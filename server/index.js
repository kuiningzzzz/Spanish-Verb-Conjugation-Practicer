const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { initDatabase } = require('./database/db')
const { initSampleData } = require('./data/initData')
const apiLogger = require('./middleware/logger')

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// API请求日志
app.use(apiLogger)

// 初始化数据库
initDatabase()

// 检查是否需要初始化示例数据
try {
  initSampleData()
} catch (error) {
  console.log('\x1b[33m   ⚠ 示例数据初始化失败:\x1b[0m', error.message)
}

// 启动定时任务调度器
try {
  const SchedulerService = require('./services/scheduler')
  SchedulerService.startAll()
} catch (error) {
  console.log('\x1b[31m   ✗ 定时任务启动失败:\x1b[0m', error.message)
}

// 路由
app.use('/api/user', require('./routes/user'))
app.use('/api/verb', require('./routes/verb'))
app.use('/api/exercise', require('./routes/exercise'))
app.use('/api/record', require('./routes/record'))
app.use('/api/checkin', require('./routes/checkin'))
app.use('/api/leaderboard', require('./routes/leaderboard'))
app.use('/api/vocabulary', require('./routes/vocabulary'))
app.use('/api/question', require('./routes/question'))  // 题库管理路由

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '服务运行正常' })
})

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: '服务器内部错误' })
})

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

// 启动服务器
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60))
  console.log('  🚀 \x1b[32m西班牙语动词变位练习系统\x1b[0m')
  console.log('='.repeat(60))
  console.log(`  📡 服务器地址: \x1b[36mhttp://localhost:${PORT}\x1b[0m`)
  console.log(`  📋 健康检查: \x1b[36mhttp://localhost:${PORT}/api/health\x1b[0m`)
  console.log(`  ⏰ 启动时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`)
  console.log('='.repeat(60) + '\n')
})

module.exports = app
