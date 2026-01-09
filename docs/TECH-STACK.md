# SubRoute Technology Stack Reference

**Last Updated**: 2026-01-09

---

## Complete Technology Stack

### Frontend

| Technology | Version | Purpose | Documentation |
|------------|---------|---------|---------------|
| **React** | 19.2.3 | UI framework | https://react.dev |
| **React DOM** | 19.2.3 | React renderer for web | https://react.dev |
| **TypeScript** | 5.5.3 | Type-safe JavaScript | https://www.typescriptlang.org |
| **Vite** | 7.3.0 | Build tool & dev server | https://vitejs.dev |
| **Tailwind CSS** | (via CDN) | Utility-first CSS framework | https://tailwindcss.com |

### Backend & Database

| Technology | Version | Purpose | Documentation |
|------------|---------|---------|---------------|
| **Firebase** | 12.7.0 | Backend platform | https://firebase.google.com |
| **Firestore** | (via Firebase) | NoSQL cloud database | https://firebase.google.com/docs/firestore |
| **Firebase Auth** | (via Firebase) | User authentication | https://firebase.google.com/docs/auth |

### Maps & Navigation

| Technology | Version | Purpose | Documentation |
|------------|---------|---------|---------------|
| **Google Maps JavaScript API** | 3.58+ | Map display | https://developers.google.com/maps/documentation/javascript |
| **Google Directions API** | v3 | Route calculation | https://developers.google.com/maps/documentation/directions |
| **Google Places API** | v3 | Address autocomplete | https://developers.google.com/maps/documentation/places |
| **Google Geocoding API** | v3 | Address → coordinates | https://developers.google.com/maps/documentation/geocoding |
| **Geolocation API** | Browser native | GPS tracking | https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API |
| **Wake Lock API** | Browser native | Keep screen on | https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API |

### External Navigation

| Technology | Purpose | Integration |
|------------|---------|-------------|
| **Google Maps App** | Turn-by-turn navigation | Deep link: `https://www.google.com/maps/dir/` |
| **Waze** | Alternative navigation | Deep link: `https://waze.com/ul` |

### Deployment & Hosting

| Technology | Purpose | Configuration |
|------------|---------|---------------|
| **Vercel** | Hosting & CD/CI | Auto-deploys from GitHub main branch |
| **GitHub** | Version control | Repository: https://github.com/DaGMan1/SubRoute-v1 |
| **SSH Deploy Key** | Authentication | Dedicated key for this repo only |

### Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| **npm** | System default | Package manager |
| **@vitejs/plugin-react** | 4.3.1 | React integration for Vite |
| **@types/google.maps** | 3.58.1 | TypeScript definitions for Google Maps |
| **@types/react** | 18.3.3 | TypeScript definitions for React |
| **@types/react-dom** | 18.3.0 | TypeScript definitions for React DOM |

---

## Platform Services

### Google Cloud Platform
- **Service**: Google Maps Platform
- **APIs Enabled**:
  - Maps JavaScript API
  - Directions API
  - Places API
  - Geocoding API
- **Authentication**: API Key (restricted by domain)

### Firebase Project
- **Project Name**: SubRoute
- **Services Used**:
  - Firestore Database (NoSQL)
  - Authentication (Email/Password)
- **Region**: Australia (asia-southeast1 or similar)

### Vercel
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Auto-Deploy**: Enabled on main branch
- **Environment Variables**: None (Firebase config in code)

---

## Architecture Patterns

### Frontend Architecture
- **Pattern**: Single Page Application (SPA)
- **State Management**: React hooks (useState, useEffect, useRef)
- **Routing**: React state-based view switching (no router library)
- **Components**: Functional components with hooks
- **Styling**: Utility-first with Tailwind CSS

### Data Flow
```
User Action
    ↓
React Component
    ↓
Firebase Client SDK
    ↓
Firestore Database (Cloud)
    ↓
Real-time Subscription
    ↓
React State Update
    ↓
UI Re-render
```

### Trip Logging Flow
```
User taps navigation
    ↓
GPS tracking starts (Geolocation API + Wake Lock API)
    ↓
Navigation app opens (Google Maps / Waze deep link)
    ↓
User drives to destination
    ↓
Page visibility change detected when returning
    ↓
GPS resumes tracking
    ↓
Arrival detected (50m geofence via Haversine formula)
    ↓
Trip data saved to Firestore
    ↓
Real-time subscription updates Trip Log UI
```

---

## Browser APIs Used

### Core Web APIs
- **Geolocation API**: Track user location via GPS
- **Local Storage API**: Persist route state across page reloads
- **Fetch API**: HTTP requests (not heavily used, Firebase handles most)
- **Page Visibility API**: Detect when user returns from navigation app
- **Wake Lock API**: Prevent screen sleep during trip tracking

### Browser Compatibility
- **Minimum Requirements**:
  - Chrome 90+ (Android)
  - Safari 15+ (iOS)
  - Modern ES2020+ JavaScript support
  - IndexedDB support (for Firebase)

---

## File Structure

```
SubRoute-github/
├── App.tsx                          # Main app component
├── components/
│   ├── SimpleRoutePlanner.tsx       # Route planning & trip tracking
│   ├── TripLogbook.tsx              # Trip log display
│   ├── VehicleManager.tsx           # Vehicle CRUD
│   ├── OdometerTracker.tsx          # Odometer & fuel tracking
│   └── Settings.tsx                 # User settings
├── lib/
│   ├── firebase.ts                  # Firebase initialization
│   ├── firestore.ts                 # Firestore helper functions
│   ├── utils.ts                     # Shared utility functions
│   └── config.ts                    # App configuration constants
├── hooks/
│   └── useLocalStorage.ts           # Custom localStorage hook
├── types.ts                         # TypeScript interfaces
├── main.tsx                         # React app entry point
├── index.html                       # HTML entry point
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Vite build config
├── vercel.json                      # Vercel deployment config
└── docs/
    ├── PROCESS-FLOW.md              # Development workflow
    ├── TECH-STACK.md                # This file
    └── SSH-SETUP.md                 # SSH authentication guide
```

---

## Dependencies Detail

### Production Dependencies (`package.json`)
```json
{
  "firebase": "^12.7.0",     // Backend platform (Firestore + Auth)
  "react": "^19.2.3",        // UI framework
  "react-dom": "^19.2.3"     // React web renderer
}
```

### Development Dependencies
```json
{
  "@types/google.maps": "^3.58.1",   // Google Maps TypeScript types
  "@types/react": "^18.3.3",         // React TypeScript types
  "@types/react-dom": "^18.3.0",     // React DOM TypeScript types
  "@vitejs/plugin-react": "^4.3.1",  // Vite React plugin
  "typescript": "^5.5.3",            // TypeScript compiler
  "vite": "^7.3.0"                   // Build tool
}
```

**Note**: Tailwind CSS is loaded via CDN in `index.html`, not installed via npm.

---

## Environment Variables

**None required!**

Firebase configuration is included directly in code (public API keys are safe for client-side apps - they're domain-restricted on Google Cloud Console).

---

## Build Configuration

### Vite Config (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

### TypeScript Config (`tsconfig.json`)
- **Target**: ES2020
- **Module**: ESNext
- **JSX**: react-jsx
- **Strict Mode**: Enabled
- **Exclude**: node_modules, docs/archived

### Vercel Config (`vercel.json`)
```json
{
  "name": "subroute-app",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite"
}
```

---

## API Keys & Credentials

### Google Maps API Key
- **Location**: Hardcoded in component (not ideal, but functional)
- **Restrictions**: HTTP referrer restrictions on Google Cloud Console
- **APIs**: Maps JavaScript, Directions, Places, Geocoding

### Firebase Config
- **Location**: `lib/firebase.ts`
- **Public Keys**: Safe to commit (domain-restricted in Firebase console)
- **Authentication**: Email/Password provider enabled

### GitHub SSH Key
- **Location**: `~/.ssh/subroute_deploy_key`
- **Type**: ED25519
- **Purpose**: Push access to GitHub repository
- **Configuration**: See `docs/SSH-SETUP.md`

---

## Performance Considerations

### Build Output
- **Typical bundle size**: ~200-600 KB (gzipped)
- **Main dependencies**: React + Firebase dominate bundle size
- **Code splitting**: Not currently implemented (single bundle)

### Runtime Performance
- **GPS polling**: Every 5 seconds when trip active
- **Firestore queries**: Real-time subscriptions (efficient)
- **Map rendering**: Google Maps handles optimization
- **State management**: React hooks (minimal overhead)

### Mobile Optimization
- **Touch targets**: Minimum 44px (iOS guidelines)
- **GPS accuracy**: High accuracy mode enabled
- **Background behavior**: Wake Lock + Page Visibility API
- **Responsive design**: Mobile-first Tailwind classes

---

## Security Model

### Frontend Security
- ✅ Firebase Security Rules enforce data access
- ✅ API keys are domain-restricted
- ✅ No secrets in frontend code
- ✅ HTTPS enforced by Vercel

### Backend Security (Firebase)
- ✅ User authentication required for all operations
- ✅ Firestore rules validate user ownership
- ✅ No admin SDK in client code
- ✅ API rate limiting via Firebase

---

## External Integrations

### Current Integrations
1. **Google Maps Platform** (mapping, routing, geocoding)
2. **Firebase** (database, authentication)
3. **Vercel** (hosting, deployment)
4. **GitHub** (version control)

### Future Integrations (Planned)
- Notion API (task tracking, bug reports)
- Twilio (SMS notifications)
- Stripe (payments - if needed)

---

## Development URLs

### Local Development
- **Dev Server**: http://localhost:5173
- **Preview Build**: http://localhost:4173 (after `npm run preview`)

### Production
- **Production URL**: [Check Vercel dashboard]
- **GitHub Repository**: https://github.com/DaGMan1/SubRoute-v1
- **Vercel Dashboard**: https://vercel.com/dashboard

### Documentation
- **Google Maps**: https://developers.google.com/maps/documentation
- **Firebase**: https://firebase.google.com/docs
- **React**: https://react.dev
- **Vite**: https://vitejs.dev
- **TypeScript**: https://www.typescriptlang.org/docs

---

## Quick Start Commands

```bash
# Navigate to project
cd "/Users/garrymans/Documents/App Dev/SubRoute-github"

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to production (via GitHub)
git add .
git commit -m "fix: description"
git push origin main
```

---

## Support & Resources

### Official Documentation
- React 19: https://react.dev
- Firebase: https://firebase.google.com/docs
- Google Maps: https://developers.google.com/maps/documentation
- Vite: https://vitejs.dev
- Vercel: https://vercel.com/docs

### Project Documentation
- Development workflow: `docs/PROCESS-FLOW.md`
- SSH setup: `docs/SSH-SETUP.md`
- Tech stack: `docs/TECH-STACK.md` (this file)

---

**Last Updated**: 2026-01-09
**Project Version**: 0.1.0
**Status**: Active Development
