import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { GoogleOAuthService } from './services/google-oauth.service';
import { UserService } from './services/user.service';
import { JwtService } from './services/jwt.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Authentication Module
 * Handles Google OAuth sign-in and JWT token management
 *
 * Features:
 * - Google OAuth verification
 * - User account management (find/create)
 * - JWT token generation and refresh
 * - Passport.js JWT strategy
 *
 * Exports:
 * - JwtAuthGuard (imported from guards externally)
 * - JwtService (for token generation in other modules)
 * - GoogleOAuthService (for OAuth verification)
 */
@Module({
  imports: [PassportModule, PrismaModule],
  controllers: [AuthController],
  providers: [
    GoogleOAuthService,
    UserService,
    JwtService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [JwtService, JwtAuthGuard, GoogleOAuthService, UserService],
})
export class AuthModule {}
