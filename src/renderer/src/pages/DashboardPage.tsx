import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { AccessLog, PeakHour, PlanStat, InactiveClient } from '../../../shared/types'
import { formatCurrency } from '@/utils/format'
import { format, parseISO } from 'date-fns'

const COLORS = ['#ff6b00', '#4ade80', '#ffb4ab', '#60a5fa', '#f472b6', '#a78bfa']

interface KpiCardProps {
  label: string
  value: string | number
  icon: keyof typeof Icons
  trend?: string
  trendUp?: boolean
  color?: 'primary' | 'success' | 'error' | 'warning'
}

function KpiCard({ label, value, icon, trend, trendUp, color = 'primary' }: KpiCardProps): JSX.Element {
  const IconComponent = Icons[icon]
  const colorClass = {
    primary: '#ff6b00',
    success: '#4ade80',
    error: '#ffb4ab',
    warning: '#fbbf24'
  }[color]

  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="kpi-label">{label}</p>
          <p className="kpi-value" style={{ color: colorClass }}>{value}</p>
        </div>
        <div 
          style={{ 
            width: 40, 
            height: 40, 
            borderRadius: 8, 
            background: `${colorClass}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colorClass
          }}
        >
          <IconComponent />
        </div>
      </div>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: trendUp ? '#4ade80' : '#ffb4ab' }}>
          {trendUp ? <Icons.TrendingUp /> : null}
          <span>{trend}</span>
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
    <div className="quick-actions">
      {actions.map((action) => {
        const IconComponent = Icons[action.icon]
        return (
          <div 
            key={action.id} 
            className="quick-action"
            onClick={() => onAction(action.id)}
          >
            <div className="quick-action-icon">
              <IconComponent />
            </div>
            <span className="quick-action-label">{action.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function RecentAccesses({ accesses }: { accesses: AccessLog[] }): JSX.Element {
  const getResultBadge = (result: string) => {
    switch (result) {
      case 'granted':
        return <span className="badge badge-success">Permitido</span>
      case 'denied_expired':
        return <span className="badge badge-error">Vencido</span>
      case 'denied_inactive':
        return <span className="badge badge-warning">Inactivo</span>
      default:
        return <span className="badge badge-error">Denegado</span>
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
    <div className="card" style={{ flex: 1, minHeight: 300 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Accesos Recientes</h3>
        <Icons.History />
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {accesses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Icons.History />
            </div>
            <p>No hay accesos registrados hoy</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
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
                {accesses.slice(0, 10).map((access) => (
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
    </div>
  )
}

function RevenueChart({ data }: { data: { month: string; revenue: number }[] }): JSX.Element {
  return (
    <div className="card" style={{ flex: 1, minHeight: 300 }}>
      <div className="card-header">
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Ingresos Mensuales</h3>
      </div>
      <div className="card-body" style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff6b00" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ff6b00" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="month" stroke="#a98a7d" fontSize={12} />
            <YAxis stroke="#a98a7d" fontSize={12} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
            <Tooltip
              contentStyle={{ 
                backgroundColor: '#201f1f', 
                border: '1px solid #2a2a2a',
                borderRadius: 8,
                color: '#e5e2e1'
              }}
              formatter={(value: number) => [formatCurrency(value), 'Ingresos']}
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#ff6b00" 
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
    <div className="card" style={{ flex: 1, minHeight: 300 }}>
      <div className="card-header">
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Horas Pico</h3>
      </div>
      <div className="card-body" style={{ height: 250 }}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="hour" stroke="#a98a7d" fontSize={12} />
              <YAxis stroke="#a98a7d" fontSize={12} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: '#201f1f', 
                  border: '1px solid #2a2a2a',
                  borderRadius: 8,
                  color: '#e5e2e1'
                }}
              />
              <Bar dataKey="count" fill="#ff6b00" radius={[4, 4, 0, 0]} />
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
    <div className="card" style={{ flex: 1, minHeight: 300 }}>
      <div className="card-header">
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Planes Más Vendidos</h3>
      </div>
      <div className="card-body" style={{ height: 250 }}>
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
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ 
                  backgroundColor: '#201f1f', 
                  border: '1px solid #2a2a2a',
                  borderRadius: 8,
                  color: '#e5e2e1'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        {data.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16, justifyContent: 'center' }}>
            {data.map((plan, index) => (
              <div key={plan.planName} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ 
                  width: 12, 
                  height: 12, 
                  borderRadius: 2, 
                  backgroundColor: COLORS[index % COLORS.length] 
                }} />
                <span style={{ fontSize: 12 }}>{plan.planName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const { dashboardMetrics, setDashboardMetrics, setTriggerNewClientModal } = useAppStore()
  const [localLoading, setLocalLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([])
  const [expiringSoon, setExpiringSoon] = useState<{ clientId: string; clientName: string; planName: string; endDate: string; daysLeft: number }[]>([])
  const [birthdays, setBirthdays] = useState<{ clientId: string; clientName: string; day: number }[]>([])
  const [inactiveClients, setInactiveClients] = useState<InactiveClient[]>([])

  const loadMetrics = async () => {
    const [result, revenueResult, expiringResult, birthdayResult, inactiveResult] = await Promise.all([
      window.electronAPI.dashboard.getMetrics(),
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
    const interval = setInterval(loadMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleQuickAction = async (action: string) => {
    switch (action) {
      case 'new-client':
        navigate('/clients')
        setTriggerNewClientModal(true)
        break
      case 'check-access':
        navigate('/access')
        break
      case 'new-payment':
        navigate('/memberships')
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
        <div style={{
          width: 40, height: 40,
          border: '4px solid rgba(255,107,0,0.2)',
          borderTopColor: '#ff6b00',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <QuickActions onAction={handleQuickAction} />

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(6, 1fr)', 
        gap: 24 
      }}>
        <KpiCard
          label="Clientes Totales"
          value={metrics.totalClients}
          icon="Users"
          color="primary"
        />
        <KpiCard
          label="Clientes Activos"
          value={metrics.activeClients}
          icon="Check"
          color="success"
        />
        <KpiCard
          label="Accesos Hoy"
          value={metrics.todayAccesses}
          icon="Access"
          color="primary"
        />
        <KpiCard
          label="Ingresos Mes"
          value={formatCurrency(metrics.monthRevenue)}
          icon="CreditCard"
          color="success"
        />
        <KpiCard
          label="Clientes con Deuda"
          value={metrics.debtorsCount}
          icon="Bell"
          color="error"
        />
        <KpiCard
          label="Inactivos 30d"
          value={metrics.inactiveClientsCount}
          icon="Clock"
          color="warning"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        <RevenueChart data={revenueData} />
        <PeakHoursChart data={metrics.peakHours} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        <TopPlansChart data={metrics.topPlans} />
        <RecentAccesses accesses={metrics.recentAccesses} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icons.Bell style={{ color: 'var(--color-warning)' }} />
              Próximos a Vencer (7 días)
            </h3>
          </div>
          <div className="card-body">
            {expiringSoon.length === 0 ? (
              <p style={{ color: 'var(--color-secondary)', fontSize: 13, textAlign: 'center', padding: 16 }}>
                No hay membresías próximas a vencer
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {expiringSoon.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', backgroundColor: 'var(--color-surface-container)',
                    borderRadius: 8, border: item.daysLeft <= 1 ? '1px solid var(--color-error)' : 'none'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.clientName}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{item.planName}</div>
                    </div>
                    <div style={{
                      fontWeight: 700, fontSize: 16,
                      color: item.daysLeft <= 1 ? 'var(--color-error)' : item.daysLeft <= 3 ? 'var(--color-warning)' : 'var(--color-primary-container)'
                    }}>
                      {item.daysLeft}d
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icons.Calendar style={{ color: 'var(--color-primary-container)' }} />
              Cumpleaños del Mes
            </h3>
          </div>
          <div className="card-body">
            {birthdays.length === 0 ? (
              <p style={{ color: 'var(--color-secondary)', fontSize: 13, textAlign: 'center', padding: 16 }}>
                No hay cumpleaños este mes
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {birthdays.map((b, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 12px', backgroundColor: 'var(--color-surface-container)', borderRadius: 8
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      backgroundColor: 'rgba(255,107,0,0.15)', color: '#ff6b00',
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
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icons.Clock style={{ color: 'var(--color-warning)' }} />
              Inactivos (+30d sin visitar)
            </h3>
          </div>
          <div className="card-body">
            {inactiveClients.length === 0 ? (
              <p style={{ color: 'var(--color-secondary)', fontSize: 13, textAlign: 'center', padding: 16 }}>
                No hay clientes inactivos
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {inactiveClients.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', backgroundColor: 'var(--color-surface-container)', borderRadius: 8
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.clientName}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{item.planName}</div>
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
      </div>
    </div>
  )
}
