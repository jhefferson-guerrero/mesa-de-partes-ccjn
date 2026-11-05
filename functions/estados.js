// functions/estados.js
// Estados de una solicitud y qué cambios se permiten. Reglas puras, sin Firebase.
const {HttpsError} = require("firebase-functions/v2/https");

const ESTADOS = ["Recibido", "En revisión", "Observado", "Atendido", "Rechazado"];
const FINALES = ["Atendido", "Rechazado"];

// Desde cada estado, a cuáles se puede pasar.
// "Observado" vuelve a "En revisión" solo cuando el ciudadano presenta su subsanación
// (lo hace el sistema, no el funcionario).
const TRANSICIONES = {
  "Recibido": ["En revisión", "Observado", "Atendido", "Rechazado"],
  "En revisión": ["Observado", "Atendido", "Rechazado"],
  "Observado": ["Atendido", "Rechazado"],
  "Atendido": [],
  "Rechazado": [],
};

// Estos cambios necesitan explicar el motivo al ciudadano.
const MENSAJE_OBLIGATORIO = ["Observado", "Rechazado"];
const MAX_MENSAJE = 1000;

// Las solicitudes anteriores a esta función no tienen estado: cuentan como "Recibido".
function estadoDe(fila) {
  return ESTADOS.includes(fila && fila.estado) ? fila.estado : "Recibido";
}

function limpiarMensaje(valor) {
  return String(valor ?? "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/\r\n?/g, "\n")
      .trim();
}

// Valida el cambio pedido por el funcionario y devuelve el mensaje ya limpio (o "").
function validarCambioEstado(actual, nuevo, mensaje) {
  if (!ESTADOS.includes(nuevo)) {
    throw new HttpsError("invalid-argument", "El estado no es válido.");
  }
  if (FINALES.includes(actual)) {
    throw new HttpsError("failed-precondition", `La solicitud ya está ${actual.toLowerCase()} y no admite más cambios.`);
  }
  if (!TRANSICIONES[actual].includes(nuevo)) {
    throw new HttpsError("failed-precondition", `No se puede pasar de "${actual}" a "${nuevo}".`);
  }
  const msg = limpiarMensaje(mensaje);
  if (msg.length > MAX_MENSAJE) {
    throw new HttpsError("invalid-argument", `El mensaje no puede superar los ${MAX_MENSAJE} caracteres.`);
  }
  if (MENSAJE_OBLIGATORIO.includes(nuevo) && !msg) {
    throw new HttpsError("invalid-argument", `Para marcar la solicitud como ${nuevo.toLowerCase()} debes escribir el motivo.`);
  }
  return msg;
}

// Mensajes sueltos entre el ciudadano y la mesa de partes (no cambian el estado). Solo mientras el trámite sigue abierto.
const MAX_MENSAJES = 100;

function validarMensaje(texto) {
  const msg = limpiarMensaje(texto);
  if (!msg) throw new HttpsError("invalid-argument", "Escribe el mensaje.");
  if (msg.length > MAX_MENSAJE) {
    throw new HttpsError("invalid-argument", `El mensaje no puede superar los ${MAX_MENSAJE} caracteres.`);
  }
  return msg;
}

// Devuelve la lista de mensajes con el nuevo agregado, o lanza el error si no se puede escribir.
function agregarMensaje(fila, entrada) {
  const estado = estadoDe(fila);
  if (FINALES.includes(estado)) {
    throw new HttpsError("failed-precondition", `El trámite ya está ${estado.toLowerCase()}: no admite más mensajes.`);
  }
  const previos = Array.isArray(fila.mensajes) ? fila.mensajes : [];
  if (previos.length >= MAX_MENSAJES) {
    throw new HttpsError("failed-precondition", "Se alcanzó el máximo de mensajes de este trámite.");
  }
  return [...previos, entrada];
}

module.exports = {
  ESTADOS, FINALES, TRANSICIONES, MENSAJE_OBLIGATORIO, MAX_MENSAJE, MAX_MENSAJES,
  estadoDe, limpiarMensaje, validarCambioEstado, validarMensaje, agregarMensaje,
};
