import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase } from '../../main/database/index'
import { logChange, getChangeLogs, setSessionUser } from '../../main/database/users'
import { createClient } from '../../main/database/clients'
import type { User } from '../../shared/types'

const trainer = {
  id: 'user_trainer_test',
  username: 'trainer_audit',
  fullName: 'Entrenador Auditor',
  role: 'trainer',
  permissions: [],
  isActive: true,
  lastLogin: null,
  createdAt: '',
  updatedAt: ''
} as unknown as User

describe('Historial de cambios (auditoría)', () => {
  beforeAll(async () => {
    await initDatabase()
    setSessionUser(trainer)

    logChange('memberships', 'mem_audit_1', 'create', null, {
      clientId: 'c1', planName: 'Mensual', amount: 80000, method: 'cash'
    })
    logChange('memberships', 'mem_audit_1', 'update', { status: 'frozen' }, { status: 'active' })
    logChange('clients', 'cli_audit_1', 'delete', { fullName: 'Cliente Eliminado' }, null)
    // Acciones de otro usuario para validar filtros por acción
    setSessionUser(null)
    logChange('users', 'u1', 'update', null, { lastLogin: '2026-01-01T00:00:00Z' })
  })

  afterAll(() => {
    closeDatabase()
  })

  it('registra el usuario de sesión como autor del cambio', () => {
    const page = getChangeLogs(1, 100)
    const created = page.data.find(l => l.action === 'create' && l.tableName === 'memberships')
    expect(created).toBeDefined()
    expect(created!.userName).toBe('Entrenador Auditor')
    expect(created!.userId).toBe('user_trainer_test')
  })

  it('acciones sin sesión quedan atribuidas a Sistema', () => {
    const page = getChangeLogs(1, 100)
    const systemEntry = page.data.find(l => l.tableName === 'users' && l.action === 'update')
    expect(systemEntry).toBeDefined()
    expect(systemEntry!.userName).toBe('Sistema')
  })

  it('filtra por tipo de acción', () => {
    const deletes = getChangeLogs(1, 100, undefined, 'delete')
    expect(deletes.total).toBeGreaterThan(0)
    expect(deletes.data.every(l => l.action === 'delete')).toBe(true)

    const creates = getChangeLogs(1, 100, undefined, 'create')
    expect(creates.data.every(l => l.action === 'create')).toBe(true)
  })

  it('filtra por tabla y conserva los valores antes/después', () => {
    const memberships = getChangeLogs(1, 100, 'memberships')
    expect(memberships.data.length).toBeGreaterThanOrEqual(2)

    const unfreeze = memberships.data.find(l => l.newValues?.includes('"active"'))
    expect(unfreeze).toBeDefined()
    expect(JSON.parse(unfreeze!.oldValues!)).toEqual({ status: 'frozen' })
    expect(JSON.parse(unfreeze!.newValues!)).toEqual({ status: 'active' })
  })

  it('el detalle de una eliminación conserva los datos previos del registro', () => {
    const deletes = getChangeLogs(1, 100, 'clients', 'delete')
    const clientDelete = deletes.data.find(l => l.recordId === 'cli_audit_1')
    expect(clientDelete).toBeDefined()
    expect(JSON.parse(clientDelete!.oldValues!).fullName).toBe('Cliente Eliminado')
    expect(clientDelete!.newValues).toBeNull()
  })

  it('los registros se ordenan del más reciente al más antiguo', () => {
    const page = getChangeLogs(1, 100)
    const timestamps = page.data.map(l => l.timestamp)
    const sorted = [...timestamps].sort().reverse()
    expect(timestamps).toEqual(sorted)
  })

  it('los inicios de sesión usan acción dedicada y se filtran aparte', () => {
    setSessionUser(trainer)
    logChange('users', 'user_trainer_test', 'login', null, { lastLogin: '2026-08-21T10:00:00Z' })

    const logins = getChangeLogs(1, 100, undefined, 'login')
    expect(logins.total).toBeGreaterThanOrEqual(1)
    expect(logins.data.every(l => l.action === 'login')).toBe(true)

    const entry = logins.data.find(l => l.userId === 'user_trainer_test')
    expect(entry).toBeDefined()
    expect(entry!.userName).toBe('Entrenador Auditor')
    // Un login no debe aparecer como Actualización
    const asUpdate = getChangeLogs(1, 100, undefined, 'update')
    expect(asUpdate.data.some(l => l.recordId === 'user_trainer_test' && l.newValues?.includes('lastLogin'))).toBe(false)
    setSessionUser(null)
  })

  it('las entradas de membresía incluyen el nombre del cliente (como lo resuelve el handler IPC)', () => {
    const client = createClient({
      fullName: 'Juan Pérez Congelado',
      documentId: `AUD-${Date.now()}`,
      birthDate: '1990-01-01',
      gender: 'male',
      phone: '3001112233',
      email: 'audit@example.com',
      address: 'Calle 1',
      photo: null,
      accessCode: `AUD${Date.now()}`,
      status: 'active',
      emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
    })

    setSessionUser(trainer)
    // Replica exactamente la llamada del handler membership:freeze
    logChange('memberships', 'mem_named_1', 'update',
      { status: 'active', clientName: client.fullName },
      { status: 'frozen', reason: 'Vacaciones', plannedDays: 6, clientName: client.fullName }
    )

    const row = getChangeLogs(1, 100, 'memberships').data.find(l => l.recordId === 'mem_named_1')
    expect(row).toBeDefined()
    expect(JSON.parse(row!.newValues!).clientName).toBe('Juan Pérez Congelado')
    expect(JSON.parse(row!.oldValues!).clientName).toBe('Juan Pérez Congelado')
    setSessionUser(null)
  })
})
