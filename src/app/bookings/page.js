'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { database, auth } from '../../../firebase-config';
import { ref, push, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import Navbar from '@/components/navbar';
import { Calendar, Clock, MapPin, Users, CheckCircle, XCircle, AlertTriangle, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

const BookingSystem = () => {
  const [selectedVenue, setSelectedVenue] = useState('board room');
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [participants, setParticipants] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [userBookings, setUserBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        loadUserBookings(user.uid);
        loadAllBookings();
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);
const filterBookings = () => {
    if (!searchTerm.trim()) {
      setFilteredBookings(userBookings);
      return;
    }

    const filtered = userBookings.filter(booking =>
      booking.venue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatDate(booking.date).toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredBookings(filtered);
  };
  useEffect(() => {
    filterBookings();
  }, [userBookings, searchTerm, filterBookings]);

  const loadUserBookings = (userId) => {
    const userBookingsRef = query(
      ref(database, 'bookings'),
      orderByChild('userId'),
      equalTo(userId)
    );

    onValue(userBookingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const bookingsArray = Object.entries(data).map(([id, booking]) => ({
          id,
          ...booking
        }));
        setUserBookings(bookingsArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } else {
        setUserBookings([]);
      }
    });
  };

  const loadAllBookings = () => {
    const allBookingsRef = ref(database, 'bookings');

    onValue(allBookingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const bookingsArray = Object.entries(data).map(([id, booking]) => ({
          id,
          ...booking
        }));
        setAllBookings(bookingsArray);
      } else {
        setAllBookings([]);
      }
    });
  };

  

  const checkForConflicts = (venue, date, startTime, endTime) => {
    const newStart = new Date(`${date}T${startTime}`);
    const newEnd = new Date(`${date}T${endTime}`);

    return allBookings.some(booking => {
      if (booking.venue !== venue || booking.date !== date || booking.status === 'rejected') {
        return false;
      }

      const existingStart = new Date(`${booking.date}T${booking.startTime}`);
      const existingEnd = new Date(`${booking.date}T${booking.endTime}`);

      return (newStart < existingEnd && newEnd > existingStart);
    });
  };

  const handleSubmit = async () => {
    if (!currentUser) {
      setMessage({ type: 'error', text: 'Please log in to make a booking' });
      return;
    }

    if (!bookingDate || !startTime || !endTime || !purpose.trim() || !participants.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    if (startTime >= endTime) {
      setMessage({ type: 'error', text: 'End time must be after start time' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (bookingDate < today) {
      setMessage({ type: 'error', text: 'Cannot book for past dates' });
      return;
    }

    const participantCount = parseInt(participants);
    if (isNaN(participantCount) || participantCount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid number of participants' });
      return;
    }

    if (checkForConflicts(selectedVenue, bookingDate, startTime, endTime)) {
      setMessage({ type: 'error', text: `${selectedVenue === 'board room' ? 'Board Room' : 'Auditorium'} is already booked for this time slot` });
      return;
    }

    setLoading(true);

    try {
      const bookingData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.email,
        venue: selectedVenue,
        facilityName: selectedVenue === 'board room' ? 'Board Room' : 'Auditorium',
        date: bookingDate,
        startTime: `${bookingDate}T${startTime}:00`,
        endTime: `${bookingDate}T${endTime}:00`,
        purpose: purpose.trim(),
        participants: participantCount,
        specialRequirements: specialRequirements.trim() || null,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await push(ref(database, 'bookings'), bookingData);

      setBookingDate('');
      setStartTime('');
      setEndTime('');
      setPurpose('');
      setParticipants('');
      setSpecialRequirements('');

      setMessage({ type: 'success', text: 'Booking request submitted successfully! Awaiting admin approval.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to submit booking request. Please try again.' });
      console.error('Booking error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateTimeString) => {
    return new Date(dateTimeString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'rejected':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
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

      <div className="absolute top-1/3 right-1/4 w-64 h-64 z-0 opacity-8">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#7F1D1D"
            d="M45.8,-58.1C60.7,-48.7,75.4,-35.2,81.5,-18.3C87.6,-1.4,85.2,18.8,73.9,31.5C62.6,44.2,42.3,49.3,22.9,56.3C3.5,63.3,-15,72.2,-32.7,67.9C-50.4,63.6,-67.2,46.2,-71.9,26.2C-76.6,6.2,-69.1,-16.4,-55.8,-29.9C-42.5,-43.4,-23.3,-47.8,-5.3,-44.9C12.7,-42,25.5,-32,45.8,-58.1Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 mt-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">Book a Venue</h1>
          <p className="text-gray-600 text-lg">Reserve meeting rooms and event spaces with ease</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
              {message.text && (
                <div className={`mb-6 p-4 rounded-lg border flex items-center ${message.type === 'success'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                  }`}>
                  {message.type === 'success' ? (
                    <CheckCircle className="h-5 w-5 mr-3 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 mr-3 text-red-600" />
                  )}
                  <span className={`font-medium ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                    {message.text}
                  </span>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-black mb-3">
                    Select Venue
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedVenue('board room')}
                      className={`p-6 rounded-xl border-2 transition-all duration-300 ${selectedVenue === 'board room'
                          ? 'border-yellow-400 bg-yellow-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                    >
                      <div className="flex items-center justify-center mb-3">
                        <div className={`p-3 rounded-lg ${selectedVenue === 'board room' ? 'bg-yellow-400' : 'bg-gray-100'}`}>
                          <Users className={`h-6 w-6 ${selectedVenue === 'board room' ? 'text-black' : 'text-gray-600'}`} />
                        </div>
                      </div>
                      <div className="text-center">
                        <h3 className="font-bold text-black mb-1">Board Room</h3>
                        <p className="text-sm text-gray-600">Professional Meetings</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedVenue('auditorium')}
                      className={`p-6 rounded-xl border-2 transition-all duration-300 ${selectedVenue === 'auditorium'
                          ? 'border-yellow-400 bg-yellow-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                    >
                      <div className="flex items-center justify-center mb-3">
                        <div className={`p-3 rounded-lg ${selectedVenue === 'auditorium' ? 'bg-yellow-400' : 'bg-gray-100'}`}>
                          <MapPin className={`h-6 w-6 ${selectedVenue === 'auditorium' ? 'text-black' : 'text-gray-600'}`} />
                        </div>
                      </div>
                      <div className="text-center">
                        <h3 className="font-bold text-black mb-1">Auditorium</h3>
                        <p className="text-sm text-gray-600">Events & Presentations</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Booking Date
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 bg-white text-black"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      Start Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 bg-white text-black"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      End Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 bg-white text-black"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Number of Participants
                  </label>
                  <input
                    type="number"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    min="1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 bg-white text-black"
                    placeholder="Enter number of participants"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Purpose of Booking
                  </label>
                  <textarea
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 resize-none bg-white text-black"
                    placeholder="Describe the purpose of your booking..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Special Requirements (Optional)
                  </label>
                  <textarea
                    value={specialRequirements}
                    onChange={(e) => setSpecialRequirements(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 resize-none bg-white text-black"
                    placeholder="Any special arrangements needed..."
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-4 px-6 rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {loading ? 'Submitting Request...' : 'Submit Booking Request'}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-black">Your Bookings</h2>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search bookings..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 bg-white text-black"
                  />
                </div>
              </div>

              {filteredBookings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-gray-100 p-6 rounded-2xl inline-block mb-4">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto" />
                  </div>
                  <p className="text-lg font-medium text-black mb-2">
                    {searchTerm ? 'No matching bookings found' : 'No bookings yet'}
                  </p>
                  <p className="text-gray-600">
                    {searchTerm ? 'Try different search terms' : 'Your bookings will appear here'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filteredBookings.map((booking) => (
                    <div key={booking.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-black capitalize">
                          {booking.venue}
                        </h3>
                        <div className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-2 ${getStatusColor(booking.status)}`}>
                          {getStatusIcon(booking.status)}
                          <span className="capitalize">{booking.status}</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600 mb-3">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span className="font-medium">{formatDate(booking.date)}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          <span className="font-medium">{formatDateTime(booking.startTime)} - {formatDateTime(booking.endTime)}</span>
                        </div>
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          <span className="font-medium">{booking.participants} participants</span>
                        </div>
                      </div>

                      <p className="text-sm text-black font-medium line-clamp-2 mb-2">
                        {booking.purpose}
                      </p>

                      {booking.specialRequirements && (
                        <p className="text-xs text-gray-600 italic mb-2">
                          Special: {booking.specialRequirements}
                        </p>
                      )}

                      {(booking.approvedReason || booking.rejectedReason) && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <span className="font-bold text-black text-xs">Admin Note:</span>
                          <p className="text-black text-xs mt-1">{booking.approvedReason || booking.rejectedReason}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-yellow-50 rounded-2xl p-6 mt-6 border border-yellow-200">
              <div className="flex items-center mb-4">
                <div className="bg-yellow-400 p-2 rounded-lg mr-3">
                  <AlertTriangle className="h-5 w-5 text-black" />
                </div>
                <h3 className="text-lg font-bold text-black">Booking Guidelines</h3>
              </div>
              <ul className="text-black space-y-2 text-sm">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-black rounded-full mr-3 mt-2 flex-shrink-0"></span>
                  All bookings require admin approval
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-black rounded-full mr-3 mt-2 flex-shrink-0"></span>
                  Submit requests at least 24 hours in advance
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-black rounded-full mr-3 mt-2 flex-shrink-0"></span>
                  Maximum booking duration is 4 hours
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-black rounded-full mr-3 mt-2 flex-shrink-0"></span>
                  Provide accurate participant count
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-black rounded-full mr-3 mt-2 flex-shrink-0"></span>
                  Check your booking status regularly
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingSystem;