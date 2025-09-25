'use client';

import { MapPin, ArrowRight } from 'lucide-react';
import Navbar from './navbar';

export default function Homepage() {
  const handleStartBooking = () => {
    console.log('Start booking clicked');
  };

  const handleViewDemo = () => {
    console.log('View demo clicked');
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <Navbar />

      {/* Background Blobs */}
      <div className="absolute top-[-5rem] left-[-5rem] w-72 h-72 z-0 opacity-60">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#FACC15" /* yellow */
            d="M60.9,-0.3C60.9,25.5,30.4,51,1.2,51C-27.9,51,-55.9,25.5,-55.9,-0.3C-55.9,-26.1,-27.9,-52.1,1.2,-52.1C30.4,-52.1,60.9,-26.1,60.9,-0.3Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      <div className="absolute bottom-[-6rem] right-[-6rem] w-96 h-96 z-0 opacity-50">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#7F1D1D" /* maroon */
            d="M61,-62.3C75.4,-46.6,81,-23.3,80.1,-0.9C79.3,21.6,72,43.1,57.6,59.7C43.1,76.4,21.6,88,2.2,85.9C-17.3,83.7,-34.5,67.7,-49.9,51.1C-65.3,34.5,-78.9,17.3,-77.7,1.2C-76.5,-14.9,-60.6,-29.7,-45.2,-45.5C-29.7,-61.3,-14.9,-77.9,4.2,-82.1C23.3,-86.3,46.6,-78.1,61,-62.3Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      <div className="absolute top-1/4 right-1/4 w-72 h-72 z-0 opacity-40">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#FDE68A" /* soft yellow */
            d="M45.8,-58.1C60.7,-48.7,75.4,-35.2,81.5,-18.3C87.6,-1.4,85.2,18.8,73.9,31.5C62.6,44.2,42.3,49.3,22.9,56.3C3.5,63.3,-15,72.2,-32.7,67.9C-50.4,63.6,-67.2,46.2,-71.9,26.2C-76.6,6.2,-69.1,-16.4,-55.8,-29.9C-42.5,-43.4,-23.3,-47.8,-5.3,-44.9C12.7,-42,25.5,-32,45.8,-58.1Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      {/* Hero Section */}
      <div className="relative z-10 pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-20">
            <h1 className="text-6xl md:text-8xl font-bold mb-8">
              <span className="text-gray-900">Book your</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-yellow-600 to-amber-700">
                space.
              </span>
              <span className="text-[#7F1D1D]"> Instantly.</span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
              ISBR College&apos;s intelligent booking system transforms how you reserve auditoriums and
              board rooms. Real-time availability, instant confirmations, and seamless management
              for students and staff.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <button
                onClick={handleStartBooking}
                className="group relative px-8 py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl text-white font-semibold text-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/30"
              >
                <span className="flex items-center space-x-2">
                  <span>Start Booking</span>
                  <ArrowRight
                    size={20}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </span>
              </button>

              <button
                onClick={handleViewDemo}
                className="group px-8 py-4 border-2 border-[#7F1D1D] rounded-2xl text-[#7F1D1D] font-semibold text-lg transition-all duration-300 hover:border-yellow-600 hover:bg-yellow-50 hover:scale-105"
              >
                <span className="flex items-center space-x-2">
                  <MapPin size={20} />
                  <span>View Facilities</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
