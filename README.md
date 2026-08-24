# BodyFitGym 🏋️

Sistema profesional de administración y control de acceso para gimnasios. Aplicación de escritorio construida con **Electron + React + TypeScript + SQLite**.

## Características

- **Gestión de Clientes** — Registro, fotos, código de acceso, búsqueda, historial
- **Membresías y Planes** — Planes personalizables, renovaciones, promociones
- **Pagos** — Múltiples métodos (efectivo, transferencia, tarjeta, Nequi, Daviplata), descuentos
- **Control de Acceso** — Validación por código, relé de puerta (HTTP/Serial/Mock), modo kiosco táctil
- **Dashboard** — Métricas en tiempo real, ingresos, membresías por vencer, cumpleaños
- **WhatsApp** — Notificaciones de bienvenida, confirmación de pago, recordatorios de vencimiento
- **Inventario** — Control de stock, movimientos, alertas de stock bajo
- **Seguimiento Corporal** — Medidas, peso, metas de los clientes
- **Usuarios** — Roles (admin, recepción, entrenador, contabilidad), permisos granulares
- **Auditoría** — Registro de cambios en datos críticos
- **Auto-actualizaciones** — vía GitHub Releases con `electron-updater`
- **Monitoreo de Errores** — Sentry integrado

## Requisitos del Sistema

- **Sistema Operativo:** Windows 10/11 (64-bit)
- **RAM:** 2 GB mínimo
- **Almacenamiento:** 500 MB libres
- **Resolución:** 1280x720 mínimo (1600x900 recomendado)

## Instalación

### Desde el instalador (usuarios finales)

Descarga el instalador más reciente desde [GitHub Releases](https://github.com/SePuLvEdA22/software_gym/releases) y ejecútalo.

### Desde código fuente (desarrolladores)

```bash
# Clonar el repositorio
git clone https://github.com/SePuLvEdA22/software_gym.git
cd software_gym

# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run dev

# Ejecutar tests
npm test

# Construir instalador para Windows
npm run build:win
```

## Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto (opcional):

| Variable | Descripción |
|----------|-------------|
| `GYM_MODE` | Modo de operación: `admin`, `kiosk` o `both` (por defecto) |
| `SENTRY_DSN` | DSN de Sentry para monitoreo de errores en producción |

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia en modo desarrollo con hot-reload |
| `npm run build` | Compila la aplicación a `out/` |
| `npm start` | Vista previa del build compilado |
| `npm test` | Ejecuta tests unitarios (Vitest) |
| `npm run lint` | Ejecuta ESLint |
| `npm run format` | Verifica formato con Prettier |
| `npm run build:win` | Compila y empaqueta instalador Windows (NSIS) |
| `npm run build:mac` | Compila y empaqueta para macOS |
| `npm run build:linux` | Compila y empaqueta para Linux |

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| **Runtime** | Electron 31 |
| **Frontend** | React 18, React Router 6, Zustand, Recharts |
| **Lenguaje** | TypeScript 5 (strict) |
| **Base de Datos** | SQLite nativo (better-sqlite3, escritura síncrona duradera) |
| **Build** | electron-vite, electron-builder |
| **Validación** | Zod |
| **Tests** | Vitest |
| **Linting** | ESLint, Prettier |
| **Logging** | electron-log |
| **Monitoreo** | Sentry |
| **Actualizaciones** | electron-updater |

## Diseño

Sistema de diseño **Material You** con tema oscuro. Ver [`design/DESIGN.md`](design/DESIGN.md) para la especificación completa y [`design/mockups/`](design/mockups) para los mockups de referencia por pantalla.

