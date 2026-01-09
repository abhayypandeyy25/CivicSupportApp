import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../../src/config/firebase';

export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const router = useRouter();
  const { verifyOTP, signInWithGoogle, user } = useAuth();

  // Initialize reCAPTCHA on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      setupRecaptcha();
    }
    
    return () => {
      // Cleanup on unmount
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, []);

  const setupRecaptcha = () => {
    try {
      // Clear any existing recaptcha
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }

      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'normal', // Use normal size so user can see and interact with it
        callback: (response: any) => {
          console.log('reCAPTCHA verified!');
          setRecaptchaReady(true);
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
          setRecaptchaReady(false);
          Alert.alert('Verification Expired', 'Please complete the verification again.');
        }
      });

      verifier.render().then(() => {
        console.log('reCAPTCHA rendered');
        setRecaptchaVerifier(verifier);
      }).catch((error) => {
        console.error('reCAPTCHA render error:', error);
      });
    } catch (error) {
      console.error('Error setting up reCAPTCHA:', error);
    }
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user]);

  const handleSendOTP = async () => {
    if (phoneNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    if (Platform.OS !== 'web') {
      Alert.alert(
        'Mobile App',
        'For the mobile app, please use "Continue as Demo User" or "Google Sign-In". Phone OTP works best on web browser.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!recaptchaReady) {
      Alert.alert('Verification Required', 'Please complete the "I\'m not a robot" verification first, then click Send OTP.');
      return;
    }

    if (!recaptchaVerifier) {
      Alert.alert('Error', 'Verification not loaded. Please refresh the page.');
      return;
    }

    setLoading(true);
    try {
      const formattedNumber = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
      console.log('Sending OTP to:', formattedNumber);
      
      const result = await signInWithPhoneNumber(auth, formattedNumber, recaptchaVerifier);
      setConfirmationResult(result);
      setStep('otp');
      Alert.alert('OTP Sent', `OTP has been sent to ${formattedNumber}. Please check your SMS.`);
    } catch (error: any) {
      console.error('OTP Error:', error);
      let errorMessage = 'Failed to send OTP. Please try again.';
      
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format. Please enter a valid Indian mobile number.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again after some time.';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please try again later or use Google Sign-In.';
      } else if (error.code === 'auth/captcha-check-failed') {
        errorMessage = 'Verification failed. Please complete the reCAPTCHA again.';
        setRecaptchaReady(false);
        setupRecaptcha();
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    if (!confirmationResult) {
      Alert.alert('Error', 'Please request OTP first');
      return;
    }

    setLoading(true);
    try {
      const success = await verifyOTP(confirmationResult, otp);
      if (success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Invalid OTP. Please check and try again.');
      }
    } catch (error: any) {
      console.error('Verify OTP Error:', error);
      let errorMessage = 'Failed to verify OTP.';
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid OTP. Please check the code and try again.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'OTP has expired. Please request a new one.';
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const success = await signInWithGoogle();
      if (success) {
        setTimeout(() => {
          if (!user) {
            setLoading(false);
          }
        }, 5000);
      } else {
        Alert.alert(
          'Info',
          'Google Sign-In requires a web browser. Please use the web version or Demo User.',
          [{ text: 'OK' }]
        );
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      let errorMessage = 'Failed to sign in with Google.';
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in cancelled. Please try again.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked. Please allow popups and try again.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'Domain not authorized in Firebase. Please contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    router.replace('/(tabs)');
  };

  const handleChangeNumber = () => {
    setStep('phone');
    setOtp('');
    setConfirmationResult(null);
    setRecaptchaReady(false);
    setupRecaptcha();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo/Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="megaphone" size={48} color="#FF5722" />
            </View>
            <Text style={styles.title}>CivicSense</Text>
            <Text style={styles.subtitle}>
              Report civic issues in your area
            </Text>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            {step === 'phone' ? (
              <>
                <Text style={styles.label}>Enter your mobile number</Text>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="9876543210"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                  />
                </View>

                {/* reCAPTCHA Container - Visible */}
                {Platform.OS === 'web' && (
                  <View style={styles.recaptchaWrapper}>
                    <Text style={styles.recaptchaLabel}>
                      {recaptchaReady ? '✓ Verified! Now click Send OTP' : 'Complete verification below:'}
                    </Text>
                    <View nativeID="recaptcha-container" style={styles.recaptchaBox} />
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.button, 
                    (loading || (Platform.OS === 'web' && !recaptchaReady)) && styles.buttonDisabled
                  ]}
                  onPress={handleSendOTP}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Enter OTP sent to +91{phoneNumber}</Text>
                <TextInput
                  style={styles.otpInput}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleVerifyOTP}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify OTP</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={handleChangeNumber}
                >
                  <Text style={styles.resendText}>Change Number</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.googleButton, loading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#fff" />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Demo Login */}
            <TouchableOpacity
              style={styles.demoButton}
              onPress={handleDemoLogin}
            >
              <Ionicons name="play-circle-outline" size={20} color="#FF5722" />
              <Text style={styles.demoButtonText}>Continue as Demo User</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to our Terms of Service
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    fontWeight: '500',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  countryCode: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
    marginRight: 10,
  },
  countryCodeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    color: '#333',
  },
  recaptchaWrapper: {
    marginBottom: 16,
    alignItems: 'center',
  },
  recaptchaLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  recaptchaBox: {
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpInput: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    fontSize: 20,
    color: '#333',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#FF5722',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#FFB299',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendText: {
    color: '#FF5722',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    color: '#999',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  demoButton: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FF5722',
  },
  demoButtonText: {
    color: '#FF5722',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
