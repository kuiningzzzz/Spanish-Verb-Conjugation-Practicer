const { userDb: db } = require('../database/db')
const bcrypt = require('bcryptjs')

class User {
  // 创建用户
  static create(userData) {
    const { username, password, email, school, enrollmentYear, userType } = userData
    const hashedPassword = bcrypt.hashSync(password, 10)
    
    // 如果邮箱为空，则不插入邮箱字段，避免 UNIQUE 约束冲突
    const emailValue = email && email.trim() ? email.trim() : null
    
    const stmt = db.prepare(`
      INSERT INTO users (username, password, email, school, enrollment_year, user_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(username, hashedPassword, emailValue, school, enrollmentYear, userType || 'student')
    return result.lastInsertRowid
  }

  // 根据用户名查找用户
  static findByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?')
    return stmt.get(username)
  }

  // 根据用户名或邮箱查找用户
  static findByIdentifier(identifier) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    return stmt.get(identifier, identifier)
  }

  // 根据邮箱查找用户
  static findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?')
    return stmt.get(email)
  }

  // 根据ID查找用户
  static findById(id) {
    const stmt = db.prepare('SELECT id, username, email, school, enrollment_year, user_type, subscription_end_date, avatar, created_at FROM users WHERE id = ?')
    return stmt.get(id)
  }

  // 验证密码
  static verifyPassword(password, hashedPassword) {
    return bcrypt.compareSync(password, hashedPassword)
  }

  // 更新用户信息
  static update(id, userData) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const updatedAt = `${year}-${month}-${day} ${hour}:${minute}:${second}`

    const fields = []
    const params = []

    if (userData.username !== undefined) {
      fields.push('username = ?')
      params.push(userData.username)
    }

    if (userData.password !== undefined) {
      const hashedPassword = bcrypt.hashSync(userData.password, 10)
      fields.push('password = ?')
      params.push(hashedPassword)
    }

    if (userData.email !== undefined) {
      fields.push('email = ?')
      params.push(userData.email)
    }

    if (userData.school !== undefined) {
      fields.push('school = ?')
      params.push(userData.school)
    }

    if (userData.enrollmentYear !== undefined) {
      fields.push('enrollment_year = ?')
      params.push(userData.enrollmentYear)
    }

    fields.push('updated_at = ?')
    params.push(updatedAt)

    params.push(id)

    const stmt = db.prepare(`
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = ?
    `)

    return stmt.run(...params)
  }

  // 更新订阅
  static updateSubscription(id, endDate) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const updatedAt = `${year}-${month}-${day} ${hour}:${minute}:${second}`
    
    const stmt = db.prepare(`
      UPDATE users 
      SET subscription_end_date = ?, updated_at = ?
      WHERE id = ?
    `)
    return stmt.run(endDate, updatedAt, id)
  }

  // 更新头像
  static updateAvatar(id, avatarBase64) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const updatedAt = `${year}-${month}-${day} ${hour}:${minute}:${second}`
    
    const stmt = db.prepare(`
      UPDATE users 
      SET avatar = ?, updated_at = ?
      WHERE id = ?
    `)
    return stmt.run(avatarBase64, updatedAt, id)
  }

  // 检查订阅状态
  static checkSubscription(id) {
    const user = this.findById(id)
    if (!user) return false
    
    // 学生用户免费
    if (user.user_type === 'student') return true
    
    // 检查订阅是否过期
    if (!user.subscription_end_date) return false
    const endDate = new Date(user.subscription_end_date)
    return endDate > new Date()
  }
}

module.exports = User
