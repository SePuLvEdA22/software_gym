// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentsPage } from '../../renderer/src/pages/PaymentsPage'
import { installElectronApiMock } from './mocks/electronAPI'
import { ToastContainer } from '../../renderer/src/components/ToastContainer'
import type { Payment } from '../../../shared/types'

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: 'pay-1',
    clientId: 'c1',
    clientName: 'Juan Pérez',
    membershipId: null,
    amount: 50000,
    discount: 0,
    method: 'cash',
    description: 'Membresía Mensual',
    date: new Date().toISOString(),
    notes: '',
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

function paymentsResponse(data: Payment[]) {
  return { success: true, data: { data, total: data.length, page: 1, totalPages: 1 } }
}

describe('PaymentsPage — resumen de facturación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  function installDefaults(payments: Payment[]) {
    return installElectronApiMock({
      payment: {
        getByDateRange: vi.fn(() => Promise.resolve(paymentsResponse(payments)))
      },
      dashboard: {
        getRevenueByYear: vi.fn(() => Promise.resolve({ success: true, data: 150000 })),
        getRevenueByTimeOfDay: vi.fn(() =>
          Promise.resolve({ success: true, data: { morning: 50000, afternoon: 0, evening: 0 } as never })
        )
      }
    })
  }

  it('carga los pagos y calcula el total del resumen con la moneda local', async () => {
    const mock = installDefaults([
      payment({ id: 'p1', amount: 50000, method: 'cash' }),
      payment({ id: 'p2', amount: 30000, method: 'transfer', discount: 5000 }),
      payment({ id: 'p3', amount: 20000, method: 'cash' })
    ])
    render(<><ToastContainer /><PaymentsPage /></>)

    // Filas de la tabla
    expect((await screen.findAllByText('Juan Pérez')).length).toBe(3)

    await waitFor(() => {
      expect(mock.payment.getByDateRange).toHaveBeenCalledTimes(1)
    })

    // Resumen: total = 100.000 en 3 pagos
    expect(screen.getByText('3')).toBeInTheDocument() // cantidad de transacciones
    const amounts = screen.getAllByText(/100\.000/)
    expect(amounts.length).toBeGreaterThan(0) // total y promedio coinciden
    expect(screen.getAllByText(/5\.000/).length).toBeGreaterThanOrEqual(2) // descuento en resumen y en fila
  })

  it('envía el método de filtro al backend cuando se selecciona uno distinto de "todos"', async () => {
    const mock = installDefaults([payment({ id: 'p1', amount: 10000, method: 'cash' })])
    const user = userEvent.setup()
    render(<><ToastContainer /><PaymentsPage /></>)

    await screen.findByText('Juan Pérez')
    mock.payment.getByDateRange.mockClear()

    // El select de método de pago
    const methodSelect = screen
      .getAllByRole('combobox')
      .find(el => (el as HTMLSelectElement).textContent?.includes('Efectivo'))
    expect(methodSelect).toBeDefined()
    await user.selectOptions(methodSelect!, 'cash')

    await waitFor(() => {
      expect(mock.payment.getByDateRange).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ method: 'cash' })
      )
    })
  })

  it('exporta el reporte CSV y muestra confirmación', async () => {
    installDefaults([])
    const user = userEvent.setup()
    render(<><ToastContainer /><PaymentsPage /></>)

    const exportBtn = await screen.findByRole('button', { name: /Exportar Reporte/i })
    await user.click(exportBtn)

    await waitFor(() => {
      expect(screen.getByText(/Exportado:/i)).toBeInTheDocument()
    })
  })

  it('sin pagos el resumen muestra cero transacciones', async () => {
    installDefaults([])
    render(<><ToastContainer /><PaymentsPage /></>)

    await waitFor(() => {
      expect(screen.queryByText('Cargando pagos...')).not.toBeInTheDocument()
    })
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
