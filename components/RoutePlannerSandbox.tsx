
import React, { useState, useEffect, useRef } from 'react';
import type { TripLog } from '../types';

declare var L: any;

interface RoutePlannerProps {
  onBack: () => void;
}

interface Stop {
  id: string;
  rawAddress: string; // What the user typed (The Truth)
  displayAddress: string; // Formatted for display
  lat?: number; // Optional - only for internal visual
  lng?: number; // Optional - only for internal visual
  notes?: string;
  status: 'pending' | 'completed' | 'skipped';
}

interface SearchResult {
    label: string;
    lat: number;
    lon: number;
    raw: any;
}

type NavApp = 'google' | 'waze';
type ViewMode = 'planning' | 'active';

// -- Utils --

const openExternalNav = (address: string, app: NavApp, lat?: number, lng?: number) => {
    // PRIORITY: Use GPS Coordinates if available.
    // This bypasses the need for the external app to "search" again, which eliminates errors.
    if (lat && lng) {
        if (app === 'waze') {
            // Waze Deep Link with Coordinates
            window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
        } else {
            // Google Maps Search with Coordinates (drops a pin exactly there)
            window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
        }
        return;
    }

    // FALLBACK: Text Search (only if no coordinates exist)
    const query = encodeURIComponent(address);
    
    if (app === 'waze') {
        window.open(`https://waze.com/ul?q=${query}&navigate=yes`, '_blank');
    } else {
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        alert("Address copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy", err);
    });
};

export const RoutePlanner: React.FC<RoutePlannerProps> = ({ onBack }) => {
  // -- State --
  const [stops, setStops] = useState<Stop[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('planning');
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  
  // Settings
  const [preferredApp, setPreferredApp] = useState<NavApp>('google');
  
  // Inputs
  const [inputAddress, setInputAddress] = useState('');
  const [inputNotes, setInputNotes] = useState('');
  
  // Search / Autocomplete State
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Store the full selected object to ensure we capture coords even if text is edited slightly
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  
  const searchTimeoutRef = useRef<any>(null);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // -- Init --
  useEffect(() => {
    // Load Settings
    const savedApp = localStorage.getItem('subroute_pref_app') as NavApp;
    if (savedApp) setPreferredApp(savedApp);

    // Load Depot/Start
    const startStop: Stop = {
        id: 'start',
        rawAddress: 'Current Location',
        displayAddress: 'Current Location',
        status: 'pending',
        lat: -27.4698, // Default Brisbane
        lng: 153.0251
    };
    
    // Try to get real GPS for the start point
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(pos => {
            setStops(prev => {
                if (prev.length === 0) return [{ ...startStop, lat: pos.coords.latitude, lng: pos.coords.longitude }];
                return prev.map(s => s.id === 'start' ? { ...s, lat: pos.coords.latitude, lng: pos.coords.longitude } : s);
            });
        });
    } else {
        setStops([startStop]);
    }
  }, []);

  // -- Autocomplete Logic --
  useEffect(() => {
      // If the input matches the currently selected result, don't search again
      if (selectedResult && inputAddress === selectedResult.label) return;

      if (!inputAddress || inputAddress.length < 3) {
          setSearchResults([]);
          setShowDropdown(false);
          return;
      }

      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      searchTimeoutRef.current = setTimeout(async () => {
          setIsSearching(true);
          try {
              // Using Photon API (OpenStreetMap based) for fast, fuzzy search
              // We bias towards Australia (lon=133, lat=-25) roughly, or better yet, current location if we had it easily accessible here
              const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(inputAddress)}&limit=5&lat=-27.47&lon=153.02`); // Biased to Brisbane for now
              const data = await res.json();
              
              const results: SearchResult[] = data.features.map((f: any) => {
                  const props = f.properties;
                  // Construct a readable label
                  const parts = [
                      props.name,
                      props.housenumber,
                      props.street,
                      props.city,
                      props.state,
                      props.postcode
                  ].filter(Boolean);
                  
                  // Deduplicate (sometimes name == street)
                  const uniqueParts = [...new Set(parts)];
                  
                  return {
                      label: uniqueParts.join(', '),
                      lat: f.geometry.coordinates[1],
                      lon: f.geometry.coordinates[0],
                      raw: f
                  };
              });

              setSearchResults(results);
              setShowDropdown(true);
          } catch (e) {
              console.error("Search failed", e);
          } finally {
              setIsSearching(false);
          }
      }, 300); // 300ms debounce

      return () => clearTimeout(searchTimeoutRef.current);
  }, [inputAddress]);


  // -- Map Effect (Visual Reference Only) --
  useEffect(() => {
      if (!mapContainerRef.current || typeof L === 'undefined') return;
      
      if (!mapInstanceRef.current) {
          const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([-27.4698, 153.0251], 12);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
              attribution: 'CartoDB'
          }).addTo(map);
          mapInstanceRef.current = map;
      }
      
      const map = mapInstanceRef.current;

      // Clear markers
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current = [];

      // Draw markers for stops that have coordinates
      const group = new L.featureGroup();
      
      stops.forEach((stop, index) => {
          if (stop.lat && stop.lng) {
              const color = index === 0 ? 'bg-black' : (stop.status === 'completed' ? 'bg-green-500' : 'bg-blue-600');
              const icon = L.divIcon({
                  html: `<div class="w-8 h-8 ${color} text-white rounded-full flex items-center justify-center font-bold border-2 border-white shadow-md">${index === 0 ? 'S' : index}</div>`,
                  className: 'bg-transparent',
                  iconSize: [32, 32],
                  iconAnchor: [16, 16]
              });
              
              const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(map).bindPopup(stop.displayAddress);
              markersRef.current.push(marker);
              marker.addTo(group);
          }
      });

      // Fit bounds if we have points
      if (stops.length > 0 && markersRef.current.length > 0) {
          map.fitBounds(group.getBounds().pad(0.1));
      }

  }, [stops]);

  // -- Handlers --

  const handleAppChange = (app: NavApp) => {
      setPreferredApp(app);
      localStorage.setItem('subroute_pref_app', app);
  };

  const selectResult = (res: SearchResult) => {
      setInputAddress(res.label);
      setSelectedResult(res); // Lock in the coordinates
      setShowDropdown(false);
  };

  const handleAddStop = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!inputAddress.trim()) return;

      // Determine coords:
      // 1. Use explicitly selected result if the text matches
      // 2. Or try to find a match in the current list
      let lat, lng;
      
      if (selectedResult && inputAddress === selectedResult.label) {
          lat = selectedResult.lat;
          lng = selectedResult.lon;
      } else {
          // Fallback check
          const match = searchResults.find(r => r.label === inputAddress);
          if (match) {
              lat = match.lat;
              lng = match.lon;
          }
      }
      
      const newStop: Stop = {
          id: Date.now().toString(),
          rawAddress: inputAddress,
          displayAddress: inputAddress,
          notes: inputNotes,
          status: 'pending',
          lat: lat,
          lng: lng
      };

      setStops(prev => [...prev, newStop]);
      setInputAddress('');
      setInputNotes('');
      setSearchResults([]);
      setSelectedResult(null);
      setShowDropdown(false);
  };

  const handleRemoveStop = (id: string) => {
      setStops(stops.filter(s => s.id !== id));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
     e.dataTransfer.setData('index', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
      const dragIndex = parseInt(e.dataTransfer.getData('index'));
      if (dragIndex === dropIndex) return;
      
      const newStops = [...stops];
      const [moved] = newStops.splice(dragIndex, 1);
      newStops.splice(dropIndex, 0, moved);
      
      setStops(newStops);
  };

  // -- Navigation Logic --

  const startRun = () => {
      if (stops.length < 2) return;
      setActiveStopIndex(1); // Skip 'Current Location'
      setViewMode('active');
  };

  const completeStop = () => {
      const stop = stops[activeStopIndex];
      
      // Save log
      try {
          const newLog: TripLog = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
            startTime: new Date().toLocaleTimeString(),
            endTime: new Date().toLocaleTimeString(),
            origin: stops[activeStopIndex - 1]?.displayAddress || 'Unknown',
            destination: stop.displayAddress,
            distanceKm: 0, 
            vehicleString: 'Default',
            durationMinutes: 0 
          };
          const logs = JSON.parse(localStorage.getItem('subroute_logs') || '[]');
          logs.push(newLog);
          localStorage.setItem('subroute_logs', JSON.stringify(logs));
      } catch (e) {}

      // Move next
      const nextStops = [...stops];
      nextStops[activeStopIndex].status = 'completed';
      setStops(nextStops);

      if (activeStopIndex < stops.length - 1) {
          setActiveStopIndex(activeStopIndex + 1);
      } else {
          alert("Run Completed!");
          setViewMode('planning');
      }
  };

  // --- RENDER: Active Mode (Driver Interface) ---
  if (viewMode === 'active') {
      const stop = stops[activeStopIndex];
      const isLast = activeStopIndex === stops.length - 1;

      return (
          <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-900 text-white">
              {/* Header Info */}
              <div className="p-6 bg-gray-800 border-b border-gray-700">
                  <div className="flex justify-between items-start">
                      <div>
                          <h2 className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-1">Stop {activeStopIndex} of {stops.length - 1}</h2>
                          <h1 className="text-3xl font-bold text-white leading-tight">{stop.displayAddress}</h1>
                          {stop.notes && (
                              <div className="mt-3 bg-yellow-900/30 text-yellow-200 p-3 rounded border border-yellow-700/50">
                                  <span className="font-bold mr-2">NOTE:</span>{stop.notes}
                              </div>
                          )}
                      </div>
                      <button onClick={() => setViewMode('planning')} className="text-gray-400 hover:text-white px-3 py-1 border border-gray-600 rounded">
                          Exit
                      </button>
                  </div>
              </div>

              {/* Big Action Area */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
                  
                  {/* The NAVIGATE Button */}
                  <button 
                    onClick={() => openExternalNav(stop.rawAddress, preferredApp, stop.lat, stop.lng)}
                    className={`w-full max-w-md py-8 rounded-2xl shadow-2xl flex flex-col items-center justify-center transform transition-all active:scale-95 ${
                        preferredApp === 'waze' ? 'bg-blue-400 text-white' : 'bg-blue-600 text-white'
                    }`}
                  >
                      <span className="text-xl font-medium opacity-90 mb-2">Open in {preferredApp === 'waze' ? 'Waze' : 'Google Maps'}</span>
                      <span className="text-4xl font-black tracking-wide">NAVIGATE</span>
                  </button>

                  {/* Failsafe Button */}
                  <button 
                    onClick={() => copyToClipboard(stop.rawAddress)}
                    className="flex items-center space-x-2 text-gray-400 hover:text-white bg-gray-800 px-4 py-2 rounded-full border border-gray-600 transition-colors"
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                      <span>Copy Address (Fail-safe)</span>
                  </button>

                  <div className="text-gray-500 text-sm text-center max-w-xs mt-4">
                      {stop.lat && stop.lng ? (
                          <span className="text-green-500 flex items-center justify-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                              GPS Locked
                          </span>
                      ) : (
                          <span className="text-yellow-500">Address Search (No GPS Lock)</span>
                      )}
                  </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-gray-800 border-t border-gray-700">
                  <button 
                    onClick={completeStop}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-5 rounded-xl text-xl shadow-lg"
                  >
                      {isLast ? 'Complete Run' : 'Complete Stop & Next'}
                  </button>
              </div>
          </div>
      );
  }

  // --- RENDER: Planning Mode ---
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:flex-row bg-gray-50">
      
      {/* LEFT PANEL: Inputs & List */}
      <div className="w-full md:w-1/2 lg:w-5/12 flex flex-col h-full border-r border-gray-200 bg-white z-10 shadow-xl">
          
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
              <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center font-medium">
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  Dashboard
              </button>
              
              {/* Settings Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                  <button 
                    onClick={() => handleAppChange('google')}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${preferredApp === 'google' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                  >
                      Google Maps
                  </button>
                  <button 
                    onClick={() => handleAppChange('waze')}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${preferredApp === 'waze' ? 'bg-white shadow text-blue-400' : 'text-gray-500'}`}
                  >
                      Waze
                  </button>
              </div>
          </div>

          {/* Input Form */}
          <div className="p-5 bg-gray-50 border-b border-gray-200 relative">
              <form onSubmit={handleAddStop} className="space-y-3 relative">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Destination Address</label>
                      <input 
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        placeholder="e.g. 7 Flinders Parade, North Lakes"
                        value={inputAddress}
                        onChange={e => {
                            setInputAddress(e.target.value);
                            // If user types, we lose the lock unless they re-select
                            if (selectedResult && e.target.value !== selectedResult.label) {
                                setSelectedResult(null); 
                            }
                        }}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        onFocus={() => inputAddress.length > 2 && setShowDropdown(true)}
                        autoFocus
                        autoComplete="off"
                      />
                      
                      {/* Autocomplete Dropdown */}
                      {showDropdown && searchResults.length > 0 && (
                          <div className="absolute top-[70px] left-0 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                              {searchResults.map((res, idx) => (
                                  <div 
                                    key={idx}
                                    onClick={() => selectResult(res)}
                                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 text-sm text-gray-800 flex justify-between"
                                  >
                                      <span>{res.label}</span>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <div className="flex space-x-2">
                      <input 
                        className="flex-1 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Notes (e.g. Gate code: 1234)"
                        value={inputNotes}
                        onChange={e => setInputNotes(e.target.value)}
                      />
                      <button 
                        type="submit"
                        disabled={!inputAddress}
                        className="bg-blue-600 text-white font-bold px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          Add
                      </button>
                  </div>
              </form>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-100">
              {stops.map((stop, index) => (
                  <div 
                    key={stop.id}
                    draggable={index !== 0}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center ${index === 0 ? 'opacity-75 bg-gray-50' : 'cursor-move hover:border-blue-300'}`}
                  >
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white mr-4 ${index === 0 ? 'bg-gray-800' : 'bg-blue-500'}`}>
                          {index === 0 ? 'S' : index}
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{stop.displayAddress}</p>
                          {stop.notes && <p className="text-xs text-gray-500 mt-0.5">Note: {stop.notes}</p>}
                          {index !== 0 && !stop.lat && <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] rounded mt-1">Manual Address (Text Only)</span>}
                      </div>
                      {index !== 0 && (
                          <button onClick={() => handleRemoveStop(stop.id)} className="text-gray-400 hover:text-red-500 p-2">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                      )}
                  </div>
              ))}
              {stops.length < 2 && (
                  <div className="text-center py-10 px-4">
                      <p className="text-gray-400 text-sm">Start typing an address above.</p>
                      <p className="text-gray-400 text-xs mt-1">Select a suggestion OR just keep typing and hit Add.</p>
                  </div>
              )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t border-gray-200">
              <button 
                onClick={startRun}
                disabled={stops.length < 2}
                className="w-full bg-green-600 text-white font-bold py-3.5 rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50 disabled:shadow-none text-lg"
              >
                  Start Run ({stops.length - 1} Stops)
              </button>
          </div>
      </div>

      {/* RIGHT PANEL: Map (Visual Reference Only) */}
      <div className="hidden md:block w-1/2 lg:w-7/12 h-full relative bg-gray-200">
          <div ref={mapContainerRef} className="absolute inset-0" />
          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg text-xs text-gray-500 shadow-sm z-[1000]">
              Visual Reference Only
          </div>
      </div>

    </div>
  );
};
