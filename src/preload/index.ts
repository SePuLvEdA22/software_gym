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
  Promotion,
  ClientDebt,
  DebtorSummary,
  WhatsappMessage,
  FreezeHistory,
  ClientAttendanceStats,
  InactiveClient,
  RevenueByPeriod,
  User,
  ChangeLog,
  UserRole,
  Product,
  InventoryMovement,
  BodyMeasurement,
  ClientGoal,
  MessageTemplate,
  PageResponse
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
    getAll: (options?: { status?: ClientStatus; page?: number; pageSize?: number }): Promise<IpcResult<{ data: Client[]; total: number; page: number; totalPages: number }>> =>
      ipcRenderer.invoke('client:getAll', options),
    search: (query: string): Promise<IpcResult<Client[]>> =>
      ipcRenderer.invoke('client:search', query),
    delete: (id: string): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('client:delete', id),
    generateCode: (): Promise<IpcResult<string>> =>
      ipcRenderer.invoke('client:generateCode'),
    getDebt: (clientId: string): Promise<IpcResult<ClientDebt[]>> =>
      ipcRenderer.invoke('client:getDebt', clientId),
    getDebtors: (): Promise<IpcResult<DebtorSummary[]>> =>
      ipcRenderer.invoke('client:getDebtors'),
    getFreezeHistory: (clientId: string): Promise<IpcResult<FreezeHistory[]>> =>
      ipcRenderer.invoke('client:getFreezeHistory', clientId),
    getAttendanceStats: (clientId: string): Promise<IpcResult<ClientAttendanceStats>> =>
      ipcRenderer.invoke('client:getAttendanceStats', clientId),
    getInactive: (daysThreshold?: number): Promise<IpcResult<InactiveClient[]>> =>
      ipcRenderer.invoke('client:getInactive', daysThreshold),
    getNextNumber: (): Promise<IpcResult<number>> =>
      ipcRenderer.invoke('client:getNextNumber')
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
    createWithPayment: (clientId: string, planId: string, amount: number, method: PaymentMethod, startDate?: string, notes?: string, discount?: number): Promise<IpcResult<{ membership: Membership | null; payment: Payment | null }>> =>
      ipcRenderer.invoke('membership:createWithPayment', clientId, planId, amount, method, startDate, notes, discount),
    getActive: (clientId: string): Promise<IpcResult<Membership | null>> =>
      ipcRenderer.invoke('membership:getActive', clientId),
    getByClient: (clientId: string): Promise<IpcResult<Membership[]>> =>
      ipcRenderer.invoke('membership:getByClient', clientId),
    freeze: (membershipId: string, reason?: string, plannedDays?: number): Promise<IpcResult<Membership | null>> =>
      ipcRenderer.invoke('membership:freeze', membershipId, reason, plannedDays),
    unfreeze: (membershipId: string): Promise<IpcResult<Membership | null>> =>
      ipcRenderer.invoke('membership:unfreeze', membershipId),
    getFreezeHistory: (membershipId: string): Promise<IpcResult<FreezeHistory[]>> =>
      ipcRenderer.invoke('membership:getFreezeHistory', membershipId)
  },

  payment: {
    record: (
      clientId: string,
      amount: number,
      method: PaymentMethod,
      description: string,
      membershipId?: string,
      notes?: string,
      discount?: number
    ): Promise<IpcResult<Payment>> =>
      ipcRenderer.invoke('payment:record', clientId, amount, method, description, membershipId, notes, discount),
    getByClient: (clientId: string, options?: { page?: number; pageSize?: number }): Promise<IpcResult<PageResponse<Payment>>> =>
      ipcRenderer.invoke('payment:getByClient', clientId, options),
    getByDateRange: (startDate: string, endDate: string, options?: { page?: number; pageSize?: number }): Promise<IpcResult<PageResponse<Payment>>> =>
      ipcRenderer.invoke('payment:getByDateRange', startDate, endDate, options),
    getByMembership: (membershipId: string): Promise<IpcResult<Payment[]>> =>
      ipcRenderer.invoke('payment:getByMembership', membershipId)
  },

  access: {
    validate: (accessCode: string): Promise<IpcResult<AccessValidation>> =>
      ipcRenderer.invoke('access:validate', accessCode),
    getLogs: (options?: { page?: number; pageSize?: number }): Promise<IpcResult<PageResponse<AccessLog>>> =>
      ipcRenderer.invoke('access:getLogs', options),
    getLogsByDate: (startDate: string, endDate: string, options?: { page?: number; pageSize?: number }): Promise<IpcResult<PageResponse<AccessLog>>> =>
      ipcRenderer.invoke('access:getLogsByDate', startDate, endDate, options),
    getLogsByClient: (clientId: string, options?: { page?: number; pageSize?: number }): Promise<IpcResult<PageResponse<AccessLog>>> =>
      ipcRenderer.invoke('access:getLogsByClient', clientId, options)
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
      ipcRenderer.invoke('dashboard:getBirthdays'),
    getRevenueByYear: (year: number): Promise<IpcResult<number>> =>
      ipcRenderer.invoke('dashboard:getRevenueByYear', year),
    getRevenueByTimeOfDay: (startDate: string, endDate: string): Promise<IpcResult<RevenueByPeriod>> =>
      ipcRenderer.invoke('dashboard:getRevenueByTimeOfDay', startDate, endDate)
  },

  auth: {
    login: (username: string, password: string): Promise<IpcResult<{ user: User }>> =>
      ipcRenderer.invoke('auth:login', username, password),
    logout: (): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('auth:logout'),
    checkSession: (): Promise<IpcResult<User | null>> =>
      ipcRenderer.invoke('auth:checkSession')
  },

  user: {
    getAll: (): Promise<IpcResult<User[]>> =>
      ipcRenderer.invoke('user:getAll'),
    getById: (id: string): Promise<IpcResult<User | null>> =>
      ipcRenderer.invoke('user:getById', id),
    create: (data: { username: string; fullName: string; password: string; role: UserRole; permissions?: string[] }): Promise<IpcResult<{ user: User }>> =>
      ipcRenderer.invoke('user:create', data),
    update: (id: string, data: Partial<{ username: string; fullName: string; role: UserRole; permissions: string[]; isActive: boolean; password: string }>): Promise<IpcResult<{ user: User }>> =>
      ipcRenderer.invoke('user:update', id, data),
    delete: (id: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('user:delete', id),
    getChangeLogs: (limit?: number, tableName?: string): Promise<IpcResult<ChangeLog[]>> =>
      ipcRenderer.invoke('user:getChangeLogs', limit, tableName)
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

  promotion: {
    getAll: (activeOnly = true): Promise<IpcResult<Promotion[]>> =>
      ipcRenderer.invoke('promotion:getAll', activeOnly),
    getById: (id: string): Promise<IpcResult<Promotion | null>> =>
      ipcRenderer.invoke('promotion:getById', id),
    create: (data: Omit<Promotion, 'id' | 'createdAt' | 'isActive'>): Promise<IpcResult<Promotion>> =>
      ipcRenderer.invoke('promotion:create', data),
    update: (id: string, data: Partial<Promotion>): Promise<IpcResult<Promotion | null>> =>
      ipcRenderer.invoke('promotion:update', id, data),
    delete: (id: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('promotion:delete', id),
    getEffectivePrice: (planId: string): Promise<IpcResult<{ price: number; discount: number; promotionName: string | null }>> =>
      ipcRenderer.invoke('membership:getEffectivePrice', planId)
  },

  system: {
    updateExpired: (): Promise<IpcResult<number>> =>
      ipcRenderer.invoke('system:updateExpired'),
    backupDb: (): Promise<IpcResult<string>> =>
      ipcRenderer.invoke('system:backupDb'),
    restoreDb: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('system:restoreDb'),
    exportCsv: (type: string, filters?: any): Promise<IpcResult<string>> =>
      ipcRenderer.invoke('system:exportCsv', type, filters),
    getAutoStart: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('system:get-auto-start'),
    setAutoStart: (enabled: boolean): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('system:set-auto-start', enabled),
    updateAdmin: (data: { username?: string; currentPassword: string; newPassword?: string }): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('system:updateAdmin', data)
  },

  inventory: {
    getAllProducts: (activeOnly = true, options?: { page?: number; pageSize?: number }): Promise<IpcResult<PageResponse<Product>>> =>
      ipcRenderer.invoke('inventory:getAllProducts', activeOnly, options),
    getProductById: (id: string): Promise<IpcResult<Product | null>> =>
      ipcRenderer.invoke('inventory:getProductById', id),
    createProduct: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): Promise<IpcResult<Product>> =>
      ipcRenderer.invoke('inventory:createProduct', data),
    updateProduct: (id: string, data: Partial<Product>): Promise<IpcResult<Product | null>> =>
      ipcRenderer.invoke('inventory:updateProduct', id, data),
    deleteProduct: (id: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('inventory:deleteProduct', id),
    registerMovement: (productId: string, type: 'in' | 'out', quantity: number, price: number, description: string): Promise<IpcResult<InventoryMovement | null>> =>
      ipcRenderer.invoke('inventory:registerMovement', productId, type, quantity, price, description),
    getMovements: (productId?: string, options?: { page?: number; pageSize?: number }): Promise<IpcResult<PageResponse<InventoryMovement>>> =>
      ipcRenderer.invoke('inventory:getMovements', productId, options),
    getLowStock: (threshold?: number): Promise<IpcResult<Product[]>> =>
      ipcRenderer.invoke('inventory:getLowStock', threshold)
  },

  bodyTracking: {
    getMeasurements: (clientId: string, limit?: number): Promise<IpcResult<BodyMeasurement[]>> =>
      ipcRenderer.invoke('bodyTracking:getMeasurements', clientId, limit),
    saveMeasurement: (clientId: string, data: { date: string; notes?: string } & Partial<BodyMeasurement>): Promise<IpcResult<BodyMeasurement>> =>
      ipcRenderer.invoke('bodyTracking:saveMeasurement', clientId, data),
    getGoals: (clientId: string): Promise<IpcResult<ClientGoal[]>> =>
      ipcRenderer.invoke('bodyTracking:getGoals', clientId),
    saveGoal: (clientId: string, data: { goal: 'lose_weight' | 'gain_muscle' | 'define' | 'maintain'; startDate: string; targetDate?: string; notes?: string }): Promise<IpcResult<ClientGoal>> =>
      ipcRenderer.invoke('bodyTracking:saveGoal', clientId, data)
  },

  messageTemplates: {
    getAll: (): Promise<IpcResult<MessageTemplate[]>> =>
      ipcRenderer.invoke('messageTemplates:getAll'),
    getById: (id: string): Promise<IpcResult<MessageTemplate | null>> =>
      ipcRenderer.invoke('messageTemplates:getById', id),
    create: (data: { name: string; type: 'email' | 'whatsapp'; subject: string; content: string; variables?: string[] }): Promise<IpcResult<MessageTemplate>> =>
      ipcRenderer.invoke('messageTemplates:create', data),
    update: (id: string, data: { name: string; type: 'email' | 'whatsapp'; subject: string; content: string; variables?: string[] }): Promise<IpcResult<MessageTemplate | null>> =>
      ipcRenderer.invoke('messageTemplates:update', id, data),
    delete: (id: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke('messageTemplates:delete', id),
    sendToClient: (templateId: string, clientId: string): Promise<IpcResult<{ sent: boolean; message?: string }>> =>
      ipcRenderer.invoke('messageTemplates:sendToClient', templateId, clientId),
    sendToAll: (templateId: string): Promise<IpcResult<{ sent: number; failed: number }>> =>
      ipcRenderer.invoke('messageTemplates:sendToAll', templateId)
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
  },

  update: {
    check: (): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('update:check'),
    download: (): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('update:download'),
    install: (): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('update:install'),
    onChecking: (callback: () => void): () => void => {
      const handler = () => callback()
      ipcRenderer.on('update:checking', handler)
      return () => ipcRenderer.removeListener('update:checking', handler)
    },
    onAvailable: (callback: (info: any) => void): () => void => {
      const handler = (_: any, info: any) => callback(info)
      ipcRenderer.on('update:available', handler)
      return () => ipcRenderer.removeListener('update:available', handler)
    },
    onNotAvailable: (callback: (info: any) => void): () => void => {
      const handler = (_: any, info: any) => callback(info)
      ipcRenderer.on('update:not-available', handler)
      return () => ipcRenderer.removeListener('update:not-available', handler)
    },
    onError: (callback: (error: string) => void): () => void => {
      const handler = (_: any, error: string) => callback(error)
      ipcRenderer.on('update:error', handler)
      return () => ipcRenderer.removeListener('update:error', handler)
    },
    onDownloadProgress: (callback: (progress: any) => void): () => void => {
      const handler = (_: any, progress: any) => callback(progress)
      ipcRenderer.on('update:download-progress', handler)
      return () => ipcRenderer.removeListener('update:download-progress', handler)
    },
    onDownloaded: (callback: (info: any) => void): () => void => {
      const handler = (_: any, info: any) => callback(info)
      ipcRenderer.on('update:downloaded', handler)
      return () => ipcRenderer.removeListener('update:downloaded', handler)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
