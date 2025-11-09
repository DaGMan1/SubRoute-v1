import React, { useState } from 'react';
import type { Trip, User, Vehicle, SuggestedTrip } from '../types';

interface TripManagerSandboxProps {
    currentUser: User | null;
    vehicles: Vehicle[];
    trips: Trip[];
    suggestedTrips: SuggestedTrip[];
    onStartTrip: (vehicleId: string, startOdometer: number) => Promise<void>;
    onEndTrip: (tripId: string, endOdometer: number, purpose: 'business' | 'personal', notes: string) => Promise<void>;
    onLogSuggestedTrip: (trip: SuggestedTrip, vehicleId: string, startOdometer: number, endOdometer: number, purpose: 'business' | 'personal', notes: string) => Promise<void>;
    onDismissSuggestedTrip: (id: string) => void;
}

export const TripManagerSandbox: React.FC<TripManagerSandboxProps> = ({ 
    currentUser, 
    vehicles, 
    trips, 
    suggestedTrips,
    onStartTrip, 
    onEndTrip,
    onLogSuggestedTrip,
    onDismissSuggestedTrip,
}) => {
    // State for ending a trip
    const [endOdometer, setEndOdometer] = useState('');
    const [purpose, setPurpose] = useState<'business' | 'personal'>('business');
    const [notes, setNotes] = useState('');

    // State for starting a trip modal
    const [isStartModalOpen, setIsStartModalOpen] = useState(false);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
    const [startOdometer, setStartOdometer] = useState('');
    
    // State for logging a suggested trip
    const [loggingSuggestion, setLoggingSuggestion] = useState<SuggestedTrip | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const activeTrip = trips.find(t => t.status === 'active');

    const handleShowStartModal = () => {
        if (!currentUser) {
            alert('Please log in to start a trip.');
            return;
        }
        if (vehicles.length === 0) {
            alert('You must add a vehicle in the "Vehicle Management" section before starting a trip.');
            return;
        }
        const primaryVehicle = vehicles.find(v => v.isPrimary);
        setSelectedVehicleId(primaryVehicle?.id || vehicles[0]?.id || '');
        setStartOdometer('');
        setIsStartModalOpen(true);
    };

    const handleConfirmStartTrip = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const startOdometerNum = parseInt(startOdometer, 10);
        if (!selectedVehicleId) {
            alert('Please select a vehicle.');
            setIsSubmitting(false);
            return;
        }
        if (isNaN(startOdometerNum) || startOdometerNum <= 0) {
            alert('Please enter a valid starting odometer reading.');
            setIsSubmitting(false);
            return;
        }
        
        await onStartTrip(selectedVehicleId, startOdometerNum);
        
        setIsStartModalOpen(false);
        setIsSubmitting(false);
    };

    const handleEndTrip = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const endOdometerNum = parseInt(endOdometer, 10);
        if (!activeTrip || isNaN(endOdometerNum) || endOdometerNum <= activeTrip.startOdometer) {
            alert('Please enter a valid end odometer reading greater than the start odometer.');
            setIsSubmitting(false);
            return;
        }
        
        await onEndTrip(activeTrip.id, endOdometerNum, purpose, notes);
        
        // Reset form
        setEndOdometer('');
        setPurpose('business');
        setNotes('');
        setIsSubmitting(false);
    };
    
    const handleShowLogSuggestionModal = (suggestion: SuggestedTrip) => {
        if (vehicles.length === 0) {
            alert('You must add a vehicle in "Vehicle Management" before logging a trip.');
            return;
        }
        const primaryVehicle = vehicles.find(v => v.isPrimary);
        setSelectedVehicleId(primaryVehicle?.id || vehicles[0]?.id || '');
        setStartOdometer('');
        setEndOdometer('');
        setPurpose('business');
        setNotes(`Trip from ${suggestion.startAddress} to ${suggestion.endAddress}`);
        setLoggingSuggestion(suggestion);
    }

    const handleConfirmLogSuggestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loggingSuggestion) return;
        
        setIsSubmitting(true);
        const startOdoNum = parseInt(startOdometer, 10);
        const endOdoNum = parseInt(endOdometer, 10);

        if (!selectedVehicleId || isNaN(startOdoNum) || isNaN(endOdoNum) || startOdoNum <= 0 || endOdoNum <= startOdoNum) {
            alert('Please fill in all fields with valid odometer readings.');
            setIsSubmitting(false);
            return;
        }

        await onLogSuggestedTrip(loggingSuggestion, selectedVehicleId, startOdoNum, endOdoNum, purpose, notes);
        setLoggingSuggestion(null);
        setIsSubmitting(false);
    }

    const completedTrips = trips.filter(t => t.status === 'completed').sort((a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0));
    
    const StartTripModal = () => (
         <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center"
            onClick={() => setIsStartModalOpen(false)}
        >
            <div 
                className="bg-white rounded-lg shadow-2xl w-full max-w-md m-4"
                onClick={(e) => e.stopPropagation()}
            >
                 <header className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold text-brand-gray-800">Start a New Trip</h2>
                    <button onClick={() => setIsStartModalOpen(false)} className="text-brand-gray-500 hover:text-brand-gray-800">&times;</button>
                </header>
                <form onSubmit={handleConfirmStartTrip} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-gray-700 mb-2">Select Vehicle</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                            {vehicles.map(vehicle => (
                                <label key={vehicle.id} className={`flex items-center p-3 rounded-md cursor-pointer transition-all ${selectedVehicleId === vehicle.id ? 'bg-blue-100 border-brand-blue' : 'bg-brand-gray-50 border-transparent'} border-2`}>
                                    <input 
                                        type="radio" 
                                        name="vehicle" 
                                        value={vehicle.id}
                                        checked={selectedVehicleId === vehicle.id}
                                        onChange={() => setSelectedVehicleId(vehicle.id)}
                                        className="h-4 w-4 text-brand-blue focus:ring-brand-blue"
                                    />
                                    <span className="ml-3 text-sm font-medium text-brand-gray-800">{vehicle.make} {vehicle.model} ({vehicle.registration})</span>
                                    {vehicle.isPrimary && <span className="ml-auto text-xs font-semibold text-green-800 bg-green-100 px-2 py-0.5 rounded-full">Primary</span>}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="start-odometer" className="block text-sm font-medium text-brand-gray-700 mb-1">Start Odometer (km)</label>
                        <input 
                            type="number" 
                            id="start-odometer" 
                            value={startOdometer} 
                            onChange={e => setStartOdometer(e.target.value)} 
                            required 
                            className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue" 
                        />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-green-600 text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:bg-brand-gray-400">
                        {isSubmitting ? 'Starting...' : 'Confirm & Start Trip'}
                    </button>
                </form>
            </div>
        </div>
    );

    const LogSuggestionModal = () => (
         <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center"
            onClick={() => setLoggingSuggestion(null)}
        >
            <div 
                className="bg-white rounded-lg shadow-2xl w-full max-w-md m-4"
                onClick={(e) => e.stopPropagation()}
            >
                 <header className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold text-brand-gray-800">Log Detected Trip</h2>
                    <button onClick={() => setLoggingSuggestion(null)} className="text-brand-gray-500 hover:text-brand-gray-800">&times;</button>
                </header>
                <form onSubmit={handleConfirmLogSuggestion} className="p-6 space-y-4">
                     <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800">
                        <p><strong>Detected:</strong> {loggingSuggestion?.distance.toFixed(1)} km trip</p>
                        <p><strong>From:</strong> {loggingSuggestion?.startAddress}</p>
                        <p><strong>To:</strong> {loggingSuggestion?.endAddress}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-gray-700 mb-2">Confirm Vehicle</label>
                        <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue">
                             {vehicles.map(vehicle => (
                                <option key={vehicle.id} value={vehicle.id}>
                                    {vehicle.make} {vehicle.model} ({vehicle.registration})
                                </option>
                            ))}
                        </select>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="log-start-odometer" className="block text-sm font-medium text-brand-gray-700 mb-1">Start Odometer (km)</label>
                            <input type="number" id="log-start-odometer" value={startOdometer} onChange={e => setStartOdometer(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue" />
                        </div>
                        <div>
                            <label htmlFor="log-end-odometer" className="block text-sm font-medium text-brand-gray-700 mb-1">End Odometer (km)</label>
                            <input type="number" id="log-end-odometer" value={endOdometer} onChange={e => setEndOdometer(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-gray-700 mb-1">Purpose</label>
                         <div className="flex space-x-4">
                           <label className="flex items-center"><input type="radio" name="log-purpose" value="business" checked={purpose === 'business'} onChange={() => setPurpose('business')} className="focus:ring-brand-blue h-4 w-4 text-brand-blue border-brand-gray-300"/> <span className="ml-2">Business</span></label>
                           <label className="flex items-center"><input type="radio" name="log-purpose" value="personal" checked={purpose === 'personal'} onChange={() => setPurpose('personal')} className="focus:ring-brand-blue h-4 w-4 text-brand-blue border-brand-gray-300"/> <span className="ml-2">Personal</span></label>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="log-notes" className="block text-sm font-medium text-brand-gray-700 mb-1">Notes (Optional)</label>
                        <textarea id="log-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"></textarea>
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-brand-gray-400">
                        {isSubmitting ? 'Logging...' : 'Confirm & Log Trip'}
                    </button>
                </form>
            </div>
        </div>
    );


    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
             {isStartModalOpen && <StartTripModal />}
             {loggingSuggestion && <LogSuggestionModal />}

            <div className="flex items-center mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue mr-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <div>
                    <h2 className="text-xl font-bold text-brand-gray-800">Trip Manager</h2>
                    <p className="text-sm text-brand-gray-600">Manually start, stop, and log a trip.</p>
                </div>
            </div>
            
            {suggestedTrips.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-brand-gray-700 mb-3">Suggested Trips</h3>
                    <div className="space-y-3">
                        {suggestedTrips.map(suggestion => (
                            <div key={suggestion.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-yellow-900">Detected a {suggestion.distance.toFixed(1)} km trip</p>
                                        <p className="text-sm text-yellow-800">From {suggestion.startAddress} to {suggestion.endAddress}</p>
                                    </div>
                                    <button onClick={() => onDismissSuggestedTrip(suggestion.id)} className="text-yellow-700 hover:text-yellow-900">&times;</button>
                                </div>
                                <div className="flex space-x-2 mt-3">
                                    <button onClick={() => handleShowLogSuggestionModal(suggestion)} className="w-full bg-yellow-500 text-white font-semibold px-3 py-1.5 text-sm rounded-md shadow-sm hover:bg-yellow-600">Log Trip</button>
                                    <button onClick={() => onDismissSuggestedTrip(suggestion.id)} className="w-full bg-white text-yellow-800 font-semibold px-3 py-1.5 text-sm rounded-md border border-yellow-500 hover:bg-yellow-100">Dismiss</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {!activeTrip ? (
                <div className="text-center py-6 border-t border-brand-gray-200">
                    <button 
                        onClick={handleShowStartModal}
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
                        <p><strong>Started at:</strong> {new Date(activeTrip.startTime).toLocaleTimeString()}</p>
                        <p><strong>Start Odometer:</strong> {activeTrip.startOdometer.toLocaleString()} km</p>
                        <p><strong>Vehicle:</strong> {activeTrip.vehicleInfo}</p>
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
                        <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-brand-gray-400">
                           {isSubmitting ? 'Ending...' : 'End Trip'}
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
                                        <p className="text-sm text-brand-gray-600">Ended at {trip.endTime ? new Date(trip.endTime).toLocaleTimeString() : ''}</p>
                                        {trip.vehicleInfo && <p className="text-sm text-brand-gray-500 mt-1">Vehicle: {trip.vehicleInfo}</p>}
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