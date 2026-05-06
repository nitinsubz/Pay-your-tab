'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ExpenseDisplay } from '@/components/ExpenseDisplay'
import { doc, getDoc, onSnapshot, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore'
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
import { calculateBalances, calculateSettlements } from '@/lib/reconciliation'
import type { SharedExpense } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
  inviteCode?: string;
  memberIds?: string[];
  sharedExpenses?: SharedExpense[];
}

interface ExpenseForm {
  description: string;
  amount: string;
  paidByName: string;
  splitBetween: string[];
}

export default function TabPage() {
  const params = useParams()
  const tabId = params.id as string

  const [loading, setLoading] = useState(true)
  const [tabExists, setTabExists] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tabOwnerId, setTabOwnerId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<string[]>([])
  const [bills, setBills] = useState<TripBill[]>([])
  const [expensesData, setExpensesData] = useState<Record<string, Record<string, number>>>({})
  const [paidStatusCache, setPaidStatusCache] = useState<Record<string, boolean>>({})

  // Shared tab
  const [sharedExpenses, setSharedExpenses] = useState<SharedExpense[]>([])
  const [memberIds, setMemberIds] = useState<string[]>([])

  // Individual view (legacy)
  const [selectedName, setSelectedName] = useState('')
  const [selectedExpenses, setSelectedExpenses] = useState<Record<string, number> | null>(null)
  const [isPaid, setIsPaid] = useState(false)

  // Add expense dialog
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [addingExpense, setAddingExpense] = useState(false)
  const [addExpenseError, setAddExpenseError] = useState('')
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({
    description: '',
    amount: '',
    paidByName: '',
    splitBetween: [],
  })

  const initialHashHandled = useRef(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUserId(u?.uid ?? null))
    return () => unsub()
  }, [])

  useEffect(() => {
    const fetchTab = async () => {
      const hashName = window.location.hash.slice(1)
      try {
        const snap = await getDoc(doc(db, 'tabs', tabId))
        const data = snap.data() as TabDocument | undefined
        if (snap.exists() && data) {
          setTitle(data.title)
          setDescription(data.description || '')
          setTabOwnerId(data.userId ?? null)
          setTabExists(true)

          const billList = getBillsFromDocument(data)
          setBills(billList)

          const expMap = aggregateExpensesFromBills(billList, data.people.map(p => p.name))
          setExpensesData(expMap)

          const sorted = data.people.map(p => p.name)
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
          setAllUsers(sorted)

          const paidMap: Record<string, boolean> = {}
          data.people.forEach(p => { paidMap[p.name] = p.paid || false })
          setPaidStatusCache(paidMap)

          setSharedExpenses(data.sharedExpenses || [])
          setMemberIds(data.memberIds || [])

          if (hashName && !initialHashHandled.current) {
            initialHashHandled.current = true
            const match = data.people.find(p => p.name.toLowerCase() === hashName.toLowerCase())?.name
            if (match && expMap[match]) {
              setSelectedName(match)
              setSelectedExpenses(expMap[match])
            }
          }
        } else {
          setTabExists(false)
        }
      } catch (e) {
        console.error(e)
        setTabExists(false)
      }
      setLoading(false)
    }
    fetchTab()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId])

  // Real-time listener for live updates
  useEffect(() => {
    if (!tabExists) return
    const unsub = onSnapshot(doc(db, 'tabs', tabId), (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as TabDocument
      const paidMap: Record<string, boolean> = {}
      ;(data.people || []).forEach(p => { paidMap[p.name] = p.paid || false })
      setPaidStatusCache(paidMap)
      setSharedExpenses(data.sharedExpenses || [])
      setMemberIds(data.memberIds || [])
    })
    return () => unsub()
  }, [tabId, tabExists])

  useEffect(() => {
    const handleHashChange = () => {
      const hashName = window.location.hash.slice(1)
      const match = Object.keys(expensesData).find(n => n.toLowerCase() === hashName.toLowerCase())
      if (match) {
        setSelectedName(match)
        setSelectedExpenses(expensesData[match])
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [expensesData])

  useEffect(() => {
    if (selectedName && expensesData) {
      window.location.hash = selectedName
      setSelectedExpenses(expensesData[selectedName])
      setIsPaid(paidStatusCache[selectedName] || false)
    } else {
      window.location.hash = ''
      setSelectedExpenses(null)
    }
  }, [selectedName, expensesData, paidStatusCache])

  const isOwner = !!(currentUserId && currentUserId === tabOwnerId)
  const isMember = !!(currentUserId && (isOwner || memberIds.includes(currentUserId)))

  const grandTotal = grandTotalFromBills(bills)
  const isTrip = bills.length > 1

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const openAddExpense = () => {
    setExpenseForm({
      description: '',
      amount: '',
      paidByName: allUsers[0] || '',
      splitBetween: [...allUsers],
    })
    setAddExpenseError('')
    setAddExpenseOpen(true)
  }

  const toggleSplitPerson = (name: string) => {
    setExpenseForm(prev => ({
      ...prev,
      splitBetween: prev.splitBetween.includes(name)
        ? prev.splitBetween.filter(n => n !== name)
        : [...prev.splitBetween, name],
    }))
  }

  const handleAddExpense = async () => {
    const amount = parseFloat(expenseForm.amount)
    if (!expenseForm.description.trim()) { setAddExpenseError('Enter a description.'); return }
    if (!amount || amount <= 0) { setAddExpenseError('Enter a valid amount.'); return }
    if (!expenseForm.paidByName) { setAddExpenseError('Select who paid.'); return }
    if (expenseForm.splitBetween.length === 0) { setAddExpenseError('Select at least one person to split with.'); return }

    setAddingExpense(true)
    setAddExpenseError('')

    const newExpense: SharedExpense = {
      id: crypto.randomUUID(),
      description: expenseForm.description.trim(),
      amount,
      paidByName: expenseForm.paidByName,
      splitBetween: expenseForm.splitBetween,
      createdAt: Timestamp.now() as unknown as { seconds: number; nanoseconds: number },
      createdByUserId: currentUserId!,
    }

    try {
      await updateDoc(doc(db, 'tabs', tabId), { sharedExpenses: arrayUnion(newExpense) })
      setAddExpenseOpen(false)
    } catch (e) {
      console.error(e)
      setAddExpenseError('Failed to add expense. Please try again.')
    }
    setAddingExpense(false)
  }

  const settlements = calculateSettlements(calculateBalances(sharedExpenses))

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </main>
    )
  }

  if (!tabExists) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Oops!</h1>
          <p className="text-xl text-gray-600">This tab does not exist.</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-center p-6 sm:p-12 pt-10">
        <div className="w-full max-w-xl mx-auto">

          {/* Header */}
          <div className="text-center mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
              {isTrip ? 'Shared trip' : 'Shared tab'}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{title}</h1>
            {description && <p className="text-sm text-gray-500 mt-2">{description}</p>}
          </div>

          {/* ── Action bar ── visible to members and owner */}
          {isMember && (
            <div className="flex flex-wrap items-center gap-2 justify-center mb-8">
              <Link
                href={`/tabs/new?editId=${tabId}`}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit expenses
              </Link>

              {isOwner && allUsers.some(u => !paidStatusCache[u]) && (
                <Link
                  href={`/tab/${tabId}/payments`}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors"
                >
                  Payments
                </Link>
              )}
            </div>
          )}

          {/* If not a member and not logged in, show a subtle join nudge */}
          {!isMember && !loading && (
            <div className="mb-8 rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-center">
              <p className="text-sm text-indigo-800 font-medium">Got an invite link? Join this tab to add expenses.</p>
              {!currentUserId && (
                <Link href={`/login?redirect=/tab/${tabId}`} className="mt-2 inline-block text-sm text-indigo-600 underline underline-offset-2">
                  Sign in
                </Link>
              )}
            </div>
          )}

          {/* ── Settlements ── (front and centre when there's shared activity) */}
          {sharedExpenses.length > 0 && (
            <div className="mb-6">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Who owes what</h2>
                    <p className="text-xs text-slate-500">
                      {sharedExpenses.length} {sharedExpenses.length === 1 ? 'expense' : 'expenses'} · $
                      {sharedExpenses.reduce((s, e) => s + e.amount, 0).toFixed(2)} total
                    </p>
                  </div>
                </div>

                {settlements.length === 0 ? (
                  <div className="px-4 py-5 text-center">
                    <p className="text-sm font-medium text-green-700">All settled up!</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {settlements.map((s, i) => (
                      <li key={i} className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-slate-900">{s.from}</span>
                          <span className="text-slate-400 text-xs">owes</span>
                          <span className="font-semibold text-slate-900">{s.to}</span>
                        </div>
                        <span className="text-base font-bold text-indigo-700">${s.amount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* ── Shared expenses list ── */}
          {sharedExpenses.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">Shared expenses</h3>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <ul className="divide-y divide-slate-100">
                  {sharedExpenses.map((expense) => (
                    <li key={expense.id} className="px-4 py-3">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{expense.description}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {expense.paidByName} paid · split {expense.splitBetween.length === allUsers.length ? 'equally' : `with ${expense.splitBetween.join(', ')}`}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-slate-700 shrink-0">${expense.amount.toFixed(2)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── Legacy bill summary ── */}
          {bills.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">
                {isTrip ? 'Trip breakdown' : 'Expense breakdown'}
              </h3>
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs text-slate-500">{billCountLabel(bills)} · ${grandTotal.toFixed(2)} total</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {bills.map((bill) => {
                    const billSum = bill.items.reduce(
                      (s, it) => s + it.splits.reduce((a, sp) => a + sp.amount, 0), 0
                    )
                    return (
                      <li key={bill.id} className="px-4 py-3 flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{bill.label || 'Expense'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {(() => { const n = bill.items.filter(i => i.name !== 'Tip & Tax').length; return `${n} line ${n === 1 ? 'item' : 'items'}`; })()}
                            {billUsesTaxTip(bill) && bill.total > 0 && <span> · receipt ${bill.total.toFixed(2)}</span>}
                          </p>
                        </div>
                        <span className={`text-sm font-semibold shrink-0 ${billSum < 0 ? 'text-blue-600' : 'text-slate-800'}`}>
                          {billSum < 0 ? `-$${Math.abs(billSum).toFixed(2)}` : `$${billSum.toFixed(2)}`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Total (splits)</span>
                  <span className={`text-lg font-bold ${grandTotal < 0 ? 'text-blue-600' : 'text-indigo-700'}`}>
                    {grandTotal < 0 ? `-$${Math.abs(grandTotal).toFixed(2)}` : `$${grandTotal.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Individual payment view ── */}
          {allUsers.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">Your individual split</h3>
              <div className="mb-4">
                <select
                  value={selectedName}
                  onChange={(e) => setSelectedName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select your name</option>
                  {allUsers.map((person) => (
                    <option key={person} value={person}>{person}</option>
                  ))}
                </select>
              </div>
              {selectedExpenses && (
                <ExpenseDisplay
                  expenses={selectedExpenses}
                  name={selectedName}
                  documentId={tabId}
                  isPaid={isPaid}
                  canTogglePaid={isOwner}
                  onPaidStatusChange={(next) => {
                    setIsPaid(next)
                    setPaidStatusCache(prev => ({ ...prev, [selectedName]: next }))
                  }}
                />
              )}
              {selectedName && !selectedExpenses && (
                <p className="text-red-500 text-sm">No expenses found for {selectedName}.</p>
              )}
              {!selectedName && (
                <p className="text-gray-400 text-sm text-center">Select your name to see your share and pay with Venmo.</p>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Add expense dialog */}
      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add shared expense</DialogTitle>
            <DialogDescription>
              Record who paid and how to split it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                placeholder="e.g. Dinner, Uber, Groceries"
                value={expenseForm.description}
                onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Paid by</label>
              <select
                value={expenseForm.paidByName}
                onChange={e => setExpenseForm(p => ({ ...p, paidByName: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select person</option>
                {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Split between</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {allUsers.map(u => (
                  <label key={u} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={expenseForm.splitBetween.includes(u)}
                      onChange={() => toggleSplitPerson(u)}
                      className="rounded"
                    />
                    {u}
                  </label>
                ))}
              </div>
            </div>
            {addExpenseError && <p className="text-sm text-red-600">{addExpenseError}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAddExpenseOpen(false)} disabled={addingExpense}>Cancel</Button>
            <Button onClick={handleAddExpense} disabled={addingExpense}>
              {addingExpense ? 'Adding…' : 'Add expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
