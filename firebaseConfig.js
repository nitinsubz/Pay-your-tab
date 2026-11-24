// // firebaseConfig.js
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDszdCHcp5xJLk_FZhveJRzt9UyidKtwBc",
  authDomain: "pay-your-tab.firebaseapp.com",
  projectId: "pay-your-tab",
  storageBucket: "pay-your-tab.firebasestorage.app",
  messagingSenderId: "265622611424",
  appId: "1:265622611424:web:dee32966373ceeafd03785",
  measurementId: "G-YTJ58PYPK6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Local development only: `NEXT_PUBLIC_FIREBASE_EMULATOR=1 npm run dev` with
// `firebase emulators:start --only auth,firestore` talks to local emulators
// instead of the live project.
if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1" && !globalThis.__tabwrappedEmulatorsConnected) {
  globalThis.__tabwrappedEmulatorsConnected = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

// Add timestamp field
export const timestamp = new Date();