'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, LogOut, Plus, Settings, Shield } from 'lucide-react';
import { useEffectiveAuth } from '@/lib/impersonation';
import { Avatar } from '@/components/app/primitives';
import { cn } from '@/lib/utils';

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2" aria-label="TabWrapped home">
      <div className="relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-40 blur-sm transition-opacity group-hover:opacity-60" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      </div>
      <span className="text-[17px] font-bold tracking-tight">
        <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Tab</span>
        <span className="text-gray-900">Wrapped</span>
      </span>
    </Link>
  );
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { authUser, effectiveUser, isSuperAdmin } = useEffectiveAuth();
  const isLoggedIn = !!authUser;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  /** The landing page is a full-width marketing layout; the app pages are a narrower column. */
  const container = pathname === '/' ? 'max-w-6xl' : 'max-w-5xl';
  const displayName = effectiveUser?.displayName || effectiveUser?.email || 'You';
  const onTabs = pathname === '/tabs';
  const onNew = pathname?.startsWith('/tabs/new');

  const navLink = (active: boolean) =>
    cn(
      'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
      active ? 'bg-gray-900/[0.06] text-gray-900' : 'text-gray-500 hover:bg-gray-900/[0.04] hover:text-gray-900'
    );

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/75 backdrop-blur-xl">
      <div className={`${container} mx-auto flex h-14 items-center justify-between gap-3 px-4`}>
        <Logo />

        <div className="flex items-center gap-1">
          {isLoggedIn ? (
            <>
              <Link href="/tabs" className={cn(navLink(onTabs), 'hidden sm:inline-flex')}>
                My tabs
              </Link>
              {isSuperAdmin && (
                <Link
                  href="/admin"
                  className={cn(
                    'hidden rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors sm:inline-flex',
                    pathname === '/admin' ? 'bg-amber-50 text-amber-700' : 'text-amber-600 hover:bg-amber-50'
                  )}
                >
                  Admin
                </Link>
              )}
              {!onNew && (
                <Link
                  href="/tabs/new"
                  className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-gray-900 pl-3 pr-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  New tab
                </Link>
              )}

              <div className="relative ml-1.5" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                  className="flex items-center gap-1 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-gray-900/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                >
                  <Avatar name={displayName} size="md" className="h-8 w-8" />
                  <ChevronDown className={cn('h-3.5 w-3.5 text-gray-400 transition-transform', menuOpen && 'rotate-180')} />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="tw-app-rise absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-100 bg-white p-1.5 shadow-[0_16px_50px_-20px_rgba(15,23,42,0.35)]"
                  >
                    <div className="flex items-center gap-3 px-3 pb-3 pt-2.5">
                      <Avatar name={displayName} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
                        {effectiveUser?.email && (
                          <p className="truncate text-xs text-gray-400">{effectiveUser.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="my-1 h-px bg-gray-100" />
                    <Link
                      href="/tabs"
                      role="menuitem"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 sm:hidden"
                    >
                      My tabs
                    </Link>
                    {isSuperAdmin && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 sm:hidden"
                      >
                        <Shield className="h-4 w-4" />
                        Admin
                      </Link>
                    )}
                    <Link
                      href="/settings"
                      role="menuitem"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Settings className="h-4 w-4 text-gray-400" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <LogOut className="h-4 w-4 text-gray-400" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/tabs" className={navLink(false)}>
                My Tabs
              </Link>
              <Link href="/login" className={navLink(false)}>
                Login
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
