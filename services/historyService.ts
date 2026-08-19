import { collection, doc, setDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface SaveItemPayload {
  ticker: string;
  mode: string;
  title?: string;
  result: any;
}

export const saveRunToDatabase = async (userId: string, payload: SaveItemPayload) => {
  const collectionPath = `users/${userId}/savedItems`;
  try {
    const newDocRef = doc(collection(db, 'users', userId, 'savedItems'));
    const docData = {
      userId,
      ticker: (payload.ticker || 'N/A').toUpperCase().substring(0, 50),
      mode: payload.mode.toUpperCase(),
      title: (payload.title || `${payload.ticker || 'Scan'} ${payload.mode}`).substring(0, 120),
      result: typeof payload.result === 'string' ? payload.result : JSON.stringify(payload.result),
      createdAt: serverTimestamp()
    };
    await setDoc(newDocRef, docData);
    return newDocRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, collectionPath);
  }
};

export const fetchUserHistory = async (userId: string) => {
  const collectionPath = `users/${userId}/savedItems`;
  try {
    const q = query(collection(db, 'users', userId, 'savedItems'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, collectionPath);
  }
};

export const deleteHistoryDoc = async (userId: string, docId: string) => {
  const docPath = `users/${userId}/savedItems/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'savedItems', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
};
