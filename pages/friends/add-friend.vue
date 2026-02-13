<template>
  <view class="container">
    <!-- 搜索框 -->
    <view class="search-section">
      <view class="search-box">
        <input 
          class="search-input"
          v-model="keyword"
          placeholder="输入ID/用户名/邮箱搜索"
          @confirm="searchUsers"
        />
        <button class="search-btn" @click="searchUsers">搜索</button>
      </view>
      <text class="search-hint">支持通过唯一ID、用户名或邮箱进行搜索</text>
    </view>

    <!-- 搜索结果 -->
    <view v-if="searching" class="loading">搜索中...</view>
    
    <view v-else-if="searchResults.length > 0" class="results-section">
      <view class="section-header">
        <text class="section-title">搜索结果</text>
      </view>
      <view class="results-list">
        <view 
          v-for="user in searchResults" 
          :key="user.id"
          class="user-item card"
        >
          <view class="avatar">
            <image 
              v-if="user.avatar"
              class="avatar-image" 
              :src="user.avatar"
              mode="aspectFill"
            />
            <text v-else class="avatar-text">{{ getAvatarText(user.username) }}</text>
          </view>
          <view class="user-info">
            <text class="username">{{ user.username }}</text>
            <text class="user-id">ID: {{ user.unique_id || '未设置' }}</text>
          </view>
          <button class="btn-add-friend" @click="sendFriendRequest(user)">
            <text>添加</text>
          </button>
        </view>
      </view>
    </view>

    <view v-else-if="searched" class="empty-state">
      <text class="empty-icon">🔍</text>
      <text class="empty-text">未找到用户</text>
      <text class="empty-hint">请检查搜索关键词是否正确</text>
    </view>

    <!-- 添加好友弹窗 -->
    <view v-if="showAddDialog" class="popup-mask" @click="closeAddDialog">
      <view class="popup-content" @click.stop>
        <view class="popup-header">
          <text class="popup-title">添加好友</text>
        </view>
        <view class="popup-body">
          <view class="user-preview">
            <view class="preview-avatar">
              <image 
                v-if="selectedUser.avatar"
                class="avatar-image" 
                :src="selectedUser.avatar"
                mode="aspectFill"
              />
              <text v-else class="avatar-text">{{ getAvatarText(selectedUser.username) }}</text>
            </view>
            <view class="preview-info">
              <text class="preview-name">{{ selectedUser.username }}</text>
              <text class="preview-id">ID: {{ selectedUser.unique_id || '未设置' }}</text>
            </view>
          </view>
          <text class="input-label">附加消息（选填）</text>
          <textarea 
            class="message-input"
            v-model="friendMessage"
            placeholder="向对方介绍一下自己吧~"
            placeholder-style="color: #999"
            maxlength="100"
            :show-count="true"
          />
        </view>
        <view class="popup-actions">
          <button class="btn-cancel" @click="closeAddDialog">取消</button>
          <button class="btn-confirm" @click="confirmAddFriend">发送申请</button>
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
      keyword: '',
      searchResults: [],
      searching: false,
      searched: false,
      showAddDialog: false,
      selectedUser: {},
      friendMessage: ''
    }
  },
  methods: {
    async searchUsers() {
      const keyword = this.keyword.trim()
      
      if (!keyword) {
        showToast('请输入搜索关键词', 'none')
        return
      }
      
      this.searching = true
      this.searched = false
      
      try {
        const res = await api.searchUsers(keyword)
        if (res.success) {
          this.searchResults = res.users
          this.searched = true
        }
      } catch (error) {
        console.error('搜索用户失败:', error)
        showToast('搜索失败', 'none')
      } finally {
        this.searching = false
      }
    },
    sendFriendRequest(user) {
      this.selectedUser = user
      this.friendMessage = ''
      this.showAddDialog = true
    },
    closeAddDialog() {
      this.showAddDialog = false
      this.selectedUser = {}
      this.friendMessage = ''
    },
    async confirmAddFriend() {
      try {
        const result = await api.sendFriendRequest(this.selectedUser.id, this.friendMessage)
        if (result.success) {
          showToast('好友申请已发送', 'success')
          this.closeAddDialog()
        }
      } catch (error) {
        console.error('发送好友申请失败:', error)
        showToast(error.error || '发送失败', 'none')
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
.search-section {
  margin-bottom: 30rpx;
}

.search-box {
  display: flex;
  gap: 20rpx;
  margin-bottom: 15rpx;
}

.search-input {
  flex: 1;
  background: #fff;
  border-radius: 50rpx;
  padding: 24rpx 32rpx;
  font-size: 28rpx;
  border: 2rpx solid #e5e5e5;
}

.search-btn {
  background: #8B0012;
  color: #fff;
  border: none;
  border-radius: 50rpx;
  padding: 24rpx 48rpx;
  font-size: 28rpx;
}

.search-hint {
  display: block;
  font-size: 24rpx;
  color: #999;
  padding: 0 32rpx;
}

.loading {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
}

.results-section {
  margin-top: 30rpx;
}

.section-header {
  padding: 20rpx 0;
}

.section-title {
  font-size: 28rpx;
  color: #666;
  font-weight: bold;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.user-item {
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

.user-info {
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
}

.btn-add-friend {
  background: #8B0012;
  color: #fff;
  border: none;
  border-radius: 50rpx;
  padding: 16rpx 40rpx;
  font-size: 28rpx;
}

.empty-state {
  text-align: center;
  padding: 100rpx 0;
}

.empty-icon {
  display: block;
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  display: block;
  font-size: 32rpx;
  color: #666;
  margin-bottom: 10rpx;
}

.empty-hint {
  display: block;
  font-size: 24rpx;
  color: #999;
}

/* 弹窗样式 */
.popup-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.popup-content {
  width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
}

.popup-header {
  padding: 40rpx 30rpx 30rpx;
  text-align: center;
  background: linear-gradient(to bottom, #f8f8f8, #fff);
}

.popup-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.popup-body {
  padding: 30rpx;
}

.user-preview {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  margin-bottom: 30rpx;
}

.preview-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  margin-right: 20rpx;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: bold;
  color: #8B0012;
  overflow: hidden;
}

.avatar-text {
  font-size: 32rpx;
}

.avatar-image {
  width: 100%;
  height: 100%;
}

.preview-info {
  flex: 1;
}

.preview-name {
  display: block;
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 6rpx;
}

.preview-id {
  display: block;
  font-size: 24rpx;
  color: #999;
}

.input-label {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-bottom: 15rpx;
}

.message-input {
  width: 100%;
  min-height: 150rpx;
  padding: 20rpx;
  border: 2rpx solid #e5e5e5;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #333;
  background-color: #fff;
  box-sizing: border-box;
  line-height: 1.6;
}

.popup-actions {
  display: flex;
  padding: 30rpx;
  gap: 20rpx;
}

.btn-cancel, .btn-confirm {
  flex: 1;
  padding: 28rpx;
  border: none;
  font-size: 32rpx;
  border-radius: 12rpx;
  transition: all 0.3s;
}

.btn-cancel {
  background: #f5f5f5;
  color: #666;
}

.btn-cancel:active {
  background: #e8e8e8;
}

.btn-confirm {
  background: #8B0012;
  color: #fff;
  font-weight: bold;
}

.btn-confirm:active {
  background: #750010;
}
</style>
