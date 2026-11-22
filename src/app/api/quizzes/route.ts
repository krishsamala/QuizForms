import { NextRequest, NextResponse } from 'next/server';
import { readServerQuizzes, writeServerQuizzes } from '@/lib/server-storage';
import { sampleQuiz, sampleQuiz2 } from '@/lib/mock-data';
import { Quiz } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getInitializedQuizzes(): Quiz[] {
  let list = readServerQuizzes();
  if (list.length === 0) {
    list = [sampleQuiz, sampleQuiz2];
    writeServerQuizzes(list);
  }
  return list;
}

export async function GET() {
  const quizzes = getInitializedQuizzes();
  return NextResponse.json(quizzes);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const quizzes = getInitializedQuizzes();

    const id = data.id || Math.random().toString(36).substring(2, 12);
    const newQuiz: Quiz = {
      ...data,
      id,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responseCount: data.responseCount || 0,
    };

    const existingIdx = quizzes.findIndex((q) => q.id === id);
    if (existingIdx !== -1) {
      quizzes[existingIdx] = newQuiz;
    } else {
      quizzes.unshift(newQuiz);
    }

    writeServerQuizzes(quizzes);
    return NextResponse.json(newQuiz);
  } catch (err: any) {
    console.error('Error in POST /api/quizzes:', err);
    return NextResponse.json({ error: err.message || 'Failed to save quiz' }, { status: 500 });
  }
}
