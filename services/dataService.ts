import { 
    User, Transaction, BudgetCategory, Investment, Goal, Insurance, Loan, Subscription, TransactionType
} from '../types';
import { safeStorage } from './storage';
import { setAITokenProvider } from './api';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  initializeAuth,
  browserLocalPersistence,
  inMemoryPersistence,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where,
  addDoc,
  getDocFromServer
} from "firebase/firestore";
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Bulletproof Auth Initialization to prevent iframe and sandbox Security errors
let auth: ReturnType<typeof getAuth>;
try {
  let isIframe = false;
  try {
    isIframe = window.self !== window.top;
  } catch (e) {
    isIframe = true;
  }

  let isStorageAccessible = false;
  try {
    const test = window.localStorage;
    if (test && !isIframe) {
      isStorageAccessible = true;
    }
  } catch (e) {
    isStorageAccessible = false;
  }

  if (isStorageAccessible) {
    console.log("Initializing Firebase Auth with standard [browserLocalPersistence, inMemoryPersistence]...");
    auth = initializeAuth(app, {
      persistence: [browserLocalPersistence, inMemoryPersistence]
    });
  } else {
    console.warn("Initializing Firebase Auth with safe in-memory persistence (Iframe / Blocked storage context)...");
    auth = initializeAuth(app, {
      persistence: inMemoryPersistence
    });
  }
} catch (error) {
  console.warn("Explicit auth initialization failed, falling back to default getAuth:", error);
  auth = getAuth(app);
  setAITokenProvider(async () => (auth.currentUser ? auth.currentUser.getIdToken() : null));
}

export { auth };
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// CRITICAL CONSTRAINT: Test connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
// Delay test connection to let critical auth/loading happen first
setTimeout(() => {
    testConnection();
}, 2000);

// Error handler helper
interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

const handleFirestoreError = (error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null) => {
  if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
    const user = auth.currentUser;
    const errorInfo: FirestoreErrorInfo = {
      error: error.message,
      operationType,
      path,
      authInfo: user ? {
        userId: user.uid,
        email: user.email || '',
        emailVerified: user.emailVerified,
        isAnonymous: user.isAnonymous,
        providerInfo: user.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || ''
        }))
      } : {
        userId: 'unauthenticated',
        email: '',
        emailVerified: false,
        isAnonymous: true,
        providerInfo: []
      }
    };
    throw new Error(JSON.stringify(errorInfo));
  }
  throw error;
};

// --- Auth Operations ---

let guestUser: User | null = null;

export const setGuestMode = (active: boolean) => {
    if (active) {
        guestUser = {
            id: 'guest-mode',
            email: 'guest@wealth.os',
            displayName: 'Guest Pilot',
            isGuest: true
        };
        safeStorage.setItem('is_guest', 'true');
    } else {
        guestUser = null;
        safeStorage.removeItem('is_guest');
    }
};

export const checkStorageAccess = (): boolean => {
    try {
        safeStorage.setItem('test_auth_integrity', 'ok');
        safeStorage.removeItem('test_auth_integrity');
        return true;
    } catch (e) {
        console.warn("Storage Access Warning: Session persistence might be impacted by browser settings.");
        return false;
    }
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
    checkStorageAccess();
    
    // Check if guest mode was active previously
    if (safeStorage.getItem('is_guest') === 'true') {
        guestUser = {
            id: 'guest-mode',
            email: 'guest@wealth.os',
            displayName: 'Guest Pilot',
            isGuest: true
        };
        setTimeout(() => callback(guestUser), 0);
    }

    return onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
            guestUser = null; // Exit guest mode if real user signs in
            safeStorage.removeItem('is_guest');
            callback({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User'
            });
        } else if (!guestUser) {
            callback(null);
        }
    });
};

export const registerUser = async (email: string, pass: string, name: string): Promise<User> => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    try {
        await sendEmailVerification(cred.user);
    } catch (ve) {
        console.error("Verification email failed to send on signup:", ve);
        // We don't throw here so the user is still registered
    }
    return {
        id: cred.user.uid,
        email: cred.user.email || '',
        displayName: name
    };
};

export const loginUser = async (email: string, pass: string): Promise<User> => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return {
        id: cred.user.uid,
        email: cred.user.email || '',
        displayName: cred.user.displayName || email.split('@')[0]
    };
};

export const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
};

export const logoutUser = async () => {
    const isGuest = guestUser !== null || safeStorage.getItem('is_guest') === 'true';
    guestUser = null;
    safeStorage.removeItem('is_guest');
    await signOut(auth);
    if (isGuest) {
        window.location.reload();
    }
};

export const resendVerificationEmail = async () => {
    const user = auth.currentUser;
    if (user) {
        await sendEmailVerification(user);
    } else {
        throw new Error("No user logged in");
    }
};

export const checkEmailVerificationStatus = async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (user) {
        await user.reload();
        return user.emailVerified;
    }
    return false;
};

export const getCurrentUser = (): User | null => {
    if (guestUser) return guestUser;
    const u = auth.currentUser;
    if (!u) return null;
    return { id: u.uid, email: u.email || '', displayName: u.displayName || 'User' };
};

// --- Firestore Helpers ---

const clean = (obj: any) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
        if (newObj[key] === undefined) {
            delete newObj[key];
        } else if (newObj[key] && typeof newObj[key] === 'object' && !Array.isArray(newObj[key])) {
            newObj[key] = clean(newObj[key]);
        }
    });
    return newObj;
};

const getCollectionRef = (collectionName: string) => {
    const user = getCurrentUser();
    if (!user) throw new Error("User not authenticated");
    return collection(db, `users/${user.id}/${collectionName}`);
};

const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];

const MOCK_GUEST_DATA: Record<string, any[]> = {
    investments: [
        { id: 'm1', name: 'Nifty 50 Index Fund', type: 'Mutual Fund', investedAmount: 120000, currentValue: 145000, purchaseDate: daysFromNow(-900), lastUpdated: new Date().toISOString(), annualizedReturn: 18.2, benchmarkName: 'Nifty 50' },
        { id: 'm2', name: 'Reliance Industries', type: 'Stock', investedAmount: 50000, currentValue: 62000, purchaseDate: daysFromNow(-500), lastUpdated: new Date().toISOString(), annualizedReturn: 22.1, benchmarkName: 'Nifty 50' },
        { id: 'm3', name: 'Digital Gold (MCX)', type: 'Gold', investedAmount: 10000, currentValue: 11200, purchaseDate: daysFromNow(-300), lastUpdated: new Date().toISOString(), annualizedReturn: 12.0, benchmarkName: 'Gold (MCX)' },
    ],
    budgets: [
        { id: 'b1', name: 'Lifestyle', allocated: 20000, spent: 14500, type: 'Want' },
        { id: 'b2', name: 'Rent & Utilities', allocated: 35000, spent: 35000, type: 'Need' },
        { id: 'b3', name: 'Wealth Building', allocated: 15000, spent: 15000, type: 'Saving' },
    ],
    transactions: [
        { id: 't1', amount: 850, category: 'Food', description: 'Coffee', merchant: 'Starbucks', date: new Date().toISOString(), type: TransactionType.EXPENSE, classification: 'Want' },
        { id: 't2', amount: 1200, category: 'Shopping', description: 'Online order', merchant: 'Amazon', date: new Date().toISOString(), type: TransactionType.EXPENSE, classification: 'Want' },
        { id: 't3', amount: 3500, category: 'Utilities', description: 'Mobile recharge', merchant: 'Airtel', date: new Date().toISOString(), type: TransactionType.EXPENSE, classification: 'Need' },
    ],
    loans: [
        { id: 'l1', name: 'Car Loan', principal: 800000, outstanding: 450000, interestRate: 8.5, tenureMonths: 60, startDate: '2023-01-10' }
    ],
    insurance: [
        { id: 'i1', name: 'Family Floater', type: 'Health', sumInsured: 1000000, premium: 18000, premiumFrequency: 'Yearly', renewDate: daysFromNow(120), provider: 'HDFC Ergo' }
    ],
    goals: [
        { id: 'g1', name: 'Early Retirement', category: 'Retirement', targetAmount: 50000000, targetDate: '2040-01-01', currentAmount: 145000 }
    ],
    subscriptions: [
        { id: 's1', name: 'Netflix', amount: 649, cycle: 'Monthly', nextDueDate: daysFromNow(9), category: 'Entertainment' }
    ]
};

const getData = async <T>(collectionName: string): Promise<T[]> => {
    const user = getCurrentUser();
    if (user?.isGuest) {
        return (MOCK_GUEST_DATA[collectionName] || []) as T[];
    }
    try {
        const colRef = getCollectionRef(collectionName);
        const snapshot = await getDocs(colRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (e) {
        handleFirestoreError(e, 'list', collectionName);
        return [];
    }
};

const saveData = async (collectionName: string, data: any) => {
    const user = getCurrentUser();
    if (user?.isGuest) {
        console.log("Guest Write Intercepted:", collectionName, data);
        return;
    }
    try {
        const colRef = getCollectionRef(collectionName);
        const cleanedData = clean(data);
        if (data.id) {
            // Update or Set specific ID
            await setDoc(doc(colRef, data.id), cleanedData);
        } else {
            // Add new
            await addDoc(colRef, cleanedData);
        }
    } catch (e) {
        handleFirestoreError(e, data.id ? 'update' : 'create', collectionName);
    }
};

const deleteData = async (collectionName: string, id: string) => {
    const user = getCurrentUser();
    if (user?.isGuest) return;
    try {
        const colRef = getCollectionRef(collectionName);
        await deleteDoc(doc(colRef, id));
    } catch (e) {
        handleFirestoreError(e, 'delete', `${collectionName}/${id}`);
    }
};

// --- Data Operations (Async now) ---

export const getTransactions = async (): Promise<Transaction[]> => {
    return getData<Transaction>('transactions');
};

export const addTransaction = async (t: Omit<Transaction, 'id'>) => {
    try {
        const colRef = getCollectionRef('transactions');
        const newDocRef = doc(colRef);
        const newItem = clean({ ...t, id: newDocRef.id });
        await setDoc(newDocRef, newItem);

        if (t.type === TransactionType.EXPENSE) {
            await updateBudgetSpent(t.category, t.amount, t.classification);
        }
        return newItem;
    } catch (e) {
        handleFirestoreError(e, 'create', 'transactions');
    }
};

export const getBudgets = async (): Promise<BudgetCategory[]> => {
    const budgets = await getData<BudgetCategory>('budgets');
    // If empty (new user), maybe seed some defaults?
    if (budgets.length === 0) return [];
    return budgets;
};

export const saveBudget = async (b: BudgetCategory) => {
    await saveData('budgets', b);
};

export const deleteBudget = async (id: string) => {
    await deleteData('budgets', id);
};

const updateBudgetSpent = async (category: string, amount: number, classification?: 'Need' | 'Want' | 'Saving') => {
    try {
        const budgets = await getBudgets();
        // Priority 1: Match exactly by category name
        let budget = budgets.find(b => b.name === category);
        
        // Priority 2: If no category match, match by classification (50/30/20 rule)
        if (!budget && classification) {
            budget = budgets.find(b => b.type === classification);
        }
        
        if (budget) {
            await saveBudget({ ...budget, spent: budget.spent + amount });
        }
    } catch (e) {
        console.error("Error updating budget spent", e);
    }
};

export const getSubscriptions = async (): Promise<Subscription[]> => getData<Subscription>('subscriptions');
export const saveSubscription = async (s: Omit<Subscription, 'id'> & { id?: string }) => {
    if(!s.id) {
        const colRef = getCollectionRef('subscriptions');
        const newRef = doc(colRef);
        await setDoc(newRef, clean({ ...s, id: newRef.id }));
    } else {
        await saveData('subscriptions', s);
    }
};
export const deleteSubscription = async (id: string) => deleteData('subscriptions', id);

export const getInvestments = async (): Promise<Investment[]> => getData<Investment>('investments');
export const saveInvestment = async (i: Omit<Investment, 'id'> & { id?: string }) => {
     if(!i.id) {
        const colRef = getCollectionRef('investments');
        const newRef = doc(colRef);
        await setDoc(newRef, clean({ ...i, id: newRef.id }));
    } else {
        await saveData('investments', i);
    }
};
export const deleteInvestment = async (id: string) => deleteData('investments', id);

export const getGoals = async (): Promise<Goal[]> => {
    const goals = await getData<Goal>('goals');
    const investments = await getInvestments(); // Fetch fresh investments to calc progress
    return goals.map(g => {
        const linkedVal = investments.filter(i => i.goalId === g.id).reduce((sum, inv) => sum + inv.currentValue, 0);
        return { ...g, currentAmount: linkedVal };
    });
};
export const saveGoal = async (g: Omit<Goal, 'id'> & { id?: string }) => {
    if(!g.id) {
        const colRef = getCollectionRef('goals');
        const newRef = doc(colRef);
        await setDoc(newRef, clean({ ...g, id: newRef.id }));
    } else {
        await saveData('goals', g);
    }
};
export const deleteGoal = async (id: string) => deleteData('goals', id);

export const getLoans = async (): Promise<Loan[]> => getData<Loan>('loans');
export const saveLoan = async (l: Omit<Loan, 'id'> & { id?: string }) => {
     if(!l.id) {
        const colRef = getCollectionRef('loans');
        const newRef = doc(colRef);
        await setDoc(newRef, clean({ ...l, id: newRef.id }));
     } else {
        await saveData('loans', l);
    }
};
export const deleteLoan = async (id: string) => deleteData('loans', id);

export const getInsurance = async (): Promise<Insurance[]> => getData<Insurance>('insurance');
export const saveInsurance = async (i: Omit<Insurance, 'id'> & { id?: string }) => {
    if(!i.id) {
        const colRef = getCollectionRef('insurance');
        const newRef = doc(colRef);
        await setDoc(newRef, clean({ ...i, id: newRef.id }));
    } else {
        await saveData('insurance', i);
    }
};
export const deleteInsurance = async (id: string) => deleteData('insurance', id);

// --- Analytics & Telemetry ---

export const trackAppEvent = async (eventName: string, params: Record<string, any> = {}) => {
    try {
        const user = getCurrentUser();
        if (user?.isGuest) return;
        const analyticsRef = collection(db, 'analytics_events');
        await addDoc(analyticsRef, {
            eventName,
            ...params,
            userId: user?.id || 'anonymous',
            userEmail: user?.email || 'anonymous',
            timestamp: new Date().toISOString(),
            platform: 'web',
            userAgent: navigator.userAgent
        });
    } catch (e) {
        // Silent fail for analytics to not break user flow
        console.warn("Analytics log failed:", e);
    }
};

export const getGlobalAnalytics = async () => {
    try {
        const analyticsRef = collection(db, 'analytics_events');
    const analyticsSnapshot = await getDocs(analyticsRef);
    const events = analyticsSnapshot.docs.map(doc => doc.data());
    
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    const totalUsers = usersSnapshot.size;
    
    // Basic aggregations
    const totalHits = events.length;
    const uniqueUsers = new Set(events.map(e => e.userId)).size;
    
    const featureUsage: Record<string, number> = {};
    events.forEach(e => {
        if (e && typeof e.eventName === 'string' && e.eventName.startsWith('view_')) {
            const feature = e.eventName.replace('view_', '');
            featureUsage[feature] = (featureUsage[feature] || 0) + 1;
        }
    });

    return {
        totalHits,
        uniqueUsers,
        totalUsers,
        featureUsage
    };
} catch (e: any) {
    console.error("Global analytics fetch failed", e);
    
    // Check if it's a permission error to give better feedback to admin
    const isPermissionError = e.code === 'permission-denied' || e.message?.includes('Missing or insufficient permissions');
    
    return {
        totalHits: 0,
        uniqueUsers: 0,
        totalUsers: 0,
        featureUsage: {},
        error: isPermissionError ? "PERMISSION_DENIED" : "FETCH_ERROR"
    };
}
};

import { getMFSchemeDetails } from './mfapiService';

export const syncInvestmentPrices = async (): Promise<{ updated: number; skipped: number }> => {
    const investments = await getInvestments();
    // Only mutual funds with a scheme code can be refreshed (free AMFI NAV data via MFAPI).
    // Stocks, gold, crypto, FDs etc. have no reliable free price feed here, so the user keeps them up to date by hand.
    const targets = investments.filter(inv => inv.type === 'Mutual Fund' && inv.mfSchemeCode && inv.units);
    let updated = 0;
    await Promise.all(targets.map(async (inv) => {
        try {
            const details = await getMFSchemeDetails(inv.mfSchemeCode!);
            const nav = details && details.data.length > 0 ? parseFloat(details.data[0].nav) : NaN;
            if (isFinite(nav) && nav > 0) {
                await saveInvestment({ ...inv, currentValue: inv.units! * nav, lastUpdated: new Date().toISOString() });
                updated++;
            }
        } catch (e) {
            console.error(`Failed to sync MF ${inv.name}:`, e);
        }
    }));
    return { updated, skipped: investments.length - updated };
};
