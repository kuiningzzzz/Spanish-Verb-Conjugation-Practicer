<template>
  <view class="settings-container">
    <view class="settings-card">
      <view class="card-header">
        <text class="card-title">人称设置</text>
        <text class="card-subtitle">影响练习题中是否包含特定人称</text>
      </view>

      <view class="setting-item">
        <view class="item-info">
          <text class="item-title">包含 vosotros</text>
          <text class="item-desc">西班牙地区常用的复数第二人称</text>
        </view>
        <switch :checked="pronounSettings.includeVosotros" @change="onVosotrosChange" color="#8B0012" />
      </view>

      <view class="setting-item">
        <view class="item-info">
          <text class="item-title">包含 vos</text>
          <text class="item-desc">拉美部分地区使用的第二人称</text>
        </view>
        <switch :checked="pronounSettings.includeVos" @change="onVosChange" color="#8B0012" />
      </view>
    </view>

    <view class="settings-card">
      <view class="card-header">
        <text class="card-title">输入法设置</text>
        <text class="card-subtitle">启用应用内西班牙语键盘</text>
      </view>

      <view class="setting-item">
        <view class="item-info">
          <text class="item-title">启用内置输入法</text>
          <text class="item-desc">开启后，查词和练习输入将不再弹出系统键盘</text>
        </view>
        <switch :checked="useInAppIME" @change="onUseInAppIMEChange" color="#8B0012" />
      </view>
    </view>

    <view class="settings-card">
      <view class="card-header">
        <text class="card-title">隐私设置</text>
        <text class="card-subtitle">控制你在排行榜中的可见性</text>
      </view>

      <view class="setting-item">
        <view class="item-info">
          <text class="item-title">参与排行榜</text>
          <text class="item-desc">关闭后，其他用户将无法在排行榜中看到你</text>
        </view>
        <switch :checked="participateInLeaderboard" @change="onLeaderboardChange" color="#8B0012" />
      </view>
    </view>

    <view class="tips-card">
      <text class="tips-title">说明</text>
      <text class="tips-text">这里的设置会全局生效，专项练习和其他功能会根据这里的选项生成题目。</text>
    </view>
  </view>
</template>

<script>
import { getPronounSettings, setPronounSettings } from '@/utils/settings.js'
import { getUseInAppIME, setUseInAppIME } from '@/utils/ime/settings-store.js'
import { showToast, showLoading, hideLoading } from '@/utils/common.js'
import api from '@/utils/api.js'

export default {
  data() {
    return {
      pronounSettings: getPronounSettings(),
      participateInLeaderboard: true,
      useInAppIME: getUseInAppIME()
    }
  },
  onShow() {
    this.pronounSettings = getPronounSettings()
    this.useInAppIME = getUseInAppIME()
    this.loadUserSettings()
  },
  methods: {
    async loadUserSettings() {
      try {
        const res = await api.getUserInfo()
        if (res.success) {
          // participate_in_leaderboard 为 1 表示参与，0 表示不参与
          this.participateInLeaderboard = res.user.participate_in_leaderboard === 1
        }
      } catch (error) {
        console.error('加载用户设置失败:', error)
      }
    },
    onVosotrosChange(event) {
      const updated = setPronounSettings({
        ...this.pronounSettings,
        includeVosotros: event.detail.value
      })
      this.pronounSettings = updated
      showToast(`已${updated.includeVosotros ? '开启' : '关闭'} vosotros`, 'success')
    },
    onVosChange(event) {
      const updated = setPronounSettings({
        ...this.pronounSettings,
        includeVos: event.detail.value
      })
      this.pronounSettings = updated
      showToast(`已${updated.includeVos ? '开启' : '关闭'} vos`, 'success')
    },
    async onLeaderboardChange(event) {
      const newValue = event.detail.value
      showLoading('保存中...')
      
      try {
        const res = await api.updateLeaderboardSetting({
          participateInLeaderboard: newValue
        })
        hideLoading()
        
        if (res.success) {
          this.participateInLeaderboard = newValue
          showToast(`已${newValue ? '参与' : '退出'}排行榜`, 'success')
        } else {
          showToast('设置失败，请重试', 'error')
          // 恢复原值
          this.participateInLeaderboard = !newValue
        }
      } catch (error) {
        hideLoading()
        console.error('更新排行榜设置失败:', error)
        showToast('设置失败，请重试', 'error')
        // 恢复原值
        this.participateInLeaderboard = !newValue
      }
    },
    onUseInAppIMEChange(event) {
      const newValue = event.detail.value
      this.useInAppIME = setUseInAppIME(newValue)
      showToast(`已${this.useInAppIME ? '开启' : '关闭'}内置输入法`, 'success')
    }
  }
}
</script>

<style scoped>
.settings-container {
  min-height: 100vh;
  padding: 30rpx 32rpx 60rpx;
  background: #f8f8f8;
}

.settings-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 12rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
}

.card-header {
  margin-bottom: 12rpx;
}

.card-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #2d2f33;
  margin-bottom: 6rpx;
}

.card-subtitle {
  display: block;
  font-size: 24rpx;
  color: #7786b7;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 0;
  border-bottom: 1rpx solid #f1f2f6;
}

.setting-item:last-child {
  border-bottom: none;
}

.item-info {
  flex: 1;
  margin-right: 20rpx;
}

.item-title {
  display: block;
  font-size: 30rpx;
  color: #1f2430;
  font-weight: 600;
  margin-bottom: 4rpx;
}

.item-desc {
  display: block;
  font-size: 24rpx;
  color: #8c93a5;
}

.tips-card {
  margin-top: 20rpx;
  background: #f7f8ff;
  border-radius: 18rpx;
  padding: 20rpx;
  color: #5f6b8a;
  border: 1rpx dashed #d9def7;
}

.tips-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #4a53a1;
  margin-bottom: 6rpx;
}

.tips-text {
  display: block;
  font-size: 24rpx;
  line-height: 1.6;
}
</style>
