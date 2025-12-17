import React, { useState, useEffect } from 'react';
import type { Vehicle, User } from '../types';
import { subscribeToVehicles, saveVehicle as saveVehicleToFirestore, deleteVehicle as deleteVehicleFromFirestore } from '../lib/firestore';

interface VehicleManagerProps {
  onBack?: () => void;
  user: User;
}

export const VehicleManager: React.FC<VehicleManagerProps> = ({ onBack, user }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [odometer, setOdometer] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Subscribe to real-time vehicle updates
  useEffect(() => {
    const unsubscribe = subscribeToVehicles(user.id, (updatedVehicles) => {
      setVehicles(updatedVehicles);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.id]);

  const resetForm = () => {
    setMake('');
    setModel('');
    setYear('');
    setPlate('');
    setOdometer('');
    setIsDefault(false);
    setEditingId(null);
    setIsAdding(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!make || !model || !plate || !odometer) return;

    try {
      let updatedVehicle: Vehicle;

      if (editingId) {
        // Update existing
        const existing = vehicles.find(v => v.id === editingId);
        if (!existing) return;

        updatedVehicle = {
          ...existing,
          make,
          model,
          year,
          plate,
          startOdometer: parseInt(odometer) || 0,
          isDefault: isDefault
        };
      } else {
        // Create new
        updatedVehicle = {
          id: Date.now().toString(),
          make,
          model,
          year,
          plate,
          startOdometer: parseInt(odometer) || 0,
          isDefault: vehicles.length === 0 ? true : isDefault,
        };
      }

      // Save to Firestore
      await saveVehicleToFirestore(user.id, updatedVehicle);

      // Handle Default Logic (Ensure only one default)
      if (updatedVehicle.isDefault) {
        // Update all other vehicles to not be default
        const otherVehicles = vehicles.filter(v => v.id !== updatedVehicle.id);
        for (const vehicle of otherVehicles) {
          if (vehicle.isDefault) {
            await saveVehicleToFirestore(user.id, { ...vehicle, isDefault: false });
          }
        }
      }

      resetForm();
    } catch (error) {
      console.error('Error saving vehicle:', error);
      alert('Failed to save vehicle. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      try {
        const vehicleToDelete = vehicles.find(v => v.id === id);
        await deleteVehicleFromFirestore(user.id, id);

        // If we deleted the default, make the first remaining one default
        if (vehicleToDelete?.isDefault && vehicles.length > 1) {
          const remaining = vehicles.filter(v => v.id !== id);
          if (remaining.length > 0) {
            await saveVehicleToFirestore(user.id, { ...remaining[0], isDefault: true });
          }
        }
      } catch (error) {
        console.error('Error deleting vehicle:', error);
        alert('Failed to delete vehicle. Please try again.');
      }
    }
  };

  const handleSetDefault = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening edit mode
    try {
      // Update all vehicles
      for (const vehicle of vehicles) {
        const newDefault = vehicle.id === id;
        if (vehicle.isDefault !== newDefault) {
          await saveVehicleToFirestore(user.id, { ...vehicle, isDefault: newDefault });
        }
      }
    } catch (error) {
      console.error('Error setting default vehicle:', error);
      alert('Failed to set default vehicle. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
          <p className="mt-4 text-brand-gray-600">Loading vehicles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-brand-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
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

      <div className="max-w-4xl mx-auto w-full px-4 py-8">
        {/* Add/Edit Form */}
        {isAdding && (
          <div className="bg-white rounded-lg shadow-sm border border-brand-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-brand-gray-900 mb-4">
              {editingId ? 'Edit Vehicle' : 'Add New Vehicle'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="make" className="block text-sm font-medium text-brand-gray-700 mb-1">
                    Make
                  </label>
                  <input
                    type="text"
                    id="make"
                    value={make}
                    onChange={e => setMake(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                    placeholder="Toyota"
                  />
                </div>
                <div>
                  <label htmlFor="model" className="block text-sm font-medium text-brand-gray-700 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    id="model"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                    placeholder="Hiace"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="year" className="block text-sm font-medium text-brand-gray-700 mb-1">
                    Year (Optional)
                  </label>
                  <input
                    type="text"
                    id="year"
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                    placeholder="2020"
                  />
                </div>
                <div>
                  <label htmlFor="plate" className="block text-sm font-medium text-brand-gray-700 mb-1">
                    Plate
                  </label>
                  <input
                    type="text"
                    id="plate"
                    value={plate}
                    onChange={e => setPlate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                    placeholder="ABC123"
                  />
                </div>
                <div>
                  <label htmlFor="odometer" className="block text-sm font-medium text-brand-gray-700 mb-1">
                    Start Odometer (km)
                  </label>
                  <input
                    type="number"
                    id="odometer"
                    value={odometer}
                    onChange={e => setOdometer(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="h-4 w-4 text-brand-blue focus:ring-brand-blue border-brand-gray-300 rounded"
                />
                <label htmlFor="isDefault" className="ml-2 block text-sm text-brand-gray-700">
                  Set as default vehicle
                </label>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="bg-brand-blue text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-blue-700 shadow-sm"
                >
                  {editingId ? 'Update Vehicle' : 'Add Vehicle'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-brand-gray-200 text-brand-gray-700 px-4 py-2 rounded-md text-sm font-bold hover:bg-brand-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Vehicle List */}
        <div className="bg-white rounded-lg shadow-sm border border-brand-gray-200 overflow-hidden">
          {vehicles.length === 0 ? (
            <div className="text-center py-12 px-4">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No vehicles yet</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding your first vehicle.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {vehicles.map(vehicle => (
                <li
                  key={vehicle.id}
                  className="px-6 py-4 hover:bg-brand-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleEditClick(vehicle)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-brand-gray-900">
                          {vehicle.make} {vehicle.model}
                          {vehicle.year && <span className="text-brand-gray-500 font-normal"> ({vehicle.year})</span>}
                        </h3>
                        {vehicle.isDefault && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-brand-gray-600">
                        <span className="font-medium">Plate:</span> {vehicle.plate}
                        <span className="mx-2">•</span>
                        <span className="font-medium">Start Odometer:</span> {vehicle.startOdometer.toLocaleString()} km
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!vehicle.isDefault && (
                        <button
                          onClick={(e) => handleSetDefault(vehicle.id, e)}
                          className="text-xs text-brand-blue hover:underline"
                        >
                          Set as Default
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(vehicle.id);
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
