const express = require('express')
const router = express.Router()
const Friend = require('../models/Friend')
const { authMiddleware } = require('../middleware/auth')

/**
 * 搜索用户
 */
router.get('/search', authMiddleware, (req, res) => {
  try {
    const { keyword } = req.query
    const userId = req.user.id

    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ error: '请输入搜索关键词' })
    }

    const users = Friend.searchUsers(keyword.trim(), userId)

    res.json({
      success: true,
      users
    })
  } catch (error) {
    console.error('搜索用户错误:', error)
    res.status(500).json({ error: '搜索用户失败' })
  }
})

/**
 * 发送好友申请
 */
router.post('/request', authMiddleware, (req, res) => {
  try {
    const { toUserId, message } = req.body
    const fromUserId = req.user.id

    if (!toUserId) {
      return res.status(400).json({ error: '缺少目标用户ID' })
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ error: '不能添加自己为好友' })
    }

    Friend.sendFriendRequest(fromUserId, toUserId, message || '')

    res.json({
      success: true,
      message: '好友申请已发送'
    })
  } catch (error) {
    console.error('发送好友申请错误:', error)
    if (error.message.includes('已经是好友') || error.message.includes('已发送')) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: '发送好友申请失败' })
  }
})

/**
 * 获取收到的好友申请
 */
router.get('/requests', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id
    const requests = Friend.getReceivedRequests(userId)

    res.json({
      success: true,
      requests
    })
  } catch (error) {
    console.error('获取好友申请错误:', error)
    res.status(500).json({ error: '获取好友申请失败' })
  }
})

/**
 * 处理好友申请
 */
router.post('/handle-request', authMiddleware, (req, res) => {
  try {
    const { requestId, accept } = req.body

    if (!requestId) {
      return res.status(400).json({ error: '缺少申请ID' })
    }

    Friend.handleFriendRequest(requestId, accept)

    res.json({
      success: true,
      message: accept ? '已接受好友申请' : '已拒绝好友申请'
    })
  } catch (error) {
    console.error('处理好友申请错误:', error)
    if (error.message.includes('不存在') || error.message.includes('已处理')) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: '处理好友申请失败' })
  }
})

/**
 * 获取好友列表
 */
router.get('/list', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id
    const friends = Friend.getFriendsList(userId)

    res.json({
      success: true,
      friends
    })
  } catch (error) {
    console.error('获取好友列表错误:', error)
    res.status(500).json({ error: '获取好友列表失败' })
  }
})

/**
 * 获取好友详细信息
 */
router.get('/detail/:friendId', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id
    const friendId = parseInt(req.params.friendId)

    if (!friendId) {
      return res.status(400).json({ error: '缺少好友ID' })
    }

    const friendDetails = Friend.getFriendDetails(userId, friendId)

    res.json({
      success: true,
      friend: friendDetails
    })
  } catch (error) {
    console.error('获取好友详情错误:', error)
    if (error.message.includes('不是好友') || error.message.includes('不存在')) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: '获取好友详情失败' })
  }
})

/**
 * 设置好友备注
 */
router.post('/remark', authMiddleware, (req, res) => {
  try {
    const { friendId, remark } = req.body
    const userId = req.user.id

    if (!friendId) {
      return res.status(400).json({ error: '缺少好友ID' })
    }

    Friend.setFriendRemark(userId, friendId, remark || '')

    res.json({
      success: true,
      message: '备注设置成功'
    })
  } catch (error) {
    console.error('设置备注错误:', error)
    res.status(500).json({ error: '设置备注失败' })
  }
})

/**
 * 设置好友星标
 */
router.post('/star', authMiddleware, (req, res) => {
  try {
    const { friendId, isStarred } = req.body
    const userId = req.user.id

    if (!friendId) {
      return res.status(400).json({ error: '缺少好友ID' })
    }

    Friend.setFriendStar(userId, friendId, isStarred)

    res.json({
      success: true,
      message: isStarred ? '已加星标' : '已取消星标'
    })
  } catch (error) {
    console.error('设置星标错误:', error)
    res.status(500).json({ error: '设置星标失败' })
  }
})

/**
 * 删除好友
 */
router.delete('/:friendId', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id
    const friendId = parseInt(req.params.friendId)

    if (!friendId) {
      return res.status(400).json({ error: '缺少好友ID' })
    }

    Friend.removeFriend(userId, friendId)

    res.json({
      success: true,
      message: '已删除好友'
    })
  } catch (error) {
    console.error('删除好友错误:', error)
    res.status(500).json({ error: '删除好友失败' })
  }
})

module.exports = router
