// functions/cargo.js
// Genera el "Cargo de recepción" en PDF (A4) a partir de los datos ya guardados de la solicitud.
// Usa pdf-lib con fuentes estándar: todo texto se pasa antes por limpiarParaPdf().
const {PDFDocument, StandardFonts, rgb} = require("pdf-lib");

// Colores de la marca (iguales a los de la aplicación)
const AZUL = rgb(0, 43 / 255, 78 / 255); // #002B4E
const AZUL_2 = rgb(62 / 255, 90 / 255, 120 / 255); // #3E5A78
const ACENTO = rgb(242 / 255, 183 / 255, 5 / 255); // #F2B705
const TEXTO = rgb(17 / 255, 24 / 255, 39 / 255); // #111827
const GRIS = rgb(107 / 255, 114 / 255, 128 / 255); // #6B7280
const FONDO = rgb(241 / 255, 243 / 255, 245 / 255); // #F1F3F5
const LINEA = rgb(213 / 255, 218 / 255, 224 / 255);
const VERDE = rgb(22 / 255, 163 / 255, 74 / 255); // #16A34A

const CONTACTO = "Central Telefónica: (01) 999-9999  ·  WhatsApp: 999 999 999";

const A4 = {w: 595.28, h: 841.89};
const MARGEN = 48;
const ANCHO_UTIL = A4.w - MARGEN * 2;

// Las fuentes estándar de PDF solo representan Latin-1 (acentos y ñ incluidos).
// Cualquier otro carácter (emoji, comillas curvas raras, etc.) se reemplaza para no romper el PDF.
function limpiarParaPdf(valor) {
  return String(valor ?? "")
      .normalize("NFC")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, "\"")
      .replace(/[–—]/g, "-")
      .replace(/[    ]/g, " ")
      .replace(/\t/g, "    ")
      .replace(/[^\n -~ -ÿ]/g, "?");
}

// Divide un texto en líneas que quepan en el ancho dado (respeta saltos de línea y corta palabras largas).
function envolver(texto, fuente, tamano, ancho) {
  const salida = [];
  String(texto).split("\n").forEach((parrafo) => {
    const palabras = parrafo.split(" ");
    let linea = "";
    const cabe = (t) => fuente.widthOfTextAtSize(t, tamano) <= ancho;
    palabras.forEach((palabra) => {
      let p = palabra;
      // Palabra más ancha que la línea (por ejemplo, un nombre de archivo sin espacios): se corta.
      while (!cabe(p) && p.length > 1) {
        let n = p.length - 1;
        while (n > 1 && !cabe(p.slice(0, n))) n--;
        if (linea) {
          salida.push(linea);
          linea = "";
        }
        salida.push(p.slice(0, n));
        p = p.slice(n);
      }
      const prueba = linea ? `${linea} ${p}` : p;
      if (cabe(prueba)) {
        linea = prueba;
      } else {
        salida.push(linea);
        linea = p;
      }
    });
    salida.push(linea);
  });
  return salida;
}

/**
 * @param {object} d datos de la solicitud
 *   expediente, fechaHora (texto en hora de Lima), estado,
 *   remitente {nombres, dni, correo}, tipoDocumento, subDocumento, asunto,
 *   archivos [{rol, nombre, tamano (texto), sha256}]
 * @return {Promise<Buffer>} PDF listo para guardar o adjuntar
 */
async function generarCargoPdf(d) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(limpiarParaPdf(`Cargo de recepción ${d.expediente}`));
  pdf.setAuthor("Mesa de Partes Virtual - CJN");
  pdf.setSubject("Cargo de recepción de solicitud");
  pdf.setCreationDate(new Date());

  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  let pagina = pdf.addPage([A4.w, A4.h]);
  let y = A4.h;

  const texto = (t, x, yy, {fuente = normal, tamano = 10, color = TEXTO} = {}) => {
    pagina.drawText(limpiarParaPdf(t), {x, y: yy, size: tamano, font: fuente, color});
  };

  // --- Cabecera ---
  pagina.drawRectangle({x: 0, y: A4.h - 78, width: A4.w, height: 78, color: AZUL});
  pagina.drawRectangle({x: 0, y: A4.h - 82, width: A4.w, height: 4, color: ACENTO});
  texto("MESA DE PARTES VIRTUAL", MARGEN, A4.h - 38, {fuente: negrita, tamano: 17, color: rgb(1, 1, 1)});
  texto("CJN", MARGEN, A4.h - 58, {fuente: negrita, tamano: 10, color: rgb(0.86, 0.9, 0.95)});
  const etiqueta = "CARGO DE RECEPCIÓN";
  const wEt = negrita.widthOfTextAtSize(limpiarParaPdf(etiqueta), 11);
  texto(etiqueta, A4.w - MARGEN - wEt, A4.h - 44, {fuente: negrita, tamano: 11, color: rgb(1, 1, 1)});
  y = A4.h - 82 - 26;

  // --- Recuadro del expediente ---
  const altoCaja = 78;
  pagina.drawRectangle({x: MARGEN, y: y - altoCaja, width: ANCHO_UTIL, height: altoCaja, color: FONDO});
  pagina.drawRectangle({x: MARGEN, y: y - altoCaja, width: 4, height: altoCaja, color: ACENTO});
  texto("N.° DE EXPEDIENTE", MARGEN + 20, y - 24, {fuente: negrita, tamano: 8.5, color: GRIS});
  texto(d.expediente, MARGEN + 20, y - 58, {fuente: negrita, tamano: 30, color: AZUL});
  const colDer = MARGEN + ANCHO_UTIL * 0.58;
  texto("FECHA Y HORA DE REGISTRO", colDer, y - 24, {fuente: negrita, tamano: 8.5, color: GRIS});
  texto(`${d.fechaHora} (hora de Lima)`, colDer, y - 40, {fuente: negrita, tamano: 10.5});
  texto("ESTADO", colDer, y - 60, {fuente: negrita, tamano: 8.5, color: GRIS});
  texto(d.estado || "Recibido", colDer, y - 75, {fuente: negrita, tamano: 11, color: VERDE});
  y -= altoCaja + 24;

  // --- Utilidades de maquetación ---
  const nuevaPaginaSiHaceFalta = (alto) => {
    if (y - alto < 64) {
      pagina = pdf.addPage([A4.w, A4.h]);
      y = A4.h - MARGEN;
    }
  };

  const seccion = (titulo) => {
    nuevaPaginaSiHaceFalta(40);
    pagina.drawCircle({x: MARGEN + 7, y: y - 5, size: 7, color: AZUL});
    texto(titulo, MARGEN + 22, y - 9, {fuente: negrita, tamano: 11.5, color: AZUL});
    y -= 16;
    pagina.drawLine({
      start: {x: MARGEN, y}, end: {x: MARGEN + ANCHO_UTIL, y}, thickness: 0.8, color: LINEA,
    });
    y -= 12;
  };

  const campo = (rotulo, valor) => {
    const anchoRotulo = 110;
    const lineas = envolver(limpiarParaPdf(valor || "-"), normal, 10, ANCHO_UTIL - anchoRotulo);
    nuevaPaginaSiHaceFalta(lineas.length * 13 + 5);
    texto(rotulo, MARGEN, y - 9, {fuente: negrita, tamano: 9.5, color: GRIS});
    lineas.forEach((l, i) => {
      texto(l, MARGEN + anchoRotulo, y - 9 - i * 13, {tamano: 10});
    });
    y -= lineas.length * 13 + 5;
  };

  // --- Remitente ---
  seccion("DATOS DEL REMITENTE");
  campo("Apellidos y nombres", d.remitente && d.remitente.nombres);
  campo("Documento (DNI)", d.remitente && d.remitente.dni);
  campo("Correo electrónico", d.remitente && d.remitente.correo);
  y -= 4;

  // --- Documento ---
  seccion("DATOS DEL DOCUMENTO");
  campo("Tipo de documento", String(d.tipoDocumento || "").toUpperCase());
  campo("Tipo de sub documento", String(d.subDocumento || "").toUpperCase());
  campo("Asunto", d.asunto);
  y -= 4;

  // --- Archivos ---
  seccion("DOCUMENTOS ADJUNTOS");
  (d.archivos || []).forEach((a) => {
    const nombre = envolver(limpiarParaPdf(a.nombre), negrita, 10, ANCHO_UTIL - 90);
    const hash = a.sha256 || "";
    const alto = 16 + nombre.length * 13 + (hash ? 46 : 16);
    nuevaPaginaSiHaceFalta(alto);
    pagina.drawRectangle({x: MARGEN, y: y - alto, width: ANCHO_UTIL, height: alto, color: FONDO});
    texto(a.rol === "principal" ? "PRINCIPAL" : "ANEXO", MARGEN + 12, y - 16, {
      fuente: negrita, tamano: 8, color: AZUL_2,
    });
    nombre.forEach((l, i) => texto(l, MARGEN + 80, y - 16 - i * 13, {fuente: negrita, tamano: 10}));
    const base = y - 16 - nombre.length * 13;
    texto(`Tamaño: ${a.tamano}`, MARGEN + 80, base, {tamano: 9, color: GRIS});
    if (hash) {
      texto("Huella SHA-256:", MARGEN + 80, base - 13, {fuente: negrita, tamano: 8, color: GRIS});
      texto(hash.slice(0, 32), MARGEN + 80, base - 24, {fuente: mono, tamano: 8, color: TEXTO});
      texto(hash.slice(32), MARGEN + 80, base - 33, {fuente: mono, tamano: 8, color: TEXTO});
    }
    y -= alto + 6;
  });
  if (!(d.archivos || []).length) campo("Archivos", "Sin archivos");
  y -= 8;

  // --- Constancia ---
  seccion("CONSTANCIA");
  const parrafos = [
    `La solicitud fue confirmada por el remitente con su contraseña de usuario (firma electrónica simple) ` +
    `el ${d.fechaHora} (hora de Lima) y quedó registrada con el expediente ${d.expediente}.`,
    "La huella SHA-256 identifica de forma única el contenido de cada archivo recibido: si el archivo " +
    "cambia, aunque sea un solo carácter, la huella cambia.",
    "Este cargo acredita la recepción de la solicitud; no implica aceptación de su contenido. CJN podrá " +
    "verificar requisitos formales, solicitar subsanaciones o derivarla al área competente.",
  ];
  parrafos.forEach((p) => {
    const lineas = envolver(limpiarParaPdf(p), normal, 9, ANCHO_UTIL);
    nuevaPaginaSiHaceFalta(lineas.length * 12 + 6);
    lineas.forEach((l, i) => texto(l, MARGEN, y - 9 - i * 12, {tamano: 9, color: TEXTO}));
    y -= lineas.length * 12 + 6;
  });

  // --- Pie de página en todas las hojas ---
  const paginas = pdf.getPages();
  paginas.forEach((pg, i) => {
    pg.drawLine({start: {x: MARGEN, y: 52}, end: {x: MARGEN + ANCHO_UTIL, y: 52}, thickness: 0.8, color: LINEA});
    pg.drawText(limpiarParaPdf(CONTACTO), {x: MARGEN, y: 38, size: 8.5, font: normal, color: GRIS});
    const num = limpiarParaPdf(`Expediente ${d.expediente}  ·  Página ${i + 1} de ${paginas.length}`);
    const w = normal.widthOfTextAtSize(num, 8.5);
    pg.drawText(num, {x: MARGEN + ANCHO_UTIL - w, y: 38, size: 8.5, font: normal, color: GRIS});
    pg.drawText("Documento generado automáticamente por el sistema.", {
      x: MARGEN, y: 26, size: 8, font: normal, color: GRIS,
    });
  });

  return Buffer.from(await pdf.save());
}

module.exports = {generarCargoPdf, limpiarParaPdf, envolver};
