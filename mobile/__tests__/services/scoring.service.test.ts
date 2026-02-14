import { calculateScore, calculateDomainBreakdown } from '../../src/services/scoring.service';
import {
  getExamAttemptById,
  getCompletedExamAttempts,
} from '../../src/storage/repositories/exam-attempt.repository';
import { getAnswersByExamAttemptId } from '../../src/storage/repositories/exam-answer.repository';
import { getQuestionsByIds } from '../../src/storage/repositories/question.repository';
import { getCachedExamTypeConfig } from '../../src/services/sync.service';
import { ExamAnswer, Question, ExamTypeConfig, DomainScore } from '../../src/storage/schema';

jest.mock('../../src/storage/repositories/exam-attempt.repository');
jest.mock('../../src/storage/repositories/exam-answer.repository');
jest.mock('../../src/storage/repositories/question.repository');
jest.mock('../../src/services/sync.service');

describe('ScoringService', () => {
  const mockExamTypeConfig: ExamTypeConfig = {
    id: 'aws-ccp',
    name: 'AWS Cloud Practitioner',
    displayName: 'AWS CCP',
    description: 'AWS Certified Cloud Practitioner',
    domains: [
      { id: 'cloud-concepts', name: 'Cloud Concepts', weight: 0.24 },
      { id: 'security', name: 'Security and Compliance', weight: 0.3 },
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

  describe('calculateScore', () => {
    it('should calculate correct score and pass status when score >= passing threshold', async () => {
      const examAttemptId = 'exam-001';
      const now = new Date();

      (getExamAttemptById as jest.Mock).mockResolvedValue({
        id: examAttemptId,
        startedAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
        completedAt: now,
      });

      (getCachedExamTypeConfig as jest.Mock).mockResolvedValue(mockExamTypeConfig);

      // 50 out of 65 = 76.9% - PASS
      const answers: ExamAnswer[] = Array.from({ length: 65 }, (_, i) => ({
        id: `answer-${i}`,
        examAttemptId,
        questionId: `question-${i}`,
        selectedAnswers: ['A'],
        isCorrect: i < 50, // first 50 are correct
        submittedAt: new Date(),
      }));

      (getAnswersByExamAttemptId as jest.Mock).mockResolvedValue(answers);

      const questions: Question[] = Array.from({ length: 65 }, (_, i) => ({
        id: `question-${i}`,
        text: `Question ${i}`,
        type: 'SINGLE_CHOICE',
        domain: 'cloud-concepts',
        difficulty: 'MEDIUM',
        options: [
          { label: 'A', text: 'Option A' },
          { label: 'B', text: 'Option B' },
        ],
        correctAnswers: ['A'],
        explanation: 'Explanation',
        examTypeId: 'aws-ccp',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      (getQuestionsByIds as jest.Mock).mockResolvedValue(questions);

      const result = await calculateScore(examAttemptId);

      expect(result.score).toBe(77); // (50/65) * 100 = 76.92...
      expect(result.passed).toBe(true);
      expect(result.correctAnswers).toBe(50);
      expect(result.totalQuestions).toBe(65);
      expect(result.passingScore).toBe(70);
      expect(result.timeSpentMs).toBeGreaterThan(0);
    });

    it('should fail when score < passing threshold', async () => {
      const examAttemptId = 'exam-002';
      const now = new Date();

      (getExamAttemptById as jest.Mock).mockResolvedValue({
        id: examAttemptId,
        startedAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
        completedAt: now,
      });

      (getCachedExamTypeConfig as jest.Mock).mockResolvedValue(mockExamTypeConfig);

      // 40 out of 65 = 61.5% - FAIL
      const answers: ExamAnswer[] = Array.from({ length: 65 }, (_, i) => ({
        id: `answer-${i}`,
        examAttemptId,
        questionId: `question-${i}`,
        selectedAnswers: ['A'],
        isCorrect: i < 40, // first 40 are correct
        submittedAt: new Date(),
      }));

      (getAnswersByExamAttemptId as jest.Mock).mockResolvedValue(answers);

      const questions: Question[] = Array.from({ length: 65 }, (_, i) => ({
        id: `question-${i}`,
        text: `Question ${i}`,
        type: 'SINGLE_CHOICE',
        domain: 'cloud-concepts',
        difficulty: 'MEDIUM',
        options: [
          { label: 'A', text: 'Option A' },
          { label: 'B', text: 'Option B' },
        ],
        correctAnswers: ['A'],
        explanation: 'Explanation',
        examTypeId: 'aws-ccp',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      (getQuestionsByIds as jest.Mock).mockResolvedValue(questions);

      const result = await calculateScore(examAttemptId);

      expect(result.score).toBe(62); // (40/65) * 100 = 61.54...
      expect(result.passed).toBe(false);
      expect(result.correctAnswers).toBe(40);
    });

    it('should throw error if exam attempt not found', async () => {
      (getExamAttemptById as jest.Mock).mockResolvedValue(null);

      await expect(calculateScore('non-existent')).rejects.toThrow('Exam attempt not found');
    });

    it('should throw error if config not found', async () => {
      (getExamAttemptById as jest.Mock).mockResolvedValue({
        id: 'exam-001',
        startedAt: new Date(),
        completedAt: new Date(),
      });

      (getCachedExamTypeConfig as jest.Mock).mockResolvedValue(null);

      await expect(calculateScore('exam-001')).rejects.toThrow('Exam configuration not found');
    });

    it('should calculate correct time spent from start to completion', async () => {
      const examAttemptId = 'exam-003';
      const startTime = new Date('2026-02-15T10:00:00Z');
      const endTime = new Date('2026-02-15T11:30:00Z');
      const expectedMs = endTime.getTime() - startTime.getTime();

      (getExamAttemptById as jest.Mock).mockResolvedValue({
        id: examAttemptId,
        startedAt: startTime,
        completedAt: endTime,
      });

      (getCachedExamTypeConfig as jest.Mock).mockResolvedValue(mockExamTypeConfig);

      const answers: ExamAnswer[] = [
        {
          id: 'a-1',
          examAttemptId,
          questionId: 'q-1',
          selectedAnswers: ['A'],
          isCorrect: true,
          submittedAt: new Date(),
        },
      ];

      (getAnswersByExamAttemptId as jest.Mock).mockResolvedValue(answers);

      const questions: Question[] = [
        {
          id: 'q-1',
          text: 'Question 1',
          type: 'SINGLE_CHOICE',
          domain: 'cloud-concepts',
          difficulty: 'EASY',
          options: [{ label: 'A', text: 'Option A' }],
          correctAnswers: ['A'],
          explanation: 'Explanation',
          examTypeId: 'aws-ccp',
          status: 'APPROVED',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (getQuestionsByIds as jest.Mock).mockResolvedValue(questions);

      const result = await calculateScore(examAttemptId);

      expect(result.timeSpentMs).toBe(expectedMs);
      expect(result.timeSpentMs).toBe(90 * 60 * 1000); // 90 minutes in ms
    });
  });

  describe('calculateDomainBreakdown', () => {
    it('should calculate correct breakdown by domain', () => {
      const answers: ExamAnswer[] = [
        {
          id: 'a-1',
          examAttemptId: 'e-1',
          questionId: 'q-1',
          selectedAnswers: ['A'],
          isCorrect: true,
          submittedAt: new Date(),
        },
        {
          id: 'a-2',
          examAttemptId: 'e-1',
          questionId: 'q-2',
          selectedAnswers: ['B'],
          isCorrect: false,
          submittedAt: new Date(),
        },
        {
          id: 'a-3',
          examAttemptId: 'e-1',
          questionId: 'q-3',
          selectedAnswers: ['A'],
          isCorrect: true,
          submittedAt: new Date(),
        },
      ];

      const questionsById = new Map([
        [
          'q-1',
          {
            id: 'q-1',
            text: 'Q1',
            type: 'SINGLE_CHOICE',
            domain: 'cloud-concepts',
            difficulty: 'EASY',
            options: [],
            correctAnswers: ['A'],
            explanation: 'Exp 1',
            examTypeId: 'aws-ccp',
            status: 'APPROVED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        [
          'q-2',
          {
            id: 'q-2',
            text: 'Q2',
            type: 'SINGLE_CHOICE',
            domain: 'security',
            difficulty: 'MEDIUM',
            options: [],
            correctAnswers: ['A'],
            explanation: 'Exp 2',
            examTypeId: 'aws-ccp',
            status: 'APPROVED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        [
          'q-3',
          {
            id: 'q-3',
            text: 'Q3',
            type: 'SINGLE_CHOICE',
            domain: 'cloud-concepts',
            difficulty: 'HARD',
            options: [],
            correctAnswers: ['A'],
            explanation: 'Exp 3',
            examTypeId: 'aws-ccp',
            status: 'APPROVED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ]);

      const result = calculateDomainBreakdown(answers, questionsById, mockExamTypeConfig);

      const cloudConcepts = result.find((d) => d.id === 'cloud-concepts');
      const security = result.find((d) => d.id === 'security');

      expect(cloudConcepts).toBeDefined();
      expect(cloudConcepts?.score).toBe(100); // 2/2 correct
      expect(security).toBeDefined();
      expect(security?.score).toBe(0); // 0/1 correct
    });

    it('should identify weak and strong domains (FR-019)', () => {
      // FR-019 thresholds: Strong = 80%+, Moderate = 70-79%, Weak = <70%
      const answers: ExamAnswer[] = [
        // Cloud Concepts: 8/10 = 80% (Strong)
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `a-cc-${i}`,
          examAttemptId: 'e-1',
          questionId: `q-cc-${i}`,
          selectedAnswers: ['A'],
          isCorrect: true,
          submittedAt: new Date(),
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `a-cc-wrong-${i}`,
          examAttemptId: 'e-1',
          questionId: `q-cc-wrong-${i}`,
          selectedAnswers: ['A'],
          isCorrect: false,
          submittedAt: new Date(),
        })),
        // Security: 5/10 = 50% (Weak)
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `a-sec-${i}`,
          examAttemptId: 'e-1',
          questionId: `q-sec-${i}`,
          selectedAnswers: ['A'],
          isCorrect: true,
          submittedAt: new Date(),
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `a-sec-wrong-${i}`,
          examAttemptId: 'e-1',
          questionId: `q-sec-wrong-${i}`,
          selectedAnswers: ['A'],
          isCorrect: false,
          submittedAt: new Date(),
        })),
      ];

      const questionsById = new Map(
        [
          ...Array.from({ length: 10 }, (_, i) => [
            `q-cc-${i}`,
            {
              id: `q-cc-${i}`,
              text: `CC Q${i}`,
              type: 'SINGLE_CHOICE',
              domain: 'cloud-concepts',
              difficulty: 'EASY',
              options: [],
              correctAnswers: ['A'],
              explanation: 'Exp',
              examTypeId: 'aws-ccp',
              status: 'APPROVED',
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Question,
          ]),
          ...Array.from({ length: 2 }, (_, i) => [
            `q-cc-wrong-${i}`,
            {
              id: `q-cc-wrong-${i}`,
              text: `CC Wrong Q${i}`,
              type: 'SINGLE_CHOICE',
              domain: 'cloud-concepts',
              difficulty: 'EASY',
              options: [],
              correctAnswers: ['A'],
              explanation: 'Exp',
              examTypeId: 'aws-ccp',
              status: 'APPROVED',
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Question,
          ]),
          ...Array.from({ length: 10 }, (_, i) => [
            `q-sec-${i}`,
            {
              id: `q-sec-${i}`,
              text: `Sec Q${i}`,
              type: 'SINGLE_CHOICE',
              domain: 'security',
              difficulty: 'MEDIUM',
              options: [],
              correctAnswers: ['A'],
              explanation: 'Exp',
              examTypeId: 'aws-ccp',
              status: 'APPROVED',
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Question,
          ]),
          ...Array.from({ length: 5 }, (_, i) => [
            `q-sec-wrong-${i}`,
            {
              id: `q-sec-wrong-${i}`,
              text: `Sec Wrong Q${i}`,
              type: 'SINGLE_CHOICE',
              domain: 'security',
              difficulty: 'MEDIUM',
              options: [],
              correctAnswers: ['A'],
              explanation: 'Exp',
              examTypeId: 'aws-ccp',
              status: 'APPROVED',
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Question,
          ]),
        ].flat(),
      );

      const result = calculateDomainBreakdown(answers, questionsById, mockExamTypeConfig);

      const cloudConcepts = result.find((d) => d.id === 'cloud-concepts');
      const security = result.find((d) => d.id === 'security');

      // Strong = 80%+
      expect(cloudConcepts?.strength).toBe('strong');
      // Weak = <70%
      expect(security?.strength).toBe('weak');
    });
  });
});
