import {
  startExam,
  saveAnswer,
  toggleQuestionFlag,
  navigateToQuestion,
  resumeExam,
  hasInProgressExam,
  submitExam,
} from '../../src/services/exam-session.service';
import {
  createExamAttempt,
  getInProgressExamAttempt,
  getExamAttemptById,
  completeExamAttempt,
  abandonExamAttempt,
} from '../../src/storage/repositories/exam-attempt.repository';
import {
  createExamAnswersBatch,
  getAnswersByExamAttemptId,
  getAnswerByExamAndQuestion,
  submitAnswer as submitAnswerRepo,
  toggleFlag as toggleFlagRepo,
  getAnsweredCount,
  getFlaggedCount,
} from '../../src/storage/repositories/exam-answer.repository';
import {
  getQuestionsByIds,
  getQuestionById,
} from '../../src/storage/repositories/question.repository';
import { incrementExamCount } from '../../src/storage/repositories/user-stats.repository';
import { generateExam, GeneratedExam } from '../../src/services/exam-generator.service';
import { getCachedExamTypeConfig } from '../../src/services/sync.service';
import { ExamTypeConfig, Question, ExamAnswer } from '../../src/storage/schema';

vi.mock('../../src/storage/repositories/exam-attempt.repository');
vi.mock('../../src/storage/repositories/exam-answer.repository');
vi.mock('../../src/storage/repositories/question.repository');
vi.mock('../../src/storage/repositories/user-stats.repository');
vi.mock('../../src/services/exam-generator.service');
vi.mock('../../src/services/sync.service');

describe('ExamSessionService', () => {
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

  const mockQuestions: Question[] = Array.from({ length: 65 }, (_, i) => ({
    id: `q-${i}`,
    text: `Question ${i}`,
    type: 'SINGLE_CHOICE' as const,
    domain: i < 16 ? 'cloud-concepts' : i < 36 ? 'security' : i < 59 ? 'technology' : 'billing',
    difficulty: 'MEDIUM' as const,
    options: [
      { id: 'A', text: 'Option A' },
      { id: 'B', text: 'Option B' },
    ],
    correctAnswers: ['A'],
    explanation: 'Explanation',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const mockAnswers: ExamAnswer[] = mockQuestions.map((q, i) => ({
    id: `answer-${i}`,
    examAttemptId: 'exam-001',
    questionId: q.id,
    selectedAnswers: [],
    isCorrect: null,
    isFlagged: false,
    orderIndex: i,
    answeredAt: null,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startExam', () => {
    it('should create new exam attempt and return exam session (FR-001, FR-006)', async () => {
      const mockGenerated: GeneratedExam = {
        questions: mockQuestions,
        totalQuestions: 65,
        config: mockExamTypeConfig,
        domainDistribution: {
          'cloud-concepts': 16,
          security: 20,
          technology: 23,
          billing: 6,
        },
      };

      const mockExamAttempt = {
        id: 'exam-001',
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: 'in-progress' as const,
        score: null,
        passed: null,
        totalQuestions: 65,
        remainingTimeMs: 90 * 60 * 1000,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      (getInProgressExamAttempt as vi.Mock).mockResolvedValue(null);
      (generateExam as vi.Mock).mockResolvedValue(mockGenerated);
      (createExamAttempt as vi.Mock).mockResolvedValue(mockExamAttempt);
      (createExamAnswersBatch as vi.Mock).mockResolvedValue(mockAnswers);

      const result = await startExam();

      expect(result).toBeDefined();
      expect(result.attempt).toEqual(mockExamAttempt);
      expect(result.questions).toHaveLength(65);
      expect(result.currentIndex).toBe(0);
      expect(result.config).toEqual(mockExamTypeConfig);
      expect(createExamAttempt).toHaveBeenCalled();
      expect(generateExam).toHaveBeenCalled();
    });

    it('should not allow starting new exam while one is in progress', async () => {
      const inProgressExam = {
        id: 'exam-in-progress',
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: 'in-progress',
        score: null,
        passed: null,
        totalQuestions: 65,
        remainingTimeMs: 80 * 60 * 1000,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      (getInProgressExamAttempt as vi.Mock).mockResolvedValue(inProgressExam);

      await expect(startExam()).rejects.toThrow('An exam is already in progress');
    });
  });

  describe('hasInProgressExam', () => {
    it('should return true when exam is in progress and not expired (FR-006)', async () => {
      const inProgressExam = {
        id: 'exam-001',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      };

      (getInProgressExamAttempt as vi.Mock).mockResolvedValue(inProgressExam);

      expect(await hasInProgressExam()).toBe(true);
    });

    it('should return false when no exam in progress (FR-006)', async () => {
      (getInProgressExamAttempt as vi.Mock).mockResolvedValue(null);

      expect(await hasInProgressExam()).toBe(false);
    });

    it('should return false when exam has expired', async () => {
      const expiredExam = {
        id: 'exam-expired',
        startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      };

      (getInProgressExamAttempt as vi.Mock).mockResolvedValue(expiredExam);

      expect(await hasInProgressExam()).toBe(false);
    });
  });

  describe('resumeExam', () => {
    it('should resume exam within expiration window and preserve remaining time', async () => {
      const startTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const examAttempt = {
        id: 'exam-resume-001',
        startedAt: startTime,
        completedAt: null,
        status: 'in-progress',
        score: null,
        passed: null,
        totalQuestions: 65,
        remainingTimeMs: 60 * 60 * 1000,
        expiresAt: new Date(Date.now() + 23.5 * 60 * 60 * 1000).toISOString(),
      };

      (getInProgressExamAttempt as vi.Mock).mockResolvedValue(examAttempt);
      (getCachedExamTypeConfig as vi.Mock).mockResolvedValue(mockExamTypeConfig);
      (getAnswersByExamAttemptId as vi.Mock).mockResolvedValue(mockAnswers);
      (getQuestionsByIds as vi.Mock).mockResolvedValue(mockQuestions);

      const result = await resumeExam();

      expect(result).not.toBeNull();
      expect(result!.attempt.id).toBe('exam-resume-001');
      expect(result!.questions.length).toBe(65);
    });

    it('should abandon exam and return null when expiration window passed', async () => {
      const startTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const examAttempt = {
        id: 'exam-expired',
        startedAt: startTime,
        completedAt: null,
        status: 'in-progress',
        score: null,
        passed: null,
        totalQuestions: 65,
        remainingTimeMs: 0,
        expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      };

      (getInProgressExamAttempt as vi.Mock).mockResolvedValue(examAttempt);

      const result = await resumeExam();

      expect(result).toBeNull();
      expect(abandonExamAttempt).toHaveBeenCalledWith('exam-expired');
    });
  });

  describe('saveAnswer', () => {
    it('should save answer to exam and auto-save (FR-003)', async () => {
      const mockQuestion: Question = {
        id: 'q-1',
        text: 'Question 1',
        type: 'SINGLE_CHOICE',
        domain: 'cloud-concepts',
        difficulty: 'MEDIUM',
        options: [
          { id: 'A', text: 'Option A' },
          { id: 'B', text: 'Option B' },
        ],
        correctAnswers: ['A'],
        explanation: 'Explanation',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockAnswer: ExamAnswer = {
        id: 'answer-1',
        examAttemptId: 'exam-001',
        questionId: 'q-1',
        selectedAnswers: [],
        isCorrect: null,
        isFlagged: false,
        orderIndex: 0,
        answeredAt: null,
      };

      (getQuestionById as vi.Mock).mockResolvedValue(mockQuestion);
      (getAnswerByExamAndQuestion as vi.Mock).mockResolvedValue(mockAnswer);

      await saveAnswer('exam-001', 'q-1', ['A']);

      expect(submitAnswerRepo).toHaveBeenCalledWith('answer-1', ['A'], true);
    });
  });

  describe('navigateToQuestion', () => {
    it('should navigate to a specific question index (FR-005)', async () => {
      (getAnsweredCount as vi.Mock).mockResolvedValue(10);
      (getFlaggedCount as vi.Mock).mockResolvedValue(2);

      const result = await navigateToQuestion('exam-001', mockAnswers, mockQuestions, 5);

      expect(result.currentIndex).toBe(5);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrevious).toBe(true);
    });

    it('should indicate no previous at first question (FR-005)', async () => {
      (getAnsweredCount as vi.Mock).mockResolvedValue(0);
      (getFlaggedCount as vi.Mock).mockResolvedValue(0);

      const result = await navigateToQuestion('exam-001', mockAnswers, mockQuestions, 0);

      expect(result.currentIndex).toBe(0);
      expect(result.hasPrevious).toBe(false);
      expect(result.hasNext).toBe(true);
    });

    it('should indicate no next at last question (FR-005)', async () => {
      (getAnsweredCount as vi.Mock).mockResolvedValue(0);
      (getFlaggedCount as vi.Mock).mockResolvedValue(0);

      const result = await navigateToQuestion('exam-001', mockAnswers, mockQuestions, 64);

      expect(result.currentIndex).toBe(64);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrevious).toBe(true);
    });

    it('should throw for invalid question index', async () => {
      await expect(navigateToQuestion('exam-001', mockAnswers, mockQuestions, -1)).rejects.toThrow(
        'Invalid question index',
      );

      await expect(navigateToQuestion('exam-001', mockAnswers, mockQuestions, 100)).rejects.toThrow(
        'Invalid question index',
      );
    });
  });

  describe('toggleQuestionFlag', () => {
    it('should toggle flag on question for review (FR-004)', async () => {
      const mockAnswer: ExamAnswer = {
        id: 'answer-5',
        examAttemptId: 'exam-001',
        questionId: 'q-5',
        selectedAnswers: [],
        isCorrect: null,
        isFlagged: false,
        orderIndex: 5,
        answeredAt: null,
      };

      (getAnswerByExamAndQuestion as vi.Mock).mockResolvedValue(mockAnswer);

      const flagged = await toggleQuestionFlag('exam-001', 'q-5');

      expect(toggleFlagRepo).toHaveBeenCalledWith('answer-5');
      expect(flagged).toBe(true);
    });
  });

  describe('submitExam', () => {
    it('should complete exam and return final results (FR-007)', async () => {
      const examAttempt = {
        id: 'exam-final',
        startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        completedAt: null,
        status: 'in-progress' as const,
        score: null,
        passed: null,
        totalQuestions: 65,
        remainingTimeMs: 30 * 60 * 1000,
        expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
      };

      const answersWithResults: ExamAnswer[] = mockQuestions.map((q, i) => ({
        id: `answer-${i}`,
        examAttemptId: 'exam-final',
        questionId: q.id,
        selectedAnswers: ['A'],
        isCorrect: i < 50, // 50/65 correct
        isFlagged: false,
        orderIndex: i,
        answeredAt: new Date().toISOString(),
      }));

      (getExamAttemptById as vi.Mock).mockResolvedValue(examAttempt);
      (getCachedExamTypeConfig as vi.Mock).mockResolvedValue(mockExamTypeConfig);
      (getAnswersByExamAttemptId as vi.Mock).mockResolvedValue(answersWithResults);
      (getQuestionsByIds as vi.Mock).mockResolvedValue(mockQuestions);
      (completeExamAttempt as vi.Mock).mockResolvedValue(undefined);
      (incrementExamCount as vi.Mock).mockResolvedValue(undefined);

      const result = await submitExam('exam-final');

      expect(result).toBeDefined();
      expect(result.score).toBe(77); // Math.round(50/65 * 100) = 77
      expect(result.passed).toBe(true);
      expect(result.totalQuestions).toBe(65);
      expect(result.correctAnswers).toBe(50);
      expect(completeExamAttempt).toHaveBeenCalledWith('exam-final', 77, true);
    });
  });
});
