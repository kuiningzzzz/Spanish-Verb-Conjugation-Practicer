<template>
  <view class="container">
    <!-- 背景装饰 -->
    <view class="profile-background">
      <view class="bg-shape shape-1"></view>
      <view class="bg-shape shape-2"></view>
      <view class="bg-shape shape-3"></view>
    </view>

    <!-- 用户头像区域 -->
    <view class="profile-header">
      <view class="header-background"></view>
      <view class="user-avatar-section">
        <view class="avatar-container">
          <view class="avatar-wrapper">
            <text class="avatar-text">{{ avatarText }}</text>
            <view class="avatar-badge" v-if="userInfo && userInfo.isVIP">VIP</view>
          </view>
          <view class="camera-icon" @click="changeAvatar">📷</view>
        </view>
        <view class="user-info">
          <text class="username">{{ userInfo && userInfo.username }}</text>
          <view class="user-tags">
            <view class="user-tag" :class="userTypeClass">
              <text class="tag-icon">{{ userTypeIcon }}</text>
              <text class="tag-text">{{ userTypeText }}</text>
            </view>
            <view class="user-tag streak" v-if="streakDays > 0">
              <text class="tag-icon">🔥</text>
              <text class="tag-text">连续 {{ streakDays }} 天</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 学习成就 -->
    <view class="achievement-section">
      <view class="section-title">学习成就</view>
      <view class="achievement-grid">
        <view class="achievement-item">
          <view class="achievement-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <text>📚</text>
          </view>
          <text class="achievement-value">{{ studyDays }}</text>
          <text class="achievement-label">学习天数</text>
        </view>
        <view class="achievement-item">
          <view class="achievement-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
            <text>✅</text>
          </view>
          <text class="achievement-value">{{ totalExercises }}</text>
          <text class="achievement-label">练习题目</text>
        </view>
        <view class="achievement-item">
          <view class="achievement-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
            <text>🎯</text>
          </view>
          <text class="achievement-value">{{ masteredCount }}</text>
          <text class="achievement-label">掌握动词</text>
        </view>
        <view class="achievement-item">
          <view class="achievement-icon" style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);">
            <text>🏆</text>
          </view>
          <text class="achievement-value">{{ rank }}</text>
          <text class="achievement-label">当前排名</text>
        </view>
      </view>
    </view>

    <!-- 个人信息 -->
    <view class="info-section">
      <view class="info-card">
        <view class="card-header">
          <text class="card-title">个人信息</text>
          <text class="edit-button" @click="editProfile">编辑</text>
        </view>
        <view class="info-list">
          <view class="info-item" v-if="userInfo && userInfo.email">
            <view class="info-icon">📧</view>
            <view class="info-content">
              <text class="info-label">邮箱</text>
              <text class="info-value">{{ userInfo.email }}</text>
            </view>
          </view>
          <view class="info-item" v-if="userInfo && userInfo.school">
            <view class="info-icon">🏫</view>
            <view class="info-content">
              <text class="info-label">学校</text>
              <text class="info-value">{{ userInfo.school }}</text>
            </view>
          </view>
          <view class="info-item" v-if="userInfo && userInfo.enrollmentYear">
            <view class="info-icon">🎓</view>
            <view class="info-content">
              <text class="info-label">入学年份</text>
              <text class="info-value">{{ userInfo.enrollmentYear }}</text>
            </view>
          </view>
          <view class="info-item">
            <view class="info-icon">📅</view>
            <view class="info-content">
              <text class="info-label">注册时间</text>
              <text class="info-value">{{ registerDate }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 订阅信息 -->
    <view class="subscription-section" v-if="userInfo && userInfo.userType === 'public'">
      <view class="subscription-card">
        <view class="card-header">
          <text class="card-title">订阅信息</text>
          <view class="subscription-status" :class="isSubscriptionValid ? 'valid' : 'invalid'">
            {{ isSubscriptionValid ? '有效' : '已过期' }}
          </view>
        </view>
        <view class="subscription-content">
          <view class="subscription-info">
            <text class="subscription-text" v-if="isSubscriptionValid">
              订阅有效期至：{{ subscriptionEndDate }}
            </text>
            <text class="subscription-text" v-else>
              订阅已过期，请续费以继续使用全部功能
            </text>
          </view>
          <button class="renew-button" @click="renewSubscription">
            <text class="button-icon">💎</text>
            <text class="button-text">续费订阅 ¥38/年</text>
          </button>
        </view>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-section">
      <view class="menu-card">
        <view class="menu-item" @click="goToStatistics">
          <view class="menu-icon">📊</view>
          <text class="menu-label">学习统计</text>
          <text class="menu-arrow">→</text>
        </view>
        <view class="menu-item" @click="goToVocabulary">
          <view class="menu-icon">📚</view>
          <text class="menu-label">我的单词本</text>
          <text class="menu-arrow">→</text>
        </view>
        <view class="menu-item" @click="goToQuestionBank">
          <view class="menu-icon">💾</view>
          <text class="menu-label">收藏题目</text>
          <text class="menu-arrow">→</text>
        </view>
        <view class="menu-item" @click="settings">
          <view class="menu-icon">⚙️</view>
          <text class="menu-label">设置</text>
          <text class="menu-arrow">→</text>
        </view>
        <view class="menu-item" @click="aboutApp">
          <view class="menu-icon">ℹ️</view>
          <text class="menu-label">关于应用</text>
          <text class="menu-arrow">→</text>
        </view>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section">
      <button class="logout-button" @click="logout">
        <text class="logout-icon">🚪</text>
        <text class="logout-text">退出登录</text>
      </button>
    </view>

    <!-- 浮动操作按钮 -->
    <view class="fab-container">
      <view class="fab-button" @click="startPractice">
        <text class="fab-icon">📝</text>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast, showConfirm, formatDate } from '@/utils/common.js'

export default {
  data() {
    return {
      userInfo: null,
      streakDays: 0,
      studyDays: 0,
      totalExercises: 0,
      masteredCount: 0,
      rank: 0
    }
  },
  computed: {
    avatarText() {
      if (!this.userInfo || !this.userInfo.username) return '?'
      return this.userInfo.username.charAt(0).toUpperCase()
    },
    userTypeText() {
      if (!this.userInfo || !this.userInfo.userType) return ''
      return this.userInfo.userType === 'student' ? '学生用户' : '社会用户'
    },
    userTypeIcon() {
      return this.userInfo && this.userInfo.userType === 'student' ? '🎓' : '💼'
    },
    userTypeClass() {
      return this.userInfo && this.userInfo.userType === 'student' ? 'student' : 'public'
    },
    registerDate() {
      if (!this.userInfo || !this.userInfo.created_at) return ''
      return formatDate(this.userInfo.created_at, 'YYYY-MM-DD')
    },
    subscriptionEndDate() {
      if (!this.userInfo || !this.userInfo.subscriptionEndDate) return ''
      return formatDate(this.userInfo.subscriptionEndDate, 'YYYY-MM-DD')
    },
    isSubscriptionValid() {
      if (!this.userInfo || !this.userInfo.subscriptionEndDate) return false
      return new Date(this.userInfo.subscriptionEndDate) > new Date()
    }
  },
  onShow() {
    const token = uni.getStorageSync('token')
    if (!token) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.loadUserInfo()
    this.loadUserStats()
  },
  methods: {
    async loadUserInfo() {
      const localUserInfo = uni.getStorageSync('userInfo')
      if (localUserInfo) {
        this.userInfo = localUserInfo
      }

      try {
        const res = await api.getUserInfo()
        if (res.success) {
          this.userInfo = res.user
          uni.setStorageSync('userInfo', res.user)
        }
      } catch (error) {
        console.error('获取用户信息失败:', error)
      }
    },
    async loadUserStats() {
      try {
        // 获取统计数据
        const statsRes = await api.getStatistics()
        if (statsRes.success) {
          const stats = statsRes.statistics.total || {}
          this.totalExercises = stats.total_exercises || 0
          this.masteredCount = stats.masteredVerbsCount || 0
        }

        // 获取打卡信息
        const checkInRes = await api.getCheckInHistory()
        if (checkInRes.success) {
          this.streakDays = checkInRes.streakDays || 0
        }

        // 模拟学习天数
        if (this.userInfo && this.userInfo.created_at) {
          const start = new Date(this.userInfo.created_at)
          const now = new Date()
          const days = Math.floor((now - start) / (1000 * 60 * 60 * 24))
          this.studyDays = Math.max(1, days + 1)
        }

        // 模拟排名
        this.rank =  1
      } catch (error) {
        console.error('加载用户统计失败:', error)
      }
    },
    changeAvatar() {
      uni.showModal({
        title: '更换头像',
        content: '头像更换功能开发中，敬请期待',
        showCancel: false
      })
    },
    editProfile() {
      uni.showModal({
        title: '编辑个人信息',
        content: '编辑功能开发中，敬请期待',
        showCancel: false
      })
    },
    renewSubscription() {
      uni.showModal({
        title: '续费订阅',
        content: '支付功能开发中，敬请期待',
        showCancel: false
      })
    },
    goToStatistics() {
      uni.switchTab({
        url: '/pages/statistics/statistics'
      })
    },
    goToVocabulary() {
      uni.switchTab({
        url: '/pages/vocabulary/vocabulary'
      })
    },
    goToQuestionBank() {
      uni.navigateTo({
        url: '/pages/question-bank/question-bank'
      })
    },
    settings() {
      uni.showModal({
        title: '设置',
        content: '设置功能开发中，敬请期待',
        showCancel: false
      })
    },
    aboutApp() {
      uni.showModal({
        title: '关于应用',
        content: '西班牙语动词变位练习APP v1.0.0\n\n帮助学生轻松掌握西班牙语动词变位\n\n—— 让学习变得更简单',
        showCancel: false
      })
    },
    startPractice() {
      uni.navigateTo({
        url: '/pages/practice/practice'
      })
    },
    async logout() {
      try {
        await showConfirm('确定要退出登录吗？')
        
        uni.removeStorageSync('token')
        uni.removeStorageSync('userInfo')
        
        showToast('已退出登录', 'success')
        
        setTimeout(() => {
          uni.reLaunch({
            url: '/pages/login/login'
          })
        }, 1000)
      } catch (error) {
        // 用户取消
      }
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f8f9fa;
  position: relative;
  overflow-x: hidden;
}

.profile-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 400rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: 0;
}

.bg-shape {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.shape-1 {
  width: 200rpx;
  height: 200rpx;
  top: -100rpx;
  right: -100rpx;
}

.shape-2 {
  width: 150rpx;
  height: 150rpx;
  top: 50%;
  left: -75rpx;
}

.shape-3 {
  width: 100rpx;
  height: 100rpx;
  bottom: 50rpx;
  right: 20%;
}

/* 用户头像区域 */
.profile-header {
  position: relative;
  z-index: 1;
}

.header-background {
  height: 200rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.user-avatar-section {
  padding: 0 40rpx;
  margin-top: -80rpx;
  display: flex;
  align-items: flex-end;
  gap: 30rpx;
}

.avatar-container {
  position: relative;
}

.avatar-wrapper {
  width: 160rpx;
  height: 160rpx;
  border-radius: 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  box-shadow: 0 20rpx 40rpx rgba(0, 0, 0, 0.2);
  position: relative;
  border: 4rpx solid #fff;
}

.avatar-badge {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  color: #fff;
  padding: 6rpx 12rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
  font-weight: bold;
  box-shadow: 0 4rpx 12rpx rgba(255, 215, 0, 0.3);
}

.camera-icon {
  position: absolute;
  bottom: -10rpx;
  right: -10rpx;
  width: 50rpx;
  height: 50rpx;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
  border: 2rpx solid #f0f0f0;
}

.user-info {
  flex: 1;
  padding-bottom: 20rpx;
}

.username {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 15rpx;
}

.user-tags {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.user-tag {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  font-weight: 500;
}

.user-tag.student {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  color: #fff;
}

.user-tag.public {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  color: #fff;
}

.user-tag.streak {
  background: rgba(255, 107, 107, 0.2);
  backdrop-filter: blur(10px);
  color: #fff;
}

.tag-icon {
  font-size: 20rpx;
}

/* 学习成就 */
.achievement-section {
  padding: 40rpx 40rpx 20rpx;
  position: relative;
  z-index: 1;
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 30rpx;
}

.achievement-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.achievement-item {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  text-align: center;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
  transition: all 0.3s ease;
}

.achievement-item:active {
  transform: scale(0.98);
  box-shadow: 0 5rpx 15rpx rgba(0, 0, 0, 0.12);
}

.achievement-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 15rpx;
  font-size: 36rpx;
  color: #fff;
}

.achievement-value {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.achievement-label {
  display: block;
  font-size: 24rpx;
  color: #666;
}

/* 个人信息 */
.info-section {
  padding: 20rpx 40rpx;
}

.info-card {
  background: #fff;
  border-radius: 25rpx;
  padding: 40rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.card-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.edit-button {
  color: #667eea;
  font-size: 26rpx;
  font-weight: 500;
  padding: 12rpx 20rpx;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 15rpx;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 25rpx;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.info-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: 15rpx;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #667eea;
}

.info-content {
  flex: 1;
}

.info-label {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 5rpx;
}

.info-value {
  display: block;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

/* 订阅信息 */
.subscription-section {
  padding: 20rpx 40rpx;
}

.subscription-card {
  background: #fff;
  border-radius: 25rpx;
  padding: 40rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
}

.subscription-status {
  padding: 8rpx 16rpx;
  border-radius: 15rpx;
  font-size: 24rpx;
  font-weight: bold;
}

.subscription-status.valid {
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}

.subscription-status.invalid {
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
}

.subscription-content {
  display: flex;
  flex-direction: column;
  gap: 25rpx;
}

.subscription-info {
  text-align: center;
}

.subscription-text {
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
}

.renew-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 25rpx;
  padding: 25rpx;
  font-size: 28rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  box-shadow: 0 8rpx 20rpx rgba(102, 126, 234, 0.3);
}

.renew-button:active {
  transform: scale(0.98);
}

.button-icon {
  font-size: 32rpx;
}

/* 功能菜单 */
.menu-section {
  padding: 20rpx 40rpx;
}

.menu-card {
  background: #fff;
  border-radius: 25rpx;
  padding: 0;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  transition: all 0.3s ease;
}

.menu-item:active {
  background: #f8f9fa;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: 15rpx;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}

.menu-label {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.menu-arrow {
  font-size: 28rpx;
  color: #ccc;
  transition: transform 0.3s ease;
}

.menu-item:active .menu-arrow {
  transform: translateX(10rpx);
  color: #667eea;
}

/* 退出登录 */
.logout-section {
  padding: 30rpx 40rpx 40rpx;
}

.logout-button {
  background: #fff;
  color: #ff4d4f;
  border: 2rpx solid #ff4d4f;
  border-radius: 25rpx;
  padding: 25rpx;
  font-size: 28rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  transition: all 0.3s ease;
}

.logout-button:active {
  background: #ff4d4f;
  color: #fff;
  transform: scale(0.98);
}

.logout-icon {
  font-size: 32rpx;
}

/* 浮动操作按钮 */
.fab-container {
  position: fixed;
  bottom: 40rpx;
  right: 40rpx;
  z-index: 100;
}

.fab-button {
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 15rpx 30rpx rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
}

.fab-button:active {
  transform: scale(0.95);
  box-shadow: 0 8rpx 20rpx rgba(102, 126, 234, 0.6);
}

.fab-icon {
  font-size: 40rpx;
  color: #fff;
}
</style>