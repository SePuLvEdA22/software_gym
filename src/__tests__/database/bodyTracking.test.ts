import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase } from '../../main/database/index'
import { createClient } from '../../main/database/clients'
import {
  getMeasurements,
  saveMeasurement,
  getGoals,
  saveGoal,
} from '../../main/database/bodyTracking'
import type { Client } from '../../shared/types'

const sampleClient: Omit<Client, 'id' | 'registrationDate'> = {
  fullName: 'Body Tracking Test',
  documentId: 'BODY-001',
  birthDate: '1990-01-01',
  gender: 'male',
  phone: '3004443322',
  email: 'body@example.com',
  address: 'Calle Body',
  photo: null,
  accessCode: 'BODY01',
  status: 'active',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
}

let clientId: string

describe('Body Tracking', () => {
  beforeAll(async () => {
    await initDatabase()
    const client = createClient(sampleClient)
    clientId = client.id
  })

  afterAll(() => {
    closeDatabase()
  })

  describe('Measurements', () => {
    it('should save a measurement with all fields', () => {
      const m = saveMeasurement(clientId, {
        date: '2026-06-01',
        weight: 75,
        height: 175,
        neck: 38,
        shoulders: 110,
        chest: 100,
        leftArm: 35,
        rightArm: 36,
        waist: 85,
        hips: 95,
        leftThigh: 55,
        rightThigh: 56,
        leftCalf: 38,
        rightCalf: 39,
        bodyFat: 15,
        notes: 'Medición inicial',
      })
      expect(m).not.toBeNull()
      expect(m.clientId).toBe(clientId)
      expect(m.date).toBe('2026-06-01')
      expect(m.weight).toBe(75)
      expect(m.height).toBe(175)
      expect(m.notes).toBe('Medición inicial')
    })

    it('should save a measurement with minimal fields', () => {
      const m = saveMeasurement(clientId, {
        date: '2026-06-15',
        weight: 74,
        notes: '',
      })
      expect(m).not.toBeNull()
      expect(m.weight).toBe(74)
      expect(m.height).toBeNull()
      expect(m.neck).toBeNull()
    })

    it('should get measurements with default limit', () => {
      const measurements = getMeasurements(clientId)
      expect(measurements.length).toBeGreaterThanOrEqual(1)
      expect(measurements[0]).toHaveProperty('id')
      expect(measurements[0]).toHaveProperty('clientId')
      expect(measurements[0]).toHaveProperty('date')
    })

    it('should get measurements in descending date order', () => {
      saveMeasurement(clientId, { date: '2026-07-01', weight: 73 })
      const measurements = getMeasurements(clientId)
      expect(measurements.length).toBeGreaterThanOrEqual(3)
      for (let i = 1; i < measurements.length; i++) {
        expect(measurements[i - 1].date >= measurements[i].date).toBe(true)
      }
    })

    it('should respect limit parameter', () => {
      const limited = getMeasurements(clientId, 2)
      expect(limited.length).toBeLessThanOrEqual(2)
    })

    it('should return empty for non-existent client', () => {
      const measurements = getMeasurements('non-existent-client')
      expect(measurements).toEqual([])
    })
  })

  describe('Goals', () => {
    it('should save a goal', () => {
      const goal = saveGoal(clientId, {
        goal: 'lose_weight',
        startDate: '2026-06-01',
        targetDate: '2026-09-01',
        notes: 'Perder 5kg',
      })
      expect(goal).not.toBeNull()
      expect(goal.clientId).toBe(clientId)
      expect(goal.goal).toBe('lose_weight')
      expect(goal.startDate).toBe('2026-06-01')
      expect(goal.targetDate).toBe('2026-09-01')
      expect(goal.notes).toBe('Perder 5kg')
      expect(goal.isActive).toBe(true)
      expect(goal.createdAt).toBeDefined()
    })

    it('should save a goal without optional fields', () => {
      const goal = saveGoal(clientId, {
        goal: 'gain_muscle',
        startDate: '2026-06-01',
      })
      expect(goal).not.toBeNull()
      expect(goal.goal).toBe('gain_muscle')
      expect(goal.targetDate).toBeNull()
      expect(goal.notes).toBe('')
    })

    it('should save all goal types', () => {
      for (const g of ['lose_weight', 'gain_muscle', 'define', 'maintain'] as const) {
        saveGoal(clientId, { goal: g, startDate: '2026-06-01' })
      }
      const goals = getGoals(clientId)
      expect(goals.length).toBeGreaterThanOrEqual(4)
    })

    it('should return goals in descending creation order', () => {
      const goals = getGoals(clientId)
      expect(goals.length).toBeGreaterThan(0)
      for (let i = 1; i < goals.length; i++) {
        expect(goals[i - 1].createdAt >= goals[i].createdAt).toBe(true)
      }
    })

    it('should return empty for non-existent client', () => {
      const goals = getGoals('non-existent-client')
      expect(goals).toEqual([])
    })
  })
})
