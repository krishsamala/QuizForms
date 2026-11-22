import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center p-4">
      <div className="gf-card max-w-lg w-full overflow-hidden">
        <div className="gf-header-accent" />
        <div className="p-8 text-center space-y-6">
          {/* Google Forms Logo Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-[#ede7f6] flex items-center justify-center text-[#673ab7]">
            <svg className="w-9 h-9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
          </div>

          <div>
            <h1 className="text-3xl font-normal text-gray-900 tracking-tight">QuizForms</h1>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              Create, host, and automatically grade timed multiple-choice practice exams with a clean Google Forms experience and Gemini AI PDF question importing.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/admin" className="gf-btn-primary">
              Teacher Dashboard
            </Link>
            <Link href="/quiz/demo-quiz-1" className="gf-btn-outline">
              Try Sample Quiz
            </Link>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Students access tests directly via links shared by instructors — no sign-in required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
