import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    signOut, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// Referencias DOM
const form = document.getElementById("verifyEmailForm");
const modal = document.getElementById("modal");
const btnModal = document.getElementById("btnVerificarEstado");
const mensajeCorreo = document.getElementById("mensajeCorreo");

// Modal oculto al cargar
modal.style.display = "none";

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = document.getElementById("correo").value.trim();
    if (!correo) return;

    try {
        // Crear contraseña temporal
        const passwordTemp = Math.random().toString(36).slice(-10);
        localStorage.setItem("passwordTemp", passwordTemp);

        // Crear usuario temporal en Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, correo, passwordTemp);
        const user = userCredential.user;

        // Enviar correo de verificación
        await sendEmailVerification(user);

        // Mostrar modal de verificación
        mensajeCorreo.textContent = `Hemos enviado un correo de verificación a: ${correo}. Revisa tu bandeja y confirma tu correo antes de continuar.`;
        btnModal.textContent = "Verificar estado del correo";
        modal.style.display = "flex";

        // Cerrar sesión temporal
        await signOut(auth);

        // Botón para verificar estado del correo
        btnModal.onclick = async () => {
            try {
                const loginTemp = await signInWithEmailAndPassword(auth, correo, passwordTemp);
                const userCheck = loginTemp.user;
                await userCheck.reload();

                if (userCheck.emailVerified) {
                    await signOut(auth);
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

    } catch (error) {
        console.error(error);

        if (error.code === "auth/email-already-in-use") {
            // Revisar Firestore para saber si el usuario ya completó el registro
            try {
                const userRecord = await signInWithEmailAndPassword(auth, correo, localStorage.getItem("passwordTemp") || ""); 
                await signOut(auth);
            } catch {
                // ignoramos error
            }

            const uidDoc = await buscarUsuarioEnFirestore(correo);

            if (uidDoc) {
                // Ya existe en Firestore: registro completo
                mensajeCorreo.textContent = "Correo no disponible. Ya existe un usuario registrado con este correo.";
                btnModal.textContent = "Aceptar";
                modal.style.display = "flex";

                btnModal.onclick = () => {
                    modal.style.display = "none";
                    document.getElementById("correo").value = "";
                    document.getElementById("correo").focus();
                };
            } else {
                // Está en Auth pero no terminó el registro: permitir verificar
                mensajeCorreo.textContent = `Ya te hemos enviado un correo de verificación a: ${correo}. Revisa tu bandeja y confírmalo para continuar.`;
                btnModal.textContent = "Verificar estado del correo";
                modal.style.display = "flex";

                btnModal.onclick = async () => {
                    try {
                        const loginTemp = await signInWithEmailAndPassword(auth, correo, localStorage.getItem("passwordTemp"));
                        const userCheck = loginTemp.user;
                        await userCheck.reload();

                        if (userCheck.emailVerified) {
                            await signOut(auth);
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
        } else {
            mensajeCorreo.textContent = "Error al enviar verificación: " + error.message;
            btnModal.textContent = "Aceptar";
            modal.style.display = "flex";
            btnModal.onclick = () => { modal.style.display = "none"; };
        }
    }
});

// Función para comprobar si el usuario ya completó el registro en Firestore
async function buscarUsuarioEnFirestore(correo) {
    const snapshot = await getDoc(doc(db, "usuarios", correo));
    if (snapshot.exists()) {
        return snapshot.id;
    }
    return null;
}
