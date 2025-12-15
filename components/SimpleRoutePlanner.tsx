import React, { useState, useEffect, useRef } from 'react';

interface SimpleRoutePlannerProps {
  onBack: () => void;
}

export const SimpleRoutePlanner: React.FC<SimpleRoutePlannerProps> = ({ onBack }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    // Initialize Google Map when component mounts
    if (mapRef.current && !googleMapRef.current) {
      // Default to Brisbane, Australia
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: -27.4698, lng: 153.0251 },
        zoom: 12,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
      });

      console.log('Google Map initialized');
    }
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shadow-sm">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center font-medium">
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Dashboard
        </button>
        <h1 className="text-xl font-bold text-gray-900">Route Planner</h1>
        <div className="w-20"></div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
      </div>
    </div>
  );
};
