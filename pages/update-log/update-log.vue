<template>
  <view class="container">
    <view class="card">
      <!-- 顶部当前版本信息 -->
      <view class="header">
        <view class="header-left">
          <text class="title">版本信息</text>
          <text class="version">当前版本：{{ currentVersionName }} ({{ currentVersionCode }})</text>
        </view>
        <view class="badge" :class="{ 'badge-latest': isLatest, 'badge-outdated': !isLatest }">
          {{ isLatest ? '已是最新' : '有新版本' }}
        </view>
      </view>

      <!-- 最新版本提示区域 -->
      <view class="latest-section" v-if="!isLatest && latestVersion">
        <view class="section-title">
          <text class="title-icon">🎉</text>
          <text>最新版本可用</text>
        </view>
        <view class="latest-info">
          <view class="version-header">
            <text class="version-name">{{ latestVersion.versionName }}</text>
            <text class="version-date">{{ latestVersion.releaseDate }}</text>
          </view>
          <view class="version-description" v-if="latestVersion.description">
            {{ latestVersion.description }}
          </view>
        </view>
        <button class="download-btn" @click="goToUpdate">
          <text class="btn-icon">⬇️</text>
          <text>立即更新</text>
        </button>
      </view>

      <!-- 更新日志列表 -->
      <view class="changelog">
        <view class="section-title">
          <text class="title-icon">📋</text>
          <text>更新日志</text>
        </view>

        <view v-if="loading" class="loading-container">
          <text class="loading-text">加载中...</text>
        </view>

        <view v-else-if="versions && versions.length" class="version-list">
          <view 
            class="version-card" 
            v-for="(version, index) in versions" 
            :key="version.versionCode"
            :class="{ 'is-current': version.versionCode === currentVersionCode }"
          >
            <!-- 版本头部 -->
            <view class="card-header">
              <view class="header-main">
                <text class="ver">{{ version.versionName }}</text>
                <text class="code">({{ version.versionCode }})</text>
                <view class="current-tag" v-if="version.versionCode === currentVersionCode">当前版本</view>
              </view>
              <text class="date">{{ version.releaseDate }}</text>
            </view>

            <!-- 版本描述 -->
            <view class="version-description" v-if="version.description">
              <text class="desc-icon">💡</text>
              <text class="desc-text">{{ version.description }}</text>
            </view>

            <!-- 版本详细信息 -->
            <view class="card-body">
              <!-- 新增功能 -->
              <view v-if="version.newFeatures && version.newFeatures.length" class="change-section">
                <view class="label new-feature">
                  <text class="label-icon">✨</text>
                  <text>新增功能</text>
                </view>
                <view class="points">
                  <view class="point-item" v-for="(feature, idx) in version.newFeatures" :key="'new-' + idx">
                    <text class="bullet">•</text>
                    <text class="point-text">{{ feature }}</text>
                  </view>
                </view>
              </view>

              <!-- 优化改进 -->
              <view v-if="version.improvements && version.improvements.length" class="change-section">
                <view class="label improvement">
                  <text class="label-icon">🚀</text>
                  <text>优化改进</text>
                </view>
                <view class="points">
                  <view class="point-item" v-for="(item, idx) in version.improvements" :key="'imp-' + idx">
                    <text class="bullet">•</text>
                    <text class="point-text">{{ item }}</text>
                  </view>
                </view>
              </view>

              <!-- Bug修复 -->
              <view v-if="version.bugFixes && version.bugFixes.length" class="change-section">
                <view class="label bug-fix">
                  <text class="label-icon">🐛</text>
                  <text>Bug修复</text>
                </view>
                <view class="points">
                  <view class="point-item" v-for="(fix, idx) in version.bugFixes" :key="'fix-' + idx">
                    <text class="bullet">•</text>
                    <text class="point-text">{{ fix }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view v-else class="empty-state">
          <text class="empty-icon">📦</text>
          <text class="empty-text">暂无版本记录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api.js'

export default {
  data() {
    return {
      currentVersionCode: 0,
      currentVersionName: '',
      isLatest: true,
      latestVersion: null,
      versions: [],
      loading: false
    }
  },
  onShow() {
    this.init()
  },
  methods: {
    async init() {
      // 获取当前版本信息
      const baseInfo = uni.getAppBaseInfo ? uni.getAppBaseInfo() : {}
      this.currentVersionCode = Number(baseInfo.appVersionCode || 0)
      this.currentVersionName = baseInfo.appVersion || baseInfo.appVersionName || '未知'

      // 加载所有版本信息
      await this.loadAllVersions()
      
      // 检查更新
      await this.checkUpdate()
    },

    async loadAllVersions() {
      this.loading = true
      try {
        const res = await api.getAllVersions()
        if (res && res.versions) {
          this.versions = res.versions
          console.log('所有版本信息:', this.versions)
        }
      } catch (err) {
        console.error('加载版本列表失败', err)
        uni.showToast({ 
          title: '加载版本列表失败', 
          icon: 'none',
          duration: 2000
        })
      } finally {
        this.loading = false
      }
    },

    async checkUpdate() {
      try {
        const res = await api.checkAppVersion(this.currentVersionCode)
        if (res && res.latestVersion) {
          this.isLatest = !!res.isLatest
          this.latestVersion = res.latestVersion
          console.log('版本检查结果:', { isLatest: this.isLatest, latestVersion: this.latestVersion })
        }
      } catch (err) {
        console.error('检查更新失败', err)
      }
    },

    goToUpdate() {
      // 清除跳过标记，允许重新进入更新页面
      uni.removeStorageSync('skippedUpdateVersion')
      
      // 确保设置了待更新信息
      if (this.latestVersion) {
        uni.setStorageSync('pendingUpdate', this.latestVersion)
      }
      
      // 跳转到更新页面
      uni.navigateTo({ 
        url: '/pages/update/update' 
      })
    }
  }
}
</script>

<style scoped>
.container { 
  min-height: 100vh; 
  background: #8B0012; 
  padding: 40rpx 30rpx;
  box-sizing: border-box;
}

.card { 
  background: #fff; 
  border-radius: 24rpx; 
  padding: 40rpx; 
  max-width: 750rpx; 
  margin: 0 auto;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.15);
  animation: slideUp 0.4s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 头部样式 */
.header { 
  display: flex; 
  justify-content: space-between; 
  align-items: flex-start;
  margin-bottom: 30rpx;
  padding-bottom: 30rpx;
  border-bottom: 2rpx solid #f0f0f5;
}

.header-left {
  flex: 1;
}

.title { 
  font-size: 40rpx; 
  color: #1a1a1a; 
  font-weight: 700;
  display: block;
  margin-bottom: 12rpx;
}

.version { 
  display: block;
  margin-top: 8rpx; 
  color: #8b8b9a;
  font-size: 26rpx;
}

.badge { 
  padding: 10rpx 20rpx; 
  border-radius: 999rpx; 
  color: #fff;
  font-size: 24rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
  white-space: nowrap;
  flex-shrink: 0;
}

.badge-latest { 
  background: #10b981;
}

.badge-outdated { 
  background: #f97316;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 4rpx 12rpx rgba(249, 115, 22, 0.3);
  }
  50% {
    box-shadow: 0 4rpx 20rpx rgba(249, 115, 22, 0.5);
  }
}

/* 最新版本提示区域 */
.latest-section {
  background: #fff5f5;
  border: 2rpx solid #fecaca;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 30rpx;
}

.latest-info {
  margin: 16rpx 0;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.version-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #dc2626;
}

.version-date {
  font-size: 24rpx;
  color: #9ca3af;
}

.version-description {
  color: #4b5563;
  font-size: 26rpx;
  line-height: 1.6;
  padding: 12rpx 16rpx;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12rpx;
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
}

.desc-icon {
  font-size: 28rpx;
  flex-shrink: 0;
}

.desc-text {
  flex: 1;
}

.download-btn {
  background: #dc2626;
  color: #fff;
  border: none;
  border-radius: 12rpx;
  padding: 18rpx 0;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin-top: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(220, 38, 38, 0.3);
  transition: all 0.3s ease;
}

.download-btn:active {
  transform: scale(0.98);
}

.btn-icon {
  font-size: 32rpx;
}

/* 更新日志 */
.changelog { 
  margin-top: 30rpx;
}

.section-title { 
  color: #333; 
  font-weight: 700; 
  font-size: 32rpx; 
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding-left: 8rpx;
}

.title-icon {
  font-size: 32rpx;
}

/* 加载状态 */
.loading-container {
  text-align: center;
  padding: 60rpx 0;
}

.loading-text {
  color: #9ca3af;
  font-size: 28rpx;
}

/* 版本列表 */
.version-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.version-card { 
  background: #fafbff;
  border-radius: 16rpx; 
  padding: 24rpx; 
  border: 2rpx solid #e8eaf0;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
}

.version-card.is-current {
  border-color: #8B0012;
  background: #fff;
  box-shadow: 0 4rpx 16rpx rgba(139, 0, 18, 0.15);
}

.card-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: flex-start; 
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 2rpx dashed #e5e7eb;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-wrap: wrap;
}

.ver { 
  font-weight: 700;
  font-size: 32rpx;
  color: #1a1a1a;
}

.code {
  font-size: 24rpx;
  color: #6b7280;
}

.current-tag {
  background: #8B0012;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  font-weight: 600;
}

.date {
  color: #9ca3af;
  font-size: 24rpx;
  white-space: nowrap;
}

/* 版本描述在卡片中 */
.version-card .version-description {
  margin-bottom: 16rpx;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.change-section {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.label { 
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-weight: 600;
  font-size: 26rpx;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  align-self: flex-start;
}

.label-icon {
  font-size: 28rpx;
}

.label.new-feature {
  color: #059669;
  background: rgba(16, 185, 129, 0.1);
}

.label.improvement {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
}

.label.bug-fix {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

.points { 
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding-left: 12rpx;
}

.point-item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  line-height: 1.6;
}

.bullet {
  color: #8B0012;
  font-weight: bold;
  font-size: 28rpx;
  flex-shrink: 0;
  margin-top: 2rpx;
}

.point-text {
  color: #4b5563;
  font-size: 26rpx;
  flex: 1;
}

/* 空状态 */
.empty-state { 
  text-align: center;
  padding: 80rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.empty-icon {
  font-size: 80rpx;
  opacity: 0.5;
}

.empty-text {
  color: #9ca3af;
  font-size: 28rpx;
}
</style>
