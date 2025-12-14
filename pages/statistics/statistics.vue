<template>
  <view class="container">
    <!-- 页面标题 -->
    <view class="page-header">
      <text class="page-title">学习统计</text>
      <text class="page-subtitle">记录你的每一次进步</text>
    </view>

    <!-- 总体统计 -->
    <view class="overview-section">
      <view class="stats-grid">
        <view class="stat-card" v-for="stat in mainStats" :key="stat.key">
          <view class="stat-icon" :style="{ background: stat.color }">
            <text>{{ stat.icon }}</text>
          </view>
          <view class="stat-content">
            <text class="stat-value">{{ stat.value }}</text>
            <text class="stat-label">{{ stat.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 正确率环形图 -->
    <view class="accuracy-section">
      <view class="accuracy-card">
        <text class="section-title">正确率分析</text>
        <view class="accuracy-chart">
          <view class="circle-progress" :style="circleStyle">
            <view class="progress-mask">
              <text class="accuracy-value">{{ accuracy }}%</text>
              <text class="accuracy-label">总体正确率</text>
            </view>
          </view>
          <view class="accuracy-details">
            <view class="detail-item correct">
              <text class="detail-icon">✅</text>
              <view class="detail-content">
                <text class="detail-value">{{ totalStats.correct_exercises || 0 }}</text>
                <text class="detail-label">答对题数</text>
              </view>
            </view>
            <view class="detail-item total">
              <text class="detail-icon">📝</text>
              <view class="detail-content">
                <text class="detail-value">{{ totalStats.total_exercises || 0 }}</text>
                <text class="detail-label">总练习题数</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 学习趋势 -->
    <view class="trend-section">
      <view class="trend-card">
        <view class="section-header">
          <text class="section-title">学习趋势</text>
          <view class="time-filters">
            <text 
              v-for="filter in timeFilters" 
              :key="filter.value"
              :class="['time-filter', activeTimeFilter === filter.value ? 'active' : '']"
              @click="switchTimeFilter(filter.value)"
            >
              {{ filter.label }}
            </text>
          </view>
        </view>
        <view class="trend-chart">
          <!-- 这里可以集成图表组件 -->
          <view class="chart-placeholder">
            <text class="chart-icon">📊</text>
            <text class="chart-text">学习趋势图表</text>
            <text class="chart-desc">展示最近学习进度和正确率变化</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 已掌握动词 -->
    <view class="mastered-section">
      <view class="mastered-card">
        <view class="section-header">
          <text class="section-title">已掌握动词</text>
          <text class="section-count">{{ masteredVerbs.length }} 个</text>
        </view>
        <view class="mastered-list">
          <view 
            class="mastered-item" 
            v-for="verb in masteredVerbs.slice(0, 6)" 
            :key="verb.id"
          >
            <view class="verb-avatar" :style="{ background: getVerbColor(verb.mastery_level) }">
              <text class="verb-icon">📖</text>
            </view>
            <view class="verb-content">
              <text class="verb-name">{{ verb.infinitive }}</text>
              <text class="verb-meaning">{{ verb.meaning }}</text>
            </view>
            <view class="mastery-level">
              <view class="level-stars">
                <text 
                  v-for="star in 5" 
                  :key="star"
                  class="star"
                  :class="{ filled: star <= verb.mastery_level }"
                >
                  {{ star <= verb.mastery_level ? '⭐' : '☆' }}
                </text>
              </view>
              <text class="level-text">掌握度 {{ verb.mastery_level }}/5</text>
            </view>
          </view>
        </view>
        <view class="view-all" v-if="masteredVerbs.length > 6" @click="viewAllMastered">
          <text>查看全部 {{ masteredVerbs.length }} 个动词</text>
          <text class="view-arrow">→</text>
        </view>
        <view class="empty-mastered" v-else-if="masteredVerbs.length === 0">
          <text class="empty-icon">📚</text>
          <text class="empty-text">还没有掌握的动词</text>
          <text class="empty-desc">加油练习，争取早日掌握！</text>
        </view>
      </view>
    </view>

    <!-- 练习记录 -->
    <view class="records-section">
      <view class="records-card">
        <view class="section-header">
          <text class="section-title">最近练习记录</text>
          <text class="section-count">最近10条</text>
        </view>
        <view class="records-list">
          <view 
            class="record-item" 
            v-for="record in recentRecords.slice(0, 10)" 
            :key="record.id"
          >
            <view class="record-icon" :class="record.is_correct ? 'correct' : 'wrong'">
              <text>{{ record.is_correct ? '✓' : '✗' }}</text>
            </view>
            <view class="record-content">
              <text class="record-verb">{{ record.infinitive }}</text>
              <text class="record-details">{{ record.mood }} {{ record.tense }} · {{ record.person }}</text>
            </view>
            <view class="record-time">{{ formatTime(record.created_at) }}</view>
          </view>
        </view>
        <view class="empty-records" v-if="recentRecords.length === 0">
          <text class="empty-icon">📝</text>
          <text class="empty-text">还没有练习记录</text>
          <text class="empty-desc">开始你的第一次练习吧！</text>
        </view>
      </view>
    </view>

    <!-- 学习建议 -->
    <view class="suggestion-section">
      <view class="suggestion-card">
        <text class="suggestion-icon">💡</text>
        <view class="suggestion-content">
          <text class="suggestion-title">学习建议</text>
          <text class="suggestion-text">{{ learningSuggestion }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast } from '@/utils/common.js'

export default {
  data() {
    return {
      totalStats: {},
      masteredVerbs: [],
      recentRecords: [],
      activeTimeFilter: 'week',
      timeFilters: [
        { value: 'week', label: '本周' },
        { value: 'month', label: '本月' },
        { value: 'all', label: '全部' }
      ],
      learningSuggestion: ''
    }
  },
  computed: {
    accuracy() {
      if (!this.totalStats.total_exercises) return 0
      return Math.round((this.totalStats.correct_exercises / this.totalStats.total_exercises) * 100)
    },
    circleStyle() {
      const circumference = 2 * Math.PI * 70
      const offset = circumference - (this.accuracy / 100) * circumference
      return {
        'background': `conic-gradient(#667eea ${this.accuracy}%, #f0f0f0 ${this.accuracy}% 100%)`
      }
    },
    mainStats() {
      return [
        {
          key: 'total',
          icon: '📝',
          label: '总练习题数',
          value: this.totalStats.total_exercises || 0,
          color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        },
        {
          key: 'mastered',
          icon: '🎯',
          label: '掌握动词',
          value: this.masteredVerbs.length || 0,
          color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
        },
        {
          key: 'verbs',
          icon: '📚',
          label: '练习动词',
          value: this.totalStats.practiced_verbs || 0,
          color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
        },
        {
          key: 'days',
          icon: '📅',
          label: '练习天数',
          value: this.totalStats.practice_days || 0,
          color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        }
      ]
    }
  },
  onShow() {
    const token = uni.getStorageSync('token')
    if (!token) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.loadData()
    this.generateSuggestion()
  },
  methods: {
    async loadData() {
      try {
        const statsRes = await api.getStatistics()
        if (statsRes.success) {
          this.totalStats = statsRes.statistics.total || {}
          this.masteredVerbs = statsRes.statistics.masteredVerbs || []
        }

        const recordsRes = await api.getStudyRecords()
        if (recordsRes.success) {
          this.recentRecords = recordsRes.records || []
        }
      } catch (error) {
        showToast('加载数据失败')
      }
    },
    switchTimeFilter(filter) {
      this.activeTimeFilter = filter
      // 这里可以加载对应时间范围的数据
    },
    getVerbColor(level) {
      const colors = [
        'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
        'linear-gradient(135deg, #ffa726 0%, #ff9800 100%)',
        'linear-gradient(135deg, #ffee58 0%, #fdd835 100%)',
        'linear-gradient(135deg, #9ccc65 0%, #7cb342 100%)',
        'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)'
      ]
      return colors[level - 1] || colors[0]
    },
    formatTime(timeStr) {
      if (!timeStr) return ''
      const date = new Date(timeStr)
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    },
    viewAllMastered() {
      // 跳转到详细掌握动词页面
      uni.navigateTo({
        url: '/pages/mastered-verbs/mastered-verbs'
      })
    },
    generateSuggestion() {
      const accuracy = this.accuracy
      const suggestions = [
        '继续保持当前的学习节奏，每天坚持练习！',
        '正确率不错，可以尝试挑战更高难度的题目！',
        '多练习错题，巩固薄弱环节，提升会更快！',
        '每天坚持打卡，养成良好的学习习惯！',
        '尝试不同类型的练习，全面提升动词变位能力！'
      ]
      this.learningSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)]
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow-x: hidden;
}

.page-header {
  padding: 80rpx 40rpx 30rpx;
  text-align: center;
}

.page-title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 10rpx;
}

.page-subtitle {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

/* 总体统计 */
.overview-section {
  padding: 0 40rpx 30rpx;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.stat-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20rpx;
  padding: 30rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4rpx;
  background: inherit;
}

.stat-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: #fff;
}

.stat-content {
  flex: 1;
}

.stat-value {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 5rpx;
}

.stat-label {
  display: block;
  font-size: 24rpx;
  color: #666;
}

/* 正确率分析 */
.accuracy-section {
  padding: 0 40rpx 30rpx;
}

.accuracy-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 25rpx;
  padding: 40rpx;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 30rpx;
}

.accuracy-chart {
  display: flex;
  align-items: center;
  gap: 40rpx;
}

.circle-progress {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-mask {
  width: 160rpx;
  height: 160rpx;
  background: #fff;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.accuracy-value {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.accuracy-label {
  font-size: 24rpx;
  color: #666;
}

.accuracy-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 15rpx;
  padding: 20rpx;
  background: #f8f9fa;
  border-radius: 15rpx;
}

.detail-icon {
  font-size: 32rpx;
}

.detail-content {
  flex: 1;
}

.detail-value {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 5rpx;
}

.detail-label {
  display: block;
  font-size: 22rpx;
  color: #666;
}

/* 学习趋势 */
.trend-section {
  padding: 0 40rpx 30rpx;
}

.trend-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 25rpx;
  padding: 40rpx;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.time-filters {
  display: flex;
  gap: 20rpx;
}

.time-filter {
  padding: 12rpx 20rpx;
  background: #f8f9fa;
  border-radius: 15rpx;
  font-size: 24rpx;
  color: #666;
  transition: all 0.3s ease;
}

.time-filter.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.trend-chart {
  height: 300rpx;
  background: #f8f9fa;
  border-radius: 15rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.chart-placeholder {
  text-align: center;
}

.chart-icon {
  font-size: 60rpx;
  display: block;
  margin-bottom: 15rpx;
}

.chart-text {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 10rpx;
}

.chart-desc {
  display: block;
  font-size: 22rpx;
  color: #666;
}

/* 已掌握动词 */
.mastered-section {
  padding: 0 40rpx 30rpx;
}

.mastered-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 25rpx;
  padding: 40rpx;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.section-count {
  font-size: 24rpx;
  color: #666;
  background: #f8f9fa;
  padding: 8rpx 16rpx;
  border-radius: 12rpx;
}

.mastered-list {
  margin-bottom: 30rpx;
}

.mastered-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 25rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.mastered-item:last-child {
  border-bottom: none;
}

.verb-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #fff;
}

.verb-content {
  flex: 1;
}

.verb-name {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 5rpx;
}

.verb-meaning {
  display: block;
  font-size: 22rpx;
  color: #666;
}

.mastery-level {
  text-align: right;
}

.level-stars {
  margin-bottom: 5rpx;
}

.star {
  font-size: 20rpx;
  margin: 0 2rpx;
}

.star.filled {
  color: #ffc107;
}

.level-text {
  font-size: 20rpx;
  color: #666;
}

.view-all {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 20rpx;
  background: #f8f9fa;
  border-radius: 15rpx;
  color: #667eea;
  font-size: 26rpx;
  font-weight: 500;
}

.view-arrow {
  font-size: 24rpx;
  transition: transform 0.3s ease;
}

.view-all:active .view-arrow {
  transform: translateX(10rpx);
}

.empty-mastered, .empty-records {
  padding: 60rpx 40rpx;
  text-align: center;
}

.empty-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 20rpx;
}

.empty-text {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 10rpx;
  font-weight: 500;
}

.empty-desc {
  display: block;
  font-size: 24rpx;
  color: #666;
}

/* 练习记录 */
.records-section {
  padding: 0 40rpx 30rpx;
}

.records-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 25rpx;
  padding: 40rpx;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.records-list {
  max-height: 400rpx;
  overflow-y: auto;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.record-item:last-child {
  border-bottom: none;
}

.record-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: 15rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
  color: #fff;
}

.record-icon.correct {
  background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
}

.record-icon.wrong {
  background: linear-gradient(135deg, #f44336 0%, #ef5350 100%);
}

.record-content {
  flex: 1;
}

.record-verb {
  display: block;
  font-size: 26rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 5rpx;
}

.record-details {
  display: block;
  font-size: 22rpx;
  color: #666;
}

.record-time {
  font-size: 22rpx;
  color: #999;
}

/* 学习建议 */
.suggestion-section {
  padding: 0 40rpx 40rpx;
}

.suggestion-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 25rpx;
  padding: 30rpx;
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  box-shadow: 0 15rpx 30rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  border-left: 6rpx solid #667eea;
}

.suggestion-icon {
  font-size: 36rpx;
  margin-top: 5rpx;
}

.suggestion-content {
  flex: 1;
}

.suggestion-title {
  display: block;
  font-size: 26rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.suggestion-text {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
}
</style>