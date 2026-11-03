// /js/ui-password.js
// Agrega un botón "ojo" a todos los campos de contraseña para mostrarla u ocultarla.
// - Es accesible: botón real, con etiqueta, aria-pressed y navegable con el teclado.
// - No quita el foco del campo al pulsarlo.
// - Trae sus propios estilos, así funciona igual en las pantallas de acceso y en las internas.

const OJO =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const OJO_TACHADO =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5.6 19 2 12 2 12a18.3 18.3 0 0 1 5.1-5.9"/><path d="M9.9 4.2A9.7 9.7 0 0 1 12 4c6.4 0 10 8 10 8a18.5 18.5 0 0 1-2.2 3.2"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m2 2 20 20"/></svg>';

const ESTILOS = `
.pw-campo{position:relative;display:block;width:100%}
.pw-campo>input{width:100%;padding-right:44px}
.pw-ojo{position:absolute;top:50%;right:6px;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:34px;height:34px;margin:0;padding:0;border:0;border-radius:6px;background:transparent;color:#666;cursor:pointer;line-height:0}
.pw-ojo:hover{color:#1983a3;background:rgba(25,131,163,.1)}
.pw-ojo:focus-visible{outline:2px solid #1983a3;outline-offset:1px}
.pw-ojo svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
`;

function inyectarEstilos() {
  if (document.getElementById("pw-ojo-estilos")) return;
  const style = document.createElement("style");
  style.id = "pw-ojo-estilos";
  style.textContent = ESTILOS;
  document.head.appendChild(style);
}

function mejorar(input) {
  if (input.dataset.pwOjo === "1") return;
  input.dataset.pwOjo = "1";

  // Si ya hay un contenedor propio (login) se reutiliza; si no, se crea uno
  let contenedor = input.parentElement;
  if (!contenedor.classList.contains("password-wrapper")) {
    contenedor = document.createElement("span");
    input.parentNode.insertBefore(contenedor, input);
    contenedor.appendChild(input);
  }
  contenedor.classList.add("pw-campo");

  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "pw-ojo";
  boton.setAttribute("aria-label", "Mostrar contraseña");
  boton.setAttribute("aria-pressed", "false");
  boton.title = "Mostrar contraseña";
  boton.innerHTML = OJO;

  // Evita que el campo pierda el foco al pulsar el botón con el ratón
  boton.addEventListener("mousedown", (e) => e.preventDefault());
  boton.addEventListener("click", () => {
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    boton.innerHTML = visible ? OJO_TACHADO : OJO;
    const etiqueta = visible ? "Ocultar contraseña" : "Mostrar contraseña";
    boton.setAttribute("aria-label", etiqueta);
    boton.setAttribute("aria-pressed", String(visible));
    boton.title = etiqueta;
    input.focus();
    const fin = input.value.length;
    try { input.setSelectionRange(fin, fin); } catch { /* algunos tipos no lo permiten */ }
  });

  contenedor.appendChild(boton);
}

function iniciar() {
  inyectarEstilos();
  document.querySelectorAll('input[type="password"]').forEach(mejorar);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
