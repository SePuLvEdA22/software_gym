import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'

export function SettingsPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [kioskOpen, setKioskOpen] = useState(false)
  const [doorConfig, setDoorConfig] = useState({
    openDuration: 5000,
    mockMode: true,
    portName: 'COM3',
    baudRate: 9600
  })

  const [whatsappConfig, setWhatsappConfig] = useState({
    enabled: false,
    provider: 'mock' as 'mock' | 'twilio' | 'evolution_api' | 'custom',
    apiUrl: '',
    apiKey: '',
    instanceId: '',
    reminders: {
      threeDays: true,
      oneDay: true,
      sameDay: true
    }
  })

  const [adminUser, setAdminUser] = useState({
    username: 'admin',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [saveSuccess, setSaveSuccess] = useState(false)

  const checkKioskStatus = async () => {
    try {
      const apiExists = typeof window !== 'undefined' && 'electronAPI' in window && window.electronAPI !== undefined
      if (!apiExists) {
        console.warn('[SettingsPage] electronAPI not available in checkKioskStatus')
        return
      }
      const result = await window.electronAPI.window.getKioskStatus()
      if (result.success && result.data) {
        setKioskOpen(result.data.isOpen)
      }
    } catch (e) {
      console.error('[SettingsPage] Error checking kiosk status:', e)
    }
  }

  const handleOpenKiosk = async () => {
    console.log('[SettingsPage] handleOpenKiosk called')
    console.log('[SettingsPage] window:', window)
    console.log('[SettingsPage] electronAPI exists?', 'electronAPI' in window)
    
    try {
      const isElectron = typeof window !== 'undefined' && 
                         'electronAPI' in window && 
                         window.electronAPI !== undefined &&
                         typeof window.electronAPI.window === 'object'
      
      console.log('[SettingsPage] isElectron:', isElectron)
      
      if (!isElectron) {
        let debugInfo = ''
        debugInfo += `typeof window: ${typeof window}\n`
        debugInfo += `'electronAPI' in window: ${'electronAPI' in window}\n`
        if ('electronAPI' in window) {
          debugInfo += `window.electronAPI: ${window.electronAPI}\n`
          debugInfo += `typeof window.electronAPI: ${typeof window.electronAPI}\n`
          if (window.electronAPI) {
            debugInfo += `window.electronAPI keys: ${Object.keys(window.electronAPI)}\n`
          }
        }
        console.log('[SettingsPage] Debug info:', debugInfo)
        
         alert(
           '⚠️ CONTEXTO INVALIDO\n\n' +
           'Esta funcionalidad solo funciona dentro de la ventana de Electron.\n\n' +
           'COMO SABER SI ESTAS EN ELECTRON:\n' +
           '- La ventana debería tener título "BodyFitGym - Panel Administrativo"\n' +
           '- No deberías ver la barra de URL del navegador\n\n' +
           'Si estas viendo esto en Chrome/Edge/Firefox:\n' +
           '1. Cierra esta pestaña\n' +
           '2. Mira la TERMINAL donde ejecutaste npm run dev\n' +
           '3. Electron abrió una ventana NUEVA - usa esa.\n\n' +
           `[Debug Info]\n${debugInfo}`
         )
        return
      }
      
      console.log('[SettingsPage] Calling openKiosk...')
      const result = await window.electronAPI.window.openKiosk()
      console.log('[SettingsPage] openKiosk result:', result)
      
      if (result.success) {
        setKioskOpen(true)
         alert(
           '✅ KIOSCO ABIERTO!\n\n' +
           'Si tienes 2 MONITORES:\n' +
           '  → Mira el segundo monitor (deberia estar en pantalla completa)\n\n' +
           'Si tienes 1 MONITOR:\n' +
           '  → Busca la ventana nueva con título "BodyFitGym Kiosco"\n\n' +
           'Para volver al panel admin:\n' +
           '  → Presiona la tecla "A" en el kiosco para mostrar el botón de admin'
         )
       } else {
         showToast('error', result.error || 'No se pudo abrir el kiosco. Mira la terminal para detalles.', 'Error')
       }
    } catch (error: any) {
      console.error('[SettingsPage] Exception in handleOpenKiosk:', error)
      console.error('[SettingsPage] error.message:', error?.message)
      console.error('[SettingsPage] error.stack:', error?.stack)
      
      let errorMsg = 'Error inesperado'
      if (error?.message) errorMsg = error.message
      if (error?.code) errorMsg = `${errorMsg} (code: ${error.code})`
      
      alert(
        `❌ EXCEPCION CAPTURADA\n\n` +
        `Mensaje: ${errorMsg}\n\n` +
        `Asegurate de:\n` +
        `1. Estar usando la ventana de Electron (no el navegador)\n` +
        `2. Tener npm run dev ejecutandose\n\n` +
        `Mira la TERMINAL para logs completos.`
      )
    }
  }

  const handleCloseKiosk = async () => {
    const result = await window.electronAPI.window.closeKiosk()
    if (result.success) {
      setKioskOpen(false)
    }
  }

  useEffect(() => {
    checkKioskStatus()
  }, [])

  const handleSaveDoor = () => {
    showToast('success', 'Configuración de puerta guardada correctamente', 'Guardado')
  }

  const handleSaveWhatsapp = () => {
    showToast('success', 'Configuración de WhatsApp guardada correctamente', 'Guardado')
  }

  const handleSaveAdmin = () => {
    if (adminUser.newPassword && adminUser.newPassword !== adminUser.confirmPassword) {
      showToast('warning', 'Las contraseñas no coinciden', 'Verificación')
      return
    }
    showToast('success', 'Configuración de administrador guardada correctamente', 'Guardado')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Door />
            Pantalla Kiosco
          </h3>
        </div>
        <div className="card-body">
          <div className="alert alert-warning">
            <Icons.Calendar />
            <div>
              <span style={{ fontWeight: 600 }}>Sistema de Dos Pantallas:</span>
              <span style={{ marginLeft: 8, color: 'var(--color-secondary)', fontSize: 13 }}>
                El kiosco se abre en una ventana SEPARADA, ideal para un segundo monitor en la puerta del gimnasio.
              </span>
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: 24,
            marginTop: 24
          }}>
            <div className="kpi-card" style={{ 
              borderColor: kioskOpen ? 'var(--color-success)' : 'var(--color-surface-container-highest)',
              background: kioskOpen 
                ? 'linear-gradient(135deg, rgba(74, 222, 128, 0.1) 0%, transparent 100%)' 
                : 'var(--color-surface-container)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p className="kpi-label">Estado del Kiosco</p>
                  <p style={{ 
                    fontSize: 20, 
                    fontWeight: 700,
                    color: kioskOpen ? '#4ade80' : 'var(--color-secondary)'
                  }}>
                    {kioskOpen ? 'ACTIVO' : 'INACTIVO'}
                  </p>
                </div>
                <div style={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: '50%',
                  backgroundColor: kioskOpen ? '#4ade80' : 'var(--color-surface-container-highest)',
                  boxShadow: kioskOpen ? '0 0 20px rgba(74, 222, 128, 0.4)' : 'none'
                }} />
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 12,
              justifyContent: 'center'
            }}>
              {!kioskOpen ? (
                <button 
                  className="btn btn-primary btn-lg"
                  onClick={handleOpenKiosk}
                  style={{ justifyContent: 'center' }}
                >
                  <Icons.Door />
                  Abrir Pantalla Kiosco
                </button>
              ) : (
                <button 
                  className="btn btn-danger btn-lg"
                  onClick={handleCloseKiosk}
                  style={{ justifyContent: 'center' }}
                >
                  <Icons.X />
                  Cerrar Pantalla Kiosco
                </button>
              )}
            </div>
          </div>

          <div className="divider" />

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: 24
          }}>
            <div className="alert" style={{ 
              backgroundColor: 'rgba(255, 107, 0, 0.08)',
              borderColor: 'rgba(255, 107, 0, 0.3)'
            }}>
              <Icons.User />
              <div style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary-container)' }}>Monitor 1:</span>
                <span style={{ marginLeft: 6, color: 'var(--color-on-surface)' }}>Panel Administrativo (Recepción)</span>
              </div>
            </div>
            
            <div className="alert" style={{ 
              backgroundColor: 'rgba(74, 222, 128, 0.08)',
              borderColor: 'rgba(74, 222, 128, 0.3)'
            }}>
              <Icons.Door />
              <div style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#4ade80' }}>Monitor 2:</span>
                <span style={{ marginLeft: 6, color: 'var(--color-on-surface)' }}>Pantalla Kiosco (Puerta/Entrada)</span>
              </div>
            </div>
          </div>

          <div style={{ 
            marginTop: 20, 
            padding: 16, 
            backgroundColor: 'var(--color-surface-container-low)',
            borderRadius: 12
          }}>
            <h4 style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
              CONFIGURACIÓN DE INICIO AUTOMÁTICO
            </h4>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', lineHeight: 1.6 }}>
              Para configurar qué modo abre al iniciar la aplicación, usa la variable de entorno <code style={{ 
                backgroundColor: 'var(--color-surface-container-highest)',
                padding: '2px 8px',
                borderRadius: 4,
                fontFamily: 'monospace'
              }}>GYM_MODE</code>:
            </p>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 8, 
              marginTop: 12,
              fontFamily: 'monospace',
              fontSize: 13
            }}>
              <div style={{ padding: 8, backgroundColor: 'var(--color-surface-container-high)', borderRadius: 6 }}>
                <code>GYM_MODE=both</code> → Admin + Kiosco (default)
              </div>
              <div style={{ padding: 8, backgroundColor: 'var(--color-surface-container-high)', borderRadius: 6 }}>
                <code>GYM_MODE=admin</code> → Solo Admin
              </div>
              <div style={{ padding: 8, backgroundColor: 'var(--color-surface-container-high)', borderRadius: 6 }}>
                <code>GYM_MODE=kiosk</code> → Solo Kiosco
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Door />
            Control de Puerta
          </h3>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Duración de apertura (ms)</label>
              <input 
                type="number" 
                className="form-input"
                value={doorConfig.openDuration}
                onChange={(e) => setDoorConfig(prev => ({ ...prev, openDuration: Number(e.target.value) }))}
              />
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
                Tiempo que la puerta permanece abierta
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Modo Simulación</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    checked={doorConfig.mockMode}
                    onChange={() => setDoorConfig(prev => ({ ...prev, mockMode: true }))}
                  />
                  <span>Activado</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    checked={!doorConfig.mockMode}
                    onChange={() => setDoorConfig(prev => ({ ...prev, mockMode: false }))}
                  />
                  <span>Hardware Real</span>
                </label>
              </div>
            </div>
          </div>

          {!doorConfig.mockMode && (
            <>
              <div className="divider" />
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Puerto Serial</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={doorConfig.portName}
                    onChange={(e) => setDoorConfig(prev => ({ ...prev, portName: e.target.value }))}
                    placeholder="COM3, /dev/ttyUSB0, etc."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Velocidad (Baud Rate)</label>
                  <select 
                    className="form-select"
                    value={doorConfig.baudRate}
                    onChange={(e) => setDoorConfig(prev => ({ ...prev, baudRate: Number(e.target.value) }))}
                  >
                    <option value={9600}>9600</option>
                    <option value={19200}>19200</option>
                    <option value={38400}>38400</option>
                    <option value={57600}>57600</option>
                    <option value={115200}>115200</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: 24 }}>
            <button className="btn btn-primary" onClick={handleSaveDoor}>
              <Icons.Check />
              Guardar Configuración
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Bell />
            Notificaciones WhatsApp
          </h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0' }}>
              <input 
                type="checkbox" 
                checked={whatsappConfig.enabled}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              <span style={{ fontWeight: 500 }}>Habilitar notificaciones por WhatsApp</span>
            </label>
          </div>

              {whatsappConfig.enabled && (
                <>
                  <div className="divider" />
                  <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Proveedor</label>
                  <select 
                    className="form-select"
                    value={whatsappConfig.provider}
                    onChange={(e) => setWhatsappConfig(prev => ({ 
                      ...prev, 
                      provider: e.target.value as 'mock' | 'twilio' | 'evolution_api' | 'custom'
                    }))}
                  >
                    <option value="mock">Modo Simulación</option>
                    <option value="evolution_api">Evolution API</option>
                    <option value="twilio">Twilio</option>
                    <option value="custom">API Personalizada</option>
                  </select>
                </div>
              </div>

              {whatsappConfig.provider !== 'mock' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">URL de la API</label>
                      <input 
                        type="text" 
                        className="form-input"
                        value={whatsappConfig.apiUrl}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                        placeholder="https://api.example.com"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">API Key / Token</label>
                      <input 
                        type="password" 
                        className="form-input"
                        value={whatsappConfig.apiKey}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder="*************"
                      />
                    </div>
                  </div>
                  {whatsappConfig.provider === 'evolution_api' && (
                    <div className="form-group">
                      <label className="form-label">Instance ID</label>
                      <input 
                        type="text" 
                        className="form-input"
                        value={whatsappConfig.instanceId}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, instanceId: e.target.value }))}
                        placeholder="ID de instancia"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="divider" />
              <h4 style={{ marginBottom: 20 }}>Recordatorios Automáticos</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={whatsappConfig.reminders.threeDays}
                    onChange={(e) => setWhatsappConfig(prev => ({ 
                      ...prev, 
                      reminders: { ...prev.reminders, threeDays: e.target.checked }
                    }))}
                  />
                  <span>3 días antes del vencimiento</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={whatsappConfig.reminders.oneDay}
                    onChange={(e) => setWhatsappConfig(prev => ({ 
                      ...prev, 
                      reminders: { ...prev.reminders, oneDay: e.target.checked }
                    }))}
                  />
                  <span>1 día antes del vencimiento</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={whatsappConfig.reminders.sameDay}
                    onChange={(e) => setWhatsappConfig(prev => ({ 
                      ...prev, 
                      reminders: { ...prev.reminders, sameDay: e.target.checked }
                    }))}
                  />
                  <span>El mismo día del vencimiento</span>
                </label>
              </div>
            </>
          )}

          <div style={{ marginTop: 24 }}>
            <button className="btn btn-primary" onClick={handleSaveWhatsapp}>
              <Icons.Check />
              Guardar Configuración
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.User />
            Usuario Administrador
          </h3>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre de Usuario</label>
              <input 
                type="text" 
                className="form-input"
                value={adminUser.username}
                onChange={(e) => setAdminUser(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
          </div>

          <div className="divider" />
          <h4 style={{ marginBottom: 20 }}>Cambiar Contraseña</h4>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Contraseña Actual</label>
              <input 
                type="password" 
                className="form-input"
                value={adminUser.currentPassword}
                onChange={(e) => setAdminUser(prev => ({ ...prev, currentPassword: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nueva Contraseña</label>
              <input 
                type="password" 
                className="form-input"
                value={adminUser.newPassword}
                onChange={(e) => setAdminUser(prev => ({ ...prev, newPassword: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar Contraseña</label>
              <input 
                type="password" 
                className="form-input"
                value={adminUser.confirmPassword}
                onChange={(e) => setAdminUser(prev => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button className="btn btn-primary" onClick={handleSaveAdmin}>
              <Icons.Check />
              Actualizar Usuario
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
