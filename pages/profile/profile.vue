<template>
  <view class="container">
    <view class="card profile-header">
      <view class="avatar">
        <text class="avatar-text">{{ avatarText }}</text>
      </view>
      <text class="username">{{ userInfo && userInfo.username }}</text>
      <text class="user-type">{{ userTypeText }}</text>
    </view>

    <view class="card user-info-card">
      <text class="subtitle">个人信息</text>
      <view class="info-list">
        <view class="info-item" v-if="userInfo && userInfo.email">
          <text class="info-label">邮箱</text>
          <text class="info-value">{{ userInfo.email }}</text>
        </view>
        <view class="info-item" v-if="userInfo && userInfo.school">
          <text class="info-label">学校</text>
          <text class="info-value">{{ userInfo.school }}</text>
        </view>
        <view class="info-item" v-if="userInfo && userInfo.enrollmentYear">
          <text class="info-label">入学年份</text>
          <text class="info-value">{{ userInfo.enrollmentYear }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">注册时间</text>
          <text class="info-value">{{ registerDate }}</text>
        </view>
      </view>
    </view>

    <view class="card subscription-card" v-if="userInfo && userInfo.userType === 'public'">
      <text class="subtitle">订阅信息</text>
      <view class="subscription-info">
        <text v-if="isSubscriptionValid" class="subscription-status valid">
          订阅有效期至：{{ subscriptionEndDate }}
        </text>
        <text v-else class="subscription-status invalid">
          订阅已过期，请续费
        </text>
        <button class="btn-primary mt-20" @click="renewSubscription">续费订阅 ¥38/年</button>
      </view>
    </view>

    <view class="card actions-card">
      <view class="action-item" @click="editProfile">
        <text class="action-label">编辑个人信息</text>
        <text class="action-arrow">›</text>
      </view>
      <view class="action-item" @click="aboutApp">
        <text class="action-label">关于应用</text>
        <text class="action-arrow">›</text>
      </view>
      <view class="action-item" @click="logout">
        <text class="action-label logout-text">退出登录</text>
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
      userInfo: null
    }
  },
  computed: {
    avatarText() {
      if (!this.userInfo || !this.userInfo.username) return ''
      return this.userInfo.username.charAt(0).toUpperCase()
    },
    userTypeText() {
      if (!this.userInfo || !this.userInfo.userType) return ''
      return this.userInfo.userType === 'student' ? '学生用户（免费）' : '社会用户'
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
    // 检查登录状态
    const token = uni.getStorageSync('token')
    if (!token) {
      // 未登录，跳转到登录页
      uni.reLaunch({
        url: '/pages/login/login'
      })
      return
    }
    this.loadUserInfo()
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
    editProfile() {
      uni.showModal({
        title: '提示',
        content: '编辑功能开发中...',
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
    aboutApp() {
      uni.showModal({
        title: '关于应用',
        content: '西班牙语动词变位练习APP v1.0.0\n\n帮助学生轻松掌握西班牙语动词变位',
        showCancel: false
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
.profile-header {
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 60rpx 30rpx;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.5);
}

.avatar-text {
  font-size: 48rpx;
  font-weight: bold;
}

.username {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  margin-bottom: 10rpx;
}

.user-type {
  display: block;
  font-size: 24rpx;
  opacity: 0.9;
}

.info-list {
  margin-top: 20rpx;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 25rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 28rpx;
  color: #999;
}

.info-value {
  font-size: 28rpx;
  color: #333;
}

.subscription-info {
  margin-top: 20rpx;
}

.subscription-status {
  display: block;
  text-align: center;
  font-size: 28rpx;
  padding: 20rpx;
  border-radius: 12rpx;
}

.subscription-status.valid {
  background: #f6ffed;
  color: #52c41a;
}

.subscription-status.invalid {
  background: #fff1f0;
  color: #ff4d4f;
}

.action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.action-item:last-child {
  border-bottom: none;
}

.action-label {
  font-size: 28rpx;
  color: #333;
}

.logout-text {
  color: #ff4d4f;
}

.action-arrow {
  font-size: 36rpx;
  color: #ccc;
}
</style>
