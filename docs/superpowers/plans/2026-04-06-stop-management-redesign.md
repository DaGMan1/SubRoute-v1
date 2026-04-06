# Stop Management & Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign stop state management so stops flow PENDING → ACTIVE → DONE with auto-sorting by nearest, interrupt-safe GO behavior, a Done button that doesn't redirect, and navigation URLs that use address text instead of coordinates.

**Architecture:** All changes are in `components/SimpleRoutePlanner.tsx`. The `Stop` interface gains a `status` field. The `completedStops` Set is removed and replaced by `stop.status === 'done'`. A `sortedStops` computed array replaces the current reversed stop array in both desktop and mobile renderers. The `logCompletedTrip` function is updated to set stop status instead of the removed Set.

**Tech Stack:** React, TypeScript, Tailwind CSS, Google Maps JS API, localStorage persistence, Firebase/Firestore

---

## File Map

| File | Change |
|------|--------|
| `components/SimpleRoutePlanner.tsx:25-31` | Add `status` field to `Stop` interface |
| `components/SimpleRoutePlanner.tsx:93` | Remove `completedStops` state |
| `components/SimpleRoutePlanner.tsx:100-155` | Update localStorage load/save to use `stop.status` |
| `components/SimpleRoutePlanner.tsx:479-505` | Update `addStopAndNavigate` — new stop starts as `pending`, no auto-navigate |
| `components/SimpleRoutePlanner.tsx:595-640` | Update `optimizeRouteWithDirections` — filter by `status !== 'done'` |
| `components/SimpleRoutePlanner.tsx:847-852` | Update `logCompletedTrip` — set stop status instead of completedStops Set |
| `components/SimpleRoutePlanner.tsx:895-915` | Update `persistRouteStateSync` — remove completedStops |
| `components/SimpleRoutePlanner.tsx:921-968` | Rewrite `startNavigationToStop` — set status, use address URL |
| `components/SimpleRoutePlanner.tsx:974-981` | Rewrite `manualCompleteStop` → `handleDone` |
| `components/SimpleRoutePlanner.tsx:1520-1650` | Rewrite desktop stop card rendering |
| `components/SimpleRoutePlanner.tsx:1900-2010` | Rewrite mobile stop card rendering |

---

## Task 1: Add `status` to Stop interface

**Files:**
- Modify: `components/SimpleRoutePlanner.tsx:25-31`

- [ ] **Step 1: Update the Stop interface**

Find this block at line 25:
```typescript
interface Stop {
  id: string;
  address: string;
  location: google.maps.LatLngLiteral;
  type?: 'pickup' | 'delivery' | 'depot';
  notes?: string;
}
```

Replace with:
```typescript
interface Stop {
  id: string;
  address: string;
  location: google.maps.LatLngLiteral;
  type?: 'pickup' | 'delivery' | 'depot';
  notes?: string;
  status: 'pending' | 'active' | 'done';
}
```

- [ ] **Step 2: Verify build catches all missing status fields**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit 2>&1 | grep "status" | head -20
```

This will show every place that creates a `Stop` object without a `status` field. Use this list to guide Task 2.

- [ ] **Step 3: Commit**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && git add components/SimpleRoutePlanner.tsx && git commit -m "feat: add status field to Stop interface"
```

---

## Task 2: Add `status: 'pending'` to all Stop creation sites

**Files:**
- Modify: `components/SimpleRoutePlanner.tsx` — all `Stop` object literals

There are several places that create Stop objects. Add `status: 'pending'` to each:

- [ ] **Step 1: Fix `addStopAndNavigate` (line ~480)**

Find:
```typescript
const newStop: Stop = {
  id: Date.now().toString(),
  address,
  location,
  type,
};
```
Replace with:
```typescript
const newStop: Stop = {
  id: Date.now().toString(),
  address,
  location,
  type,
  status: 'pending',
};
```

- [ ] **Step 2: Fix the depot Stop creation (line ~1141)**

Find the depot Stop object (search for `const depot: Stop = {`):
```typescript
const depot: Stop = {
  id: 'depot',
  address: depotAddress.address,
  location: depotAddress.location,
  type: 'depot',
};
```
Replace with:
```typescript
const depot: Stop = {
  id: 'depot',
  address: depotAddress.address,
  location: depotAddress.location,
  type: 'depot',
  status: 'pending',
};
```

- [ ] **Step 3: Fix the `addCurrentLocation` Stop creation (line ~555)**

Find the Stop literal inside `addCurrentLocation`:
```typescript
setPendingStop({
  address: results[0].formatted_address,
  location: currentLocation,
```
This uses `pendingStop` not a `Stop`, so no change needed here. Search for any remaining Stop literals with `npx tsc --noEmit 2>&1 | grep "status"` — fix any that remain.

- [ ] **Step 4: Fix localStorage load migration (line ~106)**

In the `useEffect` that loads saved routes, after parsing `savedStops`, add a migration to handle old saves that lack `status`:

Find:
```typescript
if (savedStops && savedStops.length > 0) {
  setStops(savedStops);
```
Replace with:
```typescript
if (savedStops && savedStops.length > 0) {
  // Migrate old saves: assign status from completedStops and activeTrip
  const migratedStops = savedStops.map((s: Stop) => {
    if (s.status) return s; // already has status, use it
    if (savedCompleted && savedCompleted.includes(s.id)) return { ...s, status: 'done' as const };
    if (savedActiveTrip && savedActiveTrip.destinationStopId === s.id) return { ...s, status: 'active' as const };
    return { ...s, status: 'pending' as const };
  });
  setStops(migratedStops);
```

- [ ] **Step 5: Verify build passes**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit 2>&1
```
Expected: no errors about `status`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && git add components/SimpleRoutePlanner.tsx && git commit -m "feat: populate status field on all Stop creation sites with migration for saved data"
```

---

## Task 3: Remove `completedStops` Set — replace with `stop.status`

**Files:**
- Modify: `components/SimpleRoutePlanner.tsx`

- [ ] **Step 1: Remove the `completedStops` state declaration (line ~93)**

Find and delete:
```typescript
const [completedStops, setCompletedStops] = useState<Set<string>>(new Set()); // Track by stop.id, not address
```

- [ ] **Step 2: Remove `completedStops` from the localStorage save effect (line ~137-154)**

Find:
```typescript
if (stops.length > 0 || routeDetails || routeStartTime || activeTrip || completedStops.size > 0) {
  try {
    const routeState = {
      stops,
      routeDetails,
      routeStartTime,
      depotStart: routeBegunFromDepot,
      activeTrip,
      completedStops: Array.from(completedStops),
      savedDate: new Date().toISOString().split('T')[0],
    };
```
Replace with:
```typescript
if (stops.length > 0 || routeDetails || routeStartTime || activeTrip) {
  try {
    const routeState = {
      stops,
      routeDetails,
      routeStartTime,
      depotStart: routeBegunFromDepot,
      activeTrip,
      savedDate: new Date().toISOString().split('T')[0],
    };
```

Also remove `completedStops` from the effect dependency array:
```typescript
  }, [stops, routeDetails, routeStartTime, routeBegunFromDepot, activeTrip, user.id]);
```

- [ ] **Step 3: Remove `completedStops` from `persistRouteStateSync` (line ~900-915)**

Find:
```typescript
const persistRouteStateSync = (overrides: {
  activeTrip?: typeof activeTrip;
  stops?: Stop[];
  completedStops?: Set<string>;
} = {}) => {
  try {
    const routeState = {
      stops: overrides.stops ?? stops,
      routeDetails,
      routeStartTime,
      depotStart: routeBegunFromDepot,
      activeTrip: overrides.activeTrip !== undefined ? overrides.activeTrip : activeTrip,
      completedStops: Array.from(overrides.completedStops ?? completedStops),
      savedDate: new Date().toISOString().split('T')[0],
    };
```
Replace with:
```typescript
const persistRouteStateSync = (overrides: {
  activeTrip?: typeof activeTrip;
  stops?: Stop[];
} = {}) => {
  try {
    const routeState = {
      stops: overrides.stops ?? stops,
      routeDetails,
      routeStartTime,
      depotStart: routeBegunFromDepot,
      activeTrip: overrides.activeTrip !== undefined ? overrides.activeTrip : activeTrip,
      savedDate: new Date().toISOString().split('T')[0],
    };
```

- [ ] **Step 4: Update `logCompletedTrip` — replace `setCompletedStops` with `setStops` status update (line ~847)**

Find:
```typescript
      if (!isPartialTrip) {
        const newCompletedStops = new Set(completedStops);
        newCompletedStops.add(tripToLog.destinationStopId);
        setCompletedStops(newCompletedStops);
        console.log('[SubRoute] Stop marked as completed:', tripToLog.destination, 'ID:', tripToLog.destinationStopId);
      } else {
        console.log('[SubRoute] Partial trip - stop NOT marked as completed');
      }
```
Replace with:
```typescript
      if (!isPartialTrip) {
        setStops(prev => prev.map(s =>
          s.id === tripToLog.destinationStopId ? { ...s, status: 'done' } : s
        ));
        console.log('[SubRoute] Stop marked as done:', tripToLog.destination, 'ID:', tripToLog.destinationStopId);
      } else {
        console.log('[SubRoute] Partial trip - stop NOT marked as done');
      }
```

- [ ] **Step 5: Update `optimizeRouteWithDirections` — replace `completedStops.has` (line ~595)**

Find:
```typescript
    const uncompleted = stops.filter(s => !completedStops.has(s.id));
```
Replace with:
```typescript
    const uncompleted = stops.filter(s => s.status !== 'done');
```

Find:
```typescript
      const completedList = stops.filter(s => completedStops.has(s.id));
      setStops([...completedList, ...newUncompleted]);
```
Replace with:
```typescript
      const doneList = stops.filter(s => s.status === 'done');
      setStops([...newUncompleted, ...doneList]);
```

- [ ] **Step 6: Verify build passes**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && git add components/SimpleRoutePlanner.tsx && git commit -m "feat: replace completedStops Set with stop.status field"
```

---

## Task 4: Rewrite `startNavigationToStop` — new GO behavior + address URLs

**Files:**
- Modify: `components/SimpleRoutePlanner.tsx:921-968`

- [ ] **Step 1: Rewrite `startNavigationToStop`**

Find the entire function starting at `const startNavigationToStop = (stop: Stop, navApp: 'google' | 'waze') => {` through its closing `};` and replace with:

```typescript
  const startNavigationToStop = (stop: Stop, navApp: 'google' | 'waze') => {
    console.log('[SubRoute] Starting navigation to:', stop.address, 'via', navApp);

    // If there's an active trip to a DIFFERENT destination, silently log it as partial
    if (activeTrip && activeTrip.destinationStopId !== stop.id) {
      console.log('[SubRoute] Active trip to:', activeTrip.destination, '- silently logging partial trip');
      logCompletedTrip(true);
    }

    // Set tapped stop to active, return any other active stop to pending
    setStops(prev => prev.map(s => {
      if (s.id === stop.id) return { ...s, status: 'active' };
      if (s.status === 'active') return { ...s, status: 'pending' };
      return s;
    }));

    const origin = lastGpsPosition.current || currentLocation || null;
    const originAddress = lastDestinationAddress.current || depotAddress?.address || 'Current Location';

    distanceTraveledRef.current = 0;
    const newTrip = {
      origin: originAddress,
      originLocation: origin || stop.location,
      destination: stop.address,
      destinationLocation: stop.location,
      destinationStopId: stop.id,
      startTime: Date.now(),
    };
    setActiveTrip(newTrip);
    if (origin) lastGpsPosition.current = origin;

    persistRouteStateSync({ activeTrip: newTrip });

    // Use address text — far more accurate than raw coordinates
    const encodedAddress = encodeURIComponent(stop.address);
    try {
      if (navApp === 'google') {
        const url = origin
          ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${encodedAddress}&travelmode=driving&dir_action=navigate`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving&dir_action=navigate`;
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

- [ ] **Step 2: Verify build passes**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit 2>&1
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && git add components/SimpleRoutePlanner.tsx && git commit -m "feat: GO sets stop active, returns previous active to pending, nav uses address text"
```

---

## Task 5: Rewrite `manualCompleteStop` → `handleDone`

**Files:**
- Modify: `components/SimpleRoutePlanner.tsx:974-981`

- [ ] **Step 1: Replace `manualCompleteStop` with `handleDone`**

Find:
```typescript
  // Manual complete for when GPS isn't accurate
  const manualCompleteStop = async (stop: Stop) => {
    if (!activeTrip || activeTrip.destinationStopId !== stop.id) {
      alert('No active trip to this destination');
      return;
    }
    await logCompletedTrip();
  };
```
Replace with:
```typescript
  // Mark a stop as done — no redirect, no prompt, silently logs trip
  const handleDone = async (stop: Stop) => {
    // Set status to done immediately (UI updates instantly)
    setStops(prev => prev.map(s =>
      s.id === stop.id ? { ...s, status: 'done' } : s
    ));
    // Silently log the trip in background if there's an active trip to this stop
    if (activeTrip && activeTrip.destinationStopId === stop.id) {
      await logCompletedTrip(false);
    } else {
      // No active trip tracking — just clear any active state
      setActiveTrip(null);
    }
  };
```

- [ ] **Step 2: Update all `manualCompleteStop` call sites to `handleDone`**

Search for `manualCompleteStop` in the file — there will be two calls (desktop card and mobile card). Replace both:
```typescript
onClick={() => manualCompleteStop(stop)}
```
with:
```typescript
onClick={() => handleDone(stop)}
```

- [ ] **Step 3: Verify build passes**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit 2>&1
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && git add components/SimpleRoutePlanner.tsx && git commit -m "feat: replace manualCompleteStop with handleDone — no redirect, silent trip log"
```

---

## Task 6: Add sorted stop list (Active → Pending nearest-first → Done)

**Files:**
- Modify: `components/SimpleRoutePlanner.tsx` — add computed `sortedStops` after state declarations

- [ ] **Step 1: Add `sortedStops` computed value**

Find the line `const [isOptimizing, setIsOptimizing] = useState(false);` and add the following immediately after it:

```typescript
  // Sort stops: active first, then pending by nearest distance, then done
  const sortedStops = React.useMemo(() => {
    const active = stops.filter(s => s.status === 'active');
    const pending = stops
      .filter(s => s.status === 'pending')
      .sort((a, b) => {
        if (!currentLocation) return 0;
        return calculateDistance(currentLocation, a.location) - calculateDistance(currentLocation, b.location);
      });
    const done = stops.filter(s => s.status === 'done');
    return [...active, ...pending, ...done];
  }, [stops, currentLocation]);
```

Note: `calculateDistance` is defined later in the file. Move it above the state declarations, or use an inline haversine. The simplest fix: move the `calculateDistance` function to just before the state declarations by cutting it from line ~582 and pasting it before the first `useState` call.

- [ ] **Step 2: Move `calculateDistance` before the state declarations**

Cut `calculateDistance` from its current location (~line 582) and paste it immediately before the `const [searchValue` state declaration at line ~43. The function has no dependencies on state so it's safe to move.

```typescript
  const calculateDistance = (loc1: google.maps.LatLngLiteral, loc2: google.maps.LatLngLiteral): number => {
    const R = 6371;
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
```

- [ ] **Step 3: Verify build passes**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit 2>&1
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && git add components/SimpleRoutePlanner.tsx && git commit -m "feat: sorted stop list — active top, pending nearest-first, done bottom"
```

---

## Task 7: Redesign desktop stop cards

**Files:**
- Modify: `components/SimpleRoutePlanner.tsx` — desktop stops list (~line 1520-1660)

Replace the entire `{[...stops].reverse().map(...)` block in the **desktop** stops list with `sortedStops.map(...)` using the new card designs.

- [ ] **Step 1: Replace desktop stop card rendering**

Find the desktop stops list block that starts with:
```typescript
            <div className="space-y-2">
              {[...stops].reverse().map((stop, displayIndex) => {
                const originalIndex = stops.length - 1 - displayIndex;
                const isPickup = stop.type === 'pickup';
```

Replace the entire map block (from `{[...stops].reverse().map` through its closing `})}`) with:

```typescript
            <div className="space-y-2">
              {sortedStops.map((stop) => {
                const isPickup = stop.type === 'pickup';
                const isDelivery = stop.type === 'delivery';
                const isDepot = stop.type === 'depot';
                const typeLabel = isPickup ? 'Pickup' : isDelivery ? 'Delivery' : isDepot ? 'Depot' : null;

                // Distance label for pending stops
                const distanceLabel = stop.status === 'pending' && currentLocation
                  ? `${calculateDistance(currentLocation, stop.location).toFixed(1)}km`
                  : null;

                if (stop.status === 'done') {
                  return (
                    <div key={stop.id} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">✓ Done</span>
                        {typeLabel && <span className="text-xs text-gray-400">{typeLabel}</span>}
                      </div>
                      <p className="text-sm font-semibold text-gray-700">{stop.address}</p>
                    </div>
                  );
                }

                if (stop.status === 'active') {
                  return (
                    <div key={stop.id} className="bg-white border-2 border-green-400 rounded-lg p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                        <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Active</span>
                        {typeLabel && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">{typeLabel}</span>}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mb-1">{stop.address}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleDone(stop)}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-sm font-bold rounded-lg transition-all"
                        >
                          ✓ Done
                        </button>
                        <button
                          onClick={() => startNavigationToStop(stop, preferredNavApp)}
                          className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 active:scale-95 text-white text-sm font-bold rounded-lg transition-all"
                        >
                          Re-Nav
                        </button>
                      </div>
                    </div>
                  );
                }

                // Pending stop
                return (
                  <div key={stop.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-amber-600 uppercase tracking-wide bg-amber-50 border border-amber-200 rounded px-2 py-0.5">Pending</span>
                      <span className="text-xs text-gray-400">
                        {typeLabel && `${typeLabel}`}{distanceLabel && ` · ${distanceLabel}`}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-2">{stop.address}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startNavigationToStop(stop, preferredNavApp)}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-bold rounded-lg transition-all"
                      >
                        GO ▶
                      </button>
                      <button
                        onClick={() => removeStop(stop.id)}
                        className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
```

- [ ] **Step 2: Update desktop footer counts to use `stop.status`**

Find in the desktop footer:
```typescript
const uncompletedCount = stops.filter(s => !completedStops.has(s.id)).length;
```
Replace with:
```typescript
const uncompletedCount = stops.filter(s => s.status !== 'done').length;
```

Find:
```typescript
{uncompletedCount >= 3 && (
```
This stays the same.

Also find the optimize route button condition (there are two — desktop and mobile):
```typescript
{stops.filter(s => !completedStops.has(s.id)).length >= 3 && (
```
Replace with:
```typescript
{stops.filter(s => s.status !== 'done').length >= 3 && (
```

- [ ] **Step 3: Verify build passes**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit 2>&1
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && git add components/SimpleRoutePlanner.tsx && git commit -m "feat: redesign desktop stop cards — PENDING/ACTIVE/DONE states with new layout"
```

---

## Task 8: Redesign mobile stop cards

**Files:**
- Modify: `components/SimpleRoutePlanner.tsx` — mobile stops list (~line 1900-2010)

- [ ] **Step 1: Replace mobile stop card rendering**

Find the mobile stops list block that starts with:
```typescript
                  <div className="space-y-2">
                    {[...stops].reverse().map((stop, displayIndex) => {
                      const originalIndex = stops.length - 1 - displayIndex;
                      const isPickup = stop.type === 'pickup';
```

Replace the entire map block (from `{[...stops].reverse().map` through its closing `})}`) with:

```typescript
                  <div className="space-y-2">
                    {sortedStops.map((stop) => {
                      const isPickup = stop.type === 'pickup';
                      const isDelivery = stop.type === 'delivery';
                      const isDepot = stop.type === 'depot';
                      const typeLabel = isPickup ? 'Pickup' : isDelivery ? 'Delivery' : isDepot ? 'Depot' : null;
                      const distanceLabel = stop.status === 'pending' && currentLocation
                        ? `${calculateDistance(currentLocation, stop.location).toFixed(1)}km`
                        : null;

                      if (stop.status === 'done') {
                        return (
                          <div key={stop.id} className="bg-white border border-gray-200 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">✓ Done</span>
                              {typeLabel && <span className="text-xs text-gray-400">{typeLabel}</span>}
                            </div>
                            <p className="text-sm font-medium text-gray-700">{stop.address}</p>
                          </div>
                        );
                      }

                      if (stop.status === 'active') {
                        return (
                          <div key={stop.id} className="bg-white border-2 border-green-400 rounded-xl shadow-md p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                              <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Active</span>
                              {typeLabel && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">{typeLabel}</span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-gray-900 mb-3">{stop.address}</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDone(stop)}
                                className="flex-1 py-3 bg-green-600 text-white text-sm font-bold rounded-xl active:scale-[0.98]"
                              >
                                ✓ Done
                              </button>
                              <button
                                onClick={() => startNavigationToStop(stop, preferredNavApp)}
                                className="flex-1 py-3 bg-gray-600 text-white text-sm font-bold rounded-xl active:scale-[0.98]"
                              >
                                Re-Nav
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Pending stop
                      return (
                        <div key={stop.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 uppercase tracking-wide">Pending</span>
                            <span className="text-xs text-gray-400">
                              {typeLabel && `${typeLabel}`}{distanceLabel && ` · ${distanceLabel}`}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mb-3">{stop.address}</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startNavigationToStop(stop, preferredNavApp)}
                              className="flex-1 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl active:scale-[0.98]"
                            >
                              GO ▶
                            </button>
                            <button
                              onClick={() => removeStop(stop.id)}
                              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 active:scale-95 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
```

- [ ] **Step 2: Update mobile footer uncompleted count**

Find in the mobile footer section:
```typescript
{stops.filter(s => !completedStops.has(s.id)).length >= 3 && (
```
Replace with:
```typescript
{stops.filter(s => s.status !== 'done').length >= 3 && (
```

- [ ] **Step 3: Verify build passes**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npx tsc --noEmit 2>&1
```
Expected: zero errors.

- [ ] **Step 4: Run dev server and smoke test manually**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && npm run dev
```

Open http://localhost:5173 and verify:
- Adding a stop shows it as PENDING with GO button
- Tapping GO opens nav app, stop shows as ACTIVE with Done + Re-Nav
- Tapping GO on a second stop silently returns first to PENDING
- Tapping Done marks stop as Done, moves to bottom, no redirect
- Done card shows plainly with no buttons, no greying

- [ ] **Step 5: Commit**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && git add components/SimpleRoutePlanner.tsx && git commit -m "feat: redesign mobile stop cards — PENDING/ACTIVE/DONE states with new layout"
```

---

## Task 9: Push to GitLab and deploy

- [ ] **Step 1: Merge development to main and push to GitLab**

```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github" && git checkout main && git merge development && git push gitlab main 2>&1
```

- [ ] **Step 2: Confirm Vercel deployment**

Watch Vercel dashboard — a new deployment should trigger within 30 seconds of the push. Wait for it to go green before signing off.

---

## Self-Review Against Spec

| Spec requirement | Task |
|-----------------|------|
| Three states: PENDING → ACTIVE → DONE | Tasks 1, 2 |
| Active top, pending nearest-first, done bottom | Task 6 |
| GO silently returns current active to pending | Task 4 |
| Done: marks complete, moves to bottom, no redirect | Task 5 |
| Address full width, suburb visible, buttons below | Tasks 7, 8 |
| Done card: no buttons, no greying | Tasks 7, 8 |
| Nav uses address text not coordinates | Task 4 |
| 3-tap rule: every action ≤ 3 taps | Enforced in card design |
| Migration from old localStorage format | Task 2 step 4 |
