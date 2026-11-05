// Pruebas de registrarSolicitud con Firestore, Storage y correo simulados (no tocan Firebase real).
// Ejecutar:  cd functions && npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {ESTADO, reiniciar, funciones} = require("./fakes");
const solicitudes = require("../solicitud.js");
const registrar = funciones.registrarSolicitud;

/* ---------------------------- Utilidades ---------------------------- */
const UID = "usuarioDePrueba1234567890abcd";
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("contenido de prueba ".repeat(20))]);
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from("zip".repeat(30))]);
let contadorCarpeta = 1793700000000;

function pedido(extra = {}, token = {}) {
  return {
    auth: {uid: UID, token: {email: "ciudadano@correo.com", email_verified: true, auth_time: Date.now() / 1000 - 5, ...token}},
    data: {},
    ...extra,
  };
}

// Sube archivos simulados como lo haría el navegador y devuelve los datos de la llamada.
function preparar({anexo = false, principal = PDF, nombre = "demanda final.pdf", carpeta} = {}) {
  const c = String(carpeta || ++contadorCarpeta);
  const base = `ficha-solicitudes/${UID}/${c}`;
  ESTADO.archivos.set(`${base}/principal_${nombre}`, {buf: principal, contentType: "application/pdf", metadata: {firebaseStorageDownloadTokens: "tok-principal"}});
  const data = {
    tipoDocumento: "solicitud", subDocumento: "simple", asunto: "Solicito copia del expediente",
    autorizacionCorreo: true, terminosAceptados: true,
    principal: {path: `${base}/principal_${nombre}`},
  };
  if (anexo) {
    ESTADO.archivos.set(`${base}/anexo_presupuesto.docx`, {buf: DOCX, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", metadata: {}});
    data.anexo = {path: `${base}/anexo_presupuesto.docx`};
  }
  return {data, base, carpeta: c};
}

const ejecutar = (data, token) => registrar.run(pedido({data}, token));
async function falla(promesa, codigo, texto) {
  await assert.rejects(promesa, (e) => {
    assert.equal(e.code, codigo, `código esperado ${codigo}, llegó ${e.code}: ${e.message}`);
    if (texto) assert.match(e.message, texto);
    return true;
  });
}

test.beforeEach(() => {
  reiniciar();
  ESTADO.docs.set(`usuarios/${UID}`, {
    apellidoPaterno: "ABANTO", apellidoMaterno: "VILLAR", nombres: "NATALY ERLINDA", dni: "74292311", correo: "ciudadano@correo.com",
  });
});

/* ------------------------------- Pruebas ------------------------------- */
test("registra la solicitud: expediente, archivos verificados, cargo PDF y correos", async () => {
  const {data, base, carpeta} = preparar({anexo: true});
  const r = await ejecutar(data);
  const anio = solicitudes.anioEnLima();

  assert.equal(r.ok, true);
  assert.equal(r.yaRegistrada, false);
  assert.equal(r.expediente, `${anio}-000001`);
  assert.match(r.fechaHora, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);

  const fila = ESTADO.docs.get(`ficha-solicitud/${UID}_${carpeta}`);
  assert.equal(fila.userId, UID);
  assert.equal(fila.estado, "Recibido");
  assert.equal(fila.historial.length, 1);
  assert.equal(fila.remitente.nombres, "ABANTO VILLAR NATALY ERLINDA");
  assert.equal(fila.remitente.dni, "74292311");
  assert.equal(fila.remitente.correo, "ciudadano@correo.com");
  assert.equal(fila.documentos.principal.sha256, crypto.createHash("sha256").update(PDF).digest("hex"));
  assert.equal(fila.documentos.anexos[0].sha256, crypto.createHash("sha256").update(DOCX).digest("hex"));
  assert.equal(fila.documentos.principal.size, PDF.length);
  assert.ok(fila.documentos.principal.url.includes("token=tok-principal"), "usa el token existente");
  assert.ok(fila.documentos.anexos[0].url.includes("token="), "crea el token que falta");

  // contador y límite
  assert.equal(ESTADO.docs.get(`contadores/${anio}`).ultimo, 1);
  assert.equal(ESTADO.docs.get(`limites/${UID}`).count, 1);

  // cargo en PDF
  assert.ok(r.cargo.base64.length > 100);
  const pdf = Buffer.from(r.cargo.base64, "base64");
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.equal(r.cargo.nombre, `Cargo-${r.expediente}.pdf`);
  assert.ok(ESTADO.archivos.has(`${base}/cargo_${r.expediente}.pdf`), "el cargo queda guardado en Storage");
  assert.ok(fila.cargo.url.includes("token="));

  // correos: ciudadano (con el correo verificado de la sesión) y encargado, ambos con el cargo adjunto
  assert.equal(ESTADO.correos.length, 2);
  const aCiudadano = ESTADO.correos.find((m) => m.to === "ciudadano@correo.com");
  const aEncargado = ESTADO.correos.find((m) => m.to === "encargado@correo.com");
  assert.ok(aCiudadano && aEncargado);
  assert.match(aCiudadano.subject, new RegExp(r.expediente));
  assert.match(aCiudadano.html, new RegExp(r.expediente));
  assert.equal(aCiudadano.attachments[0].filename, `Cargo-${r.expediente}.pdf`);
  assert.ok(!aEncargado.attachments || aEncargado.attachments.length === 0, "el aviso al encargado no lleva adjuntos");
  assert.match(aEncargado.html, /bandeja\.html/);
  assert.equal(r.correoCiudadano, true);
  assert.equal(fila.correoEnviado, true);
  assert.equal(fila.correoCiudadanoEnviado, true);
});

test("los expedientes son correlativos", async () => {
  const a = await ejecutar(preparar().data);
  const b = await ejecutar(preparar().data);
  const c = await ejecutar(preparar().data);
  const n = (x) => Number(x.expediente.split("-")[1]);
  assert.deepEqual([n(a), n(b), n(c)], [1, 2, 3]);
});

test("un reintento del mismo envío devuelve el mismo expediente y no duplica nada", async () => {
  const p = preparar();
  const a = await ejecutar(p.data);
  const b = await ejecutar(p.data);
  assert.equal(b.expediente, a.expediente);
  assert.equal(b.yaRegistrada, true);
  assert.ok(b.cargo && b.cargo.base64.length > 100, "vuelve a entregar el cargo guardado");
  assert.equal(ESTADO.correos.length, 2, "no se reenvían correos");
  assert.equal(ESTADO.docs.get(`contadores/${solicitudes.anioEnLima()}`).ultimo, 1);
  assert.equal(ESTADO.docs.get(`limites/${UID}`).count, 1);
});

test("el reintento de otro usuario sobre la misma carpeta no se acepta", async () => {
  const p = preparar();
  await ejecutar(p.data);
  const otro = pedido({data: p.data});
  otro.auth.uid = "otroUsuarioDistinto123456789012";
  // la ruta pertenece a UID, no al otro usuario
  await falla(registrar.run(otro), "invalid-argument");
});

test("exige sesión con correo verificado", async () => {
  const {data} = preparar();
  await falla(registrar.run({data}), "unauthenticated");
  await falla(ejecutar(data, {email_verified: false}), "unauthenticated");
});

test("exige haber confirmado la contraseña hace poco (auth_time)", async () => {
  const {data} = preparar();
  await falla(ejecutar(data, {auth_time: Date.now() / 1000 - 3600}), "failed-precondition", /reauth-required/);
  const ok = await ejecutar(data, {auth_time: Date.now() / 1000 - 60});
  assert.equal(ok.ok, true);
});

test("rechaza datos inválidos", async () => {
  const base = () => preparar().data;
  await falla(ejecutar({...base(), tipoDocumento: "otro"}), "invalid-argument", /tipo de documento/);
  await falla(ejecutar({...base(), subDocumento: "x"}), "invalid-argument", /sub documento/);
  await falla(ejecutar({...base(), asunto: "   "}), "invalid-argument", /asunto/);
  await falla(ejecutar({...base(), asunto: "a".repeat(201)}), "invalid-argument", /200/);
  await falla(ejecutar({...base(), autorizacionCorreo: false}), "invalid-argument", /autorizar/);
  await falla(ejecutar({...base(), terminosAceptados: "true"}), "invalid-argument", /autorizar/);
  await falla(ejecutar({}), "invalid-argument");
  await falla(ejecutar(null), "invalid-argument");
});

test("rechaza rutas que no son del usuario o intentan salirse de su carpeta", async () => {
  const p = preparar();
  const malas = [
    `ficha-solicitudes/otroUsuario/${p.carpeta}/principal_a.pdf`,
    `ficha-solicitudes/${UID}/${p.carpeta}/../principal_a.pdf`,
    `ficha-solicitudes/${UID}/${p.carpeta}/sub/principal_a.pdf`,
    `ficha-solicitudes/${UID}/abc/principal_a.pdf`,
    `ficha-solicitudes/${UID}/${p.carpeta}/principal_..\\a.pdf`,
    `otra-carpeta/${UID}/${p.carpeta}/principal_a.pdf`,
    `ficha-solicitudes/${UID}/${p.carpeta}/cargo_2026-000001.pdf`,
  ];
  for (const ruta of malas) {
    await falla(ejecutar({...p.data, principal: {path: ruta}}), "invalid-argument");
  }
  await falla(ejecutar({...p.data, principal: {path: 123}}), "invalid-argument");
});

test("rechaza extensiones no permitidas y anexos de otra solicitud", async () => {
  const p = preparar();
  await falla(ejecutar({...p.data, principal: {path: `${p.base}/principal_virus.exe`}}), "invalid-argument", /PDF/);
  await falla(ejecutar({...p.data, principal: {path: `${p.base}/principal_a.docx`}}), "invalid-argument", /PDF/);
  const q = preparar({anexo: true});
  await falla(ejecutar({...p.data, anexo: q.data.anexo}), "invalid-argument", /misma solicitud/);
  await falla(ejecutar({...q.data, anexo: {path: `${q.base}/anexo_x.zip`}}), "invalid-argument", /anexo/);
});

test("comprueba el contenido real del archivo y que exista", async () => {
  const falso = preparar({principal: Buffer.from("MZ esto es un ejecutable disfrazado de pdf")});
  await falla(ejecutar(falso.data), "invalid-argument", /no es un PDF válido/);

  const vacio = preparar({principal: Buffer.alloc(0)});
  await falla(ejecutar(vacio.data), "invalid-argument", /vacío/);

  const grande = preparar({principal: Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(10 * 1024 * 1024)])});
  await falla(ejecutar(grande.data), "invalid-argument", /10 MB/);

  const inexistente = preparar();
  await falla(ejecutar({...inexistente.data, principal: {path: `${inexistente.base}/principal_noexiste.pdf`}}), "failed-precondition", /No se encontró/);
});

test("el anexo Word se valida por su contenido", async () => {
  const p = preparar({anexo: true});
  ESTADO.archivos.get(`${p.base}/anexo_presupuesto.docx`).buf = Buffer.from("no soy un zip");
  await falla(ejecutar(p.data), "invalid-argument", /anexo 1 no es un DOCX/);
});

test("límite de envíos por hora y por usuario", async () => {
  for (let i = 0; i < 10; i++) await ejecutar(preparar().data);
  await falla(ejecutar(preparar().data), "resource-exhausted");
  // pasada la ventana (una hora) se libera
  const lim = ESTADO.docs.get(`limites/${UID}`);
  lim.inicio -= 61 * 60 * 1000;
  const ok = await ejecutar(preparar().data);
  assert.equal(ok.ok, true);
  assert.equal(ESTADO.docs.get(`limites/${UID}`).count, 1);
});

test("un fallo del correo no anula el registro", async () => {
  ESTADO.fallaCorreo = true;
  const p = preparar();
  const r = await ejecutar(p.data);
  assert.equal(r.ok, true);
  assert.equal(r.correoCiudadano, false);
  const fila = ESTADO.docs.get(`ficha-solicitud/${UID}_${p.carpeta}`);
  assert.equal(fila.correoEnviado, false);
  assert.equal(fila.correoCiudadanoEnviado, false);
  assert.ok(r.cargo, "el cargo se entrega igual");
});

test("usuario sin perfil y asunto con caracteres de control", async () => {
  ESTADO.docs.delete(`usuarios/${UID}`);
  const p = preparar();
  const r = await ejecutar({...p.data, asunto: "  Hola\u0000 mundo\u0007 \r\n segunda  "});
  assert.equal(r.ok, true);
  const fila = ESTADO.docs.get(`ficha-solicitud/${UID}_${p.carpeta}`);
  assert.equal(fila.remitente.nombres, "(sin nombre)");
  assert.equal(fila.asunto, "Hola mundo \n segunda");
});

test("el HTML de los correos escapa lo que escribe el usuario", async () => {
  const p = preparar();
  await ejecutar({...p.data, asunto: "<script>alert(1)</script> & \"comillas\""});
  const html = ESTADO.correos.map((m) => m.html).join("");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

/* -------------------------- Funciones puras -------------------------- */
test("expediente: formato y año en hora de Lima", () => {
  assert.equal(solicitudes.formatearExpediente(2026, 123), "2026-000123");
  assert.equal(solicitudes.formatearExpediente(2026, 1234567), "2026-1234567");
  // 1 de enero 02:00 UTC = 31 de diciembre 21:00 en Lima (UTC-5): todavía es el año anterior
  assert.equal(solicitudes.anioEnLima(new Date("2027-01-01T02:00:00Z")), 2026);
  assert.equal(solicitudes.anioEnLima(new Date("2027-01-01T05:00:00Z")), 2027);
  assert.equal(solicitudes.fechaHoraLima(new Date("2026-11-04T15:15:32Z")), "04/11/2026 10:15:32");
});

test("firmaValida distingue los tipos de archivo", () => {
  assert.equal(solicitudes.firmaValida("pdf", Buffer.from("%PDF-1.7")), true);
  assert.equal(solicitudes.firmaValida("pdf", Buffer.from("<html>")), false);
  assert.equal(solicitudes.firmaValida("docx", Buffer.from([0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0])), true);
  assert.equal(solicitudes.firmaValida("xls", Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])), true);
  assert.equal(solicitudes.firmaValida("xls", Buffer.from("%PDF-")), false);
  assert.equal(solicitudes.firmaValida("exe", Buffer.from("MZ")), false);
});

test("varios anexos: se verifican todos y se guardan en orden", async () => {
  const p = preparar();
  const rutas = [];
  for (let i = 1; i <= 3; i++) {
    const ruta = `${p.base}/anexo${i}_informe-${i}.docx`;
    ESTADO.archivos.set(ruta, {buf: DOCX, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", metadata: {}});
    rutas.push({path: ruta});
  }
  const r = await ejecutar({...p.data, anexos: rutas});
  const fila = ESTADO.docs.get(`ficha-solicitud/${UID}_${p.carpeta}`);
  assert.equal(fila.documentos.anexos.length, 3);
  assert.deepEqual(fila.documentos.anexos.map((a) => a.name), ["informe-1.docx", "informe-2.docx", "informe-3.docx"]);
  assert.ok(fila.documentos.anexos.every((a) => a.sha256.length === 64));
  const aEncargado = ESTADO.correos.find((m) => m.to === "encargado@correo.com");
  assert.ok(aEncargado.html.includes("<strong>4</strong> archivos adjuntos"), "el aviso cuenta el principal y los 3 anexos, sin listarlos");
  assert.equal(r.ok, true);
});

test("varios anexos: máximo 10, sin repetidos y todos en la misma carpeta", async () => {
  const p = preparar();
  const crear = (i) => {
    const ruta = `${p.base}/anexo${i}_a.pdf`;
    ESTADO.archivos.set(ruta, {buf: PDF, contentType: "application/pdf", metadata: {}});
    return {path: ruta};
  };
  const once = Array.from({length: 11}, (_, i) => crear(i + 1));
  await falla(ejecutar({...p.data, anexos: once}), "invalid-argument", /hasta 10/);
  const diez = once.slice(0, 10);
  const ok = await ejecutar({...p.data, anexos: diez});
  assert.equal(ok.ok, true);

  const q = preparar();
  const a = crear(1);
  await falla(ejecutar({...q.data, anexos: [{path: `${q.base}/anexo1_x.pdf`}, {path: `${q.base}/anexo1_x.pdf`}]}), "invalid-argument", /repetido/);
  await falla(ejecutar({...q.data, anexos: [{path: q.data.principal.path}]}), "invalid-argument");
  await falla(ejecutar({...q.data, anexos: "no-es-lista"}), "invalid-argument");
  await falla(ejecutar({...q.data, anexos: [a]}), "invalid-argument", /misma solicitud/);
});

test("anexos: el nombre debe ser anexo, anexoN o el de la página anterior", () => {
  const ok = (n) => solicitudes.validarRuta(`ficha-solicitudes/${UID}/1793700000000/${n}`, UID, "anexo");
  assert.equal(ok("anexo_a.pdf").nombre, "a.pdf");
  assert.equal(ok("anexo7_a.pdf").nombre, "a.pdf");
  assert.throws(() => ok("anexo123_a.pdf"));
  assert.throws(() => ok("anexoX_a.pdf"));
  assert.throws(() => ok("principal_a.pdf"));
  assert.throws(() => ok("subsanacion1_a.pdf"));
});
