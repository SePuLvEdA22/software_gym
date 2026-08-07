import { useEffect, useState, useMemo } from 'react'
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

interface ProductFormProps {
  product?: Product | null
  onClose: () => void
  onSave: () => void
}

function ProductForm({ product, onClose, onSave }: ProductFormProps): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  // Campos numéricos como string para que el usuario pueda borrarlos y escribir
  // libremente; se convierten a número al guardar.
  const [form, setForm] = useState({
    name: product?.name || '',
    category: product?.category || 'supplement',
    description: product?.description || '',
    price: product?.price != null ? String(product.price) : '',
    cost: product?.cost != null ? String(product.cost) : '',
    stock: product?.stock != null ? String(product.stock) : '',
    minStock: product?.minStock != null ? String(product.minStock) : '',
    barcode: product?.barcode || ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { showToast('error', 'El nombre es requerido'); return }
    setLoading(true)
    const data = {
      name: form.name,
      category: form.category,
      description: form.description,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      minStock: Number(form.minStock) || 0,
      barcode: form.barcode
    }
    try {
      if (product) {
        const r = await window.electronAPI.inventory.updateProduct(product.id, data)
        if (r.success) { showToast('success', 'Producto actualizado'); onSave() }
        else showToast('error', r.error)
      } else {
        const r = await window.electronAPI.inventory.createProduct(data)
        if (r.success) { showToast('success', 'Producto creado'); onSave() }
        else showToast('error', r.error)
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg glass-panel">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="headline-md">{product ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <button type="button" className="modal-close" onClick={onClose}><Icons.Close /></button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="label-md">Nombre *</label>
                <input type="text" className="form-input" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="label-md">Categoría</label>
                <select className="form-select" value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value as Product['category'] }))}>
                  <option value="supplement">Suplementos</option>
                  <option value="drink">Bebidas</option>
                  <option value="accessory">Accesorios</option>
                  <option value="other">Otros</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="label-md">Descripción</label>
              <textarea className="form-input" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="label-md">Precio Venta</label>
                <input type="text" inputMode="numeric" className="form-input" value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: e.target.value.replace(/\D/g, '') }))}
                  placeholder="0" />
              </div>
              <div className="form-group">
                <label className="label-md">Costo</label>
                <input type="text" inputMode="numeric" className="form-input" value={form.cost}
                  onChange={e => setForm(p => ({ ...p, cost: e.target.value.replace(/\D/g, '') }))}
                  placeholder="0" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="label-md">Stock Actual</label>
                <input type="text" inputMode="numeric" className="form-input" value={form.stock}
                  onChange={e => setForm(p => ({ ...p, stock: e.target.value.replace(/\D/g, '') }))}
                  placeholder="0" />
              </div>
              <div className="form-group">
                <label className="label-md">Stock Mínimo</label>
                <input type="text" inputMode="numeric" className="form-input" value={form.minStock}
                  onChange={e => setForm(p => ({ ...p, minStock: e.target.value.replace(/\D/g, '') }))}
                  placeholder="0" />
              </div>
              <div className="form-group">
                <label className="label-md">Código de Barras</label>
                <input type="text" className="form-input" value={form.barcode}
                  onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : product ? 'Actualizar' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface MovementFormProps {
  product: Product
  onClose: () => void
  onSave: () => void
}

function MovementForm({ product, onClose, onSave }: MovementFormProps): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [type, setType] = useState<'in' | 'out'>('in')
  // Como string para que el usuario pueda borrar el valor por defecto
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState(String(product.cost || product.price || ''))
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = Number(quantity)
    if (!quantity || !qty || qty <= 0) { showToast('error', 'La cantidad debe ser mayor a 0'); return }
    if (type === 'out' && qty > product.stock) {
      showToast('error', `Stock insuficiente. Disponible: ${product.stock}`)
      return
    }
    setLoading(true)
    try {
      const r = await window.electronAPI.inventory.registerMovement(product.id, type, qty, Number(price) || 0, description)
      if (r.success) {
        showToast('success', `Movimiento registrado: ${type === 'in' ? 'Entrada' : 'Salida'} de ${quantity} unidades`)
        onSave()
      } else {
        showToast('error', r.error || 'Error al registrar movimiento')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal glass-panel">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="headline-md">Movimiento: {product.name}</h2>
            <button type="button" className="modal-close" onClick={onClose}><Icons.Close /></button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="label-md">Tipo</label>
                <select className="form-select" value={type}
                  onChange={e => setType(e.target.value as 'in' | 'out')}>
                  <option value="in">Entrada</option>
                  <option value="out">Salida</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label-md">Cantidad</label>
                <input type="text" inputMode="numeric" className="form-input" value={quantity}
                  onChange={e => setQuantity(e.target.value.replace(/\D/g, ''))}
                  placeholder="0" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="label-md">Precio Unitario</label>
                <input type="text" inputMode="numeric" className="form-input" value={price}
                  onChange={e => setPrice(e.target.value.replace(/\D/g, ''))}
                  placeholder="0" />
              </div>
            </div>
            <div className="form-group">
              <label className="label-md">Descripción</label>
              <input type="text" className="form-input" value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Motivo del movimiento" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function InventoryPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const confirm = useAppStore((state) => state.confirm)
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showMovement, setShowMovement] = useState<Product | null>(null)
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
    const handler = () => { setEditingProduct(null); setShowForm(true) }
    window.addEventListener('shortcut:newProduct', handler)
    return () => window.removeEventListener('shortcut:newProduct', handler)
  }, [])

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
    else showToast('error', r.error)
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
          <button className="btn btn-primary" onClick={() => { setEditingProduct(null); setShowForm(true) }}>
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
                        <button className="btn btn-sm btn-secondary" onClick={() => { setShowMovement(p) }} title="Movimiento"><Icons.Plus /></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => { setEditingProduct(p); setShowForm(true) }} title="Editar"><Icons.Edit /></button>
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

      {showForm && <ProductForm product={editingProduct} onClose={() => { setShowForm(false); setEditingProduct(null) }} onSave={() => { setShowForm(false); setEditingProduct(null); loadProducts() }} />}
      {showMovement && <MovementForm product={showMovement} onClose={() => setShowMovement(null)} onSave={() => { setShowMovement(null); loadProducts(); loadMovements() }} />}
    </div>
  )
}
