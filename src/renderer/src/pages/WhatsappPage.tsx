import { useEffect, useState, useCallback } from 'react'
import { Icons } from '@/components/Icons'
import { Pagination } from '@/components/Pagination'
import { WhatsappMessage, MessageType, MessageStatus } from '../../../shared/types'
import { format, parseISO } from 'date-fns'

const messageTypeLabels: Record<MessageType, string> = {
  welcome: 'Bienvenida',
  payment_confirmation: 'Confirmación de Pago',
  expiry_reminder_3d: 'Recordatorio 3 días',
  expiry_reminder_1d: 'Recordatorio 1 día',
  expiry_reminder_same_day: 'Recordatorio mismo día',
  membership_expired: 'Membresía Vencida'
}

function getStatusBadge(status: MessageStatus): JSX.Element {
  switch (status) {
    case 'sent':
      return <span className="badge badge-success">Enviado</span>
    case 'failed':
      return <span className="badge badge-error">Fallido</span>
    case 'pending':
      return <span className="badge badge-default">Pendiente</span>
  }
}

export function WhatsappPage(): JSX.Element {
  const [messages, setMessages] = useState<WhatsappMessage[]>([])
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize] = useState(50)

  const loadMessages = useCallback(async (p?: number) => {
    try {
      const result = await window.electronAPI.whatsapp.getHistory({ page: p || page, pageSize })
      if (result.success && result.data) {
        setMessages(result.data.data)
        setTotalPages(result.data.totalPages)
      }
    } catch (e) {
      console.error('Error loading WhatsApp history:', e)
    }
  }, [page, pageSize])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    loadMessages(1)
  }, [filterType, filterStatus])

  const filtered = messages.filter(m => {
    if (filterType !== 'all' && m.messageType !== filterType) return false
    if (filterStatus !== 'all' && m.status !== filterStatus) return false
    return true
  })

  const sentCount = messages.filter(m => m.status === 'sent').length
  const failedCount = messages.filter(m => m.status === 'failed').length
  const pendingCount = messages.filter(m => m.status === 'pending').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="grid grid-4" style={{ gap: 16 }}>
        <div className="kpi-card">
          <p className="kpi-label">Total Mensajes</p>
          <p className="kpi-value" style={{ fontSize: 28 }}>{messages.length}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Enviados</p>
          <p className="kpi-value" style={{ color: 'var(--color-success)', fontSize: 28 }}>{sentCount}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Fallidos</p>
          <p className="kpi-value" style={{ color: 'var(--color-error)', fontSize: 28 }}>{failedCount}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Pendientes</p>
          <p className="kpi-value" style={{ color: 'var(--color-warning)', fontSize: 28 }}>{pendingCount}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Bell />
            Notificaciones Enviadas
          </h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select className="form-select" value={filterType}
              onChange={e => setFilterType(e.target.value)} style={{ width: 200 }}>
              <option value="all">Todos los tipos</option>
              {Object.entries(messageTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select className="form-select" value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)} style={{ width: 140 }}>
              <option value="all">Todos los estados</option>
              <option value="sent">Enviados</option>
              <option value="failed">Fallidos</option>
              <option value="pending">Pendientes</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={() => { setPage(1); loadMessages(1) }}>
              <Icons.Refresh />
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Tipo</th>
                <th>Mensaje</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(msg => (
                <tr key={msg.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                    {msg.createdAt ? format(parseISO(msg.createdAt), 'dd/MM HH:mm') : '-'}
                  </td>
                  <td style={{ fontWeight: 500 }}>{msg.clientName || msg.clientId.slice(0, 8)}</td>
                  <td style={{ fontSize: 13 }}>{msg.phone}</td>
                  <td style={{ fontSize: 13 }}>{messageTypeLabels[msg.messageType] || msg.messageType}</td>
                  <td style={{ fontSize: 13, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {msg.message}
                  </td>
                  <td>{getStatusBadge(msg.status)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-secondary)' }}>
                  No hay notificaciones
                </td></tr>
              )}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} size="sm" />
        </div>
      </div>
    </div>
  )
}
