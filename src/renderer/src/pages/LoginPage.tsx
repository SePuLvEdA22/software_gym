import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoSrc from '../assets/logo.png'

interface LoginPageProps {
  onLoginSuccess: () => void
}

export function LoginPage({ onLoginSuccess }: LoginPageProps): JSX.Element {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('Ingrese usuario y contraseña')
      return
    }
    setLoading(true)
    try {
      const result = await window.electronAPI.auth.login(username, password)
      if (result.success) {
        onLoginSuccess()
        navigate('/')
      } else {
        setError(result.error || 'Credenciales incorrectas')
      }
    } catch (err: any) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'var(--color-bg)'
    }}>
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 16,
        padding: 48,
        width: 400,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={logoSrc} alt="BodyFitGym" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary-container)', boxShadow: '0 0 20px rgba(255, 107, 0, 0.3)', marginBottom: 16 }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>BodyFitGym</h1>
          <p style={{ color: 'var(--color-secondary)', marginTop: 8, fontSize: 14 }}>Sistema de Gestión</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Usuario</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Nombre de usuario"
              autoFocus
              style={{ fontSize: 16, padding: '12px 16px' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
              style={{ fontSize: 16, padding: '12px 16px' }}
            />
          </div>

          {error && (
            <div style={{
              color: 'var(--color-error)',
              fontSize: 14,
              marginBottom: 16,
              textAlign: 'center',
              padding: 8,
              background: 'rgba(255,0,0,0.1)',
              borderRadius: 8
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: 16 }}
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <small style={{ color: 'var(--color-secondary)' }}>
            Usuario por defecto: admin / admin123
          </small>
        </div>
      </div>
    </div>
  )
}
