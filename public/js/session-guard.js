// /js/session-guard.js
import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// Evita parpadeo mientras comprobamos sesión
document.documentElement.setAttribute("data-auth", "checking");

// Detecta la página actual
const currentPage = window.location.pathname.split("/").pop();

// 1) Controla acceso según sesión
onAuthStateChanged(auth, (user) => {
  if (user && user.emailVerified) {
    // Si estamos en index.html y hay sesión activa -> redirige al home
    if (currentPage === "index.html" || currentPage === "") {
      window.location.replace("home.html");
    } else {
      // Permite ver la página
      document.documentElement.setAttribute("data-auth", "ok");
    }
  } else {
    // Usuario no logueado o no verificado
    if (currentPage !== "index.html") {
      // Redirige al login
      window.location.replace("index.html");
    } else {
      // Permite ver el index.html
      document.documentElement.setAttribute("data-auth", "ok");
    }
  }
});

// 2) Lógica del modal de logout
const btnLogout = document.getElementById("logout");
const modal = document.getElementById("logoutModal");
const btnAccept = document.getElementById("logoutAccept");
const btnCancel = document.getElementById("logoutCancel");

btnLogout?.addEventListener("click", () => {
  modal.style.display = "flex";
});

btnCancel?.addEventListener("click", () => {
  modal.style.display = "none";
});

btnAccept?.addEventListener("click", async () => {
  try {
    // No dejar datos personales del usuario en la pestaña al cerrar sesión
    sessionStorage.removeItem("userData");
    sessionStorage.removeItem("userDataUid");
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("tramites:"))
      .forEach((k) => sessionStorage.removeItem(k));
    await signOut(auth);
  } finally {
    window.location.replace("index.html");
  }
});

// Cerrar modal haciendo click fuera
window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});