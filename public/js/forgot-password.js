// /js/forgot-password.js
import { auth } from "./firebase-config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const form = document.getElementById("forgotForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("forgotEmail").value.trim();

  if (!email) {
    alert("Por favor ingresa tu correo electrónico.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    // Mensaje neutro: no se revela si el correo está registrado o no
    alert("Si el correo está registrado, recibirás un enlace de recuperación.");
    form.reset();
  } catch (error) {
    console.error(error);
    if (error.code === "auth/user-not-found") {
      alert("Si el correo está registrado, recibirás un enlace de recuperación.");
      form.reset();
    } else if (error.code === "auth/too-many-requests") {
      alert("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
    } else {
      alert("Error: " + error.message);
    }
  }
});