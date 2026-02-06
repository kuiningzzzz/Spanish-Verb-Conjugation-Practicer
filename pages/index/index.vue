<template>
  <view class="container">
    <view class="header">
      <text class="title">Con-jugamos</text>
      <text class="title">西班牙语动词变位</text>
      <text class="subtitle">每天练习，轻松掌握</text>
      <!-- 公告按钮 -->
      <view class="announcement-btn" @click="goToAnnouncement">
        <text class="announcement-icon">📢</text>
        <view v-if="hasNewAnnouncement" class="announcement-dot"></view>
      </view>
    </view>

    <view class="card welcome-card" v-if="userInfo">
      <view class="flex-between">
        <view>
          <text class="welcome-text">欢迎回来, {{ userInfo.username }}</text>
          <text class="study-days">已学习 {{ studyDays }} 天</text>
        </view>
        <view class="streak-badge">
          <text class="streak-number">{{ streakDays }}</text>
          <text class="streak-label">连续打卡</text>
        </view>
      </view>
    </view>

    <view class="card stats-card">
      <view class="stats-row">
        <view class="stat-item">
          <text class="stat-number">{{ todayStats.total }}</text>
          <text class="stat-label">今日练习</text>
        </view>
        <view class="stat-item">
          <text class="stat-number">{{ todayStats.correct }}</text>
          <text class="stat-label">答对题目</text>
        </view>
        <view class="stat-item">
          <text class="stat-number">{{ totalStats.masteredVerbsCount || 0 }}</text>
          <text class="stat-label">已掌握</text>
        </view>
      </view>
    </view>

    <view class="action-buttons">
      <view class="button-row">
        <button class="btn-primary half-width" @click="goToCourse">课程练习</button>
        <button class="btn-primary half-width" @click="startPractice">单词练习</button>
      </view>
      <button class="btn-secondary mt-20" @click="checkIn" v-if="!hasCheckedInToday">每日打卡</button>
      <view class="checked-in-tip mt-20" v-else>
        <text>✓ 今日已打卡</text>
      </view>
    </view>

    <view class="quick-access mt-20">
      <view class="quick-item" @click="goToLeaderboard">
        <text class="quick-icon">🏆</text>
        <text class="quick-label">排行榜</text>
      </view>
      <view class="quick-item" @click="goToStatistics">
        <text class="quick-icon">📊</text>
        <text class="quick-label">学习统计</text>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { formatDate, showToast } from '@/utils/common.js'

export default {
  data() {
    return {
      userInfo: null,
      todayStats: {
        total: 0,
        correct: 0
      },
      totalStats: {},
      streakDays: 0,
      studyDays: 0,
      hasCheckedInToday: false,
      hasNewAnnouncement: false  // 是否有新公告
    }
  },
  onLoad() {
    this.checkLogin()
  },
  onShow() {
    if (this.userInfo) {
      this.loadData()
    }
    // 检查是否有新公告
    this.checkNewAnnouncements()
  },
  methods: {
    checkLogin() {
      const token = uni.getStorageSync('token')
      const userInfo = uni.getStorageSync('userInfo')
      
      if (token && userInfo) {
        this.userInfo = userInfo
        this.loadData()
      } else {
        // 未登录，跳转到登录页（使用 reLaunch 避免 tabBar 冲突）
        uni.reLaunch({
          url: '/pages/login/login'
        })
      }
    },
    async loadData() {
      try {
        // 获取最新用户信息
        try {
          const userRes = await api.getUserInfo()
          if (userRes.success) {
            this.userInfo = userRes.user
            // 更新本地缓存
            uni.setStorageSync('userInfo', userRes.user)
          }
        } catch (error) {
          console.error('获取用户信息失败:', error)
        }

        // 获取统计数据
        try {
          const statsRes = await api.getStatistics()
          if (statsRes.success) {
            this.todayStats = statsRes.statistics.today || { total: 0, correct: 0 }
            this.totalStats = statsRes.statistics || {}
          }
        } catch (error) {
          console.error('获取统计数据失败:', error)
        }

        // 获取打卡信息
        try {
          const checkInRes = await api.getCheckInHistory()
          console.log('📅 打卡信息返回:', checkInRes)
          if (checkInRes.success) {
            // 使用类型检查，避免0被误判为falsy
            this.streakDays = typeof checkInRes.streakDays === 'number' ? checkInRes.streakDays : 0
            this.hasCheckedInToday = checkInRes.hasCheckedInToday
            console.log('✅ 连续打卡天数:', this.streakDays)
          } else {
            console.error('❌ 获取打卡信息失败:', checkInRes)
          }
        } catch (error) {
          console.error('获取打卡信息异常:', error)
        }

        // 计算学习天数
        if (this.userInfo.created_at) {
          console.log('📅 原始created_at:', this.userInfo.created_at)
          
          // 修复时区问题：SQLite存储格式为 'YYYY-MM-DD HH:MM:SS'，需要手动解析为本地时间
          const dateStr = this.userInfo.created_at
          let start
          
          // 尝试解析日期时间格式
          if (dateStr.includes(' ')) {
            // 格式：'2025-11-20 15:30:00'
            const [datePart, timePart] = dateStr.split(' ')
            const [year, month, day] = datePart.split('-').map(Number)
            const [hour = 0, minute = 0, second = 0] = timePart ? timePart.split(':').map(Number) : [0, 0, 0]
            start = new Date(year, month - 1, day, hour, minute, second)
          } else if (dateStr.includes('-')) {
            // 格式：'2025-11-20'
            const [year, month, day] = dateStr.split('-').map(Number)
            start = new Date(year, month - 1, day)
          } else {
            // 其他格式，尝试直接解析
            start = new Date(dateStr)
          }
          
          const now = new Date()
          console.log('🕐 解析后的日期:', start)
          console.log('🕐 当前日期:', now)
          
          // 验证日期是否有效
          if (!isNaN(start.getTime())) {
            const days = Math.floor((now - start) / (1000 * 60 * 60 * 24))
            this.studyDays = Math.max(1, days + 1) // 从1开始计数，今天注册显示1天
            console.log('📊 学习天数:', this.studyDays, '天')
          } else {
            console.error('❌ 无效的创建日期:', this.userInfo.created_at)
            this.studyDays = 1
          }
        } else {
          console.warn('⚠️ 用户信息中没有created_at字段')
          this.studyDays = 1
        }
      } catch (error) {
        console.error('加载数据失败:', error)
      }
    },
    startPractice() {
      uni.navigateTo({
        url: '/pages/practice/practice'
      })
    },
    async checkIn() {
      // 检查今日是否有练习记录
      if (!this.todayStats.total || this.todayStats.total === 0) {
        showToast('你今天还没练习哦！', 'none')
        return
      }

      try {
        const res = await api.checkIn()
        if (res.success) {
          showToast(res.message || '打卡成功', 'success')
          this.hasCheckedInToday = true
          this.streakDays = res.streakDays || this.streakDays + 1
        }
      } catch (error) {
        showToast('打卡失败')
      }
    },
    goToLeaderboard() {
      uni.navigateTo({
        url: '/pages/leaderboard/leaderboard'
      })
    },
    goToStatistics() {
      uni.navigateTo({
        url: '/pages/statistics/statistics'
      })
    },
    goToCourse() {
      uni.navigateTo({
        url: '/pages/course/course'
      })
    },
    goToAnnouncement() {
      uni.navigateTo({
        url: '/pages/announcement/announcement'
      })
    },
    
    // 检查是否有新公告
    async checkNewAnnouncements() {
      try {
        const res = await api.getAnnouncements()
        if (res.success && res.data) {
          const currentIds = res.data.map(a => a.id)
          const readIds = uni.getStorageSync('readAnnouncementIds') || []
          
          // 检查是否有新公告（当前ID中有不在已读ID中的）
          const hasNew = currentIds.some(id => !readIds.includes(id))
          this.hasNewAnnouncement = hasNew
          
          // 如果有ID被删除，更新已读ID列表（只保留仍然存在的ID）
          const validReadIds = readIds.filter(id => currentIds.includes(id))
          if (validReadIds.length !== readIds.length) {
            uni.setStorageSync('readAnnouncementIds', validReadIds)
          }
        }
      } catch (error) {
        console.error('检查新公告失败:', error)
      }
    }
  }
}
</script>

<style scoped>
.header {
  text-align: center;
  padding: 60rpx 0 40rpx;
  position: relative;
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.subtitle {
  display: block;
  font-size: 28rpx;
  color: #999;
}

/* 公告按钮样式 */
.announcement-btn {
  position: absolute;
  top: 60rpx;
  right: 30rpx;
  width: 70rpx;
  height: 70rpx;
  background: #8B0012;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(139, 0, 18, 0.4);
  transition: all 0.3s;
}

.announcement-btn:active {
  transform: scale(0.95);
  box-shadow: 0 2rpx 8rpx rgba(139, 0, 18, 0.3);
}

.announcement-icon {
  font-size: 36rpx;
}

.announcement-dot {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 14rpx;
  height: 14rpx;
  background: #FF0000;
  border-radius: 50%;
}

.welcome-card {
  background: #8B0012;
  color: #fff;
}

.welcome-text {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  margin-bottom: 10rpx;
}

.study-days {
  display: block;
  font-size: 24rpx;
  opacity: 0.9;
}

.streak-badge {
  text-align: center;
  background: rgba(255, 255, 255, 0.2);
  padding: 20rpx 30rpx;
  border-radius: 12rpx;
}

.streak-number {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
}

.streak-label {
  display: block;
  font-size: 22rpx;
  margin-top: 5rpx;
}

.stats-card {
  margin-top: 20rpx;
}

.stats-row {
  display: flex;
  justify-content: space-around;
}

.stat-item {
  text-align: center;
  flex: 1;
}

.stat-number {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #8B0012;
  margin-bottom: 10rpx;
}

.stat-label {
  display: block;
  font-size: 24rpx;
  color: #999;
}

.action-buttons {
  padding: 20rpx 0;
}

.button-row {
  display: flex;
  gap: 20rpx;
}

.half-width {
  flex: 1;
  margin: 0;
}

.checked-in-tip {
  text-align: center;
  color: #52c41a;
  font-size: 28rpx;
}

.quick-access {
  display: flex;
  gap: 20rpx;
}

.quick-item {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.quick-icon {
  display: block;
  font-size: 48rpx;
  margin-bottom: 10rpx;
}

.quick-label {
  display: block;
  font-size: 26rpx;
  color: #666;
}
</style>
