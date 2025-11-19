const cron = require('node-cron')
const Question = require('../models/Question')

/**
 * 定时任务调度器
 */
class SchedulerService {
  /**
   * 启动所有定时任务
   */
  static startAll() {
    // 每天凌晨0点执行清理任务
    cron.schedule('0 0 * * *', () => {
      console.log('开始执行定时清理任务...')
      this.cleanOldQuestions()
    }, {
      timezone: 'Asia/Shanghai'
    })

    console.log('定时任务调度器已启动')
  }

  /**
   * 清理超过30天的公共题库题目及相关记录
   */
  static cleanOldQuestions() {
    try {
      // 先删除答题记录
      const recordsDeleted = Question.deleteOldQuestionRecords()
      console.log(`已删除 ${recordsDeleted} 条超期题目的答题记录`)

      // 再删除题目本身
      const questionsDeleted = Question.deleteOldPublicQuestions()
      console.log(`已删除 ${questionsDeleted} 道超过30天的公共题库题目`)

      return {
        recordsDeleted,
        questionsDeleted,
        success: true
      }
    } catch (error) {
      console.error('清理旧题目失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 手动触发清理（用于测试或管理员手动操作）
   */
  static manualClean() {
    console.log('手动触发清理任务...')
    return this.cleanOldQuestions()
  }
}

module.exports = SchedulerService
