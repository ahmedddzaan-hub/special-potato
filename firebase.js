import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";

import {
  getAnalytics,
  isSupported
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-analytics.js";

import {
  getAuth,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBmW_Fb2vL22YkmehXYrHGoQykJ4YoWhdw",
  authDomain: "toolbox-64694.firebaseapp.com",
  projectId: "toolbox-64694",
  storageBucket: "toolbox-64694.firebasestorage.app",
  messagingSenderId: "555579703652",
  appId: "1:555579703652:web:936e7e3ebb9d9eb2843a71",
  measurementId: "G-EWBFRV284Y"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export const analyticsReady = isSupported()
  .then(supported => {
    if (supported) {
      return getAnalytics(app);
    }
    return null;
  })
  .catch(() => null);
