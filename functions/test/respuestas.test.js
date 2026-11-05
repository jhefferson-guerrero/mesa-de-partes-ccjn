// Pruebas de la respuesta del funcionario con documentos y de los mensajes sueltos
// (con Firestore, Storage y correo simulados).
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {ESTADO, reiniciar, funciones, Marca} = require("./fakes");

const CIUDADANO = "ciudadanoUid1234567890abcdefgh";
const OTRO = "otroCiudadanoUid1234567890abcdef";
const FUNC_UID = "funcionarioUid1234567890abcdefg";
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("contenido ".repeat(30))]);
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from("zip".repeat(30))]);

const pedidoDe = (uid, email, data) => ({
  auth: {uid, token: {email, email_verified: true, auth_time: Date.now() / 1000 - 5}},
  data,
});
const comoFuncionario = (data) => pedidoDe(FUNC_UID, "encargado@correo.com", data);
const comoCiudadano = (data, uid = CIUDADANO) => pedidoDe(uid, "ciudadano@correo.com", data);

async function falla(promesa, codigo, texto) {
  await assert.rejects(promesa, (e) => {
    assert.equal(e.code, codigo, `código esperado ${codigo}, llegó ${e.code}: ${e.message}`);
    if (texto) assert.match(e.message, texto);
    return true;
  });
}

let n = 500;
function sembrar({estado = "Recibido", uid = CIUDADANO} = {}) {
  const carpeta = String(1793700000000 + (++n) * 1000);
  const id = `${uid}_${carpeta}`;
  const fecha = new Marca(new Date());
  ESTADO.docs.set(`ficha-solicitud/${id}`, {
    userId: uid, correo: "ciudadano@correo.com",
    expediente: `2026-${String(n).padStart(6, "0")}`, anio: 2026, numero: n, estado, carpeta,
    historial: [{estado: "Recibido", fecha, por: "Sistema"}],
    remitente: {nombres: "ABANTO VILLAR NATALY", dni: "74292311", correo: "ciudadano@correo.com"},
    tipoDocumento: "solicitud", subDocumento: "simple", asunto: "Solicito copia",
    documentos: {principal: {name: "a.pdf", size: PDF.length, path: `ficha-solicitudes/${uid}/${carpeta}/principal_a.pdf`, url: "https://x/a", sha256: "0".repeat(64)}, anexos: []},
    creadoEn: fecha,
  });
  return {id, carpeta, ref: `ficha-solicitud/${id}`};
}
const leer = (s) => ESTADO.docs.get(s.ref);

test.beforeEach(() => {
  reiniciar();
});

/* ----------------------- Respuesta con documentos ----------------------- */
function subirRespuesta(s, nombres = ["resolucion.pdf"], uid = FUNC_UID) {
  return nombres.map((nombre, i) => {
    const ruta = `respuestas/${uid}/${s.id}/respuesta${1793900000000 + i}_${nombre}`;
    ESTADO.archivos.set(ruta, {buf: PDF, contentType: "application/pdf", metadata: {}});
    return {path: ruta};
  });
}

test("atender con documentos: se guardan en la respuesta, van por correo y quedan en el expediente", async () => {
  const s = sembrar({estado: "En revisión"});
  const archivos = subirRespuesta(s, ["resolucion.pdf", "constancia.pdf"]);
  const r = await funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", mensaje: "Adjunto la resolución.", archivos}));
  assert.deepEqual(r, {ok: true, estado: "Atendido", correoEnviado: true});

  const f = leer(s);
  assert.equal(f.respuesta.estado, "Atendido");
  assert.equal(f.respuesta.mensaje, "Adjunto la resolución.");
  assert.equal(f.respuesta.archivos.length, 2);
  assert.equal(f.respuesta.archivos[0].name, "resolucion.pdf");
  assert.equal(f.respuesta.archivos[0].sha256, crypto.createHash("sha256").update(PDF).digest("hex"));
  assert.ok(f.respuesta.archivos[0].url.includes("token="));

  const correo = ESTADO.correos[0];
  assert.equal(correo.to, "ciudadano@correo.com");
  assert.equal(correo.attachments.length, 2, "los PDF van pegados al correo");
  assert.equal(correo.attachments[0].filename, "resolucion.pdf");
  assert.match(correo.html, /Documentos de respuesta/);
  assert.match(correo.html, /constancia\.pdf/);
  assert.match(correo.html, /también van adjuntos/);
});

test("rechazar con documentos, atender sin documentos y sin nada: la respuesta se guarda cuando hay algo que mostrar", async () => {
  const a = sembrar();
  await funciones.bandejaCambiarEstado.run(comoFuncionario({id: a.id, estado: "Rechazado", mensaje: "No corresponde.", archivos: subirRespuesta(a)}));
  assert.equal(leer(a).respuesta.estado, "Rechazado");
  const b = sembrar();
  await funciones.bandejaCambiarEstado.run(comoFuncionario({id: b.id, estado: "Atendido", mensaje: "Listo."}));
  assert.deepEqual(leer(b).respuesta.archivos, []);
  const c = sembrar();
  await funciones.bandejaCambiarEstado.run(comoFuncionario({id: c.id, estado: "Atendido"}));
  assert.equal(leer(c).respuesta, undefined);
});

test("los documentos de respuesta solo valen al atender o rechazar, y se validan", async () => {
  const s = sembrar();
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "En revisión", archivos: subirRespuesta(s)})), "invalid-argument", /al atender o rechazar/);
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Observado", mensaje: "x", archivos: subirRespuesta(s)})), "invalid-argument", /al atender o rechazar/);
  // de otro funcionario o de otra solicitud
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", archivos: subirRespuesta(s, ["a.pdf"], "otroFuncionarioUid1234567890abcd")})), "invalid-argument", /ruta/);
  const otra = sembrar();
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", archivos: subirRespuesta(otra)})), "invalid-argument", /ruta/);
  // solo PDF, con nombre válido, sin repetidos y como máximo 5
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", archivos: subirRespuesta(s, ["carta.docx"])})), "invalid-argument", /PDF/);
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", archivos: [{path: `respuestas/${FUNC_UID}/${s.id}/../x.pdf`}]})), "invalid-argument");
  const uno = subirRespuesta(s);
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", archivos: [uno[0], uno[0]]})), "invalid-argument", /repetido/);
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", archivos: subirRespuesta(s, ["1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf", "6.pdf"])})), "invalid-argument", /hasta 5/);
  // el contenido debe ser un PDF de verdad y el archivo debe existir
  const falso = `respuestas/${FUNC_UID}/${s.id}/respuesta1793900000099_falso.pdf`;
  ESTADO.archivos.set(falso, {buf: DOCX, contentType: "application/pdf", metadata: {}});
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", archivos: [{path: falso}]})), "invalid-argument", /no es un PDF válido/);
  const fantasma = `respuestas/${FUNC_UID}/${s.id}/respuesta1793900000098_fantasma.pdf`;
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", archivos: [{path: fantasma}]})), "failed-precondition", /No se encontró/);
  assert.equal(leer(s).estado, "Recibido", "ningún intento cambió el estado");
  assert.equal(ESTADO.correos.length, 0);
});

test("un ciudadano no puede adjuntar respuestas", async () => {
  const s = sembrar();
  await falla(funciones.bandejaCambiarEstado.run(comoCiudadano({id: s.id, estado: "Atendido", archivos: subirRespuesta(s, ["a.pdf"], CIUDADANO)})), "permission-denied");
  assert.equal(leer(s).estado, "Recibido");
});

test("respuesta con documentos muy pesados: van como enlaces, no pegados al correo", async () => {
  const s = sembrar();
  const grande = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(8 * 1024 * 1024)]);
  const archivos = ["a.pdf", "b.pdf"].map((nombre, i) => {
    const ruta = `respuestas/${FUNC_UID}/${s.id}/respuesta${1793900000000 + i}_${nombre}`;
    ESTADO.archivos.set(ruta, {buf: grande, contentType: "application/pdf", metadata: {}});
    return {path: ruta};
  });
  await funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", mensaje: "Ver enlaces.", archivos}));
  assert.equal(ESTADO.correos[0].attachments.length, 0);
  assert.match(ESTADO.correos[0].html, /a\.pdf/);
  assert.doesNotMatch(ESTADO.correos[0].html, /también van adjuntos/);
});

/* ------------------------------- Mensajes ------------------------------- */
test("la mesa de partes escribe sin cambiar el estado y el ciudadano recibe el correo", async () => {
  const s = sembrar({estado: "En revisión"});
  const r = await funciones.bandejaMensaje.run(comoFuncionario({id: s.id, texto: "¿Puede indicarnos el número de <b>lote</b>?"}));
  assert.deepEqual(r, {ok: true, correoEnviado: true});
  const f = leer(s);
  assert.equal(f.estado, "En revisión", "el estado no cambia");
  assert.equal(f.historial.length, 1);
  assert.equal(f.mensajes.length, 1);
  assert.equal(f.mensajes[0].de, "Mesa de partes");
  assert.equal(f.mensajes[0].texto, "¿Puede indicarnos el número de <b>lote</b>?");
  assert.equal(ESTADO.correos[0].to, "ciudadano@correo.com");
  assert.match(ESTADO.correos[0].html, /&lt;b&gt;lote&lt;\/b&gt;/, "el texto se escapa");
  assert.match(ESTADO.correos[0].html, /procedure\.html/);
  const audit = [...ESTADO.docs.entries()].filter(([k]) => k.startsWith("auditoria/")).map(([, v]) => v);
  assert.equal(audit[0].accion, "mensaje");
  assert.equal(audit[0].correo, "encargado@correo.com");
});

test("el ciudadano responde cuando quiera (no solo si está observado) y se avisa al encargado", async () => {
  const s = sembrar();
  await funciones.bandejaMensaje.run(comoFuncionario({id: s.id, texto: "¿Lote?"}));
  const r = await funciones.enviarMensaje.run(comoCiudadano({solicitudId: s.id, texto: "Es el lote 7."}));
  assert.deepEqual(r, {ok: true, correoEncargado: true});
  const f = leer(s);
  assert.equal(f.estado, "Recibido");
  assert.deepEqual(f.mensajes.map((m) => m.de), ["Mesa de partes", "Ciudadano"]);
  assert.equal(ESTADO.correos[1].to, "encargado@correo.com");
  assert.match(ESTADO.correos[1].subject, /Mensaje del ciudadano/);
  assert.match(ESTADO.correos[1].html, /Es el lote 7\./);
  // la bandeja marca los expedientes donde el último mensaje es del ciudadano
  assert.equal((await funciones.bandejaListar.run(comoFuncionario({}))).filas[0].mensajePendiente, true);
  await funciones.bandejaMensaje.run(comoFuncionario({id: s.id, texto: "Gracias."}));
  assert.equal((await funciones.bandejaListar.run(comoFuncionario({}))).filas[0].mensajePendiente, false);
});

test("mensajes: validaciones, propiedad, trámite cerrado, máximo y permisos", async () => {
  const s = sembrar();
  await falla(funciones.enviarMensaje.run(comoCiudadano({solicitudId: s.id, texto: "   "})), "invalid-argument", /Escribe/);
  await falla(funciones.enviarMensaje.run(comoCiudadano({solicitudId: s.id, texto: "x".repeat(1001)})), "invalid-argument", /1000/);
  await falla(funciones.enviarMensaje.run(comoCiudadano({solicitudId: s.id, texto: "hola"}, OTRO)), "permission-denied");
  await falla(funciones.enviarMensaje.run(comoCiudadano({solicitudId: "NoExisteNoExisteNoExiste", texto: "hola"})), "permission-denied");
  await falla(funciones.enviarMensaje.run({data: {solicitudId: s.id, texto: "hola"}}), "unauthenticated");
  await falla(funciones.bandejaMensaje.run(comoCiudadano({id: s.id, texto: "hola"})), "permission-denied");
  await falla(funciones.bandejaMensaje.run(comoFuncionario({id: "NoExisteNoExisteNoExiste", texto: "hola"})), "not-found");
  assert.equal(leer(s).mensajes, undefined, "nada se guardó");

  ESTADO.docs.set(s.ref, {...leer(s), mensajes: Array.from({length: 100}, () => ({de: "Ciudadano", fecha: new Marca(new Date()), texto: "x"}))});
  await falla(funciones.enviarMensaje.run(comoCiudadano({solicitudId: s.id, texto: "uno más"})), "failed-precondition", /máximo/);

  const c = sembrar({estado: "Atendido"});
  await falla(funciones.enviarMensaje.run(comoCiudadano({solicitudId: c.id, texto: "hola"})), "failed-precondition", /ya está atendido/);
  await falla(funciones.bandejaMensaje.run(comoFuncionario({id: c.id, texto: "hola"})), "failed-precondition", /ya está atendido/);
});

test("mensajes: 20 por hora por ciudadano, sin afectar el límite de envíos de solicitudes", async () => {
  const s = sembrar();
  for (let i = 0; i < 20; i++) await funciones.enviarMensaje.run(comoCiudadano({solicitudId: s.id, texto: `mensaje ${i}`}));
  await falla(funciones.enviarMensaje.run(comoCiudadano({solicitudId: s.id, texto: "uno más"})), "resource-exhausted");
  assert.equal(leer(s).mensajes.length, 20);
  assert.equal(ESTADO.docs.get(`limites/${CIUDADANO}`), undefined);
});

test("un fallo del correo no deshace el mensaje", async () => {
  const s = sembrar();
  ESTADO.fallaCorreo = true;
  const r = await funciones.bandejaMensaje.run(comoFuncionario({id: s.id, texto: "Hola"}));
  assert.equal(r.ok, true);
  assert.equal(r.correoEnviado, false);
  assert.equal(leer(s).mensajes.length, 1);
});
