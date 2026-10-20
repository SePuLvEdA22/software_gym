import { BrowserWindow } from 'electron'
import { formatISO, startOfDay, endOfDay } from 'date-fns'
import { getDatabase } from './database/index'
import { getPaymentsSummary } from './database/payments'

export interface DailyCashData {
  dayKey: string
  payments: { date: string; clientName: string; description: string; method: string; amount: number }[]
  byMethod: { [method: string]: number }
  paymentsTotal: number
  totalDiscount: number
  sales: { productName: string; quantity: number; total: number }[]
  salesTotal: number
  grandTotal: number
}

/** dayKey: 'YYYY-MM-DD' en hora local. */
export function getDailyCashData(dayKey: string): DailyCashData {
  const [y, m, d] = dayKey.split('-').map(Number)
  const day = new Date(y, m - 1, d)
  // Mismo formato con offset local con el que se guardan payments.date e inventory_movements.timestamp.
  const start = formatISO(startOfDay(day))
  const end = formatISO(endOfDay(day))
  const db = getDatabase()

  const summary = getPaymentsSummary(start, end)
  const payments = db
    .prepare(
      `SELECT p.date, COALESCE(c.full_name, '') as clientName, COALESCE(p.description, '') as description,
              p.method, p.amount
       FROM payments p LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.date >= ? AND p.date <= ? ORDER BY p.date`,
    )
    .all(start, end) as unknown as DailyCashData['payments']
  const sales = db
    .prepare(
      `SELECT product_name as productName, SUM(quantity) as quantity, SUM(total) as total
       FROM inventory_movements WHERE type = 'out' AND timestamp >= ? AND timestamp <= ?
       GROUP BY product_name ORDER BY product_name`,
    )
    .all(start, end) as unknown as DailyCashData['sales']
  const salesTotal = sales.reduce((s, r) => s + r.total, 0)

  return {
    dayKey,
    payments,
    byMethod: summary.byMethod,
    paymentsTotal: summary.total,
    totalDiscount: summary.totalDiscount,
    sales,
    salesTotal,
    grandTotal: summary.total + salesTotal,
  }
}

const METHOD_LABELS: { [k: string]: string } = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
}

const money = (v: number): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function buildDailyCashHtml(data: DailyCashData): string {
  const row = (cells: string[]): string => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`
  const methods = Object.entries(data.byMethod)
    .map(([k, v]) => row([esc(METHOD_LABELS[k] || k), money(v)]))
    .join('')
  const payments = data.payments
    .map((p) =>
      row([p.date.slice(11, 16), esc(p.clientName), esc(p.description), esc(METHOD_LABELS[p.method] || p.method), money(p.amount)]),
    )
    .join('')
  const sales = data.sales.map((s) => row([esc(s.productName), String(s.quantity), money(s.total)])).join('')
  const empty = (cols: number): string => `<tr><td colspan="${cols}" class="muted">Sin registros</td></tr>`

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 13px; margin: 18px 0 6px; }
    table { width: 100%; border-collapse: collapse; } td { border-bottom: 1px solid #ddd; padding: 4px 6px; }
    td:last-child { text-align: right; } .muted { color: #777; text-align: center !important; }
    .total td { font-weight: bold; border-top: 2px solid #111; }
  </style></head><body>
    <h1>Cierre de caja — ${esc(data.dayKey)}</h1>
    <div class="muted" style="text-align:left">Generado: ${esc(new Date().toLocaleString('es-CO'))}</div>
    <h2>Resumen</h2>
    <table>
      ${row(['Pagos de membresías', money(data.paymentsTotal)])}
      ${row(['Ventas de inventario', money(data.salesTotal)])}
      ${row(['Descuentos otorgados', money(data.totalDiscount)])}
      <tr class="total"><td>Total del día</td><td>${money(data.grandTotal)}</td></tr>
    </table>
    <h2>Pagos por método</h2><table>${methods || empty(2)}</table>
    <h2>Detalle de pagos (${data.payments.length})</h2><table>${payments || empty(5)}</table>
    <h2>Ventas de inventario</h2><table>${sales || empty(3)}</table>
  </body></html>`
}

export async function renderPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    return await win.webContents.printToPDF({ pageSize: 'Letter', printBackground: true })
  } finally {
    win.destroy()
  }
}
