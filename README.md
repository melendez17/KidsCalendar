# Kids Calendar

Landing pública → registro / inicio de sesión → dashboard privado. HTML, CSS y JavaScript Vanilla; servidor Node.js y SQLite sin paquetes externos.

## Iniciar

1. Usa Node.js 24 o superior.
2. En esta carpeta ejecuta `npm start` o `node server.mjs`. No hace falta npm install.
3. Abre http://localhost:8787 y crea una cuenta familiar.

En Windows puedes hacer doble clic en iniciar.cmd. Mantén la terminal abierta. Ya no se inicia abriendo index.html directamente: las cuentas necesitan el servidor.

## Funcionalidades

- Landing basada en el proyecto educativo: autonomía, organización, acompañamiento familiar y motivación para niños de 7 a 12 años.
- Registro del adulto con nombre, correo y contraseña de 12 a 128 caracteres. No se pide nombre completo ni fecha de nacimiento del niño.
- Contraseñas derivadas con scrypt y sal aleatoria, nunca en texto plano. Sesión mediante cookie HttpOnly, SameSite=Lax, siete días; Secure con HTTPS.
- Cada cuenta tiene su calendario, tareas, descripciones, materias, estrellas, turnos y récords. Supervisión es una vista dentro de la cuenta familiar, sin credenciales separadas para padre e hijo.
- Materias sin emojis con seis colores predefinidos. Estrellas ganadas hoy, rachas e historial.
- Completar por primera vez una tarea da 10 estrellas. Cada partida cuesta una. Tres juegos sin límite de duración y con velocidad progresiva. Reabrir tareas no duplica recompensas.
- Recordatorios con permiso del navegador y la página abierta. La preferencia se guarda por cuenta; el permiso se concede por navegador.
- Guardado automático en SQLite con indicador. En fallos de conexión o conflictos entre pestañas, se detiene el guardado y se ofrece descargar los cambios pendientes. Antes de iniciar una partida se confirma que se guardó el turno.

## Estructura

- index.html: landing.
- auth.html y public/auth.js: registro e inicio de sesión.
- public/site.css: estilos públicos.
- dashboard.html: calendario, tareas y juegos.
- server.mjs: servidor HTTP, autenticación y endpoints.
- agenda-store.mjs: esquema, migración y consultas SQLite de la agenda.
- tests/: pruebas del servidor y del dashboard.
- data/calendar.sqlite: base creada automáticamente, excluida de Git.

Cada cuenta tiene una agenda en `agendas`, con su revisión, turnos gastados y preferencia de recordatorios. Las materias, tareas, recompensas y récords se guardan en `subjects`, `tasks`, `rewards` y `game_records`. Cada tarea referencia a una materia de la misma cuenta. Las recompensas se vinculan a la agenda y conservan el identificador histórico de la tarea para que sus estrellas sigan disponibles aunque se borre la tarea.

Al iniciar el servidor con una base anterior, SQLite convierte el contenido de `agendas.payload` en filas dentro de una transacción. El endpoint `/api/state` sigue enviando y recibiendo JSON como formato de intercambio.

## Respaldos y datos anteriores

Detén el servidor antes de copiar la carpeta data como respaldo. Conserva data al actualizar el código. Las agendas anteriores de localStorage permanecen en el navegador original y no se asignan automáticamente a una cuenta, para evitar mezclar información en dispositivos compartidos. Las cuentas nuevas comienzan vacías.

## Pruebas

Ejecuta `npm test`: registro, correo duplicado, credenciales incorrectas, sesiones, rutas protegidas, aislamiento por cuenta, validación, conflictos, solicitudes desde otro origen, cierre de sesión y persistencia después de reiniciar. También comprueba el flujo del dashboard: cargar cuenta, crear y completar tarea, guardar estrellas y consumir un turno. Utiliza una base temporal sin tocar datos reales.

## Publicación posterior

Esta entrega es local, todavía no está publicada. Para usarla desde varios dispositivos, aloja Node.js en un servicio con disco persistente para SQLite, HTTPS y respaldos. Configura APP_ORIGIN con el origen exacto, HOST=0.0.0.0, PORT y opcionalmente DB_PATH. La carpeta data nunca debe servirse como archivos públicos.

La versión inicial no incluye recuperación de contraseña por correo, verificación del correo, múltiples perfiles infantiles ni sincronización en tiempo real. El control de intentos es local al proceso. Antes de abrir registros públicos, completa recuperación/verificación y la información de privacidad correspondiente. Los puntos son motivacionales: están aislados por cuenta y validados, pero no constituyen un sistema protegido contra modificaciones del propio usuario.

Referencias: [SQLite de Node.js](https://nodejs.org/api/sqlite.html) y [criptografía de Node.js](https://nodejs.org/api/crypto.html).
