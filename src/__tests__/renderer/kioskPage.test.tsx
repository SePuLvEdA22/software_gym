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
})
