'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { Navbar } from '@/components/Navbar';
import { useEffectiveAuth } from '@/lib/impersonation';

interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  venmoUsername?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt?: any;
}

function formatDate(value: AdminUser['createdAt']): string {
  if (!value) return '—';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export default function AdminPage() {
  const router = useRouter();
  const { authUser, ready, isSuperAdmin, impersonating, startImpersonating, stopImpersonating } =
    useEffectiveAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!authUser) {
      router.push('/login?redirect=/admin');
      return;
    }
    if (!isSuperAdmin) {
      router.push('/tabs');
      return;
    }

    const loadUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list: AdminUser[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            email: data.email ?? null,
            displayName: data.displayName ?? null,
            venmoUsername: data.venmoUsername,
            createdAt: data.createdAt,
          };
        });
        list.sort((a, b) =>
          (a.displayName || a.email || a.uid).localeCompare(b.displayName || b.email || b.uid, undefined, {
            sensitivity: 'base',
          })
        );
        setUsers(list);
      } catch (e) {
        console.error('Error loading users:', e);
        setError(
          'Could not load users. Make sure the updated firestore.rules are deployed (firebase deploy --only firestore:rules).'
        );
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [ready, authUser, isSuperAdmin, router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.displayName, u.email, u.venmoUsername, u.uid]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [users, search]);

  const handleViewAs = (user: AdminUser) => {
    startImpersonating({ uid: user.uid, email: user.email, displayName: user.displayName });
    router.push('/tabs');
  };

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F8]">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-indigo-500" />
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-[#F7F7F8]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 pb-28">
        <div className="mb-8">
          <p className="text-sm text-gray-400 mb-0.5">Superadmin</p>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">User directory</h1>
          <p className="text-sm text-gray-400 mt-2">
            View the app as any user to debug their tabs. You keep full read and write access while
            impersonating — changes you make are saved to their data.
          </p>
        </div>

        {impersonating && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">Currently viewing as</p>
              <p className="text-sm font-medium text-gray-900 truncate">
                {impersonating.displayName || impersonating.email || impersonating.uid}
              </p>
            </div>
            <button
              onClick={stopImpersonating}
              className="shrink-0 bg-white hover:bg-gray-50 border border-amber-200 text-amber-700 text-sm font-medium px-3.5 py-1.5 rounded-xl transition-colors"
            >
              Stop
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, Venmo, or UID"
          className="w-full mb-5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />

        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Users</span>
          <span className="text-xs font-medium text-gray-300">{filtered.length}</span>
          <div className="flex-1 h-px bg-gray-100 ml-1" />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 pl-1">No users match that search.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((user) => {
              const isCurrent = impersonating?.uid === user.uid;
              const isSelf = authUser?.uid === user.uid;
              return (
                <div
                  key={user.uid}
                  className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-gray-900 text-[15px]">
                        {user.displayName || 'No name'}
                      </span>
                      {isSelf && (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-500">
                          You
                        </span>
                      )}
                      {isCurrent && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                          Viewing
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate">{user.email || 'No email'}</p>
                    <p className="text-xs text-gray-300 mt-1 truncate">
                      {user.venmoUsername ? `@${user.venmoUsername.replace(/^@/, '')}` : 'No Venmo'} · joined{' '}
                      {formatDate(user.createdAt)} · {user.uid}
                    </p>
                  </div>
                  <button
                    onClick={() => (isCurrent ? stopImpersonating() : handleViewAs(user))}
                    disabled={isSelf && !isCurrent}
                    className="shrink-0 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                  >
                    {isCurrent ? 'Stop' : 'View as'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
