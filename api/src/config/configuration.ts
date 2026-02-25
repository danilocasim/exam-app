import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || '',
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'change-me-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
}));

export const corsConfig = registerAs('cors', () => ({
  enabled: process.env.CORS_ENABLED !== 'false',
  origin: process.env.CORS_ORIGIN?.split(',') || ['*'],
}));

export const authConfig = registerAs('auth', () => ({
  googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'change-me-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-in-production',
}));

export const playIntegrityConfig = registerAs('playIntegrity', () => ({
  googleCloudProjectNumber: process.env.GOOGLE_CLOUD_PROJECT_NUMBER || '',
  googleServiceAccountKeyPath:
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '',
  googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '',
}));
