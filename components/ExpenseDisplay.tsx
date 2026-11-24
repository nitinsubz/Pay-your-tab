import React from 'react'
import { Check, CheckCircle2, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, Money } from "@/components/app/primitives"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { db } from "@/firebaseConfig"
import { doc, updateDoc, getDoc } from "firebase/firestore"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ExpenseDisplayProps {
  expenses: Record<string, number>
  name: string
  isPaid?: boolean
  canTogglePaid?: boolean
  onPaidStatusChange?: (nextPaid: boolean) => void
  documentId: string
}

export function ExpenseDisplay({
  expenses,
  name,
  isPaid = false,
  canTogglePaid = false,
  onPaidStatusChange,
  documentId,
}: ExpenseDisplayProps) {
  const [venmoUsername, setVenmoUsername] = React.useState<string>("")
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false)
  const [nextPaidState, setNextPaidState] = React.useState(true)
  const [tabTitle, setTabTitle] = React.useState<string>("")
  const [venmoLoaded, setVenmoLoaded] = React.useState(false)
  React.useEffect(() => {
    const fetchVenmoUsername = async () => {
      try {
        const tabRef = doc(db, "tabs", documentId)
        const docSnap = await getDoc(tabRef)
        const data = docSnap.data()
        if (data?.venmoUsername) {
          setVenmoUsername(data.venmoUsername)
          setTabTitle(data.title)
        }
      } catch (error) {
        console.error("Error fetching venmo username:", error)
      } finally {
        setVenmoLoaded(true)
      }
    }

    fetchVenmoUsername()
  }, [documentId])

  const total = Object.values(expenses).reduce((sum, expense) => sum + expense, 0)
  const groupedExpenses = React.useMemo(() => {
    const groups = new Map<string, Array<{ label: string; amount: number; fullKey: string }>>()
    Object.entries(expenses).forEach(([fullKey, amount]) => {
      const parts = fullKey.split(' · ')
      const section = (parts[0] || 'Other').trim() || 'Other'
      const label = (parts.slice(1).join(' · ') || parts[0] || fullKey).trim()
      if (!groups.has(section)) groups.set(section, [])
      groups.get(section)!.push({ label, amount, fullKey })
    })
    return Array.from(groups.entries()).map(([section, items]) => ({
      section,
      items,
      subtotal: items.reduce((s, it) => s + it.amount, 0),
    }))
  }, [expenses])
  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({})
  React.useEffect(() => {
    setCollapsedSections((prev) => {
      const next: Record<string, boolean> = { ...prev }
      groupedExpenses.forEach((g) => {
        if (next[g.section] === undefined) next[g.section] = true
      })
      Object.keys(next).forEach((k) => {
        if (!groupedExpenses.some((g) => g.section === k)) delete next[k]
      })
      return next
    })
  }, [groupedExpenses])

  const isMobile = () => {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.innerWidth <= 768 && 'ontouchstart' in window)
  }

  const getVenmoLink = (amount: number, isRequest: boolean = false) => {
    const encodedNote = encodeURIComponent(tabTitle)
    const formattedAmount = Math.abs(amount).toFixed(2)
    
    if (isMobile()) {
      // Mobile format: venmo://paycharge
      if (isRequest) {
        return `venmo://paycharge?txn=request&recipients=${venmoUsername}&amount=${formattedAmount}&note=${tabTitle}`
      } else {
        return `venmo://paycharge?txn=pay&recipients=${venmoUsername}&amount=${formattedAmount}&note=${tabTitle}`
      }
    } else {
      // Web format: https://venmo.com/YourUsername?txn=pay&amount=XX.XX&note=Your+Note
      if (isRequest) {
        return `https://venmo.com/${venmoUsername}?txn=request&amount=${formattedAmount}&note=${encodedNote}`
      } else {
        return `https://venmo.com/${venmoUsername}?txn=pay&amount=${formattedAmount}&note=${encodedNote}`
      }
    }
  }

  const handleVenmoClick = (amount: number, isRequest: boolean = false) => {
    const link = getVenmoLink(amount, isRequest)
    if (isMobile()) {
      // Mobile: navigate in same window for deep links
      window.location.href = link
    } else {
      // Web: open in new tab
      window.open(link, '_blank')
    }
  }

  const handleUpdatePaid = async (nextPaid: boolean) => {
    try {
      const expenseRef = doc(db, "tabs", documentId)
      
      // First get the current document data
      const docSnap = await getDoc(expenseRef)
      const currentData = docSnap.data()
      
      if (!currentData?.people) {
        throw new Error("Invalid document structure")
      }

      // Create a new people array with the updated paid status
      const updatedPeople = [...currentData.people]
      const personIndex = updatedPeople.findIndex(person => person.name === name)
      
      if (personIndex === -1) {
        throw new Error("Person not found in the tab")
      }

      // Update the specific person while preserving their other data
      updatedPeople[personIndex] = {
        ...updatedPeople[personIndex],
        paid: nextPaid
      }

      // Update the document with the entire new people array
      await updateDoc(expenseRef, {
        people: updatedPeople
      })
      
      if (onPaidStatusChange) {
        onPaidStatusChange(nextPaid)
      }
    } catch (error) {
      console.error("Error updating paid status:", error)
      alert("Failed to update paid status. Please try again.")
    }
  }

  const firstName = name.split(' ')[0]
  const owesMoney = total > 0.005
  const isOwed = total < -0.005

  return (
    <>
      <div
        className={cn(
          'overflow-hidden rounded-3xl border bg-white shadow-[0_16px_50px_-28px_rgba(15,23,42,0.35)] transition-colors',
          isPaid ? 'border-emerald-200' : 'border-gray-100'
        )}
      >
        {/* Amount hero */}
        <div className={cn('relative px-6 pb-6 pt-6 text-center', isPaid ? 'bg-emerald-50/60' : 'bg-white')}>
          {!isPaid && (
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 opacity-70 blur-3xl"
            />
          )}
          <div className="relative">
            <div className="mb-3 flex justify-center">
              <Avatar name={name} size="lg" className="ring-4 ring-white" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              {isOwed ? `${firstName} is owed` : owesMoney ? `${firstName}'s share` : `${firstName}'s balance`}
            </p>
            <p className="mt-1 text-[2.75rem] font-semibold leading-none tracking-[-0.03em] text-gray-900 tabular-nums">
              {formatMoney(Math.abs(total))}
            </p>
            {isPaid ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-3 py-1 text-sm font-medium text-emerald-700">
                <Check className="h-4 w-4" strokeWidth={3} />
                Paid
              </p>
            ) : !owesMoney && !isOwed ? (
              <p className="mt-3 text-sm text-gray-500">Nothing owed. Credits and charges balance out.</p>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        {!isPaid && (owesMoney || isOwed) && (
          <div className="px-6 pb-2">
            {venmoUsername ? (
              <button
                type="button"
                onClick={() => (owesMoney ? handleVenmoClick(total, false) : handleVenmoClick(-total, true))}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#008CFF] text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(0,140,255,0.8)] transition-all hover:bg-[#0077DA] active:scale-[0.99]"
              >
                <VenmoMark />
                {owesMoney ? `Pay ${formatMoney(total)} with Venmo` : `Request ${formatMoney(-total)} on Venmo`}
              </button>
            ) : venmoLoaded ? (
              <p className="rounded-2xl bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
                The organizer hasn&apos;t added a Venmo username yet.
              </p>
            ) : (
              <div className="h-12 w-full animate-pulse rounded-full bg-gray-100" />
            )}
          </div>
        )}
        <div className="px-6 pb-5 pt-2">
          {!isPaid && (
            <button
              type="button"
              onClick={() => {
                setNextPaidState(true)
                setShowConfirmDialog(true)
              }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
            >
              <CheckCircle2 className="h-4 w-4 text-gray-400" />
              {owesMoney ? 'I’ve paid, mark as paid' : 'Mark as settled'}
            </button>
          )}
          {isPaid && venmoUsername && (owesMoney || isOwed) && (
            <button
              type="button"
              onClick={() => (owesMoney ? handleVenmoClick(total, false) : handleVenmoClick(-total, true))}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full text-sm font-medium text-[#008CFF] transition-colors hover:bg-white"
            >
              <VenmoMark />
              {owesMoney ? 'Still need to send it? Open Venmo' : 'Open Venmo request'}
            </button>
          )}
          {isPaid && canTogglePaid && (
            <button
              type="button"
              onClick={() => {
                setNextPaidState(false)
                setShowConfirmDialog(true)
              }}
              className="flex h-10 w-full items-center justify-center rounded-full text-sm font-medium text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
            >
              Mark as unpaid
            </button>
          )}
        </div>

        {/* Breakdown */}
        <div className="border-t border-gray-100">
          <p className="px-6 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Breakdown</p>
          <ul className="px-3 pb-3">
            {groupedExpenses.map((group) => {
              const collapsed = collapsedSections[group.section] ?? true
              return (
                <li key={group.section}>
                  <button
                    type="button"
                    aria-expanded={!collapsed}
                    onClick={() =>
                      setCollapsedSections((prev) => ({
                        ...prev,
                        [group.section]: !collapsed,
                      }))
                    }
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                  >
                    <ChevronRight
                      className={cn('h-4 w-4 shrink-0 text-gray-300 transition-transform', !collapsed && 'rotate-90')}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-gray-900">{group.section}</p>
                      <p className="text-xs text-gray-400">
                        {group.items.length} item{group.items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Money amount={group.subtotal} className="text-[15px] font-semibold text-gray-900" />
                  </button>
                  {!collapsed && (
                    <ul className="mb-1 ml-[1.875rem] mr-3 space-y-0.5 border-l border-gray-100 pl-4">
                      {group.items.map((item) => (
                        <li key={item.fullKey} className="flex justify-between gap-3 py-1 text-sm">
                          <span className={cn('truncate', item.amount < 0 ? 'text-sky-600' : 'text-gray-600')}>
                            {item.label}
                            {item.amount < 0 && <span className="ml-1.5 text-xs text-sky-500">credit</span>}
                          </span>
                          <Money amount={item.amount} className="shrink-0 text-gray-700" />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <span className="text-sm font-medium text-gray-500">Total</span>
            <Money amount={total} className="text-lg font-semibold tracking-tight text-gray-900" />
          </div>
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{nextPaidState ? `Mark ${firstName} as paid?` : `Mark ${firstName} as unpaid?`}</DialogTitle>
            <DialogDescription>
              {nextPaidState
                ? 'Only do this once the money has actually been sent. The organizer will see it.'
                : 'They’ll show as owing again.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowConfirmDialog(false)
                handleUpdatePaid(nextPaidState)
              }}
            >
              {nextPaidState ? 'Mark paid' : 'Mark unpaid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function VenmoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M19.5 3c.7 1.2 1 2.4 1 3.9 0 4.9-4.2 11.2-7.6 15.6H5.2L2.1 4.3l6.8-.6 1.6 13c1.5-2.5 3.4-6.4 3.4-9 0-1.5-.3-2.5-.7-3.3L19.5 3z" />
    </svg>
  )
}
