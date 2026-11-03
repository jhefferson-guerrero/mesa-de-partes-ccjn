// functions/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

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

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// Para cabeceras (asunto del correo): sin saltos de línea.
function oneLine(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
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
