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
      <text class="page-subtitle">还有这些同学在一起努力：</text>
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
            <image v-if="leaderboard[1].avatar" :src="leaderboard[1].avatar" class="avatar-image" mode="aspectFill"></image>
            <text v-else class="avatar-text">{{ getAvatarText(leaderboard[1].username) }}</text>
          </view>
          <view class="podium-medal">🥈</view>
          <text class="podium-name">{{ leaderboard[1].username }}</text>
          <text class="podium-school" v-if="leaderboard[1].school">{{ leaderboard[1].school }}</text>
          <text class="podium-stats">{{ leaderboard[1].check_in_days }}天 · {{ leaderboard[1].total_exercises }}题</text>
        </view>

        <view class="podium-item first">
          <view class="podium-avatar champion">
            <image v-if="leaderboard[0].avatar" :src="leaderboard[0].avatar" class="avatar-image" mode="aspectFill"></image>
            <text v-else class="avatar-text">{{ getAvatarText(leaderboard[0].username) }}</text>
            <view class="crown">👑</view>
          </view>
          <view class="podium-medal">🥇</view>
          <text class="podium-name">{{ leaderboard[0].username }}</text>
          <text class="podium-school" v-if="leaderboard[0].school">{{ leaderboard[0].school }}</text>
          <text class="podium-stats">{{ leaderboard[0].check_in_days }}天 · {{ leaderboard[0].total_exercises }}题</text>
        </view>

        <view class="podium-item third">
          <view class="podium-avatar">
            <image v-if="leaderboard[2].avatar" :src="leaderboard[2].avatar" class="avatar-image" mode="aspectFill"></image>
            <text v-else class="avatar-text">{{ getAvatarText(leaderboard[2].username) }}</text>
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
            <image v-if="user.avatar" :src="user.avatar" class="avatar-image" mode="aspectFill"></image>
            <text v-else class="avatar-text">{{ getAvatarText(user.username) }}</text>
          </view>

          <view class="user-info">
            <view class="user-main">
              <text class="username" :style="getUsernameStyle(user.username)">{{ user.username }}</text>
              <view class="user-badges">
                <view class="badge" v-if="user.isCurrentUser">我</view>
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
            isCurrentUser: user.id === this.currentUser?.id
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
    getUsernameStyle(username) {
      const length = username?.length || 0

      if (length <= 6) return { fontSize: '32rpx' }
      if (length <= 9) return { fontSize: '30rpx' }
      if (length <= 12) return { fontSize: '28rpx' }
      if (length <= 14) return { fontSize: '26rpx' }
      return { fontSize: '24rpx' }
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
  background: #8B0012;
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
  background: #8B0012;
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
  max-width: 720rpx;
  margin-left: auto;
  margin-right: auto;
}

.podium-item {
  flex: none;
  width: 190rpx;
  text-align: center;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20rpx;
  padding: 30rpx 20rpx;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  position: relative;
  min-height: 320rpx;
}

.podium-item.first {
  order: 2;
  margin-bottom: -20rpx;
  z-index: 3;
  width: 220rpx;
}

.podium-item.second {
  order: 1;
  margin-bottom: -10rpx;
  z-index: 2;
  width: 180rpx;
}

.podium-item.third {
  order: 3;
  margin-bottom: -10rpx;
  z-index: 2;
  width: 180rpx;
}

.podium-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #f6d365;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 15rpx;
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  position: relative;
  overflow: hidden;
}

.podium-item.first .podium-avatar {
  background: #ffd700;
  width: 120rpx;
  height: 120rpx;
  font-size: 42rpx;
}

.podium-item.second .podium-avatar {
  background: #c0c0c0;
}

.podium-item.third .podium-avatar {
  background: #cd7f32;
}

.champion {
  background: #ffd700;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
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
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 5rpx;
  max-width: 180rpx;
  margin-left: auto;
  margin-right: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.podium-item.first .podium-name {
  max-width: 200rpx;
  font-size: 32rpx;
}

.podium-item.second .podium-name,
.podium-item.third .podium-name {
  max-width: 170rpx;
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
  background: rgba(139, 0, 18, 0.1);
  border-left: 6rpx solid #8B0012;
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
  background: #ffd700;
  color: #fff;
  box-shadow: 0 8rpx 20rpx rgba(255, 215, 0, 0.3);
}

.rank-silver {
  background: #c0c0c0;
  color: #fff;
  box-shadow: 0 8rpx 20rpx rgba(192, 192, 192, 0.3);
}

.rank-bronze {
  background: #cd7f32;
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
  background: #8B0012;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
  overflow: hidden;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-main {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
  min-width: 0;
}

.username {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  max-width: 360rpx;
  white-space: nowrap;
  flex: 1;
}

.user-badges {
  display: flex;
  gap: 8rpx;
}

.badge {
  background: #8B0012;
  color: #fff;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-size: 20rpx;
  font-weight: bold;
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
  flex-shrink: 0;
  width: 170rpx;
  margin-left: auto;
  align-items: flex-end;
  text-align: right;
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
  background: #8B0012;
  color: #fff;
  border: none;
  border-radius: 25rpx;
  padding: 20rpx 40rpx;
  font-size: 28rpx;
  font-weight: bold;
}

/* 刷新按钮 */
.refresh-fab {
  position: fixed;
  bottom: 40rpx;
  right: 40rpx;
  width: 100rpx;
  height: 100rpx;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.2);
  border: 2rpx solid rgba(255, 255, 255, 0.3);
  z-index: 100;
  transition: all 0.3s ease;
}

.refresh-fab:active {
  transform: scale(0.95);
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.3);
}

.refresh-icon {
  font-size: 40rpx;
  color: #8B0012;
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