/**
 * T240: Admin Exam Types E2E Tests
 *
 * Tests for admin exam-type CRUD endpoints:
 * - POST /admin/exam-types: create new exam type → 201
 * - POST /admin/exam-types: duplicate ID → 409 Conflict
 * - POST /admin/exam-types: invalid domain weights (sum != 100) → 400
 * - POST /admin/exam-types: missing required fields → 400
 * - PUT /admin/exam-types/:id: update existing → 200
 * - PUT /admin/exam-types/:id: non-existent → 404
 * - PATCH /admin/exam-types/:id: toggle active → 200, isActive flipped
 * - All endpoints require auth: no token → 401
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtService } from '@nestjs/jwt';
import { AdminModule } from '../src/admin/admin.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { jwtConfig } from '../src/config/configuration';

const JWT_SECRET = 'change-me-in-production';

const mockAdmin = {
  id: 'admin-uuid-123',
  email: 'admin@example.com',
  name: 'Test Admin',
  passwordHash: 'hash',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockExamType = {
  id: 'TEST-001',
  name: 'Test Certification',
  displayName: 'Test Cert',
  description: 'A test exam type',
  domains: [{ id: 'domain-1', name: 'Domain One', weight: 100, questionCount: 65 }],
  passingScore: 70,
  timeLimit: 90,
  questionCount: 65,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validCreateBody = {
  id: 'TEST-001',
  name: 'Test Certification',
  displayName: 'Test Cert',
  description: 'A test exam type',
  domains: [{ id: 'domain-1', name: 'Domain One', weight: 100, questionCount: 65 }],
  passingScore: 70,
  timeLimit: 90,
  questionCount: 65,
};

describe('Admin Exam Types Controller (e2e)', () => {
  let app: INestApplication<App>;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [jwtConfig], isGlobal: true }),
        AdminModule,
        PrismaModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        examType: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        admin: {
          findUnique: jest.fn(),
        },
        question: {
          findMany: jest.fn(),
          count: jest.fn(),
          aggregate: jest.fn(),
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }),
    );
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Generate a valid admin JWT token
    adminToken = jwtService.sign({ sub: mockAdmin.id, email: mockAdmin.email });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: admin JWT validation resolves to mockAdmin
    (prismaService.admin.findUnique as jest.Mock).mockResolvedValue(mockAdmin);
  });

  // ─── Auth guard tests ───────────────────────────────────────────────────────

  describe('Auth guard (all endpoints require token)', () => {
    it('POST /admin/exam-types without token → 401', async () => {
      await request(app.getHttpServer()).post('/admin/exam-types').send(validCreateBody).expect(401);
    });

    it('PUT /admin/exam-types/:id without token → 401', async () => {
      await request(app.getHttpServer())
        .put('/admin/exam-types/TEST-001')
        .send(validCreateBody)
        .expect(401);
    });

    it('PATCH /admin/exam-types/:id without token → 401', async () => {
      await request(app.getHttpServer()).patch('/admin/exam-types/TEST-001').expect(401);
    });
  });

  // ─── POST /admin/exam-types ─────────────────────────────────────────────────

  describe('POST /admin/exam-types', () => {
    it('should create a new exam type and return 201 with correct response body', async () => {
      (prismaService.examType.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.examType.create as jest.Mock).mockResolvedValue(mockExamType);

      const response = await request(app.getHttpServer())
        .post('/admin/exam-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCreateBody)
        .expect(201);

      expect(response.body.id).toBe('TEST-001');
      expect(response.body.name).toBe('Test Certification');
      expect(response.body.displayName).toBe('Test Cert');
      expect(response.body.passingScore).toBe(70);
      expect(response.body.timeLimit).toBe(90);
      expect(response.body.questionCount).toBe(65);
      expect(response.body.isActive).toBe(true);
    });

    it('should return 409 Conflict for duplicate exam type ID', async () => {
      (prismaService.examType.findUnique as jest.Mock).mockResolvedValue(mockExamType);

      const response = await request(app.getHttpServer())
        .post('/admin/exam-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCreateBody)
        .expect(409);

      expect(response.body.statusCode).toBe(409);
    });

    it('should return 400 when domain weights do not sum to 100', async () => {
      const invalidBody = {
        ...validCreateBody,
        domains: [
          { id: 'domain-1', name: 'Domain One', weight: 60, questionCount: 40 },
          { id: 'domain-2', name: 'Domain Two', weight: 30, questionCount: 25 },
          // total weight = 90, not 100
        ],
      };

      await request(app.getHttpServer())
        .post('/admin/exam-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidBody)
        .expect(400);
    });

    it('should return 400 when required fields are missing (no id)', async () => {
      const { id: _omit, ...bodyWithoutId } = validCreateBody;

      await request(app.getHttpServer())
        .post('/admin/exam-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bodyWithoutId)
        .expect(400);
    });

    it('should return 400 when required fields are missing (no domains)', async () => {
      const { domains: _omit, ...bodyWithoutDomains } = validCreateBody;

      await request(app.getHttpServer())
        .post('/admin/exam-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bodyWithoutDomains)
        .expect(400);
    });

    it('should return 400 when required fields are missing (no name)', async () => {
      const { name: _omit, ...bodyWithoutName } = validCreateBody;

      await request(app.getHttpServer())
        .post('/admin/exam-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bodyWithoutName)
        .expect(400);
    });
  });

  // ─── PUT /admin/exam-types/:id ──────────────────────────────────────────────

  describe('PUT /admin/exam-types/:id', () => {
    const updateBody = {
      name: 'Updated Certification',
      displayName: 'Updated Cert',
      description: 'Updated description',
      domains: [{ id: 'domain-1', name: 'Domain One', weight: 100, questionCount: 65 }],
      passingScore: 75,
      timeLimit: 120,
      questionCount: 65,
    };

    it('should update an existing exam type and return 200', async () => {
      const updatedExamType = { ...mockExamType, name: 'Updated Certification', passingScore: 75 };
      (prismaService.examType.findUnique as jest.Mock).mockResolvedValue(mockExamType);
      (prismaService.examType.update as jest.Mock).mockResolvedValue(updatedExamType);

      const response = await request(app.getHttpServer())
        .put('/admin/exam-types/TEST-001')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateBody)
        .expect(200);

      expect(response.body.id).toBe('TEST-001');
      expect(response.body.name).toBe('Updated Certification');
      expect(response.body.passingScore).toBe(75);
    });

    it('should return 404 when updating a non-existent exam type', async () => {
      (prismaService.examType.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .put('/admin/exam-types/NONEXISTENT-999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateBody)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 400 for invalid update body (bad domain weights)', async () => {
      const invalidUpdateBody = {
        ...updateBody,
        domains: [
          { id: 'domain-1', name: 'Domain One', weight: 50, questionCount: 32 },
          // total weight = 50, not 100
        ],
      };

      await request(app.getHttpServer())
        .put('/admin/exam-types/TEST-001')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUpdateBody)
        .expect(400);
    });
  });

  // ─── PATCH /admin/exam-types/:id ────────────────────────────────────────────

  describe('PATCH /admin/exam-types/:id', () => {
    it('should toggle isActive from true to false and return 200', async () => {
      const toggled = { ...mockExamType, isActive: false };
      (prismaService.examType.findUnique as jest.Mock).mockResolvedValue(mockExamType);
      (prismaService.examType.update as jest.Mock).mockResolvedValue(toggled);

      const response = await request(app.getHttpServer())
        .patch('/admin/exam-types/TEST-001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe('TEST-001');
      expect(response.body.isActive).toBe(false);
    });

    it('should toggle isActive from false to true and return 200', async () => {
      const inactiveExamType = { ...mockExamType, isActive: false };
      const toggled = { ...mockExamType, isActive: true };
      (prismaService.examType.findUnique as jest.Mock).mockResolvedValue(inactiveExamType);
      (prismaService.examType.update as jest.Mock).mockResolvedValue(toggled);

      const response = await request(app.getHttpServer())
        .patch('/admin/exam-types/TEST-001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.isActive).toBe(true);
    });

    it('should return 404 when toggling a non-existent exam type', async () => {
      (prismaService.examType.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .patch('/admin/exam-types/NONEXISTENT-999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });
  });
});
