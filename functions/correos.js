// functions/correos.js
// Plantillas HTML de los correos. Todo lo que escribe una persona pasa por escapeHtml().
const solicitudes = require("./solicitud");

const SITIO = "https://mesa-de-partes-5c6c2.web.app";
const CONTACTO = "Central Telefónica: (01) 999-9999 · WhatsApp: 999 999 999";

const HTML_ESCAPES = {"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"};

function escapeHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// Para cabeceras (asunto del correo): sin saltos de línea.
function oneLine(valor) {
  return String(valor ?? "").replace(/[\r\n]+/g, " ").trim();
}

// Texto con saltos de línea a HTML (ya escapado).
function textoHtml(valor) {
  return escapeHtml(valor).replace(/\n/g, "<br>");
}

const COLOR_ESTADO = {
  "Recibido": "#3E5A78",
  "En revisión": "#002B4E",
  "Observado": "#B58900",
  "Atendido": "#16A34A",
  "Rechazado": "#DC2626",
};

function marco(contenido) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111827">
    <div style="background:#002B4E;color:#fff;padding:18px 22px;border-bottom:4px solid #F2B705">
      <div style="font-size:18px;font-weight:bold">Mesa de Partes Virtual</div>
      <div style="font-size:12px;opacity:.8">CJN</div>
    </div>
    <div style="padding:22px;border:1px solid #e5e8ec;border-top:0">${contenido}</div>
    <div style="padding:12px 22px;font-size:12px;color:#6b7280">${escapeHtml(CONTACTO)}</div>
  </div>`;
}

function fila(rotulo, valor) {
  return `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${escapeHtml(rotulo)}</td>` +
    `<td style="padding:6px 0;font-weight:bold">${escapeHtml(valor)}</td></tr>`;
}

function cajaExpediente(expediente) {
  return `
    <div style="background:#f1f3f5;border-left:4px solid #F2B705;padding:14px 18px;margin:0 0 16px">
      <div style="font-size:12px;color:#6b7280">N.° DE EXPEDIENTE</div>
      <div style="font-size:26px;font-weight:bold;color:#002B4E">${escapeHtml(expediente)}</div>
    </div>`;
}

function etiquetaEstado(estado) {
  const color = COLOR_ESTADO[estado] || "#3E5A78";
  return `<span style="display:inline-block;background:${color};color:#fff;font-weight:bold;font-size:13px;` +
    `padding:4px 12px;border-radius:999px">${escapeHtml(estado)}</span>`;
}

function botonEnlace(texto, url) {
  return `<p style="margin:18px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#002B4E;` +
    `color:#fff;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:8px">${escapeHtml(texto)}</a></p>`;
}

// Enlaces de descarga de los documentos que la Mesa de Partes entrega al ciudadano.
function listaEnlaces(archivos) {
  return archivos.map((a) =>
    `<li><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.name)}</a> ` +
    `(${escapeHtml(solicitudes.tamanoLegible(a.size))})</li>`,
  ).join("");
}

// Los avisos al encargado no llevan los archivos: se ven en la bandeja, que guarda el historial.
function textoArchivos(n, adjetivo = "adjunto") {
  const plural = n === 1 ? "" : "s";
  return `<strong>${n}</strong> archivo${plural} ${adjetivo}${plural}.`;
}

// Todos los anexos de una solicitud (las anteriores a los anexos múltiples tienen uno solo en "anexo").
function anexosDe(fila) {
  const d = fila.documentos || {};
  if (Array.isArray(d.anexos)) return d.anexos;
  return d.anexo ? [d.anexo] : [];
}

function tipoTexto(f) {
  return `${f.tipoDocumento} (${f.subDocumento})`.toUpperCase();
}

/* ------------------------------ Plantillas ------------------------------ */

// Al ciudadano, cuando recibe su solicitud (con el cargo adjunto).
function correoCiudadano(f, fechaHora) {
  return marco(`
    <p style="margin:0 0 14px">Hola ${escapeHtml(f.remitente.nombres || "")},</p>
    <p style="margin:0 0 14px">Recibimos tu solicitud. Conserva este número para cualquier consulta:</p>
    ${cajaExpediente(f.expediente)}
    <table style="border-collapse:collapse;font-size:14px;margin:0 0 16px">
      ${fila("Fecha y hora", `${fechaHora} (hora de Lima)`)}
      ${fila("Tipo", tipoTexto(f))}
      ${fila("Asunto", f.asunto)}
    </table>
    <p style="margin:0">Adjuntamos tu <strong>cargo de recepción</strong> en PDF. También podrás
    descargarlo y seguir el estado desde <em>Mis Trámites</em>.</p>
    ${botonEnlace("Ver mis trámites", `${SITIO}/procedure.html`)}`);
}

// Al encargado, cuando entra una solicitud nueva.
function correoEncargado(f, fechaHora) {
  return marco(`
    <h3 style="margin:0 0 12px;color:#002B4E">Nueva solicitud ${escapeHtml(f.expediente)}</h3>
    <table style="border-collapse:collapse;font-size:14px;margin:0 0 14px">
      ${fila("Fecha y hora", `${fechaHora} (hora de Lima)`)}
      ${fila("Remitente", f.remitente.nombres)}
      ${fila("DNI", f.remitente.dni)}
      ${fila("Correo", f.remitente.correo)}
      ${fila("Tipo", tipoTexto(f))}
      ${fila("Asunto", f.asunto)}
    </table>
    <p style="margin:0">${textoArchivos(1 + anexosDe(f).length)} Los archivos se revisan desde la bandeja.</p>
    ${botonEnlace("Abrir la bandeja", `${SITIO}/bandeja.html`)}`);
}

// Al ciudadano, cuando el funcionario cambia el estado de su solicitud.
// `archivos`: PDF de la respuesta del funcionario. `adjuntos` indica si además van pegados al correo.
function correoCambioEstado(f, estado, mensaje, archivos = [], adjuntos = false) {
  const intro = {
    "En revisión": "Tu solicitud está siendo revisada.",
    "Observado": "Tu solicitud tiene una observación que debes atender.",
    "Atendido": "Tu solicitud fue atendida.",
    "Rechazado": "Tu solicitud fue rechazada.",
  }[estado] || "El estado de tu solicitud cambió.";
  const ayuda = estado === "Observado" ?
    "<p style=\"margin:16px 0 0\">Ingresa a <em>Mis Trámites</em>, abre el expediente y usa <strong>Subsanar</strong> " +
    "para adjuntar lo que falta. Mientras no la subsanes, el trámite no avanza.</p>" : "";
  const nombre = (f.remitente && f.remitente.nombres) || "";
  return marco(`
    <p style="margin:0 0 14px">Hola ${escapeHtml(nombre)},</p>
    <p style="margin:0 0 14px">${escapeHtml(intro)}</p>
    ${cajaExpediente(f.expediente)}
    <p style="margin:0 0 12px">Estado: ${etiquetaEstado(estado)}</p>
    ${mensaje ? `<div style="background:#f1f3f5;border-radius:8px;padding:12px 16px;font-size:14px">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Mensaje de la Mesa de Partes</div>${textoHtml(mensaje)}</div>` : ""}
    ${archivos.length ? `<p style="margin:16px 0 6px"><strong>Documentos de respuesta</strong>${adjuntos ? " (también van adjuntos a este correo)" : ""}</p>
    <ul style="margin:0;padding-left:20px;font-size:14px">${listaEnlaces(archivos)}</ul>` : ""}
    ${ayuda}
    ${botonEnlace("Abrir Mis Trámites", `${SITIO}/procedure.html`)}`);
}

// Al encargado, cuando el ciudadano presenta una subsanación.
function correoSubsanacion(f, comentario, archivos) {
  return marco(`
    <h3 style="margin:0 0 12px;color:#002B4E">Subsanación recibida · ${escapeHtml(f.expediente)}</h3>
    <table style="border-collapse:collapse;font-size:14px;margin:0 0 14px">
      ${fila("Remitente", (f.remitente && f.remitente.nombres) || "")}
      ${fila("Asunto", f.asunto)}
    </table>
    ${comentario ? `<div style="background:#f1f3f5;border-radius:8px;padding:12px 16px;font-size:14px;margin:0 0 14px">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Comentario del ciudadano</div>${textoHtml(comentario)}</div>` : ""}
    <p style="margin:0">${textoArchivos(archivos.filter(Boolean).length, "agregado")} Los archivos se revisan desde la bandeja.</p>
    <p style="margin:14px 0 0">La solicitud volvió al estado <strong>En revisión</strong>.</p>
    ${botonEnlace("Abrir la bandeja", `${SITIO}/bandeja.html`)}`);
}

// Al ciudadano, cuando la Mesa de Partes le escribe sin cambiar el estado.
function correoMensajeParaCiudadano(f, texto) {
  const nombre = (f.remitente && f.remitente.nombres) || "";
  return marco(`
    <p style="margin:0 0 14px">Hola ${escapeHtml(nombre)},</p>
    <p style="margin:0 0 14px">La Mesa de Partes te escribió sobre tu solicitud:</p>
    ${cajaExpediente(f.expediente)}
    <div style="background:#f1f3f5;border-radius:8px;padding:12px 16px;font-size:14px">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Mensaje de la Mesa de Partes</div>${textoHtml(texto)}</div>
    <p style="margin:16px 0 0">Puedes responder desde <em>Mis Trámites</em>, en el detalle del expediente.</p>
    ${botonEnlace("Abrir Mis Trámites", `${SITIO}/procedure.html`)}`);
}

// Al encargado, cuando el ciudadano escribe un mensaje.
function correoMensajeParaEncargado(f, texto) {
  return marco(`
    <h3 style="margin:0 0 12px;color:#002B4E">Mensaje del ciudadano · ${escapeHtml(f.expediente)}</h3>
    <table style="border-collapse:collapse;font-size:14px;margin:0 0 14px">
      ${fila("Remitente", (f.remitente && f.remitente.nombres) || "")}
      ${fila("Asunto", f.asunto)}
    </table>
    <div style="background:#f1f3f5;border-radius:8px;padding:12px 16px;font-size:14px">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Mensaje</div>${textoHtml(texto)}</div>
    ${botonEnlace("Abrir la bandeja", `${SITIO}/bandeja.html`)}`);
}

module.exports = {
  SITIO, escapeHtml, oneLine, textoHtml, anexosDe,
  correoCiudadano, correoEncargado, correoCambioEstado, correoSubsanacion,
  correoMensajeParaCiudadano, correoMensajeParaEncargado,
};
