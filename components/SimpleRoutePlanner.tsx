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
  deleteFavoriteAddress,
  subscribeToFavoriteAddresses,
  saveFuelStop,
  updateVehicleOdometer,
  getTripLogs,
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
  status: 'pending' | 'active' | 'done';
}

export const SimpleRoutePlanner: React.FC<SimpleRoutePlannerProps> = ({ user, onBack }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
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
  const [preferredNavApp, setPreferredNavApp] = useState<'google' | 'waze'>('google');

  // Voice search results (from AutocompleteService - works programmatically unlike the widget)
  const [voiceSearchResults, setVoiceSearchResults] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  // Fuel stop modal state
  const [showFuelStopModal, setShowFuelStopModal] = useState(false);
  const [fuelStopLocation, setFuelStopLocation] = useState('');
  const [fuelStopLiters, setFuelStopLiters] = useState('');
  const [fuelStopCost, setFuelStopCost] = useState('');
  const [fuelStopOdometer, setFuelStopOdometer] = useState('');
  const [fuelStopSaving, setFuelStopSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'stops' | 'map' | 'route'>('stops');

  // Sorted stops: active first, pending nearest-first, done last
  const sortedStops = React.useMemo(() => {
    const haversine = (loc1: google.maps.LatLngLiteral, loc2: google.maps.LatLngLiteral): number => {
      const R = 6371;
      const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
      const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const active = stops.filter(s => s.status === 'active');
    const pending = stops
      .filter(s => s.status === 'pending')
      .sort((a, b) => {
        if (!currentLocation) return 0;
        return haversine(currentLocation, a.location) - haversine(currentLocation, b.location);
      });
    const done = stops.filter(s => s.status === 'done');
    return [...active, ...pending, ...done];
  }, [stops, currentLocation]);

  // Point-to-point trip tracking
  const [activeTrip, setActiveTrip] = useState<{
    origin: string;
    originLocation: google.maps.LatLngLiteral;
    destination: string;
    destinationLocation: google.maps.LatLngLiteral;
    destinationStopId: string; // Track stop.id to mark as completed
    startTime: number;
  } | null>(null);
  const distanceTraveledRef = useRef<number>(0); // Mutable ref to avoid GPS effect restarts
  const gpsWatchId = useRef<number | null>(null);
  const lastGpsPosition = useRef<google.maps.LatLngLiteral | null>(null);
  const lastDestinationAddress = useRef<string | null>(null); // Track last completed destination for origin address
  const wakeLockRef = useRef<any>(null); // Wake Lock API to prevent screen sleep during tracking
  const isLoggingTrip = useRef<boolean>(false); // MUTEX: Prevent duplicate trip logging

  // PERSIST ROUTE STATE - Load on mount (auto-clear if from previous day)
  useEffect(() => {
    try {
      const savedRoute = localStorage.getItem(`subroute_active_route_${user.id}`);
      if (savedRoute) {
        const parsed = JSON.parse(savedRoute);
        const { stops: savedStops, routeDetails: savedDetails, routeStartTime: savedTime, depotStart, activeTrip: savedActiveTrip, completedStops: savedCompleted, savedDate } = parsed;

        // Auto-clear if saved route is from a previous day
        const today = new Date().toISOString().split('T')[0];
        if (savedDate && savedDate !== today) {
          console.log('[SubRoute] Route from previous day detected (' + savedDate + '), auto-clearing');
          localStorage.removeItem(`subroute_active_route_${user.id}`);
          return;
        }

        if (savedStops && savedStops.length > 0) {
          // Migrate old saves that lack status field
          const migratedStops = savedStops.map((s: Stop) => {
            if (s.status) return s;
            if (savedCompleted && savedCompleted.includes(s.id)) return { ...s, status: 'done' as const };
            if (savedActiveTrip && savedActiveTrip.destinationStopId === s.id) return { ...s, status: 'active' as const };
            return { ...s, status: 'pending' as const };
          });
          setStops(migratedStops);
          setRouteDetails(savedDetails || null);
          setRouteStartTime(savedTime || null);
          setRouteBegunFromDepot(depotStart || false);
          if (savedActiveTrip) {
            setActiveTrip(savedActiveTrip);
            lastGpsPosition.current = savedActiveTrip.originLocation;
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved route:', error);
    }
  }, [user.id]);

  // PERSIST ROUTE STATE - Save on change
  useEffect(() => {
    if (stops.length > 0 || routeDetails || routeStartTime || activeTrip) {
      try {
        const routeState = {
          stops,
          routeDetails,
          routeStartTime,
          depotStart: routeBegunFromDepot,
          activeTrip,
          savedDate: new Date().toISOString().split('T')[0],
        };
        localStorage.setItem(`subroute_active_route_${user.id}`, JSON.stringify(routeState));
        console.log('[SubRoute] Route state saved:', { activeTrip: activeTrip?.destination, doneCount: stops.filter(s => s.status === 'done').length });
      } catch (error) {
        console.error('Error saving route:', error);
      }
    }
  }, [stops, routeDetails, routeStartTime, routeBegunFromDepot, activeTrip, user.id]);

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

  // Load depot address and navigation preference from Firestore
  useEffect(() => {
    const loadUserPrefs = async () => {
      try {
        const prefs = await getUserPreferences(user.id);
        if (prefs.depotAddress) {
          setDepotAddress(JSON.parse(prefs.depotAddress));
        }
        if (prefs.preferredNavApp) {
          setPreferredNavApp(prefs.preferredNavApp);
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      }
    };
    loadUserPrefs();
  }, [user.id]);

  // Load address history with offline caching
  useEffect(() => {
    const loadHistory = async () => {
      const cacheKey = `subroute_address_history_${user.id}`;

      // 1. Load from localStorage first (offline support)
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedHistory = JSON.parse(cached);
          setAddressHistory(cachedHistory);
          console.log('[SubRoute] Loaded', cachedHistory.length, 'addresses from offline cache');
        }
      } catch (error) {
        console.error('Error loading cached history:', error);
      }

      // 2. Fetch from Firestore and update cache (online)
      try {
        const history = await getAddressHistory(user.id, 50);
        setAddressHistory(history);
        // Save to localStorage for offline access
        localStorage.setItem(cacheKey, JSON.stringify(history));
        console.log('[SubRoute] Synced', history.length, 'addresses from Firestore to cache');
      } catch (error) {
        console.error('Error loading address history from Firestore:', error);
        // If offline, cached data is already loaded above
      }
    };
    loadHistory();
  }, [user.id]);

  // Subscribe to favorites with offline caching
  useEffect(() => {
    const cacheKey = `subroute_favorites_${user.id}`;

    // Load from localStorage first (offline support)
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedFavorites = JSON.parse(cached);
        setFavorites(cachedFavorites);
        console.log('[SubRoute] Loaded', cachedFavorites.length, 'favorites from offline cache');
      }
    } catch (error) {
      console.error('Error loading cached favorites:', error);
    }

    // Subscribe to Firestore updates and cache them
    const unsubscribe = subscribeToFavoriteAddresses(user.id, (favs) => {
      setFavorites(favs);
      localStorage.setItem(cacheKey, JSON.stringify(favs));
      console.log('[SubRoute] Synced', favs.length, 'favorites to cache');
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
              distanceTraveledRef.current += distance;
            }
            lastGpsPosition.current = currentPos;

            // CRITICAL: Only check arrival if activeTrip still exists (not already logged)
            if (!activeTrip) {
              return;
            }

            // Check if we've arrived at destination (within 50 meters)
            const distanceToDestination = calculateDistance(currentPos, activeTrip.destinationLocation);
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

      // Initialize AutocompleteService and PlacesService for voice search
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      placesServiceRef.current = new google.maps.places.PlacesService(googleMapRef.current);

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

          // Show bottom sheet immediately — don't wait for Firestore
          setPendingStop({ address, location });
          setSearchValue('');
          if (searchInputRef.current) {
            searchInputRef.current.value = '';
          }

          // Save to history in the background (don't block UI)
          const savedAddress: SavedAddress = {
            id: `${location.lat}_${location.lng}`,
            address,
            location,
          };
          saveAddressToHistory(user.id, savedAddress).then(async (useCount) => {
            // Auto-promote to favorites after 4 visits (if not already favorited)
            if (useCount >= 4) {
              const isAlreadyFavorite = favorites.some(fav => fav.id === savedAddress.id);
              if (!isAlreadyFavorite) {
                const autoFavorite: FavoriteAddress = {
                  ...savedAddress,
                  name: `📍 ${address.split(',')[0]}`,
                  createdAt: Date.now(),
                };
                await saveFavoriteAddress(user.id, autoFavorite);
                alert(`🌟 Added to favorites: ${address.split(',')[0]} (${useCount} visits)`);
              }
            }
            // Update history cache after save
            const history = await getAddressHistory(user.id, 50);
            setAddressHistory(history);
            localStorage.setItem(`subroute_address_history_${user.id}`, JSON.stringify(history));
          }).catch((error) => {
            console.error('Error saving address to history:', error);
          });
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

  // Add stop AND auto-navigate with preferred app (streamlined flow)
  const addStopAndNavigate = (address: string, location: google.maps.LatLngLiteral, type: 'pickup' | 'delivery') => {
    const newStop: Stop = {
      id: Date.now().toString(),
      address,
      location,
      type,
      status: 'pending',
    };

    const updatedStops = [...stops, newStop];
    setStops(updatedStops);
    setPendingStop(null);

    // Persist updated stops synchronously before navigation redirects away
    persistRouteStateSync({ stops: updatedStops });

    // Auto-navigate with preferred app
    startNavigationToStop(newStop, preferredNavApp);
  };

  const addFromHistory = (historyItem: SavedAddress, type: 'pickup' | 'delivery') => {
    addStopAndNavigate(historyItem.address, historyItem.location, type);
    setShowHistory(false);
  };

  const addFromFavorite = (favorite: FavoriteAddress, type: 'pickup' | 'delivery') => {
    addStopAndNavigate(favorite.address, favorite.location, type);
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

  const optimizeRouteWithDirections = async () => {
    const uncompleted = stops.filter(s => s.status !== 'done');
    if (uncompleted.length < 3) {
      alert('Add at least 3 stops to optimize the route.');
      return;
    }
    if (!directionsServiceRef.current) {
      alert('Maps not ready yet. Please wait a moment and try again.');
      return;
    }

    setIsOptimizing(true);
    try {
      const origin = currentLocation || uncompleted[0].location;
      const destinationStop = uncompleted[uncompleted.length - 1];
      const waypointStops = uncompleted.slice(0, -1);

      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsServiceRef.current!.route(
          {
            origin,
            destination: new google.maps.LatLng(destinationStop.location.lat, destinationStop.location.lng),
            waypoints: waypointStops.map(s => ({
              location: new google.maps.LatLng(s.location.lat, s.location.lng),
              stopover: true,
            })),
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
            region: 'AU',
          },
          (res, status) => {
            if (status === 'OK' && res) resolve(res);
            else reject(new Error('Directions failed: ' + status));
          }
        );
      });

      const optimalOrder = result.routes[0].waypoint_order;
      const reorderedWaypoints = optimalOrder.map(i => waypointStops[i]);
      const newUncompleted = [...reorderedWaypoints, destinationStop];

      const doneList = stops.filter(s => s.status === 'done');
      setStops([...newUncompleted, ...doneList]);
      console.log('[SubRoute] Route optimized via Directions API, order:', optimalOrder);
    } catch (e) {
      console.error('[SubRoute] Route optimization failed:', e);
      alert('Could not optimize route. Check your connection and try again.');
    } finally {
      setIsOptimizing(false);
    }
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
    // completedStops removed — status is now on each Stop
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

  // Get route distance from Google Directions API
  const getRouteDistance = async (origin: google.maps.LatLngLiteral, destination: google.maps.LatLngLiteral): Promise<number> => {
    return new Promise((resolve) => {
      if (!directionsServiceRef.current) {
        console.warn('[SubRoute] Directions service not available, using fallback');
        resolve(0);
        return;
      }

      directionsServiceRef.current.route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK' && result && result.routes[0]?.legs[0]?.distance) {
            const distanceKm = result.routes[0].legs[0].distance.value / 1000;
            console.log('[SubRoute] Google Directions distance:', distanceKm, 'km');
            resolve(distanceKm);
          } else {
            console.warn('[SubRoute] Directions request failed:', status);
            resolve(0);
          }
        }
      );
    });
  };

  // Log completed trip when arrival detected
  // isPartialTrip = true when user switches destinations mid-route (uses current GPS as destination)
  const logCompletedTrip = async (isPartialTrip: boolean = false) => {
    console.log('[SubRoute] logCompletedTrip called, activeTrip:', activeTrip, 'isPartialTrip:', isPartialTrip, 'isLogging:', isLoggingTrip.current);

    // MUTEX CHECK: If already logging, skip to prevent duplicates
    if (isLoggingTrip.current) {
      console.warn('[SubRoute] ⚠️ Already logging a trip, skipping duplicate call');
      return;
    }

    if (!activeTrip) {
      console.warn('[SubRoute] No active trip to log!');
      return;
    }

    // SET MUTEX IMMEDIATELY - This is synchronous and prevents race conditions
    isLoggingTrip.current = true;
    console.log('[SubRoute] 🔒 Mutex locked - logging trip');

    // Capture activeTrip data
    const tripToLog = { ...activeTrip };
    const endTime = Date.now();
    const durationMinutes = Math.round((endTime - tripToLog.startTime) / (1000 * 60));

    console.log('[SubRoute] Trip duration:', durationMinutes, 'minutes');

    // Clear activeTrip state
    setActiveTrip(null);
    console.log('[SubRoute] Active trip state cleared');

    // For partial trips, use current GPS position as actual destination
    let actualDestinationLocation = tripToLog.destinationLocation;
    let actualDestinationAddress = tripToLog.destination;

    if (isPartialTrip && lastGpsPosition.current) {
      actualDestinationLocation = lastGpsPosition.current;
      actualDestinationAddress = 'Current Position (partial trip)';
      console.log('[SubRoute] Partial trip - using current GPS as destination:', actualDestinationLocation);
    }

    // Fetch road distance and vehicle info in parallel
    const [distanceResult, vehiclesResult] = await Promise.allSettled([
      getRouteDistance(tripToLog.originLocation, actualDestinationLocation),
      getVehicles(user.id),
    ]);

    let distanceKm = distanceResult.status === 'fulfilled' ? distanceResult.value : 0;
    if (distanceKm === 0) {
      const straightLine = calculateDistance(tripToLog.originLocation, actualDestinationLocation);
      distanceKm = straightLine * 1.3;
      console.log('[SubRoute] Using straight-line fallback:', distanceKm.toFixed(1), 'km');
    } else {
      console.log('[SubRoute] Route distance from Google:', distanceKm, 'km');
    }

    let vehicleString = 'Unknown Vehicle';
    if (vehiclesResult.status === 'fulfilled') {
      const defaultVehicle = vehiclesResult.value.find((v: Vehicle) => v.isDefault);
      if (defaultVehicle) {
        vehicleString = `${defaultVehicle.make} ${defaultVehicle.model} (${defaultVehicle.plate})`;
      }
    } else {
      console.error('Failed to load vehicle info', vehiclesResult.reason);
    }

    // Create trip log with actual destination (original or current GPS for partial trips)
    const tripLog: TripLog = {
      id: Date.now().toString(),
      timestamp: endTime,
      date: new Date(endTime).toISOString().split('T')[0],
      startTime: new Date(tripToLog.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date(endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      origin: tripToLog.origin,
      destination: isPartialTrip ? `${tripToLog.destination} (partial)` : tripToLog.destination,
      distanceKm: Math.round(distanceKm * 10) / 10, // Round to 1 decimal
      vehicleString,
      durationMinutes,
    };

    // Save to Firestore
    try {
      console.log('[SubRoute] Saving trip log to Firestore:', tripLog);
      await saveTripLog(user.id, tripLog);
      console.log('[SubRoute] ✅ Trip logged successfully to Firestore!', tripLog);

      // For partial trips, don't mark stop as done (they didn't actually arrive)
      // For complete trips, mark stop as done
      if (!isPartialTrip) {
        setStops(prev => prev.map(s =>
          s.id === tripToLog.destinationStopId ? { ...s, status: 'done' } : s
        ));
        console.log('[SubRoute] Stop marked as done:', tripToLog.destination, 'ID:', tripToLog.destinationStopId);
      } else {
        console.log('[SubRoute] Partial trip - stop NOT marked as done');
      }

      // Save the actual destination location and address as the starting point for next trip
      lastGpsPosition.current = actualDestinationLocation;
      lastDestinationAddress.current = isPartialTrip ? actualDestinationAddress : tripToLog.destination;
      console.log('[SubRoute] Last GPS position updated:', actualDestinationLocation);
      console.log('[SubRoute] Last destination address saved:', lastDestinationAddress.current);
      console.log('[SubRoute] ✅ Trip logging complete, ready for next trip');

      // RELEASE MUTEX after successful logging
      isLoggingTrip.current = false;
      console.log('[SubRoute] 🔓 Mutex released');
    } catch (e) {
      console.error('[SubRoute] ❌ Failed to save trip log:', e);
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      alert('Failed to save trip log: ' + errorMsg);

      // RELEASE MUTEX even on error
      isLoggingTrip.current = false;
      console.log('[SubRoute] 🔓 Mutex released (after error)');
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

  // Synchronously persist route state to localStorage (don't rely on React effect)
  const persistRouteStateSync = (overrides: {
    activeTrip?: typeof activeTrip;
    stops?: Stop[];
  } = {}) => {
    try {
      const routeState = {
        stops: overrides.stops ?? stops,
        routeDetails,
        routeStartTime,
        depotStart: routeBegunFromDepot,
        activeTrip: overrides.activeTrip !== undefined ? overrides.activeTrip : activeTrip,
        savedDate: new Date().toISOString().split('T')[0],
      };
      localStorage.setItem(`subroute_active_route_${user.id}`, JSON.stringify(routeState));
      console.log('[SubRoute] Route state persisted synchronously');
    } catch (error) {
      console.error('[SubRoute] Failed to persist route state:', error);
    }
  };

  // Start navigation to a specific stop - zero friction, address-based URLs
  const startNavigationToStop = (stop: Stop, navApp: 'google' | 'waze') => {
    console.log('[SubRoute] Starting navigation to:', stop.address, 'via', navApp);

    // If there's an active trip to a DIFFERENT destination, silently log it as partial
    if (activeTrip && activeTrip.destinationStopId !== stop.id) {
      console.log('[SubRoute] Active trip to:', activeTrip.destination, '- silently logging partial trip');
      logCompletedTrip(true);
    }

    // Set tapped stop to active, return any currently active stop to pending
    setStops(prev => prev.map(s => {
      if (s.id === stop.id) return { ...s, status: 'active' };
      if (s.status === 'active') return { ...s, status: 'pending' };
      return s;
    }));

    const origin = lastGpsPosition.current || currentLocation || null;
    const originAddress = lastDestinationAddress.current || depotAddress?.address || 'Current Location';

    distanceTraveledRef.current = 0;
    const newTrip = {
      origin: originAddress,
      originLocation: origin || stop.location,
      destination: stop.address,
      destinationLocation: stop.location,
      destinationStopId: stop.id,
      startTime: Date.now(),
    };
    console.log('[SubRoute] Starting NEW trip tracking:', newTrip);
    setActiveTrip(newTrip);
    if (origin) lastGpsPosition.current = origin;

    // CRITICAL: Persist to localStorage SYNCHRONOUSLY before navigating away
    persistRouteStateSync({ activeTrip: newTrip });

    // Use address text — far more accurate entry point than raw coordinates
    const encodedAddress = encodeURIComponent(stop.address);
    try {
      if (navApp === 'google') {
        const url = origin
          ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${encodedAddress}&travelmode=driving&dir_action=navigate`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving&dir_action=navigate`;
        console.log('[SubRoute] Opening Google Maps:', url);
        window.location.href = url;
      } else {
        const wazeUrl = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
        console.log('[SubRoute] Opening Waze:', wazeUrl);
        window.location.href = wazeUrl;
      }
    } catch (e) {
      console.error('[SubRoute] Failed to open navigation app:', e);
      alert('Failed to open navigation app. Please try again.');
    }
  };

  // Mark a stop done — no redirect, no prompt, silently logs trip
  const handleDone = async (stop: Stop) => {
    // Update status immediately so UI responds instantly
    setStops(prev => prev.map(s =>
      s.id === stop.id ? { ...s, status: 'done' } : s
    ));
    if (activeTrip && activeTrip.destinationStopId === stop.id) {
      await logCompletedTrip(false);
    } else {
      setActiveTrip(null);
    }
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

    // Auto-calculate odometer: start from vehicle's base odometer + total logged km
    try {
      const [vehicles, trips] = await Promise.all([getVehicles(user.id), getTripLogs(user.id)]);
      const defaultVehicle = vehicles.find((v: Vehicle) => v.isDefault);
      if (defaultVehicle) {
        if (defaultVehicle.currentOdometer) {
          const today = new Date().toISOString().split('T')[0];
          const todayKm = trips
            .filter(t => t.date === today)
            .reduce((sum, t) => sum + t.distanceKm, 0);
          setFuelStopOdometer(Math.round(defaultVehicle.currentOdometer + todayKm).toString());
        } else if (defaultVehicle.startOdometer) {
          const totalKm = trips.reduce((sum, t) => sum + t.distanceKm, 0);
          setFuelStopOdometer(Math.round(defaultVehicle.startOdometer + totalKm).toString());
        }
      }
    } catch (e) {
      console.error('Failed to load vehicle odometer', e);
    }

    setShowFuelStopModal(true);
  };

  // Save a pending fuel stop to localStorage backup queue
  const saveFuelStopToBackup = (vehicleId: string, fuelStop: FuelStop) => {
    try {
      const key = `subroute_pending_fuel_stops_${user.id}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({ vehicleId, fuelStop });
      localStorage.setItem(key, JSON.stringify(existing));
      console.log('[SubRoute] Fuel stop saved to localStorage backup');
    } catch (err) {
      console.error('[SubRoute] Failed to save fuel stop backup:', err);
    }
  };

  // Retry any pending fuel stops from localStorage on mount
  useEffect(() => {
    const retryPendingFuelStops = async () => {
      const key = `subroute_pending_fuel_stops_${user.id}`;
      try {
        const pending = JSON.parse(localStorage.getItem(key) || '[]');
        if (pending.length === 0) return;

        console.log(`[SubRoute] Retrying ${pending.length} pending fuel stop(s)...`);
        const stillPending: typeof pending = [];

        for (const item of pending) {
          try {
            await saveFuelStop(user.id, item.vehicleId, item.fuelStop);
            console.log('[SubRoute] Pending fuel stop saved successfully:', item.fuelStop.id);
          } catch (e) {
            console.error('[SubRoute] Retry failed for fuel stop:', item.fuelStop.id, e);
            stillPending.push(item);
          }
        }

        if (stillPending.length > 0) {
          localStorage.setItem(key, JSON.stringify(stillPending));
          console.log(`[SubRoute] ${stillPending.length} fuel stop(s) still pending`);
        } else {
          localStorage.removeItem(key);
          console.log('[SubRoute] All pending fuel stops synced');
        }
      } catch (err) {
        console.error('[SubRoute] Error retrying pending fuel stops:', err);
      }
    };

    retryPendingFuelStops();
  }, [user.id]);

  const saveFuelStopHandler = async () => {
    if (!fuelStopOdometer) {
      alert('Please enter odometer reading');
      return;
    }

    if (fuelStopSaving) return; // Prevent double-tap
    setFuelStopSaving(true);

    try {
      // Get default vehicle
      const vehicles = await getVehicles(user.id);
      const defaultVehicle = vehicles.find((v: Vehicle) => v.isDefault);
      if (!defaultVehicle) {
        alert('No default vehicle found. Please set up a vehicle in Settings first.');
        setFuelStopSaving(false);
        return;
      }

      if (!defaultVehicle.id) {
        alert('Vehicle data is missing an ID. Please re-add the vehicle in Settings.');
        setFuelStopSaving(false);
        return;
      }

      const fuelStop: FuelStop = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        odometerReading: parseFloat(fuelStopOdometer),
        liters: fuelStopLiters ? parseFloat(fuelStopLiters) : undefined,
        costAUD: fuelStopCost ? parseFloat(fuelStopCost) : undefined,
        location: fuelStopLocation || undefined,
        tripId: routeStartTime ? routeStartTime.toString() : undefined,
      };

      try {
        await saveFuelStop(user.id, defaultVehicle.id, fuelStop);

        // Update vehicle's current odometer to the new reading
        try {
          await updateVehicleOdometer(user.id, defaultVehicle.id, fuelStop.odometerReading);
          console.log('[SubRoute] Vehicle odometer updated to:', fuelStop.odometerReading);
        } catch (odoErr) {
          console.error('[SubRoute] Failed to update vehicle odometer:', odoErr);
        }

        alert('Fuel stop logged! Odometer updated to ' + fuelStop.odometerReading + ' km');
      } catch (firebaseError) {
        // Firebase failed - save to localStorage backup
        console.error('[SubRoute] Firebase fuel stop save failed, backing up locally:', firebaseError);
        saveFuelStopToBackup(defaultVehicle.id, fuelStop);
        const errorMsg = firebaseError instanceof Error ? firebaseError.message : 'Unknown error';
        alert('Fuel stop saved locally (Firebase error: ' + errorMsg + '). It will auto-sync next time you open the app.');
      }

      // Reset form and close modal - data is saved either way
      setFuelStopLocation('');
      setFuelStopLiters('');
      setFuelStopCost('');
      setFuelStopOdometer('');
      setShowFuelStopModal(false);
    } catch (e) {
      console.error('Failed to save fuel stop', e);
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      alert('Failed to save fuel stop: ' + errorMsg);
    } finally {
      setFuelStopSaving(false);
    }
  };

  const saveDepotAddress = async (address: string, location: google.maps.LatLngLiteral) => {
    const depot: Stop = {
      id: 'depot',
      address,
      location,
      type: 'depot',
      status: 'pending',
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

  const clearDepot = async () => {
    setDepotAddress(null);
    try {
      await saveUserPreferences(user.id, { depotAddress: undefined });
    } catch (error) {
      console.error('Error clearing depot address:', error);
    }
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
      console.log('[SubRoute Voice] Transcript:', transcript);

      // Set the search value in the input
      setSearchValue(transcript);
      if (searchInputRef.current) {
        searchInputRef.current.value = transcript;
      }

      setIsListening(false);

      // Use AutocompleteService to search (works programmatically, unlike the widget)
      if (autocompleteServiceRef.current && transcript.trim()) {
        const request: google.maps.places.AutocompletionRequest = {
          input: transcript,
          componentRestrictions: { country: 'au' },
        };

        // Add location bias if we have current location
        if (currentLocation) {
          request.location = new google.maps.LatLng(currentLocation.lat, currentLocation.lng);
          request.radius = 50000; // 50km bias radius
        }

        autocompleteServiceRef.current.getPlacePredictions(request, (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            console.log('[SubRoute Voice] Got', predictions.length, 'predictions');
            setVoiceSearchResults(predictions);
          } else {
            console.warn('[SubRoute Voice] Autocomplete failed:', status);
            setVoiceSearchResults([]);
          }
        });
      }
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
    if (!showDepotModal || !depotSearchRef.current || !window.google) {
      depotAutocompleteRef.current = null; // Reset so it re-attaches next open
      return;
    }
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
  }, [showDepotModal]);

  // Handle selecting a voice search result
  const selectVoiceResult = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesServiceRef.current) return;

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['formatted_address', 'geometry', 'name'],
      },
      async (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place || !place.geometry?.location) {
          console.error('[SubRoute Voice] Failed to get place details:', status);
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
          const useCount = await saveAddressToHistory(user.id, savedAddress);

          // Auto-promote to favorites after 4 visits
          if (useCount >= 4) {
            const isAlreadyFavorite = favorites.some(fav => fav.id === savedAddress.id);
            if (!isAlreadyFavorite) {
              const autoFavorite: FavoriteAddress = {
                ...savedAddress,
                name: `📍 ${address.split(',')[0]}`,
                createdAt: Date.now(),
              };
              await saveFavoriteAddress(user.id, autoFavorite);
            }
          }

          const history = await getAddressHistory(user.id, 50);
          setAddressHistory(history);
          localStorage.setItem(`subroute_address_history_${user.id}`, JSON.stringify(history));
        } catch (error) {
          console.error('Error saving address to history:', error);
        }

        // Set as pending stop
        setPendingStop({ address, location });

        // Clear search and voice results
        setSearchValue('');
        setVoiceSearchResults([]);
        if (searchInputRef.current) {
          searchInputRef.current.value = '';
        }
      }
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] h-[calc(100dvh-64px)] bg-gray-50 relative">
      {/* ===== DESKTOP LAYOUT (md and up): sidebar + map ===== */}
      {/* Left Sidebar - Stops List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg hidden md:flex">
        {/* Search and Controls */}
        <div className="p-4 border-b border-gray-200">

          {/* Search Box */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="block w-full pl-11 pr-14 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
              </svg>
            </button>

            {/* Voice Search Results Dropdown */}
            {voiceSearchResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                <div className="flex justify-end px-2 pt-1.5">
                  <button
                    onClick={() => setVoiceSearchResults([])}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
                {voiceSearchResults.map((prediction) => (
                  <button
                    key={prediction.place_id}
                    onClick={() => selectVoiceResult(prediction)}
                    className="w-full text-left px-4 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <p className="text-base font-semibold text-gray-900">{prediction.structured_formatting.main_text}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{prediction.structured_formatting.secondary_text}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Address History Dropdown */}
            {showHistory && addressHistory.length > 0 && voiceSearchResults.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Recent</p>
                </div>
                {addressHistory.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <div className="px-4 py-2.5">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.address}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => addFromHistory(item, 'pickup')}
                          className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 active:scale-95 transition-all"
                        >
                          Pickup
                        </button>
                        <button
                          onClick={() => addFromHistory(item, 'delivery')}
                          className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 active:scale-95 transition-all"
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

          {/* Quick Action Toolbar */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={addCurrentLocation}
              title="Add current location as a stop"
              className="flex-1 flex items-center justify-center py-2.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-500 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </button>
            <button
              onClick={toggleTrafficLayer}
              title={showTraffic ? 'Hide traffic layer' : 'Show traffic layer'}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-lg transition-colors ${
                showTraffic
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
            </button>
            {activeTrip && (
              <button
                onClick={openFuelStopModal}
                title="Log fuel stop"
                className="flex-1 flex items-center justify-center py-2.5 bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </button>
            )}
            <button
              onClick={() => setShowDepotModal(true)}
              title={depotAddress ? `Depot: ${depotAddress.address}` : 'Set depot address'}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-lg transition-colors ${
                depotAddress
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
              </svg>
            </button>
          </div>


          {/* Favorites — horizontal scrollable chips */}
          {favorites.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {favorites.map((fav) => (
                  <button
                    key={fav.id}
                    onClick={() => setPendingStop({ address: fav.address, location: fav.location })}
                    title={fav.address}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 text-yellow-900 text-xs font-semibold rounded-full transition-colors"
                  >
                    <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                    </svg>
                    <span className="truncate max-w-[100px]">{fav.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stops List */}
        <div className="flex-1 overflow-y-auto p-3">
          {stops.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
              </svg>
              <p className="text-sm font-medium text-gray-500">No stops added yet</p>
              <p className="text-xs mt-1 text-gray-400">Search or speak an address above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedStops.map((stop) => {
                const isPickup = stop.type === 'pickup';
                const isDelivery = stop.type === 'delivery';
                const isDepot = stop.type === 'depot';
                const typeLabel = isPickup ? 'Pickup' : isDelivery ? 'Delivery' : isDepot ? 'Depot' : null;

                if (stop.status === 'done') {
                  return (
                    <div key={stop.id} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">✓ Done</span>
                          {typeLabel && <span className="text-xs text-gray-400">{typeLabel}</span>}
                        </div>
                        <button
                          onClick={() => setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'pending' } : s))}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium px-2 py-1"
                        >
                          Undo
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-gray-700">{stop.address}</p>
                    </div>
                  );
                }

                if (stop.status === 'active') {
                  return (
                    <div key={stop.id} className="bg-white border-2 border-green-400 rounded-lg p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                        <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Active</span>
                        {typeLabel && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">{typeLabel}</span>}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">{stop.address}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDone(stop)}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-sm font-bold rounded-lg transition-all"
                        >
                          ✓ Done
                        </button>
                        <button
                          onClick={() => startNavigationToStop(stop, preferredNavApp)}
                          className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 active:scale-95 text-white text-sm font-bold rounded-lg transition-all"
                        >
                          Re-Nav
                        </button>
                      </div>
                    </div>
                  );
                }

                // Pending stop
                const haversine = (loc1: google.maps.LatLngLiteral, loc2: google.maps.LatLngLiteral) => {
                  const R = 6371;
                  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
                  const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
                  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                };
                const distanceLabel = currentLocation ? `${haversine(currentLocation, stop.location).toFixed(1)}km` : null;
                return (
                  <div key={stop.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-amber-600 uppercase tracking-wide bg-amber-50 border border-amber-200 rounded px-2 py-0.5">Pending</span>
                      <span className="text-xs text-gray-400">
                        {typeLabel}{typeLabel && distanceLabel ? ' · ' : ''}{distanceLabel}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-2">{stop.address}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startNavigationToStop(stop, preferredNavApp)}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-bold rounded-lg transition-all"
                      >
                        GO ▶
                      </button>
                      <button
                        onClick={() => removeStop(stop.id)}
                        className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {stops.length > 0 && (
          <div className="px-3 py-3 border-t border-gray-100 bg-white space-y-2">
            {(() => {
              const pickupCount = stops.filter(s => s.type === 'pickup').length;
              const deliveryCount = stops.filter(s => s.type === 'delivery').length;
              const uncompletedCount = stops.filter(s => s.status !== 'done').length;
              return (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-medium">
                    {pickupCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-700">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                        </svg>
                        {pickupCount}P
                      </span>
                    )}
                    {deliveryCount > 0 && (
                      <span className="flex items-center gap-1 text-green-700">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                        </svg>
                        {deliveryCount}D
                      </span>
                    )}
                    {pickupCount === 0 && deliveryCount === 0 && (
                      <span className="text-gray-500">{stops.length} stop{stops.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {uncompletedCount >= 3 && (
                    <button
                      onClick={optimizeRouteWithDirections}
                      disabled={isOptimizing}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {isOptimizing ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                          </svg>
                          <span>Optimizing…</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                          </svg>
                          <span>Optimize</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })()}

            {routeDetails && (
              <div className={`rounded-lg px-3 py-2 flex items-center justify-between text-sm ${activeTrip ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                <span className={`font-semibold ${activeTrip ? 'text-green-800' : 'text-gray-700'}`}>{routeDetails.distance}</span>
                {activeTrip && (
                  <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Tracking
                  </span>
                )}
                <span className={`font-semibold ${activeTrip ? 'text-green-800' : 'text-gray-700'}`}>{routeDetails.duration}</span>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={clearAll}
                className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors py-1"
              >
                Clear all stops
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Side - Map (desktop only) */}
      <div className="flex-1 relative hidden md:flex">
        <div ref={mapRef} className="absolute inset-0" />
      </div>

      {/* ===== MOBILE LAYOUT: tabbed interface ===== */}
      <div className="flex flex-col w-full md:hidden">
        {/* Mobile Tab Content */}
        <div className="flex-1 overflow-hidden">
          {/* STOPS TAB */}
          {mobileTab === 'stops' && (
            <div className="flex flex-col h-full">
              {/* Search Section */}
              <div className="p-3 border-b border-gray-200 bg-white flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="block w-full pl-10 pr-14 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Search address..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onFocus={() => setShowHistory(true)}
                    onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                  />
                  <button
                    onClick={startVoiceInput}
                    className={`absolute inset-y-0 right-0 pr-3 flex items-center w-12 justify-center ${
                      isListening ? 'text-red-600 animate-pulse' : 'text-gray-400 hover:text-blue-600'
                    }`}
                    title={isListening ? 'Listening...' : 'Voice input'}
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                    </svg>
                  </button>

                  {/* Voice Search Results */}
                  {voiceSearchResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                      <div className="flex justify-end px-2 pt-1.5">
                        <button onClick={() => setVoiceSearchResults([])} className="p-1.5 text-gray-400 hover:text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </button>
                      </div>
                      {voiceSearchResults.map((prediction) => (
                        <button
                          key={prediction.place_id}
                          onClick={() => selectVoiceResult(prediction)}
                          className="w-full text-left px-4 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                        >
                          <p className="text-base font-semibold text-gray-900">{prediction.structured_formatting.main_text}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{prediction.structured_formatting.secondary_text}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Address History */}
                  {showHistory && addressHistory.length > 0 && voiceSearchResults.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                        <p className="text-xs font-bold text-gray-500 uppercase">Recent</p>
                      </div>
                      {addressHistory.slice(0, 8).map((item) => (
                        <div key={item.id} className="border-b border-gray-100 last:border-b-0">
                          <div className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.address}</p>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => addFromHistory(item, 'pickup')}
                                className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-xs font-bold active:scale-95"
                              >
                                Pickup
                              </button>
                              <button
                                onClick={() => addFromHistory(item, 'delivery')}
                                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-xs font-bold active:scale-95"
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

                {/* Quick Actions */}
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    onClick={addCurrentLocation}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 rounded-xl transition-colors text-xs font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    Location
                  </button>
                  <button
                    onClick={toggleTrafficLayer}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl transition-colors text-xs font-medium ${
                      showTraffic ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                    </svg>
                    Traffic
                  </button>
                  {activeTrip && (
                    <button
                      onClick={openFuelStopModal}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600 rounded-xl transition-colors text-xs font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                      </svg>
                      Fuel
                    </button>
                  )}
                  <button
                    onClick={() => setShowDepotModal(true)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl transition-colors text-xs font-medium ${
                      depotAddress ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                    </svg>
                    Depot
                  </button>
                </div>

                {/* Favorites */}
                {favorites.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {favorites.map((fav) => (
                        <button
                          key={fav.id}
                          onClick={() => setPendingStop({ address: fav.address, location: fav.location })}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 text-yellow-900 text-xs font-semibold rounded-full"
                        >
                          <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                          </svg>
                          <span className="truncate max-w-[80px]">{fav.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Stops List */}
              <div className="flex-1 overflow-y-auto p-3 bg-gray-50">
                {stops.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <svg className="w-14 h-14 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                    </svg>
                    <p className="text-sm font-medium text-gray-500">No stops added yet</p>
                    <p className="text-xs mt-1 text-gray-400">Search an address above to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedStops.map((stop) => {
                      const isPickup = stop.type === 'pickup';
                      const isDelivery = stop.type === 'delivery';
                      const isDepot = stop.type === 'depot';
                      const typeLabel = isPickup ? 'Pickup' : isDelivery ? 'Delivery' : isDepot ? 'Depot' : null;

                      if (stop.status === 'done') {
                        return (
                          <div key={stop.id} className="bg-white border border-gray-200 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">✓ Done</span>
                                {typeLabel && <span className="text-xs text-gray-400">{typeLabel}</span>}
                              </div>
                              <button
                                onClick={() => setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'pending' } : s))}
                                className="text-xs text-blue-500 hover:text-blue-700 font-medium px-2 py-1"
                              >
                                Undo
                              </button>
                            </div>
                            <p className="text-sm font-medium text-gray-700">{stop.address}</p>
                          </div>
                        );
                      }

                      if (stop.status === 'active') {
                        return (
                          <div key={stop.id} className="bg-white border-2 border-green-400 rounded-xl shadow-md p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                              <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Active</span>
                              {typeLabel && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">{typeLabel}</span>}
                            </div>
                            <p className="text-sm font-semibold text-gray-900 mb-3">{stop.address}</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleDone(stop)} className="flex-1 py-3 bg-green-600 text-white text-sm font-bold rounded-xl active:scale-[0.98]">
                                ✓ Done
                              </button>
                              <button onClick={() => startNavigationToStop(stop, preferredNavApp)} className="flex-1 py-3 bg-gray-600 text-white text-sm font-bold rounded-xl active:scale-[0.98]">
                                Re-Nav
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Pending stop
                      const hav = (loc1: google.maps.LatLngLiteral, loc2: google.maps.LatLngLiteral) => {
                        const R = 6371;
                        const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
                        const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
                        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                      };
                      const distanceLabel = currentLocation ? `${hav(currentLocation, stop.location).toFixed(1)}km` : null;
                      return (
                        <div key={stop.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 uppercase tracking-wide">Pending</span>
                            <span className="text-xs text-gray-400">
                              {typeLabel}{typeLabel && distanceLabel ? ' · ' : ''}{distanceLabel}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mb-3">{stop.address}</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => startNavigationToStop(stop, preferredNavApp)} className="flex-1 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl active:scale-[0.98]">
                              GO ▶
                            </button>
                            <button onClick={() => removeStop(stop.id)} className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 active:scale-95 transition-colors">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer Summary */}
              {stops.length > 0 && (
                <div className="px-3 py-3 border-t border-gray-200 bg-white flex-shrink-0 safe-bottom">
                  {(() => {
                    const pickupCount = stops.filter(s => s.type === 'pickup').length;
                    const deliveryCount = stops.filter(s => s.type === 'delivery').length;
                    return (
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 text-xs font-medium">
                          {pickupCount > 0 && <span className="text-amber-700">{pickupCount}P</span>}
                          {deliveryCount > 0 && <span className="text-green-700">{deliveryCount}D</span>}
                          {pickupCount === 0 && deliveryCount === 0 && <span className="text-gray-500">{stops.length} stops</span>}
                        </div>
                        {routeDetails && (
                          <div className="flex items-center gap-3 text-sm font-semibold">
                            <span className="text-gray-700">{routeDetails.distance}</span>
                            <span className="text-gray-700">{routeDetails.duration}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <button onClick={clearAll} className="w-full py-2.5 text-xs text-gray-500 hover:text-red-500 font-medium">
                    Clear all stops
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MAP TAB */}
          {mobileTab === 'map' && (
            <div className="h-full relative">
              <div ref={mapRef} className="absolute inset-0" />
              {/* Quick info overlay */}
              {routeDetails && (
                <div className="absolute top-3 left-3 right-3 bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">{routeDetails.distance}</span>
                    {activeTrip && (
                      <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        Tracking
                      </span>
                    )}
                    <span className="text-sm font-semibold text-gray-700">{routeDetails.duration}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ROUTE TAB */}
          {mobileTab === 'route' && (
            <div className="flex flex-col h-full bg-gray-50">
              <div className="flex-1 overflow-y-auto p-4">
                {stops.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <svg className="w-14 h-14 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                    </svg>
                    <p className="text-sm font-medium text-gray-500">No route yet</p>
                    <p className="text-xs mt-1 text-gray-400">Add stops from the Stops tab</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Route Summary Card */}
                    {routeDetails && (
                      <div className={`rounded-xl px-4 py-4 border ${activeTrip ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-medium">Distance</p>
                            <p className={`text-xl font-bold ${activeTrip ? 'text-green-800' : 'text-gray-900'}`}>{routeDetails.distance}</p>
                          </div>
                          {activeTrip && (
                            <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium bg-green-100 px-3 py-1 rounded-full">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              Tracking
                            </span>
                          )}
                          <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase font-medium">Duration</p>
                            <p className={`text-xl font-bold ${activeTrip ? 'text-green-800' : 'text-gray-900'}`}>{routeDetails.duration}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>{stops.length} stops</span>
                          <span className="text-gray-300">|</span>
                          <span>{stops.filter(s => s.type === 'pickup').length} pickups</span>
                          <span className="text-gray-300">|</span>
                          <span>{stops.filter(s => s.type === 'delivery').length} deliveries</span>
                        </div>
                      </div>
                    )}

                    {/* Optimize Route */}
                    {stops.filter(s => s.status !== 'done').length >= 3 && (
                      <button
                        onClick={optimizeRouteWithDirections}
                        disabled={isOptimizing}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                      >
                        {isOptimizing ? (
                          <>
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                            Optimizing route...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                            Optimize Route
                          </>
                        )}
                      </button>
                    )}

                    {/* Stop List */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <p className="text-sm font-semibold text-gray-700">All Stops</p>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {stops.map((stop, index) => {
                          const isCompleted = stop.status === 'done';
                          const isActive = activeTrip?.destinationStopId === stop.id;
                          const isPickup = stop.type === 'pickup';
                          const isDelivery = stop.type === 'delivery';
                          const isDepot = stop.type === 'depot';
                          const numColor = isPickup ? 'bg-amber-500' : isDelivery ? 'bg-green-600' : isDepot ? 'bg-gray-500' : 'bg-blue-600';

                          return (
                            <div key={stop.id} className={`px-4 py-3 flex items-center gap-3 ${isCompleted ? 'opacity-50' : ''} ${isActive ? 'bg-blue-50' : ''}`}>
                              <div className={`w-7 h-7 rounded-full ${numColor} text-white flex items-center justify-center font-bold text-xs flex-shrink-0 ${isCompleted ? 'bg-green-500' : ''}`}>
                                {isCompleted ? (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                  </svg>
                                ) : (
                                  index + 1
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 line-clamp-2">{stop.address}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {(isPickup || isDelivery) && (
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isPickup ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                                      {isPickup ? 'Pickup' : 'Delivery'}
                                    </span>
                                  )}
                                  {isDepot && <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Depot</span>}
                                  {isActive && <span className="text-xs font-medium text-blue-600">En Route</span>}
                                  {isCompleted && <span className="text-xs font-medium text-green-600">Completed</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Clear All */}
                    <button
                      onClick={clearAll}
                      className="w-full py-3.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl active:scale-[0.98] transition-all"
                    >
                      Clear All Stops
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Tab Bar */}
        <div className="flex border-t border-gray-200 bg-white flex-shrink-0 safe-bottom">
          <button
            onClick={() => setMobileTab('stops')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 min-h-[56px] transition-colors ${
              mobileTab === 'stops' ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
            <span className="text-xs font-medium mt-0.5">Stops</span>
            {stops.length > 0 && (
              <span className="absolute top-1.5 ml-5 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {stops.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileTab('map')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 min-h-[56px] relative transition-colors ${
              mobileTab === 'map' ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
            </svg>
            <span className="text-xs font-medium mt-0.5">Map</span>
          </button>
          <button
            onClick={() => setMobileTab('route')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 min-h-[56px] relative transition-colors ${
              mobileTab === 'route' ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>
            <span className="text-xs font-medium mt-0.5">Route</span>
            {activeTrip && (
              <span className="absolute top-1.5 right-6 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Pickup / Delivery Bottom Sheet */}
      {pendingStop && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setPendingStop(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl shadow-2xl px-4 pt-3 pb-6 safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <p className="text-sm font-bold text-gray-900 mb-1 line-clamp-2">{pendingStop.address}</p>
            <p className="text-sm text-gray-500 mb-5">Add as pickup or delivery?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => addStopAndNavigate(pendingStop.address, pendingStop.location, 'pickup')}
                className="py-5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-base flex flex-col items-center gap-2 active:scale-95 transition-all shadow-md"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                </svg>
                Pickup
              </button>
              <button
                onClick={() => addStopAndNavigate(pendingStop.address, pendingStop.location, 'delivery')}
                className="py-5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-base flex flex-col items-center gap-2 active:scale-95 transition-all shadow-md"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
                Delivery
              </button>
            </div>
            <button
              onClick={() => setPendingStop(null)}
              className="mt-4 w-full py-3.5 text-sm font-semibold text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Depot Address Modal */}
      {showDepotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-lg shadow-xl w-full md:max-w-md safe-bottom md:safe-bottom-0">
            <div className="p-5">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 md:hidden" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Set Depot Address</h2>
                <button
                  onClick={() => setShowDepotModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 -mr-2 -mt-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base"
                  placeholder="Search for depot address..."
                  value={depotSearchValue}
                  onChange={(e) => setDepotSearchValue(e.target.value)}
                />
              </div>

              {depotAddress && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={clearDepot}
                    className="text-sm text-red-600 hover:underline py-2"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-lg shadow-xl w-full md:max-w-md safe-bottom md:safe-bottom-0">
            <div className="p-5">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 md:hidden" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                  </svg>
                  Save as Favorite
                </h2>
                <button
                  onClick={() => {
                    setShowFavoriteModal(false);
                    setFavoriteToSave(null);
                    setFavoriteName('');
                  }}
                  className="text-gray-400 hover:text-gray-600 p-2 -mr-2 -mt-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Address:</p>
                <p className="text-sm font-medium text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-200 line-clamp-2">
                  {favoriteToSave.address}
                </p>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Give this favorite a name
                </label>
                <input
                  type="text"
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-base"
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

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowFavoriteModal(false);
                    setFavoriteToSave(null);
                    setFavoriteName('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveFavorite}
                  className="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-lg shadow-xl w-full md:max-w-md safe-bottom md:safe-bottom-0 max-h-[90vh] flex flex-col">
            <div className="p-5 overflow-y-auto flex-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 md:hidden" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                  Log Fuel Stop
                </h2>
                <button
                  onClick={() => setShowFuelStopModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 -mr-2 -mt-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Location
                  </label>
                  <input
                    type="text"
                    className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base"
                    placeholder="Service station address"
                    value={fuelStopLocation}
                    onChange={(e) => setFuelStopLocation(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Odometer Reading (km) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base"
                    placeholder="12345"
                    value={fuelStopOdometer}
                    onChange={(e) => setFuelStopOdometer(e.target.value)}
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Fuel Amount (Litres)
                  </label>
                  <input
                    type="number"
                    className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base"
                    placeholder="45.5"
                    value={fuelStopLiters}
                    onChange={(e) => setFuelStopLiters(e.target.value)}
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Cost (AUD)
                  </label>
                  <input
                    type="number"
                    className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base"
                    placeholder="89.50"
                    value={fuelStopCost}
                    onChange={(e) => setFuelStopCost(e.target.value)}
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowFuelStopModal(false);
                    setFuelStopLocation('');
                    setFuelStopLiters('');
                    setFuelStopCost('');
                    setFuelStopOdometer('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveFuelStopHandler}
                  disabled={fuelStopSaving}
                  className={`flex-1 px-4 py-3 text-white rounded-lg font-medium ${fuelStopSaving ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}`}
                >
                  {fuelStopSaving ? 'Saving...' : 'Log Fuel Stop'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
// Build timestamp: 20260111083547
