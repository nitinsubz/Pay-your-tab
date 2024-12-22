import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface ExpenseDisplayProps {
  expenses: Record<string, number>
  name: string
}

export function ExpenseDisplay({ expenses, name }: ExpenseDisplayProps) {
  let total = Object.values(expenses).reduce((sum, expense) => sum + expense, 0)

  const formatAmount = (amount: number) => {
    return amount < 0 
      ? `-$${Math.abs(amount).toFixed(2)}`
      : `$${amount.toFixed(2)}`
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{name}&apos;s Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {Object.entries(expenses).map(([category, amount]) => (
            <li 
              key={category} 
  className={`flex justify-between ${amount < 0 ? 'text-blue-600' : ''}`}
  >
              <span>{category}</span>
              <span>{formatAmount(amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 text-xl font-bold flex justify-between">
          <span>Total</span>
          <span>{formatAmount(total)}</span>
        </div>
      </CardContent>
      <CardFooter>
        {total > 0 && (
          <Button className="w-full" onClick={() => window.location.href = `venmo://paycharge?txn=pay&recipients=nitinsub&amount=${total.toFixed(2)}&note=USC WEEKEND`}>
            Click to Venmo
          </Button>
         )}
         {total <= 0 && (
          <Button className="w-full" onClick={() => window.location.href = `venmo://paycharge?txn=req&recipients=nitinsub&amount=${(-total).toFixed(2)}&note=USC WEEKEND REIMBURSEMENT`}>
            Click to Venmo Request
          </Button>
         )}
      </CardFooter>
    </Card>
  )
}

