
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
