import React, { useState, useEffect, useRef } from 'react';
import type { TripLog } from '../types';

interface SimpleRoutePlannerProps {
  onBack?: () => void;
}

interface Stop {
  id: string;
  address: string;
  location: google.maps.LatLngLiteral;
  type?: 'pickup' | 'delivery' | 'depot';
  notes?: string;
}

export const SimpleRoutePlanner: React.FC<SimpleRoutePlannerProps> = ({ onBack }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  const [searchValue, setSearchValue] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);
  const [currentLocation, setCurrentLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [routeDetails, setRouteDetails] = useState<{ distance: string; duration: string } | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [depotAddress, setDepotAddress] = useState<Stop | null>(() => {
    try {
      const saved = localStorage.getItem('subroute_depot');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showDepotModal, setShowDepotModal] = useState(false);
  const [depotSearchValue, setDepotSearchValue] = useState('');
  const depotSearchRef = useRef<HTMLInputElement>(null);
  const depotAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [pendingStop, setPendingStop] = useState<{ address: string; location: google.maps.LatLngLiteral } | null>(null);
  const [routeStartTime, setRouteStartTime] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [routeBegunFromDepot, setRouteBegunFromDepot] = useState(false);

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

      // Initialize Traffic Layer
      trafficLayerRef.current = new google.maps.TrafficLayer();

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

          // Set as pending stop - user will choose pickup or delivery
          setPendingStop({
            address: place.formatted_address || place.name || 'Unknown',
            location,
          });

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

  const addStop = (address: string, location: google.maps.LatLngLiteral, type: 'pickup' | 'delivery') => {
    const newStop: Stop = {
      id: Date.now().toString(),
      address,
      location,
      type,
    };

    setStops((prev) => [...prev, newStop]);
    setPendingStop(null);
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
        setPendingStop({
          address: results[0].formatted_address,
          location: currentLocation,
        });
      } else {
        setPendingStop({
          address: 'Current Location',
          location: currentLocation,
        });
      }
    });
  };

  const toggleStopType = (id: string) => {
    setStops((prev) =>
      prev.map((stop) =>
        stop.id === id
          ? { ...stop, type: stop.type === 'pickup' ? 'delivery' : 'pickup' }
          : stop
      )
    );
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (loc1: google.maps.LatLngLiteral, loc2: google.maps.LatLngLiteral): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Optimize route order using nearest neighbor algorithm
  const optimizeStops = (stopsToOptimize: Stop[], startLocation?: google.maps.LatLngLiteral): Stop[] => {
    if (stopsToOptimize.length <= 1) return stopsToOptimize;

    const optimized: Stop[] = [];
    const remaining = [...stopsToOptimize];

    // Use starting location if provided (like depot or current location)
    let currentLoc = startLocation;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      remaining.forEach((stop, index) => {
        const distance = currentLoc
          ? calculateDistance(currentLoc, stop.location)
          : 0; // If no current location, just take first

        if (distance < nearestDistance || !currentLoc) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      const nextStop = remaining.splice(nearestIndex, 1)[0];
      optimized.push(nextStop);
      currentLoc = nextStop.location;
    }

    return optimized;
  };

  const groupPickupsFirst = () => {
    // Separate stops by type
    const depots = stops.filter((s) => s.type === 'depot');
    const pickups = stops.filter((s) => s.type === 'pickup');
    const deliveries = stops.filter((s) => s.type === 'delivery');
    const other = stops.filter((s) => !s.type);

    // Get starting location (first depot or current location)
    const startLoc = depots.length > 0 ? depots[0].location : currentLocation || undefined;

    // Optimize pickups starting from depot/current location
    const optimizedPickups = pickups.length > 0 ? optimizeStops(pickups, startLoc) : [];

    // Optimize deliveries starting from last pickup (or depot if no pickups)
    const deliveryStartLoc = optimizedPickups.length > 0
      ? optimizedPickups[optimizedPickups.length - 1].location
      : startLoc;
    const optimizedDeliveries = deliveries.length > 0 ? optimizeStops(deliveries, deliveryStartLoc) : [];

    // Rebuild stops array: depots first, then optimized pickups, then optimized deliveries, then other
    const newStops = [...depots, ...optimizedPickups, ...optimizedDeliveries, ...other];

    console.log('Optimized route:', {
      original: stops.length,
      new: newStops.length,
      depots: depots.length,
      pickups: optimizedPickups.length,
      deliveries: optimizedDeliveries.length
    });

    setStops(newStops);
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

    // Calculate route (works with 1 or more stops)
    // If only 1 stop, route from current location to that stop
    const origin = stops.length === 1 && currentLocation ? currentLocation : stops[0].location;
    const destination = stops[stops.length - 1].location;
    const waypoints = stops.length === 1 ? [] : stops.slice(1, -1).map((stop) => ({
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

        // Calculate total distance and duration
        const route = result.routes[0];
        let totalDistance = 0;
        let totalDuration = 0;

        route.legs.forEach((leg) => {
          totalDistance += leg.distance?.value || 0;
          totalDuration += leg.duration?.value || 0;
        });

        const distanceKm = (totalDistance / 1000).toFixed(1);
        const durationMins = Math.round(totalDuration / 60);

        setRouteDetails({
          distance: `${distanceKm} km`,
          duration: `${durationMins} min`,
        });

        console.log('Route calculated successfully');
      } else {
        console.error('Directions request failed:', status);
        setRouteDetails(null);
      }
    });
  }, [stops, currentLocation]);

  const clearAll = () => {
    setStops([]);
    setSearchValue('');
    setRouteDetails(null);
    setRouteBegunFromDepot(false);
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

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const newStops = [...stops];
    const [draggedStop] = newStops.splice(draggedIndex, 1);
    newStops.splice(dropIndex, 0, draggedStop);

    setStops(newStops);
    setDraggedIndex(null);
  };

  const startNavigation = () => {
    if (stops.length === 0) return;

    // Open Google Maps with directions and start navigation immediately
    // If only 1 stop, start from current location
    const origin = stops.length === 1 && currentLocation
      ? `${currentLocation.lat},${currentLocation.lng}`
      : `${stops[0].location.lat},${stops[0].location.lng}`;
    const destination = `${stops[stops.length - 1].location.lat},${stops[stops.length - 1].location.lng}`;

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving&dir_action=navigate`;

    if (stops.length > 2) {
      const waypoints = stops
        .slice(1, -1)
        .map((stop) => `${stop.location.lat},${stop.location.lng}`)
        .join('|');
      url += `&waypoints=${waypoints}`;
    }

    window.open(url, '_blank');
  };

  const startWazeNavigation = () => {
    if (stops.length === 0) return;

    // Warn if multiple stops - Waze only supports single destination
    if (stops.length > 1) {
      const confirmed = confirm(
        `⚠️ Waze Limitation\n\n` +
        `Waze only supports single destinations via URL.\n\n` +
        `This will navigate to the FIRST stop only:\n"${stops[0].address}"\n\n` +
        `Remaining ${stops.length - 1} stop(s) will NOT be included.\n\n` +
        `For multi-stop routes, use Google Maps instead.\n\n` +
        `Continue with Waze to first stop?`
      );

      if (!confirmed) {
        return; // User cancelled
      }
    }

    // For Waze, we'll navigate to the first stop
    // Waze doesn't support multi-stop routes via URL, so we open to the first destination
    // and the user can add additional stops in Waze if needed
    const firstStop = stops[0];

    // Waze URL scheme: waze://?ll=latitude,longitude&navigate=yes
    const wazeUrl = `https://waze.com/ul?ll=${firstStop.location.lat}%2C${firstStop.location.lng}&navigate=yes&zoom=17`;

    window.open(wazeUrl, '_blank');
  };

  const startRoute = () => {
    // Mark the start time when user begins navigation
    setRouteStartTime(Date.now());
  };

  const completeRoute = () => {
    if (stops.length === 0 || !routeDetails) {
      alert('No route to complete');
      return;
    }

    const endTime = Date.now();
    const startTime = routeStartTime || endTime;

    // Get vehicle info from localStorage
    const savedVehicles = localStorage.getItem('subroute_vehicles');
    let vehicleString = 'Unknown Vehicle';

    if (savedVehicles) {
      try {
        const vehicles = JSON.parse(savedVehicles);
        const defaultVehicle = vehicles.find((v: any) => v.isDefault);
        if (defaultVehicle) {
          vehicleString = `${defaultVehicle.make} ${defaultVehicle.model} (${defaultVehicle.plate})`;
        }
      } catch (e) {
        console.error('Failed to load vehicle info', e);
      }
    }

    // Create trip log entry
    const tripLog: TripLog = {
      id: Date.now().toString(),
      timestamp: endTime,
      date: new Date(endTime).toISOString().split('T')[0],
      startTime: new Date(startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date(endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      origin: stops[0]?.address || 'Unknown',
      destination: stops[stops.length - 1]?.address || 'Unknown',
      distanceKm: parseFloat(routeDetails.distance.replace(' km', '')),
      vehicleString,
      durationMinutes: parseInt(routeDetails.duration.replace(' min', '')),
    };

    // Save to localStorage
    try {
      const existingLogs = localStorage.getItem('subroute_logs');
      const logs: TripLog[] = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(tripLog);
      localStorage.setItem('subroute_logs', JSON.stringify(logs));

      // Show success message
      alert(`Trip logged successfully!\n\nDistance: ${routeDetails.distance}\nDuration: ${routeDetails.duration}\n\nView in Trip Info`);

      // Clear the route
      clearAll();
      setRouteStartTime(null);
    } catch (e) {
      console.error('Failed to save trip log', e);
      alert('Failed to save trip log');
    }
  };

  const saveDepotAddress = (address: string, location: google.maps.LatLngLiteral) => {
    const depot: Stop = {
      id: 'depot',
      address,
      location,
      type: 'depot',
    };
    setDepotAddress(depot);
    localStorage.setItem('subroute_depot', JSON.stringify(depot));
    setShowDepotModal(false);
    setDepotSearchValue('');
  };

  const addDepotAsStart = () => {
    if (!depotAddress) return;
    // Remove depot if already in stops
    const filtered = stops.filter((s) => !s.id.includes('depot'));
    setStops([{ ...depotAddress, id: 'depot-start' }, ...filtered]);
  };

  const addDepotAsEnd = () => {
    if (!depotAddress) return;
    // Remove depot if already in stops
    const filtered = stops.filter((s) => !s.id.includes('depot'));
    setStops([...filtered, { ...depotAddress, id: 'depot-end' }]);
  };

  const addDepotRoundTrip = () => {
    if (!depotAddress) return;
    // Remove depot if already in stops
    const filtered = stops.filter((s) => !s.id.includes('depot'));
    setStops([{ ...depotAddress, id: 'depot-start', type: 'depot' }, ...filtered, { ...depotAddress, id: 'depot-end', type: 'depot' }]);
  };

  const clearDepot = () => {
    setDepotAddress(null);
    localStorage.removeItem('subroute_depot');
  };

  const beginRouteFromDepot = () => {
    if (!depotAddress) {
      alert('Please set a depot address first');
      return;
    }

    // Check if depot already exists in stops
    const hasDepot = stops.some((s) => s.id.includes('depot'));

    if (!hasDepot) {
      // Add depot as first stop
      setStops([{ ...depotAddress, id: 'depot-start', type: 'depot' }]);
    }

    // Mark route as begun from depot
    setRouteBegunFromDepot(true);
  };

  const toggleTrafficLayer = () => {
    if (!trafficLayerRef.current || !googleMapRef.current) return;

    if (showTraffic) {
      trafficLayerRef.current.setMap(null);
    } else {
      trafficLayerRef.current.setMap(googleMapRef.current);
    }
    setShowTraffic(!showTraffic);
  };

  const startVoiceInput = () => {
    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    // Start listening
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-AU'; // Australian English
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;

      // Set the search value
      setSearchValue(transcript);
      if (searchInputRef.current) {
        searchInputRef.current.value = transcript;

        // Trigger Google Places autocomplete search
        const inputEvent = new Event('input', { bubbles: true });
        searchInputRef.current.dispatchEvent(inputEvent);

        // Focus the input to show autocomplete suggestions
        searchInputRef.current.focus();
      }

      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);

      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Initialize depot autocomplete when modal opens
  useEffect(() => {
    if (showDepotModal && depotSearchRef.current && !depotAutocompleteRef.current && window.google) {
      depotAutocompleteRef.current = new google.maps.places.Autocomplete(depotSearchRef.current, {
        componentRestrictions: { country: 'au' },
        fields: ['formatted_address', 'geometry', 'name'],
      });

      depotAutocompleteRef.current.addListener('place_changed', () => {
        const place = depotAutocompleteRef.current?.getPlace();
        if (!place || !place.geometry || !place.geometry.location) return;

        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        saveDepotAddress(place.formatted_address || place.name || 'Depot', location);
      });
    }
  }, [showDepotModal]);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Left Sidebar - Stops List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        {/* Search and Controls */}
        <div className="p-4 border-b border-gray-200">

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
              className="block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Search address..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <button
              onClick={startVoiceInput}
              className={`absolute inset-y-0 right-0 pr-3 flex items-center ${
                isListening ? 'text-red-600 animate-pulse' : 'text-gray-400 hover:text-blue-600'
              }`}
              title={isListening ? 'Listening...' : 'Voice input'}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
              </svg>
            </button>
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

          {/* Traffic Layer Toggle */}
          <button
            onClick={toggleTrafficLayer}
            className={`mt-2 w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium ${
              showTraffic
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>
            <span>{showTraffic ? 'Hide Traffic' : 'Show Traffic'}</span>
          </button>

          {/* Pickup/Delivery Choice Modal */}
          {pendingStop && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-900 mb-2 truncate">{pendingStop.address}</p>
              <p className="text-xs text-blue-700 mb-2">Add this stop as:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => addStop(pendingStop.address, pendingStop.location, 'pickup')}
                  className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-medium flex items-center justify-center space-x-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                  </svg>
                  <span>Pickup</span>
                </button>
                <button
                  onClick={() => addStop(pendingStop.address, pendingStop.location, 'delivery')}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium flex items-center justify-center space-x-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                  </svg>
                  <span>Delivery</span>
                </button>
              </div>
              <button
                onClick={() => setPendingStop(null)}
                className="mt-2 w-full text-xs text-blue-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Depot Address Section */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            {depotAddress ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Depot Address</span>
                  <button onClick={() => setShowDepotModal(true)} className="text-xs text-blue-600 hover:underline">
                    Change
                  </button>
                </div>
                <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                  <div className="flex items-start space-x-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                    </svg>
                    <p className="text-xs text-green-900 flex-1">{depotAddress.address}</p>
                  </div>
                </div>
                {!routeBegunFromDepot ? (
                  <>
                    {/* Big "Begin Route from Depot" button */}
                    <button
                      onClick={beginRouteFromDepot}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold flex items-center justify-center space-x-2 shadow-md"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                      </svg>
                      <span>Begin Route from Depot</span>
                    </button>
                    <p className="text-xs text-gray-500 text-center">
                      Start your day - depot will be added as first stop
                    </p>
                  </>
                ) : (
                  <>
                    {/* Route started indicator */}
                    <div className="bg-green-100 border border-green-300 rounded-lg p-2 mb-2">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span className="text-xs font-semibold text-green-900">Route started from depot</span>
                      </div>
                    </div>

                    {/* Original buttons for adding depot at end */}
                    <button
                      onClick={addDepotAsEnd}
                      className="w-full px-2 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                    >
                      Return to Depot (Add at End)
                    </button>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowDepotModal(true)}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium border border-green-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                </svg>
                <span>Set Depot Address</span>
              </button>
            )}
          </div>
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
              {stops.map((stop, index) => {
                const isPickup = stop.type === 'pickup';
                const isDelivery = stop.type === 'delivery';
                const isDepot = stop.type === 'depot';
                const bgColor = isPickup ? 'bg-amber-50 border-amber-200' : isDelivery ? 'bg-green-50 border-green-200' : isDepot ? 'bg-gray-50 border-gray-300' : 'bg-gray-50 border-gray-200';
                const markerColor = isPickup ? 'bg-amber-600' : isDelivery ? 'bg-green-600' : isDepot ? 'bg-gray-600' : 'bg-blue-600';

                return (
                  <div
                    key={stop.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`flex items-start space-x-2 p-3 rounded-lg border hover:opacity-80 cursor-move ${bgColor}`}
                  >
                    <div className="flex-shrink-0 flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path>
                      </svg>
                      <div className={`w-7 h-7 rounded-full ${markerColor} text-white flex items-center justify-center font-bold text-xs`}>
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-0.5">
                        <p className="text-sm font-medium text-gray-900 truncate flex-1">{stop.address}</p>
                      </div>
                      {(isPickup || isDelivery) && (
                        <button
                          onClick={() => toggleStopType(stop.id)}
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-semibold ${
                            isPickup ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isPickup ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                            )}
                          </svg>
                          <span>{isPickup ? 'PICKUP' : 'DELIVERY'}</span>
                        </button>
                      )}
                      {isDepot && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-600 text-white">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                          </svg>
                          <span>DEPOT</span>
                        </span>
                      )}
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
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {stops.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
            {/* Stop Summary */}
            {(() => {
              const pickupCount = stops.filter(s => s.type === 'pickup').length;
              const deliveryCount = stops.filter(s => s.type === 'delivery').length;
              const hasMultipleStops = stops.length > 2; // Show optimize if more than 2 stops

              return (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    {pickupCount > 0 && (
                      <span className="flex items-center space-x-1 text-amber-700 font-semibold">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                        </svg>
                        <span>{pickupCount} Pickup{pickupCount !== 1 ? 's' : ''}</span>
                      </span>
                    )}
                    {deliveryCount > 0 && (
                      <span className="flex items-center space-x-1 text-green-700 font-semibold">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                        </svg>
                        <span>{deliveryCount} Deliver{deliveryCount !== 1 ? 'y' : 'ies'}</span>
                      </span>
                    )}
                    {pickupCount === 0 && deliveryCount === 0 && (
                      <span className="text-gray-500 font-medium">{stops.length} Stop{stops.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {hasMultipleStops && (
                    <button
                      onClick={groupPickupsFirst}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 flex items-center space-x-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                      </svg>
                      <span>Optimize Route</span>
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Route Details */}
            {routeDetails && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                    </svg>
                    <span className="font-semibold text-blue-900">{routeDetails.distance}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span className="font-semibold text-blue-900">{routeDetails.duration}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            {stops.length >= 1 && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      startRoute();
                      startNavigation();
                    }}
                    className="px-3 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-xs flex items-center justify-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                    </svg>
                    <span>Google Maps</span>
                  </button>
                  <button
                    onClick={() => {
                      startRoute();
                      startWazeNavigation();
                    }}
                    className="px-3 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold text-xs flex items-center justify-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    </svg>
                    <span>Waze</span>
                  </button>
                </div>

                {/* Complete Route Button */}
                {routeStartTime && (
                  <button
                    onClick={completeRoute}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-sm flex items-center justify-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                    </svg>
                    <span>Complete Route & Log Trip</span>
                  </button>
                )}
              </div>
            )}

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

      {/* Depot Address Modal */}
      {showDepotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Set Depot Address</h2>
                <button
                  onClick={() => setShowDepotModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Set your home depot or warehouse address. This will be your default starting/ending point for routes.
              </p>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
                <input
                  ref={depotSearchRef}
                  type="text"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Search for depot address..."
                  value={depotSearchValue}
                  onChange={(e) => setDepotSearchValue(e.target.value)}
                />
              </div>

              {depotAddress && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={clearDepot}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Clear Depot Address
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
