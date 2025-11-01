const dniInput = document.getElementById("dni");
const nombresInput = document.getElementById("nombres");
const apePInput = document.getElementById("apellidoPaterno");
const apeMInput = document.getElementById("apellidoMaterno");
const dniErrorIcon = document.querySelector(".dni-error-icon");
const dniSuccessIcon = document.querySelector(".dni-success-icon");

// Al inicio ocultar iconos
dniErrorIcon.style.display = "none";
dniSuccessIcon.style.display = "none";

dniInput.addEventListener("input", async () => {
    dniInput.value = dniInput.value.replace(/\D/g, "").slice(0, 8);
    const dni = dniInput.value.trim();

    // Resetear estilos
    dniInput.classList.remove("input-error", "input-success");
    dniErrorIcon.style.display = "none";
    dniSuccessIcon.style.display = "none";

    if (dni.length < 8) {
        nombresInput.value = "";
        apePInput.value = "";
        apeMInput.value = "";
        nombresInput.removeAttribute("readonly");
        apePInput.removeAttribute("readonly");
        apeMInput.removeAttribute("readonly");
        return;
    }

    try {
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJleHAiOjE3MzI3NTQ5OTd9.Zw_MnXDS8edLTV-iu_cJP6-TevUgQt_4YMx1htCwwSw";
        const response = await fetch(`https://miapi.cloud/v1/dni/${dni}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const { datos } = await response.json();

        if (!datos || !datos.dni) {
            dniInput.classList.add("input-error");
            dniErrorIcon.style.display = "block";

            nombresInput.value = "";
            apePInput.value = "";
            apeMInput.value = "";
            nombresInput.removeAttribute("readonly");
            apePInput.removeAttribute("readonly");
            apeMInput.removeAttribute("readonly");
            return;
        }

        dniInput.classList.add("input-success");
        dniSuccessIcon.style.display = "block";

        nombresInput.value = datos.nombres;
        apePInput.value = datos.ape_paterno;
        apeMInput.value = datos.ape_materno;

        nombresInput.setAttribute("readonly", true);
        apePInput.setAttribute("readonly", true);
        apeMInput.setAttribute("readonly", true);

    } catch (error) {
        console.error(error);
        dniInput.classList.add("input-error");
        dniErrorIcon.style.display = "block";

        nombresInput.value = "";
        apePInput.value = "";
        apeMInput.value = "";
        nombresInput.removeAttribute("readonly");
        apePInput.removeAttribute("readonly");
        apeMInput.removeAttribute("readonly");
    }
});