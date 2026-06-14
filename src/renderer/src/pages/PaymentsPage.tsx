import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Payment, PaymentMethod, RevenueByPeriod } from '../../../shared/types'
import { formatCurrency } from '@/utils/format'
import { format, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'

const paymentMethods: { value: PaymentMethod; label: string; color: string }[] = [
  { value: 'cash', label: 'Efectivo', color: '#4ade80' },
  { value: 'transfer', label: 'Transferencia', color: '#60a5fa' },
  { value: 'card', label: 'Tarjeta', color: '#f472b6' },
  { value: 'nequi', label: 'Nequi', color: '#ff6b00' },
  { value: 'daviplata', label: 'Daviplata', color: '#a78bfa' }
]

function getPaymentMethodLabel(method: string): string {
  const pm = paymentMethods.find(p => p.value === method)
  return pm ? pm.label : method
}

function getPaymentMethodBadge(method: string): JSX.Element {
  const pm = paymentMethods.find(p => p.value === method)
  const color = pm?.color || 'var(--color-secondary)'
  
  return (
    <span 
      className="badge" 
      style={{ 
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`
      }}
    >
      {getPaymentMethodLabel(method)}
    </span>
  )
}

export function PaymentsPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [payments, setPayments] = useState<Payment[]>([])
  const [filterMethod, setFilterMethod] = useState<string>('all')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize] = useState(50)
  const [revenueByTime, setRevenueByTime] = useState<RevenueByPeriod>({ morning: 0, afternoon: 0, total: 0 })
  const [yearRevenue, setYearRevenue] = useState<number>(0)
  const [summary, setSummary] = useState({
    total: 0,
    count: 0,
    totalDiscount: 0,
    byMethod: {} as { [key: string]: number }
  })

  const loadPayments = async () => {
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

    const result = await window.electronAPI.payment.getByDateRange(
      startDate.toISOString(),
      endDate.toISOString(),
      { page, pageSize }
    )

    if (result.success && result.data) {
      let filteredPayments = result.data.data
      setTotalPages(result.data.totalPages)
      
      if (filterMethod !== 'all') {
        filteredPayments = filteredPayments.filter(p => p.method === filterMethod)
      }
      
      setPayments(filteredPayments)
      
      const total = filteredPayments.reduce((sum, p) => sum + p.amount, 0)
      const totalDiscount = filteredPayments.reduce((sum, p) => sum + (p.discount || 0), 0)
      const byMethod: { [key: string]: number } = {}
      
      for (const payment of filteredPayments) {
        byMethod[payment.method] = (byMethod[payment.method] || 0) + payment.amount
      }
      
      setSummary({
        total,
        count: filteredPayments.length,
        totalDiscount,
        byMethod
      })
    }

    const yearResult = await window.electronAPI.dashboard.getRevenueByYear(selectedYear)
    if (yearResult.success && typeof yearResult.data === 'number') {
      setYearRevenue(yearResult.data)
    }

    const timeResult = await window.electronAPI.dashboard.getRevenueByTimeOfDay(
      startDate.toISOString(),
      endDate.toISOString()
    )
    if (timeResult.success && timeResult.data) {
      setRevenueByTime(timeResult.data)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [filterMethod, dateRange, selectedYear])

  useEffect(() => {
    loadPayments()
  }, [filterMethod, dateRange, selectedYear, page])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="grid grid-4">
          <div className="kpi-card">
            <p className="kpi-label">Total Recaudado</p>
            <p className="kpi-value" style={{ color: '#4ade80' }}>
              {formatCurrency(summary.total)}
            </p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Cantidad de Pagos</p>
            <p className="kpi-value">{summary.count}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Promedio por Pago</p>
            <p className="kpi-value" style={{ fontSize: 28 }}>
              {summary.count > 0 ? formatCurrency(summary.total / summary.count) : '$0'}
            </p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Total Descuentos</p>
            <p className="kpi-value" style={{ color: '#ff6b00' }}>
              {formatCurrency(summary.totalDiscount)}
            </p>
          </div>
        </div>

        <div className="grid grid-4">
          <div className="kpi-card">
            <p className="kpi-label">Mañana (antes 12pm)</p>
            <p className="kpi-value" style={{ color: '#60a5fa' }}>
              {formatCurrency(revenueByTime.morning)}
            </p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Tarde (después 12pm)</p>
            <p className="kpi-value" style={{ color: '#f472b6' }}>
              {formatCurrency(revenueByTime.afternoon)}
            </p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Efectivo</p>
            <p className="kpi-value" style={{ color: '#4ade80' }}>
              {formatCurrency(summary.byMethod['cash'] || 0)}
            </p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Anual ({selectedYear})</p>
            <p className="kpi-value" style={{ color: '#ff6b00' }}>
              {formatCurrency(yearRevenue)}
            </p>
          </div>
        </div>

      <div className="card">
        <div className="card-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Historial de Pagos</h3>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              if (window.electronAPI?.system?.exportCsv) {
                const result = await window.electronAPI.system.exportCsv('payments')
                if (result.success) showToast('success', `Exportado: ${result.data}`, 'Exportado')
              }
            }} title="Exportar CSV">
              <Icons.Download />
            </button>
            <div className="tabs" style={{ borderBottom: 'none' }}>
              {(['today', 'week', 'month', 'all'] as const).map(range => (
                <div 
                  key={range}
                  className={`tab ${dateRange === range ? 'active' : ''}`}
                  onClick={() => setDateRange(range)}
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: 13,
                    borderRadius: 8,
                    borderBottom: dateRange === range ? '2px solid var(--color-primary-container)' : 'none'
                  }}
                >
                  {range === 'today' ? 'Hoy' 
                    : range === 'week' ? 'Semana' 
                    : range === 'month' ? 'Mes' 
                    : 'Todo'}
                </div>
              ))}
            </div>
            <select 
              className="form-select"
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              style={{ width: 140 }}
            >
              <option value="all">Todos los métodos</option>
              {paymentMethods.map(pm => (
                <option key={pm.value} value={pm.value}>{pm.label}</option>
              ))}
            </select>
            <select 
              className="form-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ width: 110 }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 4 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={loadPayments}>
              <Icons.Refresh />
            </button>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {payments.length === 0 ? (
            <div className="empty-state">
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
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Descripción</th>
                        <th>Método</th>
                        <th style={{ textAlign: 'right' }}>Monto</th>
                        <th style={{ textAlign: 'right' }}>Desc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
                            {format(parseISO(payment.date), 'dd/MM/yyyy HH:mm')}
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            {payment.clientName || payment.description || 'Pago'}
                          </td>
                          <td>
                            <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                              {payment.description || '-'}
                            </span>
                          </td>
                          <td>{getPaymentMethodBadge(payment.method)}</td>
                          <td style={{ 
                            textAlign: 'right', 
                            fontWeight: 600,
                            fontFamily: 'monospace'
                          }}>
                            {formatCurrency(payment.amount)}
                          </td>
                          <td style={{ 
                            textAlign: 'right', 
                            fontFamily: 'monospace',
                            color: payment.discount > 0 ? '#ff6b00' : 'var(--color-secondary)'
                          }}>
                            {payment.discount > 0 ? formatCurrency(payment.discount) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
            </div>
          )}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16 }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                Página {page} de {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
