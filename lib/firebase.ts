import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAkTPhW5UOilg5YFsXEj0rY-e3cLTTN1xI",
  authDomain: "subroute-eda91.firebaseapp.com",
  projectId: "subroute-eda91",
  storageBucket: "subroute-eda91.firebasestorage.app",
  messagingSenderId: "894893534696",
  appId: "1:894893534696:web:1701dfb220a69731dd085d",
  measurementId: "G-D89SY486DW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
