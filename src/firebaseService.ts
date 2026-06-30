import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { TherapyPlan, OperationType, WhatsAppSettings } from './types';
import { handleFirestoreError } from './firebaseUtils';

const COLLECTION_NAME = 'therapyPlans';

export async function checkConnection(): Promise<boolean> {
  try {
    const testDoc = doc(db, 'test-connection-check', 'test');
    await getDocFromServer(testDoc);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client is currently working offline.");
      return false;
    }
    return true;
  }
}

export async function saveTherapyPlan(plan: Omit<TherapyPlan, 'createdAt' | 'updatedAt'>, isNew: boolean): Promise<void> {
  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  if (adminToken) {
    try {
      const response = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(plan)
      });
      if (response.ok) {
        console.log("Admin API saved report ID:", plan.id);
        return;
      }
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Admin API save request failed');
    } catch (error) {
      console.error("Failed saving plan via Admin API:", error);
      throw error;
    }
  }

  const path = `${COLLECTION_NAME}/${plan.id}`;
  try {
    const docRef = doc(db, COLLECTION_NAME, plan.id);
    const payload: any = {
      ...plan,
      updatedAt: serverTimestamp()
    };

    if (isNew) {
      payload.createdAt = serverTimestamp();
    } else {
      // Preserve original createdAt
      const existingDoc = await getDoc(docRef);
      if (existingDoc.exists()) {
        payload.createdAt = existingDoc.data().createdAt || serverTimestamp();
      } else {
        payload.createdAt = serverTimestamp();
      }
    }

    await setDoc(docRef, payload);
    console.log("Saved report ID:", plan.id);
  } catch (error) {
    handleFirestoreError(error, isNew ? 'create' : 'update', path);
  }
}

export async function getTherapyPlan(planId: string): Promise<TherapyPlan | null> {
  const path = `${COLLECTION_NAME}/${planId}`;
  console.log("Collection:", COLLECTION_NAME);
  console.log("Document ID:", planId);
  try {
    const docRef = doc(db, COLLECTION_NAME, planId);
    const docSnap = await getDoc(docRef);
    console.log("Document exists:", docSnap.exists());
    if (docSnap.exists()) {
      console.log("Document data:", docSnap.data());
      return { id: docSnap.id, ...docSnap.data() } as TherapyPlan;
    }
    return null;
  } catch (error) {
    console.error("Firestore Error:", error);
    handleFirestoreError(error, 'get', path);
    return null;
  }
}

export async function deleteTherapyPlan(planId: string): Promise<void> {
  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  if (adminToken) {
    try {
      const response = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      if (response.ok) {
        console.log("Admin API deleted report ID:", planId);
        return;
      }
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Admin API delete request failed');
    } catch (error) {
      console.error("Failed deleting plan via Admin API:", error);
      throw error;
    }
  }

  const path = `${COLLECTION_NAME}/${planId}`;
  try {
    const docRef = doc(db, COLLECTION_NAME, planId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, 'delete', path);
  }
}

export async function getTherapyPlans(ownerId: string, isAdmin = false): Promise<TherapyPlan[]> {
  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  if (adminToken) {
    try {
      const response = await fetch(`/api/admin/plans`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.plans)) {
          return data.plans;
        }
      }
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Admin API failed to retrieve plans');
    } catch (error) {
      console.error("Failed fetching plans via Admin API:", error);
      throw error;
    }
  }

  try {
    const q = isAdmin 
      ? query(
          collection(db, COLLECTION_NAME),
          orderBy('createdAt', 'desc')
        )
      : query(
          collection(db, COLLECTION_NAME),
          where('ownerId', '==', ownerId),
          orderBy('createdAt', 'desc')
        );
    const querySnapshot = await getDocs(q);
    const plans: TherapyPlan[] = [];
    querySnapshot.forEach((doc) => {
      plans.push({ id: doc.id, ...doc.data() } as TherapyPlan);
    });
    return plans;
  } catch (error) {
    // If we get an index error or similar, fallback to client-side sorting to ensure the app works smoothly
    try {
      const qFallback = isAdmin
        ? query(collection(db, COLLECTION_NAME))
        : query(
            collection(db, COLLECTION_NAME),
            where('ownerId', '==', ownerId)
          );
      const querySnapshot = await getDocs(qFallback);
      const plans: TherapyPlan[] = [];
      querySnapshot.forEach((doc) => {
        plans.push({ id: doc.id, ...doc.data() } as TherapyPlan);
      });
      // Sort in-memory descending by date/createdAt-like value
      return plans.sort((a, b) => b.date.localeCompare(a.date));
    } catch (fallbackError) {
      handleFirestoreError(fallbackError, 'list', COLLECTION_NAME);
      return [];
    }
  }
}

export async function saveWhatsAppSettings(uid: string, settings: WhatsAppSettings): Promise<void> {
  const path = `userSettings/${uid}`;
  try {
    const docRef = doc(db, 'userSettings', uid);
    await setDoc(docRef, { whatsappSettings: settings }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, 'write', path);
  }
}

export async function getWhatsAppSettings(uid: string): Promise<WhatsAppSettings | null> {
  const path = `userSettings/${uid}`;
  try {
    const docRef = doc(db, 'userSettings', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().whatsappSettings) {
      return docSnap.data().whatsappSettings as WhatsAppSettings;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, 'get', path);
    return null;
  }
}
