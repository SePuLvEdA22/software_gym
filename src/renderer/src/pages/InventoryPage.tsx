import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Product, InventoryMovement } from '../../../shared/types'
import { Icons } from '@/components/Icons'
import { formatCurrency } from '@/utils/format'

const categoryLabels: Record<string, string> = {
  supplement: 'Suplementos',
  drink: 'Bebidas',
  accessory: 'Accesorios',
  other: 'Otros'
}

const categoryColors: Record<string, string> = {
  supplement: 'var(--color-primary)',
  drink: 'var(--color-info)',
  accessory: 'var(--color-warning)',
  other: 'var(--color-secondary)'
}

interface ProductFormProps {
  product?: Product | null
  onClose: () => void
  onSave: () => void
}

function ProductForm({ product, onClose, onSave }: ProductFormProps): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [form, setForm] = useState({
    name: product?.name || '',
    category: product?.category || 'supplement',
    description: product?.description || '',
    price: product?.price || 0,
    cost: product?.cost || 0,
    stock: product?.stock ?? 0,
    minStock: product?.minStock ?? 5,
    barcode: product?.barcode || ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { showToast('error', 'El nombre es requerido'); return }
    setLoading(true)
    try {
      if (product) {
        const r = await window.electronAPI.inventory.updateProduct(product.id, form)
        if (r.success) showToast('success', 'Producto actualizado')
        else showToast('error', r.error)
      } else {
        const r = await window.electronAPI.inventory.createProduct(form)
        if (r.success) showToast('success', 'Producto creado')
        else showToast('error', r.error)
      }
      if (!loading) onSave()
    } catch (err: any) {
      showToast('error', err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="modal-title">{product ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <button type="button" className="modal-close" onClick={onClose}><Icons.Close /></button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input type="text" className="form-input" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Categoría</label>
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
              <label className="form-label">Descripción</label>
              <textarea className="form-input" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Precio Venta</label>
                <input type="number" className="form-input" value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Costo</label>
                <input type="number" className="form-input" value={form.cost}
                  onChange={e => setForm(p => ({ ...p, cost: Number(e.target.value) }))} min={0} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Stock Actual</label>
                <input type="number" className="form-input" value={form.stock}
                  onChange={e => setForm(p => ({ ...p, stock: Number(e.target.value) }))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Stock Mínimo</label>
                <input type="number" className="form-input" value={form.minStock}
                  onChange={e => setForm(p => ({ ...p, minStock: Number(e.target.value) }))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Código de Barras</label>
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
  const [quantity, setQuantity] = useState(1)
  const [price, setPrice] = useState(product.cost || product.price)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (quantity <= 0) { showToast('error', 'La cantidad debe ser mayor a 0'); return }
    if (type === 'out' && quantity > product.stock) {
      showToast('error', `Stock insuficiente. Disponible: ${product.stock}`)
      return
    }
    setLoading(true)
    try {
      const r = await window.electronAPI.inventory.registerMovement(product.id, type, quantity, price, description)
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
      <div className="modal">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="modal-title">Movimiento: {product.name}</h2>
            <button type="button" className="modal-close" onClick={onClose}><Icons.Close /></button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={type}
                  onChange={e => setType(e.target.value as 'in' | 'out')}>
                  <option value="in">Entrada</option>
                  <option value="out">Salida</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cantidad</label>
                <input type="number" className="form-input" value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))} min={1} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Precio Unitario</label>
                <input type="number" className="form-input" value={price}
                  onChange={e => setPrice(Number(e.target.value))} min={0} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Descripción</label>
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

  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([])

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

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2>Inventario</h2>
        <button className="btn btn-primary" style={{ marginTop: 12, paddingBottom: 12 }} onClick={() => { setEditingProduct(null); setShowForm(true) }}>
          <Icons.Plus /> Nuevo Producto
        </button>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-warning)', marginBottom: 20 }}>
          <div style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, color: 'var(--color-warning)', margin: '0 0 8px 0' }}>
              ⚠️ Alertas de Stock Bajo ({lowStockProducts.length})
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {lowStockProducts.map(p => (
                <span key={p.id} className="badge badge-warning">
                  {p.name}: {p.stock}/{p.minStock}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
        <button className={`btn ${tab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px 0 0 8px' }} onClick={() => setTab('products')}>Productos</button>
        <button className={`btn ${tab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '0 8px 8px 0' }}
          onClick={() => { setTab('movements'); loadMovements() }}>Movimientos</button>
      </div>

      {tab === 'products' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div className="search-box" style={{ flex: 1 }}>
              <Icons.Search />
              <input type="text" placeholder="Buscar producto o código de barras..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ width: 180 }} value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}>
              <option value="">Todas las categorías</option>
              <option value="supplement">Suplementos</option>
              <option value="drink">Bebidas</option>
              <option value="accessory">Accesorios</option>
              <option value="other">Otros</option>
            </select>
          </div>

          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Stock</th>
                    <th>Stock Mín</th>
                    <th>Precio</th>
                    <th>Costo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong>{p.barcode && <div style={{ fontSize: 11, color: 'var(--color-secondary)' }}>{p.barcode}</div>}</td>
                      <td><span className="badge" style={{ background: categoryColors[p.category] + '22', color: categoryColors[p.category] }}>{categoryLabels[p.category] || p.category}</span></td>
                      <td><span style={{ color: p.stock <= p.minStock ? 'var(--color-warning)' : 'inherit', fontWeight: p.stock <= p.minStock ? 700 : 400 }}>{p.stock}</span></td>
                      <td>{p.minStock}</td>
                      <td>{formatCurrency(p.price)}</td>
                      <td>{formatCurrency(p.cost)}</td>
                      <td>{p.isActive ? <span className="badge badge-success">Activo</span> : <span className="badge badge-error">Inactivo</span>}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-sm btn-secondary" onClick={() => { setShowMovement(p) }} title="Movimiento"><Icons.Plus /></button>
                          <button className="btn btn-sm btn-secondary" onClick={() => { setEditingProduct(p); setShowForm(true) }} title="Editar"><Icons.Edit /></button>
                          <button className="btn btn-sm btn-secondary" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(p)} title="Eliminar"><Icons.Trash /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16 }}>
                <button className="btn btn-secondary btn-sm" disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .map((p, idx, arr) => (
                    <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: 'var(--color-secondary)' }}>...</span>}
                      <button className={`btn ${p === page ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={() => setPage(p)}
                        style={{ minWidth: 36, padding: '4px 8px' }}>
                        {p}
                      </button>
                    </span>
                  ))}
                <button className="btn btn-secondary btn-sm" disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'movements' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Total</th>
                  <th>Descripción</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 13 }}>{new Date(m.timestamp).toLocaleString('es-CO')}</td>
                    <td>{m.productName}</td>
                    <td><span className={`badge ${m.type === 'in' ? 'badge-success' : 'badge-error'}`}>{m.type === 'in' ? 'Entrada' : 'Salida'}</span></td>
                    <td>{m.quantity}</td>
                    <td>{formatCurrency(m.price)}</td>
                    <td>{formatCurrency(m.total)}</td>
                    <td style={{ fontSize: 13, color: 'var(--color-secondary)' }}>{m.description}</td>
                    <td style={{ fontSize: 13 }}>{m.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {movementsTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16 }}>
              <button className="btn btn-secondary btn-sm" disabled={movementsPage <= 1}
                onClick={() => setMovementsPage(p => Math.max(1, p - 1))}>Anterior</button>
              {Array.from({ length: movementsTotalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === movementsTotalPages || Math.abs(p - movementsPage) <= 2)
                .map((p, idx, arr) => (
                  <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: 'var(--color-secondary)' }}>...</span>}
                    <button className={`btn ${p === movementsPage ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      onClick={() => setMovementsPage(p)}
                      style={{ minWidth: 36, padding: '4px 8px' }}>
                      {p}
                    </button>
                  </span>
                ))}
              <button className="btn btn-secondary btn-sm" disabled={movementsPage >= movementsTotalPages}
                onClick={() => setMovementsPage(p => Math.min(movementsTotalPages, p + 1))}>Siguiente</button>
            </div>
          )}
        </div>
      )}

      {showForm && <ProductForm product={editingProduct} onClose={() => { setShowForm(false); setEditingProduct(null) }} onSave={() => { setShowForm(false); setEditingProduct(null); loadProducts() }} />}
      {showMovement && <MovementForm product={showMovement} onClose={() => setShowMovement(null)} onSave={() => { setShowMovement(null); loadProducts(); loadMovements() }} />}
    </div>
  )
}
