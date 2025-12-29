# SubRoute Refactoring Plan

**Date**: 2025-12-29
**Purpose**: Clean up codebase before mobile UI fixes

---

## Issues Identified

### 1. Empty/Unused Files

**Server Directory** (10 files, ALL empty):
- `/server/schema.sql` (0 lines)
- `/server/utils/middleware.ts` (0 lines)
- `/server/index.ts` (0 lines)
- `/server/db.ts` (0 lines)
- `/server/routes/trips.ts` (0 lines)
- `/server/routes/vehicles.ts` (0 lines)
- `/server/routes/favoritePlaces.ts` (0 lines)
- `/server/routes/expenses.ts` (0 lines)
- `/server/routes/auth.ts` (0 lines)
- `/server/mock-data.ts` (0 lines)

**API Directory** (5 files, minimal usage):
- `/api/auth/oauth.ts` (40 lines - not used)
- `/api/auth/login.ts` (34 lines - not used)
- `/api/auth/[...route].ts` (30 lines - not used)
- `/api/auth/register.ts` (46 lines - not used)
- `/api/auth/db.ts` (11 lines - not used)

**Constants Directory** (2 files, both empty):
- `/constants/markdownContent.ts` (0 lines)
- `/constants/mockData.ts` (0 lines)

**Status**: These directories were created for future backend integration but are not currently used. The app uses Firebase for all backend operations.

---

## Refactoring Actions

### Action 1: Archive Unused Backend Code

**Rationale**: The app currently uses Firebase exclusively. These files are placeholders for a potential future Express.js backend that may never be needed.

**Solution**: Move to archive directory

```bash
mkdir -p docs/archived/future-backend
mv server docs/archived/future-backend/
mv api docs/archived/future-backend/
mv constants docs/archived/future-backend/
```

Create README explaining these are not used:

```markdown
# Archived: Future Backend Stubs

These directories contain placeholder files for a potential Express.js backend.

**Current Status**: NOT USED
**Current Backend**: Firebase (Firestore + Auth)

If you need to implement a custom backend in the future:
1. Review these stubs for structure ideas
2. Start fresh with current best practices
3. Consider if Firebase + Cloud Functions is sufficient

**Do not** move these back to the main codebase without a clear plan.
```

### Action 2: Create Shared Utilities Library

**Problem**: Repeated code across components (date formatting, navigation deep links, etc.)

**Solution**: Create `/lib/utils.ts`

```typescript
// /lib/utils.ts

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
 * Geospatial calculations
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
```

### Action 3: Create Configuration Constants

**Problem**: Magic strings and config values scattered throughout components

**Solution**: Create `/lib/config.ts`

```typescript
// /lib/config.ts

/**
 * Application-wide configuration constants
 */

export const APP_CONFIG = {
  name: 'SubRoute',
  version: '1.0.0',
  environment: import.meta.env.MODE, // 'development' | 'production'
} as const;

export const MAP_CONFIG = {
  defaultCenter: {
    lat: -27.4698,
    lng: 153.0251, // Brisbane, Australia
  },
  defaultZoom: 12,
  maxZoom: 18,
  minZoom: 8,
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
} as const;

export const GEOFENCE_CONFIG = {
  arrivalRadiusKm: 0.05, // 50 meters
  gpsUpdateIntervalMs: 5000, // 5 seconds
  gpsTimeout: 10000, // 10 seconds
  enableHighAccuracy: true,
} as const;

export const API_ENDPOINTS = {
  geocoding: 'https://nominatim.openstreetmap.org/search',
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
```

### Action 4: Consolidate Documentation

**Problem**: Multiple README files with overlapping information

**Current Files**:
- README.md
- PROJECT_STATUS.md (deprecated)
- PROJECT_ROADMAP.md (deprecated)
- IMPLEMENTATION_SUMMARY.md (deprecated)
- NOTION-STATUS-UPDATE.md (important - keep)
- docs/DEPLOYMENT.md (important - keep)
- docs/README-SYNC.md (important - keep)
- docs/BUG-TRACKING-GUIDE.md (important - keep)
- docs/PROCESS-FLOW.md (important - NEW)

**Solution**:
1. Update main README.md to be comprehensive
2. Archive old status files
3. Keep focused documentation in docs/

**New README Structure**:
```markdown
# SubRoute - Australian Courier Driver Platform

## Quick Start
[Installation, setup, running]

## Features
[List of current features]

## Documentation
- [Process Flow & Architecture](docs/PROCESS-FLOW.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Bug Tracking with Notion](docs/BUG-TRACKING-GUIDE.md)
- [Roadmap Sync](docs/README-SYNC.md)

## Development
[Contributing, testing, etc.]

## Tech Stack
[React, Firebase, etc.]

## License
```

### Action 5: Create Custom Hook for localStorage

**Problem**: localStorage logic repeated in every component

**Solution**: Create `/hooks/useLocalStorage.ts`

```typescript
// /hooks/useLocalStorage.ts
import { useState, useEffect } from 'react';

/**
 * Custom hook for syncing state with localStorage
 *
 * @param key - localStorage key
 * @param initialValue - Default value if key doesn't exist
 * @returns [value, setValue] tuple
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Get initial value from localStorage or use initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage whenever storedValue changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error writing localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
```

**Usage in components**:
```typescript
// Before (old way)
const [vehicles, setVehicles] = useState<Vehicle[]>([]);

useEffect(() => {
  const saved = localStorage.getItem('subroute_vehicles');
  if (saved) setVehicles(JSON.parse(saved));
}, []);

useEffect(() => {
  localStorage.setItem('subroute_vehicles', JSON.stringify(vehicles));
}, [vehicles]);

// After (new way)
const [vehicles, setVehicles] = useLocalStorage<Vehicle[]>('subroute_vehicles', []);
```

---

## Implementation Plan

### Phase 1: Archive Unused Code
1. Create `docs/archived/future-backend/` directory
2. Move `server/`, `api/`, `constants/` directories
3. Create README in archived folder
4. Update `.gitignore` if needed

### Phase 2: Create Utility Library
1. Create `/lib/utils.ts`
2. Create `/lib/config.ts`
3. Update imports in components (gradually)

### Phase 3: Create Custom Hooks
1. Create `/hooks/useLocalStorage.ts`
2. Refactor components to use hook (gradually)

### Phase 4: Consolidate Documentation
1. Update main README.md
2. Move old status files to `docs/archived/`
3. Keep only active docs in `docs/`

### Phase 5: Test Everything
1. Run `npm run build`
2. Test app in browser
3. Verify no imports broken
4. Check localStorage still works

---

## Files to Keep (Do NOT Archive)

**Root Files**:
- App.tsx
- index.tsx
- types.ts
- vite.config.ts
- tsconfig.json
- package.json
- index.html

**Components** (all active):
- components/Auth.tsx
- components/Dashboard.tsx
- components/SimpleRoutePlanner.tsx
- components/TripLogbook.tsx
- components/VehicleManager.tsx
- components/OdometerTracker.tsx
- components/Settings.tsx

**Libraries**:
- lib/firebase.ts
- lib/firestore.ts
- lib/utils.ts (NEW)
- lib/config.ts (NEW)

**Hooks**:
- hooks/useHeadingsObserver.ts
- hooks/useLocalStorage.ts (NEW)

**Documentation** (active):
- README.md
- docs/PROCESS-FLOW.md
- docs/DEPLOYMENT.md
- docs/BUG-TRACKING-GUIDE.md
- docs/README-SYNC.md
- docs/REFACTORING-PLAN.md (this file)
- NOTION-STATUS-UPDATE.md

---

## Success Criteria

- [ ] All unused backend code archived
- [ ] Shared utilities created
- [ ] Config constants centralized
- [ ] Custom hooks implemented
- [ ] Documentation consolidated
- [ ] Build passes without errors
- [ ] App functions correctly
- [ ] No broken imports
- [ ] Git commits properly organized

---

**Next Steps**: Execute this refactoring plan before tackling mobile UI issues.
