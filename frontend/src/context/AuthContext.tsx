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
  signInWithRedirect,
  getRedirectResult,
  ConfirmationResult,
  RecaptchaVerifier,
  ApplicationVerifier,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  sendOTP: (phoneNumber: string, recaptchaVerifier: ApplicationVerifier) => Promise<ConfirmationResult | null>;
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
    try {
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
    try {
      if (Platform.OS === 'web') {
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
