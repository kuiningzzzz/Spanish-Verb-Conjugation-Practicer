<template>
  <view class="container">
    <!-- 页面标题 -->
    <view class="page-header">
      <text class="page-title">📝 我的题库</text>
      <text class="page-subtitle">{{ totalCount }} 道{{ selectedSentenceTypeLabel }}已收藏题目</text>
    </view>

    <!-- 题目类型标题 -->
    <view class="type-header">
      <text class="type-title">例句填空题</text>
    </view>

    <view
      class="sentence-type-filter"
      @touchstart="handleSentenceTypeSwipeStart"
      @touchend="handleSentenceTypeSwipeEnd"
      @touchcancel="resetSentenceTypeSwipeState"
    >
      <view class="sentence-type-navbar">
        <view
          v-for="(type, index) in sentenceTypeOptions"
          :key="type.value"
          class="sentence-type-item"
          :class="{ active: selectedSentenceTypeIndex === index }"
          @click="selectSentenceType(index)"
        >
          <text class="sentence-type-item-text">{{ type.label }}</text>
        </view>
      </view>
    </view>

    <!-- 题目列表 -->
    <view class="question-list">
      <!-- 空状态 -->
      <view v-if="currentList.length === 0" class="empty-placeholder">
        <text class="empty-icon">📚</text>
        <text class="empty-text">还没有收藏{{ selectedSentenceTypeLabel }}题目</text>
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
          <view class="header-left">
            <view class="question-number">#{{ index + 1 }}</view>
            <!-- 动词原形 -->
            <view v-if="item.infinitive" class="verb-infinitive">
              <text class="verb-text">{{ item.infinitive }}</text>
              <text v-if="item.meaning" class="verb-meaning">（{{ item.meaning }}）</text>
            </view>
          </view>
          <view class="delete-btn" @click.stop="deleteQuestion(item.id)">
            <text>🗑️</text>
          </view>
        </view>

        <!-- 带代词题额外信息 -->
        <view v-if="shouldShowPronounMeta(item)" class="question-pronoun-meta">
          <text class="meta-tag-blue">{{ getHostFormTagText(item) }}</text>
          <text v-if="shouldShowPronounPatternTag(item)" class="meta-tag-blue">{{ getDoIoTagText(item) }}</text>
        </view>

        <!-- 时态信息 -->
        <view v-if="hasApplicableMeta(item)" class="question-meta">
          <text class="meta-tag" v-if="isApplicableMeta(item.mood)">{{ item.mood }}</text>
          <text class="meta-tag" v-if="isApplicableMeta(item.tense)">{{ item.tense }}</text>
          <text class="meta-tag" v-if="isApplicableMeta(item.person)">{{ item.person }}</text>
        </view>

        <!-- 题目内容 -->
        <view class="question-content">
          <text class="question-text">{{ item.question_text }}</text>
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

        <!-- 题目信息 -->
        <view class="question-footer">
          <text class="footer-info"> 收藏于 {{ formatDate(item.created_at) }}</text>
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
      sentenceQuestions: [],
      sentenceCount: 0,
      sentenceTypeOptions: [
        { value: 'traditional', label: '纯动词变位' },
        { value: 'with_pronoun', label: '带代词变位' }
      ],
      selectedSentenceTypeIndex: 0,
      sentenceTypeSwipeStartX: 0,
      isSentenceTypeSwipeTracking: false
    }
  },
  computed: {
    currentList() {
      return this.sentenceQuestions
    },
    totalCount() {
      return this.sentenceCount
    },
    selectedSentenceType() {
      const active = this.sentenceTypeOptions[this.selectedSentenceTypeIndex]
      return active ? active.value : 'traditional'
    },
    selectedSentenceTypeLabel() {
      const active = this.sentenceTypeOptions[this.selectedSentenceTypeIndex]
      return active ? active.label : '纯动词变位'
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
        const res = await api.getMyQuestions({
          questionType: 'sentence',
          sentenceType: this.selectedSentenceType
        })
        hideLoading()

        console.log('获取题目列表响应:', res)
        if (res.success) {
          // 只保留例句填空题
          this.sentenceQuestions = res.questions.filter(q => q.question_type === 'sentence')
          this.sentenceCount = this.sentenceQuestions.length
          
          console.log('例句填空题数量:', this.sentenceCount)
          if (this.sentenceQuestions.length > 0) {
            console.log('第一道题示例:', this.sentenceQuestions[0])
          }
        }
      } catch (error) {
        hideLoading()
        console.error('加载题目失败:', error)
        showToast('加载失败', 'none')
      }
    },

    selectSentenceType(index) {
      if (index < 0 || index >= this.sentenceTypeOptions.length) return
      if (this.selectedSentenceTypeIndex === index) return
      this.selectedSentenceTypeIndex = index
      this.loadQuestions()
    },

    handleSentenceTypeSwipeStart(e) {
      const touch = e && e.touches && e.touches[0]
      if (!touch) return
      this.sentenceTypeSwipeStartX = touch.clientX
      this.isSentenceTypeSwipeTracking = true
    },

    handleSentenceTypeSwipeEnd(e) {
      if (!this.isSentenceTypeSwipeTracking) return
      const touch = e && e.changedTouches && e.changedTouches[0]
      if (!touch) {
        this.resetSentenceTypeSwipeState()
        return
      }
      const deltaX = touch.clientX - this.sentenceTypeSwipeStartX
      const minSwipeDistance = 60
      if (Math.abs(deltaX) < minSwipeDistance) {
        this.resetSentenceTypeSwipeState()
        return
      }
      if (deltaX < 0) {
        this.selectSentenceType(this.selectedSentenceTypeIndex + 1)
      } else {
        this.selectSentenceType(this.selectedSentenceTypeIndex - 1)
      }
      this.resetSentenceTypeSwipeState()
    },

    resetSentenceTypeSwipeState() {
      this.sentenceTypeSwipeStartX = 0
      this.isSentenceTypeSwipeTracking = false
    },

    isApplicableMeta(value) {
      const text = String(value || '').trim()
      if (!text) return false
      const normalized = text.toLowerCase()
      if (normalized === '不适用') return false
      if (normalized === 'n/a' || normalized === 'na') return false
      if (normalized === '-') return false
      if (normalized === 'null' || normalized === 'undefined') return false
      return true
    },

    hasApplicableMeta(item) {
      if (!item) return false
      return this.isApplicableMeta(item.mood)
        || this.isApplicableMeta(item.tense)
        || this.isApplicableMeta(item.person)
    },

    shouldShowPronounMeta(item) {
      if (!item) return false
      return item.sentence_type === 'with_pronoun'
    },

    shouldShowPronounPatternTag(item) {
      if (!item) return false
      if (item.sentence_type !== 'with_pronoun') return false
      const hostForm = String(item.host_form || '').trim().toLowerCase()
      return hostForm !== 'prnl'
    },

    getHostFormTagText(item) {
      if (!item) return '形式：未知'
      const hostFormZh = String(item.host_form_zh || '').trim()
      if (hostFormZh) return `形式：${hostFormZh}`

      const hostForm = String(item.host_form || '').trim().toLowerCase()
      const hostFormMap = {
        finite: '陈述式/时态变位',
        imperative: '命令式',
        infinitive: '不定式',
        gerund: '副动词',
        prnl: '自反形式'
      }
      return `形式：${hostFormMap[hostForm] || '未知'}`
    },

    getDoIoTagText(item) {
      if (!item) return '代词模式：—'

      const hostForm = String(item.host_form || '').trim().toLowerCase()
      if (hostForm === 'prnl') {
        return '代词模式：—'
      }

      const ioPronoun = String(item.io_pronoun || '').trim()
      const doPronoun = String(item.do_pronoun || '').trim()
      if (ioPronoun && doPronoun) {
        return '代词模式：DO+IO'
      }
      if (ioPronoun) {
        return '代词模式：IO'
      }
      if (doPronoun) {
        return '代词模式：DO'
      }

      const pattern = String(item.pronoun_pattern || '').trim().toUpperCase()
      if (pattern === 'DO') return '代词模式：DO'
      if (pattern === 'IO') return '代词模式：IO'
      if (pattern === 'DO_IO') return '代词模式：DO+IO'

      return '代词模式：—'
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
  margin-bottom: 40rpx;
}

.page-title {
  display: block;
  font-size: 52rpx;
  font-weight: bold;
  color: #1a1a1a;
  margin-bottom: 12rpx;
  letter-spacing: 2rpx;
}

.page-subtitle {
  display: block;
  font-size: 28rpx;
  color: #8B0012;
  font-weight: 500;
}

/* 题目类型标题 */
.type-header {
  background: #8B0012;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(139, 0, 18, 0.25);
  text-align: center;
}

.type-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.sentence-type-filter {
  margin-bottom: 26rpx;
}

.sentence-type-navbar {
  display: flex;
  align-items: center;
  background: #fff;
  border: 1rpx solid #f0d6da;
  border-radius: 16rpx;
  padding: 8rpx;
  box-shadow: 0 4rpx 16rpx rgba(139, 0, 18, 0.08);
}

.sentence-type-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 12rpx;
  border-radius: 12rpx;
  transition: all 0.2s ease;
}

.sentence-type-item.active {
  background: #8B0012;
}

.sentence-type-item-text {
  font-size: 26rpx;
  color: #8B0012;
  font-weight: 600;
}

.sentence-type-item.active .sentence-type-item-text {
  color: #fff;
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
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 2rpx solid #f0f0f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex: 1;
}

.question-number {
  background: #8B0012;
  color: #fff;
  padding: 10rpx 24rpx;
  border-radius: 24rpx;
  font-size: 26rpx;
  font-weight: bold;
  box-shadow: 0 4rpx 12rpx rgba(139, 0, 18, 0.3);
  flex-shrink: 0;
}

.delete-btn {
  color: #ff4d4f;
  font-size: 32rpx;
  padding: 8rpx 16rpx;
  background: #fff1f0;
  border-radius: 12rpx;
  border: 1rpx solid #ffccc7;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2rpx 8rpx rgba(255, 77, 79, 0.15);
  flex-shrink: 0;
}

.delete-btn:active {
  background: #ff4d4f;
  color: #fff;
  transform: scale(0.95);
}

/* 动词原形（在header内） */
.verb-infinitive {
  display: flex;
  align-items: center;
}

.verb-text {
  font-size: 32rpx;
  color: #333;
  font-weight: bold;
}

.verb-meaning {
  font-size: 26rpx;
  color: #888;
  margin-left: 10rpx;
}

/* 时态信息 */
.question-meta {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  margin-bottom: 20rpx;
}

.meta-tag {
  background: #fff5f5;
  padding: 8rpx 18rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #8B0012;
  font-weight: 500;
  border: 1rpx solid #ffd9d9;
}

.question-pronoun-meta {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  margin-bottom: 20rpx;
}

.meta-tag-blue {
  background: #eef6ff;
  padding: 8rpx 18rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #2a5d9f;
  font-weight: 500;
  border: 1rpx solid #d6e8ff;
}

/* 题目内容 */
.question-content {
  margin-bottom: 25rpx;
}

.question-text {
  display: block;
  font-size: 32rpx;
  color: #1a1a1a;
  line-height: 1.8;
  font-weight: 500;
  padding: 10rpx 0;
}

/* 答案区域 */
.answer-section {
  margin-bottom: 25rpx;
}

.answer-label {
  margin-bottom: 15rpx;
}

.answer-label text {
  font-size: 26rpx;
  color: #666;
  font-weight: 500;
}

.answer-box {
  background: #e8f5e9;
  padding: 22rpx 28rpx;
  border-radius: 12rpx;
  border-left: 6rpx solid #4caf50;
  box-shadow: 0 2rpx 8rpx rgba(76, 175, 80, 0.15);
}

.answer-text {
  font-size: 32rpx;
  color: #2e7d32;
  font-weight: bold;
  letter-spacing: 1rpx;
}

/* 翻译 */
.translation-section {
  display: flex;
  align-items: flex-start;
  padding: 24rpx;
  background: #fff9e6;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid #ffe8b3;
  box-shadow: 0 2rpx 8rpx rgba(255, 193, 7, 0.1);
}

.translation-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
  line-height: 1.5;
}

.translation-text {
  flex: 1;
  font-size: 26rpx;
  color: #555;
  line-height: 1.6;
}

/* 题目信息 */
.question-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 20rpx;
  border-top: 2rpx solid #f0f0f0;
}

.footer-info {
  font-size: 24rpx;
  color: #999;
  font-weight: 400;
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
  border-radius: 20rpx;
  box-shadow: 0 6rpx 24rpx rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  border: 1rpx solid #f0f0f0;
}

.card:active {
  transform: translateY(-4rpx);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
}
</style>
