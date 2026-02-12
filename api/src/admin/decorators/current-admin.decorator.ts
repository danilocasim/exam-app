import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminUser } from '../auth/admin-auth.service';

/**
 * Extract the authenticated admin user from the request.
 * Usage: @CurrentAdmin() admin: AdminUser
 */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AdminUser }>();
    return request.user;
  },
);
