import React, { useState, useEffect, useRef } from 'react';
import type { TripLog, User, Vehicle, FuelStop } from '../types';
import {
  saveUserPreferences,
  getUserPreferences,
  saveTripLog,
  getVehicles,
  saveAddressToHistory,
  getAddressHistory,
  saveFavoriteAddress,
  getFavoriteAddresses,
  deleteFavoriteAddress,
  subscribeToFavoriteAddresses,
  saveFuelStop,
  type SavedAddress,
  type FavoriteAddress
} from '../lib/firestore';

interface SimpleRoutePlannerProps {
  user: User;
  onBack?: () => void;
}

interface Stop {
  id: string;
  address: string;
  location: google.maps.LatLngLiteral;
  type?: 'pickup' | 'delivery' | 'depot';
  notes?: string;
}

export const SimpleRoutePlanner: React.FC<SimpleRoutePlannerProps> = ({ user, onBack }) => {
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
  const [depotAddress, setDepotAddress] = useState<Stop | null>(null);
  const [showDepotModal, setShowDepotModal] = useState(false);
  const [depotSearchValue, setDepotSearchValue] = useState('');
  const depotSearchRef = useRef<HTMLInputElement>(null);
  const depotAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [pendingStop, setPendingStop] = useState<{ address: string; location: google.maps.LatLngLiteral } | null>(null);
  const [routeStartTime, setRouteStartTime] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [routeBegunFromDepot, setRouteBegunFromDepot] = useState(false);
  const [addressHistory, setAddressHistory] = useState<SavedAddress[]>([]);
  const [favorites, setFavorites] = useState<FavoriteAddress[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavoriteModal, setShowFavoriteModal] = useState(false);
  const [favoriteToSave, setFavoriteToSave] = useState<{ address: string; location: google.maps.LatLngLiteral } | null>(null);
  const [favoriteName, setFavoriteName] = useState('');
  const [showMapOnMobile, setShowMapOnMobile] = useState(false);

  // Fuel stop modal state
  const [showFuelStopModal, setShowFuelStopModal] = useState(false);
  const [fuelStopLocation, setFuelStopLocation] = useState('');
  const [fuelStopLiters, setFuelStopLiters] = useState('');
  const [fuelStopCost, setFuelStopCost] = useState('');
  const [fuelStopOdometer, setFuelStopOdometer] = useState('');

  // Point-to-point trip tracking
  const [activeTrip, setActiveTrip] = useState<{
    origin: string;
    originLocation: google.maps.LatLngLiteral;
    destination: string;
    destinationLocation: google.maps.LatLngLiteral;
    startTime: number;
    distanceTraveled: number;
  } | null>(null);
  const [completedStops, setCompletedStops] = useState<Set<string>>(new Set());
  const gpsWatchId = useRef<number | null>(null);
  const lastGpsPosition = useRef<google.maps.LatLngLiteral | null>(null);
  const wakeLockRef = useRef<any>(null); // Wake Lock API to prevent screen sleep during tracking

  // PERSIST ROUTE STATE - Load on mount
  useEffect(() => {
    try {
      const savedRoute = localStorage.getItem(`subroute_active_route_${user.id}`);
      if (savedRoute) {
        const { stops: savedStops, routeDetails: savedDetails, routeStartTime: savedTime, depotStart, activeTrip: savedActiveTrip, completedStops: savedCompleted } = JSON.parse(savedRoute);
        if (savedStops && savedStops.length > 0) {
          setStops(savedStops);
          setRouteDetails(savedDetails || null);
          setRouteStartTime(savedTime || null);
          setRouteBegunFromDepot(depotStart || false);
          if (savedActiveTrip) {
            setActiveTrip(savedActiveTrip);
            lastGpsPosition.current = savedActiveTrip.originLocation;
          }
          if (savedCompleted) {
            setCompletedStops(new Set(savedCompleted));
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved route:', error);
    }
  }, [user.id]);

  // PERSIST ROUTE STATE - Save on change
  useEffect(() => {
    if (stops.length > 0 || routeDetails || routeStartTime || activeTrip || completedStops.size > 0) {
      try {
        const routeState = {
          stops,
          routeDetails,
          routeStartTime,
          depotStart: routeBegunFromDepot,
          activeTrip,
          completedStops: Array.from(completedStops)
        };
        localStorage.setItem(`subroute_active_route_${user.id}`, JSON.stringify(routeState));
        console.log('[SubRoute] Route state saved:', { activeTrip: activeTrip?.destination, completedCount: completedStops.size });
      } catch (error) {
        console.error('Error saving route:', error);
      }
    }
  }, [stops, routeDetails, routeStartTime, routeBegunFromDepot, activeTrip, completedStops, user.id]);

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

  // Load depot address from Firestore
  useEffect(() => {
    const loadDepotAddress = async () => {
      try {
        const prefs = await getUserPreferences(user.id);
        if (prefs.depotAddress) {
          setDepotAddress(JSON.parse(prefs.depotAddress));
        }
      } catch (error) {
        console.error('Error loading depot address:', error);
      }
    };
    loadDepotAddress();
  }, [user.id]);

  // Load address history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await getAddressHistory(user.id, 50);
        setAddressHistory(history);
      } catch (error) {
        console.error('Error loading address history:', error);
      }
    };
    loadHistory();
  }, [user.id]);

  // Subscribe to favorites
  useEffect(() => {
    const unsubscribe = subscribeToFavoriteAddresses(user.id, (favs) => {
      setFavorites(favs);
    });
    return () => unsubscribe();
  }, [user.id]);

  // GPS-BASED ARRIVAL DETECTION - Monitor location for arrival at destination
  useEffect(() => {
    if (!activeTrip) {
      // No active trip, stop GPS watching and release wake lock
      if (gpsWatchId.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchId.current);
        gpsWatchId.current = null;
      }
      // Release wake lock
      if (wakeLockRef.current !== null) {
        wakeLockRef.current.release().then(() => {
          console.log('[SubRoute] Wake lock released');
          wakeLockRef.current = null;
        }).catch((err: any) => {
          console.error('[SubRoute] Wake lock release error:', err);
        });
      }
      return;
    }

    // Request wake lock to keep screen on during trip tracking
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && wakeLockRef.current === null) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('[SubRoute] Wake lock acquired - screen will stay on during tracking');
        }
      } catch (err) {
        console.log('[SubRoute] Wake lock not supported or denied:', err);
      }
    };

    const startGPSTracking = () => {
      console.log('[SubRoute GPS] Starting GPS tracking for destination:', activeTrip.destination);

      if (navigator.geolocation && gpsWatchId.current === null) {
        gpsWatchId.current = navigator.geolocation.watchPosition(
          (position) => {
            const currentPos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };

            // Calculate distance traveled if we have a previous position
            if (lastGpsPosition.current) {
              const distance = calculateDistance(lastGpsPosition.current, currentPos);
              setActiveTrip(prev => prev ? { ...prev, distanceTraveled: prev.distanceTraveled + distance } : null);
            }
            lastGpsPosition.current = currentPos;

            // Check if we've arrived at destination (within 50 meters)
            const distanceToDestination = calculateDistance(currentPos, activeTrip.destinationLocation);
            console.log('[SubRoute GPS] Distance to destination:', (distanceToDestination * 1000).toFixed(0), 'meters');
            if (distanceToDestination <= 0.05) { // 50 meters = 0.05 km
              console.log('[SubRoute GPS] 🎯 Arrived at destination! Auto-logging trip...');
              logCompletedTrip();
            }
          },
          (error) => {
            console.error('[SubRoute GPS] GPS tracking error:', error);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000,
          }
        );
      }
    };

    // Request wake lock and start GPS tracking
    requestWakeLock();
    startGPSTracking();

    // Resume GPS tracking when page becomes visible again (user returns from navigation app)
    const handleVisibilityChange = () => {
      if (!document.hidden && activeTrip) {
        console.log('[SubRoute] Page visible again, resuming GPS tracking...');
        // Restart GPS if it was stopped
        if (gpsWatchId.current === null) {
          startGPSTracking();
        }
        // Reacquire wake lock if lost
        if (wakeLockRef.current === null) {
          requestWakeLock();
        }
      } else if (document.hidden) {
        console.log('[SubRoute] Page hidden (user switched apps)');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (gpsWatchId.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchId.current);
        gpsWatchId.current = null;
      }
      // Release wake lock on cleanup
      if (wakeLockRef.current !== null) {
        wakeLockRef.current.release().then(() => {
          console.log('[SubRoute] Wake lock released on cleanup');
          wakeLockRef.current = null;
        }).catch((err: any) => {
          console.error('[SubRoute] Wake lock release error:', err);
        });
      }
    };
  }, [activeTrip]);


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
        autocompleteRef.current.addListener('place_changed', async () => {
          const place = autocompleteRef.current?.getPlace();

          if (!place || !place.geometry || !place.geometry.location) {
            return;
          }

          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };

          const address = place.formatted_address || place.name || 'Unknown';

          // Save to history
          try {
            const savedAddress: SavedAddress = {
              id: `${location.lat}_${location.lng}`,
              address,
              location,
            };
            await saveAddressToHistory(user.id, savedAddress);
            // Reload history
            const history = await getAddressHistory(user.id, 50);
            setAddressHistory(history);
          } catch (error) {
            console.error('Error saving address to history:', error);
          }

          // Set as pending stop - user will choose pickup or delivery
          setPendingStop({
            address,
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

  const addFromHistory = (historyItem: SavedAddress, type: 'pickup' | 'delivery') => {
    addStop(historyItem.address, historyItem.location, type);
    setShowHistory(false);
  };

  const addFromFavorite = (favorite: FavoriteAddress, type: 'pickup' | 'delivery') => {
    addStop(favorite.address, favorite.location, type);
  };

  const openSaveFavoriteModal = (address: string, location: google.maps.LatLngLiteral) => {
    setFavoriteToSave({ address, location });
    setFavoriteName('');
    setShowFavoriteModal(true);
  };

  const saveFavorite = async () => {
    if (!favoriteToSave || !favoriteName.trim()) {
      alert('Please enter a name for this favorite');
      return;
    }

    try {
      const favorite: FavoriteAddress = {
        id: `${favoriteToSave.location.lat}_${favoriteToSave.location.lng}`,
        address: favoriteToSave.address,
        location: favoriteToSave.location,
        name: favoriteName.trim(),
        createdAt: Date.now(),
      };
      await saveFavoriteAddress(user.id, favorite);
      setShowFavoriteModal(false);
      setFavoriteToSave(null);
      setFavoriteName('');
    } catch (error) {
      console.error('Error saving favorite:', error);
      alert('Failed to save favorite');
    }
  };

  const deleteFavorite = async (favoriteId: string) => {
    if (!confirm('Remove this favorite?')) return;
    try {
      await deleteFavoriteAddress(user.id, favoriteId);
    } catch (error) {
      console.error('Error deleting favorite:', error);
      alert('Failed to delete favorite');
    }
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
    setActiveTrip(null);
    setCompletedStops(new Set());
    // Clear persisted route state
    try {
      localStorage.removeItem(`subroute_active_route_${user.id}`);
    } catch (error) {
      console.error('Error clearing saved route:', error);
    }
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

  // Log completed trip when arrival detected
  const logCompletedTrip = async () => {
    console.log('[SubRoute] logCompletedTrip called, activeTrip:', activeTrip);
    if (!activeTrip) {
      console.warn('[SubRoute] No active trip to log!');
      return;
    }

    const endTime = Date.now();
    const durationMinutes = Math.round((endTime - activeTrip.startTime) / (1000 * 60));
    console.log('[SubRoute] Trip duration:', durationMinutes, 'minutes, distance:', activeTrip.distanceTraveled, 'km');

    // Get vehicle info
    let vehicleString = 'Unknown Vehicle';
    try {
      const vehicles = await getVehicles(user.id);
      const defaultVehicle = vehicles.find((v: Vehicle) => v.isDefault);
      if (defaultVehicle) {
        vehicleString = `${defaultVehicle.make} ${defaultVehicle.model} (${defaultVehicle.plate})`;
      }
    } catch (e) {
      console.error('Failed to load vehicle info', e);
    }

    // Create trip log with actual GPS distance
    const tripLog: TripLog = {
      id: Date.now().toString(),
      timestamp: endTime,
      date: new Date(endTime).toISOString().split('T')[0],
      startTime: new Date(activeTrip.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date(endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      origin: activeTrip.origin,
      destination: activeTrip.destination,
      distanceKm: Math.round(activeTrip.distanceTraveled * 10) / 10, // Round to 1 decimal
      vehicleString,
      durationMinutes,
    };

    // Save to Firestore
    try {
      console.log('[SubRoute] Saving trip log to Firestore:', tripLog);
      await saveTripLog(user.id, tripLog);
      console.log('[SubRoute] ✅ Trip logged successfully to Firestore!', tripLog);

      // Mark this stop as completed
      const newCompletedStops = new Set(completedStops);
      newCompletedStops.add(activeTrip.destination);
      setCompletedStops(newCompletedStops);
      console.log('[SubRoute] Stop marked as completed:', activeTrip.destination);

      // Clear active trip
      setActiveTrip(null);
      lastGpsPosition.current = null;
      console.log('[SubRoute] Active trip cleared, ready for next trip');
    } catch (e) {
      console.error('[SubRoute] ❌ Failed to save trip log:', e);
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      alert('Failed to save trip log: ' + errorMsg);
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

  // Start navigation to a specific stop (point-to-point)
  const startNavigationToStop = (stop: Stop, navApp: 'google' | 'waze') => {
    console.log('[SubRoute] Starting navigation to:', stop.address, 'via', navApp);
    if (!currentLocation && !activeTrip) {
      console.warn('[SubRoute] No current location or active trip!');
      return;
    }

    // Determine origin: current location if first trip, or last destination if continuing
    const origin = activeTrip
      ? activeTrip.destinationLocation
      : (currentLocation || stops[0]?.location);

    const originAddress = activeTrip
      ? activeTrip.destination
      : (depotAddress?.address || 'Current Location');

    if (!origin) {
      console.error('[SubRoute] No origin available!');
      return;
    }

    // Start tracking this trip
    const newTrip = {
      origin: originAddress,
      originLocation: origin,
      destination: stop.address,
      destinationLocation: stop.location,
      startTime: Date.now(),
      distanceTraveled: 0,
    };
    console.log('[SubRoute] 🚗 Starting trip tracking:', newTrip);
    setActiveTrip(newTrip);
    lastGpsPosition.current = origin;

    // Open navigation app
    if (navApp === 'google') {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${stop.location.lat},${stop.location.lng}&travelmode=driving&dir_action=navigate`;
      window.open(url, '_blank');
    } else {
      const wazeUrl = `https://waze.com/ul?ll=${stop.location.lat}%2C${stop.location.lng}&navigate=yes&zoom=17`;
      window.open(wazeUrl, '_blank');
    }
  };

  // Manual complete for when GPS isn't accurate
  const manualCompleteStop = async (stop: Stop) => {
    if (!activeTrip || activeTrip.destination !== stop.address) {
      alert('No active trip to this destination');
      return;
    }
    await logCompletedTrip();
  };

  // Navigate all stops at once using Google Maps multi-waypoint
  const navigateAllStops = () => {
    if (stops.length === 0) return;

    // Get uncompleted stops only
    const uncompletedStops = stops.filter(s => !completedStops.has(s.address));
    if (uncompletedStops.length === 0) {
      alert('All stops are already completed!');
      return;
    }

    // Build Google Maps URL with waypoints
    const origin = currentLocation || uncompletedStops[0].location;
    const destination = uncompletedStops[uncompletedStops.length - 1].location;

    // Middle stops become waypoints
    const waypoints = uncompletedStops.slice(1, -1).map(s =>
      `${s.location.lat},${s.location.lng}`
    ).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;

    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }

    window.open(url, '_blank');

    // Note: Can't track individual trips in multi-waypoint mode
    alert('Note: Multi-stop navigation opened. You\'ll need to manually complete each stop for individual trip logging, or use individual navigation buttons for auto-logging.');
  };

  const openFuelStopModal = async () => {
    // Get current location (use geocoding to get address)
    if (currentLocation) {
      try {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ location: currentLocation });
        if (result.results && result.results[0]) {
          setFuelStopLocation(result.results[0].formatted_address);
        }
      } catch (e) {
        console.error('Failed to get current location address', e);
        setFuelStopLocation('');
      }
    }

    // Get default vehicle's current odometer
    try {
      const vehicles = await getVehicles(user.id);
      const defaultVehicle = vehicles.find((v: Vehicle) => v.isDefault);
      if (defaultVehicle && defaultVehicle.currentOdometer) {
        setFuelStopOdometer(defaultVehicle.currentOdometer.toString());
      } else if (defaultVehicle && defaultVehicle.startOdometer) {
        setFuelStopOdometer(defaultVehicle.startOdometer.toString());
      }
    } catch (e) {
      console.error('Failed to load vehicle odometer', e);
    }

    setShowFuelStopModal(true);
  };

  const saveFuelStopHandler = async () => {
    if (!fuelStopOdometer) {
      alert('Please enter odometer reading');
      return;
    }

    try {
      // Get default vehicle
      const vehicles = await getVehicles(user.id);
      const defaultVehicle = vehicles.find((v: Vehicle) => v.isDefault);
      if (!defaultVehicle) {
        alert('No default vehicle found. Please set up a vehicle first.');
        return;
      }

      const fuelStop: FuelStop = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        odometerReading: parseFloat(fuelStopOdometer),
        liters: fuelStopLiters ? parseFloat(fuelStopLiters) : undefined,
        costAUD: fuelStopCost ? parseFloat(fuelStopCost) : undefined,
        location: fuelStopLocation || undefined,
        tripId: routeStartTime ? routeStartTime.toString() : undefined, // Link to current trip if active
      };

      await saveFuelStop(user.id, defaultVehicle.id, fuelStop);

      alert('Fuel stop logged successfully!');

      // Reset form and close modal
      setFuelStopLocation('');
      setFuelStopLiters('');
      setFuelStopCost('');
      setFuelStopOdometer('');
      setShowFuelStopModal(false);
    } catch (e) {
      console.error('Failed to save fuel stop', e);
      alert('Failed to save fuel stop');
    }
  };

  const saveDepotAddress = async (address: string, location: google.maps.LatLngLiteral) => {
    const depot: Stop = {
      id: 'depot',
      address,
      location,
      type: 'depot',
    };
    setDepotAddress(depot);
    try {
      await saveUserPreferences(user.id, { depotAddress: JSON.stringify(depot) });
    } catch (error) {
      console.error('Error saving depot address:', error);
      alert('Failed to save depot address');
    }
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

  const clearDepot = async () => {
    setDepotAddress(null);
    try {
      await saveUserPreferences(user.id, { depotAddress: undefined });
    } catch (error) {
      console.error('Error clearing depot address:', error);
    }
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
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 relative">
      {/* Left Sidebar - Stops List */}
      <div className={`w-full md:w-80 bg-white md:border-r border-gray-200 flex flex-col shadow-lg ${showMapOnMobile ? 'hidden md:flex' : 'flex'}`}>
        {/* Search and Controls */}
        <div className="p-4 border-b border-gray-200">

          {/* Search Box */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="block w-full pl-12 pr-14 py-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base md:text-sm"
              placeholder="Search address..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            />
            <button
              onClick={startVoiceInput}
              className={`absolute inset-y-0 right-0 pr-3 flex items-center w-12 justify-center ${
                isListening ? 'text-red-600 animate-pulse' : 'text-gray-400 hover:text-blue-600 active:text-blue-700'
              }`}
              title={isListening ? 'Listening...' : 'Voice input'}
            >
              <svg className="h-7 w-7 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
              </svg>
            </button>

            {/* Address History Dropdown */}
            {showHistory && addressHistory.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Recent Addresses</p>
                </div>
                {addressHistory.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors"
                  >
                    <div className="px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-gray-900 truncate flex-1">{item.address}</p>
                        <button
                          onClick={() => openSaveFavoriteModal(item.address, item.location)}
                          className="ml-2 text-gray-400 hover:text-yellow-500 flex-shrink-0"
                          title="Save as favorite"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                          </svg>
                        </button>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => addFromHistory(item, 'pickup')}
                          className="flex-1 px-2 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700"
                        >
                          Pickup
                        </button>
                        <button
                          onClick={() => addFromHistory(item, 'delivery')}
                          className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                        >
                          Delivery
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <div className="mt-2 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
              <p className="text-sm font-semibold text-blue-900 mb-2 truncate">{pendingStop.address}</p>
              <p className="text-xs text-blue-700 mb-3">Add this stop as:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => addStop(pendingStop.address, pendingStop.location, 'pickup')}
                  className="px-4 py-4 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-bold text-sm flex flex-col items-center justify-center space-y-1 min-h-[70px] shadow-lg active:scale-95 transition-transform"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                  </svg>
                  <span>Pickup</span>
                </button>
                <button
                  onClick={() => {
                    addStop(pendingStop.address, pendingStop.location, 'delivery');
                    setPendingStop(null);
                  }}
                  className="px-4 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold text-sm flex flex-col items-center justify-center space-y-1 min-h-[70px] shadow-lg active:scale-95 transition-transform"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                  </svg>
                  <span>Delivery</span>
                </button>
              </div>
              <button
                onClick={() => setPendingStop(null)}
                className="mt-3 w-full text-sm text-blue-600 hover:underline font-medium"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Favorites Section */}
          {favorites.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase flex items-center space-x-1">
                  <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                  </svg>
                  <span>Favorites</span>
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="bg-yellow-50 rounded-lg p-2 border border-yellow-200"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-yellow-900 truncate">{fav.name}</p>
                        <p className="text-xs text-yellow-700 truncate">{fav.address}</p>
                      </div>
                      <button
                        onClick={() => deleteFavorite(fav.id)}
                        className="ml-2 text-gray-400 hover:text-red-600 flex-shrink-0"
                        title="Remove favorite"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => addFromFavorite(fav, 'pickup')}
                        className="flex-1 px-2 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700"
                      >
                        Pickup
                      </button>
                      <button
                        onClick={() => addFromFavorite(fav, 'delivery')}
                        className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                      >
                        Delivery
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stops List - COMPACT VERSION */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[40vh] md:max-h-none">
          {stops.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
              </svg>
              <p className="text-sm">No stops added yet</p>
              <p className="text-xs mt-1">Search for addresses above</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {stops.map((stop, index) => {
                const isPickup = stop.type === 'pickup';
                const isDelivery = stop.type === 'delivery';
                const isDepot = stop.type === 'depot';
                const isCompleted = completedStops.has(stop.address);
                const isActiveDestination = activeTrip?.destination === stop.address;
                const bgColor = isCompleted ? 'bg-gray-100 border-gray-300 opacity-60' : isPickup ? 'bg-amber-50 border-amber-200' : isDelivery ? 'bg-green-50 border-green-200' : isDepot ? 'bg-gray-50 border-gray-300' : 'bg-gray-50 border-gray-200';
                const markerColor = isCompleted ? 'bg-gray-400' : isPickup ? 'bg-amber-600' : isDelivery ? 'bg-green-600' : isDepot ? 'bg-gray-600' : 'bg-blue-600';

                return (
                  <div key={stop.id} className="space-y-1">
                    <div
                      draggable={!isCompleted}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`flex items-center space-x-2 p-2 rounded-lg border ${isCompleted ? '' : 'hover:opacity-80 cursor-move'} ${bgColor}`}
                    >
                      <div className="flex-shrink-0 flex items-center space-x-1.5">
                        {isCompleted ? (
                          <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                          </svg>
                        ) : (
                          <>
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path>
                            </svg>
                            <div className={`w-6 h-6 rounded-full ${markerColor} text-white flex items-center justify-center font-bold text-xs`}>
                              {index + 1}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate leading-tight">{stop.address}</p>
                        <div className="flex items-center space-x-1 mt-0.5">
                          {isCompleted && (
                            <span className="inline-flex items-center space-x-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-green-600 text-white">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                              </svg>
                              <span>TRIP LOGGED</span>
                            </span>
                          )}
                          {!isCompleted && (isPickup || isDelivery) && (
                            <button
                              onClick={() => toggleStopType(stop.id)}
                              className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isPickup ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              <span>{isPickup ? 'PICKUP' : 'DELIVERY'}</span>
                            </button>
                          )}
                          {isDepot && (
                            <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-600 text-white">
                              <span>DEPOT</span>
                            </span>
                          )}
                          {isActiveDestination && !isCompleted && (
                            <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white animate-pulse">
                              <span>EN ROUTE</span>
                            </span>
                          )}
                        </div>
                      </div>
                      {!isCompleted && (
                        <button
                          onClick={() => removeStop(stop.id)}
                          className="flex-shrink-0 text-gray-400 hover:text-red-600 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Navigation buttons for each uncompleted stop */}
                    {!isCompleted && (
                      <div className="grid grid-cols-3 gap-1 px-2">
                        <button
                          onClick={() => startNavigationToStop(stop, 'google')}
                          className="px-3 py-2.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 flex items-center justify-center space-x-1 min-h-[44px]"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                          </svg>
                          <span>Google</span>
                        </button>
                        <button
                          onClick={() => startNavigationToStop(stop, 'waze')}
                          className="px-3 py-2.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 flex items-center justify-center space-x-1 min-h-[44px]"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                          </svg>
                          <span>Waze</span>
                        </button>
                        {isActiveDestination && (
                          <button
                            onClick={() => manualCompleteStop(stop)}
                            className="px-3 py-2.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center justify-center space-x-1 min-h-[44px]"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <span>Done</span>
                          </button>
                        )}
                      </div>
                    )}
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
              <div className={`rounded-lg p-3 border ${routeStartTime ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <svg className={`w-4 h-4 ${routeStartTime ? 'text-green-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                    </svg>
                    <span className={`font-semibold ${routeStartTime ? 'text-green-900' : 'text-blue-900'}`}>{routeDetails.distance}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <svg className={`w-4 h-4 ${routeStartTime ? 'text-green-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span className={`font-semibold ${routeStartTime ? 'text-green-900' : 'text-blue-900'}`}>{routeDetails.duration}</span>
                  </div>
                </div>
                {routeStartTime && (
                  <div className="mt-2 pt-2 border-t border-green-200 flex items-center justify-center space-x-2 text-xs text-green-700 font-medium">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                    <span>Tracking - Trip will auto-log when complete</span>
                  </div>
                )}
              </div>
            )}

            {/* Navigate All Stops Button - Shows when multiple uncompleted stops */}
            {stops.filter(s => !completedStops.has(s.address)).length > 1 && !activeTrip && (
              <button
                onClick={navigateAllStops}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-sm flex items-center justify-center space-x-2 mb-2 min-h-[50px]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                </svg>
                <span>Navigate All Stops (Google Maps)</span>
              </button>
            )}

            {/* Fuel Stop Button - Shows when trip is active */}
            {activeTrip && (
              <button
                onClick={openFuelStopModal}
                className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-xs flex items-center justify-center space-x-2 mb-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <span>Log Fuel Stop</span>
              </button>
            )}

            {/* Compact Action Buttons - Side by Side */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={clearAll}
                className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm min-h-[44px]"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowMapOnMobile(true)}
                className="md:hidden px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm flex items-center justify-center space-x-1 min-h-[44px]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                </svg>
                <span>Map</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Side - Map */}
      <div className={`flex-1 relative ${showMapOnMobile ? 'flex' : 'hidden md:flex'}`}>
        {/* Mobile Back Button */}
        <button
          onClick={() => setShowMapOnMobile(false)}
          className="md:hidden absolute top-4 left-4 z-10 px-4 py-2 bg-white text-gray-700 rounded-lg shadow-lg hover:bg-gray-50 font-medium text-sm flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          <span>Back to Route</span>
        </button>
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

      {/* Save Favorite Modal */}
      {showFavoriteModal && favoriteToSave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                  </svg>
                  <span>Save as Favorite</span>
                </h2>
                <button
                  onClick={() => {
                    setShowFavoriteModal(false);
                    setFavoriteToSave(null);
                    setFavoriteName('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Address:</p>
                <p className="text-sm font-medium text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  {favoriteToSave.address}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Give this favorite a name
                </label>
                <input
                  type="text"
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  placeholder="e.g., Depot, Client - Joe's Pizza"
                  value={favoriteName}
                  onChange={(e) => setFavoriteName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      saveFavorite();
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowFavoriteModal(false);
                    setFavoriteToSave(null);
                    setFavoriteName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveFavorite}
                  className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
                >
                  Save Favorite
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fuel Stop Modal */}
      {showFuelStopModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                  <span>Log Fuel Stop</span>
                </h2>
                <button
                  onClick={() => setShowFuelStopModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Record your fuel stop. Odometer reading is required, other fields are optional.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location (Auto-detected)
                  </label>
                  <input
                    type="text"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                    placeholder="Service station address"
                    value={fuelStopLocation}
                    onChange={(e) => setFuelStopLocation(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Odometer Reading (km) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                    placeholder="12345"
                    value={fuelStopOdometer}
                    onChange={(e) => setFuelStopOdometer(e.target.value)}
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fuel Amount (Litres)
                  </label>
                  <input
                    type="number"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                    placeholder="45.5"
                    value={fuelStopLiters}
                    onChange={(e) => setFuelStopLiters(e.target.value)}
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cost (AUD)
                  </label>
                  <input
                    type="number"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                    placeholder="89.50"
                    value={fuelStopCost}
                    onChange={(e) => setFuelStopCost(e.target.value)}
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowFuelStopModal(false);
                    setFuelStopLocation('');
                    setFuelStopLiters('');
                    setFuelStopCost('');
                    setFuelStopOdometer('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveFuelStopHandler}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                >
                  Log Fuel Stop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
