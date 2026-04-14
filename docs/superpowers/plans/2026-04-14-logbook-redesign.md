# Logbook Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix inflated trip distances by logging one entry per Done tap (session model), switch distance source to GPS accumulator, fix fuel stop modal, and add stop type + running odometer to logs.

**Architecture:** All changes are contained in `SimpleRoutePlanner.tsx`, `TripLogbook.tsx`, `lib/firestore.ts`, and `types.ts`. No new components — the existing fuel stop modal is fixed in-place. The session model is implemented by changing how `startNavigationToStop` handles interruptions (update destination only, don't reset GPS or re-create the session) and removing the partial trip write from the interruption path.

**Tech Stack:** React 19, TypeScript, Firebase/Firestore, GPS watchPosition API (already in use), Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `types.ts` | Add `stopType` field to `TripLog` interface |
| `lib/firestore.ts` | Add `saveFuelLog` + `subscribeToFuelLogs` for top-level fuelLogs collection |
| `components/SimpleRoutePlanner.tsx` | Fix `startNavigationToStop` (session model), fix `logCompletedTrip` (GPS distance, stop type), fix `saveFuelStopHandler` (use saveFuelLog) |
| `components/TripLogbook.tsx` | Display `stopType` in trip rows, add running odometer to today summary |

---

### Task 1: Add stopType to TripLog interface

**Files:**
- Modify: `types.ts:19-30`

- [ ] **Step 1: Add `stopType` to the TripLog interface**

In `types.ts`, change:
```typescript
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
```
to:
```typescript
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
  stopType?: 'pickup' | 'delivery';
}
```

- [ ] **Step 2: Commit**

```bash
git add types.ts
git commit -m "feat: add stopType field to TripLog interface"
```

---

### Task 2: Add saveFuelLog to firestore.ts

**Files:**
- Modify: `lib/firestore.ts`

The existing `saveFuelStop` saves to a nested path `users/{id}/vehicles/{vehicleId}/fuelStops/{id}`. This requires a vehicleId — if no default vehicle is set, the save fails. The fix is a top-level `fuelLogs` subcollection that doesn't require a vehicle.

- [ ] **Step 1: Add `saveFuelLog` and `subscribeToFuelLogs` to `lib/firestore.ts`**

Add at the end of the file:

```typescript
// ============================================
// FUEL LOGS (top-level, no vehicle required)
// ============================================

export interface FuelLog {
  id: string;
  timestamp: number;
  date: string;
  location?: string;
  odometerKm?: number;
  litres?: number;
  costAUD?: number;
  vehicle?: string;
}

export const saveFuelLog = async (userId: string, log: FuelLog): Promise<void> => {
  const ref = doc(db, 'users', userId, 'fuelLogs', log.id);
  await setDoc(ref, {
    ...log,
    timestamp: Timestamp.fromMillis(log.timestamp)
  });
};

export const subscribeToFuelLogs = (
  userId: string,
  callback: (logs: FuelLog[]) => void
): (() => void) => {
  const ref = collection(db, 'users', userId, 'fuelLogs');
  const q = query(ref, orderBy('timestamp', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(d => {
      const data = d.data();
      return { ...data, timestamp: data.timestamp.toMillis() } as FuelLog;
    });
    callback(logs);
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/firestore.ts
git commit -m "feat: add saveFuelLog + subscribeToFuelLogs to top-level fuelLogs collection"
```

---

### Task 3: Fix startNavigationToStop — session model

**Files:**
- Modify: `components/SimpleRoutePlanner.tsx:943-996`

Current behaviour on interruption (GO on a new stop while already navigating):
- Calls `logCompletedTrip(true)` → writes a partial entry to Firestore
- Resets `distanceTraveledRef.current = 0`
- Creates a brand-new `activeTrip` object (losing the original `origin` and `startTime`)

New behaviour on interruption:
- No partial write
- Keep GPS distance accumulating (don't reset the ref)
- Update `activeTrip` destination/destinationLocation/destinationStopId only — keep origin and startTime from the first GO tap

- [ ] **Step 1: Add `stopType` to the `activeTrip` state shape** (around line 107)

Change:
```typescript
const [activeTrip, setActiveTrip] = useState<{
  origin: string;
  originLocation: google.maps.LatLngLiteral;
  destination: string;
  destinationLocation: google.maps.LatLngLiteral;
  destinationStopId: string;
  startTime: number;
} | null>(null);
```
to:
```typescript
const [activeTrip, setActiveTrip] = useState<{
  origin: string;
  originLocation: google.maps.LatLngLiteral;
  destination: string;
  destinationLocation: google.maps.LatLngLiteral;
  destinationStopId: string;
  startTime: number;
  stopType?: 'pickup' | 'delivery';
} | null>(null);
```

- [ ] **Step 2: Rewrite `startNavigationToStop` (lines 943–996)**

Replace the entire function body (keep the function signature):

```typescript
const startNavigationToStop = (stop: Stop, navApp: 'google' | 'waze') => {
  console.log('[SubRoute] Starting navigation to:', stop.address, 'via', navApp);

  let tripToSet: typeof activeTrip;

  if (activeTrip && activeTrip.destinationStopId !== stop.id) {
    // INTERRUPTION: different stop — keep origin, startTime, GPS distance as-is
    // Just update where we're heading
    console.log('[SubRoute] Diverting from', activeTrip.destination, 'to', stop.address, '— keeping session open');
    tripToSet = {
      ...activeTrip,
      destination: stop.address,
      destinationLocation: stop.location,
      destinationStopId: stop.id,
      stopType: stop.type === 'depot' ? undefined : stop.type,
    };
    setActiveTrip(tripToSet);
  } else if (!activeTrip) {
    // NEW SESSION: first GO tap (or Re-Nav on current stop with no session)
    const origin = lastGpsPosition.current || currentLocation || null;
    const originAddress = lastDestinationAddress.current || depotAddress?.address || 'Current Location';
    distanceTraveledRef.current = 0;
    tripToSet = {
      origin: originAddress,
      originLocation: origin || stop.location,
      destination: stop.address,
      destinationLocation: stop.location,
      destinationStopId: stop.id,
      startTime: Date.now(),
      stopType: stop.type === 'depot' ? undefined : stop.type,
    };
    console.log('[SubRoute] Starting NEW trip session:', tripToSet);
    setActiveTrip(tripToSet);
    if (origin) lastGpsPosition.current = origin;
  } else {
    // RE-NAV on the same active stop — keep everything, just re-open nav app
    tripToSet = activeTrip;
    console.log('[SubRoute] Re-navigating to same stop:', stop.address);
  }

  // Set tapped stop to active, return any currently active stop to pending
  setStops(prev => prev.map(s => {
    if (s.id === stop.id) return { ...s, status: 'active' };
    if (s.status === 'active') return { ...s, status: 'pending' };
    return s;
  }));

  // CRITICAL: Persist to localStorage SYNCHRONOUSLY before navigating away
  persistRouteStateSync({ activeTrip: tripToSet });

  // Use address text — far more accurate entry point than raw coordinates
  const encodedAddress = encodeURIComponent(stop.address);
  const origin = lastGpsPosition.current || currentLocation || null;
  try {
    if (navApp === 'google') {
      const url = origin
        ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${encodedAddress}&travelmode=driving&dir_action=navigate`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving&dir_action=navigate`;
      console.log('[SubRoute] Opening Google Maps:', url);
      window.location.href = url;
    } else {
      const wazeUrl = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
      console.log('[SubRoute] Opening Waze:', wazeUrl);
      window.location.href = wazeUrl;
    }
  } catch (e) {
    console.error('[SubRoute] Failed to open navigation app:', e);
    alert('Failed to open navigation app. Please try again.');
  }
};
```

- [ ] **Step 3: Verify build**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/SimpleRoutePlanner.tsx
git commit -m "fix: session model — interruptions keep GPS session open, no partial trip writes"
```

---

### Task 4: Switch logCompletedTrip to GPS distance

**Files:**
- Modify: `components/SimpleRoutePlanner.tsx:785-899`

Current code calls Google Directions API (`getRouteDistance`) which makes a Maps API call and adds latency. The GPS accumulator (`distanceTraveledRef.current`) already has the actual road distance driven. Use it directly.

- [ ] **Step 1: Replace the distance calculation in `logCompletedTrip`**

Find this block (lines ~824–837):
```typescript
// Fetch road distance and vehicle info in parallel
const [distanceResult, vehiclesResult] = await Promise.allSettled([
  getRouteDistance(tripToLog.originLocation, actualDestinationLocation),
  getVehicles(user.id),
]);

let distanceKm = distanceResult.status === 'fulfilled' ? distanceResult.value : 0;
if (distanceKm === 0) {
  const straightLine = calculateDistance(tripToLog.originLocation, actualDestinationLocation);
  distanceKm = straightLine * 1.3;
  console.log('[SubRoute] Using straight-line fallback:', distanceKm.toFixed(1), 'km');
} else {
  console.log('[SubRoute] Route distance from Google:', distanceKm, 'km');
}
```

Replace with:
```typescript
// Use GPS-accumulated distance (already tracking via watchPosition)
let distanceKm = distanceTraveledRef.current;
distanceTraveledRef.current = 0; // Reset for next trip
console.log('[SubRoute] GPS accumulated distance:', distanceKm.toFixed(2), 'km');

if (distanceKm < 0.05) {
  // GPS didn't accumulate — fall back to straight-line × 1.3
  const straightLine = calculateDistance(tripToLog.originLocation, tripToLog.destinationLocation);
  distanceKm = straightLine * 1.3;
  console.log('[SubRoute] GPS too low, using straight-line fallback:', distanceKm.toFixed(1), 'km');
}

// Fetch vehicle info
const [vehiclesResult] = await Promise.allSettled([getVehicles(user.id)]);
```

- [ ] **Step 2: Pass stopType when building the TripLog object**

Find this block (~line 850):
```typescript
const tripLog: TripLog = {
  id: Date.now().toString(),
  timestamp: endTime,
  date: new Date(endTime).toISOString().split('T')[0],
  startTime: new Date(tripToLog.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
  endTime: new Date(endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
  origin: tripToLog.origin,
  destination: isPartialTrip ? `${tripToLog.destination} (partial)` : tripToLog.destination,
  distanceKm: Math.round(distanceKm * 10) / 10,
  vehicleString,
  durationMinutes,
};
```

Replace with (remove isPartialTrip references, add stopType):
```typescript
const tripLog: TripLog = {
  id: Date.now().toString(),
  timestamp: endTime,
  date: new Date(endTime).toISOString().split('T')[0],
  startTime: new Date(tripToLog.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
  endTime: new Date(endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
  origin: tripToLog.origin,
  destination: tripToLog.destination,
  distanceKm: Math.round(distanceKm * 10) / 10,
  vehicleString,
  durationMinutes,
  stopType: tripToLog.stopType,
};
```

- [ ] **Step 3: Clean up isPartialTrip dead code**

The `isPartialTrip` parameter is no longer used (partial trips are never logged after Task 3). Remove it:

Change the function signature:
```typescript
const logCompletedTrip = async () => {
```

Remove all references to `isPartialTrip` inside the function. The `actualDestinationLocation` and `actualDestinationAddress` variables that were conditional on `isPartialTrip` can also be removed — use `tripToLog.destinationLocation` / `tripToLog.destination` directly.

The stop-marking block at the end (currently guarded by `!isPartialTrip`) should always run:
```typescript
// Mark stop as done and update origin for next trip
setStops(prev => prev.map(s =>
  s.id === tripToLog.destinationStopId ? { ...s, status: 'done' } : s
));
lastGpsPosition.current = tripToLog.destinationLocation;
lastDestinationAddress.current = tripToLog.destination;
```

- [ ] **Step 4: Update the two `logCompletedTrip()` call sites to remove the argument**

Search for `logCompletedTrip(` in the file. After Task 3, the only remaining call sites should be:
- `handleDone`: `await logCompletedTrip(false)` → change to `await logCompletedTrip()`
- Auto-arrival detection (~line 336): `logCompletedTrip()` — already has no argument, leave as-is

- [ ] **Step 5: Verify build**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add components/SimpleRoutePlanner.tsx
git commit -m "fix: use GPS accumulated distance in logCompletedTrip, remove isPartialTrip dead code"
```

---

### Task 5: Fix fuel stop modal — use saveFuelLog, remove vehicle requirement

**Files:**
- Modify: `components/SimpleRoutePlanner.tsx:1-20` (imports), `1099-1167` (saveFuelStopHandler)

The current handler fails when no default vehicle is set. The fix uses the top-level `saveFuelLog` added in Task 2. Also remove the hard odometer requirement — it's optional.

- [ ] **Step 1: Add `saveFuelLog` and `FuelLog` to the imports at the top of SimpleRoutePlanner.tsx**

Find the import block from `'../lib/firestore'` (lines 3-18) and add `saveFuelLog` and the `FuelLog` type:

```typescript
import {
  saveUserPreferences,
  getUserPreferences,
  saveTripLog,
  getVehicles,
  saveAddressToHistory,
  getAddressHistory,
  saveFavoriteAddress,
  deleteFavoriteAddress,
  subscribeToFavoriteAddresses,
  saveFuelStop,
  saveFuelLog,
  updateVehicleOdometer,
  getTripLogs,
  type SavedAddress,
  type FavoriteAddress,
  type FuelLog
} from '../lib/firestore';
```

- [ ] **Step 2: Replace `saveFuelStopHandler`**

Replace the entire `saveFuelStopHandler` function (lines 1099–1167) with:

```typescript
const saveFuelStopHandler = async () => {
  if (fuelStopSaving) return;
  setFuelStopSaving(true);

  try {
    const now = Date.now();
    const log: FuelLog = {
      id: now.toString(),
      timestamp: now,
      date: new Date(now).toISOString().split('T')[0],
      location: fuelStopLocation || undefined,
      odometerKm: fuelStopOdometer ? parseFloat(fuelStopOdometer) : undefined,
      litres: fuelStopLiters ? parseFloat(fuelStopLiters) : undefined,
      costAUD: fuelStopCost ? parseFloat(fuelStopCost) : undefined,
    };

    // Attach vehicle string if a default vehicle exists
    try {
      const vehicles = await getVehicles(user.id);
      const defaultVehicle = vehicles.find((v: Vehicle) => v.isDefault);
      if (defaultVehicle) {
        log.vehicle = `${defaultVehicle.make} ${defaultVehicle.model} (${defaultVehicle.plate})`;
        // Update vehicle's tracked odometer if reading was entered
        if (log.odometerKm) {
          await updateVehicleOdometer(user.id, defaultVehicle.id, log.odometerKm);
        }
      }
    } catch (e) {
      console.warn('[SubRoute] Could not attach vehicle to fuel log:', e);
    }

    await saveFuelLog(user.id, log);
    console.log('[SubRoute] Fuel stop logged:', log);

    setFuelStopLocation('');
    setFuelStopLiters('');
    setFuelStopCost('');
    setFuelStopOdometer('');
    setShowFuelStopModal(false);
    alert('Fuel stop logged!');
  } catch (e) {
    console.error('[SubRoute] Failed to save fuel stop:', e);
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    alert('Failed to save fuel stop: ' + errorMsg);
  } finally {
    setFuelStopSaving(false);
  }
};
```

- [ ] **Step 3: Remove the required marker from the odometer label in the modal UI**

Find (~line 2430):
```typescript
Odometer Reading (km) <span className="text-red-600">*</span>
```
Change to:
```typescript
Odometer Reading (km)
```

Also update the helper text (~line 2410–2412):
```typescript
<p className="text-sm text-gray-600 mb-4">
  Record your fuel stop. Odometer reading is required, other fields are optional.
</p>
```
Change to:
```typescript
<p className="text-sm text-gray-600 mb-4">
  Record your fuel stop. All fields are optional — fill in what you have.
</p>
```

- [ ] **Step 4: Verify build**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/SimpleRoutePlanner.tsx lib/firestore.ts
git commit -m "fix: fuel stop uses top-level fuelLogs collection, no vehicle required"
```

---

### Task 6: Add stopType and running odometer to logbook display

**Files:**
- Modify: `components/TripLogbook.tsx`

- [ ] **Step 1: Add stopType to the individual trip rows**

In the trip list rendering (search for where individual `TripLog` entries are displayed — look for `log.origin`, `log.destination`), add a stop type badge.

Find the section rendering individual trip rows. It will look something like:
```tsx
<div>{log.origin} → {log.destination}</div>
<div>{log.distanceKm} km</div>
```

Add after the distance display:
```tsx
{log.stopType && (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
    log.stopType === 'pickup'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-green-100 text-green-700'
  }`}>
    {log.stopType === 'pickup' ? 'Pickup' : 'Delivery'}
  </span>
)}
```

- [ ] **Step 2: Add running odometer to today's summary**

Add vehicle state near the top of the component (after the `logs` state):
```typescript
const [runningOdometer, setRunningOdometer] = useState<number | null>(null);
```

Add a `useEffect` to calculate it (place it after the fuel stats effect):
```typescript
useEffect(() => {
  const loadOdometer = async () => {
    try {
      const vehicles = await getVehicles(user.id);
      const defaultVehicle = vehicles.find((v: Vehicle) => v.isDefault);
      if (!defaultVehicle) return;

      // currentOdometer is updated each time the user saves a fuel stop.
      // Add today's trip distances on top to show current position.
      const baseOdo = defaultVehicle.currentOdometer || defaultVehicle.startOdometer || 0;
      const todayDate = new Date().toISOString().split('T')[0];
      const todayKm = logs
        .filter(l => l.date === todayDate)
        .reduce((sum, l) => sum + l.distanceKm, 0);
      setRunningOdometer(Math.round(baseOdo + todayKm));
    } catch (e) {
      console.error('Failed to load odometer:', e);
    }
  };
  loadOdometer();
}, [user.id, logs]);
```

Make sure `getVehicles` is imported — check the existing imports at the top of `TripLogbook.tsx` (it already imports `getVehicles`).

- [ ] **Step 3: Display running odometer in the today summary section**

Find the today summary stats (search for `totalDistance` or `totalTrips` in the JSX). Add a row for odometer:

```tsx
{runningOdometer !== null && (
  <div className="text-center">
    <div className="text-2xl font-bold text-brand-gray-900">{runningOdometer.toLocaleString()}</div>
    <div className="text-xs text-brand-gray-500 uppercase tracking-wide">Odometer (km)</div>
  </div>
)}
```

- [ ] **Step 4: Verify build**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/TripLogbook.tsx
git commit -m "feat: show stopType badge and running odometer in logbook"
```

---

### Task 7: Final build and push

- [ ] **Step 1: Full production build**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npm run build
```
Expected: build completes, no TypeScript errors, chunk size warnings are acceptable

- [ ] **Step 2: Push to GitLab (triggers Vercel deploy)**

```bash
git push gitlab main
```

- [ ] **Step 3: Verify deployment**

Open the Vercel URL and confirm:
1. Add 2 stops, tap GO on first, tap GO on second (interruption) — only ONE trip entry should appear in logbook after tapping Done on the second stop
2. Fuel stop modal opens, fills in location auto, accepts save without odometer
3. Today's summary shows running odometer
4. Trip rows show Pickup/Delivery badge

