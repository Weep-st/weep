import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyARkndIQlKNCF6cPe1UX8sIaMd8ke5UTxY",
  authDomain: "wepi-f0b21.firebaseapp.com",
  projectId: "wepi-f0b21",
  storageBucket: "wepi-f0b21.firebasestorage.app",
  messagingSenderId: "626257239107",
  appId: "1:626257239107:web:209d96b5ee6f77c95708f6",
  measurementId: "G-FLGS9XD8BE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
