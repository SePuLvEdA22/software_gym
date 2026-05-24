import { getDatabase } from './index'
import { DashboardMetrics, PeakHour, PlanStat } from '../../shared/types'
import { getTodayAccessCount, getAccessLogsByDate } from './memberships'
import { getAllClients } from './clients'
import { formatISO, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, parseISO, getHours } from 'date-fns'

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
  
  const allClients = getAllClients()
  const activeClients = allClients.filter(c => c.status === 'active').length
  const expiredClients = allClients.filter(c => c.status === 'expired').length
  const inactiveClients = allClients.filter(c => c.status === 'inactive' || c.status === 'suspended').length
  
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
  const thirtyDaysAgo = formatISO(subMonths(today, 1))
  const topPlansResults = topPlansStmt.all(startOfThisMonth, thirtyDaysAgo) as { plan_name: string; count: number; revenue: number }[]
  const topPlans: PlanStat[] = topPlansResults.map(r => ({
    planName: r.plan_name,
    count: r.count,
    revenue: r.revenue
  }))
  
  const recentAccesses = getAccessLogsByDate(startOfToday, endOfToday)
    .sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime())
    .slice(0, 20)
  
  const last30DaysAccessesStmt = db.prepare(`
    SELECT timestamp FROM access_logs 
    WHERE result = 'granted' 
      AND timestamp >= ?
  `)
  const last30Days = formatISO(subMonths(today, 1))
  const accessTimes = last30DaysAccessesStmt.all(last30Days) as { timestamp: string }[]
  
  const hourCounts = new Array(24).fill(0)
  for (const access of accessTimes) {
    const hour = getHours(parseISO(access.timestamp))
    hourCounts[hour]++
  }
  
  const peakHours: PeakHour[] = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  
  return {
    totalClients: allClients.length,
    activeClients,
    expiredClients,
    inactiveClients,
    todayAccesses: getTodayAccessCount(),
    todayRevenue: todayRevenueResult.total,
    monthRevenue: monthRevenueResult.total,
    newThisMonth: newThisMonthResult.count,
    peakHours,
    topPlans,
    recentAccesses
  }
}

export function getClientsByStatus(): { [key: string]: number } {
  const clients = getAllClients()
  const counts: { [key: string]: number } = {
    active: 0,
    expired: 0,
    inactive: 0,
    suspended: 0
  }
  
  for (const client of clients) {
    counts[client.status] = (counts[client.status] || 0) + 1
  }
  
  return counts
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
