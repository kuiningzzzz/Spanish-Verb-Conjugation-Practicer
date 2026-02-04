<template>
  <view class="container">
    <!-- 头部标题 -->
    <view class="header">
      <view class="header-icon">💭</view>
      <text class="header-title">用户反馈</text>
      <text class="header-subtitle">您的意见对我们非常重要</text>
    </view>

    <!-- 反馈表单 -->
    <view class="feedback-card">
      <!-- 满意度评分 -->
      <view class="form-section">
        <view class="section-header">
          <text class="section-title">您对我们的软件满意吗？</text>
          <text class="required-mark">*</text>
        </view>
        <view class="satisfaction-options">
          <view 
            v-for="option in satisfactionOptions" 
            :key="option.value"
            class="satisfaction-option"
            :class="{ 'selected': formData.satisfaction === option.value }"
            @click="selectSatisfaction(option.value)"
          >
            <view class="option-icon">{{ option.icon }}</view>
            <text class="option-label">{{ option.label }}</text>
          </view>
        </view>
        <text v-if="errors.satisfaction" class="error-text">{{ errors.satisfaction }}</text>
      </view>

      <!-- 意见建议 -->
      <view class="form-section">
        <view class="section-header">
          <text class="section-title">您觉得我们的软件有哪些可取之处和哪些不足之处？</text>
          <text class="optional-mark">选填</text>
        </view>
        <textarea
          class="comment-input"
          v-model="formData.comment"
          placeholder="请分享您的使用体验、建议或遇到的问题..."
          maxlength="500"
          :auto-height="true"
        />
        <view class="char-count">
          <text class="count-text">{{ commentLength }}/500</text>
        </view>
      </view>

      <!-- 提交按钮 -->
      <button class="submit-button" @click="submitFeedback" :disabled="submitting">
        <text class="button-icon">{{ submitting ? '⏳' : '📤' }}</text>
        <text class="button-text">{{ submitting ? '提交中...' : '提交反馈' }}</text>
      </button>
    </view>

    <!-- 历史反馈 -->
    <view class="history-section" v-if="feedbackHistory.length > 0">
      <view class="history-header">
        <text class="history-title">我的反馈历史</text>
        <text class="history-count">共 {{ feedbackHistory.length }} 条</text>
      </view>
      
      <view class="history-list">
        <view 
          v-for="item in feedbackHistory" 
          :key="item.id"
          class="history-item"
        >
          <view class="history-item-header">
            <view class="satisfaction-badge" :class="'level-' + item.satisfaction">
              {{ getSatisfactionLabel(item.satisfaction) }}
            </view>
            <text class="history-date">{{ formatDate(item.created_at) }}</text>
          </view>
          <text v-if="item.comment" class="history-comment">{{ item.comment }}</text>
          <text v-else class="history-no-comment">未填写意见</text>
        </view>
      </view>
    </view>

    <!-- 感谢卡片 -->
    <view class="thanks-card">
      <text class="thanks-icon">🙏</text>
      <text class="thanks-text">感谢您抽出宝贵时间提供反馈！</text>
      <text class="thanks-subtext">我们会认真阅读每一条反馈，不断改进产品</text>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast, formatDate } from '@/utils/common.js'

export default {
  data() {
    return {
      formData: {
        satisfaction: null,
        comment: ''
      },
      errors: {
        satisfaction: ''
      },
      submitting: false,
      feedbackHistory: [],
      satisfactionOptions: [
        { value: 1, label: '非常不满意', icon: '😞' },
        { value: 2, label: '不太满意', icon: '😐' },
        { value: 3, label: '比较满意', icon: '😊' },
        { value: 4, label: '非常满意', icon: '😄' }
      ]
    }
  },
  computed: {
    commentLength() {
      return this.formData.comment ? this.formData.comment.length : 0
    }
  },
  onLoad() {
    this.loadFeedbackHistory()
  },
  methods: {
    selectSatisfaction(value) {
      this.formData.satisfaction = value
      this.errors.satisfaction = ''
    },
    
    validateForm() {
      this.errors.satisfaction = ''
      
      if (!this.formData.satisfaction) {
        this.errors.satisfaction = '请选择满意度评分'
        return false
      }
      
      return true
    },
    
    async submitFeedback() {
      if (!this.validateForm()) {
        uni.showToast({
          title: '请选择满意度评分',
          icon: 'none',
          duration: 2000
        })
        return
      }
      
      this.submitting = true
      
      try {
        const res = await api.submitFeedback({
          satisfaction: this.formData.satisfaction,
          comment: this.formData.comment.trim() || null
        })
        
        if (res.success) {
          uni.showToast({
            title: '提交成功！感谢您的反馈',
            icon: 'success',
            duration: 2000
          })
          
          // 重置表单
          this.formData = {
            satisfaction: null,
            comment: ''
          }
          
          // 刷新历史记录
          this.loadFeedbackHistory()
        } else {
          uni.showToast({
            title: res.error || '提交失败',
            icon: 'none',
            duration: 2000
          })
        }
      } catch (error) {
        console.error('提交反馈失败:', error)
        uni.showToast({
          title: '提交失败，请稍后重试',
          icon: 'none',
          duration: 2000
        })
      } finally {
        this.submitting = false
      }
    },
    
    async loadFeedbackHistory() {
      try {
        const res = await api.getFeedbackHistory()
        if (res.success) {
          this.feedbackHistory = res.feedbackList || []
        }
      } catch (error) {
        console.error('加载反馈历史失败:', error)
      }
    },
    
    getSatisfactionLabel(value) {
      const option = this.satisfactionOptions.find(opt => opt.value === value)
      return option ? option.label : '未知'
    },
    
    formatDate(dateStr) {
      return formatDate(dateStr, 'YYYY-MM-DD HH:mm')
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f8f9fa;
  padding: 40rpx;
}

/* 头部 */
.header {
  text-align: center;
  margin-bottom: 40rpx;
}

.header-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.header-title {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.header-subtitle {
  display: block;
  font-size: 26rpx;
  color: #999;
}

/* 反馈卡片 */
.feedback-card {
  background: #fff;
  border-radius: 25rpx;
  padding: 40rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
  margin-bottom: 30rpx;
}

.form-section {
  margin-bottom: 40rpx;
}

.form-section:last-of-type {
  margin-bottom: 30rpx;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 25rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  flex: 1;
}

.required-mark {
  color: #ff4d4f;
  font-size: 28rpx;
  margin-left: 8rpx;
}

.optional-mark {
  font-size: 24rpx;
  color: #999;
  background: #f0f0f0;
  padding: 4rpx 12rpx;
  border-radius: 10rpx;
}

/* 满意度选项 */
.satisfaction-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.satisfaction-option {
  background: #f8f9fa;
  border: 2rpx solid #e0e0e0;
  border-radius: 20rpx;
  padding: 30rpx 20rpx;
  text-align: center;
  transition: all 0.3s ease;
}

.satisfaction-option.selected {
  background: #8B0012;
  border-color: #8B0012;
  transform: scale(1.05);
}

.option-icon {
  font-size: 48rpx;
  margin-bottom: 10rpx;
}

.option-label {
  display: block;
  font-size: 24rpx;
  color: #666;
  font-weight: 500;
}

.satisfaction-option.selected .option-label {
  color: #fff;
}

.error-text {
  display: block;
  margin-top: 15rpx;
  font-size: 24rpx;
  color: #ff4d4f;
}

/* 评论输入 */
.comment-input {
  width: 100%;
  min-height: 200rpx;
  background: #f8f9fa;
  border: 1rpx solid #e0e0e0;
  border-radius: 15rpx;
  padding: 20rpx;
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
  box-sizing: border-box;
}

.char-count {
  display: flex;
  justify-content: flex-end;
  margin-top: 10rpx;
}

.count-text {
  font-size: 24rpx;
  color: #999;
}

/* 提交按钮 */
.submit-button {
  width: 100%;
  height: 90rpx;
  background: #8B0012;
  color: #fff;
  border: none;
  border-radius: 20rpx;
  font-size: 30rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  box-shadow: 0 8rpx 20rpx rgba(139, 0, 18, 0.3);
  transition: all 0.3s ease;
}

.submit-button:active:not([disabled]) {
  transform: scale(0.98);
  box-shadow: 0 4rpx 15rpx rgba(139, 0, 18, 0.4);
}

.submit-button[disabled] {
  opacity: 0.6;
}

.button-icon {
  font-size: 32rpx;
}

/* 历史反馈 */
.history-section {
  margin-bottom: 30rpx;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  padding: 0 10rpx;
}

.history-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.history-count {
  font-size: 24rpx;
  color: #999;
  background: #f0f0f0;
  padding: 6rpx 15rpx;
  border-radius: 15rpx;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.history-item {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 5rpx 15rpx rgba(0, 0, 0, 0.05);
  border: 1rpx solid #f0f0f0;
}

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15rpx;
}

.satisfaction-badge {
  padding: 8rpx 16rpx;
  border-radius: 15rpx;
  font-size: 24rpx;
  font-weight: bold;
  color: #fff;
}

.satisfaction-badge.level-1 {
  background: #ff6b6b;
}

.satisfaction-badge.level-2 {
  background: #ffa502;
}

.satisfaction-badge.level-3 {
  background: #4facfe;
}

.satisfaction-badge.level-4 {
  background: #43e97b;
}

.history-date {
  font-size: 24rpx;
  color: #999;
}

.history-comment {
  display: block;
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
}

.history-no-comment {
  display: block;
  font-size: 26rpx;
  color: #ccc;
  font-style: italic;
}

/* 感谢卡片 */
.thanks-card {
  background: #8B0012;
  border-radius: 25rpx;
  padding: 40rpx;
  text-align: center;
  box-shadow: 0 10rpx 30rpx rgba(139, 0, 18, 0.3);
}

.thanks-icon {
  display: block;
  font-size: 60rpx;
  margin-bottom: 20rpx;
}

.thanks-text {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 10rpx;
}

.thanks-subtext {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
}
</style>
