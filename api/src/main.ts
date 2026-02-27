import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter, PrismaExceptionFilter } from './common/filters';
import multipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // Increase bodyLimit to 5 MB to accommodate bulk question imports (up to 500 questions)
    new FastifyAdapter({ bodyLimit: 5 * 1024 * 1024 }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  const logger = new Logger('Bootstrap');

  // Register Fastify multipart for file uploads
  await app.register(multipart as any, {
    limits: {
      fileSize: 2 * 1024 * 1024, // 2MB
    },
  });

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`Application running on: http://localhost:${port}`);
}
bootstrap();
