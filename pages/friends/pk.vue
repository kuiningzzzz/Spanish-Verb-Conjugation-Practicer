<template>
  <view class="container">
    <view v-if="loading" class="loading">加载中...</view>
    
    <view v-else class="pk-content">
      <!-- 标题 -->
      <view class="pk-header">
        <text class="pk-title">数值对决</text>
        <text class="pk-subtitle">五项数据巅峰对决</text>
      </view>

      <!-- 雷达图区域 -->
      <view class="radar-section">
        <view class="radar-container">
          <!-- 好友雷达图 -->
          <view class="radar-side">
            <text class="side-title">{{ friendData.username }}</text>
            <canvas 
              canvas-id="friendRadar" 
              id="friendRadar"
              class="radar-canvas"
            ></canvas>
          </view>

          <!-- VS标志 -->
          <view class="vs-badge">
            <text class="vs-text">VS</text>
          </view>

          <!-- 自己的雷达图 -->
          <view class="radar-side">
            <text class="side-title">我</text>
            <canvas 
              canvas-id="myRadar" 
              id="myRadar"
              class="radar-canvas"
            ></canvas>
          </view>
        </view>
      </view>

      <!-- 数据对比区域 -->
      <view class="compare-section">
        <!-- 总胜负 -->
        <view class="result-badge" :class="resultClass">
          <text class="result-text">{{ resultText }}</text>
          <text class="result-score">{{ friendWins }} : {{ myWins }}</text>
        </view>

        <!-- 详细对比 -->
        <view class="compare-list">
          <view 
            v-for="(item, index) in compareItems" 
            :key="index"
            class="compare-item"
          >
            <view class="compare-left" :class="{ 'winner': item.friendWin }">
              <text class="value">{{ item.friendValue }}</text>
              <text v-if="item.friendWin" class="win-badge">✓</text>
            </view>
            
            <view class="compare-center">
              <text class="label">{{ item.label }}</text>
              <text v-if="item.draw" class="draw-text">平局</text>
            </view>
            
            <view class="compare-right" :class="{ 'winner': item.myWin }">
              <text v-if="item.myWin" class="win-badge">✓</text>
              <text class="value">{{ item.myValue }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部按钮 -->
      <view class="actions">
        <button class="btn-back" @click="goBack">返回</button>
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
      friendId: null,
      loading: false,
      friendData: {},
      myData: {},
      compareItems: [],
      friendWins: 0,
      myWins: 0
    }
  },
  computed: {
    resultText() {
      if (this.friendWins > this.myWins) {
        return '对方胜利'
      } else if (this.myWins > this.friendWins) {
        return '我方胜利'
      } else {
        return '平局'
      }
    },
    resultClass() {
      if (this.friendWins > this.myWins) {
        return 'result-lose'
      } else if (this.myWins > this.friendWins) {
        return 'result-win'
      } else {
        return 'result-draw'
      }
    }
  },
  onLoad(options) {
    if (options.friendId) {
      this.friendId = parseInt(options.friendId)
      this.loadPKData()
    }
  },
  methods: {
    async loadPKData() {
      this.loading = true
      try {
        // 获取好友数据
        const friendRes = await api.getFriendDetails(this.friendId)
        // 获取自己的统计数据
        const myStatsRes = await api.getUserStats()

        if (friendRes.success && myStatsRes.success) {
          this.friendData = {
            username: friendRes.friend.username,
            stats: friendRes.friend.stats
          }
          this.myData = {
            username: '我',
            stats: myStatsRes.stats
          }
          
          console.log('好友数据:', this.friendData)
          console.log('我的数据:', this.myData)
          
          this.compareData()
          // 延迟绘制雷达图，确保canvas已经渲染
          setTimeout(() => {
            this.drawRadar()
          }, 300)
        }
      } catch (error) {
        console.error('加载PK数据失败:', error)
        showToast('加载失败', 'none')
      } finally {
        this.loading = false
      }
    },
    compareData() {
      const items = [
        {
          label: '总练习',
          key: 'total_exercises',
          friendValue: this.friendData.stats.total_exercises,
          myValue: this.myData.stats.total_exercises
        },
        {
          label: '答对题目',
          key: 'correct_count',
          friendValue: this.friendData.stats.correct_count,
          myValue: this.myData.stats.correct_count
        },
        {
          label: '正确率',
          key: 'accuracy',
          friendValue: this.friendData.stats.accuracy,
          myValue: this.myData.stats.accuracy,
          unit: '%'
        },
        {
          label: '累计打卡',
          key: 'total_check_in_days',
          friendValue: this.friendData.stats.total_check_in_days,
          myValue: this.myData.stats.total_check_in_days
        },
        {
          label: '连续打卡',
          key: 'streak_days',
          friendValue: this.friendData.stats.streak_days,
          myValue: this.myData.stats.streak_days
        }
      ]

      this.friendWins = 0
      this.myWins = 0

      this.compareItems = items.map(item => {
        const friendWin = item.friendValue > item.myValue
        const myWin = item.myValue > item.friendValue
        const draw = item.friendValue === item.myValue

        if (friendWin) this.friendWins++
        if (myWin) this.myWins++

        return {
          ...item,
          friendWin,
          myWin,
          draw,
          friendValue: item.unit ? `${item.friendValue}${item.unit}` : item.friendValue,
          myValue: item.unit ? `${item.myValue}${item.unit}` : item.myValue
        }
      })
    },
    drawRadar() {
      console.log('开始绘制雷达图')
      console.log('好友统计:', this.friendData.stats)
      console.log('我的统计:', this.myData.stats)
      this.drawRadarChart('friendRadar', this.friendData.stats, '#8B0012')
      this.drawRadarChart('myRadar', this.myData.stats, '#FF6B6B')
    },
    drawRadarChart(canvasId, stats, color) {
      console.log(`绘制雷达图: ${canvasId}`, stats)
      const ctx = uni.createCanvasContext(canvasId, this)
      
      // 获取canvas实际尺寸（rpx转px）
      const query = uni.createSelectorQuery().in(this)
      query.select(`#${canvasId}`).boundingClientRect(rect => {
        if (!rect) {
          console.error('Canvas元素未找到:', canvasId)
          return
        }
        
        console.log(`Canvas ${canvasId} 尺寸:`, rect)
        
        const canvasWidth = rect.width
        const canvasHeight = rect.height
        const centerX = canvasWidth / 2
        const centerY = canvasHeight / 2
        const radius = Math.min(canvasWidth, canvasHeight) / 2 - 20

        // 数据归一化（转换为0-100的比例）
        const maxValues = {
          total_exercises: 200,
          correct_count: 160,
          accuracy: 95,
          total_check_in_days: 30,
          streak_days: 10
        }

        const values = [
          Math.min(100, (stats.total_exercises / maxValues.total_exercises) * 100),
          Math.min(100, (stats.correct_count / maxValues.correct_count) * 100),
          Math.min(100, (stats.accuracy / maxValues.accuracy) * 100),
          Math.min(100, (stats.total_check_in_days / maxValues.total_check_in_days) * 100),
          Math.min(100, (stats.streak_days / maxValues.streak_days) * 100)
        ]

        // 清空画布
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)

        // 绘制背景网格（5层）
        ctx.setLineWidth(0.5)
        ctx.setStrokeStyle('#E5E5E5')
        for (let i = 1; i <= 5; i++) {
          const r = radius * (i / 5)
          this.drawPentagon(ctx, centerX, centerY, r)
        }

        // 绘制五条轴线
        ctx.setLineWidth(0.5)
        ctx.setStrokeStyle('#CCCCCC')
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
          const x = centerX + Math.cos(angle) * radius
          const y = centerY + Math.sin(angle) * radius
          ctx.moveTo(centerX, centerY)
          ctx.lineTo(x, y)
        }
        ctx.stroke()

        // 绘制数据区域
        ctx.beginPath()
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
          const value = values[i] || 0
          const r = radius * (value / 100)
          const x = centerX + Math.cos(angle) * r
          const y = centerY + Math.sin(angle) * r
          
          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.closePath()
        
        // 填充数据区域
        ctx.setFillStyle(this.hexToRgba(color, 0.3))
        ctx.fill()
        
        // 描边数据区域
        ctx.setLineWidth(2)
        ctx.setStrokeStyle(color)
        ctx.stroke()

        // 绘制数据点
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
          const value = values[i] || 0
          const r = radius * (value / 100)
          const x = centerX + Math.cos(angle) * r
          const y = centerY + Math.sin(angle) * r
          
          ctx.beginPath()
          ctx.arc(x, y, 3, 0, Math.PI * 2)
          ctx.setFillStyle(color)
          ctx.fill()
        }

        ctx.draw()
        console.log(`雷达图 ${canvasId} 绘制完成`)
      }).exec()
    },
    drawPentagon(ctx, cx, cy, r) {
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
        const x = cx + Math.cos(angle) * r
        const y = cy + Math.sin(angle) * r
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.closePath()
      ctx.stroke()
    },
    hexToRgba(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    },
    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #8B0012;
  padding: 20rpx;
}

.loading {
  text-align: center;
  padding: 200rpx 0;
  color: #fff;
  font-size: 32rpx;
}

.pk-content {
  padding-bottom: 40rpx;
}

.pk-header {
  text-align: center;
  padding: 40rpx 0 60rpx;
}

.pk-title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 16rpx;
  text-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.3);
}

.pk-subtitle {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.radar-section {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24rpx;
  padding: 40rpx 20rpx;
  margin-bottom: 30rpx;
}

.radar-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.radar-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.side-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.radar-canvas {
  width: 280rpx;
  height: 280rpx;
  display: block;
}

.vs-badge {
  width: 80rpx;
  height: 80rpx;
  background: #8B0012;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.vs-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.compare-section {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
}

.result-badge {
  text-align: center;
  padding: 30rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}

.result-win {
  background: #edcf29;
}

.result-lose {
  background: #999;
}

.result-draw {
  background: #8B0012;
}

.result-text {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 12rpx;
  text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.2);
}

.result-score {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.2);
}

.compare-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.compare-item {
  display: flex;
  align-items: center;
  padding: 20rpx;
  border-radius: 12rpx;
  background: #f8f8f8;
}

.compare-left,
.compare-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 16rpx;
  border-radius: 8rpx;
  transition: all 0.3s;
}

.compare-left {
  background: rgba(139, 0, 18, 0.05);
}

.compare-right {
  background: rgba(255, 107, 107, 0.05);
}

.compare-left.winner {
  background: rgba(139, 0, 18, 0.15);
}

.compare-right.winner {
  background: rgba(255, 107, 107, 0.15);
}

.compare-center {
  flex: 1;
  text-align: center;
  padding: 0 20rpx;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #666;
  font-weight: bold;
  margin-bottom: 4rpx;
}

.draw-text {
  display: block;
  font-size: 20rpx;
  color: #999;
}

.value {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}

.win-badge {
  font-size: 24rpx;
  color: #52c41a;
  font-weight: bold;
}

.actions {
  padding: 0;
}

.btn-back {
  width: 100%;
  background: #fff;
  color: #8B0012;
  border: none;
  border-radius: 24rpx;
  padding: 28rpx;
  font-size: 32rpx;
  font-weight: bold;
}

.btn-back:active {
  background: #f5f5f5;
  transform: scale(0.98);
}
</style>
