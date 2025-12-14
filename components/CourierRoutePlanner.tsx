
import React, { useState, useEffect, useRef } from 'react';
import type { TripLog, Job, JobType, RoutePreferences } from '../types';

declare var L: any;

interface CourierRoutePlannerProps {
  onBack: () => void;
}

interface SearchResult {
    label: string;
    lat: number;
    lon: number;
    raw: any;
}

type ViewMode = 'planning' | 'active';

// -- Utils --

const openWazeNav = (address: string, lat?: number, lng?: number, avoidTolls?: boolean) => {
    if (lat && lng) {
        const tollParam = avoidTolls ? '&avoid_tolls=true' : '';
        window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes${tollParam}`, '_blank');
    } else {
        const query = encodeURIComponent(address);
        const tollParam = avoidTolls ? '&avoid_tolls=true' : '';
        window.open(`https://waze.com/ul?q=${query}&navigate=yes${tollParam}`, '_blank');
    }
};

const openGoogleMapsNav = (address: string, lat?: number, lng?: number, avoidTolls?: boolean) => {
    if (lat && lng) {
        const tollParam = avoidTolls ? '&avoid=tolls' : '';
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${tollParam}`, '_blank');
    } else {
        const query = encodeURIComponent(address);
        const tollParam = avoidTolls ? '&avoid=tolls' : '';
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}${tollParam}`, '_blank');
    }
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        alert("Address copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy", err);
    });
};

export const CourierRoutePlanner: React.FC<CourierRoutePlannerProps> = ({ onBack }) => {
  // -- Core State --
  const [jobs, setJobs] = useState<Job[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('planning');
  const [activeJobIndex, setActiveJobIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number}>({ lat: -27.4698, lng: 153.0251 });

  // Settings
  const [routePrefs, setRoutePrefs] = useState<RoutePreferences>({
    avoidTolls: false,
    specificTollsToAvoid: [],
    specificTollsToAllow: [],
    preferredNavApp: 'waze'
  });

  // Job Input State
  const [jobType, setJobType] = useState<JobType>('pickup');
  const [inputAddress, setInputAddress] = useState('');
  const [inputNotes, setInputNotes] = useState('');

  // Search / Autocomplete State
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  const searchTimeoutRef = useRef<any>(null);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // -- Init --
  useEffect(() => {
    // Load Settings
    const savedPrefs = localStorage.getItem('subroute_route_prefs');
    if (savedPrefs) {
        try {
            setRoutePrefs(JSON.parse(savedPrefs));
        } catch (e) {
            console.error('Failed to load route preferences', e);
        }
    }

    // Load Saved Jobs
    const savedJobs = localStorage.getItem('subroute_active_jobs');
    if (savedJobs) {
        try {
            setJobs(JSON.parse(savedJobs));
        } catch (e) {
            console.error('Failed to load jobs', e);
        }
    }

    // Get Current Location
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(pos => {
            setCurrentLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            });
        }, (error) => {
            console.error('Geolocation error:', error);
        });
    }
  }, []);

  // Auto-save jobs
  useEffect(() => {
      localStorage.setItem('subroute_active_jobs', JSON.stringify(jobs));
  }, [jobs]);

  // Auto-save preferences
  useEffect(() => {
      localStorage.setItem('subroute_route_prefs', JSON.stringify(routePrefs));
  }, [routePrefs]);

  // -- Autocomplete Logic --
  useEffect(() => {
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
              const res = await fetch(
                  `https://nominatim.openstreetmap.org/search?` +
                  `q=${encodeURIComponent(inputAddress)}&` +
                  `format=json&` +
                  `addressdetails=1&` +
                  `countrycodes=au&` +
                  `limit=10&` +
                  `viewbox=152.8,-27.6,153.3,-27.3&` +
                  `bounded=0`,
                  {
                      headers: {
                          'User-Agent': 'SubRoute-App/1.0'
                      }
                  }
              );
              const data = await res.json();

              const results: SearchResult[] = data.map((item: any) => {
                  const addr = item.address || {};
                  const parts = [
                      addr.house_number,
                      addr.road || addr.street,
                      addr.suburb || addr.city || addr.town || addr.village,
                      addr.state,
                      addr.postcode
                  ].filter(Boolean);

                  return {
                      label: parts.join(', '),
                      lat: parseFloat(item.lat),
                      lon: parseFloat(item.lon),
                      raw: item
                  };
              });

              setSearchResults(results);
              setShowDropdown(true);
          } catch (e) {
              console.error("Search failed", e);
          } finally {
              setIsSearching(false);
          }
      }, 500);

      return () => clearTimeout(searchTimeoutRef.current);
  }, [inputAddress]);


  // -- Map Effect --
  useEffect(() => {
      if (!mapContainerRef.current || typeof L === 'undefined') return;

      if (!mapInstanceRef.current) {
          const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([currentLocation.lat, currentLocation.lng], 12);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
              attribution: 'CartoDB'
          }).addTo(map);
          mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Clear markers
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current = [];

      // Draw current location
      if (currentLocation) {
          const icon = L.divIcon({
              html: `<div class="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold border-2 border-white shadow-md">📍</div>`,
              className: 'bg-transparent',
              iconSize: [32, 32],
              iconAnchor: [16, 16]
          });
          const marker = L.marker([currentLocation.lat, currentLocation.lng], { icon }).addTo(map).bindPopup('Current Location');
          markersRef.current.push(marker);
      }

      // Draw job markers
      const group = new L.featureGroup();

      jobs.forEach((job, index) => {
          if (job.lat && job.lng) {
              const isPickup = job.type === 'pickup';
              const color = job.status === 'completed' ? 'bg-green-500' : (isPickup ? 'bg-blue-600' : 'bg-orange-600');
              const label = isPickup ? 'P' : 'D';

              const icon = L.divIcon({
                  html: `<div class="w-8 h-8 ${color} text-white rounded-full flex items-center justify-center font-bold border-2 border-white shadow-md">${label}${index + 1}</div>`,
                  className: 'bg-transparent',
                  iconSize: [32, 32],
                  iconAnchor: [16, 16]
              });

              const marker = L.marker([job.lat, job.lng], { icon }).addTo(map).bindPopup(`${job.type.toUpperCase()}: ${job.displayAddress}`);
              markersRef.current.push(marker);
              marker.addTo(group);
          }
      });

      // Fit bounds if we have points
      if (markersRef.current.length > 0) {
          map.fitBounds(group.getBounds().pad(0.1));
      }

  }, [jobs, currentLocation]);

  // -- Handlers --

  const selectResult = (res: SearchResult) => {
      setInputAddress(res.label);
      setSelectedResult(res);
      setShowDropdown(false);
  };

  const handleAddJob = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!inputAddress.trim()) return;

      let lat, lng;

      if (selectedResult && inputAddress === selectedResult.label) {
          lat = selectedResult.lat;
          lng = selectedResult.lon;
      } else {
          const match = searchResults.find(r => r.label === inputAddress);
          if (match) {
              lat = match.lat;
              lng = match.lon;
          }
      }

      const newJob: Job = {
          id: Date.now().toString(),
          type: jobType,
          address: inputAddress,
          displayAddress: inputAddress,
          notes: inputNotes,
          status: 'pending',
          lat: lat,
          lng: lng
      };

      setJobs(prev => [...prev, newJob]);
      setInputAddress('');
      setInputNotes('');
      setSearchResults([]);
      setSelectedResult(null);
      setShowDropdown(false);
  };

  const handleRemoveJob = (id: string) => {
      setJobs(jobs.filter(j => j.id !== id));
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

      const newJobs = [...jobs];
      const [moved] = newJobs.splice(dragIndex, 1);
      newJobs.splice(dropIndex, 0, moved);

      setJobs(newJobs);
  };

  // -- Navigation Logic --

  const startRun = () => {
      if (jobs.length === 0) return;
      setActiveJobIndex(0);
      setViewMode('active');
  };

  const completeJob = () => {
      const job = jobs[activeJobIndex];

      // Save log
      try {
          const newLog: TripLog = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
            startTime: new Date().toLocaleTimeString(),
            endTime: new Date().toLocaleTimeString(),
            origin: activeJobIndex > 0 ? jobs[activeJobIndex - 1]?.displayAddress : 'Current Location',
            destination: job.displayAddress,
            distanceKm: 0,
            vehicleString: 'Default',
            durationMinutes: 0
          };
          const logs = JSON.parse(localStorage.getItem('subroute_logs') || '[]');
          logs.push(newLog);
          localStorage.setItem('subroute_logs', JSON.stringify(logs));
      } catch (e) {
          console.error('Failed to save log', e);
      }

      // Update job status
      const nextJobs = [...jobs];
      nextJobs[activeJobIndex].status = 'completed';
      nextJobs[activeJobIndex].completedAt = Date.now();
      setJobs(nextJobs);

      if (activeJobIndex < jobs.length - 1) {
          setActiveJobIndex(activeJobIndex + 1);
      } else {
          alert("All Jobs Completed!");
          setViewMode('planning');
      }
  };

  const skipJob = () => {
      const nextJobs = [...jobs];
      nextJobs[activeJobIndex].status = 'skipped';
      setJobs(nextJobs);

      if (activeJobIndex < jobs.length - 1) {
          setActiveJobIndex(activeJobIndex + 1);
      } else {
          alert("All Jobs Completed!");
          setViewMode('planning');
      }
  };

  // --- RENDER: Active Mode (Driver Interface) ---
  if (viewMode === 'active') {
      const job = jobs[activeJobIndex];
      const isLast = activeJobIndex === jobs.length - 1;
      const nextJob = !isLast ? jobs[activeJobIndex + 1] : null;

      return (
          <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-900 text-white">
              {/* Header Info */}
              <div className="p-6 bg-gray-800 border-b border-gray-700">
                  <div className="flex justify-between items-start">
                      <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${job.type === 'pickup' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                                  {job.type}
                              </span>
                              <span className="text-gray-400 text-sm font-bold">Job {activeJobIndex + 1} of {jobs.length}</span>
                          </div>
                          <h1 className="text-3xl font-bold text-white leading-tight">{job.displayAddress}</h1>
                          {job.notes && (
                              <div className="mt-3 bg-yellow-900/30 text-yellow-200 p-3 rounded border border-yellow-700/50">
                                  <span className="font-bold mr-2">NOTE:</span>{job.notes}
                              </div>
                          )}
                          {nextJob && (
                              <div className="mt-4 p-3 bg-gray-700/50 rounded border border-gray-600">
                                  <span className="text-gray-400 text-xs uppercase font-bold">Next:</span>
                                  <p className="text-white text-sm mt-1">
                                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mr-2 ${nextJob.type === 'pickup' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                                          {nextJob.type}
                                      </span>
                                      {nextJob.displayAddress}
                                  </p>
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
                    onClick={() => {
                        if (routePrefs.preferredNavApp === 'waze') {
                            openWazeNav(job.address, job.lat, job.lng, routePrefs.avoidTolls);
                        } else {
                            openGoogleMapsNav(job.address, job.lat, job.lng, routePrefs.avoidTolls);
                        }
                    }}
                    className={`w-full max-w-md py-8 rounded-2xl shadow-2xl flex flex-col items-center justify-center transform transition-all active:scale-95 ${
                        routePrefs.preferredNavApp === 'waze' ? 'bg-blue-400 text-white' : 'bg-blue-600 text-white'
                    }`}
                  >
                      <span className="text-xl font-medium opacity-90 mb-2">Open in {routePrefs.preferredNavApp === 'waze' ? 'Waze' : 'Google Maps'}</span>
                      <span className="text-4xl font-black tracking-wide">NAVIGATE</span>
                  </button>

                  {/* Copy Address */}
                  <button
                    onClick={() => copyToClipboard(job.address)}
                    className="flex items-center space-x-2 text-gray-400 hover:text-white bg-gray-800 px-4 py-2 rounded-full border border-gray-600 transition-colors"
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                      <span>Copy Address</span>
                  </button>

                  <div className="text-gray-500 text-sm text-center max-w-xs mt-4">
                      {job.lat && job.lng ? (
                          <span className="text-green-500 flex items-center justify-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                              GPS Locked
                          </span>
                      ) : (
                          <span className="text-yellow-500">Address Search (No GPS)</span>
                      )}
                      {routePrefs.avoidTolls && (
                          <div className="mt-2 text-yellow-400 flex items-center justify-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                              Avoiding Tolls
                          </div>
                      )}
                  </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-gray-800 border-t border-gray-700 space-y-3">
                  <button
                    onClick={completeJob}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-5 rounded-xl text-xl shadow-lg"
                  >
                      ✓ Complete {job.type === 'pickup' ? 'Pickup' : 'Delivery'} {!isLast && '& Next'}
                  </button>
                  <button
                    onClick={skipJob}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-lg text-sm"
                  >
                      Skip This Job
                  </button>
              </div>
          </div>
      );
  }

  // --- RENDER: Planning Mode ---
  const pickupCount = jobs.filter(j => j.type === 'pickup').length;
  const deliveryCount = jobs.filter(j => j.type === 'delivery').length;

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

              {/* Nav App Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setRoutePrefs({...routePrefs, preferredNavApp: 'google'})}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${routePrefs.preferredNavApp === 'google' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                  >
                      Google
                  </button>
                  <button
                    onClick={() => setRoutePrefs({...routePrefs, preferredNavApp: 'waze'})}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${routePrefs.preferredNavApp === 'waze' ? 'bg-white shadow text-blue-400' : 'text-gray-500'}`}
                  >
                      Waze
                  </button>
              </div>
          </div>

          {/* Job Type & Toll Settings */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                  <div className="flex bg-white rounded-lg p-1 border border-gray-300 shadow-sm">
                      <button
                        onClick={() => setJobType('pickup')}
                        className={`px-4 py-2 rounded text-sm font-bold transition-all ${jobType === 'pickup' ? 'bg-blue-600 text-white shadow' : 'text-gray-600'}`}
                      >
                          Pickup
                      </button>
                      <button
                        onClick={() => setJobType('delivery')}
                        className={`px-4 py-2 rounded text-sm font-bold transition-all ${jobType === 'delivery' ? 'bg-orange-600 text-white shadow' : 'text-gray-600'}`}
                      >
                          Delivery
                      </button>
                  </div>

                  <label className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={routePrefs.avoidTolls}
                        onChange={(e) => setRoutePrefs({...routePrefs, avoidTolls: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-700">Avoid Tolls</span>
                  </label>
              </div>
          </div>

          {/* Input Form */}
          <div className="p-5 bg-white border-b border-gray-200 relative">
              <form onSubmit={handleAddJob} className="space-y-3 relative">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                          {jobType === 'pickup' ? 'Pickup' : 'Delivery'} Address
                      </label>
                      <input
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        placeholder="e.g. 7 Flinders Parade, North Lakes"
                        value={inputAddress}
                        onChange={e => {
                            setInputAddress(e.target.value);
                            if (selectedResult && e.target.value !== selectedResult.label) {
                                setSelectedResult(null);
                            }
                        }}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        onFocus={() => inputAddress.length > 2 && setShowDropdown(true)}
                        autoComplete="off"
                      />

                      {/* Autocomplete Dropdown */}
                      {showDropdown && searchResults.length > 0 && (
                          <div className="absolute top-[70px] left-0 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                              {searchResults.map((res, idx) => (
                                  <div
                                    key={idx}
                                    onClick={() => selectResult(res)}
                                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 text-sm text-gray-800"
                                  >
                                      {res.label}
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
                        className={`font-bold px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                            jobType === 'pickup' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'
                        } text-white`}
                      >
                          Add
                      </button>
                  </div>
              </form>
          </div>

          {/* Job List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-100">
              {jobs.map((job, index) => (
                  <div
                    key={job.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center cursor-move hover:border-blue-300"
                  >
                      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white mr-4 ${
                          job.type === 'pickup' ? 'bg-blue-500' : 'bg-orange-500'
                      }`}>
                          {job.type === 'pickup' ? 'P' : 'D'}{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                  job.type === 'pickup' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                              }`}>
                                  {job.type}
                              </span>
                              {!job.lat && <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] rounded">No GPS</span>}
                          </div>
                          <p className="font-semibold text-gray-900 truncate">{job.displayAddress}</p>
                          {job.notes && <p className="text-xs text-gray-500 mt-0.5">Note: {job.notes}</p>}
                      </div>
                      <button onClick={() => handleRemoveJob(job.id)} className="text-gray-400 hover:text-red-500 p-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                  </div>
              ))}
              {jobs.length === 0 && (
                  <div className="text-center py-10 px-4">
                      <p className="text-gray-400 text-sm">No jobs added yet.</p>
                      <p className="text-gray-400 text-xs mt-1">Add pickup and delivery jobs above.</p>
                  </div>
              )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t border-gray-200">
              <div className="mb-3 flex justify-between text-xs text-gray-600">
                  <span className="font-medium">
                      <span className="text-blue-600 font-bold">{pickupCount}</span> Pickups
                  </span>
                  <span className="font-medium">
                      <span className="text-orange-600 font-bold">{deliveryCount}</span> Deliveries
                  </span>
                  <span className="font-medium">
                      <span className="text-gray-900 font-bold">{jobs.length}</span> Total
                  </span>
              </div>
              <button
                onClick={startRun}
                disabled={jobs.length === 0}
                className="w-full bg-green-600 text-white font-bold py-3.5 rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50 disabled:shadow-none text-lg"
              >
                  Start Run ({jobs.length} Jobs)
              </button>
          </div>
      </div>

      {/* RIGHT PANEL: Map */}
      <div className="hidden md:block w-1/2 lg:w-7/12 h-full relative bg-gray-200">
          <div ref={mapContainerRef} className="absolute inset-0" />
          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg text-xs text-gray-500 shadow-sm z-[1000]">
              Visual Reference Only
          </div>
      </div>

    </div>
  );
};
