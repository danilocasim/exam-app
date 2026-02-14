import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { QuestionsService } from '../../src/admin/services/questions.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { QuestionInputDto } from '../../src/admin/dto/question-input.dto';
import { QuestionStatus, Difficulty } from '@prisma/client';

describe('QuestionsService (Admin)', () => {
  let service: QuestionsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockExamType = {
    id: 'aws-ccp',
    name: 'AWS Cloud Practitioner',
    displayName: 'AWS CCP',
    description: 'AWS test',
    domains: JSON.stringify([
      { id: 'cloud-concepts', name: 'Cloud Concepts', weight: 0.24 },
    ]),
    passingScore: 70,
    timeLimit: 90,
    questionCount: 65,
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsService,
        {
          provide: PrismaService,
          useValue: {
            examType: {
              findUnique: jest.fn(),
            },
            question: {
              findMany: jest.fn(),
              count: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            syncVersion: {
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<QuestionsService>(QuestionsService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  describe('create (T082)', () => {
    const validInput: QuestionInputDto = {
      examTypeId: 'aws-ccp',
      text: 'What is AWS? This is a test question with at least 20 characters.',
      type: 'SINGLE_CHOICE',
      domain: 'cloud-concepts',
      difficulty: 'EASY',
      options: [
        { label: 'A', text: 'Option A' },
        { label: 'B', text: 'Option B' },
        { label: 'C', text: 'Option C' },
        { label: 'D', text: 'Option D' },
      ],
      correctAnswers: ['A'],
      explanation: 'This is a detailed explanation with at least 50 characters to meet requirements.',
    };

    it('should create question with DRAFT status (FR-023)', async () => {
      (prisma.examType.findUnique as jest.Mock).mockResolvedValue(mockExamType);
      (prisma.question.findFirst as jest.Mock).mockResolvedValue(null); // No duplicates
      (prisma.question.create as jest.Mock).mockResolvedValue({
        id: 'q-123',
        ...validInput,
        status: QuestionStatus.DRAFT,
        createdById: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(validInput, 'admin-1');

      expect(result.id).toBe('q-123');
      expect(result.status).toBe(QuestionStatus.DRAFT);
      expect(prisma.question.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: QuestionStatus.DRAFT,
            createdById: 'admin-1',
          }),
        }),
      );
    });

    it('should reject question with text < 20 characters (FR-025)', async () => {
      const invalidInput = {
        ...validInput,
        text: 'Too short', // 9 characters
      };

      await expect(service.create(invalidInput, 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject question with explanation < 50 characters (FR-025)', async () => {
      const invalidInput = {
        ...validInput,
        explanation: 'Too short explanation', // < 50 chars
      };

      await expect(service.create(invalidInput, 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject < 4 options for single-choice (FR-025)', async () => {
      const invalidInput = {
        ...validInput,
        options: [
          { label: 'A', text: 'Option A' },
          { label: 'B', text: 'Option B' },
          { label: 'C', text: 'Option C' }, // Only 3 options
        ],
      };

      await expect(service.create(invalidInput, 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should detect duplicate questions (exact text match, FR-025)', async () => {
      (prisma.examType.findUnique as jest.Mock).mockResolvedValue(mockExamType);
      (prisma.question.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-q',
        text: validInput.text,
      }); // Duplicate found

      await expect(service.create(validInput, 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should not detect duplicate if existing question is ARCHIVED', async () => {
      (prisma.examType.findUnique as jest.Mock).mockResolvedValue(mockExamType);
      (prisma.question.findFirst as jest.Mock).mockResolvedValue(null); // Archived questions are excluded
      (prisma.question.create as jest.Mock).mockResolvedValue({
        id: 'q-new',
        ...validInput,
        status: QuestionStatus.DRAFT,
      });

      const result = await service.create(validInput, 'admin-1');

      expect(result).toBeDefined();
    });

    it('should throw error if exam type not found', async () => {
      (prisma.examType.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create(validInput, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('approve (T085)', () => {
    it('should move question from DRAFT to APPROVED (FR-023)', async () => {
      (prisma.question.findUnique as jest.Mock).mockResolvedValue({
        id: 'q-123',
        status: QuestionStatus.DRAFT,
        examTypeId: 'aws-ccp',
      });

      (prisma.question.update as jest.Mock).mockResolvedValue({
        id: 'q-123',
        status: QuestionStatus.APPROVED,
      });

      (prisma.syncVersion.update as jest.Mock).mockResolvedValue({
        version: 2,
      });

      const result = await service.approve('q-123', 'admin-1');

      expect(result.status).toBe(QuestionStatus.APPROVED);
      expect(prisma.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'q-123' },
          data: expect.objectContaining({
            status: QuestionStatus.APPROVED,
          }),
        }),
      );
    });

    it('should increment SyncVersion on approval (for mobile sync notification)', async () => {
      (prisma.question.findUnique as jest.Mock).mockResolvedValue({
        id: 'q-123',
        status: QuestionStatus.DRAFT,
        examTypeId: 'aws-ccp',
      });

      (prisma.question.update as jest.Mock).mockResolvedValue({
        id: 'q-123',
        status: QuestionStatus.APPROVED,
      });

      (prisma.syncVersion.update as jest.Mock).mockResolvedValue({
        version: 3,
      });

      await service.approve('q-123', 'admin-1');

      expect(prisma.syncVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { examTypeId: 'aws-ccp' },
        }),
      );
    });

    it('should throw error if question not found', async () => {
      (prisma.question.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.approve('nonexistent', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('archive (T086)', () => {
    it('should archive question without losing historical data (FR-024)', async () => {
      (prisma.question.findUnique as jest.Mock).mockResolvedValue({
        id: 'q-123',
        status: QuestionStatus.APPROVED,
      });

      (prisma.question.update as jest.Mock).mockResolvedValue({
        id: 'q-123',
        status: QuestionStatus.ARCHIVED,
      });

      const result = await service.archive('q-123');

      expect(result.status).toBe(QuestionStatus.ARCHIVED);
      expect(prisma.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'q-123' },
          data: expect.objectContaining({
            status: QuestionStatus.ARCHIVED,
          }),
        }),
      );
    });

    it('should allow restoring archived questions (FR-024)', async () => {
      (prisma.question.findUnique as jest.Mock).mockResolvedValue({
        id: 'q-123',
        status: QuestionStatus.ARCHIVED,
      });

      (prisma.question.update as jest.Mock).mockResolvedValue({
        id: 'q-123',
        status: QuestionStatus.APPROVED,
      });

      const result = await service.restore('q-123');

      expect(result.status).toBe(QuestionStatus.APPROVED);
    });
  });

  describe('findAll (T081)', () => {
    it('should list questions with pagination', async () => {
      (prisma.question.findMany as jest.Mock).mockResolvedValue([
        { id: 'q-1', text: 'Q1', status: QuestionStatus.APPROVED },
        { id: 'q-2', text: 'Q2', status: QuestionStatus.APPROVED },
      ]);

      (prisma.question.count as jest.Mock).mockResolvedValue(100);

      const result = await service.findAll({
        examTypeId: 'aws-ccp',
        page: 1,
        limit: 20,
      });

      expect(result.questions).toHaveLength(2);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(5);
    });

    it('should filter by status (DRAFT, APPROVED, ARCHIVED)', async () => {
      (prisma.question.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.question.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({
        examTypeId: 'aws-ccp',
        status: QuestionStatus.DRAFT,
      });

      expect(prisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: QuestionStatus.DRAFT,
          }),
        }),
      );
    });

    it('should filter by domain and difficulty', async () => {
      (prisma.question.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.question.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({
        examTypeId: 'aws-ccp',
        domain: 'cloud-concepts',
        difficulty: 'HARD',
      });

      expect(prisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            domain: 'cloud-concepts',
            difficulty: 'HARD',
          }),
        }),
      );
    });
  });
});
