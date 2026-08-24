// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RenewModal } from '../../renderer/src/components/modals/RenewModal'
import { useAppStore } from '../../renderer/src/store/appStore'
import { ToastContainer } from '../../renderer/src/components/ToastContainer'
import { installElectronApiMock } from './mocks/electronAPI'
import type { Client, MembershipPlan } from '../../../shared/types'

const CLIENT = { id: 'c1', fullName: 'Juan Pérez' } as Client

const PLANS: MembershipPlan[] = [
  {
    id: 'plan-mensual',
    name: 'Mensual',
    price: 50000,
    durationDays: 30,
    isActive: true
  },
  {
    id: 'plan-trimestral',
    name: 'Trimestral',
    price: 120000,
    durationDays: 90,
    isActive: true
  }
] as unknown as MembershipPlan[]

function renderRenewal(onSuccess = vi.fn(), onClose = vi.fn()) {
  render(
    <>
      <ToastContainer />
      <RenewModal client={CLIENT} activeMembership={null} plans={PLANS} onClose={onClose} onSuccess={onSuccess} />
    </>
  )
  return { onSuccess, onClose }
}

describe('RenewModal — renovación de membresía', () => {
  beforeEach(() => {
    useAppStore.setState({ toasts: [] }, false)
    localStorage.clear()
    vi.clearAllMocks()
  })

  function mockRenewal(resultOverride?: Record<string, unknown>) {
    return installElectronApiMock({
      membership: {
        createWithPayment: vi.fn(() =>
          Promise.resolve(
            resultOverride ?? {
              success: true,
              data: { membership: { id: 'm-new' }, payment: null }
            }
          )
        )
      },
      promotion: {
        getEffectivePrice: vi.fn(() =>
          Promise.resolve({ success: true, data: null })
        )
      }
    })
  }

  it('seleccionar plan carga su precio y crea la renovación con método de pago', async () => {
    const mock = mockRenewal()
    const user = userEvent.setup()
    const { onSuccess, onClose } = renderRenewal()

    const planSelect = screen.getAllByRole('combobox')[0]
    await user.selectOptions(planSelect, 'plan-mensual')

    // El monto se autocompleta con el precio del plan
    const amountInput = screen.getByDisplayValue('50000')
    expect(amountInput).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => {
      expect(mock.membership.createWithPayment).toHaveBeenCalledWith(
        'c1',
        'plan-mensual',
        50000,
        'cash',
        expect.any(String),
        undefined,
        undefined
      )
    })
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('muestra el toast de éxito cuando la membresía se crea correctamente', async () => {
    mockRenewal()
    const user = userEvent.setup()
    renderRenewal()

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'plan-trimestral')
    await user.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByText(/Membresía creada exitosamente/i)).toBeInTheDocument()
  })

  it('cuando el backend reporta error lógico muestra advertencia y no cierra el modal', async () => {
    mockRenewal({ success: false, data: { error: 'El cliente tiene una membresía activa' } })
    const user = userEvent.setup()
    const { onSuccess, onClose } = renderRenewal()

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'plan-mensual')
    await user.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByText(/El cliente tiene una membresía activa/)).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('excepción del IPC muestra toast de error', async () => {
    installElectronApiMock({
      membership: {
        createWithPayment: vi.fn(() => Promise.reject(new Error('DB bloqueada')))
      },
      promotion: {
        getEffectivePrice: vi.fn(() => Promise.resolve({ success: true, data: null }))
      }
    })
    const user = userEvent.setup()
    renderRenewal()

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'plan-mensual')
    await user.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByText('DB bloqueada')).toBeInTheDocument()
  })

  it('sin plan seleccionado el botón de renovación no dispara creación', async () => {
    const mock = mockRenewal()
    const user = userEvent.setup()
    renderRenewal()

    const renewBtn = screen.getByRole('button', { name: /Confirmar/i })
    expect(renewBtn).toBeDisabled()
    await user.click(renewBtn)
    expect(mock.membership.createWithPayment).not.toHaveBeenCalled()
  })
})
