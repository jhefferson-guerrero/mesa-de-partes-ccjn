// /js/procedure.js

import { auth } from "./firebase-config.js";
import { db } from "./firebase-db.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore-lite.js";
import { mostrarMensaje } from "./ui-modal.js";
import {
  el, seccion, datos, listaArchivos, historial, insigniaEstado, chipsArchivos,
  archivosDe, carpetaDe, expedienteDe, estadoDe, fechaCorta, problemaConArchivo, MAX_ARCHIVOS,
  respuestaSeccion, seccionMensajes,
} from "./detalle-ui.js";


function parseExpedienteFromPath(path = "") {
  const parts = (path || "").split("/"); // ficha-solicitudes/{uid}/{EXPEDIENTE}/archivo
  return parts.length >= 4 ? parts[2] : "";
}

function formatFecha(ts) {
  let date;
  if (ts && typeof ts.toDate === "function") date = ts.toDate();
  else if (ts instanceof Date) date = ts;
  else return "";
  const f = date
    .toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
    .replace(".", "");
  const h = date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${f} ${h}`;
}

// Milisegundos de la fecha de una fila (Timestamp de Firestore o Date)
function msDe(row) {
  const f = row?.fechaRaw;
  return f?.toMillis?.() ?? (f instanceof Date ? f.getTime() : 0);
}

// Para buscar sin importar mayúsculas ni tildes
function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function createActionButton(iconClass, title, color, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "action-btn";
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.style.backgroundColor = color;
  btn.style.border = "none";

  const i = document.createElement("i");
  i.className = `fa-solid ${iconClass}`;
  i.style.color = "#ffffff";
  i.setAttribute("aria-hidden", "true");

  btn.appendChild(i);
  btn.addEventListener("click", onClick);
  return btn;
}

const createViewButton = (onClick) => createActionButton("fa-eye", "Ver documento principal", "#002b4e", onClick);
const createCargoButton = (onClick) => createActionButton("fa-file-arrow-down", "Descargar cargo de recepción", "#3e5a78", onClick);

/* =============== Estado =============== */
let allRows = [];
let rowsSortedAsc = false;
let pageSize = 10;
let currentPage = 1;
let hasLoaded = false;
let datosListos = false; // hay una lista (de la caché o de Firestore) para mostrar
let errorCarga = false;

const filtros = { texto: "", estado: "", tipo: "", subTipo: "", desde: "", hasta: "" };
const hayFiltros = () => Object.values(filtros).some((v) => v !== "");

const expedienteToUrl = new Map();
const COLUMNAS = 6;

/* =============== Acceso DOM =============== */
const getTbody = () => document.querySelector(".procedures-table tbody");
const getFilterSelect = () => document.getElementById("filterSelect");
const getPageSelect = () => document.querySelector(".page-select");
const getPagSpan = () => document.querySelector(".pagination-info > span");
const getPagButtons = () =>
  Array.from(document.querySelectorAll(".pagination-controls .pagination-btn"));
const $id = (id) => document.getElementById(id);

/* =============== Filtrado, orden y paginación =============== */

function getFilteredData() {
  const texto = normalizar(filtros.texto);
  const desdeMs = filtros.desde ? new Date(filtros.desde + "T00:00:00").getTime() : null;
  const hastaMs = filtros.hasta ? new Date(filtros.hasta + "T23:59:59.999").getTime() : null;

  return allRows.filter((r) => {
    if (filtros.tipo && r.tipo !== filtros.tipo) return false;
    if (filtros.subTipo && r.subTipo !== filtros.subTipo) return false;
    if (filtros.estado && r.estado !== filtros.estado) return false;
    const ms = msDe(r);
    if (desdeMs !== null && ms < desdeMs) return false;
    if (hastaMs !== null && ms > hastaMs) return false;
    if (texto && !normalizar(`${r.expediente} ${r.asunto}`).includes(texto)) return false;
    return true;
  });
}

function getSortedData() {
  const copy = getFilteredData();
  copy.sort((a, b) => (rowsSortedAsc ? msDe(a) - msDe(b) : msDe(b) - msDe(a)));
  return copy;
}

function getPagedSlice() {
  const data = getSortedData();
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  return {
    data: data.slice(startIndex, endIndex),
    total,
    startIndex,
    endIndex,
    totalPages,
  };
}

/* =============== Render =============== */

function renderPaginationInfo(meta) {
  const span = getPagSpan();
  if (!span) return;
  if (!datosListos) {
    span.textContent = "";
    return;
  }
  if (meta.total === 0) {
    span.textContent = "Sin resultados";
  } else {
    span.textContent =
      `Mostrando ${meta.startIndex + 1}–${meta.endIndex} de ${meta.total}` +
      ` · Página ${currentPage} de ${meta.totalPages}`;
  }
}

function updatePaginationControls(meta) {
  const btns = getPagButtons();
  if (btns.length !== 5) return;

  const [btnFirst, btnPrev, btnNumber, btnNext, btnLast] = btns;
  // número activo
  btnNumber.textContent = String(currentPage);
  btnNumber.classList.add("active");

  // estados habilitar/deshabilitar
  const onFirstPage = currentPage <= 1;
  const onLastPage = currentPage >= meta.totalPages;

  btnFirst.disabled = onFirstPage;
  btnPrev.disabled = onFirstPage;
  btnNext.disabled = onLastPage;
  btnLast.disabled = onLastPage;

  // Etiquetas: dicen a dónde lleva cada botón o por qué está desactivado (gris)
  const etiquetas = [
    onFirstPage ? "Ya estás en la primera página" : "Primera página",
    onFirstPage ? "No hay una página anterior" : "Página anterior",
    `Página actual: ${currentPage} de ${meta.totalPages}`,
    onLastPage ? "No hay más páginas" : "Página siguiente",
    onLastPage ? "Ya estás en la última página" : "Última página",
  ];
  btns.forEach((b, i) => {
    b.title = etiquetas[i];
    b.setAttribute("aria-label", etiquetas[i]);
  });

  // listeners (limpia previos)
  btnFirst.onclick = () => {
    if (!onFirstPage) {
      currentPage = 1;
      renderRows();
    }
  };
  btnPrev.onclick = () => {
    if (!onFirstPage) {
      currentPage -= 1;
      renderRows();
    }
  };
  btnNext.onclick = () => {
    if (!onLastPage) {
      currentPage += 1;
      renderRows();
    }
  };
  btnLast.onclick = () => {
    if (!onLastPage) {
      currentPage = meta.totalPages;
      renderRows();
    }
  };
}

// Fila con un mensaje que ocupa todo el ancho (cargando, sin resultados, error)
function mostrarEstado(mensaje) {
  const tbody = getTbody();
  if (!tbody) return;
  tbody.innerHTML = "";
  const tr = document.createElement("tr");
  tr.className = "fila-estado";
  const td = document.createElement("td");
  td.colSpan = COLUMNAS;
  td.textContent = mensaje;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function celda(claseDiv, claseSpan, texto, titulo) {
  const td = document.createElement("td");
  const div = document.createElement("div");
  div.className = claseDiv;
  const span = document.createElement("span");
  span.className = claseSpan;
  span.textContent = texto;
  if (titulo) span.title = titulo;
  div.appendChild(span);
  td.appendChild(div);
  return td;
}

// El número de expediente abre el detalle del trámite
function celdaExpediente(row) {
  const td = document.createElement("td");
  const div = document.createElement("div");
  div.className = "expediente-cell";
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "link-expediente expediente-number";
  boton.textContent = row.expediente || "—";
  boton.title = "Ver el detalle de este trámite";
  boton.addEventListener("click", () => abrirDetalle(row.id));
  div.appendChild(boton);
  td.appendChild(div);
  return td;
}

// Tipo de documento con el subtipo debajo (una sola columna)
function celdaTipo(row) {
  const td = document.createElement("td");
  const div = document.createElement("div");
  div.className = "tipo-cell";
  const tipo = document.createElement("span");
  tipo.className = "tipo-text";
  tipo.textContent = (row.tipo || "").toUpperCase();
  const sub = document.createElement("small");
  sub.className = "sub-text";
  sub.textContent = (row.subTipo || "").toUpperCase();
  div.append(tipo, sub);
  td.appendChild(div);
  return td;
}

function celdaEstado(row) {
  const td = document.createElement("td");
  td.className = "status";
  td.appendChild(insigniaEstado(row.estado));
  return td;
}

// Aviso de trámites observados (esperan que la persona los subsane)
function renderAviso() {
  const caja = $id("avisoObservados");
  if (!caja) return;
  const n = allRows.filter((r) => r.estado === "Observado").length;
  if (!datosListos || n === 0) {
    caja.hidden = true;
    return;
  }
  $id("avisoObservadosTexto").textContent = n === 1
    ? "Tienes 1 trámite observado: necesita que lo subsanes."
    : `Tienes ${n} trámites observados: necesitan que los subsanes.`;
  caja.hidden = false;
}

function renderResumen(meta) {
  const resumen = $id("filterSummary");
  const limpiar = $id("clearFilters");
  if (limpiar) limpiar.disabled = !hayFiltros();
  if (!resumen) return;

  if (!datosListos) {
    resumen.textContent = "";
    return;
  }
  const n = (x) => (x === 1 ? "1 trámite" : `${x} trámites`);
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    resumen.textContent = "La fecha «Desde» es posterior a «Hasta»: revisa el rango.";
  } else if (hayFiltros()) {
    resumen.textContent = `${meta.total} de ${n(allRows.length)} coinciden con los filtros.`;
  } else {
    resumen.textContent = `${n(allRows.length)} en total.`;
  }
}

function renderRows() {
  const tbody = getTbody();
  if (!tbody) return;

  const meta = getPagedSlice();
  renderPaginationInfo(meta);
  updatePaginationControls(meta);
  renderResumen(meta);
  renderAviso();

  if (!datosListos) {
    mostrarEstado(errorCarga ? "No se pudieron cargar tus trámites. Recarga la página." : "Cargando trámites…");
    return;
  }
  if (meta.total === 0) {
    mostrarEstado(
      allRows.length === 0
        ? "Aún no tienes trámites registrados."
        : "No se encontraron trámites con esos filtros."
    );
    return;
  }

  tbody.innerHTML = "";
  const frag = document.createDocumentFragment();

  meta.data.forEach((row) => {
    const tr = document.createElement("tr");

    if (row.estado === "Observado") tr.classList.add("fila-observada");
    tr.appendChild(celdaExpediente(row));
    tr.appendChild(celda("date-cell", "date", row.fecha || "—"));
    tr.appendChild(celdaTipo(row));
    tr.appendChild(celda("asunto-cell", "asunto-text", row.asunto || "—", row.asunto || ""));
    tr.appendChild(celdaEstado(row));

    // Acciones: ver el documento principal y descargar el cargo de recepción (si existe)
    const tdAcc = document.createElement("td");
    const divAcc = document.createElement("div");
    divAcc.className = "actions-cell";

    const url = row.urlPrincipal || null;
    const btnVer = createViewButton(() => {
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
    divAcc.appendChild(btnVer);

    // Las solicitudes anteriores al cargo no lo tienen: en ese caso el botón no aparece
    const urlCargo = row.urlCargo || null;
    if (urlCargo) {
      divAcc.appendChild(createCargoButton(() => window.open(urlCargo, "_blank", "noopener,noreferrer")));
    }
    tdAcc.appendChild(divAcc);
    tr.appendChild(tdAcc);

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
}

/* =============== Caché de la lista =============== */
// La lista ya vista se guarda en la pestaña (sessionStorage): al volver a Mis Trámites
// se muestra al instante y luego se actualiza en segundo plano desde Firestore.
// Se borra al cerrar sesión o al cerrar la pestaña.
const CACHE_PREFIX = "tramites:";

function readCachedRows(uid) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + uid);
    if (!raw) return null;
    return JSON.parse(raw).map((r) => {
      const fechaRaw = r.fechaMs ? new Date(r.fechaMs) : null;
      return {
        expediente: r.expediente,
        fechaRaw,
        fecha: formatFecha(fechaRaw),
        tipo: r.tipo,
        subTipo: r.subTipo,
        asunto: r.asunto || "",
        urlPrincipal: r.urlPrincipal,
        urlCargo: r.urlCargo || null,
        id: r.id,
        estado: r.estado || "Recibido",
      };
    });
  } catch {
    return null;
  }
}

function writeCachedRows(uid, rows) {
  try {
    const plain = rows.map((r) => ({
      expediente: r.expediente,
      fechaMs: msDe(r),
      tipo: r.tipo,
      subTipo: r.subTipo,
      asunto: r.asunto || "",
      urlPrincipal: r.urlPrincipal,
      urlCargo: r.urlCargo || null,
      id: r.id,
      estado: r.estado || "Recibido",
    }));
    sessionStorage.setItem(CACHE_PREFIX + uid, JSON.stringify(plain));
  } catch {
    // sessionStorage lleno o bloqueado: simplemente no se guarda en caché
  }
}

/* =============== Carga datos =============== */

// Llena las listas de Tipo y Subtipo con los valores que existen en los trámites
function llenarOpcionesFiltro() {
  const llenar = (id, clave, etiquetaTodos) => {
    const sel = $id(id);
    if (!sel) return;
    const valores = [...new Set(allRows.map((r) => r[clave]).filter(Boolean))].sort();
    sel.innerHTML = "";
    const todos = document.createElement("option");
    todos.value = "";
    todos.textContent = etiquetaTodos;
    sel.appendChild(todos);
    valores.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v.toUpperCase();
      sel.appendChild(o);
    });
    // Si el valor elegido ya no existe, se quita ese filtro
    if (filtros[clave] && !valores.includes(filtros[clave])) filtros[clave] = "";
    sel.value = filtros[clave];
  };
  llenar("tipoFilter", "tipo", "Todos");
  llenar("subTipoFilter", "subTipo", "Todos");
}

async function loadProceduresForUser(uid) {
  const q = query(collection(db, "ficha-solicitud"), where("userId", "==", uid));
  const snap = await getDocs(q);

  const items = [];
  expedienteToUrl.clear();

  snap.forEach((docSnap) => {
    const d = docSnap.data() || {};
    const principal = d?.documentos?.principal || null;
    const anexo = d?.documentos?.anexo || null;

    const path = principal?.path || anexo?.path || "";
    const urlPrincipal = principal?.url || null;
    // Número real asignado por el servidor; las solicitudes antiguas usan el número de su carpeta
    const expediente = d?.expediente || parseExpedienteFromPath(path);
    const urlCargo = d?.cargo?.url || null;

    if (expediente && urlPrincipal) expedienteToUrl.set(expediente, urlPrincipal);

    items.push({
      id: docSnap.id,
      estado: estadoDe(d),
      expediente,
      fechaRaw: d?.creadoEn || null,
      fecha: formatFecha(d?.creadoEn || null),
      tipo: d?.tipoDocumento || "",
      subTipo: d?.subDocumento || "",
      asunto: d?.asunto || "",
      urlPrincipal,
      urlCargo,
    });
  });

  allRows = items;
  datosListos = true;
  errorCarga = false;
  llenarOpcionesFiltro();
  renderRows();
  writeCachedRows(uid, items);
}

/* =============== Controles de filtro =============== */

function aplicarFiltros() {
  currentPage = 1;
  renderRows();
}

function setupFiltros() {
  // Orden
  const orden = getFilterSelect();
  orden?.addEventListener("change", () => {
    rowsSortedAsc = orden.value === "asc";
    aplicarFiltros();
  });

  // Resultados por página
  const sel = getPageSelect();
  sel?.addEventListener("change", () => {
    pageSize = parseInt(sel.value, 10) || 10;
    aplicarFiltros();
  });

  // Buscador (con una pequeña espera para no recalcular en cada letra)
  const buscar = $id("searchInput");
  let temporizador = null;
  buscar?.addEventListener("input", () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      filtros.texto = buscar.value;
      aplicarFiltros();
    }, 200);
  });

  // Estado
  $id("estadoFilter")?.addEventListener("change", (e) => {
    filtros.estado = e.target.value;
    aplicarFiltros();
  });
  $id("verObservados")?.addEventListener("click", () => {
    filtros.estado = "Observado";
    if ($id("estadoFilter")) $id("estadoFilter").value = "Observado";
    aplicarFiltros();
  });

  // Tipo y subtipo
  $id("tipoFilter")?.addEventListener("change", (e) => {
    filtros.tipo = e.target.value;
    aplicarFiltros();
  });
  $id("subTipoFilter")?.addEventListener("change", (e) => {
    filtros.subTipo = e.target.value;
    aplicarFiltros();
  });

  // Rango de fechas (cada selector limita al otro)
  const desde = $id("desdeFilter");
  const hasta = $id("hastaFilter");
  desde?.addEventListener("change", () => {
    filtros.desde = desde.value;
    if (hasta) hasta.min = desde.value || "";
    aplicarFiltros();
  });
  hasta?.addEventListener("change", () => {
    filtros.hasta = hasta.value;
    if (desde) desde.max = hasta.value || "";
    aplicarFiltros();
  });

  // Limpiar
  $id("clearFilters")?.addEventListener("click", () => {
    Object.keys(filtros).forEach((k) => (filtros[k] = ""));
    if (buscar) buscar.value = "";
    if (desde) { desde.value = ""; desde.max = ""; }
    if (hasta) { hasta.value = ""; hasta.min = ""; }
    ["tipoFilter", "subTipoFilter", "estadoFilter"].forEach((id) => { if ($id(id)) $id(id).value = ""; });
    aplicarFiltros();
    buscar?.focus();
  });
}

function leerOrdenYTamano() {
  rowsSortedAsc = getFilterSelect()?.value === "asc";
  pageSize = parseInt(getPageSelect()?.value || "10", 10) || 10;
}

document.addEventListener("DOMContentLoaded", () => {
  setupFiltros();
  leerOrdenYTamano();
  renderRows(); // muestra "Cargando trámites…" mientras llegan los datos

  // Mostrar al instante la lista ya vista (si existe) sin esperar a la sesión ni a Firestore
  const cachedUid = sessionStorage.getItem("userDataUid");
  const cached = cachedUid ? readCachedRows(cachedUid) : null;
  if (cached) {
    allRows = cached;
    datosListos = true;
    llenarOpcionesFiltro();
    renderRows();
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user || hasLoaded) return;
  hasLoaded = true;
  leerOrdenYTamano();

  // Actualiza desde Firestore; si falla y ya se mostró la caché, se deja esa lista
  try {
    await loadProceduresForUser(user.uid);
  } catch (err) {
    console.error("No se pudo actualizar la lista de trámites:", err);
    if (!datosListos) {
      errorCarga = true;
      renderRows();
    }
  }
});

/* =============== Detalle del trámite =============== */
let detalleId = null;

function cerrarDetalle() {
  const modal = $id("detalleModal");
  if (modal) modal.style.display = "none";
  detalleId = null;
}

function icono(clase) {
  const i = el("i", `fa-solid ${clase}`);
  i.setAttribute("aria-hidden", "true");
  return i;
}

async function abrirDetalle(id) {
  detalleId = id;
  const cuerpo = $id("detalleCuerpo");
  $id("detalleTitulo").textContent = "Expediente";
  $id("detalleEstado").replaceChildren();
  cuerpo.replaceChildren(el("p", "detalle-vacio", "Cargando…"));
  $id("detalleModal").style.display = "flex";

  try {
    const snap = await getDoc(doc(db, "ficha-solicitud", id));
    if (detalleId !== id) return; // la persona cerró o abrió otro mientras cargaba
    if (!snap.exists()) throw new Error("no-existe");
    dibujarDetalle(id, snap.data());
  } catch (err) {
    console.error("No se pudo cargar el detalle:", err);
    if (detalleId === id) {
      cuerpo.replaceChildren(el("p", "detalle-vacio", "No se pudo cargar el detalle. Cierra esta ventana e inténtalo de nuevo."));
    }
  }
}

function dibujarDetalle(id, fila, opciones = {}) {
  const estado = estadoDe(fila);
  $id("detalleTitulo").textContent = `Expediente ${expedienteDe(fila)}`;
  $id("detalleEstado").replaceChildren(insigniaEstado(estado));

  const partes = [];

  if (estado === "Observado") {
    const caja = el("div", "detalle-alerta");
    const texto = el("div", "alerta-texto");
    texto.append(
      el("strong", "", "Tu solicitud tiene una observación"),
      el("p", "", (fila.observacion && fila.observacion.mensaje) || "Revisa el seguimiento de abajo.")
    );
    const boton = el("button", "btn-submit btn-subsanar");
    boton.type = "button";
    boton.append(icono("fa-paperclip"), document.createTextNode(" Subsanar"));
    boton.addEventListener("click", () => mostrarSubsanar(id, fila));
    caja.append(icono("fa-triangle-exclamation"), texto, boton);
    partes.push(caja);
  }

  // La respuesta final va arriba: es lo que la persona busca al entrar a un trámite cerrado.
  const respuesta = respuestaSeccion(fila);
  if (respuesta) partes.push(respuesta);

  partes.push(seccion("Datos del trámite", datos([
    ["Fecha de envío", fechaCorta(fila.creadoEn)],
    ["Tipo de documento", String(fila.tipoDocumento || "").toUpperCase()],
    ["Tipo de sub documento", String(fila.subDocumento || "").toUpperCase()],
    ["Asunto", fila.asunto, true],
  ])));
  partes.push(seccion("Archivos", listaArchivos(archivosDe(fila))));

  const mensajes = seccionMensajes(fila, "Ciudadano", {
    puedeEscribir: estado !== "Atendido" && estado !== "Rechazado",
    placeholder: "Escribe tu mensaje a la Mesa de Partes…",
    alEnviar: (texto) => enviarMensaje(id, texto),
  });
  if (mensajes) partes.push(mensajes);
  partes.push(seccion("Seguimiento", historial(fila.historial)));

  const cuerpo = $id("detalleCuerpo");
  const posicion = cuerpo.scrollTop;
  cuerpo.replaceChildren(...partes);
  cuerpo.scrollTop = opciones.irAMensajes ? cuerpo.scrollHeight : opciones.conservarPosicion ? posicion : 0;
  if (opciones.irAMensajes) $id("seccionMensajes")?.scrollIntoView({ block: "nearest" });
}

// Envía un mensaje a la Mesa de Partes y vuelve a dibujar el trámite con el mensaje ya en la conversación.
async function enviarMensaje(id, texto) {
  try {
    const [{ app }, functionsMod] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js"),
    ]);
    const llamar = functionsMod.httpsCallable(functionsMod.getFunctions(app, "us-central1"), "enviarMensaje");
    await llamar({ solicitudId: id, texto });
  } catch (err) {
    console.error(err);
    const codigo = String(err?.code || "");
    let mensaje = "No se pudo enviar el mensaje. Inténtalo nuevamente.";
    if (codigo === "functions/resource-exhausted") mensaje = "Enviaste demasiados mensajes seguidos. Inténtalo de nuevo más tarde.";
    else if (codigo === "functions/invalid-argument" || codigo === "functions/failed-precondition") mensaje = err.message || mensaje;
    mostrarMensaje(mensaje, { tipo: codigo.startsWith("functions/") ? "aviso" : "error", titulo: "No se pudo enviar" });
    return false;
  }
  // El mensaje ya se envió: si falla la relectura no se avisa de error, solo no se actualiza la vista.
  try {
    const snap = await getDoc(doc(db, "ficha-solicitud", id));
    if (detalleId === id && snap.exists()) dibujarDetalle(id, snap.data(), { irAMensajes: true });
  } catch (err) {
    console.error("No se pudo actualizar la conversación:", err);
  }
  return true;
}

/* ---- Subsanar una observación ---- */
function mostrarSubsanar(id, fila) {
  const cuerpo = $id("detalleCuerpo");
  const existente = $id("formSubsanar");
  if (existente) {
    existente.scrollIntoView({ behavior: "smooth", block: "center" });
    existente.querySelector("textarea")?.focus();
    return;
  }

  const archivos = [];
  const form = el("section", "detalle-seccion form-subsanar");
  form.id = "formSubsanar";
  form.appendChild(el("h4", "detalle-titulo", "Subsanar observación"));
  form.appendChild(el("p", "detalle-ayuda", "Adjunta lo que falta (hasta 10 archivos de 10 MB: PDF, Word o Excel). Al enviarlo, el trámite vuelve a revisión."));

  const comentario = el("textarea", "form-control subsanar-comentario");
  comentario.id = "subsanarComentario";
  comentario.maxLength = 500;
  comentario.rows = 3;
  comentario.placeholder = "Comentario para quien revisa (opcional)";
  comentario.setAttribute("aria-label", "Comentario");

  const input = el("input");
  input.type = "file";
  input.id = "subsanarArchivos";
  input.multiple = true;
  input.accept = ".pdf,.doc,.docx,.xls,.xlsx";
  input.hidden = true;

  const elegir = el("button", "btn-elegir");
  elegir.type = "button";
  elegir.append(icono("fa-folder-open"), document.createTextNode(" Elegir archivos"));
  elegir.addEventListener("click", () => input.click());

  const lista = el("div", "lista-chips");
  const acciones = el("div", "form-subsanar-acciones");
  const enviar = el("button", "btn-submit");
  enviar.type = "button";
  enviar.id = "subsanarEnviar";
  enviar.append(icono("fa-paper-plane"), document.createTextNode(" Enviar subsanación"));
  const cancelar = el("button", "btn-cancel");
  cancelar.type = "button";
  cancelar.textContent = "Cancelar";
  acciones.append(enviar, cancelar);

  function pintar() {
    lista.replaceChildren(chipsArchivos(archivos, (i) => { archivos.splice(i, 1); pintar(); }));
    lista.hidden = archivos.length === 0;
  }
  pintar();

  input.addEventListener("change", () => {
    const problemas = [];
    for (const f of Array.from(input.files)) {
      const motivo = problemaConArchivo(f);
      if (motivo) { problemas.push(motivo); continue; }
      if (archivos.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) {
        problemas.push(`"${f.name}" ya está en la lista.`);
        continue;
      }
      if (archivos.length >= MAX_ARCHIVOS) { problemas.push(`Solo puedes adjuntar hasta ${MAX_ARCHIVOS} archivos.`); break; }
      archivos.push(f);
    }
    input.value = "";
    pintar();
    if (problemas.length) mostrarMensaje(problemas.map((p) => `- ${p}`).join("\n"), { tipo: "aviso", titulo: "Algunos archivos no se agregaron" });
  });

  cancelar.addEventListener("click", () => form.remove());
  enviar.addEventListener("click", () => enviarSubsanacion(id, fila, comentario.value, archivos, enviar));

  form.append(comentario, elegir, input, lista, acciones);
  const alerta = cuerpo.querySelector(".detalle-alerta");
  if (alerta) alerta.after(form);
  else cuerpo.prepend(form);
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  comentario.focus();
}

async function enviarSubsanacion(id, fila, comentario, archivos, boton) {
  if (archivos.length === 0) {
    mostrarMensaje("Adjunta al menos un archivo para subsanar.", { tipo: "aviso", titulo: "Faltan archivos" });
    return;
  }
  const user = auth.currentUser;
  const carpeta = carpetaDe(fila);
  if (!user || !carpeta) {
    mostrarMensaje("No se pudo identificar la solicitud. Recarga la página e inténtalo de nuevo.", { tipo: "error", titulo: "No se pudo enviar" });
    return;
  }

  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = "Enviando…";
  try {
    // Estos módulos solo se descargan cuando se subsana (Mis Trámites no los necesita para listar)
    const [{ app }, storageMod, functionsMod] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js"),
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js"),
    ]);
    const storage = storageMod.getStorage(app);
    const marca = Date.now();
    const subidos = await Promise.all(
      archivos.map((f, i) =>
        storageMod.uploadBytes(
          storageMod.ref(storage, `ficha-solicitudes/${user.uid}/${carpeta}/subsanacion${marca}${i}_${f.name}`),
          f,
          { contentType: f.type || "application/octet-stream" }
        )
      )
    );
    const llamar = functionsMod.httpsCallable(functionsMod.getFunctions(undefined, "us-central1"), "subsanarSolicitud");
    await llamar({
      solicitudId: id,
      comentario: comentario.trim(),
      archivos: subidos.map((s) => ({ path: s.metadata.fullPath })),
    });

    cerrarDetalle();
    mostrarMensaje("Enviamos tu subsanación. El trámite volvió a revisión y te avisaremos por correo cuando haya novedades.", { tipo: "exito", titulo: "Subsanación enviada" });
    try { sessionStorage.removeItem(CACHE_PREFIX + user.uid); } catch { /* sin caché */ }
    loadProceduresForUser(user.uid).catch((e) => console.error(e));
  } catch (err) {
    console.error(err);
    const codigo = String(err?.code || "");
    let mensaje = "No se pudo enviar la subsanación. Inténtalo nuevamente.";
    let titulo = "No se pudo enviar";
    if (codigo === "functions/resource-exhausted") {
      mensaje = "Hiciste demasiados envíos seguidos. Inténtalo de nuevo más tarde.";
      titulo = "Límite de envíos";
    } else if (codigo === "functions/invalid-argument" || codigo === "functions/failed-precondition") {
      mensaje = err.message || mensaje;
      titulo = "Revisa los datos";
    } else if (codigo === "storage/unauthorized") {
      mensaje = "No se pudo subir uno de los archivos. Verifica el formato y el tamaño.";
    }
    mostrarMensaje(mensaje, { tipo: codigo.startsWith("functions/") ? "aviso" : "error", titulo });
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

// Cierre de la ventana: botón ×, clic fuera o Esc
$id("detalleCerrar")?.addEventListener("click", cerrarDetalle);
$id("detalleModal")?.addEventListener("mousedown", (e) => {
  if (e.target === $id("detalleModal")) cerrarDetalle();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $id("detalleModal")?.style.display === "flex" && !document.querySelector(".ui-modal-overlay")) {
    cerrarDetalle();
  }
});
