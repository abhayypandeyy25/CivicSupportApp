import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, isDemoMode } from '../config/firebase';
import {
  User,
  onAuthStateChanged,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  ConfirmationResult,
  RecaptchaVerifier,
  ApplicationVerifier,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Demo user for testing without Firebase
const DEMO_USER = {
  uid: 'demo-user-123',
  email: 'demo@civicsense.local',
  displayName: 'Demo User',
  phoneNumber: '+1234567890',
  photoURL: null,
  emailVerified: true,
  getIdToken: async () => 'demo-token-for-local-testing',
  getIdTokenResult: async () => ({ token: 'demo-token-for-local-testing', claims: {} }),
} as unknown as User;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  isDemoMode: boolean;
  sendOTP: (phoneNumber: string, recaptchaVerifier: ApplicationVerifier) => Promise<ConfirmationResult | null>;
  verifyOTP: (confirmationResult: ConfirmationResult, code: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signInDemo: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Demo mode sign-in for local testing
  const signInDemo = async (): Promise<boolean> => {
    try {
      setUser(DEMO_USER);
      setToken('demo-token-for-local-testing');
      await AsyncStorage.setItem('demoLoggedIn', 'true');
      await AsyncStorage.setItem('userToken', 'demo-token-for-local-testing');
      console.log('Demo sign-in successful');
      return true;
    } catch (error) {
      console.error('Error in demo sign-in:', error);
      return false;
    }
  };

  useEffect(() => {
    // In demo mode, check for stored demo session
    if (isDemoMode) {
      AsyncStorage.getItem('demoLoggedIn').then((value) => {
        if (value === 'true') {
          setUser(DEMO_USER);
          setToken('demo-token-for-local-testing');
        }
        setLoading(false);
      });
      return;
    }

    // Normal Firebase auth flow
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const idToken = await user.getIdToken();
        setToken(idToken);
        await AsyncStorage.setItem('userToken', idToken);
      } else {
        setToken(null);
        await AsyncStorage.removeItem('userToken');
      }
      setLoading(false);
    });

    // Check for redirect result on web
    if (Platform.OS === 'web') {
      getRedirectResult(auth).then((result) => {
        if (result?.user) {
          console.log('Redirect sign-in successful');
        }
      }).catch((error) => {
        console.error('Redirect error:', error);
      });
    }

    return unsubscribe;
  }, []);

  const sendOTP = async (phoneNumber: string, recaptchaVerifier: ApplicationVerifier): Promise<ConfirmationResult | null> => {
    // In demo mode, return a mock confirmation result
    if (isDemoMode) {
      console.log('Demo mode: Simulating OTP send to', phoneNumber);
      return {
        confirm: async (code: string) => {
          if (code === '123456') {
            await signInDemo();
            return { user: DEMO_USER };
          }
          throw new Error('Invalid OTP');
        },
        verificationId: 'demo-verification-id',
      } as unknown as ConfirmationResult;
    }

    try {
      if (!auth) throw new Error('Firebase not initialized');
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      return confirmationResult;
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      throw error;
    }
  };

  const verifyOTP = async (confirmationResult: ConfirmationResult, code: string): Promise<boolean> => {
    try {
      const result = await confirmationResult.confirm(code);
      return !!result.user;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return false;
    }
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    // In demo mode, use demo sign-in
    if (isDemoMode) {
      return signInDemo();
    }

    try {
      if (Platform.OS === 'web' && auth) {
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');

        try {
          // Try popup first
          const result = await signInWithPopup(auth, provider);
          return !!result.user;
        } catch (popupError: any) {
          // If popup blocked, try redirect
          if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
            await signInWithRedirect(auth, provider);
            return true; // Will redirect, so return true
          }
          throw popupError;
        }
      }
      return false;
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      if (isDemoMode) {
        setUser(null);
        setToken(null);
        await AsyncStorage.removeItem('demoLoggedIn');
        await AsyncStorage.removeItem('userToken');
        return;
      }

      if (auth) {
        await firebaseSignOut(auth);
      }
      await AsyncStorage.removeItem('userToken');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshToken = async (): Promise<string | null> => {
    if (isDemoMode) {
      return 'demo-token-for-local-testing';
    }

    if (user) {
      const newToken = await user.getIdToken(true);
      setToken(newToken);
      await AsyncStorage.setItem('userToken', newToken);
      return newToken;
    }
    return null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        isDemoMode,
        sendOTP,
        verifyOTP,
        signInWithGoogle,
        signInDemo,
        signOut,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
