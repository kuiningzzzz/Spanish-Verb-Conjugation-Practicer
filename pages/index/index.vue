<template>
  <view class="container">
    <view class="header">
      <text class="title">西班牙语动词变位</text>
      <text class="subtitle">每天练习，轻松掌握</text>
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
      <button class="btn-primary" @click="startPractice">开始练习</button>
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
      hasCheckedInToday: false
    }
  },
  onLoad() {
    this.checkLogin()
  },
  onShow() {
    if (this.userInfo) {
      this.loadData()
    }
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
            // 使用严格的类型检查，避免0被误判为falsy
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
          const start = new Date(this.userInfo.created_at)
          const now = new Date()
          
          // 验证日期是否有效
          if (!isNaN(start.getTime())) {
            const days = Math.floor((now - start) / (1000 * 60 * 60 * 24))
            this.studyDays = Math.max(0, days) // 确保不会出现负数
          } else {
            console.error('无效的创建日期:', this.userInfo.created_at)
            this.studyDays = 0
          }
        } else {
          this.studyDays = 0
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
      uni.switchTab({
        url: '/pages/leaderboard/leaderboard'
      })
    },
    goToStatistics() {
      uni.switchTab({
        url: '/pages/statistics/statistics'
      })
    }
  }
}
</script>

<style scoped>
.header {
  text-align: center;
  padding: 60rpx 0 40rpx;
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

.welcome-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  color: #667eea;
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
