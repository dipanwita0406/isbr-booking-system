'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle, Loader2, Shield, User as UserIcon, MapPin, Clock, Users, Calendar } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, database } from '../../../firebase-config';
import { ref, set, get, push } from 'firebase/database';
import Navbar from '@/components/navbar';
import Image from 'next/image';

const googleProvider = new GoogleAuthProvider();

export default function Login() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  });
  
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    hasMinLength: false
  });

  const adminEmails = [
    'dipanwita957@gmail.com'
  ];

  // Define helper functions with useCallback FIRST
  const isAdminEmail = useCallback((email) => {
    return adminEmails.includes(email.toLowerCase());
  }, [adminEmails]);

  // Safe navigation helper
  const safeNavigate = useCallback((path, delay = 1000) => {
    try {
      setTimeout(() => {
        router.push(path);
      }, delay);
    } catch (error) {
      console.warn('Navigation error:', error);
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = path;
        }
      }, delay + 500);
    }
  }, [router]);

  const storeUserInFirebase = useCallback(async (user, isNewUser = false, additionalData = {}) => {
    try {
      const isAdmin = isAdminEmail(user.email);
      const userRef = ref(database, `users/${user.uid}`);
      
      let userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || additionalData.fullName || user.email.split('@')[0],
        photoURL: user.photoURL || '',
        role: isAdmin ? 'admin' : 'user',
        lastLogin: new Date().toISOString(),
        ...additionalData
      };

      if (isNewUser) {
        userData.createdAt = new Date().toISOString();
      }

      try {
        const existingUser = await get(userRef);
        if (!existingUser.exists() || isNewUser) {
          await set(userRef, userData);
        } else {
          const existingData = existingUser.val();
          userData = { ...existingData, lastLogin: new Date().toISOString() };
          await set(userRef, userData);
        }
        
        console.log('User data stored successfully:', userData);
        return userData;
      } catch (databaseError) {
        console.error('Database storage error:', databaseError);
        
        try {
          const fallbackRef = ref(database, `user_logs`);
          await push(fallbackRef, {
            uid: user.uid,
            email: user.email,
            timestamp: new Date().toISOString(),
            action: isNewUser ? 'signup' : 'login',
            error: databaseError.message
          });
          console.log('Fallback log created');
        } catch (fallbackError) {
          console.error('Fallback storage also failed:', fallbackError);
        }

        return userData;
      }
    } catch (error) {
      console.error('Error in storeUserInFirebase:', error);
      
      const isAdmin = isAdminEmail(user.email);
      return {
        uid: user.uid,
        email: user.email,
        role: isAdmin ? 'admin' : 'user',
        displayName: user.displayName || additionalData.fullName || user.email.split('@')[0]
      };
    }
  }, [isAdminEmail]);

  const handleUserAfterAuth = useCallback(async (user, isNewUser = false, additionalData = {}) => {
    try {
      const userData = await storeUserInFirebase(user, isNewUser, additionalData);
      
      const expectedRole = isAdminEmail(user.email) ? 'admin' : 'user';
      const selectedRole = userType === 'admin' ? 'admin' : 'user';
      
      if (expectedRole !== selectedRole) {
        setLoading(false);
        if (isLogin) {
          if (expectedRole === 'admin') {
            setErrors({ general: 'This is an admin account. Please use the Admin login option.' });
          } else {
            setErrors({ general: 'This account is not authorized for admin access. Please use Student/Staff login.' });
          }
        } else {
          if (expectedRole === 'admin') {
            setErrors({ general: 'This email has admin privileges. Please select Admin account type to proceed.' });
          } else {
            setErrors({ general: 'This email is not authorized for admin access. Please select Student/Staff account type.' });
          }
        }
        return;
      }
      
      setLoading(false);
      if (userData.role === 'admin') {
        safeNavigate('/admin-management', 1500);
      } else {
        safeNavigate('/bookings', 1500);
      }
    } catch (error) {
      console.error('Error handling user after auth:', error);
      setLoading(false);
      
      setErrors({ general: 'Login successful, but there was an issue saving your data. Redirecting...' });
      
      const isAdmin = isAdminEmail(user.email);
      safeNavigate(isAdmin ? '/admin-management' : '/bookings', 2000);
    }
  }, [storeUserInFirebase, safeNavigate, isAdminEmail, userType, isLogin]);

  // Define handleExistingUser with useCallback BEFORE useEffect
  const handleExistingUser = useCallback(async (user) => {
    try {
      const userData = await storeUserInFirebase(user, false);
      
      if (userData.role === 'admin') {
        safeNavigate('/admin-management');
      } else {
        safeNavigate('/bookings');
      }
    } catch (error) {
      console.error('Error handling existing user:', error);
      const isAdmin = isAdminEmail(user.email);
      safeNavigate(isAdmin ? '/admin-management' : '/bookings');
    }
  }, [storeUserInFirebase, safeNavigate, isAdminEmail]);

  // NOW useEffect can safely reference handleExistingUser
  useEffect(() => {
    setMounted(true);
    
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user && !loading) {
          handleExistingUser(user);
        }
      });

      return () => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('Error unsubscribing from auth state:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up auth state listener:', error);
    }
  }, [handleExistingUser, loading]);

  useEffect(() => {
    if (!isLogin && formData.password) {
      setPasswordStrength({
        hasUppercase: /[A-Z]/.test(formData.password),
        hasLowercase: /[a-z]/.test(formData.password),
        hasNumber: /\d/.test(formData.password),
        hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
        hasMinLength: formData.password.length >= 8
      });
    }
  }, [formData.password, isLogin]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (userType === 'admin' && !isAdminEmail(formData.email)) {
      if (isLogin) {
        newErrors.email = 'This email is not authorized for admin access. Please use a valid admin email or switch to Student/Staff login.';
      } else {
        newErrors.email = 'Only authorized ISBR admin email addresses can create admin accounts. Please use Student/Staff signup or contact IT support.';
      }
    }
    
    if (userType === 'user' && isAdminEmail(formData.email)) {
      if (isLogin) {
        newErrors.email = 'This is an admin email. Please use the Admin login option.';
      } else {
        newErrors.email = 'This is an authorized admin email. Please select Admin account type to proceed.';
      }
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    if (!isLogin) {
      if (!formData.fullName.trim()) {
        newErrors.fullName = 'Full name is required';
      }
      
      const { hasUppercase, hasLowercase, hasNumber, hasSpecialChar, hasMinLength } = passwordStrength;
      
      if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar || !hasMinLength) {
        newErrors.password = 'Password must meet all requirements listed below';
      }
      
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setErrors({});
    
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        await handleUserAfterAuth(userCredential.user, false, { selectedUserType: userType });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await handleUserAfterAuth(userCredential.user, true, { fullName: formData.fullName, selectedUserType: userType });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      let errorMessage = 'Something went wrong. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account exists with this email address. Please check your email or sign up for a new account.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please check your password and try again.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'An account with this email address already exists. Please try signing in instead.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Please choose a stronger password with at least 6 characters.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed login attempts. Please wait a few minutes before trying again.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection and try again.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled. Please contact support for assistance.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email/password accounts are not enabled. Please contact support.';
          break;
        case 'auth/requires-recent-login':
          errorMessage = 'Please log out and log back in before retrying this operation.';
          break;
        default:
          console.error('Unhandled auth error:', error);
          errorMessage = 'Authentication failed. Please try again or contact support if the problem persists.';
      }
      
      setErrors({ general: errorMessage });
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrors({});
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const isNewUser = result._tokenResponse?.isNewUser || false;
      
      const isAdmin = isAdminEmail(result.user.email);
      const expectedRole = isAdmin ? 'admin' : 'user';
      const selectedRole = userType === 'admin' ? 'admin' : 'user';
      
      if (expectedRole !== selectedRole) {
        setLoading(false);
        if (isLogin) {
          if (expectedRole === 'admin') {
            setErrors({ general: 'This Google account has admin privileges. Please use the Admin login option.' });
          } else {
            setErrors({ general: 'This Google account is not authorized for admin access. Please use Student/Staff login.' });
          }
        } else {
          if (expectedRole === 'admin') {
            setErrors({ general: 'This Google account has admin privileges. Please select Admin account type to proceed.' });
          } else {
            setErrors({ general: 'This Google account is not authorized for admin access. Please select Student/Staff account type.' });
          }
        }
        return;
      }
      
      await handleUserAfterAuth(result.user, isNewUser);
    } catch (error) {
      console.error('Google sign-in error:', error);
      let errorMessage = 'Google sign-in failed. Please try again.';
      
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in was cancelled. Please try again.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection and try again.';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Popup was blocked by your browser. Please allow popups for this site and try again.';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'Sign-in was cancelled. Please try again.';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'An account already exists with this email using a different sign-in method. Please try signing in with email and password.';
          break;
        default:
          console.error('Unhandled Google auth error:', error);
      }
      
      setErrors({ general: errorMessage });
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setErrors({ email: 'Please enter your email address first' });
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setResetEmailSent(true);
      setErrors({});
      console.log('Password reset email sent to:', formData.email);
    } catch (error) {
      console.error('Password reset error:', error);
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address. Please check your email or sign up for a new account.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many password reset requests. Please wait a few minutes before trying again.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection and try again.';
          break;
        default:
          console.error('Unhandled password reset error:', error);
      }
      
      setErrors({ general: errorMessage });
    }
  };

  if (!mounted) return null;

  const PasswordStrengthIndicator = () => (
    <div className="space-y-2 mt-2">
      <div className="text-xs font-medium text-black">
        Password Requirements:
      </div>
      <div className="grid grid-cols-2 gap-1">
        {[
          { key: 'hasMinLength', label: '8+ characters' },
          { key: 'hasUppercase', label: 'Uppercase' },
          { key: 'hasLowercase', label: 'Lowercase' },
          { key: 'hasNumber', label: 'Number' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${
              passwordStrength[key] 
                ? 'bg-yellow-500' 
                : 'bg-gray-300'
            }`} />
            <span className={`text-xs ${
              passwordStrength[key] 
                ? 'text-black'
                : 'text-gray-500'
            }`}>
              {label}
            </span>
          </div>
        ))}
        <div className="flex items-center space-x-1 col-span-2">
          <div className={`w-2 h-2 rounded-full ${
            passwordStrength.hasSpecialChar 
              ? 'bg-yellow-500' 
              : 'bg-gray-300'
          }`} />
          <span className={`text-xs ${
            passwordStrength.hasSpecialChar 
              ? 'text-black'
              : 'text-gray-500'
          }`}>
            Special character (!@#$%^&*)
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <Navbar />
      
      {/* Background Blobs */}
      <div className="absolute top-[-5rem] left-[-5rem] w-72 h-72 z-0 opacity-30">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#7F1D1D"
            d="M60.9,-0.3C60.9,25.5,30.4,51,1.2,51C-27.9,51,-55.9,25.5,-55.9,-0.3C-55.9,-26.1,-27.9,-52.1,1.2,-52.1C30.4,-52.1,60.9,-26.1,60.9,-0.3Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      <div className="absolute bottom-[-6rem] right-[-6rem] w-96 h-96 z-0 opacity-20">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#7F1D1D"
            d="M61,-62.3C75.4,-46.6,81,-23.3,80.1,-0.9C79.3,21.6,72,43.1,57.6,59.7C43.1,76.4,21.6,88,2.2,85.9C-17.3,83.7,-34.5,67.7,-49.9,51.1C-65.3,34.5,-78.9,17.3,-77.7,1.2C-76.5,-14.9,-60.6,-29.7,-45.2,-45.5C-29.7,-61.3,-14.9,-77.9,4.2,-82.1C23.3,-86.3,46.6,-78.1,61,-62.3Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      <div className="absolute top-1/3 left-1/4 w-64 h-64 z-0 opacity-15">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#7F1D1D"
            d="M45.8,-58.1C60.7,-48.7,75.4,-35.2,81.5,-18.3C87.6,-1.4,85.2,18.8,73.9,31.5C62.6,44.2,42.3,49.3,22.9,56.3C3.5,63.3,-15,72.2,-32.7,67.9C-50.4,63.6,-67.2,46.2,-71.9,26.2C-76.6,6.2,-69.1,-16.4,-55.8,-29.9C-42.5,-43.4,-23.3,-47.8,-5.3,-44.9C12.7,-42,25.5,-32,45.8,-58.1Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      <div className="absolute top-2/3 right-1/3 w-48 h-48 z-0 opacity-25">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#7F1D1D"
            d="M35.2,-47.8C44.8,-35.6,50.1,-22.4,52.3,-8.1C54.5,6.2,53.6,21.6,46.8,33.2C40,44.8,27.3,52.6,13.1,55.9C-1.1,59.2,-16.8,57.9,-29.9,51.2C-43,44.5,-53.5,32.4,-58.1,18.7C-62.7,5,-61.4,-10.3,-54.8,-22.8C-48.2,-35.3,-36.3,-45,-22.4,-54.2C-8.5,-63.4,7.4,-72.1,21.8,-67.3C36.2,-62.5,49.1,-44.2,35.2,-47.8Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>
      
      <div className="flex min-h-screen relative z-10">
        {/* Left Side - ISBR Information */}
        <div className="hidden lg:flex lg:w-1/2 bg-white flex-col justify-center px-12 xl:px-16">
          <div className="max-w-md">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-6">
                <Image src="/file.svg" alt="Logo" className="h-10 w-10" width={40} height={40} />
                <div>
                  <h1 className="text-2xl font-bold text-black">ISBR College</h1>
                  <p className="text-gray-600 text-sm">Bangalore</p>
                </div>
              </div>
              
              <h2 className="text-4xl font-bold text-black mb-4 leading-tight">
                Smart Facility
                <span className="text-yellow-500"> Booking</span>
                <br />System
              </h2>
              
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                Streamline your facility reservations with our intelligent booking platform. 
                Book auditoriums, board rooms, and meeting spaces with real-time availability 
                and instant confirmations.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <Clock size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-black">Real-time Availability</h3>
                  <p className="text-gray-600 text-sm">Check room availability instantly and avoid conflicts</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <Users size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-black">Easy Management</h3>
                  <p className="text-gray-600 text-sm">Simple interface for students, staff, and administrators</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <Calendar size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-black">Smart Scheduling</h3>
                  <p className="text-gray-600 text-sm">Advanced scheduling with automatic notifications</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <MapPin size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-black">Multiple Locations</h3>
                  <p className="text-gray-600 text-sm">Book facilities across different campus locations</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-md w-full space-y-8">
            <div className="bg-white rounded-2xl shadow-2xl py-8 px-8 border border-gray-200">
              
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4 lg:hidden">
                  <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center font-bold text-2xl text-white">
                    I
                  </div>
                </div>
                <h2 className="text-3xl font-bold mb-2 text-black">
                  {isLogin ? 'Welcome Back' : 'Join ISBR'}
                </h2>
                <p className="text-sm text-gray-600">
                  {isLogin ? 'Sign in to your account' : 'Create your account'}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold mb-3 text-black">
                  {isLogin ? 'Select Login Type' : 'Select Account Type'}
                </label>
                <div className="flex rounded-lg border border-yellow-500 p-1 bg-yellow-50">
                  <button
                    type="button"
                    onClick={() => setUserType('user')}
                    className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md font-medium transition-all duration-200 ${
                      userType === 'user'
                        ? 'bg-black text-white shadow-sm'
                        : 'text-black hover:bg-yellow-100'
                    }`}
                  >
                    <UserIcon size={18} />
                    <span>Student/Staff</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserType('admin')}
                    className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md font-medium transition-all duration-200 ${
                      userType === 'admin'
                        ? 'bg-black text-white shadow-sm'
                        : 'text-black hover:bg-yellow-100'
                    }`}
                  >
                    <Shield size={18} />
                    <span>Admin</span>
                  </button>
                </div>
                {!isLogin && userType === 'admin' && (
                  <p className="mt-2 text-xs text-black bg-yellow-50 p-2 rounded border border-yellow-500">
                    <strong>Note:</strong> Admin accounts require an authorized ISBR admin email address
                  </p>
                )}
              </div>

              {resetEmailSent && (
                <div className="mb-6 p-4 rounded-lg border bg-yellow-50 border-yellow-500 text-black">
                  <div className="flex items-center space-x-2">
                    <CheckCircle size={20} />
                    <span className="text-sm font-medium">
                      Password reset email sent successfully! Please check your inbox and follow the instructions.
                    </span>
                  </div>
                </div>
              )}

              {errors.general && (
                <div className="mb-6 p-4 rounded-lg border flex items-start space-x-2 bg-red-50 border-red-500 text-red-700">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-medium">{errors.general}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-bold mb-2 text-black">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-medium bg-white text-black focus:border-black focus:ring-yellow-500/20 placeholder-gray-500 ${errors.fullName ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="Enter your full name"
                      />
                    </div>
                    {errors.fullName && (
                      <p className="mt-1 text-sm text-red-500 font-medium">{errors.fullName}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold mb-2 text-black">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-medium bg-white text-black focus:border-black focus:ring-yellow-500/20 placeholder-gray-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="Enter your ISBR email"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-500 font-medium">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-black">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-medium bg-white text-black focus:border-black focus:ring-yellow-500/20 placeholder-gray-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors text-black hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-500 font-medium">{errors.password}</p>
                  )}
                  {!isLogin && formData.password && <PasswordStrengthIndicator />}
                </div>

                {!isLogin && (
                  <div>
                    <label className="block text-sm font-bold mb-2 text-black">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black" />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-medium bg-white text-black focus:border-black focus:ring-yellow-500/20 placeholder-gray-500 ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="Confirm your password"
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-500 font-medium">{errors.confirmPassword}</p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-lg font-bold text-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-black hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="animate-spin h-5 w-5" />
                      <span>{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
                    </div>
                  ) : (
                    <span>
                      {isLogin 
                        ? (userType === 'admin' ? 'Admin Sign In' : 'Sign In to ISBR') 
                        : 'Create ISBR Account'
                      }
                    </span>
                  )}
                </button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 font-bold bg-white text-black">
                      Or continue with
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="mt-4 w-full py-3 px-4 rounded-lg border font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-3 border-gray-300 bg-white text-black hover:bg-gray-50 hover:border-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Sign {isLogin ? 'in' : 'up'} with Google</span>
                </button>
              </div>

              <div className="mt-6 text-center space-y-4">
                {isLogin && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm font-bold transition-colors text-black hover:text-yellow-600"
                  >
                    Forgot your password?
                  </button>
                )}
                
                <p className="text-sm font-medium text-black">
                  {isLogin ? "Don&apos;t have an account?" : "Already have an account?"}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setErrors({});
                      setFormData({ email: '', password: '', confirmPassword: '', fullName: '' });
                      setResetEmailSent(false);
                    }}
                    className="font-bold transition-colors text-black hover:text-yellow-600"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-xs font-medium text-gray-600">
                ISBR School of Business, Bangalore - Facility Booking System
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}