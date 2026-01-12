<template>
  <view class="container">
    <!-- 安全区域占位 -->
    <view class="safe-area-top"></view>
    
    <view class="card">
      <view class="header">
        <view>
          <text class="title">发现新版本 {{ updateInfo.versionName }}</text>
          <text class="version">版本号：{{ updateInfo.versionCode }}</text>
        </view>
        <view class="badge" :class="{ 'badge-force': updateInfo.forceUpdate }">
          {{ updateInfo.forceUpdate ? '必要更新' : '可选更新' }}
        </view>
      </view>

      <view class="section">
        <view class="section-title">更新内容</view>
        <view class="notes">{{ updateInfo.releaseNotes || '暂无更新说明' }}</view>
      </view>

      <view class="section stats">
        <view class="stat-item">
          <text class="stat-label">安装包大小</text>
          <text class="stat-value">{{ formatSize(updateInfo.packageSize) }}</text>
        </view>
        <view class="stat-item">
          <text class="stat-label">文件名</text>
          <text class="stat-value">{{ updateInfo.packageFileName || 'app-release.apk' }}</text>
        </view>
      </view>

      <view class="progress" v-if="downloading">
        <view class="progress-bar">
          <view class="progress-inner" :style="{ width: progress + '%' }"></view>
        </view>
        <view class="progress-info">
          <text>{{ progress.toFixed(0) }}%</text>
          <text>{{ formatSize(downloadedBytes) }} / {{ formatSize(totalBytes || updateInfo.packageSize) }}</text>
        </view>
      </view>

      <view class="actions">
        <button 
          class="primary" 
          type="primary" 
          :loading="downloading" 
          @click="startDownload" 
          :disabled="downloading || !updateInfo.packageUrl">
          {{ downloading ? '正在下载...' : '立即更新并安装' }}
        </button>
        
        <!-- 可选更新时显示跳过按钮 -->
        <button 
          v-if="!updateInfo.forceUpdate && !downloading" 
          class="secondary" 
          @click="skipUpdate">
          跳过更新，直接使用
        </button>
      </view>

      <view class="tips">
        <text v-if="updateInfo.forceUpdate">为确保正常使用，请先完成最新版本安装。</text>
        <text v-else>您可以选择稍后更新，应用将继续正常使用。</text>
      </view>
    </view>
  </view>
</template>

<script>
import api from '../../utils/api.js'

export default {
  data() {
    return {
      updateInfo: {
        versionCode: '',
        versionName: '',
        releaseNotes: '',
        packageSize: 0,
        packageUrl: '',
        packageFileName: '',
        forceUpdate: false
      },
      downloading: false,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      downloadTask: null
    }
  },
  onShow() {
    this.loadUpdateInfo()
  },
  onLoad() {
    // 延迟检查，等待数据加载完成
    setTimeout(() => {
      if (this.hasSkippedCurrentVersion()) {
        // 如果已跳过且不是强制更新，返回首页
        uni.switchTab({
          url: '/pages/index/index'
        })
      }
    }, 100)
  },
  methods: {
    async loadUpdateInfo() {
      const info = uni.getStorageSync('pendingUpdate')
      if (info && info.packageUrl) {
        this.updateInfo = info
        // 如果是强制更新，不允许返回
        if (this.updateInfo.forceUpdate) {
          this.disableBack()
        }
      } else {
        await this.fetchLatestVersion()
      }
    },
    async fetchLatestVersion() {
      try {
        const baseInfo = uni.getAppBaseInfo ? uni.getAppBaseInfo() : {}
        const currentVersionCode = Number(baseInfo.appVersionCode || 0)
        const res = await api.checkAppVersion(currentVersionCode)
        if (res.latestVersion) {
          this.updateInfo = res.latestVersion
          uni.setStorageSync('pendingUpdate', res.latestVersion)
          
          // 如果是强制更新，不允许返回
          if (this.updateInfo.forceUpdate) {
            this.disableBack()
          }
        }
      } catch (error) {
        console.error('检查更新失败:', error)
        uni.showToast({ title: '检查更新失败，请重试', icon: 'none' })
      }
    },
    disableBack() {
      // 禁用返回键（仅Android APP）
      // #ifdef APP-PLUS
      plus.key.addEventListener('backbutton', function(e) {
        // 不做任何操作，阻止返回
      }, false)
      // #endif
      
      // #ifdef MP-WEIXIN
      // 小程序中无需禁用返回，微信会自动处理
      // #endif
    },
    hasSkippedCurrentVersion() {
      const skippedVersion = uni.getStorageSync('skippedUpdateVersion')
      const pendingUpdate = uni.getStorageSync('pendingUpdate')
      
      if (!pendingUpdate) {
        return false
      }
      
      // 如果没有跳过记录，说明没有跳过
      if (!skippedVersion) {
        return false
      }
      
      // 如果当前版本号大于跳过的版本号，说明是新版本，需要再次提醒
      if (pendingUpdate.versionCode > skippedVersion) {
        return false
      }
      
      // 如果是强制更新，不能跳过
      if (pendingUpdate.forceUpdate) {
        return false
      }
      
      // 只有当前版本号等于跳过的版本号，且不是强制更新时，才算已跳过
      return skippedVersion === pendingUpdate.versionCode
    },

    skipUpdate() {
      // 记录跳过的版本号
      uni.setStorageSync('skippedUpdateVersion', this.updateInfo.versionCode)
      
      uni.showToast({
        title: '已跳过此次更新',
        icon: 'success',
        duration: 2000,
        success: () => {
          setTimeout(() => {
            // 返回首页或上一页
            uni.switchTab({
              url: '/pages/index/index'
            })
          }, 500)
        }
      })
    },
    formatSize(size) {
      if (!size) return '未知'
      const units = ['B', 'KB', 'MB', 'GB']
      let index = 0
      let currentSize = size
      while (currentSize >= 1024 && index < units.length - 1) {
        currentSize /= 1024
        index++
      }
      return `${currentSize.toFixed(1)} ${units[index]}`
    },
    startDownload() {
      // #ifdef MP-WEIXIN
      uni.showModal({
        title: '提示',
        content: '小程序版本由微信自动更新，无需手动下载安装。如需使用最新功能，请退出小程序后重新进入。',
        showCancel: false
      })
      return
      // #endif
      
      if (!this.updateInfo.packageUrl || this.downloading) return
      
      // 检查packageUrl是否完整
      let downloadUrl = this.updateInfo.packageUrl
      
      // 如果URL不包含协议，说明可能是相对路径，需要补全
      if (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {
        uni.showToast({ 
          title: '下载地址配置错误', 
          icon: 'none',
          duration: 3000
        })
        return
      }
      
      this.downloading = true
      this.progress = 0
      this.downloadedBytes = 0
      this.totalBytes = 0

      console.log('开始下载，URL:', downloadUrl)
      
      this.downloadTask = uni.downloadFile({
        url: downloadUrl,
        header: {
          'Accept': 'application/vnd.android.package-archive, application/octet-stream, */*'
        },
        timeout: 300000, // 5分钟超时
        success: (res) => {
          console.log('下载完成')
          console.log('响应状态码:', res.statusCode)
          console.log('临时文件路径:', res.tempFilePath)
          console.log('完整响应:', JSON.stringify(res))
          
          if (res.statusCode === 200) {
            // 验证文件是否存在
            // #ifdef APP-PLUS
            plus.io.resolveLocalFileSystemURL(res.tempFilePath, (entry) => {
              entry.file((file) => {
                console.log('文件大小:', file.size, 'bytes')
                if (file.size > 0) {
                  this.installPackage(res.tempFilePath)
                } else {
                  console.error('下载的文件大小为0')
                  uni.showToast({ 
                    title: '下载失败：文件为空', 
                    icon: 'none',
                    duration: 3000
                  })
                }
              })
            }, (error) => {
              console.error('文件验证失败:', error)
              this.installPackage(res.tempFilePath)
            })
            // #endif
            
            // #ifndef APP-PLUS
            this.installPackage(res.tempFilePath)
            // #endif
          } else {
            console.error('下载失败，HTTP状态码:', res.statusCode)
            uni.showToast({ 
              title: `下载失败(状态码${res.statusCode})`, 
              icon: 'none',
              duration: 3000
            })
          }
        },
        fail: (err) => {
          console.error('下载失败')
          console.error('错误信息:', err.errMsg)
          console.error('完整错误:', JSON.stringify(err))
          
          let errorMsg = '下载失败：'
          if (err.errMsg) {
            if (err.errMsg.includes('timeout')) {
              errorMsg += '连接超时，请检查网络'
            } else if (err.errMsg.includes('abort')) {
              errorMsg += '下载已取消'
            } else if (err.errMsg.includes('fail')) {
              errorMsg += err.errMsg.replace('downloadFile:fail', '')
            } else {
              errorMsg += err.errMsg
            }
          } else {
            errorMsg += '未知错误'
          }
          
          uni.showToast({ 
            title: errorMsg, 
            icon: 'none',
            duration: 3000
          })
        },
        complete: () => {
          console.log('下载任务完成（无论成功或失败）')
          this.downloading = false
          this.downloadTask = null
        }
      })


      if (this.downloadTask && this.downloadTask.onProgressUpdate) {
        this.downloadTask.onProgressUpdate((res) => {
          this.progress = res.progress
          this.downloadedBytes = res.totalBytesWritten
          this.totalBytes = res.totalBytesExpectedToWrite
          console.log(`下载进度: ${res.progress}%`)
        })
      }
    },
    installPackage(filePath) {
      // #ifdef APP-PLUS
      console.log('准备安装APK:', filePath)
      plus.runtime.install(
        filePath,
        { force: true },
        () => {
          console.log('安装成功')
          uni.showModal({
            title: '更新完成',
            content: '安装完成，应用将重启。',
            showCancel: false,
            success: () => {
              // 清除跳过记录和待更新信息
              uni.removeStorageSync('skippedUpdateVersion')
              uni.removeStorageSync('pendingUpdate')
              plus.runtime.restart()
            }
          })
        },
        (error) => {
          console.error('安装失败:', error)
          uni.showModal({
            title: '安装失败',
            content: `请手动安装。错误信息：${error.message || '未知错误'}`,
            showCancel: false
          })
        }
      )
      // #endif

      // #ifndef APP-PLUS
      uni.showToast({ title: '当前平台仅支持下载，请手动安装', icon: 'none' })
      // #endif
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea, #764ba2);
  padding: 50rpx 40rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* 顶部安全区域 */
.safe-area-top {
  display: none;
  /* 居中布局时不需要 */
}

.card {
  background-color: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 640rpx;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20rpx;
}

.title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #333;
  word-break: break-word;
}

.version {
  display: block;
  margin-top: 8rpx;
  color: #888;
  font-size: 26rpx;
}

.badge {
  background-color: #10b981;
  color: #fff;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  white-space: nowrap;
  flex-shrink: 0;
}

.badge-force {
  background-color: #f97316;
}

.section {
  margin-top: 28rpx;
}

.section-title {
  color: #555;
  font-weight: 600;
  font-size: 28rpx;
  margin-bottom: 12rpx;
}

.notes {
  background-color: #f7f7fb;
  padding: 20rpx;
  border-radius: 16rpx;
  color: #333;
  line-height: 1.8;
  white-space: pre-wrap;
  font-size: 26rpx;
}

.stats {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
}

.stat-item {
  flex: 1;
  background-color: #f8fafc;
  padding: 20rpx;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #888;
  font-size: 24rpx;
}

.stat-value {
  display: block;
  margin-top: 8rpx;
  color: #111;
  font-weight: 600;
  font-size: 24rpx;
  word-break: break-all;
}

.progress {
  margin-top: 24rpx;
}

.progress-bar {
  width: 100%;
  height: 16rpx;
  background-color: #f0f0f0;
  border-radius: 10rpx;
  overflow: hidden;
}

.progress-inner {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #5b8def);
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 12rpx;
  color: #666;
  font-size: 24rpx;
}

.actions {
  margin-top: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.primary {
  width: 100%;
  background: linear-gradient(90deg, #667eea, #5b8def);
  border: none;
  color: #fff;
  border-radius: 12rpx;
  box-shadow: 0 12rpx 24rpx rgba(102, 126, 234, 0.35);
  font-size: 30rpx;
  height: 88rpx;
  line-height: 88rpx;
  padding: 0;
  margin: 0;
}

.primary[disabled] {
  opacity: 0.6;
}

.primary::after {
  border: none;
}

.secondary {
  width: 100%;
  background-color: #fff;
  border: 2rpx solid #e5e7eb;
  color: #6b7280;
  border-radius: 12rpx;
  font-size: 30rpx;
  height: 88rpx;
  line-height: 88rpx;
  padding: 0;
  margin: 0;
}

.secondary::after {
  border: none;
}

.tips {
  margin-top: 20rpx;
  color: #999;
  font-size: 24rpx;
  text-align: center;
  line-height: 1.6;
  padding: 0 10rpx;
}
</style>
