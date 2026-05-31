import { create } from 'zustand'
import { UISlice, defaultUIState, createUIActions, Toast, ToastType, ConfirmDialogOptions } from './slices/ui'
import { DataSlice, defaultDataState, createDataActions } from './slices/data'
import { DashboardSlice, defaultDashboardState, createDashboardActions } from './slices/dashboard'

export type { ToastType }
export type { Toast }
export type { ConfirmDialogOptions }

type AppState = UISlice & DataSlice & DashboardSlice

export const useAppStore = create<AppState>((set) => ({
  ...defaultUIState,
  ...defaultDataState,
  ...defaultDashboardState,
  ...createUIActions(set),
  ...createDataActions(set),
  ...createDashboardActions(set)
}))
