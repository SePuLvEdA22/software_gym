import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'

export function HardwareSection(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
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

  useEffect(() => {
    loadDoorConfig()
  }, [])

  return (
    <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
      <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
        <h2 className="headline-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icons.Settings />
          Integración de Hardware
        </h2>
        <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
          Configure los dispositivos de hardware conectados para el control de acceso
        </p>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div className="form-group">
          <label className="form-label">Tipo de Conexión</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {([
              { value: 'mock', label: 'Simulación', desc: 'Sin hardware real' },
              { value: 'http', label: 'HTTP/HTTPS', desc: 'Relé TCP/IP o ZKTeco' },
              { value: 'serial', label: 'Puerto Serie', desc: 'RS232 / RS485 / USB' }
            ] as const).map(opt => (
              <label key={opt.value} className="glass-panel" style={{
                flex: 1, minWidth: 180, cursor: 'pointer', padding: 16,
                display: 'flex', flexDirection: 'column', gap: 4,
                border: doorConfig.connectionType === opt.value
                  ? '1px solid var(--color-primary)'
                  : '1px solid var(--color-surface-container-high)',
                background: doorConfig.connectionType === opt.value
                  ? 'rgba(255, 107, 0, 0.08)' : 'transparent'
              }}>
                <input
                  type="radio" name="connTypeHardware"
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
            <label className="form-label">Duración Abierto (ms)</label>
            <input
              type="number"
              className="form-input"
              value={doorConfig.openDuration}
              onChange={(e) => setDoorConfig(prev => ({ ...prev, openDuration: Number(e.target.value.replace(/^0+(?=\d)/, '')) || 0 }))}
            />
            <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
              Cuánto tiempo permanece la puerta abierta
            </p>
          </div>
        </div>

        <div style={{ margin: '20px 0', borderTop: '1px solid var(--color-border)', opacity: 0.3 }} />

        {doorConfig.connectionType === 'http' && (
          <>
            <div className="form-group">
              <label className="form-label">URL del Relé</label>
              <input
                type="text"
                className="form-input"
                value={doorConfig.httpUrl}
                onChange={(e) => setDoorConfig(prev => ({ ...prev, httpUrl: e.target.value }))}
                placeholder="http://192.168.1.100/relay/on or https://zkteco-ip:1443/api/..."
              />
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
              <label className="form-label">Encabezados (opcional)</label>
              <textarea
                className="form-textarea"
                value={doorConfig.httpHeaders}
                onChange={(e) => setDoorConfig(prev => ({ ...prev, httpHeaders: e.target.value }))}
                placeholder="Authorization: Bearer token&#10;Content-Type: application/json"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Cuerpo (opcional, para POST)</label>
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
                <label className="form-label">Velocidad (Baudios)</label>
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
              <label className="form-label">Comando Serie</label>
              <input
                type="text"
                className="form-input"
                value={doorConfig.serialCommand}
                onChange={(e) => setDoorConfig(prev => ({ ...prev, serialCommand: e.target.value }))}
                placeholder="1"
              />
            </div>
          </>
        )}

        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={handleSaveDoor}>
            <Icons.Check />
            Save Configuration
          </button>
          {doorConfig.connectionType !== 'mock' && (
            <button className="btn btn-secondary" onClick={handleTestConnection}>
              Probar Conexión
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
