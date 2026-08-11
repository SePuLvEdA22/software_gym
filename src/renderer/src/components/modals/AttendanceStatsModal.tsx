import { useEffect, useState } from 'react'
import { Icons } from '@/components/Icons'
import { Client, ClientAttendanceStats as ClientAttendanceStatsType } from '@shared/types'
import { format, parseISO } from 'date-fns'

interface AttendanceStatsModalProps {
  client: Client
  /** Cuando es true se omite el overlay/modal/header: útil dentro de ventanas-formulario. */
  embedded?: boolean
  onClose: () => void
}

export function AttendanceStatsModal({
  client,
  embedded = false,
  onClose
}: AttendanceStatsModalProps): JSX.Element {
  const [stats, setStats] = useState<ClientAttendanceStatsType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const result = await window.electronAPI.client.getAttendanceStats(client.id)
    if (result.success && result.data) {
      setStats(result.data)
    }
    setLoading(false)
  }

  const content = (
    <>
      <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div className="avatar" style={{ width: 48, height: 48 }}>
              {client.photo ? (
                <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} />
              ) : (
                client.fullName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{client.fullName}</div>
              <div style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                Código: {client.accessCode}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-secondary)' }}>
              Cargando estadísticas...
            </div>
          ) : stats ? (
            <div className="grid grid-2" style={{ gap: 16 }}>
              <div className="kpi-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 4 }}>Visitas Totales</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary-container)' }}>
                  {stats.totalVisits}
                </div>
              </div>
              <div className="kpi-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 4 }}>Visitas este Mes</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-success)' }}>
                  {stats.daysAttendedThisMonth}
                </div>
              </div>
              <div className="kpi-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 4 }}>Primera Visita</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {stats.firstVisit ? format(parseISO(stats.firstVisit), 'dd/MM/yyyy') : 'Sin visitas'}
                </div>
              </div>
              <div className="kpi-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 4 }}>Última Visita</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {stats.lastVisit ? format(parseISO(stats.lastVisit), 'dd/MM/yyyy') : 'Sin visitas'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-secondary)' }}>
              No se pudieron cargar las estadísticas
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
    </>
  )

  if (embedded) {
    return content
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 450 }}>
        <div className="modal-header">
          <h2 className="modal-title">Estadísticas de Asistencia</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>
        {content}
      </div>
    </div>
  )
}
