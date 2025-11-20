<template>
  <view class="container">
    <!-- 背景装饰 -->
    <view class="background-decor">
      <view class="decor-trophy">🏆</view>
      <view class="decor-medal">🥇</view>
      <view class="decor-star">⭐</view>
    </view>

    <!-- 页面标题 -->
    <view class="page-header">
      <text class="page-title">排行榜</text>
      <text class="page-subtitle">看看谁在学习路上领先</text>
    </view>

    <!-- Tab切换 -->
    <view class="tab-container">
      <view 
        v-for="tab in tabs"
        :key="tab.value"
        :class="['tab-item', activeTab === tab.value ? 'active' : '']"
        @click="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
        <view class="tab-glow" v-if="activeTab === tab.value"></view>
      </view>
    </view>

    <!-- 排行榜内容 -->
    <view class="leaderboard-content">
      <!-- 前三名奖台 -->
      <view class="podium" v-if="leaderboard.length >= 3">
        <view class="podium-item second">
          <view class="podium-avatar">
            <text class="avatar-text">{{ getAvatarText(leaderboard[1].username) }}</text>
          </view>
          <view class="podium-medal">🥈</view>
          <text class="podium-name">{{ leaderboard[1].username }}</text>
          <text class="podium-school" v-if="leaderboard[1].school">{{ leaderboard[1].school }}</text>
          <text class="podium-stats">{{ leaderboard[1].check_in_days }}天 · {{ leaderboard[1].total_exercises }}题</text>
        </view>

        <view class="podium-item first">
          <view class="podium-avatar champion">
            <text class="avatar-text">{{ getAvatarText(leaderboard[0].username) }}</text>
            <view class="crown">👑</view>
          </view>
          <view class="podium-medal">🥇</view>
          <text class="podium-name">{{ leaderboard[0].username }}</text>
          <text class="podium-school" v-if="leaderboard[0].school">{{ leaderboard[0].school }}</text>
          <text class="podium-stats">{{ leaderboard[0].check_in_days }}天 · {{ leaderboard[0].total_exercises }}题</text>
        </view>

        <view class="podium-item third">
          <view class="podium-avatar">
            <text class="avatar-text">{{ getAvatarText(leaderboard[2].username) }}</text>
          </view>
          <view class="podium-medal">🥉</view>
          <text class="podium-name">{{ leaderboard[2].username }}</text>
          <text class="podium-school" v-if="leaderboard[2].school">{{ leaderboard[2].school }}</text>
          <text class="podium-stats">{{ leaderboard[2].check_in_days }}天 · {{ leaderboard[2].total_exercises }}题</text>
        </view>
      </view>

      <!-- 排行榜列表 -->
      <view class="rank-list">
        <view 
          class="rank-item" 
          v-for="(user, index) in leaderboard" 
          :key="user.id"
          :class="{ 'current-user': user.isCurrentUser }"
        >
          <view class="rank-number" :class="getRankClass(index)">
            <text v-if="index < 3" class="medal-icon">{{ ['🥇', '🥈', '🥉'][index] }}</text>
            <text v-else class="rank-digit">{{ index + 1 }}</text>
          </view>

          <view class="user-avatar">
            <text class="avatar-text">{{ getAvatarText(user.username) }}</text>
            <view class="online-indicator" v-if="user.isOnline"></view>
          </view>

          <view class="user-info">
            <view class="user-main">
              <text class="username">{{ user.username }}</text>
              <view class="user-badges">
                <view class="badge" v-if="user.isCurrentUser">我</view>
                <view class="badge streak" v-if="user.streakDays > 7">
                  🔥 {{ user.streakDays }}
                </view>
              </view>
            </view>
            <text class="school" v-if="user.school">{{ user.school }}</text>
          </view>

          <view class="user-stats">
            <view class="stat-item">
              <text class="stat-icon">📅</text>
              <text class="stat-value">{{ user.check_in_days }}天</text>
            </view>
            <view class="stat-item">
              <text class="stat-icon">📝</text>
              <text class="stat-value">{{ user.total_exercises }}题</text>
            </view>
          </view>

          <!-- 趋势指示器 -->
          <view class="trend-indicator" :class="user.trend">
            <text class="trend-icon">{{ user.trend === 'up' ? '📈' : user.trend === 'down' ? '📉' : '➡️' }}</text>
          </view>
        </view>

        <!-- 空状态 -->
        <view class="empty-state" v-if="leaderboard.length === 0">
          <view class="empty-icon">🏆</view>
          <text class="empty-title">暂无排行数据</text>
          <text class="empty-desc">开始练习，登上排行榜吧！</text>
          <button class="empty-action" @click="startPractice">开始练习</button>
        </view>
      </view>
    </view>

    <!-- 浮动提示 -->
    <view class="floating-tips">
      <view class="tip-card">
        <text class="tip-icon">💡</text>
        <view class="tip-content">
          <text class="tip-title">上榜小技巧</text>
          <text class="tip-desc">每天坚持练习和打卡，可以快速提升排名哦！</text>
        </view>
      </view>
    </view>

    <!-- 刷新按钮 -->
    <view class="refresh-fab" @click="loadLeaderboard">
      <text class="refresh-icon" :class="{ rotating: refreshing }">🔄</text>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast, showLoading, hideLoading } from '@/utils/common.js'

export default {
  data() {
    return {
      tabs: [
        { value: 'week', label: '周榜' },
        { value: 'month', label: '月榜' },
        { value: 'all', label: '总榜' }
      ],
      activeTab: 'week',
      leaderboard: [],
      refreshing: false,
      currentUser: null
    }
  },
  onShow() {
    const token = uni.getStorageSync('token')
    if (!token) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.currentUser = uni.getStorageSync('userInfo')
    this.loadLeaderboard()
  },
  methods: {
    switchTab(tab) {
      this.activeTab = tab
      this.loadLeaderboard()
    },
    async loadLeaderboard() {
      this.refreshing = true
      showLoading('加载中...')

      try {
        const res = await api.getLeaderboard(this.activeTab)
        hideLoading()
        this.refreshing = false

        if (res.success) {
          // 标记当前用户
          this.leaderboard = (res.leaderboard || []).map(user => ({
            ...user,
            isCurrentUser: user.id === this.currentUser?.id,
            trend: this.getRandomTrend() // 模拟趋势，实际应从接口获取
          }))
        }
      } catch (error) {
        hideLoading()
        this.refreshing = false
        showToast('加载失败')
      }
    },
    getRankClass(index) {
      if (index === 0) return 'rank-gold'
      if (index === 1) return 'rank-silver'
      if (index === 2) return 'rank-bronze'
      return ''
    },
    getAvatarText(username) {
      return username ? username.charAt(0).toUpperCase() : '?'
    },
    getRandomTrend() {
      const trends = ['up', 'down', 'same']
      return trends[Math.floor(Math.random() * trends.length)]
    },
    startPractice() {
      uni.navigateTo({
        url: '/pages/practice/practice'
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.background-decor {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.decor-trophy, .decor-medal, .decor-star {
  position: absolute;
  font-size: 80rpx;
  opacity: 0.1;
}

.decor-trophy {
  top: 10%;
  left: 10%;
}

.decor-medal {
  top: 20%;
  right: 10%;
}

.decor-star {
  bottom: 20%;
  left: 15%;
}

.page-header {
  padding: 80rpx 40rpx 30rpx;
  text-align: center;
}

.page-title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 10rpx;
}

.page-subtitle {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.tab-container {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  margin: 0 40rpx 30rpx;
  border-radius: 25rpx;
  padding: 8rpx;
  display: flex;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  font-size: 28rpx;
  color: #666;
  border-radius: 20rpx;
  position: relative;
  transition: all 0.3s ease;
  z-index: 1;
}

.tab-item.active {
  color: #fff;
  font-weight: bold;
}

.tab-glow {
  position: absolute;
  top: 8rpx;
  left: 8rpx;
  right: 8rpx;
  bottom: 8rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 17rpx;
  z-index: -1;
  animation: tabGlow 2s ease-in-out infinite alternate;
}

@keyframes tabGlow {
  0% { opacity: 0.9; }
  100% { opacity: 1; }
}

.leaderboard-content {
  padding: 0 20rpx 120rpx;
}

/* 前三名奖台 */
.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 15rpx;
  margin-bottom: 40rpx;
  padding: 0 20rpx;
}

.podium-item {
  flex: 1;
  text-align: center;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20rpx;
  padding: 30rpx 20rpx;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  position: relative;
}

.podium-item.first {
  order: 2;
  margin-bottom: -20rpx;
  z-index: 3;
  transform: scale(1.05);
}

.podium-item.second {
  order: 1;
  margin-bottom: -10rpx;
  z-index: 2;
}

.podium-item.third {
  order: 3;
  margin-bottom: -10rpx;
  z-index: 2;
}

.podium-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 15rpx;
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  position: relative;
}

.podium-item.first .podium-avatar {
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  width: 120rpx;
  height: 120rpx;
  font-size: 42rpx;
}

.podium-item.second .podium-avatar {
  background: linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%);
}

.podium-item.third .podium-avatar {
  background: linear-gradient(135deg, #cd7f32 0%, #e8b880 100%);
}

.champion {
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
}

.crown {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  font-size: 24rpx;
  animation: crownGlow 2s ease-in-out infinite;
}

@keyframes crownGlow {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.podium-medal {
  font-size: 48rpx;
  margin-bottom: 10rpx;
}

.podium-name {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 5rpx;
}

.podium-school {
  display: block;
  font-size: 22rpx;
  color: #666;
  margin-bottom: 10rpx;
}

.podium-stats {
  display: block;
  font-size: 20rpx;
  color: #999;
}

/* 排行榜列表 */
.rank-list {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 25rpx;
  margin: 0 20rpx;
  overflow: hidden;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 25rpx 30rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  position: relative;
}

.rank-item:active {
  background: rgba(102, 126, 234, 0.05);
}

.rank-item.current-user {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-left: 6rpx solid #667eea;
}

.rank-number {
  width: 70rpx;
  height: 70rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
  margin-right: 20rpx;
  background: #f8f9fa;
  color: #999;
  position: relative;
}

.rank-gold {
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  color: #fff;
  box-shadow: 0 8rpx 20rpx rgba(255, 215, 0, 0.3);
}

.rank-silver {
  background: linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%);
  color: #fff;
  box-shadow: 0 8rpx 20rpx rgba(192, 192, 192, 0.3);
}

.rank-bronze {
  background: linear-gradient(135deg, #cd7f32 0%, #e8b880 100%);
  color: #fff;
  box-shadow: 0 8rpx 20rpx rgba(205, 127, 50, 0.3);
}

.medal-icon {
  font-size: 32rpx;
}

.user-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
  position: relative;
}

.online-indicator {
  position: absolute;
  bottom: 5rpx;
  right: 5rpx;
  width: 16rpx;
  height: 16rpx;
  background: #4caf50;
  border: 2rpx solid #fff;
  border-radius: 50%;
}

.user-info {
  flex: 1;
}

.user-main {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.username {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.user-badges {
  display: flex;
  gap: 8rpx;
}

.badge {
  background: #667eea;
  color: #fff;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-size: 20rpx;
  font-weight: bold;
}

.badge.streak {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
}

.school {
  font-size: 24rpx;
  color: #666;
}

.user-stats {
  display: flex;
  flex-direction: column;
  gap: 5rpx;
  margin-right: 20rpx;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.stat-icon {
  font-size: 20rpx;
}

.stat-value {
  font-size: 22rpx;
  color: #666;
}

.trend-indicator {
  width: 50rpx;
  height: 50rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}

.trend-indicator.up {
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}

.trend-indicator.down {
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
}

.trend-indicator.same {
  background: rgba(158, 158, 158, 0.1);
  color: #9e9e9e;
}

/* 空状态 */
.empty-state {
  padding: 120rpx 40rpx;
  text-align: center;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
  display: block;
}

.empty-title {
  display: block;
  font-size: 32rpx;
  color: #333;
  margin-bottom: 15rpx;
  font-weight: bold;
}

.empty-desc {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 40rpx;
  line-height: 1.5;
}

.empty-action {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 25rpx;
  padding: 20rpx 40rpx;
  font-size: 28rpx;
  font-weight: bold;
}

/* 浮动提示 */
.floating-tips {
  position: fixed;
  bottom: 120rpx;
  left: 40rpx;
  right: 40rpx;
  z-index: 10;
}

.tip-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20rpx;
  padding: 25rpx;
  display: flex;
  align-items: flex-start;
  gap: 15rpx;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.15);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  animation: slideUpIn 0.5s ease-out;
}

@keyframes slideUpIn {
  from {
    opacity: 0;
    transform: translateY(50rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tip-icon {
  font-size: 36rpx;
  margin-top: 5rpx;
}

.tip-content {
  flex: 1;
}

.tip-title {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.tip-desc {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.4;
}

/* 刷新按钮 */
.refresh-fab {
  position: fixed;
  bottom: 40rpx;
  right: 40rpx;
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 15rpx 30rpx rgba(102, 126, 234, 0.4);
  z-index: 100;
  transition: all 0.3s ease;
}

.refresh-fab:active {
  transform: scale(0.95);
  box-shadow: 0 8rpx 20rpx rgba(102, 126, 234, 0.6);
}

.refresh-icon {
  font-size: 40rpx;
  color: #fff;
  transition: transform 0.3s ease;
}

.rotating {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>