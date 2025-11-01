// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtrVl9iQELGDmKv2KdY-1JQV8CHlyTiZo",
  authDomain: "mesa-de-partes-5c6c2.firebaseapp.com",
  projectId: "mesa-de-partes-5c6c2",
  storageBucket: "mesa-de-partes-5c6c2.firebasestorage.app",
  messagingSenderId: "295329835192",
  appId: "1:295329835192:web:f576ece8dc6e3409a22c4d",
  measurementId: "G-YDH9Y48YD2"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
export const storage = getStorage(app);

export { auth, db };