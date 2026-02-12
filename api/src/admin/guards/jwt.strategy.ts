import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import {
  AdminAuthService,
  JwtPayload,
  AdminUser,
} from '../auth/admin-auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    configService: ConfigService,
    private readonly adminAuthService: AdminAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('jwt.secret') ||
        configService.get<string>('JWT_SECRET') ||
        'change-me-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<AdminUser> {
    const admin = await this.adminAuthService.validateAdmin(payload.sub);
    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }
    return admin;
  }
}
