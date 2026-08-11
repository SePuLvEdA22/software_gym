import { useEffect, useState } from 'react'
import { useFormSaved } from '@/hooks/useFormSaved'
import { useAppStore } from '@/store/appStore'
import { MessageTemplate, Client } from '../../../shared/types'
import { Icons } from '@/components/Icons'

export function MessagesPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [sendModal, setSendModal] = useState<{ template: MessageTemplate; client?: Client; all?: boolean } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [templateSearch, setTemplateSearch] = useState('')
  const [clientPage, setClientPage] = useState(1)
  const [clientTotalPages, setClientTotalPages] = useState(1)
  const [clientPageSize] = useState(50)

  const loadTemplates = async () => {
    const r = await window.electronAPI.messageTemplates.getAll()
    if (r.success && r.data) setTemplates(r.data)
  }

  const loadClients = async (p?: number) => {
    const r = await window.electronAPI.client.getAll({ page: p || clientPage, pageSize: clientPageSize })
    if (r.success && r.data) {
      setClients(r.data.data)
      setClientTotalPages(r.data.totalPages)
    }
  }

  useEffect(() => { loadTemplates(); loadClients() }, [])

  // Recargar plantillas cuando el formulario guarda en su propia ventana
  useFormSaved('template', (message) => {
    if (message) showToast('success', message)
    loadTemplates()
  })


  const handleSend = async () => {
    if (!sendModal) return
    const { template, client, all } = sendModal
    if (all) {
      const r = await window.electronAPI.messageTemplates.sendToAll(template.id)
      if (r.success && r.data) showToast('success', `Mensaje enviado a ${r.data} clientes`)
      else showToast('error', r.error || 'Error al enviar')
    } else if (client) {
      const r = await window.electronAPI.messageTemplates.sendToClient(template.id, client.id)
      if (r.success) showToast('success', 'Mensaje enviado')
      else showToast('error', r.error || 'Error al enviar')
    }
    setSendModal(null)
  }

  const handleSendToExpiring = async (templateId: string) => {
    const r = await window.electronAPI.messageTemplates.sendToExpiring(templateId, 7)
    if (r.success && r.data) {
      showToast('success', `Plantilla enviada a ${r.data.sent} clientes por vencer (${r.data.failed} fallidos)`)
    } else {
      showToast('error', r.error || 'Error al enviar')
    }
    setSendModal(null)
  }

  const filteredClients = clients.filter(c =>
    c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  )

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2>Mensajes y Promociones</h2>
        <button className="btn btn-primary" style={{ marginTop: 12, paddingBottom: 12 }} onClick={() => window.electronAPI.window.openForm('template')}>
          <Icons.Plus /> Nueva Plantilla
        </button>
      </div>

      <div className="search-box" style={{ marginBottom: 16 }}>
        <Icons.Search />
        <input type="text" placeholder="Buscar plantilla por nombre..."
          value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} />
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Asunto</th>
                <th>Contenido</th>
                <th>Variables</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {templates.filter(t => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase())).map(t => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td><span className={`badge ${t.type === 'whatsapp' ? 'badge-success' : 'badge-info'}`}>{t.type === 'whatsapp' ? 'WhatsApp' : 'Email'}</span></td>
                  <td style={{ fontSize: 13 }}>{t.subject || '-'}</td>
                  <td style={{ fontSize: 13, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.content}</td>
                  <td style={{ fontSize: 12 }}>{t.variables?.join(', ') || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => setSendModal({ template: t })} title="Enviar"><Icons.Send /></button>
                      <button className="btn btn-sm btn-secondary" onClick={() => window.electronAPI.window.openForm('template', { id: t.id })} title="Editar"><Icons.Edit /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--color-secondary)' }}>No hay plantillas. Cree una para comenzar.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {sendModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSendModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Enviar: {sendModal.template.name}</h2>
              <button className="modal-close" onClick={() => setSendModal(null)}><Icons.Close /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16, fontSize: 14 }}>Seleccione el destinatario:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSendModal({ ...sendModal, all: true, client: undefined })}>
                  Enviar a TODOS los clientes activos
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => handleSendToExpiring(sendModal.template.id)}
                >
                  Enviar a clientes por vencer (7 días)
                </button>
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', margin: '12px 0', textAlign: 'center', paddingTop: 12, color: 'var(--color-secondary)', fontSize: 13 }}>
                O enviar a un cliente específico:
              </div>
              <div className="search-box" style={{ marginBottom: 12 }}>
                <Icons.Search />
                <input type="text" placeholder="Buscar cliente..."
                  value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setClientPage(1); loadClients(1) }} />
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {filteredClients.map(c => (
                  <div key={c.id}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 6, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => setSendModal({ ...sendModal, client: c, all: false })}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>{c.fullName}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-secondary)' }}>{c.phone}</span>
                  </div>
                ))}
                {filteredClients.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-secondary)' }}>
                    No se encontraron clientes
                  </div>
                )}
              </div>
              {clientTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <button className="btn btn-secondary btn-sm" disabled={clientPage <= 1}
                    onClick={() => { setClientPage(p => p - 1); loadClients(clientPage - 1) }}>Anterior</button>
                  <span style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                    Pág. {clientPage} de {clientTotalPages}
                  </span>
                  <button className="btn btn-secondary btn-sm" disabled={clientPage >= clientTotalPages}
                    onClick={() => { setClientPage(p => p + 1); loadClients(clientPage + 1) }}>Siguiente</button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSendModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSend}>
                {sendModal.all ? 'Enviar a Todos' : sendModal.client ? `Enviar a ${sendModal.client.fullName}` : 'Seleccione destino'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
