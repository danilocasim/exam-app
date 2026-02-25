// T038: ExamSessionService - Start, save answer, navigate, submit
import {
  createExamAttempt,
  getInProgressExamAttempt,
  getExamAttemptById,
  completeExamAttempt,
  abandonExamAttempt,
  updateRemainingTime,
  deleteExamAttempt,
} from '../storage/repositories/exam-attempt.repository';
import { incrementExamCount } from '../storage/repositories/user-stats.repository';
import {
  createExamAnswersBatch,
  getAnswersByExamAttemptId,
  getAnswerByExamAndQuestion,
  submitAnswer,
  setFlag,
  toggleFlag,
  getAnsweredCount,
  getFlaggedCount,
  getNextUnansweredOrFlagged,
} from '../storage/repositories/exam-answer.repository';
import { getQuestionsByIds, getQuestionById } from '../storage/repositories/question.repository';
import {
  ExamAttempt,
  ExamAnswer,
  Question,
  ExamTypeConfig,
  ExamResult,
  DomainScore,
} from '../storage/schema';
import { generateExam, GeneratedExam } from './exam-generator.service';
import { getCachedExamTypeConfig } from './sync.service';

/**
 * Exam session state containing all current exam info
 */
export interface ExamSession {
  attempt: ExamAttempt;
  answers: ExamAnswer[];
  questions: Question[];
  currentIndex: number;
  config: ExamTypeConfig;
}

/**
 * Navigation result
 */
export interface NavigationResult {
  currentIndex: number;
  currentAnswer: ExamAnswer;
  currentQuestion: Question;
  hasNext: boolean;
  hasPrevious: boolean;
  answeredCount: number;
  flaggedCount: number;
}

/**
 * Start a new exam session
 *
 * 1. Generate exam questions using weighted selection
 * 2. Create exam attempt record
 * 3. Create answer placeholders for all questions
 * 4. Return initial session state
 */
export const startExam = async (): Promise<ExamSession> => {
  // Clean up any existing in-progress exam
  const existing = await getInProgressExamAttempt();
  if (existing) {
    // Auto-abandon expired exams
    const expiresAt = new Date(existing.expiresAt).getTime();
    if (Date.now() > expiresAt) {
      await abandonExamAttempt(existing.id);
    } else {
      // Still valid — caller must abandon explicitly first
      throw new Error('An exam is already in progress. Please complete or abandon it first.');
    }
  }

  // Also handle any other expired exams
  await handleExpiredExams();

  // Generate exam with weighted questions
  const generated: GeneratedExam = await generateExam();
  const { questions, config } = generated;

  if (questions.length === 0) {
    throw new Error('Unable to generate exam: no questions available.');
  }

  // Calculate time limit in milliseconds
  const timeLimitMs = config.timeLimit * 60 * 1000;

  // Create exam attempt
  const attempt = await createExamAttempt(questions.length, timeLimitMs);

  // Create answer placeholders for all questions
  const questionIds = questions.map((q) => q.id);
  const answers = await createExamAnswersBatch(attempt.id, questionIds);

  return {
    attempt,
    answers,
    questions,
    currentIndex: 0,
    config,
  };
};

/**
 * Resume an existing in-progress exam
 * Returns null if no exam in progress or if expired
 */
export const resumeExam = async (): Promise<ExamSession | null> => {
  const attempt = await getInProgressExamAttempt();
  if (!attempt) {
    return null;
  }

  // Check if exam has expired
  const expiresAt = new Date(attempt.expiresAt).getTime();
  if (Date.now() > expiresAt) {
    // Mark as abandoned due to expiration
    await abandonExamAttempt(attempt.id);
    return null;
  }

  // Load exam config
  const config = await getCachedExamTypeConfig();
  if (!config) {
    throw new Error('Exam configuration not found.');
  }

  // Load answers and questions
  const answers = await getAnswersByExamAttemptId(attempt.id);
  if (answers.length === 0) {
    // Corrupted state - abandon
    await abandonExamAttempt(attempt.id);
    return null;
  }

  const questionIds = answers.map((a) => a.questionId);
  const questions = await getQuestionsByIds(questionIds);

  // Sort questions by answer order index
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const sortedQuestions: Question[] = [];
  for (const answer of answers) {
    const question = questionsById.get(answer.questionId);
    if (question) {
      sortedQuestions.push(question);
    }
  }

  // Find first unanswered question or last position
  let currentIndex = 0;
  for (let i = 0; i < answers.length; i++) {
    if (!answers[i].answeredAt) {
      currentIndex = i;
      break;
    }
    currentIndex = i;
  }

  return {
    attempt,
    answers,
    questions: sortedQuestions,
    currentIndex,
    config,
  };
};

/**
 * Check if there's an exam in progress
 */
export const hasInProgressExam = async (): Promise<boolean> => {
  const attempt = await getInProgressExamAttempt();
  if (!attempt) return false;

  // Also check if not expired
  const expiresAt = new Date(attempt.expiresAt).getTime();
  return Date.now() <= expiresAt;
};

/**
 * Get remaining time for current exam in milliseconds
 */
export const getRemainingTime = async (examAttemptId: string): Promise<number> => {
  const attempt = await getExamAttemptById(examAttemptId);
  if (!attempt) return 0;

  // If exam is completed, return 0
  if (attempt.status !== 'in-progress') return 0;

  // Simpler approach: just use stored value
  // The timer component will calculate elapsed time from when it was last saved
  return Math.max(0, attempt.remainingTimeMs);
};

/**
 * Save remaining time (call periodically during exam)
 */
export const saveRemainingTime = async (
  examAttemptId: string,
  remainingTimeMs: number,
): Promise<void> => {
  await updateRemainingTime(examAttemptId, Math.max(0, remainingTimeMs));
};

/**
 * Submit an answer for the current question
 */
export const saveAnswer = async (
  examAttemptId: string,
  questionId: string,
  selectedAnswers: string[],
): Promise<void> => {
  // Get the question to validate and check correctness
  const question = await getQuestionById(questionId);
  if (!question) {
    throw new Error(`Question not found: ${questionId}`);
  }

  // Get the answer record
  const answer = await getAnswerByExamAndQuestion(examAttemptId, questionId);
  if (!answer) {
    throw new Error(`Answer record not found for question: ${questionId}`);
  }

  // Determine if answer is correct
  // Sort both arrays and compare
  const sortedSelected = [...selectedAnswers].sort();
  const sortedCorrect = [...question.correctAnswers].sort();
  const isCorrect =
    sortedSelected.length === sortedCorrect.length &&
    sortedSelected.every((v, i) => v === sortedCorrect[i]);

  // Save the answer
  await submitAnswer(answer.id, selectedAnswers, isCorrect);
};

/**
 * Toggle flag for a question
 */
export const toggleQuestionFlag = async (
  examAttemptId: string,
  questionId: string,
): Promise<boolean> => {
  const answer = await getAnswerByExamAndQuestion(examAttemptId, questionId);
  if (!answer) {
    throw new Error(`Answer record not found for question: ${questionId}`);
  }

  await toggleFlag(answer.id);
  return !answer.isFlagged;
};

/**
 * Set flag for a question
 */
export const setQuestionFlag = async (
  examAttemptId: string,
  questionId: string,
  isFlagged: boolean,
): Promise<void> => {
  const answer = await getAnswerByExamAndQuestion(examAttemptId, questionId);
  if (!answer) {
    throw new Error(`Answer record not found for question: ${questionId}`);
  }

  await setFlag(answer.id, isFlagged);
};

/**
 * Navigate to a specific question by index
 */
export const navigateToQuestion = async (
  examAttemptId: string,
  answers: ExamAnswer[],
  questions: Question[],
  targetIndex: number,
): Promise<NavigationResult> => {
  if (targetIndex < 0 || targetIndex >= answers.length) {
    throw new Error(`Invalid question index: ${targetIndex}`);
  }

  const currentAnswer = answers[targetIndex];
  const currentQuestion = questions[targetIndex];

  const answeredCount = await getAnsweredCount(examAttemptId);
  const flaggedCount = await getFlaggedCount(examAttemptId);

  return {
    currentIndex: targetIndex,
    currentAnswer,
    currentQuestion,
    hasNext: targetIndex < answers.length - 1,
    hasPrevious: targetIndex > 0,
    answeredCount,
    flaggedCount,
  };
};

/**
 * Get navigation info for current position
 */
export const getNavigationInfo = async (
  examAttemptId: string,
  answers: ExamAnswer[],
  currentIndex: number,
): Promise<{
  answeredCount: number;
  flaggedCount: number;
  totalQuestions: number;
  hasNext: boolean;
  hasPrevious: boolean;
}> => {
  const answeredCount = await getAnsweredCount(examAttemptId);
  const flaggedCount = await getFlaggedCount(examAttemptId);

  return {
    answeredCount,
    flaggedCount,
    totalQuestions: answers.length,
    hasNext: currentIndex < answers.length - 1,
    hasPrevious: currentIndex > 0,
  };
};

/**
 * Jump to next unanswered or flagged question
 */
export const goToNextUnansweredOrFlagged = async (
  examAttemptId: string,
  currentIndex: number,
): Promise<number | null> => {
  const nextAnswer = await getNextUnansweredOrFlagged(examAttemptId, currentIndex);
  return nextAnswer?.orderIndex ?? null;
};

/**
 * Submit exam for scoring
 */
export const submitExam = async (examAttemptId: string): Promise<ExamResult> => {
  const attempt = await getExamAttemptById(examAttemptId);
  if (!attempt) {
    throw new Error('Exam attempt not found');
  }

  if (attempt.status !== 'in-progress') {
    throw new Error('Exam is not in progress');
  }

  // Get config for passing score
  const config = await getCachedExamTypeConfig();
  if (!config) {
    throw new Error('Exam configuration not found');
  }

  // Get all answers and questions
  const answers = await getAnswersByExamAttemptId(examAttemptId);
  const questionIds = answers.map((a) => a.questionId);
  const questions = await getQuestionsByIds(questionIds);
  const questionsById = new Map(questions.map((q) => [q.id, q]));

  // Calculate score
  const totalQuestions = answers.length;
  const correctAnswers = answers.filter((a) => a.isCorrect === true).length;
  const score = Math.round((correctAnswers / totalQuestions) * 100);
  const passed = score >= config.passingScore;

  // Calculate domain breakdown
  const domainStats: Record<string, { correct: number; total: number; name: string }> = {};

  for (const answer of answers) {
    const question = questionsById.get(answer.questionId);
    if (!question) continue;

    const domain = question.domain;
    if (!domainStats[domain]) {
      const domainConfig = config.domains.find((d) => d.id === domain);
      domainStats[domain] = {
        correct: 0,
        total: 0,
        name: domainConfig?.name ?? domain,
      };
    }

    domainStats[domain].total++;
    if (answer.isCorrect === true) {
      domainStats[domain].correct++;
    }
  }

  const domainBreakdown: DomainScore[] = Object.entries(domainStats).map(([domainId, stats]) => ({
    domainId,
    domainName: stats.name,
    correct: stats.correct,
    total: stats.total,
    percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
  }));

  // Calculate time spent
  const startedAt = new Date(attempt.startedAt).getTime();
  const completedAt = Date.now();
  const timeSpentMs = completedAt - startedAt;

  // Mark exam as complete
  await completeExamAttempt(examAttemptId, score, passed);

  // T074: Update aggregate user stats
  await incrementExamCount(timeSpentMs, totalQuestions);

  // Update daily study streak
  try {
    const { recordExamCompletion } = await import('./streak.service');
    await recordExamCompletion();
  } catch {
    // Streak update is non-critical
  }

  return {
    examAttemptId,
    score,
    passed,
    totalQuestions,
    correctAnswers,
    domainBreakdown,
    completedAt: new Date(completedAt).toISOString(),
    timeSpentMs,
  };
};

/**
 * Abandon current exam
 */
export const abandonCurrentExam = async (examAttemptId: string): Promise<void> => {
  const attempt = await getExamAttemptById(examAttemptId);
  if (!attempt) {
    throw new Error('Exam attempt not found');
  }

  if (attempt.status !== 'in-progress') {
    throw new Error('Exam is not in progress');
  }

  await abandonExamAttempt(examAttemptId);
};

/**
 * Check and handle expired exams
 * Called on app launch to clean up any expired in-progress exams
 */
export const handleExpiredExams = async (): Promise<number> => {
  const attempt = await getInProgressExamAttempt();
  if (!attempt) return 0;

  const expiresAt = new Date(attempt.expiresAt).getTime();
  if (Date.now() > expiresAt) {
    await abandonExamAttempt(attempt.id);
    return 1;
  }

  return 0;
};

/**
 * Delete an exam attempt and all its answers
 */
export const deleteExam = async (examAttemptId: string): Promise<void> => {
  await deleteExamAttempt(examAttemptId);
};

/**
 * Get exam progress summary
 */
export const getExamProgress = async (
  examAttemptId: string,
): Promise<{
  answered: number;
  flagged: number;
  total: number;
  percentComplete: number;
}> => {
  const attempt = await getExamAttemptById(examAttemptId);
  if (!attempt) {
    throw new Error('Exam attempt not found');
  }

  const answered = await getAnsweredCount(examAttemptId);
  const flagged = await getFlaggedCount(examAttemptId);
  const total = attempt.totalQuestions;

  return {
    answered,
    flagged,
    total,
    percentComplete: Math.round((answered / total) * 100),
  };
};
