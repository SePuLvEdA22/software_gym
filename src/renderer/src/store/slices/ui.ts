export type ToastType = 'success' | 'error' | 'warning' | 'info'
export type ThemeMode = 'dark' | 'light'

export interface Toast {
  id: string
  type: ToastType
  message: string
  title?: string
}

export interface ConfirmDialogOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
}

export interface UISlice {
  loading: boolean
  searchQuery: string
  sidebarCollapsed: boolean
  triggerNewClientModal: boolean
  theme: ThemeMode
  toasts: Toast[]
  confirmDialog: ConfirmDialogOptions | null
  confirmResolve: ((value: boolean) => void) | null

  setLoading: (loading: boolean) => void
  setSearchQuery: (query: string) => void
  toggleSidebar: () => void
  setTriggerNewClientModal: (value: boolean) => void
  setTheme: (theme: ThemeMode) => void
  showToast: (type: ToastType, message: string, title?: string) => void
  removeToast: (id: string) => void
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>
  resolveConfirm: (value: boolean) => void
}

function generateToastId(): string {
  return 'toast_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

function getInitialTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem('bodyfitgym-theme')
    if (stored === 'dark' || stored === 'light') return stored
  } catch {}
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

export const defaultUIState = {
  loading: false,
  searchQuery: '',
  sidebarCollapsed: false,
  triggerNewClientModal: false,
  theme: getInitialTheme() as ThemeMode,
  toasts: [] as Toast[],
  confirmDialog: null as ConfirmDialogOptions | null,
  confirmResolve: null as ((value: boolean) => void) | null
}

export const createUIActions = (set: any) => ({
  setLoading: (loading: boolean) => set({ loading }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  toggleSidebar: () => set((state: any) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTriggerNewClientModal: (value: boolean) => set({ triggerNewClientModal: value }),
  setTheme: (theme: ThemeMode) => {
    try { localStorage.setItem('bodyfitgym-theme', theme) } catch {}
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  },

  showToast: (type: ToastType, message: string, title?: string) => {
    const id = generateToastId()
    const toast: Toast = { id, type, message, title }
    set((state: any) => ({ toasts: [...state.toasts, toast] }))
    setTimeout(() => {
      set((state: any) => ({
        toasts: state.toasts.filter((t: Toast) => t.id !== id)
      }))
    }, 5000)
  },

  removeToast: (id: string) => set((state: any) => ({
    toasts: state.toasts.filter((t: Toast) => t.id !== id)
  })),

  confirm: (options: ConfirmDialogOptions) => new Promise<boolean>((resolve) => {
    set({ confirmDialog: options, confirmResolve: resolve })
  }),

  resolveConfirm: (value: boolean) => set((state: any) => {
    state.confirmResolve?.(value)
    return { confirmDialog: null, confirmResolve: null }
  })
})
