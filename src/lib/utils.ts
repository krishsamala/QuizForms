import { Quiz, QuizAttempt, QuizQuestion, ResponseStats } from './types';
import { isMockMode, db, storage } from './firebase';
import { mockDb, sampleQuiz, sampleQuiz2 } from './mock-data';
import { v4 as uuidv4 } from 'uuid';

// ── Firestore helpers (only used when NOT in mock mode) ──

async function firestoreModule() {
  return await import('firebase/firestore');
}

async function storageModule() {
  return await import('firebase/storage');
}

export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) return null as any;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeForFirestore) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean as T;
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
  if (!id) return null;
  const cleanId = decodeURIComponent(id).trim().replace(/[\/\.\,\s]+$/, '');
  if (!cleanId) return null;

  // Always allow fallback to sample quizzes even in Firestore mode
  if (cleanId === sampleQuiz.id) return sampleQuiz;
  if (cleanId === sampleQuiz2.id) return sampleQuiz2;

  if (isMockMode) {
    const local = mockDb.getQuiz(cleanId);
    if (local) return local;
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/quizzes/${cleanId}`, { cache: 'no-store' });
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
  const snap = await getDoc(doc(db!, 'quizzes', cleanId));
  if (!snap.exists()) {
    if (cleanId === sampleQuiz.id) return sampleQuiz;
    if (cleanId === sampleQuiz2.id) return sampleQuiz2;
    return null;
  }
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
  const cleanData = sanitizeForFirestore({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    responseCount: 0,
  });
  const ref = await addDoc(collection(db!, 'quizzes'), cleanData);
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
  const { doc, setDoc, serverTimestamp } = await firestoreModule();
  const cleanData = sanitizeForFirestore({
    ...data,
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db!, 'quizzes', id), cleanData, { merge: true });
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

export async function createAttempt(
  quizId: string,
  studentName: string,
  studentEmail: string,
  durationMinutes: number,
  studentDivision?: string
): Promise<QuizAttempt> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const cleanEmail = studentEmail?.trim() || `${studentName.trim().toLowerCase().replace(/\s+/g, '_')}@exam.local`;
  const attempt: Omit<QuizAttempt, 'id'> = {
    quizId,
    studentName: studentName.trim(),
    studentEmail: cleanEmail,
    studentDivision: studentDivision || '',
    answers: {},
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  if (isMockMode) return mockDb.createAttempt(attempt);

  const { collection, addDoc, serverTimestamp, Timestamp } = await firestoreModule();
  const expiresAtTs = Timestamp.fromDate(expiresAt);
  const cleanData = sanitizeForFirestore({
    ...attempt,
    startedAt: serverTimestamp(),
    expiresAt: expiresAtTs,
  });
  const ref = await addDoc(collection(db!, 'attempts'), cleanData);
  return { ...attempt, id: ref.id };
}

export async function findActiveAttempt(quizId: string, studentEmail: string): Promise<QuizAttempt | null> {
  if (isMockMode) return mockDb.getAttemptByStudent(quizId, studentEmail) || null;
  const { collection, query, where, getDocs } = await firestoreModule();
  const snap = await getDocs(
    query(collection(db!, 'attempts'),
      where('quizId', '==', quizId),
      where('studentEmail', '==', studentEmail))
  );
  if (snap.empty) return null;
  const activeDoc = snap.docs.find(d => !d.data().submittedAt);
  if (!activeDoc) return null;
  return { id: activeDoc.id, ...activeDoc.data() } as QuizAttempt;
}

export async function findSubmittedAttempt(quizId: string, studentEmail: string): Promise<QuizAttempt | null> {
  if (isMockMode) {
    const attempts = mockDb.getAttempts(quizId);
    return attempts.find(a => a.studentEmail === studentEmail && a.submittedAt) || null;
  }
  const { collection, query, where, getDocs } = await firestoreModule();
  const snap = await getDocs(
    query(collection(db!, 'attempts'),
      where('quizId', '==', quizId),
      where('studentEmail', '==', studentEmail))
  );
  if (snap.empty) return null;
  const submittedDocs = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as QuizAttempt))
    .filter(a => !!a.submittedAt);
  if (submittedDocs.length === 0) return null;
  submittedDocs.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
  return submittedDocs[0];
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

  const { doc, getDoc, setDoc, serverTimestamp, increment } = await firestoreModule();
  const attemptRef = doc(db!, 'attempts', attemptId);
  const attemptSnap = await getDoc(attemptRef);
  if (attemptSnap.exists()) {
    const data = attemptSnap.data();
    const startedAt = data.startedAt?.toDate ? data.startedAt.toDate() : new Date(data.startedAt);
    updateData.timeTakenSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
  }
  const cleanAttempt = sanitizeForFirestore({ ...updateData, submittedAt: serverTimestamp() });
  await setDoc(attemptRef, cleanAttempt, { merge: true });

  // Update response count
  try {
    const quizRef = doc(db!, 'quizzes', quiz.id);
    await setDoc(quizRef, { responseCount: increment(1) }, { merge: true });
  } catch (e) {
    console.warn('Could not increment quiz responseCount:', e);
  }

  return { id: attemptId, quizId: quiz.id, studentName: '', studentEmail: '', startedAt: '', expiresAt: '', ...updateData } as QuizAttempt;
}

export async function getAttempts(quizId: string): Promise<QuizAttempt[]> {
  if (isMockMode) return mockDb.getAttempts(quizId);
  const { collection, query, where, getDocs } = await firestoreModule();
  const snap = await getDocs(
    query(collection(db!, 'attempts'),
      where('quizId', '==', quizId))
  );
  const list = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as QuizAttempt))
    .filter(a => !!a.submittedAt);
  list.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
  return list;
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

// ── Storage & Diagram Helpers ──

/**
 * Compresses an image file/blob to an optimized data URL (max dimension 1000px, JPEG/WebP quality 0.82).
 * Fills white background to ensure transparent diagrams don't turn black.
 */
export function compressImageToDataUrl(
  fileOrBlob: File | Blob,
  maxWidth = 1000,
  maxHeight = 800,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Empty file'));
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          try {
            const webpUrl = canvas.toDataURL('image/webp', quality);
            if (webpUrl.startsWith('data:image/webp')) {
              resolve(webpUrl);
              return;
            }
          } catch {}

          const jpegUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(jpegUrl);
        } catch (scaleErr) {
          console.warn('Canvas scaling warning, using raw data URL:', scaleErr);
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

export async function uploadDiagramImage(file: File, quizId: string, questionId: string): Promise<string> {
  let compressedDataUrl = '';
  try {
    compressedDataUrl = await compressImageToDataUrl(file);
  } catch (err) {
    console.warn('Image compression warning:', err);
  }

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (isMockMode || !storage || !bucket || bucket.trim() === '') {
    if (compressedDataUrl) return compressedDataUrl;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  try {
    const { ref, uploadBytes, getDownloadURL } = await storageModule();
    const path = `diagrams/${quizId}/${questionId}_${Date.now()}.png`;
    const storageRef = ref(storage, path);

    const uploadPromise = (async () => {
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    })();

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase Storage timeout')), 6000)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (storageErr) {
    console.warn('Firebase Storage upload failed or blocked by CORS/permissions. Falling back to embedded diagram:', storageErr);
    if (compressedDataUrl) return compressedDataUrl;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export async function uploadDiagramBlob(blob: Blob, quizId: string, questionId: string): Promise<string> {
  let compressedDataUrl = '';
  try {
    compressedDataUrl = await compressImageToDataUrl(blob);
  } catch (err) {
    console.warn('Blob compression warning:', err);
  }

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (isMockMode || !storage || !bucket || bucket.trim() === '') {
    if (compressedDataUrl) return compressedDataUrl;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  try {
    const { ref, uploadBytes, getDownloadURL } = await storageModule();
    const path = `diagrams/${quizId}/${questionId}_${Date.now()}.png`;
    const storageRef = ref(storage, path);

    const uploadPromise = (async () => {
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
    })();

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase Storage timeout')), 6000)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (storageErr) {
    console.warn('Firebase Storage blob upload failed. Falling back to embedded diagram:', storageErr);
    if (compressedDataUrl) return compressedDataUrl;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// ── CSV Export ──

export function exportToCsv(attempts: QuizAttempt[], quiz: Quiz): string {
  const headers = ['Name', 'Division', 'Roll No./Email', 'Score', 'Total Marks', 'Percentage', 'Time Taken (min)', 'Auto-Submitted', 'Submitted At'];
  const rows = attempts.map(a => [
    a.studentName,
    a.studentDivision || 'N/A',
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
