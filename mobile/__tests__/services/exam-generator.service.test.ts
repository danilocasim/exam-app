import { generateExam, selectQuestionsByDomain, calculateDomainQuotaDistribution } from '../../src/services/exam-generator.service';
import { getQuestionsByDomainAndStatus } from '../../src/storage/repositories/question.repository';
import { ExamTypeConfig, Question } from '../../src/storage/schema';

jest.mock('../../src/storage/repositories/question.repository');

describe('ExamGeneratorService', () => {
  const mockExamTypeConfig: ExamTypeConfig = {
    id: 'aws-ccp',
    name: 'AWS Cloud Practitioner',
    displayName: 'AWS CCP',
    description: 'AWS Certified Cloud Practitioner',
    domains: [
      { id: 'cloud-concepts', name: 'Cloud Concepts', weight: 0.24 },
      { id: 'security', name: 'Security and Compliance', weight: 0.30 },
      { id: 'technology', name: 'Technology', weight: 0.34 },
      { id: 'billing', name: 'Billing and Pricing', weight: 0.12 },
    ],
    passingScore: 70,
    timeLimit: 90,
    questionCount: 65,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDomainQuotaDistribution', () => {
    it('should distribute 65 questions across domains with correct weightings (FR-001)', () => {
      const distribution = calculateDomainQuotaDistribution(
        mockExamTypeConfig.domains,
        mockExamTypeConfig.questionCount,
      );

      // Cloud Concepts: 24% of 65 = 15.6 → 15-16
      expect(distribution['cloud-concepts']).toBeGreaterThanOrEqual(15);
      expect(distribution['cloud-concepts']).toBeLessThanOrEqual(16);

      // Security: 30% of 65 = 19.5 → 19-20
      expect(distribution['security']).toBeGreaterThanOrEqual(19);
      expect(distribution['security']).toBeLessThanOrEqual(20);

      // Technology: 34% of 65 = 22.1 → 22-23
      expect(distribution['technology']).toBeGreaterThanOrEqual(22);
      expect(distribution['technology']).toBeLessThanOrEqual(23);

      // Billing: 12% of 65 = 7.8 → 7-8
      expect(distribution['billing']).toBeGreaterThanOrEqual(7);
      expect(distribution['billing']).toBeLessThanOrEqual(8);

      // Total must be exactly 65
      const total = Object.values(distribution).reduce((a, b) => a + b, 0);
      expect(total).toBe(65);
    });

    it('should handle custom domain weights', () => {
      const customDomains = [
        { id: 'domain-1', name: 'Domain 1', weight: 0.5 },
        { id: 'domain-2', name: 'Domain 2', weight: 0.5 },
      ];

      const distribution = calculateDomainQuotaDistribution(customDomains, 100);

      expect(distribution['domain-1']).toBe(50);
      expect(distribution['domain-2']).toBe(50);
    });

    it('should handle unequal distribution with rounding', () => {
      const domains = [
        { id: 'd1', name: 'D1', weight: 0.33 },
        { id: 'd2', name: 'D2', weight: 0.33 },
        { id: 'd3', name: 'D3', weight: 0.34 },
      ];

      const distribution = calculateDomainQuotaDistribution(domains, 100);
      const total = Object.values(distribution).reduce((a, b) => a + b, 0);

      expect(total).toBe(100);
    });
  });

  describe('selectQuestionsByDomain', () => {
    it('should select random questions from domain meeting quota', () => {
      const availableQuestions: Question[] = Array.from({ length: 100 }, (_, i) => ({
        id: `q-${i}`,
        text: `Question ${i}`,
        type: 'SINGLE_CHOICE',
        domain: 'cloud-concepts',
        difficulty: 'MEDIUM',
        options: [{ label: 'A', text: 'Option A' }],
        correctAnswers: ['A'],
        explanation: 'Exp',
        examTypeId: 'aws-ccp',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const selected = selectQuestionsByDomain(availableQuestions, 16);

      expect(selected).toHaveLength(16);
      expect(new Set(selected.map((q) => q.id)).size).toBe(16); // All unique
    });

    it('should ensure no duplicate questions in single exam', () => {
      const availableQuestions: Question[] = Array.from({ length: 80 }, (_, i) => ({
        id: `q-${i}`,
        text: `Question ${i}`,
        type: 'SINGLE_CHOICE',
        domain: 'cloud-concepts',
        difficulty: i < 40 ? 'EASY' : 'MEDIUM',
        options: [{ label: 'A', text: 'Option A' }],
        correctAnswers: ['A'],
        explanation: 'Exp',
        examTypeId: 'aws-ccp',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const selected = selectQuestionsByDomain(availableQuestions, 65);

      const ids = selected.map((q) => q.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(65); // All unique
    });

    it('should throw error if not enough questions available for quota', () => {
      const availableQuestions: Question[] = Array.from({ length: 5 }, (_, i) => ({
        id: `q-${i}`,
        text: `Question ${i}`,
        type: 'SINGLE_CHOICE',
        domain: 'cloud-concepts',
        difficulty: 'MEDIUM',
        options: [{ label: 'A', text: 'Option A' }],
        correctAnswers: ['A'],
        explanation: 'Exp',
        examTypeId: 'aws-ccp',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      expect(() => selectQuestionsByDomain(availableQuestions, 16)).toThrow(
        'Not enough approved questions in domain',
      );
    });
  });

  describe('generateExam', () => {
    it('should generate exam with exactly 65 questions following domain weighting (FR-001)', async () => {
      // Mock questions for each domain
      const cloudConceptsQuestions = Array.from({ length: 40 }, (_, i) => ({
        id: `cc-${i}`,
        text: `Cloud Concepts ${i}`,
        type: 'SINGLE_CHOICE',
        domain: 'cloud-concepts',
        difficulty: 'MEDIUM',
        options: [{ label: 'A', text: 'Option A' }],
        correctAnswers: ['A'],
        explanation: 'Exp',
        examTypeId: 'aws-ccp',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const securityQuestions = Array.from({ length: 50 }, (_, i) => ({
        id: `sec-${i}`,
        text: `Security ${i}`,
        type: 'SINGLE_CHOICE',
        domain: 'security',
        difficulty: 'MEDIUM',
        options: [{ label: 'A', text: 'Option A' }],
        correctAnswers: ['A'],
        explanation: 'Exp',
        examTypeId: 'aws-ccp',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const technologyQuestions = Array.from({ length: 60 }, (_, i) => ({
        id: `tech-${i}`,
        text: `Technology ${i}`,
        type: 'SINGLE_CHOICE',
        domain: 'technology',
        difficulty: 'MEDIUM',
        options: [{ label: 'A', text: 'Option A' }],
        correctAnswers: ['A'],
        explanation: 'Exp',
        examTypeId: 'aws-ccp',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const billingQuestions = Array.from({ length: 30 }, (_, i) => ({
        id: `bill-${i}`,
        text: `Billing ${i}`,
        type: 'SINGLE_CHOICE',
        domain: 'billing',
        difficulty: 'MEDIUM',
        options: [{ label: 'A', text: 'Option A' }],
        correctAnswers: ['A'],
        explanation: 'Exp',
        examTypeId: 'aws-ccp',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      (getQuestionsByDomainAndStatus as jest.Mock)
        .mockResolvedValueOnce(cloudConceptsQuestions) // cloud-concepts
        .mockResolvedValueOnce(securityQuestions) // security
        .mockResolvedValueOnce(technologyQuestions) // technology
        .mockResolvedValueOnce(billingQuestions); // billing

      const exam = await generateExam(mockExamTypeConfig);

      // Total should be exactly 65
      expect(exam).toHaveLength(65);

      // Count by domain
      const bydomain = {
        'cloud-concepts': exam.filter((q) => q.domain === 'cloud-concepts').length,
        security: exam.filter((q) => q.domain === 'security').length,
        technology: exam.filter((q) => q.domain === 'technology').length,
        billing: exam.filter((q) => q.domain === 'billing').length,
      };

      // Verify weighting (with tolerance for rounding)
      expect(bydomain['cloud-concepts']).toBeGreaterThanOrEqual(15);
      expect(bydomain['cloud-concepts']).toBeLessThanOrEqual(16);

      expect(bydomain['security']).toBeGreaterThanOrEqual(19);
      expect(bydomain['security']).toBeLessThanOrEqual(20);

      expect(bydomain['technology']).toBeGreaterThanOrEqual(22);
      expect(bydomain['technology']).toBeLessThanOrEqual(23);

      expect(bydomain['billing']).toBeGreaterThanOrEqual(7);
      expect(bydomain['billing']).toBeLessThanOrEqual(8);

      // Verify no duplicates
      const questionIds = exam.map((q) => q.id);
      expect(new Set(questionIds).size).toBe(65);
    });

    it('should fail exam generation if insufficient questions in any domain', async () => {
      const insufficientQuestions = Array.from({ length: 5 }, (_, i) => ({
        id: `q-${i}`,
        text: `Question ${i}`,
        type: 'SINGLE_CHOICE',
        domain: 'cloud-concepts',
        difficulty: 'MEDIUM',
        options: [{ label: 'A', text: 'Option A' }],
        correctAnswers: ['A'],
        explanation: 'Exp',
        examTypeId: 'aws-ccp',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      (getQuestionsByDomainAndStatus as jest.Mock).mockResolvedValueOnce(insufficientQuestions); // Only 5 questions, need 15-16

      await expect(generateExam(mockExamTypeConfig)).rejects.toThrow('Not enough questions');
    });
  });
});
