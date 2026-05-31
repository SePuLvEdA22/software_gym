import { DashboardMetrics } from '../../../../shared/types'

export interface DashboardSlice {
  dashboardMetrics: DashboardMetrics

  setDashboardMetrics: (metrics: DashboardMetrics) => void
}

export const initialMetrics: DashboardMetrics = {
  totalClients: 0,
  activeClients: 0,
  expiredClients: 0,
  inactiveClients: 0,
  todayAccesses: 0,
  todayRevenue: 0,
  monthRevenue: 0,
  newThisMonth: 0,
  debtorsCount: 0,
  inactiveClientsCount: 0,
  peakHours: [],
  topPlans: [],
  recentAccesses: []
}

export const defaultDashboardState = {
  dashboardMetrics: initialMetrics
}

export const createDashboardActions = (set: any) => ({
  setDashboardMetrics: (metrics: DashboardMetrics) => set({ dashboardMetrics: metrics })
})
