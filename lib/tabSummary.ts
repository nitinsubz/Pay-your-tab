import {
  aggregateExpensesFromBills,
  getBillsFromDocument,
  grandTotalFromBills,
  type TabLike,
  type TripBill,
} from '@/lib/tripLedger';

export interface PersonSummary {
  name: string;
  paid: boolean;
  /** What this person owes on the tab; negative means they're owed (they fronted money). */
  owes: number;
}

export interface TabSummary {
  bills: TripBill[];
  total: number;
  people: PersonSummary[];
  paidCount: number;
  /** Sum of what unpaid people still owe (positive balances only). */
  outstanding: number;
}

export interface SummarizableTab extends TabLike {
  people?: { name: string; paid?: boolean }[];
}

/** Read-only view of a tab document: totals and who owes what. Never throws. */
export function summarizeTab(tab: SummarizableTab): TabSummary {
  const people = (tab.people || []).filter((p) => p && typeof p.name === 'string');
  try {
    const bills = getBillsFromDocument(tab);
    const map = aggregateExpensesFromBills(
      bills,
      people.map((p) => p.name)
    );
    const summaries: PersonSummary[] = people.map((p) => ({
      name: p.name,
      paid: p.paid === true,
      owes: Object.values(map[p.name] || {}).reduce((s, v) => s + v, 0),
    }));
    return {
      bills,
      total: grandTotalFromBills(bills),
      people: summaries,
      paidCount: summaries.filter((p) => p.paid).length,
      outstanding: summaries
        .filter((p) => !p.paid && p.owes > 0.005)
        .reduce((s, p) => s + p.owes, 0),
    };
  } catch {
    return {
      bills: [],
      total: 0,
      people: people.map((p) => ({ name: p.name, paid: p.paid === true, owes: 0 })),
      paidCount: people.filter((p) => p.paid === true).length,
      outstanding: 0,
    };
  }
}
