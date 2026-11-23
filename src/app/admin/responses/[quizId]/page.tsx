'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Quiz, QuizAttempt } from '@/lib/types';
import { getQuiz, getAttempts, computeStats, exportToCsv, downloadCsv, formatTime } from '@/lib/utils';

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export default function QuizResponsesPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const quizId = resolvedParams.quizId;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'time' | 'date' | 'name'>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal Inspection
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttempt | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [qData, aData] = await Promise.all([getQuiz(quizId), getAttempts(quizId)]);
        setQuiz(qData);
        setAttempts(aData);
      } catch (err) {
        console.error('Failed to load responses:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [quizId]);

  const stats = computeStats(attempts);

  const allDivisions = Array.from(
    new Set([
      ...(quiz?.divisions || ['6th A', '6th B', '6th C', '6th D', '6th E', '6th F']),
      ...attempts.map((a) => a.studentDivision).filter(Boolean) as string[],
    ])
  );

  // Filter & Sort Attempts
  const filteredAttempts = attempts
    .filter((a) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        a.studentName.toLowerCase().includes(q) ||
        a.studentEmail.toLowerCase().includes(q) ||
        (a.studentDivision || '').toLowerCase().includes(q);
      const matchesDivision =
        selectedDivision === 'all' || (a.studentDivision || '') === selectedDivision;
      return matchesSearch && matchesDivision;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'score') {
        comparison = (a.percentage || 0) - (b.percentage || 0);
      } else if (sortBy === 'time') {
        comparison = (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
      } else if (sortBy === 'name') {
        comparison = a.studentName.localeCompare(b.studentName);
      } else if (sortBy === 'date') {
        const da = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const db = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        comparison = da - db;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

  const toggleSort = (field: 'score' | 'time' | 'date' | 'name') => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const handleExportCsv = () => {
    if (!quiz) return;
    const csvContent = exportToCsv(attempts, quiz);
    const safeTitle = quiz.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    downloadCsv(csvContent, `${safeTitle}_responses.csv`);
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-3 border-[#673ab7] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Loading Responses...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-red-600 font-semibold">Quiz not found</p>
        <Link href="/admin" className="gf-btn-primary">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Google Forms Tab Bar (Questions / Responses) */}
      <div className="bg-white border-b border-[#dadce0] -mt-8 -mx-4 px-6 mb-6 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href={`/admin/edit/${quiz.id}`}
              className="py-3.5 text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors"
            >
              Questions
            </Link>
            <Link
              href={`/admin/responses/${quiz.id}`}
              className="py-3.5 text-sm font-semibold text-[#673ab7] border-b-2 border-[#673ab7] flex items-center gap-2"
            >
              Responses
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#ede7f6] font-bold text-[#673ab7]">
                {attempts.length}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCsv}
              disabled={attempts.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
              title="Export all submissions to CSV"
            >
              <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/>
              </svg>
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Summary Card */}
        <div className="gf-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-3xl font-light text-gray-900">{attempts.length}</span>
            <span className="text-lg text-gray-600 ml-2">responses</span>
            <p className="text-xs text-gray-500 mt-1">
              Quiz: <strong className="text-gray-800">{quiz.title}</strong> ({quiz.questions.length} questions, {quiz.durationMinutes} min limit)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600">
              {quiz.isAcceptingResponses ? 'Accepting responses' : 'Not accepting responses'}
            </span>
            <span
              className={`w-3 h-3 rounded-full ${
                quiz.isAcceptingResponses ? 'bg-emerald-500' : 'bg-gray-400'
              }`}
            />
          </div>
        </div>

        {/* 5 Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="gf-card p-4 text-center">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Submissions</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.totalResponses}</p>
          </div>

          <div className="gf-card p-4 text-center">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Average</p>
            <p className="text-2xl font-semibold text-[#673ab7] mt-1">{stats.averageScore}%</p>
          </div>

          <div className="gf-card p-4 text-center">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">High Score</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{stats.highestScore}%</p>
          </div>

          <div className="gf-card p-4 text-center">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Low Score</p>
            <p className="text-2xl font-semibold text-rose-600 mt-1">{stats.lowestScore}%</p>
          </div>

          <div className="gf-card p-4 text-center col-span-2 sm:col-span-1">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Avg Time</p>
            <p className="text-2xl font-semibold text-blue-600 mt-1">
              {stats.averageTimeTaken > 0 ? `${Math.round(stats.averageTimeTaken / 60)}m` : '0m'}
            </p>
          </div>
        </div>

        {/* Search & Sort Controls */}
        <div className="gf-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or roll/email..."
              className="w-full text-xs py-2 pl-9 pr-3 rounded-md border border-[#dadce0] focus:border-[#673ab7] focus:outline-none"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 self-end sm:self-auto">
            <span>Division:</span>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="border border-[#dadce0] rounded px-2.5 py-1 text-xs font-medium text-gray-700 bg-white"
            >
              <option value="all">All Divisions ({attempts.length})</option>
              {allDivisions.map((d) => (
                <option key={d} value={d}>
                  {d} ({attempts.filter((a) => (a.studentDivision || '') === d).length})
                </option>
              ))}
            </select>

            <span className="ml-1">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-[#dadce0] rounded px-2.5 py-1 text-xs font-medium text-gray-700 bg-white"
            >
              <option value="score">Score (%)</option>
              <option value="time">Time Taken</option>
              <option value="date">Submission Time</option>
              <option value="name">Student Name</option>
            </select>

            <button
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-1 border border-[#dadce0] rounded hover:bg-gray-50 cursor-pointer"
              title="Toggle sort direction"
            >
              {sortDirection === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="gf-card overflow-hidden">
          {filteredAttempts.length === 0 ? (
            <div className="p-16 text-center text-gray-500 space-y-2">
              <p className="font-semibold text-gray-700">No student responses found</p>
              <p className="text-xs text-gray-400">
                Share the student quiz link with your test takers to begin collecting responses.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8f9fa] border-b border-[#dadce0] text-gray-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('name')}>
                      Candidate Name
                    </th>
                    <th className="py-3 px-4">Standard / Division</th>
                    <th className="py-3 px-4">Roll No. / Email</th>
                    <th className="py-3 px-4 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('score')}>
                      Score
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('score')}>
                      Percentage
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('time')}>
                      Time Taken
                    </th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-normal">
                  {filteredAttempts.map((att, idx) => {
                    const pct = att.percentage || 0;
                    const pctBadge =
                      pct >= 75
                        ? 'bg-emerald-100 text-emerald-800'
                        : pct >= 50
                        ? 'bg-purple-100 text-[#673ab7]'
                        : pct >= 35
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800';

                    return (
                      <tr
                        key={att.id}
                        onClick={() => setSelectedAttempt(att)}
                        className="hover:bg-[#f0ebf8]/30 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4 text-gray-400">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-semibold text-gray-900">{att.studentName}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-[#673ab7] font-semibold text-[11px] border border-purple-100">
                            {att.studentDivision || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">{att.studentEmail}</td>
                        <td className="py-3.5 px-4 font-medium text-gray-800">
                          {att.score || 0} / {att.totalMarks || quiz.questions.length}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${pctBadge}`}>
                            {pct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">
                          {att.timeTakenSeconds ? formatTime(att.timeTakenSeconds) : 'N/A'}
                        </td>
                        <td className="py-3.5 px-4">
                          {att.autoSubmitted ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                              Auto-Submitted
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                              Manual
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAttempt(att);
                            }}
                            className="text-[#673ab7] hover:underline font-semibold"
                          >
                            View Sheet &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: Graded Response Sheet Inspection ── */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="gf-card max-w-3xl w-full max-h-[92vh] flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Student Graded Response Sheet
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Candidate: <strong className="text-gray-800">{selectedAttempt.studentName}</strong> | Division: <strong className="text-[#673ab7]">{selectedAttempt.studentDivision || 'N/A'}</strong> ({selectedAttempt.studentEmail})
                </p>
              </div>

              <button
                onClick={() => setSelectedAttempt(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Score Banner */}
            <div className="p-4 rounded-lg bg-[#ede7f6]/60 border border-purple-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#673ab7] uppercase">Final Result</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  {selectedAttempt.score} / {selectedAttempt.totalMarks}{' '}
                  <span className="text-base font-semibold text-[#673ab7]">({selectedAttempt.percentage}%)</span>
                </p>
              </div>

              <div className="text-right text-xs text-gray-600 space-y-0.5">
                <p>Time Taken: <strong>{formatTime(selectedAttempt.timeTakenSeconds || 0)}</strong></p>
                <p>Status: <strong>{selectedAttempt.autoSubmitted ? 'Auto-Submitted' : 'Manual Submit'}</strong></p>
              </div>
            </div>

            {/* Questions Review */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {quiz.questions.map((q, idx) => {
                const studentAnswer = selectedAttempt.answers[q.id];
                const isCorrect = studentAnswer === q.answer;
                const isUnanswered = studentAnswer === undefined;

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-lg border text-xs space-y-2.5 ${
                      isCorrect
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : isUnanswered
                        ? 'border-gray-200 bg-gray-50/50'
                        : 'border-rose-200 bg-rose-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-sm">
                        Q{idx + 1}. {q.question}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isCorrect
                            ? 'bg-emerald-100 text-emerald-800'
                            : isUnanswered
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isCorrect ? '✓ Correct (+1)' : isUnanswered ? 'Not Answered (0)' : '✗ Incorrect (0)'}
                      </span>
                    </div>

                    {q.diagramUrl && (
                      <div className="max-h-48 flex justify-center bg-white p-2 rounded border border-gray-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={q.diagramUrl} alt="Diagram" className="max-h-44 object-contain" />
                      </div>
                    )}

                    {/* Options list */}
                    <div className="space-y-1">
                      {q.options.map((opt, optIdx) => {
                        const optNum = optIdx + 1;
                        const isChosen = studentAnswer === optNum;
                        const isCorrectKey = q.answer === optNum;

                        let style = 'border-gray-200 bg-white text-gray-700';
                        if (isCorrectKey) {
                          style = 'border-emerald-300 bg-emerald-100 text-emerald-900 font-semibold';
                        } else if (isChosen && !isCorrectKey) {
                          style = 'border-rose-300 bg-rose-100 text-rose-900 line-through';
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`p-2 rounded border flex items-center justify-between text-xs ${style}`}
                          >
                            <span>
                              <span className="font-bold mr-2">{String.fromCharCode(65 + optIdx)}.</span>
                              {opt}
                            </span>

                            <div className="flex items-center gap-2">
                              {isChosen && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-900 text-white font-medium">
                                  Student Choice
                                </span>
                              )}
                              {isCorrectKey && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-medium">
                                  Correct Key
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="p-2.5 rounded bg-white/90 border border-gray-200 text-[11px] text-gray-600">
                        <span className="font-semibold text-[#673ab7]">Explanation: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedAttempt(null)}
                className="gf-btn-primary text-xs"
              >
                Close Response Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
