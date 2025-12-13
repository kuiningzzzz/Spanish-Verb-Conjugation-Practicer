const jwt = require('jsonwebtoken')

const JWT_SECRET = 'your-secret-key-change-in-production'

// 认证中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权访问' })
  }

  const token = authHeader.substring(7)

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.userId = decoded.userId
    req.user = { id: decoded.userId } // 添加 req.user 对象以兼容新路由
    next()
  } catch (error) {
    return res.status(401).json({ error: '无效的token' })
  }
}

// 生成token
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' })
}

module.exports = {
  authMiddleware,
  generateToken,
  JWT_SECRET
}
