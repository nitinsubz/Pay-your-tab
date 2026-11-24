'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { Navbar } from '@/components/Navbar';
import { useEffectiveAuth } from '@/lib/impersonation';
import { ArrowLeft, Check, Lock, PencilLine, Users } from 'lucide-react';
import { summarizeTab, type SummarizableTab } from '@/lib/tabSummary';
import { formatMoney } from '@/lib/format';
import { Avatar, Money, Panel, ProgressBar, Spinner } from '@/components/app/primitives';

interface Person {
  name: string;
  paid?: boolean;
}

interface TabDoc extends SummarizableTab {
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
  const [paidNames, setPaidNames] = useState<string[]>([]);
  const [unpaidNames, setUnpaidNames] = useState<string[]>([]);
  const [owes, setOwes] = useState<Record<string, number>>({});

  const { effectiveUid: currentUserId } = useEffectiveAuth();

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
          const owed: Record<string, number> = {};
          summarizeTab(data).people.forEach((p) => {
            owed[p.name] = p.owes;
          });
          setOwes(owed);
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

  const outstanding = unpaidNames.reduce((sum, n) => sum + Math.max(0, owes[n] ?? 0), 0);
  const collected = paidNames.reduce((sum, n) => sum + Math.max(0, owes[n] ?? 0), 0);

  const PersonRow = ({ name, paid }: { name: string; paid: boolean }) => {
    const amount = owes[name] ?? 0;
    return (
      <li className="flex items-center gap-3 px-5 py-3">
        <Avatar name={name} size="md" />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-gray-900">{name}</span>
        {amount < -0.005 ? (
          <span className="text-sm text-sky-600">is owed {formatMoney(-amount)}</span>
        ) : (
          <Money amount={amount} className={paid ? 'text-sm text-gray-400 line-through decoration-gray-300' : 'text-sm font-semibold text-gray-900'} />
        )}
      </li>
    );
  };

  return (
    <div className="min-h-screen tw-app-bg">
      <Navbar />
      <main className="tw-app-rise mx-auto max-w-2xl px-4 pb-24 pt-8 sm:pt-12">
        <Link
          href={`/tab/${tabId}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tab
        </Link>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        ) : !tabExists ? (
          <p className="py-16 text-center text-gray-500">This tab doesn&apos;t exist.</p>
        ) : !isOwner ? (
          <Panel className="p-8 text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
              <Lock className="h-5 w-5" />
            </span>
            <p className="text-[17px] font-semibold text-gray-900">Only the organizer can see payments</p>
            <p className="mt-1.5 text-sm text-gray-500">Sign in with the account that created this tab.</p>
            <Link href="/login" className="mt-5 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800">
              Sign in
            </Link>
          </Panel>
        ) : total === 0 ? (
          <Panel className="p-8 text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
              <Users className="h-5 w-5" />
            </span>
            <p className="text-[17px] font-semibold text-gray-900">No one&apos;s on this tab yet</p>
            <p className="mt-1.5 text-sm text-gray-500">Add people to track who has paid.</p>
            <Link
              href={`/tabs/new?editId=${tabId}`}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              <PencilLine className="h-4 w-4" />
              Edit tab
            </Link>
          </Panel>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600">Payments</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-gray-900">{title}</h1>
            </div>

            <Panel className="mb-6 p-5">
              {allPaid ? (
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-[0_10px_24px_-12px_rgba(16,185,129,0.9)]">
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Everyone&apos;s paid</p>
                    <p className="text-sm text-gray-500">
                      All {total} {total === 1 ? 'person has' : 'people have'} settled up. This tab is done.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-400">Still out</p>
                      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-gray-900 tabular-nums">{formatMoney(outstanding)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400">Collected</p>
                      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-emerald-600 tabular-nums">{formatMoney(collected)}</p>
                    </div>
                  </div>
                  <ProgressBar value={paidNames.length / total} />
                  <p className="mt-2 text-xs text-gray-500">
                    {paidNames.length} of {total} paid · {unpaidNames.length} to go
                  </p>
                </>
              )}
            </Panel>

            {hasOutstanding && (
              <section className="mb-6">
                <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Waiting on · {unpaidNames.length}
                </h2>
                <Panel className="divide-y divide-gray-100 overflow-hidden">
                  <ul className="divide-y divide-gray-100">
                    {unpaidNames.map((n) => (
                      <PersonRow key={n} name={n} paid={false} />
                    ))}
                  </ul>
                </Panel>
              </section>
            )}

            {paidNames.length > 0 && (
              <section>
                <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Paid · {paidNames.length}
                </h2>
                <Panel className="overflow-hidden">
                  <ul className="divide-y divide-gray-100">
                    {paidNames.map((n) => (
                      <PersonRow key={n} name={n} paid />
                    ))}
                  </ul>
                </Panel>
              </section>
            )}

            <p className="mt-6 text-center text-xs text-gray-400">
              Updates live as people mark themselves paid. Open someone from the tab page to change their status.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
