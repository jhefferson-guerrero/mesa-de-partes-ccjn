// /js/rol.js
// Si la persona es funcionario, agrega "BANDEJA" al menú lateral de las pantallas internas.
// Se pregunta al servidor una sola vez por sesión del navegador (la respuesta se recuerda en la pestaña).
// Esto solo decide qué mostrar: la seguridad está en las funciones del servidor.
import { auth, app } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const CLAVE = "rolFuncionario:";

// js/menu-bandeja.js (script normal, justo después del menú) ya agregó "BANDEJA" al instante si el rol estaba
// recordado; aquí solo se completa el caso en que todavía no se sabía (primera pantalla de la sesión).
const agregarMenuBandeja = () => window.agregarMenuBandeja && window.agregarMenuBandeja();

onAuthStateChanged(auth, async (user) => {
  if (!user || !user.emailVerified) return;

  let guardado = null;
  try {
    guardado = sessionStorage.getItem(CLAVE + user.uid);
  } catch { /* sin almacenamiento */ }

  if (guardado === "1") return agregarMenuBandeja();
  if (guardado === "0") {
    document.querySelector("[data-bandeja]")?.remove(); // por si se mostró con el rol de otra cuenta
    return;
  }

  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js");
    const { data } = await httpsCallable(getFunctions(app, "us-central1"), "miRol")();
    try { sessionStorage.setItem(CLAVE + user.uid, data && data.funcionario ? "1" : "0"); } catch { /* se ignora */ }
    if (data && data.funcionario) agregarMenuBandeja();
  } catch (err) {
    console.warn("No se pudo consultar el rol:", err);
  }
});
