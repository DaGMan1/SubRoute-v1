export const markdownContent = `
# SubRoute: Architectural Review & Actionable Project Plan

This document provides a refined architectural plan and an actionable roadmap for the **SubRoute** application. Based on the initial high-level design, this plan incorporates expert recommendations, simplifies complexities, and integrates modern AI capabilities using Google's Gemini models. It is structured to serve as a single source of truth for creating development tasks and guiding the project forward.

## Executive Summary & Vision

SubRoute aims to be the indispensable digital toolkit for subcontractor courier drivers in Australia. It will streamline operations, ensure ATO compliance, and maximize efficiency through intelligent routing and automated logbook management.

The original vision is strong. We will enhance it by integrating **Gemini AI** to provide proactive, intelligent features that move beyond simple record-keeping into a true digital assistant for drivers.

## Architectural Refinements

After reviewing the initial architecture, the following refinements are proposed to enhance robustness, simplify the data model, and future-proof the technology stack.

### Technology Stack Recommendations
The proposed stack (React Native, Node.js, PostgreSQL) is solid. However, we should consider the following:

- **Mapping Provider**: While Mapbox is excellent, **Google Maps Platform** should be strongly considered. Its comprehensive data, Street View, and strong integration with the Google ecosystem are significant advantages. We will also leverage its data through **Gemini with Google Maps grounding** for location-based intelligence. The MVP will proceed with one, but an abstraction layer should be built to potentially support both.
- **Database Schema**: To reduce complexity, the \`logbook_entries\` table can be merged into the \`trips\` table. A single \`trips\` table with a flexible \`JSONB\` column for logbook-specific details (\`logbook_details\`) will simplify queries and reduce joins.

#### Proposed Simplified \`trips\` Schema
\`\`\`sql
-- trips table (combining trip and logbook data)
CREATE TABLE trips (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    vehicle_id UUID REFERENCES vehicles(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    start_location GEOGRAPHY(POINT),
    end_location GEOGRAPHY(POINT),
    start_odometer INTEGER NOT NULL,
    end_odometer INTEGER,
    distance_km NUMERIC(10, 2),
    purpose TEXT CHECK (purpose IN ('business', 'personal')),
    route_data JSONB, -- Stored route from mapping provider
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- ATO-specific fields can live in a JSONB column
    logbook_details JSONB -- e.g., { "destination": "Client HQ", "client_name": "ACME Corp", "tax_deductible": true }
);
\`\`\`

### Gemini AI Integration
We will integrate Gemini to provide a competitive edge:

1.  **Smart Receipt Scanning**: Use Gemini's multimodal capabilities to extract vendor, amount, and date from receipt photos for expense tracking.
2.  **Natural Language Logbook Queries**: Allow drivers to ask questions like, *"How many business kilometers did I drive in the last financial quarter?"*
3.  **Predictive Routing**: Analyze historical trip data to suggest optimal routes based on time of day and typical traffic patterns.
4.  **Automated Trip Classification**: Suggest if a trip is 'business' or 'personal' based on destination and time.

## Grounding with Gemini & Google Maps

As requested, we will use **Gemini with Google Maps grounding** to ensure the information provided to drivers is accurate, up-to-date, and contextually relevant for Australian conditions.

> **Our Strategy:** For features requiring real-world, dynamic data, we will construct prompts for the Gemini 1.5 Flash model and enable the Google Maps tool. This allows the model to access and reason over Google Maps data for its responses.

**Use Cases:**
- **Toll Cost Estimation**: "What is the approximate toll cost for a standard car driving from Sydney Airport to Parramatta via the M5 and M4 motorways during peak hour?"
- **Finding Amenities**: "Find highly-rated rest stops with truck parking and 24/7 facilities along the Hume Highway between Sydney and Melbourne."
- **Compliance & Regulations**: "What are the latest ATO guidelines for calculating car expense deductions for a sole trader in Australia?" (This uses Google Search grounding, often paired with Maps for location context).

## Actionable Roadmap: Epics & User Stories

**Status Key:** ✅ Complete | 👉 Next Up | 🕹️ Prototype Complete

### Epic 1: Foundation & MVP (Months 1-3)

**Goal:** Launch a functional app that allows drivers to securely register, and manually record ATO-compliant trips.

- ✅ **Story 1.1: User Authentication**
  - **As a driver, I want to create an account, log in securely, and manage my profile so I can start using the app.**
  - *Acceptance Criteria:* Email/password registration, secure login, basic profile page (Name, ABN).
- ✅ **Story 1.2: Vehicle Management**
  - **As a driver, I want to add and manage my vehicles so I can assign trips to the correct one.**
  - *Acceptance Criteria:* Add/edit/delete vehicle details (Make, Model, Rego). Mark one as primary.
- ✅ **Story 1.3: Manual Trip Recording**
  - **As a driver, I want to manually start and stop a trip, recording key ATO-required details.**
  - *Acceptance Criteria:* "Start Trip" button records start time and odometer. "End Trip" prompts for end odometer, trip purpose (business/personal), and notes. Distance is calculated.
- ✅ **Story 1.4: Trip Logbook View**
  - **As a driver, I want to view a list of all my past trips so I can review my logbook.**
  - *Acceptance Criteria:* A chronological list of completed trips is displayed. Each entry shows date, distance, and purpose.
- **Story 1.5: Basic Offline Support**
  - **As a driver, I want the app to save my trips locally if I'm offline and sync them later.**
  - *Acceptance Criteria:* Trips can be created and saved without an internet connection. A visual indicator shows sync status.

### Epic 2: Core Features (Months 4-6)

**Goal:** Introduce routing, expense tracking, and basic reporting to make the app a daily-use tool.

- 🕹️ **Story 2.1: Route Planning & Navigation**
  - **As a driver, I want to plan a route between multiple stops and see it on a map.**
  - *Acceptance Criteria:* Integration with a mapping provider (Google Maps/Mapbox). User can input a start, end, and optional waypoints. The optimal route is displayed.
- ✅ **Story 2.2: Expense Tracking**
  - **As a driver, I want to log expenses like fuel and tolls and attach a receipt photo.**
  - *Acceptance Criteria:* User can add an expense, select a category, enter an amount, and attach a photo from the camera or gallery.
- 👉 **Story 2.3: Simple Logbook Export**
  - **As a driver, I want to export my logbook for a specific date range as a CSV file.**
  - *Acceptance Criteria:* A feature to select dates and generate a CSV file of trips, sent to the user's email.
- 🕹️ **Story 2.4: Multi-stop Route Optimization**
  - **As a driver with multiple deliveries, I want the app to calculate the most efficient order for my stops.**
  - *Acceptance Criteria:* User can input multiple waypoints and the app will reorder them for the shortest/fastest route.

### Epic 3: Advanced Features (Months 7-9)

**Goal:** Add intelligent and automated features that significantly reduce manual work.

- **Story 3.1: ATO-Compliant PDF Reporting**
  - **As a driver, I want to generate an ATO-compliant PDF logbook summary for tax purposes.**
  - *Acceptance Criteria:* Generate a formatted PDF including all required fields, business use percentage, and summary totals.
- **Story 3.2: Automated Trip Detection (Optional Start)**
  - **As a driver, I want the app to automatically detect when I start and finish a drive, and prompt me to log it.**
  - *Acceptance Criteria:* Using device sensors (GPS/accelerometer), the app suggests potential trips for the user to confirm and classify. This needs careful battery management.
- ✅ **Story 3.3: Gemini-Powered Receipt Scanning**
  - **As a driver, when I upload a receipt, I want the app to automatically fill in the vendor, date, and amount.**
  - *Acceptance Criteria:* On receipt photo upload, call Gemini vision model. The extracted data populates the expense form for user confirmation.
- 🕹️ **Story 3.4: Toll Road Preferences**
  - **As a driver, I want my route planning to consider my preference to use or avoid toll roads.**
  - *Acceptance Criteria:* A user setting to "Avoid Tolls". Route calculation respects this setting and shows toll costs if available.

### Epic 4: Optimization & Growth (Months 10-12)

**Goal:** Refine the user experience, improve performance, and add value-add services.

- **Story 4.1: Performance & Offline Optimization**
  - **As a developer, I want to optimize app start time, sync speed, and offline map performance.**
  - *Acceptance Criteria:* App cold start under 2s. Offline map tiles for major metro areas are pre-cached. Sync is efficient.
- 🕹️ **Story 4.2: Gemini Natural Language Query**
  - **As a driver, I want to ask my logbook questions in plain English.**
  - *Acceptance Criteria:* A search/chat interface where a user can type "Show my fuel expenses for May" and get a filtered list.
- **Story 4.3: Push Notifications & Reminders**
  - **As a driver, I want to be reminded to complete my logbook at the end of the day.**
  - *Acceptance Criteria:* A daily configurable notification to remind users to log any unrecorded trips.
- **Story 4.4: Web Dashboard (Admin/Analytics)**
  - **As a power user, I want a web dashboard to view my analytics and manage my data on a larger screen.**
  - *Acceptance Criteria:* A secure web portal for viewing trip history, running reports, and visualizing driving patterns.

### Additional Completed Features
- ✅ **Favorite Places Management**: A new feature allowing users to save and manage frequently visited locations was implemented to enhance route planning usability.

## Confirmed Technology Stack

| Layer                | Technology                                | Justification                                                 |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| **Mobile Frontend**  | React Native                              | Single codebase, native feel, large ecosystem.                |
| **Backend API**      | Node.js + Express/Fastify                 | JavaScript consistency, excellent performance for I/O.        |
| **Database**         | PostgreSQL with PostGIS                   | ACID compliant, robust geospatial support, flexible JSONB.    |
| **State Management** | Redux Toolkit / Zustand                   | Predictable state, scalable. Zustand for simplicity.          |
| **AI/ML**            | Google Gemini API                         | Multimodality, function calling, grounding for accurate data. |
| **Mapping**          | Google Maps Platform / Mapbox             | High-quality maps, routing, geocoding.                        |
| **File Storage**     | Google Cloud Storage / AWS S3             | Scalable, reliable, CDN integration for fast access.          |
| **Authentication**   | JWT (JSON Web Tokens)                     | Stateless, scalable, industry standard for APIs.              |

## Risk Assessment & Mitigation

| Risk                                     | Impact | Mitigation Strategy                                                                                             |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| **API Costs (Maps & AI)**                | High   | Implement aggressive caching, usage monitoring, and API request optimization. Set firm budgets and alerts.      |
| **Battery Drain from GPS Tracking**      | Medium | Optimize location tracking frequency. Make automatic tracking an opt-in feature with clear warnings.            |
| **Offline Sync Conflicts**               | Medium | Implement a "last-write-wins" strategy. Log conflicts for review and notify users of significant data overwrites. |
| **Changes to ATO Requirements**          | High   | Decouple the compliance logic into a specific module. Schedule regular reviews of ATO guidelines.             |
| **Accuracy of Gemini AI Features**       | Medium | Always require user confirmation for AI-extracted data (e.g., receipt scans). Fine-tune prompts for accuracy. |
`;