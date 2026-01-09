import React, { useState, useEffect } from 'react';
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
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const router = useRouter();
  const { verifyOTP, signInWithGoogle, user } = useAuth();

  // Initialize reCAPTCHA on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      setupRecaptcha();
    }
  }, []);

  const setupRecaptcha = () => {
    try {
      // Clear any existing recaptcha
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }

      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'normal',
        callback: (response: any) => {
          console.log('reCAPTCHA verified successfully!', response);
          setStatusMessage('✓ Verification complete! Click Send OTP');
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
          setStatusMessage('Verification expired. Please try again.');
        }
      });

      verifier.render().then((widgetId) => {
        console.log('reCAPTCHA rendered with widget ID:', widgetId);
        setRecaptchaVerifier(verifier);
        setStatusMessage('Complete the verification below');
      }).catch((error) => {
        console.error('reCAPTCHA render error:', error);
        setStatusMessage('Failed to load verification. Refresh page.');
      });
    } catch (error: any) {
      console.error('Error setting up reCAPTCHA:', error);
      setStatusMessage('Error: ' + error.message);
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
        'For the mobile app, please use "Continue as Demo User" or "Google Sign-In".',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!recaptchaVerifier) {
      Alert.alert('Error', 'Verification not loaded. Please refresh the page.');
      return;
    }

    setLoading(true);
    setStatusMessage('Sending OTP...');
    
    try {
      const formattedNumber = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
      console.log('Attempting to send OTP to:', formattedNumber);
      
      const result = await signInWithPhoneNumber(auth, formattedNumber, recaptchaVerifier);
      console.log('OTP sent successfully!', result);
      setConfirmationResult(result);
      setStep('otp');
      setStatusMessage('');
      Alert.alert('OTP Sent', `OTP has been sent to ${formattedNumber}. Please check your SMS.`);
    } catch (error: any) {
      console.error('OTP Error:', error.code, error.message);
      let errorMessage = 'Failed to send OTP.';
      
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number. Please enter a valid Indian mobile number.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again after some time.';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please use Google Sign-In instead.';
      } else if (error.code === 'auth/captcha-check-failed') {
        errorMessage = 'Verification failed. Please complete the reCAPTCHA again.';
        setupRecaptcha();
      } else if (error.code === 'auth/missing-phone-number') {
        errorMessage = 'Please enter your phone number.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Phone authentication is not enabled. Please use Google Sign-In or Demo User.';
      } else {
        errorMessage = `Error: ${error.message || error.code || 'Unknown error'}`;
      }
      
      setStatusMessage(errorMessage);
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
      Alert.alert('Error', error.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setStatusMessage('Opening Google Sign-In...');
    try {
      const success = await signInWithGoogle();
      if (success) {
        setStatusMessage('Signing in...');
      } else {
        setStatusMessage('');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      setStatusMessage('');
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    router.replace('/(tabs)');
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
              <Ionicons name="megaphone" size={42} color="#FF5722" />
            </View>
            <Text style={styles.title}>CivicSense</Text>
            <Text style={styles.subtitle}>Report civic issues in your area</Text>
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

                {/* Status Message */}
                {statusMessage ? (
                  <Text style={[styles.statusText, statusMessage.includes('✓') ? styles.successText : styles.infoText]}>
                    {statusMessage}
                  </Text>
                ) : null}

                {/* reCAPTCHA Container */}
                {Platform.OS === 'web' && (
                  <View style={styles.recaptchaWrapper}>
                    <View nativeID="recaptcha-container" style={styles.recaptchaBox} />
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
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
                  placeholder="000000"
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
                  onPress={() => { setStep('phone'); setOtp(''); setConfirmationResult(null); setupRecaptcha(); }}
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
              <Ionicons name="logo-google" size={20} color="#fff" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Demo Login */}
            <TouchableOpacity style={styles.demoButton} onPress={handleDemoLogin}>
              <Ionicons name="play-circle-outline" size={20} color="#FF5722" />
              <Text style={styles.demoButtonText}>Continue as Demo User</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>By continuing, you agree to our Terms of Service</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  header: { alignItems: 'center', marginBottom: 24 },
  logoContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  form: { flex: 1 },
  label: { fontSize: 14, color: '#333', marginBottom: 10, fontWeight: '500' },
  phoneInputContainer: { flexDirection: 'row', marginBottom: 12 },
  countryCode: { backgroundColor: '#f5f5f5', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, marginRight: 10 },
  countryCodeText: { fontSize: 16, color: '#333', fontWeight: '500' },
  phoneInput: { flex: 1, backgroundColor: '#f5f5f5', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 16, color: '#333' },
  statusText: { fontSize: 13, textAlign: 'center', marginBottom: 12, padding: 8, borderRadius: 8 },
  successText: { color: '#4CAF50', backgroundColor: '#E8F5E9' },
  infoText: { color: '#FF5722', backgroundColor: '#FFF3E0' },
  recaptchaWrapper: { marginBottom: 12, alignItems: 'center' },
  recaptchaBox: { minHeight: 78 },
  otpInput: { backgroundColor: '#f5f5f5', paddingHorizontal: 16, paddingVertical: 16, borderRadius: 12, fontSize: 24, color: '#333', textAlign: 'center', letterSpacing: 12, marginBottom: 16 },
  button: { backgroundColor: '#FF5722', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  buttonDisabled: { backgroundColor: '#FFB299' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resendButton: { alignItems: 'center', paddingVertical: 12 },
  resendText: { color: '#FF5722', fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e0e0e0' },
  dividerText: { color: '#999', paddingHorizontal: 16, fontSize: 14 },
  googleButton: { backgroundColor: '#4285F4', paddingVertical: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  googleButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  demoButton: { backgroundColor: '#FFF3E0', paddingVertical: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FF5722' },
  demoButtonText: { color: '#FF5722', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  footer: { marginTop: 16, alignItems: 'center' },
  footerText: { fontSize: 12, color: '#999', textAlign: 'center' },
});
