// /js/login.js
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { mostrarMensaje } from "./ui-modal.js";

const FIRESTORE_URL = "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore-lite.js";

// Mientras la persona escribe sus datos, se descarga Firestore en segundo plano
// para que el perfil cargue rápido justo después de iniciar sesión.
const whenIdle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
whenIdle(() => {
  import("./firebase-db.js").catch(() => {});
});

// Trae el perfil antes de entrar para que la ficha ya muestre los nombres al abrir.
// Si tarda demasiado o falla, se entra igual (load-user.js lo carga después).
async function precargarPerfil(user) {
  try {
    const [{ db }, { doc, getDoc }] = await Promise.all([
      import("./firebase-db.js"),
      import(FIRESTORE_URL),
    ]);
    const snap = await Promise.race([
      getDoc(doc(db, "usuarios", user.uid)),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000)),
    ]);
    if (snap.exists()) {
      sessionStorage.setItem("userData", JSON.stringify(snap.data()));
      sessionStorage.setItem("userDataUid", user.uid);
    }
  } catch (err) {
    console.warn("No se pudo precargar el perfil:", err);
  }
}

async function loginUsuario(e) {
  e.preventDefault();

  const correo = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const boton = document.querySelector("#loginForm .btn-ingresar");

  if (!correo || !password) {
    mostrarMensaje("Por favor, ingresa correo y contraseña.", { tipo: "aviso", titulo: "Faltan datos" });
    return;
  }

  // Evita doble envío y da feedback mientras se valida
  const textoOriginal = boton ? boton.innerHTML : "";
  if (boton) {
    boton.disabled = true;
    boton.textContent = "Ingresando...";
  }

  try {
    // Quitar datos de una sesión anterior en esta pestaña
    sessionStorage.removeItem("userData");
    sessionStorage.removeItem("userDataUid");
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("tramites:"))
      .forEach((k) => sessionStorage.removeItem(k));

    // 1) Persistencia local
    await setPersistence(auth, browserLocalPersistence);

    // 2) Login
    const { user } = await signInWithEmailAndPassword(auth, correo, password);

    // 3) Solo usuarios con correo verificado
    if (!user.emailVerified) {
      mostrarMensaje("Debes verificar tu correo antes de iniciar sesión.", { tipo: "aviso", titulo: "Verifica tu correo" });
      return;
    }

    // 4) Perfil listo y adelante
    await precargarPerfil(user);
    window.location.href = "home.html";
  } catch (error) {
    console.error(error);
    // Firebase actual devuelve invalid-credential tanto para usuario inexistente como
    // para contraseña errónea (no revela si el correo existe); se mantienen los códigos antiguos.
    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/user-not-found" ||
      error.code === "auth/wrong-password"
    ) {
      mostrarMensaje("Correo o contraseña incorrectos.", { tipo: "error", titulo: "No se pudo iniciar sesión" });
    } else if (error.code === "auth/too-many-requests") {
      mostrarMensaje("Demasiados intentos. Espera unos minutos o restablece tu contraseña.", { tipo: "aviso", titulo: "Demasiados intentos" });
    } else {
      mostrarMensaje("Error al iniciar sesión: " + error.message, { tipo: "error" });
    }
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.innerHTML = textoOriginal;
    }
  }
}

document.getElementById("loginForm").addEventListener("submit", loginUsuario);
