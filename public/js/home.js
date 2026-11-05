// /js/home.js
import { auth, app } from "./firebase-config.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";
import { mostrarMensaje } from "./ui-modal.js";
import { problemaConArchivo, MAX_ARCHIVOS } from "./detalle-ui.js";

const functions = getFunctions(undefined, "us-central1");


import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
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

/* ------------ Anexos: hasta 10 archivos ------------ */
const anexos = []; // File[] elegidos como anexos
const mismoArchivo = (a, b) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

function crearTarjetaAnexo(archivo, indice) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "uploaded-file";

  const tipo = iconoDeArchivo(archivo.name);
  const caja = document.createElement("span");
  caja.className = "file-icon " + tipo.clase;
  const icono = document.createElement("i");
  icono.className = "fa-solid " + tipo.icono;
  icono.setAttribute("aria-hidden", "true");
  caja.appendChild(icono);

  const meta = document.createElement("span");
  meta.className = "file-meta";
  const nombre = document.createElement("span");
  nombre.className = "file-name";
  nombre.textContent = archivo.name;
  nombre.title = archivo.name;
  const peso = document.createElement("span");
  peso.className = "file-size";
  peso.textContent = formatearTamano(archivo.size);
  meta.append(nombre, peso);

  const quitar = document.createElement("button");
  quitar.type = "button";
  quitar.className = "btn-delete";
  quitar.title = "Quitar archivo";
  quitar.setAttribute("aria-label", "Quitar " + archivo.name);
  const tacho = document.createElement("i");
  tacho.className = "fa-solid fa-trash";
  tacho.setAttribute("aria-hidden", "true");
  quitar.appendChild(tacho);
  quitar.addEventListener("click", () => {
    anexos.splice(indice, 1);
    renderAnexos();
  });

  tarjeta.append(caja, meta, quitar);
  return tarjeta;
}

function renderAnexos() {
  const lista = document.getElementById("annexDoc-lista");
  if (lista) lista.replaceChildren(...anexos.map(crearTarjetaAnexo));
}

function agregarAnexos(archivos) {
  const problemas = [];
  for (const f of Array.from(archivos || [])) {
    const motivo = problemaConArchivo(f);
    if (motivo) { problemas.push(motivo); continue; }
    if (anexos.some((x) => mismoArchivo(x, f))) { problemas.push(`"${f.name}" ya está en la lista.`); continue; }
    if (anexos.length >= MAX_ARCHIVOS) { problemas.push(`Solo puedes adjuntar hasta ${MAX_ARCHIVOS} anexos.`); break; }
    anexos.push(f);
  }
  renderAnexos();
  if (problemas.length) {
    mostrarMensaje(problemas.map((p) => "- " + p).join("\n"), { tipo: "aviso", titulo: "Algunos archivos no se agregaron" });
  }
}

window.handleAnnexUpload = function handleAnnexUpload(input) {
  agregarAnexos(input.files);
  input.value = ""; // permite volver a elegir el mismo archivo si se quitó
};

function clearUploads() {
  // Quita el documento principal y todos los anexos (y vuelve a mostrar la zona del principal)
  if (document.getElementById("mainDoc")) window.removeFile("mainDoc");
  anexos.length = 0;
  renderAnexos();
}

/* ------------ Estado del botón "Guardar y continuar" ------------
   - Sin guardar: botón activo "Guardar y continuar".
   - Guardado: el botón queda desactivado como "✓ Datos guardados" y aparece "Modificar datos".
   Así no se puede repetir el paso y, si hace falta cambiar algo, hay una salida clara. */
function setDatosGuardados(guardado) {
  const guardar = document.getElementById("btnGuardar");
  const modificar = document.getElementById("btnModificar");
  if (guardar) {
    guardar.disabled = guardado;
    guardar.classList.toggle("guardado", guardado);
    guardar.innerHTML = guardado
      ? '<i class="fa-solid fa-check" aria-hidden="true"></i> Datos guardados'
      : "Guardar y continuar";
  }
  if (modificar) modificar.style.display = guardado ? "inline-flex" : "none";
}

function resetUIAfterSuccess() {
  // Rehabilita los campos del documento y el botón de guardar
  setDocFieldsDisabled(false);
  setDatosGuardados(false);

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

  // Los datos se bloquean recién cuando la persona confirma en la ventana (acceptGenerate).
  // Si cancela, no pasa nada y puede seguir editando.
  showGenerateModal();
};

/* ------------ Botón Modificar datos ------------ */
window.handleModificarDatos = function handleModificarDatos() {
  setDocFieldsDisabled(false);
  setDatosGuardados(false);
  // Se oculta el paso 2; los archivos elegidos se conservan
  const add = document.getElementById("additionalFields");
  if (add) add.style.display = "none";
  document.getElementById("asuntoDocumento")?.focus();
};

/* ------------ Modales ------------ */
function showGenerateModal() {
  document.getElementById("generateModal").style.display = "flex";
}

window.acceptGenerate = function acceptGenerate() {
  closeModal("generateModal");

  // Bloquea “DATOS DEL DOCUMENTO” y deja el botón como "Datos guardados"
  setDocFieldsDisabled(true);
  setDatosGuardados(true);

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
function formatearTamano(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Icono y color según el tipo de archivo
function iconoDeArchivo(nombre) {
  const ext = (nombre.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return { clase: "pdf", icono: "fa-file-pdf" };
  if (ext === "doc" || ext === "docx") return { clase: "doc", icono: "fa-file-word" };
  if (ext === "xls" || ext === "xlsx") return { clase: "xls", icono: "fa-file-excel" };
  return { clase: "", icono: "fa-file" };
}

// Al elegir un archivo: se oculta la zona de carga y aparece una tarjeta con nombre, tamaño y botón para quitarlo
window.handleFileUpload = function handleFileUpload(input, fieldId) {
  const file = input.files?.[0];
  if (!file) return;

  const tarjeta = document.getElementById(fieldId + "-file");
  const zona = document.getElementById(fieldId + "-zone");
  if (!tarjeta) return;

  tarjeta.querySelector(".file-name").textContent = file.name;
  tarjeta.querySelector(".file-size").textContent = formatearTamano(file.size);
  const tipo = iconoDeArchivo(file.name);
  const caja = tarjeta.querySelector(".file-icon");
  caja.className = "file-icon " + tipo.clase;
  caja.querySelector("i").className = "fa-solid " + tipo.icono;

  tarjeta.style.display = "flex";
  if (zona) zona.style.display = "none";
};

window.removeFile = function removeFile(fieldId) {
  const input = document.getElementById(fieldId);
  const tarjeta = document.getElementById(fieldId + "-file");
  const zona = document.getElementById(fieldId + "-zone");

  if (input) input.value = "";
  if (tarjeta) tarjeta.style.display = "none";
  if (zona) zona.style.display = "";
};

/* ------------ Arrastrar y soltar archivos ------------ */
["mainDoc"].forEach((id) => {
  const zona = document.getElementById(id + "-zone");
  const input = document.getElementById(id);
  if (!zona || !input) return;

  ["dragenter", "dragover"].forEach((ev) =>
    zona.addEventListener(ev, (e) => {
      e.preventDefault();
      zona.classList.add("arrastrando");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    zona.addEventListener(ev, (e) => {
      e.preventDefault();
      zona.classList.remove("arrastrando");
    })
  );
  zona.addEventListener("drop", (e) => {
    const archivo = e.dataTransfer?.files?.[0];
    if (!archivo) return;
    const permitidos = input.accept.split(",").map((x) => x.trim().toLowerCase());
    const ext = "." + (archivo.name.split(".").pop() || "").toLowerCase();
    if (!permitidos.includes(ext)) {
      mostrarMensaje(`Este campo acepta solo: ${permitidos.join(", ")}`, { tipo: "aviso", titulo: "Formato no válido" });
      return;
    }
    const lista = new DataTransfer();
    lista.items.add(archivo);
    input.files = lista.files;
    window.handleFileUpload(input, id);
  });
  // Un clic en la zona (fuera del botón) también abre el selector de archivos
  zona.addEventListener("click", (e) => {
    if (!e.target.closest("button")) input.click();
  });
});

// Zona de anexos: acepta varios archivos a la vez
(() => {
  const zona = document.getElementById("annexDoc-zone");
  const input = document.getElementById("annexDoc");
  if (!zona || !input) return;
  ["dragenter", "dragover"].forEach((ev) =>
    zona.addEventListener(ev, (e) => {
      e.preventDefault();
      zona.classList.add("arrastrando");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    zona.addEventListener(ev, (e) => {
      e.preventDefault();
      zona.classList.remove("arrastrando");
    })
  );
  zona.addEventListener("drop", (e) => agregarAnexos(e.dataTransfer && e.dataTransfer.files));
  zona.addEventListener("click", (e) => {
    if (!e.target.closest("button")) input.click();
  });
})();

// Si se suelta un archivo fuera de la zona, el navegador no debe abrirlo y sacar a la persona de la página
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

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

/* ------------ Ventana de éxito: número de expediente y cargo en PDF ------------ */
let cargoActual = null; // { nombre, base64 } del último envío

function descargarArchivoBase64(nombre, base64, tipo = "application/pdf") {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

window.showSuccessModal = function showSuccessModal(resultado = {}, correo = "") {
  cargoActual = resultado.cargo || null;

  document.getElementById("successExpediente").textContent = resultado.expediente || "—";

  // Mensaje según lo que realmente pasó (sin prometer lo que no ocurrió)
  let mensaje;
  if (resultado.correoCiudadano && correo) {
    mensaje = `Te enviamos el cargo de recepción a ${correo}. Guarda este número para cualquier consulta.`;
  } else if (cargoActual) {
    mensaje = "No pudimos enviarte el correo, pero tu solicitud quedó registrada. Descarga tu cargo ahora; también lo tendrás en Mis Trámites.";
  } else {
    mensaje = "Tu solicitud quedó registrada con este número. No pudimos generar el cargo en este momento; guárdalo para cualquier consulta.";
  }
  document.getElementById("successMessage").textContent = mensaje;

  const btnCargo = document.getElementById("btnDescargarCargo");
  if (btnCargo) btnCargo.style.display = cargoActual ? "inline-flex" : "none";

  document.getElementById("successModal").style.display = "flex";
  (cargoActual ? btnCargo : document.getElementById("btnIrTramites"))?.focus();
};

window.descargarCargoActual = function descargarCargoActual() {
  if (cargoActual) descargarArchivoBase64(cargoActual.nombre, cargoActual.base64);
};

window.copiarExpediente = async function copiarExpediente() {
  const texto = document.getElementById("successExpediente").textContent;
  const btn = document.getElementById("btnCopiarExpediente");
  try {
    await navigator.clipboard.writeText(texto);
    btn.classList.add("copiado");
    btn.title = "¡Copiado!";
    setTimeout(() => { btn.classList.remove("copiado"); btn.title = "Copiar número"; }, 1800);
  } catch {
    mostrarMensaje("No se pudo copiar. Selecciona el número y cópialo manualmente.", { tipo: "aviso", titulo: "No se pudo copiar" });
  }
};

window.irAMisTramites = function irAMisTramites() {
  // La lista guardada en la pestaña no incluye el trámite nuevo: se descarta para que se vuelva a leer
  Object.keys(sessionStorage).filter((k) => k.startsWith("tramites:")).forEach((k) => sessionStorage.removeItem(k));
  window.location.href = "procedure.html";
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

    // 3) Subir los archivos a la carpeta del usuario
    if (!mainFile) throw new Error("falta-principal");
    const basePath = `ficha-solicitudes/${user.uid}/${Date.now()}`;

    const mainSnap = await uploadBytes(
      ref(storage, `${basePath}/principal_${mainFile.name}`),
      mainFile,
      { contentType: mainFile.type || "application/pdf" }
    );
    const anexosSubidos = await Promise.all(
      anexos.map((f, i) =>
        uploadBytes(
          ref(storage, `${basePath}/anexo${i + 1}_${f.name}`),
          f,
          { contentType: f.type || "application/octet-stream" }
        )
      )
    );

    // 4) Registrar en el servidor: asigna el número de expediente, verifica los archivos,
    //    genera el cargo en PDF y envía los correos. El navegador ya no escribe en la base de datos.
    await user.getIdToken(true); // token nuevo, con la contraseña recién confirmada
    const registrarSolicitud = httpsCallable(functions, "registrarSolicitud");
    const { data: resultado } = await registrarSolicitud({
      tipoDocumento,
      subDocumento,
      asunto,
      principal: { path: mainSnap.metadata.fullPath },
      anexos: anexosSubidos.map((s) => ({ path: s.metadata.fullPath })),
      autorizacionCorreo: document.getElementById("emailNotification").checked,
      terminosAceptados: document.getElementById("acceptTerms").checked,
    });

    // 5) Cerrar y mostrar el número de expediente
    document.getElementById("confirmPassword").value = "";
    closeModal("confirmModal");
    showSuccessModal(resultado, user.email);

  } catch (err) {
    const codigo = String(err?.code || "");
    if (codigo === "auth/invalid-credential" || codigo === "auth/wrong-password") {
      mostrarMensaje("Contraseña incorrecta.", { tipo: "error", titulo: "Contraseña incorrecta" });
    } else if (err?.message === "need-password") {
      mostrarMensaje("Ingresa tu contraseña para confirmar.", { tipo: "aviso", titulo: "Falta la contraseña" });
    } else if (codigo === "auth/too-many-requests") {
      mostrarMensaje("Demasiados intentos con contraseña incorrecta. Espera unos minutos e inténtalo de nuevo.", { tipo: "aviso", titulo: "Demasiados intentos" });
    } else if (codigo === "functions/resource-exhausted") {
      mostrarMensaje("Hiciste demasiados envíos seguidos. Inténtalo de nuevo más tarde.", { tipo: "aviso", titulo: "Límite de envíos" });
    } else if (codigo === "functions/invalid-argument" || codigo === "functions/failed-precondition") {
      // El servidor explica qué falta o qué está mal (archivo inválido, asunto, etc.)
      const detalle = String(err.message || "").replace(/^reauth-required:\s*/, "");
      mostrarMensaje(detalle || "Revisa los datos e inténtalo nuevamente.", { tipo: "aviso", titulo: "Revisa los datos" });
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
