// /js/ui-modal.js
// Reemplazo de alert(): un modal propio con el mismo estilo que el resto de la app.
// Uso:  mostrarMensaje("Texto", { tipo: "aviso" | "error" | "exito" | "info", titulo: "Opcional" });
// Devuelve una promesa que se cumple cuando la persona cierra el modal.
// - Los mensajes se muestran como texto (nunca como HTML).
// - Las líneas que empiezan con "- " se muestran como lista.
// - Si se llama varias veces seguidas, los modales salen uno detrás de otro.
// - Se cierra con el botón, con Esc, con Enter o al hacer clic fuera.

const ICONO = (paths) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

const TIPOS = {
  aviso: {
    titulo: "Revisa los datos",
    color: "#d98a00",
    icono: ICONO('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  },
  error: {
    titulo: "No se pudo completar",
    color: "#c0392b",
    icono: ICONO('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>'),
  },
  exito: {
    titulo: "Listo",
    color: "#28a745",
    icono: ICONO('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
  },
  info: {
    titulo: "Información",
    color: "#1983a3",
    icono: ICONO('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  },
};

const ESTILOS = `
.ui-modal-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.5);animation:ui-modal-fade .15s ease-out}
.ui-modal{--ui-modal-color:#1983a3;width:100%;max-width:460px;max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:"Krub",system-ui,sans-serif;color:#212121;animation:ui-modal-pop .18s ease-out}
.ui-modal-head{display:flex;align-items:center;gap:12px;padding:20px 20px 14px;border-bottom:1px solid #e0e0e0}
.ui-modal-icon{display:flex;flex:none;color:var(--ui-modal-color)}
.ui-modal-icon svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ui-modal-title{margin:0;font-size:19px;font-weight:700;line-height:1.3;color:#212121}
.ui-modal-body{padding:18px 20px;font-size:15px;line-height:1.6;color:#555;word-wrap:break-word;overflow-wrap:anywhere}
.ui-modal-body p{margin:0 0 8px}
.ui-modal-body p:last-child{margin-bottom:0}
.ui-modal-body ul{margin:8px 0 0;padding-left:22px}
.ui-modal-body li{margin:2px 0}
.ui-modal-actions{display:flex;justify-content:center;padding:12px 20px 20px;border-top:1px solid #e0e0e0}
.ui-modal-btn{all:unset;box-sizing:border-box;cursor:pointer;background:#1983a3;color:#fff;border-radius:5px;padding:10px 30px;font:700 15px "Krub",system-ui,sans-serif;text-align:center}
.ui-modal-btn:hover{background:#156d88}
.ui-modal-btn:focus-visible{outline:3px solid #9fd3e3;outline-offset:2px}
@keyframes ui-modal-fade{from{opacity:0}to{opacity:1}}
@keyframes ui-modal-pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ui-modal-overlay,.ui-modal{animation:none}}
`;

function inyectarEstilos() {
  if (document.getElementById("ui-modal-estilos")) return;
  const style = document.createElement("style");
  style.id = "ui-modal-estilos";
  style.textContent = ESTILOS;
  document.head.appendChild(style);
}

function crear(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

// Convierte el texto en párrafos y listas (líneas que empiezan con "- ")
function armarCuerpo(mensaje) {
  const cuerpo = crear("div", "ui-modal-body");
  let lista = null;
  String(mensaje ?? "").split("\n").forEach((linea) => {
    const t = linea.trim();
    if (!t) return;
    if (t.startsWith("- ")) {
      if (!lista) {
        lista = crear("ul");
        cuerpo.appendChild(lista);
      }
      lista.appendChild(crear("li", "", t.slice(2)));
    } else {
      lista = null;
      cuerpo.appendChild(crear("p", "", t));
    }
  });
  return cuerpo;
}

let contador = 0;

function abrir(mensaje, tipo, titulo, textoBoton) {
  return new Promise((resolve) => {
    inyectarEstilos();
    const cfg = TIPOS[tipo] || TIPOS.aviso;
    const id = `ui-modal-${++contador}`;
    const focoPrevio = document.activeElement;

    const overlay = crear("div", "ui-modal-overlay");
    const caja = crear("div", "ui-modal");
    caja.setAttribute("role", "alertdialog");
    caja.setAttribute("aria-modal", "true");
    caja.setAttribute("aria-labelledby", `${id}-titulo`);
    caja.setAttribute("aria-describedby", `${id}-texto`);
    caja.style.setProperty("--ui-modal-color", cfg.color);

    const cabecera = crear("div", "ui-modal-head");
    const icono = crear("span", "ui-modal-icon");
    icono.innerHTML = cfg.icono; // SVG fijo definido en este archivo, nunca texto del usuario
    const h3 = crear("h3", "ui-modal-title", titulo || cfg.titulo);
    h3.id = `${id}-titulo`;
    cabecera.append(icono, h3);

    const cuerpo = armarCuerpo(mensaje);
    cuerpo.id = `${id}-texto`;

    const acciones = crear("div", "ui-modal-actions");
    const boton = crear("button", "ui-modal-btn", textoBoton);
    boton.type = "button";
    acciones.appendChild(boton);

    caja.append(cabecera, cuerpo, acciones);
    overlay.appendChild(caja);

    function cerrar() {
      document.removeEventListener("keydown", alTeclear, true);
      overlay.remove();
      if (focoPrevio && typeof focoPrevio.focus === "function") focoPrevio.focus();
      resolve();
    }

    function alTeclear(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cerrar();
      } else if (e.key === "Tab") {
        e.preventDefault(); // un solo control: el foco se queda en el botón
        boton.focus();
      }
    }

    boton.addEventListener("click", cerrar);
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) cerrar();
    });
    document.addEventListener("keydown", alTeclear, true);

    document.body.appendChild(overlay);
    boton.focus();
  });
}

let cola = Promise.resolve();

export function mostrarMensaje(mensaje, { tipo = "aviso", titulo, textoBoton = "Aceptar" } = {}) {
  const turno = cola.then(() => abrir(mensaje, tipo, titulo, textoBoton));
  cola = turno;
  return turno;
}
