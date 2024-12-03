import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface ExpenseDisplayProps {
  expenses: Record<string, number>
  name: string
}

export function ExpenseDisplay({ expenses, name }: ExpenseDisplayProps) {
  const total = Object.values(expenses).reduce((sum, expense) => sum + expense, 0)

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{name}&apos;s Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {Object.entries(expenses).map(([category, amount]) => (
            <li key={category} className="flex justify-between">
              <span>{category}</span>
              <span>${amount.toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 text-xl font-bold flex justify-between">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={() => window.location.href = `venmo://paycharge?txn=pay&recipients=nitinsub&amount=${total.toFixed(2)}&note=USC WEEKEND`}>
          Click to Venmo
        </Button>
      </CardFooter>
    </Card>
  )
}

