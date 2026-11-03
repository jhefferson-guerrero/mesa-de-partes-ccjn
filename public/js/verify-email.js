import { auth } from "./firebase-config.js";
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// Referencias DOM
const form = document.getElementById("verifyEmailForm");
const correoInput = document.getElementById("correo");
const modal = document.getElementById("modal");
const btnModal = document.getElementById("btnVerificarEstado");
const mensajeCorreo = document.getElementById("mensajeCorreo");

// Modal oculto al cargar
modal.style.display = "none";

// Contraseña temporal aleatoria (criptográficamente segura)
function generarPasswordTemporal() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "Aa1!";
}

function mostrarModal(mensaje, textoBoton, onClick) {
    mensajeCorreo.textContent = mensaje;
    btnModal.textContent = textoBoton;
    btnModal.onclick = onClick;
    modal.style.display = "flex";
}

function cerrarModal() {
    modal.style.display = "none";
}

function cerrarYLimpiarCorreo() {
    cerrarModal();
    correoInput.value = "";
    correoInput.focus();
}

// Comprueba si el correo ya está verificado y pasa al registro completo
function verificarEstado(correo) {
    return async () => {
        try {
            const passwordTemp = localStorage.getItem("passwordTemp") || "";
            const { user } = await signInWithEmailAndPassword(auth, correo, passwordTemp);
            await user.reload();
            const verificado = user.emailVerified;
            await signOut(auth);

            if (verificado) {
                localStorage.setItem("correoVerificado", correo);
                window.location.href = "register-complete.html";
            } else {
                mensajeCorreo.textContent = "Correo aún no verificado. Revisa tu bandeja y confirma tu correo.";
            }
        } catch (err) {
            console.error(err);
            mensajeCorreo.textContent = "Error verificando el correo: " + err.message;
        }
    };
}

// ¿La cuenta existe en Auth pero el registro quedó a medias en este navegador?
// Si la contraseña temporal guardada todavía funciona, el registro no se completó
// (al completarlo se cambia la contraseña). No hace falta leer Firestore.
async function esRegistroPendiente(correo) {
    const passwordTemp = localStorage.getItem("passwordTemp");
    if (!passwordTemp) return false;
    try {
        await signInWithEmailAndPassword(auth, correo, passwordTemp);
        await signOut(auth);
        return true;
    } catch {
        return false;
    }
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = correoInput.value.trim().toLowerCase();
    if (!correo) return;

    const passwordTemp = generarPasswordTemporal();

    try {
        // Crear usuario temporal en Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, correo, passwordTemp);

        // Guardar la contraseña temporal solo si la cuenta se creó (si no, se perdería la anterior)
        localStorage.setItem("passwordTemp", passwordTemp);

        // Enviar correo de verificación y cerrar la sesión temporal
        await sendEmailVerification(userCredential.user);
        await signOut(auth);

        mostrarModal(
            `Hemos enviado un correo de verificación a: ${correo}. Revisa tu bandeja y confirma tu correo antes de continuar.`,
            "Verificar estado del correo",
            verificarEstado(correo)
        );
    } catch (error) {
        console.error(error);

        if (error.code === "auth/email-already-in-use") {
            if (await esRegistroPendiente(correo)) {
                // Está en Auth pero no terminó el registro: permitir verificar
                mostrarModal(
                    `Ya te hemos enviado un correo de verificación a: ${correo}. Revisa tu bandeja y confírmalo para continuar.`,
                    "Verificar estado del correo",
                    verificarEstado(correo)
                );
            } else {
                mostrarModal(
                    "Correo no disponible. Ya existe un usuario registrado con este correo.",
                    "Aceptar",
                    cerrarYLimpiarCorreo
                );
            }
        } else {
            mostrarModal("Error al enviar verificación: " + error.message, "Aceptar", cerrarModal);
        }
    }
});
