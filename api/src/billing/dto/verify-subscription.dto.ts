/**
 * T262.5: DTOs for subscription verification endpoint.
 */
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifySubscriptionRequest {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  purchaseToken: string;

  @IsString()
  @IsNotEmpty()
  packageName: string;
}

export class VerifySubscriptionResponse {
  valid: boolean;
  expiryTimeMillis: number;
  autoRenewing: boolean;
  paymentState: number;
  cancelReason?: number;
}
