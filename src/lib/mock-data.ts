import { Quiz, QuizAttempt, QuizQuestion } from './types';

function makeId(): string {
  return Math.random().toString(36).substring(2, 15);
}

const sampleQuestions: QuizQuestion[] = [
  {
    id: 'q1', num: 1, question: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'], answer: 3, points: 1,
    explanation: 'Paris is the capital and most populous city of France.'
  },
  {
    id: 'q2', num: 2, question: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], answer: 2, points: 1,
    explanation: 'Mars appears red due to iron oxide on its surface.'
  },
  {
    id: 'q3', num: 3, question: 'What is the chemical symbol for water?',
    options: ['H2O', 'CO2', 'NaCl', 'O2'], answer: 1, points: 1,
    explanation: 'Water is composed of two hydrogen atoms and one oxygen atom.'
  },
  {
    id: 'q4', num: 4, question: 'Who wrote "Romeo and Juliet"?',
    options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'],
    answer: 2, points: 1, explanation: 'William Shakespeare wrote Romeo and Juliet around 1594-1596.'
  },
  {
    id: 'q5', num: 5, question: 'What is the largest mammal?',
    options: ['African Elephant', 'Blue Whale', 'Giraffe', 'Hippopotamus'],
    answer: 2, points: 1, explanation: 'The blue whale can reach up to 100 feet in length.'
  },
  {
    id: 'q6', num: 6, question: 'In which year did World War II end?',
    options: ['1943', '1944', '1945', '1946'], answer: 3, points: 1,
    explanation: 'World War II ended in 1945 with the surrender of Japan.'
  },
  {
    id: 'q7', num: 7, question: 'What is the powerhouse of the cell?',
    options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Endoplasmic Reticulum'],
    answer: 3, points: 1, explanation: 'Mitochondria generate most of the cell\'s ATP.'
  },
  {
    id: 'q8', num: 8, question: 'Which gas do plants absorb from the atmosphere?',
    options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'],
    answer: 3, points: 1, explanation: 'Plants use CO₂ in photosynthesis to produce glucose and oxygen.'
  },
  {
    id: 'q9', num: 9, question: 'What is the speed of light approximately?',
    options: ['3 × 10⁶ m/s', '3 × 10⁸ m/s', '3 × 10¹⁰ m/s', '3 × 10⁴ m/s'],
    answer: 2, points: 1, explanation: 'The speed of light in vacuum is approximately 3 × 10⁸ m/s.'
  },
  {
    id: 'q10', num: 10, question: 'Which element has the atomic number 1?',
    options: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'],
    answer: 2, points: 1, explanation: 'Hydrogen is the lightest and most abundant element.',
    hasDiagram: true, pageNumber: 1
  },
];

export const sampleQuiz: Quiz = {
  id: 'demo-quiz-1',
  title: 'General Knowledge Practice Test',
  description: 'A comprehensive practice test covering general knowledge topics including science, history, geography, and literature. Answer all questions within the time limit.',
  durationMinutes: 90,
  questions: sampleQuestions,
  isAcceptingResponses: true,
  showResultsImmediately: true,
  allowSingleAttempt: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  responseCount: 3,
};

export const sampleQuiz2: Quiz = {
  id: 'demo-quiz-2',
  title: 'Physics Mid-Term Examination',
  description: 'Mid-term examination covering mechanics, thermodynamics, and waves. Calculator permitted.',
  durationMinutes: 120,
  questions: sampleQuestions.slice(0, 5).map((q, i) => ({ ...q, id: `q2-${i + 1}`, num: i + 1 })),
  isAcceptingResponses: false,
  showResultsImmediately: false,
  allowSingleAttempt: true,
  createdAt: new Date(Date.now() - 86400000).toISOString(),
  updatedAt: new Date(Date.now() - 86400000).toISOString(),
  responseCount: 47,
};

export const sampleAttempts: QuizAttempt[] = [
  {
    id: 'attempt-1', quizId: 'demo-quiz-1', studentName: 'Alice Johnson',
    studentEmail: 'alice@example.com',
    answers: { q1: 3, q2: 2, q3: 1, q4: 2, q5: 2, q6: 3, q7: 3, q8: 3, q9: 2, q10: 2 },
    score: 10, totalMarks: 10, percentage: 100,
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    expiresAt: new Date(Date.now() - 1800000).toISOString(),
    submittedAt: new Date(Date.now() - 3600000).toISOString(),
    autoSubmitted: false, timeTakenSeconds: 3600,
  },
  {
    id: 'attempt-2', quizId: 'demo-quiz-1', studentName: 'Bob Smith',
    studentEmail: 'bob@example.com',
    answers: { q1: 3, q2: 1, q3: 1, q4: 2, q5: 1, q6: 3, q7: 2, q8: 3, q9: 1, q10: 2 },
    score: 6, totalMarks: 10, percentage: 60,
    startedAt: new Date(Date.now() - 10800000).toISOString(),
    expiresAt: new Date(Date.now() - 5400000).toISOString(),
    submittedAt: new Date(Date.now() - 7200000).toISOString(),
    autoSubmitted: true, timeTakenSeconds: 5400,
  },
  {
    id: 'attempt-3', quizId: 'demo-quiz-1', studentName: 'Charlie Brown',
    studentEmail: '21CS001@university.edu',
    answers: { q1: 3, q2: 2, q3: 1, q4: 1, q5: 2, q6: 2, q7: 3, q8: 3, q9: 2, q10: 1 },
    score: 7, totalMarks: 10, percentage: 70,
    startedAt: new Date(Date.now() - 14400000).toISOString(),
    expiresAt: new Date(Date.now() - 9000000).toISOString(),
    submittedAt: new Date(Date.now() - 10800000).toISOString(),
    autoSubmitted: false, timeTakenSeconds: 3600,
  },
];

// Storage Keys
const QUIZZES_STORAGE_KEY = 'quizforms_db_quizzes';
const ATTEMPTS_STORAGE_KEY = 'quizforms_db_attempts';

function loadQuizzes(): Quiz[] {
  if (typeof window !== 'undefined') {
    try {
      const data = localStorage.getItem(QUIZZES_STORAGE_KEY);
      if (data) {
        const parsed: Quiz[] = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const ids = new Set(parsed.map((q) => q.id));
          if (!ids.has(sampleQuiz.id)) parsed.push(sampleQuiz);
          if (!ids.has(sampleQuiz2.id)) parsed.push(sampleQuiz2);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to read quizzes from localStorage', e);
    }
  }
  return [sampleQuiz, sampleQuiz2];
}

function persistQuizzes(quizzes: Quiz[]) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(QUIZZES_STORAGE_KEY, JSON.stringify(quizzes));
    } catch (e) {
      console.warn('Failed to save quizzes to localStorage', e);
    }
  }
}

function loadAttempts(): QuizAttempt[] {
  if (typeof window !== 'undefined') {
    try {
      const data = localStorage.getItem(ATTEMPTS_STORAGE_KEY);
      if (data) {
        const parsed: QuizAttempt[] = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to read attempts from localStorage', e);
    }
  }
  return [...sampleAttempts];
}

function persistAttempts(attempts: QuizAttempt[]) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts));
    } catch (e) {
      console.warn('Failed to save attempts to localStorage', e);
    }
  }
}

// In-memory mock store backed by localStorage
let mockQuizzes: Quiz[] = loadQuizzes();
let mockAttempts: QuizAttempt[] = loadAttempts();

export const mockDb = {
  getQuizzes: (): Quiz[] => {
    mockQuizzes = loadQuizzes();
    return [...mockQuizzes];
  },

  getQuiz: (id: string): Quiz | undefined => {
    mockQuizzes = loadQuizzes();
    return mockQuizzes.find((q) => q.id === id);
  },

  setQuiz: (quiz: Quiz): void => {
    mockQuizzes = loadQuizzes();
    const idx = mockQuizzes.findIndex((q) => q.id === quiz.id);
    if (idx !== -1) {
      mockQuizzes[idx] = quiz;
    } else {
      mockQuizzes.push(quiz);
    }
    persistQuizzes(mockQuizzes);
  },

  createQuiz: (quiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt' | 'responseCount'>): Quiz => {
    mockQuizzes = loadQuizzes();
    const newQuiz: Quiz = {
      ...quiz,
      id: makeId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responseCount: 0,
    };
    mockQuizzes.push(newQuiz);
    persistQuizzes(mockQuizzes);
    return newQuiz;
  },

  updateQuiz: (id: string, data: Partial<Quiz>): Quiz | undefined => {
    mockQuizzes = loadQuizzes();
    const index = mockQuizzes.findIndex((q) => q.id === id);
    if (index === -1) return undefined;
    mockQuizzes[index] = { ...mockQuizzes[index], ...data, updatedAt: new Date().toISOString() };
    persistQuizzes(mockQuizzes);
    return mockQuizzes[index];
  },

  deleteQuiz: (id: string): boolean => {
    mockQuizzes = loadQuizzes();
    const len = mockQuizzes.length;
    mockQuizzes = mockQuizzes.filter((q) => q.id !== id);
    mockAttempts = loadAttempts().filter((a) => a.quizId !== id);
    persistQuizzes(mockQuizzes);
    persistAttempts(mockAttempts);
    return mockQuizzes.length < len;
  },

  getAttempts: (quizId: string): QuizAttempt[] => {
    mockAttempts = loadAttempts();
    return mockAttempts.filter((a) => a.quizId === quizId);
  },

  getAttempt: (attemptId: string): QuizAttempt | undefined => {
    mockAttempts = loadAttempts();
    return mockAttempts.find((a) => a.id === attemptId);
  },

  getAttemptByStudent: (quizId: string, email: string): QuizAttempt | undefined => {
    mockAttempts = loadAttempts();
    return mockAttempts.find((a) => a.quizId === quizId && a.studentEmail === email && !a.submittedAt);
  },

  createAttempt: (attempt: Omit<QuizAttempt, 'id'>): QuizAttempt => {
    mockAttempts = loadAttempts();
    const newAttempt: QuizAttempt = { ...attempt, id: makeId() };
    mockAttempts.push(newAttempt);
    persistAttempts(mockAttempts);
    return newAttempt;
  },

  submitAttempt: (attemptId: string, data: Partial<QuizAttempt>): QuizAttempt | undefined => {
    mockAttempts = loadAttempts();
    const index = mockAttempts.findIndex((a) => a.id === attemptId);
    if (index === -1) return undefined;
    mockAttempts[index] = { ...mockAttempts[index], ...data };
    persistAttempts(mockAttempts);

    // Update response count
    const quizId = mockAttempts[index].quizId;
    mockQuizzes = loadQuizzes();
    const qIdx = mockQuizzes.findIndex((q) => q.id === quizId);
    if (qIdx !== -1) {
      mockQuizzes[qIdx].responseCount = mockAttempts.filter((a) => a.quizId === quizId && a.submittedAt).length;
      persistQuizzes(mockQuizzes);
    }
    return mockAttempts[index];
  },
};
