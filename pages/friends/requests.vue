<template>
  <view class="container">
    <view v-if="loading" class="loading">加载中...</view>
    
    <view v-else-if="requests.length === 0" class="empty-state">
      <text class="empty-icon">📭</text>
      <text class="empty-text">暂无好友申请</text>
    </view>

    <view v-else class="requests-list">
      <view 
        v-for="request in requests" 
        :key="request.id"
        class="request-item card"
      >
        <view class="avatar">
          <image 
            v-if="request.avatar"
            class="avatar-image" 
            :src="request.avatar"
            mode="aspectFill"
          />
          <text v-else class="avatar-text">{{ getAvatarText(request.username) }}</text>
        </view>
        <view class="request-info">
          <text class="username">{{ request.username }}</text>
          <text class="user-id" v-if="request.unique_id">ID: {{ request.unique_id }}</text>
          <text class="message" v-if="request.message">{{ request.message }}</text>
          <text class="time">{{ formatTime(request.created_at) }}</text>
        </view>
        <view class="request-actions">
          <button class="btn-accept" @click="handleRequest(request.id, true)">
            <text>✓</text>
          </button>
          <button class="btn-reject" @click="handleRequest(request.id, false)">
            <text>✕</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast } from '@/utils/common.js'

export default {
  data() {
    return {
      requests: [],
      loading: false
    }
  },
  onLoad() {
    this.loadRequests()
  },
  methods: {
    async loadRequests() {
      this.loading = true
      try {
        const res = await api.getFriendRequests()
        if (res.success) {
          this.requests = res.requests
        }
      } catch (error) {
        console.error('获取好友申请失败:', error)
        showToast('获取好友申请失败', 'none')
      } finally {
        this.loading = false
      }
    },
    async handleRequest(requestId, accept) {
      try {
        const res = await api.handleFriendRequest(requestId, accept)
        if (res.success) {
          showToast(res.message, 'success')
          this.loadRequests()
        }
      } catch (error) {
        console.error('处理好友申请失败:', error)
        showToast('处理失败', 'none')
      }
    },
    formatTime(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      const now = new Date()
      const diff = now - date
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)
      
      if (minutes < 60) {
        return `${minutes}分钟前`
      } else if (hours < 24) {
        return `${hours}小时前`
      } else if (days < 7) {
        return `${days}天前`
      } else {
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const day = date.getDate().toString().padStart(2, '0')
        return `${month}-${day}`
      }
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

.empty-state {
  text-align: center;
  padding: 150rpx 0;
}

.empty-icon {
  display: block;
  font-size: 120rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  display: block;
  font-size: 32rpx;
  color: #666;
}

.requests-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.request-item {
  display: flex;
  align-items: center;
  padding: 30rpx;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  margin-right: 24rpx;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: bold;
  color: #8B0012;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
}

.avatar-text {
  font-size: 40rpx;
}

.request-info {
  flex: 1;
}

.username {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.user-id {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 8rpx;
}

.message {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 8rpx;
  background: #f5f5f5;
  padding: 12rpx 20rpx;
  border-radius: 8rpx;
}

.time {
  display: block;
  font-size: 22rpx;
  color: #999;
}

.request-actions {
  display: flex;
  gap: 20rpx;
}

.btn-accept, .btn-reject {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  border: none;
  font-size: 32rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.btn-accept {
  background: #52c41a;
  color: #fff;
}

.btn-reject {
  background: #f5f5f5;
  color: #999;
}
</style>
