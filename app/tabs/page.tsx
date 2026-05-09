'use client';

import React, { useEffect, useState } from 'react';
import { auth } from '@/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, query, where, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { Navbar } from '@/components/Navbar';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { getBillsFromDocument, billCountLabel } from '@/lib/tripLedger';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedAt?: any;
  inviteCode?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sharedExpenses?: any[];
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{children}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs font-medium text-gray-300">{count}</span>
      )}
      <div className="flex-1 h-px bg-gray-100 ml-1" />
    </div>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function TabsDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User>();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [joinedTabs, setJoinedTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tabToDelete, setTabToDelete] = useState<{ id: string; title: string; status: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTabs = async (userId: string) => {
    const tabsRef = collection(db, 'tabs');
    const ownedQ = query(tabsRef, where('userId', '==', userId));
    const joinedQ = query(tabsRef, where('memberIds', 'array-contains', userId));

    const [ownedSnap, joinedSnap] = await Promise.all([getDocs(ownedQ), getDocs(joinedQ)]);

    const userTabs: Tab[] = ownedSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tab));
    setTabs(userTabs);

    const memberTabs: Tab[] = joinedSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tab));
    setJoinedTabs(memberTabs);

    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);
      await fetchTabs(currentUser.uid);
    });
    return () => unsubscribe();
  }, [router]);

  const tripBadge = (tab: Tab) => {
    try {
      const n = getBillsFromDocument(tab).length;
      if (n <= 1) return null;
      return (
        <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-500">
          {billCountLabel(getBillsFromDocument(tab))}
        </span>
      );
    } catch {
      return null;
    }
  };

  const handleDeleteClick = (tab: Tab) => {
    setTabToDelete({ id: tab.id, title: tab.title || 'Untitled Tab', status: tab.status });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!tabToDelete || !user) return;
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'tabs', tabToDelete.id));
      await fetchTabs(user.uid);
      setDeleteDialogOpen(false);
      setTabToDelete(null);
    } catch (error) {
      console.error('Error deleting tab:', error);
      alert('Failed to delete tab. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F7F7F8]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-indigo-500" />
      </div>
    );
  }

  const isFullyPaid = (tab: Tab) => {
    if (!tab.people || tab.people.length === 0) return false;
    return tab.people.every((person) => person.paid === true);
  };

  const allActiveTabs = tabs
    .filter(tab => tab.status === 'active')
    .sort((a, b) => {
      const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
      const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
      return bDate.getTime() - aDate.getTime();
    });

  const unpaidTabs = allActiveTabs.filter(tab => !isFullyPaid(tab));
  const fullyPaidTabs = allActiveTabs.filter(tab => isFullyPaid(tab));

  const draftTabs = tabs
    .filter(tab => tab.status === 'draft')
    .sort((a, b) => {
      const aDate = a.updatedAt?.toDate ? a.updatedAt.toDate() : (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0));
      const bDate = b.updatedAt?.toDate ? b.updatedAt.toDate() : (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0));
      return bDate.getTime() - aDate.getTime();
    });

  const firstName = user?.displayName?.split(' ')[0] || user?.email;

  return (
    <div className="min-h-screen bg-[#F7F7F8]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">

        {/* Greeting */}
        <div className="mb-10">
          <p className="text-sm text-gray-400 mb-0.5">Welcome back</p>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{firstName}</h1>
        </div>

        {/* Joined tabs */}
        {joinedTabs.length > 0 && (
          <section className="mb-8">
            <SectionLabel count={joinedTabs.length}>Tabs I&apos;ve Joined</SectionLabel>
            <div className="space-y-3">
              {joinedTabs.map((tab) => (
                <div key={tab.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-gray-900 text-[15px]">{tab.title || 'Untitled Tab'}</span>
                      {tripBadge(tab)}
                    </div>
                    {tab.description && <p className="text-sm text-gray-400 leading-snug">{tab.description}</p>}
                    {(tab.sharedExpenses?.length ?? 0) > 0 && (
                      <span className="inline-block mt-1.5 text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-medium">
                        {tab.sharedExpenses!.length} shared {tab.sharedExpenses!.length === 1 ? 'expense' : 'expenses'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/tabs/new?editId=${tab.id}`)}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    Add expenses
                    <ChevronRight />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Drafts */}
        {draftTabs.length > 0 && (
          <section className="mb-8">
            <SectionLabel count={draftTabs.length}>Drafts</SectionLabel>
            <div className="space-y-3">
              {draftTabs.map((tab) => (
                <div key={tab.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-gray-900 text-[15px]">{tab.title || 'Untitled Tab'}</span>
                      {tripBadge(tab)}
                    </div>
                    <p className="text-sm text-gray-400 leading-snug">{tab.description || 'No description'}</p>
                    <p className="text-xs text-gray-300 mt-1">
                      Last saved {tab.updatedAt?.toDate ? new Date(tab.updatedAt.toDate()).toLocaleString() : 'recently'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => router.push(`/tabs/new?draftId=${tab.id}`)}
                      className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                    >
                      Continue
                    </button>
                    <button
                      onClick={() => handleDeleteClick(tab)}
                      className="p-2 text-gray-300 hover:text-red-400 rounded-xl transition-colors"
                      title="Delete draft"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active tabs with unpaid people */}
        {unpaidTabs.length > 0 && (
          <section className="mb-8">
            <SectionLabel count={unpaidTabs.length}>Active Tabs</SectionLabel>
            <div className="space-y-3">
              {unpaidTabs.map((tab) => {
                const totalPeople = tab.people?.length || 0;
                const unpaidCount = tab.people?.filter((p) => !p.paid).length || 0;
                const paidCount = totalPeople - unpaidCount;

                return (
                  <div key={tab.id} className="bg-amber-50 rounded-2xl border border-amber-100 px-5 py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-semibold text-gray-900 text-[15px]">{tab.title}</span>
                          {tripBadge(tab)}
                        </div>
                        {tab.description && (
                          <p className="text-sm text-amber-700/60 leading-snug">{tab.description}</p>
                        )}
                        {totalPeople > 0 && (
                          <p className="text-xs text-amber-600/80 mt-1.5">
                            {unpaidCount} of {totalPeople} haven&apos;t paid
                            {paidCount > 0 && <span className="text-amber-500/60"> · {paidCount} paid</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => router.push(`/tab/${tab.id}`)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                        >
                          Open tab
                          <ChevronRight />
                        </button>
                        <button
                          onClick={() => router.push(`/tabs/new?editId=${tab.id}`)}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-xl transition-colors text-sm font-medium"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(tab)}
                          className="p-2 text-gray-300 hover:text-red-400 rounded-xl transition-colors"
                          title="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Fully paid tabs */}
        {(fullyPaidTabs.length > 0 || unpaidTabs.length === 0) && (
          <section>
            <SectionLabel count={fullyPaidTabs.length}>Fully Paid</SectionLabel>
            {fullyPaidTabs.length === 0 ? (
              <p className="text-sm text-gray-400 pl-1">No fully paid tabs yet.</p>
            ) : (
              <div className="space-y-3">
                {fullyPaidTabs.map((tab) => (
                  <div key={tab.id} className="bg-emerald-50 rounded-2xl border border-emerald-100 px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-gray-900 text-[15px]">{tab.title}</span>
                        {tripBadge(tab)}
                      </div>
                      {tab.description && <p className="text-sm text-emerald-700/60 leading-snug">{tab.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => router.push(`/tab/${tab.id}`)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => router.push(`/tabs/new?editId=${tab.id}`)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-xl transition-colors text-sm font-medium"
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(tab)}
                        className="p-2 text-gray-300 hover:text-red-400 rounded-xl transition-colors"
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tab</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{tabToDelete?.title}&quot;? This action cannot be undone.
              {tabToDelete?.status === 'active' && (
                <span className="block mt-2 text-red-600 font-medium">
                  This is a finalized tab. All data will be permanently deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setTabToDelete(null); }} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
