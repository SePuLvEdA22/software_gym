import { useEffect, useState } from 'react'
import { useFormSaved } from '@/hooks/useFormSaved'
import { Client, BodyMeasurement, ClientGoal, FitnessGoal } from '../../../shared/types'
import { Icons } from '@/components/Icons'
import { format, parseISO } from 'date-fns'

const goalLabels: Record<FitnessGoal, string> = {
  lose_weight: 'Bajar de Peso',
  gain_muscle: 'Ganar Masa Muscular',
  define: 'Definir',
  maintain: 'Mantener'
}

function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null
  try {
    const birth = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  } catch { return null }
}

export function BodyTrackingPage(): JSX.Element {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  const loadClients = async () => {
    const r = await window.electronAPI.client.getAll({ page: 1, pageSize: 1000 })
    if (r.success && r.data) setClients(r.data.data)
  }

  useEffect(() => { loadClients() }, [])

  const filteredClients = clients.filter(c =>
    c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.documentId.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedClientData = clients.find(c => c.id === selectedClient)

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2>Seguimiento de Clientes</h2>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="search-box" style={{ margin: 16 }}>
          <Icons.Search />
          <input type="text" placeholder="Buscar cliente por nombre o documento..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        {searchQuery && (
          <div style={{ padding: '0 16px 16px' }}>
            {filteredClients.slice(0, 10).map(c => (
              <div key={c.id}
                style={{
                  padding: '10px 12px', cursor: 'pointer', borderRadius: 8,
                  background: selectedClient === c.id ? 'var(--color-primary)' : 'transparent',
                  color: selectedClient === c.id ? '#fff' : 'inherit',
                  marginBottom: 4, display: 'flex', justifyContent: 'space-between'
                }}
                onClick={() => { setSelectedClient(c.id); setSearchQuery('') }}
              >
                <span>{c.fullName}</span>
                <span style={{ fontSize: 13, opacity: 0.7 }}>{c.documentId} | Edad: {calculateAge(c.birthDate) ?? '-'}</span>
              </div>
            ))}
            {filteredClients.length === 0 && <div style={{ color: 'var(--color-secondary)', fontSize: 14 }}>Sin resultados</div>}
          </div>
        )}
      </div>

      {selectedClientData && (
        <div className="grid grid-2" style={{ gap: 20 }}>
          <MeasurementsPanel clientId={selectedClient} clientName={selectedClientData.fullName} />
          <GoalsPanel clientId={selectedClient} clientName={selectedClientData.fullName} />
        </div>
      )}

      {!selectedClientData && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-secondary)' }}>
          <Icons.Activity style={{ width: 48, height: 48, marginBottom: 16 }} />
          <p>Seleccione un cliente para ver su seguimiento</p>
        </div>
      )}
    </div>
  )
}

function MeasurementsPanel({ clientId, clientName }: { clientId: string; clientName: string }): JSX.Element {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])

  const loadMeasurements = async () => {
    const r = await window.electronAPI.bodyTracking.getMeasurements(clientId)
    if (r.success && r.data) setMeasurements(r.data)
  }

  useEffect(() => { if (clientId) loadMeasurements() }, [clientId])

  // Recargar medidas cuando el formulario guarda en su propia ventana
  useFormSaved('measurement', () => loadMeasurements())

  const latest = measurements[0]

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Medidas Corporales - {clientName}</h3>
        <button className="btn btn-sm btn-primary" onClick={() => window.electronAPI.window.openForm('measurement', { clientId })}>
          <Icons.Plus /> Nueva Medición
        </button>
      </div>

      {latest && (
        <div className="grid grid-3" style={{ padding: 16, gap: 12 }}>
          <MeasurementItem label="Peso" value={latest.weight} unit="kg" />
          <MeasurementItem label="Altura" value={latest.height} unit="cm" />
          <MeasurementItem label="Cuello" value={latest.neck} unit="cm" />
          <MeasurementItem label="Hombros" value={latest.shoulders} unit="cm" />
          <MeasurementItem label="Pecho" value={latest.chest} unit="cm" />
          <MeasurementItem label="Brazo Izq" value={latest.leftArm} unit="cm" />
          <MeasurementItem label="Brazo Der" value={latest.rightArm} unit="cm" />
          <MeasurementItem label="Cintura" value={latest.waist} unit="cm" />
          <MeasurementItem label="Cadera" value={latest.hips} unit="cm" />
          <MeasurementItem label="Pierna Izq" value={latest.leftThigh} unit="cm" />
          <MeasurementItem label="Pierna Der" value={latest.rightThigh} unit="cm" />
          <MeasurementItem label="Pantorrilla Izq" value={latest.leftCalf} unit="cm" />
          <MeasurementItem label="Pantorrilla Der" value={latest.rightCalf} unit="cm" />
          {latest.bodyFat != null && <MeasurementItem label="% Grasa" value={latest.bodyFat} unit="%" />}
        </div>
      )}

      {measurements.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          <div style={{ padding: 12, fontSize: 13, fontWeight: 600, color: 'var(--color-secondary)' }}>Historial</div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Peso</th>
                  <th>Cintura</th>
                  <th>Pecho</th>
                  <th>Brazo</th>
                  <th>Pierna</th>
                  <th>% Grasa</th>
                </tr>
              </thead>
              <tbody>
                {measurements.slice(0, 20).map(m => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 13 }}>{format(parseISO(m.date), 'dd/MM/yyyy')}</td>
                    <td>{m.weight ?? '-'}</td>
                    <td>{m.waist ?? '-'}</td>
                    <td>{m.chest ?? '-'}</td>
                    <td>{m.leftArm ?? '-'}</td>
                    <td>{m.leftThigh ?? '-'}</td>
                    <td>{m.bodyFat != null ? `${m.bodyFat}%` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}

function MeasurementItem({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }): JSX.Element {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--color-bg)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--color-secondary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>
        {value != null ? `${value} ${unit}` : '-'}
      </div>
    </div>
  )
}

function GoalsPanel({ clientId, clientName }: { clientId: string; clientName: string }): JSX.Element {
  const [goals, setGoals] = useState<ClientGoal[]>([])

  const loadGoals = async () => {
    const r = await window.electronAPI.bodyTracking.getGoals(clientId)
    if (r.success && r.data) setGoals(r.data)
  }

  useEffect(() => { if (clientId) loadGoals() }, [clientId])

  // Recargar objetivos cuando el formulario guarda en su propia ventana
  useFormSaved('goal', () => loadGoals())

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Objetivos - {clientName}</h3>
        <button className="btn btn-sm btn-primary" onClick={() => window.electronAPI.window.openForm('goal', { clientId })}>
          <Icons.Plus /> Nuevo Objetivo
        </button>
      </div>

      <div style={{ padding: 16 }}>
        {goals.filter(g => g.isActive).map(g => (
          <div key={g.id} style={{ padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{goalLabels[g.goal] || g.goal}</div>
            <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
              Desde: {format(parseISO(g.startDate), 'dd/MM/yyyy')}
              {g.targetDate && ` | Hasta: ${format(parseISO(g.targetDate), 'dd/MM/yyyy')}`}
            </div>
            {g.notes && <div style={{ fontSize: 12, marginTop: 4 }}>{g.notes}</div>}
          </div>
        ))}
        {goals.filter(g => g.isActive).length === 0 && (
          <div style={{ color: 'var(--color-secondary)', fontSize: 14 }}>Sin objetivos activos</div>
        )}

        {goals.filter(g => !g.isActive).length > 0 && (
          <>
            <div style={{ marginTop: 20, fontSize: 13, fontWeight: 600, color: 'var(--color-secondary)' }}>Historial</div>
            {goals.filter(g => !g.isActive).map(g => (
              <div key={g.id} style={{ padding: '8px 12px', background: 'var(--color-bg)', borderRadius: 8, marginTop: 6, opacity: 0.6 }}>
                <div style={{ fontSize: 13 }}>{goalLabels[g.goal] || g.goal}</div>
                <div style={{ fontSize: 11, color: 'var(--color-secondary)' }}>
                  {format(parseISO(g.startDate), 'dd/MM/yyyy')} - {format(parseISO(g.createdAt), 'dd/MM/yyyy')}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

    </div>
  )
}
