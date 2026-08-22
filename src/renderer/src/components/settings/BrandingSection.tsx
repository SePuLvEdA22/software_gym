import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'

export function BrandingSection(): JSX.Element {
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)

  return (
    <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
      <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
        <h2 className="headline-md" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icons.Sun />
          Marca y Apariencia
        </h2>
        <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
          Personalice la apariencia de su panel de administración
        </p>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 className="headline-md" style={{ fontSize: 16, marginBottom: 16 }}>Tema</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTheme('dark')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              🌙 Oscuro
            </button>
            <button
              className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTheme('light')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              ☀️ Claro
            </button>
          </div>
          <p className="body-lg" style={{ color: 'var(--color-secondary)', marginTop: 12, fontSize: 13 }}>
            Cambie entre temas oscuro y claro. Su preferencia se guarda automáticamente.
          </p>
        </div>
      </div>
    </div>
  )
}
