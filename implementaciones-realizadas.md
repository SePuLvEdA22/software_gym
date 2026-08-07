# Implementaciones Realizadas — BodyFitGym

> Registro de cambios realizados para preparar la aplicación para producción.
> Inicio: Junio 2026

---

## Índice

1. [ESLint + Prettier](#1-eslint--prettier)
2. [Tests Automatizados (Vitest)](#2-tests-automatizados-vitest)
3. [Rate-limiting en Login](#3-rate-limiting-en-login)
4. [Paginación en Listados](#4-paginación-en-listados)
5. [UI de Backup/Restore](#5-ui-de-backuprestore)
6. [GitHub Actions (CI/CD)](#6-github-actions-cicd)
7. [Sentry](#7-sentry)
8. [Migrar Fotos BLOB a Archivos](#8-migrar-fotos-blob-a-archivos)
9. [Validación IPC con Zod](#9-validación-ipc-con-zod)
10. [Serial Relay con librería serialport](#10-serial-relay-con-librería-serialport)
11. [.env.example](#11-envexample)

---

## 1. ESLint + Prettier

### ¿Por qué?
No existía análisis estático de código ni formateo automático. Esto permitía código inconsistente y bugs evitables.

### ¿Qué se hizo?
- Se instaló:
  - `eslint` + `@eslint/js` + `typescript-eslint`
  - `prettier` + `eslint-config-prettier`
  - `eslint-plugin-react-hooks`
- Se creó `eslint.config.js` (flat config moderna)
- Se creó `.prettierrc`
- Se agregaron scripts `lint` y `format` en `package.json`

### Archivos creados/modificados
| Archivo | Acción |
|---------|--------|
| `eslint.config.js` | Creado |
| `.prettierrc` | Creado |
| `package.json` | Modificado (scripts + devDependencies) |

---

## 2. Tests Automatizados (Vitest)

### ¿Por qué?
Cero tests en todo el proyecto. Cualquier refactor o nueva feature podía romper funcionalidad existente sin detección.

### ¿Qué se hizo?
- Se instaló `vitest`
- Se crearon tests unitarios para:
  - Base de datos: clientes, usuarios, membresías
  - Autenticación
- Se configuró Vitest en `vitest.config.ts`

### Archivos creados/modificados
| Archivo | Acción |
|---------|--------|
| `vitest.config.ts` | Creado |
| `src/__tests__/database/clients.test.ts` | Creado |
| `src/__tests__/database/users.test.ts` | Creado |
| `package.json` | Modificado (script test + devDependency) |

---

## 3. Rate-limiting en Login

### ¿Por qué?
No había límite de intentos de inicio de sesión, permitiendo ataques de fuerza bruta contra el panel de administración.

### ¿Qué se hizo?
- Se implementó un sistema de rate-limiting en memoria usando `Map`
- Bloqueo de 30 segundos después de 5 intentos fallidos por usuario
- Se limpiaron automáticamente las entradas expiradas

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/main/database/users.ts` | Se agregó lógica de rate-limiting en `authenticateUser()` |

---

## 4. Paginación en Listados

### ¿Por qué?
Clientes, pagos, accesos e inventario cargaban **todos los registros en memoria**, causando degradación con cientos/miles de registros.

### ¿Qué se hizo?
- Se agregaron tipos `PageRequest` y `PageResponse<T>` en `shared/types.ts`
- Se modificaron las consultas SQL en `clients.ts`, `memberships.ts`, `inventory.ts` para aceptar `LIMIT`/`OFFSET` y devolver `PageResponse`
- Se agregaron parámetros `page` y `pageSize` en los IPC handlers correspondientes
- Se actualizó el preload para exponer los métodos con tipos paginados
- **Pendiente:** Actualizar componentes React para mostrar controles de paginación

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/shared/types.ts` | Tipos PageRequest/PageResponse |
| `src/main/database/clients.ts` | Consultas con LIMIT/OFFSET (ya existía) |
| `src/main/database/memberships.ts` | Consultas con LIMIT/OFFSET para payments y access logs |
| `src/main/database/inventory.ts` | Consultas con LIMIT/OFFSET |
| `src/main/ipc/index.ts` | Handlers con paginación |
| `src/preload/index.ts` | Métodos con tipos paginados |

---

## 5. UI de Backup/Restore

### ¿Por qué?
La función `backupDatabase()` existía en IPC pero no había ningún botón ni página para que el usuario la ejecutara.

### ¿Qué se hizo?
- **Ya estaba implementado** en `SettingsPage.tsx` (líneas 1241-1274) con botones "Respaldar Base de Datos" y "Restaurar Base de Datos"
- No se requirieron cambios adicionales

### Archivos
| Archivo | Estado |
|---------|--------|
| `src/renderer/src/pages/SettingsPage.tsx` | Ya implementado |

---

## 6. GitHub Actions (CI/CD)

### ¿Por qué?
No existían pipelines de integración continua. Cada release era un proceso manual sin garantías de calidad.

### ¿Qué se hizo?
- Se creó `ci.yml` con jobs para:
  - **Lint**: ejecuta ESLint
  - **Typecheck**: ejecuta `tsc --noEmit`
  - **Test**: ejecuta Vitest
  - **Build**: ejecuta `electron-vite build`
- Trigger: push a `main` + pull requests

### Archivos creados
| Archivo | Acción |
|---------|--------|
| `.github/workflows/ci.yml` | Creado |

---

## 7. Sentry

### ¿Por qué?
Los errores en producción solo quedaban en un archivo de log local. El equipo no se enteraba de crashes hasta que el usuario reportaba.

### ¿Qué se hizo?
- Se agregó Sentry con DSN configurable vía variable de entorno
- Integración en proceso main y renderer
- Captura de errores no capturados y promesas rechazadas

### Archivos creados/modificados
| Archivo | Acción |
|---------|--------|
| `package.json` | Modificado (dependencia `@sentry/electron`) |
| `src/main/index.ts` | Integración Sentry en main process |
| `src/renderer/src/main.tsx` | Integración Sentry en renderer |

---

## 8. Migrar Fotos BLOB a Archivos

### ¿Por qué?
Las fotos de clientes se almacenaban como `BLOB` en SQLite. Con el tiempo, la BD crecía sin control afectando rendimiento.

### ¿Qué se hizo?
- Nueva migración `008_migrate_photos_to_files`:
  - Agrega columna `photo_path` a `clients`
  - Exporta BLOBs existentes a `app.getPath('userData')/photos/` como archivos `.jpg`
  - Se mantiene columna `photo` por compatibilidad (no se elimina para evitar recreación de tabla)
- Se modificó `clients.ts`:
  - `DbClient` usa `photo_path: string | null` en vez de `photo: Buffer | null`
  - `savePhotoFile()` escribe archivo JPEG desde base64
  - `readPhotoFile()` lee archivo y retorna base64
  - `createClient()` guarda foto como archivo, almacena ruta en `photo_path`
  - `updateClient()` guarda foto como archivo solo si `data.photo` viene definido
  - `mapDbClient()` lee archivo y expone base64 → API contract intacto
- No se requirieron cambios en UI (`CameraCapture`, `ClientsPage`) porque el contrato base64 se preserva

### Archivos creados/modificados
| Archivo | Acción |
|---------|--------|
| `src/main/database/index.ts` | Nueva migración 008 |
| `src/main/database/clients.ts` | Lógica de archivos en vez de BLOB |

---

## 9. Validación IPC con Zod

### ¿Por qué?
Los handlers IPC en main confiaban en que el preload/envía datos válidos. No había sanitización en los argumentos recibidos.

### ¿Qué se hizo?
- Se instaló `zod`
- Se definieron schemas en `src/shared/schemas.ts`
- Se aplicó validación en handlers críticos (clientes, usuarios, membresías, pagos)

### Archivos creados/modificados
| Archivo | Acción |
|---------|--------|
| `package.json` | Modificado (dependencia `zod`) |
| `src/shared/schemas.ts` | Creado (schemas Zod) |
| `src/main/ipc/index.ts` | Validación con Zod en handlers |

---

## 10. Serial Relay con librería serialport

### ¿Por qué?
El relé serie usaba `fs.write` raw al puerto COM sin control de baudios, paridad ni handshake, lo que es poco confiable.

### ¿Qué se hizo?
- ~~Se instaló `serialport`~~ Revertido: `serialport` tiene dependencia nativa `@serialport/bindings-cpp` que falla con Electron sin C++ tools
- Se mantuvo `fs.openSync`/`fs.writeSync` raw usando `'wx+'` mode (abre sin buffer, escribe síncrono, cierra)
- La app ahora tiene **0 dependencias nativas** — 100% JS/WASM, sin `node-gyp` ni `electron-rebuild`

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `package.json` | Eliminada dependencia `serialport` |
| `src/main/door/serialRelay.ts` | Revertido a `fs` raw |

---

## 11. .env.example

### ¿Por qué?
`.env` estaba en `.gitignore` pero no había `.env.example` documentando las variables necesarias.

### ¿Qué se hizo?
- Se creó `.env.example` con todas las variables y sus descripciones

### Archivos creados
| Archivo | Acción |
|---------|--------|
| `.env.example` | Creado |

---

## Resumen de Dependencias Agregadas

### Producción
| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `@sentry/electron` | ^5.x | Monitoreo de errores |
| `zod` | ^3.x | Validación de datos IPC |
| `electron-updater` | ^6.x | Actualizaciones automáticas |
| `sql.js` | ^1.x | SQLite puro JS (WASM) |

### Desarrollo
| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `vitest` | ^2.x | Framework de tests |
| `eslint` | ^9.x | Linter |
| `prettier` | ^3.x | Formateo de código |
| `typescript-eslint` | ^8.x | Reglas ESLint para TypeScript |
| `eslint-config-prettier` | ^9.x | Compatibilidad ESLint + Prettier |
| `eslint-plugin-react-hooks` | ^5.x | Reglas para React Hooks |

## 12. Migrar better-sqlite3 → sql.js

### ¿Por qué?
`better-sqlite3` requiere compilación nativa (`node-gyp`) y daba error `NODE_MODULE_VERSION` mismatch con Electron. No se pudo usar `electron-rebuild` por falta de herramientas C++ de VS. `sql.js` es SQLite compilado a WASM, 100% JavaScript, sin dependencias nativas.

### ¿Qué se hizo?
- Se instaló `sql.js` y se eliminó `better-sqlite3`
- Se eliminó `@electron/rebuild` y los scripts `postinstall` / `rebuild` del `package.json`
- Se creó clase `SqlJsDatabase` que envuelve `sql.js.Database` y expone la misma API que `better-sqlite3`:
  - `prepare(sql)` → `{ run(), get(), all() }` — cada llamada crea/free su propio statement
  - `exec(sql)`, `run(sql, params)`, `close()`, `transaction(fn)`
  - Persistencia automática: exporta a disco tras cada escritura mediante `db.export()`
  - `batchSaving` flag para diferir escrituras dentro de transacciones
  - `getRowsModified()` para rastrear cambios reales (DELETE, UPDATE)
- `initDatabase()` ahora es async (retorna `Promise`)
- `restoreDatabase()` ahora es async
- Se actualizó `src/main/index.ts` para `await initDatabase()`
- Se actualizaron tests para `beforeAll(async () => await initDatabase())`
- Se actualizó IPC handler de restore para `await restoreDatabase()`

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `package.json` | `sql.js` agregado, `better-sqlite3`/`@electron/rebuild` eliminados, scripts `postinstall`/`rebuild` eliminados |
| `src/main/database/index.ts` | Reescribir completo con `SqlJsDatabase` wrapper sobre `sql.js` |
| `src/main/index.ts` | `await initDatabase()` |
| `src/main/ipc/index.ts` | `await restoreDatabase()` |
| `src/__tests__/database/clients.test.ts` | `await initDatabase()` |
| `src/__tests__/database/users.test.ts` | `await initDatabase()` |

---

## 13. Auto-updater (electron-updater)

### ¿Por qué?
Cada release requería descarga/instalación manual. `electron-updater` permite actualizaciones automáticas vía GitHub Releases, con barra de progreso en la UI.

### ¿Qué se hizo?
- Se instaló `electron-updater`
- Se agregó `publish.github` en `electron-builder` config (`owner: SePuLvEdA22`, `repo: software_gym`)
- Se creó `src/main/updater.ts`:
  - `initUpdater(adminWindow)` configura eventos `checking`, `update-available`, `update-not-available`, `error`, `download-progress`, `update-downloaded`
  - `autoUpdater.autoDownload = false` (el usuario decide cuándo descargar)
  - IPC handlers: `update:check`, `update:download`, `update:install`
- Se expuso API en preload (`window.electronAPI.update.onChecking/onAvailable/onDownloadProgress/onDownloaded/onError`, más `.check()/.download()/.install()`)
- Se creó `UpdateChecker` componente React con:
  - Botón "Buscar actualizaciones"
  - Estados: checking, available, not-available, downloading (barra de progreso), downloaded, error
  - Botón "Descargar" y "Reiniciar e instalar"
- Se integró en `SettingsPage` después de la sección Backup
- Se enlazó `initUpdater(adminWindow)` en `src/main/index.ts` tras crear la ventana admin

### Archivos creados/modificados
| Archivo | Acción |
|---------|--------|
| `package.json` | Dependencia + publish config |
| `src/main/updater.ts` | Creado |
| `src/main/index.ts` | `initUpdater(adminWindow)` |
| `src/preload/index.ts` | API `update` con eventos + comandos |
| `src/renderer/src/components/UpdateChecker.tsx` | Creado |
| `src/renderer/src/pages/SettingsPage.tsx` | Importar + renderizar `UpdateChecker` |

---

## 14. Fase 1 — Preparación final para producción (agosto 2026)

### ¿Por qué?
Cierre de las brechas críticas detectadas en el análisis de producción: el DSN de Sentry no llegaba al instalador empaquetado (Sentry inactivo en prod), y los providers de WhatsApp placeholder (`twilio`, `custom`) marcaban mensajes como "Enviado" sin enviar nada realmente.

### 14.1 Sentry: DSN horneado en el build 🔥

**Problema:** `process.env.SENTRY_DSN` solo existe en la máquina del desarrollador; en un `.exe` empaquetado la variable no existe, por lo que Sentry nunca se inicializaba en producción.

**Qué se hizo:**
- `electron.vite.config.ts` ahora carga **todas** las variables de entorno (`.env` + `process.env`) con `loadEnv(mode, process.cwd(), '')` y **hornea (bake)** el DSN en el bundle en tiempo de build mediante `define`:
  - Main: `process.env.SENTRY_DSN` → valor estático
  - Renderer: `import.meta.env.VITE_SENTRY_DSN` → valor estático
- `src/renderer/src/main.tsx` simplificado: lee `import.meta.env.VITE_SENTRY_DSN` (reemplazo estático de Vite) con fallback a `window.__SENTRY_DSN__`
- `.github/workflows/release.yml`: paso `SENTRY_DSN` del secret de GitHub Actions al build
- `.env.example`: documenta que el DSN se hornea en build
- **Verificado:** con `SENTRY_DSN=...` el DSN aparece en `out/main/index.js` y `out/renderer/assets/*.js`; sin DSN, Sentry queda desactivado (código eliminado por tree-shaking) y el build no falla.

**Configuración requerida (una vez):**
```bash
# GitHub → Settings → Secrets → Actions → New repository secret
# Name: SENTRY_DSN
# Value: https://xxx@o123.ingest.sentry.io/456
```

### 14.2 WhatsApp: eliminar providers placeholder que fingían éxito 🚫

**Problema:** `sendViaTwilio()` y `sendViaCustom()` devolvían `{ success: true }` sin enviar nada, marcando mensajes como "Enviado" falsamente en el historial.

**Qué se hizo:**
- `src/main/whatsapp/index.ts`:
  - `sendViaTwilio` / `sendViaCustom` ahora devuelven `{ success: false, error: '...' }` con log de error
  - El caso `default` de `sendViaProvider` también devuelve error
  - `formatPhoneNumber()` ahora es exportado para testing
- `src/renderer/src/pages/SettingsPage.tsx`: se eliminaron las opciones `twilio` y `custom` del dropdown de proveedores (solo quedan `mock`, `evolution_api` y `whatsapp_cloud`)
- Tests: `src/__tests__/whatsapp.test.ts` (14 tests) — generadores de mensajes, formato de teléfono (prefijo 57), y verificación de que twilio/custom NO marcan como enviado

### 14.3 Migración legacy validada con datos reales 📊

- Se ejecutó `npm run migrate:legacy` sobre `software_actual/db_actual.sql` (394 MB):
  - **22,632 registros migrados** (2,333 socios, 3,705 sociomembresias, 3,464 pagos, 13 planes, 5,057 detalleentrada, 4,828 detallesalida, etc.)
  - El filtro `idEstado !== 1` salta correctamente membresías eliminadas/inactivas junto con sus pagos
  - ⚠️ **Hallazgo:** la tabla `visita` (12,332 filas) no estaba mapeada en el migrador — ✅ **resuelto en Fase 5** (ver §18)
  - ⚠️ Contraseñas de usuarios legacy en texto plano: se asigna hash de `admin123` por defecto (documentado)
- Test de regresión: `src/__tests__/database/legacyMigration.test.ts` (4 tests)

### 14.4 QA ejecutado (según estándares de calidad)

| Verificación | Resultado |
|--------------|-----------|
| Tests unitarios | ✅ 183 tests (12 archivos), incluidos 14 nuevos de WhatsApp |
| Typecheck (`tsc --noEmit`) | ✅ 0 errores |
| Lint (ESLint) | ✅ 0 errores, 315 warnings pre-existentes (sin nuevos) |
| Formato (Prettier) | ✅ aplicado a archivos modificados |
| Build (electron-vite) | ✅ con y sin DSN |
| Migración con datos reales | ✅ 22,632 registros |
| `npm audit --omit=dev` | ⚠️ 11 vulnerabilidades (8 moderate, 3 high) en dependencias de producción — electron 31, js-yaml, uuid; requiere actualización programada |
| Mutation testing | ⚠️ No configurado (sin Stryker); pendiente para siguiente iteración |
| Cobertura | ⚠️ No configurada en CI; pendiente (ver estándares, umbral sugerido ≥80%) |

### Archivos creados/modificados (Fase 1)
| Archivo | Acción |
|---------|--------|
| `electron.vite.config.ts` | DSN horneado vía `loadEnv` + `define` |
| `src/renderer/src/main.tsx` | Lectura limpia de `VITE_SENTRY_DSN` |
| `.env.example` | Documentación del DSN |
| `.github/workflows/release.yml` | Secret `SENTRY_DSN` → build |
| `src/main/whatsapp/index.ts` | Placeholders devuelven error; `formatPhoneNumber` exportado |
| `src/renderer/src/pages/SettingsPage.tsx` | Dropdown sin twilio/custom |
| `src/__tests__/whatsapp.test.ts` | Creado (14 tests) |
| `scripts/migrate-legacy-data.ts` + `src/main/migration/legacyMigrator.ts` | Filtro `idEstado` (WIP previo, ahora commiteado) |

---

## 15. Fase 2 — Brechas críticas resueltas (agosto 2026)

### 15.1 Dependencias: Electron 31 → 43 y limpieza de vulnerabilidades 🔒

**Problema:** `npm audit --omit=dev` reportaba **11 vulnerabilidades** (8 moderadas, 3 altas); Electron 31.7.7 estaba EOL con 8 advisories de seguridad directos.

**Qué se hizo:**
- `electron` ^31.3.1 → **^43.3.0** (elimina los 8 advisories del runtime)
- `electron-builder` 26.8.1 → 26.15.3
- `uuid` ^10 → **^11.1.1** (advisory de buffer bounds; la app solo usa v4, sin cambios de API)
- `react-router-dom` ^6 → **^7.18.2** (corrige open redirect + deserializeErrors SSR; el uso del router es básico: HashRouter/Routes/Route/Navigate)
- Se regeneró `package-lock.json` con instalación limpia

**Resultado:** `npm audit --omit=dev` pasó de **11 → 2** vulnerabilidades. Las 2 restantes (high) corresponden al advisory **RSC-mode CSRF** de react-router (7.12–8.2), que **no aplica** a esta app (SPA de Electron sin React Server Components ni SSR). El fix de ese advisory entra en conflicto con los otros dos (whack-a-mole entre versiones), por lo que se documenta como riesgo residual aceptado.

⚠️ **Pendiente obligatorio antes de publicar:** smoke test manual en Windows real — ventanas (admin, kiosco, cliente, renovación), sql.js WASM, relé de puerta y flujo del auto-updater. El CI valida compilación/tests, pero no el runtime del shell de Electron 43.

### 15.2 Cambio forzado de contraseña del admin 🔑

**Problema:** las credenciales por defecto `admin/admin123` hardcodeadas en la migración 006 quedaban activas indefinidamente en producción.

**Qué se hizo:**
- Migración `011_force_password_change`: si el admin aún usa `admin123`, marca `must_change_password=1` (instalaciones con contraseña ya cambiada quedan en 0)
- `authenticateUser` devuelve `mustChangePassword` **solo para la cuenta `user_admin`** (evita bloquear a recepcionistas/trainers en la pantalla de cambio)
- `LoginPage` muestra pantalla obligatoria de cambio de contraseña antes de entrar al panel
- `system:updateAdmin` ahora **verifica la contraseña actual** (antes no la validaba) y limpia la bandera al cambiar; `user:update` también la limpia al cambiar la contraseña de `user_admin`
- Tests: 3 nuevos en `users.test.ts` (flag por defecto, limpieza tras cambio, verificación de contraseña)

### 15.3 Respaldo automático de la base de datos 💾

**Problema:** la BD es un único archivo local y solo existía respaldo manual desde Configuración; si el PC fallaba, se perdía todo.

**Qué se hizo:**
- Nuevo módulo `src/main/backup.ts`: copia **al iniciar la app + cada 24 h**, con rotación (retención configurable 1–30, por defecto 7) en `userData/backups`
- IPC: `backup:getConfig`, `backup:setConfig`, `backup:runNow` (los 2 últimos con rol admin)
- UI en Configuración → Sistema: toggle de respaldo automático, retención, fecha del último respaldo y botón "Crear Respaldo Ahora"
- La copia manual con selector de ubicación se mantiene ("Guardar Copia") — recomendada para destino externo (USB/nube), ya que el respaldo automático vive en el mismo disco que la BD
- Tests: 5 nuevos en `backup.test.ts` (creación, config, clamping de retención, poda, BD no inicializada)

### 15.4 Fix de aislamiento de tests 🧪

**Problema latente:** el mock de `userData` en `src/__tests__/setup.ts` usaba `Date.now()`, que podía colisionar entre workers en paralelo (dos archivos de test compartiendo la misma base de datos → tests no independientes, fallos intermitentes).

**Qué se hizo:** se reemplazó por `randomUUID()`, garantizando un directorio único por archivo de test.

### QA Fase 2

| Verificación | Resultado |
|---|---|
| Tests unitarios | ✅ 191 (13 archivos; 8 nuevos) |
| Typecheck (`tsc --noEmit`) | ✅ 0 errores |
| Lint (ESLint) | ✅ 0 errores |
| Build (electron-vite) | ✅ con Electron 43 |
| `npm audit --omit=dev` | ⚠️ 2 high (react-router RSC-mode, N/A para esta app) |

---

## 16. Optimización de rendimiento (agosto 2026)

### ¿Por qué?
Análisis basado en mediciones reales (`scripts/bench-save.cjs`): la escritura de sql.js **no** es el cuello de botella (2–7 ms aun con 60k registros). Los costos reales eran: fotos completas en base64 leídas del disco en cada listado, subconsultas correlacionadas sin índices, refetch agresivo del dashboard y recharts (~500 KB) en el chunk inicial.

### 16.1 Miniaturas de fotos (thumbnails) 🖼️

**Problema:** `mapDbClient` leía la foto completa (200–500 KB) y la codificaba a base64 **por cada cliente devuelto**: ~15 MB por página de 50 clientes vía IPC.

**Qué se hizo:**
- Nueva migración `012_add_indexes_thumbnails`: columna `thumbnail_path` en `clients` + índices (ver 16.2)
- Nuevo módulo `src/main/photos.ts` con `jimp` (^1.6): genera thumbnail JPEG de **160px, calidad 70** (unos KB)
  - `generateThumbnail()`: cover 160×160 desde la foto completa
  - `scheduleThumbnail()`: dispara en segundo plano tras guardar/actualizar una foto (sin bloquear el guardado)
  - `ensureThumbnails()`: backfill de las fotos existentes al arrancar, cediendo el event loop entre clientes
- `mapDbClient` ahora acepta `{ thumbnailOnly }`: los **listados** (getAllClients, searchClients) devuelven la miniatura; el **detalle** (getClientById, kiosco, edición) devuelve la foto completa. Si no hay miniatura aún, cae a la foto completa (degradación elegante hasta el backfill)
- IPC: `scheduleThumbnail` se dispara al crear/actualizar cliente
- **Impacto:** ~15 MB → ~100 KB por página

### 16.2 Índices de base de datos 📊

**Problema:** `getInactiveClients()` ejecutaba 3 subconsultas correlacionadas sobre `access_logs` **sin índice** (full-scan por cliente × 22k accesos), y `getDebtors()`/conteo de deudores sobre `payments` sin índice. El dashboard las ejecuta 2 veces por carga y cada 30 s.

**Qué se hizo** (migración `012_add_indexes_thumbnails`):
- `CREATE INDEX IF NOT EXISTS idx_access_logs_client ON access_logs(client_id)`
- `CREATE INDEX IF NOT EXISTS idx_access_logs_result_ts ON access_logs(result, timestamp)`
- `CREATE INDEX IF NOT EXISTS idx_payments_membership ON payments(membership_id)`

### 16.3 Cache de queries del dashboard con TTL ⏱️

**Qué se hizo:**
- Nuevo helper `src/main/database/queryCache.ts`: `cached(key, ttlMs, fn)` con expiración por tiempo y `clearQueryCache()`
- `getInactiveClients()` → cache TTL **60 s** (key incluye el umbral de días)
- `getBirthdaysThisMonth()` → cache TTL **10 min** (key incluye el mes, para no servir el mes anterior tras la medianoche)
- **Invalidación en escrituras** (el cache nunca queda obsoleto): createClient, updateClient, deleteClient, updateClientStatus, createMembership, freeze/unfreeze, updateExpiredMemberships y logAccess con resultado `granted`

### 16.4 Code splitting del dashboard 🧩

**Problema:** `recharts` (~500 KB) se importaba en el chunk inicial (bundle de 1.92 MB) que se parseaba al arrancar.

**Qué se hizo:** `React.lazy` + `Suspense` para `DashboardPage` en `App.tsx` (con `PageLoader` de fallback). Verificado en el build: el chunk inicial baja a **1.09 MB** y recharts queda en `DashboardPage-*.js` (888 KB) que se carga solo al entrar al dashboard.

### 16.5 Backup de arranque diferido ⏳

El respaldo automático de arranque (Fase 2) ahora se difiere con `setImmediate` para no bloquear el primer paint ni competir con la apertura de la BD.

### 16.6 QA Fase 3 (rendimiento)

| Verificación | Resultado |
|---|---|
| Tests unitarios | ✅ **198** (15 archivos; 7 nuevos: 3 photos + 4 queryCache) |
| Typecheck (`tsc --noEmit`) | ✅ 0 errores |
| Lint (ESLint) | ✅ 0 errores (322 warnings pre-existentes) |
| Build (electron-vite) | ✅ chunk inicial 1.09 MB + DashboardPage 888 KB lazy |
| Revisión de código | ✅ freeze/unfreeze invalidan cache; TTL ajustado a 60 s; key de mes en cumpleaños; `readFile` async en thumbnails |

### Archivos creados/modificados (Fase 3)
| Archivo | Acción |
|---------|--------|
| `src/main/database/index.ts` | Migración 012 (índices + thumbnail_path) |
| `src/main/photos.ts` | Creado (jimp, thumbnails, backfill) |
| `src/main/database/clients.ts` | mapDbClient thumbnailOnly + invalidación de cache |
| `src/main/database/memberships.ts` | getInactiveClients cacheado + invalidaciones |
| `src/main/database/dashboard.ts` | getBirthdaysThisMonth cacheado |
| `src/main/database/queryCache.ts` | Creado (cache TTL) |
| `src/renderer/src/App.tsx` | React.lazy + Suspense para DashboardPage |
| `src/main/index.ts` | Backfill de thumbnails + backup diferido |
| `src/main/ipc/index.ts` | scheduleThumbnail al crear/actualizar cliente |
| `package.json` | Dependencia `jimp` ^1.6 |
| `scripts/bench-save.cjs` | Creado (benchmark de escritura sql.js) |
| `src/__tests__/database/photos.test.ts` | Creado (3 tests) |
| `src/__tests__/database/queryCache.test.ts` | Creado (4 tests) |

---

## 17. Corrección de mojibake en datos migrados (agosto 2026)

### ¿Por qué?
Nombres de clientes/productos mostraban caracteres corruptos tipo `PEQUEÃ'A` en vez de `PEQUEÑA`. Causa raíz verificada con bytes: el sistema antiguo guardó caracteres UTF-8 (Ñ = bytes `C3 91`) interpretándolos como Windows-1252 (`C3`→Ã, `91`→comilla tipográfica), y esa doble codificación quedó grabada en el dump original (`software_actual/db_actual.sql`, 107+ ocurrencias de `Ã`). El migrador copiaba el texto tal cual.

### Qué se hizo:
- **`src/shared/encoding.ts`**: helper `fixMojibake()` que revierte la doble codificación (mapea cada carácter a su byte cp1252 y decodifica como UTF-8). Es **idempotente y seguro**: no toca strings ya correctos (con tildes reales), ni emojis, ni caracteres CJK, ni texto ASCII.
- **Migrador CLI** (`scripts/migrate-legacy-data.ts`): aplica el fix en `parseSqlValue` → futuras migraciones generan `migrated-data.sql` limpio
- **Migrador interno** (`src/main/migration/legacyMigrator.ts`): ídem para la migración vía IPC
- **Importador** (`scripts/import-migrated-data.ts`): corrige el SQL completo antes de importar (cubre archivos generados con versiones anteriores)
- **`scripts/fix-mojibake-db.ts`**: repara la BD real existente (backup automático previo, tabla por tabla, solo columnas de texto). Uso: `npx tsx scripts/fix-mojibake-db.ts [--dry-run] [--db ruta]` — requiere la app cerrada
- **Verificado** en copia de la BD real (dry-run): **100 valores corregidos** (99 en `clients`, 1 en `products`)
- Tests: `src/__tests__/encoding.test.ts` (8 tests: Ñ, vocales, signos, idempotencia, no-toques)

### Archivos creados/modificados (Fase 4)
| Archivo | Acción |
|---------|--------|
| `src/shared/encoding.ts` | Creado (`fixMojibake`) |
| `scripts/migrate-legacy-data.ts` | Fix en parseSqlValue |
| `src/main/migration/legacyMigrator.ts` | Fix en parseSqlValue |
| `scripts/import-migrated-data.ts` | Fix sobre el SQL antes de importar |
| `scripts/fix-mojibake-db.ts` | Creado (reparador de BD) |
| `src/__tests__/encoding.test.ts` | Creado (8 tests) |

---

## 18. Migración de la tabla `visita` (agosto 2026)

### ¿Por qué?
La tabla `visita` del sistema antiguo (12,332 registros) no estaba mapeada en el migrador: se ignoraba silenciosamente y se perdía el historial de visitas de pase diario de los socios.

### Qué se hizo:
- **Mapeo verificado con datos reales:** `visita(idVisita, idSocio, fechaCreacion, precioVisita)` son visitas de pase diario de socios. Las **12,332 filas tienen `precioVisita = 0.00`** (0 con precio > 0), por lo que se importan como registros de acceso (`access_logs`) — igual que `registro` — **sin generar pagos**.
- **`src/main/migration/legacyMigrator.ts`**: helper compartido `transformAccessLogs()` (extraído de `transformRegistro`, comportamiento idéntico) y nuevo `transformVisita()` → `access_logs` con mensaje `Visita migrada (pase diario)`.
- **`scripts/migrate-legacy-data.ts`**: ídem para el generador de SQL (`Visita (pase diario) migrada del sistema anterior`).
- **Tests** (`legacyMigration.test.ts`): fixture con 3 visitas (2 de socio mapeado + 1 de socio inexistente) — se importan con cliente/fecha/mensaje correctos y se salta la de socio no mapeado.

### Archivos modificados
| Archivo | Acción |
|---------|--------|
| `src/main/migration/legacyMigrator.ts` | `transformAccessLogs` compartido + `transformVisita` |
| `scripts/migrate-legacy-data.ts` | ídem |
| `src/__tests__/database/legacyMigration.test.ts` | Fixture + 2 tests nuevos |

---

## 19. Fix: membresía de 1 día / último día se marcaba como vencida (agosto 2026)

### ¿Por qué?
Dos bugs combinados hacían que una membresía de 1 día (o **cualquier** membresía en su último día) saliera como "vencida" en el kiosco:

1. **Kiosco (frontend):** `ResultScreen` calculaba `isExpired = !valid || daysRemaining <= 0`. Con `differenceInDays`, una membresía que vence HOY da 0 días restantes → la pantalla mostraba "Acceso Denegado — Membresía Vencida" aunque el backend hubiera **concedido** el acceso (la puerta abría).
2. **Backend:** `getActiveOrFrozenMembership`, `getActiveMembership` y `updateExpiredMemberships` comparaban `end_date` contra el instante exacto (`formatISO(new Date())`). Una membresía que vencía hoy a las 14:00 quedaba denegada a las 14:01, a mitad de día.

### Qué se hizo:
- **`createMembership`**: `end_date` ahora es el **final del último día** (`endOfDay(addDays(startOfDay(start), duration-1))`) con duración mínima 1. Una membresía de 1 día comprada hoy vence hoy a las 23:59, y cualquier membresía es válida durante TODO su último día.
- **Comparaciones día-conscientes**: las tres funciones comparan contra la **fecha de hoy** (`formatISO(new Date()).slice(0, 10)`), no contra el instante. El prefijo de fecha es robusto para formatos ISO local (`YYYY-MM-DDTHH:mm:ss±HH:mm`) y legado (`YYYY-MM-DD HH:mm:ss`). Así, una membresía que vence hoy no se deniega ni se marca vencida hasta que el día termina.
- **Migrador legacy**: el chequeo al importar (día-consciente con `setHours(0,0,0,0)`) y el SQL de expiración/sync usan `datetime('now','start of day')`.
- **Kiosco (`KioskPage`)**: `isExpired = !validationResult.valid || daysRemaining < 0`; 0 días = **"Vence Hoy"** (último día válido), 1 día = "1 Día Restante".
- **`RenewModal`**: la vista previa de fecha de vencimiento ahora coincide con la lógica de creación (`addDays(start, duration-1)`).
- **Renovación el último día**: la guarda anti-solapamiento (`createMembership`/`createMembershipWithPayment`) ahora solo bloquea si la membresía vigente se extiende **más allá de hoy** (`endDate.slice(0,10) > todayKey()`). Renovar durante el último día de vigencia vuelve a estar permitido (antes, al comparar por instante, sí se podía renovar después de la hora de vencimiento; con la comparación día-consciente se habría bloqueado todo el día — corregido).
- **Tests** (+5 en `memberships.test.ts`): membresía de 1 día creada hoy queda activa y vence a las 23:59; membresía cuyo vencimiento es HOY sigue válida (ni `getActiveOrFrozenMembership` ni `updateExpiredMemberships` la vencen); membresía vencida AYER sí se considera vencida; **renovar el último día está permitido**; renovar con vigencia más allá de hoy sigue bloqueado. Se corrigió un test previo que usaba `toISOString()` (UTC) — formato inconsistente con el que la app guarda (`formatISO` local) — a `formatISO`.

### Archivos modificados
| Archivo | Acción |
|---------|--------|
| `src/main/database/memberships.ts` | `endOfDay` en creación, comparaciones por fecha (`todayKey()`) y renovación permitida el último día |
| `src/main/migration/legacyMigrator.ts` | Import-time y SQL de expiración/sync día-consciente |
| `src/renderer/src/pages/KioskPage.tsx` | `isExpired`/`daysText` corregidos |
| `src/renderer/src/components/modals/RenewModal.tsx` | Preview de vencimiento consistente |
| `src/__tests__/database/memberships.test.ts` | +5 tests, fix de formato UTC → local |
| `src/__tests__/database/migration.test.ts` | Sync SQL día-consciente |

---

## 20. Fix: no se podía actualizar clientes con código de acceso corto (agosto 2026)

### ¿Por qué?
Al editar un cliente migrado del sistema antiguo (códigos de 1-3 dígitos, ej. `212`) el guardado fallaba con:

```
Error updating client: Error: Datos inválidos: accessCode: Too small: expected string to have >=4 characters
```

`UpdateClientSchema` (y `CreateClientSchema`) exigían `accessCode` con **mínimo 4** y **máximo 10** caracteres, pero el sistema soporta códigos cortos en toda su operación: el migrador los preserva deliberadamente ("NO reemplazar códigos cortos pero válidos como '212'"), el kiosco acepta códigos de 1 dígito en adelante, y el formulario permite hasta 20 dígitos. La restricción del schema era artificial e inconsistente.

### Qué se hizo:
- **`src/shared/schemas.ts`**: `accessCode` ahora es `min(1, 'Código de acceso requerido').max(20)` — alineado con los límites reales del formulario y el kiosco (20 dígitos). Códigos legados cortos se aceptan tanto en creación como en actualización.
- **Tests** (`validation.test.ts`): acepta `212` (crear y actualizar), acepta 20 dígitos, rechaza vacío y rechaza >20 dígitos.
- Se reconstruyó el bundle (`out/`) para que el fix aplique a la app empaquetada.

### Archivos modificados
| Archivo | Acción |
|---------|--------|
| `src/shared/schemas.ts` | `accessCode` min 1 / max 20 |
| `src/__tests__/schemas/validation.test.ts` | Tests de códigos cortos/límites |

---

## 21. Fix: fotos de clientes importadas no se mostraban (agosto 2026)

### ¿Por qué?
Al importar la BD antigua ningún cliente mostraba su foto, aunque **sí se exportaban**: el dump tiene **1,669 socios con foto** de 2,333 (formato `0x...` JPEG) y la migración CLI generó **4,033 archivos** con **1,344 `photo_path`** en el SQL. El problema era de **rutas**:

1. Los migradores guardaban en `photo_path` **solo el nombre del archivo** (`uuid.jpg`), pero `readPhotoFile()` hacía `existsSync('uuid.jpg')` contra el CWD del proceso, no contra `userData/photos` → foto siempre `null`.
2. El flujo CLI exporta las fotos a `software_actual/migrated_photos/` pero el importador **nunca las copiaba** al directorio de fotos de la app.

### Qué se hizo:
- **`src/main/photos.ts`**: nuevo `getPhotosDir()` y `resolvePhotoPath()` — si la ruta no existe tal cual, se resuelve contra `userData/photos` (robusto para rutas relativas migradas y absolutas nativas). `generateThumbnail` también lo usa (las miniaturas ahora se generan para clientes migrados).
- **`src/main/database/clients.ts`**: `readPhotoFile` usa `resolvePhotoPath`.
- **`src/main/migration/legacyMigrator.ts`** (migración interna): guarda la **ruta absoluta** (`fullPath`), igual que las fotos creadas en la app.
- **`scripts/import-migrated-data.ts`**: en modo `--app-db` copia `migrated_photos/*.jpg` a `<dir de la BD>/photos` (el userData de la app).
- **Tests** (+2 en `photos.test.ts`): `resolvePhotoPath` resuelve un nombre relativo a `userData/photos`; un cliente migrado con `photo_path` relativo muestra su foto.

**Importante para datos ya importados:** el fix aplica al reiniciar la app (reconstruido `out/`). Si la migración fue interna, las fotos ya están en `userData/photos` y aparecerán solas. Si fue por CLI con BD copiada manualmente, hay que copiar `software_actual/migrated_photos/*.jpg` a `%APPDATA%/bodyfitgym/photos` (o reimportar con `--app-db`, que ahora lo hace automáticamente).

### Archivos modificados
| Archivo | Acción |
|---------|--------|
| `src/main/photos.ts` | `getPhotosDir` + `resolvePhotoPath` |
| `src/main/database/clients.ts` | `readPhotoFile` con resolución |
| `src/main/migration/legacyMigrator.ts` | Ruta absoluta de foto |
| `scripts/import-migrated-data.ts` | Copia de fotos en `--app-db` |
| `src/__tests__/database/photos.test.ts` | +2 tests |

---

## 22. DatePicker personalizado (agosto 2026) 🗓️

### ¿Por qué?
Los 6 campos de fecha usaban el `<input type="date">` nativo del navegador, cuyo calendario desplegable (Chromium) no contrastaba con el diseño Material You de la app (tema oscuro con acento naranja) y resultaba anticuado.

### Qué se hizo:
- **Nuevo componente `src/renderer/src/components/DatePicker.tsx`** — calendario 100% a medida:
  - Tema oscuro/claro con los tokens de la app (`--color-surface-container`, `--color-primary-container`, `--color-border`, etc.), tipografías Montserrat/Inter y sombras de glow del sistema de diseño.
  - Meses en español, semana iniciando en **lunes** (convención latinoamericana), día de hoy marcado con punto naranja, día seleccionado con degradado naranja.
  - **Portal** (`createPortal`) + overlay fijo: el panel se abre debajo del campo (o arriba si no hay espacio), se reposiciona con scroll/resize y se cierra al hacer clic fuera o con `Escape`.
  - Props `min`/`max` (días fuera de rango deshabilitados), `clearable` (botón × para limpiar), accesible por teclado (Enter/Espacio para abrir), y botones rápidos **Hoy** / **Borrar**.
  - Parsing de fechas con **hora local** (`new Date(y, m, d)`) — sin bugs de desplazamiento UTC; helper exportado `todayLocalKey()` para el día de hoy.
- **Reemplazo de los 6 campos nativos**:
  - `ClientFormPage`: fecha de nacimiento (máx. hoy).
  - `BodyTrackingPage`: fecha de medición (máx. hoy) y fechas inicio/objetivo del objetivo (objetivo ≥ inicio).
  - `SettingsPage`: fechas de inicio/fin de promoción (sin botón borrar por ser obligatorias, con validación cruzada `min`/`max` entre ambas).
- **Estilos** en `index.css` (sección `DatePicker personalizado (Material You)`).

### Archivos creados/modificados
| Archivo | Acción |
|---------|--------|
| `src/renderer/src/components/DatePicker.tsx` | Creado |
| `src/renderer/src/index.css` | Estilos `.dp-*` |
| `src/renderer/src/pages/ClientFormPage.tsx` | Fecha de nacimiento → DatePicker |
| `src/renderer/src/pages/BodyTrackingPage.tsx` | 3 fechas → DatePicker |
| `src/renderer/src/pages/SettingsPage.tsx` | Fechas promoción → DatePicker |

### Mejora: selector de mes/año estilo Apple (agosto 2026) ⏭️

**Problema:** para cambiar de año había que navegar mes por mes con las flechas — incómodo para fechas lejanas (ej. fecha de nacimiento en los 90s).

**Qué se hizo:**
- El título del panel (mes + año) ahora es **clicable** y alterna a una vista de selección rápida:
  - **Stepper de año** con botones −1/+1 y **−10/+10 años** («/»)
  - **Rejilla de 12 meses**: un clic salta directo a ese mes/año y vuelve a la vista de días
  - Meses completos fuera del rango `min`/`max` se muestran deshabilitados
  - El caret del título rota 180° al entrar/salir de la vista (feedback visual)

---

## 23. Fix: fondo rojo en 'Precio Unitario' del inventario (agosto 2026)

### ¿Por qué?
Al abrir el modal de movimiento (botón **+** de una card de producto), la etiqueta "Precio Unitario" se veía con **fondo rojo**. Causa: un `style={{ background: "red" }}` hardcodeado en la etiqueta del `MovementForm` de `InventoryPage`.

### Qué se hizo:
- `src/renderer/src/pages/InventoryPage.tsx`: se eliminó el estilo inline de la etiqueta (ahora usa la clase `label-md` estándar del theme).

---

## 24. Fix: calendario se cortaba al abrir + inputs numéricos no borrables (agosto 2026)

### 24.1 Calendario: el panel se abría hacia arriba y cortaba los meses 🗓️

**Problema:** al abrir el selector de mes/año, el panel se desplegaba hacia arriba, se salía de la pantalla y no se veían todos los meses ("rompe el layout").

**Causa raíz:** el panel se posicionaba con una **estimación fija de altura** (360 px) y `scrollIntoView`, sin medir su altura real. Al abrir hacia arriba, si no cabía, el top quedaba fuera del viewport y se recortaba la rejilla de meses.

**Qué se hizo** (`DatePicker.tsx`):
- Nuevo `computePanelPos()` que **mide la altura real del panel** (`offsetHeight`) y lo posiciona: abajo si hay espacio, arriba si el panel cabe completo, y si no hay espacio en ningún lado lo recorta al borde del viewport (nunca fuera de pantalla).
- Se recalcula al **abrir** y al **cambiar de modo** (días ↔ meses), porque la altura cambia; también con scroll/resize.
- Salvaguarda CSS: `max-height: min(100vh - 16px, 440px)` + `overflow-y: auto` en `.dp-panel` — el panel nunca rompe el layout, ni en ventanas pequeñas.
- La animación de aparición se dispara solo cuando el panel ya está posicionado (`dp-panel-ready`).

### 24.2 Inventario: valores por defecto de cantidad/precio no se podían borrar 🔢

**Problema:** en el modal de movimiento (y en el de producto) los campos numéricos no dejaban borrar el valor por defecto: en CANTIDAD el `1` no se quitaba (al teclear 2 quedaba `12`) y en PRECIO UNITARIO al borrar `1000` quedaba `0` que se pegaba al escribir (`02000`).

**Causa raíz:** los handlers convertían el texto a número y **forzaban un valor** con `Number(...) || 1` / `Number(...) || 0`. Al borrar el campo, el valor se volvía a re-renderizar con el default y el cero concatenaba con lo nuevo.

**Qué se hizo** (`InventoryPage.tsx`):
- `MovementForm` (Cantidad y Precio Unitario) y `ProductForm` (Precio Venta, Costo, Stock Actual, Stock Mínimo): los campos ahora guardan **string** (`type="text" inputMode="numeric"`, solo dígitos) → se pueden **borrar por completo** y escribir libremente.
- La conversión a número ocurre **al guardar** (`Number(...)` con `|| 0`), manteniendo el contrato de tipos con `registerMovement`/`createProduct`.
- Fix adicional en `ProductForm`: `onSave()` (cerrar modal + recargar lista) ahora se llama solo si `r.success` — antes `if (!loading) onSave()` **nunca se ejecutaba** (loading era `true`), dejando el modal abierto y la lista sin refrescar.

---

## 25. Acciones rápidas del Panel General al inicio (agosto 2026) ⚡

### ¿Por qué?
Los botones de acción rápida (Nuevo Cliente, Control Acceso, Registrar Pago, Abrir Puerta) estaban renderizados **al final** del dashboard, después de todas las cards — obligando a hacer scroll para usarlos.

### Qué se hizo:
- `src/renderer/src/pages/DashboardPage.tsx`: el componente `QuickActions` se movió **justo debajo del encabezado** y antes de las métricas.
- `src/renderer/src/index.css`: nueva clase `.quick-action` — los botones ahora tienen micro-interacción (hover con borde primario, elevación y escala del icono; active sin elevación).

---

## 26. Documento de identidad opcional al crear clientes (agosto 2026) 🪪

### ¿Por qué?
El documento de identidad era **obligatorio** en el formulario de cliente (validación frontend + `min(1)` en el schema Zod + la columna `document_id TEXT UNIQUE` en BD). El gimnasio quiere poder registrar clientes sin documento.

### Qué se hizo:
- **`src/shared/schemas.ts`**: `documentId` → `z.string().max(50)` (acepta vacío).
- **`src/main/database/clients.ts`**:
  - Nuevo helper `normalizeDocumentId()`: vacío/espacios → **`NULL`** en BD (la columna es `UNIQUE` y SQLite permite múltiples `NULL` — dos clientes sin documento no colisionan).
  - `createClient`/`updateClient` lo usan; el `return` de `createClient` y `mapDbClient` devuelven `''` para no cambiar el contrato `Client.documentId: string` en el frontend.
- **`src/renderer/src/pages/ClientFormPage.tsx`**: se quitó la validación obligatoria y el `*` del label; la verificación de duplicado solo corre si el documento trae valor.
- **Fix de bug pre-existente en `updateClient`** (detectado en revisión): `if (photoPath !== undefined)` era **siempre verdadero** (`photoPath` se inicializa en `null`), por lo que **cada actualización sin `photo` borraba la foto y la miniatura**. Ahora la foto solo se toca cuando el caller envía `photo` explícitamente.
- **Tests**: 2 tests de schema invertidos (aceptan `''`), +2 tests de BD (dos clientes sin documento; trim + mapeo de NULL → `''`).

### Archivos modificados
| Archivo | Acción |
|---------|--------|
| `src/shared/schemas.ts` | `documentId` opcional |
| `src/main/database/clients.ts` | `normalizeDocumentId` (NULL) + fix bug de foto en `updateClient` |
| `src/renderer/src/pages/ClientFormPage.tsx` | Sin validación obligatoria, duplicado condicional |
| `src/__tests__/schemas/validation.test.ts` | 2 tests invertidos |
| `src/__tests__/database/clients.test.ts` | +2 tests |
