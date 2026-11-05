// functions/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const solicitudes = require("./solicitud");
const { generarCargoPdf } = require("./cargo");
const correos = require("./correos");
const estados = require("./estados");
const { escapeHtml, oneLine } = correos;

initializeApp();

// Variables de entorno (archivo functions/.env, ver functions/.env.example)
//   SMTP_HOST, SMTP_PORT        : servidor SMTP (por defecto smtp.gmail.com:587)
//   SMTP_USER, SMTP_PASS        : cuenta y contraseña (de aplicación, en Gmail)
//   MAIL_FROM                   : remitente (en Gmail, la misma cuenta SMTP_USER)
//   MAIL_TO                     : correo del encargado que recibe las solicitudes
//   MIAPI_TOKEN                 : token de miapi.cloud (consulta de DNI)

// Límite de envíos por usuario para evitar abuso (cuenta demo, bucles, etc.)
const RATE_LIMIT = {max: 10, windowMs: 60 * 60 * 1000};

const REGION = "us-central1";
const ALLOWED_ORIGINS = [
  "https://mesa-de-partes-5c6c2.web.app",
  "https://mesa-de-partes-5c6c2.firebaseapp.com",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
];

const PROJECT_ID = process.env.GCLOUD_PROJECT || "mesa-de-partes-5c6c2";
const ALLOWED_BUCKETS = [
  `${PROJECT_ID}.firebasestorage.app`,
  `${PROJECT_ID}.appspot.com`,
];

/* ------------------------- Utilidades ------------------------- */

// Exige sesión iniciada con correo verificado y devuelve el uid.
function requireVerifiedUser(request) {
  const token = request.auth && request.auth.token;
  if (!token || token.email_verified !== true) {
    throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión con un correo verificado.",
    );
  }
  return request.auth.uid;
}

// Solo se aceptan enlaces de Firebase Storage del propio proyecto
// y dentro de la carpeta del usuario.
function isOwnStorageUrl(rawUrl, uid) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    if (url.hostname !== "firebasestorage.googleapis.com") return false;
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!match || !ALLOWED_BUCKETS.includes(match[1])) return false;
    return decodeURIComponent(match[2]).startsWith(`ficha-solicitudes/${uid}/`);
  } catch (err) {
    return false;
  }
}

let transporter = null;
function getTransporter() {
  const {SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO} = process.env;
  if (!SMTP_USER || !SMTP_PASS || !MAIL_FROM || !MAIL_TO) {
    logger.error(
        "Faltan variables de entorno: SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO",
    );
    throw new HttpsError(
        "failed-precondition",
        "El envío de correo no está configurado.",
    );
  }
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: {user: SMTP_USER, pass: SMTP_PASS},
    });
  }
  return transporter;
}

/* ------------------- enviarSolicitud (callable) ------------------- */
// El cliente solo envía el id de la solicitud que acaba de crear.
// Todo el contenido del correo se lee del servidor, no del cliente.
exports.enviarSolicitud = onCall(
    {region: REGION, timeoutSeconds: 60, cors: ALLOWED_ORIGINS},
    async (request) => {
      const uid = requireVerifiedUser(request);

      const solicitudId = String((request.data || {}).solicitudId || "");
      if (!/^[A-Za-z0-9]{20}$/.test(solicitudId)) {
        throw new HttpsError("invalid-argument", "Solicitud no válida.");
      }

      const db = getFirestore();
      const solicitudRef = db.collection("ficha-solicitud").doc(solicitudId);
      const limiteRef = db.collection("limites").doc(uid);

      // Reserva la solicitud (evita duplicados) y aplica el límite por usuario.
      const ficha = await db.runTransaction(async (tx) => {
        const snap = await tx.get(solicitudRef);
        if (!snap.exists || snap.data().userId !== uid) {
          throw new HttpsError("permission-denied", "Solicitud no encontrada.");
        }
        if (snap.data().correoEnviado) {
          throw new HttpsError("already-exists", "Esta solicitud ya fue notificada.");
        }

        const limSnap = await tx.get(limiteRef);
        const lim = limSnap.exists ? limSnap.data() : {};
        const ahora = Date.now();
        const enVentana = lim.inicio && ahora - lim.inicio < RATE_LIMIT.windowMs;
        const cuenta = enVentana ? lim.count : 0;
        if (cuenta >= RATE_LIMIT.max) {
          throw new HttpsError(
              "resource-exhausted",
              "Demasiados envíos seguidos. Inténtalo más tarde.",
          );
        }

        tx.set(limiteRef, {inicio: enVentana ? lim.inicio : ahora, count: cuenta + 1});
        tx.update(solicitudRef, {correoEnviado: true});
        return snap.data();
      });

      try {
        const userSnap = await db.collection("usuarios").doc(uid).get();
        const u = userSnap.exists ? userSnap.data() : {};
        const nombres = [u.apellidoPaterno, u.apellidoMaterno, u.nombres]
            .filter(Boolean).join(" ") || "(sin nombre)";

        const archivos = [ficha.documentos && ficha.documentos.principal,
          ficha.documentos && ficha.documentos.anexo]
            .filter((d) => d && isOwnStorageUrl(d.url, uid));

        const listaArchivosHTML = archivos.length > 0 ?
          archivos.map((a) =>
            `<li><a href="${escapeHtml(a.url)}" target="_blank" ` +
            `rel="noopener noreferrer">${escapeHtml(a.name || "archivo")}</a></li>`,
          ).join("") :
          "<li>— sin archivos —</li>";

        await getTransporter().sendMail({
          from: process.env.MAIL_FROM,
          to: process.env.MAIL_TO,
          subject: oneLine(`Nueva solicitud de ${nombres}`),
          html: `
            <h3>Datos del remitente</h3>
            <p><strong>Nombre:</strong> ${escapeHtml(nombres)}</p>
            <p><strong>DNI:</strong> ${escapeHtml(u.dni || "")}</p>
            <p><strong>Correo:</strong> ${escapeHtml(u.correo || ficha.correo)}</p>

            <h3>Solicitud</h3>
            <p><strong>Tipo:</strong> ${escapeHtml(ficha.tipoDocumento)}
               (${escapeHtml(ficha.subDocumento)})</p>
            <p><strong>Asunto:</strong> ${escapeHtml(ficha.asunto)}</p>

            <h3>Archivos</h3>
            <ul>${listaArchivosHTML}</ul>
          `,
        });

        await solicitudRef.update({correoEnviadoEn: FieldValue.serverTimestamp()});
        logger.info("Correo enviado al encargado.", {solicitudId});
        return {success: true, message: "Correo enviado correctamente"};
      } catch (err) {
        // Libera la reserva para poder reintentar.
        await solicitudRef.update({correoEnviado: false}).catch(() => {});
        if (err instanceof HttpsError) throw err;
        logger.error("Error enviando correo:", err);
        throw new HttpsError("internal", "send-email-failed");
      }
    },
);

/* ------------------ registrarSolicitud (callable) ------------------ */
// Registra la solicitud en el servidor (el navegador ya no escribe en Firestore):
//   1. valida todo lo que llega y comprueba los archivos subidos (existen, son del usuario, su contenido
//      coincide con su tipo y se calcula su huella SHA-256),
//   2. asigna el número de expediente (año-correlativo) dentro de una transacción,
//   3. genera el cargo de recepción en PDF y lo guarda junto a los archivos,
//   4. envía el cargo por correo al ciudadano y avisa al encargado.
// Si el navegador reintenta el mismo envío, devuelve el mismo expediente (no se duplica).

const BUCKET = ALLOWED_BUCKETS[0];
// La contraseña se pide justo antes de enviar: el servidor exige que esa confirmación sea reciente.
const AUTENTICACION_MAX_SEG = 10 * 60;

function requireAutenticacionReciente(request) {
  const authTime = request.auth && request.auth.token && request.auth.token.auth_time;
  if (typeof authTime === "number" && Date.now() / 1000 - authTime > AUTENTICACION_MAX_SEG) {
    throw new HttpsError(
        "failed-precondition",
        "reauth-required: Confirma tu contraseña nuevamente para enviar.",
    );
  }
}

function urlConToken(bucketName, ruta, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/` +
    `${encodeURIComponent(ruta)}?alt=media&token=${token}`;
}

// Comprueba un archivo ya subido a Storage y devuelve sus datos verificados por el servidor.
async function inspeccionarArchivo(bucket, info, rol) {
  const file = bucket.file(info.path);
  const [existe] = await file.exists();
  if (!existe) {
    throw new HttpsError(
        "failed-precondition",
        `No se encontró el archivo ${rol}. Vuelve a adjuntarlo e inténtalo de nuevo.`,
    );
  }
  const [meta] = await file.getMetadata();
  const size = Number(meta.size);
  if (!size) throw new HttpsError("invalid-argument", `El archivo ${rol} está vacío.`);
  if (size > solicitudes.MAX_BYTES) {
    throw new HttpsError("invalid-argument", `El archivo ${rol} supera los 10 MB.`);
  }

  // El contenido real debe coincidir con la extensión (no basta con el nombre).
  const ext = solicitudes.extension(info.nombre);
  const [cabecera] = await file.download({start: 0, end: 7});
  if (!solicitudes.firmaValida(ext, cabecera)) {
    throw new HttpsError(
        "invalid-argument",
        `El archivo ${rol} no es un ${ext.toUpperCase()} válido.`,
    );
  }

  // Huella SHA-256 del contenido (por streaming, sin cargar todo en memoria).
  const sha256 = await new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    file.createReadStream()
        .on("data", (parte) => hash.update(parte))
        .on("end", () => resolve(hash.digest("hex")))
        .on("error", reject);
  });

  let token = String((meta.metadata && meta.metadata.firebaseStorageDownloadTokens) || "")
      .split(",")[0];
  if (!token) {
    token = crypto.randomUUID();
    await file.setMetadata({metadata: {firebaseStorageDownloadTokens: token}});
  }

  return {
    name: info.nombre,
    contentType: meta.contentType || "application/octet-stream",
    size,
    path: info.path,
    url: urlConToken(bucket.name, info.path, token),
    sha256,
  };
}

function datosCargo(fila, fechaHora) {
  const d = fila.documentos || {};
  const archivo = (rol, a) => ({
    rol, nombre: a.name, tamano: solicitudes.tamanoLegible(a.size), sha256: a.sha256,
  });
  return {
    expediente: fila.expediente,
    fechaHora,
    estado: fila.estado,
    remitente: fila.remitente,
    tipoDocumento: fila.tipoDocumento,
    subDocumento: fila.subDocumento,
    asunto: fila.asunto,
    archivos: [
      d.principal && archivo("principal", d.principal),
      ...correos.anexosDe(fila).map((a) => archivo("anexo", a)),
    ].filter(Boolean),
  };
}

// Envía un correo sin hacer fallar la operación: la solicitud ya existe y el correo es un aviso.
async function enviarCorreo(mensaje, contexto) {
  try {
    await getTransporter().sendMail({from: process.env.MAIL_FROM, ...mensaje});
    return true;
  } catch (err) {
    logger.error("No se pudo enviar el correo.", {...contexto, mensaje: err.message});
    return false;
  }
}

// Límite de envíos por usuario y por hora. Devuelve el nuevo estado del contador o lanza el error.
function aplicarLimite(limiteSnap, ahoraMs, max = RATE_LIMIT.max) {
  const lim = limiteSnap.exists ? limiteSnap.data() : {};
  const enVentana = lim.inicio && ahoraMs - lim.inicio < RATE_LIMIT.windowMs;
  const cuenta = enVentana ? lim.count : 0;
  if (cuenta >= max) {
    throw new HttpsError("resource-exhausted", "Demasiados envíos seguidos. Inténtalo más tarde.");
  }
  return {inicio: enVentana ? lim.inicio : ahoraMs, count: cuenta + 1};
}

async function leerCargoGuardado(bucket, fila) {
  if (!fila.cargo || !fila.cargo.path) return null;
  try {
    const [contenido] = await bucket.file(fila.cargo.path).download();
    return {nombre: fila.cargo.name, base64: contenido.toString("base64")};
  } catch (err) {
    logger.warn("No se pudo leer el cargo guardado.", {path: fila.cargo.path});
    return null;
  }
}

async function respuestaDeSolicitudExistente(bucket, fila, uid) {
  if (fila.userId !== uid) {
    throw new HttpsError("permission-denied", "Solicitud no encontrada.");
  }
  return {
    ok: true,
    yaRegistrada: true,
    expediente: fila.expediente,
    fechaHora: solicitudes.fechaHoraLima(fila.creadoEn && fila.creadoEn.toDate ? fila.creadoEn.toDate() : new Date()),
    cargo: await leerCargoGuardado(bucket, fila),
    correoCiudadano: Boolean(fila.correoCiudadanoEnviado),
  };
}

exports.registrarSolicitud = onCall(
    {region: REGION, timeoutSeconds: 120, memory: "512MiB", cors: ALLOWED_ORIGINS},
    async (request) => {
      const uid = requireVerifiedUser(request);
      requireAutenticacionReciente(request);
      const entrada = solicitudes.validarEntrada(request.data, uid);

      const db = getFirestore();
      const bucket = getStorage().bucket(BUCKET);
      const solicitudRef = db.collection("ficha-solicitud")
          .doc(solicitudes.idSolicitud(uid, entrada.carpeta));

      // Mismo envío repetido (doble clic, reintento de red): se devuelve el mismo expediente.
      const previa = await solicitudRef.get();
      if (previa.exists) return respuestaDeSolicitudExistente(bucket, previa.data(), uid);

      // Datos del remitente tal como están hoy (quedan guardados con la solicitud).
      const userSnap = await db.collection("usuarios").doc(uid).get();
      const u = userSnap.exists ? userSnap.data() : {};
      const remitente = {
        nombres: [u.apellidoPaterno, u.apellidoMaterno, u.nombres].filter(Boolean).join(" ") || "(sin nombre)",
        dni: u.dni || "",
        correo: request.auth.token.email,
      };

      // Archivos verificados por el servidor.
      const principal = await inspeccionarArchivo(bucket, entrada.principal, "principal");
      const anexos = await Promise.all(
          entrada.anexos.map((a, i) => inspeccionarArchivo(bucket, a, `anexo ${i + 1}`)),
      );

      const ahora = new Date();
      const anio = solicitudes.anioEnLima(ahora);
      const contadorRef = db.collection("contadores").doc(String(anio));
      const limiteRef = db.collection("limites").doc(uid);

      // Número de expediente + límite por usuario, todo en una transacción.
      const registro = await db.runTransaction(async (tx) => {
        const [existente, contador, limite] = await Promise.all([
          tx.get(solicitudRef), tx.get(contadorRef), tx.get(limiteRef),
        ]);
        if (existente.exists) return {yaExistia: true, fila: existente.data()};

        const nuevoLimite = aplicarLimite(limite, ahora.getTime());
        const numero = (contador.exists ? contador.data().ultimo : 0) + 1;
        const expediente = solicitudes.formatearExpediente(anio, numero);
        const marca = Timestamp.fromDate(ahora);
        const fila = {
          userId: uid,
          correo: remitente.correo,
          expediente,
          anio,
          numero,
          estado: "Recibido",
          historial: [{estado: "Recibido", fecha: marca, por: "Sistema"}],
          remitente,
          tipoDocumento: entrada.tipoDocumento,
          subDocumento: entrada.subDocumento,
          asunto: entrada.asunto,
          carpeta: entrada.carpeta,
          documentos: {principal, anexos},
          autorizacionCorreo: true,
          terminosAceptados: true,
          firma: {metodo: "contraseña", authTime: request.auth.token.auth_time || null},
          creadoEn: marca,
          correoEnviado: false,
          correoCiudadanoEnviado: false,
        };
        tx.set(contadorRef, {ultimo: numero});
        tx.set(limiteRef, nuevoLimite);
        tx.set(solicitudRef, fila);
        return {yaExistia: false, fila};
      });

      if (registro.yaExistia) return respuestaDeSolicitudExistente(bucket, registro.fila, uid);
      const fila = registro.fila;
      const fechaHora = solicitudes.fechaHoraLima(ahora);

      // Cargo de recepción (PDF). Si falla, la solicitud igual queda registrada.
      let cargoPdf = null;
      let cargo = null;
      try {
        cargoPdf = await generarCargoPdf(datosCargo(fila, fechaHora));
        const ruta = `ficha-solicitudes/${uid}/${entrada.carpeta}/cargo_${fila.expediente}.pdf`;
        const token = crypto.randomUUID();
        await bucket.file(ruta).save(cargoPdf, {
          contentType: "application/pdf",
          metadata: {metadata: {firebaseStorageDownloadTokens: token}},
        });
        cargo = {path: ruta, url: urlConToken(bucket.name, ruta, token), name: `Cargo-${fila.expediente}.pdf`};
        await solicitudRef.update({cargo});
      } catch (err) {
        logger.error("No se pudo generar o guardar el cargo.", {expediente: fila.expediente, mensaje: err.message});
        cargoPdf = null;
        cargo = null;
      }

      // Correos: el cargo al ciudadano y el aviso al encargado.
      const adjuntos = cargoPdf ? [{
        filename: `Cargo-${fila.expediente}.pdf`, content: cargoPdf, contentType: "application/pdf",
      }] : [];
      const [correoCiudadano, correoEncargado] = await Promise.all([
        enviarCorreo({
          to: fila.remitente.correo,
          subject: oneLine(`Cargo de recepción - Expediente ${fila.expediente}`),
          html: correos.correoCiudadano(fila, fechaHora),
          attachments: adjuntos,
        }, {expediente: fila.expediente, para: "ciudadano"}),
        enviarCorreo({
          to: process.env.MAIL_TO,
          subject: oneLine(`Nueva solicitud ${fila.expediente} de ${fila.remitente.nombres}`),
          html: correos.correoEncargado(fila, fechaHora),
        }, {expediente: fila.expediente, para: "encargado"}),
      ]);
      await solicitudRef.update({
        correoEnviado: correoEncargado,
        correoCiudadanoEnviado: correoCiudadano,
        correoEnviadoEn: FieldValue.serverTimestamp(),
      }).catch((err) => logger.warn("No se pudo guardar el estado de los correos.", {mensaje: err.message}));

      logger.info("Solicitud registrada.", {expediente: fila.expediente, uid});
      return {
        ok: true,
        yaRegistrada: false,
        expediente: fila.expediente,
        fechaHora,
        cargo: cargoPdf ? {nombre: cargo.name, base64: cargoPdf.toString("base64")} : null,
        correoCiudadano,
      };
    },
);

/* ------------------------- Utilidades de seguimiento ------------------------- */

// Quién es funcionario: los correos de FUNCIONARIOS (separados por coma) o, si no se define,
// el correo del encargado (MAIL_TO). Debe ser una cuenta con el correo verificado.
function listaFuncionarios() {
  const crudo = process.env.FUNCIONARIOS || process.env.MAIL_TO || "";
  return crudo.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function esFuncionario(request) {
  const t = request.auth && request.auth.token;
  return Boolean(t) && t.email_verified === true &&
    listaFuncionarios().includes(String(t.email || "").toLowerCase());
}

function requireFuncionario(request) {
  const uid = requireVerifiedUser(request);
  if (!esFuncionario(request)) {
    throw new HttpsError("permission-denied", "No tienes acceso a la bandeja.");
  }
  return uid;
}

// Timestamp de Firestore -> milisegundos (para enviarlo al navegador).
function serializar(valor) {
  if (valor === null || valor === undefined) return valor;
  if (typeof valor.toMillis === "function") return valor.toMillis();
  if (Array.isArray(valor)) return valor.map(serializar);
  if (typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, serializar(v)]));
  }
  return valor;
}

// Las solicitudes anteriores a los expedientes numerados no tienen "carpeta": se saca de la ruta del archivo.
function carpetaDe(fila) {
  if (fila.carpeta) return String(fila.carpeta);
  const p = fila.documentos && fila.documentos.principal && fila.documentos.principal.path;
  return p ? String(p).split("/")[2] || "" : "";
}

function normalizarTexto(valor) {
  return String(valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function resumenDe(id, fila) {
  const d = fila.documentos || {};
  const extra = (fila.subsanaciones || []).reduce((n, s) => n + ((s.archivos || []).length), 0);
  const r = fila.remitente || {};
  return {
    id,
    expediente: fila.expediente || carpetaDe(fila) || "—",
    creadoEn: fila.creadoEn && fila.creadoEn.toMillis ? fila.creadoEn.toMillis() : 0,
    estado: estados.estadoDe(fila),
    nombres: r.nombres || "",
    dni: r.dni || "",
    correo: r.correo || fila.correo || "",
    tipo: fila.tipoDocumento || "",
    subTipo: fila.subDocumento || "",
    asunto: String(fila.asunto || "").slice(0, 160),
    archivos: (d.principal ? 1 : 0) + correos.anexosDe(fila).length + extra,
    // El último mensaje es del ciudadano: la mesa de partes todavía no le respondió.
    mensajePendiente: Array.isArray(fila.mensajes) && fila.mensajes.length > 0 &&
      fila.mensajes[fila.mensajes.length - 1].de === "Ciudadano" && !estados.FINALES.includes(estados.estadoDe(fila)),
  };
}

const MAX_BANDEJA = 1000; // solicitudes más recientes que se consultan por vez
const MAX_FILAS_BANDEJA = 500; // filas que se devuelven al navegador

function idValido(valor) {
  const id = String(valor || "");
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(id)) {
    throw new HttpsError("invalid-argument", "Solicitud no válida.");
  }
  return id;
}

/* ------------------------- miRol (callable) ------------------------- */
// Le dice al navegador si debe mostrar la bandeja. La seguridad real está en cada función de la bandeja.
exports.miRol = onCall(
    {region: REGION, timeoutSeconds: 30, cors: ALLOWED_ORIGINS},
    async (request) => {
      requireVerifiedUser(request);
      return {funcionario: esFuncionario(request)};
    },
);

/* ---------------------- bandejaListar (callable) ---------------------- */
exports.bandejaListar = onCall(
    {region: REGION, timeoutSeconds: 60, cors: ALLOWED_ORIGINS},
    async (request) => {
      requireFuncionario(request);
      const d = request.data || {};
      const db = getFirestore();

      const snap = await db.collection("ficha-solicitud")
          .orderBy("creadoEn", "desc").limit(MAX_BANDEJA + 1).get();
      const truncado = snap.size > MAX_BANDEJA;
      const todas = snap.docs.slice(0, MAX_BANDEJA).map((x) => resumenDe(x.id, x.data()));

      const conteos = Object.fromEntries(estados.ESTADOS.map((e) => [e, 0]));
      todas.forEach((r) => {
        conteos[r.estado] += 1;
      });

      const estadoFiltro = estados.ESTADOS.includes(d.estado) ? d.estado : "";
      const texto = normalizarTexto(d.texto);
      const filas = todas.filter((r) =>
        (!estadoFiltro || r.estado === estadoFiltro) &&
        (!texto || normalizarTexto(`${r.expediente} ${r.nombres} ${r.dni} ${r.correo} ${r.asunto}`).includes(texto)),
      );
      return {filas: filas.slice(0, MAX_FILAS_BANDEJA), total: filas.length, conteos, truncado};
    },
);

/* ---------------------- bandejaDetalle (callable) ---------------------- */
exports.bandejaDetalle = onCall(
    {region: REGION, timeoutSeconds: 30, cors: ALLOWED_ORIGINS},
    async (request) => {
      requireFuncionario(request);
      const id = idValido((request.data || {}).id);
      const snap = await getFirestore().collection("ficha-solicitud").doc(id).get();
      if (!snap.exists) throw new HttpsError("not-found", "No se encontró la solicitud.");
      const fila = snap.data();
      return {
        id,
        ...serializar(fila),
        expediente: fila.expediente || carpetaDe(fila) || "—",
        estado: estados.estadoDe(fila),
        transiciones: estados.TRANSICIONES[estados.estadoDe(fila)],
      };
    },
);

/* ------------------ bandejaCambiarEstado (callable) ------------------ */
// Los PDF de respuesta pesan hasta 5 x 10 MB: solo se pegan al correo si el total es razonable.
const MAX_ADJUNTOS_CORREO = 15 * 1024 * 1024;

exports.bandejaCambiarEstado = onCall(
    {region: REGION, timeoutSeconds: 120, memory: "512MiB", cors: ALLOWED_ORIGINS},
    async (request) => {
      const uid = requireFuncionario(request);
      const d = request.data || {};
      const id = idValido(d.id);
      const nuevo = String(d.estado || "");
      const pedidos = solicitudes.validarArchivosRespuesta(d.archivos, uid, id);
      if (pedidos.length > 0 && !["Atendido", "Rechazado"].includes(nuevo)) {
        throw new HttpsError("invalid-argument", "Solo se adjuntan documentos de respuesta al atender o rechazar.");
      }
      const db = getFirestore();
      const bucket = getStorage().bucket(BUCKET);
      const ref = db.collection("ficha-solicitud").doc(id);
      const ahora = new Date();
      const marca = Timestamp.fromDate(ahora);

      // Los PDF de respuesta se revisan igual que los del ciudadano (existen, son PDF de verdad, huella SHA-256).
      const archivos = await Promise.all(
          pedidos.map((a, i) => inspeccionarArchivo(bucket, a, `de respuesta ${i + 1}`)),
      );

      const resultado = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new HttpsError("not-found", "No se encontró la solicitud.");
        const fila = snap.data();
        const anterior = estados.estadoDe(fila);
        const mensaje = estados.validarCambioEstado(anterior, nuevo, d.mensaje);

        const entrada = {estado: nuevo, fecha: marca, por: "Mesa de partes"};
        if (mensaje) entrada.mensaje = mensaje;
        const cambios = {
          estado: nuevo,
          historial: [...(fila.historial || []), entrada],
          observacion: nuevo === "Observado" ? {mensaje, fecha: marca} : null,
        };
        // La respuesta final (mensaje y documentos) que el ciudadano ve y descarga en su trámite.
        if (estados.FINALES.includes(nuevo) && (mensaje || archivos.length > 0)) {
          cambios.respuesta = {estado: nuevo, fecha: marca, mensaje, archivos};
        }
        tx.update(ref, cambios);
        return {fila: {...fila, estado: nuevo}, anterior, mensaje};
      });

      // Registro interno de quién hizo el cambio (los ciudadanos no lo ven).
      await db.collection("auditoria").add({
        accion: "cambiarEstado", solicitudId: id, expediente: resultado.fila.expediente || carpetaDe(resultado.fila),
        de: resultado.anterior, a: nuevo, mensaje: resultado.mensaje, archivos: archivos.map((a) => a.path),
        uid, correo: request.auth.token.email, fecha: marca,
      }).catch((err) => logger.warn("No se pudo guardar la auditoría.", {mensaje: err.message}));

      const fila = resultado.fila;
      const destino = (fila.remitente && fila.remitente.correo) || fila.correo;
      const expediente = fila.expediente || carpetaDe(fila);

      // Los documentos de respuesta también van pegados al correo (si no pesan demasiado) y siempre como enlaces.
      let adjuntos = [];
      const total = archivos.reduce((suma, a) => suma + a.size, 0);
      if (archivos.length > 0 && total <= MAX_ADJUNTOS_CORREO) {
        try {
          adjuntos = await Promise.all(archivos.map(async (a) => ({
            filename: a.name, content: (await bucket.file(a.path).download())[0], contentType: "application/pdf",
          })));
        } catch (err) {
          logger.warn("No se pudieron adjuntar los documentos de respuesta al correo.", {mensaje: err.message});
          adjuntos = [];
        }
      }
      const correoEnviado = destino ? await enviarCorreo({
        to: destino,
        subject: oneLine(`Expediente ${expediente}: ${nuevo}`),
        html: correos.correoCambioEstado({...fila, expediente}, nuevo, resultado.mensaje, archivos, adjuntos.length > 0),
        attachments: adjuntos,
      }, {expediente, para: "ciudadano", estado: nuevo}) : false;

      logger.info("Estado cambiado.", {expediente, de: resultado.anterior, a: nuevo});
      return {ok: true, estado: nuevo, correoEnviado};
    },
);

/* ------------------------- Mensajes (callables) ------------------------- */
// Conversación suelta entre el ciudadano y la mesa de partes: no cambia el estado del trámite.

const MAX_MENSAJES_HORA = 20; // por ciudadano (aparte del límite de envíos de solicitudes)

// Agrega un mensaje al expediente dentro de una transacción. `autor`: "Mesa de partes" o "Ciudadano".
async function guardarMensaje(ref, autor, texto, {propietario} = {}) {
  const db = getFirestore();
  const marca = Timestamp.fromDate(new Date());
  const limiteRef = propietario ? db.collection("limites").doc(`${propietario}_mensajes`) : null;
  return db.runTransaction(async (tx) => {
    const [snap, limite] = await Promise.all([tx.get(ref), limiteRef ? tx.get(limiteRef) : null]);
    if (!snap.exists || (propietario && snap.data().userId !== propietario)) {
      throw new HttpsError(propietario ? "permission-denied" : "not-found", propietario ? "Solicitud no encontrada." : "No se encontró la solicitud.");
    }
    const fila = snap.data();
    const mensajes = estados.agregarMensaje(fila, {de: autor, fecha: marca, texto});
    if (limiteRef) tx.set(limiteRef, aplicarLimite(limite, marca.toMillis(), MAX_MENSAJES_HORA));
    tx.update(ref, {mensajes});
    return {fila, marca};
  });
}

exports.bandejaMensaje = onCall(
    {region: REGION, timeoutSeconds: 60, cors: ALLOWED_ORIGINS},
    async (request) => {
      const uid = requireFuncionario(request);
      const d = request.data || {};
      const id = idValido(d.id);
      const texto = estados.validarMensaje(d.texto);
      const ref = getFirestore().collection("ficha-solicitud").doc(id);
      const {fila, marca} = await guardarMensaje(ref, "Mesa de partes", texto);

      const expediente = fila.expediente || carpetaDe(fila);
      await getFirestore().collection("auditoria").add({
        accion: "mensaje", solicitudId: id, expediente, mensaje: texto,
        uid, correo: request.auth.token.email, fecha: marca,
      }).catch((err) => logger.warn("No se pudo guardar la auditoría.", {mensaje: err.message}));

      const destino = (fila.remitente && fila.remitente.correo) || fila.correo;
      const correoEnviado = destino ? await enviarCorreo({
        to: destino,
        subject: oneLine(`Expediente ${expediente}: mensaje de la Mesa de Partes`),
        html: correos.correoMensajeParaCiudadano({...fila, expediente}, texto),
      }, {expediente, para: "ciudadano", tipo: "mensaje"}) : false;
      return {ok: true, correoEnviado};
    },
);

exports.enviarMensaje = onCall(
    {region: REGION, timeoutSeconds: 60, cors: ALLOWED_ORIGINS},
    async (request) => {
      const uid = requireVerifiedUser(request);
      const d = request.data || {};
      const id = idValido(d.solicitudId);
      const texto = estados.validarMensaje(d.texto);
      const ref = getFirestore().collection("ficha-solicitud").doc(id);
      const {fila} = await guardarMensaje(ref, "Ciudadano", texto, {propietario: uid});

      const expediente = fila.expediente || carpetaDe(fila);
      const correoEncargado = await enviarCorreo({
        to: process.env.MAIL_TO,
        subject: oneLine(`Mensaje del ciudadano - Expediente ${expediente}`),
        html: correos.correoMensajeParaEncargado({...fila, expediente}, texto),
      }, {expediente, para: "encargado", tipo: "mensaje"});
      return {ok: true, correoEncargado};
    },
);

/* ------------------- subsanarSolicitud (callable) ------------------- */
// El ciudadano responde a una observación: agrega archivos y la solicitud vuelve a "En revisión".
exports.subsanarSolicitud = onCall(
    {region: REGION, timeoutSeconds: 120, memory: "512MiB", cors: ALLOWED_ORIGINS},
    async (request) => {
      const uid = requireVerifiedUser(request);
      const entrada = solicitudes.validarSubsanacion(request.data, uid);

      const db = getFirestore();
      const ref = db.collection("ficha-solicitud").doc(entrada.solicitudId);
      const snap = await ref.get();
      if (!snap.exists || snap.data().userId !== uid) {
        throw new HttpsError("permission-denied", "Solicitud no encontrada.");
      }
      const previa = snap.data();
      if (estados.estadoDe(previa) !== "Observado") {
        throw new HttpsError("failed-precondition", "Esta solicitud no tiene una observación pendiente.");
      }
      if (carpetaDe(previa) !== entrada.carpeta) {
        throw new HttpsError("invalid-argument", "Los archivos no pertenecen a esta solicitud.");
      }

      const bucket = getStorage().bucket(BUCKET);
      const archivos = await Promise.all(
          entrada.archivos.map((a, i) => inspeccionarArchivo(bucket, a, `adjunto ${i + 1}`)),
      );

      const ahora = new Date();
      const marca = Timestamp.fromDate(ahora);
      const limiteRef = db.collection("limites").doc(uid);
      const fila = await db.runTransaction(async (tx) => {
        const [actual, limite] = await Promise.all([tx.get(ref), tx.get(limiteRef)]);
        const f = actual.data();
        if (estados.estadoDe(f) !== "Observado") {
          throw new HttpsError("failed-precondition", "Esta solicitud no tiene una observación pendiente.");
        }
        tx.set(limiteRef, aplicarLimite(limite, ahora.getTime()));
        tx.update(ref, {
          estado: "En revisión",
          subsanaciones: [...(f.subsanaciones || []), {fecha: marca, comentario: entrada.comentario, archivos}],
          historial: [...(f.historial || []), {
            estado: "En revisión", fecha: marca, por: "Ciudadano",
            mensaje: entrada.comentario || "Presentó su subsanación.",
          }],
          observacion: null,
        });
        return f;
      });

      const expediente = fila.expediente || carpetaDe(fila);
      const correoEncargado = await enviarCorreo({
        to: process.env.MAIL_TO,
        subject: oneLine(`Subsanación recibida - Expediente ${expediente}`),
        html: correos.correoSubsanacion({...fila, expediente}, entrada.comentario, archivos),
      }, {expediente, para: "encargado"});

      logger.info("Subsanación presentada.", {expediente, uid});
      return {ok: true, estado: "En revisión", correoEncargado};
    },
);

/* -------------------- consultarDni (callable) -------------------- */
// Consulta nombres por DNI sin exponer el token de miapi.cloud en el navegador.
exports.consultarDni = onCall(
    {region: REGION, timeoutSeconds: 30, cors: ALLOWED_ORIGINS},
    async (request) => {
      requireVerifiedUser(request);

      const dni = String((request.data || {}).dni || "");
      if (!/^\d{8}$/.test(dni)) {
        throw new HttpsError("invalid-argument", "DNI no válido.");
      }

      const token = process.env.MIAPI_TOKEN;
      if (!token) {
        logger.error("Falta la variable de entorno MIAPI_TOKEN");
        throw new HttpsError("failed-precondition", "Consulta de DNI no configurada.");
      }

      let body = {};
      try {
        const resp = await fetch(`https://miapi.cloud/v1/dni/${dni}`, {
          headers: {Authorization: `Bearer ${token}`},
          signal: AbortSignal.timeout(15000),
        });
        body = await resp.json().catch(() => ({}));
        if (resp.status === 401 || resp.status === 403) {
          logger.error("miapi.cloud rechazó el token", {status: resp.status});
          throw new HttpsError("failed-precondition", "Servicio de DNI no disponible.");
        }
      } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error("Error consultando miapi.cloud:", err);
        throw new HttpsError("unavailable", "No se pudo consultar el DNI.");
      }

      const d = body && body.datos;
      if (!d || !d.dni) return {found: false};

      return {
        found: true,
        nombres: d.nombres,
        apellidoPaterno: d.ape_paterno,
        apellidoMaterno: d.ape_materno,
      };
    },
);
