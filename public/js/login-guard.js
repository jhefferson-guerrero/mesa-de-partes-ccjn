// /js/login-guard.js
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

document.documentElement.setAttribute("data-auth", "checking");

onAuthStateChanged(auth, (user) => {
  if (user && user.emailVerified) {
    // Usuario ya logueado: redirige a home
    window.location.replace("home.html");
  } else {
    // Usuario no logueado: permite ver index
    document.documentElement.setAttribute("data-auth", "ok");
  }
});