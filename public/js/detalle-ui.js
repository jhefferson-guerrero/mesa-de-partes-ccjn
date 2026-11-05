// /js/detalle-ui.js
// Piezas para dibujar el detalle de un trámite (las usan Mis Trámites y la bandeja del funcionario).
// Todo texto se inserta con textContent: nunca se interpreta como HTML.

export const ESTADOS = ["Recibido", "En revisión", "Observado", "Atendido", "Rechazado"];

const ICONO_ESTADO = {
  "Recibido": "fa-inbox",
  "En revisión": "fa-magnifying-glass",
  "Observado": "fa-triangle-exclamation",
  "Atendido": "fa-circle-check",
  "Rechazado": "fa-circle-xmark",
};

const CLASE_ESTADO = {
  "Recibido": "estado-recibido",
  "En revisión": "estado-revision",
  "Observado": "estado-observado",
  "Atendido": "estado-atendido",
  "Rechazado": "estado-rechazado",
};

export function el(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined && texto !== null) nodo.textContent = texto;
  return nodo;
}

// Acepta milisegundos, Timestamp de Firestore (con toMillis o toDate) o Date.
export function aMs(valor) {
  if (typeof valor === "number") return valor;
  if (valor && typeof valor.toMillis === "function") return valor.toMillis();
  if (valor && typeof valor.toDate === "function") return valor.toDate().getTime();
  if (valor instanceof Date) return valor.getTime();
  return 0;
}

const formatoFecha = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

// "04 nov 2026, 14:31" en hora de Lima (la misma que usa el cargo)
export function fechaCorta(valor) {
  const ms = aMs(valor);
  if (!ms) return "—";
  return formatoFecha.format(new Date(ms)).replace(/\./g, "");
}

export function tamano(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function estadoDe(fila) {
  return ESTADOS.includes(fila && fila.estado) ? fila.estado : "Recibido";
}

export function insigniaEstado(estado) {
  const e = ESTADOS.includes(estado) ? estado : "Recibido";
  const span = el("span", `estado-badge ${CLASE_ESTADO[e]}`);
  const i = el("i", `fa-solid ${ICONO_ESTADO[e]}`);
  i.setAttribute("aria-hidden", "true");
  span.append(i, document.createTextNode(" " + e));
  return span;
}

// Solo se enlazan archivos de Firebase Storage por https (defensa extra si algún dato viniera alterado).
export function urlSegura(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && u.hostname === "firebasestorage.googleapis.com" ? u.href : "";
  } catch {
    return "";
  }
}

export function carpetaDe(fila) {
  if (fila && fila.carpeta) return String(fila.carpeta);
  const p = fila && fila.documentos && fila.documentos.principal && fila.documentos.principal.path;
  return p ? String(p).split("/")[2] || "" : "";
}

export function expedienteDe(fila) {
  return (fila && fila.expediente) || carpetaDe(fila) || "—";
}

export function anexosDe(fila) {
  const d = (fila && fila.documentos) || {};
  if (Array.isArray(d.anexos)) return d.anexos;
  return d.anexo ? [d.anexo] : [];
}

// Todos los archivos de la solicitud, agrupados: principal, anexos, subsanaciones y cargo.
export function archivosDe(fila) {
  const d = (fila && fila.documentos) || {};
  const lista = [];
  if (d.principal) lista.push({ grupo: "Documento principal", ...d.principal });
  anexosDe(fila).forEach((a, i, todos) => lista.push({ grupo: todos.length > 1 ? `Anexo ${i + 1}` : "Anexo", ...a }));
  ((fila && fila.subsanaciones) || []).forEach((s) => {
    (s.archivos || []).forEach((a) => lista.push({ grupo: `Subsanación del ${fechaCorta(s.fecha)}`, ...a }));
  });
  if (fila && fila.cargo) lista.push({ grupo: "Cargo de recepción", name: fila.cargo.name, size: 0, url: fila.cargo.url, cargo: true });
  return lista;
}

function iconoArchivo(nombre) {
  const ext = String(nombre).split(".").pop().toLowerCase();
  if (ext === "pdf") return ["fa-file-pdf", "pdf"];
  if (ext === "doc" || ext === "docx") return ["fa-file-word", "doc"];
  if (ext === "xls" || ext === "xlsx") return ["fa-file-excel", "xls"];
  return ["fa-file", ""];
}

export function seccion(titulo, ...contenido) {
  const s = el("section", "detalle-seccion");
  s.appendChild(el("h4", "detalle-titulo", titulo));
  contenido.forEach((c) => c && s.appendChild(c));
  return s;
}

export function datos(filas) {
  const dl = el("dl", "detalle-datos");
  filas.forEach(([rotulo, valor, ancho]) => {
    const caja = el("div", ancho ? "detalle-dato ancho" : "detalle-dato");
    caja.append(el("dt", "", rotulo), el("dd", "", valor || "—"));
    dl.appendChild(caja);
  });
  return dl;
}

export function listaArchivos(archivos) {
  if (!archivos.length) return el("p", "detalle-vacio", "Sin archivos.");
  const ul = el("ul", "detalle-archivos");
  archivos.forEach((a) => {
    const li = el("li", "detalle-archivo");
    const [icono, clase] = a.cargo ? ["fa-file-lines", "cargo"] : iconoArchivo(a.name);
    const i = el("i", `fa-solid ${icono} archivo-icono ${clase}`);
    i.setAttribute("aria-hidden", "true");
    const cuerpo = el("div", "archivo-cuerpo");
    cuerpo.appendChild(el("span", "archivo-grupo", a.grupo));
    const href = urlSegura(a.url);
    if (href) {
      const enlace = el("a", "archivo-nombre", a.name);
      enlace.href = href;
      enlace.target = "_blank";
      enlace.rel = "noopener noreferrer";
      if (a.sha256) enlace.title = `Huella SHA-256: ${a.sha256}`;
      cuerpo.appendChild(enlace);
    } else {
      cuerpo.appendChild(el("span", "archivo-nombre", a.name));
    }
    li.append(i, cuerpo);
    if (a.size) li.appendChild(el("span", "archivo-tamano", tamano(a.size)));
    ul.appendChild(li);
  });
  return ul;
}

// Línea de tiempo: del más antiguo al más reciente.
export function historial(entradas) {
  const ol = el("ol", "linea-tiempo");
  (entradas && entradas.length ? entradas : []).forEach((h, i, todas) => {
    const estado = ESTADOS.includes(h.estado) ? h.estado : "Recibido";
    const li = el("li", `paso ${CLASE_ESTADO[estado]}${i === todas.length - 1 ? " actual" : ""}`);
    li.appendChild(el("span", "paso-punto"));
    const cuerpo = el("div", "paso-cuerpo");
    const cab = el("div", "paso-cabecera");
    cab.append(el("strong", "", estado), el("span", "paso-fecha", fechaCorta(h.fecha)));
    cuerpo.appendChild(cab);
    if (h.por) cuerpo.appendChild(el("span", "paso-por", h.por));
    if (h.mensaje) cuerpo.appendChild(el("p", "paso-mensaje", h.mensaje));
    li.appendChild(cuerpo);
    ol.appendChild(li);
  });
  if (!ol.children.length) return el("p", "detalle-vacio", "Sin movimientos.");
  return ol;
}

// Respuesta final de la Mesa de Partes (mensaje y documentos que el ciudadano descarga). null si no hay.
export function respuestaSeccion(fila) {
  const r = fila && fila.respuesta;
  if (!r) return null;
  const caja = seccion("Respuesta de la Mesa de Partes");
  caja.classList.add("detalle-respuesta", r.estado === "Rechazado" ? "rechazada" : "atendida");
  caja.appendChild(el("p", "respuesta-fecha", `${r.estado === "Rechazado" ? "Rechazado" : "Atendido"} el ${fechaCorta(r.fecha)}`));
  if (r.mensaje) caja.appendChild(el("p", "respuesta-mensaje", r.mensaje));
  const archivos = (r.archivos || []).map((a) => ({ grupo: "Documento de respuesta", ...a }));
  if (archivos.length) caja.appendChild(listaArchivos(archivos));
  return caja;
}

// Conversación entre el ciudadano y la Mesa de Partes. `yo`: quién la está leyendo ("Ciudadano" o "Mesa de partes").
export function hiloMensajes(mensajes, yo) {
  const hilo = el("div", "hilo-mensajes");
  hilo.setAttribute("role", "log");
  hilo.setAttribute("aria-label", "Mensajes del trámite");
  (mensajes || []).forEach((m) => {
    const mio = m.de === yo;
    const burbuja = el("div", `mensaje ${mio ? "mio" : "otro"}`);
    const cab = el("div", "mensaje-cabecera");
    cab.append(el("strong", "", mio ? "Tú" : m.de === "Ciudadano" ? "Ciudadano" : "Mesa de Partes"), el("span", "mensaje-fecha", fechaCorta(m.fecha)));
    burbuja.append(cab, el("p", "mensaje-texto", m.texto));
    hilo.appendChild(burbuja);
  });
  return hilo;
}

export const MAX_MENSAJE = 1000;

// Caja para escribir un mensaje. `alEnviar(texto)` devuelve una promesa con true si se envió (la caja se vacía).
export function formularioMensaje({ placeholder, alEnviar }) {
  const form = el("div", "form-mensaje");
  const area = el("textarea", "form-control");
  area.rows = 3;
  area.maxLength = MAX_MENSAJE;
  area.placeholder = placeholder;
  area.setAttribute("aria-label", "Escribe un mensaje");
  const pie = el("div", "form-mensaje-pie");
  const contador = el("span", "contador-mensaje", `0 / ${MAX_MENSAJE}`);
  const boton = el("button", "btn-submit");
  boton.type = "button";
  const icono = el("i", "fa-solid fa-paper-plane");
  icono.setAttribute("aria-hidden", "true");
  boton.append(icono, document.createTextNode(" Enviar mensaje"));
  pie.append(contador, boton);
  form.append(area, pie);

  area.addEventListener("input", () => { contador.textContent = `${area.value.length} / ${MAX_MENSAJE}`; });
  boton.addEventListener("click", async () => {
    const texto = area.value.trim();
    if (!texto) { area.focus(); return; }
    area.disabled = boton.disabled = true;
    boton.lastChild.textContent = " Enviando…";
    let enviado = false;
    try { enviado = await alEnviar(texto); } catch { enviado = false; }
    area.disabled = boton.disabled = false;
    boton.lastChild.textContent = " Enviar mensaje";
    if (enviado) { area.value = ""; contador.textContent = `0 / ${MAX_MENSAJE}`; }
  });
  return form;
}

// Sección "Mensajes": el hilo y, si el trámite sigue abierto, la caja para escribir. null si no hay nada que mostrar.
export function seccionMensajes(fila, yo, { puedeEscribir, placeholder, alEnviar }) {
  const mensajes = Array.isArray(fila && fila.mensajes) ? fila.mensajes : [];
  if (!mensajes.length && !puedeEscribir) return null;
  const s = seccion("Mensajes");
  s.id = "seccionMensajes";
  s.classList.add("seccion-mensajes");
  if (mensajes.length) s.appendChild(hiloMensajes(mensajes, yo));
  else s.appendChild(el("p", "detalle-vacio", "Todavía no hay mensajes. Aquí puedes aclarar dudas sin cambiar el estado del trámite."));
  if (puedeEscribir) s.appendChild(formularioMensaje({ placeholder, alEnviar }));
  else s.appendChild(el("p", "detalle-ayuda", "El trámite está cerrado: ya no se pueden enviar mensajes."));
  return s;
}
export const MAX_RESPUESTA = 5;

// Comprueba un PDF elegido como documento de respuesta; devuelve el motivo si no sirve.
export function problemaConPdf(archivo) {
  const ext = (archivo.name.split(".").pop() || "").toLowerCase();
  if (ext !== "pdf") return `"${archivo.name}": la respuesta debe ser un PDF.`;
  if (archivo.size > MAX_BYTES) return `"${archivo.name}" supera los 10 MB.`;
  if (archivo.size === 0) return `"${archivo.name}" está vacío.`;
  return "";
}

export const EXT_PERMITIDAS = ["pdf", "doc", "docx", "xls", "xlsx"];
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_ARCHIVOS = 10;

// Comprueba un archivo elegido para subsanar o adjuntar; devuelve el motivo si no sirve.
export function problemaConArchivo(archivo) {
  const ext = (archivo.name.split(".").pop() || "").toLowerCase();
  if (!EXT_PERMITIDAS.includes(ext)) return `"${archivo.name}": solo se aceptan PDF, Word o Excel.`;
  if (archivo.size > MAX_BYTES) return `"${archivo.name}" supera los 10 MB.`;
  if (archivo.size === 0) return `"${archivo.name}" está vacío.`;
  return "";
}

// Chips de archivos elegidos (con botón para quitar cada uno). Devuelve el nodo.
export function chipsArchivos(archivos, alQuitar) {
  const caja = el("div", "chips-archivos");
  archivos.forEach((a, i) => {
    const chip = el("div", "chip-archivo");
    const [icono, clase] = iconoArchivo(a.name);
    const ic = el("i", `fa-solid ${icono} archivo-icono ${clase}`);
    ic.setAttribute("aria-hidden", "true");
    const nombre = el("span", "chip-nombre", a.name);
    nombre.title = a.name;
    const peso = el("span", "chip-peso", tamano(a.size));
    const quitar = el("button", "chip-quitar");
    quitar.type = "button";
    quitar.title = "Quitar archivo";
    quitar.setAttribute("aria-label", `Quitar ${a.name}`);
    quitar.innerHTML = "&times;";
    quitar.addEventListener("click", () => alQuitar(i));
    chip.append(ic, nombre, peso, quitar);
    caja.appendChild(chip);
  });
  return caja;
}
