import { useState, useEffect, useCallback } from 'react'
import { Icons } from '@/components/Icons'
import { Client, Membership } from '../../../shared/types'
import { format, parseISO, differenceInDays } from 'date-fns'

type AccessState = 'idle' | 'granted' | 'denied' | 'checking'

interface ValidationResult {
  valid: boolean
  client?: Client
  membership?: Membership
  message: string
  code: string
}

function CodeDisplay({ code, placeholder = 'Ingrese su código' }: {
  code: string
  placeholder?: string
}): JSX.Element {
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
      backgroundColor: 'var(--color-surface-container-low)',
      border: '2px solid var(--color-surface-container-highest)',
      borderRadius: 12,
      fontFamily: 'monospace',
      fontSize,
      fontWeight: 700,
      color: len > 0 ? 'var(--color-primary-container)' : 'var(--color-secondary)',
      letterSpacing,
      padding: '0 20px',
      overflow: 'hidden'
    }}>
      {len > 0 ? (
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
            backgroundColor: 'var(--color-primary-container)',
            marginLeft: Math.max(4, letterSpacing),
            animation: 'blink 1s step-end infinite',
            flexShrink: 0
          }} />
        </>
      ) : (
        <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: 0 }}>
          {placeholder}
        </span>
      )}
    </div>
  )
}

function AccessNumpad({ onDigit, onClear, onBackspace, onEnter, disabled }: {
  onDigit: (digit: string) => void
  onClear: () => void
  onBackspace: () => void
  onEnter: () => void
  disabled: boolean
}): JSX.Element {
  const buttonStyle = (bg: string, textColor: string, isActive: boolean): React.CSSProperties => ({
    width: 96,
    height: 72,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isActive ? bg : 'var(--color-surface-container)',
    border: isActive ? '2px solid ' + bg : '2px solid var(--color-surface-container-highest)',
    borderRadius: 10,
    fontSize: isActive ? 16 : 28,
    fontWeight: 700,
    color: isActive ? textColor : 'var(--color-on-surface)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.1s ease',
    gap: 6,
    flexDirection: 'column'
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            onClick={() => onDigit(digit)}
            disabled={disabled}
            style={buttonStyle('var(--color-surface-container)', 'var(--color-on-surface)', false)}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-container-highest)'
                e.currentTarget.style.borderColor = 'var(--color-primary-container)'
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-container)'
                e.currentTarget.style.borderColor = 'var(--color-surface-container-highest)'
              }
            }}
          >
            {digit}
          </button>
        ))}
        
        <button
          onClick={onClear}
          disabled={disabled}
          style={buttonStyle('var(--color-error-container)', 'var(--color-on-error-container)', true)}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-error)'
              e.currentTarget.style.color = 'var(--color-on-error)'
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-error-container)'
              e.currentTarget.style.color = 'var(--color-on-error-container)'
            }
          }}
        >
          <Icons.X style={{ width: 24, height: 24 }} />
          <span style={{ fontSize: 12 }}>LIMPIAR</span>
        </button>
        
        <button
          onClick={() => onDigit('0')}
          disabled={disabled}
          style={buttonStyle('var(--color-surface-container)', 'var(--color-on-surface)', false)}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-container-highest)'
              e.currentTarget.style.borderColor = 'var(--color-primary-container)'
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-container)'
              e.currentTarget.style.borderColor = 'var(--color-surface-container-highest)'
            }
          }}
        >
          0
        </button>
        
        <button
          onClick={onBackspace}
          disabled={disabled}
          style={buttonStyle('var(--color-surface-container-high)', 'var(--color-on-surface)', true)}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-container-highest)'
              e.currentTarget.style.borderColor = 'var(--color-primary-container)'
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'
              e.currentTarget.style.borderColor = 'var(--color-surface-container-highest)'
            }
          }}
        >
          <Icons.Backspace style={{ width: 24, height: 24 }} />
          <span style={{ fontSize: 12 }}>BORRAR</span>
        </button>
      </div>
      
      <button
        onClick={onEnter}
        disabled={disabled}
        style={{
          width: 308,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-primary)',
          border: 'none',
          borderRadius: 10,
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--color-on-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 0.1s ease',
          gap: 10
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            e.currentTarget.style.filter = 'brightness(1.15)'
            e.currentTarget.style.transform = 'scale(1.01)'
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            e.currentTarget.style.filter = 'none'
            e.currentTarget.style.transform = 'scale(1)'
          }
        }}
      >
        <Icons.Check style={{ width: 24, height: 24 }} />
        ENTER
      </button>
    </div>
  )
}

function AccessGrantedView({ 
  client, 
  membership,
  debtBalance,
  onReset 
}: { 
  client: Client
  membership?: Membership
  debtBalance?: number
  onReset: () => void
}): JSX.Element {
  const daysRemaining = membership 
    ? differenceInDays(parseISO(membership.endDate), new Date())
    : 0

  useEffect(() => {
    const timer = setTimeout(onReset, 5000)
    return () => clearTimeout(timer)
  }, [onReset])

  return (
    <div className="access-granted" style={{ width: '100%', maxWidth: 500 }}>
      <div style={{ 
        textAlign: 'center', 
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ 
          width: 80, 
          height: 80, 
          borderRadius: '50%', 
          backgroundColor: 'var(--color-success-container)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          color: 'var(--color-success)'
        }}>
          <Icons.Check />
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-success)' }}>
          ACCESO PERMITIDO
        </h2>
      </div>

      <div className="access-client-photo">
        {client.photo ? (
          <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} />
        ) : (
          client.fullName.charAt(0).toUpperCase()
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Bienvenido, {client.fullName}
        </h3>
        {membership && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '12px 16px',
              backgroundColor: 'var(--color-surface-container)',
              borderRadius: 8
            }}>
              <span style={{ color: 'var(--color-secondary)' }}>Membresía</span>
              <span style={{ fontWeight: 600 }}>{membership.planName}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '12px 16px',
              backgroundColor: 'var(--color-surface-container)',
              borderRadius: 8
            }}>
              <span style={{ color: 'var(--color-secondary)' }}>Vencimiento</span>
              <span style={{ fontWeight: 600 }}>
                {format(parseISO(membership.endDate), 'dd/MM/yyyy')}
              </span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '12px 16px',
              backgroundColor: daysRemaining <= 5 
                ? 'var(--color-warning-container)' 
                : 'var(--color-surface-container)',
              borderRadius: 8,
              border: daysRemaining <= 5 ? '1px solid var(--color-warning)' : 'none'
            }}>
              <span style={{ color: 'var(--color-secondary)' }}>Días restantes</span>
              <span style={{ 
                fontWeight: 700,
                fontSize: 18,
                color: daysRemaining <= 3 
                  ? 'var(--color-error)' 
                  : daysRemaining <= 7 
                    ? 'var(--color-warning)' 
                    : 'var(--color-primary-container)'
              }}>
                {daysRemaining} días
              </span>
            </div>
          </div>
        )}

        {debtBalance && debtBalance > 0 && (
          <div style={{ 
            marginTop: 16,
            padding: 12,
            backgroundColor: 'var(--color-error-container)',
            borderRadius: 8,
            border: '1px solid var(--color-error)'
          }}>
            <p style={{ 
              fontSize: 14, 
              fontWeight: 600,
              color: 'var(--color-error)',
              textAlign: 'center'
            }}>
              Saldo pendiente: ${debtBalance.toLocaleString('es-CO')} - Por favor cancela en recepción
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function AccessDeniedView({ 
  result, 
  client,
  onReset 
}: { 
  result: ValidationResult
  client?: Client
  onReset: () => void
}): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onReset, 5000)
    return () => clearTimeout(timer)
  }, [onReset])

  return (
    <div className="access-denied" style={{ width: '100%', maxWidth: 500 }}>
      <div style={{ 
        textAlign: 'center', 
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ 
          width: 80, 
          height: 80, 
          borderRadius: '50%', 
          backgroundColor: 'var(--color-error-container)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          color: 'var(--color-error)'
        }}>
          <Icons.X />
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-error)' }}>
          ACCESO DENEGADO
        </h2>
      </div>

      {client && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: 16,
          padding: 16,
          backgroundColor: 'var(--color-surface-container)',
          borderRadius: 8
        }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 12
          }}>
            <div className="avatar">
              {client.photo ? (
                <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} />
              ) : (
                client.fullName.charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>{client.fullName}</div>
              <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                Código: {client.accessCode}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ 
        textAlign: 'center', 
        marginTop: 24,
        padding: 16,
        backgroundColor: 'var(--color-error-container)',
        borderRadius: 8,
        border: '1px solid var(--color-error)'
      }}>
        <p style={{ 
          fontSize: 18, 
          fontWeight: 600,
          color: 'var(--color-error)'
        }}>
          {result.message}
        </p>
        {result.code === 'denied_expired' && (
          <p style={{ 
            fontSize: 14, 
            marginTop: 8,
            color: 'var(--color-secondary)'
          }}>
            Por favor renueve su membresía en recepción
          </p>
        )}
        {result.code === 'denied_frozen' && (
          <p style={{ 
            fontSize: 14, 
            marginTop: 8,
            color: 'var(--color-secondary)'
          }}>
            Visite recepción para reactivar su membresía congelada
          </p>
        )}
      </div>
    </div>
  )
}

export function AccessPage(): JSX.Element {
  const [accessCode, setAccessCode] = useState('')
  const [accessState, setAccessState] = useState<AccessState>('idle')
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [debtBalance, setDebtBalance] = useState<number>(0)

  const handleDigit = useCallback((digit: string) => {
    if (accessCode.length < 20 && accessState === 'idle') {
      setAccessCode(prev => prev + digit)
    }
  }, [accessCode.length, accessState])

  const handleClear = useCallback(() => {
    setAccessCode('')
    setAccessState('idle')
    setValidationResult(null)
    setClient(null)
    setMembership(null)
    setDebtBalance(0)
  }, [])

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
        if (result.data.client) {
          const debtResult = await window.electronAPI.client.getDebt(result.data.client.id)
          if (debtResult.success && debtResult.data) {
            const totalBalance = debtResult.data.reduce((sum, d) => sum + d.balance, 0)
            setDebtBalance(totalBalance)
          }
        }
        await window.electronAPI.door.open()
      } else {
        setAccessState('denied')
      }
    }
  }, [accessCode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Escape' || e.key === 'Clear') {
        handleClear()
      } else if (e.key === 'Enter') {
        validateAccess()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDigit, handleBackspace, handleClear, validateAccess])

  const handleManualOpen = async () => {
    await window.electronAPI.door.open()
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100%',
      minHeight: 600,
      gap: 32
    }}>
       <div style={{ textAlign: 'center' }}>
         <h1 style={{ 
           fontSize: 32, 
           fontWeight: 800, 
           marginBottom: 8,
           color: 'var(--color-primary-container)'
         }}>
           CONTROL DE ACCESO
         </h1>
         <p style={{ color: 'var(--color-secondary)', fontSize: 16 }}>
           Ingrese su código de acceso (1-20 dígitos)
         </p>
       </div>

       {accessState === 'idle' || accessState === 'checking' ? (
         <>
           <CodeDisplay
             code={accessCode}
             placeholder="Ingrese su código"
           />

           {accessState === 'checking' && (
             <div style={{ 
               display: 'flex', 
               alignItems: 'center', 
               gap: 12,
               color: 'var(--color-primary-container)',
               fontSize: 16,
               fontWeight: 600
             }}>
               <div style={{ 
                 width: 24, 
                 height: 24, 
                 border: '3px solid var(--color-surface-container-highest)',
                 borderTopColor: 'var(--color-primary-container)',
                 borderRadius: '50%',
                 animation: 'spin 1s linear infinite'
               }} />
               <span>Validando acceso...</span>
             </div>
           )}

          <AccessNumpad
            onDigit={handleDigit}
            onClear={handleClear}
            onBackspace={handleBackspace}
            onEnter={validateAccess}
            disabled={accessState === 'checking'}
          />

           <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                className="btn btn-secondary btn-lg"
                onClick={handleManualOpen}
              >
                <Icons.Door />
                Abrir Puerta Manualmente
              </button>
              <button 
                className="btn btn-secondary btn-lg"
                onClick={handleClear}
              >
                <Icons.X />
                Limpiar
              </button>
            </div>
         </>
       ) : accessState === 'granted' && client ? (
        <AccessGrantedView
          client={client}
          membership={membership || undefined}
          debtBalance={debtBalance}
          onReset={handleClear}
        />
      ) : accessState === 'denied' && validationResult ? (
        <AccessDeniedView
          result={validationResult}
          client={client || undefined}
          onReset={handleClear}
        />
      ) : null}

       <style>{`
         @keyframes spin {
           from { transform: rotate(0deg); }
           to { transform: rotate(360deg); }
         }
         @keyframes blink {
           0%, 100% { opacity: 1; }
           50% { opacity: 0; }
         }
       `}</style>
    </div>
  )
}
