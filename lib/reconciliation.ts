import type { SharedExpense } from '@/types';

export interface NetBalance {
  name: string;
  balance: number;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export function calculateBalances(expenses: SharedExpense[]): NetBalance[] {
  const map: Record<string, number> = {};

  for (const expense of expenses) {
    const n = expense.splitBetween.length;
    if (n === 0 || expense.amount <= 0) continue;
    const share = expense.amount / n;

    map[expense.paidByName] = (map[expense.paidByName] ?? 0) + expense.amount;
    for (const name of expense.splitBetween) {
      map[name] = (map[name] ?? 0) - share;
    }
  }

  return Object.entries(map).map(([name, balance]) => ({ name, balance }));
}

export function calculateSettlements(balances: NetBalance[]): Settlement[] {
  const EPSILON = 0.005;
  const settlements: Settlement[] = [];
  const creditors = balances
    .filter((b) => b.balance > EPSILON)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balance - a.balance);
  const debtors = balances
    .filter((b) => b.balance < -EPSILON)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.balance - b.balance);

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(-debtors[i].balance, creditors[j].balance);
    if (amount > EPSILON) {
      settlements.push({
        from: debtors[i].name,
        to: creditors[j].name,
        amount: Math.round(amount * 100) / 100,
      });
    }
    debtors[i].balance += amount;
    creditors[j].balance -= amount;
    if (Math.abs(debtors[i].balance) < EPSILON) i++;
    if (Math.abs(creditors[j].balance) < EPSILON) j++;
  }

  return settlements;
}
