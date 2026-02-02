const express = require('express')
const router = express.Router()
const Announcement = require('../models/Announcement')
const { verifyToken } = require('../middleware/auth')
const { requireAdmin } = require('../middleware/adminAuth')

// 获取所有激活的公告（无需登录）
router.get('/', (req, res) => {
  try {
    const announcements = Announcement.getActive()
    const sorted = Announcement.sortByPriority(announcements)
    
    res.json({
      success: true,
      data: sorted
    })
  } catch (error) {
    console.error('获取公告列表失败:', error)
    res.status(500).json({
      success: false,
      error: '获取公告列表失败'
    })
  }
})

// 获取所有公告（包括未激活的）- 管理员权限
router.get('/all', requireAdmin, (req, res) => {
  try {
    const announcements = Announcement.getAll()
    const sorted = Announcement.sortByPriority(announcements)
    
    res.json({
      success: true,
      data: sorted
    })
  } catch (error) {
    console.error('获取公告列表失败:', error)
    res.status(500).json({
      success: false,
      error: '获取公告列表失败'
    })
  }
})

// 根据ID获取公告详情
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params
    const announcement = Announcement.getById(id)
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: '公告不存在'
      })
    }
    
    res.json({
      success: true,
      data: announcement
    })
  } catch (error) {
    console.error('获取公告详情失败:', error)
    res.status(500).json({
      success: false,
      error: '获取公告详情失败'
    })
  }
})

// 创建新公告 - 管理员权限
router.post('/', requireAdmin, (req, res) => {
  try {
    const { title, content, priority, publisher, publishTime, isActive } = req.body
    
    // 验证必填字段
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      })
    }
    
    const announcementData = {
      title,
      content,
      priority,
      publisher: publisher || req.admin.username,
      publishTime,
      isActive
    }
    
    const newAnnouncement = Announcement.create(announcementData)
    
    res.status(201).json({
      success: true,
      data: newAnnouncement,
      message: '公告创建成功'
    })
  } catch (error) {
    console.error('创建公告失败:', error)
    res.status(500).json({
      success: false,
      error: '创建公告失败'
    })
  }
})

// 更新公告 - 管理员权限
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body
    
    // 防止修改ID
    delete updateData.id
    
    const updatedAnnouncement = Announcement.update(id, updateData)
    
    if (!updatedAnnouncement) {
      return res.status(404).json({
        success: false,
        error: '公告不存在'
      })
    }
    
    res.json({
      success: true,
      data: updatedAnnouncement,
      message: '公告更新成功'
    })
  } catch (error) {
    console.error('更新公告失败:', error)
    res.status(500).json({
      success: false,
      error: '更新公告失败'
    })
  }
})

// 删除公告 - 管理员权限
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params
    const success = Announcement.delete(id)
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: '公告不存在'
      })
    }
    
    res.json({
      success: true,
      message: '公告删除成功'
    })
  } catch (error) {
    console.error('删除公告失败:', error)
    res.status(500).json({
      success: false,
      error: '删除公告失败'
    })
  }
})

// 切换公告激活状态 - 管理员权限
router.patch('/:id/toggle', requireAdmin, (req, res) => {
  try {
    const { id } = req.params
    const announcement = Announcement.getById(id)
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: '公告不存在'
      })
    }
    
    const updatedAnnouncement = Announcement.update(id, {
      isActive: !announcement.isActive
    })
    
    res.json({
      success: true,
      data: updatedAnnouncement,
      message: `公告已${updatedAnnouncement.isActive ? '激活' : '停用'}`
    })
  } catch (error) {
    console.error('切换公告状态失败:', error)
    res.status(500).json({
      success: false,
      error: '切换公告状态失败'
    })
  }
})

module.exports = router
