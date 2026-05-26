import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { MembershipPlan, MembershipType } from '../../../shared/types'

export function SettingsPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [kioskOpen, setKioskOpen] = useState(false)
  const [doorConfig, setDoorConfig] = useState({
    connectionType: 'mock' as 'mock' | 'http' | 'serial',
    openDuration: 5000,
    httpUrl: '',
    httpMethod: 'GET' as 'GET' | 'POST',
    httpHeaders: '',
    httpBody: '',
    portName: 'COM3',
    baudRate: 9600,
    serialCommand: ''
  })

  const [whatsappConfig, setWhatsappConfig] = useState({
    enabled: false,
    provider: 'mock' as 'mock' | 'twilio' | 'evolution_api' | 'custom' | 'whatsapp_cloud',
    phoneNumberId: '',
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

  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null)
  const [planForm, setPlanForm] = useState({ name: '', type: 'monthly' as MembershipType, price: 0, durationDays: 30, description: '' })
  const [autoStart, setAutoStart] = useState(false)

  const handlePlanFormChange = (field: string, value: string | number) => {
    setPlanForm(prev => ({ ...prev, [field]: value }))
  }

  const openNewPlan = () => {
    setEditingPlan(null)
    setPlanForm({ name: '', type: 'monthly', price: 0, durationDays: 30, description: '' })
    setShowPlanModal(true)
  }

  const openEditPlan = (plan: MembershipPlan) => {
    setEditingPlan(plan)
    setPlanForm({ name: plan.name, type: plan.type, price: plan.price, durationDays: plan.durationDays, description: plan.description })
    setShowPlanModal(true)
  }

  const savePlan = async () => {
    if (!planForm.name || planForm.price <= 0 || planForm.durationDays <= 0) {
      showToast('warning', 'Completa todos los campos obligatorios', 'Validación')
      return
    }
    try {
      if (editingPlan) {
        const result = await window.electronAPI.plans.update(editingPlan.id, {
          name: planForm.name,
          type: planForm.type,
          price: planForm.price,
          durationDays: planForm.durationDays,
          description: planForm.description
        })
        if (result.success) {
          showToast('success', 'Plan actualizado correctamente', 'Guardado')
        }
      } else {
        const result = await window.electronAPI.plans.create(planForm)
        if (result.success) {
          showToast('success', 'Plan creado correctamente', 'Guardado')
        }
      }
      setShowPlanModal(false)
      loadPlans()
    } catch (e: any) {
      showToast('error', e.message || 'Error al guardar plan', 'Error')
    }
  }

  const deletePlan = async (id: string) => {
    if (!confirm('¿Eliminar este plan? Los clientes con este plan no se verán afectados.')) return
    try {
      const result = await window.electronAPI.plans.delete(id)
      if (result.success) {
        showToast('success', 'Plan eliminado', 'Eliminado')
        loadPlans()
      }
    } catch (e: any) {
      showToast('error', e.message || 'Error al eliminar plan', 'Error')
    }
  }

  const togglePlanActive = async (plan: MembershipPlan) => {
    try {
      await window.electronAPI.plans.update(plan.id, { isActive: !plan.isActive })
      loadPlans()
    } catch (e: any) {
      showToast('error', e.message || 'Error al cambiar estado', 'Error')
    }
  }

  const loadPlans = async () => {
    try {
      const result = await window.electronAPI.plans.getAll(false)
      if (result.success && result.data) setPlans(result.data as MembershipPlan[])
    } catch (e) { /* ignore */ }
  }

  const loadWhatsAppConfig = async () => {
    try {
      if (window.electronAPI?.whatsapp?.getConfig) {
        const result = await window.electronAPI.whatsapp.getConfig()
        if (result.success && result.data) {
          setWhatsappConfig(prev => ({ ...prev, ...result.data }))
        }
      }
    } catch (e) { /* ignore */ }
  }

  const loadAutoStart = async () => {
    try {
      if (window.electronAPI?.system) {
        const result = await (window.electronAPI as any).system.getAutoStart()
        if (result.success) setAutoStart(result.data)
      }
    } catch (e) { /* ignore */ }
  }

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
    loadDoorConfig()
    loadPlans()
    loadWhatsAppConfig()
    loadAutoStart()
  }, [])

  const loadDoorConfig = async () => {
    try {
      if (window.electronAPI?.door?.getConfig) {
        const result = await window.electronAPI.door.getConfig()
        if (result.success && result.data) {
          setDoorConfig(result.data)
        }
      }
    } catch (e) {
      console.error('[SettingsPage] Error loading door config:', e)
    }
  }

  const handleSaveDoor = async () => {
    try {
      if (window.electronAPI?.door?.saveConfig) {
        const result = await window.electronAPI.door.saveConfig(doorConfig)
        if (result.success) {
          showToast('success', 'Configuración de puerta guardada correctamente', 'Guardado')
        } else {
          showToast('error', result.error || 'Error al guardar configuración', 'Error')
        }
      } else {
        showToast('success', 'Configuración de puerta guardada correctamente (sin Electron)', 'Guardado')
      }
    } catch (e: any) {
      showToast('error', e.message || 'Error al guardar', 'Error')
    }
  }

  const handleTestConnection = async () => {
    try {
      if (window.electronAPI?.door?.testConnection) {
        const result = await window.electronAPI.door.testConnection()
        if (result.success && result.data) {
          showToast('success', 'Conexión exitosa! La puerta debería abrirse.', 'Prueba OK')
        } else {
          showToast('error', 'Error de conexión. Revisa la configuración.', 'Prueba Fallida')
        }
      }
    } catch (e: any) {
      showToast('error', e.message || 'Error al probar conexión', 'Error')
    }
  }

  const handleSaveWhatsapp = async () => {
    try {
      if (window.electronAPI?.whatsapp?.saveConfig) {
        const result = await window.electronAPI.whatsapp.saveConfig(whatsappConfig)
        if (result.success) {
          showToast('success', 'Configuración de WhatsApp guardada correctamente', 'Guardado')
        } else {
          showToast('error', result.error || 'Error al guardar', 'Error')
        }
      } else {
        showToast('success', 'Configuración de WhatsApp guardada (sin Electron)', 'Guardado')
      }
    } catch (e: any) {
      showToast('error', e.message || 'Error al guardar', 'Error')
    }
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
          <div className="form-group">
            <label className="form-label">Tipo de Conexión</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {([
                { value: 'mock', label: 'Simulación', desc: 'Sin hardware real' },
                { value: 'http', label: 'HTTP/HTTPS', desc: 'Relay TCP/IP o ZKTeco' },
                { value: 'serial', label: 'Puerto Serie', desc: 'RS232 / RS485 / USB' }
              ] as const).map(opt => (
                <label key={opt.value} className="card" style={{
                  flex: 1, minWidth: 180, cursor: 'pointer', padding: 16,
                  display: 'flex', flexDirection: 'column', gap: 4,
                  borderColor: doorConfig.connectionType === opt.value
                    ? 'var(--color-primary-container)' : 'var(--color-surface-container-high)',
                  background: doorConfig.connectionType === opt.value
                    ? 'rgba(255, 107, 0, 0.08)' : 'transparent'
                }}>
                  <input
                    type="radio" name="connType"
                    checked={doorConfig.connectionType === opt.value}
                    onChange={() => setDoorConfig(prev => ({ ...prev, connectionType: opt.value }))}
                    style={{ marginBottom: 4 }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{opt.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>

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
          </div>

          <div className="divider" />

          {doorConfig.connectionType === 'http' && (
            <>
              <div className="form-group">
                <label className="form-label">URL del Relay</label>
                <input
                  type="text"
                  className="form-input"
                  value={doorConfig.httpUrl}
                  onChange={(e) => setDoorConfig(prev => ({ ...prev, httpUrl: e.target.value }))}
                  placeholder="http://192.168.1.100/relay/on o https://zkteco-ip:1443/api/..."
                />
                <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
                  URL que activa el relay. Para ZKTeco usa la IP del dispositivo
                </p>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Método HTTP</label>
                  <select
                    className="form-select"
                    value={doorConfig.httpMethod}
                    onChange={(e) => setDoorConfig(prev => ({ ...prev, httpMethod: e.target.value as 'GET' | 'POST' }))}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Headers (opcional, uno por línea)</label>
                <textarea
                  className="form-textarea"
                  value={doorConfig.httpHeaders}
                  onChange={(e) => setDoorConfig(prev => ({ ...prev, httpHeaders: e.target.value }))}
                  placeholder="Authorization: Bearer token&#10;Content-Type: application/json"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Body (opcional, para POST)</label>
                <textarea
                  className="form-textarea"
                  value={doorConfig.httpBody}
                  onChange={(e) => setDoorConfig(prev => ({ ...prev, httpBody: e.target.value }))}
                  placeholder='{"command": "unlock"}'
                  rows={2}
                />
              </div>
            </>
          )}

          {doorConfig.connectionType === 'serial' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Puerto Serie</label>
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
              <div className="form-group">
                <label className="form-label">Comando Serial</label>
                <input
                  type="text"
                  className="form-input"
                  value={doorConfig.serialCommand}
                  onChange={(e) => setDoorConfig(prev => ({ ...prev, serialCommand: e.target.value }))}
                  placeholder="1"
                />
                <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
                  Dato a enviar por el puerto serie para activar el relay
                </p>
              </div>
            </>
          )}

          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={handleSaveDoor}>
              <Icons.Check />
              Guardar Configuración
            </button>
            {doorConfig.connectionType !== 'mock' && (
              <button className="btn btn-secondary" onClick={handleTestConnection}>
                Probar Conexión
              </button>
            )}
          </div>

          <div className="divider" />
          <div className="alert alert-warning" style={{ marginTop: 8 }}>
            <Icons.Bell />
            <div style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>¿No sabes cómo conectar?</span>
              <span style={{ marginLeft: 8, color: 'var(--color-secondary)' }}>
                Usa el modo Simulación mientras investigas. Para ZKTeco: conecta vía TCP/IP (HTTP) o por puerto serie.
              </span>
            </div>
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
                        provider: e.target.value as any
                      }))}
                    >
                      <option value="mock">Modo Simulación</option>
                      <option value="whatsapp_cloud">WhatsApp Cloud API (Meta)</option>
                      <option value="evolution_api">Evolution API</option>
                      <option value="twilio">Twilio</option>
                      <option value="custom">API Personalizada</option>
                    </select>
                </div>
              </div>

              {whatsappConfig.provider !== 'mock' && (
                <>
                  {whatsappConfig.provider === 'whatsapp_cloud' && (
                    <div className="form-group">
                      <label className="form-label">Phone Number ID</label>
                      <input 
                        type="text" 
                        className="form-input"
                        value={whatsappConfig.phoneNumberId}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                        placeholder="ID numérico del número en Meta Business"
                      />
                    </div>
                  )}
                  <div className="form-row">
                    {whatsappConfig.provider !== 'whatsapp_cloud' && (
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
                    )}
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

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Membership />
            Planes de Membresía
          </h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={openNewPlan}>
              <Icons.Plus />
              Nuevo Plan
            </button>
          </div>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Precio</th>
                <th>Duración</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id}>
                  <td style={{ fontWeight: 600 }}>{plan.name}</td>
                  <td>{plan.type}</td>
                  <td>${plan.price.toLocaleString('es-CO')}</td>
                  <td>{plan.durationDays} días</td>
                  <td>
                    <span className={`badge ${plan.isActive ? 'badge-success' : 'badge-default'}`}>
                      {plan.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEditPlan(plan)}>
                        <Icons.Edit />
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => togglePlanActive(plan)}>
                        {plan.isActive ? <Icons.X /> : <Icons.Check />}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => deletePlan(plan.id)}>
                        <Icons.Trash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-secondary)', padding: 24 }}>No hay planes registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPlanModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: 480, maxHeight: '90vh', overflow: 'auto' }}>
            <div className="card-header">
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>
                {editingPlan ? 'Editar Plan' : 'Nuevo Plan'}
              </h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={planForm.name}
                  onChange={e => handlePlanFormChange('name', e.target.value)}
                  placeholder="Ej: Mensual Premium" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-select" value={planForm.type}
                    onChange={e => handlePlanFormChange('type', e.target.value)}>
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">15 Días</option>
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="semiannual">Semestral</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duración (días) *</label>
                  <input type="number" className="form-input" value={planForm.durationDays}
                    onChange={e => handlePlanFormChange('durationDays', Number(e.target.value))} min={1} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Precio *</label>
                <input type="number" className="form-input" value={planForm.price}
                  onChange={e => handlePlanFormChange('price', Number(e.target.value))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea className="form-textarea" value={planForm.description}
                  onChange={e => handlePlanFormChange('description', e.target.value)} rows={2} />
              </div>
              <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowPlanModal(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={savePlan}>
                  <Icons.Check />
                  {editingPlan ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Settings />
            Sistema
          </h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0' }}>
              <input type="checkbox" checked={autoStart}
                onChange={async (e) => {
                  const enabled = e.target.checked
                  setAutoStart(enabled)
                  if (window.electronAPI?.system) {
                    await (window.electronAPI as any).system.setAutoStart(enabled)
                  }
                }} />
              <span style={{ fontWeight: 500 }}>Iniciar automáticamente con Windows</span>
            </label>
            <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4, marginLeft: 28 }}>
              La app se abrirá sola cuando enciendas la PC del gimnasio
            </p>
          </div>

          <div className="divider" />

          <h4 style={{ marginBottom: 16 }}>Copia de Seguridad</h4>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={async () => {
              if (window.electronAPI?.system?.backupDb) {
                const result = await window.electronAPI.system.backupDb()
                if (result.success) {
                  showToast('success', `Backup guardado en: ${result.data}`, 'Backup Exitoso')
                } else if (result.error !== 'Cancelado') {
                  showToast('error', result.error || 'Error al hacer backup', 'Error')
                }
              }
            }}>
              <Icons.Download />
              Respaldar Base de Datos
            </button>
            <button className="btn btn-secondary" onClick={async () => {
              if (window.electronAPI?.system?.restoreDb) {
                const ok = confirm('¿Restaurar base de datos? Se perderán los cambios no respaldados.')
                if (!ok) return
                const result = await window.electronAPI.system.restoreDb()
                if (result.success) {
                  showToast('success', 'Base de datos restaurada. Reinicia la app.', 'Restauración Exitosa')
                } else if (result.error !== 'Cancelado') {
                  showToast('error', result.error || 'Error al restaurar', 'Error')
                }
              }
            }}>
              <Icons.Upload />
              Restaurar Base de Datos
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 8 }}>
            La base de datos contiene clientes, membresías, pagos, accesos y configuración.
          </p>
        </div>
      </div>
    </div>
  )
}
