# Logbook Redesign

**Date:** 2026-04-14  
**Status:** Approved

---

## Problem

1. **Inflated daily totals** — `logCompletedTrip(true)` fires on every GO interruption, creating partial trip entries. Tapping GO on 3 stops before completing one produces 3 entries instead of 1.
2. **Broken fuel stop modal** — data entry fails unreliably; fuel logs are lost.
3. **No odometer tracking** — the app has no running odometer, making logbook reconciliation against the vehicle's actual odometer impossible.
4. **Logbook display** — currently shows incorrect totals due to partial entries; otherwise the structure is good and will be preserved.

---

## Design Decisions

### 1. Trip Session Model

A lightweight session is held in component state. **No Firestore write happens until the driver taps Done.**

**Session shape:**
```
activeSession: {
  fromAddress: string    // last completed stop address, or depot if first trip of day
  startTime: Date        // when GO was tapped on the current active stop
  gpsDistanceKm: number  // GPS accumulator — resets to 0 on each Done tap
} | null
```

**On GO tap:**
- If no session exists: open one with `fromAddress` = last completed stop's address (or depot address if no stops done yet), `startTime` = now, `gpsDistanceKm` = 0.
- If a session already exists (interruption/diversion): leave it open. The `fromAddress` and `startTime` stay as-is. GPS distance continues accumulating. No partial entry is written.

**On Done tap:**
- Write one `TripLog` entry to Firestore (see Section 2).
- Reset `gpsDistanceKm` to 0.
- Update `fromAddress` = completed stop's address.
- Session stays open ready for the next GO.

**On shift end / clear all:**
- Discard session without writing an entry (driver decided not to complete remaining stops).

### 2. Trip Log Entry Format

One entry per Done tap, written to Firestore `tripLogs` collection:

| Field | Type | Source |
|-------|------|--------|
| `date` | string (YYYY-MM-DD) | auto |
| `fromAddress` | string | session.fromAddress |
| `toAddress` | string | completed stop address |
| `startTime` | ISO timestamp | session.startTime |
| `endTime` | ISO timestamp | now() |
| `distanceKm` | number | session.gpsDistanceKm |
| `stopType` | 'pickup' \| 'delivery' | stop.type |
| `vehicle` | string | active vehicle from preferences |
| `userId` | string | auth user ID |

### 3. Odometer Tracking

**Per vehicle, stored in Firestore vehicle preferences:**
```
{
  lastOdometer: number       // odometer reading at last known point
  lastOdometerDate: string   // date of last known reading
}
```

**Running total:**  
`currentOdometer = lastOdometer + sum of all tripLog.distanceKm since lastOdometerDate`

This is calculated client-side from existing trip log data — no extra field to maintain.

**Recalibration at fuel stop:**  
The odometer field in the fuel stop modal pre-fills with the current running total. If the driver edits it to match the real odometer, the app saves that value as the new `lastOdometer` and `lastOdometerDate`. All future calculations run from this corrected baseline.

### 4. Fuel Stop Entry

Rebuilt from scratch as `FuelLogModal`. Saves to a `fuelLogs` Firestore collection.

**Fields:**
| Field | Source |
|-------|--------|
| Date | Auto (today) |
| Location | Auto from last GPS position; editable |
| Odometer | Pre-filled from running total; editable (triggers recalibration on save) |
| Litres | Manual entry |
| Total cost ($) | Manual entry |

**Fuel log entry shape:**
```
{
  date, location, odometerKm, litres, costDollars, userId, vehicle
}
```

**Future enhancement (out of scope):** photo receipt scanning.

### 5. Logbook Display

Structure is preserved — the existing layout works well. Data fixes make it accurate.

**Today's summary (top):**
- Trips completed (Done taps only — no partials)
- Total km driven
- Time on road (first GO of day → last Done of day)
- Average trip distance
- Running odometer

**Today's trips (below summary):**
- One row per completed leg: From → To, km, start–end time, stop type
- Listed in completion order

**Hamburger menu (unchanged):**
- Daily history
- Weekly summary
- Monthly summary
- All trips detailed
- Fuel logs (new entry in menu)

**Fuel logs view:**  
List of fuel stop entries: date, location, litres, cost, odometer at fill-up.

---

## What Changes

| File | Change |
|------|--------|
| `components/SimpleRoutePlanner.tsx` | Add `activeSession` state; update GO handler to open/maintain session; update `handleDone` to write one entry and reset session |
| `components/TripLogbook.tsx` | Fix daily total calculations (already correct once data is clean); add running odometer to summary; add fuel logs view |
| `components/FuelLogModal.tsx` | New component — replaces broken existing fuel stop UI |
| `lib/firestore.ts` | Add `saveFuelLog`, `subscribeToFuelLogs`; add odometer fields to vehicle preferences schema |

---

## Out of Scope

- Photo receipt scanning (future enhancement)
- Automatic arrival detection
- ATO export / PDF generation
- Multi-vehicle odometer switching mid-day
