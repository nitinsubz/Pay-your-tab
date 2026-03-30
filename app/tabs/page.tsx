'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, query, where, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { Navbar } from '@/components/Navbar';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { getBillsFromDocument, billCountLabel } from '@/lib/tripLedger';

export default function TabsDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tabs, setTabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tabToDelete, setTabToDelete] = useState<{ id: string; title: string; status: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTabs = async (userId: string) => {
    const tabsRef = collection(db, 'tabs');
    const q = query(tabsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const userTabs = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt
    }));
    setTabs(userTabs);
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
  }

  const tripBadge = (tab: Tab) => {
    try {
      const n = getBillsFromDocument(tab).length;
      if (n <= 1) return null;
      return (
        <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
          {billCountLabel(getBillsFromDocument(tab))}
        </span>
      );
    } catch {
      return null;
    }
  };

  const handleDeleteClick = (tab: Tab) => {
    setTabToDelete({
      id: tab.id,
      title: tab.title || 'Untitled Tab',
      status: tab.status
    });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!tabToDelete || !user) return;

    try {
      setIsDeleting(true);
      const tabRef = doc(db, 'tabs', tabToDelete.id);
      await deleteDoc(tabRef);
      
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
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>;
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
      const aDate = a.updatedAt?.toDate ? a.updatedAt.toDate() : 
                   (a.createdAt?.toDate ? a.createdAt.toDate() : 
                   (a.updatedAt ? new Date(a.updatedAt) : 
                   (a.createdAt ? new Date(a.createdAt) : new Date(0))));
      const bDate = b.updatedAt?.toDate ? b.updatedAt.toDate() : 
                   (b.createdAt?.toDate ? b.createdAt.toDate() : 
                   (b.updatedAt ? new Date(b.updatedAt) : 
                   (b.createdAt ? new Date(b.createdAt) : new Date(0))));
      return bDate.getTime() - aDate.getTime();
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">
          Welcome, {user?.displayName || user?.email}
        </h1>
        
        {draftTabs.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Drafts (Continue Editing)
            </h2>
            <ul className="space-y-4">
              {draftTabs.map((tab) => (
                <li key={tab.id} className="border-b border-yellow-200 pb-4 flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{tab.title || 'Untitled Tab'}</h3>
                      {tripBadge(tab)}
                    </div>
                    <p className="text-gray-600 text-sm">{tab.description || 'No description'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Last saved: {tab.updatedAt?.toDate ? new Date(tab.updatedAt.toDate()).toLocaleString() : 'Recently'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/tabs/new?draftId=${tab.id}`)}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center gap-2"
                    >
                      Continue Editing
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(tab)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center gap-2"
                    >
                      Delete
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {unpaidTabs.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-800">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tabs with Unpaid People ({unpaidTabs.length})
            </h2>
            <ul className="space-y-4">
              {unpaidTabs.map((tab) => {
                const totalPeople = tab.people?.length || 0;
                const unpaidCount = tab.people?.filter((person: TabPerson) => !person.paid).length || 0;
                const paidCount = totalPeople - unpaidCount;
                
                return (
                  <li key={tab.id} className="border-b border-red-200 pb-4 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{tab.title}</h3>
                        {tripBadge(tab)}
                      </div>
                      <p className="text-gray-600 text-sm">{tab.description}</p>
                      <div className="mt-2 flex items-center gap-4">
                        {totalPeople > 0 ? (
                          <>
                            <span className="text-sm font-medium flex items-center gap-1 text-red-600">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {unpaidCount} {unpaidCount === 1 ? 'person' : 'people'} unpaid
                            </span>
                            <span className="text-xs text-gray-500">
                              {paidCount} of {totalPeople} paid
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-500">No people added</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/tab/${tab.id}`)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center gap-2"
                      >
                        View Tab
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(tab)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center gap-2"
                      >
                        Delete
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Fully Paid Tabs {fullyPaidTabs.length > 0 && `(${fullyPaidTabs.length})`}
          </h2>
          {fullyPaidTabs.length === 0 ? (
            <p className="text-gray-500">No fully paid tabs yet.</p>
          ) : (
            <ul className="space-y-4">
              {fullyPaidTabs.map((tab) => {
                const totalPeople = tab.people?.length || 0;
                
                return (
                  <li key={tab.id} className="border-b pb-4 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{tab.title}</h3>
                        {tripBadge(tab)}
                      </div>
                      <p className="text-gray-600 text-sm">{tab.description}</p>
                      <div className="mt-2 flex items-center gap-4">
                        <span className="text-sm font-medium flex items-center gap-1 text-green-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          All paid ({totalPeople}/{totalPeople})
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/tab/${tab.id}`)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center gap-2"
                      >
                        View Tab
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(tab)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center gap-2"
                      >
                        Delete
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tab</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{tabToDelete?.title}&quot;? This action cannot be undone.
              {tabToDelete?.status === 'active' && (
                <span className="block mt-2 text-red-600 font-medium">
                  This is a finalized tab. All associated data will be permanently deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
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
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
