# Análisis de Preparación para Producción — BodyFitGym

> ⚠️ **DOCUMENTO HISTÓRICO (Junio 2026).** Este análisis describía el estado del
> proyecto antes de la iniciativa de producción-readiness. La mayoría de las
> brechas aquí listadas ya están resueltas: ver `implementaciones-realizadas.md`
> para el estado actual (tests, CI/CD, Sentry, auto-updates, paginación, etc.).
> No usar como referencia del estado actual.

> **Estado general:** 🟡 Cerca, pero con brechas críticas que resolver antes de producción abierta.
>
> Fecha del análisis: Junio 2026

---

## 1. Resumen Ejecutivo

BodyFitGym es una aplicación de escritorio **completa en funcionalidad** construida con Electron + React + TypeScript + SQLite. Gestiona el ciclo de vida completo de un gimnasio: registro de clientes, planes de membresía, pagos, control de acceso físico (relé de puerta), notificaciones WhatsApp, inventario, seguimiento corporal y panel de administración con dashboard analítico.

**Ya genera instalador de Windows** (NSIS + portable) y la arquitectura sigue buenas prácticas de seguridad. Sin embargo, carece de pilares fundamentales para operación en producción real: **tests automatizados, CI/CD, actualizaciones automáticas, monitoreo de errores y paginación**.

---

## 2. Lo que ya está bien ✅

| Aspecto | Estado |
|---------|--------|
| **Arquitectura** | Electron 3-capas bien separada (main / preload / renderer) |
| **Base de datos** | SQLite con WAL, migraciones versionadas, recuperación ante corrupción, foreign keys |
| **Seguridad** | `contextIsolation: true`, `nodeIntegration: false`, consultas parametrizadas, contraseñas con bcrypt |
| **Tipado** | TypeScript estricto (`strict: true`) en toda la aplicación |
| **Build** | `electron-vite` + `electron-builder` con targets Windows (NSIS + portable), macOS y Linux |
| **UI/UX** | Sistema de diseño oscuro Material You completo, tema consistente, tipografía Montserrat |
| **Logging** | `electron-log` estructurado por niveles (info a archivo, debug a consola) |
| **Cobertura funcional** | Clientes, membresías, pagos, control de acceso, relé de puerta, WhatsApp, inventario, seguimiento corporal, dashboard, usuarios, auditoría de cambios |
| **Manejo de ventanas** | Modo administrador, modo kiosko (pantalla táctil), multi-pantalla, bandeja del sistema |
| **Arranque** | Auto-inicio con Windows configurable, restauración de estado de puerta y WhatsApp |

---

## 3. Brechas CRÍTICAS 🚨

### 3.1 Sin tests automatizados
- **0 archivos de test**, 0 frameworks instalados.
- Cualquier refactor o nueva feature puede romper funcionalidad existente sin detección.
- **Recomendación:** Instalar Vitest (ya en ecosistema Vite) y cubrir al menos la capa de base de datos e IPC handlers.

### 3.2 Sin CI/CD
- No hay pipelines de integración continua (GitHub Actions, GitLab CI, etc.).
- Cada release es un proceso manual sin garantías de calidad.
- **Recomendación:** Configurar GitHub Actions para `npm run build` + tests + lint en cada PR, y build automático en tags.

### 3.3 Sin auto-updater
- No se usa `electron-updater`. Los usuarios deben descargar e instalar manualmente cada nueva versión.
- No hay canal de actualizaciones (stable/beta).
- **Recomendación:** Integrar `electron-updater` con GitHub Releases o S3.

### 3.4 Sin monitoreo de errores
- No hay Sentry, Rollbar ni similar. Los errores en producción solo quedan en un archivo de log local.
- El equipo no se entera de crashes hasta que el usuario reporta.
- **Recomendación:** Agregar Sentry al proceso main y renderer.

### 3.5 Sin rate-limiting en login
- No hay límite de intentos de inicio de sesión. Posible ataque de fuerza bruta.
- **Recomendación:** Bloquear por 30-60 segundos después de 3-5 intentos fallidos.

### 3.6 Backup sin interfaz de usuario
- La función `backupDatabase()` existe en IPC pero no hay botón ni página para que el usuario la ejecute.
- **Recomendación:** Agregar sección de backup/restore en Configuración.

### 3.7 Fotos como BLOB en SQLite
- Las fotos de clientes se almacenan como `BLOB` en la base de datos. Con el tiempo, la DB crecerá sin control.
- **Recomendación:** Migrar a archivos en `app.getPath('userData')/photos/` y guardar solo la ruta en DB.

### 3.8 Sin paginación en listados
- Clientes, pagos, accesos, inventario cargan **todos los registros en memoria**.
- Con cientos o miles de registros, la UI se volverá lenta.
- **Recomendación:** Implementar paginación (OFFSET/LIMIT) en consultas SQL y en los componentes React.

---

## 4. Brechas IMPORTANTES ⚠️

### 4.1 Calidad de código
- **Sin ESLint** — no hay análisis estático de código.
- **Sin Prettier** — no hay formateo automático.
- `noUnusedLocals` y `noUnusedParameters` activos en tsconfig pueden causar errores de build si hay código muerto.
- **Recomendación:** Configurar ESLint + Prettier + husky + lint-staged.

### 4.2 Relé serie usa fs.write raw
- `src/main/door/serialRelay.ts` usa `fs.write` al puerto COM sin control de baudios, paridad ni handshake.
- No depende de la librería `serialport` npm.
- **Recomendación:** Instalar `serialport` y migrar a su API para control real del puerto.

### 4.3 Variables de entorno no documentadas
- `.env` está en `.gitignore` pero no hay `.env.example`.
- `GYM_MODE` es la única variable usada, no está documentada.
- **Recomendación:** Crear `.env.example` con todas las variables y sus descripciones.

### 4.4 Sin i18n (internacionalización)
- Todos los textos de UI están hardcodeados en español.
- No hay soporte para otros idiomas.
- **Recomendación:** Evaluar si es necesario según mercado objetivo. Si sí, usar react-i18next.

### 4.5 Sin reportes / PDF
- No hay generación de comprobantes de pago, reportes de membresías ni listados imprimibles.
- **Recomendación:** Agregar reportes básicos con generación de PDF.

### 4.6 Validación IPC
- Los handlers IPC en main confían en que el preload/envía datos válidos. No hay sanitización en los argumentos recibidos.
- **Recomendación:** Agregar validación de tipos y rangos en los handlers IPC (ej. con Zod).

### 4.7 UX: Sin atajos de teclado, sin tema claro
- Toda la interacción es click-based.
- Solo existe tema oscuro.
- **Recomendación:** Agregar atajos comunes (Ctrl+F para buscar, Escape para cerrar modales) y tema claro opcional.

---

## 5. Brechas MENORES 🔧

| Categoría | Detalle |
|-----------|---------|
| **CSP** | Content-Security-Policy permite `unsafe-inline` para estilos |
| **Cámara** | `setPermissionCheckHandler` acepta `media` para todos los orígenes sin restricción |
| **Admin por defecto** | Credenciales admin/admin123 hardcodeadas en migración |
| **Intervalo recordatorios** | 6 horas fijo, no configurable desde UI |
| **Módulo de WhatsApp** | Solo proveedor mock implementado; Twilio, Evolution API, WhatsApp Cloud son stubs |
| **Sin .dockerignore** | Aunque no hay Docker, si se agrega, falta el ignore |
| **Sin licencia** | `package.json` dice MIT pero no hay LICENSE.txt |
| **Sin tags git** | No hay versiones semánticas taggeadas en el repo |

---

## 6. Checklist de Preparación para Producción

### 🔴 Imprescindible (hacer antes de producir)
- [ ] Agregar tests automatizados (Vitest)
- [ ] Configurar GitHub Actions (build + test)
- [ ] Agregar `electron-updater` para actualizaciones
- [ ] Rate-limiting en login
- [ ] Migrar fotos BLOB a archivos
- [ ] Paginación en listados (clientes, pagos, logs)
- [ ] UI de backup/restore
- [ ] Agregar Sentry

### 🟡 Muy recomendado (siguiente iteración)
- [ ] ESLint + Prettier
- [ ] Migrar a librería `serialport` para relé serie
- [ ] Validación de datos en IPC (Zod)
- [ ] .env.example
- [ ] Reportes PDF básicos
- [ ] Atajos de teclado

### 🟢 Buen tener (futuro)
- [ ] Modo claro / toggle de tema
- [ ] i18n multi-idioma
- [ ] Onboarding / first-run wizard
- [ ] Dashboard de auditoría de uso del sistema
- [ ] Pruebas E2E con Playwright
- [ ] Docker para entorno de desarrollo
- [ ] Caché en Redis (si escala a multi-sucursal)

---

## 7. Stack Tecnológico Actual

| Capa | Tecnología |
|------|-----------|
| **Runtime** | Electron 31 + Chromium + Node.js |
| **Frontend** | React 18 + React Router 6 + Zustand + Recharts |
| **Backend (main)** | Node.js + better-sqlite3 + bcryptjs + date-fns |
| **Build** | electron-vite + Vite + TypeScript 5.5 |
| **Packaging** | electron-builder (NSIS + portable) |
| **Estilo** | CSS custom properties (Material You dark) |
| **Logging** | electron-log |

---

## 8. Dependencias de Producción

```json
"dependencies": {
  "@electron-toolkit/utils": "^3.0.0",
  "bcryptjs": "^3.0.3",
  "better-sqlite3": "^11.1.2",
  "date-fns": "^3.6.0",
  "electron-log": "^5.1.5",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.0",
  "recharts": "^2.12.7",
  "uuid": "^10.0.0",
  "zustand": "^4.5.4"
}
```

---

## 9. Conclusión

**BodyFitGym está listo para un piloto controlado** con usuarios reales en un entorno supervisado. La funcionalidad es completa y la arquitectura es sólida.

**No está listo para producción abierta** debido a la ausencia de tests, auto-updates, monitoreo de errores y paginación. Cualquier bug, crash o degradación de rendimiento no sería detectable hasta que el usuario lo reporte.

**Esfuerzo estimado para llegar a producción:**
- **Crítico:** ~2-3 semanas (tests, CI/CD, auto-update, rate-limiting, fotos, paginación)
- **Recomendado:** ~2 semanas adicionales (lint, serialport, validación, backups)
- **Total estimado:** ~4-5 semanas de desarrollo enfocado
