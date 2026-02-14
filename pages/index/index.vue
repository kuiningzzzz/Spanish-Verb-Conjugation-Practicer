<template>
  <view class="container">
    <view v-if="loadFailed" class="network-error-tip">加载失败，请检查您的网络连接</view>
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
          <text class="welcome-checkin-tip" v-if="hasCheckedInToday">已完成今日打卡，再接再厉哦！</text>
          <text class="welcome-checkin-tip" v-else>你今天还没有打卡哟～完成任意练习即可续火</text>
        </view>
        <view class="streak-badge">
          <view class="streak-number-row">
            <text class="streak-status-icon">{{ hasCheckedInToday ? '🔥' : '⏰' }}</text>
            <text class="streak-number" :class="{ 'streak-number-checked': hasCheckedInToday }">{{ streakDays }}</text>
          </view>
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
      <view class="quick-item" @click="goToFriends">
        <text class="quick-icon">👥</text>
        <text class="quick-label">好友</text>
      </view>
      <view class="quick-item" @click="goToClass">
        <text class="quick-icon">🎓</text>
        <text class="quick-label">班级</text>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'

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
      hasCheckedInToday: false,
      hasNewAnnouncement: false,  // 是否有新公告
      loadFailed: false
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
      this.loadFailed = false
      try {
        // 获取最新用户信息
        try {
          const userRes = await api.getUserInfo({ silentFailToast: true })
          if (userRes.success) {
            this.userInfo = userRes.user
            // 更新本地缓存
            uni.setStorageSync('userInfo', userRes.user)
          }
        } catch (error) {
          if (this.isNetworkError(error)) this.loadFailed = true
          console.error('获取用户信息失败:', error)
        }

        // 获取统计数据
        try {
          const statsRes = await api.getStatistics({ silentFailToast: true })
          if (statsRes.success) {
            this.todayStats = statsRes.statistics.today || { total: 0, correct: 0 }
            this.totalStats = statsRes.statistics || {}
          }
        } catch (error) {
          if (this.isNetworkError(error)) this.loadFailed = true
          console.error('获取统计数据失败:', error)
        }

        // 获取打卡信息
        try {
          const checkInRes = await api.getCheckInHistory({ silentFailToast: true })
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
          if (this.isNetworkError(error)) this.loadFailed = true
          console.error('获取打卡信息异常:', error)
        }

      } catch (error) {
        if (this.isNetworkError(error)) this.loadFailed = true
        console.error('加载数据失败:', error)
      }
    },
    isNetworkError(error) {
      return Boolean(error && typeof error.errMsg === 'string' && error.errMsg.includes('request:fail'))
    },
    startPractice() {
      uni.navigateTo({
        url: '/pages/practice/practice'
      })
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
    goToFriends() {
      uni.navigateTo({
        url: '/pages/friends/friends'
      })
    },
    goToClass() {
      uni.showToast({
        title: '班级功能正在火热施工中！',
        icon: 'none',
        duration: 2000
      })
    },
    
    // 检查是否有新公告
    async checkNewAnnouncements() {
      try {
        const res = await api.getAnnouncements({ silentFailToast: true })
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
        if (this.isNetworkError(error)) this.loadFailed = true
        console.error('检查新公告失败:', error)
      }
    }
  }
}
</script>

<style scoped>
.network-error-tip {
  text-align: center;
  color: #d93025;
  font-size: 28rpx;
  font-weight: 600;
  padding-top: 12rpx;
}

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

.welcome-checkin-tip {
  display: block;
  font-size: 24rpx;
  line-height: 1.5;
  opacity: 0.9;
  max-width: 480rpx;
}

.streak-badge {
  text-align: center;
  background: rgba(255, 255, 255, 0.2);
  padding: 20rpx 30rpx;
  border-radius: 12rpx;
}

.streak-number {
  font-size: 40rpx;
  font-weight: bold;
}

.streak-number-checked {
  color: #ff6a1a;
}

.streak-number-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 52rpx;
}

.streak-status-icon {
  font-size: 32rpx;
  line-height: 1;
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

.quick-access {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.quick-item {
  width: 49%;
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 20rpx;
  box-sizing: border-box;
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
