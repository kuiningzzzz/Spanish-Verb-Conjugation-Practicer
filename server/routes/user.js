const express = require('express')
const router = express.Router()
const User = require('../models/User')
const { generateToken } = require('../middleware/auth')

// 用户注册
router.post('/register', (req, res) => {
  try {
    const { username, password, email, school, enrollmentYear, userType } = req.body

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }

    // 检查用户名是否已存在
    const existingUser = User.findByUsername(username)
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' })
    }

    // 如果提供了邮箱，检查邮箱是否已存在
    if (email && email.trim()) {
      const existingEmail = User.findByEmail(email.trim())
      if (existingEmail) {
        return res.status(400).json({ error: '该邮箱已被注册' })
      }
    }

    // 创建用户
    const userId = User.create({
      username,
      password,
      email,
      school,
      enrollmentYear,
      userType: userType || 'student'
    })

    // 生成token
    const token = generateToken(userId)
    const user = User.findById(userId)

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        school: user.school,
        enrollmentYear: user.enrollment_year,
        userType: user.user_type,
        created_at: user.created_at
      }
    })
  } catch (error) {
    console.error('注册错误:', error)
    // 处理数据库唯一约束错误
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: '用户名或邮箱已被注册' })
    }
    res.status(500).json({ error: '注册失败，请稍后重试' })
  }
})

// 用户登录
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }

    // 查找用户
    const user = User.findByUsername(username)
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    // 验证密码
    const isValid = User.verifyPassword(password, user.password)
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    // 生成token
    const token = generateToken(user.id)

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        school: user.school,
        enrollmentYear: user.enrollment_year,
        userType: user.user_type,
        created_at: user.created_at
      }
    })
  } catch (error) {
    console.error('登录错误:', error)
    res.status(500).json({ error: '登录失败' })
  }
})

// 获取用户信息
router.get('/info', require('../middleware/auth').authMiddleware, (req, res) => {
  try {
    const user = User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        school: user.school,
        enrollmentYear: user.enrollment_year,
        userType: user.user_type,
        subscriptionEndDate: user.subscription_end_date,
        created_at: user.created_at
      }
    })
  } catch (error) {
    console.error('获取用户信息错误:', error)
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

// 更新用户信息
router.put('/profile', require('../middleware/auth').authMiddleware, (req, res) => {
  try {
    const { email, school, enrollmentYear } = req.body

    User.update(req.userId, { email, school, enrollmentYear })

    const user = User.findById(req.userId)
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        school: user.school,
        enrollmentYear: user.enrollment_year,
        userType: user.user_type
      }
    })
  } catch (error) {
    console.error('更新用户信息错误:', error)
    res.status(500).json({ error: '更新用户信息失败' })
  }
})

module.exports = router
