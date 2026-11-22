'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, isMock, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#673ab7] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-gray-600">Loading QuizForms...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isMock) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center p-4">
        <div className="gf-card max-w-md w-full overflow-hidden">
          <div className="gf-header-accent" />
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#ede7f6] flex items-center justify-center text-[#673ab7]">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">Admin Sign-in</h1>
              <p className="text-sm text-gray-600 mt-2">
                Sign in with your authorized Google Account to create exams and manage student scores.
              </p>
            </div>

            <button
              onClick={() => signIn()}
              className="w-full flex items-center justify-center gap-3 px-6 py-2.5 bg-white border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.8s.7 5.1 1.9 7.5l3.7-2.9z" />
                <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z" />
              </svg>
              <span>Sign in with Google</span>
            </button>

            <div>
              <Link href="/" className="text-xs text-[#673ab7] hover:underline font-medium">
                &larr; Return to Home Page
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0ebf8]">
      {/* Google Forms Top Navigation Bar */}
      <header className="bg-white border-b border-[#dadce0] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[#673ab7] group-hover:bg-[#ede7f6] transition-colors">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-lg text-gray-800 tracking-tight">QuizForms</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ede7f6] text-[#673ab7]">
                    Admin
                  </span>
                </div>
              </div>
            </Link>

            <nav className="hidden sm:flex items-center ml-8 gap-1">
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:text-[#673ab7] hover:bg-[#ede7f6]/60 transition-colors"
              >
                All Forms
              </Link>
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-[#673ab7] hover:bg-gray-100 transition-colors"
                target="_blank"
              >
                Live Preview ↗
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isMock && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-[#673ab7] border border-purple-200">
                <span className="w-2 h-2 rounded-full bg-[#673ab7]"></span>
                Demo / Local Mode
              </span>
            )}

            <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200">
              <div className="w-9 h-9 rounded-full bg-[#673ab7] text-white flex items-center justify-center font-semibold text-sm shadow-sm">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden lg:block text-left text-xs leading-tight">
                <p className="font-semibold text-gray-800">{user?.displayName || 'Administrator'}</p>
                <p className="text-gray-500">{user?.email || 'admin@demo.com'}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="ml-1 p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                title="Sign Out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
