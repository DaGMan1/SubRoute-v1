
import React, { useState } from 'react';
import type { Trip } from '../types';

export const TripManagerSandbox: React.FC = () => {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [endOdometer, setEndOdometer] = useState('');
    const [purpose, setPurpose] = useState<'business' | 'personal'>('business');
    const [notes, setNotes] = useState('');

    const activeTrip = trips.find(t => t.status === 'active');

    const handleStartTrip = () => {
        if (activeTrip) {
            alert('A trip is already in progress.');
            return;
        }
        const startOdo = window.prompt("Enter starting odometer reading (km):");
        const startOdometer = parseInt(startOdo || '0', 10);
        if (!isNaN(startOdometer) && startOdometer > 0) {
            const newTrip: Trip = {
                id: Date.now().toString(),
                startTime: new Date(),
                startOdometer,
                status: 'active',
            };
            setTrips(prev => [...prev, newTrip]);
        } else if (startOdo !== null) {
            alert('Please enter a valid number for the odometer.');
        }
    };

    const handleEndTrip = (e: React.FormEvent) => {
        e.preventDefault();
        const endOdometerNum = parseInt(endOdometer, 10);
        if (!activeTrip || isNaN(endOdometerNum) || endOdometerNum <= activeTrip.startOdometer) {
            alert('Please enter a valid end odometer reading greater than the start odometer.');
            return;
        }
        
        const completedTrip: Trip = {
            ...activeTrip,
            endTime: new Date(),
            endOdometer: endOdometerNum,
            distance: endOdometerNum - activeTrip.startOdometer,
            purpose,
            notes,
            status: 'completed',
        };
        
        setTrips(prev => prev.map(t => t.id === activeTrip.id ? completedTrip : t));
        
        // Reset form
        setEndOdometer('');
        setPurpose('business');
        setNotes('');
    };

    const completedTrips = trips.filter(t => t.status === 'completed').sort((a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0));

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
            <div className="flex items-center mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue mr-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <div>
                    <h2 className="text-xl font-bold text-brand-gray-800">Component: Manual Trip Recording</h2>
                    <p className="text-sm text-brand-gray-600">Implements **Story 1.3**: Manually start, stop, and log a trip.</p>
                </div>
            </div>

            {!activeTrip ? (
                <div className="text-center py-6">
                    <button 
                        onClick={handleStartTrip}
                        className="bg-green-600 text-white font-bold px-8 py-3 rounded-lg shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform transform hover:scale-105"
                    >
                        Start New Trip
                    </button>
                    <p className="text-sm text-brand-gray-500 mt-3">Click to begin recording a new trip.</p>
                </div>
            ) : (
                <div className="bg-blue-50 border-2 border-dashed border-brand-blue rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-brand-gray-800">Active Trip</h3>
                    <div className="text-sm text-brand-gray-700 mt-2 mb-4">
                        <p><strong>Started at:</strong> {activeTrip.startTime.toLocaleTimeString()}</p>
                        <p><strong>Start Odometer:</strong> {activeTrip.startOdometer.toLocaleString()} km</p>
                    </div>
                    <form onSubmit={handleEndTrip} className="space-y-4">
                        <div>
                            <label htmlFor="end-odometer" className="block text-sm font-medium text-brand-gray-700 mb-1">End Odometer (km)</label>
                            <input type="number" id="end-odometer" value={endOdometer} onChange={e => setEndOdometer(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-gray-700 mb-1">Purpose</label>
                            <div className="flex space-x-4">
                               <label className="flex items-center"><input type="radio" name="purpose" value="business" checked={purpose === 'business'} onChange={() => setPurpose('business')} className="focus:ring-brand-blue h-4 w-4 text-brand-blue border-brand-gray-300"/> <span className="ml-2">Business</span></label>
                               <label className="flex items-center"><input type="radio" name="purpose" value="personal" checked={purpose === 'personal'} onChange={() => setPurpose('personal')} className="focus:ring-brand-blue h-4 w-4 text-brand-blue border-brand-gray-300"/> <span className="ml-2">Personal</span></label>
                            </div>
                        </div>
                         <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-brand-gray-700 mb-1">Notes (Optional)</label>
                            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"></textarea>
                        </div>
                        <button type="submit" className="w-full bg-red-600 text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                           End Trip
                        </button>
                    </form>
                </div>
            )}
            
            <div className="mt-8">
                 <h3 className="text-lg font-semibold text-brand-gray-700 mb-3 border-t pt-6">Completed Trips</h3>
                 <div className="space-y-3">
                    {completedTrips.length > 0 ? (
                        completedTrips.map(trip => (
                            <div key={trip.id} className="bg-brand-gray-50 p-4 rounded-lg border border-brand-gray-200">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-brand-gray-800">{trip.distance} km trip</p>
                                        <p className="text-sm text-brand-gray-600">Ended at {trip.endTime?.toLocaleTimeString()}</p>
                                        {trip.notes && <p className="text-sm text-brand-gray-500 mt-1 italic">"{trip.notes}"</p>}
                                    </div>
                                    <span className={`capitalize px-2 py-0.5 text-xs font-semibold rounded-full ${trip.purpose === 'business' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{trip.purpose}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                         <p className="text-sm text-brand-gray-500 text-center py-8">No trips have been completed yet.</p>
                    )}
                 </div>
            </div>

        </div>
    );
};
