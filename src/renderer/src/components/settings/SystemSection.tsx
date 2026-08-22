import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { UpdateChecker } from '@/components/UpdateChecker'
import { BackupConfig } from '../../../../shared/types'

export function SystemSection(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const confirm = useAppStore((state) => state.confirm)
  const [autoStart, setAutoStart] = useState(false)
  const [backupConfig, setBackupConfigState] = useState<BackupConfig>({
    enabled: true,
    retention: 7,
    lastBackupAt: null,
    backupDir: '',
    count: 0
  })
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState('')
  const [migrationBackupPath, setMigrationBackupPath] = useState<string | null>(null)

  const loadAutoStart = async () => {
    try {
      if (window.electronAPI?.system) {
        const result = await window.electronAPI.system.getAutoStart()
        if (result.success) setAutoStart(!!result.data)
      }
    } catch (e) { console.error('Error loading auto-start:', e) }
  }

  const loadBackupConfig = async () => {
    try {
      if (window.electronAPI?.backup?.getConfig) {
        const result = await window.electronAPI.backup.getConfig()
        if (result.success && result.data) {
          setBackupConfigState(result.data)
        }
      }
    } catch (e) { console.error('Error loading backup config:', e) }
  }

  const handleSaveBackupConfig = async (config: { enabled: boolean; retention: number }) => {
    try {
      if (window.electronAPI?.backup?.setConfig) {
        const result = await window.electronAPI.backup.setConfig(config)
        if (result.success) {
          setBackupConfigState(prev => ({ ...prev, ...config }))
          showToast('success', 'Configuración de respaldo guardada', 'Guardado')
        } else {
          showToast('error', result.error || 'Error al guardar respaldo', 'Error')
        }
      }
    } catch (e: any) {
      showToast('error', e.message || 'Error al guardar respaldo', 'Error')
    }
  }

  useEffect(() => {
    loadAutoStart()
    loadBackupConfig()
  }, [])

  return (
    <>
      <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
        <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
          <h2 className="headline-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Shield />
            Sistema
          </h2>
          <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
            Configuración general, inicio automático y administración de base de datos
          </p>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="glass-panel" style={{ padding: 20, marginBottom: 24 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0' }}>
                <input type="checkbox" checked={autoStart}
                  onChange={async (e) => {
                    const enabled = e.target.checked
                    setAutoStart(enabled)
                    if (window.electronAPI?.system?.setAutoStart) {
                      await window.electronAPI.system.setAutoStart(enabled)
                    }
                  }} />
                <span style={{ fontWeight: 500 }}>Iniciar automáticamente con Windows</span>
              </label>
              <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4, marginLeft: 28 }}>
                La aplicación se iniciará automáticamente cuando encienda el PC del gimnasio
              </p>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 className="headline-md" style={{ fontSize: 16, marginBottom: 16 }}>Respaldo de Base de Datos</h3>

            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0' }}>
                <input
                  type="checkbox"
                  checked={backupConfig.enabled}
                  onChange={(e) => handleSaveBackupConfig({ enabled: e.target.checked, retention: backupConfig.retention })}
                />
                <span style={{ fontWeight: 500 }}>Respaldo automático</span>
              </label>
              <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4, marginLeft: 28 }}>
                Se crea una copia de la base de datos al iniciar la aplicación y luego cada 24 horas.
              </p>

              <div className="form-row" style={{ marginTop: 16, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Conservar copias</label>
                  <input
                    type="number"
                    className="form-input"
                    value={backupConfig.retention}
                    min={1}
                    max={30}
                    style={{ width: 100 }}
                    onChange={(e) => setBackupConfigState(prev => ({ ...prev, retention: Math.max(1, Math.min(30, Number(e.target.value) || 7)) }))}
                  />
                  <small style={{ display: 'block', color: 'var(--color-secondary)', marginTop: 4 }}>
                    Las copias más antiguas se eliminan automáticamente (1–30)
                  </small>
                </div>
                <button className="btn btn-secondary" onClick={() => handleSaveBackupConfig({ enabled: backupConfig.enabled, retention: backupConfig.retention })}>
                  <Icons.Check />
                  Guardar
                </button>
              </div>

              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-secondary)' }}>
                {backupConfig.lastBackupAt
                  ? <>Último respaldo: <strong>{new Date(backupConfig.lastBackupAt).toLocaleString('es-CO')}</strong> · {backupConfig.count} copia(s) en carpeta local</>
                  : <>Aún no se ha creado ningún respaldo automático</>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={async () => {
                if (window.electronAPI?.backup?.runNow) {
                  const result = await window.electronAPI.backup.runNow()
                  if (result.success) {
                    showToast('success', `Respaldo creado: ${result.data}`, 'Respaldo Exitoso')
                    loadBackupConfig()
                  } else {
                    showToast('error', result.error || 'Error al crear respaldo', 'Error')
                  }
                }
              }}>
                <Icons.Download />
                Crear Respaldo Ahora
              </button>
              <button className="btn btn-secondary" onClick={async () => {
                if (window.electronAPI?.system?.backupDb) {
                  const result = await window.electronAPI.system.backupDb()
                  if (result.success) {
                    showToast('success', `Respaldo guardado en: ${result.data}`, 'Respaldo Exitoso')
                  } else if (result.error !== 'Canceled') {
                    showToast('error', result.error || 'Error al crear respaldo', 'Error')
                  }
                }
              }}>
                <Icons.Download />
                Guardar Copia (elegir ubicación)
              </button>
              <button className="btn btn-secondary" onClick={async () => {
                if (window.electronAPI?.system?.restoreDb) {
                  const ok = await confirm({ title: 'Restaurar base de datos', message: '¿Restaurar base de datos? Los cambios no guardados se perderán.', variant: 'warning', confirmLabel: 'Restaurar' })
                  if (!ok) return
                  const result = await window.electronAPI.system.restoreDb()
                  if (result.success) {
                    showToast('success', 'Base de datos restaurada. Reinicie la aplicación.', 'Restauración Exitosa')
                  } else if (result.error !== 'Canceled') {
                    showToast('error', result.error || 'Error al restaurar base de datos', 'Error')
                  }
                }
              }}>
                <Icons.Upload />
                Restaurar Base de Datos
              </button>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={async () => {
                if (!window.electronAPI?.system?.migrateLegacy) return
                const ok = await confirm({
                  title: '⚠️ Importar datos del sistema anterior',
                  message: '¿Importar datos desde la base de datos anterior (db_actual.sql)?\n\n⚠️ SE ELIMINARÁN todos los datos actuales: clientes, membresías, pagos, planes, productos y registros de acceso.\n\n✅ Se creará un backup automático antes de comenzar. Si la migración falla, los datos se restaurarán automáticamente.',
                  variant: 'warning',
                  confirmLabel: 'Importar'
                })
                if (!ok) return

                setShowMigrationModal(true)
                setMigrationBackupPath(null)
                setMigrationStatus('Selecciona el archivo db_actual.sql...')

                // Escuchar progreso
                const cleanup = window.electronAPI.system.onMigrationProgress((progress: { phase: string; table?: string; current?: number; message: string }) => {
                  if (progress.phase === 'parsing') {
                    setMigrationStatus(`📄 ${progress.message}`)
                  } else if (progress.phase === 'importing') {
                    setMigrationStatus(`📦 Importando ${progress.table}...`)
                  } else if (progress.phase === 'done') {
                    setMigrationStatus('✅ Migración completada exitosamente.')
                  }
                })

                try {
                  const result = await window.electronAPI.system.migrateLegacy()
                  cleanup()

                  if (result.success && result.data) {
                    setMigrationBackupPath(result.data.backupPath || null)
                    const summary = [
                      `✅ Completado: ${result.data.totalRecords} registros importados,`,
                      `${result.data.photosExported} fotos exportadas.`
                    ].join(' ')
                    setMigrationStatus(summary)
                    showToast('success', `Migración completada: ${result.data.totalRecords} registros`, 'Migración Exitosa')
                  } else {
                    setMigrationBackupPath((result.data as any)?.backupPath || null)
                    const errorMsg = result.error || 'Error desconocido'
                    setMigrationStatus(`❌ Error: ${errorMsg}`)
                    showToast('error', errorMsg, 'Error')
                  }
                } catch (e: any) {
                  cleanup()
                  setMigrationStatus(`❌ Error: ${e.message}`)
                  showToast('error', e.message || 'Error en la migración', 'Error')
                }
              }}>
                <Icons.Refresh />
                Importar datos del sistema anterior
              </button>
            </div>
            <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 8 }}>
              La base de datos contiene clientes, membresías, pagos, registros de acceso y configuración.
            </p>
          </div>

          <UpdateChecker />
        </div>
      </div>

      {showMigrationModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: 520, padding: 32, textAlign: 'center' }}>
            {migrationStatus.includes('✅') || migrationStatus.includes('❌') ? (
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {migrationStatus.includes('✅') ? '🎉' : '😞'}
              </div>
            ) : (
              <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 16px' }} />
            )}
            <h3 className="headline-md" style={{ marginBottom: 8 }}>
              {migrationStatus.includes('✅') ? 'Migración Completada' :
               migrationStatus.includes('❌') ? 'Error en Migración' :
               'Importando Datos Legacy'}
            </h3>
            <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
              {migrationStatus || 'Procesando...'}
            </p>

            {migrationBackupPath && (migrationStatus.includes('✅') || migrationStatus.includes('❌')) && (
              <div className="glass-panel" style={{
                marginTop: 16, padding: 12, fontSize: 12,
                textAlign: 'left',
                background: 'rgba(255, 107, 0, 0.08)'
              }}>
                <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--color-primary)' }}>
                  💾 Backup disponible
                </p>
                <p style={{ wordBreak: 'break-all', color: 'var(--color-on-surface-variant)' }}>
                  {migrationBackupPath}
                </p>
                <button className="btn btn-sm btn-secondary" style={{ marginTop: 8 }}
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Restaurar desde backup',
                      message: '¿Restaurar la base de datos desde el backup automático? Se perderán los cambios de la migración.',
                      variant: 'warning',
                      confirmLabel: 'Restaurar'
                    })
                    if (!ok) return
                    // No podemos pasar un path directamente al restoreDb existente
                    // Mostramos instrucciones al usuario
                    setMigrationStatus(`ℹ️ Para restaurar:
1. Ve a Sistema → Restaurar Base de Datos
2. Selecciona el archivo:
${migrationBackupPath}`)
                  }}>
                  <Icons.Upload />
                  ¿Cómo restaurar desde backup?
                </button>
              </div>
            )}

            {(migrationStatus.includes('✅') || migrationStatus.includes('❌')) && (
              <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
                {migrationStatus.includes('✅') ? (
                  <button className="btn btn-primary"
                    onClick={() => {
                      setShowMigrationModal(false)
                      window.location.reload()
                    }}>
                    <Icons.Refresh />
                    Reiniciar para aplicar cambios
                  </button>
                ) : (
                  <button className="btn btn-secondary"
                    onClick={() => setShowMigrationModal(false)}>
                    Cerrar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
