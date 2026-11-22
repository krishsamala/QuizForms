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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const { quizId } = await params;
  const quizzes = getInitializedQuizzes();
  const quiz = quizzes.find((q) => q.id === quizId);

  if (!quiz) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  }

  return NextResponse.json(quiz);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const { quizId } = await params;
  try {
    const patch = await req.json();
    const quizzes = getInitializedQuizzes();
    const idx = quizzes.findIndex((q) => q.id === quizId);

    if (idx === -1) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    quizzes[idx] = {
      ...quizzes[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    writeServerQuizzes(quizzes);
    return NextResponse.json(quizzes[idx]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const { quizId } = await params;
  const quizzes = getInitializedQuizzes();
  const filtered = quizzes.filter((q) => q.id !== quizId);
  writeServerQuizzes(filtered);
  return NextResponse.json({ success: true });
}
