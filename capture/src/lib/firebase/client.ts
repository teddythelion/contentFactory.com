import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBJWWfvZmo4cPubPOVuZXbnV2oE_j9SXKA",
  authDomain: "project-app-479008.firebaseapp.com",
  projectId: "project-app-479008",
  storageBucket: "project-app-479008.firebasestorage.app",
  messagingSenderId: "1019907238808",
  appId: "1:1019907238808:web:790e83b57f71ee0515d9ed",
  measurementId: "G-EN9FNY239C"
};

// Initialize Firebase (client-side only)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== 'undefined') {
  // Only initialize on client side
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };