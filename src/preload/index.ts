import { contextBridge, ipcRenderer } from 'electron'
import {
  Client,
  MembershipPlan,
  Membership,
  Payment,
  AccessLog,
  AccessValidation,
  DashboardMetrics,
  ClientStatus,
  PaymentMethod,
  WhatsappMessage
} from '../shared/types'

interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}

const electronAPI = {
  client: {
    create: (data: Omit<Client, 'id' | 'registrationDate'>): Promise<IpcResult<Client>> =>
      ipcRenderer.invoke('client:create', data),
    update: (id: string, data: Partial<Client>): Promise<IpcResult<Client | null>> =>
      ipcRenderer.invoke('client:update', id, data),
    getById: (id: string): Promise<IpcResult<Client | null>> =>
      ipcRenderer.invoke('client:getById', id),
    getByAccessCode: (code: string): Promise<IpcResult<Client | null>> =>
      ipcRenderer.invoke('client:getByAccessCode', code),
    getByDocumentId: (docId: string): Promise<IpcResult<Client | null>> =>
      ipcRenderer.invoke('client:getByDocumentId', docId),
    getAll: (status?: ClientStatus): Promise<IpcResult<Client[]>> =>
      ipcRenderer.invoke('client:getAll', status),
    search: (query: string): Promise<IpcResult<Client[]>> =>
      ipcRenderer.invoke('client:search', query),
    delete: (id: string): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('client:delete', id),
    generateCode: (): Promise<IpcResult<string>> =>
      ipcRenderer.invoke('client:generateCode')
  },

  plans: {
    getAll: (activeOnly = true): Promise<IpcResult<MembershipPlan[]>> =>
      ipcRenderer.invoke('plans:getAll', activeOnly),
    getById: (id: string): Promise<IpcResult<MembershipPlan | null>> =>
      ipcRenderer.invoke('plans:getById', id),
    create: (data: Omit<MembershipPlan, 'id' | 'createdAt' | 'isActive'>): Promise<IpcResult<MembershipPlan>> =>
      ipcRenderer.invoke('plans:create', data),
    update: (id: string, data: Partial<MembershipPlan>): Promise<IpcResult<MembershipPlan | null>> =>
      ipcRenderer.invoke('plans:update', id, data),
    delete: (id: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('plans:delete', id)
  },

  membership: {
    create: (clientId: string, planId: string, startDate?: string): Promise<IpcResult<Membership | null>> =>
      ipcRenderer.invoke('membership:create', clientId, planId, startDate),
    getActive: (clientId: string): Promise<IpcResult<Membership | null>> =>
      ipcRenderer.invoke('membership:getActive', clientId),
    getByClient: (clientId: string): Promise<IpcResult<Membership[]>> =>
      ipcRenderer.invoke('membership:getByClient', clientId),
    freeze: (membershipId: string): Promise<IpcResult<Membership | null>> =>
      ipcRenderer.invoke('membership:freeze', membershipId),
    unfreeze: (membershipId: string): Promise<IpcResult<Membership | null>> =>
      ipcRenderer.invoke('membership:unfreeze', membershipId)
  },

  payment: {
    record: (
      clientId: string,
      amount: number,
      method: PaymentMethod,
      description: string,
      membershipId?: string,
      notes?: string
    ): Promise<IpcResult<Payment>> =>
      ipcRenderer.invoke('payment:record', clientId, amount, method, description, membershipId, notes),
    getByClient: (clientId: string): Promise<IpcResult<Payment[]>> =>
      ipcRenderer.invoke('payment:getByClient', clientId),
    getByDateRange: (startDate: string, endDate: string): Promise<IpcResult<Payment[]>> =>
      ipcRenderer.invoke('payment:getByDateRange', startDate, endDate)
  },

  access: {
    validate: (accessCode: string): Promise<IpcResult<AccessValidation>> =>
      ipcRenderer.invoke('access:validate', accessCode),
    getLogs: (limit?: number): Promise<IpcResult<AccessLog[]>> =>
      ipcRenderer.invoke('access:getLogs', limit),
    getLogsByDate: (startDate: string, endDate: string): Promise<IpcResult<AccessLog[]>> =>
      ipcRenderer.invoke('access:getLogsByDate', startDate, endDate),
    getLogsByClient: (clientId: string, limit?: number): Promise<IpcResult<AccessLog[]>> =>
      ipcRenderer.invoke('access:getLogsByClient', clientId, limit)
  },

  dashboard: {
    getMetrics: (): Promise<IpcResult<DashboardMetrics>> =>
      ipcRenderer.invoke('dashboard:getMetrics'),
    getRevenueByMonth: (months?: number): Promise<IpcResult<{ month: string; revenue: number }[]>> =>
      ipcRenderer.invoke('dashboard:getRevenueByMonth', months),
    getClientsByStatus: (): Promise<IpcResult<{ [key: string]: number }>> =>
      ipcRenderer.invoke('dashboard:getClientsByStatus'),
    getExpiringSoon: (days: number): Promise<IpcResult<{ clientId: string; clientName: string; planName: string; endDate: string; daysLeft: number }[]>> =>
      ipcRenderer.invoke('dashboard:getExpiringSoon', days),
    getBirthdays: (): Promise<IpcResult<{ clientId: string; clientName: string; birthDate: string; day: number }[]>> =>
      ipcRenderer.invoke('dashboard:getBirthdays')
  },

  door: {
    open: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('door:open'),
    getStatus: (): Promise<IpcResult<{ status: string; mockMode: boolean }>> =>
      ipcRenderer.invoke('door:getStatus'),
    getConfig: (): Promise<IpcResult<any>> =>
      ipcRenderer.invoke('door:getConfig'),
    saveConfig: (config: any): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('door:saveConfig', config),
    testConnection: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('door:testConnection')
  },

  whatsapp: {
    getConfig: (): Promise<IpcResult<any>> =>
      ipcRenderer.invoke('whatsapp:getConfig'),
    saveConfig: (config: any): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('whatsapp:saveConfig', config),
    sendWelcome: (clientId: string): Promise<IpcResult<{ success: boolean }>> =>
      ipcRenderer.invoke('whatsapp:sendWelcome', clientId),
    sendPaymentConfirmation: (clientId: string, planName: string, endDate: string): Promise<IpcResult<{ success: boolean }>> =>
      ipcRenderer.invoke('whatsapp:sendPaymentConfirmation', clientId, planName, endDate),
    getHistory: (clientId?: string, limit?: number): Promise<IpcResult<WhatsappMessage[]>> =>
      ipcRenderer.invoke('whatsapp:getHistory', clientId, limit),
    checkReminders: (): Promise<IpcResult<{ sent: number }>> =>
      ipcRenderer.invoke('whatsapp:checkReminders')
  },

  system: {
    updateExpired: (): Promise<IpcResult<number>> =>
      ipcRenderer.invoke('system:updateExpired'),
    backupDb: (): Promise<IpcResult<string>> =>
      ipcRenderer.invoke('system:backupDb'),
    restoreDb: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('system:restoreDb'),
    exportCsv: (type: string, filters?: any): Promise<IpcResult<string>> =>
      ipcRenderer.invoke('system:exportCsv', type, filters)
  },

  window: {
    openKiosk: (): Promise<IpcResult<{ isOpen: boolean; alreadyOpen?: boolean }>> =>
      ipcRenderer.invoke('window:open-kiosk'),
    closeKiosk: (): Promise<IpcResult<{ alreadyClosed?: boolean }>> =>
      ipcRenderer.invoke('window:close-kiosk'),
    getKioskStatus: (): Promise<IpcResult<{ isOpen: boolean }>> =>
      ipcRenderer.invoke('window:kiosk-status'),
    minimize: (): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('window:minimize-admin'),
    maximize: (): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('window:maximize-admin')
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
