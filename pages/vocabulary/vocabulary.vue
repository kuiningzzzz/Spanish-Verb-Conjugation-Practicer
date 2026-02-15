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

    <!-- 专项练习入口 -->
    <view class="practice-entries">
      <view class="entry-card" @click="startFavoritePractice">
        <view class="entry-icon">⭐</view>
        <view class="entry-content">
          <text class="entry-title">收藏专练</text>
          <text class="entry-desc">练习已收藏的单词</text>
        </view>
        <view class="entry-arrow">→</view>
      </view>

      <view class="entry-card" @click="startWrongPractice">
        <view class="entry-icon">❌</view>
        <view class="entry-content">
          <text class="entry-title">错题专练</text>
          <text class="entry-desc">练习做错的单词</text>
        </view>
        <view class="entry-arrow">→</view>
      </view>

      <view class="entry-card" @click="viewQuestions">
        <view class="entry-icon">📝</view>
        <view class="entry-content">
          <text class="entry-title">收藏题目</text>
          <text class="entry-desc">查看已收藏的填空题和例句题</text>
        </view>
        <view class="entry-arrow">→</view>
      </view>
    </view>

    <!-- Tab切换 -->
    <view class="tabs">
      <view 
        :class="['tab-item', activeTab === 'favorite' ? 'active' : '']" 
        @click="switchTab('favorite')"
      >
        <text>收藏单词 ({{ favoriteCount }})</text>
      </view>
      <view 
        :class="['tab-item', activeTab === 'wrong' ? 'active' : '']" 
        @click="switchTab('wrong')"
      >
        <text>错题单词 ({{ wrongCount }})</text>
      </view>
    </view>

    <!-- 收藏列表 -->
    <view v-if="activeTab === 'favorite'" class="word-list">
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
            <text class="meta-item">收藏于 {{ formatDate(item.created_at) }}</text>
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
      listLoadFailed: false
    }
  },
  onShow() {
    this.scrollToTop()
    // 每次显示页面时刷新数据
    this.loadStats()
    this.loadAllLists()
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
        showLoading('加载中...')
        const [favoriteRes, wrongRes] = await Promise.all([
          api.getFavoriteList({ silentFailToast: true }),
          api.getWrongList({ silentFailToast: true })
        ])
        hideLoading()

        if (favoriteRes.success) {
          this.favoriteList = favoriteRes.favorites
        }
        if (wrongRes.success) {
          this.wrongList = wrongRes.wrongs
        }
      } catch (error) {
        hideLoading()
        this.listLoadFailed = true
        this.favoriteList = []
        this.wrongList = []
        console.error('加载单词列表失败:', error)
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

    viewQuestions() {
      if (this.questionCount === 0) {
        showToast('还没有收藏题目', 'none')
        return
      }
      uni.navigateTo({
        url: '/pages/question-bank/question-bank'
      })
    },

    formatDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${month}月${day}日`
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

/* 专项练习入口 */
.practice-entries {
  margin-bottom: 30rpx;
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

/* 单词列表 */
.word-list {
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
