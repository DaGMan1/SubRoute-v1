# SubRoute Process Flow Documentation

**Purpose**: Master reference document for understanding application flow, data architecture, and development processes

**Last Updated**: 2025-12-29

---

## 1. APPLICATION ARCHITECTURE OVERVIEW

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (brand colors: blue #0052CC, gray palette)
- **Maps**: Google Maps JavaScript API, Directions API, Places API
- **Backend**: Firebase (Firestore + Authentication)
- **Deployment**: Google Cloud Run (Docker + Nginx)

### Core Design Principles
1. **Mobile-First**: Designed for courier drivers using phones while driving
2. **Point-to-Point Tracking**: Each trip leg is logged individually
3. **GPS-Based Automation**: Auto-log trips when driver arrives at destination
4. **ATO Compliance**: Trip logs formatted for Australian Tax Office requirements

---

## 2. USER JOURNEY & WORKFLOW

### Morning Routine (Start of Day)
```
1. Open SubRoute app
2. Check odometer reading → Update in Settings
3. Navigate to Route Planner
4. Add all pickup/delivery stops for the day
5. Depot becomes origin for first trip
```

### During Deliveries (Active Mode)
```
For each stop:
1. Tap Google Maps or Waze button for next stop
   → App starts GPS tracking
   → Navigation app opens with destination

2. Drive to destination
   → App monitors GPS location in background
   → Tracks actual distance traveled

3. Arrive at destination (within 50m radius)
   → App auto-detects arrival via geofencing
   → Trip log created automatically
   → Stop marked complete with green checkmark
   → "EN ROUTE" badge disappears

4. (Optional) If GPS inaccurate:
   → Tap "Done" button to manually complete

5. Move to next stop
   → Previous destination becomes new origin
   → Repeat process
```

### Fuel Stops (Anytime During Route)
```
1. Tap "Log Fuel Stop" button (appears when trip active)
2. Enter current odometer reading
3. Optionally add: liters, cost, location
4. Save → Returns to route navigation
5. Fuel stop linked to current trip ID
```

### End of Day
```
1. Navigate to Trip Log tab
2. Review all logged trips
3. Check today's total km
4. (Optional) Export to CSV for ATO records
```

---

## 3. DATA FLOW ARCHITECTURE

### Point-to-Point Trip Logging System

**Key Concept**: Each trip leg between any two points is logged as a separate TripLog entry.

#### Trip Lifecycle
```
[START] User taps Google/Waze for Stop A
   ↓
[TRACKING BEGINS]
   • activeTrip object created with:
     - origin: Last destination OR current location
     - originLocation: {lat, lng}
     - destination: Stop A address
     - destinationLocation: {lat, lng}
     - startTime: Date.now()
     - distanceTraveled: 0 km
   • GPS monitoring starts (navigator.geolocation.watchPosition)
   • lastGpsPosition stored as reference point
   ↓
[DURING TRIP]
   • GPS updates every ~5 seconds
   • Calculate distance from lastGpsPosition to currentPosition
   • Add to activeTrip.distanceTraveled
   • Update lastGpsPosition
   • Check if within 50m of destination
   ↓
[ARRIVAL DETECTED] (within 50m geofence)
   ↓
[AUTO-LOGGING]
   • Calculate endTime, duration
   • Fetch default vehicle info
   • Create TripLog object:
     {
       id: timestamp string
       timestamp: endTime
       date: 'YYYY-MM-DD'
       startTime: 'HH:MM' (24-hour format)
       endTime: 'HH:MM'
       origin: activeTrip.origin
       destination: activeTrip.destination
       distanceKm: activeTrip.distanceTraveled (rounded to 1 decimal)
       vehicleString: 'Make Model (PLATE)'
       durationMinutes: Math.round((endTime - startTime) / 60000)
     }
   • Save to Firestore: users/{userId}/trips/{tripId}
   • Mark stop as completed
   • Clear activeTrip state
   • Stop GPS monitoring
   ↓
[NEXT TRIP]
   • User taps navigation for Stop B
   • Stop A becomes new origin
   • Cycle repeats
```

#### GPS Distance Calculation (Haversine Formula)
```javascript
function calculateDistance(pos1: {lat, lng}, pos2: {lat, lng}): number {
  const R = 6371; // Earth radius in km
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLon = (pos2.lng - pos1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}
```

---

## 4. COMPONENT DATA FLOW

### SimpleRoutePlanner.tsx (Main Route Component)

#### State Variables
```typescript
// Route Management
stops: Stop[]                    // List of pickup/delivery stops
optimizedRoute: Stop[]           // Reordered stops (if optimized)
currentLocation: {lat, lng}      // User's GPS position
depotAddress: Address            // Starting location

// Trip Tracking
activeTrip: {                    // Current trip in progress
  origin: string
  originLocation: {lat, lng}
  destination: string
  destinationLocation: {lat, lng}
  startTime: number
  distanceTraveled: number
} | null

completedStops: Set<string>     // Addresses of completed stops
gpsWatchId: useRef<number>       // GPS watch ID for cleanup
lastGpsPosition: useRef<{lat, lng}>  // Previous GPS position

// UI State
showFuelModal: boolean           // Fuel stop form visibility
```

#### Key Functions

**startNavigationToStop(stop, navApp)**
```typescript
Purpose: Begin trip tracking for a specific stop
Flow:
1. Determine origin (previous destination or current location)
2. Create activeTrip object
3. Initialize GPS monitoring
4. Open Google Maps or Waze with destination
```

**GPS Monitoring (useEffect)**
```typescript
Trigger: activeTrip changes (becomes non-null)
Flow:
1. Start navigator.geolocation.watchPosition
2. On each GPS update:
   a. Calculate distance from lastGpsPosition
   b. Add to distanceTraveled
   c. Update lastGpsPosition
   d. Check if within 50m of destination
   e. If yes → call logCompletedTrip()
3. On unmount: Clear GPS watch
```

**logCompletedTrip()**
```typescript
Purpose: Save trip log when arrival detected
Flow:
1. Calculate endTime and duration
2. Fetch default vehicle from Firestore
3. Create TripLog object
4. Save to Firestore: users/{userId}/trips/{tripId}
5. Add destination to completedStops set
6. Clear activeTrip state
7. Clear GPS references
```

**manualCompleteStop(stop)**
```typescript
Purpose: Manual override when GPS inaccurate
Flow:
1. Verify activeTrip matches stop
2. Call logCompletedTrip()
```

---

## 5. FIREBASE DATA STRUCTURE

### Firestore Collections

```
/users/{userId}
  ├── /vehicles/{vehicleId}
  │     ├── make: string
  │     ├── model: string
  │     ├── year: string
  │     ├── plate: string
  │     ├── isDefault: boolean
  │     ├── startOdometer: number
  │     └── currentOdometer: number (auto-updated from trips)
  │
  ├── /trips/{tripId}
  │     ├── timestamp: number
  │     ├── date: string (YYYY-MM-DD)
  │     ├── startTime: string (HH:MM)
  │     ├── endTime: string (HH:MM)
  │     ├── origin: string
  │     ├── destination: string
  │     ├── distanceKm: number
  │     ├── vehicleString: string
  │     └── durationMinutes: number
  │
  ├── /fuelStops/{fuelStopId}
  │     ├── timestamp: number
  │     ├── odometerReading: number
  │     ├── liters?: number
  │     ├── costAUD?: number
  │     ├── location?: string
  │     └── tripId?: string (links to active trip)
  │
  └── /serviceReminders/{reminderId}
        ├── vehicleId: string
        ├── type: 'service' | 'rego' | 'insurance' | 'custom'
        ├── description: string
        ├── dueOdometer?: number
        ├── dueDate?: string
        └── isCompleted: boolean
```

### Firebase Operations

**Save Trip Log**
```typescript
import { collection, addDoc } from 'firebase/firestore';

const tripRef = collection(db, 'users', userId, 'trips');
await addDoc(tripRef, tripLog);
```

**Get Default Vehicle**
```typescript
import { collection, query, where, getDocs } from 'firebase/firestore';

const vehiclesRef = collection(db, 'users', userId, 'vehicles');
const q = query(vehiclesRef, where('isDefault', '==', true));
const snapshot = await getDocs(q);
const defaultVehicle = snapshot.docs[0]?.data();
```

**Update Vehicle Odometer**
```typescript
import { doc, updateDoc } from 'firebase/firestore';

const vehicleRef = doc(db, 'users', userId, 'vehicles', vehicleId);
await updateDoc(vehicleRef, { currentOdometer: newReading });
```

---

## 6. NAVIGATION DEEP LINKS

### Google Maps Navigation
```typescript
// Basic format
const url = `https://www.google.com/maps/dir/?api=1` +
  `&origin=${originLat},${originLng}` +
  `&destination=${destLat},${destLng}` +
  `&travelmode=driving` +
  `&dir_action=navigate`;

// With toll avoidance
const url = url + `&avoid=tolls`;
```

### Waze Navigation
```typescript
// Basic format
const url = `https://waze.com/ul?` +
  `ll=${destLat}%2C${destLng}` +
  `&navigate=yes` +
  `&zoom=17`;

// Note: Waze doesn't support origin parameter
```

---

## 7. UI/UX DESIGN PATTERNS

### Mobile-First Principles

**Button Sizing**: Minimum 44x44px touch targets
**Spacing**: Extra padding for fat finger taps
**Color States**:
- Default: Gray
- Active/Selected: Blue (#0052CC)
- Complete: Green with checkmark
- Disabled: Light gray

### Component States

#### Stop Card States
```typescript
1. Pending (not started)
   - White background
   - Full color icons
   - Google/Waze/Done buttons visible

2. En Route (actively navigating to this stop)
   - Pulsing blue "EN ROUTE" badge
   - Google/Waze buttons still visible
   - "Done" button enabled

3. Completed
   - Gray background (bg-gray-100)
   - Green checkmark icon
   - Text opacity reduced (opacity-60)
   - Navigation buttons hidden
   - Cannot be re-started
```

#### Navigation Button Logic
```typescript
// Show Google/Waze buttons if:
- Stop is not completed AND
- No active trip OR active trip destination ≠ this stop

// Show Done button if:
- Active trip exists AND
- Active trip destination = this stop
```

---

## 8. ERROR HANDLING & EDGE CASES

### GPS Tracking Edge Cases

**1. User Closes App During Trip**
```
Problem: GPS monitoring stops when app closed
Solution:
- Use background geolocation (future enhancement)
- OR: Manual "Done" button as fallback
- Current: Trip stays "active" until user returns and completes
```

**2. GPS Signal Lost**
```
Problem: No position updates for extended period
Solution:
- Manual "Done" button always available
- User can complete trip manually
- Distance tracked up to last known position
```

**3. User Overshoots Destination**
```
Problem: Drives past without triggering 50m geofence
Solution:
- Geofence checks on every GPS update
- If distance starts increasing after being < 100m, still triggers
- Manual "Done" button as backup
```

**4. Multiple Stops at Same Location**
```
Problem: Multiple stops with same coordinates
Solution:
- Each stop has unique ID
- Use stop ID + address for completion tracking
- Completed stops Set uses stop.address as key
```

### Firebase Edge Cases

**1. Offline Mode**
```
Problem: No internet connection
Solution:
- Firebase has offline persistence by default
- Trips queue locally and sync when online
- User sees trips immediately (optimistic UI)
```

**2. Firestore Write Failure**
```
Problem: Trip log save fails
Solution:
try {
  await saveTripLog(userId, tripLog);
  console.log('Trip logged successfully');
  markStopCompleted();
} catch (error) {
  console.error('Failed to save trip log', error);
  alert('Failed to save trip. Please try again.');
  // Keep activeTrip state - user can retry
}
```

**3. No Default Vehicle**
```
Problem: User hasn't set a default vehicle
Solution:
- Check for defaultVehicle before creating trip
- If null, show alert: "Please set a default vehicle in Settings"
- Trip not logged until vehicle selected
```

---

## 9. DEVELOPMENT WORKFLOW

### Git Branching Strategy

**Main Branches**:
- `main` - Production code (deployed to Cloud Run)
- `development` - Integration branch (deployed to staging)

**Feature Branches**:
- `feature/trip-logging` - GPS-based trip logging
- `feature/fuel-tracking` - Fuel stop integration
- `feature/ui-mobile` - Mobile UI improvements

**Hotfix Branches**:
- `hotfix/bug-name` - Critical production fixes

### Commit Message Format
```
Type: Short description

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>

Detailed explanation:
- What changed
- Why it changed
- Related issue IDs
```

**Types**: fix, feat, refactor, docs, test, style, chore

### Deployment Process

**1. Development → Staging**
```bash
git checkout development
git merge feature/branch-name
git push origin development
# Auto-deploys to staging (if configured)
```

**2. Staging → Production**
```bash
git checkout main
git merge development
git push origin main
# Triggers Cloud Build → Cloud Run deployment
```

**3. Manual Deploy (if needed)**
```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github"
npm run build
gcloud run deploy subroute-app \
  --source . \
  --region australia-southeast1 \
  --allow-unauthenticated
```

---

## 10. NOTION INTEGRATION WORKFLOW

### Bug Tracking Process

**While Driving** (10 seconds at red light):
```
1. Open Notion mobile app
2. Add new entry to "Bugs" database:
   - Title: "Waze button opens wrong address"
   - Severity: High
3. Done - back to driving
```

**Back at Office** (afternoon):
```
1. Ask Claude: "Read all bugs from Notion"
   → Claude fetches via MCP server
   → Generates BUGS.md file

2. Ask Claude: "Fix all critical bugs"
   → Claude analyzes each bug
   → Makes code fixes
   → Updates Notion with fix notes + commit hash
   → Changes status to "Fixed (Pending Deploy)"

3. Review and deploy:
   → npm run build
   → git add . && git commit -m "fix: [bug descriptions]"
   → git push origin main

4. Ask Claude: "Mark bugs as deployed"
   → Claude updates Notion status to "Resolved"
```

### Roadmap Sync Process
```bash
# Sync roadmap from Notion to ROADMAP.md
./scripts/sync-roadmap.sh

# Or with Claude Code:
"Read roadmap from Notion and update ROADMAP.md"
```

---

## 11. TESTING STRATEGY

### Manual Testing Checklist (Before Deploy)

**Trip Logging System**:
- [ ] Add 3 stops to route planner
- [ ] Tap Google Maps for first stop
- [ ] Verify "EN ROUTE" badge appears
- [ ] Wait 10 seconds (simulate driving)
- [ ] Tap "Done" button
- [ ] Check trip appears in Trip Log with correct:
  - [ ] Origin (depot or previous destination)
  - [ ] Destination (stop address)
  - [ ] Start time
  - [ ] End time
  - [ ] Distance (> 0 km)
  - [ ] Duration (> 0 min)
- [ ] Verify stop shows green checkmark
- [ ] Repeat for remaining stops

**Fuel Stop System**:
- [ ] Start a trip
- [ ] Tap "Log Fuel Stop" button
- [ ] Enter odometer reading
- [ ] Add liters and cost
- [ ] Save fuel stop
- [ ] Verify fuel stop appears in Odometer tab
- [ ] Check tripId is populated

**Vehicle Management**:
- [ ] Add new vehicle
- [ ] Set as default
- [ ] Verify appears in trip logs
- [ ] Edit vehicle details
- [ ] Password prompt appears
- [ ] Delete vehicle
- [ ] Confirm deletion

**Mobile Responsiveness**:
- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test landscape orientation
- [ ] Test with keyboard open
- [ ] Test touch targets (all buttons tappable)

---

## 12. MOBILE UI ISSUES (CURRENT KNOWN PROBLEMS)

### Dashboard Issues
```
❌ "Not working on mobile phone" (user reported)

Suspected issues:
1. Button tap targets too small
2. Navigation not triggering view changes
3. Layout breaking on small screens
4. Header/footer overlapping content
5. Scrolling issues
```

**Investigation needed**:
- Test on actual iPhone/Android device
- Check touch event handlers
- Review responsive breakpoints
- Inspect z-index layering
- Test with Chrome DevTools mobile emulator

---

## 13. QUICK REFERENCE

### File Locations
```
Main App:           /App.tsx
Route Planner:      /components/SimpleRoutePlanner.tsx
Trip Log:           /components/TripLogbook.tsx
Vehicle Manager:    /components/VehicleManager.tsx
Odometer Tracker:   /components/OdometerTracker.tsx
Settings:           /components/Settings.tsx
Types:              /types.ts
Firebase Config:    /lib/firebase.ts
Firestore Utils:    /lib/firestore.ts
```

### Key Commands
```bash
# Development
npm run dev              # Start dev server (port 5173)
npm run build            # Build for production
npm run preview          # Preview production build

# Git
git status               # Check current state
git add .                # Stage all changes
git commit -m "message"  # Commit with message
git push origin main     # Push to production

# Firebase
firebase deploy          # Deploy to Firebase Hosting
firebase login           # Authenticate Firebase CLI

# Cloud Run
gcloud run deploy        # Deploy to Cloud Run
gcloud run services list # List deployed services
```

### Important URLs
```
Production:  https://subroute-app-[hash].run.app
Staging:     [to be configured]
Notion DB:   https://www.notion.so/2c94ca3fb25f81568875fb80290c01a7
GitHub:      [repository URL]
```

---

## 14. FUTURE ENHANCEMENTS (ROADMAP)

### Phase 1: Core Stability (Current)
- [x] Point-to-point trip logging
- [x] GPS-based arrival detection
- [x] Fuel stop tracking
- [ ] Mobile UI fixes (NEXT)
- [ ] Background GPS tracking
- [ ] Offline mode improvements

### Phase 2: Advanced Features
- [ ] Multi-day route planning
- [ ] Route optimization algorithms
- [ ] Real-time traffic integration
- [ ] Push notifications for service reminders
- [ ] Photo capture for proof of delivery

### Phase 3: Business Intelligence
- [ ] Weekly/monthly reports
- [ ] Fuel economy analytics
- [ ] Route efficiency scoring
- [ ] Tax deduction calculations
- [ ] Integration with accounting software

---

**END OF PROCESS FLOW DOCUMENTATION**

This document should be updated whenever:
- New features are added
- Data structure changes
- Workflows are modified
- Bugs are discovered and fixed
- Deployment processes change
