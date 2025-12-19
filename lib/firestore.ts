import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import type { TripLog, Vehicle, FuelStop, ServiceReminder } from '../types';

// ============================================
// TRIP LOGS
// ============================================

export const saveTripLog = async (userId: string, tripLog: TripLog): Promise<void> => {
  const tripRef = doc(db, 'users', userId, 'trips', tripLog.id);
  await setDoc(tripRef, {
    ...tripLog,
    timestamp: Timestamp.fromMillis(tripLog.timestamp)
  });
};

export const getTripLogs = async (userId: string): Promise<TripLog[]> => {
  const tripsRef = collection(db, 'users', userId, 'trips');
  const q = query(tripsRef, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      timestamp: data.timestamp.toMillis()
    } as TripLog;
  });
};

export const subscribeToTripLogs = (
  userId: string,
  callback: (trips: TripLog[]) => void
): (() => void) => {
  const tripsRef = collection(db, 'users', userId, 'trips');
  const q = query(tripsRef, orderBy('timestamp', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const trips = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        timestamp: data.timestamp.toMillis()
      } as TripLog;
    });
    callback(trips);
  });
};

export const clearAllTripLogs = async (userId: string): Promise<void> => {
  const tripsRef = collection(db, 'users', userId, 'trips');
  const snapshot = await getDocs(tripsRef);

  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
};

// ============================================
// VEHICLES
// ============================================

export const saveVehicle = async (userId: string, vehicle: Vehicle): Promise<void> => {
  const vehicleRef = doc(db, 'users', userId, 'vehicles', vehicle.id);
  await setDoc(vehicleRef, vehicle);
};

export const getVehicles = async (userId: string): Promise<Vehicle[]> => {
  const vehiclesRef = collection(db, 'users', userId, 'vehicles');
  const snapshot = await getDocs(vehiclesRef);

  return snapshot.docs.map(doc => doc.data() as Vehicle);
};

export const subscribeToVehicles = (
  userId: string,
  callback: (vehicles: Vehicle[]) => void
): (() => void) => {
  const vehiclesRef = collection(db, 'users', userId, 'vehicles');

  return onSnapshot(vehiclesRef, (snapshot) => {
    const vehicles = snapshot.docs.map(doc => doc.data() as Vehicle);
    callback(vehicles);
  });
};

export const deleteVehicle = async (userId: string, vehicleId: string): Promise<void> => {
  const vehicleRef = doc(db, 'users', userId, 'vehicles', vehicleId);
  await deleteDoc(vehicleRef);
};

export const getDefaultVehicle = async (userId: string): Promise<Vehicle | null> => {
  const vehiclesRef = collection(db, 'users', userId, 'vehicles');
  const q = query(vehiclesRef, where('isDefault', '==', true));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as Vehicle;
};

// ============================================
// USER PREFERENCES
// ============================================

export interface UserPreferences {
  depotAddress?: string;
  currentOdometer?: number;
}

export const saveUserPreferences = async (userId: string, prefs: UserPreferences): Promise<void> => {
  const prefsRef = doc(db, 'users', userId, 'preferences', 'main');
  await setDoc(prefsRef, prefs, { merge: true });
};

export const getUserPreferences = async (userId: string): Promise<UserPreferences> => {
  const prefsRef = doc(db, 'users', userId, 'preferences', 'main');
  const snapshot = await getDoc(prefsRef);

  if (!snapshot.exists()) {
    return {};
  }

  return snapshot.data() as UserPreferences;
};

export const subscribeToUserPreferences = (
  userId: string,
  callback: (prefs: UserPreferences) => void
): (() => void) => {
  const prefsRef = doc(db, 'users', userId, 'preferences', 'main');

  return onSnapshot(prefsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as UserPreferences);
    } else {
      callback({});
    }
  });
};

// ============================================
// ADDRESS HISTORY & FAVORITES
// ============================================

export interface SavedAddress {
  id: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  lastUsed?: number;
  useCount?: number;
}

export interface FavoriteAddress extends SavedAddress {
  name: string; // Custom name like "Depot", "Client - Joe's Pizza"
  createdAt: number;
}

export const saveAddressToHistory = async (userId: string, address: SavedAddress): Promise<void> => {
  const historyRef = doc(db, 'users', userId, 'addressHistory', address.id);
  await setDoc(historyRef, {
    ...address,
    lastUsed: Date.now(),
    useCount: (await getDoc(historyRef)).exists()
      ? ((await getDoc(historyRef)).data()?.useCount || 0) + 1
      : 1
  });
};

export const getAddressHistory = async (userId: string, limit: number = 50): Promise<SavedAddress[]> => {
  const historyRef = collection(db, 'users', userId, 'addressHistory');
  const q = query(historyRef, orderBy('lastUsed', 'desc'), where('lastUsed', '!=', null));
  const snapshot = await getDocs(q);

  return snapshot.docs.slice(0, limit).map(doc => doc.data() as SavedAddress);
};

export const saveFavoriteAddress = async (userId: string, favorite: FavoriteAddress): Promise<void> => {
  const favRef = doc(db, 'users', userId, 'favorites', favorite.id);
  await setDoc(favRef, {
    ...favorite,
    createdAt: favorite.createdAt || Date.now()
  });
};

export const getFavoriteAddresses = async (userId: string): Promise<FavoriteAddress[]> => {
  const favRef = collection(db, 'users', userId, 'favorites');
  const q = query(favRef, orderBy('name', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => doc.data() as FavoriteAddress);
};

export const deleteFavoriteAddress = async (userId: string, favoriteId: string): Promise<void> => {
  const favRef = doc(db, 'users', userId, 'favorites', favoriteId);
  await deleteDoc(favRef);
};

export const subscribeToFavoriteAddresses = (
  userId: string,
  callback: (favorites: FavoriteAddress[]) => void
): (() => void) => {
  const favRef = collection(db, 'users', userId, 'favorites');
  const q = query(favRef, orderBy('name', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const favorites = snapshot.docs.map(doc => doc.data() as FavoriteAddress);
    callback(favorites);
  });
};

// ============================================
// FUEL STOPS & ODOMETER
// ============================================

export const saveFuelStop = async (userId: string, vehicleId: string, fuelStop: FuelStop): Promise<void> => {
  const fuelRef = doc(db, 'users', userId, 'vehicles', vehicleId, 'fuelStops', fuelStop.id);
  await setDoc(fuelRef, {
    ...fuelStop,
    timestamp: Timestamp.fromMillis(fuelStop.timestamp)
  });
};

export const getFuelStops = async (userId: string, vehicleId: string): Promise<FuelStop[]> => {
  const fuelRef = collection(db, 'users', userId, 'vehicles', vehicleId, 'fuelStops');
  const q = query(fuelRef, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      timestamp: data.timestamp.toMillis()
    } as FuelStop;
  });
};

export const subscribeToFuelStops = (
  userId: string,
  vehicleId: string,
  callback: (fuelStops: FuelStop[]) => void
): (() => void) => {
  const fuelRef = collection(db, 'users', userId, 'vehicles', vehicleId, 'fuelStops');
  const q = query(fuelRef, orderBy('timestamp', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const fuelStops = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        timestamp: data.timestamp.toMillis()
      } as FuelStop;
    });
    callback(fuelStops);
  });
};

export const deleteFuelStop = async (userId: string, vehicleId: string, fuelStopId: string): Promise<void> => {
  const fuelRef = doc(db, 'users', userId, 'vehicles', vehicleId, 'fuelStops', fuelStopId);
  await deleteDoc(fuelRef);
};

// Service Reminders
export const saveServiceReminder = async (userId: string, vehicleId: string, reminder: ServiceReminder): Promise<void> => {
  const reminderRef = doc(db, 'users', userId, 'vehicles', vehicleId, 'serviceReminders', reminder.id);
  await setDoc(reminderRef, reminder);
};

export const getServiceReminders = async (userId: string, vehicleId: string): Promise<ServiceReminder[]> => {
  const reminderRef = collection(db, 'users', userId, 'vehicles', vehicleId, 'serviceReminders');
  const snapshot = await getDocs(reminderRef);

  return snapshot.docs.map(doc => doc.data() as ServiceReminder);
};

export const subscribeToServiceReminders = (
  userId: string,
  vehicleId: string,
  callback: (reminders: ServiceReminder[]) => void
): (() => void) => {
  const reminderRef = collection(db, 'users', userId, 'vehicles', vehicleId, 'serviceReminders');

  return onSnapshot(reminderRef, (snapshot) => {
    const reminders = snapshot.docs.map(doc => doc.data() as ServiceReminder);
    callback(reminders);
  });
};

export const deleteServiceReminder = async (userId: string, vehicleId: string, reminderId: string): Promise<void> => {
  const reminderRef = doc(db, 'users', userId, 'vehicles', vehicleId, 'serviceReminders', reminderId);
  await deleteDoc(reminderRef);
};

// Update vehicle's current odometer
export const updateVehicleOdometer = async (userId: string, vehicleId: string, currentOdometer: number): Promise<void> => {
  const vehicleRef = doc(db, 'users', userId, 'vehicles', vehicleId);
  await setDoc(vehicleRef, { currentOdometer }, { merge: true });
};
