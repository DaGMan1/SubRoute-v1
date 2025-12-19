
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: string;
  plate: string;
  isDefault: boolean;
  startOdometer: number;
  currentOdometer?: number; // Current odometer reading, auto-updates from trips
}

export interface TripLog {
  id: string;
  timestamp: number;
  date: string;
  startTime: string;
  endTime: string;
  origin: string;
  destination: string;
  distanceKm: number;
  vehicleString: string;
  durationMinutes: number;
}

export type JobType = 'pickup' | 'delivery';
export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface Job {
  id: string;
  type: JobType;
  address: string;
  displayAddress: string;
  lat?: number;
  lng?: number;
  notes?: string;
  status: JobStatus;
  completedAt?: number;
  relatedJobId?: string; // Link pickup to delivery
}

export interface RoutePreferences {
  avoidTolls: boolean;
  specificTollsToAvoid?: string[]; // Toll road names/IDs
  specificTollsToAllow?: string[]; // Overrides for specific tolls
  preferredNavApp: 'google' | 'waze';
}

export interface FuelStop {
  id: string;
  timestamp: number;
  odometerReading: number;
  liters?: number;
  costAUD?: number;
  location?: string;
}

export interface ServiceReminder {
  id: string;
  vehicleId: string;
  type: 'service' | 'rego' | 'insurance' | 'custom';
  description: string;
  dueOdometer?: number;
  dueDate?: string;
  isCompleted: boolean;
}
