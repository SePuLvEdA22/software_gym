// Smoke: verifica que better-sqlite3 carga en el proceso principal de Electron.
const { app } = require('electron')

app.whenReady().then(() => {
  try {
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    db.exec('CREATE TABLE t(a)')
    db.prepare('INSERT INTO t VALUES (?)').run(7)
    const row = db.prepare('SELECT a FROM t').get()
    console.log('SMOKE_ELECTRON_OK', row.a)
    app.exit(0)
  } catch (err) {
    console.error('SMOKE_ELECTRON_FAIL', err.message)
    app.exit(1)
  }
})
