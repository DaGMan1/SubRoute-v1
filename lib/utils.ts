/**
 * Shared utility functions for SubRoute application
 */

/**
 * Date and time formatting utilities
 */
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
};

export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }); // HH:MM (24-hour)
};

export const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Navigation deep links
 */
export const openGoogleMaps = (
  destination: { lat: number; lng: number },
  origin?: { lat: number; lng: number },
  avoidTolls: boolean = false
): void => {
  let url = 'https://www.google.com/maps/dir/?api=1';

  if (origin) {
    url += `&origin=${origin.lat},${origin.lng}`;
  }

  url += `&destination=${destination.lat},${destination.lng}`;
  url += '&travelmode=driving&dir_action=navigate';

  if (avoidTolls) {
    url += '&avoid=tolls';
  }

  window.open(url, '_blank');
};

export const openWaze = (
  destination: { lat: number; lng: number },
  avoidTolls: boolean = false
): void => {
  let url = `https://waze.com/ul?ll=${destination.lat}%2C${destination.lng}`;
  url += '&navigate=yes&zoom=17';

  if (avoidTolls) {
    url += '&avoid_tolls=yes';
  }

  window.open(url, '_blank');
};

/**
 * Geospatial calculations using Haversine formula
 */
export const calculateDistance = (
  pos1: { lat: number; lng: number },
  pos2: { lat: number; lng: number }
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLon = (pos2.lng - pos1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

/**
 * String utilities
 */
export const truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
};

export const sanitizeForCSV = (str: string): string => {
  // Escape quotes and wrap in quotes if contains comma/newline
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Clipboard operations
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * Number formatting
 */
export const roundToDecimal = (num: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(amount);
};

export const formatDistance = (km: number): string => {
  return `${roundToDecimal(km, 1)} km`;
};

/**
 * Validation utilities
 */
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isValidLicensePlate = (plate: string): boolean => {
  // Australian plates: 3-7 characters (simplified)
  return /^[A-Z0-9]{3,7}$/.test(plate.toUpperCase().replace(/\s/g, ''));
};
