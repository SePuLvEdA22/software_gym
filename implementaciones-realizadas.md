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
  - ⚠️ **Hallazgo:** la tabla `visita` (12,332 filas) no está mapeada en el migrador — revisar si debe importarse
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
