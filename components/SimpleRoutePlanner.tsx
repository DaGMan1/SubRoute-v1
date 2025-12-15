import React, { useState, useEffect, useRef } from 'react';

interface SimpleRoutePlannerProps {
  onBack: () => void;
}

export const SimpleRoutePlanner: React.FC<SimpleRoutePlannerProps> = ({ onBack }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    // Wait for Google Maps to load
    const initMap = () => {
      if (!mapRef.current || googleMapRef.current) return;

      // Initialize Google Map
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: -27.4698, lng: 153.0251 }, // Brisbane, Australia
        zoom: 12,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
      });

      // Initialize Autocomplete on search input
      if (searchInputRef.current) {
        autocompleteRef.current = new google.maps.places.Autocomplete(searchInputRef.current, {
          componentRestrictions: { country: 'au' }, // Restrict to Australia
          fields: ['formatted_address', 'geometry', 'name'],
        });

        // Bind autocomplete to map bounds
        autocompleteRef.current.bindTo('bounds', googleMapRef.current);

        // Listen for place selection
        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();

          if (!place || !place.geometry || !place.geometry.location) {
            console.log('No place details available');
            return;
          }

          // Clear existing marker
          if (markerRef.current) {
            markerRef.current.setMap(null);
          }

          // Add marker at selected location
          markerRef.current = new google.maps.Marker({
            position: place.geometry.location,
            map: googleMapRef.current,
            title: place.name || place.formatted_address,
            animation: google.maps.Animation.DROP,
          });

          // Center map on selected location
          googleMapRef.current?.setCenter(place.geometry.location);
          googleMapRef.current?.setZoom(15);

          console.log('Selected place:', place.formatted_address);
        });
      }

      console.log('Google Map initialized with autocomplete');
    };

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      initMap();
    } else {
      // Wait for Google Maps to load
      const checkGoogleMaps = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkGoogleMaps);
          initMap();
        }
      }, 100);

      // Cleanup
      return () => clearInterval(checkGoogleMaps);
    }
  }, []);

  const handleClearSearch = () => {
    setSearchValue('');
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    // Clear marker
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    // Reset map to Brisbane
    if (googleMapRef.current) {
      googleMapRef.current.setCenter({ lat: -27.4698, lng: 153.0251 });
      googleMapRef.current.setZoom(12);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center font-medium">
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Dashboard
          </button>
          <h1 className="text-xl font-bold text-gray-900">Route Planner</h1>
          <div className="w-20"></div>
        </div>

        {/* Search Box */}
        <div className="relative max-w-2xl mx-auto">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="block w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              placeholder="Search for address in Australia (e.g., 7 Flinders Parade, North Lakes)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            {searchValue && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Start typing an address - suggestions will appear automatically
          </p>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
      </div>
    </div>
  );
};
