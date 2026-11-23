'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Quiz } from '@/lib/types';
import { getQuizzes, createQuiz, updateQuiz, deleteQuiz } from '@/lib/utils';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [qrModalQuizId, setQrModalQuizId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const list = await getQuizzes();
      setQuizzes(list);
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateNew = async () => {
    try {
      setIsCreating(true);
      const newQuiz = await createQuiz({
        title: 'Untitled Quiz',
        description: 'Provide instructions for students here...',
        durationMinutes: 90,
        isAcceptingResponses: true,
        showResultsImmediately: true,
        allowSingleAttempt: true,
        questions: [
          {
            id: 'q1',
            num: 1,
            question: 'Sample Question 1',
            options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
            answer: 1,
            points: 1,
            explanation: 'Explanation for question 1.',
          },
        ],
      });
      router.push(`/admin/edit/${newQuiz.id}`);
    } catch (err: any) {
      console.error('Failed to create quiz:', err);
      const msg = err.code ? `[${err.code}] ${err.message}` : (err.message || 'Error creating new quiz');
      showToast(`Error creating quiz: ${msg}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleStatus = async (quiz: Quiz) => {
    const nextStatus = !quiz.isAcceptingResponses;
    try {
      await updateQuiz(quiz.id, { isAcceptingResponses: nextStatus });
      setQuizzes((prev) =>
        prev.map((q) => (q.id === quiz.id ? { ...q, isAcceptingResponses: nextStatus } : q))
      );
      showToast(nextStatus ? 'Quiz is now accepting responses' : 'Quiz responses closed');
    } catch (err) {
      console.error(err);
      showToast('Failed to update quiz status');
    }
  };

  const handleCopyLink = (quizId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const studentUrl = `${origin}/quiz/${quizId}`;
    navigator.clipboard.writeText(studentUrl);
    showToast('✓ Student quiz link copied to clipboard!');
  };

  const handleDelete = async (quizId: string) => {
    try {
      await deleteQuiz(quizId);
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      setDeleteConfirmId(null);
      showToast('Quiz deleted');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete quiz');
    }
  };

  const filteredQuizzes = quizzes.filter((q) =>
    q.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#323232] text-white px-5 py-3 rounded-md shadow-lg text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* "Start a new form" Section (Google Forms Style) */}
      <section className="bg-white rounded-xl p-6 border border-[#dadce0] shadow-xs">
        <h2 className="text-base font-medium text-gray-800 mb-4">Start a new quiz / exam</h2>
        <div className="flex flex-wrap gap-6 items-start">
          {/* Blank Quiz Card */}
          <button
            onClick={handleCreateNew}
            disabled={isCreating}
            className="flex flex-col items-center gap-2 group text-left cursor-pointer"
          >
            <div className="w-36 h-28 rounded-lg border-2 border-dashed border-[#dadce0] group-hover:border-[#673ab7] bg-gray-50/50 group-hover:bg-[#f0ebf8]/50 flex items-center justify-center transition-all shadow-xs">
              {isCreating ? (
                <div className="w-8 h-8 border-3 border-[#673ab7] border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#ede7f6] group-hover:bg-[#673ab7] text-[#673ab7] group-hover:text-white flex items-center justify-center transition-all">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              )}
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#673ab7]">Blank Quiz</span>
          </button>

          {/* Quick Metrics Cards */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 self-center">
            <div className="p-3.5 rounded-lg bg-[#f0ebf8]/60 border border-purple-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#673ab7] text-white flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Total Quizzes</p>
                <p className="text-xl font-bold text-gray-900">{quizzes.length}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-emerald-50/80 border border-emerald-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Accepting</p>
                <p className="text-xl font-bold text-gray-900">
                  {quizzes.filter((q) => q.isAcceptingResponses).length}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-blue-50/80 border border-blue-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Total Submissions</p>
                <p className="text-xl font-bold text-gray-900">
                  {quizzes.reduce((a, b) => a + (b.responseCount || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* "Recent forms" Section (Google Forms Style) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <h2 className="text-base font-semibold text-gray-800">Recent quizzes & exam papers</h2>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search quizzes..."
              className="w-full text-xs py-2 pl-9 pr-3 rounded-lg border border-[#dadce0] bg-white focus:outline-none focus:border-[#673ab7] transition-all shadow-2xs"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-gray-500 bg-white rounded-xl border border-[#dadce0]">
            <div className="w-8 h-8 border-3 border-[#673ab7] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading quizzes...
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-xl border border-[#dadce0] space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#ede7f6] text-[#673ab7] flex items-center justify-center mx-auto">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
            </div>
            <div>
              <p className="text-base font-medium text-gray-800">No quizzes match your search</p>
              <p className="text-xs text-gray-500 mt-1">Click &quot;Blank Quiz&quot; above to create a new exam paper.</p>
            </div>
          </div>
        ) : (
          /* Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="gf-card flex flex-col justify-between overflow-hidden group hover:border-[#673ab7]/40"
              >
                {/* Card Top Accent & Header */}
                <div>
                  <div className="h-2 bg-[#673ab7]" />
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/edit/${quiz.id}`}
                        className="text-base font-semibold text-gray-900 group-hover:text-[#673ab7] transition-colors line-clamp-1"
                      >
                        {quiz.title || 'Untitled Quiz'}
                      </Link>
                      <button
                        onClick={() => handleToggleStatus(quiz)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider transition-colors ${
                          quiz.isAcceptingResponses
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title="Click to toggle accepting responses"
                      >
                        {quiz.isAcceptingResponses ? 'Accepting' : 'Closed'}
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 line-clamp-2 min-h-[32px]">
                      {quiz.description || 'No instructions provided.'}
                    </p>

                    {/* Metadata Badges */}
                    <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {quiz.questions?.length || 0} Questions
                      </span>

                      <span className="flex items-center gap-1 font-medium">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {quiz.durationMinutes}m
                      </span>

                      <span className="flex items-center gap-1 font-medium text-[#673ab7]">
                        <svg className="w-3.5 h-3.5 text-[#673ab7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {quiz.responseCount || 0} Responses
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Bottom Bar */}
                <div className="px-5 py-3 bg-gray-50/60 border-t border-[#dadce0] flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {/* Preview student view */}
                    <Link
                      href={`/quiz/${quiz.id}`}
                      target="_blank"
                      className="p-1.5 rounded-full text-gray-500 hover:text-[#673ab7] hover:bg-[#ede7f6] transition-colors"
                      title="Preview Student Quiz View"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>

                    {/* Copy student link */}
                    <button
                      onClick={() => handleCopyLink(quiz.id)}
                      className="p-1.5 rounded-full text-gray-500 hover:text-[#673ab7] hover:bg-[#ede7f6] transition-colors"
                      title="Copy Student Quiz Link"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </button>

                    {/* QR Code */}
                    <button
                      onClick={() => setQrModalQuizId(quiz.id)}
                      className="p-1.5 rounded-full text-gray-500 hover:text-[#673ab7] hover:bg-[#ede7f6] transition-colors"
                      title="Show QR Code for Mobile"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </button>

                    {/* View Responses */}
                    <Link
                      href={`/admin/responses/${quiz.id}`}
                      className="p-1.5 rounded-full text-gray-500 hover:text-[#673ab7] hover:bg-[#ede7f6] transition-colors"
                      title="View Student Responses"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </Link>

                    {/* Delete Quiz */}
                    <button
                      onClick={() => setDeleteConfirmId(quiz.id)}
                      className="p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete Quiz"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <Link
                    href={`/admin/edit/${quiz.id}`}
                    className="text-xs font-semibold text-[#673ab7] hover:text-[#5e35a1] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>Edit Form</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="gf-card max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Delete this form?</h3>
            <p className="text-sm text-gray-500">
              This form and all associated student submissions will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="gf-btn-text text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium text-xs shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal for Mobile Access */}
      {qrModalQuizId && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setQrModalQuizId(null)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Scan Exam Link with Phone</h3>
              <button
                type="button"
                onClick={() => setQrModalQuizId(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Point your phone camera at this QR code to open the exam directly:
            </p>

            <div className="flex justify-center p-4 bg-gray-50 rounded-xl border border-gray-200/60 shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
                  typeof window !== 'undefined' ? `${window.location.origin}/quiz/${qrModalQuizId}` : `/quiz/${qrModalQuizId}`
                )}`}
                alt="Quiz QR Code"
                className="w-48 h-48 rounded-lg shadow-xs"
              />
            </div>

            <div className="bg-purple-50 text-[#673ab7] p-2.5 rounded-lg border border-purple-100 text-[11px] font-mono break-all select-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/quiz/${qrModalQuizId}` : `/quiz/${qrModalQuizId}`}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  handleCopyLink(qrModalQuizId);
                  setQrModalQuizId(null);
                }}
                className="gf-btn-outline flex-1 text-xs py-2"
              >
                Copy Link
              </button>
              <button
                type="button"
                onClick={() => setQrModalQuizId(null)}
                className="gf-btn-primary flex-1 text-xs py-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
