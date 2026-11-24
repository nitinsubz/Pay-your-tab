'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BellRing,
  Check,
  Link2,
  PencilLine,
  Receipt,
  Share2,
  Users,
  Wallet,
} from 'lucide-react'
import { ExpenseDisplay } from '@/components/ExpenseDisplay'
import { Navbar } from '@/components/Navbar'
import { doc, getDoc, onSnapshot, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore'
import { db } from '@/firebaseConfig'
import { useParams } from 'next/navigation'
import { useEffectiveAuth } from '@/lib/impersonation'
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
import {
  Avatar,
  Money,
  Panel,
  PaidPill,
  ProgressBar,
  Spinner,
  Toast,
  copyText,
  inputClass,
  useToast,
} from '@/components/app/primitives'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

/** The person a share link points at (`/tab/:id#Name`), decoded so names with spaces work. */
function readHashName(): string {
  const raw = window.location.hash.slice(1)
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

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
  const { effectiveUid: currentUserId } = useEffectiveAuth()
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
  const shareCardRef = useRef<HTMLDivElement>(null)
  const { toast, show: showToast } = useToast()
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])

  useEffect(() => {
    const fetchTab = async () => {
      const hashName = readHashName()
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
      const hashName = readHashName()
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


  const personTotal = (person: string) =>
    Object.values(expensesData[person] || {}).reduce((s, v) => s + v, 0)

  const tabUrl = origin ? `${origin}/tab/${tabId}` : ''
  const personUrl = (person: string) => `${tabUrl}#${encodeURIComponent(person)}`

  const paidCount = allUsers.filter((u) => paidStatusCache[u]).length
  const unpaidOwing = allUsers.filter((u) => !paidStatusCache[u] && personTotal(u) > 0.005)

  const copy = async (text: string, message: string) => {
    const ok = await copyText(text)
    showToast(ok ? message : 'Couldn’t copy. Try again.', ok ? 'success' : 'error')
  }

  const shareTab = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, text: `Here's your share of ${title}`, url: tabUrl })
        return
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
      }
    }
    copy(tabUrl, 'Link copied')
  }

  const reminderText = () => {
    const lines = unpaidOwing.map((u) => `• ${u}: ${formatMoney(personTotal(u))}`)
    return `${title}: still waiting on\n${lines.join('\n')}\n\nFind your share and pay here: ${tabUrl}`
  }

  const selectPerson = (person: string) => {
    setSelectedName(person)
    requestAnimationFrame(() => {
      shareCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen tw-app-bg">
        <Navbar />
        <main className="flex min-h-[60vh] items-center justify-center">
          <Spinner className="h-8 w-8" />
        </main>
      </div>
    )
  }

  if (!tabExists) {
    return (
      <div className="min-h-screen tw-app-bg">
        <Navbar />
        <main className="mx-auto flex max-w-md flex-col items-center px-6 pt-28 text-center">
          <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 text-white">
            <Receipt className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">This tab doesn&apos;t exist</h1>
          <p className="mt-2 text-gray-500">It may have been deleted, or the link is missing a few characters.</p>
          <Link href="/" className="mt-8 text-sm font-medium text-indigo-600 hover:text-indigo-800">
            Go to TabWrapped
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen tw-app-bg">
      <Navbar />
      <main className="relative mx-auto max-w-2xl px-4 pb-24 pt-8 sm:pt-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-1/2 h-72 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 opacity-60 blur-3xl"
        />

        {/* Header */}
        <header className="tw-app-rise relative mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600">
            {isTrip ? 'Shared trip' : 'Shared tab'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-gray-900 sm:text-[2.5rem] sm:leading-tight">
            {title}
          </h1>
          {description && <p className="mx-auto mt-2 max-w-md text-[15px] text-gray-500">{description}</p>}
          {bills.length > 0 && (
            <p className="mt-3 text-sm text-gray-400">
              <Money amount={grandTotal} className="font-medium text-gray-700" /> total · {allUsers.length}{' '}
              {allUsers.length === 1 ? 'person' : 'people'}
              {isTrip && ` · ${billCountLabel(bills)}`}
            </p>
          )}

          {isMember && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/tabs/new?editId=${tabId}`}>
                  <PencilLine />
                  Edit tab
                </Link>
              </Button>
              {isOwner && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/tab/${tabId}/payments`}>
                    <Wallet />
                    Payments
                  </Link>
                </Button>
              )}
            </div>
          )}
        </header>

        {/* Owner: send it out */}
        {isOwner && allUsers.length > 0 && (
          <Panel className="tw-app-rise relative mb-6 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-gray-900">Send it out</h2>
                <p className="text-xs text-gray-400">
                  {paidCount === allUsers.length
                    ? 'Everyone has paid. Nice.'
                    : `${paidCount} of ${allUsers.length} paid · ${formatMoney(
                        unpaidOwing.reduce((s, u) => s + personTotal(u), 0)
                      )} still out`}
                </p>
              </div>
              <div className="flex gap-2">
                {unpaidOwing.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => copy(reminderText(), 'Reminder copied')}>
                    <BellRing />
                    Copy reminder
                  </Button>
                )}
                <Button size="sm" onClick={shareTab}>
                  <Share2 />
                  Share link
                </Button>
              </div>
            </div>
            <div className="px-5 pt-3">
              <ProgressBar value={allUsers.length ? paidCount / allUsers.length : 0} tone={paidCount === allUsers.length ? 'emerald' : 'brand'} />
            </div>
            <ul className="px-2 py-2">
              {allUsers.map((person) => {
                const owes = personTotal(person)
                const paid = !!paidStatusCache[person]
                return (
                  <li key={person} className="group flex items-center gap-1 rounded-2xl pr-1 transition-colors hover:bg-gray-50">
                    <button
                      type="button"
                      onClick={() => selectPerson(person)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
                    >
                      <Avatar name={person} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-gray-900">{person}</span>
                        <span className={cn('block text-xs', owes < -0.005 ? 'text-sky-600' : 'text-gray-400')}>
                          {owes < -0.005 ? `is owed ${formatMoney(-owes)}` : `owes ${formatMoney(owes)}`}
                        </span>
                      </span>
                      <PaidPill paid={paid} />
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(personUrl(person), `${person.split(' ')[0]}'s link copied`)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white hover:text-gray-900 hover:shadow-sm"
                      aria-label={`Copy ${person}'s personal link`}
                      title="Copy their personal link"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
              Each person&apos;s link opens straight to their share and Venmo button.
            </p>
          </Panel>
        )}

        {/* Find your share */}
        {allUsers.length > 0 && (
          <section className="mb-6 scroll-mt-20" ref={shareCardRef}>
            {!isOwner && (
              <div className="mb-4 text-center">
                <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                  {selectedName ? 'Your share' : 'Who are you?'}
                </h2>
                {!selectedName && (
                  <p className="mt-0.5 text-sm text-gray-500">Tap your name to see what you owe and pay in one tap.</p>
                )}
              </div>
            )}

            {!isOwner && (
              <div className={cn('flex flex-wrap justify-center gap-2', selectedName ? 'mb-5' : 'mb-2')}>
                {allUsers.map((person) => {
                  const active = selectedName === person
                  return (
                    <button
                      key={person}
                      type="button"
                      onClick={() => (active ? setSelectedName('') : selectPerson(person))}
                      aria-pressed={active}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-sm font-medium transition-all',
                        active
                          ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-900',
                        selectedName && !active && 'opacity-60 hover:opacity-100'
                      )}
                    >
                      <Avatar name={person} size="sm" className={active ? 'ring-gray-700' : ''} />
                      {person}
                    </button>
                  )
                })}
              </div>
            )}

            {isOwner && selectedName && (
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{selectedName}&apos;s view</p>
                <button
                  type="button"
                  onClick={() => setSelectedName('')}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Close
                </button>
              </div>
            )}

            {selectedExpenses && (
              <div className="tw-app-rise" key={selectedName}>
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
              </div>
            )}
            {selectedName && !selectedExpenses && (
              <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-gray-500">
                No expenses found for {selectedName}.
              </p>
            )}
          </section>
        )}

        {/* Settlements (shared expenses) */}
        {sharedExpenses.length > 0 && (
          <Panel className="mb-6 overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-gray-900">Who owes what</h2>
              <p className="text-xs text-gray-400">
                {sharedExpenses.length} {sharedExpenses.length === 1 ? 'expense' : 'expenses'} ·{' '}
                {formatMoney(sharedExpenses.reduce((s, e) => s + e.amount, 0))} total
              </p>
            </div>
            {settlements.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-5 py-6 text-sm font-medium text-emerald-700">
                <Check className="h-4 w-4" strokeWidth={3} />
                All settled up
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {settlements.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <Avatar name={s.from} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-500">
                      <span className="font-medium text-gray-900">{s.from}</span> pays{' '}
                      <span className="font-medium text-gray-900">{s.to}</span>
                    </span>
                    <Money amount={s.amount} className="text-[15px] font-semibold text-gray-900" />
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-gray-100 px-5 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Shared expenses</p>
              <ul className="space-y-2">
                {sharedExpenses.map((expense) => (
                  <li key={expense.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{expense.description}</p>
                      <p className="text-xs text-gray-400">
                        {expense.paidByName} paid · split{' '}
                        {expense.splitBetween.length === allUsers.length ? 'equally' : `with ${expense.splitBetween.join(', ')}`}
                      </p>
                    </div>
                    <Money amount={expense.amount} className="shrink-0 font-medium text-gray-700" />
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        )}

        {/* Receipts */}
        {bills.length > 0 && (
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-gray-900">{isTrip ? 'Trip breakdown' : 'The receipt'}</h2>
              <span className="text-xs text-gray-400">{billCountLabel(bills)}</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {bills.map((bill) => {
                const billSum = bill.items.reduce(
                  (s, it) => s + it.splits.reduce((a, sp) => a + sp.amount, 0), 0
                )
                const n = bill.items.filter(i => i.name !== 'Tip & Tax').length
                return (
                  <li key={bill.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
                      <Receipt className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-gray-900">{bill.label || 'Expense'}</p>
                      <p className="text-xs text-gray-400">
                        {n} {n === 1 ? 'item' : 'items'}
                        {billUsesTaxTip(bill) && bill.total > 0 && ` · incl. tax & tip`}
                        {bill.paidBy && ` · ${bill.paidBy} paid`}
                      </p>
                    </div>
                    <Money amount={billSum} className="text-[15px] font-semibold text-gray-900" />
                  </li>
                )
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-5 py-4">
              <span className="text-sm font-medium text-gray-500">Total</span>
              <Money amount={grandTotal} className="text-lg font-semibold tracking-tight text-gray-900" />
            </div>
          </Panel>
        )}

        {/* Not a member: quiet footnote */}
        {!isMember && (
          <p className="mt-10 text-center text-xs text-gray-400">
            <Users className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
            Covered something on this tab? Ask the organizer for an invite link to add it.
            {!currentUserId && (
              <>
                {' '}
                <Link href={`/login?redirect=/tab/${tabId}`} className="font-medium text-gray-500 underline underline-offset-2 hover:text-gray-900">
                  Sign in
                </Link>
              </>
            )}
          </p>
        )}

        <p className="mt-10 text-center text-xs text-gray-300">
          Split with{' '}
          <Link href="/" className="font-medium text-gray-400 hover:text-gray-900">
            TabWrapped
          </Link>
          <ArrowRight className="ml-0.5 inline h-3 w-3 align-[-1px]" />
        </p>
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
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-900">Description</label>
              <input
                type="text"
                placeholder="e.g. Dinner, Uber, Groceries"
                value={expenseForm.description}
                onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-900">Amount ($)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-900">Paid by</label>
              <select
                value={expenseForm.paidByName}
                onChange={e => setExpenseForm(p => ({ ...p, paidByName: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select person</option>
                {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">Split between</label>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {allUsers.map(u => (
                  <label key={u} className="flex cursor-pointer select-none items-center gap-2 text-sm">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddExpenseOpen(false)} disabled={addingExpense}>Cancel</Button>
            <Button onClick={handleAddExpense} disabled={addingExpense}>
              {addingExpense ? 'Adding…' : 'Add expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toast toast={toast} />
    </div>
  )
}
