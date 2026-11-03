// /js/home.js
import { auth, app } from "./firebase-config.js";
import { db } from "./firebase-db.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";
import { mostrarMensaje } from "./ui-modal.js";

const functions = getFunctions(undefined, "us-central1");


import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore-lite.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const storage = getStorage(app);


/* ------------ Cargar datos del usuario (sessionStorage) ------------ */
const fillUserData = () => {
  const userData = JSON.parse(sessionStorage.getItem("userData"));
  if (!userData) return;

  document.querySelectorAll(".form-group input").forEach((input) => {
    const label = input.previousElementSibling.textContent.trim();
    switch (label) {
      case "Apellidos y nombres":
        input.value = `${userData.apellidoPaterno} ${userData.apellidoMaterno} ${userData.nombres}`;
        break;
      case "Documento de identidad":
        input.value = userData.dni;
        break;
      case "Correo electrónico":
        input.value = userData.correo;
        break;
    }
  });
};
fillUserData();
document.addEventListener("userDataLoaded", fillUserData);

/* ------------ Helpers ------------ */
function getDocFields() {
  return {
    tipo: document.getElementById("tipoDocumento"),
    sub: document.getElementById("subDocumento"),
    asunto: document.getElementById("asuntoDocumento"),
  };
}

function setDocFieldsDisabled(disabled) {
  const { tipo, sub, asunto } = getDocFields();
  [tipo, sub, asunto].forEach((el) => el && (el.disabled = disabled));
}

function clearUploads() {
  // Limpia principal
  const mainInput = document.getElementById("mainDoc");
  if (mainInput) {
    mainInput.value = "";
    const disp = mainInput.parentElement.querySelector(".upload-display");
    if (disp) disp.value = "";
    const box = document.getElementById("mainDoc-file");
    if (box) box.style.display = "none";
  }
  // Limpia anexo
  const annexInput = document.getElementById("annexDoc");
  if (annexInput) {
    annexInput.value = "";
    const disp = annexInput.parentElement.querySelector(".upload-display");
    if (disp) disp.value = "";
    const box = document.getElementById("annexDoc-file");
    if (box) box.style.display = "none";
  }
}

function resetUIAfterSuccess() {
  // Rehabilita los campos del documento
  setDocFieldsDisabled(false);

  // Resetea selects/textarea a valores iniciales
  const { tipo, sub, asunto } = getDocFields();
  if (tipo) tipo.value = "solicitud";
  if (sub) sub.value = "simple";
  if (asunto) asunto.value = "";

  // Limpia uploads
  clearUploads();

  // Desmarca checks
  const emailNotification = document.getElementById("emailNotification");
  const acceptTerms = document.getElementById("acceptTerms");
  if (emailNotification) emailNotification.checked = false;
  if (acceptTerms) acceptTerms.checked = false;

  // Oculta sección adicional y cierra modales si estuvieran abiertos
  const add = document.getElementById("additionalFields");
  if (add) add.style.display = "none";
  ["generateModal", "confirmModal", "termsModal"].forEach((id) => {
    const m = document.getElementById(id);
    if (m) m.style.display = "none";
  });

  // Vuelve arriba
  // El que se desplaza es el contenido (la cabecera y el menú quedan fijos)
  document.querySelector(".main-content")?.scrollTo({ top: 0, behavior: "smooth" });
}

/* ------------ Validación previa a generar ------------ */
function validateBeforeModal() {
  const asuntoDocumento = document.getElementById("asuntoDocumento").value.trim();
  if (!asuntoDocumento) {
    mostrarMensaje("Debes completar el asunto del documento.", { tipo: "aviso", titulo: "Falta el asunto" });
    return false;
  }
  return true;
}

/* ------------ Botón Guardar y continuar ------------ */
window.handleGuardarContinuar = function handleGuardarContinuar() {
  if (!validateBeforeModal()) return;

  // Bloquea “DATOS DEL DOCUMENTO” para que no se editen más
  setDocFieldsDisabled(true);

  showGenerateModal();
};

/* ------------ Modales ------------ */
function showGenerateModal() {
  document.getElementById("generateModal").style.display = "flex";
}

window.acceptGenerate = function acceptGenerate() {
  closeModal("generateModal");
  document.getElementById("additionalFields").style.display = "block";

  const timeline = document.querySelector(".timeline");
  if (timeline) {
    const newItem = document.createElement("div");
    newItem.className = "timeline-item";
    newItem.innerHTML = `<div class="timeline-circle">3</div>`;
    timeline.appendChild(newItem);
  }

  document.getElementById("additionalFields").scrollIntoView({ behavior: "smooth" });
};

window.showConfirmModal = function showConfirmModal() {
  // Validaciones obligatorias antes de abrir Confirmar envío
  const mainInput = document.getElementById("mainDoc");
  const emailNotification = document.getElementById("emailNotification").checked;
  const acceptTerms = document.getElementById("acceptTerms").checked;

  const mainFile = mainInput?.files?.[0] || null;
  if (!mainFile) {
    mostrarMensaje("Debes adjuntar el Documento principal (PDF).", { tipo: "aviso", titulo: "Falta el documento principal" });
    return;
  }
  const isPdf = mainFile.type === "application/pdf" || /\.pdf$/i.test(mainFile.name);
  const maxBytes = 10 * 1024 * 1024;
  if (!isPdf) {
    mostrarMensaje("El Documento principal debe ser PDF.", { tipo: "aviso", titulo: "Formato no válido" });
    return;
  }
  if (mainFile.size > maxBytes) {
    mostrarMensaje("El Documento principal supera los 10MB.", { tipo: "aviso", titulo: "Archivo demasiado grande" });
    return;
  }
  const annexFile = document.getElementById("annexDoc")?.files?.[0] || null;
  if (annexFile && annexFile.size > maxBytes) {
    mostrarMensaje("El Anexo supera los 10MB.", { tipo: "aviso", titulo: "Archivo demasiado grande" });
    return;
  }
  if (!emailNotification || !acceptTerms) {
    mostrarMensaje("Debes autorizar la notificación por correo y aceptar los términos.", { tipo: "aviso", titulo: "Falta tu autorización" });
    return;
  }

  document.getElementById("confirmModal").style.display = "flex";
};

window.showTermsModal = function showTermsModal() {
  document.getElementById("termsModal").style.display = "flex";
};

window.closeModal = function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
};

/* ------------ UI de archivos ------------ */
window.handleFileUpload = function handleFileUpload(input, fieldId) {
  const file = input.files?.[0];
  if (file) {
    const uploadDisplay = input.parentElement.querySelector(".upload-display");
    const fileDiv = document.getElementById(fieldId + "-file");
    const fileName = fileDiv.querySelector(".file-name");

    uploadDisplay.value = file.name;
    fileName.textContent = file.name;
    fileDiv.style.display = "flex";
  }
};

window.removeFile = function removeFile(fieldId) {
  const input = document.getElementById(fieldId);
  const uploadDisplay = input.parentElement.querySelector(".upload-display");
  const fileDiv = document.getElementById(fieldId + "-file");

  input.value = "";
  if (uploadDisplay) uploadDisplay.value = "";
  if (fileDiv) fileDiv.style.display = "none";
};

/* ------------ Util: forzar re-auth (evita subir con clave mala) ------------ */
async function ensureRecentLogin(maxAgeSec = 0) {
  // maxAgeSec=0 -> SIEMPRE re-auth
  const user = auth.currentUser;
  if (!user) throw new Error("no-user");

  // Siempre pedimos contraseña
  const pwd = document.getElementById("confirmPassword").value.trim();
  if (!pwd) throw new Error("need-password");

  const cred = EmailAuthProvider.credential(user.email, pwd);
  await reauthenticateWithCredential(user, cred);
}

// Modal de éxito
window.showSuccessModal = function showSuccessModal(msg = "Tu documento fue enviado exitosamente.") {
  const text = document.getElementById("successMessage");
  if (text) text.textContent = msg;
  document.getElementById("successModal").style.display = "flex";
};

window.closeSuccessAndReset = function closeSuccessAndReset() {
  closeModal("successModal");
  resetUIAfterSuccess();
};

let isSubmitting = false;

function setConfirmBtnState(disabled, label = null) {
  const btn = document.querySelector('#confirmModal .btn-accept');
  if (!btn) return;
  btn.disabled = disabled;
  if (label) btn.textContent = label;
}

/* ------------ Confirmar envío: valida contraseña, sube, guarda y notifica ------------ */
window.confirmSend = async function confirmSend() {
  if (isSubmitting) return;                    // candado anti-doble click
  isSubmitting = true;
  setConfirmBtnState(true, "Enviando...");     // deshabilita botón

  const user = auth.currentUser;
  if (!user) {
    mostrarMensaje("Sesión no válida. Vuelve a iniciar sesión.", { tipo: "error", titulo: "Sesión no válida" });
    isSubmitting = false;
    setConfirmBtnState(false, "✓ Aceptar");
    return;
  }

  try {
    // 1) Reautenticación
    await ensureRecentLogin(0);

    // 2) Datos
    const tipoDocumento = document.getElementById("tipoDocumento").value;
    const subDocumento  = document.getElementById("subDocumento").value;
    const asunto        = document.getElementById("asuntoDocumento").value.trim();
    const mainFile      = document.getElementById("mainDoc")?.files?.[0] || null;
    const annexFile     = document.getElementById("annexDoc")?.files?.[0] || null;

    // 3) Subir y guardar
    let mainUrl=null, mainMeta=null, annexUrl=null, annexMeta=null;

    const now = Date.now();
    const basePath = `ficha-solicitudes/${user.uid}/${now}`;

    if (mainFile) {
      const mainRef = ref(storage, `${basePath}/principal_${mainFile.name}`);
      const mainSnap = await uploadBytes(mainRef, mainFile, { contentType: mainFile.type || "application/pdf" });
      mainUrl = await getDownloadURL(mainRef);
      mainMeta = { name: mainFile.name, contentType: mainFile.type || "application/pdf", size: mainFile.size, path: mainSnap.metadata.fullPath };
    }

    if (annexFile) {
      const annexRef = ref(storage, `${basePath}/anexo_${annexFile.name}`);
      const annexSnap = await uploadBytes(annexRef, annexFile, { contentType: annexFile.type || "application/octet-stream" });
      annexUrl = await getDownloadURL(annexRef);
      annexMeta = { name: annexFile.name, contentType: annexFile.type || "application/octet-stream", size: annexFile.size, path: annexSnap.metadata.fullPath };
    }

    const solicitudRef = await addDoc(collection(db, "ficha-solicitud"), {
      userId: user.uid,
      correo: user.email,
      tipoDocumento,
      subDocumento,
      asunto,
      documentos: {
        principal: mainUrl ? { url: mainUrl, ...mainMeta } : null,
        anexo: annexUrl ? { url: annexUrl, ...annexMeta } : null,
      },
      autorizacionCorreo: true,
      terminosAceptados: true,
      creadoEn: serverTimestamp(),
    });

    // 4) Notificación (el servidor arma el correo a partir de la solicitud guardada)
    try {
      const enviarSolicitud = httpsCallable(functions, "enviarSolicitud");
      await enviarSolicitud({ solicitudId: solicitudRef.id });
      console.log("enviarSolicitud: llamada completada correctamente");
    } catch(e) {
      console.warn("No se pudo enviar el correo (continúo igual):", e);
    }

    // 5) Cerrar y éxito
    closeModal("confirmModal");
    showSuccessModal("Tu documento fue enviado correctamente. Se generó tu ficha de solicitud y se guardaron tus archivos.");

  } catch (err) {
    if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password") {
      mostrarMensaje("Contraseña incorrecta.", { tipo: "error", titulo: "Contraseña incorrecta" });
    } else if (err?.message === "need-password") {
      mostrarMensaje("Ingresa tu contraseña para confirmar.", { tipo: "aviso", titulo: "Falta la contraseña" });
    } else {
      console.error(err);
      mostrarMensaje("No se pudo completar el envío. Inténtalo nuevamente.", { tipo: "error", titulo: "No se pudo enviar" });
    }
    isSubmitting = false;
    setConfirmBtnState(false, "✓ Aceptar");    // reactivar solo si falló
    return;
  }

  // éxito: liberar flag después de mostrar modal y resetear UI
  isSubmitting = false;
  setConfirmBtnState(false, "✓ Aceptar");
};

/* ------------ Guarda de sesión por si llegan directo ------------ */
onAuthStateChanged(auth, (u) => {
  if (!u) window.location.replace("index.html");
});
