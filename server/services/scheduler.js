const cron = require('node-cron')
const Question = require('../models/Question')
const VerificationCode = require('../models/VerificationCode')

function getNonNegativeInteger(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.floor(parsed)
}

/**
 * 定时任务调度器
 */
class SchedulerService {
  static getQuestionCleanupConfig() {
    return {
      daysOld: getNonNegativeInteger(process.env.QUESTION_CLEANUP_MAX_AGE_DAYS, 30),
      minCount: getNonNegativeInteger(process.env.QUESTION_CLEANUP_MIN_COUNT, 5)
    }
  }

  /**
   * 启动所有定时任务
   */
  static startAll() {
    const cleanupConfig = this.getQuestionCleanupConfig()

    // 每天凌晨0点执行清理任务
    cron.schedule('0 0 * * *', () => {
      console.log('\n' + '='.repeat(60))
      console.log('⏰ 定时任务触发 | ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }))
      console.log('='.repeat(60))
      this.cleanOldQuestions()
      this.cleanExpiredVerificationCodes()
      console.log('='.repeat(60) + '\n')
    }, {
      timezone: 'Asia/Shanghai'
    })

    // 每小时清理一次过期验证码
    cron.schedule('0 * * * *', () => {
      this.cleanExpiredVerificationCodes()
    }, {
      timezone: 'Asia/Shanghai'
    })

    console.log('\x1b[36m✓ 定时任务调度器已启动\x1b[0m')
    console.log(`   • 每天凌晨0点清理超过${cleanupConfig.daysOld}天且超出保留阈值的题目（每组至少保留${cleanupConfig.minCount}题）`)
    console.log('   • 每小时清理过期验证码')
  }

  /**
   * 清理超过30天的公共题库题目及相关记录
   */
  static cleanOldQuestions() {
    try {
      const cleanupConfig = this.getQuestionCleanupConfig()
      const cleanupPlan = Question.planOldPublicQuestionCleanup(cleanupConfig)
      const plannedQuestionDeletes = cleanupPlan.traditionalIds.length + cleanupPlan.pronounIds.length

      console.log(`\n🧹 开始清理超过${cleanupPlan.daysOld}天的旧题目...`)
      console.log('-'.repeat(60))
      console.log(`📐 保留阈值: 每课/每时态/每种带代词变位形式至少保留 ${cleanupPlan.minCount} 题`)
      console.log(`🗂️ 超期候选题目: 传统 ${cleanupPlan.candidates.traditional} 题 | 带代词 ${cleanupPlan.candidates.pronoun} 题`)
      console.log(`✂️ 本次可删除题目: ${plannedQuestionDeletes} 题`)
      
      // 先删除答题记录
      console.log('📊 步骤1: 清理答题记录...')
      const recordsDeleted = Question.deleteQuestionRecordsByIds(cleanupPlan)
      console.log(`   ✓ 已删除 \x1b[33m${recordsDeleted}\x1b[0m 条超期题目的答题记录`)

      // 再删除题目本身
      console.log('\n📝 步骤2: 清理公共题库题目...')
      const questionsDeleted = Question.deletePublicQuestionsByIds(cleanupPlan)
      console.log(`   ✓ 已删除 \x1b[33m${questionsDeleted}\x1b[0m 道超过${cleanupPlan.daysOld}天且超出保留阈值的公共题库题目`)
      
      console.log('-'.repeat(60))
      console.log(`\x1b[32m✓ 清理完成\x1b[0m | 记录: ${recordsDeleted} 条 | 题目: ${questionsDeleted} 道\n`)

      return {
        recordsDeleted,
        questionsDeleted,
        success: true
      }
    } catch (error) {
      console.error('\x1b[31m✗ 清理旧题目失败:\x1b[0m', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 清理过期的验证码记录
   */
  static cleanExpiredVerificationCodes() {
    try {
      console.log('\n🧹 清理过期验证码...')
      const deleted = VerificationCode.cleanupExpired()
      console.log(`   ✓ 已删除 \x1b[33m${deleted}\x1b[0m 条过期验证码记录`)
      
      return {
        deleted,
        success: true
      }
    } catch (error) {
      console.error('\x1b[31m✗ 清理验证码失败:\x1b[0m', error)
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
    console.log('\n' + '='.repeat(60))
    console.log('👤 手动触发清理任务 | ' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }))
    console.log('='.repeat(60))
    const result = this.cleanOldQuestions()
    this.cleanExpiredVerificationCodes()
    console.log('='.repeat(60) + '\n')
    return result
  }
}

module.exports = SchedulerService
