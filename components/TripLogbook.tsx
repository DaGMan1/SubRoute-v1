import React, { useState, useEffect } from 'react';
import type { TripLog, User } from '../types';
import { subscribeToTripLogs, clearAllTripLogs, getUserPreferences } from '../lib/firestore';

interface TripLogbookProps {
  user: User;
  onBack?: () => void;
}

type ViewMode = 'today' | 'individual' | 'daily' | 'weekly' | 'monthly';

interface DailySummary {
  date: string;
  trips: TripLog[];
  totalDistance: number;
  totalTrips: number;
  firstTripTime: string;
  lastTripTime: string;
  totalDuration: number;
}

export const TripLogbook: React.FC<TripLogbookProps> = ({ user, onBack }) => {
  const [logs, setLogs] = useState<TripLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToTripLogs(user.id, (trips) => {
      setLogs(trips);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.id]);

  // Get today's date
  const today = new Date().toISOString().split('T')[0];

  // Calculate daily summaries
  const getDailySummaries = (): DailySummary[] => {
    const summaryMap = new Map<string, DailySummary>();

    logs.forEach(log => {
      const existing = summaryMap.get(log.date);

      if (!existing) {
        summaryMap.set(log.date, {
          date: log.date,
          trips: [log],
          totalDistance: log.distanceKm,
          totalTrips: 1,
          firstTripTime: log.startTime,
          lastTripTime: log.endTime,
          totalDuration: log.durationMinutes
        });
      } else {
        existing.trips.push(log);
        existing.totalDistance += log.distanceKm;
        existing.totalTrips += 1;
        existing.totalDuration += log.durationMinutes;

        if (log.startTime < existing.firstTripTime) {
          existing.firstTripTime = log.startTime;
        }
        if (log.endTime > existing.lastTripTime) {
          existing.lastTripTime = log.endTime;
        }
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  };

  // Get today's summary
  const getTodaySummary = (): DailySummary | null => {
    const dailySummaries = getDailySummaries();
    return dailySummaries.find(s => s.date === today) || null;
  };

  // Calculate weekly summaries
  const getWeeklySummaries = () => {
    const weekMap = new Map<string, { weekStart: string; summaries: DailySummary[] }>();
    const dailySummaries = getDailySummaries();

    dailySummaries.forEach(summary => {
      const date = new Date(summary.date);
      const dayOfWeek = date.getDay();
      const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      const monday = new Date(date);
      monday.setDate(date.getDate() + diff);
      const weekKey = monday.toISOString().split('T')[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { weekStart: weekKey, summaries: [] });
      }
      weekMap.get(weekKey)!.summaries.push(summary);
    });

    return Array.from(weekMap.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  };

  // Calculate monthly summaries
  const getMonthlySummaries = () => {
    const monthMap = new Map<string, DailySummary[]>();
    const dailySummaries = getDailySummaries();

    dailySummaries.forEach(summary => {
      const monthKey = summary.date.substring(0, 7);
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, []);
      }
      monthMap.get(monthKey)!.push(summary);
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, summaries]) => ({
        month,
        summaries,
        totalDistance: summaries.reduce((sum, s) => sum + s.totalDistance, 0),
        totalTrips: summaries.reduce((sum, s) => sum + s.totalTrips, 0),
        totalDays: summaries.length
      }));
  };

  const clearLogs = async () => {
    if (confirm("Are you sure you want to clear your entire logbook? This cannot be undone.")) {
      try {
        await clearAllTripLogs(user.id);
        setLogs([]);
      } catch (error) {
        console.error('Error clearing logs:', error);
        alert('Failed to clear logs. Please try again.');
      }
    }
  };

  const exportToCSV = async () => {
    if (logs.length === 0) {
      alert('No trips to export');
      return;
    }

    try {
      const prefs = await getUserPreferences(user.id);
      let currentOdometer = prefs.currentOdometer || 0;

      const headers = [
        'Date', 'Start Time', 'End Time', 'Start Odometer (km)', 'End Odometer (km)',
        'Distance (km)', 'Origin', 'Destination', 'Purpose', 'Vehicle'
      ];

      const csvRows = [headers.join(',')];
      const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);

      sortedLogs.forEach((log) => {
        const startOdo = currentOdometer;
        const endOdo = currentOdometer + log.distanceKm;
        currentOdometer = endOdo;

        const row = [
          log.date, log.startTime, log.endTime, startOdo.toFixed(1), endOdo.toFixed(1),
          log.distanceKm.toFixed(1), `"${log.origin.replace(/"/g, '""')}"`,
          `"${log.destination.replace(/"/g, '""')}"`, 'Business - Courier Delivery', log.vehicleString
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `SubRoute_Logbook_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    }
  };

  const getViewLabel = () => {
    switch(viewMode) {
      case 'today': return "Today's Summary";
      case 'individual': return 'All Trips';
      case 'daily': return 'Daily View';
      case 'weekly': return 'Weekly View';
      case 'monthly': return 'Monthly View';
      default: return 'Trip Log';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
          <p className="mt-4 text-brand-gray-600">Loading trips...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-gray-100 flex flex-col">
      {/* Header with Hamburger Menu */}
      <div className="bg-white shadow-sm border-b border-brand-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Left: Menu + Title */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-brand-gray-900">{getViewLabel()}</h1>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={exportToCSV}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-2 rounded-lg text-sm flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown Menu Overlay */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-25 z-30"
            onClick={() => setShowMenu(false)}
          ></div>
          <div className="fixed top-16 left-4 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-40 w-56">
            <button
              onClick={() => { setViewMode('today'); setShowMenu(false); }}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 ${viewMode === 'today' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span className="font-medium">Today's Summary</span>
            </button>
            <button
              onClick={() => { setViewMode('daily'); setShowMenu(false); }}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 ${viewMode === 'daily' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <span className="font-medium">Daily History</span>
            </button>
            <button
              onClick={() => { setViewMode('weekly'); setShowMenu(false); }}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 ${viewMode === 'weekly' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              <span className="font-medium">Weekly Summary</span>
            </button>
            <button
              onClick={() => { setViewMode('monthly'); setShowMenu(false); }}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 ${viewMode === 'monthly' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <span className="font-medium">Monthly Summary</span>
            </button>

            <div className="border-t border-gray-200 my-2"></div>

            <button
              onClick={() => { setViewMode('individual'); setShowMenu(false); }}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 ${viewMode === 'individual' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
              <span className="font-medium">All Trips (Detail)</span>
            </button>

            <div className="border-t border-gray-200 my-2"></div>

            <button
              onClick={() => { clearLogs(); setShowMenu(false); }}
              className="w-full text-left px-4 py-3 hover:bg-red-50 flex items-center space-x-3 text-red-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              <span className="font-medium">Clear All Data</span>
            </button>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto w-full px-4 py-6 flex-1">
        {viewMode === 'today' && <TodaySummaryView summary={getTodaySummary()} allLogs={logs} />}
        {viewMode === 'individual' && <IndividualTripsView logs={logs} />}
        {viewMode === 'daily' && <DailySummaryView summaries={getDailySummaries()} />}
        {viewMode === 'weekly' && <WeeklySummaryView weeks={getWeeklySummaries()} />}
        {viewMode === 'monthly' && <MonthlySummaryView months={getMonthlySummaries()} />}
      </div>
    </div>
  );
};

// Today's Summary View (Default) - Big stats focused
const TodaySummaryView: React.FC<{ summary: DailySummary | null; allLogs: TripLog[] }> = ({ summary, allLogs }) => {
  const todayTrips = summary?.trips || [];
  const totalDistance = summary?.totalDistance || 0;
  const totalTrips = summary?.totalTrips || 0;
  const totalDuration = summary?.totalDuration || 0;

  // Calculate average speed (km/h) = distance / (duration in hours)
  const avgSpeed = totalDuration > 0 ? (totalDistance / (totalDuration / 60)).toFixed(1) : '0.0';

  // Calculate average distance per trip
  const avgDistancePerTrip = totalTrips > 0 ? (totalDistance / totalTrips).toFixed(1) : '0.0';

  // Calculate all-time stats
  const allTimeDistance = allLogs.reduce((sum, log) => sum + log.distanceKm, 0);
  const allTimeTrips = allLogs.length;

  const formatDate = () => {
    return new Date().toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Today's Date Header */}
      <div className="text-center">
        <p className="text-gray-500 text-sm">{formatDate()}</p>
      </div>

      {/* Big Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Distance - Primary */}
        <div className="col-span-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-blue-100 text-sm font-medium mb-1">Today's Distance</p>
          <p className="text-5xl font-bold">{totalDistance.toFixed(1)}</p>
          <p className="text-blue-200 text-lg">kilometres</p>
        </div>

        {/* Total Trips */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Trips</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalTrips}</p>
        </div>

        {/* Time Active */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Drive Time</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {totalDuration >= 60 ? `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m` : `${totalDuration}m`}
          </p>
        </div>

        {/* Average Speed */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Avg Speed</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{avgSpeed}</p>
          <p className="text-gray-400 text-xs">km/h</p>
        </div>

        {/* Avg per Trip */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5"></path>
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Avg/Trip</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{avgDistancePerTrip}</p>
          <p className="text-gray-400 text-xs">km</p>
        </div>
      </div>

      {/* Today's Trips List */}
      {todayTrips.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Today's Trips</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {todayTrips.map((trip, idx) => (
              <div key={trip.id} className="px-4 py-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{trip.destination}</p>
                    <p className="text-xs text-gray-500 truncate">From: {trip.origin}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-bold text-gray-900">{trip.distanceKm.toFixed(1)} km</p>
                    <p className="text-xs text-gray-500">{trip.startTime} - {trip.endTime}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No trips today message */}
      {todayTrips.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No trips today yet</h3>
          <p className="mt-1 text-sm text-gray-500">Start navigating to log your first trip</p>
        </div>
      )}

      {/* All-time Summary Footer */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          <span className="font-semibold">{allTimeTrips}</span> total trips &bull; <span className="font-semibold">{allTimeDistance.toFixed(1)}</span> km all-time
        </p>
      </div>
    </div>
  );
};

// Individual Trips View Component
const IndividualTripsView: React.FC<{ logs: TripLog[] }> = ({ logs }) => {
  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-brand-gray-200 p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No trips recorded</h3>
        <p className="mt-1 text-sm text-gray-500">Complete routes to start logging trips.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs text-gray-500">{log.date} &bull; {log.startTime} - {log.endTime}</p>
              <p className="font-medium text-gray-900">{log.destination}</p>
              <p className="text-sm text-gray-500">From: {log.origin}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-blue-600">{log.distanceKm.toFixed(1)} km</p>
              <p className="text-xs text-gray-500">{log.durationMinutes} min</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">{log.vehicleString}</p>
        </div>
      ))}
    </div>
  );
};

// Daily Summary View Component
const DailySummaryView: React.FC<{ summaries: DailySummary[] }> = ({ summaries }) => {
  if (summaries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-brand-gray-200 p-12 text-center">
        <p className="text-gray-500">No daily summaries available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summaries.map((summary) => (
        <div key={summary.date} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-white border-b border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900">
                  {new Date(summary.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                </h3>
                <p className="text-xs text-gray-500">{summary.firstTripTime} - {summary.lastTripTime}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{summary.totalDistance.toFixed(1)} km</p>
                <p className="text-xs text-gray-500">{summary.totalTrips} trips</p>
              </div>
            </div>
          </div>

          <details className="group">
            <summary className="px-4 py-3 cursor-pointer text-sm text-blue-600 hover:bg-blue-50 flex items-center justify-between">
              <span>View trips</span>
              <svg className="w-4 h-4 transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </summary>
            <div className="px-4 pb-4 space-y-2">
              {summary.trips.map((trip) => (
                <div key={trip.id} className="text-sm border-l-2 border-blue-200 pl-3 py-1">
                  <span className="font-medium">{trip.destination}</span>
                  <span className="text-gray-500 ml-2">({trip.distanceKm.toFixed(1)} km)</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      ))}
    </div>
  );
};

// Weekly Summary View Component
const WeeklySummaryView: React.FC<{ weeks: { weekStart: string; summaries: DailySummary[] }[] }> = ({ weeks }) => {
  if (weeks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-brand-gray-200 p-12 text-center">
        <p className="text-gray-500">No weekly summaries available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {weeks.map((week) => {
        const weekTotal = week.summaries.reduce((sum, s) => sum + s.totalDistance, 0);
        const weekTrips = week.summaries.reduce((sum, s) => sum + s.totalTrips, 0);
        const weekEnd = new Date(week.weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        return (
          <div key={week.weekStart} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-gray-900">
                  {new Date(week.weekStart).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                </h3>
                <p className="text-sm text-gray-500">{week.summaries.length} days worked</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{weekTotal.toFixed(1)} km</p>
                <p className="text-sm text-gray-500">{weekTrips} trips</p>
              </div>
            </div>

            <div className="space-y-2">
              {week.summaries.map((day) => (
                <div key={day.date} className="flex justify-between items-center py-2 border-t border-gray-100">
                  <span className="text-sm">{new Date(day.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' })}</span>
                  <div className="text-right">
                    <span className="text-sm font-bold">{day.totalDistance.toFixed(1)} km</span>
                    <span className="text-xs text-gray-500 ml-2">({day.totalTrips})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Monthly Summary View Component
const MonthlySummaryView: React.FC<{ months: { month: string; summaries: DailySummary[]; totalDistance: number; totalTrips: number; totalDays: number }[] }> = ({ months }) => {
  if (months.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-brand-gray-200 p-12 text-center">
        <p className="text-gray-500">No monthly summaries available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {months.map((monthData) => {
        const monthDate = new Date(monthData.month + '-01');

        return (
          <div key={monthData.month} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {monthDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-sm text-gray-500">{monthData.totalDays} days worked</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{monthData.totalDistance.toFixed(1)} km</p>
                <p className="text-sm text-gray-500">{monthData.totalTrips} trips</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
              <div className="text-center">
                <p className="text-xs text-gray-500">Avg/Day</p>
                <p className="font-bold text-gray-900">{(monthData.totalDistance / monthData.totalDays).toFixed(1)} km</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Avg/Trip</p>
                <p className="font-bold text-gray-900">{(monthData.totalDistance / monthData.totalTrips).toFixed(1)} km</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Trips/Day</p>
                <p className="font-bold text-gray-900">{(monthData.totalTrips / monthData.totalDays).toFixed(1)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
