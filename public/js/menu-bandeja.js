// /js/menu-bandeja.js
// Va justo después del menú lateral y es un script normal (no módulo) para que se ejecute mientras se arma
// la página: si ya se sabe que la persona es funcionario (rol.js lo recuerda en la pestaña), "BANDEJA" aparece
// en el mismo instante que el resto del menú y no "parpadea" al cambiar de pantalla.
// Esto solo decide qué mostrar: la seguridad está en las funciones del servidor.
(function () {
  function agregarMenuBandeja() {
    var menu = document.querySelector(".sidebar");
    if (!menu || menu.querySelector("[data-bandeja]")) return;

    var item = document.createElement("div");
    item.className = "menu-item";
    item.setAttribute("data-bandeja", "");
    item.addEventListener("click", function () { window.location.href = "bandeja.html"; });

    var icono = document.createElement("span");
    icono.className = "icon";
    var i = document.createElement("i");
    i.className = "fa-solid fa-inbox";
    icono.appendChild(i);

    var texto = document.createElement("span");
    texto.className = "text";
    var fuerte = document.createElement("strong");
    fuerte.textContent = "BANDEJA";
    texto.appendChild(fuerte);

    item.appendChild(icono);
    item.appendChild(texto);
    if (document.documentElement.classList.contains("menu-colapsado")) item.title = "BANDEJA";

    menu.insertBefore(item, menu.querySelector(".contact-info"));
  }

  window.agregarMenuBandeja = agregarMenuBandeja;

  try {
    var uid = sessionStorage.getItem("userDataUid");
    if (uid && sessionStorage.getItem("rolFuncionario:" + uid) === "1") agregarMenuBandeja();
  } catch (e) { /* sin almacenamiento: rol.js lo agrega cuando responda el servidor */ }
})();
