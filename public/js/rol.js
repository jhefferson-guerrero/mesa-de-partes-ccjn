// /js/rol.js
// Decide si se muestra "BANDEJA" en el menú lateral de las pantallas internas: el botón ya está en el HTML y
// el CSS lo muestra solo cuando <html> tiene la clase "es-funcionario".
// menu-toggle.js pone esa clase antes de pintar si el rol ya estaba recordado; aquí se pregunta al servidor
// una sola vez por sesión del navegador (la respuesta se recuerda en la pestaña).
// Esto solo decide qué mostrar: la seguridad está en las funciones del servidor.
import { auth, app } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const CLAVE = "rolFuncionario:";
const marcar = (esFuncionario) => document.documentElement.classList.toggle("es-funcionario", esFuncionario);

onAuthStateChanged(auth, async (user) => {
  if (!user || !user.emailVerified) return;

  let guardado = null;
  try {
    guardado = sessionStorage.getItem(CLAVE + user.uid);
  } catch { /* sin almacenamiento */ }

  if (guardado === "1" || guardado === "0") return marcar(guardado === "1");

  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js");
    const { data } = await httpsCallable(getFunctions(app, "us-central1"), "miRol")();
    const esFuncionario = Boolean(data && data.funcionario);
    try { sessionStorage.setItem(CLAVE + user.uid, esFuncionario ? "1" : "0"); } catch { /* se ignora */ }
    marcar(esFuncionario);
  } catch (err) {
    console.warn("No se pudo consultar el rol:", err);
  }
});
