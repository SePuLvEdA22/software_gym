import type { AppState } from '../appStore'

type SetAppState = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void

import { Client, MembershipPlan, AccessLog } from '../../../../shared/types'

export interface DataSlice {
  clients: Client[]
  plans: MembershipPlan[]
  accessLogs: AccessLog[]

  setClients: (clients: Client[]) => void
  setPlans: (plans: MembershipPlan[]) => void
  setAccessLogs: (logs: AccessLog[]) => void
  addClient: (client: Client) => void
  updateClientInState: (client: Client) => void
  removeClient: (id: string) => void
}

export const defaultDataState = {
  clients: [] as Client[],
  plans: [] as MembershipPlan[],
  accessLogs: [] as AccessLog[]
}

export const createDataActions = (set: SetAppState) => ({
  setClients: (clients: Client[]) => set({ clients }),
  setPlans: (plans: MembershipPlan[]) => set({ plans }),
  setAccessLogs: (logs: AccessLog[]) => set({ accessLogs: logs }),
  addClient: (client: Client) => set((state: AppState) => ({ clients: [...state.clients, client] })),
  updateClientInState: (client: Client) => set((state: AppState) => ({
    clients: state.clients.map((c: Client) => c.id === client.id ? client : c)
  })),
  removeClient: (id: string) => set((state: AppState) => ({
    clients: state.clients.filter((c: Client) => c.id !== id)
  }))
})
