// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fireEvent } from '@testing-library/react'
import { ClientFormPage } from '../../renderer/src/pages/ClientFormPage'
import { installElectronApiMock } from './mocks/electronAPI'
import type { Client } from '../../shared/types'

function existingClient(): Client {
  return {
    id: 'c1',
    fullName: 'María García',
    documentId: 'DOC-1',
    birthDate: '1990-05-10T00:00:00Z',
    gender: 'female',
    phone: '+573001234567',
    email: 'maria@test.com',
    address: '',
    photo: null,
    accessCode: '4321',
    status: 'active',
    registrationDate: '2026-01-01T00:00:00Z',
    notes: '',
    emergencyContact: { name: '', phone: '', relationship: '', notes: '' }
  } as unknown as Client
}

describe('ClientFormPage — formulario de cliente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.hash = ''
    vi.spyOn(window, 'close').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('teléfono inválido: muestra error de validación y no envía al backend', async () => {
    const mock = installElectronApiMock()
    const user = userEvent.setup()
    render(<ClientFormPage />)

    await user.type(screen.getByPlaceholderText('Ingrese nombre completo'), 'Nuevo Cliente')
    await user.type(screen.getByPlaceholderText('Número de teléfono'), 'abc')
    fireEvent.submit(document.querySelector('form')!)

    expect(await screen.findByText('El teléfono no es válido')).toBeInTheDocument()
    expect(mock.client.create).not.toHaveBeenCalled()
    expect(mock.client.update).not.toHaveBeenCalled()
  })

  it('email inválido: muestra error de validación y no envía al backend', async () => {
    const mock = installElectronApiMock()
    const user = userEvent.setup()
    render(<ClientFormPage />)

    await user.type(screen.getByPlaceholderText('Ingrese nombre completo'), 'Nuevo Cliente')
    await user.type(screen.getByPlaceholderText('correo@ejemplo.com'), 'no-es-un-correo')
    fireEvent.submit(document.querySelector('form')!)

    expect(await screen.findByText('El email no es válido')).toBeInTheDocument()
    expect(mock.client.create).not.toHaveBeenCalled()
  })

  it('cliente nuevo válido: llama a create con los datos del formulario y cierra la ventana', async () => {
    const mock = installElectronApiMock({
      client: {
        create: vi.fn(() => Promise.resolve({ success: true, data: existingClient() }))
      }
    })
    const user = userEvent.setup()
    render(<ClientFormPage />)

    await user.type(screen.getByPlaceholderText('Ingrese nombre completo'), 'Nuevo Cliente')
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(mock.client.create).toHaveBeenCalledTimes(1)
    })
    const sent = mock.client.create.mock.calls[0][0] as { fullName: string }
    expect(sent.fullName).toBe('Nuevo Cliente')
    expect(mock.window.notifyClientFormSaved).toHaveBeenCalledTimes(1)
    expect(window.close).toHaveBeenCalled()
  })

  it('modo edición: carga el cliente existente y envía update al guardar', async () => {
    const mock = installElectronApiMock({
      client: {
        getById: vi.fn(() => Promise.resolve({ success: true, data: existingClient() })),
        update: vi.fn(() => Promise.resolve({ success: true, data: existingClient() })),
        create: vi.fn()
      }
    })
    window.location.hash = '#/form/client?id=c1'
    const user = userEvent.setup()
    render(<ClientFormPage />)

    await waitFor(() => {
      expect(mock.client.getById).toHaveBeenCalledWith('c1')
    })
    const nameInput = await screen.findByPlaceholderText('Ingrese nombre completo')
    expect(nameInput).toHaveValue('María García')

    await user.clear(nameInput)
    await user.type(nameInput, 'María García Editada')
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(mock.client.update).toHaveBeenCalledWith('c1', expect.objectContaining({ fullName: 'María García Editada' }))
    })
    expect(mock.client.create).not.toHaveBeenCalled()
  })

  it('error devuelto por el backend se muestra en el formulario', async () => {
    installElectronApiMock({
      client: {
        create: vi.fn(() =>
          Promise.resolve({ success: false, error: 'Ya existe un cliente con ese código de acceso' })
        )
      }
    })
    const user = userEvent.setup()
    render(<ClientFormPage />)

    await user.type(screen.getByPlaceholderText('Ingrese nombre completo'), 'Duplicado')
    fireEvent.submit(document.querySelector('form')!)

    expect(await screen.findByText(/Ya existe un cliente con ese código/i)).toBeInTheDocument()
  })
})
