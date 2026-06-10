// Dummy signing script for electron-builder
// Called as: node script.js <file> <platform> <configuration>
// We just skip signing and return success

const path = require('path')
const filePath = process.argv[2]
console.log(`[dummy-sign] Skipping signing for: ${path.basename(filePath || 'unknown')}`)
process.exit(0)
