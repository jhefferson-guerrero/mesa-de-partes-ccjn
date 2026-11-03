// /js/forgot-password.js
import { auth } from "./firebase-config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { mostrarMensaje } from "./ui-modal.js";

const form = document.getElementById("forgotForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("forgotEmail").value.trim();

  if (!email) {
    mostrarMensaje("Por favor ingresa tu correo electrónico.", { tipo: "aviso", titulo: "Falta el correo" });
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    // Mensaje neutro: no se revela si el correo está registrado o no
    mostrarMensaje("Si el correo está registrado, recibirás un enlace de recuperación.", { tipo: "exito", titulo: "Revisa tu correo" });
    form.reset();
  } catch (error) {
    console.error(error);
    if (error.code === "auth/user-not-found") {
      mostrarMensaje("Si el correo está registrado, recibirás un enlace de recuperación.", { tipo: "exito", titulo: "Revisa tu correo" });
      form.reset();
    } else if (error.code === "auth/too-many-requests") {
      mostrarMensaje("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.", { tipo: "aviso", titulo: "Demasiados intentos" });
    } else {
      mostrarMensaje("Error: " + error.message, { tipo: "error" });
    }
  }
});