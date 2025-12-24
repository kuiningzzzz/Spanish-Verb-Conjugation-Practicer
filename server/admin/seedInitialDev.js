const bcrypt = require('bcryptjs')
const { userDb } = require('../database/db')

function ensureInitialDev() {
  const email = process.env.DEV_USER_EMAIL
  const password = process.env.DEV_USER_PASSWORD
  const username = process.env.DEV_USER_NAME || 'initial_dev'
  if (!email || !password) {
    console.log('\x1b[33m⚠️  DEV_USER_EMAIL 或 DEV_USER_PASSWORD 未配置，跳过初始 dev 注入\x1b[0m')
    return
  }

  const existingByEmail = userDb.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!existingByEmail) {
    const hashed = bcrypt.hashSync(password, 10)
    userDb
      .prepare(
        `INSERT INTO users (username, email, password, role, is_initial_dev)
         VALUES (?, ?, ?, 'dev', 1)`
      )
      .run(username, email, hashed)
    console.log('   ✓ 已注入初始 dev 用户')
    return
  }

  const updates = []
  const params = []

  if (existingByEmail.role !== 'dev') {
    updates.push('role = ?')
    params.push('dev')
  }
  if (!existingByEmail.is_initial_dev) {
    updates.push('is_initial_dev = 1')
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now', 'localtime')")
    params.push(existingByEmail.id)
    userDb.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    console.log('   ✓ 已升级现有用户为初始 dev')
  } else {
    console.log('   ✓ 初始 dev 已存在，跳过创建')
  }
}

module.exports = { ensureInitialDev }
