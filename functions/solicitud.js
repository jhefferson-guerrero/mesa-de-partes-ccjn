// functions/solicitud.js
// Reglas puras (sin Firebase) para registrar una solicitud: validación de lo que envía el
// navegador, formato del número de expediente y comprobación de archivos. Se prueban aparte.
const {HttpsError} = require("firebase-functions/v2/https");

const TIPOS_DOCUMENTO = ["solicitud", "carta", "oficio", "informe"];
const SUBTIPOS = ["simple", "urgente", "confidencial"];
const MAX_ASUNTO = 200;
const MAX_COMENTARIO = 500;
const MAX_ANEXOS = 10;
const MAX_RESPUESTA = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const EXT_PRINCIPAL = ["pdf"];
const EXT_ANEXO = ["pdf", "doc", "docx", "xls", "xlsx"];
const ZONA = "America/Lima";

function invalido(mensaje) {
  return new HttpsError("invalid-argument", mensaje);
}

// Quita caracteres de control (deja saltos de línea y tabulaciones) y recorta espacios.
function limpiarTexto(valor) {
  return String(valor ?? "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/\r\n?/g, "\n")
      .trim();
}

function extension(nombre) {
  const i = String(nombre).lastIndexOf(".");
  return i < 0 ? "" : String(nombre).slice(i + 1).toLowerCase();
}

// Cómo se llama el archivo según su función dentro de la solicitud:
//   principal_{nombre}              documento principal (PDF)
//   anexo_{nombre} / anexo3_{nombre}  anexos (PDF, Word o Excel)
//   subsanacion17937..._{nombre}    archivos que el ciudadano agrega al subsanar una observación
const PATRON_ROL = {
  principal: "principal",
  anexo: "anexo[0-9]{0,2}",
  subsanacion: "subsanacion[0-9]{1,20}",
};

// Ruta esperada: ficha-solicitudes/{uid}/{carpeta}/{rol}_{nombre}
// Debe estar dentro de la carpeta del propio usuario y no puede salirse de ella.
function validarRuta(ruta, uid, rol) {
  const etiqueta = rol === "principal" ? "principal" : rol === "anexo" ? "anexo" : "adjunto";
  if (typeof ruta !== "string") throw invalido("Falta el archivo " + etiqueta + ".");
  const partes = ruta.split("/");
  const [raiz, dueno, carpeta, archivo] = partes;
  if (partes.length !== 4 || raiz !== "ficha-solicitudes" || dueno !== uid) {
    throw invalido("La ruta del archivo " + etiqueta + " no es válida.");
  }
  if (!/^\d{10,16}$/.test(carpeta)) {
    throw invalido("La ruta del archivo " + etiqueta + " no es válida.");
  }
  // eslint-disable-next-line no-control-regex
  const reArchivo = new RegExp("^(" + PATRON_ROL[rol] + ")_([^/\\\\\\u0000-\\u001F]{1,200})$");
  const m = reArchivo.exec(archivo);
  if (!m || archivo.includes("..")) {
    throw invalido("El nombre del archivo " + etiqueta + " no es válido.");
  }
  const nombre = m[2];
  const permitidas = rol === "principal" ? EXT_PRINCIPAL : EXT_ANEXO;
  if (!permitidas.includes(extension(nombre))) {
    throw invalido(
        rol === "principal" ?
        "El documento principal debe ser PDF." :
        "Los anexos deben ser PDF, Word o Excel.",
    );
  }
  return {path: ruta, carpeta, nombre};
}

// Lista de archivos {path} -> rutas validadas, sin repetidos y todos en la misma carpeta.
function validarLista(lista, uid, rol, carpetaEsperada) {
  if (lista === undefined || lista === null) return [];
  if (!Array.isArray(lista)) throw invalido("La lista de archivos no es válida.");
  if (lista.length > MAX_ANEXOS) {
    throw invalido(`Puedes adjuntar hasta ${MAX_ANEXOS} archivos.`);
  }
  const vistos = new Set();
  return lista.map((a) => {
    const r = validarRuta(a && a.path, uid, rol);
    if (carpetaEsperada && r.carpeta !== carpetaEsperada) {
      throw invalido("Los archivos no pertenecen a la misma solicitud.");
    }
    if (vistos.has(r.path)) throw invalido("Hay un archivo repetido.");
    vistos.add(r.path);
    return r;
  });
}

// Valida y normaliza todo lo que llega del navegador. Nada se toma sin comprobar.
function validarEntrada(data, uid) {
  const d = data || {};
  if (!TIPOS_DOCUMENTO.includes(d.tipoDocumento)) {
    throw invalido("El tipo de documento no es válido.");
  }
  if (!SUBTIPOS.includes(d.subDocumento)) {
    throw invalido("El tipo de sub documento no es válido.");
  }
  const asunto = limpiarTexto(d.asunto);
  if (!asunto) throw invalido("Debes completar el asunto del documento.");
  if (asunto.length > MAX_ASUNTO) {
    throw invalido(`El asunto no puede superar los ${MAX_ASUNTO} caracteres.`);
  }
  if (d.autorizacionCorreo !== true || d.terminosAceptados !== true) {
    throw invalido("Debes autorizar la notificación y aceptar los términos.");
  }

  const principal = validarRuta(d.principal && d.principal.path, uid, "principal");
  // "anexo" (uno solo) lo usaban las páginas anteriores; se sigue aceptando.
  const lista = d.anexos !== undefined ? d.anexos : (d.anexo && d.anexo.path ? [d.anexo] : []);
  const anexos = validarLista(lista, uid, "anexo", principal.carpeta);
  if (anexos.some((a) => a.path === principal.path)) throw invalido("Hay un archivo repetido.");

  return {
    tipoDocumento: d.tipoDocumento,
    subDocumento: d.subDocumento,
    asunto,
    carpeta: principal.carpeta,
    principal,
    anexos,
  };
}

// Subsanación: el ciudadano agrega archivos (y un comentario) a una solicitud observada.
function validarSubsanacion(data, uid) {
  const d = data || {};
  const solicitudId = String(d.solicitudId || "");
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(solicitudId)) throw invalido("Solicitud no válida.");
  const comentario = limpiarTexto(d.comentario);
  if (comentario.length > MAX_COMENTARIO) {
    throw invalido(`El comentario no puede superar los ${MAX_COMENTARIO} caracteres.`);
  }
  const archivos = validarLista(d.archivos, uid, "subsanacion", null);
  if (archivos.length === 0) throw invalido("Adjunta al menos un archivo para subsanar.");
  const carpetas = new Set(archivos.map((a) => a.carpeta));
  if (carpetas.size !== 1) throw invalido("Los archivos no pertenecen a la misma solicitud.");
  return {solicitudId, comentario, archivos, carpeta: archivos[0].carpeta};
}

// Respuesta del funcionario: PDF que sube a su propia carpeta de paso (respuestas/{su uid}/{solicitud}/...)
// y que el servidor revisa antes de ponerlos en el expediente del ciudadano.
//   respuestas/{uid del funcionario}/{id de la solicitud}/respuesta{número}_{nombre}.pdf
function validarArchivosRespuesta(lista, uid, solicitudId) {
  if (lista === undefined || lista === null) return [];
  if (!Array.isArray(lista)) throw invalido("La lista de archivos no es válida.");
  if (lista.length > MAX_RESPUESTA) throw invalido(`Puedes adjuntar hasta ${MAX_RESPUESTA} archivos en la respuesta.`);
  const vistos = new Set();
  return lista.map((a) => {
    const ruta = a && a.path;
    if (typeof ruta !== "string") throw invalido("Falta un archivo de la respuesta.");
    const partes = ruta.split("/");
    if (partes.length !== 4 || partes[0] !== "respuestas" || partes[1] !== uid || partes[2] !== solicitudId) {
      throw invalido("La ruta de un archivo de la respuesta no es válida.");
    }
    // eslint-disable-next-line no-control-regex
    const m = /^respuesta[0-9]{1,20}_([^/\\\u0000-\u001F]{1,200})$/.exec(partes[3]);
    if (!m || partes[3].includes("..")) throw invalido("El nombre de un archivo de la respuesta no es válido.");
    if (extension(m[1]) !== "pdf") throw invalido("Los archivos de la respuesta deben ser PDF.");
    if (vistos.has(ruta)) throw invalido("Hay un archivo repetido.");
    vistos.add(ruta);
    return {path: ruta, nombre: m[1]};
  });
}

// Año y fecha en hora de Lima (el contador de expedientes se reinicia cada año en esa zona).
function partesEnLima(fecha = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  const p = {};
  f.formatToParts(fecha).forEach((x) => {
    p[x.type] = x.value;
  });
  return p;
}

function anioEnLima(fecha = new Date()) {
  return Number(partesEnLima(fecha).year);
}

// "04/11/2026 10:15:32"
function fechaHoraLima(fecha = new Date()) {
  const p = partesEnLima(fecha);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

// 2026 + 123 -> "2026-000123"
function formatearExpediente(anio, numero) {
  return `${anio}-${String(numero).padStart(6, "0")}`;
}

// Un mismo envío (misma carpeta) siempre da el mismo id: si el navegador reintenta, no se duplica.
function idSolicitud(uid, carpeta) {
  return `${uid}_${carpeta}`;
}

// Comprueba que el contenido real del archivo coincide con su extensión (no basta con el nombre).
function firmaValida(ext, cabecera) {
  const b = Buffer.from(cabecera);
  if (ext === "pdf") return b.subarray(0, 5).toString("latin1") === "%PDF-";
  if (ext === "docx" || ext === "xlsx") {
    return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04;
  }
  if (ext === "doc" || ext === "xls") {
    const ole = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    return b.length >= 8 && ole.every((v, i) => b[i] === v);
  }
  return false;
}

function tamanoLegible(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

module.exports = {
  TIPOS_DOCUMENTO, SUBTIPOS, MAX_ASUNTO, MAX_COMENTARIO, MAX_ANEXOS, MAX_RESPUESTA, MAX_BYTES, EXT_ANEXO, EXT_PRINCIPAL,
  validarEntrada, validarSubsanacion, validarArchivosRespuesta, validarRuta, limpiarTexto, extension,
  anioEnLima, fechaHoraLima, formatearExpediente, idSolicitud, firmaValida, tamanoLegible,
};
