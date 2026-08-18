'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffectiveAuth } from '@/lib/impersonation';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { authUser, isSuperAdmin } = useEffectiveAuth();
  const isLoggedIn = !!authUser;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  /** The landing page is a full-width marketing layout; the app pages are a narrow column. */
  const container = pathname === '/' ? 'max-w-6xl' : 'max-w-2xl';

  return (
    <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className={`${container} mx-auto flex h-14 items-center justify-between px-4`}>
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-lg blur-sm opacity-40 group-hover:opacity-60 transition-opacity" />
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <span className="text-[17px] font-bold tracking-tight">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Tab</span>
            <span className="text-gray-900">Wrapped</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {pathname === '/tabs' && (
            <Link
              href="/tabs/new"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3.5 py-1.5 rounded-lg transition-colors"
            >
              New tab
            </Link>
          )}
          {pathname !== '/tabs' && (
            <Link
              href="/tabs"
              className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              My Tabs
            </Link>
          )}
          {isSuperAdmin && pathname !== '/admin' && (
            <Link
              href="/admin"
              className="text-sm text-amber-600 hover:text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors font-medium"
            >
              Admin
            </Link>
          )}
          {isLoggedIn && (
            <Link
              href="/settings"
              className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Settings
            </Link>
          )}
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
