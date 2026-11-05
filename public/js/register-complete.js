import { auth } from "./firebase-config.js";
import { db } from "./firebase-db.js";
import { updatePassword, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore-lite.js";
import { sessionReady } from "./register-session.js";

const form = document.getElementById("registerCompleteForm");
const errorMessage = document.getElementById("errorMessage");
const successModal = document.getElementById("successModal");
const modalOkButton = document.getElementById("modalOkButton");
const celularInput = document.getElementById("celular");
const passwordInput = document.getElementById("password");
const passwordReqDiv = document.getElementById("passwordRequirements");
const fechaNacimientoInput = document.getElementById("fechaNacimiento");

// ==================== FUNCIONES AUXILIARES ====================
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
}

function hideError() {
    errorMessage.textContent = "";
    errorMessage.style.display = "none";
}

// Limitar input de celular a solo números y máximo 9 dígitos
celularInput.addEventListener("input", () => {
    celularInput.value = celularInput.value.replace(/\D/g, "").slice(0, 9);
});

// Expresión regular para contraseña
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

// Validación en tiempo real de contraseña
passwordInput.addEventListener("input", () => {
    const val = passwordInput.value;

    if (val === "") {
        passwordInput.style.borderColor = "#d1d5db";
        passwordInput.style.backgroundColor = "#ffffff";
    } else if (passwordRegex.test(val)) {
        passwordInput.style.borderColor = "#16a34a";
        passwordInput.style.backgroundColor = "#f0fdf4";
    } else {
        passwordInput.style.borderColor = "#dc2626";
        passwordInput.style.backgroundColor = "#fef2f2";
    }

    const requirements = [
        { regex: /.{8,}/, text: "Mínimo 8 caracteres" },
        { regex: /[A-Z]/, text: "Una mayúscula" },
        { regex: /[a-z]/, text: "Una minúscula" },
        { regex: /\d/, text: "Un número" },
        { regex: /[\W_]/, text: "Un caracter especial" }
    ];

    passwordReqDiv.innerHTML = requirements.map(req => {
        const cumple = req.regex.test(val);
        const color = val === "" ? "#6b7280" : (cumple ? "#16a34a" : "#dc2626");
        return `<span style="color:${color}">&#9679;</span> ${req.text}`;
    }).join(" &nbsp; ");
});

// ==================== FECHA DE NACIMIENTO ====================
// Evitar escribir manualmente
fechaNacimientoInput.addEventListener("keydown", (e) => e.preventDefault());

const today = new Date();
const minAge = 18;
const maxAge = 120;
const maxDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
const minDate = new Date(today.getFullYear() - maxAge, today.getMonth(), today.getDate());
fechaNacimientoInput.setAttribute("max", maxDate.toISOString().split("T")[0]);
fechaNacimientoInput.setAttribute("min", minDate.toISOString().split("T")[0]);

// ==================== SUBMIT DEL FORM ====================
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const correo = localStorage.getItem("correoVerificado");
    const passwordTemp = localStorage.getItem("passwordTemp");

    const password = passwordInput.value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const dni = document.getElementById("dni").value.trim();
    const apellidoPaterno = document.getElementById("apellidoPaterno").value.trim();
    const apellidoMaterno = document.getElementById("apellidoMaterno").value.trim();
    const nombres = document.getElementById("nombres").value.trim();
    const celular = celularInput.value.trim();
    const direccion = document.getElementById("direccion").value.trim();
    const departamento = document.getElementById("departamento").value.trim();
    const provincia = document.getElementById("provincia").value.trim();
    const distrito = document.getElementById("distrito").value.trim();
    const fechaNacimiento = fechaNacimientoInput.value;

    // Validaciones
    if (!correo || !passwordTemp) {
        showError("No hay correo verificado. Regresa al paso anterior.");
        return;
    }

    if (!fechaNacimiento) {
        showError("Debes seleccionar tu fecha de nacimiento.");
        return;
    }

    const nacimientoDate = new Date(fechaNacimiento);
    let edad = today.getFullYear() - nacimientoDate.getFullYear();
    const mesDiff = today.getMonth() - nacimientoDate.getMonth();
    const diaDiff = today.getDate() - nacimientoDate.getDate();
    if (mesDiff < 0 || (mesDiff === 0 && diaDiff < 0)) edad--;

    if (edad < minAge) {
        showError("Debes tener al menos 18 años para registrarte.");
        return;
    }

    if (edad > maxAge) {
        showError("La fecha de nacimiento ingresada es demasiado antigua.");
        return;
    }

    if (password !== confirmPassword) {
        showError("Las contraseñas no coinciden.");
        return;
    }

    if (!passwordRegex.test(password)) {
        showError("La contraseña debe tener al menos 8 caracteres, incluyendo mayúscula, minúscula, número y caracter especial.");
        return;
    }

    if (!/^[9]\d{8}$/.test(celular)) {
        showError("El número de celular debe contener 9 dígitos y comenzar con 9.");
        return;
    }

    if (!direccion) {
        showError("La dirección no puede estar vacía.");
        return;
    }

    if (!/^\d{8}$/.test(dni)) {
        showError("El DNI debe tener 8 dígitos.");
        return;
    }

    // Sesión de la cuenta temporal (se abre en register-session.js)
    let user;
    try {
        user = await sessionReady;
    } catch (error) {
        console.error(error);
        showError("Tu sesión de verificación expiró. Regresa al paso anterior para verificar tu correo.");
        return;
    }

    try {
        // Un solo batch: reserva el DNI (/dnis/{dni}) y crea el perfil.
        // Si el DNI ya existe, las reglas rechazan todo el batch (permission-denied).
        const batch = writeBatch(db);
        batch.set(doc(db, "dnis", dni), { uid: user.uid });
        batch.set(doc(db, "usuarios", user.uid), {
            correo: user.email,
            dni,
            apellidoPaterno,
            apellidoMaterno,
            nombres,
            celular,
            direccion,
            departamento,
            provincia,
            distrito,
            fechaNacimiento,
            fechaRegistro: Timestamp.now()
        });
        await batch.commit();
    } catch (error) {
        console.error(error);
        if (error.code === "permission-denied") {
            showError("El DNI ingresado ya está registrado o no se pudo completar el registro. Verifica tus datos.");
        } else {
            showError("Error al completar el registro: " + error.message);
        }
        return;
    }

    try {
        // Reemplaza la contraseña temporal por la que eligió el usuario
        await updatePassword(user, password);
        await signOut(auth);
        localStorage.removeItem("correoVerificado");
        localStorage.removeItem("passwordTemp");

        successModal.style.display = "flex";
    } catch (error) {
        console.error(error);
        showError("Tu perfil se guardó, pero no se pudo establecer la contraseña. Usa «Olvidé mi contraseña» para crearla.");
    }
});

// Listener del modal OK
modalOkButton.addEventListener("click", () => {
    window.location.href = "index.html";
});

// ==================== UBIGEO ====================
function initUbigeoRegister() {
    const departamentoSelect = document.getElementById("departamento");
    const provinciaSelect = document.getElementById("provincia");
    const distritoSelect = document.getElementById("distrito");

    // Llenar departamentos
    ubigeo.departamentos().forEach((dep) => {
        const option = document.createElement("option");
        option.value = dep;
        option.textContent = dep;
        departamentoSelect.appendChild(option);
    });

    departamentoSelect.addEventListener("change", () => {
        provinciaSelect.innerHTML = `<option value="">Seleccione...</option>`;
        distritoSelect.innerHTML = `<option value="">Seleccione...</option>`;
        const dep = departamentoSelect.value;
        if (!dep) return;
        ubigeo.provincias(dep).forEach((prov) => {
            const option = document.createElement("option");
            option.value = prov;
            option.textContent = prov;
            provinciaSelect.appendChild(option);
        });
    });

    provinciaSelect.addEventListener("change", () => {
        distritoSelect.innerHTML = `<option value="">Seleccione...</option>`;
        const dep = departamentoSelect.value;
        const prov = provinciaSelect.value;
        if (!dep || !prov) return;
        ubigeo.distritos(dep, prov).forEach((dist) => {
            const option = document.createElement("option");
            option.value = dist;
            option.textContent = dist;
            distritoSelect.appendChild(option);
        });
    });
}

document.addEventListener("DOMContentLoaded", initUbigeoRegister);
