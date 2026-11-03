import { auth } from "./firebase-config.js";
import { db } from "./firebase-db.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore-lite.js";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { mostrarMensaje } from "./ui-modal.js";

let profileEditMode = false;

// Referencias de selects e inputs
const departamentoSelect = document.getElementById("departamento");
const provinciaSelect = document.getElementById("provincia");
const distritoSelect = document.getElementById("distrito");

const departamentoInput = document.getElementById("departamento-input");
const provinciaInput = document.getElementById("provincia-input");
const distritoInput = document.getElementById("distrito-input");

// Agregar clase para que los selects sean editables
departamentoSelect.classList.add("profile-editable-field");
provinciaSelect.classList.add("profile-editable-field");
distritoSelect.classList.add("profile-editable-field");

// Inicializar selects de ubigeo con preselección
function initUbigeo(userData) {
    // Limpiar selects
    departamentoSelect.innerHTML = `<option value="">Seleccione...</option>`;
    provinciaSelect.innerHTML = `<option value="">Seleccione...</option>`;
    distritoSelect.innerHTML = `<option value="">Seleccione...</option>`;

    // Llenar departamentos
    ubigeo.departamentos().forEach((dep) => {
        const option = document.createElement("option");
        option.value = dep;
        option.textContent = dep;
        departamentoSelect.appendChild(option);
    });

    // Preseleccionar departamento, provincia y distrito si existen
    if (userData.departamento) {
        departamentoSelect.value = userData.departamento;
        actualizarProvincias(userData.departamento, userData.provincia);

        if (userData.provincia) {
            provinciaSelect.value = userData.provincia;
            actualizarDistritos(userData.departamento, userData.provincia, userData.distrito);
        }
    }

    // Eventos para cuando cambian los selects
    departamentoSelect.addEventListener("change", () => {
        const dep = departamentoSelect.value;
        actualizarProvincias(dep, null);
        distritoSelect.innerHTML = `<option value="">Seleccione...</option>`;
    });

    provinciaSelect.addEventListener("change", () => {
        const dep = departamentoSelect.value;
        const prov = provinciaSelect.value;
        actualizarDistritos(dep, prov, null);
    });

    // Deshabilitar selects inicialmente si no estamos en modo edición
    departamentoSelect.disabled = !profileEditMode;
    provinciaSelect.disabled = !profileEditMode;
    distritoSelect.disabled = !profileEditMode;
}

function actualizarProvincias(dep, provSelected) {
    provinciaSelect.innerHTML = `<option value="">Seleccione...</option>`;
    if (!dep) return;
    ubigeo.provincias(dep).forEach((prov) => {
        const option = document.createElement("option");
        option.value = prov;
        option.textContent = prov;
        if (prov === provSelected) option.selected = true;
        provinciaSelect.appendChild(option);
    });
}

function actualizarDistritos(dep, prov, distSelected) {
    distritoSelect.innerHTML = `<option value="">Seleccione...</option>`;
    if (!dep || !prov) return;
    ubigeo.distritos(dep, prov).forEach((dist) => {
        const option = document.createElement("option");
        option.value = dist;
        option.textContent = dist;
        if (dist === distSelected) option.selected = true;
        distritoSelect.appendChild(option);
    });
}

// Cargar datos del usuario
function cargarDatosUsuario() {
    const userData = JSON.parse(sessionStorage.getItem("userData"));
    if (!userData) return;

    document.querySelectorAll(".profile-form-control").forEach((input) => {
        const label = input.previousElementSibling?.textContent.trim();
        switch (label) {
            case "Apellidos y nombres":
                input.value = `${userData.apellidoPaterno} ${userData.apellidoMaterno}, ${userData.nombres}`;
                break;
            case "Documento Identidad":
                input.value = userData.dni || "";
                break;
            case "Dirección/domicilio fiscal":
                input.value = userData.direccion || "";
                break;
            case "Celular":
                input.value = userData.celular || "";
                break;
            case "Correo Electrónico":
                input.value = userData.correo || "";
                break;
            case "Departamento":
                input.value = userData.departamento || "";
                break;
            case "Provincia":
                input.value = userData.provincia || "";
                break;
            case "Distrito":
                input.value = userData.distrito || "";
                break;
        }
    });

    initUbigeo(userData);

    if (userData.departamento) departamentoInput.value = userData.departamento;
    if (userData.provincia) provinciaInput.value = userData.provincia;
    if (userData.distrito) distritoInput.value = userData.distrito;

    if (!profileEditMode) {
        departamentoInput.style.display = "block";
        provinciaInput.style.display = "block";
        distritoInput.style.display = "block";
        departamentoSelect.style.display = "none";
        provinciaSelect.style.display = "none";
        distritoSelect.style.display = "none";
    }
}

document.addEventListener("DOMContentLoaded", cargarDatosUsuario);

// Si se entra directo al perfil (pestaña nueva, sin copia guardada), los datos llegan
// después desde Firestore (load-user.js) y se llenan los campos en ese momento.
let perfilYaMostrado = !!sessionStorage.getItem("userData");
document.addEventListener("userDataLoaded", () => {
    if (perfilYaMostrado || profileEditMode) return;
    perfilYaMostrado = true;
    cargarDatosUsuario();
});

// Tabs
window.showProfileTab = function (tabId) {
    document.querySelectorAll(".profile-tab-content").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".profile-tab-btn").forEach((btn) => btn.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
    event.target.classList.add("active");
};

// Alternar modo edición
window.toggleProfileEdit = function () {
    profileEditMode = !profileEditMode;
    const editableFields = document.querySelectorAll(".profile-editable-field");
    const editButton = document.querySelector(".profile-edit-btn");
    const updateButton = document.querySelector(".profile-update-btn");

    if (profileEditMode) {
        editableFields.forEach((field) => {
            if (field.tagName === "SELECT") field.disabled = false;
            else field.readOnly = false;
            field.classList.add("editable");
        });
        departamentoSelect.style.display = "block";
        provinciaSelect.style.display = "block";
        distritoSelect.style.display = "block";
        departamentoInput.style.display = "none";
        provinciaInput.style.display = "none";
        distritoInput.style.display = "none";

        editButton.innerHTML = "✗ Cancelar";
        editButton.style.backgroundColor = "#dc3545";
        updateButton.style.display = "inline-flex";
    } else {
        editableFields.forEach((field) => {
            if (field.tagName === "SELECT") field.disabled = true;
            else field.readOnly = true;
            field.classList.remove("editable");
        });
        departamentoInput.style.display = "block";
        provinciaInput.style.display = "block";
        distritoInput.style.display = "block";
        departamentoSelect.style.display = "none";
        provinciaSelect.style.display = "none";
        distritoSelect.style.display = "none";

        editButton.innerHTML = '<i class="fa-solid fa-pencil"></i> Editar';
        editButton.style.backgroundColor = "#1983a3";
        updateButton.style.display = "none";
        cargarDatosUsuario();
    }
};

// ================= VALIDACIONES CELULAR =================
const celularInputField = document.getElementById("celular-input");

// Solo números y máximo 9 caracteres
celularInputField.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, ""); // Solo números
    if (e.target.value.length > 9) {
        e.target.value = e.target.value.slice(0, 9); // Máx 9 dígitos
    }
});

// ================= ACTUALIZAR PERFIL =================
window.updateUserProfile = async function () {
    const user = auth.currentUser;
    if (!user) return;

    const userDocRef = doc(db, "usuarios", user.uid);
    const updatedData = {};

    const direccionInput = document.querySelector("#direccion-input");
    const celularInput = document.querySelector("#celular-input");

    // Validación de dirección
    const direccion = direccionInput?.value.trim() || "";
    if (!direccion) {
        mostrarMensaje("El campo Dirección/domicilio fiscal no puede estar vacío.", { tipo: "aviso", titulo: "Falta la dirección" });
        return;
    }
    updatedData.direccion = direccion;

    // Validación de celular
    const celular = celularInput?.value || "";
    if (celular.length !== 9) {
        mostrarMensaje("El celular debe tener exactamente 9 dígitos.", { tipo: "aviso", titulo: "Celular no válido" });
        return;
    }
    if (!celular.startsWith("9")) {
        mostrarMensaje("El celular debe empezar en 9.", { tipo: "aviso", titulo: "Celular no válido" });
        return;
    }
    updatedData.celular = celular;

    // Validación de selects
    const dep = departamentoSelect.value;
    const prov = provinciaSelect.value;
    const dist = distritoSelect.value;

    if (dep && (!prov || !dist)) {
        mostrarMensaje("Si seleccionas un departamento, debes seleccionar también provincia y distrito.", { tipo: "aviso" });
        return;
    }

    if (dep) updatedData.departamento = dep;
    if (prov) updatedData.provincia = prov;
    if (dist) updatedData.distrito = dist;

    try {
        await updateDoc(userDocRef, updatedData);

        const userData = JSON.parse(sessionStorage.getItem("userData")) || {};
        sessionStorage.setItem("userData", JSON.stringify({ ...userData, ...updatedData }));

        document.getElementById("profileSuccessMessage").textContent = "Perfil actualizado correctamente.";
        document.getElementById("profileSuccessModal").style.display = "flex";
        toggleProfileEdit();
    } catch (error) {
        console.error("Error al actualizar perfil:", error);
        mostrarMensaje("Error al actualizar el perfil. Intenta nuevamente.", { tipo: "error", titulo: "No se pudo guardar" });
    }
};

// ================= CAMBIO DE CONTRASEÑA =================
window.changeUserPassword = async function () {
    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        mostrarMensaje("Por favor, completa todos los campos.", { tipo: "aviso", titulo: "Faltan datos" });
        return;
    }
    if (newPassword !== confirmPassword) {
        mostrarMensaje("Las contraseñas no coinciden.", { tipo: "aviso", titulo: "Las contraseñas no coinciden" });
        return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#.])[A-Za-z\d@$!%*?&#.]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        mostrarMensaje("La nueva contraseña debe tener:\n- 8 caracteres como mínimo\n- Una mayúscula\n- Una minúscula\n- Un número\n- Un carácter especial (@ $ ! % * ? & # .)", { tipo: "aviso", titulo: "Contraseña no válida" });
        return;
    }

    try {
        const user = auth.currentUser;
        if (!user) return;

        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        await updatePassword(user, newPassword);

        document.getElementById("profileSuccessMessage").textContent = "Contraseña actualizada correctamente.";
        document.getElementById("profileSuccessModal").style.display = "flex";

        clearPasswordFields();
    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        if (error.code === "auth/wrong-password") {
            mostrarMensaje("La contraseña actual es incorrecta.", { tipo: "error", titulo: "Contraseña actual incorrecta" });
        } else {
            mostrarMensaje("Error al cambiar la contraseña: " + error.message, { tipo: "error" });
        }
    }
};

function clearPasswordFields() {
    document.getElementById("current-password").value = "";
    document.getElementById("new-password").value = "";
    document.getElementById("confirm-password").value = "";
}

// ================= CERRAR MODAL =================
window.closeProfileModal = function () {
    document.getElementById("profileSuccessModal").style.display = "none";
    const message = document.getElementById("profileSuccessMessage").textContent;
    if (message.includes("Contraseña")) showProfileTab("profile-data-tab");
};

window.addEventListener("click", function (event) {
    const profileModal = document.getElementById("profileSuccessModal");
    if (event.target === profileModal) closeProfileModal();
});
