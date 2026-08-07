// Benchmark temporal: costo de persistir la BD sql.js (export + write) según nº de registros
// Uso: node scripts/bench-save.cjs
const initSqlJs = require('sql.js')
const { writeFileSync, readFileSync, rmSync } = require('fs')
const os = require('os')

async function main() {
  const SQL = await initSqlJs()
  const file = os.tmpdir() + '/bench-bodyfitgym.db'

  const db = new SQL.Database()
  db.run('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, ts TEXT, extra TEXT)')
  const totalRows = 60000
  const results = []

  for (let i = 1; i <= totalRows; i++) {
    db.run('INSERT INTO t (name, ts, extra) VALUES (?, ?, ?)', [
      'Cliente ' + i,
      new Date().toISOString(),
      'x'.repeat(120),
    ])
    if (i % 10000 === 0) {
      // costo de guardar (export + writeFileSync) - lo que hace save() en cada run()
      let t0 = performance.now()
      const data = db.export()
      writeFileSync(file, Buffer.from(data))
      let t1 = performance.now()
      const exportWriteMs = t1 - t0

      // costo de abrir la BD (lo que hace initDatabase al iniciar)
      t0 = performance.now()
      const buf = readFileSync(file)
      const db2 = new SQL.Database(buf)
      const count = db2.exec('SELECT COUNT(*) FROM t')[0].values[0][0]
      db2.close()
      t1 = performance.now()

      results.push({
        filas: i,
        tamanoMB: (data.byteLength / 1048576).toFixed(1),
        exportWriteMs: exportWriteMs.toFixed(0),
        abrirMs: (t1 - t0).toFixed(0),
      })
    }
  }
  console.table(results)
  db.close()
  rmSync(file, { force: true })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
