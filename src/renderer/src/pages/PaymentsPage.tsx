import { useEffect, useState } from 'react'
import { usePersistentState } from '@/hooks/usePersistentState'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Pagination } from '@/components/Pagination'
import { Payment, PaymentMethod, RevenueByPeriod } from '../../../shared/types'
import { formatCurrency } from '@/utils/format'
import { format, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'

const paymentMethods: { value: PaymentMethod; label: string; color: string }[] = [
  { value: 'cash', label: 'Efectivo', color: '#4ade80' },
  { value: 'transfer', label: 'Transferencia', color: '#60a5fa' },
  { value: 'card', label: 'Tarjeta', color: '#f472b6' },
  { value: 'nequi', label: 'Nequi', color: '#ff6b00' },
  { value: 'daviplata', label: 'Daviplata', color: '#a78bfa' },
]

function getPaymentMethodLabel(method: string): string {
  const pm = paymentMethods.find((p) => p.value === method)
  return pm ? pm.label : method
}

function getPaymentMethodBadge(method: string): JSX.Element {
  const pm = paymentMethods.find((p) => p.value === method)
  const color = pm?.color || 'var(--color-secondary)'

  return (
    <span
      className="status-badge status-badge-info"
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      {getPaymentMethodLabel(method)}
    </span>
  )
}

function getInitials(name: string): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function PaymentsPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [payments, setPayments] = useState<Payment[]>([])
  const [filterMethod, setFilterMethod] = usePersistentState('bodyfitgym-payments-method', 'all')
  const [dateRange, setDateRange] = usePersistentState<'today' | 'week' | 'month' | 'all'>(
    'bodyfitgym-payments-daterange',
    'month',
  )
  const [selectedYear, setSelectedYear] = usePersistentState<number>(
    'bodyfitgym-payments-year',
    new Date().getFullYear(),
  )
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize] = useState(50)
  const [revenueByTime, setRevenueByTime] = useState<RevenueByPeriod>({
    morning: 0,
    afternoon: 0,
    total: 0,
  })
  const [yearRevenue, setYearRevenue] = useState<number>(0)
  const [summary, setSummary] = useState({
    total: 0,
    count: 0,
    totalDiscount: 0,
    byMethod: {} as { [key: string]: number },
  })

  const [loading, setLoading] = useState(true)

  const loadPayments = async () => {
    setLoading(true)
    let startDate: Date
    let endDate: Date

    const now = new Date()
    switch (dateRange) {
      case 'today':
        startDate = startOfDay(now)
        endDate = endOfDay(now)
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        endDate = endOfDay(now)
        break
      case 'month':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      default:
        startDate = new Date(0)
        endDate = new Date()
    }

    const methodParam = filterMethod === 'all' ? undefined : filterMethod
    const result = await window.electronAPI.payment.getByDateRange(
      startDate.toISOString(),
      endDate.toISOString(),
      { page, pageSize, method: methodParam },
    )

    if (result.success && result.data) {
      const paymentsData = result.data.data
      setTotalPages(result.data.totalPages)
      setPayments(paymentsData)

      const total = paymentsData.reduce((sum: number, p: Payment) => sum + p.amount, 0)
      const totalDiscount = paymentsData.reduce(
        (sum: number, p: Payment) => sum + (p.discount || 0),
        0,
      )
      const byMethod: { [key: string]: number } = {}

      for (const payment of paymentsData) {
        byMethod[payment.method] = (byMethod[payment.method] || 0) + payment.amount
      }

      setSummary({
        total,
        count: paymentsData.length,
        totalDiscount,
        byMethod,
      })
    }

    const yearResult = await window.electronAPI.dashboard.getRevenueByYear(selectedYear)
    if (yearResult.success && typeof yearResult.data === 'number') {
      setYearRevenue(yearResult.data)
    }

    const timeResult = await window.electronAPI.dashboard.getRevenueByTimeOfDay(
      startDate.toISOString(),
      endDate.toISOString(),
    )
    if (timeResult.success && timeResult.data) {
      setRevenueByTime(timeResult.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    setPage(1)
  }, [filterMethod, dateRange, selectedYear])

  useEffect(() => {
    loadPayments()
  }, [filterMethod, dateRange, selectedYear, page])

  if (loading) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 16, color: 'var(--color-on-surface-variant)' }}>
            Cargando pagos...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="display-lg">Resumen de Facturación</h1>
          <p style={{ color: 'var(--color-on-surface-variant)', marginTop: 4 }}>
            Monitoree pagos, ingresos y transacciones de membresías
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={async () => {
            if (window.electronAPI?.system?.exportCsv) {
              const result = await window.electronAPI.system.exportCsv('payments')
              if (result.success) showToast('success', `Exportado: ${result.data}`, 'Exportado')
            }
          }}
        >
          <Icons.Download />
          Exportar Reporte
        </button>
      </div>

      <div className="grid grid-4">
        <div className="metric-card">
          <div
            className="metric-card-blur"
            style={{
              background: 'var(--color-success)',
              width: 120,
              height: 120,
              top: -40,
              right: -20,
            }}
          />
          <p className="metric-card-label">Total Recaudado</p>
          <p className="metric-card-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(summary.total)}
          </p>
        </div>
        <div className="metric-card">
          <div
            className="metric-card-blur"
            style={{
              background: 'var(--color-info)',
              width: 100,
              height: 100,
              top: -30,
              right: -10,
            }}
          />
          <p className="metric-card-label">Cantidad de Pagos</p>
          <p className="metric-card-value">{summary.count}</p>
        </div>
        <div className="metric-card">
          <div
            className="metric-card-blur"
            style={{
              background: 'var(--color-primary-container)',
              width: 100,
              height: 100,
              bottom: -30,
              left: -10,
            }}
          />
          <p className="metric-card-label">Promedio por Pago</p>
          <p className="metric-card-value">
            {summary.count > 0 ? formatCurrency(summary.total / summary.count) : '$0'}
          </p>
        </div>
        <div className="metric-card">
          <div
            className="metric-card-blur"
            style={{
              background: 'var(--color-primary-container)',
              width: 100,
              height: 100,
              top: -30,
              right: -10,
            }}
          />
          <p className="metric-card-label">Total Descuentos</p>
          <p className="metric-card-value" style={{ color: 'var(--color-primary-container)' }}>
            {formatCurrency(summary.totalDiscount)}
          </p>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="metric-card">
          <div
            className="metric-card-blur"
            style={{
              background: 'var(--color-info)',
              width: 100,
              height: 100,
              bottom: -30,
              left: -10,
            }}
          />
          <p className="metric-card-label">Mañana (antes 12pm)</p>
          <p className="metric-card-value" style={{ color: 'var(--color-info)' }}>
            {formatCurrency(revenueByTime.morning)}
          </p>
        </div>
        <div className="metric-card">
          <div
            className="metric-card-blur"
            style={{ background: '#f472b6', width: 100, height: 100, top: -30, right: -10 }}
          />
          <p className="metric-card-label">Tarde (después 12pm)</p>
          <p className="metric-card-value" style={{ color: '#f472b6' }}>
            {formatCurrency(revenueByTime.afternoon)}
          </p>
        </div>
        <div className="metric-card">
          <div
            className="metric-card-blur"
            style={{
              background: 'var(--color-success)',
              width: 100,
              height: 100,
              top: -30,
              left: -10,
            }}
          />
          <p className="metric-card-label">Efectivo</p>
          <p className="metric-card-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(summary.byMethod['cash'] || 0)}
          </p>
        </div>
        <div className="metric-card">
          <div
            className="metric-card-blur"
            style={{ background: '#a78bfa', width: 100, height: 100, bottom: -30, right: -10 }}
          />
          <p className="metric-card-label">Anual ({selectedYear})</p>
          <p className="metric-card-value" style={{ color: 'var(--color-primary-container)' }}>
            {formatCurrency(yearRevenue)}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        <div className="bento-card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              padding: 'var(--spacing-md)',
            }}
          >
            <h3 className="headline-md" style={{ paddingLeft: 4 }}>
              Transacciones Recientes
            </h3>
            <div
              style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <div
                className="tabs"
                style={{
                  borderBottom: 'none',
                  marginBottom: 0,
                  alignSelf: 'center',
                  flexShrink: 0,
                }}
              >
                {(['today', 'week', 'month', 'all'] as const).map((range) => (
                  <div
                    key={range}
                    className={`tab ${dateRange === range ? 'active' : ''}`}
                    onClick={() => setDateRange(range)}
                  >
                    {range === 'today'
                      ? 'Hoy'
                      : range === 'week'
                        ? 'Semana'
                        : range === 'month'
                          ? 'Mes'
                          : 'Todo'}
                  </div>
                ))}
              </div>
              <select
                className="form-select"
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                style={{
                  width: 140,
                  height: 38,
                  padding: '8px 36px 8px 12px',
                  fontSize: 13,
                  borderRadius: 9999,
                  alignSelf: 'center',
                }}
              >
                <option value="all">Todos los métodos</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
              <select
                className="form-select"
                value={selectedYear}
                onChange={(e) => {
                  const raw = e.target.value.replace(/^0+(?=\d)/, '')
                  setSelectedYear(raw === '' ? new Date().getFullYear() : Number(raw))
                }}
                style={{
                  width: 110,
                  height: 38,
                  padding: '8px 36px 8px 12px',
                  fontSize: 13,
                  borderRadius: 9999,
                  alignSelf: 'center',
                }}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 4 + i).map(
                  (year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ),
                )}
              </select>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadPayments}
                title="Actualizar"
              >
                <Icons.Refresh />
              </button>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--spacing-xl)' }}>
              <div className="empty-state-icon">
                <Icons.CreditCard />
              </div>
              <h3>No hay pagos registrados</h3>
              <p style={{ marginTop: 8, color: 'var(--color-secondary)' }}>
                No se encontraron pagos en este período
              </p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Miembro</th>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Método</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th style={{ textAlign: 'right' }}>Descuento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className={`avatar-initials ${payment.clientName ? '' : ''}`}>
                            {getInitials(payment.clientName || '?')}
                          </div>
                          <span style={{ fontWeight: 500 }}>
                            {payment.clientName || payment.description || 'Pago'}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {format(parseISO(payment.date), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>
                          {payment.description || '-'}
                        </span>
                      </td>
                      <td>{getPaymentMethodBadge(payment.method)}</td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                        }}
                      >
                        {formatCurrency(payment.amount)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          color:
                            payment.discount > 0
                              ? 'var(--color-primary-container)'
                              : 'var(--color-on-surface-variant)',
                        }}
                      >
                        {payment.discount > 0 ? formatCurrency(payment.discount) : '-'}
                      </td>
                      <td>
                        <span className="status-badge status-badge-success">Pagado</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} size="sm" />
          </div>
        </div>

        <div
          style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}
        >
          <div className="bento-card bento-card-highlight">
            <h3 className="headline-md" style={{ marginBottom: 16 }}>
              Acciones Rápidas
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: 8, width: '100%' }}
                onClick={async () => {
                  if (window.electronAPI?.system?.exportCsv) {
                    const result = await window.electronAPI.system.exportCsv('payments')
                    if (result.success)
                      showToast('success', `Exportado: ${result.data}`, 'Exportado')
                  }
                }}
              >
                <Icons.Download />
                Exportar CSV
              </button>
              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: 8, width: '100%' }}
                onClick={loadPayments}
              >
                <Icons.Refresh />
                Actualizar Datos
              </button>
            </div>
          </div>

          <div className="bento-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--color-primary-container)',
                }}
              />
              <h3 className="headline-md">Análisis de Ingresos</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span className="label-md" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  Ingresos Mañana
                </span>
                <span style={{ fontWeight: 600, color: 'var(--color-info)' }}>
                  {formatCurrency(revenueByTime.morning)}
                </span>
              </div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span className="label-md" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  Ingresos Tarde
                </span>
                <span style={{ fontWeight: 600, color: '#f472b6' }}>
                  {formatCurrency(revenueByTime.afternoon)}
                </span>
              </div>
              <div style={{ height: 1, background: 'var(--color-surface-container-highest)' }} />
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span
                  className="label-md"
                  style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}
                >
                  Ingresos Anuales
                </span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary-container)' }}>
                  {formatCurrency(yearRevenue)}
                </span>
              </div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span className="label-md" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  Total Descuentos
                </span>
                <span style={{ fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                  {formatCurrency(summary.totalDiscount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
