// firebase-db.js
// Firestore en un módulo aparte: solo lo importan las páginas que leen o guardan datos.
import { app } from "./firebase-config.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore-lite.js";

export const db = getFirestore(app);
