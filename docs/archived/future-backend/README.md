# Archived: Future Backend Stubs

**Date Archived**: 2025-12-29

---

## What's Here

This directory contains placeholder files for a potential Express.js backend that was initially planned but never implemented.

**Directories**:
- `server/` - Express.js server stubs (all empty files)
- `api/` - API route handlers (minimal implementation, not used)
- `constants/` - Empty constant files

---

## Current Status: NOT USED

The SubRoute application currently uses **Firebase** exclusively for all backend operations:

- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **Storage**: Firestore collections
- **Hosting**: Cloud Run (frontend only)

---

## Why Archived

1. **Dead Code**: These files were never imported or used by any component
2. **Firebase is Sufficient**: Firebase provides all needed backend functionality
3. **Maintenance Burden**: Empty files clutter the codebase and confuse developers
4. **No Clear Plan**: No roadmap item requires a custom Express backend

---

## If You Need a Custom Backend in the Future

### Consider These Questions First

1. **Why not Cloud Functions?**
   - Firebase Cloud Functions can handle serverless backend logic
   - Easier to maintain than a separate Express server
   - Scales automatically

2. **Why not extend Firestore?**
   - Firestore Security Rules can handle most access control
   - Firestore Triggers can handle complex data flows
   - No server needed

3. **What does Express give you that Firebase doesn't?**
   - Custom business logic requiring Node.js libraries?
   - Third-party API integrations requiring server-side secrets?
   - Complex data transformations not suitable for Cloud Functions?

### If You Still Need Express

**Don't use these stubs**. Start fresh:

1. Use current Express best practices (2025+)
2. Use TypeScript with proper types
3. Set up proper project structure:
   ```
   backend/
   ├── src/
   │   ├── routes/
   │   ├── controllers/
   │   ├── middleware/
   │   ├── models/
   │   └── utils/
   ├── tests/
   ├── package.json
   ├── tsconfig.json
   └── Dockerfile
   ```
4. Use modern tools: Express 5+, TypeScript 5+, Prisma/TypeORM
5. Deploy to Cloud Run (containerized)

---

## What Was in Each Directory

### `/server` (10 files, all 0 bytes)
- `schema.sql` - Database schema (never defined)
- `index.ts` - Express server entry point (empty)
- `db.ts` - Database connection (empty)
- `mock-data.ts` - Test data (empty)
- `utils/middleware.ts` - Auth/logging middleware (empty)
- `routes/` - API route handlers (all empty):
  - `auth.ts`
  - `trips.ts`
  - `vehicles.ts`
  - `expenses.ts`
  - `favoritePlaces.ts`

### `/api` (5 files, 161 total lines)
- `auth/oauth.ts` (40 lines) - OAuth provider stubs (not connected)
- `auth/login.ts` (34 lines) - Login endpoint (not used)
- `auth/register.ts` (46 lines) - Register endpoint (not used)
- `auth/[...route].ts` (30 lines) - Catch-all route (not used)
- `auth/db.ts` (11 lines) - Mock database (not used)

**Note**: These files had some implementation but were never imported by any component. All auth is handled by `/components/Auth.tsx` which uses Firebase directly.

### `/constants` (2 files, both 0 bytes)
- `markdownContent.ts` - Supposed to hold static markdown (empty)
- `mockData.ts` - Supposed to hold test data (empty)

---

## Restoration Instructions

If you need to restore these files:

```bash
cd /Users/garrymans/Documents/App Dev/SubRoute-github
git log --all --oneline --follow -- docs/archived/future-backend/

# Find commit before archival
git checkout <commit-hash> -- server/ api/ constants/

# Or just copy back
cp -r docs/archived/future-backend/server ./
cp -r docs/archived/future-backend/api ./
cp -r docs/archived/future-backend/constants ./
```

---

**Bottom Line**: You probably don't need these files. Use Firebase or Cloud Functions instead.
