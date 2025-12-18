<template>
  <view class="container">
    <!-- 用户资料卡片 -->
    <view class="profile-card">
      <view class="profile-background">
        <view class="gradient-overlay"></view>
      </view>
      <view class="profile-content">
        <view class="user-avatar-section">
          <view class="avatar-container">
            <view class="avatar-wrapper" @click="chooseAvatar">
              <image v-if="userInfo && userInfo.avatar" :src="userInfo.avatar" class="avatar-image" mode="aspectFill" />
              <text v-else class="avatar-text">{{ avatarText }}</text>
              <view class="avatar-badge" v-if="userInfo && userInfo.isVIP">VIP</view>
            </view>
            <view class="camera-icon" @click="chooseAvatar">📷</view>
          </view>
          <view class="user-info">
            <text class="username">{{ userInfo && userInfo.username }}</text>
            <view class="user-tags">
              <view class="user-tag" :class="userTypeClass">
                <text class="tag-icon">{{ userTypeIcon }}</text>
                <text class="tag-text">{{ userTypeText }}</text>
              </view>
              <view class="user-tag streak" v-if="streakDays > 0">
                <text class="tag-icon">🔥</text>
                <text class="tag-text">连续 {{ streakDays }} 天</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 学习成就 -->
    <view class="achievement-section">
      <view class="achievement-grid">
        <view class="achievement-item">
          <view class="achievement-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <text>📚</text>
          </view>
          <text class="achievement-value">{{ studyDays }}</text>
          <text class="achievement-label">学习天数</text>
        </view>
        <view class="achievement-item">
          <view class="achievement-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
            <text>✅</text>
          </view>
          <text class="achievement-value">{{ totalExercises }}</text>
          <text class="achievement-label">练习题目</text>
        </view>
        <view class="achievement-item">
          <view class="achievement-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
            <text>🎯</text>
          </view>
          <text class="achievement-value">{{ masteredCount }}</text>
          <text class="achievement-label">掌握动词</text>
        </view>
        <view class="achievement-item">
          <view class="achievement-icon" style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);">
            <text>🏆</text>
          </view>
          <text class="achievement-value">{{ rank }}</text>
          <text class="achievement-label">当前排名</text>
        </view>
      </view>
    </view>

    <!-- 个人信息 -->
    <view class="info-section">
      <view class="info-card">
        <view class="card-header">
          <text class="card-title">个人信息</text>
          <text class="edit-button" @click="showEditProfile">编辑</text>
        </view>
        <view class="info-list">
          <view class="info-item" v-if="userInfo && userInfo.email">
            <view class="info-icon">📧</view>
            <view class="info-content">
              <text class="info-label">邮箱</text>
              <text class="info-value">{{ userInfo.email }}</text>
            </view>
          </view>
          <view class="info-item" v-if="userInfo && userInfo.school">
            <view class="info-icon">🏫</view>
            <view class="info-content">
              <text class="info-label">学校</text>
              <text class="info-value">{{ userInfo.school }}</text>
            </view>
          </view>
          <view class="info-item" v-if="userInfo && userInfo.enrollmentYear">
            <view class="info-icon">🎓</view>
            <view class="info-content">
              <text class="info-label">入学年份</text>
              <text class="info-value">{{ userInfo.enrollmentYear }}</text>
            </view>
          </view>
          <view class="info-item">
            <view class="info-icon">📅</view>
            <view class="info-content">
              <text class="info-label">注册时间</text>
              <text class="info-value">{{ registerDate }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 订阅信息 -->
    <view class="subscription-section" v-if="userInfo && userInfo.userType === 'public'">
      <view class="subscription-card">
        <view class="card-header">
          <text class="card-title">订阅信息</text>
          <view class="subscription-status" :class="isSubscriptionValid ? 'valid' : 'invalid'">
            {{ isSubscriptionValid ? '有效' : '已过期' }}
          </view>
        </view>
        <view class="subscription-content">
          <view class="subscription-info">
            <text class="subscription-text" v-if="isSubscriptionValid">
              订阅有效期至：{{ subscriptionEndDate }}
            </text>
            <text class="subscription-text" v-else>
              订阅已过期，请续费以继续使用全部功能
            </text>
          </view>
          <button class="renew-button" @click="renewSubscription">
            <text class="button-icon">💎</text>
            <text class="button-text">续费订阅 ¥38/年</text>
          </button>
        </view>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-section">
      <view class="menu-card">
        <view class="menu-item" @click="settings">
          <view class="menu-icon">⚙️</view>
          <text class="menu-label">设置</text>
          <text class="menu-arrow">→</text>
        </view>
        <view class="menu-item" @click="aboutApp">
          <view class="menu-icon">ℹ️</view>
          <text class="menu-label">关于应用</text>
          <text class="menu-arrow">→</text>
        </view>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section">
      <button class="logout-button" @click="logout">
        <text class="logout-icon">🚪</text>
        <text class="logout-text">退出登录</text>
      </button>
    </view>

    <!-- 浮动操作按钮 -->
    <view class="fab-container">
      <view class="fab-button" @click="startPractice">
        <text class="fab-icon">📝</text>
      </view>
    </view>
    
    <!-- 隐藏的 Canvas 用于图片转换 -->
    <canvas canvas-id="avatarCanvas" style="position: fixed; left: -9999px; width: 200px; height: 200px;"></canvas>
    
    <!-- 编辑个人信息弹窗 -->
    <view class="modal" v-if="showEditModal" @click="closeEditModal">
      <view class="modal-content edit-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">编辑个人信息</text>
          <text class="modal-close" @click="closeEditModal">×</text>
        </view>
        
        <view class="modal-body">
          <view class="form-item">
            <text class="form-label">用户名</text>
            <input
              class="form-input"
              v-model="editForm.username"
              placeholder="请输入6-15位字母或数字"
              maxlength="15"
              @blur="ensureUsernameAvailability"
            />
            <text v-if="editErrors.username" class="form-error">{{ editErrors.username }}</text>
          </view>

          <view class="form-item">
            <text class="form-label">新密码</text>
            <input
              class="form-input"
              type="password"
              v-model="editForm.password"
              placeholder="留空则不修改"
              maxlength="20"
              @blur="validateEditPassword"
            />
            <text v-if="editErrors.password" class="form-error">{{ editErrors.password }}</text>
          </view>

          <view class="form-item">
            <text class="form-label">确认新密码</text>
            <input
              class="form-input"
              type="password"
              v-model="editForm.confirmPassword"
              placeholder="请再次输入新密码"
              maxlength="20"
              @blur="validateConfirmPassword"
            />
            <text v-if="editErrors.confirmPassword" class="form-error">{{ editErrors.confirmPassword }}</text>
          </view>

          <view class="form-item">
            <text class="form-label">学校</text>
            <input
              class="form-input" 
              v-model="editForm.school" 
              placeholder="请输入学校名称"
              maxlength="50"
            />
          </view>
          
          <view class="form-item">
            <text class="form-label">入学年份</text>
            <picker 
              mode="date" 
              :value="editForm.enrollmentYear" 
              fields="year"
              :start="startYear"
              :end="currentYear"
              @change="onYearChange"
            >
              <view class="picker-input">
                <text v-if="editForm.enrollmentYear">{{ editForm.enrollmentYear }}</text>
                <text v-else class="placeholder">请选择入学年份</text>
              </view>
            </picker>
          </view>

          <view class="form-note">
            <text class="note-icon">ℹ️</text>
            <text class="note-text">邮箱和注册时间不可修改</text>
          </view>
        </view>
        
        <view class="modal-footer">
          <button class="modal-btn cancel-btn" @click="closeEditModal">取消</button>
          <button class="modal-btn confirm-btn" @click="saveProfile">保存</button>
        </view>
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
      userInfo: null,
      streakDays: 0,
      studyDays: 0,
      totalExercises: 0,
      masteredCount: 0,
      rank: 0,
      showEditModal: false,
      editForm: {
        username: '',
        password: '',
        confirmPassword: '',
        school: '',
        enrollmentYear: ''
      },
      editErrors: {
        username: '',
        password: '',
        confirmPassword: ''
      }
    }
  },
  computed: {
    avatarText() {
      if (!this.userInfo || !this.userInfo.username) return '?'
      return this.userInfo.username.charAt(0).toUpperCase()
    },
    userTypeText() {
      if (!this.userInfo || !this.userInfo.userType) return ''
      return this.userInfo.userType === 'student' ? '学生用户' : '社会用户'
    },
    userTypeIcon() {
      return this.userInfo && this.userInfo.userType === 'student' ? '🎓' : '💼'
    },
    userTypeClass() {
      return this.userInfo && this.userInfo.userType === 'student' ? 'student' : 'public'
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
    },
    currentYear() {
      return new Date().getFullYear().toString()
    },
    startYear() {
      return '1990'
    }
  },
  onShow() {
    const token = uni.getStorageSync('token')
    if (!token) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.loadUserInfo()
    this.loadUserStats()
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
    async loadUserStats() {
      try {
        // 获取统计数据
        const statsRes = await api.getStatistics()
        if (statsRes.success) {
          const stats = statsRes.statistics.total || {}
          this.totalExercises = stats.total_exercises || 0
          this.masteredCount = stats.masteredVerbsCount || 0
        }

        // 获取打卡信息（包括连续天数和总学习天数）
        const checkInRes = await api.getCheckInHistory()
        if (checkInRes.success) {
          this.streakDays = checkInRes.streakDays || 0
          this.studyDays = checkInRes.totalStudyDays || 0
        }

        // 获取用户排名
        const rankRes = await api.getUserRank()
        if (rankRes.success) {
          this.rank = rankRes.rank || 0
        }
      } catch (error) {
        console.error('加载用户统计失败:', error)
      }
    },
    async chooseAvatar() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePath = res.tempFilePaths[0]
          
          // 使用 Canvas 转换为 Base64（跨平台方案）
          this.imageToBase64(tempFilePath)
        }
      })
    },
    
    imageToBase64(imagePath) {
      // 获取图片信息
      uni.getImageInfo({
        src: imagePath,
        success: (imageInfo) => {
          // 创建 Canvas 上下文
          const canvas = uni.createCanvasContext('avatarCanvas', this)
          
          // 计算压缩后的尺寸（最大150x150，更小的尺寸以减少文件大小）
          let width = imageInfo.width
          let height = imageInfo.height
          const maxSize = 150
          
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize
              width = maxSize
            } else {
              width = (width / height) * maxSize
              height = maxSize
            }
          }
          
          // 绘制图片
          canvas.drawImage(imagePath, 0, 0, width, height)
          canvas.draw(false, () => {
            // 导出为 Base64，使用更低的质量以减小文件大小
            uni.canvasToTempFilePath({
              canvasId: 'avatarCanvas',
              width: width,
              height: height,
              destWidth: width,
              destHeight: height,
              fileType: 'jpg',
              quality: 0.6, // 降低质量从0.8到0.6，显著减小文件大小
              success: (canvasRes) => {
                // 将临时文件转换为 Base64
                this.uploadBase64Avatar(canvasRes.tempFilePath)
              },
              fail: (error) => {
                console.error('Canvas 导出失败:', error)
                uni.showToast({
                  title: '图片处理失败',
                  icon: 'none'
                })
              }
            }, this)
          })
        },
        fail: (error) => {
          console.error('获取图片信息失败:', error)
          uni.showToast({
            title: '图片读取失败',
            icon: 'none'
          })
        }
      })
    },
    
    uploadBase64Avatar(tempFilePath) {
      // #ifdef H5
      // H5 环境下直接使用 FileReader
      fetch(tempFilePath)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader()
          reader.onload = async (e) => {
            const base64 = e.target.result
            await this.sendAvatarToServer(base64)
          }
          reader.readAsDataURL(blob)
        })
      // #endif
      
      // #ifndef H5
      // 非 H5 环境使用 plus.io (APP) 或其他方式
      // #ifdef APP-PLUS
      plus.io.resolveLocalFileSystemURL(tempFilePath, (entry) => {
        entry.file((file) => {
          const reader = new plus.io.FileReader()
          reader.onloadend = async (e) => {
            const base64 = e.target.result
            await this.sendAvatarToServer(base64)
          }
          reader.readAsDataURL(file)
        })
      }, (error) => {
        console.error('读取文件失败:', error)
        uni.showToast({
          title: '读取图片失败',
          icon: 'none'
        })
      })
      // #endif
      
      // #ifdef MP
      // 小程序环境
      uni.getFileSystemManager().readFile({
        filePath: tempFilePath,
        encoding: 'base64',
        success: async (fileRes) => {
          const base64 = 'data:image/jpeg;base64,' + fileRes.data
          await this.sendAvatarToServer(base64)
        },
        fail: (error) => {
          console.error('读取文件失败:', error)
          uni.showToast({
            title: '读取图片失败',
            icon: 'none'
          })
        }
      })
      // #endif
      // #endif
    },
    
    async sendAvatarToServer(base64) {
      // 检查大小，如果还是太大，进一步压缩
      let finalBase64 = base64
      
      if (base64.length > 150000) {
        console.log('图片仍然较大，尝试进一步压缩...')
        // 提取base64数据（去掉data:image/jpeg;base64,前缀）
        const base64Data = base64.split(',')[1]
        const prefix = base64.split(',')[0] + ','
        
        // 降低质量进一步压缩（这里简单地检查，实际压缩在Canvas阶段已完成）
        if (base64.length > 200000) {
          uni.showToast({
            title: '图片过大，请选择更小的图片',
            icon: 'none',
            duration: 2000
          })
          return
        }
      }
      
      console.log('最终Base64大小:', finalBase64.length, '字符')
      
      uni.showLoading({ title: '上传中...' })
      
      try {
        const res = await api.uploadAvatar({ avatar: finalBase64 })
        uni.hideLoading()
        
        if (res.success) {
          this.userInfo.avatar = finalBase64
          uni.setStorageSync('userInfo', this.userInfo)
          
          uni.showToast({
            title: '头像更新成功',
            icon: 'success'
          })
        }
      } catch (error) {
        uni.hideLoading()
        console.error('上传头像失败:', error)
        uni.showToast({
          title: '上传失败',
          icon: 'none'
        })
      }
    },

    showEditProfile() {
      // 初始化编辑表单
      this.editForm = {
        username: this.userInfo.username || '',
        password: '',
        confirmPassword: '',
        school: this.userInfo.school || '',
        enrollmentYear: this.userInfo.enrollmentYear || ''
      }
      this.editErrors = {
        username: '',
        password: '',
        confirmPassword: ''
      }
      this.showEditModal = true
    },
    
    closeEditModal() {
      this.showEditModal = false
    },
    
    onYearChange(e) {
      this.editForm.enrollmentYear = e.detail.value
    },

    async saveProfile() {
      // 验证
      const usernameValid = this.validateEditUsername()
      const passwordValid = this.validateEditPassword()
      const confirmValid = this.validateConfirmPassword()

      if (!usernameValid || !passwordValid || !confirmValid) {
        uni.showToast({
          title: '请修正标红提示后再保存',
          icon: 'none'
        })
        return
      }

      const usernameAvailable = await this.ensureUsernameAvailability()
      if (!usernameAvailable) {
        uni.showToast({
          title: '用户名不可用，请修改',
          icon: 'none'
        })
        return
      }

      uni.showLoading({ title: '保存中...' })

      try {
        const trimmedUsername = this.editForm.username.trim()
        const trimmedSchool = this.editForm.school && typeof this.editForm.school === 'string' 
          ? this.editForm.school.trim() 
          : ''
        const enrollmentYearValue = this.editForm.enrollmentYear
          ? parseInt(this.editForm.enrollmentYear)
          : undefined
        const res = await api.updateProfile({
          username: trimmedUsername,
          password: this.editForm.password ? this.editForm.password : undefined,
          email: this.userInfo.email,
          school: trimmedSchool,
          enrollmentYear: enrollmentYearValue
        })

        uni.hideLoading()

        if (res.success) {
          // 更新本地用户信息
          this.userInfo.username = trimmedUsername
          this.userInfo.school = trimmedSchool
          if (enrollmentYearValue !== undefined) {
            this.userInfo.enrollmentYear = enrollmentYearValue
          }
          uni.setStorageSync('userInfo', this.userInfo)

          this.showEditModal = false

          // 清理密码字段
          this.editForm.password = ''
          this.editForm.confirmPassword = ''

          uni.showToast({
            title: '保存成功',
            icon: 'success'
          })
        } else {
          if (res.error && res.error.includes('用户名')) {
            this.editErrors.username = res.error
          }
          uni.showToast({
            title: res.error || '保存失败',
            icon: 'none'
          })
        }
      } catch (error) {
        uni.hideLoading()
        console.error('保存个人信息失败:', error)
        uni.showToast({
          title: '保存失败',
          icon: 'none'
        })
      }
    },

    isUsernameValid(value = this.editForm.username) {
      if (!value || typeof value !== 'string') return false
      const usernamePattern = /^[A-Za-z0-9]{6,15}$/
      const trimmed = value.trim()
      return Boolean(trimmed && usernamePattern.test(trimmed))
    },
    validateEditUsername(value = this.editForm.username) {
      if (!value || typeof value !== 'string' || !value.trim()) {
        this.editErrors.username = '请输入用户名'
        return false
      }

      if (!this.isUsernameValid(value)) {
        this.editErrors.username = '用户名需为6-15位字母或数字组合'
        return false
      }

      this.editErrors.username = ''
      return true
    },
    isPasswordValid(value = this.editForm.password) {
      if (!value || typeof value !== 'string') return false
      const passwordPattern = /^[A-Za-z0-9!@#$%^&*()_+\-.]{8,20}$/
      const trimmed = value.trim()
      const hasLetter = /[A-Za-z]/.test(trimmed)
      const hasNumber = /\d/.test(trimmed)
      const hasSymbol = /[!@#$%^&*()_+\-.]/.test(trimmed)
      const categoryCount = [hasLetter, hasNumber, hasSymbol].filter(Boolean).length
      return Boolean(trimmed && passwordPattern.test(trimmed) && categoryCount >= 2)
    },
    validateEditPassword(value = this.editForm.password) {
      if (!value) {
        this.editErrors.password = ''
        return true
      }

      if (!this.isPasswordValid(value)) {
        this.editErrors.password = '密码需为8-20位，包含字母、数字、特殊符号中的至少两种'
        return false
      }

      this.editErrors.password = ''
      return true
    },
    validateConfirmPassword() {
      if (this.editForm.password && this.editForm.password !== this.editForm.confirmPassword) {
        this.editErrors.confirmPassword = '两次输入的密码不一致'
        return false
      }

      this.editErrors.confirmPassword = ''
      return true
    },
    async ensureUsernameAvailability() {
      if (!this.validateEditUsername()) return false

      if (!this.editForm.username || typeof this.editForm.username !== 'string') return false
      
      const trimmed = this.editForm.username.trim()
      if (trimmed === this.userInfo.username) {
        this.editErrors.username = ''
        return true
      }

      try {
        const res = await api.checkUsername({ username: trimmed })
        if (res.success && (res.available === undefined || res.available === true || res.isAvailable === true)) {
          this.editErrors.username = ''
          return true
        }

        const unavailable = res.available === false || res.isAvailable === false
        this.editErrors.username = unavailable ? '用户名已存在，请更换' : (res.error || '用户名不可用')
        return false
      } catch (error) {
        console.error('用户名查重失败:', error)
        this.editErrors.username = error.error || '无法校验用户名，请稍后再试'
        return false
      }
    },

    renewSubscription() {
      uni.showModal({
        title: '续费订阅',
        content: '支付功能开发中，敬请期待',
        showCancel: false
      })
    },
    settings() {
      uni.navigateTo({
        url: '/pages/profile/settings/settings'
      })
    },
    aboutApp() {
      uni.showModal({
        title: '关于应用',
        content: '西班牙语动词变位练习APP v1.0.0\n\n帮助学生轻松掌握西班牙语动词变位\n\n—— 让学习变得更简单',
        showCancel: false
      })
    },
    startPractice() {
      uni.navigateTo({
        url: '/pages/feedback/feedback'
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
.container {
  min-height: 100vh;
  background: #f8f9fa;
  padding: 30rpx 40rpx 40rpx;
}

/* 个人资料卡片 */
.profile-card {
  background: #fff;
  border-radius: 25rpx;
  overflow: hidden;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
  margin-bottom: 30rpx;
  position: relative;
}

.profile-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 200rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: 0;
}

.gradient-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.05) 25%,
    transparent 25%,
    transparent 75%,
    rgba(255, 255, 255, 0.05) 75%
  );
  background-size: 60rpx 60rpx;
  opacity: 0.3;
}

.profile-content {
  position: relative;
  z-index: 1;
  padding: 40rpx 40rpx 30rpx 40rpx;
}

.user-avatar-section {
  display: flex;
  align-items: center;
  gap: 30rpx;
}

.avatar-container {
  position: relative;
}

.avatar-wrapper {
  width: 120rpx;
  height: 120rpx;
  border-radius: 25rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: bold;
  color: #667eea;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.1);
  position: relative;
  border: 3rpx solid #f0f0f0;  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;}

.avatar-badge {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  color: #fff;
  padding: 6rpx 12rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
  font-weight: bold;
  box-shadow: 0 4rpx 12rpx rgba(255, 215, 0, 0.3);
}

.camera-icon {
  position: absolute;
  bottom: -8rpx;
  right: -8rpx;
  width: 44rpx;
  height: 44rpx;
  background: #667eea;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.3);
  border: 2rpx solid #fff;
}

.user-info {
  flex: 1;
}

.username {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 15rpx;
}

.user-tags {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.user-tag {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  font-weight: 500;
}

.user-tag.student {
  background: #66a64b;
  color: #fff;
}

.user-tag.public {
  background: #764ba2;
  color: #fff;
}

.user-tag.streak {
  background: #ff6b6b;
  color: #fff;
}

.tag-icon {
  font-size: 20rpx;
}

/* 学习成就 */
.achievement-section {
  padding: 0 0 20rpx;
}

.achievement-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.achievement-item {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  text-align: center;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
  transition: all 0.3s ease;
}

.achievement-item:active {
  transform: scale(0.98);
  box-shadow: 0 5rpx 15rpx rgba(0, 0, 0, 0.12);
}

.achievement-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 15rpx;
  font-size: 36rpx;
  color: #fff;
}

.achievement-value {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.achievement-label {
  display: block;
  font-size: 24rpx;
  color: #666;
}

/* 个人信息 */
.info-section {
  padding: 0 0 20rpx;
}

.info-card {
  background: #fff;
  border-radius: 25rpx;
  padding: 40rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.card-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.edit-button {
  color: #667eea;
  font-size: 26rpx;
  font-weight: 500;
  padding: 12rpx 20rpx;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 15rpx;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 25rpx;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.info-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: 15rpx;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #667eea;
}

.info-content {
  flex: 1;
}

.info-label {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 5rpx;
}

.info-value {
  display: block;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

/* 订阅信息 */
.subscription-section {
  padding: 0 0 20rpx;
}

.subscription-card {
  background: #fff;
  border-radius: 25rpx;
  padding: 40rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
}

.subscription-status {
  padding: 8rpx 16rpx;
  border-radius: 15rpx;
  font-size: 24rpx;
  font-weight: bold;
}

.subscription-status.valid {
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}

.subscription-status.invalid {
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
}

.subscription-content {
  display: flex;
  flex-direction: column;
  gap: 25rpx;
}

.subscription-info {
  text-align: center;
}

.subscription-text {
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
}

.renew-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 25rpx;
  padding: 25rpx;
  font-size: 28rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  box-shadow: 0 8rpx 20rpx rgba(102, 126, 234, 0.3);
}

.renew-button:active {
  transform: scale(0.98);
}

.button-icon {
  font-size: 32rpx;
}

/* 功能菜单 */
.menu-section {
  padding: 0 0 20rpx;
}

.menu-card {
  background: #fff;
  border-radius: 25rpx;
  padding: 0;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  transition: all 0.3s ease;
}

.menu-item:active {
  background: #f8f9fa;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: 15rpx;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}

.menu-label {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.menu-arrow {
  font-size: 28rpx;
  color: #ccc;
  transition: transform 0.3s ease;
}

.menu-item:active .menu-arrow {
  transform: translateX(10rpx);
  color: #667eea;
}

/* 退出登录 */
.logout-section {
  padding: 0 0 40rpx;
}

.logout-button {
  background: #fff;
  color: #ff4d4f;
  border: 2rpx solid #ff4d4f;
  border-radius: 25rpx;
  padding: 25rpx;
  font-size: 28rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  transition: all 0.3s ease;
}

.logout-button:active {
  background: #ff4d4f;
  color: #fff;
  transform: scale(0.98);
}

.logout-icon {
  font-size: 32rpx;
}

/* 浮动操作按钮 */
.fab-container {
  position: fixed;
  bottom: 40rpx;
  right: 40rpx;
  z-index: 100;
}

.fab-button {
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 15rpx 30rpx rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
}

.fab-button:active {
  transform: scale(0.95);
  box-shadow: 0 8rpx 20rpx rgba(102, 126, 234, 0.6);
}

.fab-icon {
  font-size: 40rpx;
  color: #fff;
}

/* 编辑弹窗 */
.modal {
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

.modal-content.edit-modal {
  width: 600rpx;
  background: #fff;
  border-radius: 25rpx;
  overflow: hidden;
  box-shadow: 0 20rpx 40rpx rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx 40rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.modal-close {
  font-size: 48rpx;
  color: #999;
  line-height: 1;
}

.modal-body {
  padding: 40rpx;
}

.form-item {
  margin-bottom: 30rpx;
}

.form-label {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 15rpx;
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 80rpx;
  background: #f8f9fa;
  border-radius: 15rpx;
  padding: 0 25rpx;
  font-size: 28rpx;
  color: #333;
  border: 1rpx solid #e0e0e0;
  box-sizing: border-box;
}

.form-error {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #e74c3c;
}

.picker-input {
  width: 100%;
  height: 80rpx;
  background: #f8f9fa;
  border-radius: 15rpx;
  padding: 0 25rpx;
  font-size: 28rpx;
  color: #333;
  border: 1rpx solid #e0e0e0;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.picker-input .placeholder {
  color: #999;
}

.form-note {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 20rpx;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 15rpx;
  margin-top: 10rpx;
}

.note-icon {
  font-size: 28rpx;
}

.note-text {
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  padding: 30rpx 40rpx;
  border-top: 1rpx solid #f0f0f0;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: bold;
  border: none;
}

.cancel-btn {
  background: #f8f9fa;
  color: #666;
}

.confirm-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}
</style>
