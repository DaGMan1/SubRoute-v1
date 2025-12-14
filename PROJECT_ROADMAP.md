
# Project Roadmap

## Current Phase: Prototype & Sandbox
Currently, the application runs in a "Sandbox Mode".
- **Authentication**: User accounts are stored in your browser's `localStorage` (Local Storage). This means you can create an account, refresh the page, and close the browser, and your account will persist on *that specific device and browser*.
- **Data Persistence**: All data (vehicles, trips, expenses) is currently simulated locally.

## Future Phase: Production
To move this to a production environment, the following architecture changes will be needed:

1.  **Authentication**: Replace the `AuthSandbox.tsx` component with a real identity provider (IDP) integration.
    - Recommended: **Clerk**, **Auth0**, or **Firebase Auth**.
    - This ensures users can log in from any device and their account is secure.

2.  **Database**: Migrate data storage from `localStorage` to a cloud database.
    - Recommended: **PostgreSQL** (via Supabase or Neon) or **Firestore**.
    - This ensures data is backed up and accessible everywhere.

3.  **API**: Connect the frontend `apiClient` to real server endpoints instead of the sandbox mock logic.

## Immediate Next Steps
- [x] Fix session persistence to prevent "flicker" on reload.
- [ ] Complete the Vehicle Manager module.
- [ ] Implement the Trip Logbook logic.
