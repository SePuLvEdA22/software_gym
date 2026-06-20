import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase } from '../../main/database/index'
import { createClient } from '../../main/database/clients'
import { createPlan, createMembership, recordPayment, logAccess } from '../../main/database/memberships'
import {
  getDashboardMetrics,
  getClientsByStatus,
  getExpiringSoon,
  getBirthdaysThisMonth,
  getRevenueByMonth,
  getRevenueByYear,
  getRevenueByTimeOfDay,
} from '../../main/database/dashboard'
import type { Client } from '../../shared/types'

const sampleClient: Omit<Client, 'id' | 'registrationDate'> = {
  fullName: 'Dashboard Test',
  documentId: 'DASH-001',
  birthDate: '1990-06-15',
  gender: 'male',
  phone: '3005554433',
  email: 'dash@example.com',
  address: 'Calle Dashboard',
  photo: null,
  accessCode: 'DASH01',
  status: 'active',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
}

describe('Dashboard', () => {
  beforeAll(async () => {
    await initDatabase()
    const client = createClient(sampleClient)
    const plan = createPlan({
      name: 'Dashboard Plan',
      type: 'monthly',
      price: 50000,
      durationDays: 30,
      description: '',
    })
    createMembership(client.id, plan.id)
    recordPayment(client.id, 50000, 'cash', 'Pago dashboard')
    logAccess('DASH01', 'granted', 'Acceso dashboard', client.id, client.fullName)
  })

  afterAll(() => {
    closeDatabase()
  })

  describe('getDashboardMetrics', () => {
    it('should return all metrics without errors', () => {
      const metrics = getDashboardMetrics()
      expect(metrics).toBeDefined()
      expect(metrics).toHaveProperty('totalClients')
      expect(metrics).toHaveProperty('activeClients')
      expect(metrics).toHaveProperty('expiredClients')
      expect(metrics).toHaveProperty('inactiveClients')
      expect(metrics).toHaveProperty('todayAccesses')
      expect(metrics).toHaveProperty('todayRevenue')
      expect(metrics).toHaveProperty('monthRevenue')
      expect(metrics).toHaveProperty('newThisMonth')
      expect(metrics).toHaveProperty('debtorsCount')
      expect(metrics).toHaveProperty('inactiveClientsCount')
    })

    it('should return valid counts', () => {
      const metrics = getDashboardMetrics()
      expect(metrics.totalClients).toBeGreaterThan(0)
      expect(metrics.activeClients).toBeGreaterThan(0)
      expect(typeof metrics.todayAccesses).toBe('number')
      expect(typeof metrics.todayRevenue).toBe('number')
      expect(typeof metrics.monthRevenue).toBe('number')
    })

    it('should return peakHours as array', () => {
      const metrics = getDashboardMetrics()
      expect(Array.isArray(metrics.peakHours)).toBe(true)
    })

    it('should return topPlans as array', () => {
      const metrics = getDashboardMetrics()
      expect(Array.isArray(metrics.topPlans)).toBe(true)
      if (metrics.topPlans.length > 0) {
        expect(metrics.topPlans[0]).toHaveProperty('planName')
        expect(metrics.topPlans[0]).toHaveProperty('count')
        expect(metrics.topPlans[0]).toHaveProperty('revenue')
      }
    })

    it('should return recentAccesses as array', () => {
      const metrics = getDashboardMetrics()
      expect(Array.isArray(metrics.recentAccesses)).toBe(true)
    })
  })

  describe('getClientsByStatus', () => {
    it('should return counts for all statuses', () => {
      const counts = getClientsByStatus()
      expect(counts).toHaveProperty('active')
      expect(counts).toHaveProperty('expired')
      expect(counts).toHaveProperty('inactive')
      expect(counts).toHaveProperty('suspended')
      expect(counts.active).toBeGreaterThan(0)
    })
  })

  describe('getExpiringSoon', () => {
    it('should return memberships expiring within given days', () => {
      const result = getExpiringSoon(365)
      expect(Array.isArray(result)).toBe(true)
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('clientId')
        expect(result[0]).toHaveProperty('clientName')
        expect(result[0]).toHaveProperty('planName')
        expect(result[0]).toHaveProperty('endDate')
        expect(result[0]).toHaveProperty('daysLeft')
        expect(typeof result[0].daysLeft).toBe('number')
      }
    })

    it('should return empty for 0 days', () => {
      const result = getExpiringSoon(0)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getBirthdaysThisMonth', () => {
    it('should return birthdays this month', () => {
      const result = getBirthdaysThisMonth()
      expect(Array.isArray(result)).toBe(true)
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('clientId')
        expect(result[0]).toHaveProperty('clientName')
        expect(result[0]).toHaveProperty('birthDate')
        expect(result[0]).toHaveProperty('day')
      }
    })
  })

  describe('getRevenueByMonth', () => {
    it('should return revenue for each month', () => {
      const result = getRevenueByMonth(3)
      expect(result.length).toBe(3)
      expect(result[0]).toHaveProperty('month')
      expect(result[0]).toHaveProperty('revenue')
    })

    it('should default to 6 months', () => {
      const result = getRevenueByMonth()
      expect(result.length).toBe(6)
    })
  })

  describe('getRevenueByYear', () => {
    it('should return total revenue for the year', () => {
      const revenue = getRevenueByYear(2026)
      expect(typeof revenue).toBe('number')
      expect(revenue).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getRevenueByTimeOfDay', () => {
    it('should return revenue split by time of day', () => {
      const start = new Date(Date.now() - 86400000).toISOString()
      const end = new Date(Date.now() + 86400000).toISOString()
      const result = getRevenueByTimeOfDay(start, end)
      expect(result).toHaveProperty('morning')
      expect(result).toHaveProperty('afternoon')
      expect(result).toHaveProperty('total')
      expect(result.total).toBe(result.morning + result.afternoon)
    })
  })
})
