import { getDatabase } from './index'
import { cached, clearQueryCache } from './queryCache'
import { Membership, MembershipStatus, ClientDebt, DebtorSummary, FreezeHistory, ClientAttendanceStats, InactiveClient } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { getClientById, updateClientStatus } from './clients'
import { getPlanById } from './plans'
import { addDays, formatISO, parseISO, differenceInDays, startOfDay, endOfDay } from 'date-fns'
import log from 'electron-log'

export interface DbMembership {
  id: string
  client_id: string
  plan_id: string
  plan_name: string
  start_date: string
  end_date: string
  status: string
  created_at: string
  frozen_at?: string | null
  freeze_reason?: string | null
  freeze_days?: number | null
}

function mapDbMembership(dbMembership: DbMembership): Membership {
  return {
    id: dbMembership.id,
    clientId: dbMembership.client_id,
    planId: dbMembership.plan_id,
    planName: dbMembership.plan_name,
    startDate: dbMembership.start_date,
    endDate: dbMembership.end_date,
    status: dbMembership.status as MembershipStatus,
    createdAt: dbMembership.created_at,
    frozenAt: dbMembership.frozen_at || null,
    freezeReason: dbMembership.freeze_reason || null,
    freezeDays: dbMembership.freeze_days || null
  }
}

/**
 * 'YYYY-MM-DD' de hoy (fecha actual). Se usa para comparaciones
 * día-conscientes de vencimiento por prefijo de fecha: una membresía cuyo
 * vencimiento es HOY sigue siendo válida todo el día y solo se vence al
 * terminar el día. El prefijo es robusto para formatos ISO local
 * ('YYYY-MM-DDTHH:mm:ss±HH:mm') y legado ('YYYY-MM-DD HH:mm:ss').
 */
export function todayKey(): string {
  return formatISO(new Date()).slice(0, 10)
}

export function getClientDebt(clientId: string): ClientDebt[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT 
      m.id as membershipId,
      m.plan_name as planName,
      p.price as planPrice,
      m.end_date as endDate,
      m.status,
      COALESCE((SELECT SUM(pm.amount) FROM payments pm WHERE pm.membership_id = m.id), 0) as totalPaid,
      COALESCE((SELECT SUM(pm.discount) FROM payments pm WHERE pm.membership_id = m.id), 0) as totalDiscount
    FROM memberships m
    JOIN membership_plans p ON p.id = m.plan_id
    WHERE m.client_id = ?
    ORDER BY m.created_at DESC
  `).all(clientId) as { membershipId: string; planName: string; planPrice: number; endDate: string; status: string; totalPaid: number; totalDiscount: number }[]

  const debts: ClientDebt[] = []
  for (const row of rows) {
    const effectiveDue = row.planPrice - row.totalDiscount
    if (row.totalPaid < effectiveDue) {
      debts.push({
        clientId,
        clientName: '',
        clientPhone: '',
        membershipId: row.membershipId,
        planName: row.planName,
        totalDue: row.planPrice,
        totalPaid: row.totalPaid,
        balance: effectiveDue - row.totalPaid,
        endDate: row.endDate,
        status: row.status
      })
    }
  }
  return debts
}

export function getDebtors(): DebtorSummary[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT 
      c.id as clientId,
      c.full_name as clientName,
      c.phone,
      m.id as membershipId,
      p.price as planPrice,
      COALESCE((SELECT SUM(pm.amount) FROM payments pm WHERE pm.membership_id = m.id), 0) as totalPaid,
      COALESCE((SELECT SUM(pm.discount) FROM payments pm WHERE pm.membership_id = m.id), 0) as totalDiscount
    FROM memberships m
    JOIN clients c ON c.id = m.client_id
    JOIN membership_plans p ON p.id = m.plan_id
    WHERE m.status = 'active' OR m.status = 'frozen'
    GROUP BY m.id
    HAVING totalPaid < (p.price - totalDiscount)
    ORDER BY ((p.price - totalDiscount) - totalPaid) DESC
  `).all() as { clientId: string; clientName: string; phone: string; membershipId: string; planPrice: number; totalPaid: number; totalDiscount: number }[]

  return rows.map(r => ({
    clientId: r.clientId,
    clientName: r.clientName,
    phone: r.phone,
    balance: r.planPrice - r.totalPaid - r.totalDiscount
  }))
}

export function getExpiringMemberships(days: number): { clientId: string; clientName: string; phone: string; planName: string; endDate: string; daysLeft: number }[] {
  const db = getDatabase()
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const endDate = new Date(now)
  endDate.setDate(endDate.getDate() + days)
  const endStr = formatISO(endDate)

  const rows = db.prepare(`
    SELECT c.id as clientId, c.full_name as clientName, c.phone,
           m.plan_name as planName, m.end_date as endDate
    FROM memberships m
    JOIN clients c ON c.id = m.client_id
    WHERE m.status = 'active'
      AND m.end_date >= ? 
      AND m.end_date <= ?
    ORDER BY m.end_date ASC
  `).all(formatISO(now), endStr) as { clientId: string; clientName: string; phone: string; planName: string; endDate: string }[]

  return rows.map(r => ({
    ...r,
    daysLeft: differenceInDays(parseISO(r.endDate), now)
  }))
}

export function getActiveOrFrozenMembership(clientId: string): Membership | null {
  const db = getDatabase()
  // Día-consciente: se compara contra la FECHA de hoy, no contra el instante
  // exacto. Una membresía cuyo vencimiento es hoy sigue siendo válida todo el
  // día (no se vence a mitad de día por la hora de compra).
  const now = todayKey()

  // Una membresía CONGELADA NO consume días: si su vencimiento nominal pasó
  // mientras estaba congelada no está "vencida", está congelada (al descongelar
  // se extiende en unfreezeMembership). Por eso el filtro de end_date solo
  // aplica a las activas; así el kiosco responde denied_frozen (no
  // denied_expired) y updateExpiredMemberships no las marca vencidas.
  const stmt = db.prepare(`
    SELECT * FROM memberships 
    WHERE client_id = ? 
      AND (
        (status = 'active' AND end_date >= ?)
        OR status = 'frozen'
      )
    ORDER BY end_date DESC
    LIMIT 1
  `)
  
  const result = stmt.get(clientId, now) as DbMembership | undefined
  
  return result ? mapDbMembership(result) : null
}

export function createMembership(clientId: string, planId: string, startDate?: string): Membership | null {
  const db = getDatabase()
  const plan = getPlanById(planId)
  const client = getClientById(clientId)
  
  if (!plan || !client) {
    log.error('Cannot create membership: Plan or client not found')
    return null
  }
  
  if (client.status === 'suspended') {
    log.error(`Cannot create membership: Client ${clientId} is suspended`)
    return null
  }

  const existingMembership = getActiveOrFrozenMembership(clientId)
  // La membresía vigente NO bloquea la creación si vence HOY (su último día):
  // se permite renovar durante el último día de vigencia. Solo bloquea si se
  // extiende más allá de hoy.
  if (existingMembership && existingMembership.endDate.slice(0, 10) > todayKey()) {
    log.error(`Cannot create membership: Client ${clientId} already has an active or frozen membership`)
    return null
  }
  
  const actualStartDate = startDate ? parseISO(startDate) : new Date()
  // La membresía es válida durante TODOS los días completos de su duración:
  // vence al final (23:59:59) del último día, no a la misma hora de compra.
  // Así, una membresía de 1 día es válida durante todo el día y cualquier
  // membresía en su último día sigue operativa hasta que el día termine.
  // (durationDays mínimo 1: defensa ante planes con duración 0).
  const durationDays = Math.max(1, plan.durationDays)
  const endDate = endOfDay(addDays(startOfDay(actualStartDate), durationDays - 1))
  const now = new Date()

  // Día-consciente: si la fecha de vencimiento cae en un día ya pasado, la
  // membresía no tiene ningún valor (p. ej. startDate muy retroactivo + plan de
  // 1 día) y NO se crea. Antes nacía con status 'expired' pero igual se cobraba
  // el pago en createMembershipWithPayment: el cliente pagaba por algo vencido.
  if (formatISO(endDate).slice(0, 10) < todayKey()) {
    log.error(`Cannot create membership: end date ${formatISO(endDate)} is already in the past`)
    return null
  }
  
  const newMembership: Membership = {
    id: uuidv4(),
    clientId,
    planId,
    planName: plan.name,
    startDate: formatISO(actualStartDate),
    endDate: formatISO(endDate),
    status: formatISO(endDate).slice(0, 10) >= todayKey() ? 'active' : 'expired',
    createdAt: formatISO(now),
    frozenAt: null,
    freezeReason: null,
    freezeDays: null
  }
  
  const stmt = db.prepare(`
    INSERT INTO memberships (id, client_id, plan_id, plan_name, start_date, end_date, status, created_at, frozen_at, freeze_reason, freeze_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    newMembership.id,
    newMembership.clientId,
    newMembership.planId,
    newMembership.planName,
    newMembership.startDate,
    newMembership.endDate,
    newMembership.status,
    newMembership.createdAt,
    newMembership.frozenAt,
    null,
    null
  )
  
  if (newMembership.status === 'active') {
    updateClientStatus(clientId, 'active')
  }

  clearQueryCache()
  
  return newMembership
}

export function freezeMembership(membershipId: string, reason?: string, plannedDays?: number): Membership | null {
  const db = getDatabase()
  const now = formatISO(new Date())
  
  const getStmt = db.prepare('SELECT * FROM memberships WHERE id = ?')
  const membership = getStmt.get(membershipId) as DbMembership | undefined
  
  if (!membership) {
    log.error(`Cannot freeze: Membership ${membershipId} not found`)
    return null
  }
  
  if (membership.status !== 'active') {
    log.error(`Cannot freeze: Membership ${membershipId} is not active (status: ${membership.status})`)
    return null
  }
  
  const freezeOp = db.transaction(() => {
    db.prepare(`
      UPDATE memberships 
      SET status = 'frozen', frozen_at = ?, freeze_reason = ?, freeze_days = ?
      WHERE id = ?
    `).run(now, reason || null, plannedDays || null, membershipId)

    db.prepare(`
      INSERT INTO freeze_history (id, membership_id, client_id, frozen_at, reason, planned_days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), membershipId, membership.client_id, now, reason || null, plannedDays || null)
  })
  
  freezeOp()
  
  const updatedMembership = getStmt.get(membershipId) as DbMembership | undefined
  
  clearQueryCache()
  
  return updatedMembership ? mapDbMembership(updatedMembership) : null
}

export function unfreezeMembership(membershipId: string, opts?: { automatic?: boolean }): Membership | null {
  const db = getDatabase()
  const now = new Date()
  const nowIso = formatISO(now)
  
  const getStmt = db.prepare('SELECT * FROM memberships WHERE id = ?')
  const membership = getStmt.get(membershipId) as DbMembership | undefined
  
  if (!membership) {
    log.error(`Cannot unfreeze: Membership ${membershipId} not found`)
    return null
  }
  
  if (membership.status !== 'frozen') {
    log.error(`Cannot unfreeze: Membership ${membershipId} is not frozen (status: ${membership.status})`)
    return null
  }
  
  if (!membership.frozen_at) {
    log.error(`Cannot unfreeze: Membership ${membershipId} has no frozen_at date`)
    return null
  }
  
  const frozenDate = parseISO(membership.frozen_at)
  const frozenDays = Math.ceil((now.getTime() - frozenDate.getTime()) / (1000 * 60 * 60 * 24))
  
  const unfreezeOp = db.transaction(() => {
    if (frozenDays > 0) {
      const currentEndDate = parseISO(membership.end_date)
      const newEndDate = addDays(currentEndDate, frozenDays)
      
      log.info(`Extending membership ${membershipId} by ${frozenDays} days (was frozen)`)
      
      db.prepare(`
        UPDATE memberships 
        SET status = 'active', 
            frozen_at = NULL,
            freeze_reason = NULL,
            freeze_days = NULL,
            end_date = ?
        WHERE id = ?
      `).run(formatISO(newEndDate), membershipId)
    } else {
      db.prepare(`
        UPDATE memberships 
        SET status = 'active', 
            frozen_at = NULL,
            freeze_reason = NULL,
            freeze_days = NULL
        WHERE id = ?
      `).run(membershipId)
    }

    db.prepare(`
      UPDATE freeze_history 
      SET unfrozen_at = ?, actual_days = ?, unfrozen_by = ?
      WHERE membership_id = ? AND unfrozen_at IS NULL
    `).run(nowIso, frozenDays, opts?.automatic ? 'auto' : 'manual', membershipId)
  })
  
  unfreezeOp()
  
  const updatedMembership = getStmt.get(membershipId) as DbMembership | undefined
  
  if (updatedMembership) {
    const mapped = mapDbMembership(updatedMembership)
    if (mapped.status === 'active') {
      updateClientStatus(mapped.clientId, 'active')
    }
    return mapped
  }
  
  clearQueryCache()
  
  return null
}

/**
 * Descongela automáticamente las membresías cuyo periodo planeado de
 * congelamiento (freeze_days) ya venció. Reutiliza unfreezeMembership: la
 * fecha de fin se extiende por los días transcurridos, de modo que los días
 * de la membresía vuelven a contar desde donde se quedaron.
 *
 * Evaluación perezosa: se invoca al cargar el dashboard y en system:updateExpired,
 * por lo que funciona incluso si la app estuvo cerrada durante el vencimiento.
 */
export function autoUnfreezeDueMemberships(): number {
  const db = getDatabase()
  const now = Date.now()

  const frozen = db.prepare(`
    SELECT id, frozen_at, freeze_days FROM memberships
    WHERE status = 'frozen' AND freeze_days IS NOT NULL AND frozen_at IS NOT NULL
  `).all() as Array<{ id: string; frozen_at: string; freeze_days: number | null }>

  let count = 0
  for (const row of frozen) {
    const plannedDays = Number(row.freeze_days)
    if (!Number.isFinite(plannedDays) || plannedDays <= 0) continue

    const frozenAt = parseISO(row.frozen_at)
    if (Number.isNaN(frozenAt.getTime())) continue

    if (now >= addDays(frozenAt, plannedDays).getTime()) {
      const result = unfreezeMembership(row.id, { automatic: true })
      if (result) count++
    }
  }

  if (count > 0) {
    log.info(`Auto-unfroze ${count} membership(s): planned freeze period ended`)
  }
  return count
}

export function getActiveMembership(clientId: string): Membership | null {
  const db = getDatabase()
  // Día-consciente: válida hasta el final del día de vencimiento (ver
  // getActiveOrFrozenMembership). Evita denegar el acceso a mitad de día.
  const now = todayKey()
  
  const stmt = db.prepare(`
    SELECT * FROM memberships 
    WHERE client_id = ? 
      AND status = 'active' 
      AND end_date >= ?
    ORDER BY end_date DESC
    LIMIT 1
  `)
  
  const result = stmt.get(clientId, now) as DbMembership | undefined
  
  return result ? mapDbMembership(result) : null
}

export function getClientMemberships(clientId: string): Membership[] {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT * FROM memberships 
    WHERE client_id = ? 
    ORDER BY created_at DESC
  `)
  
  const results = stmt.all(clientId) as unknown as DbMembership[]
  
  return results.map(mapDbMembership)
}

export function updateExpiredMemberships(): number {
  const db = getDatabase()
  // Día-consciente: una membresía que vence HOY no se marca como vencida hasta
  // que el día termina. Se compara contra la fecha de hoy.
  const now = todayKey()

  const expiredOp = db.transaction(() => {
    const getExpired = db.prepare(`
      SELECT DISTINCT client_id FROM memberships 
      WHERE status = 'active' AND end_date < ?
    `)

    const expiredClients = getExpired.all(now) as { client_id: string }[]

    const updateStmt = db.prepare(`
      UPDATE memberships SET status = 'expired' 
      WHERE status = 'active' AND end_date < ?
    `)

    const result = updateStmt.run(now)

    for (const client of expiredClients) {
      // Si el cliente conserva una membresía congelada (válida aunque su
      // vencimiento nominal haya pasado, porque no consume días congelado),
      // NO se le marca 'expired': sigue congelado hasta que se descongele.
      const activeOrFrozen = getActiveOrFrozenMembership(client.client_id)
      if (!activeOrFrozen) {
        updateClientStatus(client.client_id, 'expired')
      }
    }

    return result.changes
  })

  const changes = expiredOp()
  clearQueryCache()
  log.info(`Updated ${changes} expired memberships`)
  return changes
}

export interface DbFreezeHistory {
  id: string
  membership_id: string
  client_id: string
  frozen_at: string
  unfrozen_at: string | null
  reason: string | null
  planned_days: number | null
  actual_days: number | null
  unfrozen_by: string | null
}

function mapDbFreezeHistory(h: DbFreezeHistory): FreezeHistory {
  return {
    id: h.id,
    membershipId: h.membership_id,
    clientId: h.client_id,
    frozenAt: h.frozen_at,
    unfrozenAt: h.unfrozen_at || null,
    reason: h.reason || null,
    plannedDays: h.planned_days || null,
    actualDays: h.actual_days || null,
    unfrozenBy: (h.unfrozen_by as FreezeHistory['unfrozenBy']) || null
  }
}

export function getFreezeHistory(membershipId: string): FreezeHistory[] {
  const db = getDatabase()
  const results = db.prepare('SELECT * FROM freeze_history WHERE membership_id = ? ORDER BY frozen_at DESC').all(membershipId) as unknown as DbFreezeHistory[]
  return results.map(mapDbFreezeHistory)
}

export function getClientFreezeHistory(clientId: string): FreezeHistory[] {
  const db = getDatabase()
  const results = db.prepare('SELECT * FROM freeze_history WHERE client_id = ? ORDER BY frozen_at DESC').all(clientId) as unknown as DbFreezeHistory[]
  return results.map(mapDbFreezeHistory)
}

export function getClientAttendanceStats(clientId: string): ClientAttendanceStats {
  const db = getDatabase()
  const now = new Date()
  const startOfMonth = formatISO(new Date(now.getFullYear(), now.getMonth(), 1))
  
  const totalResult = db.prepare('SELECT COUNT(*) as count FROM access_logs WHERE client_id = ? AND result = ?').get(clientId, 'granted') as { count: number }
  const lastResult = db.prepare('SELECT timestamp FROM access_logs WHERE client_id = ? AND result = ? ORDER BY timestamp DESC LIMIT 1').get(clientId, 'granted') as { timestamp: string } | undefined
  const firstResult = db.prepare('SELECT timestamp FROM access_logs WHERE client_id = ? AND result = ? ORDER BY timestamp ASC LIMIT 1').get(clientId, 'granted') as { timestamp: string } | undefined
  const monthResult = db.prepare('SELECT COUNT(*) as count FROM access_logs WHERE client_id = ? AND result = ? AND timestamp >= ?').get(clientId, 'granted', startOfMonth) as { count: number }

  return {
    totalVisits: totalResult.count,
    lastVisit: lastResult?.timestamp || null,
    firstVisit: firstResult?.timestamp || null,
    daysAttendedThisMonth: monthResult.count
  }
}

/**
 * Consulta pesada (subconsultas correlacionadas sobre access_logs) que el dashboard
 * ejecuta 2 veces por carga y cada 30 s. Se cachea con TTL corto; se invalida al
 * registrar un acceso concedido (logAccess) o al mutar clientes/membresías.
 */
export function getInactiveClients(daysThreshold: number = 30): InactiveClient[] {
  // TTL 60 s: el dashboard refresca cada 30 s, así el cache sirve refrescos
  // consecutivos. Las escrituras (accesos, membresías, clientes) invalidan.
  return cached(`inactiveClients:${daysThreshold}`, 60_000, () => {
    const db = getDatabase()
    const cutoff = formatISO(new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000))

    const rows = db.prepare(`
      SELECT 
        c.id as clientId,
        c.full_name as clientName,
        c.phone,
        m.plan_name as planName,
        (SELECT MAX(a.timestamp) FROM access_logs a WHERE a.client_id = c.id AND a.result = 'granted') as lastVisit
      FROM clients c
      JOIN memberships m ON m.client_id = c.id AND m.status = 'active'
      WHERE c.status = 'active'
        AND (
          (SELECT MAX(a.timestamp) FROM access_logs a WHERE a.client_id = c.id AND a.result = 'granted') IS NULL
          OR (SELECT MAX(a.timestamp) FROM access_logs a WHERE a.client_id = c.id AND a.result = 'granted') < ?
        )
      ORDER BY lastVisit ASC
    `).all(cutoff) as { clientId: string; clientName: string; phone: string; planName: string; lastVisit: string | null }[]

    return rows.map(r => ({
      clientId: r.clientId,
      clientName: r.clientName,
      phone: r.phone,
      planName: r.planName,
      lastVisit: r.lastVisit || null,
      daysSinceLastVisit: r.lastVisit
        ? Math.floor((Date.now() - new Date(r.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
        : daysThreshold
    }))
  })
}
