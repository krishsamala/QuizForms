import fs from 'fs';
import path from 'path';
import { Quiz, QuizAttempt } from './types';

const dataDir = path.join(process.cwd(), '.data');
const quizzesFile = path.join(dataDir, 'quizzes.json');
const attemptsFile = path.join(dataDir, 'attempts.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function readServerQuizzes(): Quiz[] {
  ensureDataDir();
  if (!fs.existsSync(quizzesFile)) return [];
  try {
    const raw = fs.readFileSync(quizzesFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function writeServerQuizzes(quizzes: Quiz[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(quizzesFile, JSON.stringify(quizzes, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write quizzes to disk:', e);
  }
}

export function readServerAttempts(): QuizAttempt[] {
  ensureDataDir();
  if (!fs.existsSync(attemptsFile)) return [];
  try {
    const raw = fs.readFileSync(attemptsFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function writeServerAttempts(attempts: QuizAttempt[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(attemptsFile, JSON.stringify(attempts, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write attempts to disk:', e);
  }
}
