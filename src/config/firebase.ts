// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB1UY11uxSjgWCxAdD11ewukeBqpWTRqXU",
  authDomain: "senai-wuzuy.firebaseapp.com",
  projectId: "senai-wuzuy",
  storageBucket: "senai-wuzuy.firebasestorage.app",
  messagingSenderId: "124079474870",
  appId: "1:124079474870:web:cb31e719db890e12fa7e17",
  measurementId: "G-MYKWHCM1PH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);