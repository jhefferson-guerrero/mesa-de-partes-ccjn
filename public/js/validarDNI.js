// /js/validarDNI.js
// Consulta los nombres por DNI a través de la Cloud Function "consultarDni".
// El token de miapi.cloud vive en el servidor, no en el navegador.
import "./firebase-config.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";
import { sessionReady } from "./register-session.js";

const consultarDni = httpsCallable(getFunctions(undefined, "us-central1"), "consultarDni");

const dniInput = document.getElementById("dni");
const nombresInput = document.getElementById("nombres");
const apePInput = document.getElementById("apellidoPaterno");
const apeMInput = document.getElementById("apellidoMaterno");
const dniErrorIcon = document.querySelector(".dni-error-icon");
const dniSuccessIcon = document.querySelector(".dni-success-icon");

// Al inicio ocultar iconos
dniErrorIcon.style.display = "none";
dniSuccessIcon.style.display = "none";

function limpiarNombres() {
    nombresInput.value = "";
    apePInput.value = "";
    apeMInput.value = "";
    nombresInput.removeAttribute("readonly");
    apePInput.removeAttribute("readonly");
    apeMInput.removeAttribute("readonly");
}

function marcarError() {
    dniInput.classList.add("input-error");
    dniErrorIcon.style.display = "block";
    limpiarNombres();
}

dniInput.addEventListener("input", async () => {
    dniInput.value = dniInput.value.replace(/\D/g, "").slice(0, 8);
    const dni = dniInput.value.trim();

    // Resetear estilos
    dniInput.classList.remove("input-error", "input-success");
    dniErrorIcon.style.display = "none";
    dniSuccessIcon.style.display = "none";

    if (dni.length < 8) {
        limpiarNombres();
        return;
    }

    try {
        await sessionReady;
        const { data } = await consultarDni({ dni });

        // Si el usuario siguió escribiendo mientras tanto, ignorar esta respuesta
        if (dniInput.value.trim() !== dni) return;

        if (!data || !data.found) {
            marcarError();
            return;
        }

        dniInput.classList.add("input-success");
        dniSuccessIcon.style.display = "block";

        nombresInput.value = data.nombres;
        apePInput.value = data.apellidoPaterno;
        apeMInput.value = data.apellidoMaterno;

        nombresInput.setAttribute("readonly", true);
        apePInput.setAttribute("readonly", true);
        apeMInput.setAttribute("readonly", true);

    } catch (error) {
        console.error(error);
        marcarError();
    }
});
