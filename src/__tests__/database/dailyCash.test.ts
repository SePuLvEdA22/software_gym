import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { formatISO } from 'date-fns'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import { createClient } from '../../main/database/clients'
import { recordPayment } from '../../main/database/payments'
import { createProduct, registerMovement } from '../../main/database/inventory'
import { getDailyCashData, buildDailyCashHtml } from '../../main/dailyCash'

describe('Cierre de caja diario', () => {
  beforeAll(async () => {
    await initDatabase()
    const db = getDatabase()
    const client = createClient({
      fullName: '<b>Cliente</b> Caja',
      documentId: `CAJA-${Date.now()}`,
      birthDate: '1990-01-01',
      gender: 'male',
      phone: '3000000002',
      email: 'caja@example.com',
      address: '',
      photo: null,
      accessCode: `C${String(Date.now()).slice(-6)}`,
      status: 'active',
      emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
    })
    const setDate = (id: string, d: Date): void => {
      db.prepare('UPDATE payments SET date = ? WHERE id = ?').run(formatISO(d), id)
    }
    // 00:30 local: borde de madrugada que una comparación en UTC dejaría fuera.
    setDate(recordPayment(client.id, 50000, 'cash', 'Madrugada', undefined, '', 1000).id, new Date(2026, 8, 15, 0, 30))
    setDate(recordPayment(client.id, 70000, 'nequi', 'Noche', undefined, '', 0).id, new Date(2026, 8, 15, 23, 50))
    setDate(recordPayment(client.id, 99000, 'cash', 'Otro día', undefined, '', 0).id, new Date(2026, 8, 16, 8, 0))

    const product = createProduct({
      name: 'Agua Caja', category: 'drink', description: '', price: 2000, cost: 1000,
      stock: 10, minStock: 1, barcode: `CAJA${Date.now()}`,
    })
    const mv = registerMovement(product.id, 'out', 3, 2000, 'Venta')!
    db.prepare('UPDATE inventory_movements SET timestamp = ? WHERE id = ?').run(
      formatISO(new Date(2026, 8, 15, 12, 0)), mv.id,
    )
  })

  afterAll(() => closeDatabase())

  it('suma solo los pagos y ventas del día local, incluyendo la madrugada', () => {
    const d = getDailyCashData('2026-09-15')
    expect(d.payments).toHaveLength(2)
    expect(d.paymentsTotal).toBe(120000)
    expect(d.totalDiscount).toBe(1000)
    expect(d.byMethod).toEqual({ cash: 50000, nequi: 70000 })
    expect(d.sales).toEqual([{ productName: 'Agua Caja', quantity: 3, total: 6000 }])
    expect(d.grandTotal).toBe(126000)
  })

  it('escapa el HTML de los datos del cliente', () => {
    const html = buildDailyCashHtml(getDailyCashData('2026-09-15'))
    expect(html).toContain('&lt;b&gt;Cliente&lt;/b&gt;')
    expect(html).not.toContain('<b>Cliente')
  })
})
