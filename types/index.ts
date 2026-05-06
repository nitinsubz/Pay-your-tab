export interface SharedExpense {
  id: string;
  description: string;
  amount: number;
  paidByName: string;
  splitBetween: string[];
  createdAt: { seconds: number; nanoseconds: number };
  createdByUserId: string;
}

export interface FirestoreParticipant {
  phoneNumber?: string;
  name: string;
  paid: boolean;
}

export interface Participant extends FirestoreParticipant {
  id: string;
}

export interface FirestoreTabData {
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  people: FirestoreParticipant[];
  status: 'active' | 'closed' | 'draft';
  title: string;
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bills?: any[];
  venmoUsername?: string;
  updatedAt?: { seconds: number; nanoseconds: number };
  inviteCode?: string;
  members?: Record<string, { displayName: string; email: string; joinedAt: { seconds: number; nanoseconds: number } }>;
  memberIds?: string[];
  sharedExpenses?: SharedExpense[];
}

export interface TabData {
  participants: Participant[];
  expenses: ExpenseWithDetails[];
}

export interface ExpenseWithDetails {
  id: string;
  description: string;
  amount: number;
  paidBy: Participant;
  paidById: string;
  splitBetween: Participant[];
  splitBetweenIds: string[];
}
