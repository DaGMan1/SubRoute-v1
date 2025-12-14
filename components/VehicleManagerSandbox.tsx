
import React, { useState, useEffect } from 'react';
import type { Vehicle, User } from '../types';

interface VehicleManagerProps {
  onBack: () => void;
  user: User;
}

export const VehicleManager: React.FC<VehicleManagerProps> = ({ onBack, user }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [odometer, setOdometer] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('subroute_vehicles');
    if (saved) {
      try {
        setVehicles(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load vehicles", e);
      }
    }
  }, []);

  // Save to LocalStorage whenever vehicles change
  useEffect(() => {
    localStorage.setItem('subroute_vehicles', JSON.stringify(vehicles));
  }, [vehicles]);

  const resetForm = () => {
    setMake('');
    setModel('');
    setYear('');
    setPlate('');
    setOdometer('');
    setIsDefault(false);
    setEditingId(null);
    setIsAdding(false);
    setShowPasswordModal(false);
    setPasswordInput('');
    setPasswordError('');
  };

  const handleEditClick = (vehicle: Vehicle) => {
    setMake(vehicle.make);
    setModel(vehicle.model);
    setYear(vehicle.year);
    setPlate(vehicle.plate);
    setOdometer(vehicle.startOdometer.toString());
    setIsDefault(vehicle.isDefault);
    setEditingId(vehicle.id);
    setIsAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!make || !model || !plate || !odometer) return;

    // If we are editing, we require password verification
    if (editingId) {
        setShowPasswordModal(true);
        return;
    }

    // If adding new, proceed immediately
    saveVehicle();
  };

  const verifyPasswordAndSave = () => {
    // 1. Get all users from local storage "database"
    const usersRaw = localStorage.getItem('subroute_users');
    if (!usersRaw) {
        setPasswordError('System error: User database not found.');
        return;
    }

    try {
        const users = JSON.parse(usersRaw);
        // 2. Find current user
        const dbUser = users.find((u: any) => u.email === user.email);
        
        if (!dbUser) {
             setPasswordError('User record not found.');
             return;
        }

        // 3. Check password
        if (dbUser.password !== passwordInput) {
            setPasswordError('Incorrect password.');
            return;
        }

        // 4. Success
        saveVehicle();

    } catch (e) {
        setPasswordError('Verification failed.');
    }
  };

  const saveVehicle = () => {
    let updatedVehicles = [...vehicles];

    if (editingId) {
        // Update existing
        updatedVehicles = updatedVehicles.map(v => {
            if (v.id === editingId) {
                return {
                    ...v,
                    make,
                    model,
                    year,
                    plate,
                    startOdometer: parseInt(odometer) || 0,
                    isDefault: isDefault
                };
            }
            return v;
        });
    } else {
        // Create new
        const newVehicle: Vehicle = {
            id: Date.now().toString(),
            make,
            model,
            year,
            plate,
            startOdometer: parseInt(odometer) || 0,
            isDefault: vehicles.length === 0 ? true : isDefault,
        };
        updatedVehicles.push(newVehicle);
    }

    // Handle Default Logic (Ensure only one default)
    const targetId = editingId || updatedVehicles[updatedVehicles.length - 1].id; // ID of the one we just touched
    const isTargetDefault = isDefault || (vehicles.length === 0 && !editingId);

    if (isTargetDefault) {
       updatedVehicles = updatedVehicles.map(v => ({
           ...v,
           isDefault: v.id === targetId
       }));
    }

    setVehicles(updatedVehicles);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      const filtered = vehicles.filter(v => v.id !== id);
      // If we deleted the default, make the first remaining one default
      if (vehicles.find(v => v.id === id)?.isDefault && filtered.length > 0) {
        filtered[0].isDefault = true;
      }
      setVehicles(filtered);
    }
  };

  const handleSetDefault = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening edit mode
    const updated = vehicles.map(v => ({
      ...v,
      isDefault: v.id === id
    }));
    setVehicles(updated);
  };

  return (
    <div className="min-h-screen bg-brand-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-brand-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <button onClick={onBack} className="text-brand-gray-500 hover:text-brand-blue mr-4 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </button>
            <h1 className="text-2xl font-bold text-brand-gray-900">My Vehicles</h1>
          </div>
          {!isAdding && (
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-brand-blue text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-blue-700 shadow-sm flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
              Add Vehicle
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full px-4 py-8 flex-grow relative">
        
        {isAdding ? (
          <div className="bg-white rounded-lg shadow border border-brand-gray-200 p-6 animate-fade-in-up">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{editingId ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Make</label>
                  <input 
                    type="text" 
                    required
                    value={make} 
                    onChange={e => setMake(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm"
                    placeholder="Toyota"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Model</label>
                  <input 
                    type="text" 
                    required
                    value={model} 
                    onChange={e => setModel(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm"
                    placeholder="HiAce"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Year</label>
                  <input 
                    type="text" 
                    required
                    maxLength={4}
                    pattern="\d*"
                    value={year} 
                    onChange={e => {
                        // Force number only for Year, preventing scroll wheel issues
                        const val = e.target.value.replace(/\D/g, '');
                        setYear(val);
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm"
                    placeholder="YYYY"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">License Plate</label>
                  <input 
                    type="text" 
                    required
                    value={plate} 
                    onChange={e => setPlate(e.target.value.toUpperCase())}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm"
                    placeholder="ABC-123"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Current Odometer (km)</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                      type="number"
                      required
                      value={odometer}
                      onChange={e => setOdometer(e.target.value)}
                      className="focus:ring-brand-blue focus:border-brand-blue block w-full pl-3 pr-12 sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                      placeholder="e.g. 45000"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">km</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">This sets the baseline for your mileage logs.</p>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="default-vehicle"
                  type="checkbox"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="h-4 w-4 text-brand-blue focus:ring-brand-blue border-gray-300 rounded"
                />
                <label htmlFor="default-vehicle" className="ml-2 block text-sm text-gray-900">
                  Set as primary vehicle
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-blue hover:bg-blue-700 focus:outline-none"
                >
                  {editingId ? 'Update Vehicle' : 'Save Vehicle'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {vehicles.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h6m-6 4h6m-6 4h6"></path>
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No vehicles added</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by adding your first delivery vehicle.</p>
                <div className="mt-6">
                  <button
                    onClick={() => setIsAdding(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-blue hover:bg-blue-700 focus:outline-none"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Vehicle
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {vehicles.map((vehicle) => (
                  <div 
                    key={vehicle.id} 
                    onClick={() => handleEditClick(vehicle)}
                    className="bg-white border border-brand-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow flex justify-between items-start group cursor-pointer ring-2 ring-transparent hover:ring-brand-blue/50"
                  >
                    <div>
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-bold text-gray-900">{vehicle.make} {vehicle.model}</h3>
                        {vehicle.isDefault && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-gray-500 grid grid-cols-2 gap-x-6 gap-y-1">
                        <span>Year: {vehicle.year}</span>
                        <span>Rego: <span className="font-mono font-medium text-gray-700">{vehicle.plate}</span></span>
                        <span className="col-span-2 mt-1 text-gray-600 flex items-center">
                            <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            Start Odo: {vehicle.startOdometer?.toLocaleString()} km
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {!vehicle.isDefault && (
                        <button 
                          onClick={(e) => handleSetDefault(vehicle.id, e)}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded border border-gray-300 z-10"
                          title="Set as Primary"
                        >
                          Make Primary
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(vehicle.id);
                        }}
                        className="text-gray-400 hover:text-red-500 p-1 z-10"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                      {/* Visible Edit Icon for clarity */}
                      <button
                         className="text-brand-blue hover:text-blue-700 p-1 z-10"
                         title="Edit"
                      >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Password Verification Modal */}
        {showPasswordModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                <div className="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div className="mt-3 text-center">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Security Check</h3>
                        <div className="mt-2 px-7 py-3">
                            <p className="text-sm text-gray-500 mb-4">
                                Please enter your password to update vehicle details.
                            </p>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                                placeholder="Password"
                            />
                            {passwordError && <p className="text-red-500 text-xs mt-2 text-left">{passwordError}</p>}
                        </div>
                        <div className="items-center px-4 py-3">
                            <button
                                onClick={verifyPasswordAndSave}
                                className="px-4 py-2 bg-brand-blue text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 mb-2"
                            >
                                Confirm
                            </button>
                             <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPasswordInput('');
                                    setPasswordError('');
                                }}
                                className="px-4 py-2 bg-white text-gray-700 text-base font-medium rounded-md w-full shadow-sm border border-gray-300 hover:bg-gray-50 focus:outline-none"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};
