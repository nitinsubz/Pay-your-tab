import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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

  const formatAmount = (amount: number) => {
    return amount < 0 
      ? `-$${Math.abs(amount).toFixed(2)}`
      : `$${amount.toFixed(2)}`
  }

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

  return (
    <>
      <Card className={`w-full max-w-md ${isPaid ? 'bg-green-50' : ''}`}>
        <CardHeader>
          <CardTitle>{name}&apos;s Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {groupedExpenses.map((group) => {
              const collapsed = collapsedSections[group.section] ?? true
              return (
                <div key={group.section} className="rounded-lg border border-slate-200 bg-slate-50/80">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedSections((prev) => ({
                        ...prev,
                        [group.section]: !collapsed,
                      }))
                    }
                    className="w-full px-3 py-2 flex items-center justify-between text-left"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{group.section}</div>
                      <div className="text-xs text-slate-500">
                        {group.items.length} line item{group.items.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold ${group.subtotal < 0 ? 'text-blue-600' : 'text-slate-800'}`}>
                        {formatAmount(group.subtotal)}
                      </span>
                      <span className="text-slate-500 text-sm">{collapsed ? '▸' : '▾'}</span>
                    </div>
                  </button>
                  {!collapsed && (
                    <ul className="px-3 pb-3 space-y-1">
                      {group.items.map((item) => (
                        <li
                          key={item.fullKey}
                          className={`flex justify-between gap-3 pl-4 py-1 text-sm border-l-2 border-slate-200 ${
                            item.amount < 0 ? 'text-blue-600' : 'text-slate-700'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="tabular-nums">{formatAmount(item.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-4 text-xl font-bold flex justify-between">
            <span>Total</span>
            <span>{formatAmount(total)}</span>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {total > 0 && (
            <Button className="w-full" onClick={() => handleVenmoClick(total, false)}>
              Click to Venmo
            </Button>
          )}
          {total < 0 && (
            <Button className="w-full" onClick={() => handleVenmoClick(-total, true)}>
              Click to Venmo Request
            </Button>
          )}
          {total === 0 && (
            <p className="text-center text-sm text-slate-600 py-1">
              Nothing owed — credits and charges balance out.
            </p>
          )}
          {isPaid && <div className="text-center font-medium text-green-600">Paid ✓</div>}
          {!isPaid && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setNextPaidState(true)
                setShowConfirmDialog(true)
              }}
            >
              Mark as Paid
            </Button>
          )}
          {isPaid && canTogglePaid && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setNextPaidState(false)
                setShowConfirmDialog(true)
              }}
            >
              Mark as Unpaid
            </Button>
          )}
        </CardFooter>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{nextPaidState ? 'Confirm Payment' : 'Mark as Unpaid?'}</DialogTitle>
            <DialogDescription>
              {nextPaidState
                ? 'Are you sure you want to mark this as paid?'
                : 'Marking unpaid will allow this person to be paid again.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowConfirmDialog(false)
              handleUpdatePaid(nextPaidState)
            }}>
              {nextPaidState ? 'Confirm' : 'Mark Unpaid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

