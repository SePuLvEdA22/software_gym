import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { parseISO, differenceInDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Client, Membership, ClientDebt, ClientRoutine, GymSettings } from '../../../shared/types'
import kioskBg from '@/assets/kiosk-bg.png'
import { useAppStore } from '@/store/appStore'

type AccessState = 'idle' | 'result' | 'checking'

interface ValidationResult {
  valid: boolean
  client?: Client
  membership?: Membership
  message: string
  code: string
  debt?: ClientDebt[]
  routines?: ClientRoutine[]
}

// Maps JS dayOfWeek (0=Dom, 1=Lun...) to DAYS array index (0=Lun...)
const DAY_INDEX_FROM_DOW = [6, 0, 1, 2, 3, 4, 5]

const DAYS = [
  { key: 'Lunes', icon: 'directions_run', label: 'Cardio y Abdomen' },
  { key: 'Martes', icon: 'fitness_center', label: 'Tren Superior' },
  { key: 'Miércoles', icon: 'self_improvement', label: 'Recuperación Activa' },
  { key: 'Jueves', icon: 'fitness_center', label: 'Tren Inferior' },
  { key: 'Viernes', icon: 'sports_gymnastics', label: 'HIIT Cuerpo Completo' },
  { key: 'Sábado', icon: 'pool', label: 'Opcional / Natación' },
  { key: 'Domingo', icon: 'bed', label: 'Descanso', dimmed: true }
]

const glass: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--color-surface-container-high) 60%, transparent)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid var(--color-outline-variant)'
}

function MaterialIcon({ name, style }: { name: string; style?: React.CSSProperties }): JSX.Element {
  return (
    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", ...style }}>
      {name}
    </span>
  )
}

function ClockWidget(): JSX.Element {
  const [clock, setClock] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="kiosk-clock-glass">
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-on-surface)', fontFamily: 'monospace', margin: 0, letterSpacing: '-0.02em', position: 'relative', zIndex: 1 }}>
        {format(clock, 'HH:mm:ss')}
      </p>
    </div>
  )
}

type ManualOpenTone = 'idle' | 'success' | 'warn' | 'error'

function IdleScreen({
  settings, accessCode, showAdminButton, onGoToAdmin, errorMessage,
  onDigit, onBackspace, onCheckIn, onManualOpen, manualOpenPending,
  manualOpenCoolingDown, manualOpenMessage, manualOpenTone
}: {
  settings: GymSettings | null
  accessCode: string
  showAdminButton: boolean
  onGoToAdmin: () => void
  errorMessage: string
  onDigit: (d: string) => void
  onBackspace: () => void
  onCheckIn: () => void
  onManualOpen: () => void
  manualOpenPending: boolean
  manualOpenCoolingDown: boolean
  manualOpenMessage: string
  manualOpenTone: ManualOpenTone
}): JSX.Element {
  const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  // El código puede tener hasta 20 dígitos, pero el display usa fuente grande
  // con letter-spacing amplio: al pasar de ~10 dígitos el texto se desbordaba
  // y `text-overflow: ellipsis` ocultaba los dígitos nuevos. Medimos el ancho
  // real del display y reducimos la fuente para que TODOS los dígitos queden
  // siempre visibles mientras se escribe.
  const codeDisplayRef = useRef<HTMLDivElement | null>(null)
  const [codeAreaWidth, setCodeAreaWidth] = useState(320)
  useEffect(() => {
    const el = codeDisplayRef.current
    if (!el) return
    // clientWidth incluye el padding; el contenido útil resta 20px de cada lado.
    const update = () => setCodeAreaWidth(Math.max(0, el.clientWidth - 40))
    update()
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  // Ancho por dígito en JetBrains Mono ≈ 0.60em + letter-spacing 0.22em = 0.84em.
  // El margen 0.98 garantiza que nunca se recorte el último dígito por redondeo.
  const codeFontSize = accessCode
    ? Math.min(36, Math.max(16, (codeAreaWidth * 0.98) / (accessCode.length * 0.84)))
    : undefined

  return (
    <div className="kiosk-idle-root" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', backgroundColor: 'var(--color-bg)',
      position: 'relative', fontFamily: "'Montserrat', 'Inter', sans-serif",
      overflowX: 'hidden', overflowY: 'auto', userSelect: 'none'
    }}>
      {/* Icon background — <img> para drop-shadow con forma */}
      <img src={kioskBg} className="kiosk-bg" alt="" aria-hidden draggable={false} />
      <img src={kioskBg} className="kiosk-bg-corner" alt="" aria-hidden draggable={false} />
      {/* Background Glows */}
      <div style={{
        position: 'absolute', top: '15%', left: '-10%',
        width: '40vw', height: '40vw', borderRadius: '50%',
        background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
        filter: 'blur(120px)', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '-10%',
        width: '40vw', height: '40vw', borderRadius: '50%',
        background: 'color-mix(in srgb, var(--color-secondary) 8%, transparent)',
        filter: 'blur(120px)', pointerEvents: 'none'
      }} />

      {/* Admin Button (hidden by default) */}
      {showAdminButton && (
        <button onClick={onGoToAdmin} style={{
          position: 'absolute', top: 16, right: 16, zIndex: 100,
          padding: '6px 14px', fontSize: 13, fontWeight: 600,
          backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)',
          border: '1px solid var(--color-surface-container-highest)', borderRadius: 8, cursor: 'pointer'
        }}>
          Panel Admin
        </button>
      )}

      {/* Main Content */}
      <div className="kiosk-idle-content" style={{
        flex: '1 0 auto', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 'clamp(14px, 2.6vh, 36px)',
        padding: 'clamp(12px, 2.4vh, 32px) 32px clamp(16px, 3vh, 40px)',
        maxWidth: 480, width: '100%', zIndex: 1,
        position: 'relative', margin: 'auto'
      }}>
        {/* Welcome Section */}
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 420 }}>
          <h2 className="kiosk-welcome-title" style={{
            fontSize: 'clamp(16px, 2.8vw, 26px)',
            color: 'var(--color-on-surface)', margin: 0,
            letterSpacing: '-0.02em', lineHeight: 1.3,
            fontFamily: "'Montserrat', sans-serif",
            overflowWrap: 'break-word', wordBreak: 'break-word',
            hyphens: 'auto'
          }}>
            Bienvenido a{' '}
            <span className="kiosk-gym-highlight" title={settings?.name || 'BodyFit Gym'}>
              {settings?.name || 'BodyFit Gym'}
            </span>
            , nos complace que seas parte de nuestro equipo.
          </h2>
          <p className="kiosk-welcome-sub" style={{
            fontSize: 17, marginTop: 8,
            fontFamily: "'Inter', sans-serif"
          }}>
            Ingresa tu código de acceso
          </p>
        </div>

        {/* Code Display — muestra el código en claro para que el staff/cliente lo vea */}
        <div ref={codeDisplayRef} className="kiosk-code-display" aria-live="polite" aria-label={accessCode ? `Código ingresado ${accessCode}` : 'Código vacío'}>
          {accessCode ? (
            <span
              className="kiosk-code-value"
              style={codeFontSize !== undefined ? { fontSize: codeFontSize } : undefined}
            >
              {accessCode}
            </span>
          ) : (
            <span className="kiosk-code-placeholder" aria-hidden="true">— — — —</span>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="kiosk-keypad" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'clamp(8px, 1.4vh, 12px)', width: '100%', maxWidth: 360
        }}>
          {numpadKeys.map(d => (
            <button key={d} onClick={() => onDigit(d)} className="kiosk-numpad-btn">
              {d}
            </button>
          ))}
          <button onClick={onBackspace} className="kiosk-numpad-btn kiosk-backspace-btn" aria-label="Borrar">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
              <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
            </svg>
          </button>
          <button onClick={() => onDigit('0')} className="kiosk-numpad-btn">
            0
          </button>
          <button onClick={onCheckIn} className="kiosk-primary-glass">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Ingresar
          </button>
        </div>

        {/* Apertura manual para staff (mouse): reabre sin reescribir el código.
            Solo llama a door:open con trigger 'manual'; no valida ni registra acceso. */}
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={onManualOpen}
            disabled={manualOpenPending || manualOpenCoolingDown}
            aria-label="Abrir puerta"
            title="El personal puede reabrir la puerta sin pedir el código de nuevo"
            className="kiosk-numpad-btn"
            style={{
              width: '100%', padding: '12px 16px', fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: manualOpenPending || manualOpenCoolingDown ? 0.6 : 1,
              cursor: manualOpenPending || manualOpenCoolingDown ? 'wait' : 'pointer'
            }}
          >
            <MaterialIcon name="door_open" style={{ fontSize: 20 }} />
            {manualOpenPending ? 'Abriendo…' : 'Abrir puerta'}
          </button>
        </div>

      </div>

      {/* Floating toasts — error de código + aviso de puerta (misma posición, apilados) */}
      {(errorMessage || manualOpenMessage) && (
        <div className="kiosk-error-float" style={{
          position: 'absolute', top: 16, right: 32, zIndex: 50,
          width: 400, maxWidth: 'calc(100% - 64px)',
          pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 12
        }}>
          {errorMessage && (
            <div style={{
              animation: 'kiosk-shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both, kiosk-fade-in 0.35s ease-out both',
              position: 'relative'
            }}>
              <div className="kiosk-error-glow" />
              <div className="kiosk-error-glass">
                <div className="kiosk-error-icon">
                  <MaterialIcon name="block" style={{ fontSize: 22, color: 'var(--color-error)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    color: 'var(--color-error)', fontWeight: 700, fontSize: 13, margin: 0,
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>
                    Código inválido
                  </p>
                  <p style={{
                    color: 'var(--color-on-surface-variant)', fontWeight: 500, fontSize: 13, margin: '2px 0 0 0', lineHeight: 1.4
                  }}>
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}
          {manualOpenMessage && (() => {
            const toneColor = manualOpenTone === 'success'
              ? 'var(--color-success)'
              : manualOpenTone === 'warn'
                ? 'var(--color-warning)'
                : 'var(--color-error)'
            const toneIcon = manualOpenTone === 'success'
              ? 'door_open'
              : manualOpenTone === 'warn'
                ? 'warning'
                : 'error'
            const toneTitle = manualOpenTone === 'success'
              ? 'Puerta abierta'
              : manualOpenTone === 'warn'
                ? 'Aviso'
                : 'Error'
            return (
              <div
                role="status"
                aria-live="polite"
                style={{
                  animation: 'kiosk-fade-in 0.35s ease-out both',
                  position: 'relative'
                }}
              >
                <div className="kiosk-error-glow" style={{ background: `color-mix(in srgb, ${toneColor} 16%, transparent)` }} />
                <div
                  className="kiosk-error-glass"
                  style={{
                    background: `color-mix(in srgb, ${toneColor} 13%, var(--color-surface-container) 62%, transparent)`,
                    borderColor: `color-mix(in srgb, ${toneColor} 36%, transparent)`,
                    boxShadow: `0 12px 40px color-mix(in srgb, ${toneColor} 20%, transparent), 0 8px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.14)`
                  }}
                >
                  <div className="kiosk-error-icon" style={{ background: `color-mix(in srgb, ${toneColor} 22%, transparent)`, borderColor: `color-mix(in srgb, ${toneColor} 28%, transparent)` }}>
                    <MaterialIcon name={toneIcon} style={{ fontSize: 22, color: toneColor }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      color: toneColor, fontWeight: 700, fontSize: 13, margin: 0,
                      textTransform: 'uppercase', letterSpacing: '0.04em'
                    }}>
                      {toneTitle}
                    </p>
                    {manualOpenMessage !== toneTitle && (
                      <p style={{
                        color: 'var(--color-on-surface-variant)', fontWeight: 500, fontSize: 13, margin: '2px 0 0 0', lineHeight: 1.4
                      }}>
                        {manualOpenMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      <style>{`
        @keyframes kiosk-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        .kiosk-pulse { animation: kiosk-pulse 2s ease-in-out infinite; }
        @keyframes kiosk-shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        @keyframes kiosk-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}function ResultScreen({
      client, membership, validationResult, debts, routines, onRenew
    }: {
  client: Client
  membership?: Membership
  validationResult: ValidationResult
  debts?: ClientDebt[]
  routines?: ClientRoutine[]
  onReset: () => void
  onRenew: () => void
}): JSX.Element {
  const daysRemaining = membership
    ? differenceInDays(parseISO(membership.endDate), new Date())
    : 0

  // El backend es la fuente de verdad del acceso. Los días restantes son
  // informativos: una membresía que vence HOY sigue siendo válida todo el día
  // (0 días restantes = último día, NO vencida). Solo se considera vencida
  // cuando el acceso fue denegado o la fecha de vencimiento ya pasó.
  const isExpired = !validationResult.valid || daysRemaining < 0
  const isFrozen = !validationResult.valid && validationResult.code === 'denied_frozen'
  // Aviso rojizo cuando queda ≤1 día (incluye "Vence Hoy" = 0): sigue concediendo
  // acceso (puerta abre) pero el color advierte cercanía a vencer.
  const isExpiringSoon = validationResult.valid && daysRemaining >= 0 && daysRemaining <= 1
  const daysText = !membership
    ? '0 Días Restantes'
    : daysRemaining > 1
      ? `${daysRemaining} Días Restantes`
      : daysRemaining === 1
        ? '1 Día Restante'
        : 'Vence Hoy'

  // Estado visual: verde (activa con holgura), rojizo (por vencer ≤1 día, aun
  // con acceso concedido), ámbar (congelada) y rojo (vencida/denegada).
  const statusColor = !validationResult.valid
    ? isFrozen
      ? 'var(--color-warning)'
      : 'var(--color-error)'
    : isExpiringSoon
      ? 'var(--color-error)'
      : 'var(--color-success)'

  const statusLabel = !validationResult.valid
    ? isFrozen
      ? 'Acceso Denegado — Membresía Congelada'
      : 'Acceso Denegado — Membresía Vencida'
    : isExpiringSoon
      ? 'Acceso Permitido — Por Vencer'
      : 'Acceso Permitido — Membresía Activa'

  const estadoLabel = !validationResult.valid ? (isFrozen ? 'Congelada' : 'Vencida') : isExpiringSoon ? 'Por Vencer' : 'Activa'

  // Para congelada los días restantes no aplican: se muestra el mensaje del
  // backend ("Membresía congelada - contacta recepción").
  const statusSubtext = isFrozen
    ? validationResult.message || 'Membresía congelada - contacta recepción'
    : daysText

  const totalDebt = useMemo(() => {
    if (!debts || debts.length === 0) return 0
    return debts.reduce((sum, d) => sum + d.balance, 0)
  }, [debts])

  // Deuda pendiente en estado ACTIVO: blanco/neutro (paleta "verde + blanco"),
  // sin rojo ni ámbar, para no chocar con el verde del acceso permitido.
  // El rojo queda reservado para acceso denegado / membresía vencida.
  const debtColor = totalDebt <= 0
    ? (isExpired ? 'var(--color-on-surface-variant)' : 'var(--color-success)')
    : (isExpired ? 'var(--color-error)' : 'var(--color-on-surface)')
  const debtText = totalDebt <= 0 ? 'Sin Deuda' : 'Pendiente'

  const expiryDate = membership
    ? format(parseISO(membership.endDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
    : '—'

  // Paleta activa "verde + blanco": se neutralizan los tonos cálidos (durazno)
  // del tema kiosco oscuro para que los textos no aporten el cast rojizo que
  // chocaba con el verde del estado activo. Solo aplica cuando el acceso está
  // permitido Y el tema base es oscuro (en claro no hace falta y empeora contraste).
  const kioskTheme = useAppStore((s) => s.theme)
  const isLightKiosk = kioskTheme === 'light'
  const activeNeutralPalette = kioskTheme === 'dark'
    ? ({ '--color-on-surface-variant': '#dedede', '--color-outline': '#9e9e9e' } as React.CSSProperties)
    : ({} as React.CSSProperties)
  // Glass para rutina: en claro usamos vidrio blanco luminoso (igual que kiosk-code-display light)
  // para que no se vea gris apagado; en oscuro se mantiene el glass oscuro original.
  const routineGlass: React.CSSProperties = isLightKiosk
    ? {
        background: 'rgba(255,255,255,0.62)',
        backdropFilter: 'blur(18px) saturate(1.35)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.35)',
        border: '1px solid rgba(26,28,30,0.10)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.92)',
      }
    : glass

  return (
    <div style={{
      height: '100vh', backgroundColor: 'var(--color-bg)',
      fontFamily: "'Montserrat', 'Inter', sans-serif",
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      position: 'relative',
      ...(isExpired ? {} : activeNeutralPalette)
    }}>
      {/* Icon background — <img> para drop-shadow con forma */}
      <img src={kioskBg} className="kiosk-bg" alt="" aria-hidden draggable={false} />
      <img src={kioskBg} className="kiosk-bg-corner" alt="" aria-hidden draggable={false} />
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '5%', right: '-5%',
        width: '45vw', height: '45vw', borderRadius: '50%',
        background: `color-mix(in srgb, ${statusColor} 6%, transparent)`,
        filter: 'blur(140px)', pointerEvents: 'none', zIndex: 0
      }} />
      <main style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', zIndex: 1 }}>
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexShrink: 0, gap: 16
        }}>
          <div style={{ flex: '0 1 auto', minWidth: 0 }}>
            <h2 style={{ fontSize: 32, lineHeight: '38px', fontWeight: 700, color: 'var(--color-on-surface)', margin: 0, letterSpacing: '-0.02em' }}>
              Registro de Ingreso
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: statusColor,
                boxShadow: `0 0 8px ${statusColor}`,
                animation: 'kiosk-pulse 2s ease-in-out infinite'
              }} />
              <span style={{ color: statusColor, fontWeight: 600, fontSize: 15 }}>
                {statusLabel}
              </span>
            </div>
          </div>
          <ClockWidget />
        </header>

        <div style={{
          flex: 1, display: 'grid', gridTemplateColumns: '1fr 2fr', gridTemplateRows: '1fr',
          gap: 24, paddingBottom: 32,
          minHeight: 0, minWidth: 0
        }}>
          {/* LEFT COLUMN: Photo + Renew button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            <div style={{
              ...routineGlass, borderRadius: 16, padding: 24,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              position: 'relative', flexShrink: 0
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: 96,
                borderRadius: '16px 16px 0 0',
                background: `linear-gradient(to bottom, color-mix(in srgb, ${statusColor} 15%, transparent), transparent)`,
                pointerEvents: 'none'
              }} />
              <div style={{ position: 'relative', marginBottom: 24, marginTop: 16 }}>
                <div style={{
                  width: 128, height: 128, borderRadius: '50%',
                  border: '4px solid var(--color-surface-container)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  overflow: 'hidden', backgroundColor: 'var(--color-surface-bright)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', zIndex: 1
                }}>
                  {client.photo ? (
                    <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <MaterialIcon name="person" style={{ fontSize: 64, color: 'var(--color-on-surface-variant)' }} />
                  )}
                </div>
                <div style={{
                  position: 'absolute', bottom: 4, right: 4, width: 32, height: 32,
                  borderRadius: '50%', backgroundColor: statusColor,
                  border: '4px solid var(--color-surface-container)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 2
                }}>
                  <MaterialIcon name={isFrozen ? 'ac_unit' : isExpired ? 'close' : isExpiringSoon ? 'warning' : 'check'} style={{
                    fontSize: 16,
                    color: isFrozen ? 'var(--color-on-warning)' : isExpired || isExpiringSoon ? 'var(--color-on-error)' : '#fff'
                  }} />
                </div>
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 4px 0', textAlign: 'center' }}>
                {client.fullName.toUpperCase()}
              </h3>
              <p style={{
                fontSize: 13, color: 'var(--color-on-surface-variant)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 24
              }}>
                MIEMBRO
              </p>
              <div style={{ width: '100%' }}>
                <div style={{
                  backgroundColor: isLightKiosk ? 'rgba(255,255,255,0.58)' : 'var(--color-surface-container)', borderRadius: 12, padding: 16,
                  border: isLightKiosk ? '1px solid rgba(26,28,30,0.10)' : '1px solid rgba(139,144,160,0.2)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>ID (Clave)</span>
                  <span style={{
                    fontSize: 18, fontFamily: 'monospace', fontWeight: 700,
                    color: statusColor, letterSpacing: '0.05em'
                  }}>
                    {client.accessCode}
                  </span>
                </div>
              </div>
            </div>

            {isExpired && validationResult.code === 'denied_expired' && (
              <button onClick={onRenew} style={{
                width: '100%', padding: 16, borderRadius: 10,
                backgroundColor: 'var(--color-primary-container)',
                color: 'var(--color-on-primary-container)',
                border: 'none', fontSize: 16, fontWeight: 800, cursor: 'pointer',
                letterSpacing: '0.02em'
              }}>
                RENOVAR MEMBRESÍA
              </button>
            )}
          </div>

          {/* RIGHT COLUMN: Status cards + Routine panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            {/* Status cards row */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div style={{
                  ...routineGlass, borderRadius: 12, padding: 20,
                  display: 'flex', flexDirection: 'column',
                  borderLeft: `4px solid ${statusColor}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <MaterialIcon name={isFrozen ? 'ac_unit' : isExpired ? 'event_busy' : isExpiringSoon ? 'warning' : 'check_circle'} style={{ color: statusColor, fontSize: 20 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>Estado</span>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)', margin: 0 }}>
                    {estadoLabel}
                  </p>
                  <p style={{ fontSize: 12, color: statusColor, fontWeight: 600, marginTop: 4 }}>{statusSubtext}</p>
                </div>
                <div style={{
                  ...routineGlass, borderRadius: 12, padding: 20,
                  display: 'flex', flexDirection: 'column',
                  borderLeft: `4px solid ${debtColor}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <MaterialIcon name="payments" style={{ color: debtColor, fontSize: 20 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>Adeudo</span>
                  </div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)', margin: 0 }}>
                    ${totalDebt.toFixed(2)}
                  </p>
                  <p style={{ fontSize: 12, color: debtColor, fontWeight: 600, marginTop: 4 }}>{debtText}</p>
                </div>
                <div style={{
                  ...routineGlass, borderRadius: 12, padding: 20,
                  display: 'flex', flexDirection: 'column',
                  borderLeft: `4px solid ${statusColor}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <MaterialIcon name="calendar_month" style={{ color: statusColor, fontSize: 20 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>Vencimiento</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)', margin: 0, textTransform: 'capitalize' }}>
                    {expiryDate}
                  </p>
                </div>
              </div>
            </div>

            {/* Routine panel — en claro vidrio blanco, no gris oscuro */}
            <div style={{
              flex: 1, overflowY: 'auto', minHeight: 0,
              ...routineGlass, borderRadius: 16,
              display: 'flex', flexDirection: 'column'
            }}>
              <div style={{
                padding: '14px 24px 12px',
                borderBottom: isLightKiosk ? '1px solid rgba(26,28,30,0.10)' : '1px solid rgba(139,144,160,0.2)',
                backgroundColor: isLightKiosk ? 'rgba(255,255,255,0.48)' : 'rgba(32,31,31,0.5)',
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <MaterialIcon name="fitness_center" style={{ color: statusColor, fontSize: 18 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: statusColor }}>Rutina Semanal</span>
              </div>

              <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Array.from({ length: 7 }, (_, dow) => {
                  const dayIdx = DAY_INDEX_FROM_DOW[dow]
                  const dayInfo = DAYS[dayIdx]
                  const isWeekend = dow === 0 || dow === 6
                  const dayRoutine = routines?.find(r => r.dayOfWeek === dow)
                  const exercises = dayRoutine?.exercises || []

                  return (
                    <div key={dow}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 6
                      }}>
                        <MaterialIcon name={dayInfo.icon} style={{
                          color: isWeekend ? 'var(--color-on-surface-variant)' : statusColor,
                          fontSize: 15
                        }} />
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          color: isWeekend ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)',
                          textTransform: 'uppercase', letterSpacing: '0.03em'
                        }}>
                          {dayInfo.key}
                        </span>
                      </div>
                      {exercises.length > 0 ? (
                        <div style={{
                          backgroundColor: isLightKiosk ? 'rgba(255,255,255,0.72)' : 'var(--color-surface-container)',
                          borderRadius: 10, padding: '10px 14px',
                          border: isLightKiosk ? '1px solid rgba(26,28,30,0.10)' : '1px solid rgba(139,144,160,0.15)',
                          display: 'flex', flexDirection: 'column', gap: 6
                        }}>
                          {exercises.map((ex, i) => (
                            <div key={i} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                  width: 20, height: 20, borderRadius: '50%',
                                  backgroundColor: isLightKiosk ? 'rgba(255,255,255,0.90)' : 'var(--color-surface-container-high)',
                                  border: isLightKiosk ? '1px solid rgba(26,28,30,0.10)' : 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 9, fontWeight: 700, color: statusColor
                                }}>{i + 1}</span>
                                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-on-surface)' }}>{ex.name}</span>
                              </div>
                              <span style={{ color: 'var(--color-outline)', fontWeight: 500, fontSize: 12 }}>
                                {ex.sets} x {ex.reps}
                                {ex.notes && <span style={{ color: 'var(--color-outline)', marginLeft: 4, fontSize: 10 }}>({ex.notes})</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{
                          backgroundColor: isLightKiosk ? 'rgba(255,255,255,0.58)' : 'var(--color-surface-container)',
                          borderRadius: 10, padding: '10px 14px',
                          border: isLightKiosk ? '1px dashed rgba(26,28,30,0.14)' : '1px dashed rgba(139,144,160,0.2)',
                          opacity: isLightKiosk ? 1 : 0.6
                        }}>
                          <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>
                            Sin ejercicios registrados
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--color-outline)', fontSize: 13, marginTop: 8, flexShrink: 0 }}>
          Volviendo al inicio...
        </p>
      </main>

      <style>{`
        * { user-select: none; }
        @keyframes kiosk-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>
    </div>
  )
}

export function KioskPage(): JSX.Element {
  const [accessCode, setAccessCode] = useState('')
  const [accessState, setAccessState] = useState<AccessState>('idle')
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [debts, setDebts] = useState<ClientDebt[] | undefined>(undefined)
  const [routines, setRoutines] = useState<ClientRoutine[] | undefined>(undefined)
  const [showAdminButton, setShowAdminButton] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [gymSettings, setGymSettings] = useState<GymSettings | null>(null)
  const isValidating = useRef(false)
  // Reapertura manual desde el formulario (staff con mouse): no valida código,
  // solo reabre la puerta. Con cooldown para no martillar el relé.
  const [doorPending, setDoorPending] = useState(false)
  const [doorCoolingDown, setDoorCoolingDown] = useState(false)
  const [doorMessage, setDoorMessage] = useState('')
  const [doorTone, setDoorTone] = useState<ManualOpenTone>('idle')
  const doorCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (doorCooldownTimer.current) clearTimeout(doorCooldownTimer.current)
    }
  }, [])

  useEffect(() => {
    window.electronAPI.gym.getSettings().then((result) => {
      if (result.success && result.data) {
        setGymSettings(result.data)
      }
    })
  }, [])

  // Sincroniza con el tema global (Configuración > Marca y Apariencia).
  // El kiosco ya no usa un data-theme propio 'kiosk': usa 'dark'/'light'
  // heredado del store y añade data-kiosk="true" para overrides visuales.
  const kioskTheme = useAppStore((s) => s.theme)
  const setKioskTheme = useAppStore((s) => s.setTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', kioskTheme)
    document.documentElement.setAttribute('data-kiosk', 'true')
  }, [kioskTheme])

  useEffect(() => {
    // El kiosco vive en una BrowserWindow separada con su propia memoria de
    // Zustand. El admin persiste el tema en localStorage; el kiosco escucha
    // storage + poll por si el evento no llega en file://.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bodyfitgym-theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        const current = useAppStore.getState().theme
        if (e.newValue !== current) setKioskTheme(e.newValue as 'dark' | 'light')
        else {
          document.documentElement.setAttribute('data-theme', e.newValue)
          document.documentElement.setAttribute('data-kiosk', 'true')
        }
      }
    }
    window.addEventListener('storage', onStorage)
    const poll = setInterval(() => {
      try {
        const stored = localStorage.getItem('bodyfitgym-theme')
        if ((stored === 'dark' || stored === 'light') && stored !== useAppStore.getState().theme) {
          setKioskTheme(stored as 'dark' | 'light')
        }
      } catch { /* storage no disponible */ }
    }, 1500)
    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(poll)
      document.documentElement.removeAttribute('data-kiosk')
    }
  }, [setKioskTheme])

  const resetAll = useCallback(() => {
    setAccessCode('')
    setAccessState('idle')
    setErrorMessage('')
    setValidationResult(null)
    setClient(null)
    setMembership(null)
    setDebts(undefined)
    setRoutines(undefined)
  }, [])

  useEffect(() => {
    if (accessState === 'result') {
      const timer = setTimeout(resetAll, 8000)
      return () => clearTimeout(timer)
    }
  }, [accessState, resetAll])

  const handleDigit = useCallback((digit: string) => {
    if (accessCode.length < 20 && accessState === 'idle') {
      setAccessCode(prev => prev + digit)
      setErrorMessage('')
    }
  }, [accessCode.length, accessState])

  const handleBackspace = useCallback(() => {
    if (accessState === 'idle') {
      setAccessCode(prev => prev.slice(0, -1))
    }
  }, [accessState])

  const handleManualOpen = useCallback(async () => {
    if (doorPending || doorCoolingDown) return
    setDoorPending(true)
    // Opción A: sin toast intermedio — el botón ya muestra "Abriendo…"
    setDoorMessage('')
    try {
      const result = await window.electronAPI.door.open('manual')
      if (result.success && result.data) {
        setDoorTone('success')
        setDoorMessage('Puerta abierta')
      } else if (result.success) {
        setDoorTone('warn')
        setDoorMessage('La puerta ya está abierta')
      } else {
        setDoorTone('error')
        setDoorMessage(result.error || 'No se pudo abrir la puerta')
      }
    } catch {
      setDoorTone('error')
      setDoorMessage('No se pudo abrir la puerta')
    } finally {
      setDoorPending(false)
      setDoorCoolingDown(true)
      if (doorCooldownTimer.current) clearTimeout(doorCooldownTimer.current)
      doorCooldownTimer.current = setTimeout(() => {
        setDoorCoolingDown(false)
        doorCooldownTimer.current = null
      }, 3000)
    }
  }, [doorPending, doorCoolingDown])

  const validateAccess = useCallback(async () => {
    if (accessCode.length < 1 || isValidating.current) return
    isValidating.current = true
    setAccessState('checking')
    try {
      const result = await window.electronAPI.access.validate(accessCode)

      if (result.success && result.data && result.data.client) {
        setValidationResult(result.data)
        setClient(result.data.client || null)
        setMembership(result.data.membership || null)
        setDebts(result.data.debt)
        setRoutines(result.data.routines)

        setAccessState('result')
        if (result.data.valid) {
          await window.electronAPI.door.open('access_code')
        }
      } else {
        setAccessCode('')
        setAccessState('idle')
        setErrorMessage('El código ingresado no existe')
      }
    } catch {
      setAccessCode('')
      setAccessState('idle')
      setErrorMessage('Error al validar el código')
    } finally {
      isValidating.current = false
    }
  }, [accessCode, resetAll])

  useEffect(() => {
    if (!errorMessage) return
    const timer = setTimeout(() => setErrorMessage(''), 5000)
    return () => clearTimeout(timer)
  }, [errorMessage])

  useEffect(() => {
    if (!doorMessage || doorPending) return
    const timer = setTimeout(() => setDoorMessage(''), 5000)
    return () => clearTimeout(timer)
  }, [doorMessage, doorPending])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        setErrorMessage('')
        resetAll()
      } else if (e.key === 'Enter') {
        validateAccess()
      } else if (e.key.toLowerCase() === 'a') {
        setShowAdminButton(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDigit, handleBackspace, resetAll, validateAccess])

  const goToAdmin = () => {
    window.location.hash = '#/'
  }

  const goToRenew = () => {
    if (client) {
      window.electronAPI.window.openKioskRenew(client.id)
    }
  }

  if (accessState === 'checking') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: 'var(--color-bg)', gap: 24,
        position: 'relative', overflow: 'hidden'
      }}>
        <img src={kioskBg} className="kiosk-bg" alt="" aria-hidden draggable={false} />
        <div style={{
          width: 44, height: 44,
          border: '4px solid var(--color-surface-container-highest)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          position: 'relative', zIndex: 1
        }} />
        <span style={{ color: 'var(--color-primary)', fontSize: 22, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", position: 'relative', zIndex: 1 }}>Validando...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (accessState === 'result' && client && validationResult) {
    return (
      <ResultScreen
        client={client}
        membership={membership || undefined}
        validationResult={validationResult}
        debts={debts}
        routines={routines}
        onReset={resetAll}
        onRenew={goToRenew}
      />
    )
  }

  return (
    <IdleScreen
      settings={gymSettings}
      accessCode={accessCode}
      showAdminButton={showAdminButton}
      onGoToAdmin={goToAdmin}
      errorMessage={errorMessage}
      onDigit={handleDigit}
      onBackspace={handleBackspace}
      onCheckIn={validateAccess}
      onManualOpen={handleManualOpen}
      manualOpenPending={doorPending}
      manualOpenCoolingDown={doorCoolingDown}
      manualOpenMessage={doorMessage}
      manualOpenTone={doorTone}
    />
  )
}
