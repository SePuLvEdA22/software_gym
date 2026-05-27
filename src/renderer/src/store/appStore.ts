import { create } from 'zustand'
import { Client, MembershipPlan, DashboardMetrics, AccessLog } from '../../../shared/types'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  title?: string
}

interface AppState {
  clients: Client[]
  plans: MembershipPlan[]
  dashboardMetrics: DashboardMetrics | null
  accessLogs: AccessLog[]
  loading: boolean
  searchQuery: string
  sidebarCollapsed: boolean
  triggerNewClientModal: boolean
  toasts: Toast[]

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
  showToast: (type: ToastType, message: string, title?: string) => void
  removeToast: (id: string) => void
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
  debtorsCount: 0,
  inactiveClientsCount: 0,
  peakHours: [],
  topPlans: [],
  recentAccesses: []
}

function generateToastId(): string {
  return 'toast_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
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
  toasts: [],

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
  setTriggerNewClientModal: (value) => set({ triggerNewClientModal: value }),

  showToast: (type, message, title) => {
    const id = generateToastId()
    const toast: Toast = { id, type, message, title }
    
    set((state) => ({ toasts: [...state.toasts, toast] }))
    
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
      }))
    }, 5000)
  },

  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  }))
}))
