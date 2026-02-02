const fs = require('fs')
const path = require('path')

const ANNOUNCEMENT_FILE = path.join(__dirname, '../src/announcement.json')

class Announcement {
  // 将北京时间格式 "2026-02-02 10:00:00" 转换为 ISO 格式
  static convertTimeFormat(timeString) {
    if (!timeString) return null
    // 如果已经是 ISO 格式，直接返回
    if (timeString.includes('T')) return timeString
    // 将 "2026-02-02 10:00:00" 转换为 "2026-02-02T10:00:00+08:00"
    return timeString.replace(' ', 'T') + '+08:00'
  }

  // 处理公告数据，转换时间格式
  static processAnnouncement(announcement) {
    return {
      ...announcement,
      publishTime: this.convertTimeFormat(announcement.publishTime)
    }
  }

  // 获取所有公告
  static getAll() {
    try {
      const data = fs.readFileSync(ANNOUNCEMENT_FILE, 'utf8')
      const announcements = JSON.parse(data)
      // 转换时间格式
      return announcements.map(a => this.processAnnouncement(a))
    } catch (error) {
      console.error('读取公告文件失败:', error)
      return []
    }
  }

  // 获取所有激活的公告
  static getActive() {
    const announcements = this.getAll()
    
    return announcements.filter(announcement => {
      // 必须是激活状态
      return announcement.isActive
    })
  }

  // 根据ID获取公告
  static getById(id) {
    const announcements = this.getAll()
    return announcements.find(announcement => announcement.id === parseInt(id))
  }

  // 创建新公告
  static create(announcementData) {
    const announcements = this.getAll()
    
    // 生成新ID
    const maxId = announcements.reduce((max, a) => Math.max(max, a.id), 0)
    const newAnnouncement = {
      id: maxId + 1,
      title: announcementData.title,
      content: announcementData.content,
      priority: announcementData.priority || 'medium',
      publisher: announcementData.publisher,
      publishTime: announcementData.publishTime || new Date().toISOString(),
      isActive: announcementData.isActive !== undefined ? announcementData.isActive : true
    }
    
    announcements.push(newAnnouncement)
    this.saveAll(announcements)
    
    return newAnnouncement
  }

  // 更新公告
  static update(id, updateData) {
    const announcements = this.getAll()
    const index = announcements.findIndex(a => a.id === parseInt(id))
    
    if (index === -1) {
      return null
    }
    
    // 更新公告数据
    announcements[index] = {
      ...announcements[index],
      ...updateData,
      id: announcements[index].id // 确保ID不被更改
    }
    
    this.saveAll(announcements)
    return announcements[index]
  }

  // 删除公告
  static delete(id) {
    const announcements = this.getAll()
    const index = announcements.findIndex(a => a.id === parseInt(id))
    
    if (index === -1) {
      return false
    }
    
    announcements.splice(index, 1)
    this.saveAll(announcements)
    
    return true
  }

  // 保存所有公告到文件
  static saveAll(announcements) {
    try {
      fs.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify(announcements, null, 2), 'utf8')
      return true
    } catch (error) {
      console.error('保存公告文件失败:', error)
      return false
    }
  }

  // 按优先级排序
  static sortByPriority(announcements) {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return announcements.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      // 优先级相同时，按发布时间倒序
      return new Date(b.publishTime) - new Date(a.publishTime)
    })
  }
}

module.exports = Announcement
