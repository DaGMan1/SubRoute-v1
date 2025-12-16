
import React, { useState, useEffect } from 'react';
import type { TripLog } from '../types';

interface TripLogbookProps {
  onBack?: () => void;
}

export const TripLogbook: React.FC<TripLogbookProps> = ({ onBack }) => {
  const [logs, setLogs] = useState<TripLog[]>([]);

  useEffect(() => {
    const savedLogs = localStorage.getItem('subroute_logs');
    if (savedLogs) {
      try {
        const parsed = JSON.parse(savedLogs);
        // Sort by timestamp descending (newest first)
        setLogs(parsed.sort((a: TripLog, b: TripLog) => b.timestamp - a.timestamp));
      } catch (e) {
        console.error("Failed to load logs", e);
      }
    }
  }, []);

  const totalKm = logs.reduce((acc, log) => acc + (log.distanceKm || 0), 0);
  const today = new Date().toISOString().split('T')[0];
  const todayKm = logs
    .filter(l => l.date === today)
    .reduce((acc, log) => acc + (log.distanceKm || 0), 0);

  const clearLogs = () => {
    if (confirm("Are you sure you want to clear your entire logbook? This cannot be undone.")) {
        localStorage.removeItem('subroute_logs');
        setLogs([]);
    }
  };

  const exportToCSV = () => {
    if (logs.length === 0) {
      alert('No trips to export');
      return;
    }

    // ATO-compliant CSV format
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

    let currentOdometer = parseFloat(localStorage.getItem('subroute_current_odometer') || '0');

    const csvRows = [headers.join(',')];

    // Sort logs by timestamp ascending for proper odometer calculation
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
        `"${log.origin.replace(/"/g, '""')}"`, // Escape quotes
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
  };

  return (
    <div className="min-h-screen bg-brand-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-brand-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-brand-gray-900">Trip Info</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToCSV}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <span>Export ATO CSV</span>
            </button>
            <button onClick={clearLogs} className="text-xs text-red-500 hover:underline">Clear History</button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-4 py-8">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-brand-gray-200">
                <p className="text-sm text-gray-500 font-medium">Distance Today</p>
                <p className="text-2xl font-bold text-brand-blue">{todayKm.toFixed(1)} km</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-brand-gray-200">
                <p className="text-sm text-gray-500 font-medium">Total Distance</p>
                <p className="text-2xl font-bold text-gray-800">{totalKm.toFixed(1)} km</p>
            </div>
        </div>

        {/* Logs List */}
        <div className="bg-white rounded-lg shadow-sm border border-brand-gray-200 overflow-hidden">
            {logs.length === 0 ? (
                <div className="text-center py-12 px-4">
                    <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No trips recorded</h3>
                    <p className="mt-1 text-sm text-gray-500">Complete stops in the Route Planner to automatically generate logs.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Distance</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {log.date}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.startTime} - {log.endTime} <br/>
                                        <span className="text-xs text-gray-400">({log.durationMinutes} min)</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        <div className="flex flex-col max-w-xs">
                                            <span className="text-xs text-gray-500 truncate">From: {log.origin}</span>
                                            <span className="font-medium truncate">To: {log.destination}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.vehicleString}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                        {log.distanceKm.toFixed(1)} km
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
