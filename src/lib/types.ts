export interface QuizQuestion {
  id: string;
  num: number;
  question: string;
  options: [string, string, string, string];
  answer: number; // 1-4
  points: number;
  explanation?: string;
  diagramUrl?: string;
  hasDiagram?: boolean;
  pageNumber?: number;
  warning?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  questions: QuizQuestion[];
  isAcceptingResponses: boolean;
  showResultsImmediately: boolean;
  allowSingleAttempt: boolean;
  createdAt: string;
  updatedAt: string;
  responseCount?: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentName: string;
  studentEmail: string;
  answers: Record<string, number>; // questionId -> selected option (1-4)
  score?: number;
  totalMarks?: number;
  percentage?: number;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  autoSubmitted?: boolean;
  timeTakenSeconds?: number;
}

export interface ImportedQuestion {
  num: number;
  question: string;
  options: [string, string, string, string];
  answer: number;
  explanation?: string;
  hasDiagram: boolean;
  pageNumber: number;
  warning?: string;
}

export interface PdfImportResult {
  questions: ImportedQuestion[];
  warnings: string[];
  totalPages: number;
}

export interface ResponseStats {
  totalResponses: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  averageTimeTaken: number;
}
