import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, getFirestore, type Firestore } from 'firebase/firestore';
// @ts-expect-error getReactNativePersistence exists at runtime but is missing from TS declarations
import { initializeAuth, getReactNativePersistence, getAuth, type Auth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBXmbb6enSevC8eSbEDcJJZmSan90JWYoc",
  authDomain: "holyguard-app.firebaseapp.com",
  projectId: "holyguard-app",
  storageBucket: "holyguard-app.firebasestorage.app",
  messagingSenderId: "1074509187586",
  appId: "1:1074509187586:web:57bc9dbfaf35957d52b51b",
  measurementId: "G-0F46BXBZL6"
};

// Initialize Firebase (guard against double initialization in dev hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth with persistence (use existing if already initialized)
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (error: any) {
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw error;
  }
}

// Initialize Firestore with network-only mode
let db: Firestore;
try {
  db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false,
  });
} catch (error: any) {
  if (error.code === 'failed-precondition') {
    db = getFirestore(app);
  } else {
    throw error;
  }
}

// Force enable network
import { enableNetwork } from 'firebase/firestore';
enableNetwork(db).catch(err => console.error('Failed to enable Firestore network:', err));

export { auth, db, app };
export const storage = getStorage(app);
