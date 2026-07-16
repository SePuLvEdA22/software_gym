import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { ClientRoutine, RoutineExercise, Client } from '@shared/types'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface RoutinesModalProps {
  client: Client
  onClose: () => void
}

export function RoutinesModal({ client, onClose }: RoutinesModalProps): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const confirm = useAppStore((state) => state.confirm)
  const [routines, setRoutines] = useState<ClientRoutine[]>([])
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay())
  const [exercises, setExercises] = useState<RoutineExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadRoutines()
  }, [])

  useEffect(() => {
    const dayRoutine = routines.find(r => r.dayOfWeek === selectedDay)
    setExercises(dayRoutine?.exercises || [])
  }, [selectedDay, routines])

  const loadRoutines = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.routine.getByClient(client.id)
      if (result.success && result.data) {
        setRoutines(result.data as ClientRoutine[])
      }
    } catch (e) {
      console.error('Error loading routines:', e)
    } finally {
      setLoading(false)
    }
  }

  const addExercise = () => {
    setExercises(prev => [...prev, { name: '', sets: 3, reps: '12', notes: '' }])
  }

  const updateExercise = (index: number, field: keyof RoutineExercise, value: string | number) => {
    setExercises(prev => prev.map((ex, i) =>
      i === index ? { ...ex, [field]: value } : ex
    ))
  }

  const removeExercise = (index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    const validExercises = exercises.filter(e => e.name.trim())
    if (validExercises.length === 0) {
      showToast('warning', 'Agrega al menos un ejercicio con nombre', 'Validación')
      return
    }
    setSaving(true)
    try {
      const result = await window.electronAPI.routine.save(client.id, selectedDay, validExercises)
      if (result.success) {
        showToast('success', `Rutina de ${DAY_NAMES[selectedDay]} guardada`, 'Guardado')
        loadRoutines()
      } else {
        showToast('error', result.error || 'Error al guardar', 'Error')
      }
    } catch (e: any) {
      showToast('error', e.message || 'Error al guardar', 'Error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDay = async () => {
    const confirmed = await confirm({ title: 'Eliminar rutina', message: `¿Eliminar toda la rutina del ${DAY_NAMES[selectedDay]}?`, variant: 'danger', confirmLabel: 'Eliminar' })
    if (!confirmed) return
    try {
      await window.electronAPI.routine.delete(client.id, selectedDay)
      showToast('success', `Rutina de ${DAY_NAMES[selectedDay]} eliminada`, 'Eliminado')
      loadRoutines()
    } catch (e: any) {
      showToast('error', e.message || 'Error al eliminar', 'Error')
    }
  }

  const hasRoutine = (day: number) => routines.some(r => r.dayOfWeek === day)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <h2 className="modal-title">Rutinas de {client.fullName}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>

        <div className="modal-body">
          {/* Day Selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
            {DAY_NAMES.map((dayName, i) => (
              <button
                key={i}
                className={`filter-pill${selectedDay === i ? ' active' : ''}`}
                onClick={() => setSelectedDay(i)}
                style={{ position: 'relative' }}
              >
                {dayName}
                {hasRoutine(i) && (
                  <span style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: 'var(--color-success)'
                  }} />
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="spinner" />
            </div>
          ) : (
            <>
              {/* Exercises List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {exercises.map((ex, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    padding: 12, backgroundColor: 'var(--color-surface-container-low)',
                    borderRadius: 10, border: '1px solid var(--color-surface-container-high)'
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%',
                      backgroundColor: 'var(--color-primary-container)',
                      color: 'var(--color-on-primary-container)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0
                    }}>{i + 1}</span>
                    
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={ex.name}
                        onChange={(e) => updateExercise(i, 'name', e.target.value)}
                        placeholder="Ejercicio"
                        style={{ flex: '2 1 160px', padding: '8px 12px' }}
                      />
                      <input
                        type="number"
                        className="form-input"
                        value={ex.sets}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/^0+(?=\d)/, '')
                          updateExercise(i, 'sets', raw === '' ? 0 : Number(raw))
                        }}
                        placeholder="Sets"
                        min={1}
                        style={{ flex: '0 1 70px', padding: '8px 12px', width: 70 }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        value={ex.reps}
                        onChange={(e) => updateExercise(i, 'reps', e.target.value)}
                        placeholder="Reps"
                        style={{ flex: '0 1 80px', padding: '8px 12px', width: 80 }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        value={ex.notes || ''}
                        onChange={(e) => updateExercise(i, 'notes', e.target.value)}
                        placeholder="Notas"
                        style={{ flex: '1 1 100px', padding: '8px 12px' }}
                      />
                    </div>

                    <button
                      className="icon-btn danger"
                      onClick={() => removeExercise(i)}
                      style={{ flexShrink: 0 }}
                    >
                      <Icons.X />
                    </button>
                  </div>
                ))}
              </div>

              {exercises.length === 0 && (
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="empty-state-icon"><Icons.Dumbbell /></div>
                  <p>No hay ejercicios para {DAY_NAMES[selectedDay]}</p>
                  <p style={{ fontSize: 13, color: 'var(--color-on-surface-variant)', marginTop: 4 }}>
                    Haz clic en "Agregar Ejercicio" para empezar
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn btn-secondary" onClick={addExercise}>
                  <Icons.Plus />
                  Agregar Ejercicio
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  {hasRoutine(selectedDay) && (
                    <button className="btn btn-danger btn-sm" onClick={handleDeleteDay}>
                      <Icons.Trash />
                      Eliminar día
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <Icons.Check />
                    {saving ? 'Guardando...' : 'Guardar Rutina'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
