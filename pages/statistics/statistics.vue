<template>
  <view class="container">
    <view class="card stats-overview">
      <text class="title">学习统计</text>
      <view class="stats-grid">
        <view class="stat-box">
          <text class="stat-value">{{ totalStats.total_exercises || 0 }}</text>
          <text class="stat-label">总练习题数</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ totalStats.correct_exercises || 0 }}</text>
          <text class="stat-label">答对题数</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ totalStats.practiced_verbs || 0 }}</text>
          <text class="stat-label">练习过的动词</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ totalStats.practice_days || 0 }}</text>
          <text class="stat-label">练习天数</text>
        </view>
      </view>
    </view>

    <view class="card accuracy-card">
      <text class="subtitle">正确率</text>
      <view class="accuracy-circle">
        <text class="accuracy-value">{{ accuracy }}%</text>
      </view>
    </view>

    <view class="card mastered-card">
      <text class="subtitle">已掌握动词</text>
      <view class="mastered-list">
        <view class="mastered-item" v-for="verb in masteredVerbs" :key="verb.id">
          <view class="verb-name">
            <text class="infinitive">{{ verb.infinitive }}</text>
            <text class="meaning">{{ verb.meaning }}</text>
          </view>
          <view class="mastery-level">
            <text>掌握度: {{ verb.mastery_level }}/5</text>
          </view>
        </view>
        <view class="empty-tip" v-if="masteredVerbs.length === 0">
          <text>还没有掌握的动词，加油练习吧！</text>
        </view>
      </view>
    </view>

    <view class="card recent-records">
      <text class="subtitle">最近练习记录</text>
      <view class="record-list">
        <view class="record-item" v-for="record in recentRecords.slice(0, 10)" :key="record.id">
          <view class="record-verb">
            <text class="verb-text">{{ record.infinitive }}</text>
            <text class="verb-meaning">{{ record.meaning }}</text>
          </view>
          <view class="record-detail">
            <text class="tense-text">{{ record.mood }} {{ record.tense }}</text>
            <text :class="['result-icon', record.is_correct ? 'correct' : 'wrong']">
              {{ record.is_correct ? '✓' : '✗' }}
            </text>
          </view>
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
      recentRecords: []
    }
  },
  computed: {
    accuracy() {
      if (!this.totalStats.total_exercises) return 0
      return Math.round((this.totalStats.correct_exercises / this.totalStats.total_exercises) * 100)
    }
  },
  onShow() {
    // 检查登录状态
    const token = uni.getStorageSync('token')
    if (!token) {
      uni.reLaunch({
        url: '/pages/login/login'
      })
      return
    }
    this.loadData()
  },
  methods: {
    async loadData() {
      try {
        // 获取统计数据
        const statsRes = await api.getStatistics()
        if (statsRes.success) {
          this.totalStats = statsRes.statistics.total || {}
          this.masteredVerbs = statsRes.statistics.masteredVerbs || []
        }

        // 获取练习记录
        const recordsRes = await api.getStudyRecords()
        if (recordsRes.success) {
          this.recentRecords = recordsRes.records || []
        }
      } catch (error) {
        showToast('加载数据失败')
      }
    }
  }
}
</script>

<style scoped>
.stats-overview {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 30rpx;
  margin-top: 20rpx;
}

.stat-box {
  text-align: center;
  padding: 20rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12rpx;
}

.stat-value {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  margin-bottom: 10rpx;
}

.stat-label {
  display: block;
  font-size: 24rpx;
  opacity: 0.9;
}

.accuracy-card {
  text-align: center;
}

.accuracy-circle {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  border: 10rpx solid #667eea;
  margin: 30rpx auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.accuracy-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #667eea;
}

.mastered-list {
  margin-top: 20rpx;
}

.mastered-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.verb-name {
  flex: 1;
}

.infinitive {
  display: block;
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
}

.meaning {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-top: 5rpx;
}

.mastery-level {
  font-size: 24rpx;
  color: #667eea;
}

.empty-tip {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
  font-size: 26rpx;
}

.record-list {
  margin-top: 20rpx;
}

.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.record-verb {
  flex: 1;
}

.verb-text {
  display: block;
  font-size: 28rpx;
  color: #333;
}

.verb-meaning {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 5rpx;
}

.record-detail {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.tense-text {
  font-size: 22rpx;
  color: #666;
}

.result-icon {
  font-size: 32rpx;
  font-weight: bold;
}

.result-icon.correct {
  color: #52c41a;
}

.result-icon.wrong {
  color: #ff4d4f;
}
</style>
