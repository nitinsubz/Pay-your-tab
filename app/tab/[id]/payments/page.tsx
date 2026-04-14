'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/firebaseConfig';
import { Navbar } from '@/components/Navbar';

interface Person {
  name: string;
  paid?: boolean;
}

interface TabDoc {
  title?: string;
  userId?: string;
  people?: Person[];
}

function sortNames(names: string[]) {
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export default function TabPaymentsDashboard() {
  const params = useParams();
  const tabId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [tabExists, setTabExists] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [paidNames, setPaidNames] = useState<string[]>([]);
  const [unpaidNames, setUnpaidNames] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUserId(u?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'tabs', tabId),
      (snap) => {
        if (!snap.exists()) {
          setTabExists(false);
          setTitle('');
          setOwnerId(null);
          setPaidNames([]);
          setUnpaidNames([]);
          setLoading(false);
          return;
        }
        setTabExists(true);
        const data = snap.data() as TabDoc;
        setTitle(data.title || 'Tab');
        const oid = data.userId ?? null;
        setOwnerId(oid);

        const owner = Boolean(currentUserId && oid && currentUserId === oid);
        if (owner) {
          const people = data.people || [];
          const paid: string[] = [];
          const unpaid: string[] = [];
          people.forEach((p) => {
            if (!p?.name?.trim()) return;
            if (p.paid === true) paid.push(p.name);
            else unpaid.push(p.name);
          });
          setPaidNames(sortNames(paid));
          setUnpaidNames(sortNames(unpaid));
        } else {
          setPaidNames([]);
          setUnpaidNames([]);
        }
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setTabExists(false);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [tabId, currentUserId]);

  const isOwner = Boolean(currentUserId && ownerId && currentUserId === ownerId);
  const total = paidNames.length + unpaidNames.length;
  const allPaid = total > 0 && unpaidNames.length === 0;
  const hasOutstanding = total > 0 && unpaidNames.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-24">
        <div className="mb-6">
          <Link
            href={`/tab/${tabId}`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            ← Back to tab
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : !tabExists ? (
          <p className="text-center text-slate-600">This tab does not exist.</p>
        ) : !isOwner ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="font-semibold text-amber-900">Owner only</p>
            <p className="mt-2 text-sm text-amber-800">
              Sign in with the account that created this tab to see who has paid.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
            >
              Sign in
            </Link>
          </div>
        ) : total === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
            <h1 className="text-lg font-semibold text-slate-900">No people on this tab</h1>
            <p className="mt-2 text-sm text-slate-600">Add participants when editing the tab to track who has paid.</p>
            <Link
              href={`/tabs/new?editId=${tabId}`}
              className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
            >
              Edit tab
            </Link>
          </div>
        ) : allPaid ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
              ✓
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Everyone&apos;s paid</h1>
            <p className="mt-2 text-slate-600">
              All {total} {total === 1 ? 'person has' : 'people have'} marked paid on &quot;{title}&quot;.
            </p>
            <Link
              href={`/tab/${tabId}`}
              className="mt-6 inline-flex rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Return to tab
            </Link>
          </div>
        ) : hasOutstanding ? (
          <>
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Payment tracker</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
              <p className="mt-2 text-sm text-slate-600">
                {paidNames.length} of {total} paid · {unpaidNames.length} still outstanding
              </p>
              <div className="mx-auto mt-4 h-2 max-w-md overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${total ? (paidNames.length / total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                  Paid ({paidNames.length})
                </h2>
                <ul className="mt-3 max-h-[min(50vh,28rem)] space-y-2 overflow-y-auto pr-1">
                  {paidNames.map((n) => (
                    <li
                      key={n}
                      className="flex items-center justify-between rounded-lg bg-emerald-50/90 px-3 py-2 text-sm text-emerald-950"
                    >
                      <span className="font-medium">{n}</span>
                      <span className="text-xs font-medium text-emerald-700">Paid</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm ring-1 ring-amber-100">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
                  Not paid yet ({unpaidNames.length})
                </h2>
                <ul className="mt-3 max-h-[min(50vh,28rem)] space-y-2 overflow-y-auto pr-1">
                  {unpaidNames.map((n) => (
                    <li
                      key={n}
                      className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950"
                    >
                      <span className="font-medium">{n}</span>
                      <span className="text-xs font-medium text-amber-800">Pending</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              Status updates when someone marks paid from their share view (or when you change it while editing).
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
