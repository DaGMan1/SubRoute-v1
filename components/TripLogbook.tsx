import React, { useState, useEffect } from 'react';
import type { TripLog, User } from '../types';
import { subscribeToTripLogs, clearAllTripLogs, getUserPreferences } from '../lib/firestore';

interface TripLogbookProps {
  user: User;
  onBack?: () => void;
}

type ViewTab = 'individual' | 'daily' | 'weekly' | 'monthly';

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
  const [activeTab, setActiveTab] = useState<ViewTab>('individual');

  useEffect(() => {
    const unsubscribe = subscribeToTripLogs(user.id, (trips) => {
      setLogs(trips);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.id]);

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

        // Update first/last times
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

  // Calculate weekly summaries
  const getWeeklySummaries = () => {
    const weekMap = new Map<string, { weekStart: string; summaries: DailySummary[] }>();
    const dailySummaries = getDailySummaries();

    dailySummaries.forEach(summary => {
      const date = new Date(summary.date);
      const dayOfWeek = date.getDay();
      const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Monday as start
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
      const monthKey = summary.date.substring(0, 7); // YYYY-MM
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

  const totalKm = logs.reduce((acc, log) => acc + (log.distanceKm || 0), 0);
  const today = new Date().toISOString().split('T')[0];
  const todayKm = logs
    .filter(l => l.date === today)
    .reduce((acc, log) => acc + (log.distanceKm || 0), 0);

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
        'Date',
        'Start Time',
        'End Time',
        'Start Odometer (km)',
        'End Odometer (km)',
        'Distance (km)',
        'Origin',
        'Destination',
        'Purpose',
        'Vehicle'
      ];

      const csvRows = [headers.join(',')];
      const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);

      sortedLogs.forEach((log) => {
        const startOdo = currentOdometer;
        const endOdo = currentOdometer + log.distanceKm;
        currentOdometer = endOdo;

        const row = [
          log.date,
          log.startTime,
          log.endTime,
          startOdo.toFixed(1),
          endOdo.toFixed(1),
          log.distanceKm.toFixed(1),
          `"${log.origin.replace(/"/g, '""')}"`,
          `"${log.destination.replace(/"/g, '""')}"`,
          'Business - Courier Delivery',
          log.vehicleString
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

  const tabClasses = (tab: ViewTab) =>
    `px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
      activeTab === tab
        ? 'bg-white text-brand-blue border-b-2 border-brand-blue'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`;

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
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-brand-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-brand-gray-900">Trip Info</h1>
            <div className="flex items-center space-x-3">
              <button
                onClick={exportToCSV}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              <button onClick={clearLogs} className="text-xs text-red-500 hover:underline">Clear All</button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 border-b border-gray-200">
            <button onClick={() => setActiveTab('individual')} className={tabClasses('individual')}>
              Individual
            </button>
            <button onClick={() => setActiveTab('daily')} className={tabClasses('daily')}>
              Daily
            </button>
            <button onClick={() => setActiveTab('weekly')} className={tabClasses('weekly')}>
              Weekly
            </button>
            <button onClick={() => setActiveTab('monthly')} className={tabClasses('monthly')}>
              Monthly
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-brand-gray-200">
            <p className="text-sm text-gray-500 font-medium">Today</p>
            <p className="text-2xl font-bold text-brand-blue">{todayKm.toFixed(1)} km</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-brand-gray-200">
            <p className="text-sm text-gray-500 font-medium">Total</p>
            <p className="text-2xl font-bold text-gray-800">{totalKm.toFixed(1)} km</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-brand-gray-200">
            <p className="text-sm text-gray-500 font-medium">Total Trips</p>
            <p className="text-2xl font-bold text-gray-800">{logs.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-brand-gray-200">
            <p className="text-sm text-gray-500 font-medium">Avg per Trip</p>
            <p className="text-2xl font-bold text-gray-800">{logs.length > 0 ? (totalKm / logs.length).toFixed(1) : '0.0'} km</p>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'individual' && (
          <IndividualTripsView logs={logs} />
        )}

        {activeTab === 'daily' && (
          <DailySummaryView summaries={getDailySummaries()} />
        )}

        {activeTab === 'weekly' && (
          <WeeklySummaryView weeks={getWeeklySummaries()} />
        )}

        {activeTab === 'monthly' && (
          <MonthlySummaryView months={getMonthlySummaries()} />
        )}
      </div>
    </div>
  );
};

// Individual Trips View Component
const IndividualTripsView: React.FC<{ logs: TripLog[] }> = ({ logs }) => {
  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-brand-gray-200 p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No trips recorded</h3>
        <p className="mt-1 text-sm text-gray-500">Complete routes to start logging trips.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-brand-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Distance</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.startTime} - {log.endTime}<br/>
                  <span className="text-xs text-gray-400">({log.durationMinutes} min)</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="flex flex-col max-w-xs">
                    <span className="text-xs text-gray-500 truncate">From: {log.origin}</span>
                    <span className="font-medium truncate">To: {log.destination}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.vehicleString}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{log.distanceKm.toFixed(1)} km</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
        <div key={summary.date} className="bg-white rounded-lg shadow-sm border border-brand-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{new Date(summary.date).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
              <p className="text-sm text-gray-500">{summary.firstTripTime} - {summary.lastTripTime}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-brand-blue">{summary.totalDistance.toFixed(1)} km</p>
              <p className="text-sm text-gray-500">{summary.totalTrips} trips</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500">Total Duration</p>
              <p className="text-sm font-semibold">{summary.totalDuration} min</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg per Trip</p>
              <p className="text-sm font-semibold">{(summary.totalDistance / summary.totalTrips).toFixed(1)} km</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg Duration</p>
              <p className="text-sm font-semibold">{Math.round(summary.totalDuration / summary.totalTrips)} min</p>
            </div>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-brand-blue hover:underline">View {summary.totalTrips} trips</summary>
            <div className="mt-3 space-y-2">
              {summary.trips.map((trip, idx) => (
                <div key={trip.id} className="text-sm border-l-2 border-gray-200 pl-3 py-1">
                  <span className="font-medium">Trip {idx + 1}:</span> {trip.origin} → {trip.destination} <span className="text-gray-500">({trip.distanceKm.toFixed(1)} km)</span>
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
          <div key={week.weekStart} className="bg-white rounded-lg shadow-sm border border-brand-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Week of {new Date(week.weekStart).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                </h3>
                <p className="text-sm text-gray-500">{week.summaries.length} days worked</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-brand-blue">{weekTotal.toFixed(1)} km</p>
                <p className="text-sm text-gray-500">{weekTrips} trips</p>
              </div>
            </div>

            <div className="space-y-2">
              {week.summaries.map((day) => (
                <div key={day.date} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium">{new Date(day.date).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <div className="text-right">
                    <span className="text-sm font-bold">{day.totalDistance.toFixed(1)} km</span>
                    <span className="text-xs text-gray-500 ml-2">({day.totalTrips} trips)</span>
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
          <div key={monthData.month} className="bg-white rounded-lg shadow-sm border border-brand-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {monthDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-sm text-gray-500">{monthData.totalDays} days worked</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-brand-blue">{monthData.totalDistance.toFixed(1)} km</p>
                <p className="text-sm text-gray-500">{monthData.totalTrips} trips</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Avg per Day</p>
                <p className="text-sm font-semibold">{(monthData.totalDistance / monthData.totalDays).toFixed(1)} km</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Avg per Trip</p>
                <p className="text-sm font-semibold">{(monthData.totalDistance / monthData.totalTrips).toFixed(1)} km</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Trips per Day</p>
                <p className="text-sm font-semibold">{(monthData.totalTrips / monthData.totalDays).toFixed(1)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
