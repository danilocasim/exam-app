// T051: PracticeService - Start session, submit answer, end session
import {
  createPracticeSession,
  getPracticeSessionById,
  completePracticeSession,
  incrementSessionCounters,
  deletePracticeSession,
} from '../storage/repositories/practice-session.repository';
import {
  createPracticeAnswer,
  getPracticeAnswersBySessionId,
  hasQuestionBeenAnswered,
} from '../storage/repositories/practice-answer.repository';
import {
  getQuestionsByDomain,
  getQuestionsByDifficulty,
  getQuestionsByDomainAndDifficulty,
  getAllQuestions,
  getQuestionById,
} from '../storage/repositories/question.repository';
import { PracticeSession, PracticeAnswer, Question, Difficulty, DomainId } from '../storage/schema';
import { incrementPracticeCount } from '../storage/repositories/user-stats.repository';

/**
 * Practice session state containing all current session info
 */
export interface PracticeSessionState {
  session: PracticeSession;
  questions: Question[];
  answers: PracticeAnswer[];
  currentIndex: number;
}

/**
 * Answer result returned after submitting an answer
 */
export interface PracticeAnswerResult {
  answer: PracticeAnswer;
  isCorrect: boolean;
  correctAnswers: string[];
  explanation: string;
}

/**
 * Practice session summary
 */
export interface PracticeSummary {
  sessionId: string;
  domain: DomainId | null;
  difficulty: Difficulty | null;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  score: number; // percentage 0-100
  startedAt: string;
  completedAt: string | null;
  answers: PracticeAnswer[];
  questions: Question[];
}

/**
 * Fetch questions based on domain and difficulty filters, then shuffle
 */
const fetchFilteredQuestions = async (
  domain: DomainId | null,
  difficulty: Difficulty | null,
): Promise<Question[]> => {
  let questions: Question[];

  if (domain && difficulty) {
    questions = await getQuestionsByDomainAndDifficulty(domain, difficulty);
  } else if (domain) {
    questions = await getQuestionsByDomain(domain);
  } else if (difficulty) {
    questions = await getQuestionsByDifficulty(difficulty);
  } else {
    questions = await getAllQuestions();
  }

  // Shuffle questions using Fisher-Yates
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  return questions;
};

/**
 * Start a new practice session
 */
export const startPracticeSession = async (
  domain: DomainId | null,
  difficulty: Difficulty | null,
): Promise<PracticeSessionState> => {
  // Fetch and shuffle questions matching the filters
  const questions = await fetchFilteredQuestions(domain, difficulty);

  if (questions.length === 0) {
    throw new Error('No questions available for the selected filters');
  }

  // Create the session record
  const session = await createPracticeSession(domain, difficulty);

  return {
    session,
    questions,
    answers: [],
    currentIndex: 0,
  };
};

/**
 * Submit an answer for the current practice question
 * Returns the result with correct/incorrect feedback
 */
export const submitPracticeAnswer = async (
  sessionId: string,
  questionId: string,
  selectedAnswers: string[],
): Promise<PracticeAnswerResult> => {
  // Get the question to check correctness
  const question = await getQuestionById(questionId);
  if (!question) {
    throw new Error(`Question not found: ${questionId}`);
  }

  // Check if already answered in this session
  const alreadyAnswered = await hasQuestionBeenAnswered(sessionId, questionId);
  if (alreadyAnswered) {
    throw new Error('Question already answered in this session');
  }

  // Determine correctness
  const isCorrect = checkAnswer(selectedAnswers, question.correctAnswers);

  // Save the answer
  const answer = await createPracticeAnswer(sessionId, questionId, selectedAnswers, isCorrect);

  // Update session counters
  await incrementSessionCounters(sessionId, isCorrect);

  return {
    answer,
    isCorrect,
    correctAnswers: question.correctAnswers,
    explanation: question.explanation,
  };
};

/**
 * Check if selected answers match correct answers
 */
const checkAnswer = (selectedAnswers: string[], correctAnswers: string[]): boolean => {
  if (selectedAnswers.length !== correctAnswers.length) return false;
  const sortedSelected = [...selectedAnswers].sort();
  const sortedCorrect = [...correctAnswers].sort();
  return sortedSelected.every((ans, i) => ans === sortedCorrect[i]);
};

/**
 * End/complete a practice session
 */
export const endPracticeSession = async (sessionId: string): Promise<void> => {
  // Get session data to capture stats before completing
  const session = await getPracticeSessionById(sessionId);
  const answers = await getPracticeAnswersBySessionId(sessionId);

  await completePracticeSession(sessionId);

  // T074: Update aggregate user stats
  if (session) {
    const startedAt = new Date(session.startedAt).getTime();
    const completedAt = Date.now();
    const timeSpentMs = completedAt - startedAt;
    await incrementPracticeCount(answers.length, timeSpentMs);
  }
};

/**
 * Get practice session summary
 */
export const getPracticeSummary = async (sessionId: string): Promise<PracticeSummary> => {
  const session = await getPracticeSessionById(sessionId);
  if (!session) {
    throw new Error(`Practice session not found: ${sessionId}`);
  }

  const answers = await getPracticeAnswersBySessionId(sessionId);
  const totalQuestions = answers.length;
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const incorrectCount = totalQuestions - correctCount;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // Fetch questions for the answers
  const questionIds = answers.map((a) => a.questionId);
  const questions: Question[] = [];
  for (const qId of questionIds) {
    const q = await getQuestionById(qId);
    if (q) questions.push(q);
  }

  return {
    sessionId,
    domain: session.domain,
    difficulty: session.difficulty,
    totalQuestions,
    correctCount,
    incorrectCount,
    score,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    answers,
    questions,
  };
};

/**
 * Get available question count for given filters
 */
export const getAvailableQuestionCount = async (
  domain: DomainId | null,
  difficulty: Difficulty | null,
): Promise<number> => {
  const questions = await fetchFilteredQuestions(domain, difficulty);
  return questions.length;
};

/**
 * Delete a practice session and its answers
 */
export const deletePracticeSessionWithAnswers = async (sessionId: string): Promise<void> => {
  await deletePracticeSession(sessionId);
};
