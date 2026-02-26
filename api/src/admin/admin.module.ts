import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma';
import { AdminAuthService } from './auth';
import { JwtStrategy, JwtAuthGuard } from './guards';
import { QuestionsService, AdminExamTypesService, S3Service } from './services';
import {
  AdminAuthController,
  AdminQuestionsController,
  AdminExamTypesController,
} from './controllers';
import { UploadsController } from './controllers/uploads.controller';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'admin-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn =
          configService.get<string>('jwt.expiresIn') ||
          configService.get<string>('JWT_EXPIRES_IN') ||
          '7d';
        return {
          secret:
            configService.get<string>('jwt.secret') ||
            configService.get<string>('JWT_SECRET') ||
            'change-me-in-production',
          signOptions: {
            expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
          },
        };
      },
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminQuestionsController,
    AdminExamTypesController,
    UploadsController,
  ],
  providers: [
    AdminAuthService,
    JwtStrategy,
    JwtAuthGuard,
    QuestionsService,
    AdminExamTypesService,
    S3Service,
  ],
  exports: [
    AdminAuthService,
    QuestionsService,
    AdminExamTypesService,
    S3Service,
  ],
})
export class AdminModule {}
