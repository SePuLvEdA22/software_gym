import { Icons } from './Icons'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  size?: 'sm' | 'md'
}

export function Pagination({ page, totalPages, onPageChange, size = 'md' }: PaginationProps): JSX.Element | null {
  if (totalPages <= 1) return null

  const btnClass = size === 'sm' ? 'btn btn-secondary btn-sm' : 'btn btn-secondary'
  const pageBtnClass = (p: number) =>
    `btn ${p === page ? 'btn-primary' : 'btn-secondary'}${size === 'sm' ? ' btn-sm' : ''}`

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16 }}>
      <button className={btnClass} disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}>
        {size === 'md' && <Icons.ChevronLeft />}
        Anterior
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
        .map((p, idx, arr) => (
          <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: 'var(--color-secondary)' }}>...</span>}
            <button className={pageBtnClass(p)}
              onClick={() => onPageChange(p)}
              style={{ minWidth: 36, padding: '4px 8px' }}>
              {p}
            </button>
          </span>
        ))}
      <button className={btnClass} disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}>
        Siguiente
        {size === 'md' && <Icons.ChevronRight />}
      </button>
    </div>
  )
}
