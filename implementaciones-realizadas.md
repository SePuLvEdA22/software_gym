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
