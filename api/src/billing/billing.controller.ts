import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { VerifySubscriptionRequest, VerifySubscriptionResponse } from './dto';

@Controller('api/billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * POST /api/billing/verify-subscription
   *
   * Verifies a Google Play subscription purchase token server-side.
   * Requires JWT authentication.
   */
  @Post('verify-subscription')
  async verifySubscription(
    @Body() dto: VerifySubscriptionRequest,
  ): Promise<VerifySubscriptionResponse> {
    return this.billingService.verifySubscription(
      dto.packageName,
      dto.purchaseToken,
    );
  }
}
