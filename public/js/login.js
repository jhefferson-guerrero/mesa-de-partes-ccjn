// /js/login.js
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

async function loginUsuario(e) {
  e.preventDefault();

  const correo = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!correo || !password) {
    alert("Por favor, ingresa correo y contraseña.");
    return;
  }

  try {
    // 1) Persistencia local
    await setPersistence(auth, browserLocalPersistence);

    // 2) Login
    const { user } = await signInWithEmailAndPassword(auth, correo, password);

    // 3) Solo usuarios con correo verificado
    if (!user.emailVerified) {
      alert("Debes verificar tu correo antes de iniciar sesión.");
      return;
    }

    // 4) Adelante
    window.location.href = "home.html";
  } catch (error) {
    console.error(error);
    if (error.code === "auth/user-not-found") {
      alert("Usuario no registrado.");
    } else if (error.code === "auth/wrong-password") {
      alert("Contraseña incorrecta.");
    } else {
      alert("Error al iniciar sesión: " + error.message);
    }
  }
}

document.getElementById("loginForm").addEventListener("submit", loginUsuario);
