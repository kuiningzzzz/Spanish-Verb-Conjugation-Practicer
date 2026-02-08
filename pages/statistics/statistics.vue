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
          <view class="chart-container" v-if="trendData.length > 0">
            <view class="chart-bars">
              <view 
                class="bar-item" 
                v-for="(item, index) in trendData" 
                :key="index"
              >
                <view class="bar-wrapper">
                  <view class="bar-count">{{ item.count }}</view>
                  <view 
                    class="bar" 
                    :style="{ height: getBarHeight(item.count) + '%', background: '#8B0012' }"
                  >
                  </view>
                </view>
                <view class="bar-label">{{ item.label }}</view>
              </view>
            </view>
          </view>
          <view class="chart-placeholder" v-else>
            <text class="chart-icon">📊</text>
            <text class="chart-text">暂无数据</text>
            <text class="chart-desc">开始练习后将显示学习趋势</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 已掌握动词 -->
    <view class="mastered-section">
      <view class="mastered-card">
        <view class="section-header">
          <text class="section-title">已掌握动词</text>
          <view class="header-actions">
            <text class="criteria-btn" @click="showCriteriaModal">评判标准</text>
            <text class="section-count">{{ masteredVerbs.length }} 个</text>
          </view>
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
            class="record-item record-clickable" 
            v-for="record in recentRecords.slice(0, 10)" 
            :key="record.id"
            @click="viewVerbDetail(record)"
          >
            <view class="record-icon" :class="record.is_correct ? 'correct' : 'wrong'">
              <text>{{ record.is_correct ? '✓' : '✗' }}</text>
            </view>
            <view class="record-content">
              <text class="record-verb">{{ record.infinitive || '未知动词' }}</text>
              <text class="record-details">{{ record.mood || '' }} {{ record.tense || '' }}{{ record.person ? ' · ' + record.person : '' }}</text>
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

    <!-- 掌握度评判标准弹窗 -->
    <view v-if="showCriteria" class="modal-overlay" @click="closeCriteriaModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">🎯 掌握度评判标准</text>
          <view class="close-btn" @click="closeCriteriaModal">✕</view>
        </view>
        
        <view class="criteria-list">
          <view class="criteria-item">
            <view class="criteria-level level-5">
              <text class="level-icon">⭐⭐⭐⭐⭐</text>
              <text class="level-name">精通 (5级)</text>
            </view>
            <view class="criteria-desc">
              <text class="criteria-condition">条件：练习次数 ≥ 5次 且 正确率 ≥ 80%</text>
              <text class="criteria-note">对该动词已非常熟练，几乎不会出错</text>
            </view>
          </view>

          <view class="criteria-item">
            <view class="criteria-level level-4">
              <text class="level-icon">⭐⭐⭐⭐</text>
              <text class="level-name">熟练 (4级)</text>
            </view>
            <view class="criteria-desc">
              <text class="criteria-condition">条件：练习次数 ≥ 4次 且 正确率 ≥ 70%</text>
              <text class="criteria-note">对该动词已熟练掌握，偶尔可能出错</text>
            </view>
          </view>

          <view class="criteria-item">
            <view class="criteria-level level-3">
              <text class="level-icon">⭐⭐⭐</text>
              <text class="level-name">掌握 (3级)</text>
            </view>
            <view class="criteria-desc">
              <text class="criteria-condition">条件：练习次数 ≥ 3次 且 正确率 ≥ 60%</text>
              <text class="criteria-note">已基本掌握该动词，需要继续巩固</text>
            </view>
          </view>

          <view class="criteria-item">
            <view class="criteria-level level-2">
              <text class="level-icon">⭐⭐</text>
              <text class="level-name">熟悉 (2级)</text>
            </view>
            <view class="criteria-desc">
              <text class="criteria-condition">条件：正确率 ≥ 50%</text>
              <text class="criteria-note">对该动词有一定了解，还需多练习</text>
            </view>
          </view>

          <view class="criteria-item">
            <view class="criteria-level level-1">
              <text class="level-icon">⭐</text>
              <text class="level-name">初学 (1级)</text>
            </view>
            <view class="criteria-desc">
              <text class="criteria-condition">条件：正确率 < 50%</text>
              <text class="criteria-note">刚开始学习该动词，需要多加练习</text>
            </view>
          </view>
        </view>

        <view class="criteria-footer">
          <text class="footer-note">💡 提示：系统会根据你的练习表现自动评定掌握度等级</text>
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
        { value: 'week', label: '近7天' },
        { value: 'month', label: '近30天' },
        { value: 'year', label: '近一年' }
      ],
      trendData: [],  // 趋势数据
      showCriteria: false  // 是否显示评判标准弹窗
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
        'background': `conic-gradient(#8B0012 ${this.accuracy}%, #f0f0f0 ${this.accuracy}% 100%)`
      }
    },
    mainStats() {
      return [
        {
          key: 'total',
          icon: '📝',
          label: '总练习题数',
          value: this.totalStats.total_exercises || 0,
          color: '#8B0012'
        },
        {
          key: 'mastered',
          icon: '🎯',
          label: '掌握动词',
          value: this.masteredVerbs.length || 0,
          color: '#D4A04A'
        },
        {
          key: 'verbs',
          icon: '📚',
          label: '练习动词',
          value: this.totalStats.practiced_verbs || 0,
          color: '#4CAF50'
        },
        {
          key: 'days',
          icon: '📅',
          label: '练习天数',
          value: this.totalStats.practice_days || 0,
          color: '#FF9800'
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
        
        // 加载趋势数据
        await this.loadTrendData()
      } catch (error) {
        showToast('加载数据失败')
      }
    },
    async loadTrendData() {
      try {
        const res = await api.getStudyTrend(this.activeTimeFilter)
        if (res.success) {
          this.trendData = res.trend || []
        }
      } catch (error) {
        console.error('加载趋势数据失败:', error)
      }
    },
    switchTimeFilter(filter) {
      this.activeTimeFilter = filter
      this.loadTrendData()
    },
    getMaxValue() {
      if (this.trendData.length === 0) return 10
      const max = Math.max(...this.trendData.map(d => d.count))
      return max > 0 ? max : 10
    },
    getBarHeight(count) {
      const max = this.getMaxValue()
      return Math.max((count / max) * 100, 2) // 最小高度2%，避免为0时看不见
    },
    getVerbColor(level) {
      const colors = [
        '#ff6b6b',
        '#ffa726',
        '#ffee58',
        '#9ccc65',
        '#66bb6a'
      ]
      return colors[level - 1] || colors[0]
    },
    formatTime(timeStr) {
      if (!timeStr) return ''
      // 正确解析本地时间字符串 '2025-12-17 21:30:45'
      // 不能直接用 new Date(timeStr)，因为它会当作UTC时间
      let date
      if (timeStr.includes(' ')) {
        // 格式：'2025-12-17 21:30:45'
        const [datePart, timePart] = timeStr.split(' ')
        const [year, month, day] = datePart.split('-').map(Number)
        const [hour, minute, second] = timePart.split(':').map(Number)
        date = new Date(year, month - 1, day, hour, minute, second)
      } else {
        // 其他格式尝试直接解析
        date = new Date(timeStr)
      }
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    },
    viewAllMastered() {
      uni.showModal({
        title: '已掌握动词',
        content: `共掌握 ${this.masteredVerbs.length} 个动词\n\n包括：${this.masteredVerbs.slice(0, 5).map(v => v.infinitive).join('、')}${this.masteredVerbs.length > 5 ? ' 等' : ''}`,
        showCancel: false
      })
    },
    viewVerbDetail(record) {
      if (!record || !record.verb_id) {
        showToast('动词信息不完整')
        return
      }
      uni.navigateTo({
        url: `/pages/conjugation-detail/conjugation-detail?verbId=${record.verb_id}`
      })
    },
    showCriteriaModal() {
      this.showCriteria = true
    },
    closeCriteriaModal() {
      this.showCriteria = false
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #8B0012;
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
  background: #8B0012;
  color: #fff;
}

.trend-chart {
  min-height: 300rpx;
  background: #f8f9fa;
  border-radius: 15rpx;
  padding: 30rpx 20rpx 60rpx;
  overflow: hidden;
}

.chart-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.chart-bars {
  width: 100%;
  height: 240rpx;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6rpx;
  padding-bottom: 50rpx;
  position: relative;
}

.bar-item {
  flex: 1;
  min-width: 30rpx;
  max-width: 80rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.bar-wrapper {
  width: 100%;
  height: 180rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
}

.bar-count {
  position: absolute;
  top: -25rpx;
  font-size: 18rpx;
  color: #666;
  font-weight: bold;
  white-space: nowrap;
}

.bar {
  width: 100%;
  min-height: 4rpx;
  background: #8B0012;
  border-radius: 4rpx 4rpx 0 0;
  transition: all 0.3s ease;
  box-shadow: 0 -2rpx 8rpx rgba(139, 0, 18, 0.2);
}

.bar-label {
  position: absolute;
  bottom: -45rpx;
  left: 50%;
  font-size: 18rpx;
  color: #666;
  white-space: nowrap;
  transform: translateX(-50%) rotate(-45deg);
  transform-origin: center center;
  text-align: center;
}

.chart-placeholder {
  text-align: center;
  padding: 60rpx 0;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 15rpx;
}

.criteria-btn {
  font-size: 24rpx;
  color: #8B0012;
  background: rgba(139, 0, 18, 0.1);
  padding: 8rpx 16rpx;
  border-radius: 12rpx;
  font-weight: 500;
  transition: all 0.3s ease;
}

.criteria-btn:active {
  background: rgba(139, 0, 18, 0.2);
  transform: scale(0.95);
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
  color: #8B0012;
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

.record-clickable {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 12rpx;
  margin: 0 -15rpx;
  padding: 20rpx 15rpx;
}

.record-clickable:hover {
  background: rgba(102, 126, 234, 0.05);
  transform: translateX(5rpx);
}

.record-clickable:active {
  background: rgba(102, 126, 234, 0.1);
  transform: scale(0.98);
  transition: all 0.1s ease;
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
  background: #4caf50;
}

.record-icon.wrong {
  background: #f44336;
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

/* 掌握度评判标准弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 60rpx;
}

.modal-content {
  background: #fff;
  border-radius: 24rpx;
  padding: 0;
  max-height: 80vh;
  overflow-y: auto;
  width: 100%;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100rpx);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 40rpx;
  border-bottom: 1rpx solid #f0f0f0;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}

.modal-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.close-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f5f5f5;
  font-size: 36rpx;
  color: #666;
  font-weight: bold;
  transition: all 0.3s;
}

.close-btn:active {
  background: #e8e8e8;
  transform: scale(0.95);
}

.criteria-list {
  padding: 30rpx 40rpx;
}

.criteria-item {
  margin-bottom: 30rpx;
  padding: 30rpx;
  background: #f8f9fa;
  border-radius: 16rpx;
  border-left: 6rpx solid #8B0012;
}

.criteria-item:last-child {
  margin-bottom: 0;
}

.criteria-level {
  display: flex;
  align-items: center;
  gap: 15rpx;
  margin-bottom: 15rpx;
}

.level-icon {
  font-size: 24rpx;
}

.level-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.level-5 {
  color: #ffc107;
}

.level-4 {
  color: #4caf50;
}

.level-3 {
  color: #2196f3;
}

.level-2 {
  color: #ff9800;
}

.level-1 {
  color: #9e9e9e;
}

.criteria-desc {
  padding-left: 40rpx;
}

.criteria-condition {
  display: block;
  font-size: 26rpx;
  color: #8B0012;
  font-weight: 500;
  margin-bottom: 10rpx;
}

.criteria-note {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
}

.criteria-footer {
  padding: 30rpx 40rpx;
  background: #fffbf0;
  border-top: 1rpx solid #f0f0f0;
}

.footer-note {
  font-size: 24rpx;
  color: #999;
  line-height: 1.6;
}
</style>