import { getDatabase } from './index'
import { DashboardMetrics, PeakHour, PlanStat, RevenueByPeriod } from '../../shared/types'
import { getTodayAccessCount, getAccessLogsByDate, getInactiveClients, deactivateExpiredPromotions } from './memberships'
import { formatISO, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, parseISO, startOfYear, endOfYear } from 'date-fns'

export interface DbAccessLog {
  id: string
  client_id: string | null
  client_name: string | null
  access_code: string
  access_type: string
  result: string
  message: string
  timestamp: string
}

export function getDashboardMetrics(): DashboardMetrics {
  const db = getDatabase()
  const today = new Date()
  const startOfToday = formatISO(startOfDay(today))
  const endOfToday = formatISO(endOfDay(today))
  const startOfThisMonth = formatISO(startOfMonth(today))
  const endOfThisMonth = formatISO(endOfMonth(today))

  deactivateExpiredPromotions()
  
  const counts = db.prepare(`
    SELECT status, COUNT(*) as count FROM clients GROUP BY status
  `).all() as { status: string; count: number }[]
  const countMap: Record<string, number> = {}
  for (const row of counts) countMap[row.status] = row.count
  const totalClients = counts.reduce((sum, r) => sum + r.count, 0)
  const activeClients = countMap['active'] || 0
  const expiredClients = countMap['expired'] || 0
  const inactiveClients = (countMap['inactive'] || 0) + (countMap['suspended'] || 0)
  
  const newThisMonthStmt = db.prepare(`
    SELECT COUNT(*) as count FROM clients 
    WHERE registration_date >= ?
  `)
  const newThisMonthResult = newThisMonthStmt.get(startOfThisMonth) as { count: number }
  
  const todayRevenueStmt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments 
    WHERE date >= ? AND date <= ?
  `)
  const todayRevenueResult = todayRevenueStmt.get(startOfToday, endOfToday) as { total: number }
  
  const monthRevenueStmt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments 
    WHERE date >= ? AND date <= ?
  `)
  const monthRevenueResult = monthRevenueStmt.get(startOfThisMonth, endOfThisMonth) as { total: number }
  
  const thirtyDaysAgo = formatISO(subMonths(today, 1))
  const topPlansStmt = db.prepare(`
    SELECT 
      plan_name,
      COUNT(*) as count,
      (SELECT COALESCE(SUM(p.amount), 0) 
       FROM payments p 
       JOIN memberships m2 ON p.membership_id = m2.id 
       WHERE m2.plan_name = m.plan_name
         AND p.date >= ?) as revenue
    FROM memberships m
    WHERE m.created_at >= ?
    GROUP BY plan_name
    ORDER BY count DESC
    LIMIT 5
  `)
  const topPlansResults = topPlansStmt.all(thirtyDaysAgo, thirtyDaysAgo) as { plan_name: string; count: number; revenue: number }[]
  const topPlans: PlanStat[] = topPlansResults.map(r => ({
    planName: r.plan_name,
    count: r.count,
    revenue: r.revenue
  }))
  
  const recentAccesses = getAccessLogsByDate(startOfToday, endOfToday)
    .sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime())
    .slice(0, 20)
  
  const hourCounts = db.prepare(`
    SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour, COUNT(*) as count
    FROM access_logs
    WHERE result = 'granted' AND timestamp >= ?
    GROUP BY hour
    ORDER BY count DESC
    LIMIT 5
  `).all(thirtyDaysAgo) as { hour: number; count: number }[]
  
  const peakHours: PeakHour[] = hourCounts.map(h => ({ hour: h.hour, count: h.count }))
  
  const debtorsCount = db.prepare(`
    SELECT COUNT(DISTINCT m.client_id) as count
    FROM memberships m
    JOIN membership_plans p ON p.id = m.plan_id
    WHERE (m.status = 'active' OR m.status = 'frozen')
      AND (SELECT COALESCE(SUM(pm.amount), 0) FROM payments pm WHERE pm.membership_id = m.id) < p.price
  `).get() as { count: number }

  const inactiveClientsCount = getInactiveClients(30).length

  return {
    totalClients,
    activeClients,
    expiredClients,
    inactiveClients,
    todayAccesses: getTodayAccessCount(),
    todayRevenue: todayRevenueResult.total,
    monthRevenue: monthRevenueResult.total,
    newThisMonth: newThisMonthResult.count,
    debtorsCount: debtorsCount.count,
    inactiveClientsCount,
    peakHours,
    topPlans,
    recentAccesses
  }
}

export function getClientsByStatus(): { [key: string]: number } {
  const db = getDatabase()
  const counts: { [key: string]: number } = {
    active: 0,
    expired: 0,
    inactive: 0,
    suspended: 0
  }
  
  const rows = db.prepare('SELECT status, COUNT(*) as count FROM clients GROUP BY status').all() as { status: string; count: number }[]
  for (const row of rows) {
    counts[row.status] = row.count
  }
  
  return counts
}

export function getExpiringSoon(days: number): { clientId: string; clientName: string; planName: string; endDate: string; daysLeft: number }[] {
  const db = getDatabase()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const future = new Date(today)
  future.setDate(future.getDate() + days)

  const rows = db.prepare(`
    SELECT c.id as clientId, c.full_name as clientName,
           m.plan_name as planName, m.end_date as endDate
    FROM memberships m
    JOIN clients c ON c.id = m.client_id
    WHERE m.status = 'active'
      AND m.end_date >= ? AND m.end_date <= ?
    ORDER BY m.end_date ASC
  `).all(formatISO(today), formatISO(future)) as { clientId: string; clientName: string; planName: string; endDate: string }[]

  return rows.map(r => ({
    ...r,
    daysLeft: Math.ceil((new Date(r.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }))
}

export function getBirthdaysThisMonth(): { clientId: string; clientName: string; birthDate: string; day: number }[] {
  const db = getDatabase()
  const now = new Date()
  const month = now.getMonth() + 1

  const rows = db.prepare(`
    SELECT id as clientId, full_name as clientName, birth_date as birthDate
    FROM clients
    WHERE birth_date IS NOT NULL AND birth_date != ''
      AND CAST(strftime('%m', birth_date) AS INTEGER) = ?
    ORDER BY CAST(strftime('%d', birth_date) AS INTEGER) ASC
  `).all(month) as { clientId: string; clientName: string; birthDate: string }[]

  return rows.map(r => ({
    ...r,
    day: parseInt(r.birthDate.split('-')[2] || '0', 10)
  }))
}

export function getRevenueByMonth(months: number = 6): { month: string; revenue: number }[] {
  const db = getDatabase()
  const today = new Date()
  const results: { month: string; revenue: number }[] = []
  
  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(today, i)
    const monthStart = formatISO(startOfMonth(date))
    const monthEnd = formatISO(endOfMonth(date))
    const monthLabel = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments 
      WHERE date >= ? AND date <= ?
    `)
    const result = stmt.get(monthStart, monthEnd) as { total: number }
    
    results.push({
      month: monthLabel,
      revenue: result.total
    })
  }
  
  return results
}

export function getRevenueByYear(year: number): number {
  const db = getDatabase()
  const date = new Date(year, 0, 1)
  const yearStart = formatISO(startOfYear(date))
  const yearEnd = formatISO(endOfYear(date))
  const result = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE date >= ? AND date <= ?').get(yearStart, yearEnd) as { total: number }
  return result.total
}

export function getRevenueByTimeOfDay(startDate: string, endDate: string): RevenueByPeriod {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT amount, date FROM payments 
    WHERE date >= ? AND date <= ?
  `).all(startDate, endDate) as { amount: number; date: string }[]

  let morning = 0
  let afternoon = 0
  for (const row of rows) {
    const hour = new Date(row.date).getHours()
    if (hour < 12) {
      morning += row.amount
    } else {
      afternoon += row.amount
    }
  }

  return { morning, afternoon, total: morning + afternoon }
}
