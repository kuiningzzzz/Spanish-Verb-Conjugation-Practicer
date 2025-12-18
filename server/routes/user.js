const express = require('express')
const router = express.Router()
const User = require('../models/User')
const VerificationCode = require('../models/VerificationCode')
const emailService = require('../services/emailService')
const { generateToken } = require('../middleware/auth')
const { validateAndPrepareImage, getImageInfo } = require('../services/imageCompression')

// 用户名校验规则
const USERNAME_PATTERN = /^[A-Za-z0-9]{8,20}$/
// 密码校验规则：8-20位，字母/数字/特殊符号(!@#$%^&*()_+-.)至少两种
const PASSWORD_PATTERN = /^[A-Za-z0-9!@#$%^&*()_+\-.]{8,20}$/

/**
 * 生成6位随机验证码
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 用户名查重
router.post('/check-username', (req, res) => {
  try {
    const { username } = req.body

    if (!username || !username.trim()) {
      return res.status(400).json({ error: '请输入用户名' })
    }

    const trimmedUsername = username.trim()

    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      return res.status(400).json({ error: '用户名需为8-20位字母或数字组合' })
    }

    const existingUser = User.findByUsername(trimmedUsername)

    res.json({
      success: true,
      available: !existingUser
    })
  } catch (error) {
    console.error('检查用户名错误:', error)
    res.status(500).json({ error: '检查用户名失败' })
  }
})

/**
 * 发送验证码
 */
router.post('/send-verification-code', async (req, res) => {
  try {
    const { email, username, password } = req.body

    // 验证邮箱格式
    if (!email || !email.trim()) {
      return res.status(400).json({ error: '请输入邮箱地址' })
    }

    const trimmedEmail = email.trim().toLowerCase()

    // 验证必须是edu.cn结尾
    if (!trimmedEmail.endsWith('edu.cn')) {
      return res.status(400).json({ error: '学生认证邮箱必须以edu.cn结尾' })
    }

    // 检查邮箱是否已被注册
    const existingUser = User.findByEmail(trimmedEmail)
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被注册' })
    }

    // 如果提供了用户名和密码，先在发送验证码前校验
    if (!username || !password) {
      return res.status(400).json({ error: '请填写用户名和密码后再获取验证码' })
    }

    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()

    // 用户名规则：8-20位，字母数字组合
    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      return res.status(400).json({ error: '用户名需为8-20位字母或数字组合' })
    }

    // 检查用户名是否已存在
    const existingUsername = User.findByUsername(trimmedUsername)
    if (existingUsername) {
      return res.status(400).json({ error: '用户名已存在' })
    }

    // 密码规则：8-20位，字母/数字/特殊符号(!@#$%^&*()_+-.)至少两种
    const hasLetter = /[A-Za-z]/.test(trimmedPassword)
    const hasNumber = /\d/.test(trimmedPassword)
    const hasSymbol = /[!@#$%^&*()_+\-.]/.test(trimmedPassword)
    const categoryCount = [hasLetter, hasNumber, hasSymbol].filter(Boolean).length

    if (!PASSWORD_PATTERN.test(trimmedPassword) || categoryCount < 2) {
      return res.status(400).json({ error: '密码需为8-20位，包含字母、数字、特殊符号中的至少两种' })
    }

    // 检查是否可以发送（防止频繁发送）
    const { canSend, waitTime } = VerificationCode.canSend(trimmedEmail, 60)
    if (!canSend) {
      return res.status(429).json({ 
        error: `请${waitTime}秒后再试`,
        waitTime 
      })
    }

    // 生成验证码
    const code = generateVerificationCode()

    // 保存验证码到数据库（有效期2分钟）
    VerificationCode.create(trimmedEmail, code, 2)

    // 发送邮件
    try {
      await emailService.sendVerificationCode(trimmedEmail, code)
      
      res.json({
        success: true,
        message: '验证码已发送，请查收邮件',
        expiresIn: 120 // 2分钟
      })
    } catch (emailError) {
      console.error('邮件发送失败:', emailError.message)
      
      // 根据错误信息提供更友好的提示
      let errorMsg = emailError.message
      
      if (errorMsg.includes('未配置')) {
        errorMsg = '邮箱服务未配置，请联系管理员'
      } else if (errorMsg.includes('认证失败')) {
        errorMsg = '邮箱服务配置错误，请联系管理员'
      }
      
      return res.status(500).json({ 
        error: errorMsg
      })
    }
  } catch (error) {
    console.error('发送验证码错误:', error)
    res.status(500).json({ error: '发送验证码失败，请稍后重试' })
  }
})

// 用户注册
router.post('/register', (req, res) => {
  try {
    const { username, password, email, school, enrollmentYear, userType, verificationCode } = req.body

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }

    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()

    // 用户名规则：8-20位，字母数字组合
    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      return res.status(400).json({ error: '用户名需为8-20位字母或数字组合' })
    }

    // 密码规则：8-20位，字母/数字/特殊符号(!@#$%^&*()_+-.)至少两种
    const hasLetter = /[A-Za-z]/.test(trimmedPassword)
    const hasNumber = /\d/.test(trimmedPassword)
    const hasSymbol = /[!@#$%^&*()_+\-.]/.test(trimmedPassword)
    const categoryCount = [hasLetter, hasNumber, hasSymbol].filter(Boolean).length

    if (!PASSWORD_PATTERN.test(trimmedPassword) || categoryCount < 2) {
      return res.status(400).json({ error: '密码需为8-20位，包含字母、数字、特殊符号中的至少两种' })
    }

    // 学生身份需要邮箱认证
    if (userType === 'student') {
      if (!email || !email.trim()) {
        return res.status(400).json({ error: '学生身份必须提供认证邮箱' })
      }

      const trimmedEmail = email.trim().toLowerCase()

      // 验证必须是edu.cn结尾
      if (!trimmedEmail.endsWith('edu.cn')) {
        return res.status(400).json({ error: '学生认证邮箱必须以edu.cn结尾' })
      }

      // 验证验证码
      if (!verificationCode) {
        return res.status(400).json({ error: '请输入邮箱验证码' })
      }

      const verification = VerificationCode.verify(trimmedEmail, verificationCode)
      if (!verification.valid) {
        return res.status(400).json({ error: verification.message })
      }
    }

    // 检查用户名是否已存在
    const existingUser = User.findByUsername(trimmedUsername)
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' })
    }

    // 如果提供了邮箱，检查邮箱是否已存在
    if (email && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase()
      const existingEmail = User.findByEmail(normalizedEmail)
      if (existingEmail) {
        return res.status(400).json({ error: '该邮箱已被注册' })
      }
    }

    // 创建用户
    const userId = User.create({
      username: trimmedUsername,
      password: trimmedPassword,
      email: email ? email.trim().toLowerCase() : null,
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

    const identifier = username.trim()
    const normalizedIdentifier = identifier.includes('@') ? identifier.toLowerCase() : identifier

    // 查找用户（支持用户名或邮箱）
    const user = User.findByIdentifier(normalizedIdentifier)
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
        avatar: user.avatar,
        created_at: user.created_at
      }
    })
  } catch (error) {
    console.error('获取用户信息错误:', error)
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

// 更新头像
router.post('/avatar', require('../middleware/auth').authMiddleware, (req, res) => {
  try {
    const { avatar } = req.body

    if (!avatar) {
      return res.status(400).json({ error: '头像数据不能为空' })
    }

    // 使用图片验证和压缩服务
    const validation = validateAndPrepareImage(avatar, {
      maxSizeKB: 100, // 最大 100KB
      allowedFormats: ['png', 'jpg', 'jpeg', 'webp']
    })

    if (!validation.valid) {
      console.log('头像验证失败:', validation.error)
      return res.status(400).json({ error: validation.error })
    }

    // 记录图片信息
    const imageInfo = getImageInfo(avatar)
    console.log('上传头像信息:', {
      userId: req.userId,
      format: imageInfo.format,
      sizeKB: imageInfo.sizeKB,
      sizeBytes: imageInfo.sizeBytes
    })

    // 更新数据库
    User.updateAvatar(req.userId, avatar)

    res.json({
      success: true,
      message: '头像更新成功',
      avatar,
      info: {
        format: validation.format,
        sizeKB: validation.sizeKB
      }
    })
  } catch (error) {
    console.error('更新头像错误:', error)
    res.status(500).json({ error: '更新头像失败' })
  }
})

// 更新用户信息
router.put('/profile', require('../middleware/auth').authMiddleware, (req, res) => {
  try {
    const { username, password, email, school, enrollmentYear } = req.body

    if (!username || !username.trim()) {
      return res.status(400).json({ error: '请输入用户名' })
    }

    const trimmedUsername = username.trim()

    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      return res.status(400).json({ error: '用户名需为8-20位字母或数字组合' })
    }

    const existingUser = User.findByUsername(trimmedUsername)
    if (existingUser && existingUser.id !== req.userId) {
      return res.status(400).json({ error: '用户名已存在' })
    }

    let passwordToUpdate
    if (password !== undefined) {
      const trimmedPassword = password.trim()

      if (!trimmedPassword) {
        return res.status(400).json({ error: '密码不能为空' })
      }

      const hasLetter = /[A-Za-z]/.test(trimmedPassword)
      const hasNumber = /\d/.test(trimmedPassword)
      const hasSymbol = /[!@#$%^&*()_+\-.]/.test(trimmedPassword)
      const categoryCount = [hasLetter, hasNumber, hasSymbol].filter(Boolean).length

      if (!PASSWORD_PATTERN.test(trimmedPassword) || categoryCount < 2) {
        return res.status(400).json({ error: '密码需为8-20位，包含字母、数字、特殊符号中的至少两种' })
      }

      passwordToUpdate = trimmedPassword
    }

    User.update(req.userId, {
      username: trimmedUsername,
      password: passwordToUpdate,
      email,
      school,
      enrollmentYear
    })

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
