<template>
  <view class="container">
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        :class="['tab-item', activeTab === tab.value ? 'active' : '']"
        @click="switchTab(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <view class="card leaderboard-card">
      <view class="rank-list">
        <view class="rank-item" v-for="(user, index) in leaderboard" :key="user.id">
          <view class="rank-number" :class="getRankClass(index)">
            <text v-if="index < 3">{{ ['🥇', '🥈', '🥉'][index] }}</text>
            <text v-else>{{ index + 1 }}</text>
          </view>
          <view class="user-info">
            <text class="username">{{ user.username }}</text>
            <text class="school" v-if="user.school">{{ user.school }}</text>
          </view>
          <view class="user-stats">
            <text class="check-in-days">连续打卡 {{ user.check_in_days }} 天</text>
            <text class="exercise-count">练习 {{ user.total_exercises }} 题</text>
          </view>
        </view>

        <view class="empty-tip" v-if="leaderboard.length === 0">
          <text>暂无排行数据</text>
        </view>
      </view>
    </view>

    <view class="tips card">
      <text class="tip-title">💡 小提示</text>
      <text class="tip-content">每天坚持练习和打卡，可以提升排名哦！</text>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast, showLoading, hideLoading } from '@/utils/common.js'

export default {
  data() {
    return {
      tabs: [
        { value: 'week', label: '周榜' },
        { value: 'month', label: '月榜' },
        { value: 'all', label: '总榜' }
      ],
      activeTab: 'week',
      leaderboard: []
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
    this.loadLeaderboard()
  },
  methods: {
    switchTab(tab) {
      this.activeTab = tab
      this.loadLeaderboard()
    },
    async loadLeaderboard() {
      showLoading('加载中...')

      try {
        const res = await api.getLeaderboard(this.activeTab)
        hideLoading()

        if (res.success) {
          this.leaderboard = res.leaderboard || []
        }
      } catch (error) {
        hideLoading()
        showToast('加载失败')
      }
    },
    getRankClass(index) {
      if (index === 0) return 'gold'
      if (index === 1) return 'silver'
      if (index === 2) return 'bronze'
      return ''
    }
  }
}
</script>

<style scoped>
.tab-bar {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  padding: 10rpx;
  margin-bottom: 20rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #666;
  transition: all 0.3s;
}

.tab-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: bold;
}

.rank-list {
  margin-top: 20rpx;
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 25rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.rank-number {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
  background: #f5f5f5;
  color: #999;
  margin-right: 20rpx;
}

.rank-number.gold {
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  color: #fff;
}

.rank-number.silver {
  background: linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%);
  color: #fff;
}

.rank-number.bronze {
  background: linear-gradient(135deg, #cd7f32 0%, #e8b880 100%);
  color: #fff;
}

.user-info {
  flex: 1;
}

.username {
  display: block;
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
}

.school {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 5rpx;
}

.user-stats {
  text-align: right;
}

.check-in-days {
  display: block;
  font-size: 24rpx;
  color: #667eea;
  font-weight: bold;
}

.exercise-count {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 5rpx;
}

.empty-tip {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
  font-size: 26rpx;
}

.tips {
  background: #fff9e6;
  border-left: 4rpx solid #faad14;
}

.tip-title {
  display: block;
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
  margin-bottom: 10rpx;
}

.tip-content {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
}
</style>
