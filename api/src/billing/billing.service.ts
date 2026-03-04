/**
 * T262.5: Billing Service — Server-side subscription validation via Google Play Developer API.
 *
 * Validates subscription purchase tokens by calling the Google Play Developer API
 * (`purchases.subscriptionsv2.get`). Reuses the same service account credentials
 * as the Play Integrity module.
 *
 * Provides additional security against local subscription spoofing — the mobile app
 * can call this endpoint periodically (e.g., on app launch when online) to re-validate
 * subscription status against Google's authoritative backend.
 */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { VerifySubscriptionResponse } from './dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly serviceAccountKeyPath: string;
  private googleAuth: GoogleAuth | null = null;

  constructor(private readonly configService: ConfigService) {
    this.serviceAccountKeyPath =
      this.configService.get<string>(
        'playIntegrity.googleServiceAccountKeyPath',
      ) || '';
  }

  /**
   * Initialize Google Auth client with service account credentials.
   * Scoped to `androidpublisher` for Google Play Developer API access.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async getGoogleAuth(): Promise<GoogleAuth> {
    if (this.googleAuth) {
      return this.googleAuth;
    }

    try {
      const inlineKey = this.configService.get<string>(
        'playIntegrity.googleServiceAccountKey',
      );
      let credentials: Record<string, unknown>;

      if (inlineKey) {
        this.logger.log(
          'Using inline GOOGLE_SERVICE_ACCOUNT_KEY environment variable',
        );
        credentials = JSON.parse(inlineKey) as Record<string, unknown>;
      } else {
        const keyPath = path.resolve(process.cwd(), this.serviceAccountKeyPath);

        if (!fs.existsSync(keyPath)) {
          throw new Error(
            `Service account key file not found at: ${keyPath}. ` +
              'Set GOOGLE_SERVICE_ACCOUNT_KEY env var or provide the file.',
          );
        }

        const keyFileContent = fs.readFileSync(keyPath, 'utf8');
        credentials = JSON.parse(keyFileContent) as Record<string, unknown>;
      }

      this.googleAuth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });

      this.logger.log(
        'Google Auth client initialized for Android Publisher API',
      );
      return this.googleAuth;
    } catch (error) {
      this.logger.error(
        `Failed to initialize Google Auth: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Failed to initialize Google authentication for billing verification',
      );
    }
  }

  /**
   * Verify a subscription purchase token with the Google Play Developer API.
   *
   * Uses `purchases.subscriptionsv2.get` which returns comprehensive subscription
   * state including expiry, auto-renewal status, payment state, and cancellation reason.
   *
   * @param packageName - Android package name (e.g., "com.danilocasim.dojoexam.clfc02")
   * @param purchaseToken - Purchase token from the client-side purchase
   * @returns VerifySubscriptionResponse with subscription validity and metadata
   */
  async verifySubscription(
    packageName: string,
    purchaseToken: string,
  ): Promise<VerifySubscriptionResponse> {
    this.logger.debug(`Verifying subscription for package: ${packageName}`);

    try {
      const auth = await this.getGoogleAuth();
      const authClient = await auth.getClient();

      const androidPublisher = google.androidpublisher({
        version: 'v3',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        auth: authClient as any,
      });

      // Use subscriptionsv2.get for comprehensive subscription state
      const response = await androidPublisher.purchases.subscriptionsv2.get({
        packageName,
        token: purchaseToken,
      });

      const subscription = response.data;

      // Parse expiry time
      const expiryTimeMillis = subscription.lineItems?.[0]?.expiryTime
        ? new Date(subscription.lineItems[0].expiryTime).getTime()
        : 0;

      // Determine auto-renewal from subscription state
      const autoRenewing =
        subscription.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' &&
        !subscription.canceledStateContext;

      // Map subscription state to a numeric payment state for client compatibility
      // 0 = payment pending, 1 = payment received, 2 = free trial, 3 = deferred upgrade/downgrade
      let paymentState = 0;
      switch (subscription.subscriptionState) {
        case 'SUBSCRIPTION_STATE_ACTIVE':
          paymentState = 1;
          break;
        case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
          paymentState = 1; // Still considered paid during grace period
          break;
        case 'SUBSCRIPTION_STATE_ON_HOLD':
          paymentState = 0;
          break;
        case 'SUBSCRIPTION_STATE_PAUSED':
          paymentState = 0;
          break;
        case 'SUBSCRIPTION_STATE_CANCELED':
          paymentState = 1; // Access continues until expiry
          break;
        case 'SUBSCRIPTION_STATE_EXPIRED':
          paymentState = 0;
          break;
        case 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED':
          paymentState = 0;
          break;
        default:
          paymentState = 0;
      }

      // Determine cancel reason if applicable
      let cancelReason: number | undefined;
      if (subscription.canceledStateContext) {
        if (subscription.canceledStateContext.userInitiatedCancellation) {
          cancelReason = 0; // User cancelled
        } else if (
          subscription.canceledStateContext.systemInitiatedCancellation
        ) {
          cancelReason = 1; // System cancelled (billing failure)
        } else if (
          subscription.canceledStateContext.developerInitiatedCancellation
        ) {
          cancelReason = 2; // Developer cancelled (e.g., revoked)
        } else if (subscription.canceledStateContext.replacementCancellation) {
          cancelReason = 3; // Replaced by another subscription
        }
      }

      // Subscription is valid if it's active, in grace period, or cancelled but not yet expired
      const isExpired = expiryTimeMillis
        ? expiryTimeMillis <= Date.now()
        : true;
      const valid =
        !isExpired ||
        subscription.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' ||
        subscription.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';

      this.logger.log(
        `Subscription verification: valid=${valid}, state=${subscription.subscriptionState}, expiry=${new Date(expiryTimeMillis).toISOString()}`,
      );

      return {
        valid,
        expiryTimeMillis,
        autoRenewing,
        paymentState,
        cancelReason,
      };
    } catch (error: unknown) {
      const apiError = error as { code?: number; message?: string };

      // Handle specific Google API errors
      if (apiError.code === 410) {
        // 410 Gone — purchase token expired or invalid
        this.logger.warn(
          `Subscription token expired or invalid for package: ${packageName}`,
        );
        return {
          valid: false,
          expiryTimeMillis: 0,
          autoRenewing: false,
          paymentState: 0,
        };
      }

      if (apiError.code === 404) {
        // 404 Not Found — subscription not found
        this.logger.warn(`Subscription not found for package: ${packageName}`);
        return {
          valid: false,
          expiryTimeMillis: 0,
          autoRenewing: false,
          paymentState: 0,
        };
      }

      this.logger.error(
        `Failed to verify subscription: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Failed to verify subscription with Google Play',
      );
    }
  }
}
