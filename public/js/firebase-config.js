// firebase-config.js
// Solo App y Auth: es lo mínimo que necesitan todas las páginas.
// Firestore (firebase-db.js) y Storage (home.js) se cargan únicamente donde se usan,
// para que el login y las pantallas simples no descarguen módulos que no necesitan.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtrVl9iQELGDmKv2KdY-1JQV8CHlyTiZo",
  authDomain: "mesa-de-partes-5c6c2.firebaseapp.com",
  projectId: "mesa-de-partes-5c6c2",
  storageBucket: "mesa-de-partes-5c6c2.firebasestorage.app",
  messagingSenderId: "295329835192",
  appId: "1:295329835192:web:f576ece8dc6e3409a22c4d"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
