import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence, connectAuthEmulator } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Check if running in demo mode (no Firebase credentials)
const DEMO_MODE = !process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
                  process.env.EXPO_PUBLIC_FIREBASE_API_KEY === 'demo';

const firebaseConfig = DEMO_MODE ? {
  // Demo/development config - uses Firebase emulator or mock
  apiKey: 'demo-api-key-for-local-testing',
  authDomain: 'localhost',
  projectId: 'demo-civicsense',
  storageBucket: 'demo-civicsense.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
} : {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Export demo mode flag for other components to check
export const isDemoMode = DEMO_MODE;

// Initialize Firebase
let app: any = null;
let auth: any = null;

if (!DEMO_MODE) {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  // Initialize Auth with persistence
  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    } catch (error) {
      auth = getAuth(app);
    }
  }
}

export { app, auth };
export default app;
