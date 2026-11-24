'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where, doc, deleteDoc } from 'firebase/firestore';
import { ArrowRight, Copy, PencilLine, Plus, Receipt, Trash2, Users } from 'lucide-react';
import { db } from '@/firebaseConfig';
import { Navbar } from '@/components/Navbar';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { billCountLabel, type LedgerItem, type TripBill } from '@/lib/tripLedger';
import { useEffectiveAuth } from '@/lib/impersonation';
import { summarizeTab, type TabSummary } from '@/lib/tabSummary';
import { formatMoney, formatRelative, toDate } from '@/lib/format';
import {
  AvatarStack,
  EmptyState,
  Money,
  Panel,
  ProgressBar,
  SectionHeader,
  Skeleton,
  Toast,
  copyText,
  useToast,
} from '@/components/app/primitives';
import { Menu } from '@/components/app/menu';

interface TabPerson {
  name: string;
  paid?: boolean;
}

interface Tab {
  id: string;
  title?: string;
  description?: string;
  status: string;
  people?: TabPerson[];
  bills?: TripBill[];
  items?: LedgerItem[];
  subtotal?: number;
  total?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedAt?: any;
  inviteCode?: string;
  userId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sharedExpenses?: any[];
}

interface TabWithSummary extends Tab {
  summary: TabSummary;
}

function withSummary(tab: Tab): TabWithSummary {
  return { ...tab, summary: summarizeTab(tab) };
}

function byNewest(field: 'createdAt' | 'updatedAt') {
  return (a: Tab, b: Tab) => {
    const ad = toDate(a[field]) ?? toDate(a.createdAt) ?? new Date(0);
    const bd = toDate(b[field]) ?? toDate(b.createdAt) ?? new Date(0);
    return bd.getTime() - ad.getTime();
  };
}

function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Panel className="px-5 py-4">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </Panel>
  );
}

function TripBadge({ tab }: { tab: TabWithSummary }) {
  if (tab.summary.bills.length <= 1) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-600">
      {billCountLabel(tab.summary.bills)}
    </span>
  );
}

function ActiveTabCard({
  tab,
  onEdit,
  onCopy,
  onDelete,
}: {
  tab: TabWithSummary;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const { summary } = tab;
  const total = summary.people.length;
  const settled = total > 0 && summary.paidCount === total;
  const date = toDate(tab.createdAt);

  return (
    <Link
      href={`/tab/${tab.id}`}
      className="group block min-w-0 rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-px hover:border-gray-200 hover:shadow-[0_12px_32px_-18px_rgba(15,23,42,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold tracking-tight text-gray-900">
              {tab.title || 'Untitled tab'}
            </h3>
            <TripBadge tab={tab} />
          </div>
          <p className="mt-0.5 truncate text-sm text-gray-400">
            {tab.description || (date ? `Created ${formatRelative(date)}` : 'Shared tab')}
          </p>
        </div>
        <div className="flex items-start gap-1">
          <div className="text-right">
            <Money amount={summary.total} className="text-[16px] font-semibold tracking-tight text-gray-900" />
            {!settled && summary.outstanding > 0.005 && (
              <p className="text-xs text-amber-600 tabular-nums">{formatMoney(summary.outstanding)} left</p>
            )}
          </div>
          <Menu
            className="-mr-2 -mt-1"
            items={[
              { label: 'Edit tab', icon: <PencilLine />, onSelect: onEdit },
              { label: 'Copy link', icon: <Copy />, onSelect: onCopy },
              { label: 'Delete', icon: <Trash2 />, onSelect: onDelete, danger: true },
            ]}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <AvatarStack names={summary.people.map((p) => p.name)} />
        <ProgressBar value={total ? summary.paidCount / total : 0} tone={settled ? 'emerald' : 'brand'} className="flex-1" />
        <span className={`shrink-0 text-xs font-medium tabular-nums ${settled ? 'text-emerald-600' : 'text-gray-500'}`}>
          {settled ? 'All paid' : total === 0 ? 'No people' : `${summary.paidCount} of ${total} paid`}
        </span>
      </div>
    </Link>
  );
}

function DraftRow({ tab, onDelete }: { tab: TabWithSummary; onDelete: () => void }) {
  const saved = toDate(tab.updatedAt) ?? toDate(tab.createdAt);
  const people = tab.summary.people.length;
  return (
    <Link
      href={`/tabs/new?draftId=${tab.id}`}
      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50/70 focus-visible:bg-gray-50 focus-visible:outline-none"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-dashed border-gray-300 text-gray-400">
        <PencilLine className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-gray-900">{tab.title || 'Untitled draft'}</p>
        <p className="truncate text-xs text-gray-400">
          {saved ? `Saved ${formatRelative(saved)}` : 'Saved recently'}
          {people > 0 && ` · ${people} ${people === 1 ? 'person' : 'people'}`}
          {tab.summary.total !== 0 && ` · ${formatMoney(tab.summary.total)}`}
        </p>
      </div>
      <span className="hidden items-center gap-1 text-sm font-medium text-gray-500 transition-colors group-hover:text-gray-900 sm:inline-flex">
        Continue
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
        aria-label={`Delete draft ${tab.title || ''}`.trim()}
        title="Delete draft"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </Link>
  );
}

function JoinedRow({ tab }: { tab: TabWithSummary }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <Users className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[15px] font-medium text-gray-900">{tab.title || 'Untitled tab'}</p>
          <TripBadge tab={tab} />
        </div>
        <p className="truncate text-xs text-gray-400">
          {tab.description || 'Shared with you'}
          {(tab.sharedExpenses?.length ?? 0) > 0 &&
            ` · ${tab.sharedExpenses!.length} shared ${tab.sharedExpenses!.length === 1 ? 'expense' : 'expenses'}`}
        </p>
      </div>
      <Link
        href={`/tabs/new?editId=${tab.id}`}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Add expenses</span>
        <span className="sm:hidden">Add</span>
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-[88px] rounded-3xl" />
        <Skeleton className="h-[88px] rounded-3xl" />
        <Skeleton className="h-[88px] rounded-3xl" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-[132px] rounded-3xl" />
        <Skeleton className="h-[132px] rounded-3xl" />
      </div>
    </div>
  );
}

export default function TabsDashboard() {
  const router = useRouter();
  const { authUser, effectiveUser, ready } = useEffectiveAuth();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [joinedTabs, setJoinedTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tabToDelete, setTabToDelete] = useState<{ id: string; title: string; status: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { toast, show } = useToast();

  const fetchTabs = async (userId: string) => {
    try {
      const tabsRef = collection(db, 'tabs');
      const ownedQ = query(tabsRef, where('userId', '==', userId));
      const joinedQ = query(tabsRef, where('memberIds', 'array-contains', userId));

      const [ownedSnap, joinedSnap] = await Promise.all([getDocs(ownedQ), getDocs(joinedQ)]);

      setTabs(ownedSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Tab)));
      setJoinedTabs(joinedSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Tab)));
      setLoadError(false);
    } catch (error) {
      console.error('Error loading tabs:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const effectiveUid = effectiveUser?.uid;

  useEffect(() => {
    if (!ready) return;
    if (!authUser || !effectiveUid) {
      router.push('/login');
      return;
    }
    setLoading(true);
    fetchTabs(effectiveUid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authUser, effectiveUid, router]);

  const handleDeleteClick = (tab: Tab) => {
    setTabToDelete({ id: tab.id, title: tab.title || 'Untitled tab', status: tab.status });
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!tabToDelete || !effectiveUid) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteDoc(doc(db, 'tabs', tabToDelete.id));
      await fetchTabs(effectiveUid);
      setDeleteDialogOpen(false);
      setTabToDelete(null);
      show('Tab deleted');
    } catch (error) {
      console.error('Error deleting tab:', error);
      setDeleteError('Couldn’t delete this tab. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyLink = async (tab: Tab) => {
    const ok = await copyText(`${window.location.origin}/tab/${tab.id}`);
    show(ok ? 'Link copied' : 'Couldn’t copy the link', ok ? 'success' : 'error');
  };

  const { openTabs, settledTabs, draftTabs, joined, stats } = useMemo(() => {
    const active = tabs.filter((t) => t.status === 'active').sort(byNewest('createdAt')).map(withSummary);
    const isFullyPaid = (t: TabWithSummary) =>
      t.summary.people.length > 0 && t.summary.paidCount === t.summary.people.length;
    const open = active.filter((t) => !isFullyPaid(t));
    const settled = active.filter(isFullyPaid);
    const drafts = tabs.filter((t) => t.status === 'draft').sort(byNewest('updatedAt')).map(withSummary);
    const outstanding = open.reduce((s, t) => s + t.summary.outstanding, 0);
    const waitingOn = open.reduce(
      (s, t) => s + t.summary.people.filter((p) => !p.paid && p.owes > 0.005).length,
      0
    );
    return {
      openTabs: open,
      settledTabs: settled,
      draftTabs: drafts,
      joined: joinedTabs.map(withSummary),
      stats: { outstanding, waitingOn, open: open.length, settled: settled.length },
    };
  }, [tabs, joinedTabs]);

  const firstName = effectiveUser?.displayName?.split(' ')[0] || effectiveUser?.email || '';
  const hasAnything = tabs.length > 0 || joinedTabs.length > 0;

  return (
    <div className="min-h-screen tw-app-bg">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:pt-12">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="tw-app-rise">
            {/* Greeting */}
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-gray-400">
                  {effectiveUser?.isImpersonating ? 'Viewing account' : 'Welcome back'}
                </p>
                <h1 className="mt-0.5 text-3xl font-semibold tracking-[-0.02em] text-gray-900 sm:text-[2rem]">
                  {firstName}
                </h1>
              </div>
            </div>

            {loadError && (
              <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                We couldn&apos;t load your tabs. Check your connection and refresh.
              </div>
            )}

            {!hasAnything && !loadError ? (
              <EmptyState
                icon={<Receipt />}
                title="Your first tab is one dinner away"
                action={
                  <Button asChild variant="brand" size="lg">
                    <Link href="/tabs/new">
                      <Plus />
                      Start a tab
                    </Link>
                  </Button>
                }
              >
                Add the items, add your friends, and send everyone a link with exactly what they owe.
              </EmptyState>
            ) : (
              <>
                {/* Stats */}
                {tabs.some((t) => t.status === 'active') && (
                  <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
                    <StatTile
                      label="Still to collect"
                      value={formatMoney(stats.outstanding)}
                      sub={
                        stats.waitingOn > 0
                          ? `from ${stats.waitingOn} ${stats.waitingOn === 1 ? 'person' : 'people'}`
                          : 'Nobody owes you'
                      }
                    />
                    <StatTile label="Open tabs" value={stats.open} sub="waiting on payments" />
                    <StatTile
                      label="Settled"
                      value={stats.settled}
                      sub={stats.settled === 1 ? 'tab fully paid' : 'tabs fully paid'}
                    />
                  </div>
                )}

                {/* Open tabs */}
                {openTabs.length > 0 && (
                  <section className="mb-10">
                    <SectionHeader title="Waiting on payments" count={openTabs.length} />
                    <div className="grid gap-3 md:grid-cols-2">
                      {openTabs.map((tab) => (
                        <ActiveTabCard
                          key={tab.id}
                          tab={tab}
                          onEdit={() => router.push(`/tabs/new?editId=${tab.id}`)}
                          onCopy={() => handleCopyLink(tab)}
                          onDelete={() => handleDeleteClick(tab)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Drafts */}
                {draftTabs.length > 0 && (
                  <section className="mb-10">
                    <SectionHeader title="Drafts" count={draftTabs.length} />
                    <Panel className="divide-y divide-gray-100 overflow-hidden">
                      {draftTabs.map((tab) => (
                        <DraftRow key={tab.id} tab={tab} onDelete={() => handleDeleteClick(tab)} />
                      ))}
                    </Panel>
                  </section>
                )}

                {/* Joined */}
                {joined.length > 0 && (
                  <section className="mb-10">
                    <SectionHeader title="Shared with you" count={joined.length} />
                    <Panel className="divide-y divide-gray-100 overflow-hidden">
                      {joined.map((tab) => (
                        <JoinedRow key={tab.id} tab={tab} />
                      ))}
                    </Panel>
                  </section>
                )}

                {/* Settled */}
                {settledTabs.length > 0 && (
                  <section className="mb-10">
                    <SectionHeader title="Settled" count={settledTabs.length} />
                    <div className="grid gap-3 md:grid-cols-2">
                      {settledTabs.map((tab) => (
                        <ActiveTabCard
                          key={tab.id}
                          tab={tab}
                          onEdit={() => router.push(`/tabs/new?editId=${tab.id}`)}
                          onCopy={() => handleCopyLink(tab)}
                          onDelete={() => handleDeleteClick(tab)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {openTabs.length === 0 && settledTabs.length === 0 && tabs.length > 0 && (
                  <p className="px-1 text-sm text-gray-400">
                    No finished tabs yet. Finish a draft to send it out.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setDeleteDialogOpen(open);
          if (!open) setTabToDelete(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </span>
            <DialogTitle>Delete “{tabToDelete?.title}”?</DialogTitle>
            <DialogDescription>
              {tabToDelete?.status === 'active'
                ? 'This tab has been sent out. Its link will stop working and everyone’s payment status will be lost. This can’t be undone.'
                : 'This draft will be permanently deleted. This can’t be undone.'}
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setTabToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toast toast={toast} />
    </div>
  );
}
