const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { initDatabase } = require('./database/db')
const { initSampleData } = require('./data/initData')

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 初始化数据库
initDatabase()

// 检查是否需要初始化示例数据
try {
  initSampleData()
} catch (error) {
  console.log('示例数据已存在或初始化失败:', error.message)
}

// 路由
app.use('/api/user', require('./routes/user'))
app.use('/api/verb', require('./routes/verb'))
app.use('/api/exercise', require('./routes/exercise'))
app.use('/api/record', require('./routes/record'))
app.use('/api/checkin', require('./routes/checkin'))
app.use('/api/leaderboard', require('./routes/leaderboard'))
app.use('/api/vocabulary', require('./routes/vocabulary'))

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
  console.log(`服务器运行在 http://localhost:${PORT}`)
  console.log(`API文档: http://localhost:${PORT}/api/health`)
})

module.exports = app
