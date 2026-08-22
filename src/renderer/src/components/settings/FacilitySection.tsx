import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { GymSettingsForm } from './GymSettingsForm'

export function FacilitySection(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const confirm = useAppStore((state) => state.confirm)
  const [kioskOpen, setKioskOpen] = useState(false)

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
    try {
      const isElectron = typeof window !== 'undefined' && 
                         'electronAPI' in window && 
                         window.electronAPI !== undefined &&
                         typeof window.electronAPI.window === 'object'
      
      if (!isElectron) {
        showToast('error', 'Esta funcionalidad solo funciona dentro de la ventana de Electron. Asegúrate de estar usando la ventana nativa, no el navegador.', 'Contexto Inválido')
        return
      }
      
      const result = await window.electronAPI.window.openKiosk()
      
      if (result.success) {
        setKioskOpen(true)
        showToast('success', 
          'Kiosco abierto correctamente. ' +
          (result.data?.alreadyOpen ? 'Ya estaba abierto.' : '') +
          ' Si tienes 2 monitores, mira el segundo. ' +
          'Si tienes 1 monitor, busca la ventana "BodyFitGym Kiosco". ' +
          'Presiona "A" en el kiosco para mostrar el botón de admin.',
          'Kiosco Abierto')
       } else {
         showToast('error', result.error || 'No se pudo abrir el kiosco. Mira la terminal para detalles.', 'Error')
       }
    } catch (error: any) {
      showToast('error', `Error inesperado: ${error?.message || 'desconocido'}. Asegúrate de estar en la ventana de Electron con npm run dev ejecutándose.`, 'Error')
    }
  }

  const handleCloseKiosk = async () => {
    const ok = await confirm({ title: 'Cerrar kiosco', message: '¿Estás seguro de cerrar la ventana del kiosco?', variant: 'warning', confirmLabel: 'Cerrar kiosco' })
    if (!ok) return
    const result = await window.electronAPI.window.closeKiosk()
    if (result.success) {
      setKioskOpen(false)
    }
  }

  useEffect(() => {
    checkKioskStatus()
  }, [])

  return (
    <>
      <div className="card" style={{ border: 'none', background: 'transparent', padding: 0, marginBottom: 32 }}>
        <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
          <h2 className="headline-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Door />
            Pantalla Kiosco
          </h2>
          <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
            Configure el kiosco de check-in para que los miembros accedan por su cuenta
          </p>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="glass-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Icons.Calendar />
            <div>
              <span style={{ fontWeight: 600 }}>Sistema de Doble Pantalla:</span>
              <span style={{ marginLeft: 8, color: 'var(--color-secondary)', fontSize: 13 }}>
                El kiosco se abre en una ventana SEPARADA, ideal para un segundo monitor en la entrada del gimnasio.
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div className="glass-panel" style={{
              padding: 20,
              border: `1px solid ${kioskOpen ? 'var(--color-success)' : 'var(--color-surface-container-highest)'}`,
              background: kioskOpen 
                ? 'linear-gradient(135deg, rgba(74, 222, 128, 0.1) 0%, transparent 100%)' 
                : 'var(--color-surface-container)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p className="metric-card-label" style={{ margin: 0 }}>Estado del Kiosco</p>
                  <p className="metric-card-value" style={{ 
                    fontSize: 24,
                    color: kioskOpen ? 'var(--color-success)' : 'var(--color-secondary)'
                  }}>
                    {kioskOpen ? 'ACTIVO' : 'INACTIVO'}
                  </p>
                </div>
                <div style={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: '50%',
                  backgroundColor: kioskOpen ? 'var(--color-success)' : 'var(--color-surface-container-highest)',
                  boxShadow: kioskOpen ? '0 0 20px rgba(74, 222, 128, 0.4)' : 'none'
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
              {!kioskOpen ? (
                <button className="btn btn-primary btn-lg" onClick={handleOpenKiosk} style={{ justifyContent: 'center' }}>
                  <Icons.Door />
                  Abrir Pantalla Kiosco
                </button>
              ) : (
                <button className="btn btn-danger btn-lg" onClick={handleCloseKiosk} style={{ justifyContent: 'center' }}>
                  <Icons.X />
                  Cerrar Pantalla Kiosco
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="glass-panel" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: 'rgba(255, 107, 0, 0.08)' }}>
              <Icons.User />
              <div><span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Monitor 1:</span> Panel Admin (Recepción)</div>
            </div>
            <div className="glass-panel" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: 'rgba(74, 222, 128, 0.08)' }}>
              <Icons.Door />
              <div><span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Monitor 2:</span> Pantalla Kiosco (Entrada)</div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 20 }}>
            <h4 className="label-md" style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Configuración de Inicio Automático
            </h4>
            <p className="body-lg" style={{ color: 'var(--color-secondary)', lineHeight: 1.6, fontSize: 13 }}>
              Para configurar qué modo se abre al iniciar, use la variable de entorno <code className="chip" style={{ fontFamily: 'monospace', fontSize: 12 }}>GYM_MODE</code>:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, fontFamily: 'monospace', fontSize: 13 }}>
              <div className="glass-panel" style={{ padding: '8px 12px' }}>
                <code>GYM_MODE=both</code> → Admin + Kiosco (por defecto)
              </div>
              <div className="glass-panel" style={{ padding: '8px 12px' }}>
                <code>GYM_MODE=admin</code> → Solo Admin
              </div>
              <div className="glass-panel" style={{ padding: '8px 12px' }}>
                <code>GYM_MODE=kiosk</code> → Solo Kiosco
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
        <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
          <h2 className="headline-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Door />
            Información del Gimnasio
          </h2>
          <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
            Configure el nombre, dirección y mensaje de bienvenida que se muestra en el kiosco
          </p>
        </div>
        <GymSettingsForm />
      </div>
    </>
  )
}
