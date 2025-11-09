


export interface Heading {
  id: string;
  text: string;
  level: number;
}

export interface GroundingChunk {
  maps: {
    title: string;
    uri: string;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  registration: string;
  isPrimary: boolean;
}

export interface Trip {
  id:string;
  startTime: Date;
  endTime?: Date;
  startOdometer: number;
  endOdometer?: number;
  distance?: number;
  purpose?: 'business' | 'personal';
  notes?: string;
  status: 'active' | 'completed';
  vehicleId?: string;
  vehicleInfo?: string;
}

export type ExpenseCategory = 'fuel' | 'tolls' | 'parking' | 'maintenance' | 'other';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // Using string to easily manage date input value
  receiptUrl?: string;
  receiptDataUrl?: string; // To hold base64 data for previews
  tripId?: string; // Link to a specific trip
}

export interface FavoritePlace {
  id: string;
  name: string;
  address: string;
  isHome: boolean;
}

export interface ScannedReceiptData {
    vendor: string;
    amount: number;
    date: string;
}

export interface SuggestedTrip {
  id: string; // A temporary client-side ID
  startTime: Date;
  endTime: Date;
  distance: number;
  startAddress: string;
  endAddress: string;
}
