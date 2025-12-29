/**
 * Application-wide configuration constants
 */

export const APP_CONFIG = {
  name: 'SubRoute',
  version: '1.0.0',
  environment: (import.meta as any).env?.MODE || 'production', // 'development' | 'production'
} as const;

export const MAP_CONFIG = {
  defaultCenter: {
    lat: -27.4698,
    lng: 153.0251, // Brisbane, Australia
  },
  defaultZoom: 12,
  maxZoom: 18,
  minZoom: 8,
} as const;

export const GEOFENCE_CONFIG = {
  arrivalRadiusKm: 0.05, // 50 meters
  gpsUpdateIntervalMs: 5000, // 5 seconds
  gpsTimeout: 10000, // 10 seconds
  enableHighAccuracy: true,
} as const;

export const API_ENDPOINTS = {
  googleMaps: 'https://www.google.com/maps/dir/?api=1',
  waze: 'https://waze.com/ul',
} as const;

export const CSV_EXPORT_CONFIG = {
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'HH:MM',
  tripPurpose: 'Business - Courier Delivery',
  encoding: 'utf-8',
} as const;

export const VALIDATION_RULES = {
  passwordMinLength: 8,
  odometerMin: 0,
  odometerMax: 999999,
  fuelMinLiters: 0,
  fuelMaxLiters: 200,
  fuelMinCost: 0,
  fuelMaxCost: 1000,
} as const;

export const UI_CONFIG = {
  toastDuration: 3000, // 3 seconds
  animationDuration: 200, // 200ms
  debounceDelayMs: 300, // For search inputs
  touchTargetMinSize: 44, // 44x44px minimum (iOS guidelines)
} as const;
