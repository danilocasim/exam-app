import { generateExam, canGenerateExam } from '../../src/services/exam-generator.service';
import {
  getRandomQuestionsByDomain,
  getQuestionCountByDomain,
  getTotalQuestionCount,
} from '../../src/storage/repositories/question.repository';
import { getCachedExamTypeConfig } from '../../src/services/sync.service';
import { ExamTypeConfig, Question } from '../../src/storage/schema';

vi.mock('../../src/storage/repositories/question.repository');
vi.mock('../../src/services/sync.service');

describe('ExamGeneratorService', () => {
  const mockExamTypeConfig: ExamTypeConfig = {
    id: 'aws-ccp',
    name: 'AWS Cloud Practitioner',
    displayName: 'AWS CCP',
    description: 'AWS Certified Cloud Practitioner',
    domains: [
      { id: 'cloud-concepts', name: 'Cloud Concepts', weight: 0.24, questionCount: 40 },
      { id: 'security', name: 'Security and Compliance', weight: 0.3, questionCount: 50 },
      { id: 'technology', name: 'Technology', weight: 0.34, questionCount: 60 },
      { id: 'billing', name: 'Billing and Pricing', weight: 0.12, questionCount: 30 },
    ],
    passingScore: 70,
    timeLimit: 90,
    questionCount: 65,
  };

  const makeQuestions = (domain: string, count: number): Question[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${domain}-${i}`,
      text: `${domain} Question ${i}`,
      type: 'SINGLE_CHOICE' as const,
      domain,
      difficulty: 'MEDIUM' as const,
      options: [{ id: 'A', text: 'Option A' }],
      correctAnswers: ['A'],
      explanation: 'Explanation',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateExam', () => {
    it('should generate exam with exactly 65 questions following domain weighting (FR-001)', async () => {
      (getCachedExamTypeConfig as vi.Mock).mockResolvedValue(mockExamTypeConfig);
      (getTotalQuestionCount as vi.Mock).mockResolvedValue(180);
      (getQuestionCountByDomain as vi.Mock).mockResolvedValue({
        'cloud-concepts': 40,
        security: 50,
        technology: 60,
        billing: 30,
      });

      (getRandomQuestionsByDomain as vi.Mock).mockImplementation(
        async (domainId: string, count: number) => makeQuestions(domainId, count),
      );

      const result = await generateExam();

      // Total should be exactly 65
      expect(result.questions).toHaveLength(65);
      expect(result.totalQuestions).toBe(65);
      expect(result.config).toEqual(mockExamTypeConfig);

      // Verify domain distribution follows weights (with tolerance for rounding)
      const dist = result.domainDistribution;

      // Cloud Concepts: 24% of 65 = 15.6 → 15-16
      expect(dist['cloud-concepts']).toBeGreaterThanOrEqual(15);
      expect(dist['cloud-concepts']).toBeLessThanOrEqual(16);

      // Security: 30% of 65 = 19.5 → 19-20
      expect(dist['security']).toBeGreaterThanOrEqual(19);
      expect(dist['security']).toBeLessThanOrEqual(20);

      // Technology: 34% of 65 = 22.1 → 21-23 (rounding adjustment may reduce by 1)
      expect(dist['technology']).toBeGreaterThanOrEqual(21);
      expect(dist['technology']).toBeLessThanOrEqual(23);

      // Billing: 12% of 65 = 7.8 → 7-8
      expect(dist['billing']).toBeGreaterThanOrEqual(7);
      expect(dist['billing']).toBeLessThanOrEqual(8);

      // Total must be exactly 65
      const total = Object.values(dist).reduce((a, b) => a + b, 0);
      expect(total).toBe(65);

      // Verify no duplicate questions
      const questionIds = result.questions.map((q) => q.id);
      expect(new Set(questionIds).size).toBe(65);
    });

    it('should handle equal domain weights', async () => {
      const customConfig: ExamTypeConfig = {
        ...mockExamTypeConfig,
        domains: [
          { id: 'domain-1', name: 'Domain 1', weight: 0.5, questionCount: 60 },
          { id: 'domain-2', name: 'Domain 2', weight: 0.5, questionCount: 60 },
        ],
        questionCount: 100,
      };

      (getCachedExamTypeConfig as vi.Mock).mockResolvedValue(customConfig);
      (getTotalQuestionCount as vi.Mock).mockResolvedValue(120);
      (getQuestionCountByDomain as vi.Mock).mockResolvedValue({
        'domain-1': 60,
        'domain-2': 60,
      });

      (getRandomQuestionsByDomain as vi.Mock).mockImplementation(
        async (domainId: string, count: number) => makeQuestions(domainId, count),
      );

      const result = await generateExam();

      expect(result.domainDistribution['domain-1']).toBe(50);
      expect(result.domainDistribution['domain-2']).toBe(50);
    });

    it('should handle unequal distribution with rounding', async () => {
      const customConfig: ExamTypeConfig = {
        ...mockExamTypeConfig,
        domains: [
          { id: 'd1', name: 'D1', weight: 0.33, questionCount: 50 },
          { id: 'd2', name: 'D2', weight: 0.33, questionCount: 50 },
          { id: 'd3', name: 'D3', weight: 0.34, questionCount: 50 },
        ],
        questionCount: 100,
      };

      (getCachedExamTypeConfig as vi.Mock).mockResolvedValue(customConfig);
      (getTotalQuestionCount as vi.Mock).mockResolvedValue(150);
      (getQuestionCountByDomain as vi.Mock).mockResolvedValue({
        d1: 50,
        d2: 50,
        d3: 50,
      });

      (getRandomQuestionsByDomain as vi.Mock).mockImplementation(
        async (domainId: string, count: number) => makeQuestions(domainId, count),
      );

      const result = await generateExam();
      const total = Object.values(result.domainDistribution).reduce((a, b) => a + b, 0);

      expect(total).toBe(100);
    });

    it('should throw error when no exam config is found', async () => {
      (getCachedExamTypeConfig as vi.Mock).mockResolvedValue(null);

      await expect(generateExam()).rejects.toThrow('Exam configuration not found');
    });

    it('should throw error when no questions are available', async () => {
      (getCachedExamTypeConfig as vi.Mock).mockResolvedValue(mockExamTypeConfig);
      (getTotalQuestionCount as vi.Mock).mockResolvedValue(0);
      (getQuestionCountByDomain as vi.Mock).mockResolvedValue({});

      await expect(generateExam()).rejects.toThrow('No questions available');
    });

    it('should return shuffled questions with no duplicates', async () => {
      (getCachedExamTypeConfig as vi.Mock).mockResolvedValue(mockExamTypeConfig);
      (getTotalQuestionCount as vi.Mock).mockResolvedValue(180);
      (getQuestionCountByDomain as vi.Mock).mockResolvedValue({
        'cloud-concepts': 40,
        security: 50,
        technology: 60,
        billing: 30,
      });

      (getRandomQuestionsByDomain as vi.Mock).mockImplementation(
        async (domainId: string, count: number) => makeQuestions(domainId, count),
      );

      const result = await generateExam();

      expect(result.questions).toHaveLength(65);
      const ids = result.questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(65);
    });
  });

  describe('canGenerateExam', () => {
    it('should return true when enough questions available', async () => {
      (getCachedExamTypeConfig as vi.Mock).mockResolvedValue(mockExamTypeConfig);
      (getTotalQuestionCount as vi.Mock).mockResolvedValue(200);

      const result = await canGenerateExam();

      expect(result.canGenerate).toBe(true);
      expect(result.totalAvailable).toBe(200);
      expect(result.totalRequired).toBe(65);
      expect(result.shortfall).toBe(0);
    });

    it('should return false when not enough questions available', async () => {
      (getCachedExamTypeConfig as vi.Mock).mockResolvedValue(mockExamTypeConfig);
      (getTotalQuestionCount as vi.Mock).mockResolvedValue(30);

      const result = await canGenerateExam();

      expect(result.canGenerate).toBe(false);
      expect(result.shortfall).toBe(35);
    });

    it('should return false when no config available', async () => {
      (getCachedExamTypeConfig as vi.Mock).mockResolvedValue(null);

      const result = await canGenerateExam();

      expect(result.canGenerate).toBe(false);
    });
  });
});
