import { useState, useEffect, useCallback } from 'react'
import { Icons } from './Icons'

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export function UpdateChecker(): JSX.Element {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [version, setVersion] = useState('')

  useEffect(() => {
    const cleanups: (() => void)[] = []

    if (window.electronAPI?.update) {
      cleanups.push(window.electronAPI.update.onChecking(() => {
        setStatus('checking')
        setErrorMsg('')
      }))

      cleanups.push(window.electronAPI.update.onAvailable((info: any) => {
        setStatus('available')
        setVersion(info?.version ?? '')
      }))

      cleanups.push(window.electronAPI.update.onNotAvailable(() => {
        setStatus('not-available')
        setTimeout(() => setStatus('idle'), 4000)
      }))

      cleanups.push(window.electronAPI.update.onError((error: any) => {
        setStatus('error')
        setErrorMsg(error)
      }))

      cleanups.push(window.electronAPI.update.onDownloadProgress((p: any) => {
        setStatus('downloading')
        setProgress(p.percent ?? 0)
      }))

      cleanups.push(window.electronAPI.update.onDownloaded(() => {
        setStatus('downloaded')
        setProgress(100)
      }))
    }

    return () => cleanups.forEach(fn => fn())
  }, [])

  const handleCheck = useCallback(async () => {
    setStatus('checking')
    setErrorMsg('')
    await window.electronAPI?.update?.check()
  }, [])

  const handleDownload = useCallback(async () => {
    setStatus('downloading')
    setProgress(0)
    await window.electronAPI?.update?.download()
  }, [])

  const handleInstall = useCallback(async () => {
    await window.electronAPI?.update?.install()
  }, [])

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-header">
        <Icons.Refresh />
        <span>Actualizaciones</span>
      </div>
      <div className="card-body">
        <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 16 }}>
          Versión actual: 1.0.0
        </p>

        {status === 'checking' && (
          <p style={{ color: 'var(--color-primary)' }}>Buscando actualizaciones...</p>
        )}

        {status === 'not-available' && (
          <p style={{ color: 'var(--color-success)' }}>Ya tienes la versión más reciente</p>
        )}

        {status === 'available' && (
          <div>
            <p style={{ color: 'var(--color-primary)', marginBottom: 12 }}>
              Nueva versión disponible: {version}
            </p>
            <button className="btn btn-primary" onClick={handleDownload}>
              <Icons.Download />
              Descargar actualización
            </button>
          </div>
        )}

        {status === 'downloading' && (
          <div>
            <p style={{ marginBottom: 8 }}>Descargando actualización...</p>
            <div style={{
              width: '100%', height: 8, borderRadius: 4,
              background: 'var(--color-bg-secondary)', overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                background: 'var(--color-primary)',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {status === 'downloaded' && (
          <div>
            <p style={{ color: 'var(--color-success)', marginBottom: 12 }}>
              Actualización descargada. ¿Reiniciar ahora?
            </p>
            <button className="btn btn-primary" onClick={handleInstall}>
              <Icons.Refresh />
              Reiniciar e instalar
            </button>
          </div>
        )}

        {status === 'error' && (
          <p style={{ color: 'var(--color-error)', marginBottom: 8 }}>
            Error: {errorMsg}
          </p>
        )}

        {status === 'idle' && (
          <button className="btn btn-secondary" onClick={handleCheck}>
            <Icons.Refresh />
            Buscar actualizaciones
          </button>
        )}
      </div>
    </div>
  )
}
