
import React, { useState } from 'react';
import type { Vehicle } from '../types';

export const VehicleManagerSandbox: React.FC = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([
        { id: '1', make: 'Toyota', model: 'HiAce', registration: '1AB-2CD', isPrimary: true },
        { id: '2', make: 'Ford', model: 'Transit', registration: '3EF-4GH', isPrimary: false },
    ]);
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [registration, setRegistration] = useState('');

    const handleAddVehicle = (e: React.FormEvent) => {
        e.preventDefault();
        if (!make || !model || !registration) {
            // Add some user feedback here later
            return;
        }
        const newVehicle: Vehicle = {
            id: Date.now().toString(),
            make,
            model,
            registration,
            isPrimary: vehicles.length === 0, // Make first vehicle primary
        };
        setVehicles([...vehicles, newVehicle]);
        // Clear form
        setMake('');
        setModel('');
        setRegistration('');
    };
    
    const handleSetPrimary = (id: string) => {
        setVehicles(vehicles.map(v => ({
            ...v,
            isPrimary: v.id === id,
        })));
    };

    const handleDelete = (id: string) => {
        // In a real app, you'd confirm this
        setVehicles(vehicles.filter(v => v.id !== id));
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
            <div className="flex items-center mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue mr-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 2a2 2 0 00-2 2v1H6a2 2 0 00-2 2v1H2a2 2 0 00-2 2v1a2 2 0 002 2h2v1a2 2 0 002 2h2v1a2 2 0 002 2h2a2 2 0 002-2v-1h2a2 2 0 002-2v-1h2a2 2 0 002-2V8a2 2 0 00-2-2h-2V7a2 2 0 00-2-2h-2V4a2 2 0 00-2-2h-2zm-2 4h4v2H8V6zm0 4h4v2H8v-2z" clipRule="evenodd" />
                     <path d="M18 8a2 2 0 00-2-2h-1V4a4 4 0 00-4-4H8a4 4 0 00-4 4v2H3a2 2 0 00-2 2v2a2 2 0 002 2h1v2a4 4 0 004 4h4a4 4 0 004-4v-2h1a2 2 0 002-2V8z" />
                 </svg>
                <div>
                    <h2 className="text-xl font-bold text-brand-gray-800">Component: Vehicle Management</h2>
                    <p className="text-sm text-brand-gray-600">Implements **Story 1.2**: Add and manage vehicles.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {/* Add Vehicle Form */}
                <div className="md:col-span-1">
                    <h3 className="text-lg font-semibold text-brand-gray-700 mb-3">Add a New Vehicle</h3>
                    <form onSubmit={handleAddVehicle} className="space-y-4">
                        <div>
                            <label htmlFor="make" className="block text-sm font-medium text-brand-gray-700 mb-1">Make</label>
                            <input type="text" id="make" value={make} onChange={e => setMake(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue" placeholder="e.g., Ford"/>
                        </div>
                         <div>
                            <label htmlFor="model" className="block text-sm font-medium text-brand-gray-700 mb-1">Model</label>
                            <input type="text" id="model" value={model} onChange={e => setModel(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue" placeholder="e.g., Transit Custom"/>
                        </div>
                         <div>
                            <label htmlFor="registration" className="block text-sm font-medium text-brand-gray-700 mb-1">Registration</label>
                            <input type="text" id="registration" value={registration} onChange={e => setRegistration(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue" placeholder="e.g., 1AB-2CD"/>
                        </div>
                        <button type="submit" className="w-full bg-brand-blue text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue">
                           Add Vehicle
                        </button>
                    </form>
                </div>

                {/* Vehicle List */}
                <div className="md:col-span-2">
                    <h3 className="text-lg font-semibold text-brand-gray-700 mb-3">Your Vehicles</h3>
                    <div className="space-y-3">
                        {vehicles.length > 0 ? (
                            vehicles.map(vehicle => (
                                <div key={vehicle.id} className="bg-brand-gray-50 p-4 rounded-lg border border-brand-gray-200 flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center space-x-3">
                                            <p className="font-semibold text-brand-gray-800">{vehicle.make} {vehicle.model}</p>
                                            {vehicle.isPrimary && <span className="px-2 py-0.5 text-xs font-semibold text-green-800 bg-green-100 rounded-full">Primary</span>}
                                        </div>
                                        <p className="text-sm text-brand-gray-600">{vehicle.registration}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {!vehicle.isPrimary && (
                                             <button onClick={() => handleSetPrimary(vehicle.id)} className="text-xs font-medium text-brand-gray-600 hover:text-brand-blue" title="Set as primary">Set Primary</button>
                                        )}
                                        <button className="text-xs font-medium text-brand-gray-600 hover:text-brand-blue">Edit</button>
                                        <button onClick={() => handleDelete(vehicle.id)} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-brand-gray-500 text-center py-8">You haven't added any vehicles yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
