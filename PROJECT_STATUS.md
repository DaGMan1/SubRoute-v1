
# SubRoute - Project Status Report

**Date:** February 26, 2025
**Version:** 0.3.0 (Sandbox)

## 1. Executive Summary
The application is currently in a functional "Sandbox" prototype phase. 
- **Core Functionality:** User authentication, Vehicle Management, and a fully interactive Route Planner are implemented.
- **Architecture:** The app runs entirely client-side using React and stores data in the browser's `localStorage`. No backend server is currently required for testing.
- **Mapping:** We have successfully migrated from mock simulated maps to **Leaflet (OpenStreetMap)** and **OSRM** for real-world routing, replacing the broken mock simulation.

## 2. Implemented Features

### Authentication (`AuthSandbox.tsx`)
- [x] Login & Register UI.
- [x] "Persistent Session" using LocalStorage (prevents logout on refresh).
- [x] Mock OAuth buttons (visual only).

### Dashboard (`Dashboard.tsx`)
- [x] Navigation hub to different modules.
- [x] Responsive layout.

### Vehicle Manager (`VehicleManagerSandbox.tsx`)
- [x] CRUD operations (Create, Read, Update, Delete) for vehicles.
- [x] Set "Default" vehicle.
- [x] **Password Protection:** Critical edits require the user to re-enter their password.
- [x] Odometer tracking.

### Route Planner (`RoutePlannerSandbox.tsx`)
- [x] **Map Engine:** Leaflet JS with OpenStreetMap tiles.
- [x] **Routing Engine:** OSRM (Open Source Routing Machine) calculates real road paths, distances, and times.
- [x] **Geocoding:** Nominatim API (OpenStreetMap) allows real address searching (e.g., "Carol Park").
- [x] **Optimization:** Basic simulated reordering of stops.
- [x] **Navigation Mode:** Turn-by-turn style view with "Complete Stop" functionality.
- [x] **Mobile Support:** Toggle between List and Map views.

## 3. Known Issues & Limitations
1.  **Optimization Algorithm:** The "Optimize" button currently uses a simple latitude sort. It does not use a true TSP (Traveling Salesman Problem) algorithm yet.
2.  **API Rate Limits:** The free OpenStreetMap/OSRM APIs have rate limits. Heavy usage may result in temporary timeouts.
3.  **Data Sync:** Since data is stored in `localStorage`, it does not sync between your phone and your laptop.

## 4. Next Steps (Development Queue)
1.  **Trip Logbook:** Build the logic to automatically record a trip into a logbook when "Complete" is clicked in Navigation mode.
2.  **Expense Tracker:** Create the module for logging fuel and maintenance costs.
3.  **True Optimization:** Integrate a more robust client-side routing algorithm (e.g., nearest neighbor) for the Optimize button.

## 5. Technical Stack
- **Frontend:** React 19, Tailwind CSS.
- **Maps:** Leaflet, Leaflet Routing Machine.
- **Data:** LocalStorage (Browser).
