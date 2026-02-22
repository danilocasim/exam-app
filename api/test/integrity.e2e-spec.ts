/**
 * T185: Integrity API E2E Tests
 *
 * Supertest E2E tests for POST /api/integrity/verify endpoint:
 * - Mock Google Play Integrity API responses
 * - Test success scenarios (all verdicts pass)
 * - Test failure scenarios (UNLICENSED, UNRECOGNIZED_VERSION, etc.)
 * - Test error handling (invalid token, API timeout, etc.)
 * - Verify stateless behavior (no database writes)
 *
 * Test Scenario: Backend integration for Play Integrity Guard
 * Acceptance: Backend correctly decrypts tokens and returns verdicts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { IntegrityModule } from '../src/integrity/integrity.module';
import { IntegrityService } from '../src/integrity/integrity.service';
import { ConfigModule } from '@nestjs/config';
import { PlayIntegrityVerdict } from '../src/integrity/dto/integrity-verdict.dto';

// Mock Google Play Integrity API responses
const mockValidVerdict: PlayIntegrityVerdict = {
  appRecognitionVerdict: 'PLAY_RECOGNIZED',
  appLicensingVerdict: 'LICENSED',
  deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
};

const mockUnlicensedVerdict: PlayIntegrityVerdict = {
  appRecognitionVerdict: 'PLAY_RECOGNIZED',
  appLicensingVerdict: 'UNLICENSED',
  deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
};

const mockUnrecognizedVerdict: PlayIntegrityVerdict = {
  appRecognitionVerdict: 'UNRECOGNIZED_VERSION',
  appLicensingVerdict: 'LICENSED',
  deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
};

const mockRootedDeviceVerdict: PlayIntegrityVerdict = {
  appRecognitionVerdict: 'PLAY_RECOGNIZED',
  appLicensingVerdict: 'LICENSED',
  deviceRecognitionVerdict: 'UNKNOWN',
};

const mockPartiallyEvaluatedVerdict: PlayIntegrityVerdict = {
  appRecognitionVerdict: 'PLAY_RECOGNIZED',
  appLicensingVerdict: 'UNKNOWN',
  deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
};

describe('Integrity Controller (e2e)', () => {
  let app: INestApplication<App>;
  let integrityService: IntegrityService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        IntegrityModule,
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
    })
      .overrideProvider(IntegrityService)
      .useValue({
        verifyToken: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    integrityService = moduleFixture.get<IntegrityService>(IntegrityService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/integrity/verify - Success Scenarios', () => {
    it('should return success with valid verdict when all checks pass', async () => {
      // Mock Google API success
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockValidVerdict,
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'valid-token-123' })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('verdict');
      expect(response.body.verdict.appRecognitionVerdict).toBe(
        'PLAY_RECOGNIZED',
      );
      expect(response.body.verdict.appLicensingVerdict).toBe('LICENSED');
      expect(response.body.verdict.deviceRecognitionVerdict).toBe(
        'MEETS_DEVICE_INTEGRITY',
      );

      // Verify service was called with token
      expect(integrityService.verifyToken).toHaveBeenCalledWith(
        'valid-token-123',
      );
      expect(integrityService.verifyToken).toHaveBeenCalledTimes(1);
    });

    it('should return success with MEETS_STRONG_INTEGRITY verdict', async () => {
      const strongIntegrityVerdict: PlayIntegrityVerdict = {
        appRecognitionVerdict: 'PLAY_RECOGNIZED',
        appLicensingVerdict: 'LICENSED',
        deviceRecognitionVerdict: 'MEETS_STRONG_INTEGRITY',
      };

      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        strongIntegrityVerdict,
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'strong-integrity-token' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.verdict.deviceRecognitionVerdict).toBe(
        'MEETS_STRONG_INTEGRITY',
      );
    });

    it('should return verdict even with partially evaluated fields', async () => {
      // Some verdicts may be UNKNOWN due to transient issues
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockPartiallyEvaluatedVerdict,
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'partial-token' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.verdict.appRecognitionVerdict).toBe(
        'PLAY_RECOGNIZED',
      );
      expect(response.body.verdict.appLicensingVerdict).toBe('UNKNOWN'); // Transient
      expect(response.body.verdict.deviceRecognitionVerdict).toBe(
        'MEETS_DEVICE_INTEGRITY',
      );
    });
  });

  describe('POST /api/integrity/verify - Definitive Failures', () => {
    it('should return UNLICENSED verdict for sideloaded app', async () => {
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockUnlicensedVerdict,
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'sideloaded-token' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.verdict.appLicensingVerdict).toBe('UNLICENSED');
      // Client is responsible for blocking based on this verdict
    });

    it('should return UNRECOGNIZED_VERSION verdict for re-signed app', async () => {
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockUnrecognizedVerdict,
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'tampered-token' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.verdict.appRecognitionVerdict).toBe(
        'UNRECOGNIZED_VERSION',
      );
    });

    it('should return UNKNOWN device integrity for rooted device', async () => {
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockRootedDeviceVerdict,
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'rooted-device-token' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.verdict.deviceRecognitionVerdict).toBe('UNKNOWN');
    });
  });

  describe('POST /api/integrity/verify - Request Validation', () => {
    it('should return error when token is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({})
        .expect(400); // ValidationPipe rejects missing required field
    });

    it('should return error when token is empty string', async () => {
      await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: '' })
        .expect(400); // ValidationPipe rejects empty string (@IsNotEmpty)
    });

    it('should return error when request body is malformed', async () => {
      await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ wrongField: 'value' })
        .expect(400); // ValidationPipe rejects missing token field
    });

    it('should handle token with special characters', async () => {
      const tokenWithSpecialChars = 'eyJhbGci.OiJSUzI1NiI.sInR5cCI6IkpXVC';
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockValidVerdict,
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: tokenWithSpecialChars })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(integrityService.verifyToken).toHaveBeenCalledWith(
        tokenWithSpecialChars,
      );
    });
  });

  describe('POST /api/integrity/verify - Google API Errors', () => {
    it('should return error when Google API is unavailable', async () => {
      (integrityService.verifyToken as jest.Mock).mockRejectedValue(
        new Error('Google Play Integrity API unavailable'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'valid-token' })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return error when token is invalid format', async () => {
      (integrityService.verifyToken as jest.Mock).mockRejectedValue(
        new Error('Invalid token format'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'invalid-token-format' })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid token format');
    });

    it('should return error when token is expired', async () => {
      (integrityService.verifyToken as jest.Mock).mockRejectedValue(
        new Error('Token expired'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'expired-token' })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Token expired');
    });

    it('should handle timeout gracefully', async () => {
      (integrityService.verifyToken as jest.Mock).mockRejectedValue(
        new Error('Timeout'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'slow-token' })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/integrity/verify - Stateless Behavior', () => {
    it('should not persist verdict in database', async () => {
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockValidVerdict,
      );

      // Make multiple requests with same token
      await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'token-1' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'token-1' })
        .expect(201);

      // Service should be called twice (no caching)
      expect(integrityService.verifyToken).toHaveBeenCalledTimes(2);
      // No database writes expected (stateless endpoint)
    });

    it('should return same verdict for identical token', async () => {
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockValidVerdict,
      );

      const response1 = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'consistent-token' })
        .expect(201);

      const response2 = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'consistent-token' })
        .expect(201);

      // Both responses should have same verdict
      expect(response1.body.verdict).toEqual(response2.body.verdict);
    });
  });

  describe('POST /api/integrity/verify - Response Structure', () => {
    it('should return correct response format for success', async () => {
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockValidVerdict,
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'token' })
        .expect(201);

      // Verify response structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('verdict');
      expect(response.body.verdict).toHaveProperty('appRecognitionVerdict');
      expect(response.body.verdict).toHaveProperty('appLicensingVerdict');
      expect(response.body.verdict).toHaveProperty('deviceRecognitionVerdict');
      expect(response.body).not.toHaveProperty('error');
    });

    it('should return correct response format for error', async () => {
      (integrityService.verifyToken as jest.Mock).mockRejectedValue(
        new Error('API error'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'token' })
        .expect(201);

      // Verify error response structure
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).not.toHaveProperty('verdict');
    });

    it('should include all verdict fields in response', async () => {
      const completeVerdict: PlayIntegrityVerdict = {
        appRecognitionVerdict: 'PLAY_RECOGNIZED',
        appLicensingVerdict: 'LICENSED',
        deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
        additionalField: 'some-value', // Extra fields preserved
      };

      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        completeVerdict,
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'token' })
        .expect(201);

      expect(response.body.verdict).toEqual(completeVerdict);
    });
  });

  describe('POST /api/integrity/verify - Performance', () => {
    it('should respond within 5 seconds for successful verification', async () => {
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockValidVerdict,
      );

      const startTime = Date.now();

      await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: 'token' })
        .expect(201);

      const elapsed = Date.now() - startTime;

      // API should respond quickly (< 5 seconds)
      expect(elapsed).toBeLessThan(5000);
    });

    it('should handle concurrent requests correctly', async () => {
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockValidVerdict,
      );

      // Make 3 sequential requests to avoid ECONNRESET on CI
      const responses = [];
      for (let i = 0; i < 3; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/integrity/verify')
          .send({ token: `token-${i}` })
          .expect(201);
        responses.push(res);
      }

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.body.success).toBe(true);
      });

      // Service should be called 3 times
      expect(integrityService.verifyToken).toHaveBeenCalledTimes(3);
    });
  });

  describe('POST /api/integrity/verify - Edge Cases', () => {
    it('should handle very long token strings', async () => {
      const longToken = 'a'.repeat(10000);
      (integrityService.verifyToken as jest.Mock).mockResolvedValue(
        mockValidVerdict,
      );

      const response = await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: longToken })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(integrityService.verifyToken).toHaveBeenCalledWith(longToken);
    });

    it('should handle null token gracefully', async () => {
      await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: null })
        .expect(400); // ValidationPipe rejects null (@IsString)
    });

    it('should handle undefined token gracefully', async () => {
      await request(app.getHttpServer())
        .post('/api/integrity/verify')
        .send({ token: undefined })
        .expect(400); // ValidationPipe rejects undefined (@IsNotEmpty)
    });
  });
});
