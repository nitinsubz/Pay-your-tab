import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

export const updateTab = async (tabId, updatedData) => {
  try {
    const tabRef = doc(db, 'tabs', tabId);
    await updateDoc(tabRef, updatedData);
    return true;
  } catch (error) {
    console.error('Error updating tab:', error);
    throw error;
  }
}; 