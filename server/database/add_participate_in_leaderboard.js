/**
 * 数据库迁移脚本：添加 participate_in_leaderboard 字段
 * 
 * 功能：为 users 表添加 participate_in_leaderboard 字段，用于控制用户是否参与排行榜
 * 默认值：1（参与排行榜）
 * 兼容性：自动为已有用户设置默认值，确保向后兼容
 */

const path = require('path')
const Database = require('better-sqlite3')

function migrate() {
  console.log('   • 检查迁移: 添加排行榜参与设置...')
  
  try {
    // 连接用户数据库
    const dbPath = path.join(__dirname, '../data/user_data.db')
    const db = new Database(dbPath)
    
    // 检查字段是否已存在
    const tableInfo = db.prepare("PRAGMA table_info(users)").all()
    const fieldExists = tableInfo.some(col => col.name === 'participate_in_leaderboard')
    
    if (fieldExists) {
      console.log('     ℹ️  字段已存在，跳过')
      db.close()
      return
    }
    
    // 添加字段（默认值为 1，表示参与排行榜）
    console.log('     ➕ 添加字段 participate_in_leaderboard...')
    db.exec(`
      ALTER TABLE users 
      ADD COLUMN participate_in_leaderboard INTEGER DEFAULT 1
    `)
    
    // 更新所有现有用户的该字段为 1（确保向后兼容）
    const updateResult = db.prepare(`
      UPDATE users 
      SET participate_in_leaderboard = 1 
      WHERE participate_in_leaderboard IS NULL
    `).run()
    
    console.log(`     ✓ 字段添加成功，已更新 ${updateResult.changes} 个用户记录`)
    
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
