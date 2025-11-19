const express = require('express')
const router = express.Router()
const FavoriteVerb = require('../models/FavoriteVerb')
const WrongVerb = require('../models/WrongVerb')
const { authMiddleware } = require('../middleware/auth')

// 获取单词本统计
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    
    const favoriteCount = FavoriteVerb.getCount(userId)
    const wrongCount = WrongVerb.getCount(userId)
    
    res.json({
      success: true,
      stats: {
        favoriteCount,
        wrongCount
      }
    })
  } catch (error) {
    console.error('获取单词本统计失败:', error)
    res.status(500).json({ error: '获取统计失败' })
  }
})

// ==================== 收藏相关 ====================

// 添加收藏
router.post('/favorite/add', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const { verbId } = req.body
    
    if (!verbId) {
      return res.status(400).json({ error: '缺少verbId参数' })
    }
    
    const added = FavoriteVerb.add(userId, verbId)
    
    res.json({
      success: true,
      added,
      message: added ? '收藏成功' : '已经收藏过了'
    })
  } catch (error) {
    console.error('添加收藏失败:', error)
    res.status(500).json({ error: '收藏失败' })
  }
})

// 取消收藏
router.post('/favorite/remove', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const { verbId } = req.body
    
    if (!verbId) {
      return res.status(400).json({ error: '缺少verbId参数' })
    }
    
    const removed = FavoriteVerb.remove(userId, verbId)
    
    res.json({
      success: true,
      removed,
      message: removed ? '取消收藏成功' : '未找到收藏记录'
    })
  } catch (error) {
    console.error('取消收藏失败:', error)
    res.status(500).json({ error: '取消收藏失败' })
  }
})

// 检查是否已收藏
router.get('/favorite/check/:verbId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const verbId = parseInt(req.params.verbId)
    
    const isFavorited = FavoriteVerb.isFavorited(userId, verbId)
    
    res.json({
      success: true,
      isFavorited
    })
  } catch (error) {
    console.error('检查收藏状态失败:', error)
    res.status(500).json({ error: '检查失败' })
  }
})

// 获取收藏列表
router.get('/favorite/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const favorites = FavoriteVerb.getByUserId(userId)
    
    // 变位类型映射
    const conjugationTypeMap = {
      1: '第一变位',
      2: '第二变位',
      3: '第三变位'
    }
    
    const formattedFavorites = favorites.map(fav => ({
      ...fav,
      conjugationType: conjugationTypeMap[fav.conjugation_type] || '未知',
      isIrregular: fav.is_irregular === 1
    }))
    
    res.json({
      success: true,
      favorites: formattedFavorites,
      count: favorites.length
    })
  } catch (error) {
    console.error('获取收藏列表失败:', error)
    res.status(500).json({ error: '获取列表失败' })
  }
})

// ==================== 错题相关 ====================

// 添加错题记录
router.post('/wrong/add', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const { verbId } = req.body
    
    if (!verbId) {
      return res.status(400).json({ error: '缺少verbId参数' })
    }
    
    const wrongCount = WrongVerb.addOrUpdate(userId, verbId)
    
    res.json({
      success: true,
      wrongCount,
      message: '错题记录已更新'
    })
  } catch (error) {
    console.error('添加错题失败:', error)
    res.status(500).json({ error: '添加错题失败' })
  }
})

// 删除错题记录
router.post('/wrong/remove', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const { verbId } = req.body
    
    if (!verbId) {
      return res.status(400).json({ error: '缺少verbId参数' })
    }
    
    const removed = WrongVerb.remove(userId, verbId)
    
    res.json({
      success: true,
      removed,
      message: removed ? '错题记录已删除' : '未找到错题记录'
    })
  } catch (error) {
    console.error('删除错题失败:', error)
    res.status(500).json({ error: '删除错题失败' })
  }
})

// 获取错题列表
router.get('/wrong/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const wrongs = WrongVerb.getByUserId(userId)
    
    // 变位类型映射
    const conjugationTypeMap = {
      1: '第一变位',
      2: '第二变位',
      3: '第三变位'
    }
    
    const formattedWrongs = wrongs.map(wrong => ({
      ...wrong,
      conjugationType: conjugationTypeMap[wrong.conjugation_type] || '未知',
      isIrregular: wrong.is_irregular === 1
    }))
    
    res.json({
      success: true,
      wrongs: formattedWrongs,
      count: wrongs.length
    })
  } catch (error) {
    console.error('获取错题列表失败:', error)
    res.status(500).json({ error: '获取列表失败' })
  }
})

module.exports = router
