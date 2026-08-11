import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase } from '../../main/database/index'
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  registerMovement,
  getMovements,
  getLowStockProducts,
} from '../../main/database/inventory'
import type { Product } from '../../shared/types'

const sampleProduct: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> = {
  name: 'Proteína Whey',
  category: 'supplement',
  description: 'Proteína de suero',
  price: 120000,
  cost: 80000,
  stock: 50,
  minStock: 10,
  barcode: '7701234567890',
}

describe('Inventory', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  describe('Products CRUD', () => {
    it('should create a product', () => {
      const product = createProduct(sampleProduct)
      expect(product.id).toBeDefined()
      expect(product.name).toBe('Proteína Whey')
      expect(product.price).toBe(120000)
      expect(product.stock).toBe(50)
      expect(product.isActive).toBe(true)
      expect(product.category).toBe('supplement')
    })

    it('should get product by id', () => {
      const product = createProduct({ ...sampleProduct, name: 'Get Test', barcode: 'GET001' })
      const found = getProductById(product.id)
      expect(found).not.toBeNull()
      expect(found!.name).toBe('Get Test')
    })

    it('should return null for non-existent product', () => {
      const found = getProductById('non-existent')
      expect(found).toBeNull()
    })

    it('should list all products with pagination', () => {
      for (let i = 0; i < 5; i++) {
        createProduct({ ...sampleProduct, name: `Pagination Product ${i}`, barcode: `PAG${i}` })
      }
      const result = getAllProducts(false, 1, 3)
      expect(result.data.length).toBeLessThanOrEqual(3)
      expect(result.total).toBeGreaterThanOrEqual(5)
      expect(result.page).toBe(1)
      expect(result.totalPages).toBeGreaterThanOrEqual(2)
    })

    it('should list only active products by default', () => {
      const inactive = createProduct({ ...sampleProduct, name: 'Inactive Product', barcode: 'INACTIVE001' })
      updateProduct(inactive.id, { isActive: false })
      const activeProducts = getAllProducts()
      expect(activeProducts.data.every(p => p.isActive)).toBe(true)
      const allProducts = getAllProducts(false)
      expect(allProducts.data.some(p => !p.isActive)).toBe(true)
    })

    it('should update a product', () => {
      const product = createProduct({ ...sampleProduct, name: 'Update Test', barcode: 'UPDATE001' })
      const updated = updateProduct(product.id, { price: 130000, stock: 40 })
      expect(updated).not.toBeNull()
      expect(updated!.price).toBe(130000)
      expect(updated!.stock).toBe(40)
      expect(updated!.name).toBe('Update Test')
    })

    it('should return null when updating non-existent product', () => {
      const result = updateProduct('non-existent', { name: 'Test' })
      expect(result).toBeNull()
    })

    it('should delete a product', () => {
      const product = createProduct({ ...sampleProduct, name: 'Delete Test', barcode: 'DELETE001' })
      const result = deleteProduct(product.id)
      expect(result).toBe(true)
      const found = getProductById(product.id)
      expect(found).toBeNull()
    })

    it('should return false when deleting non-existent product', () => {
      const result = deleteProduct('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('Inventory Movements', () => {
    it('should register an entry movement', () => {
      const product = createProduct({ ...sampleProduct, name: 'Movement Test In', barcode: 'MOVIN001' })
      const movement = registerMovement(product.id, 'in', 10, 75000, 'Compra a proveedor')
      expect(movement).not.toBeNull()
      expect(movement!.type).toBe('in')
      expect(movement!.quantity).toBe(10)
      expect(movement!.price).toBe(75000)
      expect(movement!.total).toBe(750000)
      expect(movement!.productId).toBe(product.id)
      expect(movement!.productName).toBe('Movement Test In')
    })

    it('should register an exit movement', () => {
      const product = createProduct({ ...sampleProduct, name: 'Movement Test Out', barcode: 'MOVOUT001' })
      registerMovement(product.id, 'in', 20, 50000, 'Stock inicial')
      const movement = registerMovement(product.id, 'out', 5, 90000, 'Venta')
      expect(movement).not.toBeNull()
      expect(movement!.type).toBe('out')
      expect(movement!.quantity).toBe(5)
    })

    it('should update stock on movement', () => {
      const product = createProduct({ ...sampleProduct, name: 'Stock Test', barcode: 'STK001', stock: 0 })
      registerMovement(product.id, 'in', 100, 10000, 'Entrada masiva')
      const updated = getProductById(product.id)
      expect(updated!.stock).toBe(100)
      registerMovement(product.id, 'out', 30, 15000, 'Venta')
      const afterSale = getProductById(product.id)
      expect(afterSale!.stock).toBe(70)
    })

    it('should return null for non-existent product movement', () => {
      const movement = registerMovement('non-existent', 'in', 1, 1000, 'Test')
      expect(movement).toBeNull()
    })

    it('should get movements with pagination', () => {
      const product = createProduct({ ...sampleProduct, name: 'Movement Pagination', barcode: 'MVPG001' })
      for (let i = 0; i < 5; i++) {
        registerMovement(product.id, 'in', 1, 1000, `Mov ${i}`)
      }
      const page1 = getMovements(undefined, 1, 3)
      expect(page1.data.length).toBeLessThanOrEqual(3)
      expect(page1.total).toBeGreaterThanOrEqual(5)
      expect(page1.totalPages).toBeGreaterThanOrEqual(2)
    })

    it('should get movements filtered by product', () => {
      const p1 = createProduct({ ...sampleProduct, name: 'Filter Product A', barcode: 'FLTA001' })
      const p2 = createProduct({ ...sampleProduct, name: 'Filter Product B', barcode: 'FLTB001' })
      registerMovement(p1.id, 'in', 1, 100, 'A only')
      registerMovement(p2.id, 'in', 1, 100, 'B only')
      const p1Movements = getMovements(p1.id)
      expect(p1Movements.data.every(m => m.productId === p1.id)).toBe(true)
      expect(p1Movements.data.length).toBe(1)
    })
  })

  describe('Integridad de stock (movimientos inválidos)', () => {
    it('NO permite movimientos con cantidad 0', () => {
      const product = createProduct({ ...sampleProduct, name: 'Cero Qty', barcode: 'ZERO001', stock: 10 })
      const m = registerMovement(product.id, 'in', 0, 1000, 'Cero')
      expect(m).toBeNull()
      expect(getProductById(product.id)!.stock).toBe(10)
    })

    it('NO permite cantidades negativas (antes una salida negativa INCREMENTABA el stock)', () => {
      const product = createProduct({ ...sampleProduct, name: 'Neg Qty', barcode: 'NEG001', stock: 10 })
      const m = registerMovement(product.id, 'out', -5, 1000, 'Negativa')
      expect(m).toBeNull()
      expect(getProductById(product.id)!.stock).toBe(10)
      // Tampoco se registra un movimiento fantasma
      expect(getMovements(product.id).total).toBe(0)
    })

    it('NO permite salidas mayores al stock disponible (el stock nunca queda negativo)', () => {
      const product = createProduct({ ...sampleProduct, name: 'Oversell', barcode: 'OVR001', stock: 3 })
      const m = registerMovement(product.id, 'out', 10, 1000, 'Sobreventa')
      expect(m).toBeNull()
      expect(getProductById(product.id)!.stock).toBe(3)
    })

    it('permite salida exacta al stock disponible (stock llega a 0)', () => {
      const product = createProduct({ ...sampleProduct, name: 'Exact Out', barcode: 'EXCT001', stock: 5 })
      const m = registerMovement(product.id, 'out', 5, 1000, 'Últimas unidades')
      expect(m).not.toBeNull()
      expect(getProductById(product.id)!.stock).toBe(0)
    })
  })

  describe('Low Stock', () => {
    it('should return products below minimum stock', () => {
      createProduct({ ...sampleProduct, name: 'Low Stock Product', barcode: 'LOW001', stock: 5, minStock: 10 })
      createProduct({ ...sampleProduct, name: 'Well Stocked', barcode: 'HIGH001', stock: 100, minStock: 10 })
      const low = getLowStockProducts()
      expect(low.some(p => p.name === 'Low Stock Product')).toBe(true)
      expect(low.every(p => p.stock <= p.minStock)).toBe(true)
    })

    it('should respect custom threshold', () => {
      const product = createProduct({ ...sampleProduct, name: 'Custom Threshold', barcode: 'CTH001', stock: 15, minStock: 10 })
      const lowDefault = getLowStockProducts()
      expect(lowDefault.some(p => p.id === product.id)).toBe(false)
      const lowCustom = getLowStockProducts(20)
      expect(lowCustom.some(p => p.id === product.id)).toBe(true)
    })
  })
})
