import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { MessageTemplate, Client } from '../../../shared/types'
import { Icons } from '@/components/Icons'

export function MessagesPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
  const [sendModal, setSendModal] = useState<{ template: MessageTemplate; client?: Client; all?: boolean } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [templateSearch, setTemplateSearch] = useState('')
  const [form, setForm] = useState({ name: '', type: 'whatsapp' as 'email' | 'whatsapp', subject: '', content: '', variables: '' })

  const loadTemplates = async () => {
    const r = await window.electronAPI.messageTemplates.getAll()
    if (r.success) setTemplates(r.data)
  }

  const loadClients = async () => {
    const r = await window.electronAPI.client.getAll({ page: 1, pageSize: 1000 })
    if (r.success) setClients(r.data.data)
  }

  useEffect(() => { loadTemplates(); loadClients() }, [])

  const handleSaveTemplate = async () => {
    if (!form.name || !form.content) { showToast('error', 'Nombre y contenido son requeridos'); return }
    const vars = form.variables ? form.variables.split(',').map(v => v.trim()).filter(Boolean) : []
    if (editingTemplate) {
      const r = await window.electronAPI.messageTemplates.update(editingTemplate.id, { ...form, variables: vars })
      if (r.success) { showToast('success', 'Plantilla actualizada'); setShowForm(false); loadTemplates() }
      else showToast('error', r.error)
    } else {
      const r = await window.electronAPI.messageTemplates.create({ ...form, variables: vars })
      if (r.success) { showToast('success', 'Plantilla creada'); setShowForm(false); loadTemplates() }
      else showToast('error', r.error)
    }
  }

  const handleSend = async () => {
    if (!sendModal) return
    const { template, client, all } = sendModal
    if (all) {
      const r = await window.electronAPI.messageTemplates.sendToAll(template.id)
      if (r.success) showToast('success', `Mensaje enviado a ${r.data} clientes`)
      else showToast('error', r.error)
    } else if (client) {
      const r = await window.electronAPI.messageTemplates.sendToClient(template.id, client.id)
      if (r.success) showToast('success', 'Mensaje enviado')
      else showToast('error', r.error)
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
        <button className="btn btn-primary" style={{ marginTop: 12, paddingBottom: 12 }} onClick={() => { setEditingTemplate(null); setForm({ name: '', type: 'whatsapp', subject: '', content: '', variables: '' }); setShowForm(true) }}>
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
                      <button className="btn btn-sm btn-secondary" onClick={() => { setEditingTemplate(t); setForm({ name: t.name, type: t.type, subject: t.subject, content: t.content, variables: (t.variables || []).join(', ') }); setShowForm(true) }} title="Editar"><Icons.Edit /></button>
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
              <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }} onClick={() => setSendModal({ ...sendModal, all: true, client: undefined })}>
                Enviar a TODOS los clientes activos
              </button>
              <div style={{ borderTop: '1px solid var(--color-border)', margin: '12px 0', textAlign: 'center', paddingTop: 12, color: 'var(--color-secondary)', fontSize: 13 }}>
                O enviar a un cliente específico:
              </div>
              <div className="search-box" style={{ marginBottom: 12 }}>
                <Icons.Search />
                <input type="text" placeholder="Buscar cliente..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {filteredClients.slice(0, 20).map(c => (
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
              </div>
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

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}><Icons.Close /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input type="text" className="form-input" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Promoción Julio" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-select" value={form.type}
                    onChange={e => setForm(p => ({ ...p, type: e.target.value as 'email' | 'whatsapp' }))}>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Correo Electrónico</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Asunto {form.type === 'email' ? '*' : '(opcional)'}</label>
                  <input type="text" className="form-input" value={form.subject}
                    onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder={form.type === 'email' ? 'Asunto del correo' : 'No aplica para WhatsApp'} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Contenido *</label>
                <textarea className="form-input" value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  rows={6} style={{ resize: 'vertical', fontFamily: 'monospace' }}
                  placeholder="Ej: Hola {{nombre}}, tenemos una promoción especial..." />
                <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
                  Variables disponibles: {'{nombre}'}, {'{documento}'}, {'{telefono}'}, {'{plan}'}, {'{vencimiento}'}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Variables (separadas por coma)</label>
                <input type="text" className="form-input" value={form.variables}
                  onChange={e => setForm(p => ({ ...p, variables: e.target.value }))}
                  placeholder="nombre, plan, vencimiento" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveTemplate}>
                {editingTemplate ? 'Actualizar' : 'Crear Plantilla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
