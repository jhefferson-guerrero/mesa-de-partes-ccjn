// /js/bandeja.js
// Bandeja del funcionario: lista las solicitudes, muestra el detalle y permite cambiar el estado.
// Todo pasa por funciones del servidor, que comprueban que la persona sea funcionario.
import { auth, app } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";
import { mostrarMensaje, confirmar } from "./ui-modal.js";
import {
  ESTADOS, el, seccion, datos, listaArchivos, historial, insigniaEstado, archivosDe, fechaCorta,
  respuestaSeccion, seccionMensajes, chipsArchivos, problemaConPdf, MAX_RESPUESTA,
} from "./detalle-ui.js";

const functions = getFunctions(app, "us-central1");
const llamar = async (nombre, parametros) => (await httpsCallable(functions, nombre)(parametros)).data;
const $ = (id) => document.getElementById(id);
const COLUMNAS = 7;

const estado = {
  filas: [], total: 0, conteos: {}, truncado: false,
  filtroEstado: "", texto: "", pagina: 1, tamano: 15,
  cargando: true, error: false, detalleId: null,
};
let peticion = 0; // para ignorar respuestas viejas si se busca rápido

/* ------------------------------ Lista ------------------------------ */

async function cargar() {
  const mia = ++peticion;
  estado.cargando = true;
  render();
  try {
    const r = await llamar("bandejaListar", { estado: estado.filtroEstado, texto: estado.texto });
    if (mia !== peticion) return;
    Object.assign(estado, { filas: r.filas, total: r.total, conteos: r.conteos, truncado: r.truncado, error: false });
  } catch (err) {
    if (mia !== peticion) return;
    console.error("No se pudo cargar la bandeja:", err);
    estado.error = true;
  }
  estado.cargando = false;
  render();
}

function mostrarFila(mensaje) {
  const tbody = $("bandejaCuerpo");
  const tr = el("tr", "fila-estado");
  const td = el("td", "", mensaje);
  td.colSpan = COLUMNAS;
  tr.appendChild(td);
  tbody.replaceChildren(tr);
}

function renderChips() {
  const caja = $("bandejaChips");
  const suma = ESTADOS.reduce((n, e) => n + (estado.conteos[e] || 0), 0);
  const chips = [["", "Todos", suma], ...ESTADOS.map((e) => [e, e, estado.conteos[e] || 0])].map(([valor, texto, cantidad]) => {
    const b = el("button", "chip-estado" + (estado.filtroEstado === valor ? " activo" : ""));
    b.type = "button";
    b.setAttribute("aria-pressed", String(estado.filtroEstado === valor));
    b.dataset.estado = valor;
    b.append(el("span", "chip-texto", texto), el("span", "chip-num", String(cantidad)));
    b.addEventListener("click", () => {
      estado.filtroEstado = valor;
      estado.pagina = 1;
      cargar();
    });
    return b;
  });
  caja.replaceChildren(...chips);
}

function celda(...hijos) {
  const td = document.createElement("td");
  td.append(...hijos);
  return td;
}

function filaDe(f) {
  const tr = el("tr");
  if (f.estado === "Observado") tr.classList.add("fila-observada");

  const abrir = el("button", "link-expediente expediente-number", f.expediente);
  abrir.type = "button";
  abrir.title = "Abrir la solicitud";
  abrir.addEventListener("click", () => abrirDetalle(f.id));
  tr.appendChild(celda(el("div", "expediente-cell", "")));
  tr.lastChild.firstChild.appendChild(abrir);

  tr.appendChild(celda(el("div", "date-cell", fechaCorta(f.creadoEn))));

  const quien = el("div", "remitente-cell");
  const nombre = el("strong", "remitente-nombre", f.nombres || "(sin nombre)");
  nombre.title = f.nombres;
  quien.append(nombre, el("small", "remitente-dni", [f.dni && `DNI ${f.dni}`, f.correo].filter(Boolean).join(" · ")));
  tr.appendChild(celda(quien));

  const tipo = el("div", "tipo-cell");
  tipo.append(el("span", "tipo-text", f.tipo.toUpperCase()), el("small", "sub-text", f.subTipo.toUpperCase()));
  tr.appendChild(celda(tipo));

  const asunto = el("span", "asunto-text", f.asunto || "—");
  asunto.title = f.asunto;
  tr.appendChild(celda(asunto));

  const tdEstado = celda(insigniaEstado(f.estado));
  if (f.mensajePendiente) {
    // El ciudadano escribió y la mesa de partes todavía no le respondió.
    const aviso = el("span", "aviso-mensaje");
    aviso.title = "El ciudadano escribió un mensaje y espera respuesta";
    aviso.setAttribute("aria-label", aviso.title);
    const ic = el("i", "fa-solid fa-comment-dots");
    ic.setAttribute("aria-hidden", "true");
    aviso.appendChild(ic);
    tdEstado.appendChild(aviso);
  }
  tdEstado.className = "status";
  tr.appendChild(tdEstado);

  const btn = el("button", "btn-abrir", "Abrir");
  btn.type = "button";
  btn.addEventListener("click", () => abrirDetalle(f.id));
  tr.appendChild(celda(btn));
  return tr;
}

function render() {
  renderChips();

  const hayFiltros = Boolean(estado.filtroEstado || estado.texto);
  $("bandejaLimpiar").disabled = !hayFiltros;

  const totalPaginas = Math.max(1, Math.ceil(estado.filas.length / estado.tamano));
  estado.pagina = Math.min(Math.max(1, estado.pagina), totalPaginas);
  const ini = (estado.pagina - 1) * estado.tamano;
  const fin = Math.min(ini + estado.tamano, estado.filas.length);

  // Resumen y paginación
  const resumen = $("bandejaResumen");
  if (estado.cargando) resumen.textContent = "";
  else if (estado.error) resumen.textContent = "";
  else {
    const cuenta = estado.total === 1 ? "1 solicitud" : `${estado.total} solicitudes`;
    resumen.textContent = (hayFiltros ? `${cuenta} coinciden con los filtros.` : `${cuenta} en total.`) +
      (estado.truncado ? " Se muestran las 1000 más recientes." : "");
  }
  $("bandejaPagInfo").textContent = estado.cargando || estado.error || estado.filas.length === 0 ? "" :
    `Mostrando ${ini + 1}–${fin} de ${estado.filas.length} · Página ${estado.pagina} de ${totalPaginas}`;

  const [primera, anterior, numero, siguiente, ultima] = document.querySelectorAll(".pagination-controls .pagination-btn");
  numero.textContent = String(estado.pagina);
  primera.disabled = anterior.disabled = estado.pagina <= 1;
  siguiente.disabled = ultima.disabled = estado.pagina >= totalPaginas;
  primera.onclick = () => { estado.pagina = 1; render(); };
  anterior.onclick = () => { estado.pagina -= 1; render(); };
  siguiente.onclick = () => { estado.pagina += 1; render(); };
  ultima.onclick = () => { estado.pagina = totalPaginas; render(); };

  // Filas
  if (estado.cargando && estado.filas.length === 0) return mostrarFila("Cargando solicitudes…");
  if (estado.error) return mostrarFila("No se pudo cargar la bandeja. Pulsa «Actualizar» para reintentar.");
  if (estado.filas.length === 0) return mostrarFila(hayFiltros ? "No hay solicitudes con esos filtros." : "Aún no hay solicitudes.");
  $("bandejaCuerpo").replaceChildren(...estado.filas.slice(ini, fin).map(filaDe));
}

/* ------------------------------ Detalle ------------------------------ */

function cerrarDetalle() {
  $("detalleModal").style.display = "none";
  estado.detalleId = null;
}

async function abrirDetalle(id) {
  estado.detalleId = id;
  $("detalleTitulo").textContent = "Expediente";
  $("detalleEstado").replaceChildren();
  $("detalleCuerpo").replaceChildren(el("p", "detalle-vacio", "Cargando…"));
  $("detalleModal").style.display = "flex";
  try {
    const d = await llamar("bandejaDetalle", { id });
    if (estado.detalleId !== id) return;
    dibujar(d);
  } catch (err) {
    console.error("No se pudo cargar el detalle:", err);
    if (estado.detalleId === id) {
      $("detalleCuerpo").replaceChildren(el("p", "detalle-vacio", "No se pudo cargar la solicitud. Cierra esta ventana e inténtalo de nuevo."));
    }
  }
}

function dibujar(d, { irAMensajes = false } = {}) {
  $("detalleTitulo").textContent = `Expediente ${d.expediente}`;
  $("detalleEstado").replaceChildren(insigniaEstado(d.estado));

  const r = d.remitente || {};
  const izquierda = el("div", "detalle-col");
  const respuesta = respuestaSeccion(d);
  if (respuesta) izquierda.appendChild(respuesta);
  izquierda.append(
    seccion("Remitente", datos([
      ["Apellidos y nombres", r.nombres || "—", true],
      ["DNI", r.dni],
      ["Correo", r.correo || d.correo],
    ])),
    seccion("Datos del trámite", datos([
      ["Fecha de envío", fechaCorta(d.creadoEn)],
      ["Tipo de documento", String(d.tipoDocumento || "").toUpperCase()],
      ["Tipo de sub documento", String(d.subDocumento || "").toUpperCase()],
      ["Asunto", d.asunto, true],
    ])),
    seccion("Archivos", listaArchivos(archivosDe(d)))
  );

  const derecha = el("div", "detalle-col");
  const mensajes = seccionMensajes(d, "Mesa de partes", {
    puedeEscribir: Boolean(d.transiciones && d.transiciones.length > 0), // un trámite cerrado ya no admite mensajes
    placeholder: "Escribe un mensaje al ciudadano (no cambia el estado)…",
    alEnviar: (texto) => enviarMensaje(d.id, texto),
  });
  derecha.append(panelAcciones(d));
  if (mensajes) derecha.appendChild(mensajes);
  derecha.appendChild(seccion("Seguimiento", historial(d.historial)));

  const dos = el("div", "detalle-dos-columnas");
  dos.append(izquierda, derecha);
  const cuerpo = $("detalleCuerpo");
  cuerpo.replaceChildren(dos);
  cuerpo.scrollTop = 0;
  if (irAMensajes) $("seccionMensajes")?.scrollIntoView({ block: "nearest" });
}

// Escribe al ciudadano sin cambiar el estado. Devuelve true si se envió.
async function enviarMensaje(id, texto) {
  try {
    const r = await llamar("bandejaMensaje", { id, texto });
    if (!r.correoEnviado) {
      mostrarMensaje("El mensaje quedó guardado en el trámite, pero no se pudo avisar al ciudadano por correo.", { tipo: "aviso", titulo: "Mensaje guardado" });
    }
  } catch (err) {
    console.error(err);
    const codigo = String(err?.code || "");
    const explicable = codigo === "functions/invalid-argument" || codigo === "functions/failed-precondition";
    mostrarMensaje(explicable ? err.message : "No se pudo enviar el mensaje. Inténtalo nuevamente.", {
      tipo: explicable ? "aviso" : "error", titulo: "No se pudo enviar",
    });
    if (codigo === "functions/failed-precondition") { cargar(); abrirDetalle(id); } // alguien más lo cerró
    return false;
  }
  // Ya se envió: si falla la relectura solo se deja la vista como estaba.
  try {
    const d = await llamar("bandejaDetalle", { id });
    if (estado.detalleId === id) dibujar(d, { irAMensajes: true });
  } catch (err) {
    console.error("No se pudo actualizar la conversación:", err);
  }
  cargar(); // quita la marca de «espera respuesta» de la lista
  return true;
}

const AYUDA = {
  "En revisión": "Opcional. Se le avisa al ciudadano por correo.",
  "Observado": "Obligatorio. Explica qué debe corregir o adjuntar; el ciudadano lo verá y podrá subsanar.",
  "Atendido": "Opcional. Por ejemplo, el resultado o cómo recoger la respuesta. Cierra el trámite.",
  "Rechazado": "Obligatorio. Explica el motivo. Cierra el trámite.",
};
const MOTIVO_OBLIGATORIO = ["Observado", "Rechazado"];
const CIERRA = ["Atendido", "Rechazado"]; // solo estos admiten documentos de respuesta

function panelAcciones(d) {
  const caja = el("section", "detalle-seccion panel-estado");
  caja.appendChild(el("h4", "detalle-titulo", "Actualizar estado"));

  if (!d.transiciones || d.transiciones.length === 0) {
    caja.appendChild(el("p", "detalle-vacio", `Este trámite está ${d.estado.toLowerCase()} y ya no admite cambios.`));
    return caja;
  }

  const etSelect = el("label", "panel-etiqueta", "Nuevo estado");
  etSelect.htmlFor = "nuevoEstado";
  const select = el("select", "filter-select");
  select.id = "nuevoEstado";
  d.transiciones.forEach((e) => select.appendChild(new Option(e, e)));

  const etMensaje = el("label", "panel-etiqueta");
  etMensaje.htmlFor = "mensajeEstado";
  const mensaje = el("textarea", "form-control");
  mensaje.id = "mensajeEstado";
  mensaje.rows = 4;
  mensaje.maxLength = 1000;
  const ayuda = el("p", "detalle-ayuda");

  // Documentos de respuesta (PDF): solo al atender o rechazar.
  const pdfs = [];
  const bloque = el("div", "panel-archivos");
  const etArchivos = el("span", "panel-etiqueta", "Documentos de respuesta (PDF, opcional)");
  const input = el("input");
  input.type = "file";
  input.id = "archivosRespuesta";
  input.multiple = true;
  input.accept = ".pdf,application/pdf";
  input.hidden = true;
  const elegir = el("button", "btn-elegir");
  elegir.type = "button";
  const icElegir = el("i", "fa-solid fa-file-pdf");
  icElegir.setAttribute("aria-hidden", "true");
  elegir.append(icElegir, document.createTextNode(" Adjuntar PDF"));
  elegir.addEventListener("click", () => input.click());
  const listaPdf = el("div", "lista-chips");
  const ayudaPdf = el("p", "detalle-ayuda", `Hasta ${MAX_RESPUESTA} archivos de 10 MB. El ciudadano los verá y descargará en su trámite y le llegarán por correo.`);
  bloque.append(etArchivos, elegir, input, listaPdf, ayudaPdf);

  function pintarPdfs() {
    listaPdf.replaceChildren(chipsArchivos(pdfs, (i) => { pdfs.splice(i, 1); pintarPdfs(); }));
    listaPdf.hidden = pdfs.length === 0;
  }
  pintarPdfs();
  input.addEventListener("change", () => {
    const problemas = [];
    for (const f of Array.from(input.files)) {
      const motivo = problemaConPdf(f);
      if (motivo) { problemas.push(motivo); continue; }
      if (pdfs.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) {
        problemas.push(`"${f.name}" ya está en la lista.`);
        continue;
      }
      if (pdfs.length >= MAX_RESPUESTA) { problemas.push(`Solo puedes adjuntar hasta ${MAX_RESPUESTA} archivos.`); break; }
      pdfs.push(f);
    }
    input.value = "";
    pintarPdfs();
    if (problemas.length) mostrarMensaje(problemas.map((p) => `- ${p}`).join("\n"), { tipo: "aviso", titulo: "Algunos archivos no se agregaron" });
  });

  function actualizar() {
    const e = select.value;
    etMensaje.textContent = MOTIVO_OBLIGATORIO.includes(e) ? "Motivo (se envía al ciudadano)" : "Mensaje para el ciudadano";
    mensaje.placeholder = MOTIVO_OBLIGATORIO.includes(e) ? "Escribe el motivo…" : "Mensaje (opcional)";
    ayuda.textContent = AYUDA[e] || "";
    bloque.hidden = !CIERRA.includes(e);
  }
  select.addEventListener("change", actualizar);
  actualizar();

  const aplicar = el("button", "btn-submit");
  aplicar.type = "button";
  aplicar.append(el("i", "fa-solid fa-check"), document.createTextNode(" Aplicar cambio"));
  aplicar.addEventListener("click", () => aplicarCambio(d, select.value, mensaje.value, CIERRA.includes(select.value) ? pdfs : [], aplicar));

  caja.append(etSelect, select, etMensaje, mensaje, ayuda, bloque, aplicar);
  return caja;
}

// Sube los PDF de respuesta a la carpeta de paso del funcionario; el servidor los revisa y los entrega.
async function subirRespuestas(d, pdfs) {
  const [{ app }, storageMod] = await Promise.all([
    import("./firebase-config.js"),
    import("https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js"),
  ]);
  const storage = storageMod.getStorage(app);
  const uid = auth.currentUser.uid;
  const marca = Date.now();
  const subidos = await Promise.all(pdfs.map((f, i) => storageMod.uploadBytes(
    storageMod.ref(storage, `respuestas/${uid}/${d.id}/respuesta${marca}${i}_${f.name}`), f, { contentType: "application/pdf" },
  )));
  return subidos.map((s) => ({ path: s.metadata.fullPath }));
}

async function aplicarCambio(d, nuevo, texto, pdfs, boton) {
  const mensaje = texto.trim();
  if (MOTIVO_OBLIGATORIO.includes(nuevo) && !mensaje) {
    mostrarMensaje(`Para marcar la solicitud como ${nuevo.toLowerCase()} debes escribir el motivo.`, { tipo: "aviso", titulo: "Falta el motivo" });
    return;
  }

  const final = CIERRA.includes(nuevo);
  const conArchivos = pdfs.length > 0 ? ` Se entregarán ${pdfs.length} documento${pdfs.length === 1 ? "" : "s"} de respuesta.` : "";
  const seguro = await confirmar(
    final
      ? `Esto cierra el trámite y no se puede deshacer. Se le avisará por correo al ciudadano.${conArchivos}`
      : `Se le avisará por correo al ciudadano.`,
    {
      tipo: final ? "aviso" : "info",
      titulo: `¿Marcar como ${nuevo.toLowerCase()}?`,
      textoSi: final ? `Sí, ${nuevo === "Atendido" ? "atender" : "rechazar"}` : "Sí, aplicar",
      enfocarNo: final,
    }
  );
  if (!seguro) return;

  const original = boton.innerHTML;
  boton.disabled = true;
  boton.textContent = "Guardando…";
  try {
    boton.textContent = pdfs.length > 0 ? "Subiendo documentos…" : "Guardando…";
    const archivos = pdfs.length > 0 ? await subirRespuestas(d, pdfs) : [];
    boton.textContent = "Guardando…";
    const r = await llamar("bandejaCambiarEstado", { id: d.id, estado: nuevo, mensaje, archivos });
    mostrarMensaje(
      r.correoEnviado ? `La solicitud quedó ${nuevo.toLowerCase()} y se avisó al ciudadano por correo.`
        : `La solicitud quedó ${nuevo.toLowerCase()}, pero no se pudo enviar el correo al ciudadano.`,
      { tipo: r.correoEnviado ? "exito" : "aviso", titulo: "Estado actualizado" }
    );
    cargar(); // refresca la lista y los conteos
    if (estado.detalleId === d.id) abrirDetalle(d.id);
  } catch (err) {
    console.error(err);
    const codigo = String(err?.code || "");
    const explicable = codigo === "functions/invalid-argument" || codigo === "functions/failed-precondition";
    mostrarMensaje(
      explicable ? err.message
        : codigo === "storage/unauthorized" ? "No se pudo subir uno de los PDF. Verifica que sea un PDF de menos de 10 MB."
          : "No se pudo actualizar el estado. Inténtalo nuevamente.", {
      tipo: explicable ? "aviso" : "error", titulo: "No se pudo actualizar",
    });
    boton.disabled = false;
    boton.innerHTML = original;
    if (codigo === "functions/failed-precondition") { cargar(); abrirDetalle(d.id); } // alguien más lo cambió
  }
}

/* ------------------------------ Controles ------------------------------ */

$("detalleCerrar").addEventListener("click", cerrarDetalle);
$("detalleModal").addEventListener("mousedown", (e) => {
  if (e.target === $("detalleModal")) cerrarDetalle();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("detalleModal").style.display === "flex" && !document.querySelector(".ui-modal-overlay")) cerrarDetalle();
});

$("bandejaRecargar").addEventListener("click", cargar);
$("bandejaPorPagina").addEventListener("change", (e) => {
  estado.tamano = parseInt(e.target.value, 10) || 15;
  estado.pagina = 1;
  render();
});
let espera = null;
$("bandejaBuscar").addEventListener("input", (e) => {
  clearTimeout(espera);
  espera = setTimeout(() => {
    estado.texto = e.target.value.trim();
    estado.pagina = 1;
    cargar();
  }, 350);
});
$("bandejaLimpiar").addEventListener("click", () => {
  estado.filtroEstado = "";
  estado.texto = "";
  estado.pagina = 1;
  $("bandejaBuscar").value = "";
  cargar();
});

/* ------------------------------ Arranque ------------------------------ */

let iniciado = false;
onAuthStateChanged(auth, async (user) => {
  if (!user || iniciado) return;
  iniciado = true;
  try {
    const rol = await llamar("miRol");
    if (!rol.funcionario) {
      await mostrarMensaje("Esta sección es solo para el personal de la Mesa de Partes.", { tipo: "aviso", titulo: "Sin acceso" });
      window.location.replace("home.html");
      return;
    }
    try { sessionStorage.setItem("rolFuncionario:" + user.uid, "1"); } catch { /* se ignora */ }
    await cargar();
  } catch (err) {
    console.error(err);
    estado.cargando = false;
    estado.error = true;
    render();
  }
});

render();
