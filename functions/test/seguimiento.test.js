// Pruebas de estados, bandeja del funcionario y subsanación (con Firestore, Storage y correo simulados).
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {ESTADO, reiniciar, funciones, Marca} = require("./fakes");
const estados = require("../estados.js");

const CIUDADANO = "ciudadanoUid1234567890abcdefgh";
const OTRO = "otroCiudadanoUid1234567890abcdef";
const FUNC_UID = "funcionarioUid1234567890abcdefg";
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("contenido ".repeat(30))]);
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from("zip".repeat(30))]);

const pedidoDe = (uid, email, data, extra = {}) => ({
  auth: {uid, token: {email, email_verified: true, auth_time: Date.now() / 1000 - 5, ...extra}},
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

let n = 0;
// Crea una solicitud ya registrada, como la dejaría registrarSolicitud.
function sembrar({estado = "Recibido", uid = CIUDADANO, minutos = 0, nombres = "ABANTO VILLAR NATALY", asunto = "Solicito copia", extra = {}} = {}) {
  const carpeta = String(1793700000000 + (++n) * 1000);
  const id = `${uid}_${carpeta}`;
  const fecha = new Marca(new Date(Date.now() - minutos * 60000));
  ESTADO.docs.set(`ficha-solicitud/${id}`, {
    userId: uid, correo: "ciudadano@correo.com",
    expediente: `2026-${String(n).padStart(6, "0")}`, anio: 2026, numero: n, estado, carpeta,
    historial: [{estado: "Recibido", fecha, por: "Sistema"}],
    remitente: {nombres, dni: "74292311", correo: "ciudadano@correo.com"},
    tipoDocumento: "solicitud", subDocumento: "simple", asunto,
    documentos: {principal: {name: "a.pdf", size: PDF.length, path: `ficha-solicitudes/${uid}/${carpeta}/principal_a.pdf`, url: "https://x/a", sha256: "0".repeat(64)}, anexos: []},
    creadoEn: fecha, ...extra,
  });
  return {id, carpeta, ref: `ficha-solicitud/${id}`};
}
const leer = (s) => ESTADO.docs.get(s.ref);

test.beforeEach(() => {
  reiniciar();
});

/* ------------------------------- Roles ------------------------------- */
test("miRol: solo el correo del encargado (o FUNCIONARIOS) es funcionario", async () => {
  assert.deepEqual(await funciones.miRol.run(comoFuncionario({})), {funcionario: true});
  assert.deepEqual(await funciones.miRol.run(comoCiudadano({})), {funcionario: false});
  // mayúsculas en el correo no engañan ni excluyen
  assert.deepEqual(await funciones.miRol.run(pedidoDe(FUNC_UID, "Encargado@Correo.com", {})), {funcionario: true});
  // sin verificar el correo no vale
  await falla(funciones.miRol.run(pedidoDe(FUNC_UID, "encargado@correo.com", {}, {email_verified: false})), "unauthenticated");
  await falla(funciones.miRol.run({data: {}}), "unauthenticated");
});

test("FUNCIONARIOS tiene prioridad sobre MAIL_TO y admite varios correos", async () => {
  process.env.FUNCIONARIOS = " ana@correo.com , luis@correo.com ";
  try {
    assert.deepEqual(await funciones.miRol.run(pedidoDe("u1", "ana@correo.com", {})), {funcionario: true});
    assert.deepEqual(await funciones.miRol.run(pedidoDe("u2", "luis@correo.com", {})), {funcionario: true});
    assert.deepEqual(await funciones.miRol.run(comoFuncionario({})), {funcionario: false}, "MAIL_TO deja de contar");
  } finally {
    delete process.env.FUNCIONARIOS;
  }
});

test("un ciudadano no puede usar ninguna función de la bandeja", async () => {
  const s = sembrar();
  await falla(funciones.bandejaListar.run(comoCiudadano({})), "permission-denied");
  await falla(funciones.bandejaDetalle.run(comoCiudadano({id: s.id})), "permission-denied");
  await falla(funciones.bandejaCambiarEstado.run(comoCiudadano({id: s.id, estado: "Atendido"})), "permission-denied");
  assert.equal(leer(s).estado, "Recibido", "no cambió nada");
  assert.equal(ESTADO.correos.length, 0);
});

/* ------------------------------ Bandeja ------------------------------ */
test("bandejaListar: ordena por fecha, cuenta por estado y filtra", async () => {
  sembrar({minutos: 30, nombres: "PEÑA ÑAHUI JOSÉ", asunto: "Licencia de funcionamiento"});
  sembrar({minutos: 20, estado: "Observado"});
  sembrar({minutos: 10, estado: "Atendido", nombres: "ROJAS DÍAZ MARÍA"});
  sembrar({minutos: 1, estado: "En revisión"});

  const todo = await funciones.bandejaListar.run(comoFuncionario({}));
  assert.equal(todo.total, 4);
  assert.equal(todo.filas[0].estado, "En revisión", "la más reciente primero");
  assert.deepEqual(todo.conteos, {"Recibido": 1, "En revisión": 1, "Observado": 1, "Atendido": 1, "Rechazado": 0});
  assert.equal(todo.truncado, false);

  const observadas = await funciones.bandejaListar.run(comoFuncionario({estado: "Observado"}));
  assert.equal(observadas.total, 1);
  assert.equal(observadas.filas[0].estado, "Observado");
  assert.equal(observadas.conteos["Recibido"], 1, "los conteos no dependen del filtro");

  // búsqueda sin importar mayúsculas ni tildes, por nombre, asunto, DNI y expediente
  assert.equal((await funciones.bandejaListar.run(comoFuncionario({texto: "pena nahui jose"}))).total, 1);
  assert.equal((await funciones.bandejaListar.run(comoFuncionario({texto: "PEÑA"}))).total, 1);
  assert.equal((await funciones.bandejaListar.run(comoFuncionario({texto: "LICENCIA"}))).total, 1);
  assert.equal((await funciones.bandejaListar.run(comoFuncionario({texto: "74292311"}))).total, 4);
  assert.equal((await funciones.bandejaListar.run(comoFuncionario({texto: todo.filas[1].expediente}))).total, 1);
  assert.equal((await funciones.bandejaListar.run(comoFuncionario({texto: "no-existe"}))).total, 0);
  // un estado inventado no filtra nada
  assert.equal((await funciones.bandejaListar.run(comoFuncionario({estado: "Inventado"}))).total, 4);
});

test("bandejaListar: las solicitudes antiguas (sin estado ni expediente) se muestran bien", async () => {
  ESTADO.docs.set("ficha-solicitud/AbCdEfGhIjKlMnOpQrSt", {
    userId: CIUDADANO, correo: "viejo@correo.com", tipoDocumento: "oficio", subDocumento: "simple", asunto: "Trámite antiguo",
    documentos: {principal: {name: "x.pdf", path: `ficha-solicitudes/${CIUDADANO}/1793729442979/principal_x.pdf`}},
    creadoEn: new Marca(new Date("2026-11-03T18:00:00Z")),
  });
  const r = await funciones.bandejaListar.run(comoFuncionario({}));
  assert.equal(r.filas[0].estado, "Recibido");
  assert.equal(r.filas[0].expediente, "1793729442979");
  assert.equal(r.filas[0].correo, "viejo@correo.com");
  assert.equal(r.filas[0].archivos, 1);
});

test("bandejaDetalle: devuelve todo con fechas en milisegundos y los cambios permitidos", async () => {
  const s = sembrar({estado: "En revisión"});
  const d = await funciones.bandejaDetalle.run(comoFuncionario({id: s.id}));
  assert.equal(d.id, s.id);
  assert.equal(d.estado, "En revisión");
  assert.deepEqual(d.transiciones, ["Observado", "Atendido", "Rechazado"]);
  assert.equal(typeof d.creadoEn, "number");
  assert.equal(typeof d.historial[0].fecha, "number");
  assert.equal(d.remitente.dni, "74292311");
  await falla(funciones.bandejaDetalle.run(comoFuncionario({id: "NoExisteNoExisteNoExiste"})), "not-found");
  await falla(funciones.bandejaDetalle.run(comoFuncionario({id: "../etc"})), "invalid-argument");
  await falla(funciones.bandejaDetalle.run(comoFuncionario({})), "invalid-argument");
});

/* --------------------------- Cambio de estado --------------------------- */
test("cambiar a En revisión: guarda historial, audita y avisa por correo al ciudadano", async () => {
  const s = sembrar();
  const r = await funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "En revisión"}));
  assert.deepEqual(r, {ok: true, estado: "En revisión", correoEnviado: true});
  const f = leer(s);
  assert.equal(f.estado, "En revisión");
  assert.equal(f.historial.length, 2);
  assert.equal(f.historial[1].estado, "En revisión");
  assert.equal(f.historial[1].por, "Mesa de partes", "no se expone quién fue");
  assert.equal(f.observacion, null);

  assert.equal(ESTADO.correos.length, 1);
  assert.equal(ESTADO.correos[0].to, "ciudadano@correo.com");
  assert.match(ESTADO.correos[0].subject, /2026-000\d+: En revisión/);

  const auditoria = [...ESTADO.docs.entries()].filter(([k]) => k.startsWith("auditoria/")).map(([, v]) => v);
  assert.equal(auditoria.length, 1);
  assert.equal(auditoria[0].correo, "encargado@correo.com");
  assert.equal(auditoria[0].de, "Recibido");
  assert.equal(auditoria[0].a, "En revisión");
});

test("Observado y Rechazado exigen el motivo; los demás no", async () => {
  const s = sembrar();
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Observado"})), "invalid-argument", /motivo/);
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Observado", mensaje: "   "})), "invalid-argument", /motivo/);
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Rechazado"})), "invalid-argument", /motivo/);
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Observado", mensaje: "x".repeat(1001)})), "invalid-argument", /1000/);
  assert.equal(leer(s).estado, "Recibido", "nada cambió");
  const ok = await funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido"}));
  assert.equal(ok.estado, "Atendido");
});

test("Observado: guarda la observación y el correo la explica con el enlace a Mis Trámites", async () => {
  const s = sembrar();
  await funciones.bandejaCambiarEstado.run(comoFuncionario({
    id: s.id, estado: "Observado", mensaje: "Falta la copia del DNI.\nAdjúntala <b>hoy</b>.",
  }));
  const f = leer(s);
  assert.equal(f.observacion.mensaje, "Falta la copia del DNI.\nAdjúntala <b>hoy</b>.");
  assert.equal(f.historial[1].mensaje, f.observacion.mensaje);
  const html = ESTADO.correos[0].html;
  assert.match(html, /Falta la copia del DNI\.<br>Adjúntala &lt;b&gt;hoy&lt;\/b&gt;\./, "el mensaje se escapa y respeta los saltos de línea");
  assert.match(html, /Subsanar/);
  assert.match(html, /procedure\.html/);
});

test("transiciones: no se vuelve atrás ni se sale de un estado final", async () => {
  const s = sembrar();
  await funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "En revisión"}));
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Recibido"})), "failed-precondition", /No se puede pasar/);
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "En revisión"})), "failed-precondition");
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Cualquiera"})), "invalid-argument", /no es válido/);
  await funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", mensaje: "Listo."}));
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Rechazado", mensaje: "x"})), "failed-precondition", /ya está atendido/);
  assert.equal(leer(s).estado, "Atendido");
  assert.equal(leer(s).historial.length, 3);
  await falla(funciones.bandejaCambiarEstado.run(comoFuncionario({id: "NoExisteNoExisteNoExiste", estado: "Atendido"})), "not-found");
});

test("un fallo del correo no deshace el cambio de estado", async () => {
  const s = sembrar();
  ESTADO.fallaCorreo = true;
  const r = await funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "En revisión"}));
  assert.equal(r.ok, true);
  assert.equal(r.correoEnviado, false);
  assert.equal(leer(s).estado, "En revisión");
});

test("las reglas de estados (módulo puro)", () => {
  assert.equal(estados.estadoDe({}), "Recibido");
  assert.equal(estados.estadoDe({estado: "Basura"}), "Recibido");
  assert.equal(estados.estadoDe({estado: "Atendido"}), "Atendido");
  assert.deepEqual(estados.TRANSICIONES["Observado"], ["Atendido", "Rechazado"], "de Observado solo se sale por subsanación o cierre");
  assert.equal(estados.validarCambioEstado("Recibido", "Atendido", "  ok  "), "ok");
});

/* ----------------------------- Subsanación ----------------------------- */
function subirArchivos(s, uid = CIUDADANO, nombres = ["dni.pdf"]) {
  return nombres.map((nombre, i) => {
    const ruta = `ficha-solicitudes/${uid}/${s.carpeta}/subsanacion${1793800000000 + i}_${nombre}`;
    const esDocx = nombre.endsWith(".docx");
    ESTADO.archivos.set(ruta, {buf: esDocx ? DOCX : PDF, contentType: esDocx ? "application/octet-stream" : "application/pdf", metadata: {}});
    return {path: ruta};
  });
}

test("subsanar: verifica los archivos, vuelve a En revisión y avisa al encargado", async () => {
  const s = sembrar({estado: "Observado", extra: {observacion: {mensaje: "Falta DNI", fecha: new Marca(new Date())}}});
  const archivos = subirArchivos(s, CIUDADANO, ["dni.pdf", "carta.docx"]);
  const r = await funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, comentario: "Adjunto lo pedido.", archivos}));
  assert.deepEqual(r, {ok: true, estado: "En revisión", correoEncargado: true});

  const f = leer(s);
  assert.equal(f.estado, "En revisión");
  assert.equal(f.observacion, null);
  assert.equal(f.subsanaciones.length, 1);
  assert.equal(f.subsanaciones[0].comentario, "Adjunto lo pedido.");
  assert.equal(f.subsanaciones[0].archivos.length, 2);
  assert.equal(f.subsanaciones[0].archivos[0].sha256, crypto.createHash("sha256").update(PDF).digest("hex"));
  assert.ok(f.subsanaciones[0].archivos[0].url.includes("token="));
  const ultimo = f.historial[f.historial.length - 1];
  assert.equal(ultimo.estado, "En revisión");
  assert.equal(ultimo.por, "Ciudadano");
  assert.equal(ultimo.mensaje, "Adjunto lo pedido.");

  assert.equal(ESTADO.correos.length, 1);
  assert.equal(ESTADO.correos[0].to, "encargado@correo.com");
  assert.match(ESTADO.correos[0].subject, /Subsanación recibida/);
  assert.match(ESTADO.correos[0].html, /<strong>2<\/strong> archivos agregados/);
  assert.match(ESTADO.correos[0].html, /bandeja\.html/);
});

test("subsanar: solo si la solicitud está Observada y es del usuario", async () => {
  const sNo = sembrar({estado: "En revisión"});
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: sNo.id, archivos: subirArchivos(sNo)})), "failed-precondition", /observación pendiente/);

  const ajena = sembrar({estado: "Observado", uid: OTRO});
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: ajena.id, archivos: subirArchivos(ajena, CIUDADANO)})), "permission-denied");
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: "NoExisteNoExisteNoExiste", archivos: subirArchivos(sNo)})), "permission-denied");
  assert.equal(leer(sNo).estado, "En revisión");
  assert.equal(ESTADO.correos.length, 0);
});

test("subsanar: valida archivos, carpeta y comentario", async () => {
  const s = sembrar({estado: "Observado"});
  const ok = subirArchivos(s);
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, archivos: []})), "invalid-argument", /al menos un archivo/);
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id})), "invalid-argument", /al menos un archivo/);
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, archivos: ok, comentario: "x".repeat(501)})), "invalid-argument", /500/);
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, archivos: [{path: `ficha-solicitudes/${CIUDADANO}/${s.carpeta}/principal_x.pdf`}]})), "invalid-argument");
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, archivos: [{path: `ficha-solicitudes/${OTRO}/${s.carpeta}/subsanacion1_x.pdf`}]})), "invalid-argument");
  // archivos de otra solicitud (otra carpeta)
  const otra = sembrar({estado: "Observado"});
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, archivos: subirArchivos(otra)})), "invalid-argument", /no pertenecen/);
  // contenido que no corresponde a su extensión
  const falso = subirArchivos(s, CIUDADANO, ["raro.pdf"]);
  ESTADO.archivos.get(falso[0].path).buf = Buffer.from("MZ ejecutable");
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, archivos: falso})), "invalid-argument", /no es un PDF válido/);
  // archivo no subido
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, archivos: [{path: `ficha-solicitudes/${CIUDADANO}/${s.carpeta}/subsanacion9_noexiste.pdf`}]})), "failed-precondition", /No se encontró/);
  assert.equal(leer(s).estado, "Observado", "ninguna falla cambió el estado");
});

test("subsanar: máximo 10 archivos", async () => {
  const s = sembrar({estado: "Observado"});
  const once = subirArchivos(s, CIUDADANO, Array.from({length: 11}, (_, i) => `a${i}.pdf`));
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, archivos: once})), "invalid-argument", /hasta 10/);
  const diez = subirArchivos(s, CIUDADANO, Array.from({length: 10}, (_, i) => `b${i}.pdf`));
  const r = await funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, archivos: diez}));
  assert.equal(r.ok, true);
});

test("subsanar: solicitudes antiguas (sin carpeta) usan la de su archivo principal", async () => {
  const s = sembrar({estado: "Observado"});
  const f = leer(s);
  delete f.carpeta; // como las solicitudes anteriores a los expedientes numerados
  const r = await funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, archivos: subirArchivos(s)}));
  assert.equal(r.ok, true);
});

test("subsanar: el ciclo completo Observado -> subsanación -> Atendido", async () => {
  const s = sembrar();
  await funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Observado", mensaje: "Falta el DNI."}));
  await funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, comentario: "Ahí va.", archivos: subirArchivos(s)}));
  assert.equal(leer(s).estado, "En revisión");
  await funciones.bandejaCambiarEstado.run(comoFuncionario({id: s.id, estado: "Atendido", mensaje: "Todo en orden."}));
  const f = leer(s);
  assert.deepEqual(f.historial.map((h) => h.estado), ["Recibido", "Observado", "En revisión", "Atendido"]);
  assert.deepEqual(f.historial.map((h) => h.por), ["Sistema", "Mesa de partes", "Ciudadano", "Mesa de partes"]);
  // ya no se puede subsanar
  await falla(funciones.subsanarSolicitud.run(comoCiudadano({solicitudId: s.id, archivos: subirArchivos(s, CIUDADANO, ["otra.pdf"])})), "failed-precondition");
});
