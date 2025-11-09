
import React, { useState, useEffect, useCallback } from 'react';
import type { Vehicle, User } from '../types';

interface VehicleManagerSandboxProps {
    currentUser: User | null;
    vehicles: Vehicle[];
    onVehicleUpdate: () => void;
}

export const VehicleManagerSandbox: React.FC<VehicleManagerSandboxProps> = ({ currentUser, vehicles, onVehicleUpdate }) => {
    const [error, setError] = useState('');
    
    // Form state
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [registration, setRegistration] = useState('');

    const API_BASE_URL = '/api';

    const handleAddVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!make || !model || !registration || !currentUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/vehicles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': currentUser.id,
                },
                body: JSON.stringify({ make, model, registration }),
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Failed to add vehicle.');
            }
            // Clear form and notify parent to refetch
            setMake('');
            setModel('');
            setRegistration('');
            onVehicleUpdate();
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    const handleSetPrimary = async (id: string) => {
        if (!currentUser) return;
        try {
             const response = await fetch(`${API_BASE_URL}/vehicles/${id}/primary`, {
                method: 'PUT',
                headers: { 'x-user-id': currentUser.id },
            });
            if (!response.ok) throw new Error('Failed to set primary vehicle.');
            onVehicleUpdate();
        } catch (err: any) {
             setError(err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!currentUser || !window.confirm('Are you sure you want to delete this vehicle?')) return;
        try {
            const response = await fetch(`${API_BASE_URL}/vehicles/${id}`, {
                method: 'DELETE',
                headers: { 'x-user-id': currentUser.id },
            });
            if (!response.ok) throw new Error('Failed to delete vehicle.');
            onVehicleUpdate();
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (!currentUser) {
        return (
             <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
                <div className="flex items-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue mr-3" viewBox="0 0 20 20" fill="currentColor"><path d="M18 8a2 2 0 00-2-2h-1V4a4 4 0 00-4-4H8a4 4 0 00-4 4v2H3a2 2 0 00-2 2v2a2 2 0 002 2h1v2a4 4 0 004 4h4a4 4 0 004-4v-2h1a2 2 0 002-2V8z" /></svg>
                    <div>
                        <h2 className="text-xl font-bold text-brand-gray-800">Vehicle Management</h2>
                        <p className="text-sm text-brand-gray-600">Add and manage your vehicles.</p>
                    </div>
                </div>
                <div className="text-center py-8 bg-brand-gray-50 rounded-md mt-6">
                    <p className="text-brand-gray-600">Please log in to manage your vehicles.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
            <div className="flex items-center mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue mr-3" viewBox="0 0 20 20" fill="currentColor">
                     <path d="M18 8a2 2 0 00-2-2h-1V4a4 4 0 00-4-4H8a4 4 0 00-4 4v2H3a2 2 0 00-2 2v2a2 2 0 002 2h1v2a4 4 0 004 4h4a4 4 0 004-4v-2h1a2 2 0 002-2V8z" />
                 </svg>
                <div>
                    <h2 className="text-xl font-bold text-brand-gray-800">Vehicle Management</h2>
                    <p className="text-sm text-brand-gray-600">Add and manage your vehicles.</p>
                </div>
            </div>
            
            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md my-4 text-center">{error}</p>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
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
                                        <button onClick={() => handleDelete(vehicle.id)} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-brand-gray-500 text-center py-8">You haven't added any vehicles yet. Please add one to start tracking trips.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
