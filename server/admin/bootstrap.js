const { runAdminMigrations } = require('./migrations')
const { ensureInitialAdmin } = require('./seedInitialAdmin')
const { ensureInitialDev } = require('./seedInitialDev')

async function bootstrapAdmin() {
  runAdminMigrations()
  ensureInitialAdmin()
  ensureInitialDev()
}

module.exports = { bootstrapAdmin }
