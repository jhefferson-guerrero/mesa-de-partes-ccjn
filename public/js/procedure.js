// /js/procedure.js

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


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

const expedienteToUrl = new Map();

/* =============== Acceso DOM =============== */
const getTbody = () => document.querySelector(".procedures-table tbody");
const getFilterSelect = () => document.getElementById("filterSelect");
const getPageSelect = () => document.querySelector(".page-select");
const getPagSpan = () => document.querySelector(".pagination-info > span");
const getPagButtons = () =>
  Array.from(document.querySelectorAll(".pagination-controls .pagination-btn")); 

/* =============== Render =============== */

function clearStaticRowImmediately() {
  const tbody = getTbody();
  if (tbody) tbody.innerHTML = "";
}

function getSortedData() {
  // Orden por fecha
  const copy = [...allRows];
  copy.sort((a, b) => {
    const toMs = (x) =>
      x?.fechaRaw?.toMillis?.() ??
      (x?.fechaRaw instanceof Date ? x.fechaRaw.getTime() : 0);
    return rowsSortedAsc ? toMs(a) - toMs(b) : toMs(b) - toMs(a);
  });
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

function renderPaginationInfo(meta) {
  const span = getPagSpan();
  if (!span) return;
  if (meta.total === 0) {
    span.textContent = "Sin resultados";
  } else {
    span.textContent = `Mostrando ${meta.startIndex + 1}–${meta.endIndex} de ${meta.total}`;
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

function renderRows() {
  const tbody = getTbody();
  if (!tbody) return;

  const meta = getPagedSlice();

  tbody.innerHTML = "";
  const frag = document.createDocumentFragment();

  meta.data.forEach((row) => {
    const tr = document.createElement("tr");

    // Expediente
    const tdExp = document.createElement("td");
    const divExp = document.createElement("div");
    divExp.className = "expediente-cell";
    const spanExp = document.createElement("span");
    spanExp.className = "expediente-number";
    spanExp.textContent = row.expediente || "—";
    divExp.appendChild(spanExp);
    tdExp.appendChild(divExp);

    // Fecha
    const tdFecha = document.createElement("td");
    const divFecha = document.createElement("div");
    divFecha.className = "date-cell";
    const spanFecha = document.createElement("span");
    spanFecha.className = "date";
    spanFecha.textContent = row.fecha || "—";
    divFecha.appendChild(spanFecha);
    tdFecha.appendChild(divFecha);

    // Tipo
    const tdTipo = document.createElement("td");
    const divTipo = document.createElement("div");
    divTipo.className = "tipo-cell";
    const spanTipo = document.createElement("span");
    spanTipo.className = "tipo-text";
    spanTipo.textContent = (row.tipo || "").toUpperCase();
    divTipo.appendChild(spanTipo);
    tdTipo.appendChild(divTipo);

    // Subtipo
    const tdSub = document.createElement("td");
    const divSub = document.createElement("div");
    divSub.className = "sub-cell";
    const spanSub = document.createElement("span");
    spanSub.className = "sub-text";
    spanSub.textContent = (row.subTipo || "").toUpperCase();
    divSub.appendChild(spanSub);
    tdSub.appendChild(divSub);

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

    tr.appendChild(tdExp);
    tr.appendChild(tdFecha);
    tr.appendChild(tdTipo);
    tr.appendChild(tdSub);
    tr.appendChild(tdAcc);

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);

  renderPaginationInfo(meta);
  updatePaginationControls(meta);
}

/* =============== Carga datos =============== */

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
      urlPrincipal,
    });
  });

  allRows = items;
  renderRows();
}

/* =============== Filtros =============== */

function setupFilterAscDesc() {
  const filter = getFilterSelect();
  if (!filter) return;
  filter.addEventListener("change", () => {
    rowsSortedAsc = filter.value === "asc";
    currentPage = 1;
    renderRows();
  });
}

function setupPageSize() {
  const sel = getPageSelect();
  if (!sel) return;
  sel.addEventListener("change", () => {
    pageSize = parseInt(sel.value, 10) || 10;
    currentPage = 1;
    renderRows();
  });
}



// Limpia la fila estática y prepara los controles
document.addEventListener("DOMContentLoaded", () => {
  clearStaticRowImmediately();
  setupFilterAscDesc();
  setupPageSize();
});

onAuthStateChanged(auth, async (user) => {
  if (!user || hasLoaded) return;
  hasLoaded = true;
  const filter = getFilterSelect();
  rowsSortedAsc = filter?.value === "asc";
  const sel = getPageSelect();
  pageSize = parseInt(sel?.value || "10", 10) || 10;

  await loadProceduresForUser(user.uid);
});
