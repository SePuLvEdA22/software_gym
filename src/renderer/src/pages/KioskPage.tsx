import { useState, useEffect, useCallback } from 'react'
import { Icons } from '@/components/Icons'
import { parseISO, differenceInDays } from 'date-fns'
import { Client, Membership } from '../../../shared/types'

type AccessState = 'idle' | 'granted' | 'denied' | 'checking'

interface ValidationResult {
  valid: boolean
  client?: Client
  membership?: Membership
  message: string
  code: string
}

function CodeDisplay({ code }: { code: string }): JSX.Element {
  const len = code.length
  
  const getFontSize = () => {
    if (len <= 6) return 36
    if (len <= 8) return 32
    if (len <= 10) return 28
    if (len <= 12) return 24
    if (len <= 15) return 20
    return 16
  }
  
  const getLetterSpacing = () => {
    if (len <= 6) return 6
    if (len <= 10) return 4
    return 2
  }
  
  const fontSize = getFontSize()
  const letterSpacing = getLetterSpacing()

  return (
    <div style={{
      width: 420,
      height: 72,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1c1b1b',
      border: '2px solid #353534',
      borderRadius: 12,
      fontFamily: 'monospace',
      fontSize,
      fontWeight: 700,
      color: code ? '#ff6b00' : '#606060',
      letterSpacing,
      padding: '0 20px',
      overflow: 'hidden'
    }}>
      {code ? (
        <>
          <span style={{ 
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            direction: 'rtl',
            textAlign: 'left'
          }}>
            {code}
          </span>
          <span style={{
            display: 'inline-block',
            width: Math.max(2, fontSize / 18),
            height: fontSize,
            backgroundColor: '#ff6b00',
            marginLeft: Math.max(4, letterSpacing),
            animation: 'blink 1s step-end infinite',
            flexShrink: 0
          }} />
        </>
      ) : (
        <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: 0 }}>
          Ingrese su código
        </span>
      )}
    </div>
  )
}

function Numpad({ onDigit, onClear, onBackspace, onEnter, disabled }: {
  onDigit: (d: string) => void
  onClear: () => void
  onBackspace: () => void
  onEnter: () => void
  disabled: boolean
}): JSX.Element {
  const btnDigit: React.CSSProperties = {
    width: 96,
    height: 64,
    border: 'none',
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: 28,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1
  }

  const btnSmall: React.CSSProperties = {
    width: 96,
    height: 64,
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {['1','2','3'].map(d => (
          <button key={d} style={btnDigit} onClick={() => onDigit(d)} disabled={disabled}>{d}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {['4','5','6'].map(d => (
          <button key={d} style={btnDigit} onClick={() => onDigit(d)} disabled={disabled}>{d}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {['7','8','9'].map(d => (
          <button key={d} style={btnDigit} onClick={() => onDigit(d)} disabled={disabled}>{d}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClear} disabled={disabled} style={{
          ...btnSmall,
          backgroundColor: 'rgba(255, 180, 171, 0.15)',
          color: '#ffb4ab'
        }}>
          LIMPIAR
        </button>
        <button onClick={() => onDigit('0')} disabled={disabled} style={btnDigit}>0</button>
        <button onClick={onBackspace} disabled={disabled} style={{
          ...btnSmall,
          backgroundColor: 'rgba(200, 198, 197, 0.12)',
          color: '#c8c6c5'
        }}>
          BORRAR
        </button>
      </div>
      <button onClick={onEnter} disabled={disabled} style={{
        width: 308,
        height: 64,
        border: 'none',
        borderRadius: 10,
        backgroundColor: '#ff6b00',
        color: '#fff',
        fontSize: 20,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1
      }}>
        ENTER
      </button>
    </div>
  )
}

export function KioskPage(): JSX.Element {
  const [accessCode, setAccessCode] = useState('')
  const [accessState, setAccessState] = useState<AccessState>('idle')
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [showAdminButton, setShowAdminButton] = useState(false)

  const resetAll = useCallback(() => {
    setAccessCode('')
    setAccessState('idle')
    setValidationResult(null)
    setClient(null)
    setMembership(null)
  }, [])

  useEffect(() => {
    if (accessState === 'granted' || accessState === 'denied') {
      const timer = setTimeout(resetAll, 6000)
      return () => clearTimeout(timer)
    }
  }, [accessState, resetAll])

  const handleDigit = useCallback((digit: string) => {
    if (accessCode.length < 20 && accessState === 'idle') {
      setAccessCode(prev => prev + digit)
    }
  }, [accessCode.length, accessState])

  const handleBackspace = useCallback(() => {
    if (accessState === 'idle') {
      setAccessCode(prev => prev.slice(0, -1))
    }
  }, [accessState])

  const validateAccess = useCallback(async () => {
    if (accessCode.length < 1) return
    setAccessState('checking')
    const result = await window.electronAPI.access.validate(accessCode)

    if (result.success && result.data) {
      setValidationResult(result.data)
      setClient(result.data.client || null)
      setMembership(result.data.membership || null)

      if (result.data.valid) {
        setAccessState('granted')
        await window.electronAPI.door.open()
      } else {
        setAccessState('denied')
      }
    } else {
      resetAll()
    }
  }, [accessCode, resetAll])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
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

  if (accessState === 'checking') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: '#0e0e0e', gap: 24
      }}>
        <div style={{
          width: 40, height: 40,
          border: '4px solid rgba(255,107,0,0.2)',
          borderTopColor: '#ff6b00',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <span style={{ color: '#ff6b00', fontSize: 20, fontWeight: 600 }}>Validando...</span>
      </div>
    )
  }

  if (accessState === 'granted' && client) {
    const daysRemaining = membership
      ? differenceInDays(parseISO(membership.endDate), new Date())
      : 0

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: '#0e0e0e', gap: 20
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
          padding: '40px 48px', backgroundColor: 'rgba(74,222,128,0.06)',
          border: '2px solid #4ade80', borderRadius: 16
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            backgroundColor: 'rgba(74,222,128,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icons.Check />
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: '#4ade80', margin: 0 }}>
            ACCESO PERMITIDO
          </h2>
          <p style={{ fontSize: 16, color: '#a98a7d', margin: 0 }}>
            Bienvenido, puedes ingresar
          </p>
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            backgroundColor: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 48, fontWeight: 800, color: '#ff6b00', overflow: 'hidden'
          }}>
            {client.photo ? (
              <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              client.fullName.charAt(0).toUpperCase()
            )}
          </div>
          <h3 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{client.fullName}</h3>
          {membership && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px',
                backgroundColor: '#1c1b1b', borderRadius: 8 }}>
                <span style={{ color: '#a98a7d', fontSize: 14 }}>Membresía</span>
                <span style={{ fontWeight: 700 }}>{membership.planName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px',
                backgroundColor: '#1c1b1b', borderRadius: 8 }}>
                <span style={{ color: '#a98a7d', fontSize: 14 }}>Días Restantes</span>
                <span style={{ fontWeight: 800, fontSize: 24,
                  color: daysRemaining <= 3 ? '#ffb4ab' : daysRemaining <= 7 ? '#fbbf24' : '#4ade80'
                }}>
                  {daysRemaining} días
                </span>
              </div>
            </div>
          )}
        </div>
        <span style={{ color: '#606060', fontSize: 13 }}>
          Volviendo al inicio...
        </span>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          * { user-select: none; }
        `}</style>
      </div>
    )
  }

  if (accessState === 'denied' && validationResult) {
    const getTitle = () => {
      switch (validationResult.code) {
        case 'denied_expired': return 'MEMBRESÍA VENCIDA'
        case 'denied_frozen': return 'MEMBRESÍA CONGELADA'
        case 'denied_inactive': return 'CUENTA INACTIVA'
        default: return 'ACCESO DENEGADO'
      }
    }

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: '#0e0e0e', gap: 20
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
          padding: '40px 48px', backgroundColor: 'rgba(255,180,171,0.06)',
          border: '2px solid #ffb4ab', borderRadius: 16
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            backgroundColor: 'rgba(255,180,171,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icons.X />
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#ffb4ab', margin: 0 }}>
            {getTitle()}
          </h2>
          {client && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16,
              backgroundColor: '#1c1b1b', borderRadius: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: '#2a2a2a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: '#ff6b00', overflow: 'hidden' }}>
                {client.photo ? (
                  <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  client.fullName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{client.fullName}</div>
                <div style={{ fontSize: 13, color: '#a98a7d' }}>Código: {client.accessCode}</div>
              </div>
            </div>
          )}
          <p style={{ fontSize: 18, fontWeight: 600, color: '#ffb4ab', margin: 0, textAlign: 'center' }}>
            {validationResult.message}
          </p>
          {validationResult.code === 'denied_expired' && (
            <p style={{ fontSize: 14, color: '#a98a7d', margin: 0 }}>
              Renueva tu membresía en recepción
            </p>
          )}
          {validationResult.code === 'denied_frozen' && (
            <p style={{ fontSize: 14, color: '#a98a7d', margin: 0 }}>
              Visita recepción para reactivar tu membresía
            </p>
          )}
        </div>
        <span style={{ color: '#606060', fontSize: 13 }}>
          Volviendo al inicio...
        </span>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          * { user-select: none; }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', backgroundColor: '#0e0e0e', padding: 32, gap: 40, position: 'relative'
    }}>
      {showAdminButton && (
        <button onClick={goToAdmin} style={{
          position: 'absolute', top: 20, right: 20, zIndex: 100,
          padding: '6px 14px', fontSize: 13, fontWeight: 600,
          backgroundColor: '#2a2a2a', color: '#fff', border: '1px solid #353534',
          borderRadius: 8, cursor: 'pointer'
        }}>
          Panel Admin
        </button>
      )}

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 44, fontWeight: 800, color: '#ff6b00', margin: 0 }}>
          BODYFITGYM
        </h1>
        <p style={{ fontSize: 18, color: '#a98a7d', marginTop: 8 }}>
          Ingresa tu código de acceso
        </p>
      </div>

      <CodeDisplay code={accessCode} />

      <Numpad
        onDigit={handleDigit}
        onClear={resetAll}
        onBackspace={handleBackspace}
        onEnter={validateAccess}
        disabled={false}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        * { user-select: none; }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  )
}
