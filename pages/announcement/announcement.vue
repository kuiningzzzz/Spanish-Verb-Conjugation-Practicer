<template>
  <view class="container">
    <view class="top-bar">
      <view class="sort-btn" @click="openSortPicker">排序</view>
    </view>
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-container">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 公告列表 -->
    <view v-else-if="announcements.length > 0" class="announcement-list">
      <view 
        v-for="announcement in pagedAnnouncements" 
        :key="announcement.id"
        class="announcement-item"
        :class="'priority-' + announcement.priority"
        @click="showDetail(announcement)"
      >
        <view v-if="announcement.isUnread" class="new-dot"></view>
        <!-- 公告头部 -->
        <view class="announcement-header">
          <text class="announcement-time">【{{ getPriorityLabel(announcement.priority) }}】{{ formatTime(announcement.publishTime) }}</text>
        </view>

        <!-- 公告标题 -->
        <view class="announcement-title">
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
    <view v-if="announcements.length > 0" class="pagination">
      <view class="page-btn" :class="{ disabled: currentPage <= 1 }" @click="goPrevPage">上一页</view>
      <text class="page-info">共 {{ currentPage }} / {{ totalPages }} 页</text>
      <view class="page-btn" :class="{ disabled: currentPage >= totalPages }" @click="goNextPage">下一页</view>
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
      readAnnouncementIds: [],
      pageSize: 10,
      currentPage: 1,
      sortMode: 'time',
      showDetailModal: false,
      selectedAnnouncement: null
    }
  },
  onLoad() {
    this.loadAnnouncements()
  },
  computed: {
    totalPages() {
      if (this.announcements.length === 0) return 0
      return Math.max(1, Math.ceil(this.announcements.length / this.pageSize))
    },
    pagedAnnouncements() {
      if (this.announcements.length === 0) return []
      const start = (this.currentPage - 1) * this.pageSize
      return this.announcements.slice(start, start + this.pageSize)
    }
  },
  methods: {
    async loadAnnouncements() {
      this.loading = true
      try {
        const res = await api.getAnnouncements()
        if (res.success) {
          const list = Array.isArray(res.data) ? res.data : []
          this.readAnnouncementIds = this.getReadAnnouncementIds(list)
          this.announcements = this.sortAnnouncements(list)
          this.currentPage = 1
          this.clampCurrentPage()
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
    openSortPicker() {
      uni.showActionSheet({
        itemList: ['按时间排序', '按重要程度排序'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.sortMode = 'time'
          } else if (res.tapIndex === 1) {
            this.sortMode = 'priority'
          }
          this.announcements = this.sortAnnouncements(this.announcements)
          this.currentPage = 1
          this.clampCurrentPage()
        }
      })
    },
    getReadAnnouncementIds(currentAnnouncements = []) {
      const stored = uni.getStorageSync('readAnnouncementIds') || []
      const currentIds = currentAnnouncements.map(a => a.id)
      const validReadIds = stored.filter(id => currentIds.includes(id))
      if (validReadIds.length !== stored.length) {
        uni.setStorageSync('readAnnouncementIds', validReadIds)
      }
      return validReadIds
    },
    sortAnnouncements(list) {
      const readIds = this.readAnnouncementIds
      const withFlags = list.map(item => ({
        ...item,
        isUnread: !readIds.includes(item.id)
      }))
      const priorityRank = (priority) => {
        const rank = { high: 3, medium: 2, low: 1 }
        return rank[priority] || 0
      }
      const sortByTimeDesc = (a, b) => {
        const timeA = new Date(a.publishTime).getTime() || 0
        const timeB = new Date(b.publishTime).getTime() || 0
        return timeB - timeA
      }
      const sortByPriorityDesc = (a, b) => {
        const diff = priorityRank(b.priority) - priorityRank(a.priority)
        if (diff !== 0) return diff
        return sortByTimeDesc(a, b)
      }
      const sorter = this.sortMode === 'priority' ? sortByPriorityDesc : sortByTimeDesc
      const unreadList = withFlags.filter(item => item.isUnread).sort(sorter)
      const readList = withFlags.filter(item => !item.isUnread).sort(sorter)
      return unreadList.concat(readList)
    },
    markAnnouncementAsRead(announcementId) {
      if (!announcementId) return
      if (!this.readAnnouncementIds.includes(announcementId)) {
        this.readAnnouncementIds = [...this.readAnnouncementIds, announcementId]
        uni.setStorageSync('readAnnouncementIds', this.readAnnouncementIds)
        this.announcements = this.sortAnnouncements(this.announcements)
        this.clampCurrentPage()
      }
    },
    clampCurrentPage() {
      if (this.totalPages === 0) {
        this.currentPage = 1
        return
      }
      if (this.currentPage < 1) this.currentPage = 1
      if (this.currentPage > this.totalPages) this.currentPage = this.totalPages
    },
    goPrevPage() {
      if (this.currentPage <= 1) return
      this.currentPage -= 1
    },
    goNextPage() {
      if (this.currentPage >= this.totalPages) return
      this.currentPage += 1
    },
    showDetail(announcement) {
      this.selectedAnnouncement = announcement
      this.showDetailModal = true
      this.markAnnouncementAsRead(announcement.id)
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

.top-bar {
  display: flex;
  justify-content: flex-end;
  padding: 20rpx 30rpx 0;
}

.sort-btn {
  font-size: 24rpx;
  color: #8B0012;
  background: #fff;
  border-radius: 999rpx;
  padding: 10rpx 22rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.06);
}

.sort-btn:active {
  opacity: 0.8;
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
  position: relative;
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

.new-dot {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
  width: 14rpx;
  height: 14rpx;
  background: #FF0000;
  border-radius: 50%;
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

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  padding: 10rpx 30rpx 30rpx;
}

.page-btn {
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  background: #fff;
  color: #8B0012;
  font-size: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.06);
}

.page-btn.disabled {
  opacity: 0.4;
}

.page-info {
  font-size: 24rpx;
  color: #666;
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
