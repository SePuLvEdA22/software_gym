/** Tipo mínimo del resultado IPC que expone el preload. */
export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}
