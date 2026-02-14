<template>
  <view class="container">
    <!-- 头部操作栏 -->
    <view class="header-actions">
      <button class="btn-add" @click="goToAddFriend">
        <text class="icon">➕</text>
        <text>添加好友</text>
      </button>
      <view class="request-badge" @click="goToRequests" v-if="requestCount > 0">
        <text class="icon">📬</text>
        <text>好友申请</text>
        <view class="badge">{{ requestCount }}</view>
      </view>
    </view>

    <!-- 好友列表 -->
    <view class="friends-section">
      <view class="section-header">
        <text class="section-title">我的好友 ({{ friends.length }})</text>
      </view>

      <view v-if="loading" class="loading">加载中...</view>
      
      <view v-else-if="friends.length === 0" class="empty-state">
        <text class="empty-icon">👥</text>
        <text class="empty-text">还没有好友</text>
        <text class="empty-hint">快去添加好友吧</text>
      </view>

      <view v-else class="friends-list">
        <view 
          v-for="friend in friends" 
          :key="friend.id"
          class="friend-item"
          @click="goToFriendCard(friend.id)"
        >
          <view class="avatar">
            <image 
              v-if="friend.avatar"
              class="avatar-image" 
              :src="friend.avatar"
              mode="aspectFill"
            />
            <text v-else class="avatar-text">{{ getAvatarText(friend.username) }}</text>
          </view>
          <view class="friend-info">
            <view class="name-row">
              <text class="friend-name">
                <text v-if="friend.is_starred" class="star-icon">⭐</text>
                <text v-if="friend.remark">{{ friend.remark }}({{ friend.username }})</text>
                <text v-else>{{ friend.username }}</text>
              </text>
            </view>
          </view>
          <view class="friend-actions" @click.stop="openFriendMenu(friend)">
            <text class="more-icon">⋮</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 好友菜单弹窗 -->
    <view v-if="showFriendMenuPopup" class="popup-mask" @click="closeFriendMenu">
      <view class="friend-menu" @click.stop>
        <view class="menu-item" @click="setRemark">
          <text class="menu-icon">✏️</text>
          <text>设置备注</text>
        </view>
        <view class="menu-item" @click="toggleStar">
          <text class="menu-icon">{{ selectedFriend && selectedFriend.is_starred ? '🌟' : '⭐' }}</text>
          <text>{{ selectedFriend && selectedFriend.is_starred ? '取消星标' : '加星标' }}</text>
        </view>
        <view class="menu-item danger" @click="confirmRemoveFriend">
          <text class="menu-icon">🗑️</text>
          <text>删除好友</text>
        </view>
        <view class="menu-item cancel" @click="closeFriendMenu">
          <text>取消</text>
        </view>
      </view>
    </view>

    <!-- 设置备注弹窗 -->
    <view v-if="showRemarkDialog" class="popup-mask" @click="closeRemarkDialog">
      <view class="popup-content" @click.stop>
        <view class="popup-header">
          <text class="popup-title">设置备注</text>
        </view>
        <view class="popup-body">
          <view class="user-preview">
            <image 
              class="preview-avatar" 
              :src="selectedFriend.avatar || '/static/picture/default-avatar.png'"
              mode="aspectFill"
            />
            <view class="preview-info">
              <text class="preview-name">{{ selectedFriend.username }}</text>
            </view>
          </view>
          <text class="input-label">备注名称</text>
          <input 
            class="remark-input"
            v-model="remarkInput"
            placeholder="请输入备注名"
            placeholder-style="color: #999"
            maxlength="20"
            cursor-spacing="50"
          />
        </view>
        <view class="popup-actions">
          <button class="btn-cancel" @click="closeRemarkDialog">取消</button>
          <button class="btn-confirm" @click="confirmSetRemark">确定</button>
        </view>
      </view>
    </view>

    <!-- 删除好友确认弹窗 -->
    <view v-if="showDeleteDialog" class="popup-mask" @click="closeDeleteDialog">
      <view class="popup-content" @click.stop>
        <view class="popup-header">
          <text class="popup-title">删除好友</text>
        </view>
        <view class="popup-body">
          <view class="user-preview">
            <image 
              class="preview-avatar" 
              :src="selectedFriend.avatar || '/static/picture/default-avatar.png'"
              mode="aspectFill"
            />
            <view class="preview-info">
              <text class="preview-name">{{ selectedFriend.username }}</text>
            </view>
          </view>
          <text class="warning-text">确定要删除该好友吗？删除后将无法查看对方的学习动态。</text>
        </view>
        <view class="popup-actions">
          <button class="btn-cancel" @click="closeDeleteDialog">取消</button>
          <button class="btn-confirm danger" @click="confirmDelete">删除</button>
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
      userInfo: {},
      friends: [],
      loading: false,
      requestCount: 0,
      selectedFriend: null,
      showFriendMenuPopup: false,
      showRemarkDialog: false,
      remarkInput: '',
      showDeleteDialog: false
    }
  },
  onLoad() {
    this.loadUserInfo()
    this.loadFriends()
    this.loadRequestCount()
  },
  onShow() {
    // 从其他页面返回时刷新数据
    this.loadUserInfo()
    this.loadFriends()
    this.loadRequestCount()
  },
  methods: {
    async loadUserInfo() {
      try {
        const res = await api.getUserInfo()
        if (res.success) {
          this.userInfo = res.user
        }
      } catch (error) {
        console.error('获取用户信息失败:', error)
      }
    },
    async loadFriends() {
      this.loading = true
      try {
        const res = await api.getFriendsList()
        if (res.success) {
          this.friends = res.friends
        }
      } catch (error) {
        console.error('获取好友列表失败:', error)
        showToast('获取好友列表失败', 'none')
      } finally {
        this.loading = false
      }
    },
    async loadRequestCount() {
      try {
        const res = await api.getFriendRequests()
        if (res.success) {
          this.requestCount = res.requests.length 
        }
      } catch (error) {
        console.error('获取好友申请失败:', error)
      }
    },
    goToAddFriend() {
      uni.navigateTo({
        url: '/pages/friends/add-friend'
      })
    },
    goToRequests() {
      uni.navigateTo({
        url: '/pages/friends/requests'
      })
    },
    goToFriendCard(friendId) {
      uni.navigateTo({
        url: `/pages/friends/friend-card?friendId=${friendId}`
      })
    },
    openFriendMenu(friend) {
      this.selectedFriend = friend
      this.showFriendMenuPopup = true
    },
    closeFriendMenu() {
      this.showFriendMenuPopup = false
    },
    setRemark() {
      this.remarkInput = this.selectedFriend.remark || ''
      this.showRemarkDialog = true
      this.closeFriendMenu()
    },
    closeRemarkDialog() {
      this.showRemarkDialog = false
      this.remarkInput = ''
    },
    async confirmSetRemark() {
      try {
        const result = await api.setFriendRemark(this.selectedFriend.id, this.remarkInput)
        if (result.success) {
          showToast('备注设置成功', 'success')
          this.loadFriends()
          this.closeRemarkDialog()
        }
      } catch (error) {
        console.error('设置备注失败:', error)
        showToast('设置备注失败', 'none')
      }
    },
    async toggleStar() {
      this.closeFriendMenu()
      const isStarred = !this.selectedFriend.is_starred
      try {
        const res = await api.setFriendStar(this.selectedFriend.id, isStarred)
        if (res.success) {
          showToast(res.message, 'success')
          this.loadFriends()
        }
      } catch (error) {
        console.error('设置星标失败:', error)
        showToast('设置星标失败', 'none')
      }
    },
    confirmRemoveFriend() {
      this.showDeleteDialog = true
      this.closeFriendMenu()
    },
    closeDeleteDialog() {
      this.showDeleteDialog = false
    },
    async confirmDelete() {
      try {
        const result = await api.removeFriend(this.selectedFriend.id)
        if (result.success) {
          showToast('已删除好友', 'success')
          this.loadFriends()
          this.closeDeleteDialog()
        }
      } catch (error) {
        console.error('删除好友失败:', error)
        showToast('删除好友失败', 'none')
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
.header-actions {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.btn-add {
  flex: 1;
  background: #8B0012;
  color: #fff;
  border: none;
  border-radius: 50rpx;
  padding: 24rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.request-badge {
  position: relative;
  background: #fff;
  border: 2rpx solid #8B0012;
  border-radius: 50rpx;
  padding: 24rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 28rpx;
  color: #8B0012;
}

.badge {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  background: #FF0000;
  color: #fff;
  border-radius: 50%;
  width: 36rpx;
  height: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
}

.friends-section {
  margin-top: 20rpx;
}

.section-header {
  padding: 20rpx 0;
}

.section-title {
  font-size: 28rpx;
  color: #666;
  font-weight: bold;
}

.loading {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
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

.friends-list {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.friend-item:last-child {
  border-bottom: none;
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

.friend-info {
  flex: 1;
}

.name-row {
  margin-bottom: 8rpx;
}

.friend-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.star-icon {
  margin-right: 8rpx;
}

.friend-actions {
  padding: 10rpx 20rpx;
}

.more-icon {
  font-size: 40rpx;
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
  padding: 40rpx 30rpx;
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

.btn-confirm:disabled {
  background: #ddd;
  color: #999;
}

/* 好友菜单 */
.friend-menu {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 16rpx 16rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 1001;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 30rpx;
  font-size: 32rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.menu-item.danger {
  color: #8B0012;
}

.menu-item.cancel {
  justify-content: center;
  color: #666;
  border-top: 10rpx solid #f5f5f5;
  border-bottom: none;
}

.menu-icon {
  font-size: 40rpx;
}

/* 用户预览卡片 */
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

.input-label {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-bottom: 15rpx;
}

.remark-input {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  border: 2rpx solid #e5e5e5;
  border-radius: 12rpx;
  font-size: 32rpx;
  color: #333;
  background-color: #fff;
  box-sizing: border-box;
}

.remark-input:focus {
  border-color: #8B0012;
}

.warning-text {
  display: block;
  padding: 30rpx 20rpx;
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
  text-align: center;
}

.btn-confirm.danger {
  background: #8B0012;
}

.btn-confirm.danger:active {
  background: #8B0012;
}
</style>
