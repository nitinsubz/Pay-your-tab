import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getBillsFromDocument } from '@/lib/tripLedger';

let cachedApp: App | null = null;

function getAdminApp(): App | null {
  if (cachedApp) return cachedApp;
  const existing = getApps()[0];
  if (existing) {
    cachedApp = existing;
    return cachedApp;
  }
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  /** Defaults to this repo’s Firebase project; override if you fork. */
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? 'pay-your-tab';
  if (!clientEmail || !privateKey) {
    return null;
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
  cachedApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return cachedApp;
}

export type TabShareMetadata = {
  title: string;
  /** Shown under the title on the tab page when set. */
  description: string;
  /** Matches the small label above the title: "Shared trip" vs "Shared tab". */
  eyebrow: string;
};

export async function getTabShareMetadata(tabId: string): Promise<TabShareMetadata | null> {
  const app = getAdminApp();
  if (!app) return null;
  const db = getFirestore(app);
  const snap = await db.collection('tabs').doc(tabId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data) return null;
  const title =
    typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Untitled tab';
  const description =
    typeof data.description === 'string' ? data.description.trim() : '';
  const bills = getBillsFromDocument({
    title: data.title,
    bills: data.bills,
    items: data.items,
    subtotal: data.subtotal,
    total: data.total,
  });
  const eyebrow = bills.length > 1 ? 'Shared trip' : 'Shared tab';
  return { title, description, eyebrow };
}
