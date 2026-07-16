import { getDatabase } from './index'
import { ClientRoutine, RoutineExercise, GymSettings } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'

interface DbClientRoutine {
  id: string
  client_id: string
  day_of_week: number
  exercises: string
  created_at: string
}

function mapDbRoutine(db: DbClientRoutine): ClientRoutine {
  return {
    id: db.id,
    clientId: db.client_id,
    dayOfWeek: db.day_of_week,
    exercises: JSON.parse(db.exercises) as RoutineExercise[],
    createdAt: db.created_at
  }
}

export function getClientRoutineByDay(clientId: string, dayOfWeek: number): ClientRoutine | null {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT * FROM client_routines WHERE client_id = ? AND day_of_week = ?'
  ).get(clientId, dayOfWeek) as DbClientRoutine | undefined
  return row ? mapDbRoutine(row) : null
}

export function getClientRoutines(clientId: string): ClientRoutine[] {
  const db = getDatabase()
  const rows = db.prepare(
    'SELECT * FROM client_routines WHERE client_id = ? ORDER BY day_of_week'
  ).all(clientId) as unknown as DbClientRoutine[]
  return rows.map(mapDbRoutine)
}

export function saveClientRoutine(
  clientId: string,
  dayOfWeek: number,
  exercises: RoutineExercise[]
): ClientRoutine {
  const db = getDatabase()
  const existing = db.prepare(
    'SELECT id FROM client_routines WHERE client_id = ? AND day_of_week = ?'
  ).get(clientId, dayOfWeek) as { id: string } | undefined

  if (existing) {
    db.prepare(
      'UPDATE client_routines SET exercises = ? WHERE id = ?'
    ).run(JSON.stringify(exercises), existing.id)
    const row = db.prepare('SELECT * FROM client_routines WHERE id = ?').get(existing.id) as unknown as DbClientRoutine
    return mapDbRoutine(row)
  } else {
    const id = uuidv4()
    db.prepare(
      'INSERT INTO client_routines (id, client_id, day_of_week, exercises) VALUES (?, ?, ?, ?)'
    ).run(id, clientId, dayOfWeek, JSON.stringify(exercises))
    return {
      id,
      clientId,
      dayOfWeek,
      exercises,
      createdAt: new Date().toISOString()
    }
  }
}

export function deleteClientRoutine(clientId: string, dayOfWeek: number): boolean {
  const db = getDatabase()
  const result = db.prepare(
    'DELETE FROM client_routines WHERE client_id = ? AND day_of_week = ?'
  ).run(clientId, dayOfWeek)
  return result.changes > 0
}

export function getGymSettings(): GymSettings {
  const db = getDatabase()
  const keys = ['gym_name', 'gym_address', 'gym_phone', 'gym_welcome_message']
  const defaults: Record<string, string> = {
    gym_name: 'BODYFITGYM',
    gym_address: '',
    gym_phone: '',
    gym_welcome_message: 'Bienvenido, nos complace que seas parte de nuestro equipo.'
  }
  const result: Record<string, string> = { ...defaults }
  for (const key of keys) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    if (row) {
      result[key] = row.value
    }
  }
  return {
    name: result.gym_name,
    address: result.gym_address,
    phone: result.gym_phone,
    welcomeMessage: result.gym_welcome_message
  }
}

export function saveGymSettings(settings: Partial<GymSettings>): GymSettings {
  const db = getDatabase()
  const map: Record<string, string | undefined> = {
    gym_name: settings.name,
    gym_address: settings.address,
    gym_phone: settings.phone,
    gym_welcome_message: settings.welcomeMessage
  }
  for (const [key, value] of Object.entries(map)) {
    if (value !== undefined) {
      db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(key, value)
    }
  }
  return getGymSettings()
}
