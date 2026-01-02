'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle, Loader2, Shield, User as UserIcon, Clock, Users, Calendar, MapPin } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, database } from '../../../firebase-config';
import { ref, set, get } from 'firebase/database';
import Navbar from '@/components/navbar';

export default function Login() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [signupEmailSent, setSignupEmailSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  
  const [errors, setErrors] = useState({});

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

  const isAdminEmail = useCallback(async (email) => {
    try {
      // Check against backend API
      const response = await fetch('http://localhost:8000/api/check-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      
      const data = await response.json();
      return data.isAdmin;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }, []);

  const storeUserInFirebase = useCallback(async (user, isNewUser = false, additionalData = {}) => {
    try {
      const isAdmin = await isAdminEmail(user.email);
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

      const existingUser = await get(userRef);
      if (!existingUser.exists() || isNewUser) {
        await set(userRef, userData);
      } else {
        const existingData = existingUser.val();
        userData = { ...existingData, lastLogin: new Date().toISOString() };
        await set(userRef, userData);
      }
      
      return userData;
    } catch (error) {
      console.error('Error in storeUserInFirebase:', error);
      const isAdmin = await isAdminEmail(user.email);
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
      
      const isAdmin = await isAdminEmail(user.email);
      const expectedRole = isAdmin ? 'admin' : 'user';
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
            setErrors({ general: 'This email has admin privileges. Admins cannot sign up - please contact IT support.' });
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
      
      const isAdmin = await isAdminEmail(user.email);
      safeNavigate(isAdmin ? '/admin-management' : '/bookings', 2000);
    }
  }, [storeUserInFirebase, safeNavigate, isAdminEmail, userType, isLogin]);

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
      const isAdmin = await isAdminEmail(user.email);
      safeNavigate(isAdmin ? '/admin-management' : '/bookings');
    }
  }, [storeUserInFirebase, safeNavigate, isAdminEmail]);

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = async () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
      setErrors(newErrors);
      return false;
    }
    
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
      setErrors(newErrors);
      return false;
    }
    
    const isAdmin = await isAdminEmail(formData.email);
    
    if (userType === 'admin' && !isAdmin) {
      if (isLogin) {
        newErrors.email = 'This email is not authorized for admin access. Please use a valid admin email or switch to Student/Staff login.';
      } else {
        newErrors.email = 'Only authorized admin emails can access admin accounts. Admins cannot sign up.';
      }
      setErrors(newErrors);
      return false;
    }
    
    if (userType === 'user' && isAdmin) {
      if (isLogin) {
        newErrors.email = 'This is an admin email. Please use the Admin login option.';
      } else {
        newErrors.email = 'This is an authorized admin email. Admins cannot sign up through this form.';
      }
      setErrors(newErrors);
      return false;
    }
    
    if (isLogin && !formData.password) {
      newErrors.password = 'Password is required';
      setErrors(newErrors);
      return false;
    }
    
    if (!isLogin && userType === 'user' && !formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
      setErrors(newErrors);
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const isValid = await validateForm();
    if (!isValid) return;
    
    setLoading(true);
    setErrors({});
    
    try {
      if (isLogin) {
        // Login flow
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        await handleUserAfterAuth(userCredential.user, false, { selectedUserType: userType });
      } else {
        // Signup flow - send request to backend
        const response = await fetch('http://localhost:8000/api/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            fullName: formData.fullName,
            userType: userType
          }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Backend created account, now send email via EmailJS from frontend
          try {
            // Check if EmailJS is configured
            const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
            const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID_SIGNUP;
            const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

            if (!serviceId || !templateId || !publicKey) {
              throw new Error('EmailJS is not configured. Please set up .env.local with EmailJS credentials.');
            }

            // Send email via EmailJS
            const emailJSResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                service_id: serviceId,
                template_id: templateId,
                user_id: publicKey,
                template_params: data.emailData
              }),
            });

            if (!emailJSResponse.ok) {
              const emailError = await emailJSResponse.text();
              throw new Error(`EmailJS error: ${emailError}`);
            }

            // Email sent successfully
            setSignupEmailSent(true);
            setLoading(false);
            setFormData({ email: '', password: '', fullName: '' });
            
          } catch (emailError) {
            console.error('Email sending error:', emailError);
            setLoading(false);
            setErrors({ 
              general: `Account was created but failed to send email: ${emailError.message}. Please contact support at support@isbr.edu with your email: ${formData.email}` 
            });
          }
        } else {
          setErrors({ general: data.detail || 'Signup failed. Please try again.' });
          setLoading(false);
        }
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
        default:
          console.error('Unhandled auth error:', error);
          errorMessage = 'Authentication failed. Please try again or contact support if the problem persists.';
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
        default:
          console.error('Unhandled password reset error:', error);
      }
      
      setErrors({ general: errorMessage });
    }
  };

  if (!mounted) return null;

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
      
      <div className="flex min-h-screen relative z-10 pt-16">
        {/* Left Side - ISBR Information */}
        <div className="hidden lg:flex lg:w-1/2 bg-white flex-col justify-center px-12 xl:px-16">
          <div className="max-w-md">
            <div className="mb-4">
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
        <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-2xl shadow-2xl py-6 px-6 border border-gray-200">
              
              <div className="text-center mb-6">
                <div className="flex justify-center mb-3 lg:hidden">
                  <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center font-bold text-xl text-white">
                    I
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-1 text-black">
                  {isLogin ? 'Welcome Back' : 'Join ISBR'}
                </h2>
                <p className="text-xs text-gray-600">
                  {isLogin ? 'Sign in to your account' : 'Create your account'}
                </p>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-bold mb-2 text-black">
                  {isLogin ? 'Select Login Type' : 'Select Account Type'}
                </label>
                <div className="flex rounded-lg border border-yellow-500 p-1 bg-yellow-50">
                  <button
                    type="button"
                    onClick={() => setUserType('user')}
                    className={`flex-1 flex items-center justify-center space-x-2 py-2 px-2 rounded-md font-medium transition-all duration-200 text-sm ${
                      userType === 'user'
                        ? 'bg-black text-white shadow-sm'
                        : 'text-black hover:bg-yellow-100'
                    }`}
                  >
                    <UserIcon size={16} />
                    <span>Student/Staff</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserType('admin')}
                    className={`flex-1 flex items-center justify-center space-x-2 py-2 px-2 rounded-md font-medium transition-all duration-200 text-sm ${
                      userType === 'admin'
                        ? 'bg-black text-white shadow-sm'
                        : 'text-black hover:bg-yellow-100'
                    }`}
                  >
                    <Shield size={16} />
                    <span>Admin</span>
                  </button>
                </div>
                {!isLogin && userType === 'admin' && (
                  <p className="mt-2 text-xs text-black bg-yellow-50 p-2 rounded border border-yellow-500">
                    <strong>Note:</strong> Admins cannot sign up. Please contact IT support.
                  </p>
                )}
              </div>

              {resetEmailSent && (
                <div className="mb-4 p-3 rounded-lg border bg-yellow-50 border-yellow-500 text-black">
                  <div className="flex items-center space-x-2">
                    <CheckCircle size={18} />
                    <span className="text-xs font-medium">
                      Password reset email sent! Check your inbox.
                    </span>
                  </div>
                </div>
              )}

              {signupEmailSent && (
                <div className="mb-4 p-3 rounded-lg border bg-green-50 border-green-500 text-green-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle size={18} />
                    <span className="text-xs font-medium">
                      Account created! Check your email for login credentials and reset your password.
                    </span>
                  </div>
                </div>
              )}

              {errors.general && (
                <div className="mb-4 p-3 rounded-lg border flex items-start space-x-2 bg-red-50 border-red-500 text-red-700">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span className="text-xs font-medium">{errors.general}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && userType === 'user' && (
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-black">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-black" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className={`w-full pl-9 pr-3 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-medium bg-white text-black focus:border-black focus:ring-yellow-500/20 placeholder-gray-500 ${errors.fullName ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="Enter your full name"
                      />
                    </div>
                    {errors.fullName && (
                      <p className="mt-1 text-xs text-red-500 font-medium">{errors.fullName}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-black">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-black" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full pl-9 pr-3 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-medium bg-white text-black focus:border-black focus:ring-yellow-500/20 placeholder-gray-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="Enter your ISBR email"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-500 font-medium">{errors.email}</p>
                  )}
                </div>

                {isLogin && (
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-black">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-black" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className={`w-full pl-9 pr-10 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-medium bg-white text-black focus:border-black focus:ring-yellow-500/20 placeholder-gray-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors text-black hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs text-red-500 font-medium">{errors.password}</p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-bold text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-black hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="animate-spin h-4 w-4" />
                      <span className="text-sm">{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
                    </div>
                  ) : (
                    <span className="text-sm">
                      {isLogin 
                        ? (userType === 'admin' ? 'Admin Sign In' : 'Sign In') 
                        : 'Create Account'
                      }
                    </span>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center space-y-3">
                {isLogin && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-bold transition-colors text-black hover:text-yellow-600"
                  >
                    Forgot your password?
                  </button>
                )}
                
                <p className="text-xs font-medium text-black">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setErrors({});
                      setFormData({ email: '', password: '', fullName: '' });
                      setResetEmailSent(false);
                      setSignupEmailSent(false);
                    }}
                    className="font-bold transition-colors text-black hover:text-yellow-600"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-xs font-medium text-gray-600">
                ISBR Business School - Facility Booking System
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}