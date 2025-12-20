const bcrypt = require('bcryptjs')
const { userDb } = require('../../database/db')

function ensureInitialAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL
  const password = process.env.INITIAL_ADMIN_PASSWORD
  const username = process.env.INITIAL_ADMIN_USERNAME || 'initial_admin'
  const reset = process.env.RESET_INITIAL_ADMIN === 'true'

  if (!email || !password) {
    console.log('\x1b[33m⚠️  INITIAL_ADMIN_EMAIL 或 INITIAL_ADMIN_PASSWORD 未配置，跳过初始管理员注入\x1b[0m')
    return
  }

  const existingInitial = userDb
    .prepare('SELECT * FROM users WHERE is_initial_admin = 1 LIMIT 1')
    .get()

  if (existingInitial && !reset) {
    console.log('   ✓ 已存在初始管理员，跳过创建')
    return
  }

  const hashedPassword = bcrypt.hashSync(password, 10)

  if (existingInitial && reset) {
    userDb
      .prepare('UPDATE users SET username = ?, email = ?, password = ?, role = ?, updated_at = datetime(''now'', ''localtime'') WHERE id = ?')
      .run(username, email, hashedPassword, 'admin', existingInitial.id)
    console.log('   ✓ 已重置初始管理员信息')
    return
  }

  const existingByEmail = userDb.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (existingByEmail && !existingByEmail.is_initial_admin) {
    userDb
      .prepare('UPDATE users SET role = ?, is_initial_admin = 1 WHERE id = ?')
      .run('admin', existingByEmail.id)
    console.log('   ✓ 将现有用户标记为初始管理员')
    return
  }

  userDb
    .prepare(
      `INSERT INTO users (username, email, password, role, is_initial_admin)
       VALUES (?, ?, ?, 'admin', 1)`
    )
    .run(username, email, hashedPassword)

  console.log('   ✓ 初始管理员创建完成')
}

module.exports = { ensureInitialAdmin }
