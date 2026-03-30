/**
 * Trip-style tabs: multiple bills (meals, nights, etc.) in one document,
 * with one consolidated total per person for payment.
 */

export interface ItemSplit {
  personName: string;
  amount: number;
}

export interface LedgerItem {
  name: string;
  totalAmount: number;
  splits: ItemSplit[];
}

export interface TripBill {
  id: string;
  label: string;
  items: LedgerItem[];
  subtotal: number;
  total: number;
  /** When true, show subtotal/receipt total and apply tip & tax. When false, line-item splits are final (gas, groceries, etc.). */
  useTaxTip?: boolean;
}

export interface TabLike {
  title?: string;
  items?: LedgerItem[];
  subtotal?: number;
  total?: number;
  bills?: TripBill[];
}

export function createEmptyBill(): TripBill {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bill-${Date.now()}`,
    label: '',
    items: [],
    subtotal: 0,
    total: 0,
    useTaxTip: false
  };
}

/** Infer or read whether this expense uses the restaurant-style tax & tip step. */
export function billUsesTaxTip(b: TripBill): boolean {
  if (b.useTaxTip === true) return true;
  if (b.useTaxTip === false) return false;
  return b.subtotal > 0 && b.total > b.subtotal;
}

/** Ensure `useTaxTip` is explicit for UI (legacy docs may omit it). */
export function normalizeTripBill(b: TripBill): TripBill {
  if (b.useTaxTip === true || b.useTaxTip === false) return b;
  return {
    ...b,
    useTaxTip: b.subtotal > 0 && b.total > b.subtotal
  };
}

/** Normalize legacy single-receipt docs or new multi-bill trips. */
export function getBillsFromDocument(data: TabLike): TripBill[] {
  if (data.bills && Array.isArray(data.bills) && data.bills.length > 0) {
    return data.bills.map((b) => normalizeTripBill(b));
  }
  return [
    normalizeTripBill({
      id: 'legacy',
      label: data.title || 'Receipt',
      items: data.items || [],
      subtotal: typeof data.subtotal === 'number' ? data.subtotal : 0,
      total: typeof data.total === 'number' ? data.total : 0
    })
  ];
}

/** Per-person line items: keys are "Expense label · line item" for clarity. */
export function aggregateExpensesFromBills(
  bills: TripBill[],
  peopleNames: string[]
): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  peopleNames.forEach((p) => {
    map[p] = {};
  });

  bills.forEach((bill) => {
    const prefix = (bill.label || 'Expense').trim() || 'Expense';
    bill.items.forEach((item) => {
      item.splits.forEach((split) => {
        if (!map[split.personName]) map[split.personName] = {};
        const key = `${prefix} · ${item.name}`;
        map[split.personName][key] = (map[split.personName][key] || 0) + split.amount;
      });
    });
  });

  return map;
}

/** Sum of all split amounts across bills (matches receipt total when data is consistent). */
export function sumBillSplits(b: TripBill): number {
  return b.items.reduce(
    (s, it) => s + it.splits.reduce((a, sp) => a + sp.amount, 0),
    0
  );
}

export function grandTotalFromBills(bills: TripBill[]): number {
  return bills.reduce((sum, b) => sum + sumBillSplits(b), 0);
}

export function billCountLabel(bills: TripBill[]): string {
  const n = bills.length;
  return n === 1 ? '1 expense' : `${n} expenses`;
}
