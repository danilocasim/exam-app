import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { ExamTypesModule } from './exam-types';
import { AdminModule } from './admin';
import { AuthModule } from './auth/auth.module';
import { ExamAttemptModule } from './exam-attempts/exam-attempt.module';
import { SyncModule } from './sync/sync.module';
import {
  RequestLoggerMiddleware,
  RateLimitMiddleware,
} from './common/middleware';
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  corsConfig,
  authConfig,
  playIntegrityConfig,
} from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        corsConfig,
        authConfig,
        playIntegrityConfig,
      ],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'admin-portal', 'dist'),
      serveRoot: '/portal',
      serveStaticOptions: {
        index: ['index.html'],
      },
    }),
    PrismaModule,
    ExamTypesModule,
    AdminModule,
    AuthModule,
    ExamAttemptModule,
    SyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
