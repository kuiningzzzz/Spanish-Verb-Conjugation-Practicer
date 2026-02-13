/**
 * 数据库迁移脚本：添加好友系统
 * 
 * 功能：
 * 1. 为 users 表添加 unique_id 字段（6-8位唯一ID）
 * 2. 创建好友关系表 friends
 * 3. 创建好友申请表 friend_requests
 * 4. 创建好友设置表 friend_settings
 */

const path = require('path')
const Database = require('better-sqlite3')

function migrate() {
  console.log('   • 检查迁移: 添加好友系统...')
  
  try {
    const dbPath = path.join(__dirname, '../../data/user_data.db')
    const db = new Database(dbPath)
    
    // 1. 检查并添加 unique_id 字段
    const tableInfo = db.prepare("PRAGMA table_info(users)").all()
    const hasUniqueId = tableInfo.some(col => col.name === 'unique_id')
    
    if (!hasUniqueId) {
      console.log('     ➕ 添加字段 unique_id...')
      db.exec(`ALTER TABLE users ADD COLUMN unique_id TEXT`)
      
      // 创建唯一索引
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_id 
        ON users(unique_id) WHERE unique_id IS NOT NULL AND unique_id != ''
      `)
    }
    
    // 2. 创建好友关系表
    const friendsTableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='friends'"
    ).get()
    
    if (!friendsTableExists) {
      console.log('     ➕ 创建好友关系表...')
      db.exec(`
        CREATE TABLE friends (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          friend_id INTEGER NOT NULL,
          created_at TEXT DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, friend_id)
        )
      `)
      
      db.exec(`CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id)`)
    }
    
    // 3. 创建好友申请表
    const requestsTableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='friend_requests'"
    ).get()
    
    if (!requestsTableExists) {
      console.log('     ➕ 创建好友申请表...')
      db.exec(`
        CREATE TABLE friend_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          from_user_id INTEGER NOT NULL,
          to_user_id INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          message TEXT,
          created_at TEXT DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(from_user_id, to_user_id)
        )
      `)
      
      db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_to ON friend_requests(to_user_id, status)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_from ON friend_requests(from_user_id)`)
    }
    
    // 4. 创建好友设置表
    const settingsTableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='friend_settings'"
    ).get()
    
    if (!settingsTableExists) {
      console.log('     ➕ 创建好友设置表...')
      db.exec(`
        CREATE TABLE friend_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          friend_id INTEGER NOT NULL,
          remark TEXT,
          is_starred INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, friend_id)
        )
      `)
      
      db.exec(`CREATE INDEX IF NOT EXISTS idx_friend_settings_user ON friend_settings(user_id)`)
    }
    
    if (!hasUniqueId || !friendsTableExists || !requestsTableExists || !settingsTableExists) {
      console.log('     ✓ 好友系统表创建成功')
    } else {
      console.log('     ℹ️  好友系统已存在，跳过')
    }
    
    db.close()
  } catch (error) {
    console.error('     ✗ 迁移失败:', error.message)
    throw error
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrate()
}

module.exports = migrate
