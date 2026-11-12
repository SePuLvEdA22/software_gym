import { BrowserWindow } from 'electron'
import { format, formatISO, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { getDatabase } from './database/index'
import { getPaymentsSummary } from './database/payments'
import type { GymSettings } from '../shared/types'

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

type Column = { label: string; num?: boolean }

/** Tabla con encabezado, filas y fila de total opcional; las celdas ya vienen escapadas. */
function table(columns: Column[], rows: string[][], total?: string[]): string {
  const cell = (tag: 'th' | 'td', c: string, i: number): string =>
    `<${tag}${columns[i].num ? ' class="num"' : ''}>${c}</${tag}>`
  const head = `<thead><tr>${columns.map((c, i) => cell('th', c.label, i)).join('')}</tr></thead>`
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((c, i) => cell('td', c, i)).join('')}</tr>`).join('')
    : `<tr><td colspan="${columns.length}" class="empty">Sin registros</td></tr>`
  const foot = total && rows.length ? `<tfoot><tr>${total.map((c, i) => cell('td', c, i)).join('')}</tr></tfoot>` : ''
  return `<table>${head}<tbody>${body}</tbody>${foot}</table>`
}

export function buildDailyCashHtml(data: DailyCashData, gym?: Pick<GymSettings, 'name' | 'address' | 'phone'>): string {
  const [y, m, d] = data.dayKey.split('-').map(Number)
  const dateText = format(new Date(y, m - 1, d), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
  const longDate = dateText.charAt(0).toUpperCase() + dateText.slice(1)
  const gymName = gym?.name || 'BODYFITGYM'
  const gymInfo = [gym?.address, gym?.phone].filter(Boolean).map((s) => esc(s!)).join(' · ')

  const methodLabel = (k: string): string => esc(METHOD_LABELS[k] || k)
  const countByMethod: { [k: string]: number } = {}
  for (const p of data.payments) countByMethod[p.method] = (countByMethod[p.method] || 0) + 1
  const share = (v: number): number => (data.paymentsTotal ? Math.round((v / data.paymentsTotal) * 100) : 0)
  const units = data.sales.reduce((s, r) => s + r.quantity, 0)
  const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
  const cashTotal = data.byMethod.cash || 0

  // Resumen tipo estado de cuenta: de dónde salió el dinero del día.
  const line = (label: string, sub: string, value: string, cls = ''): string =>
    `<tr class="${cls}"><td>${label}${sub ? `<span class="muted"> · ${sub}</span>` : ''}</td><td class="num">${value}</td></tr>`
  const summary = `<table class="statement">
    ${line('Membresías', plural(data.payments.length, 'pago', 'pagos'), money(data.paymentsTotal))}
    ${line('Ventas de inventario', plural(units, 'unidad', 'unidades'), money(data.salesTotal))}
    ${line('Total recaudado', '', money(data.grandTotal), 'grand')}
  </table>
  ${data.totalDiscount ? `<div class="note">Incluye ${money(data.totalDiscount)} en descuentos ya restados de los pagos.</div>` : ''}`

  const methodRows = Object.entries(data.byMethod)
    .sort(([, a], [, b]) => b - a)
    .map(
      ([k, v]) => `<tr><td>${methodLabel(k)}</td><td class="num muted">${countByMethod[k] || 0}</td>
        <td class="bar-cell"><div class="bar"><span style="width:${share(v)}%"></span></div></td>
        <td class="num muted pct">${share(v)}%</td><td class="num">${money(v)}</td></tr>`,
    )
    .join('')
  const methods = `<table class="methods"><thead><tr><th>Método</th><th class="num">Pagos</th><th></th><th></th><th class="num">Total</th></tr></thead>
    <tbody>${methodRows || '<tr><td colspan="5" class="empty">Sin pagos</td></tr>'}</tbody></table>`

  const payments = table(
    [{ label: 'Hora' }, { label: 'Cliente' }, { label: 'Concepto' }, { label: 'Método' }, { label: 'Valor', num: true }],
    data.payments.map((p) => [
      p.date.slice(11, 16),
      esc(p.clientName) || '—',
      esc(p.description) || '—',
      methodLabel(p.method),
      money(p.amount),
    ]),
    ['Total', '', '', '', money(data.paymentsTotal)],
  )
  const sales = table(
    [{ label: 'Producto' }, { label: 'Cantidad', num: true }, { label: 'Total', num: true }],
    data.sales.map((s) => [esc(s.productName), String(s.quantity), money(s.total)]),
    ['Total', String(units), money(data.salesTotal)],
  )

  // Arqueo a mano: las ventas de inventario no guardan método de pago, así que
  // solo se muestra el efectivo registrado en membresías como referencia.
  const field = (label: string, value = ''): string =>
    `<div class="field"><span>${label}</span><span class="blank">${value}</span></div>`
  const arqueo = `<div class="arqueo">
    <div class="arqueo-title">Arqueo de efectivo</div>
    <div class="fields">
      ${field('Base inicial')}
      ${field('+ Efectivo en membresías', money(cashTotal))}
      ${field('+ Efectivo de ventas')}
      ${field('= Efectivo esperado')}
      ${field('Efectivo contado')}
      ${field('Diferencia')}
    </div>
    <div class="field obs"><span>Observaciones</span><span class="blank"></span></div>
  </div>`

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #1f2328; margin: 0; }
    .muted { color: #6b7280; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 10px; border-bottom: 3px solid #ff6b00; }
    .gym { font-size: 18px; font-weight: 800; letter-spacing: .04em; }
    .gym-info { color: #6b7280; font-size: 9.5px; margin-top: 3px; }
    .doc { text-align: right; }
    .doc h1 { font-size: 14px; margin: 0; text-transform: uppercase; letter-spacing: .08em; }
    .doc .date { color: #374151; font-size: 11px; margin-top: 3px; }
    h2 { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; margin: 0 0 6px; color: #374151; }
    .section { margin-top: 20px; }
    .top { display: grid; grid-template-columns: 1fr 1.15fr; gap: 28px; margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
         color: #6b7280; padding: 5px 6px; border-bottom: 1px solid #d1d5db; }
    td { padding: 5px 6px; border-bottom: 1px solid #eef0f2; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .statement td { padding: 7px 0; font-size: 11px; }
    .statement tr.grand td { border-top: 2px solid #1f2328; border-bottom: none; font-weight: 800; font-size: 15px; padding-top: 9px; }
    .statement tr.grand td.num { color: #c2410c; font-size: 18px; }
    .note { font-size: 9px; color: #6b7280; margin-top: 6px; }
    .methods td { padding: 6px 6px; }
    .bar-cell { width: 34%; }
    .bar { height: 7px; background: #f1f2f4; border-radius: 4px; overflow: hidden; }
    .bar span { display: block; height: 100%; background: #ff6b00; border-radius: 4px; }
    .pct { width: 34px; }
    .detail tbody tr:nth-child(even) td { background: #fafafa; }
    tfoot td { font-weight: 700; border-top: 1.5px solid #1f2328; border-bottom: none; }
    thead { display: table-header-group; }
    tfoot { display: table-row-group; } /* total solo al final, no en cada página */
    tr, .top, .arqueo, .signatures { page-break-inside: avoid; }
    .empty { text-align: center; color: #9ca3af; padding: 10px; }
    .arqueo { margin-top: 24px; border: 1px solid #d1d5db; border-radius: 6px; padding: 12px 14px; }
    .arqueo-title { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; margin-bottom: 10px; }
    .fields { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, auto); grid-auto-flow: column; gap: 12px 28px; }
    .field { display: flex; align-items: flex-end; gap: 8px; }
    .field span:first-child { white-space: nowrap; color: #374151; }
    .blank { flex: 1; border-bottom: 1px solid #9ca3af; min-height: 15px; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    .obs { margin-top: 14px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 52px; }
    .sig { border-top: 1px solid #1f2328; padding-top: 5px; text-align: center; font-size: 9.5px; color: #374151; }
  </style></head><body>
    <div class="header">
      <div><div class="gym">${esc(gymName)}</div>${gymInfo ? `<div class="gym-info">${gymInfo}</div>` : ''}</div>
      <div class="doc"><h1>Cierre de caja</h1><div class="date">${esc(longDate)}</div></div>
    </div>
    <div class="top">
      <div><h2>Resumen del día</h2>${summary}</div>
      <div><h2>Membresías por método de pago</h2>${methods}</div>
    </div>
    <div class="section detail"><h2>Detalle de pagos</h2>${payments}</div>
    <div class="section detail"><h2>Ventas de inventario</h2>${sales}</div>
    ${arqueo}
    <div class="signatures"><div class="sig">Entregado por (nombre y firma)</div><div class="sig">Recibido por (nombre y firma)</div></div>
  </body></html>`
}

export async function renderPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    const generated = esc(new Date().toLocaleString('es-CO'))
    return await win.webContents.printToPDF({
      pageSize: 'Letter',
      printBackground: true,
      margins: { top: 0.5, bottom: 0.6, left: 0.5, right: 0.5 },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-family:Arial,sans-serif;font-size:8px;color:#9ca3af;padding:0 0.5in;display:flex;justify-content:space-between">
        <span>Generado el ${generated}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
    })
  } finally {
    win.destroy()
  }
}
