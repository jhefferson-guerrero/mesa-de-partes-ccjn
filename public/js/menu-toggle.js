// /js/menu-toggle.js
// Menú lateral contraíble: con un botón se reduce a solo iconos y se vuelve a expandir.
// - Recuerda la elección de la persona (localStorage) y la aplica antes de pintar la página.
// - Al contraer, cada opción muestra su nombre como ayuda (title) al pasar el ratón.
// - Es un script clásico (no módulo) para poder cargarlo en <head> sin esperar a Firebase.
(function () {
  var CLAVE = "menuColapsado";
  var raiz = document.documentElement;

  try {
    if (localStorage.getItem(CLAVE) === "1") raiz.classList.add("menu-colapsado");
  } catch (e) {
    /* sin almacenamiento: el menú arranca expandido */
  }

  // Si ya se sabe que la persona es funcionario (rol.js lo recuerda en la pestaña), se marca la página antes de
  // pintarla: el botón BANDEJA ya está en el HTML y el CSS solo lo muestra, así no parpadea al cambiar de pantalla.
  // Esto solo decide qué mostrar: la seguridad está en las funciones del servidor.
  try {
    var uid = sessionStorage.getItem("userDataUid");
    if (uid && sessionStorage.getItem("rolFuncionario:" + uid) === "1") raiz.classList.add("es-funcionario");
  } catch (e) {
    /* sin almacenamiento: rol.js lo marca cuando responda el servidor */
  }

  document.addEventListener("DOMContentLoaded", function () {
    var boton = document.getElementById("menuToggle");
    if (!boton) return;

    function pintar() {
      var colapsado = raiz.classList.contains("menu-colapsado");
      var texto = colapsado ? "Expandir menú" : "Contraer menú";
      boton.setAttribute("aria-expanded", String(!colapsado));
      boton.setAttribute("aria-label", texto);
      boton.title = texto;

      // Con el menú contraído solo se ven iconos: el nombre aparece como ayuda
      var items = document.querySelectorAll(".sidebar .menu-item, .sidebar .contact-info p");
      for (var i = 0; i < items.length; i++) {
        items[i].title = colapsado ? items[i].textContent.replace(/\s+/g, " ").trim() : "";
      }
    }

    boton.addEventListener("click", function () {
      var colapsado = raiz.classList.toggle("menu-colapsado");
      try {
        localStorage.setItem(CLAVE, colapsado ? "1" : "0");
      } catch (e) {
        /* se ignora */
      }
      pintar();
    });

    pintar();
  });
})();
