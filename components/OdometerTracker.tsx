
import React, { useState, useEffect } from 'react';
import type { Vehicle, FuelStop, ServiceReminder } from '../types';

interface OdometerTrackerProps {
  onBack?: () => void;
}

export const OdometerTracker: React.FC<OdometerTrackerProps> = ({ onBack }) => {
  const [currentOdometer, setCurrentOdometer] = useState(0);
  const [fuelStops, setFuelStops] = useState<FuelStop[]>([]);
  const [serviceReminders, setServiceReminders] = useState<ServiceReminder[]>([]);
  const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null);

  // Fuel stop input
  const [inputOdometer, setInputOdometer] = useState('');
  const [inputLiters, setInputLiters] = useState('');
  const [inputCost, setInputCost] = useState('');
  const [inputLocation, setInputLocation] = useState('');

  // Service reminder input
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceType, setServiceType] = useState<'service' | 'rego' | 'insurance' | 'custom'>('service');
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceDueOdometer, setServiceDueOdometer] = useState('');
  const [serviceDueDate, setServiceDueDate] = useState('');

  useEffect(() => {
    // Load active vehicle
    const vehicles = JSON.parse(localStorage.getItem('subroute_vehicles') || '[]');
    const defaultVehicle = vehicles.find((v: Vehicle) => v.isDefault) || vehicles[0];
    if (defaultVehicle) {
      setActiveVehicle(defaultVehicle);
    }

    // Load current odometer
    const savedOdometer = localStorage.getItem('subroute_current_odometer');
    if (savedOdometer) {
      setCurrentOdometer(parseFloat(savedOdometer));
    } else if (defaultVehicle) {
      setCurrentOdometer(defaultVehicle.startOdometer);
    }

    // Load fuel stops
    const savedFuelStops = localStorage.getItem('subroute_fuel_stops');
    if (savedFuelStops) {
      setFuelStops(JSON.parse(savedFuelStops));
    }

    // Load service reminders
    const savedReminders = localStorage.getItem('subroute_service_reminders');
    if (savedReminders) {
      setServiceReminders(JSON.parse(savedReminders));
    }
  }, []);

  // Auto-save
  useEffect(() => {
    localStorage.setItem('subroute_current_odometer', currentOdometer.toString());
  }, [currentOdometer]);

  useEffect(() => {
    localStorage.setItem('subroute_fuel_stops', JSON.stringify(fuelStops));
  }, [fuelStops]);

  useEffect(() => {
    localStorage.setItem('subroute_service_reminders', JSON.stringify(serviceReminders));
  }, [serviceReminders]);

  const handleAddFuelStop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputOdometer) return;

    const newFuelStop: FuelStop = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      odometerReading: parseFloat(inputOdometer),
      liters: inputLiters ? parseFloat(inputLiters) : undefined,
      costAUD: inputCost ? parseFloat(inputCost) : undefined,
      location: inputLocation || undefined
    };

    setFuelStops(prev => [newFuelStop, ...prev]);
    setCurrentOdometer(parseFloat(inputOdometer));

    // Reset form
    setInputOdometer('');
    setInputLiters('');
    setInputCost('');
    setInputLocation('');
  };

  const handleAddServiceReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceDescription) return;

    const newReminder: ServiceReminder = {
      id: Date.now().toString(),
      vehicleId: activeVehicle?.id || 'default',
      type: serviceType,
      description: serviceDescription,
      dueOdometer: serviceDueOdometer ? parseFloat(serviceDueOdometer) : undefined,
      dueDate: serviceDueDate || undefined,
      isCompleted: false
    };

    setServiceReminders(prev => [...prev, newReminder]);

    // Reset form
    setServiceDescription('');
    setServiceDueOdometer('');
    setServiceDueDate('');
    setShowServiceForm(false);
  };

  const toggleReminderComplete = (id: string) => {
    setServiceReminders(prev =>
      prev.map(r => r.id === id ? { ...r, isCompleted: !r.isCompleted } : r)
    );
  };

  const deleteReminder = (id: string) => {
    setServiceReminders(prev => prev.filter(r => r.id !== id));
  };

  const deleteFuelStop = (id: string) => {
    setFuelStops(prev => prev.filter(f => f.id !== id));
  };

  // Calculate fuel economy
  const calculateFuelEconomy = () => {
    if (fuelStops.length < 2) return null;

    const sortedStops = [...fuelStops].sort((a, b) => a.timestamp - b.timestamp);
    const recentStops = sortedStops.slice(-10); // Last 10 fuel stops

    let totalDistance = 0;
    let totalFuel = 0;

    for (let i = 1; i < recentStops.length; i++) {
      const distance = recentStops[i].odometerReading - recentStops[i - 1].odometerReading;
      const fuel = recentStops[i - 1].liters;

      if (fuel && distance > 0) {
        totalDistance += distance;
        totalFuel += fuel;
      }
    }

    if (totalFuel === 0) return null;

    const litersPer100km = (totalFuel / totalDistance) * 100;
    const kmPerLiter = totalDistance / totalFuel;

    return {
      litersPer100km: litersPer100km.toFixed(2),
      kmPerLiter: kmPerLiter.toFixed(2)
    };
  };

  const fuelEconomy = calculateFuelEconomy();

  // Check for due service reminders
  const dueReminders = serviceReminders.filter(r => {
    if (r.isCompleted) return false;
    if (r.dueOdometer && currentOdometer >= r.dueOdometer) return true;
    if (r.dueDate && new Date(r.dueDate) <= new Date()) return true;
    return false;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-center bg-white shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Odometer & Fuel Tracking</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* Current Odometer Card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-100 text-sm font-medium uppercase tracking-wide">Current Odometer</span>
            {activeVehicle && (
              <span className="text-blue-100 text-xs">{activeVehicle.make} {activeVehicle.model}</span>
            )}
          </div>
          <div className="text-5xl font-black mb-1">
            {currentOdometer.toLocaleString()}
            <span className="text-2xl ml-2 font-normal text-blue-200">km</span>
          </div>
          {fuelEconomy && (
            <div className="mt-4 pt-4 border-t border-blue-500 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-blue-200">Fuel Economy</div>
                <div className="text-xl font-bold">{fuelEconomy.litersPer100km} <span className="text-sm font-normal">L/100km</span></div>
              </div>
              <div>
                <div className="text-blue-200">Efficiency</div>
                <div className="text-xl font-bold">{fuelEconomy.kmPerLiter} <span className="text-sm font-normal">km/L</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Service Alerts */}
        {dueReminders.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <div className="flex-1">
                <h3 className="text-red-900 font-bold mb-2">Service Due!</h3>
                <ul className="space-y-1">
                  {dueReminders.map(r => (
                    <li key={r.id} className="text-red-800 text-sm">
                      • {r.description}
                      {r.dueOdometer && ` (${r.dueOdometer.toLocaleString()} km)`}
                      {r.dueDate && ` (${new Date(r.dueDate).toLocaleDateString()})`}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Add Fuel Stop */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Record Fuel Stop</h2>
          <form onSubmit={handleAddFuelStop} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Odometer Reading (km) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={inputOdometer}
                  onChange={e => setInputOdometer(e.target.value)}
                  placeholder="123456"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Liters</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={inputLiters}
                  onChange={e => setInputLiters(e.target.value)}
                  placeholder="45.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cost (AUD)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={inputCost}
                  onChange={e => setInputCost(e.target.value)}
                  placeholder="85.00"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={inputLocation}
                  onChange={e => setInputLocation(e.target.value)}
                  placeholder="Shell North Lakes"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
            >
              Record Fuel Stop
            </button>
          </form>
        </div>

        {/* Fuel Stop History */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Fuel Stop History</h2>
          {fuelStops.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No fuel stops recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {fuelStops.map(stop => (
                <div key={stop.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-2xl font-bold text-gray-900">{stop.odometerReading.toLocaleString()} km</span>
                        <span className="text-gray-400 text-sm">{new Date(stop.timestamp).toLocaleDateString()}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        {stop.liters && (
                          <div>
                            <span className="text-gray-500">Liters:</span>
                            <span className="ml-1 font-semibold text-gray-900">{stop.liters.toFixed(2)} L</span>
                          </div>
                        )}
                        {stop.costAUD && (
                          <div>
                            <span className="text-gray-500">Cost:</span>
                            <span className="ml-1 font-semibold text-gray-900">${stop.costAUD.toFixed(2)}</span>
                          </div>
                        )}
                        {stop.location && (
                          <div>
                            <span className="text-gray-500">Location:</span>
                            <span className="ml-1 font-semibold text-gray-900">{stop.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteFuelStop(stop.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Service Reminders */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Service Reminders</h2>
            <button
              onClick={() => setShowServiceForm(!showServiceForm)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg text-sm"
            >
              {showServiceForm ? 'Cancel' : '+ Add Reminder'}
            </button>
          </div>

          {showServiceForm && (
            <form onSubmit={handleAddServiceReminder} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                  <select
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={serviceType}
                    onChange={e => setServiceType(e.target.value as any)}
                  >
                    <option value="service">Service</option>
                    <option value="rego">Registration</option>
                    <option value="insurance">Insurance</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description *</label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={serviceDescription}
                    onChange={e => setServiceDescription(e.target.value)}
                    placeholder="e.g. Oil Change"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Due Odometer (km)</label>
                  <input
                    type="number"
                    step="1"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={serviceDueOdometer}
                    onChange={e => setServiceDueOdometer(e.target.value)}
                    placeholder="125000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={serviceDueDate}
                    onChange={e => setServiceDueDate(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg"
              >
                Add Reminder
              </button>
            </form>
          )}

          {serviceReminders.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No service reminders set.</p>
          ) : (
            <div className="space-y-2">
              {serviceReminders.map(reminder => (
                <div
                  key={reminder.id}
                  className={`border rounded-lg p-4 ${
                    reminder.isCompleted
                      ? 'bg-gray-50 border-gray-300'
                      : dueReminders.some(r => r.id === reminder.id)
                      ? 'bg-red-50 border-red-300'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start flex-1">
                      <input
                        type="checkbox"
                        checked={reminder.isCompleted}
                        onChange={() => toggleReminderComplete(reminder.id)}
                        className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500 mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-sm font-bold ${reminder.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {reminder.description}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-medium uppercase">
                            {reminder.type}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {reminder.dueOdometer && (
                            <div>Due at: {reminder.dueOdometer.toLocaleString()} km</div>
                          )}
                          {reminder.dueDate && (
                            <div>Due date: {new Date(reminder.dueDate).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteReminder(reminder.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
