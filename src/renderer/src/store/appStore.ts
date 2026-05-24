import { create } from 'zustand'
import { Client, MembershipPlan, DashboardMetrics, AccessLog, Membership, Payment } from '../../shared/types'

interface AppState {
  clients: Client[]
  plans: MembershipPlan[]
  dashboardMetrics: DashboardMetrics | null
  accessLogs: AccessLog[]
  loading: boolean
  searchQuery: string
  sidebarCollapsed: boolean
  triggerNewClientModal: boolean

  setLoading: (loading: boolean) => void
  setSearchQuery: (query: string) => void
  setClients: (clients: Client[]) => void
  setPlans: (plans: MembershipPlan[]) => void
  setDashboardMetrics: (metrics: DashboardMetrics) => void
  setAccessLogs: (logs: AccessLog[]) => void
  toggleSidebar: () => void
  addClient: (client: Client) => void
  updateClientInState: (client: Client) => void
  removeClient: (id: string) => void
  setTriggerNewClientModal: (value: boolean) => void
}

const initialMetrics: DashboardMetrics = {
  totalClients: 0,
  activeClients: 0,
  expiredClients: 0,
  inactiveClients: 0,
  todayAccesses: 0,
  todayRevenue: 0,
  monthRevenue: 0,
  newThisMonth: 0,
  peakHours: [],
  topPlans: [],
  recentAccesses: []
}

export const useAppStore = create<AppState>((set) => ({
  clients: [],
  plans: [],
  dashboardMetrics: initialMetrics,
  accessLogs: [],
  loading: false,
  searchQuery: '',
  sidebarCollapsed: false,
  triggerNewClientModal: false,

  setLoading: (loading) => set({ loading }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setClients: (clients) => set({ clients }),
  setPlans: (plans) => set({ plans }),
  setDashboardMetrics: (metrics) => set({ dashboardMetrics: metrics }),
  setAccessLogs: (logs) => set({ accessLogs: logs }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  addClient: (client) => set((state) => ({ clients: [...state.clients, client] })),
  updateClientInState: (client) => set((state) => ({ 
    clients: state.clients.map(c => c.id === client.id ? client : c)
  })),
  removeClient: (id) => set((state) => ({ 
    clients: state.clients.filter(c => c.id !== id)
  })),
  setTriggerNewClientModal: (value) => set({ triggerNewClientModal: value })
}))
