# 📋 Plan de Pruebas — BodyFitGym

Sistema profesional de administración y control de acceso para gimnasios.
Electron + React + TypeScript + SQLite (sql.js).

Este documento lista las pruebas recomendadas para comprobar el correcto funcionamiento de la aplicación, organizadas por módulo y prioridad.

---

## 0. Verificación base del proyecto (automática)

Antes de cualquier prueba manual, ejecuta la suite ya existente y el lint:

| # | Prueba | Comando | Qué valida |
|---|--------|---------|------------|
| 0.1 | Suite de tests unitarios | `npm test` | Que TODOS los tests existentes pasen (database, whatsapp, schemas, ipc, encoding) |
| 0.2 | Lint | `npm run lint` | Sin errores de ESLint |
| 0.3 | Formato | `npm run format` | Prettier sin discrepancias |
| 0.4 | Compilación | `npm run build` | TypeScript + build electron-vite sin errores |

---

## 1. Instalación y arranque (Alta prioridad)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 1.1 | Instalar con el instalador NSIS desde cero | Instala sin errores, crea accesos directos, permite elegir directorio |
| 1.2 | Primer arranque (BD nueva) | Se crea `bodyfitgym.db`, se aplican migraciones 001–012, arranca sin crash |
| 1.3 | Arranque con BD corrupta | El sistema detecta corrupción, hace backup/renombra el archivo y recrea la BD (ver logs) |
| 1.4 | Cerrar y reabrir la app 3 veces seguidas | No se pierde data; la BD se guarda correctamente en cada cierre |
| 1.5 | Modo kiosco (`GYM_MODE=kiosk`) | Solo arranca la ventana kiosco, sin panel admin |
| 1.6 | Modo admin (`GYM_MODE=admin`) | Solo arranca el panel admin |
| 1.7 | Modo `both` (default) | Arrancan ambas ventanas |

---

## 2. Autenticación y usuarios (Alta prioridad)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 2.1 | Login con `admin` / `admin123` (primer uso) | Entra y aparece aviso de **cambio de contraseña obligatorio** (migración 011) |
| 2.2 | Cambiar contraseña del admin | Se guarda, al relogear no vuelve a pedir cambio, ya no funciona la antigua |
| 2.3 | Login con contraseña incorrecta | Mensaje de error, sin acceso |
| 2.4 | Crear usuario con rol `reception`, `trainer`, `accounting` | Se crea correctamente |
| 2.5 | Login con usuario de rol no-admin | Solo ve las secciones permitidas por permisos (requiereRole admin bloquea users/backups/plantillas) |
| 2.6 | Editar usuario, desactivar usuario | El desactivado ya no puede loguearse |
| 2.7 | Eliminar usuario | Desaparece; el log de auditoría (`change_log`) registra la acción |
| 2.8 | **No eliminar al admin** | El sistema impide borrar el último administrador |
| 2.9 | Sesión tras reiniciar app | `auth:checkSession` restaura o cierra sesión correctamente |
| 2.10 | Logout | Vuelve al login, las rutas protegidas redirigen |

---

## 3. Clientes (Alta prioridad)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 3.1 | Crear cliente completo (datos, emergencia, teléfono) | Se guarda, aparece en lista |
| 3.2 | **Documento de identidad duplicado** | Validación Zod/Capa DB lo rechaza con mensaje claro |
| 3.3 | **Código de acceso duplicado** | Rechazado (UNIQUE en `access_code`) |
| 3.4 | Código de acceso corto (ej. 3–4 dígitos) | Se permite y el kiosco lo acepta (fix de códigos cortos) |
| 3.5 | Tomar foto con cámara | Se guarda; en la lista se muestra el **thumbnail** (migración 012) |
| 3.6 | Editar cliente (nombre, teléfono, foto) | Se actualiza; `updated_at` cambia |
| 3.7 | Búsqueda por nombre, documento, teléfono | Resultados correctos e instantáneos |
| 3.8 | Eliminar cliente | Se elimina (verifica cómo se comportan sus membresías/pagos asociados) |
| 3.9 | Código de cliente auto-generado | Sigue la secuencia (1000, 1001…) sin repetirse |
| 3.10 | Cliente con deuda | Aparece en "deudores" y la deuda se ve en su ficha |

---

## 4. Planes, membresías y congelación (Alta prioridad)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 4.1 | Crear plan diario, semanal, mensual | Se guardan con precio y duración |
| 4.2 | Desactivar un plan | No aparece en listas de planes activos, pero las membresías existentes siguen válidas |
| 4.3 | Crear membresía con pago | Cliente pasa a `active`, fechas correctas (start hoy, end = hoy + duración) |
| 4.4 | **Plan de 1 día: vence hoy mismo** | Se marca vencida SOLO al día siguiente, no el mismo día (fix día final válido) |
| 4.5 | Renovar el último día de vigencia | Se crea la nueva membresía sin conflicto |
| 4.6 | **Renovar con fecha retroactiva en plan corto (1 día)** | ⚠️ **Caso documentado como falencia**: la membresía nace `expired` y aun así se cobra. Verifica si el kiosco/panel lo maneja o hay que decidir un fix |
| 4.7 | Congelar membresía activa | Status `frozen`, se registra `freeze_history` con motivo y días |
| 4.8 | **Congelar dos veces la misma membresía** | El segundo intento es rechazado |
| 4.9 | **Congelar membresía ya vencida** | Rechazado |
| 4.10 | **Renovar mientras está congelada** | Bloqueado (mensaje "membresía congelada") |
| 4.11 | Descongelar | Status vuelve a `active`, `end_date` se extiende por los días congelados reales, historial registra `unfrozen_at` y `actual_days` |
| 4.12 | Crear membresía a cliente **suspendido** | Rechazado |
| 4.13 | Promociones: crear promo de % o monto fijo | El precio efectivo (`getEffectivePrice`) se calcula correctamente |
| 4.14 | Promoción fuera de rango de fechas | No aplica descuento |

---

## 5. Pagos y abonos (Alta prioridad)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 5.1 | Registrar pago en efectivo | Aparece en historial del cliente y en reportes por fecha |
| 5.2 | Registrar pago con cada método (transferencia, tarjeta, Nequi, Daviplata) | Se guarda con el método correcto |
| 5.3 | Pago con descuento | `discount` se registra; el monto total cuadra |
| 5.4 | Abono a una deuda | Reduce la deuda pendiente correctamente |
| 5.5 | Pago sin membresía (pago suelto/tienda) | Se registra sin romper membresías |
| 5.6 | Filtro de pagos por rango de fechas y método | Filtra correctamente, paginación funciona |
| 5.7 | Confirmación WhatsApp de pago (si configurado) | Se dispara `payment_confirmation` |

---

## 6. Kiosco de entrada / control de acceso (Crítica — es el corazón)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 6.1 | Código válido con membresía activa | Mensaje "Bienvenido {nombre}", se abre la puerta, `access_logs` registra `granted` |
| 6.2 | Código inexistente | "Cliente no encontrado" (`denied_not_found`), log registrado, **NO** se abre la puerta |
| 6.3 | Código de cliente vencido | "Membresía vencida" (`denied_expired`), el cliente pasa a status `expired`, se muestra deuda si tiene |
| 6.4 | Código de cliente con membresía congelada | "Membresía congelada – contacta recepción" (`denied_frozen`) |
| 6.5 | Cliente suspendido/inactivo SIN membresía | Marca `expired` y muestra "Membresía vencida" |
| 6.6 | Cliente con membresía activa + deuda | Entra, pero muestra el aviso de deuda |
| 6.7 | Cliente con rutinas asignadas | El kiosco muestra sus rutinas (si aplica en pantalla de bienvenida) |
| 6.8 | **Doble escaneo consecutivo del mismo código** | Solo se registra un ingreso válido (no duplica si la puerta ya está abierta) |
| 6.9 | Renovar desde el kiosco (pantalla de renovación) | Cliente vencido puede pagar y renovar desde el kiosco |
| 6.10 | Interfaz táctil del kiosco | Botones grandes, funciona con toque, no se desborda en pantalla vertical/pequeña |
| 6.11 | Verificación de logs por fecha/cliente | `access:getLogs`, `getLogsByClient`, `getLogsByDate` devuelven lo esperado |

---

## 7. Puerta / relé (Alta — depende del hardware)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 7.1 | **Modo mock** (sin hardware) | `door:open` devuelve éxito, evento `open` se guarda en `door_events`, auto-cierre tras `openDuration` ms |
| 7.2 | Apertura manual desde admin | La puerta se abre (`manualOpen` devuelve Promise real) y el evento se registra con trigger `manual` |
| 7.3 | Cierre manual | Evento `close` registrado con trigger `manual` |
| 7.4 | Auto-cierre | Tras el tiempo configurado la puerta vuelve a `closed` (evento `auto_close`) |
| 7.5 | **HTTP relay: URL apuntando al ESP8266** | Se abre la puerta; si el relay no responde → status `error` y evento `denied`, sin falsos positivos |
| 7.6 | **Serial (puerto COM)** | Configurar puerto/baudios, probar apertura real, verificar fallo si el puerto no existe |
| 7.7 | `door:testConnection` | Devuelve éxito/fallo según el modo configurado |
| 7.8 | Guardar configuración de puerta | Persiste al reiniciar la app |
| 7.9 | **Abrir puerta 2 veces rápido** | El segundo intento mientras está abierta no genera eventos duplicados (retorna false/log de "already open") |

---

## 8. Dashboard (Media)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 8.1 | Métricas del día/semana/mes | Ingresos, accesos, membresías nuevas cuadran con datos reales |
| 8.2 | Ingresos por mes y por año | Gráficas correctas; años vacíos no rompen |
| 8.3 | Ingresos por hora del día | Horas pico calculadas desde `access_logs` |
| 8.4 | Clientes por estado | Conteos correctos (activos, inactivos, vencidos, suspendidos) |
| 8.5 | Por vencer en N días | Lista correcta según `end_date` |
| 8.6 | Cumpleaños del mes | Lista correcta |
| 8.7 | **Con BD grande (>10.000 registros)** | El dashboard carga sin congelarse (cache de queries funciona) |
| 8.8 | Estadísticas de asistencia de un cliente | Modal muestra datos coherentes |

---

## 9. Inventario (Media)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 9.1 | CRUD de producto | Crear, editar, desactivar, eliminar |
| 9.2 | Movimiento de entrada | Stock sube, movimiento registrado con usuario |
| 9.3 | Movimiento de salida | Stock baja |
| 9.4 | **Salida con cantidad 0** | Rechazada (integridad de stock) |
| 9.5 | **Salida con cantidad negativa** | Rechazada — antes incrementaba el stock (bug corregido) |
| 9.6 | **Salida mayor al stock disponible** | Rechazada, el stock nunca queda negativo |
| 9.7 | Salida exacta al stock | Stock llega a 0 (permitido) |
| 9.8 | Búsqueda por nombre/categoría + paginación | Funciona |
| 9.9 | Stock bajo (`min_stock`) | Lista de alertas correcta |

---

## 10. Seguimiento corporal (Baja)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 10.1 | Guardar medidas (peso, brazos, cintura, etc.) | Se guardan; el historial muestra la evolución cronológica |
| 10.2 | Guardar meta con fecha objetivo | Se registra y aparece activa |
| 10.3 | Cerrar/desactivar meta | Deja de listarse como activa |

---

## 11. WhatsApp (Alta si se usa en producción)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 11.1 | **Mensaje de prueba** con config deshabilitada | Devuelve éxito con "Modo simulación" (no envía nada real) |
| 11.2 | **Twilio seleccionado** | ⚠️ Debe **fallar explícitamente** ("no disponible"), NO marcar como enviado (fix de falso positivo) |
| 11.3 | **Custom API seleccionado** | Igual: debe fallar explícitamente |
| 11.4 | Evolution API con URL + instance + apikey reales | Envía y guarda `sent` con `sent_at` |
| 11.5 | WhatsApp Cloud API con `phoneNumberId` | Envía template en español |
| 11.6 | `checkAndSendExpiryReminders` | Envía recordatorio a 3 días, 1 día y mismo día según toggles; **NO duplica el mismo día** (dedup) |
| 11.7 | Membresía vencida hace <30 días | Recibe "membresía ha vencido" |
| 11.8 | Membresía que vence en >3 días | NO recibe recordatorio |
| 11.9 | `formatPhoneNumber`: número de 10 dígitos | Se le antepone 57 (Colombia) |
| 11.10 | Número inválido (<10 dígitos) | Rechazado, no se envía |
| 11.11 | Enviar recordatorio manual a un cliente | Se envía con el tipo correcto según días restantes |
| 11.12 | Plantillas: crear, editar, enviar a cliente/todos/por vencer | Funciona y el historial lo registra |
| 11.13 | Historial de mensajes con paginación | Orden descendente por fecha, páginas correctas |

---

## 12. Backups, restauración y migración (Alta)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 12.1 | Backup automático configurado | Se genera el `.db` de backup en el destino; el archivo no está corrupto |
| 12.2 | Retención (número de backups) | Los antiguos se eliminan, se conservan los N recientes |
| 12.3 | Backup manual (`backup:runNow`) | Se crea y se puede abrir |
| 12.4 | **Restaurar desde backup** | Los datos vuelven al estado del backup; el DB actual se respalda antes de sobrescribir |
| 12.5 | Restaurar desde archivo inexistente/corrupto | Falla con mensaje claro y la BD actual sigue funcionando |
| 12.6 | **Migración legacy** (`system:migrateLegacy`) | Importa clientes/membresías de la BD antigua; filtra por `idEstado` (eliminados no se importan) |
| 12.7 | Migración de fotos legacy | Las fotos importadas se muestran (fix de `photo_path`) |
| 12.8 | Mojibake en datos importados | Los acentos se corrigen (`fixMojibake`) |
| 12.9 | Importar las 12.332 visitas de pase diario | `access_logs` recibe las visitas y el dashboard las cuenta |

---

## 13. Actualizaciones (Media)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 13.1 | App en versión anterior + release nuevo en GitHub | El checker de actualización detecta la nueva versión (incluye pre-releases) |
| 13.2 | Descargar e instalar actualización | Descarga, aplica y reinicia sin perder la BD |
| 13.3 | Sin conexión a internet | La app funciona normal, sin errores molestos |
| 13.4 | Después de actualizar | Las migraciones nuevas de BD se aplican al arrancar |

---

## 14. Ventanas y formularios (Media — feature nueva)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 14.1 | Abrir formulario de usuario/producto/movimiento/plan/promo/plantilla/medidas/objetivo/renovación/congelación/abono/estadísticas | Se abre ventana independiente, redimensionable, centrada en el monitor del admin |
| 14.2 | Abrir el mismo formulario 2 veces con mismos params | No se duplica; la ventana existente se enfoca |
| 14.3 | Abrir el formulario con params distintos (otro cliente) | La ventana se recrea con los datos nuevos |
| 14.4 | Guardar desde el formulario | Se cierra la ventana y el panel admin se actualiza (evento `form:saved:{type}`) |
| 14.5 | Ventana de formulario en monitor secundario | Se centra en el monitor correcto |
| 14.6 | Formulario de cliente (ventana legacy) | Abre, guarda y notifica al admin correctamente |

---

## 15. Seguridad y datos (Alta)

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 15.1 | Validaciones Zod en formularios (datos inválidos, tipos incorrectos) | Error claro, no se guarda basura |
| 15.2 | Contraseñas almacenadas con bcrypt | En la BD solo hay hash, nunca texto plano |
| 15.3 | Autenticación en canales sensibles (backup, restore, users, plantillas, door config) | `requireRole('admin')` bloquea a otros roles |
| 15.4 | Sentry (si `SENTRY_DSN` configurado) | Un error no capturado aparece en Sentry |
| 15.5 | Logs (`electron-log`) | Los eventos importantes (migraciones, backups, puerta, whatsapp) quedan en el archivo de log |
| 15.6 | Exportar CSV (clientes, pagos, etc.) | El archivo se genera con los datos filtrados |

---

## 16. Pruebas de humo finales (recomendación)

Ejecuta este "recorrido E2E" completo al final:

1. Login admin → cambiar contraseña → crear cliente con foto → generar código
2. Crear plan + promoción → vender membresía con pago → confirmar WhatsApp (mock)
3. Escanear el código en el kiosco → puerta abre (mock) → log `granted`
4. Congelar → intentar entrar (negado) → descongelar → entrar (ok)
5. Registrar movimiento de inventario válido e inválido (stock negativo)
6. Crear 2º usuario con rol recepción → verificar que NO ve usuarios ni backups
7. Backup manual → modificar datos → restaurar → verificar que volvió
8. Cerrar y reabrir la app → validar persistencia

---

## ⚠️ Puntos que el código mismo marca como riesgos conocidos (prueba prioritaria)

- **Falencia documentada**: membresía retroactiva en plan de 1 día nace `expired` pero el pago sí se cobra (test `FALENCIA DOCUMENTADA` en memberships.test.ts).
- **Puerta**: `manualOpen` ahora devuelve Promise (antes bug: siempre truthy) — verifica que el botón de apertura manual realmente espere la respuesta.
- **WhatsApp Twilio/Custom**: no implementados, deben fallar explícitamente (nunca "enviado").
