
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "ai-interview-96055.firebaseapp.com",
  projectId: "ai-interview-96055",
  storageBucket: "ai-interview-96055.firebasestorage.app",
  messagingSenderId: "236759604248",
  appId: "1:236759604248:web:0fab0abf6fd8e70196376d"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider()

export {auth, provider}