<template>
  <view class="container">
    <!-- 页面标题 -->
    <view class="page-header">
      <text class="page-title">📝 我的题库</text>
      <text class="page-subtitle">{{ totalCount }} 道已收藏的题目</text>
    </view>

    <!-- Tab切换 -->
    <view class="tabs">
      <view 
        :class="['tab-item', activeTab === 'fill' ? 'active' : '']" 
        @click="switchTab('fill')"
      >
        <text>填空题 ({{ fillCount }})</text>
      </view>
      <view 
        :class="['tab-item', activeTab === 'sentence' ? 'active' : '']" 
        @click="switchTab('sentence')"
      >
        <text>例句填空 ({{ sentenceCount }})</text>
      </view>
    </view>

    <!-- 题目列表 -->
    <view class="question-list">
      <!-- 空状态 -->
      <view v-if="currentList.length === 0" class="empty-placeholder">
        <text class="empty-icon">📚</text>
        <text class="empty-text">还没有收藏{{ activeTab === 'fill' ? '填空题' : '例句填空' }}</text>
        <text class="empty-hint">在练习时点击题目收藏按钮</text>
      </view>

      <!-- 题目卡片 -->
      <view 
        v-for="(item, index) in currentList" 
        :key="item.id" 
        class="question-card card"
      >
        <!-- 题目头部 -->
        <view class="question-header">
          <view class="question-number">#{{ index + 1 }}</view>
          <view class="question-meta">
            <text class="meta-tag">{{ item.tense || '一般现在时' }}</text>
            <text class="meta-tag" v-if="item.mood">{{ item.mood }}</text>
            <text class="meta-tag" v-if="item.person">{{ item.person }}</text>
          </view>
          <view class="delete-btn" @click.stop="deleteQuestion(item.id)">
            <text>🗑️ 删除</text>
          </view>
        </view>

        <!-- 题目内容 -->
        <view class="question-content">
          <text class="question-text">{{ item.question_text }}</text>
        </view>

        <!-- 例句（如果有） -->
        <view v-if="item.example_sentence" class="example-section">
          <text class="example-label">例句：</text>
          <text class="example-text">{{ item.example_sentence }}</text>
        </view>

        <!-- 答案区域 -->
        <view class="answer-section">
          <view class="answer-label">
            <text>正确答案</text>
          </view>
          <view class="answer-box">
            <text class="answer-text">{{ item.correct_answer }}</text>
          </view>
        </view>

        <!-- 翻译（如果有） -->
        <view v-if="item.translation" class="translation-section">
          <text class="translation-icon">🌐</text>
          <text class="translation-text">{{ item.translation }}</text>
        </view>

        <!-- 提示（如果有） -->
        <view v-if="item.hint" class="hint-section">
          <text class="hint-icon">💡</text>
          <text class="hint-text">{{ item.hint }}</text>
        </view>

        <!-- 题目信息 -->
        <view class="question-footer">
          <text class="footer-info">动词ID: {{ item.verb_id }}</text>
          <text class="footer-info">收藏于 {{ formatDate(item.created_at) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast, showLoading, hideLoading, showModal } from '@/utils/common.js'

export default {
  data() {
    return {
      activeTab: 'fill', // 'fill' 或 'sentence'
      fillQuestions: [],
      sentenceQuestions: [],
      fillCount: 0,
      sentenceCount: 0
    }
  },
  computed: {
    currentList() {
      return this.activeTab === 'fill' ? this.fillQuestions : this.sentenceQuestions
    },
    totalCount() {
      return this.fillCount + this.sentenceCount
    }
  },
  onLoad() {
    this.loadQuestions()
  },
  onShow() {
    // 每次显示页面时刷新数据
    this.loadQuestions()
  },
  methods: {
    async loadQuestions() {
      try {
        showLoading('加载中...')
        const res = await api.getMyQuestions()
        hideLoading()

        console.log('获取题目列表响应:', res)
        if (res.success) {
          // 按题目类型分类
          this.fillQuestions = res.questions.filter(q => q.question_type === 'fill')
          this.sentenceQuestions = res.questions.filter(q => q.question_type === 'sentence')
          this.fillCount = this.fillQuestions.length
          this.sentenceCount = this.sentenceQuestions.length
          
          console.log('填空题数量:', this.fillCount)
          console.log('例句数量:', this.sentenceCount)
          if (res.questions.length > 0) {
            console.log('第一道题示例:', res.questions[0])
          }
        }
      } catch (error) {
        hideLoading()
        console.error('加载题目失败:', error)
        showToast('加载失败', 'none')
      }
    },

    switchTab(tab) {
      this.activeTab = tab
    },

    async deleteQuestion(questionId) {
      console.log('点击删除按钮，题目ID:', questionId)
      
      const result = await showModal('确认删除', '确定要删除这道题目吗？')
      if (!result) {
        console.log('用户取消删除')
        return
      }

      try {
        showLoading('删除中...')
        console.log('发送删除请求，参数:', { privateQuestionId: questionId })
        const res = await api.unfavoriteQuestion({ privateQuestionId: questionId })
        hideLoading()

        console.log('删除响应:', res)
        if (res.success) {
          showToast('删除成功', 'success')
          this.loadQuestions()
        } else {
          showToast(res.message || '删除失败', 'none')
        }
      } catch (error) {
        hideLoading()
        console.error('删除题目失败:', error)
        showToast('删除失败', 'none')
      }
    },

    formatDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${year}年${month}月${day}日`
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  padding: 40rpx;
  background: #f8f8f8;
}

/* 页面标题 */
.page-header {
  text-align: center;
  margin-bottom: 30rpx;
}

.page-title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.page-subtitle {
  display: block;
  font-size: 28rpx;
  color: #999;
}

/* Tab切换 */
.tabs {
  display: flex;
  background: #fff;
  border-radius: 12rpx;
  padding: 8rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  font-size: 28rpx;
  color: #666;
  border-radius: 8rpx;
  transition: all 0.3s;
}

.tab-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: bold;
}

/* 题目列表 */
.question-list {
  margin-bottom: 40rpx;
}

.question-card {
  margin-bottom: 30rpx;
  padding: 30rpx;
}

/* 题目头部 */
.question-header {
  display: flex;
  align-items: center;
  margin-bottom: 25rpx;
  padding-bottom: 20rpx;
  border-bottom: 2rpx solid #f0f0f0;
}

.question-number {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  font-weight: bold;
  margin-right: 15rpx;
}

.question-meta {
  flex: 1;
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}

.meta-tag {
  background: #f0f0f0;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: #666;
}

.delete-btn {
  color: #ff4d4f;
  font-size: 26rpx;
  padding: 12rpx 20rpx;
  background: #fff1f0;
  border-radius: 8rpx;
  border: 1rpx solid #ffccc7;
  min-width: 100rpx;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.delete-btn:active {
  background: #ff4d4f;
  color: #fff;
  transform: scale(0.95);
}

/* 题目内容 */
.question-content {
  margin-bottom: 25rpx;
}

.question-text {
  display: block;
  font-size: 32rpx;
  color: #333;
  line-height: 1.6;
  font-weight: 500;
}

/* 例句 */
.example-section {
  background: #f8f9ff;
  padding: 20rpx;
  border-radius: 12rpx;
  margin-bottom: 25rpx;
}

.example-label {
  display: block;
  font-size: 24rpx;
  color: #667eea;
  margin-bottom: 8rpx;
  font-weight: bold;
}

.example-text {
  display: block;
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
}

/* 答案区域 */
.answer-section {
  margin-bottom: 25rpx;
}

.answer-label {
  margin-bottom: 15rpx;
}

.answer-label text {
  font-size: 24rpx;
  color: #999;
}

.answer-box {
  background: #e8f5e9;
  padding: 20rpx 25rpx;
  border-radius: 12rpx;
  border-left: 6rpx solid #4caf50;
}

.answer-text {
  font-size: 30rpx;
  color: #2e7d32;
  font-weight: bold;
}

/* 翻译 */
.translation-section {
  display: flex;
  align-items: flex-start;
  padding: 20rpx;
  background: #fff9e6;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}

.translation-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.translation-text {
  flex: 1;
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
}

/* 提示 */
.hint-section {
  display: flex;
  align-items: flex-start;
  padding: 20rpx;
  background: #fff3e0;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}

.hint-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.hint-text {
  flex: 1;
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
}

/* 题目信息 */
.question-footer {
  display: flex;
  justify-content: space-between;
  padding-top: 20rpx;
  border-top: 2rpx solid #f0f0f0;
}

.footer-info {
  font-size: 24rpx;
  color: #999;
}

/* 空状态 */
.empty-placeholder {
  text-align: center;
  padding: 120rpx 40rpx;
}

.empty-icon {
  display: block;
  font-size: 120rpx;
  margin-bottom: 30rpx;
}

.empty-text {
  display: block;
  font-size: 32rpx;
  color: #666;
  margin-bottom: 15rpx;
  font-weight: 500;
}

.empty-hint {
  display: block;
  font-size: 26rpx;
  color: #999;
}

/* 通用卡片样式 */
.card {
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}
</style>
