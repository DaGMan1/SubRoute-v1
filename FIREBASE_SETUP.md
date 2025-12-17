# Firebase Setup Guide for SubRoute

Your SubRoute app is now ready to use Firebase for authentication and database storage. Follow these steps to complete the setup.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name: `SubRoute` (or your preferred name)
4. Choose whether to enable Google Analytics (recommended for production)
5. Click "Create project"

## Step 2: Register Your Web App

1. In your Firebase project, click the **Web** icon (</>) to add a web app
2. Register app nickname: `SubRoute Web`
3. Check "Also set up Firebase Hosting" if you want to use Firebase Hosting
4. Click "Register app"
5. **Important**: Copy the Firebase configuration object shown on screen

The configuration looks like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

## Step 3: Update Firebase Configuration

1. Open `lib/firebase.ts` in your code editor
2. Replace the placeholder values with your actual Firebase configuration:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_ACTUAL_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_ACTUAL_PROJECT_ID",
  storageBucket: "YOUR_ACTUAL_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_ACTUAL_MESSAGING_SENDER_ID",
  appId: "YOUR_ACTUAL_APP_ID"
};
```

## Step 4: Enable Firebase Authentication

1. In Firebase Console, go to **Build** → **Authentication**
2. Click "Get started"
3. Enable **Email/Password** authentication:
   - Click "Email/Password"
   - Toggle "Enable"
   - Click "Save"
4. Enable **Google** sign-in (recommended):
   - Click "Google"
   - Toggle "Enable"
   - Select a support email
   - Click "Save"

## Step 5: Create Firestore Database

1. In Firebase Console, go to **Build** → **Firestore Database**
2. Click "Create database"
3. Choose **Start in production mode** (we'll add security rules next)
4. Select a location closest to your users (e.g., "australia-southeast1" for Australia)
5. Click "Enable"

## Step 6: Set Up Firestore Security Rules

1. In Firestore Database, go to the **Rules** tab
2. Replace the default rules with these security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User documents - users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // User's trips subcollection
      match /trips/{tripId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // User's vehicles subcollection
      match /vehicles/{vehicleId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // User's preferences subcollection
      match /preferences/{prefsId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

3. Click "Publish"

These rules ensure that:
- Users can only access their own data
- All data requires authentication
- No one can access other users' data

## Step 7: Build and Deploy

1. Build your app with the new Firebase configuration:
   ```bash
   npm run build
   ```

2. Deploy to Vercel or your preferred platform

## Step 8: Test Your Setup

1. Open your deployed app
2. Try registering a new account with email/password
3. Try signing in with Google
4. Add a vehicle - it should save to Firestore
5. Complete a route - the trip log should save to Firestore
6. Check Firebase Console → Firestore Database to see your data

## Firebase Database Structure

Your app uses this Firestore structure:

```
users/{userId}
  ├── email: string
  ├── name: string
  ├── abn: string (optional)
  ├── createdAt: timestamp
  ├── trips/{tripId}
  │   ├── id: string
  │   ├── timestamp: timestamp
  │   ├── date: string
  │   ├── startTime: string
  │   ├── endTime: string
  │   ├── origin: string
  │   ├── destination: string
  │   ├── distanceKm: number
  │   ├── vehicleString: string
  │   └── durationMinutes: number
  ├── vehicles/{vehicleId}
  │   ├── id: string
  │   ├── make: string
  │   ├── model: string
  │   ├── year: string
  │   ├── plate: string
  │   ├── startOdometer: number
  │   └── isDefault: boolean
  └── preferences/main
      ├── depotAddress: string (JSON)
      └── currentOdometer: number
```

## Cost Estimation

Firebase has a **generous free tier**:

- **Authentication**: 50,000 MAU (Monthly Active Users) free
- **Firestore**:
  - 1 GB storage free
  - 50,000 reads/day free
  - 20,000 writes/day free
  - 20,000 deletes/day free

**Typical usage for a single courier driver:**
- ~200 reads/day (loading trips, vehicles, preferences)
- ~50 writes/day (saving trips, updating vehicles)
- **Cost: $0/month** (well within free tier)

**For a small courier team (5-10 drivers):**
- ~2,000 reads/day
- ~500 writes/day
- **Cost: $0-$5/month**

You can monitor usage in Firebase Console → **Usage and billing** → **Details & Settings**

## What Changed

Firebase integration replaced all `localStorage` usage with cloud database:

1. **Authentication**: Real user accounts instead of fake localStorage auth
2. **Trip Logs**: Synced across devices via Firestore
3. **Vehicles**: Synced across devices via Firestore
4. **Depot Address**: Synced across devices via Firestore
5. **User Preferences**: Synced across devices via Firestore

## Benefits

- ✅ **Cross-device sync**: Access your data from phone, tablet, desktop
- ✅ **Real user accounts**: Secure authentication with email/password or Google
- ✅ **Data persistence**: Never lose data when clearing browser cache
- ✅ **Team collaboration**: Multiple drivers can have separate accounts
- ✅ **Real-time updates**: Changes sync instantly across devices
- ✅ **Scalable**: Can handle thousands of users without code changes

## Troubleshooting

### Error: "Firebase: Error (auth/unauthorized-domain)"

**Solution**: Add your domain to authorized domains:
1. Firebase Console → Authentication → Settings
2. Scroll to "Authorized domains"
3. Click "Add domain"
4. Enter your Vercel domain (e.g., `your-app.vercel.app`)

### Error: "Missing or insufficient permissions"

**Solution**: Check Firestore security rules are published correctly

### Users can't sign in

**Solution**: Verify Email/Password and Google auth are enabled in Firebase Console

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Firebase config in `lib/firebase.ts`
3. Check Firebase Console for authentication and Firestore status
4. Ensure security rules are published

---

**Your app is now cloud-enabled!** 🎉

All trip logs, vehicles, and settings will now sync across all your devices.
