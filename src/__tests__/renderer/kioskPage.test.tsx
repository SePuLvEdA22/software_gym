// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KioskPage } from '../../renderer/src/pages/KioskPage'
import { installElectronApiMock } from './mocks/electronAPI'
import type { Client, Membership, AccessValidation } from '../../shared/types'

const CLIENT: Client = {
  id: 'c1',
  accessCode: '5555',
  fullName: 'Juan Pérez',
  documentId: '123',
  phone: '3001234567',
  email: '',
  address: '',
  birthDate: '',
  gender: 'male',
  status: 'active',
  registrationDate: '2026-01-01T00:00:00Z',
  notes: '',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' }
} as unknown as Client

function futureMembership(days: number): Membership {
  const end = new Date()
  end.setDate(end.getDate() + days)
  return {
    id: 'm1',
    clientId: 'c1',
    planId: 'p1',
    startDate: '2026-01-01T00:00:00Z',
    endDate: end.toISOString(),
    status: 'active'
  } as unknown as Membership
}

function validation(overrides: Partial<AccessValidation>): AccessValidation {
  return {
    valid: false,
    message: '',
    code: 'denied_expired',
    ...overrides
  }
}

async function enterCodeAndCheckIn(user: ReturnType<typeof userEvent.setup>, code: string) {
  for (const digit of code) {
    await user.click(screen.getByRole('button', { name: digit }))
  }
  await user.click(screen.getByRole('button', { name: /Ingresar/i }))
}

describe('KioskPage — control de acceso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('valida el código ingresado por teclado numérico y lo envía al backend', async () => {
    const mock = installElectronApiMock({
      access: {
        validate: vi.fn(() =>
          Promise.resolve({
            success: true,
            data: validation({
              valid: true,
              code: 'granted',
              message: 'Acceso concedido',
              client: CLIENT,
              membership: futureMembership(10),
              debt: []
            })
          })
        )
      }
    })
    const user = userEvent.setup()
    render(<KioskPage />)

    await enterCodeAndCheckIn(user, '5555')

    await waitFor(() => {
      expect(mock.access.validate).toHaveBeenCalledWith('5555')
    })
  })

  it('acceso permitido: muestra estado activo y abre la puerta', async () => {
    const mock = installElectronApiMock({
      access: {
        validate: vi.fn(() =>
          Promise.resolve({
            success: true,
            data: validation({
              valid: true,
              code: 'granted',
              message: 'Acceso concedido',
              client: CLIENT,
              membership: futureMembership(10),
              debt: []
            })
          })
        )
      }
    })
    const user = userEvent.setup()
    render(<KioskPage />)

    await enterCodeAndCheckIn(user, '5555')

    expect(await screen.findByText(/JUAN PÉREZ/i)).toBeInTheDocument()
    expect(screen.getByText('Acceso Permitido — Membresía Activa')).toBeInTheDocument()
    expect(screen.getByText('Activa')).toBeInTheDocument()
    expect(mock.door.open).toHaveBeenCalledTimes(1)
  })

  it('código inexistente: muestra mensaje de error y no abre la puerta', async () => {
    const mock = installElectronApiMock({
      access: {
        validate: vi.fn(() => Promise.resolve({ success: false, error: 'not found' }))
      }
    })
    const user = userEvent.setup()
    render(<KioskPage />)

    await enterCodeAndCheckIn(user, '9999')

    expect(await screen.findByText('El código ingresado no existe')).toBeInTheDocument()
    expect(mock.door.open).not.toHaveBeenCalled()
  })

  it('membresía vencida: acceso denegado, puerta cerrada y botón de renovación visible', async () => {
    const mock = installElectronApiMock({
      access: {
        validate: vi.fn(() =>
          Promise.resolve({
            success: true,
            data: validation({
              valid: false,
              code: 'denied_expired',
              message: 'Membresía vencida',
              client: CLIENT,
              membership: futureMembership(-5)
            })
          })
        )
      }
    })
    const user = userEvent.setup()
    render(<KioskPage />)

    await enterCodeAndCheckIn(user, '5555')

    expect(await screen.findByText('Acceso Denegado — Membresía Vencida')).toBeInTheDocument()
    expect(screen.getByText('Vencida')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /RENOVAR MEMBRESÍA/i })).toBeInTheDocument()
    expect(mock.door.open).not.toHaveBeenCalled()
  })

  it('membresía congelada: estado ámbar con mensaje del backend y sin botón de renovación', async () => {
    installElectronApiMock({
      access: {
        validate: vi.fn(() =>
          Promise.resolve({
            success: true,
            data: validation({
              valid: false,
              code: 'denied_frozen',
              message: 'Membresía congelada - contacta recepción',
              client: CLIENT,
              membership: futureMembership(20)
            })
          })
        )
      }
    })
    const user = userEvent.setup()
    render(<KioskPage />)

    await enterCodeAndCheckIn(user, '5555')

    expect(await screen.findByText('Acceso Denegado — Membresía Congelada')).toBeInTheDocument()
    expect(screen.getByText(/contacta recepción/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /RENOVAR MEMBRESÍA/i })).not.toBeInTheDocument()
  })

  it('formulario inicial: muestra botón Abrir puerta sin validar ningún código', async () => {
    const mock = installElectronApiMock()
    const user = userEvent.setup()
    render(<KioskPage />)

    const openBtn = await screen.findByRole('button', { name: /Abrir puerta/i })
    expect(openBtn).toBeInTheDocument()

    await user.click(openBtn)

    await waitFor(() => {
      expect(mock.door.open).toHaveBeenCalledTimes(1)
      expect(mock.door.open).toHaveBeenCalledWith('manual')
    })
    expect(mock.access.validate).not.toHaveBeenCalled()
    expect(await screen.findByText('Puerta abierta')).toBeInTheDocument()
  })

  it('reapertura: no borra el código a medio escribir ni valida', async () => {
    const mock = installElectronApiMock()
    const user = userEvent.setup()
    render(<KioskPage />)

    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: /Abrir puerta/i }))

    await waitFor(() => {
      expect(mock.door.open).toHaveBeenCalledWith('manual')
    })
    expect(mock.access.validate).not.toHaveBeenCalled()
    expect(await screen.findByText('Puerta abierta')).toBeInTheDocument()
    // El formulario sigue visible (no se validó ni se reseteó al resultado)
    expect(screen.getByRole('button', { name: /Ingresar/i })).toBeInTheDocument()
  })

  it('puerta ya abierta: muestra aviso sin marcar error', async () => {
    installElectronApiMock({
      door: {
        open: vi.fn(() => Promise.resolve({ success: true, data: false }))
      }
    })
    const user = userEvent.setup()
    render(<KioskPage />)

    await user.click(await screen.findByRole('button', { name: /Abrir puerta/i }))

    expect(await screen.findByText('La puerta ya está abierta')).toBeInTheDocument()
  })

  it('fallo del relé: muestra error y permite reintentar tras el cooldown', async () => {
    const mock = installElectronApiMock({
      door: {
        open: vi.fn(() => Promise.resolve({ success: false, error: 'relay down' }))
      }
    })
    const user = userEvent.setup()
    render(<KioskPage />)

    const openBtn = await screen.findByRole('button', { name: /Abrir puerta/i })
    await user.click(openBtn)

    expect(await screen.findByText('relay down')).toBeInTheDocument()
    // Cooldown de 3s: el botón queda deshabilitado justo después del pulso
    expect(openBtn).toBeDisabled()
    expect(mock.door.open).toHaveBeenCalledTimes(1)
  })

    it('pantalla de resultado: no muestra el botón de apertura manual', async () => {

    installElectronApiMock({
      access: {
        validate: vi.fn(() =>
          Promise.resolve({
            success: true,
            data: validation({
              valid: true,
              code: 'granted',
              message: 'Acceso concedido',
              client: CLIENT,
              membership: futureMembership(10),
              debt: []
            })
          })
        )
      }
    })
    const user = userEvent.setup()
    render(<KioskPage />)

    await enterCodeAndCheckIn(user, '5555')

    expect(await screen.findByText(/JUAN PÉREZ/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Abrir puerta/i })).not.toBeInTheDocument()
  })

  it('responsive: el formulario permite scroll vertical y expone todo el teclado', async () => {
    installElectronApiMock()
    render(<KioskPage />)

    // El root debe permitir scroll (antes: overflow hidden recortaba medio botón)
    const root = document.querySelector('.kiosk-idle-root')
    expect(root).not.toBeNull()
    expect(root).toHaveStyle({ overflowY: 'auto' })

    // Todos los botones del formulario existen y están habilitados
    for (const digit of ['1', '5', '9', '0']) {
      expect(await screen.findByRole('button', { name: digit })).toBeEnabled()
    }
    expect(await screen.findByRole('button', { name: /Ingresar/i })).toBeEnabled()
    expect(await screen.findByRole('button', { name: /Abrir puerta/i })).toBeEnabled()
  })

  it('bienvenida: nombre del gym resaltado y sin marca superior', async () => {
    installElectronApiMock()
    render(<KioskPage />)

    // "Bienvenido a {nombre}" con el nombre resaltado (viene de settings)
    expect(await screen.findByText(/Bienvenido a/i)).toBeInTheDocument()
    expect(screen.getByText('BodyFitGym')).toBeInTheDocument()
    expect(document.querySelector('.kiosk-gym-highlight')).not.toBeNull()
    // Sin logo ni cápsula en la parte superior
    expect(document.querySelector('.kiosk-idle-brand-row')).toBeNull()
    expect(document.querySelector('.kiosk-idle-header')).toBeNull()
  })
})
