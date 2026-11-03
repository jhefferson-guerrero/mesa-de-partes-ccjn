# Mesa de Partes Virtual

![Firebase](https://img.shields.io/badge/Backend-Firebase-orange)
![Storage](https://img.shields.io/badge/Files-Cloud%20Storage-blue)
![Auth](https://img.shields.io/badge/Auth-Firebase%20Auth-yellow)
![JS](https://img.shields.io/badge/Language-JavaScript-blue)
![Status](https://img.shields.io/badge/Status-Online-success)

Sistema web para registrar y gestionar solicitudes con adjuntos (PDF/Word).  
Incluye autenticación, bandeja **Mis Trámites**, **Perfil** y **correo automático** al encargado.

[![Abrir la demo](https://img.shields.io/badge/DEMO-abrir%20app-blue)](https://mesa-de-partes-5c6c2.web.app/)
[![Repositorio](https://img.shields.io/badge/GitHub-jheffersonGuerrero-000)](https://github.com/jhefferson-guerrero/mesa-de-partes-ccjn)


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
- **BaaS:** Firebase (Authentication, Firestore, Cloud Storage, Hosting)
- **Backend:** Cloud Functions (Node 22): envío de correo por SMTP (Gmail) y consulta de DNI

## Seguridad
- **Firestore y Storage** tienen reglas por usuario (`firestore.rules`, `storage.rules`): cada persona solo lee y crea sus propios datos y archivos.
- Las Cloud Functions exigen sesión con correo verificado. El correo se arma en el servidor con los datos guardados, no con lo que envíe el navegador.
- Ninguna clave va en el código. El token de DNI y las credenciales de correo viven en `functions/.env` (no se sube a Git).

## Configuración y despliegue
1. Copia `functions/.env.example` a `functions/.env` y completa los valores.
2. Instala dependencias de las funciones: `cd functions && npm install`.
3. Despliega todo junto (reglas, funciones y hosting): `firebase deploy`.

## Screenshots
 ![Login](screens/login.png)
 ![Registro de Solicitud](screens/solicitud.png)
 ![Adjuntar archivos y enviar](screens/solicitud-enviar.png)
 ![Mis Trámites](screens/mis-tramites.png)
 ![Perfil](screens/perfil.png)
 ![Actualizar contraseña](screens/actualizar-contrasena.png)

