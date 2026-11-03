// /js/register-session.js
// Inicia sesión con la cuenta temporal (correo ya verificado) para poder
// consultar el DNI y completar el registro con las reglas de seguridad activas.
// La sesión es solo de pestaña: si se cierra sin terminar, no queda abierta.
import { auth } from "./firebase-config.js";
import {
  setPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

export const sessionReady = (async () => {
  const correo = localStorage.getItem("correoVerificado");
  const passwordTemp = localStorage.getItem("passwordTemp");
  if (!correo || !passwordTemp) throw new Error("no-verified-email");

  await setPersistence(auth, browserSessionPersistence);
  const { user } = await signInWithEmailAndPassword(auth, correo, passwordTemp);
  if (!user.emailVerified) throw new Error("email-not-verified");
  return user;
})();

// Evita el aviso de "unhandled rejection"; quien la use maneja el error con await.
sessionReady.catch(() => {});
