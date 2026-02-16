<template>
  <view class="container">
    <!-- 统计卡片 -->
    <view class="card stats-card">
      <view class="stats-row">
        <view class="stat-item">
          <text class="stat-number">{{ favoriteCount }}</text>
          <text class="stat-label">收藏单词</text>
        </view>
        <view class="stat-item">
          <text class="stat-number">{{ wrongCount }}</text>
          <text class="stat-label">错题单词</text>
        </view>
        <view class="stat-item">
          <text class="stat-number">{{ questionCount }}</text>
          <text class="stat-label">收藏题目</text>
        </view>
      </view>
    </view>

    <!-- Tab切换 -->
    <view class="tabs">
      <view 
        :class="['tab-item', activeTab === 'favorite' ? 'active' : '']" 
        @click="switchTab('favorite')"
      >
        <text>收藏单词</text>
      </view>
      <view 
        :class="['tab-item', activeTab === 'wrong' ? 'active' : '']" 
        @click="switchTab('wrong')"
      >
        <text>错题单词</text>
      </view>
      <view
        :class="['tab-item', activeTab === 'question' ? 'active' : '']"
        @click="switchTab('question')"
      >
        <text>收藏题目</text>
      </view>
    </view>

    <!-- 收藏列表 -->
    <view v-if="activeTab === 'favorite'" class="word-list">
      <view class="entry-card tab-practice-entry" @click="startFavoritePractice">
        <view class="entry-icon">⭐</view>
        <view class="entry-content">
          <text class="entry-title">收藏专练</text>
          <text class="entry-desc">练习已收藏的单词</text>
        </view>
        <view class="entry-arrow">→</view>
      </view>

      <view v-if="listLoadFailed" class="empty-placeholder load-failed-placeholder">
        <text class="load-failed-text">加载失败，请检查您的网络连接</text>
      </view>
      <view v-else-if="favoriteList.length === 0" class="empty-placeholder">
        <text class="empty-icon">📚</text>
        <text class="empty-text">还没有收藏单词</text>
        <text class="empty-hint">在练习时点击星标收藏</text>
      </view>

      <template v-else>
        <view
          v-for="item in favoriteList"
          :key="item.id"
          class="word-item card"
        >
          <view class="word-header">
            <view class="word-main">
              <text class="word-infinitive">{{ formatInfinitive(item) }}</text>
              <text class="word-meaning">{{ item.meaning }}</text>
              <view class="word-badges">
                <view class="word-tag">{{ item.conjugationType }}</view>
                <view v-if="item.isReflexive" class="word-tag reflexive">Prnl.</view>
                <view v-if="item.isIrregular" class="word-tag irregular">Irreg.</view>
                <view v-if="item.hasTrUse" class="word-tag transitive">tr.</view>
                <view v-if="item.hasIntrUse" class="word-tag intransitive">intr.</view>
              </view>
            </view>
          </view>
          <view class="word-meta">
            <text class="meta-item">收藏于 {{ formatFavoriteDate(item.created_at) }}</text>
            <view class="word-actions">
              <text class="detail-btn" @click="viewConjugations(item.verb_id)">查看全变位</text>
              <text class="remove-btn" @click="removeFavorite(item.verb_id)">删除</text>
            </view>
          </view>
        </view>
      </template>
    </view>

    <!-- 错题列表 -->
    <view v-if="activeTab === 'wrong'" class="word-list">
      <view class="entry-card tab-practice-entry" @click="startWrongPractice">
        <view class="entry-icon">❌</view>
        <view class="entry-content">
          <text class="entry-title">错题专练</text>
          <text class="entry-desc">练习做错的单词</text>
        </view>
        <view class="entry-arrow">→</view>
      </view>

      <view v-if="listLoadFailed" class="empty-placeholder load-failed-placeholder">
        <text class="load-failed-text">加载失败，请检查您的网络连接</text>
      </view>
      <view v-else-if="wrongList.length === 0" class="empty-placeholder">
        <text class="empty-icon">✅</text>
        <text class="empty-text">还没有错题记录</text>
        <text class="empty-hint">继续加油！</text>
      </view>

      <template v-else>
        <view 
          v-for="item in wrongList" 
          :key="item.id" 
          class="word-item card"
        >
          <view class="word-header">
            <view class="word-main">
              <text class="word-infinitive">{{ formatInfinitive(item) }}</text>
              <text class="word-meaning">{{ item.meaning }}</text>
              <view class="word-badges">
                <view class="word-tag">{{ item.conjugationType }}</view>
                <view v-if="item.isReflexive" class="word-tag reflexive">Prnl.</view>
                <view v-if="item.isIrregular" class="word-tag irregular">Irreg.</view>
                <view v-if="item.hasTrUse" class="word-tag transitive">tr.</view>
                <view v-if="item.hasIntrUse" class="word-tag intransitive">intr.</view>
              </view>
            </view>
            <view class="word-header-extra">
              <view class="wrong-count">错 {{ item.wrong_count }} 次</view>
            </view>
          </view>
          <view class="word-meta">
            <text class="meta-item">最近错误: {{ formatDate(item.last_wrong_at) }}</text>
            <view class="word-actions">
              <text class="detail-btn" @click="viewConjugations(item.verb_id)">查看全变位</text>
              <text class="remove-btn" @click="removeWrong(item.verb_id)">删除</text>
            </view>
          </view>
        </view>
      </template>
    </view>

    <!-- 收藏题目 -->
    <view v-if="activeTab === 'question'" class="question-list">
      <view v-if="questionLoadFailed" class="empty-placeholder load-failed-placeholder">
        <text class="load-failed-text">加载失败，请检查您的网络连接</text>
      </view>
      <template v-else>
        <view class="entry-card tab-practice-entry" @click="startQuestionPractice">
          <view class="entry-icon">📝</view>
          <view class="entry-content">
            <text class="entry-title">收藏题目专练</text>
            <text class="entry-desc">练习已收藏的题目</text>
          </view>
          <view class="entry-arrow">→</view>
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

        <view v-if="sentenceQuestions.length === 0" class="empty-placeholder">
          <text class="empty-icon">📚</text>
          <text class="empty-text">还没有收藏{{ selectedSentenceTypeLabel }}题目</text>
          <text class="empty-hint">在练习时点击题目收藏按钮</text>
        </view>

        <template v-else>
          <view
            v-for="(item, index) in sentenceQuestions"
            :key="item.id"
            class="question-card card"
          >
            <view class="question-header">
              <view class="header-left">
                <view class="question-number">#{{ index + 1 }}</view>
                <view v-if="item.infinitive" class="verb-infinitive">
                  <text class="verb-text">{{ item.infinitive }}</text>
                </view>
              </view>
              <view class="question-header-actions">
                <text class="detail-btn question-detail-btn" @click.stop="viewConjugations(item.verb_id)">查看全变位</text>
              </view>
            </view>

            <view v-if="shouldShowPronounMeta(item)" class="question-pronoun-meta">
              <text class="meta-tag-blue">{{ getHostFormTagText(item) }}</text>
              <text v-if="shouldShowPronounPatternTag(item)" class="meta-tag-blue">{{ getDoIoTagText(item) }}</text>
            </view>

            <view v-if="hasApplicableMeta(item)" class="question-meta">
              <text class="meta-tag" v-if="isApplicableMeta(item.mood)">{{ item.mood }}</text>
              <text class="meta-tag" v-if="isApplicableMeta(item.tense)">{{ item.tense }}</text>
              <text class="meta-tag" v-if="isApplicableMeta(item.person)">{{ item.person }}</text>
            </view>

            <view class="question-content">
              <text class="question-text">{{ item.question_text }}</text>
            </view>

            <view class="question-helper-buttons">
              <button
                class="question-helper-btn"
                :class="{ active: isQuestionTranslationVisible(item.id) }"
                @click.stop="toggleQuestionTranslation(item.id)"
              >
                <text class="question-helper-icon">📖</text>
                <text>{{ isQuestionTranslationVisible(item.id) ? '隐藏翻译' : '查看翻译' }}</text>
              </button>
              <button
                class="question-helper-btn"
                :class="{ active: isQuestionAnswerVisible(item.id) }"
                @click.stop="toggleQuestionAnswer(item.id)"
              >
                <text class="question-helper-icon">💡</text>
                <text>{{ isQuestionAnswerVisible(item.id) ? '隐藏答案' : '查看答案' }}</text>
              </button>
            </view>

            <view
              v-if="item.translation && isQuestionTranslationVisible(item.id)"
              class="translation-section question-reveal-panel"
            >
              <text class="translation-icon">🌐</text>
              <text class="translation-text">{{ item.translation }}</text>
            </view>

            <view v-if="isQuestionAnswerVisible(item.id)" class="answer-section question-reveal-panel">
              <view class="answer-box">
                <text class="answer-text">{{ item.correct_answer }}</text>
              </view>
            </view>

            <view class="question-footer">
              <text class="footer-info">收藏于 {{ formatQuestionDate(item.created_at) }}</text>
              <view class="word-actions">
                <text class="remove-btn" @click.stop="deleteQuestion(item.id)">删除</text>
              </view>
            </view>
          </view>
        </template>
      </template>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast, showLoading, hideLoading } from '@/utils/common.js'

export default {
  data() {
    return {
      activeTab: 'favorite',
      favoriteCount: 0,
      wrongCount: 0,
      questionCount: 0,
      favoriteList: [],
      wrongList: [],
      sentenceQuestions: [],
      sentenceTypeOptions: [
        { value: 'traditional', label: '纯动词变位' },
        { value: 'with_pronoun', label: '带代词变位' }
      ],
      selectedSentenceTypeIndex: 0,
      sentenceTypeSwipeStartX: 0,
      isSentenceTypeSwipeTracking: false,
      questionRevealStates: {},
      listLoadFailed: false,
      questionLoadFailed: false
    }
  },
  computed: {
    selectedSentenceType() {
      const active = this.sentenceTypeOptions[this.selectedSentenceTypeIndex]
      return active ? active.value : 'traditional'
    },
    selectedSentenceTypeLabel() {
      const active = this.sentenceTypeOptions[this.selectedSentenceTypeIndex]
      return active ? active.label : '纯动词变位'
    }
  },
  onShow() {
    this.scrollToTop()
    // 每次显示页面时刷新数据
    this.loadStats()
    this.loadAllLists()
    this.loadQuestions()
  },
  methods: {
    scrollToTop(duration = 0) {
      this.$nextTick(() => {
        if (typeof uni !== 'undefined' && typeof uni.pageScrollTo === 'function') {
          uni.pageScrollTo({
            scrollTop: 0,
            duration
          })
          return
        }
        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
          window.scrollTo({
            top: 0,
            left: 0,
            behavior: duration > 0 ? 'smooth' : 'auto'
          })
        }
      })
    },
    async loadStats() {
      try {
        const res = await api.getVocabularyStats({ silentFailToast: true })
        if (res.success) {
          this.favoriteCount = res.stats.favoriteCount
          this.wrongCount = res.stats.wrongCount
        }

        // 加载题目统计
        const questionRes = await api.getQuestionStats({ silentFailToast: true })
        if (questionRes.success) {
          this.questionCount = questionRes.stats.totalCount
        }
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    },

    async loadAllLists() {
      try {
        this.listLoadFailed = false
        const [favoriteRes, wrongRes] = await Promise.all([
          api.getFavoriteList({ silentFailToast: true }),
          api.getWrongList({ silentFailToast: true })
        ])

        if (favoriteRes.success) {
          this.favoriteList = favoriteRes.favorites
        } else {
          this.favoriteList = []
        }
        if (wrongRes.success) {
          this.wrongList = wrongRes.wrongs
        } else {
          this.wrongList = []
        }
      } catch (error) {
        this.listLoadFailed = true
        this.favoriteList = []
        this.wrongList = []
        console.error('加载单词列表失败:', error)
      }
    },

    async loadQuestions(showLoadingMask = false) {
      try {
        this.questionLoadFailed = false
        if (showLoadingMask) showLoading('加载中...')
        const res = await api.getMyQuestions({
          questionType: 'sentence',
          sentenceType: this.selectedSentenceType
        })
        if (showLoadingMask) hideLoading()

        if (res.success) {
          this.sentenceQuestions = (res.questions || []).filter(q => q.question_type === 'sentence')
        } else {
          this.sentenceQuestions = []
        }
        this.questionRevealStates = {}
      } catch (error) {
        if (showLoadingMask) hideLoading()
        this.questionLoadFailed = true
        this.sentenceQuestions = []
        this.questionRevealStates = {}
        console.error('加载收藏题目失败:', error)
        if (showLoadingMask) showToast('加载失败', 'none')
      }
    },

    async loadFavoriteList() {
      try {
        this.listLoadFailed = false
        showLoading('加载中...')
        const res = await api.getFavoriteList({ silentFailToast: true })
        hideLoading()
        
        if (res.success) {
          this.favoriteList = res.favorites
        }
      } catch (error) {
        hideLoading()
        this.listLoadFailed = true
        this.favoriteList = []
        this.wrongList = []
        console.error('加载收藏列表失败:', error)
      }
    },

    async loadWrongList() {
      try {
        this.listLoadFailed = false
        showLoading('加载中...')
        const res = await api.getWrongList({ silentFailToast: true })
        hideLoading()
        
        if (res.success) {
          this.wrongList = res.wrongs
        }
      } catch (error) {
        hideLoading()
        this.listLoadFailed = true
        this.favoriteList = []
        this.wrongList = []
        console.error('加载错题列表失败:', error)
      }
    },

    switchTab(tab) {
      this.activeTab = tab
    },

    async removeFavorite(verbId) {
      try {
        const { confirm } = await uni.showModal({
          title: '提示',
          content: '确定要删除该收藏单词吗？'
        })
        if (!confirm) return

        const res = await api.removeFavorite({ verbId })
        if (res.success) {
          showToast('已取消收藏', 'success')
          this.loadStats()
          this.loadFavoriteList()
        }
      } catch (error) {
        showToast('操作失败', 'none')
      }
    },

    async removeWrong(verbId) {
      try {
        const { confirm } = await uni.showModal({
          title: '提示',
          content: '确定要删除该错题单词吗？'
        })
        if (!confirm) return

        const res = await api.removeWrongVerb({ verbId })
        if (res.success) {
          showToast('已删除', 'success')
          this.loadStats()
          this.loadWrongList()
        }
      } catch (error) {
        showToast('操作失败', 'none')
      }
    },

    // 查看动词完整变位
    viewConjugations(verbId) {
      uni.navigateTo({
        url: `/pages/conjugation-detail/conjugation-detail?verbId=${verbId}`
      })
    },

    startFavoritePractice() {
      if (this.favoriteCount === 0) {
        uni.showModal({
          title: '提示',
          content: '你还没有收藏任何单词哦~\n\n在练习过程中点击星标⭐即可收藏单词，收藏后可以专门练习这些单词。',
          showCancel: false,
          confirmText: '知道了'
        })
        return
      }
      uni.navigateTo({
        url: '/pages/practice/practice?mode=favorite'
      })
    },

    startWrongPractice() {
      if (this.wrongCount === 0) {
        uni.showModal({
          title: '提示',
          content: '你还没有错题记录~太棒了！\n\n在练习中答错的单词会自动加入错题本，之后可以专门练习错过的单词。',
          showCancel: false,
          confirmText: '知道了'
        })
        return
      }
      uni.navigateTo({
        url: '/pages/practice/practice?mode=wrong'
      })
    },

    startQuestionPractice() {
      showToast('收藏题目专练正在开发中', 'none')
    },

    getQuestionRevealState(questionId) {
      return this.questionRevealStates[questionId] || {
        showTranslation: false,
        showAnswer: false
      }
    },

    isQuestionTranslationVisible(questionId) {
      return this.getQuestionRevealState(questionId).showTranslation
    },

    isQuestionAnswerVisible(questionId) {
      return this.getQuestionRevealState(questionId).showAnswer
    },

    toggleQuestionTranslation(questionId) {
      const current = this.getQuestionRevealState(questionId)
      this.questionRevealStates = {
        ...this.questionRevealStates,
        [questionId]: {
          ...current,
          showTranslation: !current.showTranslation
        }
      }
    },

    toggleQuestionAnswer(questionId) {
      const current = this.getQuestionRevealState(questionId)
      this.questionRevealStates = {
        ...this.questionRevealStates,
        [questionId]: {
          ...current,
          showAnswer: !current.showAnswer
        }
      }
    },

    selectSentenceType(index) {
      if (index < 0 || index >= this.sentenceTypeOptions.length) return
      if (this.selectedSentenceTypeIndex === index) return
      this.selectedSentenceTypeIndex = index
      this.loadQuestions(true)
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
      try {
        const { confirm } = await uni.showModal({
          title: '提示',
          content: '确定要删除该收藏题目吗？'
        })
        if (!confirm) return

        const res = await api.unfavoriteQuestion({ privateQuestionId: questionId })
        if (res.success) {
          showToast('已删除', 'success')
          this.loadStats()
          this.loadQuestions()
        }
      } catch (error) {
        showToast('操作失败', 'none')
      }
    },

    formatDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${month}月${day}日`
    },

    formatFavoriteDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${year}年${month}月${day}日`
    },

    formatQuestionDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${year}年${month}月${day}日`
    },

    formatInfinitive(verb) {
      if (!verb) return ''
      return verb.isReflexive ? `${verb.infinitive}(se)` : verb.infinitive
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

/* 统计卡片 */
.stats-card {
  background: #8B0012;
  color: #fff;
  margin-bottom: 30rpx;
}

.stats-row {
  display: flex;
  justify-content: space-around;
}

.stat-item {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 56rpx;
  font-weight: bold;
  margin-bottom: 10rpx;
}

.stat-label {
  display: block;
  font-size: 28rpx;
  opacity: 0.9;
}

.entry-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  transition: transform 0.2s;
  cursor: pointer;
}

.entry-card:active {
  transform: scale(0.98);
}

.entry-icon {
  font-size: 60rpx;
  margin-right: 24rpx;
}

.entry-content {
  flex: 1;
}

.entry-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.entry-desc {
  display: block;
  font-size: 26rpx;
  color: #999;
}

.entry-arrow {
  font-size: 40rpx;
  color: #8B0012;
}

.tab-practice-entry {
  margin-bottom: 30rpx;
}

/* Tab切换 */
.tabs {
  display: flex;
  background: #fff;
  border-radius: 12rpx;
  padding: 8rpx;
  margin-bottom: 30rpx;
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
  background: #8B0012;
  color: #fff;
  font-weight: bold;
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

/* 单词列表 */
.word-list {
  margin-bottom: 40rpx;
}

.question-list {
  margin-bottom: 40rpx;
}

.word-item {
  position: relative;
  margin-bottom: 20rpx;
  padding: 30rpx;
}

.word-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20rpx;
  gap: 20rpx;
}

.word-main {
  flex: 1;
}

.word-infinitive {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.word-meaning {
  display: block;
  font-size: 28rpx;
  color: #666;
}


.word-actions {
  display: flex;
  align-items: center;
  gap: 15rpx;
  flex-wrap: nowrap;
}

.word-header-extra {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  min-width: 160rpx;
}

.word-badges {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
  margin-top: 24rpx;
}

.word-tag {
  background: #f0f0f0;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: #666;
}

.word-tag.reflexive {
  background: #ffe0e0;
  color: #ff6b6b;
}

.word-tag.irregular {
  background: #fff4e6;
  color: #ff8c00;
}

.word-tag.transitive {
  background: #e8f4ff;
  color: #1e88e5;
}

.word-tag.intransitive {
  background: #e8f5e9;
  color: #43a047;
}

.wrong-count {
  background: #fff0f0;
  color: #ff4d4f;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  font-weight: bold;
}

.detail-btn {
  color: #8B0012;
  font-size: 26rpx;
  padding: 8rpx 16rpx;
  background: #fff0f0;
  border-radius: 8rpx;
}

.remove-btn {
  color: #ff4d4f;
  font-size: 26rpx;
  padding: 8rpx 16rpx;
}

.word-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 30rpx;
}

.meta-item {
  font-size: 24rpx;
  color: #999;
}

.question-card {
  margin-bottom: 30rpx;
  padding: 30rpx;
}

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

.question-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
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

.verb-infinitive {
  display: flex;
  align-items: center;
}

.verb-text {
  font-size: 32rpx;
  color: #333;
  font-weight: bold;
}

.question-detail-btn {
  flex-shrink: 0;
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

.question-helper-buttons {
  display: flex;
  gap: 15rpx;
  margin: 25rpx 0 20rpx;
}

.question-helper-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 18rpx 16rpx;
  background: #f5f5f5;
  border: 2rpx solid #d1d9e6;
  border-radius: 50rpx;
  font-size: 26rpx;
  color: #555;
  transition: all 0.3s ease;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  line-height: 1.2;
}

.question-helper-btn::after {
  border: none;
}

.question-helper-btn.active {
  background: #8B0012;
  border-color: #8B0012;
  color: #fff;
  box-shadow: 0 4rpx 12rpx rgba(139, 0, 18, 0.3);
  transform: translateY(-2rpx);
}

.question-helper-icon {
  font-size: 32rpx;
  line-height: 1;
}

.question-reveal-panel {
  animation: questionSlideIn 0.3s ease;
}

.answer-section {
  margin-bottom: 25rpx;
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

.question-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20rpx;
  border-top: 2rpx solid #f0f0f0;
  gap: 20rpx;
}

.footer-info {
  font-size: 24rpx;
  color: #999;
  font-weight: 400;
}

@keyframes questionSlideIn {
  from {
    opacity: 0;
    transform: translateY(-10rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

.load-failed-placeholder {
  min-height: 360rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.load-failed-text {
  font-size: 32rpx;
  color: #d93025;
  font-weight: 600;
}
</style>
