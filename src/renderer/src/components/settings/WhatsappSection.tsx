import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { toErrorMessage } from '../../../../shared/errors'

export function WhatsappSection(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [whatsappConfig, setWhatsappConfig] = useState({
    enabled: false,
    provider: 'mock' as 'mock' | 'twilio' | 'evolution_api' | 'custom' | 'whatsapp_cloud',
    phoneNumberId: '',
    apiUrl: '',
    apiKey: '',
    instanceId: '',
    checkIntervalHours: 6,
    reminders: {
      threeDays: true,
      oneDay: true,
      sameDay: true
    }
  })

  const loadWhatsAppConfig = async () => {
    try {
      if (window.electronAPI?.whatsapp?.getConfig) {
        const result = await window.electronAPI.whatsapp.getConfig()
        if (result.success && result.data) {
          // Sanitizar: providers no implementados (twilio/custom guardados en
          // versiones anteriores) se reasignan a mock para no romper el dropdown.
          const unsupported = ['twilio', 'custom']
          const provider = unsupported.includes(result.data.provider) ? 'mock' : result.data.provider
          setWhatsappConfig(prev => ({ ...prev, ...result.data, provider }))
        }
      }
    } catch (e) { console.error('Error loading WhatsApp config:', e) }
  }

  const handleSaveWhatsapp = async () => {
    try {
      if (window.electronAPI?.whatsapp?.saveConfig) {
        const result = await window.electronAPI.whatsapp.saveConfig(whatsappConfig)
        if (result.success) {
          showToast('success', 'Configuración de WhatsApp guardada correctamente', 'Guardado')
          // Reiniciar el intervalo de recordatorios para reflejar los cambios
          if (window.electronAPI?.system?.restartReminderInterval) {
            await window.electronAPI.system.restartReminderInterval()
          }
        } else {
          showToast('error', result.error || 'Error al guardar', 'Error')
        }
      } else {
        showToast('success', 'Configuración de WhatsApp guardada (sin Electron)', 'Guardado')
      }
    } catch (e) {
      showToast('error', toErrorMessage(e, 'Error al guardar'), 'Error')
    }
  }

  useEffect(() => {
    // Carga inicial asíncrona desde IPC (patrón igual al resto de secciones)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWhatsAppConfig()
  }, [])

  return (
    <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
      <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
        <h2 className="headline-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icons.Bell />
          Notificaciones WhatsApp
        </h2>
        <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
          Envíe recordatorios y alertas automáticas a los miembros vía WhatsApp
        </p>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0' }}>
            <input 
              type="checkbox" 
              checked={whatsappConfig.enabled}
              onChange={(e) => setWhatsappConfig(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            <span style={{ fontWeight: 500 }}>Activar notificaciones WhatsApp</span>
          </label>
        </div>

        {whatsappConfig.enabled && (
          <>
            <div style={{ margin: '20px 0', borderTop: '1px solid var(--color-border)', opacity: 0.3 }} />
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Proveedor</label>
                <select 
                  className="form-select"
                  value={whatsappConfig.provider}
                  onChange={(e) => setWhatsappConfig(prev => ({ 
                    ...prev, 
                    provider: e.target.value as 'mock' | 'twilio' | 'evolution_api' | 'custom' | 'whatsapp_cloud'
                  }))}
                >
                  <option value="mock">Modo Simulación</option>
                  <option value="evolution_api">Evolution API (recomendado)</option>
                  <option value="whatsapp_cloud">WhatsApp Cloud API (Meta)</option>
                  {/* Twilio y API personalizada no están implementados: eliminados para evitar envíos falsos */}
                </select>
              </div>
            </div>

            {whatsappConfig.provider !== 'mock' && (
              <>
                {whatsappConfig.provider === 'whatsapp_cloud' && (
                  <div className="form-group">
                    <label className="form-label">ID del Número de Teléfono
</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={whatsappConfig.phoneNumberId}
                      onChange={(e) => setWhatsappConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                      placeholder="ID numérico de Meta Business"
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
                    <label className="form-label">Clave API / Token</label>
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
                    <label className="form-label">ID de Instancia</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={whatsappConfig.instanceId}
                      onChange={(e) => setWhatsappConfig(prev => ({ ...prev, instanceId: e.target.value }))}
                      placeholder="ID de Instancia"
                    />
                  </div>
                )}
              </>
            )}

            <div style={{ margin: '20px 0', borderTop: '1px solid var(--color-border)', opacity: 0.3 }} />
            <h3 className="headline-md" style={{ fontSize: 16, marginBottom: 20 }}>Recordatorios Automáticos</h3>
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
            <div style={{ marginTop: 16 }}>
              <label className="form-label">Intervalo de revisión (horas)</label>
              <input
                type="number"
                className="form-input"
                value={whatsappConfig.checkIntervalHours}                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, checkIntervalHours: Math.max(1, Number(e.target.value.replace(/^0+(?=\d)/, ''))) }))}
                min={1}
                max={168}
                style={{ width: 120 }}
              />
              <small style={{ display: 'block', color: 'var(--color-secondary)', marginTop: 4 }}>
                Cada cuánto revisar y enviar recordatorios (mín 1, máx 168)
              </small>
            </div>
          </>
        )}

        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={handleSaveWhatsapp}>
            <Icons.Check />
            Guardar Configuración
          </button>
          {whatsappConfig.enabled && (
            <button className="btn btn-secondary" onClick={async () => {
              const phone = prompt('Ingresa el número de teléfono para enviar mensaje de prueba (Ej: 573001234567):')
              if (!phone) return
              if (window.electronAPI?.whatsapp?.sendTestMessage) {
                const result = await window.electronAPI.whatsapp.sendTestMessage(phone)
                if (result.success) {
                  showToast('success', result.data?.message || 'Mensaje de prueba enviado', 'Prueba OK')
                } else {
                  showToast('error', result.data?.message || result.error || 'Error al enviar prueba', 'Error')
                }
              }
            }}>
              <Icons.Bell />
              Enviar Mensaje de Prueba
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
