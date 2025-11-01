// functions/index.js
const { onCall } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const nodemailer = require("nodemailer");

// Variables de entorno (.env en /functions)
const SENDGRID_USER = process.env.SENDGRID_USER;
const SENDGRID_KEY  = process.env.SENDGRID_KEY; 

// Transport SMTP SendGrid
const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 587,
  secure: false,
  auth: {
    user: SENDGRID_USER,
    pass: SENDGRID_KEY,
  },
});

// Callable v2
exports.enviarSolicitud = onCall(
  { region: "us-central1", timeoutSeconds: 60, cors: true },
  async (request) => {
    try {
      const {
        nombres,
        dni,
        correo,
        tipoDocumento,
        subDocumento,
        asunto,
        archivos: archivosRaw,
      } = request.data || {};

      // Normaliza y filtra "archivos"
      const archivos = Array.isArray(archivosRaw)
        ? archivosRaw.filter(Boolean).map(a => ({
            nombre: a?.nombre ?? "archivo",
            url: a?.url ?? "",
          }))
        : [];

      // Logs útiles en Cloud Logging
      logger.info("enviarSolicitud: payload recibido", {
        tieneArchivos: archivos.length,
        primerArchivo: archivos[0] || null,
      });

      // HTML de la lista
      const listaArchivosHTML =
        archivos.length > 0
          ? archivos
              .map(
                (a) =>
                  `<li><a href="${a.url}" target="_blank" rel="noopener noreferrer">${a.nombre}</a></li>`
              )
              .join("")
          : `<li>— sin archivos —</li>`;

      const mailOptions = {
        from: "jheffer17x@gmail.com",    // remitente VERIFICADO en SendGrid
        to: "jhefguerrerot@gmail.com",   // destinatario
        subject: `Nueva solicitud de ${nombres}`,
        html: `
          <h3>Datos del remitente</h3>
          <p><strong>Nombre:</strong> ${nombres}</p>
          <p><strong>DNI:</strong> ${dni}</p>
          <p><strong>Correo:</strong> ${correo}</p>

          <h3>Solicitud</h3>
          <p><strong>Tipo:</strong> ${tipoDocumento} (${subDocumento})</p>
          <p><strong>Asunto:</strong> ${asunto}</p>

          <h3>Archivos</h3>
          <ul>${listaArchivosHTML}</ul>
        `,
      };

      await transporter.sendMail(mailOptions);
      logger.info("Correo enviado OK a encargado.");

      return { success: true, message: "Correo enviado correctamente" };
    } catch (err) {
      logger.error("Error enviando correo:", err);
      throw new Error("send-email-failed");
    }
  }
);
