import React, { useState, useEffect, useRef } from 'react';

interface SimpleRoutePlannerProps {
  onBack: () => void;
}

interface Stop {
  id: string;
  address: string;
  location: google.maps.LatLngLiteral;
}

export const SimpleRoutePlanner: React.FC<SimpleRoutePlannerProps> = ({ onBack }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const [searchValue, setSearchValue] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);
  const [currentLocation, setCurrentLocation] = useState<google.maps.LatLngLiteral | null>(null);

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(location);
        },
        () => {
          // Default to Brisbane if geolocation fails
          setCurrentLocation({ lat: -27.4698, lng: 153.0251 });
        }
      );
    } else {
      setCurrentLocation({ lat: -27.4698, lng: 153.0251 });
    }
  }, []);

  useEffect(() => {
    // Wait for Google Maps to load
    const initMap = () => {
      if (!mapRef.current || googleMapRef.current || !currentLocation) return;

      // Initialize Google Map
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center: currentLocation,
        zoom: 12,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
      });

      // Initialize Directions Service and Renderer
      directionsServiceRef.current = new google.maps.DirectionsService();
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: googleMapRef.current,
        suppressMarkers: false, // Show Google's default markers
        polylineOptions: {
          strokeColor: '#4285F4',
          strokeWeight: 5,
        },
      });

      // Initialize Autocomplete on search input
      if (searchInputRef.current) {
        autocompleteRef.current = new google.maps.places.Autocomplete(searchInputRef.current, {
          componentRestrictions: { country: 'au' },
          fields: ['formatted_address', 'geometry', 'name'],
        });

        autocompleteRef.current.bindTo('bounds', googleMapRef.current);

        // Listen for place selection
        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();

          if (!place || !place.geometry || !place.geometry.location) {
            return;
          }

          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };

          // Add stop
          addStop(place.formatted_address || place.name || 'Unknown', location);

          // Clear search
          setSearchValue('');
          if (searchInputRef.current) {
            searchInputRef.current.value = '';
          }
        });
      }

      console.log('Google Map initialized with directions');
    };

    if (window.google && window.google.maps && currentLocation) {
      initMap();
    } else if (currentLocation) {
      const checkGoogleMaps = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkGoogleMaps);
          initMap();
        }
      }, 100);

      return () => clearInterval(checkGoogleMaps);
    }
  }, [currentLocation]);

  const addStop = (address: string, location: google.maps.LatLngLiteral) => {
    const newStop: Stop = {
      id: Date.now().toString(),
      address,
      location,
    };

    setStops((prev) => [...prev, newStop]);
  };

  const removeStop = (id: string) => {
    setStops((prev) => prev.filter((stop) => stop.id !== id));
  };

  const addCurrentLocation = () => {
    if (!currentLocation) return;

    // Reverse geocode to get address
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: currentLocation }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        addStop(results[0].formatted_address, currentLocation);
      } else {
        addStop('Current Location', currentLocation);
      }
    });
  };

  // Calculate and display route whenever stops change
  useEffect(() => {
    if (!directionsServiceRef.current || !directionsRendererRef.current || stops.length === 0) {
      // Clear route if no stops
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setDirections({ routes: [] } as any);
      }
      return;
    }

    if (stops.length === 1) {
      // Just one stop - center map on it
      if (googleMapRef.current) {
        googleMapRef.current.setCenter(stops[0].location);
        googleMapRef.current.setZoom(15);
      }
      return;
    }

    // Calculate route with multiple stops
    const origin = stops[0].location;
    const destination = stops[stops.length - 1].location;
    const waypoints = stops.slice(1, -1).map((stop) => ({
      location: stop.location,
      stopover: true,
    }));

    const request: google.maps.DirectionsRequest = {
      origin,
      destination,
      waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      region: 'AU',
    };

    directionsServiceRef.current.route(request, (result, status) => {
      if (status === 'OK' && result) {
        directionsRendererRef.current?.setDirections(result);
        console.log('Route calculated successfully');
      } else {
        console.error('Directions request failed:', status);
      }
    });
  }, [stops]);

  const clearAll = () => {
    setStops([]);
    setSearchValue('');
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] } as any);
    }
    if (googleMapRef.current && currentLocation) {
      googleMapRef.current.setCenter(currentLocation);
      googleMapRef.current.setZoom(12);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Left Sidebar - Stops List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center font-medium">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
              Back
            </button>
            <h1 className="text-lg font-bold text-gray-900">Route Planner</h1>
          </div>

          {/* Search Box */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Search address..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>

          {/* Add Current Location Button */}
          <button
            onClick={addCurrentLocation}
            className="mt-2 w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <span>Add Current Location</span>
          </button>
        </div>

        {/* Stops List */}
        <div className="flex-1 overflow-y-auto p-4">
          {stops.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
              </svg>
              <p className="text-sm">No stops added yet</p>
              <p className="text-xs mt-1">Search for addresses above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stops.map((stop, index) => (
                <div
                  key={stop.id}
                  className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                    {index === 0 ? 'A' : index === stops.length - 1 ? 'B' : index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{stop.address}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {index === 0 ? 'Start' : index === stops.length - 1 ? 'Destination' : `Stop ${index}`}
                    </p>
                  </div>
                  <button
                    onClick={() => removeStop(stop.id)}
                    className="flex-shrink-0 text-gray-400 hover:text-red-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {stops.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={clearAll}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
            >
              Clear All Stops
            </button>
          </div>
        )}
      </div>

      {/* Right Side - Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
      </div>
    </div>
  );
};
