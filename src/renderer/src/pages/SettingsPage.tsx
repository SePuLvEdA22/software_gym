import { useState, useEffect } from 'react'
import { useFormSaved } from '@/hooks/useFormSaved'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { UpdateChecker } from '@/components/UpdateChecker'
import { MembershipPlan, Promotion, BackupConfig } from '../../../shared/types'

type SettingsSection = 'plans' | 'staff' | 'facility' | 'branding' | 'hardware' | 'whatsapp' | 'system'

const SETTINGS_NAV: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'plans', label: 'Planes de Membresía', icon: <Icons.Membership /> },
  { id: 'staff', label: 'Personal y Roles', icon: <Icons.User /> },
  { id: 'facility', label: 'Info del Gimnasio', icon: <Icons.Door /> },
  { id: 'branding', label: 'Marca y Apariencia', icon: <Icons.Sun /> },
  { id: 'hardware', label: 'Integración de Hardware', icon: <Icons.Settings /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <Icons.Bell /> },
  { id: 'system', label: 'Sistema', icon: <Icons.Shield /> },
]

export function SettingsPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const confirm = useAppStore((state) => state.confirm)
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('plans')
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
    checkIntervalHours: 6,
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
  const [autoStart, setAutoStart] = useState(false)
  const [backupConfig, setBackupConfigState] = useState<BackupConfig>({
    enabled: true,
    retention: 7,
    lastBackupAt: null,
    backupDir: '',
    count: 0
  })

  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState('')
  const [migrationBackupPath, setMigrationBackupPath] = useState<string | null>(null)



  const deletePlan = async (id: string) => {
    const ok = await confirm({ title: 'Eliminar plan', message: '¿Eliminar este plan?', variant: 'danger', confirmLabel: 'Eliminar' })
    if (!ok) return
    try {
      const result = await window.electronAPI.plans.delete(id)
      if (result.success) {
        showToast('success', 'Plan eliminado', 'Eliminado')
        loadPlans()
      } else {
        showToast('error', result.error || 'Error al eliminar plan', 'Error')
      }
    } catch (e: any) {
      showToast('error', e.message || 'Error al eliminar plan', 'Error')
    }
  }

  const togglePlanActive = async (plan: MembershipPlan) => {
    if (!plan.isActive) {
      try {
        await window.electronAPI.plans.update(plan.id, { isActive: true })
        loadPlans()
      } catch (e: any) {
        showToast('error', e.message || 'Error al cambiar estado', 'Error')
      }
      return
    }
    const ok = await confirm({ title: 'Desactivar plan', message: `¿Desactivar el plan "${plan.name}"? Los clientes con este plan no se verán afectados.`, variant: 'warning', confirmLabel: 'Desactivar' })
    if (!ok) return
    try {
      await window.electronAPI.plans.update(plan.id, { isActive: false })
      loadPlans()
    } catch (e: any) {
      showToast('error', e.message || 'Error al cambiar estado', 'Error')
    }
  }



  const deletePromo = async (id: string) => {
    const ok = await confirm({ title: 'Eliminar promoción', message: '¿Eliminar esta promoción?', variant: 'danger', confirmLabel: 'Eliminar' })
    if (!ok) return
    try {
      const result = await window.electronAPI.promotion.delete(id)
      if (result.success) {
        showToast('success', 'Promoción eliminada', 'Eliminado')
        loadPromotions()
      }
    } catch (e: any) {
      showToast('error', e.message || 'Error al eliminar promoción', 'Error')
    }
  }

  const togglePromoActive = async (promo: Promotion) => {
    try {
      await window.electronAPI.promotion.update(promo.id, { isActive: !promo.isActive })
      loadPromotions()
    } catch (e: any) {
      showToast('error', e.message || 'Error al cambiar estado', 'Error')
    }
  }

  const loadPromotions = async () => {
    try {
      const result = await window.electronAPI.promotion.getAll(false)
      if (result.success && result.data) setPromotions(result.data as Promotion[])
    } catch (e) { console.error('Error loading promotions:', e) }
  }

  const loadPlans = async () => {
    try {
      const result = await window.electronAPI.plans.getAll(false)
      if (result.success && result.data) setPlans(result.data as MembershipPlan[])
    } catch (e) { console.error('Error loading plans:', e) }
  }

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

  const loadAutoStart = async () => {
    try {
      if (window.electronAPI?.system) {
        const result = await window.electronAPI.system.getAutoStart()
        if (result.success) setAutoStart(!!result.data)
      }
    } catch (e) { console.error('Error loading auto-start:', e) }
  }

  const loadBackupConfig = async () => {
    try {
      if (window.electronAPI?.backup?.getConfig) {
        const result = await window.electronAPI.backup.getConfig()
        if (result.success && result.data) {
          setBackupConfigState(result.data)
        }
      }
    } catch (e) { console.error('Error loading backup config:', e) }
  }

  const handleSaveBackupConfig = async (config: { enabled: boolean; retention: number }) => {
    try {
      if (window.electronAPI?.backup?.setConfig) {
        const result = await window.electronAPI.backup.setConfig(config)
        if (result.success) {
          setBackupConfigState(prev => ({ ...prev, ...config }))
          showToast('success', 'Configuración de respaldo guardada', 'Guardado')
        } else {
          showToast('error', result.error || 'Error al guardar respaldo', 'Error')
        }
      }
    } catch (e: any) {
      showToast('error', e.message || 'Error al guardar respaldo', 'Error')
    }
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
    loadDoorConfig()
    loadPlans()
    loadPromotions()
    loadWhatsAppConfig()
    loadAutoStart()
    loadBackupConfig()
  }, [])

  // Recargar planes/promociones cuando guardan en su propia ventana
  useFormSaved('plan', (message) => {
    if (message) showToast('success', message)
    loadPlans()
  })
  useFormSaved('promo', (message) => {
    if (message) showToast('success', message)
    loadPromotions()
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
    } catch (e: any) {
      showToast('error', e.message || 'Error al guardar', 'Error')
    }
  }

  const handleSaveAdmin = async () => {
    if (!adminUser.currentPassword) {
      showToast('warning', 'Ingresa tu contraseña actual', 'Validación')
      return
    }
    if (adminUser.newPassword && adminUser.newPassword !== adminUser.confirmPassword) {
      showToast('warning', 'Las contraseñas nuevas no coinciden', 'Verificación')
      return
    }
    const result = await window.electronAPI.system.updateAdmin({
      username: adminUser.username,
      currentPassword: adminUser.currentPassword,
      newPassword: adminUser.newPassword || undefined
    })
    if (result.success) {
      showToast('success', 'Configuración de administrador guardada correctamente', 'Guardado')
      setAdminUser(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }))
    } else {
      showToast('error', result.error || 'Error al guardar', 'Error')
    }
  }

  function GymSettingsForm() {
    const [gymForm, setGymForm] = useState({ name: '', address: '', phone: '', welcomeMessage: '' })
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      loadGymSettings()
    }, [])

    const loadGymSettings = async () => {
      try {
        const result = await window.electronAPI.gym.getSettings()
        if (result.success && result.data) {
          setGymForm(result.data)
        }
      } catch (e) { console.error('Error loading gym settings:', e) }
      finally { setLoading(false) }
    }

    const handleSave = async () => {
      if (!gymForm.name.trim()) {
        showToast('warning', 'El nombre del gimnasio es obligatorio', 'Validación')
        return
      }
      setSaving(true)
      try {
        const result = await window.electronAPI.gym.saveSettings(gymForm)
        if (result.success) {
          showToast('success', 'Información del gimnasio guardada', 'Guardado')
        } else {
          showToast('error', result.error || 'Error al guardar', 'Error')
        }
      } catch (e: any) {
        showToast('error', e.message || 'Error al guardar', 'Error')
      } finally { setSaving(false) }
    }

    if (loading) {
      return <div className="spinner" style={{ margin: '24px auto' }} />
    }

    return (
      <div className="card-body" style={{ padding: 0 }}>
        <div className="form-group">
          <label className="form-label">Nombre del Gimnasio *</label>
          <input
            type="text"
            className="form-input"
            value={gymForm.name}
            onChange={(e) => setGymForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="BODYFITGYM"
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Dirección</label>
            <input
              type="text"
              className="form-input"
              value={gymForm.address}
              onChange={(e) => setGymForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="AV 4 CALLE 4 Y 5 MOLINOS DEL NORTE"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono</label>
            <input
              type="text"
              className="form-input"
              value={gymForm.phone}
              onChange={(e) => setGymForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="3124962338"
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Mensaje de Bienvenida</label>
          <input
            type="text"
            className="form-input"
            value={gymForm.welcomeMessage}
            onChange={(e) => setGymForm(prev => ({ ...prev, welcomeMessage: e.target.value }))}
            placeholder="Bienvenido, nos complace que seas parte de nuestro equipo."
          />
          <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
            Se muestra en la pantalla de check-in del kiosco
          </p>
        </div>
        <div style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Icons.Check />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-col gap-md">
      <div>
        <h1 className="display-lg">Configuración del Sistema</h1>
        <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)', marginTop: 8 }}>
          Configure los planes de membresía, permisos del personal, hardware e imagen de su gimnasio.
        </p>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav">
          {SETTINGS_NAV.map(item => (
            <button
              key={item.id}
              className={`settings-nav-item${settingsSection === item.id ? ' active' : ''}`}
              onClick={() => setSettingsSection(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="bento-card settings-content">
          {settingsSection === 'plans' && (
            <>
              <div className="flex-row-between" style={{ marginBottom: 24 }}>
                <div>
                  <h2 className="headline-md">Planes de Membresía</h2>
                  <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)', margin: '4px 0 0' }}>
                    Administre los niveles de suscripción y precios de su gimnasio
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => window.electronAPI.window.openForm('plan')}>
                  <Icons.Plus />
                  Nuevo Plan
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                {plans.map(plan => (
                  <div key={plan.id} className={`plan-card${plan.isActive ? ' active' : ''}`}>
                    <div className="plan-card-header">
                      <div>
                        <h3 className="plan-card-name">{plan.name}</h3>
                        <span className="chip" style={{ marginTop: 4, display: 'inline-block' }}>{plan.type}</span>
                      </div>
                      <span className={`status-badge-${plan.isActive ? 'success' : 'error'}`} style={{ borderRadius: '5px', padding: '3px'}}>
                        {plan.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div>
                      <span className="plan-card-price">${plan.price.toLocaleString('es-CO')}</span>
                      <span className="plan-card-duration">/ {plan.durationDays} días</span>
                    </div>
                    {plan.description && (
                      <p className="plan-card-description">{plan.description}</p>
                    )}
                    <div className="plan-card-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => window.electronAPI.window.openForm('plan', { id: plan.id })}>
                        <Icons.Edit />
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => togglePlanActive(plan)}>
                        {plan.isActive ? <Icons.X /> : <Icons.Check />}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => deletePlan(plan.id)}>
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>
                ))}
                {plans.length === 0 && (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    <div className="empty-state-icon"><Icons.Membership /></div>
                    <p>No hay planes de membresía aún. Haga clic en "Nuevo Plan" para crear uno.</p>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 32 }}>
                <div className="flex-row-between" style={{ marginBottom: 20 }}>
                  <div>
                    <h2 className="headline-md">Promociones y Descuentos</h2>
                    <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)', margin: '4px 0 0' }}>
                      Ofertas por tiempo limitado para atraer nuevos miembros
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={() => window.electronAPI.window.openForm('promo')}>
                    <Icons.Plus />
                    Nueva Promoción
                  </button>
                </div>

                {promotions.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><Icons.TrendingUp /></div>
                    <p>No hay promociones aún. Haga clic en "Nueva Promoción" para crear una.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                    {promotions.map(promo => {
                      const plan = plans.find(p => p.id === promo.planId)
                      return (
                        <div key={promo.id} className={`promo-card${promo.isActive ? ' active' : ''}`}>
                          <div className="plan-card-header">
                            <h3 className="headline-md" style={{ margin: 0, fontSize: 16 }}>{promo.name}</h3>
                            <span className={`status-badge-${promo.isActive ? 'success' : 'error'}`}>
                              {promo.isActive ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                          <span className="chip" style={{ alignSelf: 'flex-start' }}>
                            {plan?.name || promo.planId}
                          </span>
                          <span className="promo-card-value">
                            {promo.discountType === 'percentage' ? `${promo.discountValue}%` : `$${promo.discountValue.toLocaleString('es-CO')}`}
                          </span>
                          <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)', margin: 0, fontSize: 13 }}>
                            {promo.startDate.split('T')[0]} → {promo.endDate.split('T')[0]}
                          </p>
                          <div className="plan-card-actions">
                            <button className="btn btn-sm btn-secondary" onClick={() => window.electronAPI.window.openForm('promo', { id: promo.id })}>
                              <Icons.Edit />
                            </button>
                            <button className="btn btn-sm btn-secondary" onClick={() => togglePromoActive(promo)}>
                              {promo.isActive ? <Icons.X /> : <Icons.Check />}
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => deletePromo(promo.id)}>
                              <Icons.Trash />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {settingsSection === 'staff' && (
            <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
              <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
                <h2 className="headline-md" style={{ margin: 0 }}>Personal y Roles</h2>
                <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                  Administre las credenciales de administradores y control de acceso
                </p>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
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

                <div style={{ margin: '20px 0', borderTop: '1px solid var(--color-border)', opacity: 0.3 }} />
                <h3 className="headline-md" style={{ fontSize: 16, marginBottom: 16 }}>Cambiar Contraseña</h3>
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
          )}

          {settingsSection === 'facility' && (
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
          )}

          {settingsSection === 'branding' && (
            <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
              <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
                <h2 className="headline-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.Sun />
                  Marca y Apariencia
                </h2>
                <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                  Personalice la apariencia de su panel de administración
                </p>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="glass-panel" style={{ padding: 20 }}>
                  <h3 className="headline-md" style={{ fontSize: 16, marginBottom: 16 }}>Tema</h3>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button
                      className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setTheme('dark')}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      🌙 Oscuro
                    </button>
                    <button
                      className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setTheme('light')}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      ☀️ Claro
                    </button>
                  </div>
                  <p className="body-lg" style={{ color: 'var(--color-secondary)', marginTop: 12, fontSize: 13 }}>
                    Cambie entre temas oscuro y claro. Su preferencia se guarda automáticamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {settingsSection === 'hardware' && (
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
          )}

          {settingsSection === 'whatsapp' && (
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
                            provider: e.target.value as any
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
          )}

          {settingsSection === 'system' && (
            <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
              <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
                <h2 className="headline-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.Shield />
                  Sistema
                </h2>
                <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                  Configuración general, inicio automático y administración de base de datos
                </p>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="glass-panel" style={{ padding: 20, marginBottom: 24 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0' }}>
                      <input type="checkbox" checked={autoStart}
                        onChange={async (e) => {
                          const enabled = e.target.checked
                          setAutoStart(enabled)
                          if (window.electronAPI?.system?.setAutoStart) {
                            await window.electronAPI.system.setAutoStart(enabled)
                          }
                        }} />
                      <span style={{ fontWeight: 500 }}>Iniciar automáticamente con Windows</span>
                    </label>
                    <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4, marginLeft: 28 }}>
                      La aplicación se iniciará automáticamente cuando encienda el PC del gimnasio
                    </p>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: 20 }}>
                  <h3 className="headline-md" style={{ fontSize: 16, marginBottom: 16 }}>Respaldo de Base de Datos</h3>

                  <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0' }}>
                      <input
                        type="checkbox"
                        checked={backupConfig.enabled}
                        onChange={(e) => handleSaveBackupConfig({ enabled: e.target.checked, retention: backupConfig.retention })}
                      />
                      <span style={{ fontWeight: 500 }}>Respaldo automático</span>
                    </label>
                    <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4, marginLeft: 28 }}>
                      Se crea una copia de la base de datos al iniciar la aplicación y luego cada 24 horas.
                    </p>

                    <div className="form-row" style={{ marginTop: 16, alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Conservar copias</label>
                        <input
                          type="number"
                          className="form-input"
                          value={backupConfig.retention}
                          min={1}
                          max={30}
                          style={{ width: 100 }}
                          onChange={(e) => setBackupConfigState(prev => ({ ...prev, retention: Math.max(1, Math.min(30, Number(e.target.value) || 7)) }))}
                        />
                        <small style={{ display: 'block', color: 'var(--color-secondary)', marginTop: 4 }}>
                          Las copias más antiguas se eliminan automáticamente (1–30)
                        </small>
                      </div>
                      <button className="btn btn-secondary" onClick={() => handleSaveBackupConfig({ enabled: backupConfig.enabled, retention: backupConfig.retention })}>
                        <Icons.Check />
                        Guardar
                      </button>
                    </div>

                    <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-secondary)' }}>
                      {backupConfig.lastBackupAt
                        ? <>Último respaldo: <strong>{new Date(backupConfig.lastBackupAt).toLocaleString('es-CO')}</strong> · {backupConfig.count} copia(s) en carpeta local</>
                        : <>Aún no se ha creado ningún respaldo automático</>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary" onClick={async () => {
                      if (window.electronAPI?.backup?.runNow) {
                        const result = await window.electronAPI.backup.runNow()
                        if (result.success) {
                          showToast('success', `Respaldo creado: ${result.data}`, 'Respaldo Exitoso')
                          loadBackupConfig()
                        } else {
                          showToast('error', result.error || 'Error al crear respaldo', 'Error')
                        }
                      }
                    }}>
                      <Icons.Download />
                      Crear Respaldo Ahora
                    </button>
                    <button className="btn btn-secondary" onClick={async () => {
                      if (window.electronAPI?.system?.backupDb) {
                        const result = await window.electronAPI.system.backupDb()
                        if (result.success) {
                          showToast('success', `Respaldo guardado en: ${result.data}`, 'Respaldo Exitoso')
                        } else if (result.error !== 'Canceled') {
                          showToast('error', result.error || 'Error al crear respaldo', 'Error')
                        }
                      }
                    }}>
                      <Icons.Download />
                      Guardar Copia (elegir ubicación)
                    </button>
                    <button className="btn btn-secondary" onClick={async () => {
                      if (window.electronAPI?.system?.restoreDb) {
                        const ok = await confirm({ title: 'Restaurar base de datos', message: '¿Restaurar base de datos? Los cambios no guardados se perderán.', variant: 'warning', confirmLabel: 'Restaurar' })
                        if (!ok) return
                        const result = await window.electronAPI.system.restoreDb()
                        if (result.success) {
                          showToast('success', 'Base de datos restaurada. Reinicie la aplicación.', 'Restauración Exitosa')
                        } else if (result.error !== 'Canceled') {
                          showToast('error', result.error || 'Error al restaurar base de datos', 'Error')
                        }
                      }
                    }}>
                      <Icons.Upload />
                      Restaurar Base de Datos
                    </button>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary" onClick={async () => {
                      if (!window.electronAPI?.system?.migrateLegacy) return
                      const ok = await confirm({
                        title: '⚠️ Importar datos del sistema anterior',
                        message: '¿Importar datos desde la base de datos anterior (db_actual.sql)?\n\n⚠️ SE ELIMINARÁN todos los datos actuales: clientes, membresías, pagos, planes, productos y registros de acceso.\n\n✅ Se creará un backup automático antes de comenzar. Si la migración falla, los datos se restaurarán automáticamente.',
                        variant: 'warning',
                        confirmLabel: 'Importar'
                      })
                      if (!ok) return

                      setShowMigrationModal(true)
                      setMigrationBackupPath(null)
                      setMigrationStatus('Selecciona el archivo db_actual.sql...')

                      // Escuchar progreso
                      const cleanup = window.electronAPI.system.onMigrationProgress((progress: { phase: string; table?: string; current?: number; message: string }) => {
                        if (progress.phase === 'parsing') {
                          setMigrationStatus(`📄 ${progress.message}`)
                        } else if (progress.phase === 'importing') {
                          setMigrationStatus(`📦 Importando ${progress.table}...`)
                        } else if (progress.phase === 'done') {
                          setMigrationStatus('✅ Migración completada exitosamente.')
                        }
                      })

                      try {
                        const result = await window.electronAPI.system.migrateLegacy()
                        cleanup()

                        if (result.success && result.data) {
                          setMigrationBackupPath(result.data.backupPath || null)
                          const summary = [
                            `✅ Completado: ${result.data.totalRecords} registros importados,`,
                            `${result.data.photosExported} fotos exportadas.`
                          ].join(' ')
                          setMigrationStatus(summary)
                          showToast('success', `Migración completada: ${result.data.totalRecords} registros`, 'Migración Exitosa')
                        } else {
                          setMigrationBackupPath((result.data as any)?.backupPath || null)
                          const errorMsg = result.error || 'Error desconocido'
                          setMigrationStatus(`❌ Error: ${errorMsg}`)
                          showToast('error', errorMsg, 'Error')
                        }
                      } catch (e: any) {
                        cleanup()
                        setMigrationStatus(`❌ Error: ${e.message}`)
                        showToast('error', e.message || 'Error en la migración', 'Error')
                      }
                    }}>
                      <Icons.Refresh />
                      Importar datos del sistema anterior
                    </button>
                  </div>
                  <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 8 }}>
                    La base de datos contiene clientes, membresías, pagos, registros de acceso y configuración.
                  </p>
                </div>

                <UpdateChecker />
              </div>
            </div>
          )}
        </div>
      </div>

      {showMigrationModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: 520, padding: 32, textAlign: 'center' }}>
            {migrationStatus.includes('✅') || migrationStatus.includes('❌') ? (
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {migrationStatus.includes('✅') ? '🎉' : '😞'}
              </div>
            ) : (
              <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 16px' }} />
            )}
            <h3 className="headline-md" style={{ marginBottom: 8 }}>
              {migrationStatus.includes('✅') ? 'Migración Completada' :
               migrationStatus.includes('❌') ? 'Error en Migración' :
               'Importando Datos Legacy'}
            </h3>
            <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
              {migrationStatus || 'Procesando...'}
            </p>

            {migrationBackupPath && (migrationStatus.includes('✅') || migrationStatus.includes('❌')) && (
              <div className="glass-panel" style={{
                marginTop: 16, padding: 12, fontSize: 12,
                textAlign: 'left',
                background: 'rgba(255, 107, 0, 0.08)'
              }}>
                <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--color-primary)' }}>
                  💾 Backup disponible
                </p>
                <p style={{ wordBreak: 'break-all', color: 'var(--color-on-surface-variant)' }}>
                  {migrationBackupPath}
                </p>
                <button className="btn btn-sm btn-secondary" style={{ marginTop: 8 }}
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Restaurar desde backup',
                      message: '¿Restaurar la base de datos desde el backup automático? Se perderán los cambios de la migración.',
                      variant: 'warning',
                      confirmLabel: 'Restaurar'
                    })
                    if (!ok) return
                    // No podemos pasar un path directamente al restoreDb existente
                    // Mostramos instrucciones al usuario
                    setMigrationStatus(`ℹ️ Para restaurar:
1. Ve a Sistema → Restaurar Base de Datos
2. Selecciona el archivo:
${migrationBackupPath}`)
                  }}>
                  <Icons.Upload />
                  ¿Cómo restaurar desde backup?
                </button>
              </div>
            )}

            {(migrationStatus.includes('✅') || migrationStatus.includes('❌')) && (
              <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
                {migrationStatus.includes('✅') ? (
                  <button className="btn btn-primary"
                    onClick={() => {
                      setShowMigrationModal(false)
                      window.location.reload()
                    }}>
                    <Icons.Refresh />
                    Reiniciar para aplicar cambios
                  </button>
                ) : (
                  <button className="btn btn-secondary"
                    onClick={() => setShowMigrationModal(false)}>
                    Cerrar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
