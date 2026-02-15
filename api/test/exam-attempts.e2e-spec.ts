/**
 * T145: Exam Attempts E2E Tests
 *
 * Tests for exam-attempts endpoints:
 * - POST /exam-attempts/submit (public, unsigned)
 * - POST /exam-attempts/submit-authenticated (authenticated)
 * - GET /exam-attempts/my-history (pagination, filtering)
 * - GET /exam-attempts/:id (retrieve single attempt)
 * - GET /exam-attempts/analytics/my-analytics (analytics summary)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ExamAttemptModule } from '../src/exam-attempts/exam-attempt.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '../src/auth/services/jwt.service';
import { AuthModule } from '../src/auth/auth.module';

const mockUser = {
  id: 'user-uuid-123',
  googleId: 'google-user-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockExamAttempt = {
  examTypeId: 'aws-ccp',
  score: 75,
  passed: true,
  duration: 2400,
  submittedAt: new Date(),
};

describe('ExamAttempts Controller (e2e)', () => {
  let app: INestApplication<App>;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ExamAttemptModule, PrismaModule, AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        examAttempt: {
          create: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          update: jest.fn(),
          aggregate: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Generate test JWT token
    accessToken = jwtService.generateAccessToken(mockUser.id, mockUser.email);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /exam-attempts/submit', () => {
    it('should submit exam attempt without authentication (public)', async () => {
      const mockCreatedAttempt = {
        id: 'attempt-uuid-1',
        userId: null,
        ...mockExamAttempt,
        createdAt: new Date(),
        syncStatus: 'PENDING',
        syncedAt: null,
        syncRetries: 0,
      };

      jest
        .spyOn(prismaService.examAttempt, 'create')
        .mockResolvedValue(mockCreatedAttempt as any);

      const response = await request(app.getHttpServer())
        .post('/exam-attempts/submit')
        .send(mockExamAttempt)
        .expect(201);

      expect(response.body).toMatchObject({
        id: 'attempt-uuid-1',
        userId: null,
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: 2400,
        syncStatus: 'PENDING',
      });

      expect(prismaService.examAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: undefined,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
        }),
      });
    });

    it('should validate score range (0-100)', async () => {
      await request(app.getHttpServer())
        .post('/exam-attempts/submit')
        .send({ ...mockExamAttempt, score: 150 })
        .expect(400);

      await request(app.getHttpServer())
        .post('/exam-attempts/submit')
        .send({ ...mockExamAttempt, score: -10 })
        .expect(400);
    });

    it('should validate duration is non-negative', async () => {
      await request(app.getHttpServer())
        .post('/exam-attempts/submit')
        .send({ ...mockExamAttempt, duration: -100 })
        .expect(400);
    });
  });

  describe('POST /exam-attempts/submit-authenticated', () => {
    it('should submit exam attempt with user authentication', async () => {
      const mockCreatedAttempt = {
        id: 'attempt-uuid-2',
        userId: mockUser.id,
        ...mockExamAttempt,
        createdAt: new Date(),
        syncStatus: 'PENDING',
        syncedAt: null,
        syncRetries: 0,
      };

      jest
        .spyOn(prismaService.examAttempt, 'create')
        .mockResolvedValue(mockCreatedAttempt as any);

      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUser as any);

      const response = await request(app.getHttpServer())
        .post('/exam-attempts/submit-authenticated')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(mockExamAttempt)
        .expect(201);

      expect(response.body).toMatchObject({
        id: 'attempt-uuid-2',
        userId: mockUser.id,
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: 2400,
        syncStatus: 'PENDING',
      });

      expect(prismaService.examAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
        }),
      });
    });

    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/exam-attempts/submit-authenticated')
        .send(mockExamAttempt)
        .expect(401);
    });

    it('should reject invalid JWT tokens', async () => {
      await request(app.getHttpServer())
        .post('/exam-attempts/submit-authenticated')
        .set('Authorization', 'Bearer invalid-token')
        .send(mockExamAttempt)
        .expect(401);
    });
  });

  describe('GET /exam-attempts/my-history', () => {
    it('should return paginated exam history for authenticated user', async () => {
      const mockAttempts = [
        {
          id: 'attempt-1',
          userId: mockUser.id,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date('2026-01-15'),
          createdAt: new Date('2026-01-15'),
          syncStatus: 'SYNCED',
          syncedAt: new Date('2026-01-15'),
          syncRetries: 0,
        },
        {
          id: 'attempt-2',
          userId: mockUser.id,
          examTypeId: 'aws-ccp',
          score: 80,
          passed: true,
          duration: 2200,
          submittedAt: new Date('2026-01-20'),
          createdAt: new Date('2026-01-20'),
          syncStatus: 'SYNCED',
          syncedAt: new Date('2026-01-20'),
          syncRetries: 0,
        },
      ];

      jest
        .spyOn(prismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      jest.spyOn(prismaService.examAttempt, 'count').mockResolvedValue(2);

      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUser as any);

      const response = await request(app.getHttpServer())
        .get('/exam-attempts/my-history')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'attempt-1', score: 75 }),
          expect.objectContaining({ id: 'attempt-2', score: 80 }),
        ]),
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      expect(prismaService.examAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id },
          orderBy: { submittedAt: 'desc' },
        }),
      );
    });

    it('should support pagination parameters', async () => {
      const mockAttempts = Array.from({ length: 5 }, (_, i) => ({
        id: `attempt-${i + 1}`,
        userId: mockUser.id,
        examTypeId: 'aws-ccp',
        score: 75 + i,
        passed: true,
        duration: 2400,
        submittedAt: new Date(),
        createdAt: new Date(),
        syncStatus: 'SYNCED',
        syncedAt: new Date(),
        syncRetries: 0,
      }));

      jest
        .spyOn(prismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts.slice(0, 5) as any);

      jest.spyOn(prismaService.examAttempt, 'count').mockResolvedValue(25);

      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUser as any);

      const response = await request(app.getHttpServer())
        .get('/exam-attempts/my-history?page=2&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        total: 25,
        page: 2,
        limit: 5,
        totalPages: 5,
      });

      expect(prismaService.examAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page 2 - 1) * limit 5
          take: 5,
        }),
      );
    });

    it('should filter by examTypeId', async () => {
      const mockAttempts = [
        {
          id: 'attempt-1',
          userId: mockUser.id,
          examTypeId: 'aws-saa',
          score: 85,
          passed: true,
          duration: 2200,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'SYNCED',
          syncedAt: new Date(),
          syncRetries: 0,
        },
      ];

      jest
        .spyOn(prismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      jest.spyOn(prismaService.examAttempt, 'count').mockResolvedValue(1);

      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUser as any);

      const response = await request(app.getHttpServer())
        .get('/exam-attempts/my-history?examTypeId=aws-saa')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].examTypeId).toBe('aws-saa');

      expect(prismaService.examAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUser.id,
            examTypeId: 'aws-saa',
          },
        }),
      );
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/exam-attempts/my-history')
        .expect(401);
    });
  });

  describe('GET /exam-attempts/:id', () => {
    it('should return single exam attempt by ID', async () => {
      const mockAttempt = {
        id: 'attempt-uuid-1',
        userId: mockUser.id,
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: 2400,
        submittedAt: new Date(),
        createdAt: new Date(),
        syncStatus: 'SYNCED',
        syncedAt: new Date(),
        syncRetries: 0,
      };

      jest
        .spyOn(prismaService.examAttempt, 'findUnique')
        .mockResolvedValue(mockAttempt as any);

      const response = await request(app.getHttpServer())
        .get('/exam-attempts/attempt-uuid-1')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'attempt-uuid-1',
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
      });

      expect(prismaService.examAttempt.findUnique).toHaveBeenCalledWith({
        where: { id: 'attempt-uuid-1' },
      });
    });

    it('should return 404 for non-existent attempt', async () => {
      jest
        .spyOn(prismaService.examAttempt, 'findUnique')
        .mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/exam-attempts/non-existent-id')
        .expect(404);
    });

    it('should enforce ownership when authenticated', async () => {
      const mockAttempt = {
        id: 'attempt-uuid-1',
        userId: 'different-user-id',
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: 2400,
        submittedAt: new Date(),
        createdAt: new Date(),
        syncStatus: 'SYNCED',
        syncedAt: new Date(),
        syncRetries: 0,
      };

      jest
        .spyOn(prismaService.examAttempt, 'findUnique')
        .mockResolvedValue(mockAttempt as any);

      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUser as any);

      // Should return 404 to prevent user enumeration
      await request(app.getHttpServer())
        .get('/exam-attempts/attempt-uuid-1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('GET /exam-attempts/analytics/my-analytics', () => {
    it('should return analytics summary for authenticated user', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: 'SYNCED',
        },
        {
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: 'SYNCED',
        },
        {
          score: 65,
          passed: false,
          duration: 2500,
          syncStatus: 'SYNCED',
        },
      ];

      jest
        .spyOn(prismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUser as any);

      const response = await request(app.getHttpServer())
        .get('/exam-attempts/analytics/my-analytics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        totalAttempts: 3,
        totalPassed: 2,
        passRate: expect.closeTo(0.667, 2), // 2/3
        averageScore: expect.closeTo(73.33, 2), // (75+80+65)/3
        averageDuration: 2367, // (2400+2200+2500)/3
      });
    });

    it('should handle zero attempts gracefully', async () => {
      jest.spyOn(prismaService.examAttempt, 'findMany').mockResolvedValue([]);

      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUser as any);

      const response = await request(app.getHttpServer())
        .get('/exam-attempts/analytics/my-analytics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        totalAttempts: 0,
        totalPassed: 0,
        passRate: 0,
        averageScore: 0,
        averageDuration: 0,
      });
    });

    it('should filter analytics by examTypeId', async () => {
      const mockAttempts = [
        {
          examTypeId: 'aws-saa',
          score: 85,
          passed: true,
          duration: 2000,
          syncStatus: 'SYNCED',
        },
      ];

      jest
        .spyOn(prismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockUser as any);

      const response = await request(app.getHttpServer())
        .get('/exam-attempts/analytics/my-analytics?examTypeId=aws-saa')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        totalAttempts: 1,
        totalPassed: 1,
        passRate: 1,
        averageScore: 85,
        averageDuration: 2000,
      });

      expect(prismaService.examAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser.id,
            examTypeId: 'aws-saa',
          }),
        }),
      );
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/exam-attempts/analytics/my-analytics')
        .expect(401);
    });
  });
});
