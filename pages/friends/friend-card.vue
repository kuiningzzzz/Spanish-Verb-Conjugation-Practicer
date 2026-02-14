<template>
  <view class="container">
    <view v-if="loading" class="loading">加载中...</view>
    
    <view v-else-if="friend" class="friend-card">
      <!-- 头像和基本信息 -->
      <view class="profile-header">
        <view class="avatar-large">
          <image 
            v-if="friend.avatar"
            class="avatar-image" 
            :src="friend.avatar"
            mode="aspectFill"
          />
          <text v-else class="avatar-text">{{ getAvatarText(friend.username) }}</text>
        </view>
        <view class="profile-info">
          <view class="name-section">
            <text class="username">{{ displayName }}</text>
            <text v-if="friend.is_starred" class="star-badge">⭐</text>
          </view>
          <text class="friend-since">成为好友：{{ formatDate(friend.created_at) }}</text>
        </view>
      </view>

      <!-- 学习统计 -->
      <view class="stats-section card">
        <view class="stats-header">
          <text class="stats-title">学习数据</text>
        </view>
        <view class="stats-grid">
          <view class="stat-item">
            <text class="stat-value">{{ friend.stats.total_exercises }}</text>
            <text class="stat-label">总练习</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ friend.stats.correct_count }}</text>
            <text class="stat-label">答对题目</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ friend.stats.accuracy }}%</text>
            <text class="stat-label">正确率</text>
          </view>
        </view>
        <view class="stats-grid">
          <view class="stat-item">
            <text class="stat-value">{{ friend.stats.total_check_in_days }}</text>
            <text class="stat-label">累计打卡</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ friend.stats.streak_days }}</text>
            <text class="stat-label">连续打卡</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast, formatDate } from '@/utils/common.js'

export default {
  data() {
    return {
      friendId: null,
      friend: null,
      loading: false
    }
  },
  computed: {
    displayName() {
      if (!this.friend) return ''
      if (this.friend.remark) {
        return `${this.friend.remark}(${this.friend.username})`
      }
      return this.friend.username
    }
  },
  onLoad(options) {
    if (options.friendId) {
      this.friendId = parseInt(options.friendId)
      this.loadFriendDetails()
    }
  },
  methods: {
    async loadFriendDetails() {
      this.loading = true
      try {
        const res = await api.getFriendDetails(this.friendId)
        if (res.success) {
          this.friend = res.friend
        }
      } catch (error) {
        console.error('获取好友详情失败:', error)
        showToast('获取好友详情失败', 'none')
        setTimeout(() => {
          uni.navigateBack()
        }, 1500)
      } finally {
        this.loading = false
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      const year = date.getFullYear()
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    getAvatarText(username) {
      if (!username) return '?'
      return username.charAt(0).toUpperCase()
    }
  }
}
</script>

<style scoped>
.loading {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
}

.friend-card {
  padding-bottom: 40rpx;
}

.profile-header {
  background: #8B0012;
  padding: 60rpx 30rpx;
  display: flex;
  align-items: center;
  gap: 30rpx;
  margin-bottom: 20rpx;
  border-radius: 16rpx;
}

.avatar-large {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.5);
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  font-weight: bold;
  color: #8B0012;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
}

.avatar-text {
  font-size: 60rpx;
}

.profile-info {
  flex: 1;
  color: #fff;
}

.name-section {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 12rpx;
}

.username {
  font-size: 36rpx;
  font-weight: bold;
}

.star-badge {
  font-size: 32rpx;
}

.unique-id {
  display: block;
  font-size: 24rpx;
  opacity: 0.9;
  margin-bottom: 8rpx;
}

.friend-since {
  display: block;
  font-size: 22rpx;
  opacity: 0.8;
}

.stats-section {
  margin-bottom: 20rpx;
}

.stats-header {
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f5f5f5;
  margin-bottom: 20rpx;
}

.stats-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}

.stats-grid {
  display: flex;
  justify-content: space-around;
  margin-bottom: 30rpx;
}

.stats-grid:last-child {
  margin-bottom: 0;
}

.stat-item {
  text-align: center;
  flex: 1;
}

.stat-value {
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
</style>
