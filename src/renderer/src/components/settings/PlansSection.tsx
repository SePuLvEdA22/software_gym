import { useState, useEffect } from 'react'
import { useFormSaved } from '@/hooks/useFormSaved'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { MembershipPlan, Promotion } from '../../../../shared/types'
import { toErrorMessage } from '../../../../shared/errors'

export function PlansSection(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const confirm = useAppStore((state) => state.confirm)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])

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
    } catch (e) {
      showToast('error', toErrorMessage(e, 'Error al eliminar plan'), 'Error')
    }
  }

  const togglePlanActive = async (plan: MembershipPlan) => {
    if (!plan.isActive) {
      try {
        await window.electronAPI.plans.update(plan.id, { isActive: true })
        loadPlans()
      } catch (e) {
        showToast('error', toErrorMessage(e, 'Error al cambiar estado'), 'Error')
      }
      return
    }
    const ok = await confirm({ title: 'Desactivar plan', message: `¿Desactivar el plan "${plan.name}"? Los clientes con este plan no se verán afectados.`, variant: 'warning', confirmLabel: 'Desactivar' })
    if (!ok) return
    try {
      await window.electronAPI.plans.update(plan.id, { isActive: false })
      loadPlans()
    } catch (e) {
      showToast('error', toErrorMessage(e, 'Error al cambiar estado'), 'Error')
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
    } catch (e) {
      showToast('error', toErrorMessage(e, 'Error al eliminar promoción'), 'Error')
    }
  }

  const togglePromoActive = async (promo: Promotion) => {
    try {
      await window.electronAPI.promotion.update(promo.id, { isActive: !promo.isActive })
      loadPromotions()
    } catch (e) {
      showToast('error', toErrorMessage(e, 'Error al cambiar estado'), 'Error')
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

  useEffect(() => {
    loadPlans()
    loadPromotions()
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

  return (
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
  )
}
