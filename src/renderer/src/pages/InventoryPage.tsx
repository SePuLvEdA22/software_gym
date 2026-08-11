import { useEffect, useState, useMemo } from 'react'
import { useFormSaved } from '@/hooks/useFormSaved'
import { useAppStore } from '@/store/appStore'
import { Product, InventoryMovement } from '../../../shared/types'
import { Icons } from '@/components/Icons'
import { Pagination } from '@/components/Pagination'
import { formatCurrency } from '@/utils/format'
import { format, parseISO } from 'date-fns'

const categoryLabels: Record<string, string> = {
  supplement: 'Suplementos',
  drink: 'Bebidas',
  accessory: 'Accesorios',
  other: 'Ropa y Otros'
}

const categoryColors: Record<string, string> = {
  supplement: 'var(--color-primary)',
  drink: 'var(--color-info)',
  accessory: 'var(--color-warning)',
  other: 'var(--color-secondary)'
}

const filterCategories = [
  { value: '', label: 'Todos los Productos' },
  { value: 'supplement', label: 'Suplementos' },
  { value: 'other', label: 'Ropa y Otros' },
  { value: 'accessory', label: 'Accesorios' },
  { value: 'drink', label: 'Bebidas' },
]

function getStockLevel(stock: number): 'success' | 'warning' | 'error' {
  if (stock < 5) return 'error'
  if (stock <= 20) return 'warning'
  return 'success'
}

function getStockLabel(stock: number): string {
  if (stock < 5) return 'Por Reordenar'
  if (stock <= 20) return 'Ordenar Pronto'
  return 'En Stock'
}

function getStockPercent(stock: number): number {
  return Math.min(Math.round((stock / 50) * 100), 100)
}


export function InventoryPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const confirm = useAppStore((state) => state.confirm)
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [tab, setTab] = useState<'products' | 'movements'>('products')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [movementsPage, setMovementsPage] = useState(1)
  const [movementsTotalPages, setMovementsTotalPages] = useState(1)
  const [pageSize] = useState(50)
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([])

  const loadProducts = async () => {
    const searchParam = search.trim() || undefined
    const categoryParam = selectedCategory || undefined
    const r = await window.electronAPI.inventory.getAllProducts(false, { page, pageSize, search: searchParam, category: categoryParam })
    if (r.success && r.data) {
      setProducts(r.data.data)
      setTotalPages(r.data.totalPages)
      setTotalCount(r.data.total)
    }
  }

  const loadMovements = async () => {
    const r = await window.electronAPI.inventory.getMovements(undefined, { page: movementsPage, pageSize })
    if (r.success && r.data) {
      setMovements(r.data.data)
      setMovementsTotalPages(r.data.totalPages)
    }
  }

  const loadLowStock = async () => {
    const r = await window.electronAPI.inventory.getLowStock(undefined)
    if (r.success && r.data) {
      setLowStockProducts(r.data)
    }
  }

  useEffect(() => { loadProducts() }, [page, search, selectedCategory])
  useEffect(() => { loadMovements() }, [movementsPage])
  useEffect(() => { loadProducts(); loadMovements(); loadLowStock() }, [])

  useEffect(() => {
    const handler = () => { window.electronAPI.window.openForm('product') }
    window.addEventListener('shortcut:newProduct', handler)
    return () => window.removeEventListener('shortcut:newProduct', handler)
  }, [])

  // Recargar listas cuando los formularios de producto/movimiento guardan en su propia ventana
  useFormSaved('product', (message) => {
    if (message) showToast('success', message)
    loadProducts()
    loadLowStock()
  })
  useFormSaved('movement', (message) => {
    if (message) showToast('success', message)
    loadProducts()
    loadMovements()
    loadLowStock()
  })

  useEffect(() => { setPage(1) }, [search, selectedCategory])

  const handleDelete = async (product: Product) => {
    const ok = await confirm({
      title: 'Eliminar Producto',
      message: `¿Eliminar "${product.name}"?`,
      variant: 'danger',
      confirmLabel: 'Eliminar'
    })
    if (!ok) return
    const r = await window.electronAPI.inventory.deleteProduct(product.id)
    if (r.success) { showToast('success', 'Producto eliminado'); loadProducts() }
    else showToast('error', r.error || 'Error al eliminar el producto')
  }

  const uniqueCategories = useMemo(() => {
    return [...new Set(products.map(p => p.category))].length
  }, [products])

  const thisMonthSales = useMemo(() => {
    const now = new Date()
    return movements
      .filter(m => {
        const d = parseISO(m.timestamp)
        return m.type === 'out' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((sum, m) => sum + m.total, 0)
  }, [movements])

  const stockFillColor = (stock: number) => {
    if (stock < 5) return 'var(--color-error)'
    if (stock <= 20) return 'var(--color-warning)'
    return 'var(--color-success)'
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="display-lg" style={{ margin: 0 }}>Inventario de Tienda</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: 220 }}>
            <Icons.Search />
            <input type="text" placeholder="Buscar productos..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => window.electronAPI.window.openForm('product')}>
            <Icons.Plus /> Agregar Producto
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        <button className={`btn ${tab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px 0 0 8px' }} onClick={() => setTab('products')}>Productos</button>
        <button className={`btn ${tab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '0 8px 8px 0' }}
          onClick={() => { setTab('movements'); loadMovements() }}>Movimientos</button>
      </div>

      {tab === 'products' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="metric-card">
              <div className="metric-card-blur" style={{ width: 120, height: 120, background: 'var(--color-primary-container)', top: -30, right: -30 }} />
              <div className="metric-card-label">Total Productos</div>
              <div className="metric-card-value">{totalCount}</div>
            </div>
            <div className="metric-card" style={{ borderColor: 'rgba(255, 180, 171, 0.3)' }}>
              <div className="metric-card-blur" style={{ width: 120, height: 120, background: 'var(--color-error)', top: -30, right: -30 }} />
              <div className="metric-card-label" style={{ color: 'var(--color-error)' }}>Stock Bajo</div>
              <div className="metric-card-value" style={{ color: 'var(--color-error)' }}>{lowStockProducts.length}</div>
            </div>
            <div className="metric-card">
              <div className="metric-card-blur" style={{ width: 120, height: 120, background: 'var(--color-info)', top: -30, right: -30 }} />
              <div className="metric-card-label">Categorías</div>
              <div className="metric-card-value">{uniqueCategories}</div>
            </div>
            <div className="metric-card">
              <div className="metric-card-blur" style={{ width: 120, height: 120, background: 'var(--color-success)', top: -30, right: -30 }} />
              <div className="metric-card-label">Ventas del Mes</div>
              <div className="metric-card-value">{formatCurrency(thisMonthSales)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {filterCategories.map(fc => (
              <button key={fc.value}
                className={`filter-pill ${selectedCategory === fc.value ? 'active' : ''}`}
                onClick={() => setSelectedCategory(fc.value)}>
                {fc.label}
              </button>
            ))}
          </div>

          {products.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: 48, borderRadius: 12 }}>
              <p className="headline-md" style={{ color: 'var(--color-on-surface-variant)' }}>No se encontraron productos</p>
              <p className="label-md" style={{ color: 'var(--color-on-surface-variant)', marginTop: 8 }}>Ajuste su búsqueda o filtros</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
                {products.map(p => {
                  const level = getStockLevel(p.stock)
                  const color = stockFillColor(p.stock)
                  return (
                    <div key={p.id} className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span className="label-md" style={{ background: categoryColors[p.category] + '22', color: categoryColors[p.category], padding: '2px 10px', borderRadius: 9999 }}>
                          {categoryLabels[p.category] || p.category}
                        </span>
                        <span className={`status-badge-${level}`}>{getStockLabel(p.stock)}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 className="headline-md" style={{ fontSize: 'clamp(16px, 2vw, 20px)', margin: '0 0 4px 0' }}>{p.name}</h3>
                        <div className="label-xl" style={{ color: 'var(--color-primary-container)', marginBottom: 8 }}>{formatCurrency(p.price)}</div>
                        {p.barcode && (
                          <div className="label-md" style={{ color: 'var(--color-on-surface-variant)' }}>Código: {p.barcode}</div>
                        )}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span className="label-md">Stock</span>
                          <span className="label-md" style={{ color }}>{p.stock} unds</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-bar-fill" style={{ width: `${getStockPercent(p.stock)}%`, backgroundColor: color }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => window.electronAPI.window.openForm('movement', { productId: p.id })} title="Movimiento"><Icons.Plus /></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => window.electronAPI.window.openForm('product', { id: p.id })} title="Editar"><Icons.Edit /></button>
                        <button className="btn btn-sm btn-secondary" style={{ color: 'var(--color-error)', marginLeft: 'auto' }} onClick={() => handleDelete(p)} title="Eliminar"><Icons.Trash /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} size="sm" />
            </>
          )}
        </>
      )}

      {tab === 'movements' && (
        <div className="glass-panel" style={{ borderRadius: 12, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Cant</th>
                  <th>Precio</th>
                  <th>Total</th>
                  <th>Descripción</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 13 }}>{format(parseISO(m.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                    <td>{m.productName}</td>
                    <td><span className={`status-badge-${m.type === 'in' ? 'success' : 'error'}`}>{m.type === 'in' ? 'Entrada' : 'Salida'}</span></td>
                    <td>{m.quantity}</td>
                    <td>{formatCurrency(m.price)}</td>
                    <td>{formatCurrency(m.total)}</td>
                    <td style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>{m.description}</td>
                    <td style={{ fontSize: 13 }}>{m.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 16px' }}>
            <Pagination page={movementsPage} totalPages={movementsTotalPages} onPageChange={setMovementsPage} size="sm" />
          </div>
        </div>
      )}

    </div>
  )
}
