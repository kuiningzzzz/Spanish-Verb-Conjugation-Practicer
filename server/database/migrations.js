/**
 * 数据库迁移管理器
 * 
 * 功能：统一管理所有数据库迁移脚本，在服务器启动时自动执行
 * 每个迁移脚本会自动检查是否需要执行，避免重复迁移
 */

const path = require('path')
const fs = require('fs')

/**
 * 运行所有数据库迁移
 */
function runMigrations() {
  console.log('\n🔄 检查数据库迁移...')
  
  const migrations = [
    {
      name: '添加排行榜参与设置',
      script: './migration_scripts/add_participate_in_leaderboard.js'
    },
    {
      name: '添加好友系统',
      script: './migration_scripts/add_friend_system.js'
    }
    // 在此添加更多迁移脚本
    // { name: '迁移名称', script: './migration_script.js' }
  ]
  
  let executedCount = 0
  let skippedCount = 0
  
  for (const migration of migrations) {
    try {
      const scriptPath = path.join(__dirname, migration.script)
      
      // 检查迁移脚本是否存在
      if (!fs.existsSync(scriptPath)) {
        console.log(`   ⚠️  迁移脚本不存在: ${migration.name}`)
        continue
      }
      
      // 执行迁移脚本
      const migrate = require(scriptPath)
      
      // 捕获迁移脚本的输出来判断是否执行了迁移
      const originalLog = console.log
      let migrationExecuted = false
      
      console.log = function(...args) {
        const message = args.join(' ')
        if (message.includes('✓') && !message.includes('已存在')) {
          migrationExecuted = true
        }
        originalLog.apply(console, args)
      }
      
      migrate()
      
      console.log = originalLog
      
      if (migrationExecuted) {
        executedCount++
      } else {
        skippedCount++
      }
      
    } catch (error) {
      console.error(`   ✗ 迁移失败 [${migration.name}]:`, error.message)
    }
  }
  
  // 汇总输出
  if (executedCount > 0 || skippedCount > 0) {
    console.log(`\n   📊 迁移检查完成: ${executedCount} 个已执行, ${skippedCount} 个已跳过`)
  }
  console.log('\x1b[32m   ✓ 数据库迁移检查完成\x1b[0m\n')
}

module.exports = runMigrations
