const { runAdminMigrations } = require('./migrations')
const { ensureInitialAdmin } = require('./seedInitialAdmin')

async function bootstrapAdmin() {
  runAdminMigrations()
  ensureInitialAdmin()
}

module.exports = { bootstrapAdmin }
