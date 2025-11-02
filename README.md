# Mesa de Partes Virtual

![Firebase](https://img.shields.io/badge/Backend-Firebase-orange)
![Storage](https://img.shields.io/badge/Files-Cloud%20Storage-blue)
![Auth](https://img.shields.io/badge/Auth-Firebase%20Auth-yellow)
![JS](https://img.shields.io/badge/Language-JavaScript-blue)
![Status](https://img.shields.io/badge/Status-Online-success)

Sistema web para registrar y gestionar solicitudes con adjuntos (PDF/Word).  
Incluye autenticación, bandeja **Mis Trámites**, **Perfil** y **correo automático** al encargado.

[![Abrir la demo](https://img.shields.io/badge/DEMO-abrir%20app-blue)](https://mesa-de-partes-5c6c2.web.app/)
[![Repositorio](https://img.shields.io/badge/GitHub-Novita17x-000)](https://github.com/Novita17x/mesa-de-partes-ccjn)


## Demo rápida
- **Usuario demo:** `democcjn@gmail.com`
- **Contraseña:** `Demo123456*`

> Entra con la cuenta demo, crea una “Solicitud simple”, adjunta un PDF y verifica que aparece en **Mis Trámites**. El encargado recibe un correo con los datos y el adjunto.

## Funcionalidades
- Login, registro y recuperación de contraseña (Firebase Auth).
- Crear solicitud con adjuntos (PDF/Word) y envío por correo al encargado.
- Mis Trámites: historial con fecha, tipo/subtipo y visor de PDF.
- Perfil: editar datos personales y contraseña.
- Validaciones de campos, tamaño de archivo y confirmaciones.

## Stack
- **Frontend:** HTML5, CSS3, JavaScript
- **BaaS:** Firebase (Authentication, Firestore, Hosting)
- **Email:** (Cloud Function/servicio SMTP)

## Screenshots
 ![Login](screens/login.png)
 ![Registro de Solicitud](screens/solicitud.png)
 ![Adjuntar archivos y enviar](screens/solicitud-enviar.png)
 ![Mis Trámites](screens/mis-tramites.png)
 ![Perfil](screens/perfil.png)
 ![Actualizar contraseña](screens/actualizar-contrasena.png)

