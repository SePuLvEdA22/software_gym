import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import os from 'os'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import { runLegacyMigration } from '../../main/migration/legacyMigrator'

/**
 * Fixture SQL que reproduce el escenario real reportado por el usuario:
 * un socio con una membresía válida (idEstado=1) y otra "eliminada"
 * (idEstado=3) con fecha de vencimiento futura. La eliminada NO debe
 * importarse, ni como membresía ni sus pagos.
 */
const FIXTURE_SQL = [
  'INSERT INTO `estado` (`idEstados`,`Estado`) VALUES',
  "(1,'Activo'),",
  "(3,'Eliminado');",
  '',
  'INSERT INTO `ctipomembresia` (`id`,`nombre`) VALUES',
  "(1,'mensual');",
  '',
  'INSERT INTO `socio` (`idSocio`,`idEstado`,`fechaCreacion`,`Nombre`,`Paterno`,`Materno`,`Telefono`,`Observaciones`,`idUsuarioCreo`,`foto`,`clave`,`huella`,`fechaNacimiento`,`correo`,`lunes`,`martes`,`miercoles`,`jueves`,`viernes`,`sabado`,`domingo`) VALUES',
  "(1,1,'2024-01-01 10:00:00','Juan','Perez','Gomez','3001234567','',1,NULL,'1001',NULL,'1990-01-01','juan@mail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL);",
  '',
  'INSERT INTO `membresia` (`idMembresia`,`Nombre`,`idEstado`,`fechaCreacion`,`Precio`,`idUsuarioCreo`,`meses`,`horaInicio`,`horaFinal`,`idTipoMembresia`,`semanas`,`dias`) VALUES',
  "(1,'Plan Mensual',1,'2024-01-01 10:00:00',50000.00,1,1,NULL,NULL,1,0,0);",
  '',
  'INSERT INTO `sociomembresia` (`idSocioMembresia`,`idEstado`,`fechaCreacion`,`idUsuarioCreo`,`idSocio`,`idMembresia`,`Precio`,`fechaInicioMembresia`,`estadoMembresia`,`meses`,`semanas`,`dias`,`idTipoMembresia`,`Vencimiento`) VALUES',
  "(1,1,'2030-07-01 10:00:00',1,1,1,50000.00,'2030-07-01 10:00:00','Pagada',1,0,0,1,'2030-07-31 10:00:00'),",
  "(2,3,'2030-06-01 10:00:00',1,1,1,100.00,'2030-06-01 10:00:00','Pagada',0,15,0,2,'2030-09-30 10:00:00');",
  '',
  'INSERT INTO `sociomembresia_pago` (`id`,`observacion`,`folio`,`idSocioMembresia`,`fecha`,`idEstado`,`idUsuarioCreo`,`importe`) VALUES',
  "(1,'','F001',1,'2030-07-01 10:00:00',1,1,50000.00),",
  "(2,'','F002',2,'2030-06-01 10:00:00',1,1,100.00);",
  '',
].join('\n')

describe('Migración legacy: filtro por idEstado (membresías eliminadas)', () => {
  let fixturePath: string

  beforeAll(async () => {
    await initDatabase()
    fixturePath = join(os.tmpdir(), `migration-fixture-${Date.now()}.sql`)
    writeFileSync(fixturePath, FIXTURE_SQL)

    const result = await runLegacyMigration(fixturePath)
    expect(result.success).toBe(true)
  })

  afterAll(() => {
    if (existsSync(fixturePath)) {
      unlinkSync(fixturePath)
    }
    closeDatabase()
  })

  it('importa la membresía con idEstado=1 (Activa)', () => {
    const db = getDatabase()
    const memberships = db.prepare('SELECT * FROM memberships').all() as Array<{
      plan_name: string
      status: string
      end_date: string
    }>
    expect(memberships).toHaveLength(1)
    expect(memberships[0].plan_name).toBe('Plan Mensual')
    expect(memberships[0].status).toBe('active')
  })

  it('NO importa la membresía con idEstado=3 (Eliminada) aunque tenga vencimiento futuro', () => {
    const db = getDatabase()
    const eliminated = db
      .prepare("SELECT * FROM memberships WHERE end_date LIKE '2030-09-30%'")
      .all()
    expect(eliminated).toHaveLength(0)
  })

  it('NO importa los pagos asociados a membresías eliminadas', () => {
    const db = getDatabase()
    const payments = db.prepare('SELECT * FROM payments').all() as Array<{
      description: string
      amount: number
    }>
    // Solo debe existir el pago de la membresía activa (50000), no el de la eliminada (100)
    expect(payments).toHaveLength(1)
    expect(payments[0].amount).toBe(50000)
  })

  it('el cliente queda con status active porque su membresía vigente es idEstado=1', () => {
    const db = getDatabase()
    const client = db.prepare("SELECT status FROM clients WHERE document_id = 'OLD-1'").get() as {
      status: string
    }
    expect(client.status).toBe('active')
  })
})
