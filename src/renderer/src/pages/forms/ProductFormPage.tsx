import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Product } from '@shared/types'
import { FormWindowShell } from '@/components/FormWindowShell'

export function ProductFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const productId = searchParams.get('id')
  const isEditing = !!productId
  const showToast = useAppStore((state) => state.showToast)

  const [form, setForm] = useState({
    name: '',
    category: 'supplement' as Product['category'],
    description: '',
    price: '',
    cost: '',
    stock: '',
    minStock: '',
    barcode: ''
  })
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!productId) return
    window.electronAPI.inventory
      .getProductById(productId)
      .then((result: any) => {
        if (result.success && result.data) {
          const p = result.data
          setForm({
            name: p.name || '',
            category: p.category || 'supplement',
            description: p.description || '',
            price: p.price != null ? String(p.price) : '',
            cost: p.cost != null ? String(p.cost) : '',
            stock: p.stock != null ? String(p.stock) : '',
            minStock: p.minStock != null ? String(p.minStock) : '',
            barcode: p.barcode || ''
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [productId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) {
      showToast('error', 'El nombre es requerido')
      return
    }
    setSaving(true)
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
      const r = isEditing && productId
        ? await window.electronAPI.inventory.updateProduct(productId, data)
        : await window.electronAPI.inventory.createProduct(data)
      if (r.success) {
        showToast('success', isEditing ? 'Producto actualizado' : 'Producto creado')
        await window.electronAPI.window.notifyFormSaved(
          'product',
          isEditing ? 'Producto actualizado' : 'Producto creado'
        )
      } else {
        showToast('error', r.error || 'Error al guardar el producto')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <FormWindowShell title={isEditing ? 'Editar Producto' : 'Nuevo Producto'}>
        <div className="spinner" style={{ margin: '48px auto' }} />
      </FormWindowShell>
    )
  }

  return (
    <FormWindowShell title={isEditing ? 'Editar Producto' : 'Nuevo Producto'}>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select
              className="form-select"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as Product['category'] }))}
            >
              <option value="supplement">Suplementos</option>
              <option value="drink">Bebidas</option>
              <option value="accessory">Accesorios</option>
              <option value="other">Otros</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Descripción</label>
          <textarea
            className="form-input"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={2}
            style={{ resize: 'vertical' }}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Precio Venta</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-input"
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value.replace(/\D/g, '') }))}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Costo</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-input"
              value={form.cost}
              onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value.replace(/\D/g, '') }))}
              placeholder="0"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Stock Actual</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-input"
              value={form.stock}
              onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value.replace(/\D/g, '') }))}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Stock Mínimo</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-input"
              value={form.minStock}
              onChange={(e) => setForm((p) => ({ ...p, minStock: e.target.value.replace(/\D/g, '') }))}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Código de Barras</label>
            <input
              type="text"
              className="form-input"
              value={form.barcode}
              onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--color-surface-container-high)' }}>
          <button type="button" className="btn btn-secondary" onClick={() => window.close()}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Producto'}
          </button>
        </div>
      </form>
    </FormWindowShell>
  )
}
