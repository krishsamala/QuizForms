'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { isMockMode, auth } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isMock: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, isAdmin: false, isMock: true, authError: null,
  signIn: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';

  useEffect(() => {
    if (isMockMode) {
      // Mock mode: auto-login as admin
      setUser({ email: 'admin@demo.com', displayName: 'Demo Admin', uid: 'mock-admin' } as unknown as User);
      setLoading(false);
      return;
    }

    if (!auth) { setLoading(false); return; }

    const { onAuthStateChanged } = require('firebase/auth');
    const unsub = onAuthStateChanged(auth, (u: User | null) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const isAdmin = isMockMode
    ? true
    : (!!user && (
        !adminEmail ||
        adminEmail === 'admin@demo.com' ||
        user.email?.toLowerCase() === adminEmail.toLowerCase() ||
        adminEmail.split(',').map((e) => e.trim().toLowerCase()).includes(user.email?.toLowerCase() || '')
      ));

  const signIn = async () => {
    if (isMockMode) {
      setUser({ email: 'admin@demo.com', displayName: 'Demo Admin', uid: 'mock-admin' } as unknown as User);
      return;
    }
    if (!auth) {
      setAuthError('Firebase Auth is not initialized. Please check your NEXT_PUBLIC_FIREBASE environment variables.');
      return;
    }
    setAuthError(null);
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Firebase sign-in error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'your-domain.vercel.app';
        setAuthError(`Domain "${domain}" is not authorized! Go to Firebase Console ➔ Authentication ➔ Settings ➔ Authorized domains, click "Add domain", and enter "${domain}".`);
      } else if (err.code === 'auth/operation-not-allowed') {
        setAuthError('Google sign-in is not enabled! Go to Firebase Console ➔ Authentication ➔ Sign-in method ➔ Click "Google" and toggle Enable.');
      } else if (err.code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed before completing. Please try again.');
      } else {
        setAuthError(err.message || 'Failed to sign in with Google');
      }
    }
  };

  const signOutFn = async () => {
    if (isMockMode) { setUser(null); return; }
    if (!auth) return;
    const { signOut: fbSignOut } = await import('firebase/auth');
    await fbSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isMock: isMockMode, authError, signIn, signOut: signOutFn }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
