import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { AccessLog, AccessResult } from '../../../shared/types'
import { format, parseISO, startOfDay, endOfDay, startOfMonth } from 'date-fns'

function getResultBadge(result: AccessResult): JSX.Element {
  switch (result) {
    case 'granted':
      return <span className="badge badge-success">Permitido</span>
    case 'denied_expired':
      return <span className="badge badge-error">Memb. Vencida</span>
    case 'denied_inactive':
      return <span className="badge badge-warning">Inactivo</span>
    case 'denied_not_found':
      return <span className="badge badge-error">No Encontrado</span>
    default:
      return <span className="badge badge-default">{result}</span>
  }
}

function getResultIcon(result: AccessResult): JSX.Element {
  switch (result) {
    case 'granted':
      return <Icons.Check />
    case 'denied_expired':
    case 'denied_inactive':
    case 'denied_not_found':
      return <Icons.X />
    default:
      return <Icons.X />
  }
}

export function LogsPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [filterResult, setFilterResult] = useState<string>('all')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('today')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize] = useState(50)
  const [stats, setStats] = useState({
    total: 0,
    granted: 0,
    denied: 0,
    deniedExpired: 0,
    deniedInactive: 0,
    deniedNotFound: 0
  })

  const loadLogs = async () => {
    const resultParam = filterResult === 'all' ? undefined : filterResult
    const options = { page, pageSize, result: resultParam }
    
    const result = dateRange === 'all'
      ? await window.electronAPI.access.getLogs(options)
      : await (() => {
          const now = new Date()
          let startDate: Date
          const endDate: Date = endOfDay(now)

          switch (dateRange) {
            case 'today':
              startDate = startOfDay(now)
              break
            case 'week':
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              break
            case 'month':
              startDate = startOfMonth(now)
              break
            default:
              startDate = new Date(0)
          }

          return window.electronAPI.access.getLogsByDate(
            startDate.toISOString(),
            endDate.toISOString(),
            options
          )
        })()

    if (result.success && result.data) {
      const logsData = result.data.data
      setTotalPages(result.data.totalPages)
      setLogs(logsData)
      
      const granted = logsData.filter(l => l.result === 'granted').length
      const deniedExpired = logsData.filter(l => l.result === 'denied_expired').length
      const deniedInactive = logsData.filter(l => l.result === 'denied_inactive').length
      const deniedNotFound = logsData.filter(l => l.result === 'denied_not_found').length
      
      setStats({
        total: logsData.length,
        granted,
        denied: deniedExpired + deniedInactive + deniedNotFound,
        deniedExpired,
        deniedInactive,
        deniedNotFound
      })
    }
  }

  useEffect(() => {
    setPage(1)
  }, [filterResult, dateRange])

  useEffect(() => {
    loadLogs()
    const interval = setInterval(loadLogs, 10000)
    return () => clearInterval(interval)
  }, [filterResult, dateRange, page])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="grid grid-5" style={{ gap: 16 }}>
        <div className="kpi-card">
          <p className="kpi-label">Total Accesos</p>
          <p className="kpi-value" style={{ fontSize: 28 }}>{stats.total}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Permitidos</p>
          <p className="kpi-value" style={{ color: '#4ade80', fontSize: 28 }}>{stats.granted}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Denegados</p>
          <p className="kpi-value" style={{ color: 'var(--color-error)', fontSize: 28 }}>{stats.denied}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Vencidos</p>
          <p className="kpi-value" style={{ color: '#fbbf24', fontSize: 28 }}>{stats.deniedExpired}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">No Encontrados</p>
          <p className="kpi-value" style={{ fontSize: 28 }}>{stats.deniedNotFound}</p>
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
          <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.History />
            Historial de Accesos
          </h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              style={{ width: 160 }}
            >
              <option value="all">Todos los resultados</option>
              <option value="granted">Permitidos</option>
              <option value="denied_expired">Membresía Vencida</option>
              <option value="denied_inactive">Cliente Inactivo</option>
              <option value="denied_not_found">No Encontrado</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={loadLogs}>
              <Icons.Refresh />
            </button>
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              if (window.electronAPI?.system?.exportCsv) {
                const result = await window.electronAPI.system.exportCsv('access')
                if (result.success) showToast('success', `Exportado: ${result.data}`, 'Exportado')
              }
            }} title="Exportar CSV">
              <Icons.Download />
            </button>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0, maxHeight: 600, overflowY: 'auto' }}>
          {logs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Icons.History />
              </div>
              <h3>No hay registros de acceso</h3>
              <p style={{ marginTop: 8, color: 'var(--color-secondary)' }}>
                No se encontraron registros en este período
              </p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th>Código</th>
                    <th>Resultado</th>
                    <th>Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {format(parseISO(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {log.clientName || (
                          <span style={{ color: 'var(--color-secondary)' }}>Desconocido</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>
                        <span className="badge badge-default">{log.accessCode}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ 
                            color: log.result === 'granted' ? '#4ade80' : 'var(--color-error)' 
                          }}>
                            {getResultIcon(log.result)}
                          </div>
                          {getResultBadge(log.result)}
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                        {log.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16 }}>
              <button className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}>
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => (
                  <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: 'var(--color-secondary)' }}>...</span>}
                    <button className={`btn ${p === page ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      onClick={() => setPage(p)}
                      style={{ minWidth: 36, padding: '4px 8px' }}>
                      {p}
                    </button>
                  </span>
                ))}
              <button className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
