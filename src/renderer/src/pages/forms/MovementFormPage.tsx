import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Product } from '@shared/types'
import { FormWindowShell } from '@/components/FormWindowShell'
import { toErrorMessage } from '../../../../shared/errors'

export function MovementFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const productId = searchParams.get('productId') || ''
  const showToast = useAppStore((state) => state.showToast)

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<'in' | 'out'>('in')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!productId) {
      setLoading(false)
      return
    }
    window.electronAPI.inventory
      .getProductById(productId)
      .then((result) => {
        if (result.success && result.data) {
          setProduct(result.data)
          setPrice(String(result.data.cost || result.data.price || ''))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [productId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return
    const qty = Number(quantity)
    if (!quantity || !qty || qty <= 0) {
      showToast('error', 'La cantidad debe ser mayor a 0')
      return
    }
    if (type === 'out' && qty > product.stock) {
      showToast('error', `Stock insuficiente. Disponible: ${product.stock}`)
      return
    }
    setSaving(true)
    try {
      const r = await window.electronAPI.inventory.registerMovement(
        product.id,
        type,
        qty,
        Number(price) || 0,
        description
      )
      if (r.success) {
        showToast('success', `Movimiento registrado: ${type === 'in' ? 'Entrada' : 'Salida'} de ${quantity} unidades`)
        await window.electronAPI.window.notifyFormSaved(
          'movement',
          `Movimiento registrado: ${type === 'in' ? 'Entrada' : 'Salida'} de ${quantity} unidades`
        )
      } else {
        showToast('error', r.error || 'Error al registrar movimiento')
      }
    } catch (err) {
      showToast('error', toErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <FormWindowShell title="Movimiento de Inventario">
        <div className="spinner" style={{ margin: '48px auto' }} />
      </FormWindowShell>
    )
  }

  return (
    <FormWindowShell title={product ? `Movimiento: ${product.name}` : 'Movimiento de Inventario'}>
      {!product ? (
        <p style={{ color: 'var(--color-secondary)' }}>No se encontró el producto seleccionado.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 13 }}>
              <strong>{product.name}</strong> — Stock actual: <strong>{product.stock}</strong>
            </span>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={type} onChange={(e) => setType(e.target.value as 'in' | 'out')}>
                <option value="in">Entrada</option>
                <option value="out">Salida</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cantidad</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Precio Unitario</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-input"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input
              type="text"
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Motivo del movimiento"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--color-surface-container-high)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => window.close()}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Registrando...' : 'Registrar Movimiento'}
            </button>
          </div>
        </form>
      )}
    </FormWindowShell>
  )
}
