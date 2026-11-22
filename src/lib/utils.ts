import { Quiz, QuizAttempt, QuizQuestion, ResponseStats } from './types';
import { isMockMode, db, storage } from './firebase';
import { mockDb } from './mock-data';
import { v4 as uuidv4 } from 'uuid';

// ── Firestore helpers (only used when NOT in mock mode) ──

async function firestoreModule() {
  return await import('firebase/firestore');
}

async function storageModule() {
  return await import('firebase/storage');
}

// ── Quiz CRUD ──

export async function getQuizzes(): Promise<Quiz[]> {
  if (isMockMode) {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/quizzes', { cache: 'no-store' });
        if (res.ok) {
          const list: Quiz[] = await res.json();
          list.forEach(q => mockDb.setQuiz(q));
          return list;
        }
      } catch {}
    }
    return mockDb.getQuizzes();
  }
  const { collection, getDocs, query, orderBy } = await firestoreModule();
  const snap = await getDocs(query(collection(db!, 'quizzes'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz));
}

export async function getQuiz(id: string): Promise<Quiz | null> {
  if (isMockMode) {
    const local = mockDb.getQuiz(id);
    if (local) return local;
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/quizzes/${id}`, { cache: 'no-store' });
        if (res.ok) {
          const q: Quiz = await res.json();
          mockDb.setQuiz(q);
          return q;
        }
      } catch {}
    }
    return null;
  }
  const { doc, getDoc } = await firestoreModule();
  const snap = await getDoc(doc(db!, 'quizzes', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Quiz;
}

export async function createQuiz(data: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt' | 'responseCount'>): Promise<Quiz> {
  if (isMockMode) {
    const created = mockDb.createQuiz(data);
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/quizzes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(created),
        });
      } catch {}
    }
    return created;
  }
  const { collection, addDoc, serverTimestamp } = await firestoreModule();
  const ref = await addDoc(collection(db!, 'quizzes'), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), responseCount: 0,
  });
  return { ...data, id: ref.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), responseCount: 0 };
}

export async function updateQuiz(id: string, data: Partial<Quiz>): Promise<void> {
  if (isMockMode) {
    mockDb.updateQuiz(id, data);
    if (typeof window !== 'undefined') {
      try {
        await fetch(`/api/quizzes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch {}
    }
    return;
  }
  const { doc, updateDoc, serverTimestamp } = await firestoreModule();
  await updateDoc(doc(db!, 'quizzes', id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteQuiz(id: string): Promise<void> {
  if (isMockMode) {
    mockDb.deleteQuiz(id);
    if (typeof window !== 'undefined') {
      try {
        await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
      } catch {}
    }
    return;
  }
  const { doc, deleteDoc } = await firestoreModule();
  await deleteDoc(doc(db!, 'quizzes', id));
}

// ── Attempt CRUD ──

export async function createAttempt(quizId: string, studentName: string, studentEmail: string, durationMinutes: number): Promise<QuizAttempt> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const attempt: Omit<QuizAttempt, 'id'> = {
    quizId, studentName, studentEmail, answers: {},
    startedAt: now.toISOString(), expiresAt: expiresAt.toISOString(),
  };

  if (isMockMode) return mockDb.createAttempt(attempt);

  const { collection, addDoc, serverTimestamp, Timestamp } = await firestoreModule();
  const expiresAtTs = Timestamp.fromDate(expiresAt);
  const ref = await addDoc(collection(db!, 'attempts'), {
    ...attempt, startedAt: serverTimestamp(), expiresAt: expiresAtTs,
  });
  return { ...attempt, id: ref.id };
}

export async function findActiveAttempt(quizId: string, studentEmail: string): Promise<QuizAttempt | null> {
  if (isMockMode) return mockDb.getAttemptByStudent(quizId, studentEmail) || null;
  const { collection, query, where, getDocs, limit } = await firestoreModule();
  const snap = await getDocs(
    query(collection(db!, 'attempts'),
      where('quizId', '==', quizId),
      where('studentEmail', '==', studentEmail),
      where('submittedAt', '==', null),
      limit(1))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as QuizAttempt;
}

export async function findSubmittedAttempt(quizId: string, studentEmail: string): Promise<QuizAttempt | null> {
  if (isMockMode) {
    const attempts = mockDb.getAttempts(quizId);
    return attempts.find(a => a.studentEmail === studentEmail && a.submittedAt) || null;
  }
  const { collection, query, where, getDocs, limit, orderBy } = await firestoreModule();
  const snap = await getDocs(
    query(collection(db!, 'attempts'),
      where('quizId', '==', quizId),
      where('studentEmail', '==', studentEmail),
      where('submittedAt', '!=', null),
      orderBy('submittedAt', 'desc'),
      limit(1))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as QuizAttempt;
}

export async function submitAttempt(
  attemptId: string,
  answers: Record<string, number>,
  quiz: Quiz,
  autoSubmitted: boolean
): Promise<QuizAttempt> {
  // Grade
  let score = 0;
  let totalMarks = 0;
  for (const q of quiz.questions) {
    totalMarks += q.points;
    if (answers[q.id] === q.answer) score += q.points;
  }
  const now = new Date();
  const updateData: Partial<QuizAttempt> = {
    answers, score, totalMarks,
    percentage: totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0,
    submittedAt: now.toISOString(), autoSubmitted,
  };

  if (isMockMode) {
    const attempt = mockDb.getAttempt(attemptId);
    if (attempt) {
      const timeTaken = Math.floor((now.getTime() - new Date(attempt.startedAt).getTime()) / 1000);
      updateData.timeTakenSeconds = timeTaken;
    }
    return mockDb.submitAttempt(attemptId, updateData) as QuizAttempt;
  }

  const { doc, getDoc, updateDoc, serverTimestamp } = await firestoreModule();
  const attemptRef = doc(db!, 'attempts', attemptId);
  const attemptSnap = await getDoc(attemptRef);
  if (attemptSnap.exists()) {
    const data = attemptSnap.data();
    const startedAt = data.startedAt?.toDate ? data.startedAt.toDate() : new Date(data.startedAt);
    updateData.timeTakenSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
  }
  await updateDoc(attemptRef, { ...updateData, submittedAt: serverTimestamp() });

  // Update response count
  const quizRef = doc(db!, 'quizzes', quiz.id);
  const { increment } = await firestoreModule();
  await import('firebase/firestore').then(m => m.updateDoc(quizRef, { responseCount: increment(1) }));

  return { id: attemptId, quizId: quiz.id, studentName: '', studentEmail: '', startedAt: '', expiresAt: '', ...updateData } as QuizAttempt;
}

export async function getAttempts(quizId: string): Promise<QuizAttempt[]> {
  if (isMockMode) return mockDb.getAttempts(quizId);
  const { collection, query, where, getDocs, orderBy } = await firestoreModule();
  const snap = await getDocs(
    query(collection(db!, 'attempts'),
      where('quizId', '==', quizId),
      where('submittedAt', '!=', null),
      orderBy('submittedAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizAttempt));
}

export function computeStats(attempts: QuizAttempt[]): ResponseStats {
  if (attempts.length === 0) {
    return { totalResponses: 0, averageScore: 0, highestScore: 0, lowestScore: 0, averageTimeTaken: 0 };
  }
  const scores = attempts.map(a => a.percentage || 0);
  const times = attempts.map(a => a.timeTakenSeconds || 0);
  return {
    totalResponses: attempts.length,
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores),
    averageTimeTaken: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
  };
}

// ── Storage ──

export async function uploadDiagramImage(file: File, quizId: string, questionId: string): Promise<string> {
  if (isMockMode) {
    // Return a fake data URL for mock mode
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
  const { ref, uploadBytes, getDownloadURL } = await storageModule();
  const path = `diagrams/${quizId}/${questionId}_${Date.now()}.png`;
  const storageRef = ref(storage!, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadDiagramBlob(blob: Blob, quizId: string, questionId: string): Promise<string> {
  if (isMockMode) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }
  const { ref, uploadBytes, getDownloadURL } = await storageModule();
  const path = `diagrams/${quizId}/${questionId}_${Date.now()}.png`;
  const storageRef = ref(storage!, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

// ── CSV Export ──

export function exportToCsv(attempts: QuizAttempt[], quiz: Quiz): string {
  const headers = ['Name', 'Roll No./Email', 'Score', 'Total Marks', 'Percentage', 'Time Taken (min)', 'Auto-Submitted', 'Submitted At'];
  const rows = attempts.map(a => [
    a.studentName,
    a.studentEmail,
    a.score?.toString() || '0',
    a.totalMarks?.toString() || '0',
    `${a.percentage || 0}%`,
    a.timeTakenSeconds ? (a.timeTakenSeconds / 60).toFixed(1) : 'N/A',
    a.autoSubmitted ? 'Yes' : 'No',
    a.submittedAt ? new Date(a.submittedAt).toLocaleString() : 'N/A',
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  return csv;
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateQuestionId(): string {
  return uuidv4().substring(0, 8);
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
