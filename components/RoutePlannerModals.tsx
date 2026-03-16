import React from 'react';

interface FuelStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: string;
  setLocation: (v: string) => void;
  liters: string;
  setLiters: (v: string) => void;
  cost: string;
  setCost: (v: string) => void;
  odometer: string;
  setOdometer: (v: string) => void;
  isSaving: boolean;
  onSave: () => Promise<void>;
}

export const FuelStopModal: React.FC<FuelStopModalProps> = ({
  isOpen,
  onClose,
  location,
  setLocation,
  liters,
  setLiters,
  cost,
  setCost,
  odometer,
  setOdometer,
  isSaving,
  onSave
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Log Fuel Stop</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Odometer (km) *</label>
              <input
                type="number"
                step="0.1"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="123456"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Liters</label>
                <input
                  type="number"
                  step="0.01"
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="45.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost (AUD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="85.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Shell North Lakes"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 font-semibold px-4 py-3 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={isSaving || !odometer}
              className="flex-1 bg-blue-600 text-white font-semibold px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FavoriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  favoriteToSave: { address: string; location: { lat: number; lng: number } } | null;
  name: string;
  setName: (v: string) => void;
  onSave: () => Promise<void>;
}

export const FavoriteModal: React.FC<FavoriteModalProps> = ({
  isOpen,
  onClose,
  favoriteToSave,
  name,
  setName,
  onSave
}) => {
  if (!isOpen || !favoriteToSave) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Save as Favorite</h2>
          <p className="text-sm text-gray-600 mb-4">{favoriteToSave.address}</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Depot, Client - Joe's Pizza"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 font-semibold px-4 py-3 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!name.trim()}
              className="flex-1 bg-yellow-500 text-white font-semibold px-4 py-3 rounded-lg hover:bg-yellow-600 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DepotModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchValue: string;
  setSearchValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

export const DepotModal: React.FC<DepotModalProps> = ({
  isOpen,
  onClose,
  searchValue,
  setSearchValue,
  inputRef
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Set Depot Address</h2>
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
            placeholder="Search for depot address..."
          />
          <p className="text-sm text-gray-500 mb-4">
            Start typing to search for your depot address
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 font-semibold px-4 py-3 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StopCardProps {
  stop: {
    id: string;
    address: string;
    type?: 'pickup' | 'delivery' | 'depot';
    notes?: string;
  };
  index: number;
  isCompleted: boolean;
  onToggleType: () => void;
  onNavigate: (app: 'google' | 'waze') => void;
  onRemove: () => void;
  preferredApp: 'google' | 'waze';
}

export const StopCard: React.FC<StopCardProps> = ({
  stop,
  index,
  isCompleted,
  onToggleType,
  onNavigate,
  onRemove,
  preferredApp
}) => {
  const typeColors = {
    pickup: 'bg-amber-500',
    delivery: 'bg-green-500',
    depot: 'bg-blue-500'
  };

  const typeLabels = {
    pickup: 'Pickup',
    delivery: 'Delivery',
    depot: 'Depot'
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-3 ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-gray-400">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${typeColors[stop.type || 'delivery']}`}>
              {typeLabels[stop.type || 'delivery']}
            </span>
            {isCompleted && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                Completed
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">{stop.address}</p>
          {stop.notes && (
            <p className="text-xs text-gray-500 mt-1">{stop.notes}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={onToggleType}
            className="text-xs text-gray-500 hover:text-gray-700"
            title="Toggle type"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
            </svg>
          </button>
          <button
            onClick={() => onNavigate(preferredApp)}
            className="text-xs text-blue-600 hover:text-blue-700"
            title="Navigate"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
            </svg>
          </button>
          <button
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-600"
            title="Remove"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
