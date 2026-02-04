<template>
  <view class="container">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-container">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 公告列表 -->
    <view v-else-if="announcements.length > 0" class="announcement-list">
      <view 
        v-for="announcement in announcements" 
        :key="announcement.id"
        class="announcement-item"
        :class="'priority-' + announcement.priority"
        @click="showDetail(announcement)"
      >
        <!-- 公告头部 -->
        <view class="announcement-header">
          <text class="announcement-time">【{{ getPriorityLabel(announcement.priority) }}】{{ formatTime(announcement.publishTime) }}</text>
        </view>

        <!-- 公告标题 -->
        <view class="announcement-title">
          <text class="priority-indicator" v-if="announcement.priority === 'high'">🔴</text>
          {{ announcement.title }}
        </view>

        <!-- 公告预览 -->
        <view class="announcement-preview">
          {{ getPreview(announcement.content) }}
        </view>

        <!-- 公告底部 -->
        <view class="announcement-footer">
          <text class="publisher">{{ announcement.publisher }}</text>
          <text class="read-more">查看详情 ›</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty-state">
      <text class="empty-icon">📭</text>
      <text class="empty-text">暂无公告</text>
    </view>

    <!-- 公告详情弹窗 -->
    <view v-if="showDetailModal" class="modal-overlay" @click="closeDetail">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-priority-label">【{{ getPriorityLabel(selectedAnnouncement.priority) }}】</text>
          <view class="close-btn" @click="closeDetail">✕</view>
        </view>

        <view class="modal-title">
          {{ selectedAnnouncement.title }}
        </view>

        <view class="modal-meta">
          <text class="meta-item">📅 {{ formatTime(selectedAnnouncement.publishTime) }}</text>
          <text class="meta-item">👤 {{ selectedAnnouncement.publisher }}</text>
        </view>

        <view class="modal-content-text">
          {{ selectedAnnouncement.content }}
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
      loading: false,
      announcements: [],
      showDetailModal: false,
      selectedAnnouncement: null
    }
  },
  onLoad() {
    this.loadAnnouncements()
  },
  methods: {
    async loadAnnouncements() {
      this.loading = true
      try {
        const res = await api.getAnnouncements()
        if (res.success) {
          this.announcements = res.data || []
        } else {
          showToast('获取公告失败', 'none')
        }
      } catch (error) {
        console.error('获取公告失败:', error)
        showToast('获取公告失败', 'none')
      } finally {
        this.loading = false
      }
    },
    getPriorityLabel(priority) {
      const labels = {
        high: '重要',
        medium: '普通',
        low: '提示'
      }
      return labels[priority] || '普通'
    },
    formatTime(timeString) {
      if (!timeString) return ''
      const date = new Date(timeString)
      const now = new Date()
      const diff = now - date
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      
      if (days === 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        if (hours === 0) {
          const minutes = Math.floor(diff / (1000 * 60))
          return minutes === 0 ? '刚刚' : `${minutes}分钟前`
        }
        return `${hours}小时前`
      } else if (days === 1) {
        return '昨天'
      } else if (days < 7) {
        return `${days}天前`
      } else {
        return date.toLocaleDateString('zh-CN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        })
      }
    },
    getPreview(content) {
      if (!content) return ''
      // 移除换行符，取前50个字符
      const text = content.replace(/\n/g, ' ')
      return text.length > 50 ? text.substring(0, 50) + '...' : text
    },
    showDetail(announcement) {
      this.selectedAnnouncement = announcement
      this.showDetailModal = true
    },
    closeDetail() {
      this.showDetailModal = false
      setTimeout(() => {
        this.selectedAnnouncement = null
      }, 300)
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

/* 加载状态 */
.loading-container {
  padding: 100rpx 0;
  text-align: center;
}

.loading-text {
  color: #999;
  font-size: 28rpx;
}

/* 公告列表 */
.announcement-list {
  padding: 30rpx;
}

.announcement-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  transition: all 0.3s;
}

.announcement-item:active {
  transform: scale(0.98);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
}

/* 高优先级公告边框 */
.priority-high {
  border-left: 6rpx solid #ff4d4f;
}

.priority-medium {
  border-left: 6rpx solid #ffa940;
}

.priority-low {
  border-left: 6rpx solid #52c41a;
}

/* 公告头部 */
.announcement-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.announcement-time {
  font-size: 22rpx;
  color: #999;
  font-weight: 500;
}

/* 公告标题 */
.announcement-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 15rpx;
  line-height: 1.5;
}

.priority-indicator {
  margin-right: 8rpx;
  font-size: 24rpx;
}

/* 公告预览 */
.announcement-preview {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
  margin-bottom: 20rpx;
}

/* 公告底部 */
.announcement-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.publisher {
  font-size: 24rpx;
  color: #999;
}

.read-more {
  font-size: 24rpx;
  color: #8B0012;
  font-weight: 500;
}

/* 空状态 */
.empty-state {
  padding: 150rpx 0;
  text-align: center;
}

.empty-icon {
  display: block;
  font-size: 120rpx;
  margin-bottom: 30rpx;
}

.empty-text {
  display: block;
  font-size: 28rpx;
  color: #999;
}

/* 详情弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 60rpx;
}

.modal-content {
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  max-height: 80vh;
  overflow-y: auto;
  width: 100%;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100rpx);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.modal-priority-label {
  font-size: 26rpx;
  color: #8B0012;
  font-weight: bold;
}

/* 类型徽章在弹窗中也使用相同样式 */

.close-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f5f5f5;
  font-size: 36rpx;
  color: #666;
  font-weight: bold;
  transition: all 0.3s;
}

.close-btn:active {
  background: #e8e8e8;
  transform: scale(0.95);
}

.modal-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  line-height: 1.5;
  margin-bottom: 20rpx;
}

.modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  margin-bottom: 30rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.meta-item {
  font-size: 24rpx;
  color: #999;
}

.modal-content-text {
  font-size: 28rpx;
  color: #666;
  line-height: 1.8;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
