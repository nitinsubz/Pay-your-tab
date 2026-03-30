'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ExpenseDisplay } from '@/components/ExpenseDisplay'
import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { useParams } from 'next/navigation'
import {
  aggregateExpensesFromBills,
  getBillsFromDocument,
  grandTotalFromBills,
  billCountLabel,
  billUsesTaxTip,
  type TripBill,
  type LedgerItem
} from '@/lib/tripLedger'

interface Person {
  name: string;
  phoneNumber: string;
  paid?: boolean;
}

interface TabDocument {
  people: Person[];
  title: string;
  description: string;
  userId?: string;
  bills?: TripBill[];
  items?: LedgerItem[];
  subtotal?: number;
  total?: number;
}

export default function Home() {
  const [name, setName] = useState('')
  const [expenses, setExpenses] = useState<Record<string, number> | null>(null)
  const params = useParams()
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [tabExists, setTabExists] = useState(true);
  const [title, setTitle] = useState('');
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [expensesData, setExpensesData] = useState<Record<string, Record<string, number>>>({});
  const [paid, setPaid] = useState(false);
  const [paidStatusCache, setPaidStatusCache] = useState<Record<string, boolean>>({});
  const [bills, setBills] = useState<TripBill[]>([]);
  const [tabOwnerId, setTabOwnerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUserId(u?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    const urlId = params.id as string
    const hashName = window.location.hash.slice(1)

    const fetchTabAndExpenses = async () => {
      try {
        const tabDocRef = doc(db, 'tabs', urlId);
        const tabDocSnap = await getDoc(tabDocRef);
        const tabData = tabDocSnap.data() as TabDocument | undefined;

        if (tabDocSnap.exists() && tabData) {
          setDescription(tabData.description || '');
          setTitle(tabData.title);
          setTabExists(true);
          setTabOwnerId(tabData.userId ?? null);

          const billList = getBillsFromDocument(tabData);
          setBills(billList);

          const expensesMap = aggregateExpensesFromBills(
            billList,
            tabData.people.map((p: Person) => p.name)
          );

          setExpensesData(expensesMap);
          setAllUsers(tabData.people.map((p: Person) => p.name));

          const initialPaidStatus: Record<string, boolean> = {};
          tabData.people.forEach((person: Person) => {
            initialPaidStatus[person.name] = person.paid || false;
          });
          setPaidStatusCache(initialPaidStatus);

          if (hashName) {
            const matchingHashName = tabData.people.find(
              (p: Person) => p.name.toLowerCase() === hashName.toLowerCase()
            )?.name;
            if (matchingHashName && expensesMap[matchingHashName]) {
              setName(matchingHashName);
              setExpenses(expensesMap[matchingHashName]);
            }
          }
        } else {
          setTabExists(false);
          setBills([]);
          setTabOwnerId(null);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setTabExists(false);
        setBills([]);
        setTabOwnerId(null);
      }
      setLoading(false);
    };
    fetchTabAndExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    const handleHashChange = () => {
      const hashName = window.location.hash.slice(1)
      if (expensesData) {
        const matchingName = Object.keys(expensesData).find(
          n => n.toLowerCase() === hashName.toLowerCase()
        )
        if (matchingName) {
          setName(matchingName)
          setExpenses(expensesData[matchingName])
          setLoading(false)
        }
      }
    }
    
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [expensesData])
  
  useEffect(() => {
    if (name && expensesData) {
      window.location.hash = name
      setExpenses(expensesData[name])
      setPaid(paidStatusCache[name] || false);
    } else {
      window.location.hash = ''
      setExpenses(null)
    }
  }, [name, expensesData, paidStatusCache])

  const grandTotal = grandTotalFromBills(bills);
  const isTrip = bills.length > 1;

  const getComponent = () => {
    if (loading) {
      return <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    }
    
    if (!tabExists) {
      return (
        <>
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Oops!</h1>
          <p className="text-xl text-gray-600">This tab does not exist.</p>
        </div>
        </>
      );
    }

    return (
      <>
        <div className="w-full max-w-lg mx-auto text-center mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
            {isTrip ? 'Shared trip' : 'Shared tab'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{title}</h1>
          {description ? (
            <p className="text-sm text-gray-600 mt-2">{description}</p>
          ) : null}
        </div>

        {bills.length > 0 && (
          <div className="w-full max-w-xl mx-auto mb-8">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Expense summary</h2>
                  <p className="text-xs text-slate-500">{billCountLabel(bills)} · ${grandTotal.toFixed(2)} total</p>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {bills.map((bill) => {
                  const billSum = bill.items.reduce(
                    (s, it) => s + it.splits.reduce((a, sp) => a + sp.amount, 0),
                    0
                  );
                  return (
                    <li key={bill.id} className="px-4 py-3 flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{bill.label || 'Expense'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {bill.items.filter((i) => i.name !== 'Tip & Tax').length} line items
                          {billUsesTaxTip(bill) && bill.total > 0 && (
                            <span> · receipt ${bill.total.toFixed(2)}</span>
                          )}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold shrink-0 ${
                          billSum < 0 ? 'text-blue-600' : 'text-slate-800'
                        }`}
                      >
                        {billSum < 0
                          ? `-$${Math.abs(billSum).toFixed(2)}`
                          : `$${billSum.toFixed(2)}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">Trip total (splits)</span>
                <span
                  className={`text-lg font-bold ${
                    grandTotal < 0 ? 'text-blue-600' : 'text-indigo-700'
                  }`}
                >
                  {grandTotal < 0
                    ? `-$${Math.abs(grandTotal).toFixed(2)}`
                    : `$${grandTotal.toFixed(2)}`}
                </span>
              </div>
            </div>
            <p className="text-center text-xs text-slate-500 mt-3">
              Pick your name below to see what you owe across {isTrip ? 'all of these expenses' : 'this tab'} — one Venmo total.
            </p>
          </div>
        )}

        {currentUserId && tabOwnerId && currentUserId === tabOwnerId && (
          <div className="w-full max-w-xl mx-auto flex justify-center mb-6">
            <Link
              href={`/tabs/new?editId=${params.id as string}`}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit trip tab
            </Link>
          </div>
        )}

        <div className="mb-8 w-full max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Who are you?</label>
          <select
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Select your name</option>
            {allUsers.map((person) => (
              <option key={person} value={person}>
                {person}
              </option>
            ))}
          </select>
        </div>
        {expenses && (
          <ExpenseDisplay 
            expenses={expenses} 
            name={name} 
            documentId={params.id as string}
            isPaid={paid}
            onMarkPaid={() => {
              setPaid(true);
              setPaidStatusCache(prev => ({
                ...prev,
                [name]: true
              }));
            }}
          />
        )}
        {name && !expenses && <p className="text-red-500">No expenses found for {name}</p>}
        {!name && <p className="text-gray-500 text-center">Select your name to see your share and pay with Venmo.</p>}
      </>
    )
  };


  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
      {getComponent()}
    </main>
  )
}
