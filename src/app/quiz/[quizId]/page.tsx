'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { Quiz, QuizAttempt } from '@/lib/types';
import { getQuiz, createAttempt, findActiveAttempt, findSubmittedAttempt, submitAttempt, formatTime } from '@/lib/utils';

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export default function StudentQuizPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const quizId = resolvedParams.quizId;

  // Quiz & Attempt State
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Student Input State
  const [studentName, setStudentName] = useState('');
  const [studentDivision, setStudentDivision] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [startLoading, setStartLoading] = useState(false);

  // Active Test State
  const [activeAttempt, setActiveAttempt] = useState<QuizAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Submission & Results State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submittedAttempt, setSubmittedAttempt] = useState<QuizAttempt | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const answersRef = useRef<Record<string, number>>({});
  answersRef.current = answers;
  const isSubmittingRef = useRef<boolean>(false);

  // Prevent accidental tab closure during live test
  useEffect(() => {
    if (!activeAttempt || submittedAttempt) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeAttempt, submittedAttempt]);

  // Step 1: Initial Single Read to load Quiz (Concurrency optimization: 1 read only)
  useEffect(() => {
    async function fetchQuiz() {
      try {
        setLoading(true);
        const q = await getQuiz(quizId);
        if (!q) {
          setErrorMsg('Quiz not found. Please verify the URL or ID provided by your instructor.');
          return;
        }
        setQuiz(q);

        // Check if there is a cached attempt ID in localStorage for this quiz
        const cachedAttemptId = localStorage.getItem(`quiz_active_attempt_${quizId}`);
        if (cachedAttemptId) {
          const cachedAnswers = localStorage.getItem(`quiz_answers_${cachedAttemptId}`);
          if (cachedAnswers) {
            try {
              setAnswers(JSON.parse(cachedAnswers));
            } catch {
              // ignore
            }
          }
        }
      } catch (err: any) {
        console.error('fetchQuiz error:', err);
        const code = err?.code || '';
        const msg = err?.message || '';
        if (code === 'permission-denied' || msg.includes('permission') || msg.includes('Permission')) {
          setErrorMsg('PERMISSION_DENIED');
        } else {
          setErrorMsg(msg || 'Failed to load quiz details');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
  }, [quizId]);

  // Step 2: Start Quiz Handler (Concurrency optimization: 1 write to start)
  const divisionsList = quiz?.divisions && quiz.divisions.length > 0
    ? quiz.divisions
    : ['6th A', '6th B', '6th C', '6th D', '6th E', '6th F'];

  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quiz || !studentName.trim()) return;
    if (divisionsList.length > 0 && !studentDivision) {
      setErrorMsg('Please select your Standard/ Division.');
      return;
    }

    try {
      setStartLoading(true);
      setErrorMsg(null);

      const studentKey = studentEmail.trim() || `${studentName.trim().toLowerCase().replace(/\s+/g, '_')}_${studentDivision.replace(/\s+/g, '_')}@exam.local`;

      // Check for single attempt rule
      if (quiz.allowSingleAttempt) {
        const existing = await findSubmittedAttempt(quiz.id, studentKey.toLowerCase());
        if (existing) {
          setSubmittedAttempt(existing);
          return;
        }
      }

      // Check if student already has an active, unsubmitted attempt to resume
      let attempt = await findActiveAttempt(quiz.id, studentKey.toLowerCase());

      if (!attempt) {
        attempt = await createAttempt(
          quiz.id,
          studentName.trim(),
          studentKey.toLowerCase(),
          quiz.durationMinutes,
          studentDivision
        );
      }

      // Persist active attempt in localStorage
      localStorage.setItem(`quiz_active_attempt_${quiz.id}`, attempt.id);

      // Restore any localStorage saved answers
      const savedAnswers = localStorage.getItem(`quiz_answers_${attempt.id}`);
      if (savedAnswers) {
        try {
          const parsed = JSON.parse(savedAnswers);
          setAnswers(parsed);
        } catch {
          // ignore
        }
      }

      setActiveAttempt(attempt);
    } catch (err: any) {
      console.error('handleStartQuiz error:', err);
      const code = err?.code || '';
      const msg = err?.message || 'Failed to start quiz';
      if (code === 'permission-denied' || msg.includes('permission')) {
        setErrorMsg('Firebase Permission Denied: Student attempts cannot be written. Please check Firestore Rules.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setStartLoading(false);
    }
  };

  // Step 3: Server-Anchored Countdown Timer
  useEffect(() => {
    if (!activeAttempt || submittedAttempt) return;

    function syncTimer() {
      if (!activeAttempt) return;
      const now = Date.now();
      const expires = new Date(activeAttempt.expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      setSecondsRemaining(diff);

      // Auto-Submit when timer hits 00:00
      if (diff <= 0) {
        handleFinalSubmit(true);
      }
    }

    syncTimer();
    timerRef.current = setInterval(syncTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeAttempt, submittedAttempt]);

  // Step 4: Handle Answer Selection with instant LocalStorage Persistence
  const handleSelectOption = (questionId: string, optionNumber: number) => {
    if (!activeAttempt || submittedAttempt || isSubmitting) return;

    const updated = { ...answers, [questionId]: optionNumber };
    setAnswers(updated);
    answersRef.current = updated;

    // Save to localStorage so accidental refresh never loses progress
    localStorage.setItem(`quiz_answers_${activeAttempt.id}`, JSON.stringify(updated));
  };

  // Step 5: Final Submission (Manual or Auto-Submit)
  const handleFinalSubmit = async (autoSubmitted = false) => {
    if (!activeAttempt || !quiz || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      // Gather latest answers from state/ref and localStorage
      let latestAnswers = { ...answersRef.current };
      try {
        const cached = localStorage.getItem(`quiz_answers_${activeAttempt.id}`);
        if (cached) {
          latestAnswers = { ...latestAnswers, ...JSON.parse(cached) };
        }
      } catch {
        // use latestAnswers
      }

      // Concurrency optimization: 1 write on final submission
      const graded = await submitAttempt(activeAttempt.id, latestAnswers, quiz, autoSubmitted);

      // Clear localStorage cache
      localStorage.removeItem(`quiz_active_attempt_${quiz.id}`);
      localStorage.removeItem(`quiz_answers_${activeAttempt.id}`);

      setSubmittedAttempt(graded);
      setActiveAttempt(null);
      setShowSubmitConfirm(false);
    } catch (err: any) {
      console.error('Submission error:', err);
      setErrorMsg('Failed to record submission. Please check connection and retry.');
      isSubmittingRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = quiz?.questions.length || 0;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#673ab7] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-gray-700">Loading Exam Paper...</p>
        </div>
      </div>
    );
  }

  // Error Screen
  if (errorMsg || !quiz) {
    const isPermDenied = errorMsg === 'PERMISSION_DENIED' || errorMsg?.includes('permission-denied') || errorMsg?.includes('Permission');
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center p-4">
        <div className="gf-card max-w-lg w-full overflow-hidden shadow-md">
          <div className="gf-header-accent" />
          <div className="p-8 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <svg className="w-8 h-8 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h1 className="text-xl font-semibold text-gray-900">Quiz Unavailable</h1>
            </div>

            {isPermDenied ? (
              <div className="space-y-3">
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  <strong>Firebase Permission Denied:</strong> Your Firestore database is blocking unauthenticated students from reading the quiz.
                </p>
                <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="font-semibold text-gray-900">How to fix in Firebase Console (1 minute):</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
                    <li>Open <strong>Firebase Console</strong> → your project → <strong>Firestore Database</strong>.</li>
                    <li>Click the <strong>Rules</strong> tab at the top.</li>
                    <li>Paste the updated rules to allow public read on quizzes and public read/write on attempts.</li>
                    <li>Click <strong>Publish</strong>.</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  {errorMsg || 'This quiz could not be loaded. Please verify the URL or ID provided by your instructor.'}
                </p>
                <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
                  <div className="font-mono text-gray-500 break-all">
                    Attempted ID: <span className="text-[#673ab7] font-semibold">{quizId}</span>
                  </div>
                  <p className="text-gray-500 pt-1">
                    Tip: If opening on a phone, make sure the link was not cut off or mistyped, or scan the QR code directly from the instructor dashboard.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2 text-center">
              <Link href="/" className="gf-btn-outline inline-flex items-center gap-2">
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Not Accepting Responses
  if (!quiz.isAcceptingResponses && !activeAttempt && !submittedAttempt) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center p-4">
        <div className="gf-card max-w-lg w-full overflow-hidden">
          <div className="gf-header-accent" />
          <div className="p-8 text-center space-y-4">
            <h1 className="text-2xl font-semibold text-gray-900">{quiz.title}</h1>
            <p className="text-sm text-gray-600">
              This form is no longer accepting responses. Try contacting the owner of the form if you think this is a mistake.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE 3: SUBMISSION SCORE CARD & REVIEW SCREEN ──
  if (submittedAttempt) {
    const totalMarks = submittedAttempt.totalMarks || quiz.questions.reduce((a, b) => a + b.points, 0);
    const score = submittedAttempt.score || 0;
    const percentage = submittedAttempt.percentage || (totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0);

    // Calculate detailed breakdown
    let markedCorrectCount = 0;
    let markedIncorrectCount = 0;
    let unmarkedCount = 0;

    quiz.questions.forEach((q) => {
      const studentChoice = submittedAttempt.answers?.[q.id];
      if (studentChoice === undefined || studentChoice === null) {
        unmarkedCount++;
      } else if (studentChoice === q.answer) {
        markedCorrectCount++;
      } else {
        markedIncorrectCount++;
      }
    });

    return (
      <div className="min-h-screen bg-[#f0ebf8] py-12 px-4">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Top Score Card */}
          <div className="gf-card overflow-hidden">
            <div className="gf-header-accent" />
            <div className="p-8 space-y-5">
              <div>
                <h1 className="text-2xl font-normal text-gray-900">{quiz.title}</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Candidate: <strong className="text-gray-900">{submittedAttempt.studentName}</strong>
                  {submittedAttempt.studentDivision && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-100 text-[#673ab7] font-semibold text-xs">
                      {submittedAttempt.studentDivision}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Your response has been recorded.
                </p>
              </div>

              {submittedAttempt.autoSubmitted && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3 text-amber-900">
                  <span className="text-xl shrink-0">⏱️</span>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-amber-900 text-sm">Exam Timer Ended — Automatically Submitted</p>
                    <p className="text-amber-800 leading-relaxed">
                      The countdown timer reached 00:00. Your exam was automatically submitted with all marked answers. Any unmarked questions have been recorded with <strong>0 marks</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Main Score Display Box */}
              <div className="p-5 rounded-lg bg-[#ede7f6]/60 border border-purple-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#673ab7] uppercase tracking-wider">Total Score</p>
                  <p className="text-3xl font-light text-gray-900 mt-0.5">
                    {score} <span className="text-lg text-gray-500">/ {totalMarks} points</span>
                  </p>
                </div>

                <div className="text-right text-xs text-gray-600 space-y-1">
                  <p>Grade Percentage: <strong className="text-base text-[#673ab7] font-semibold">{percentage}%</strong></p>
                  <p>Time Taken: <strong>{submittedAttempt.timeTakenSeconds ? `${Math.round(submittedAttempt.timeTakenSeconds / 60)} min` : 'N/A'}</strong></p>
                </div>
              </div>

              {/* Marked vs Unmarked 3-Pillar Breakdown */}
              <div className="grid grid-cols-3 gap-3 pt-1 text-center text-xs">
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Marked Correct</span>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">{markedCorrectCount}</p>
                  <span className="text-[11px] text-emerald-600 font-medium">+{score} pts</span>
                </div>

                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                  <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">Marked Wrong</span>
                  <p className="text-xl font-bold text-rose-700 mt-0.5">{markedIncorrectCount}</p>
                  <span className="text-[11px] text-rose-600 font-medium">0 pts</span>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">Unmarked</span>
                  <p className="text-xl font-bold text-amber-700 mt-0.5">{unmarkedCount}</p>
                  <span className="text-[11px] text-amber-600 font-medium">0 pts</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span>Candidate: <strong className="text-gray-800">{submittedAttempt.studentName}</strong> ({submittedAttempt.studentEmail})</span>
                <span className="text-gray-400">Total: {quiz.questions.length} questions</span>
              </div>
            </div>
          </div>

          {/* Question-by-Question Review with Marked & Unmarked Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-semibold text-gray-800">
                Question Breakdown & Marked Results
              </h2>
              <span className="text-xs text-gray-500">
                Unmarked questions scored as 0 pts
              </span>
            </div>

            {quiz.questions.map((q, idx) => {
              const studentChoice = submittedAttempt.answers?.[q.id];
              const isCorrect = studentChoice === q.answer;
              const isUnanswered = studentChoice === undefined || studentChoice === null;

              return (
                <div
                  key={q.id}
                  className={`gf-card p-6 space-y-3.5 transition-all ${
                    isCorrect
                      ? 'border-l-4 border-l-emerald-500'
                      : isUnanswered
                      ? 'border-l-4 border-l-amber-400 bg-amber-50/10'
                      : 'border-l-4 border-l-rose-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-sm text-gray-900 leading-relaxed">
                      {idx + 1}. {q.question}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                        isCorrect
                          ? 'bg-emerald-100 text-emerald-800'
                          : isUnanswered
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isCorrect
                        ? `✓ Correct (+${q.points} pt)`
                        : isUnanswered
                        ? `○ Unmarked (0 / ${q.points} pt)`
                        : `✗ Incorrect (0 / ${q.points} pt)`}
                    </span>
                  </div>

                  {q.diagramUrl && (
                    <div className="max-h-52 flex justify-center bg-gray-50 p-2 rounded border border-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.diagramUrl} alt="Question Diagram" className="max-h-48 object-contain" />
                    </div>
                  )}

                  {/* Options */}
                  <div className="space-y-1.5 pt-1">
                    {q.options.map((opt, optIdx) => {
                      const optNum = optIdx + 1;
                      const isChosen = studentChoice === optNum;
                      const isAnswerKey = q.answer === optNum;

                      let style = 'bg-gray-50/80 text-gray-700 border-gray-200';
                      if (isAnswerKey) {
                        style = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium';
                      } else if (isChosen && !isAnswerKey) {
                        style = 'bg-rose-50 border-rose-300 text-rose-900 line-through';
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 rounded-md border text-xs flex items-center justify-between ${style}`}
                        >
                          <span>
                            <span className="font-bold mr-2">{String.fromCharCode(65 + optIdx)}.</span>
                            {opt}
                          </span>

                          <div className="flex items-center gap-2">
                            {isChosen && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isAnswerKey ? 'bg-emerald-700 text-white' : 'bg-gray-900 text-white'}`}>
                                Your Choice
                              </span>
                            )}
                            {isAnswerKey && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-medium">
                                Correct Key
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Unmarked Question Notice */}
                  {isUnanswered && (
                    <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-1.5 font-medium">
                      <span>⚠️ You did not mark an answer for this question. Scored <strong>0 points</strong>.</span>
                    </div>
                  )}

                  {q.explanation && (
                    <div className="p-3 bg-[#ede7f6]/60 rounded-md border border-purple-100 text-xs text-gray-700 mt-2">
                      <span className="font-bold text-[#673ab7]">Explanation: </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE 1: PRE-TEST START SCREEN (Google Forms Style) ──
  if (!activeAttempt) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] py-8 sm:py-12 px-4 flex justify-center">
        <form onSubmit={handleStartQuiz} className="max-w-2xl w-full space-y-4">
          {/* Header Card */}
          <div className="gf-card overflow-hidden">
            <div className="gf-header-accent" />
            <div className="p-6 sm:p-8 space-y-4">
              <h1 className="text-2xl sm:text-3xl font-normal text-gray-900 tracking-tight">
                {quiz.title}
              </h1>
              {quiz.description && (
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {quiz.description}
                </p>
              )}

              {/* Test Summary Badges */}
              <div className="p-3.5 rounded-lg bg-[#ede7f6]/60 border border-purple-100 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-medium text-gray-500 uppercase text-[10px]">Questions</p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">{quiz.questions.length}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500 uppercase text-[10px]">Total Marks</p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">
                    {quiz.questions.reduce((a, b) => a + b.points, 0)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-500 uppercase text-[10px]">Time Limit</p>
                  <p className="text-base font-bold text-[#673ab7] mt-0.5">{quiz.durationMinutes} min</p>
                </div>
              </div>

              <div className="text-xs text-red-500 font-medium pt-1">
                * Indicates required question
              </div>
            </div>
          </div>

          {/* Card 1: Full Name of the Student */}
          <div className="gf-card p-6 border border-[#dadce0] rounded-lg bg-white space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-900 flex items-center gap-1">
                Full Name of the Student <span className="text-red-500">*</span>
              </label>
              <p className="text-xs font-semibold text-gray-700 mt-0.5">
                (Name &nbsp;&nbsp; Father's Name &nbsp;&nbsp; Surname)
              </p>
            </div>
            <div className="pt-2">
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Short-answer text"
                className="w-full text-sm text-gray-900 gf-input-underline pb-2 placeholder-gray-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Card 2: Standard/ Division */}
          {divisionsList.length > 0 && (
            <div className="gf-card p-6 border border-[#dadce0] rounded-lg bg-white space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-900 flex items-center gap-1">
                  Standard/ Division <span className="text-red-500">*</span>
                </label>
                {/* 6 drag dots icon at top like Google Forms */}
                <div className="text-gray-300">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="7" r="1.5"/><circle cx="15" cy="7" r="1.5"/>
                    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                    <circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/>
                  </svg>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                {divisionsList.map((div, idx) => {
                  const isSelected = studentDivision === div;
                  return (
                    <div
                      key={idx}
                      onClick={() => setStudentDivision(div)}
                      className="flex items-center gap-3 p-2.5 rounded-md hover:bg-gray-50/80 cursor-pointer text-sm text-gray-800 select-none group transition-colors"
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'border-[#673ab7]' : 'border-gray-400 group-hover:border-gray-600'
                        }`}
                      >
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#673ab7]" />}
                      </div>
                      <span className={isSelected ? 'font-medium text-[#673ab7]' : 'text-gray-800'}>
                        {div}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Card 3: Roll Number (Optional) */}
          <div className="gf-card p-6 border border-[#dadce0] rounded-lg bg-white space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-900">
                Roll Number / ID Number <span className="text-xs text-gray-400 font-normal">(Optional)</span>
              </label>
            </div>
            <div className="pt-1">
              <input
                type="text"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                placeholder="Short-answer text"
                className="w-full text-sm text-gray-900 gf-input-underline pb-2 placeholder-gray-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={startLoading || !studentName.trim() || (divisionsList.length > 0 && !studentDivision)}
              className="gf-btn-primary px-8 py-2.5 text-sm cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {startLoading ? 'Preparing Exam Session...' : 'Start Quiz →'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStudentName('');
                setStudentDivision('');
                setStudentEmail('');
              }}
              className="text-xs text-[#673ab7] hover:underline font-medium cursor-pointer"
            >
              Clear form
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── PHASE 2: LIVE QUIZ TAKING WITH TAMPER-RESISTANT TIMER ──
  const isAmber = secondsRemaining !== null && secondsRemaining <= 600 && secondsRemaining > 120;
  const isRed = secondsRemaining !== null && secondsRemaining <= 120;

  return (
    <div className="min-h-screen bg-[#f0ebf8] pb-36">
      {/* Google Forms Sticky Top Bar */}
      <header className="gf-timer-bar">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-medium text-gray-900 text-sm hidden sm:inline truncate max-w-xs">
              {quiz.title}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[#ede7f6] text-[#673ab7]">
              {answeredCount} of {totalQuestions} answered
            </span>
          </div>

          {/* Countdown & Submit Button */}
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-1.5 font-mono text-base font-bold tracking-wider ${
                isRed ? 'timer-red' : isAmber ? 'timer-amber' : 'text-gray-800'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{secondsRemaining !== null ? formatTime(secondsRemaining) : '--:--:--'}</span>
            </div>

            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="gf-btn-primary text-xs py-1.5 px-4"
            >
              Submit
            </button>
          </div>
        </div>
      </header>

      {/* Main Single Column Exam Paper */}
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
        {/* Header Card */}
        <div className="gf-card overflow-hidden">
          <div className="gf-header-accent" />
          <div className="p-6 space-y-2">
            <h1 className="text-2xl font-normal text-gray-900">{quiz.title}</h1>
            <p className="text-sm text-gray-600">{quiz.description}</p>
            <div className="pt-3 text-xs text-gray-500 font-medium flex items-center justify-between border-t border-gray-100">
              <span>Candidate: <strong className="text-gray-800">{activeAttempt.studentName}</strong> ({activeAttempt.studentEmail})</span>
              <span>Total Questions: {totalQuestions}</span>
            </div>
          </div>
        </div>

        {/* Questions Cards */}
        {quiz.questions.map((q, idx) => {
          const selectedOption = answers[q.id];

          return (
            <div
              key={q.id}
              className="gf-card p-6 space-y-4 hover:border-gray-400 transition-colors"
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#ede7f6] text-[#673ab7] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="font-normal text-gray-900 text-base leading-relaxed">
                    {q.question}
                  </p>
                </div>
                <span className="text-xs text-gray-400 font-medium shrink-0">
                  {q.points} pt{q.points > 1 ? 's' : ''}
                </span>
              </div>

              {/* Diagram */}
              {q.diagramUrl && (
                <div className="max-h-72 flex justify-center bg-gray-50 p-2 rounded-lg border border-gray-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={q.diagramUrl} alt="Question diagram" className="max-h-64 object-contain rounded" />
                </div>
              )}

              {/* 4 MCQ Option Radios */}
              <div className="space-y-2 pt-1">
                {q.options.map((opt, optIdx) => {
                  const optionNum = optIdx + 1;
                  const isChecked = selectedOption === optionNum;

                  return (
                    <label
                      key={optIdx}
                      onClick={() => handleSelectOption(q.id, optionNum)}
                      className={`flex items-center gap-3.5 p-3 rounded-lg border cursor-pointer select-none transition-all ${
                        isChecked
                          ? 'border-[#673ab7] bg-[#ede7f6]/40 text-gray-900 font-medium'
                          : 'border-[#dadce0] bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        checked={isChecked}
                        onChange={() => {}}
                        className="gf-radio"
                      />
                      <span className="text-xs font-bold text-gray-400 w-4">
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      <span className="text-sm flex-1">{opt}</span>
                    </label>
                  );
                })}
              </div>

              {/* Clear Selection Link */}
              {selectedOption !== undefined && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...answers };
                      delete next[q.id];
                      setAnswers(next);
                      if (activeAttempt) {
                        localStorage.setItem(`quiz_answers_${activeAttempt.id}`, JSON.stringify(next));
                      }
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 font-medium cursor-pointer"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom Submit Card */}
        <div className="gf-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Finished your exam?</p>
            <p className="text-xs text-gray-500 mt-0.5">
              You have answered {answeredCount} of {totalQuestions} questions.
            </p>
          </div>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="gf-btn-primary w-full sm:w-auto text-sm"
          >
            Submit Final Exam
          </button>
        </div>
      </main>

      {/* Confirmation Dialog before Manual Submit */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="gf-card max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Submit Quiz?</h3>

            {unansweredCount > 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-md border border-amber-200">
                You have <strong>{unansweredCount}</strong> unanswered question{unansweredCount > 1 ? 's' : ''} remaining. Are you sure you want to finalize and submit?
              </p>
            ) : (
              <p className="text-xs text-gray-600">
                You have answered all {totalQuestions} questions. Once submitted, your answers cannot be altered.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="gf-btn-text text-xs"
              >
                Continue Quiz
              </button>
              <button
                type="button"
                onClick={() => handleFinalSubmit(false)}
                disabled={isSubmitting}
                className="gf-btn-primary text-xs"
              >
                {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
