import { getDatabase } from './index'
import { BodyMeasurement, ClientGoal, FitnessGoal } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { formatISO } from 'date-fns'

interface MeasurementRow {
  id: string
  client_id: string
  date: string
  weight: number | null
  height: number | null
  neck: number | null
  shoulders: number | null
  chest: number | null
  left_arm: number | null
  right_arm: number | null
  waist: number | null
  hips: number | null
  left_thigh: number | null
  right_thigh: number | null
  left_calf: number | null
  right_calf: number | null
  body_fat: number | null
  notes: string
}

interface GoalRow {
  id: string
  client_id: string
  goal: FitnessGoal
  start_date: string
  target_date: string | null
  notes: string
  is_active: number
  created_at: string
}

export function getMeasurements(clientId: string, limit = 50): BodyMeasurement[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT * FROM body_measurements WHERE client_id = ? ORDER BY date DESC LIMIT ?
  `).all(clientId, limit) as unknown as MeasurementRow[]
  return rows.map(mapMeasurement)
}

function mapMeasurement(r: MeasurementRow): BodyMeasurement {
  return {
    id: r.id,
    clientId: r.client_id,
    date: r.date,
    weight: r.weight,
    height: r.height,
    neck: r.neck,
    shoulders: r.shoulders,
    chest: r.chest,
    leftArm: r.left_arm,
    rightArm: r.right_arm,
    waist: r.waist,
    hips: r.hips,
    leftThigh: r.left_thigh,
    rightThigh: r.right_thigh,
    leftCalf: r.left_calf,
    rightCalf: r.right_calf,
    bodyFat: r.body_fat,
    notes: r.notes || ''
  }
}

export function saveMeasurement(
  clientId: string,
  data: { date: string; notes?: string } & Partial<BodyMeasurement>
): BodyMeasurement {
  const db = getDatabase()
  const id = uuidv4()
  db.prepare(`
    INSERT INTO body_measurements (
      id, client_id, date, weight, height, neck, shoulders, chest,
      left_arm, right_arm, waist, hips, left_thigh, right_thigh,
      left_calf, right_calf, body_fat, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, clientId, data.date,
    data.weight ?? null, data.height ?? null, data.neck ?? null,
    data.shoulders ?? null, data.chest ?? null, data.leftArm ?? null,
    data.rightArm ?? null, data.waist ?? null, data.hips ?? null,
    data.leftThigh ?? null, data.rightThigh ?? null, data.leftCalf ?? null,
    data.rightCalf ?? null, data.bodyFat ?? null, data.notes || ''
  )
  return getMeasurements(clientId, 1)[0]
}

export function getGoals(clientId: string): ClientGoal[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT * FROM client_goals WHERE client_id = ? ORDER BY created_at DESC
  `).all(clientId) as unknown as GoalRow[]
  return rows.map(mapGoal)
}

function mapGoal(r: GoalRow): ClientGoal {
  return {
    id: r.id,
    clientId: r.client_id,
    goal: r.goal as FitnessGoal,
    startDate: r.start_date,
    targetDate: r.target_date || null,
    notes: r.notes || '',
    isActive: r.is_active === 1,
    createdAt: r.created_at
  }
}

export function saveGoal(
  clientId: string,
  data: { goal: FitnessGoal; startDate: string; targetDate?: string; notes?: string }
): ClientGoal {
  const db = getDatabase()
  const id = uuidv4()
  const createdAt = formatISO(new Date())
  db.prepare(`
    INSERT INTO client_goals (id, client_id, goal, start_date, target_date, notes, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `).run(id, clientId, data.goal, data.startDate, data.targetDate || null, data.notes || '', createdAt)
  return {
    id,
    clientId,
    goal: data.goal,
    startDate: data.startDate,
    targetDate: data.targetDate || null,
    notes: data.notes || '',
    isActive: true,
    createdAt
  }
}
