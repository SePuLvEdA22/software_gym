import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Client } from '@shared/types'
import { AttendanceStatsModal } from '@/components/modals/AttendanceStatsModal'
import { FormWindowShell } from '@/components/FormWindowShell'

export function StatsFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('clientId') || ''

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) {
      setLoading(false)
      return
    }
    window.electronAPI.client
      .getById(clientId)
      .then((result: any) => {
        if (result.success && result.data) setClient(result.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) {
    return (
      <FormWindowShell title="Estadísticas de Asistencia">
        <div className="spinner" style={{ margin: '48px auto' }} />
      </FormWindowShell>
    )
  }

  if (!client) {
    return (
      <FormWindowShell title="Estadísticas de Asistencia">
        <p style={{ color: 'var(--color-secondary)' }}>No se encontró el cliente seleccionado.</p>
      </FormWindowShell>
    )
  }

  return (
    <FormWindowShell title="Estadísticas de Asistencia">
      <AttendanceStatsModal embedded client={client} onClose={() => window.close()} />
    </FormWindowShell>
  )
}
