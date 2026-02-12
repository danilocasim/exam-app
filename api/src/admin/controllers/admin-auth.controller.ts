import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AdminAuthService, LoginResponse } from '../auth/admin-auth.service';
import { LoginDto } from '../dto';

/**
 * T078: POST /admin/auth/login endpoint
 */
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.adminAuthService.login(loginDto.email, loginDto.password);
  }
}
