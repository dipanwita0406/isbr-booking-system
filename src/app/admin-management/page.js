'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar, 
  MapPin, 
  MessageSquare,
  Filter,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  X,
  Users
} from 'lucide-react';
import { auth, database } from '../../../firebase-config';
import { ref, onValue, update, get, push } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import Navbar from '@/components/navbar';

const AdminManagement = () => {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mounted, setMounted] = useState(false);

  const filterBookings = useCallback(() => {
    let filtered = bookings;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(booking => booking.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(booking =>
        booking.facilityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.venue?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredBookings(filtered);
  }, [bookings, statusFilter, searchTerm]);

  const loadBookings = useCallback(() => {
    const bookingsRef = ref(database, 'bookings');
    const unsubscribe = onValue(bookingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const bookingsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        
        bookingsArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setBookings(bookingsArray);
      } else {
        setBookings([]);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setMounted(true);
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = ref(database, `users/${user.uid}`);
          const userSnapshot = await get(userRef);
          const userData = userSnapshot.val();
          
          if (userData && userData.role === 'admin') {
            setCurrentUser(userData);
            loadBookings();
          } else {
            router.push('/bookings');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          router.push('/login');
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, loadBookings]);

  useEffect(() => {
    if (bookings.length > 0) {
      filterBookings();
    }
  }, [bookings, searchTerm, statusFilter, filterBookings]);

  const handleAction = useCallback((booking, action) => {
    setSelectedBooking(booking);
    setActionType(action);
    setShowReasonModal(true);
    setReason('');
  }, []);

  const confirmAction = useCallback(async () => {
    if (!selectedBooking || !actionType) return;

    setActionLoading(true);
    try {
      const bookingRef = ref(database, `bookings/${selectedBooking.id}`);
      const updateData = {
        status: actionType,
        [`${actionType}At`]: new Date().toISOString(),
        [`${actionType}By`]: currentUser?.uid || auth.currentUser?.uid,
        [`${actionType}Reason`]: reason.trim() || null
      };

      await update(bookingRef, updateData);

      const notificationRef = ref(database, 'notifications');
      await push(notificationRef, {
        userId: selectedBooking.userId,
        type: actionType,
        bookingId: selectedBooking.id,
        facilityName: selectedBooking.facilityName || selectedBooking.venue,
        message: `Your booking for ${selectedBooking.facilityName || selectedBooking.venue} has been ${actionType}${reason ? ': ' + reason : ''}`,
        createdAt: new Date().toISOString(),
        read: false
      });

      setShowReasonModal(false);
      setSelectedBooking(null);
      setActionType('');
      setReason('');
    } catch (error) {
      console.error('Error updating booking:', error);
    } finally {
      setActionLoading(false);
    }
  }, [selectedBooking, actionType, reason, currentUser]);

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'approved':
        return 'text-green-700 bg-green-50 border-green-300';
      case 'rejected':
        return 'text-red-700 bg-red-50 border-red-300';
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 border-yellow-400';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-300';
    }
  }, []);

  const getStatusIcon = useCallback((status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={16} />;
      case 'rejected':
        return <XCircle size={16} />;
      case 'pending':
        return <Clock size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  }, []);

  const formatDateTime = useCallback((dateTimeString) => {
    if (!dateTimeString) return '';
    return new Date(dateTimeString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-black mx-auto mb-4" />
          <p className="text-black font-medium">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <Navbar />
      
      {/* Background Blobs */}
      <div className="absolute top-[-5rem] left-[-5rem] w-72 h-72 z-0 opacity-15">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#7F1D1D"
            d="M60.9,-0.3C60.9,25.5,30.4,51,1.2,51C-27.9,51,-55.9,25.5,-55.9,-0.3C-55.9,-26.1,-27.9,-52.1,1.2,-52.1C30.4,-52.1,60.9,-26.1,60.9,-0.3Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      <div className="absolute bottom-[-6rem] right-[-6rem] w-96 h-96 z-0 opacity-10">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#7F1D1D"
            d="M61,-62.3C75.4,-46.6,81,-23.3,80.1,-0.9C79.3,21.6,72,43.1,57.6,59.7C43.1,76.4,21.6,88,2.2,85.9C-17.3,83.7,-34.5,67.7,-49.9,51.1C-65.3,34.5,-78.9,17.3,-77.7,1.2C-76.5,-14.9,-60.6,-29.7,-45.2,-45.5C-29.7,-61.3,-14.9,-77.9,4.2,-82.1C23.3,-86.3,46.6,-78.1,61,-62.3Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      <div className="absolute top-1/3 right-1/4 w-64 h-64 z-0 opacity-20">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#7F1D1D"
            d="M45.8,-58.1C60.7,-48.7,75.4,-35.2,81.5,-18.3C87.6,-1.4,85.2,18.8,73.9,31.5C62.6,44.2,42.3,49.3,22.9,56.3C3.5,63.3,-15,72.2,-32.7,67.9C-50.4,63.6,-67.2,46.2,-71.9,26.2C-76.6,6.2,-69.1,-16.4,-55.8,-29.9C-42.5,-43.4,-23.3,-47.8,-5.3,-44.9C12.7,-42,25.5,-32,45.8,-58.1Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      <div className="absolute top-2/3 left-1/4 w-48 h-48 z-0 opacity-12">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#7F1D1D"
            d="M35.2,-47.8C44.8,-35.6,50.1,-22.4,52.3,-8.1C54.5,6.2,53.6,21.6,46.8,33.2C40,44.8,27.3,52.6,13.1,55.9C-1.1,59.2,-16.8,57.9,-29.9,51.2C-43,44.5,-53.5,32.4,-58.1,18.7C-62.7,5,-61.4,-10.3,-54.8,-22.8C-48.2,-35.3,-36.3,-45,-22.4,-54.2C-8.5,-63.4,7.4,-72.1,21.8,-67.3C36.2,-62.5,49.1,-44.2,35.2,-47.8Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 my-30">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">Admin Management</h1>
          <p className="text-gray-600 text-lg">Review and manage facility booking requests</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500/20 focus:border-black text-black font-medium bg-white"
                />
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500/20 focus:border-black text-black font-medium appearance-none bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="text-sm text-gray-600 font-medium bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
              Total Bookings: <span className="font-bold text-black">{filteredBookings.length}</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-black mb-2">No bookings found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-black mb-2 capitalize">
                          {booking.facilityName || booking.venue}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <User size={16} />
                            <span className="font-medium">{booking.userName || booking.userEmail}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar size={16} />
                            <span className="font-medium">
                              {booking.startTime && booking.endTime ? (
                                `${formatDateTime(booking.startTime)} - ${formatDateTime(booking.endTime)}`
                              ) : (
                                `${formatDate(booking.date)} ${booking.startTime} - ${booking.endTime}`
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-full border flex items-center gap-2 text-sm font-bold ${getStatusColor(booking.status)}`}>
                        {getStatusIcon(booking.status)}
                        <span className="capitalize">{booking.status}</span>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 text-sm mb-4">
                      <div className="space-y-3">
                        <div>
                          <span className="font-bold text-black block mb-1">Purpose:</span>
                          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{booking.purpose}</p>
                        </div>
                        <div>
                          <span className="font-bold text-black block mb-1">Participants:</span>
                          <p className="text-gray-700 flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                            <Users size={16} />
                            <span className="font-medium">{booking.participants} people</span>
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <span className="font-bold text-black block mb-1">Requested:</span>
                          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg font-medium">{formatDateTime(booking.createdAt)}</p>
                        </div>
                        {booking.specialRequirements && (
                          <div>
                            <span className="font-bold text-black block mb-1">Special Requirements:</span>
                            <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{booking.specialRequirements}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {(booking.approvedReason || booking.rejectedReason) && (
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare size={16} className="text-black" />
                          <span className="font-bold text-black">Admin Note:</span>
                        </div>
                        <p className="text-gray-700">{booking.approvedReason || booking.rejectedReason}</p>
                      </div>
                    )}
                  </div>

                  {booking.status === 'pending' && (
                    <div className="flex flex-row sm:flex-col gap-3 lg:w-44">
                      <button
                        onClick={() => handleAction(booking, 'approved')}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                        <CheckCircle size={18} />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleAction(booking, 'rejected')}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                        <XCircle size={18} />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-black">
                {actionType === 'approved' ? 'Approve Booking' : 'Reject Booking'}
              </h3>
              <button
                onClick={() => setShowReasonModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-bold text-black mb-3 capitalize text-lg">
                {selectedBooking?.facilityName || selectedBooking?.venue}
              </h4>
              <div className="space-y-2 text-sm text-gray-700">
                <p><span className="font-medium">Requested by:</span> {selectedBooking?.userName || selectedBooking?.userEmail}</p>
                <p><span className="font-medium">Date:</span> {selectedBooking && (
                  selectedBooking.startTime ? 
                    formatDateTime(selectedBooking.startTime) : 
                    `${formatDate(selectedBooking.date)} ${selectedBooking.startTime}`
                )}</p>
                <p><span className="font-medium">Participants:</span> {selectedBooking?.participants} people</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold mb-2 text-black">
                Reason (Optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Enter reason for ${actionType === 'approved' ? 'approval' : 'rejection'}...`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500/20 focus:border-black text-black resize-none h-32 bg-white"
                maxLength={500}
              />
              <div className="text-right text-xs text-gray-500 mt-1">
                {reason.length}/500 characters
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowReasonModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-3 border border-gray-300 text-black rounded-lg font-bold hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={actionLoading}
                className={`flex-1 px-4 py-3 rounded-lg font-bold text-white transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg ${
                  actionType === 'approved' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading ? (
                  <RefreshCw className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    {actionType === 'approved' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    <span>Confirm {actionType === 'approved' ? 'Approval' : 'Rejection'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;