'use client';

import { Suspense, useState } from "react";
import { loginWithGoogle, logout } from "@/lib/authutils";
import { User } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Spinner } from '@/components/app/primitives';
import { db } from '@/firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

function LoginForm() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    setSigningIn(true);
    setLoginError(null);
    const { success, user, error } = await loginWithGoogle();
    if (!success) {
      setSigningIn(false);
      const code = (error as { code?: string } | undefined)?.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setLoginError('Sign-in didn’t go through. Please try again.');
      }
    }
    if (success && user) {
      setUser(user);
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            createdAt: serverTimestamp()
          });
        }

        if (redirectTo) {
          router.push(redirectTo);
          return;
        }

        const updatedSnap = await getDoc(userRef);
        if (!updatedSnap.exists() || !updatedSnap.data()?.venmoUsername) {
          router.push('/settings?setup=true');
        } else {
          router.push('/tabs');
        }
      } catch (error) {
        console.error('Error handling login:', error);
        router.push(redirectTo || '/tabs');
      }
    } else {
      console.error(error);
    }
  };

  const handleLogout = async () => {
    setSigningIn(false);
    const { success, error } = await logout();
    if (success) {
      setUser(null);
    } else {
      console.error(error);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden tw-app-bg">
      <Navbar />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[34rem] w-[56rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 opacity-70 blur-3xl"
      />
      <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-16">
        <div className="tw-app-rise w-full max-w-sm">
          {user ? (
            <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-[0_16px_50px_-24px_rgba(15,23,42,0.35)]">
              <Spinner className="mx-auto h-7 w-7" />
              <p className="mt-4 text-[15px] font-medium text-gray-900">Signing you in as {user.displayName || user.email}</p>
              <button onClick={handleLogout} className="mt-6 text-sm text-gray-400 underline underline-offset-2 hover:text-gray-900">
                Not you? Sign out
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_16px_50px_-24px_rgba(15,23,42,0.35)]">
              <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-[0_10px_24px_-10px_rgba(124,58,237,0.7)]">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-gray-900">
                {redirectTo?.startsWith('/join/') ? 'Sign in to join the tab' : 'Welcome to TabWrapped'}
              </h1>
              <p className="mt-2 text-center text-[15px] text-gray-500">
                Split the check, send the links, and watch it get paid.
              </p>
              <button
                onClick={handleLogin}
                disabled={signingIn}
                className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-gray-200 bg-white text-[15px] font-medium text-gray-800 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.99] disabled:opacity-60"
              >
                {signingIn ? <Spinner className="h-5 w-5" /> : <Image src="/google.svg" alt="" width={20} height={20} />}
                {signingIn ? 'Waiting for Google…' : 'Continue with Google'}
              </button>
              {loginError && <p className="mt-3 text-center text-sm text-red-600">{loginError}</p>}
              <p className="mt-6 text-center text-xs leading-relaxed text-gray-400">
                Friends you split with don&apos;t need an account.
              </p>
            </div>
          )}
          <p className="mt-6 text-center text-sm text-gray-400">
            <Link href="/" className="hover:text-gray-900">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
