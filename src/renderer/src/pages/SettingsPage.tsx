import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { UpdateChecker } from '@/components/UpdateChecker'
import { MembershipPlan, MembershipType, Promotion } from '../../../shared/types'

type SettingsSection = 'plans' | 'staff' | 'facility' | 'branding' | 'hardware' | 'whatsapp' | 'system'

const SETTINGS_NAV: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'plans', label: 'Membership Plans', icon: <Icons.Membership /> },
  { id: 'staff', label: 'Staff & Roles', icon: <Icons.User /> },
  { id: 'facility', label: 'Facility Info', icon: <Icons.Door /> },
  { id: 'branding', label: 'Branding', icon: <Icons.Sun /> },
  { id: 'hardware', label: 'Hardware Integration', icon: <Icons.Settings /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <Icons.Bell /> },
  { id: 'system', label: 'System', icon: <Icons.Shield /> },
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
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null)
  const [planForm, setPlanForm] = useState({ name: '', type: 'monthly' as MembershipType, price: 0, durationDays: 30, description: '' })
  const [autoStart, setAutoStart] = useState(false)

  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null)
  const [promoForm, setPromoForm] = useState({ name: '', planId: '', discountType: 'percentage' as 'percentage' | 'fixed', discountValue: 0, startDate: '', endDate: '' })

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

  const openNewPromo = () => {
    setEditingPromo(null)
    setPromoForm({ name: '', planId: '', discountType: 'percentage', discountValue: 0, startDate: '', endDate: '' })
    setShowPromoModal(true)
  }

  const openEditPromo = (promo: Promotion) => {
    setEditingPromo(promo)
    setPromoForm({
      name: promo.name,
      planId: promo.planId,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      startDate: promo.startDate.split('T')[0],
      endDate: promo.endDate.split('T')[0]
    })
    setShowPromoModal(true)
  }

  const savePromo = async () => {
    if (!promoForm.name || !promoForm.planId || promoForm.discountValue <= 0 || !promoForm.startDate || !promoForm.endDate) {
      showToast('warning', 'Completa todos los campos obligatorios', 'Validación')
      return
    }
    try {
      const data = {
        ...promoForm,
        startDate: new Date(promoForm.startDate).toISOString(),
        endDate: new Date(promoForm.endDate).toISOString()
      }
      if (editingPromo) {
        const result = await window.electronAPI.promotion.update(editingPromo.id, data)
        if (result.success) showToast('success', 'Promoción actualizada', 'Guardado')
      } else {
        const result = await window.electronAPI.promotion.create(data)
        if (result.success) showToast('success', 'Promoción creada', 'Guardado')
      }
      setShowPromoModal(false)
      loadPromotions()
    } catch (e: any) {
      showToast('error', e.message || 'Error al guardar promoción', 'Error')
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
          setWhatsappConfig(prev => ({ ...prev, ...result.data }))
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
          <label className="form-label">Gym Name *</label>
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
            <label className="form-label">Address</label>
            <input
              type="text"
              className="form-input"
              value={gymForm.address}
              onChange={(e) => setGymForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="AV 4 CALLE 4 Y 5 MOLINOS DEL NORTE"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
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
          <label className="form-label">Welcome Message</label>
          <input
            type="text"
            className="form-input"
            value={gymForm.welcomeMessage}
            onChange={(e) => setGymForm(prev => ({ ...prev, welcomeMessage: e.target.value }))}
            placeholder="Bienvenido a BodyFitGym"
          />
          <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
            Shown on the kiosk check-in screen
          </p>
        </div>
        <div style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Icons.Check />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-col gap-md">
      <div>
        <h1 className="display-lg">System Settings</h1>
        <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)', marginTop: 8 }}>
          Configure your gym's membership plans, staff permissions, facility hardware, and branding preferences.
        </p>
      </div>

      <div className="flex-row" style={{ alignItems: 'start', gap: 32, display: 'grid', gridTemplateColumns: '240px 1fr' }}>
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

        <div className="bento-card" style={{ padding: 28 }}>
          {settingsSection === 'plans' && (
            <>
              <div className="flex-row-between" style={{ marginBottom: 24 }}>
                <div>
                  <h2 className="headline-md">Membership Plans</h2>
                  <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)', margin: '4px 0 0' }}>
                    Manage subscription tiers and pricing for your gym
                  </p>
                </div>
                <button className="btn btn-primary" onClick={openNewPlan}>
                  <Icons.Plus />
                  New Plan
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
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div>
                      <span className="plan-card-price">${plan.price.toLocaleString('es-CO')}</span>
                      <span className="plan-card-duration">/ {plan.durationDays} days</span>
                    </div>
                    {plan.description && (
                      <p className="plan-card-description">{plan.description}</p>
                    )}
                    <div className="plan-card-actions">
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
                  </div>
                ))}
                {plans.length === 0 && (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    <div className="empty-state-icon"><Icons.Membership /></div>
                    <p>No membership plans yet. Click "New Plan" to create one.</p>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 32 }}>
                <div className="flex-row-between" style={{ marginBottom: 20 }}>
                  <div>
                    <h2 className="headline-md">Promotions & Discounts</h2>
                    <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)', margin: '4px 0 0' }}>
                      Time-limited offers to attract new members
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={openNewPromo}>
                    <Icons.Plus />
                    New Promotion
                  </button>
                </div>

                {promotions.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><Icons.TrendingUp /></div>
                    <p>No promotions yet. Click "New Promotion" to create one.</p>
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
                              {promo.isActive ? 'Active' : 'Inactive'}
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
                            <button className="btn btn-sm btn-secondary" onClick={() => openEditPromo(promo)}>
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
                <h2 className="headline-md" style={{ margin: 0 }}>Staff & Roles</h2>
                <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                  Manage administrator credentials and access control
                </p>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={adminUser.username}
                      onChange={(e) => setAdminUser(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ margin: '20px 0', borderTop: '1px solid var(--color-border)', opacity: 0.3 }} />
                <h3 className="headline-md" style={{ fontSize: 16, marginBottom: 16 }}>Change Password</h3>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <input 
                      type="password" 
                      className="form-input"
                      value={adminUser.currentPassword}
                      onChange={(e) => setAdminUser(prev => ({ ...prev, currentPassword: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input 
                      type="password" 
                      className="form-input"
                      value={adminUser.newPassword}
                      onChange={(e) => setAdminUser(prev => ({ ...prev, newPassword: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm Password</label>
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
                    Update User
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
                    Kiosk Display
                  </h2>
                  <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                    Configure the check-in kiosk for member self-service
                  </p>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <div className="glass-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <Icons.Calendar />
                    <div>
                      <span style={{ fontWeight: 600 }}>Dual Display System:</span>
                      <span style={{ marginLeft: 8, color: 'var(--color-secondary)', fontSize: 13 }}>
                        The kiosk opens in a SEPARATE window, ideal for a second monitor at the gym entrance.
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
                          <p className="metric-card-label" style={{ margin: 0 }}>Kiosk Status</p>
                          <p className="metric-card-value" style={{ 
                            fontSize: 24,
                            color: kioskOpen ? 'var(--color-success)' : 'var(--color-secondary)'
                          }}>
                            {kioskOpen ? 'ACTIVE' : 'INACTIVE'}
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
                          Open Kiosk Display
                        </button>
                      ) : (
                        <button className="btn btn-danger btn-lg" onClick={handleCloseKiosk} style={{ justifyContent: 'center' }}>
                          <Icons.X />
                          Close Kiosk Display
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    <div className="glass-panel" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: 'rgba(255, 107, 0, 0.08)' }}>
                      <Icons.User />
                      <div><span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Monitor 1:</span> Admin Panel (Reception)</div>
                    </div>
                    <div className="glass-panel" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: 'rgba(74, 222, 128, 0.08)' }}>
                      <Icons.Door />
                      <div><span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Monitor 2:</span> Kiosk Display (Entrance)</div>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: 20 }}>
                    <h4 className="label-md" style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Auto-start Configuration
                    </h4>
                    <p className="body-lg" style={{ color: 'var(--color-secondary)', lineHeight: 1.6, fontSize: 13 }}>
                      To configure which mode opens on app start, use the <code className="chip" style={{ fontFamily: 'monospace', fontSize: 12 }}>GYM_MODE</code> environment variable:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, fontFamily: 'monospace', fontSize: 13 }}>
                      <div className="glass-panel" style={{ padding: '8px 12px' }}>
                        <code>GYM_MODE=both</code> → Admin + Kiosk (default)
                      </div>
                      <div className="glass-panel" style={{ padding: '8px 12px' }}>
                        <code>GYM_MODE=admin</code> → Admin only
                      </div>
                      <div className="glass-panel" style={{ padding: '8px 12px' }}>
                        <code>GYM_MODE=kiosk</code> → Kiosk only
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
                  <h2 className="headline-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icons.Door />
                    Gym Information
                  </h2>
                  <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                    Configure your gym's name, address, and welcome message displayed on the kiosk
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
                  Branding
                </h2>
                <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                  Customize the look and feel of your gym management panel
                </p>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="glass-panel" style={{ padding: 20 }}>
                  <h3 className="headline-md" style={{ fontSize: 16, marginBottom: 16 }}>Theme</h3>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button
                      className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setTheme('dark')}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      🌙 Dark
                    </button>
                    <button
                      className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setTheme('light')}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      ☀️ Light
                    </button>
                  </div>
                  <p className="body-lg" style={{ color: 'var(--color-secondary)', marginTop: 12, fontSize: 13 }}>
                    Switch between dark and light themes. Your preference is saved automatically.
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
                  Hardware Integration
                </h2>
                <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                  Configure connected hardware devices for door access and entry control
                </p>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="form-group">
                  <label className="form-label">Connection Type</label>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {([
                      { value: 'mock', label: 'Simulation', desc: 'No real hardware' },
                      { value: 'http', label: 'HTTP/HTTPS', desc: 'TCP/IP Relay or ZKTeco' },
                      { value: 'serial', label: 'Serial Port', desc: 'RS232 / RS485 / USB' }
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
                    <label className="form-label">Open Duration (ms)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={doorConfig.openDuration}
                      onChange={(e) => setDoorConfig(prev => ({ ...prev, openDuration: Number(e.target.value) }))}
                    />
                    <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
                      How long the door stays unlocked
                    </p>
                  </div>
                </div>

                <div style={{ margin: '20px 0', borderTop: '1px solid var(--color-border)', opacity: 0.3 }} />

                {doorConfig.connectionType === 'http' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Relay URL</label>
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
                        <label className="form-label">HTTP Method</label>
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
                      <label className="form-label">Headers (optional)</label>
                      <textarea
                        className="form-textarea"
                        value={doorConfig.httpHeaders}
                        onChange={(e) => setDoorConfig(prev => ({ ...prev, httpHeaders: e.target.value }))}
                        placeholder="Authorization: Bearer token&#10;Content-Type: application/json"
                        rows={3}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Body (optional, for POST)</label>
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
                        <label className="form-label">Serial Port</label>
                        <input
                          type="text"
                          className="form-input"
                          value={doorConfig.portName}
                          onChange={(e) => setDoorConfig(prev => ({ ...prev, portName: e.target.value }))}
                          placeholder="COM3, /dev/ttyUSB0, etc."
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Baud Rate</label>
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
                      <label className="form-label">Serial Command</label>
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
                      Test Connection
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
                  WhatsApp Notifications
                </h2>
                <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                  Send automated reminders and alerts to members via WhatsApp
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
                    <span style={{ fontWeight: 500 }}>Enable WhatsApp notifications</span>
                  </label>
                </div>

                {whatsappConfig.enabled && (
                  <>
                    <div style={{ margin: '20px 0', borderTop: '1px solid var(--color-border)', opacity: 0.3 }} />
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Provider</label>
                        <select 
                          className="form-select"
                          value={whatsappConfig.provider}
                          onChange={(e) => setWhatsappConfig(prev => ({ 
                            ...prev, 
                            provider: e.target.value as any
                          }))}
                        >
                          <option value="mock">Simulation Mode</option>
                          <option value="whatsapp_cloud">WhatsApp Cloud API (Meta)</option>
                          <option value="evolution_api">Evolution API</option>
                          <option value="twilio">Twilio</option>
                          <option value="custom">Custom API</option>
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
                              placeholder="Numeric ID from Meta Business"
                            />
                          </div>
                        )}
                        <div className="form-row">
                          {whatsappConfig.provider !== 'whatsapp_cloud' && (
                            <div className="form-group">
                              <label className="form-label">API URL</label>
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
                              placeholder="Instance ID"
                            />
                          </div>
                        )}
                      </>
                    )}

                    <div style={{ margin: '20px 0', borderTop: '1px solid var(--color-border)', opacity: 0.3 }} />
                    <h3 className="headline-md" style={{ fontSize: 16, marginBottom: 20 }}>Automatic Reminders</h3>
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
                        <span>3 days before expiry</span>
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
                        <span>1 day before expiry</span>
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
                        <span>Same day of expiry</span>
                      </label>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <label className="form-label">Check interval (hours)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={whatsappConfig.checkIntervalHours}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, checkIntervalHours: Math.max(1, Number(e.target.value)) }))}
                        min={1}
                        max={168}
                        style={{ width: 120 }}
                      />
                      <small style={{ display: 'block', color: 'var(--color-secondary)', marginTop: 4 }}>
                        How often to check and send automatic reminders (min 1, max 168)
                      </small>
                    </div>
                  </>
                )}

                <div style={{ marginTop: 24 }}>
                  <button className="btn btn-primary" onClick={handleSaveWhatsapp}>
                    <Icons.Check />
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          )}

          {settingsSection === 'system' && (
            <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
              <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
                <h2 className="headline-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.Shield />
                  System
                </h2>
                <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                  General system settings, auto-start, and database management
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
                      <span style={{ fontWeight: 500 }}>Start automatically with Windows</span>
                    </label>
                    <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4, marginLeft: 28 }}>
                      The app will launch automatically when the gym PC starts
                    </p>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: 20 }}>
                  <h3 className="headline-md" style={{ fontSize: 16, marginBottom: 16 }}>Database Backup</h3>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary" onClick={async () => {
                      if (window.electronAPI?.system?.backupDb) {
                        const result = await window.electronAPI.system.backupDb()
                        if (result.success) {
                          showToast('success', `Backup saved to: ${result.data}`, 'Backup Successful')
                        } else if (result.error !== 'Canceled') {
                          showToast('error', result.error || 'Error creating backup', 'Error')
                        }
                      }
                    }}>
                      <Icons.Download />
                      Backup Database
                    </button>
                    <button className="btn btn-secondary" onClick={async () => {
                      if (window.electronAPI?.system?.restoreDb) {
                        const ok = await confirm({ title: 'Restore database', message: 'Restore database? Unsaved changes will be lost.', variant: 'warning', confirmLabel: 'Restore' })
                        if (!ok) return
                        const result = await window.electronAPI.system.restoreDb()
                        if (result.success) {
                          showToast('success', 'Database restored. Restart the app.', 'Restore Successful')
                        } else if (result.error !== 'Canceled') {
                          showToast('error', result.error || 'Error restoring database', 'Error')
                        }
                      }
                    }}>
                      <Icons.Upload />
                      Restore Database
                    </button>
                  </div>
                  <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 8 }}>
                    The database contains clients, memberships, payments, access logs, and configuration.
                  </p>
                </div>

                <UpdateChecker />
              </div>
            </div>
          )}
        </div>
      </div>

      {showPromoModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: 480, maxHeight: '90vh', overflow: 'auto', padding: 0 }}>
            <div className="card-header" style={{ padding: 20, borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="headline-md" style={{ margin: 0 }}>
                {editingPromo ? 'Edit Promotion' : 'New Promotion'}
              </h3>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={promoForm.name}
                  onChange={e => setPromoForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g.: Summer Special" />
              </div>
              <div className="form-group">
                <label className="form-label">Plan *</label>
                <select className="form-select" value={promoForm.planId}
                  onChange={e => setPromoForm(prev => ({ ...prev, planId: e.target.value }))}>
                  <option value="">Select a plan</option>
                  {plans.filter(p => p.isActive).map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.name} - ${plan.price.toLocaleString('es-CO')}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Discount Type</label>
                  <select className="form-select" value={promoForm.discountType}
                    onChange={e => setPromoForm(prev => ({ ...prev, discountType: e.target.value as 'percentage' | 'fixed' }))}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Value *</label>
                  <input type="number" className="form-input" value={promoForm.discountValue}
                    onChange={e => setPromoForm(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                    min={0} placeholder={promoForm.discountType === 'percentage' ? 'e.g.: 20' : 'e.g.: 50000'} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Date *</label>
                  <input type="date" className="form-input" value={promoForm.startDate}
                    onChange={e => setPromoForm(prev => ({ ...prev, startDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date *</label>
                  <input type="date" className="form-input" value={promoForm.endDate}
                    onChange={e => setPromoForm(prev => ({ ...prev, endDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowPromoModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={savePromo}>
                  <Icons.Check />
                  {editingPromo ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPlanModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: 480, maxHeight: '90vh', overflow: 'auto', padding: 0 }}>
            <div className="card-header" style={{ padding: 20, borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="headline-md" style={{ margin: 0 }}>
                {editingPlan ? 'Edit Plan' : 'New Plan'}
              </h3>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={planForm.name}
                  onChange={e => handlePlanFormChange('name', e.target.value)}
                  placeholder="e.g.: Monthly Premium" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={planForm.type}
                    onChange={e => handlePlanFormChange('type', e.target.value)}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">15 Days</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semiannual">Semi-Annual</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (days) *</label>
                  <input type="number" className="form-input" value={planForm.durationDays}
                    onChange={e => handlePlanFormChange('durationDays', Number(e.target.value))} min={1} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Price *</label>
                <input type="number" className="form-input" value={planForm.price}
                  onChange={e => handlePlanFormChange('price', Number(e.target.value))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={planForm.description}
                  onChange={e => handlePlanFormChange('description', e.target.value)} rows={2} />
              </div>
              <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowPlanModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={savePlan}>
                  <Icons.Check />
                  {editingPlan ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
