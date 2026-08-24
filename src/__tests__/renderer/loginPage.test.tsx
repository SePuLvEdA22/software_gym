import '@testing-library/jest-dom/vitest'
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from '../../renderer/src/pages/LoginPage'
import { installElectronApiMock } from './mocks/electronAPI'

function renderLoginPage(onLoginSuccess = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage onLoginSuccess={onLoginSuccess} />} />
        <Route path="/" element={<div>Panel Principal</div>} />
      </Routes>
    </MemoryRouter>
  )
  return { onLoginSuccess }
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra error de validación si faltan usuario o contraseña y no llama al backend', async () => {
    const mock = installElectronApiMock()
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    expect(screen.getByText('Ingrese usuario y contraseña')).toBeInTheDocument()
    expect(mock.auth.login).not.toHaveBeenCalled()
  })

  it('muestra el error devuelto por el backend cuando las credenciales son incorrectas', async () => {
    const mock = installElectronApiMock({
      auth: {
        login: vi.fn(() => Promise.resolve({ success: false, error: 'Usuario bloqueado temporalmente' }))
      }
    })
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByPlaceholderText('Nombre de usuario'), 'admin')
    await user.type(screen.getByPlaceholderText('Contraseña'), 'mala-clave')
    await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    expect(mock.auth.login).toHaveBeenCalledWith('admin', 'mala-clave')
    await waitFor(() => {
      expect(screen.getByText('Usuario bloqueado temporalmente')).toBeInTheDocument()
    })
  })

  it('login exitoso invoca onLoginSuccess y navega al panel principal', async () => {
    installElectronApiMock({
      auth: {
        login: vi.fn(() => Promise.resolve({ success: true, data: { success: true } as never }))
      }
    })
    const user = userEvent.setup()
    const { onLoginSuccess } = renderLoginPage()

    await user.type(screen.getByPlaceholderText('Nombre de usuario'), 'admin')
    await user.type(screen.getByPlaceholderText('Contraseña'), 'correcta')
    await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    await waitFor(() => {
      expect(screen.getByText('Panel Principal')).toBeInTheDocument()
    })
    expect(onLoginSuccess).toHaveBeenCalledTimes(1)
  })

  it('si debe cambiar la contraseña muestra el formulario de cambio en vez de entrar', async () => {
    installElectronApiMock({
      auth: {
        login: vi.fn(() =>
          Promise.resolve({ success: true, data: { mustChangePassword: true } as never })
        )
      }
    })
    const user = userEvent.setup()
    const { onLoginSuccess } = renderLoginPage()

    await user.type(screen.getByPlaceholderText('Nombre de usuario'), 'admin')
    await user.type(screen.getByPlaceholderText('Contraseña'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    await waitFor(() => {
      expect(screen.getByText(/debe cambiar la contraseña por defecto/i)).toBeInTheDocument()
    })
    expect(onLoginSuccess).not.toHaveBeenCalled()
    expect(screen.queryByText('Panel Principal')).not.toBeInTheDocument()
  })

  it('cambio de contraseña con confirmación que no coincide muestra error y no llama updateAdmin', async () => {
    installElectronApiMock({
      auth: {
        login: vi.fn(() =>
          Promise.resolve({ success: true, data: { mustChangePassword: true } as never })
        )
      },
      system: {
        updateAdmin: vi.fn(() => Promise.resolve({ success: true, data: null }))
      }
    })
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByPlaceholderText('Nombre de usuario'), 'admin')
    await user.type(screen.getByPlaceholderText('Contraseña'), 'admin123')
    await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    await screen.findByText(/debe cambiar la contraseña por defecto/i)
    await user.type(screen.getByPlaceholderText('Mínimo 4 caracteres'), 'nueva123')
    await user.type(screen.getByPlaceholderText('Repita la contraseña'), 'distinta')
    await user.click(screen.getByRole('button', { name: /Cambiar Contraseña/i }))

    expect(await screen.findByText('Las contraseñas nuevas no coinciden')).toBeInTheDocument()
  })

  it('excepción del IPC durante el login muestra Error de conexión', async () => {
    installElectronApiMock({
      auth: {
        login: vi.fn(() => Promise.reject(new Error('network down')))
      }
    })
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByPlaceholderText('Nombre de usuario'), 'admin')
    await user.type(screen.getByPlaceholderText('Contraseña'), 'x')
    await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }))

    expect(await screen.findByText('Error de conexión')).toBeInTheDocument()
  })
})
