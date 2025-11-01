import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// Listener de sesión activa
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDocRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userDocRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                sessionStorage.setItem("userData", JSON.stringify(userData));

                // Disparar evento para avisar que los datos ya están listos
                document.dispatchEvent(new Event("userDataLoaded"));
            } else {
                console.warn("No se encontró el documento del usuario en Firestore.");
            }
        } catch (error) {
            console.error("Error cargando datos del usuario:", error);
        }
    } else {
        console.warn("Usuario no autenticado. Redirigiendo al login...");
        window.location.href = "index.html";
    }
});
