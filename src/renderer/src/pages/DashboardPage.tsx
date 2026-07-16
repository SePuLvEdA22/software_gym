import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { AccessLog, PeakHour, PlanStat, InactiveClient } from '../../../shared/types'
import { formatCurrency } from '@/utils/format'
import { format, parseISO } from 'date-fns'

const CHART_COLORS = ['var(--color-primary-container)', 'var(--color-success)', 'var(--color-error)', 'var(--color-info)', '#f472b6', '#a78bfa']

function RecentAccesses({ accesses }: { accesses: AccessLog[] }): JSX.Element {
  const getResultBadge = (result: string) => {
    switch (result) {
      case 'granted':
        return <span className="status-badge status-badge-success">Permitido</span>
      case 'denied_expired':
        return <span className="status-badge status-badge-error">Vencido</span>
      case 'denied_inactive':
        return <span className="status-badge status-badge-warning">Inactivo</span>
      default:
        return <span className="status-badge status-badge-error">Denegado</span>
    }
  }

  const formatTime = (timestamp: string) => {
    try {
      return format(parseISO(timestamp), 'HH:mm:ss')
    } catch {
      return timestamp
    }
  }

  return (
    <div className="bento-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="flex-row-between" style={{ marginBottom: 16 }}>
        <h3 className="headline-md" style={{ fontSize: 18 }}>Accesos Recientes</h3>
        <Icons.History style={{ color: 'var(--color-on-surface-variant)' }} />
      </div>
      {accesses.length === 0 ? (
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="empty-state-icon">
            <Icons.History />
          </div>
          <p>No hay accesos registrados hoy</p>
        </div>
      ) : (
        <div className="table-container" style={{ border: 'none', borderRadius: 0, flex: 1, maxHeight: 300, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Código</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {accesses.slice(0, 5).map((access) => (
                <tr key={access.id}>
                  <td style={{ fontFamily: 'monospace' }}>{formatTime(access.timestamp)}</td>
                  <td>{access.clientName || 'Desconocido'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{access.accessCode}</td>
                  <td>{getResultBadge(access.result)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RevenueChart({ data }: { data: { month: string; revenue: number }[] }): JSX.Element {
  return (
    <div className="bento-card">
      <div style={{ marginBottom: 16 }}>
        <h3 className="headline-md" style={{ fontSize: 18 }}>Ingresos Mensuales</h3>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary-container)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-primary-container)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-container-high)" />
            <XAxis dataKey="month" stroke="var(--color-outline)" fontSize={12} />
            <YAxis stroke="var(--color-outline)" fontSize={12} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'var(--color-surface-container)', 
                border: '1px solid var(--color-surface-container-high)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-on-surface)'
              }}
              formatter={(value: number) => [formatCurrency(value), 'Ingresos']}
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="var(--color-primary-container)" 
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function PeakHoursChart({ data }: { data: PeakHour[] }): JSX.Element {
  const chartData = data.map(d => ({
    hour: `${d.hour}:00`,
    count: d.count
  }))

  return (
    <div className="bento-card">
      <div style={{ marginBottom: 16 }}>
        <h3 className="headline-md" style={{ fontSize: 18 }}>Horas Pico</h3>
      </div>
      <div className="chart-body">
        {data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Icons.Clock />
            </div>
            <p>No hay datos suficientes</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-container-high)" />
              <XAxis dataKey="hour" stroke="var(--color-outline)" fontSize={12} />
              <YAxis stroke="var(--color-outline)" fontSize={12} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'var(--color-surface-container)', 
                  border: '1px solid var(--color-surface-container-high)',                borderRadius: 'var(--radius-md)',
                color: 'var(--color-on-surface)'
              }}
              />
              <Bar dataKey="count" fill="var(--color-primary-container)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function TopPlansChart({ data }: { data: PlanStat[] }): JSX.Element {
  const chartData = data.map(d => ({
    name: d.planName,
    value: d.count
  }))

  return (
    <div className="bento-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16 }}>
        <h3 className="headline-md" style={{ fontSize: 18 }}>Planes Más Vendidos</h3>
      </div>
      <div className="chart-body" style={{ flex: 1 }}>
        {data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Icons.Membership />
            </div>
            <p>No hay datos suficientes</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'var(--color-surface-container)', 
                  border: '1px solid var(--color-surface-container-high)',                borderRadius: 'var(--radius-md)',
                color: 'var(--color-on-surface)'
              }}
            />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      {/* Legend outside chart-body so it's not constrained by fixed height */}
      {data.length > 0 && (
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 8, 
          marginTop: 8, 
          justifyContent: 'center',
          padding: '4px 0',
          borderTop: '1px solid var(--color-surface-container-high)'
        }}>
          {data.map((plan, index) => (
            <div key={plan.planName} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 4,
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: 'var(--color-surface-container-high)',
              }}
              title={plan.planName}
            >
              <div style={{ 
                width: 10, 
                height: 10, 
                borderRadius: 2, 
                flexShrink: 0,
                backgroundColor: CHART_COLORS[index % CHART_COLORS.length] 
              }} />
              <span style={{ 
                fontSize: 11, 
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 60
              }}>
                {plan.planName}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuickActions({ onAction }: { onAction: (action: string) => void }): JSX.Element {
  const actions = [
    { id: 'new-client', label: 'Nuevo Cliente', icon: 'Plus' as const },
    { id: 'check-access', label: 'Control Acceso', icon: 'Access' as const },
    { id: 'new-payment', label: 'Registrar Pago', icon: 'CreditCard' as const },
    { id: 'open-door', label: 'Abrir Puerta', icon: 'Door' as const }
  ]

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {actions.map((action) => {
        const IconComponent = Icons[action.icon]
        return (
          <div
            key={action.id}
            className="bento-card"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 20px', cursor: 'pointer',
              flex: '1 1 auto', minWidth: 140, userSelect: 'none'
            }}
            onClick={() => onAction(action.id)}
          >
            <div style={{ color: 'var(--color-primary-container)', display: 'flex' }}>
              <IconComponent />
            </div>
            <span className="body-lg" style={{ fontSize: 14 }}>{action.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const { dashboardMetrics, setDashboardMetrics, setTriggerNewClientModal, showToast } = useAppStore()
  const [localLoading, setLocalLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([])
  const [expiringSoon, setExpiringSoon] = useState<{ clientId: string; clientName: string; planName: string; endDate: string; daysLeft: number }[]>([])
  const [birthdays, setBirthdays] = useState<{ clientId: string; clientName: string; day: number }[]>([])
  const [inactiveClients, setInactiveClients] = useState<InactiveClient[]>([])
  const [dashboardPeriod, setDashboardPeriod] = useState<'day' | 'week' | 'month'>('day')

  const loadMetrics = async (periodParam?: 'day' | 'week' | 'month') => {
    const activePeriod = periodParam || dashboardPeriod
    const [result, revenueResult, expiringResult, birthdayResult, inactiveResult] = await Promise.all([
      window.electronAPI.dashboard.getMetrics(activePeriod),
      window.electronAPI.dashboard.getRevenueByMonth(6),
      window.electronAPI.dashboard.getExpiringSoon(7),
      window.electronAPI.dashboard.getBirthdays(),
      window.electronAPI.client.getInactive(30)
    ])

    if (result.success && result.data) {
      setDashboardMetrics(result.data)
    }
    if (revenueResult.success && revenueResult.data) {
      setRevenueData(revenueResult.data)
    }
    if (expiringResult.success && expiringResult.data) {
      setExpiringSoon(expiringResult.data as any[])
    }
    if (birthdayResult.success && birthdayResult.data) {
      setBirthdays(birthdayResult.data as any[])
    }
    if (inactiveResult.success && inactiveResult.data) {
      setInactiveClients(inactiveResult.data)
    }
    setLocalLoading(false)
  }

  useEffect(() => {
    loadMetrics()
    const interval = setInterval(() => loadMetrics(dashboardPeriod), 30000)
    return () => clearInterval(interval)
  }, [dashboardPeriod])

  const handleQuickAction = async (action: string) => {
    switch (action) {
      case 'new-client':
        navigate('/clients')
        setTriggerNewClientModal(true)
        break
      case 'check-access':
        navigate('/logs')
        break
      case 'new-payment':
        navigate('/payments')
        break
      case 'open-door':
        await window.electronAPI.door.open()
        break
    }
  }

  const metrics = dashboardMetrics || {
    totalClients: 0,
    activeClients: 0,
    expiredClients: 0,
    inactiveClients: 0,
    todayAccesses: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    newThisMonth: 0,
    debtorsCount: 0,
    inactiveClientsCount: 0,
    peakHours: [],
    topPlans: [],
    recentAccesses: []
  }

  if (localLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div className="spinner" />
      </div>
    )
  }

  const periodLabels: Record<string, string> = { day: 'Día', week: 'Semana', month: 'Mes' }
  const revenueLabel: Record<string, string> = { day: 'Ingresos Hoy', week: 'Ingresos Semana', month: 'Ingresos Mes' }

  const handlePeriodChange = (p: 'day' | 'week' | 'month') => {
    setDashboardPeriod(p)
    setLocalLoading(true)
    loadMetrics(p)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="display-lg">Panel General</h1>
          <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)', marginTop: 4 }}>
            Panel de control del gimnasio
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['day', 'week', 'month'] as const).map((p) => (
            <div
              key={p}
              className={`filter-pill${dashboardPeriod === p ? ' active' : ''}`}
              onClick={() => handlePeriodChange(p)}
            >
              {periodLabels[p]}
            </div>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-6">
        <div className="metric-card kpi-left-border kpi-left-border-primary" style={{ minHeight: 160 }}>
          <div className="metric-card-blur" style={{ top: '-20%', right: '-20%', width: 140, height: 140, background: 'var(--color-primary-container)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p className="metric-card-label">Clientes Totales</p>
            <p className="metric-card-value">{metrics.totalClients}</p>
          </div>
        </div>
        <div className="metric-card kpi-left-border kpi-left-border-success" style={{ minHeight: 160 }}>
          <div className="metric-card-blur" style={{ bottom: '-20%', left: '-20%', width: 120, height: 120, background: 'var(--color-success)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p className="metric-card-label">Clientes Activos</p>
            <p className="metric-card-value">{metrics.activeClients}</p>
          </div>
        </div>
        <div className="metric-card kpi-left-border kpi-left-border-primary" style={{ minHeight: 160 }}>
          <div className="metric-card-blur" style={{ top: '10%', right: '-10%', width: 100, height: 100, background: 'var(--color-primary-container)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p className="metric-card-label">Accesos Hoy</p>
            <p className="metric-card-value">{metrics.todayAccesses}</p>
          </div>
        </div>
        <div className="metric-card kpi-left-border kpi-left-border-success" style={{ minHeight: 160 }}>
          <div className="metric-card-blur" style={{ bottom: '-10%', right: '-10%', width: 130, height: 130, background: 'var(--color-success)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p className="metric-card-label">{revenueLabel[dashboardPeriod]}</p>
            <p className="metric-card-value">{formatCurrency(metrics.monthRevenue)}</p>
          </div>
        </div>
        <div className="metric-card kpi-left-border kpi-left-border-error" style={{ minHeight: 160 }}>
          <div className="metric-card-blur" style={{ top: '-30%', left: '30%', width: 110, height: 110, background: 'var(--color-error)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p className="metric-card-label">Clientes con Deuda</p>
            <p className="metric-card-value">{metrics.debtorsCount}</p>
          </div>
        </div>
        <div className="metric-card kpi-left-border kpi-left-border-warning" style={{ minHeight: 160 }}>
          <div className="metric-card-blur" style={{ bottom: '-20%', right: '20%', width: 120, height: 120, background: 'var(--color-warning)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p className="metric-card-label">Inactivos 30d</p>
            <p className="metric-card-value">{metrics.inactiveClientsCount}</p>
          </div>
        </div>
      </div>

      {/* Charts Row: Peak Hours (2/3) + Recent Accesses (1/3) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <PeakHoursChart data={metrics.peakHours} />
        <RecentAccesses accesses={metrics.recentAccesses} />
      </div>

      {/* Charts Row: Revenue (1/2) + Top Plans (1/2) */}
      <div className="grid grid-2">
        <RevenueChart data={revenueData} />
        <TopPlansChart data={metrics.topPlans} />
      </div>

      {/* Info Cards */}
      <div className="grid grid-3">
        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexShrink: 0 }}>
            <Icons.Bell style={{ color: 'var(--color-warning)' }} />
            <h3 className="label-md" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: 14 }}>
              Próximos a Vencer (7 días)
            </h3>
          </div>
          {expiringSoon.length === 0 ? (
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 13, textAlign: 'center', padding: 16 }}>
              No hay membresías próximas a vencer
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                {expiringSoon.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', backgroundColor: 'var(--color-surface-container-high)',
                    borderRadius: 8,
                    borderLeft: item.daysLeft <= 1 ? '3px solid var(--color-error)' :
                               item.daysLeft <= 3 ? '3px solid var(--color-warning)' :
                               '3px solid var(--color-primary-container)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.clientName}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{item.planName}</div>
                    </div>
                    <div style={{
                      fontWeight: 700, fontSize: 16,
                      color: item.daysLeft <= 1 ? 'var(--color-error)' :
                             item.daysLeft <= 3 ? 'var(--color-warning)' :
                             'var(--color-primary-container)'
                    }}>
                      {item.daysLeft}d
                    </div>
                  </div>
                ))}
              </div>
              <button 
                className="btn btn-primary btn-sm" 
                style={{ width: '100%', marginTop: 12, justifyContent: 'center', flexShrink: 0 }}
                onClick={async () => {
                  const result = await window.electronAPI.whatsapp.checkReminders()
                  if (result.success && result.data) {
                    const sent = result.data.sent
                    if (sent > 0) {
                      showToast('success', `${sent} recordatorio(s) enviado(s)`, 'Recordatorios')
                    } else {
                      showToast('info', 'No se encontraron clientes para notificar', 'Sin novedades')
                    }
                    loadMetrics()
                  }
                }}
              >
                <Icons.Bell />
                Enviar Recordatorios
              </button>
            </>
          )}
        </div>

        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexShrink: 0 }}>
            <Icons.Calendar style={{ color: 'var(--color-primary-container)' }} />
            <h3 className="label-md" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: 14 }}>
              Cumpleaños del Mes
            </h3>
          </div>
          {birthdays.length === 0 ? (
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 13, textAlign: 'center', padding: 16 }}>
              No hay cumpleaños este mes
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              {birthdays.map((b, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', backgroundColor: 'var(--color-surface-container-high)', borderRadius: 8
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    backgroundColor: 'color-mix(in srgb, var(--color-primary-container) 15%, transparent)', color: 'var(--color-primary-container)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14
                  }}>
                    {b.day}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{b.clientName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexShrink: 0 }}>
            <Icons.Clock style={{ color: 'var(--color-warning)' }} />
            <h3 className="label-md" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: 14 }}>
              Inactivos (+30d sin visitar)
            </h3>
          </div>
          {inactiveClients.length === 0 ? (
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 13, textAlign: 'center', padding: 16 }}>
              No hay clientes inactivos
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              {inactiveClients.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', backgroundColor: 'var(--color-surface-container-high)', borderRadius: 8
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.clientName}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{item.planName}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-warning)' }}>
                    {item.daysSinceLastVisit}d
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} />
    </div>
  )
}
