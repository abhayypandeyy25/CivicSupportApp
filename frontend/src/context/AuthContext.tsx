import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '../config/firebase';
import {
  User,
  onAuthStateChanged,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  ConfirmationResult,
  RecaptchaVerifier,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  sendOTP: (phoneNumber: string) => Promise<ConfirmationResult | null>;
  verifyOTP: (confirmationResult: ConfirmationResult, code: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
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

    return unsubscribe;
  }, []);

  const sendOTP = async (phoneNumber: string): Promise<ConfirmationResult | null> => {
    try {
      if (Platform.OS === 'web') {
        // For web, we need RecaptchaVerifier
        const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
        return confirmationResult;
      }
      // For native, Firebase handles verification differently
      // This is a simplified version - in production you'd use expo-firebase-recaptcha
      return null;
    } catch (error) {
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
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        return !!result.user;
      }
      // For native, we'll handle this differently
      return false;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      return false;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      await AsyncStorage.removeItem('userToken');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshToken = async (): Promise<string | null> => {
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
        sendOTP,
        verifyOTP,
        signInWithGoogle,
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
