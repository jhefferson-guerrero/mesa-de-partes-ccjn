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
    alert("Se envió un enlace de recuperación a tu correo.");
    form.reset();
  } catch (error) {
    console.error(error);
    if (error.code === "auth/user-not-found") {
      alert("No existe un usuario registrado con ese correo.");
    } else {
      alert("Error: " + error.message);
    }
  }
});