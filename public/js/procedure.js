// /js/procedure.js

import { auth } from "./firebase-config.js";
import { db } from "./firebase-db.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore-lite.js";


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

function createViewButton(onClick) {
  const btn = document.createElement("button");
  btn.className = "action-btn";
  btn.title = "Ver";
  btn.style.backgroundColor = "#1983a3";
  btn.style.border = "none";

  const i = document.createElement("i");
  i.className = "fa-solid fa-eye";
  i.style.color = "#ffffff";

  btn.appendChild(i);
  btn.addEventListener("click", onClick);
  return btn;
}

/* =============== Estado =============== */
let allRows = [];
let rowsSortedAsc = false;
let pageSize = 10;
let currentPage = 1;
let hasLoaded = false;
let datosListos = false; // hay una lista (de la caché o de Firestore) para mostrar
let errorCarga = false;

const filtros = { texto: "", tipo: "", subTipo: "", desde: "", hasta: "" };
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

    tr.appendChild(celda("expediente-cell", "expediente-number", row.expediente || "—"));
    tr.appendChild(celda("date-cell", "date", row.fecha || "—"));
    tr.appendChild(celda("tipo-cell", "tipo-text", (row.tipo || "").toUpperCase()));
    tr.appendChild(celda("sub-cell", "sub-text", (row.subTipo || "").toUpperCase()));
    tr.appendChild(celda("asunto-cell", "asunto-text", row.asunto || "—", row.asunto || ""));

    // Acciones (solo Ver)
    const tdAcc = document.createElement("td");
    const divAcc = document.createElement("div");
    divAcc.className = "actions-cell";

    const url = row.urlPrincipal || null;
    const btnVer = createViewButton(() => {
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });

    divAcc.appendChild(btnVer);
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
    const expediente = parseExpedienteFromPath(path);

    if (expediente && urlPrincipal) expedienteToUrl.set(expediente, urlPrincipal);

    items.push({
      expediente,
      fechaRaw: d?.creadoEn || null,
      fecha: formatFecha(d?.creadoEn || null),
      tipo: d?.tipoDocumento || "",
      subTipo: d?.subDocumento || "",
      asunto: d?.asunto || "",
      urlPrincipal,
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
    ["tipoFilter", "subTipoFilter"].forEach((id) => { if ($id(id)) $id(id).value = ""; });
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
