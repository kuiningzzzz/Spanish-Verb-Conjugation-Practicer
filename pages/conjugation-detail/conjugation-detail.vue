<template>
  <view class="container">
    <!-- 顶部动词信息卡片 -->
    <view class="verb-info-card card">
      <view class="verb-header">
        <text class="verb-infinitive">{{ verbInfo.infinitive }}</text>
        <view class="verb-badges">
          <view class="badge badge-type">{{ verbInfo.conjugationType }}</view>
          <view v-if="verbInfo.isIrregular" class="badge badge-irregular">不规则</view>
        </view>
      </view>
      <text class="verb-meaning">{{ verbInfo.meaning }}</text>
    </view>

    <!-- 变位表格 -->
    <view class="conjugation-section">
      <view class="section-title">📋 完整变位表</view>

      <!-- 按语气分组显示 -->
      <view v-for="(group, moodKey) in groupedConjugations" :key="moodKey" class="mood-group">
        <view class="mood-header" @click="toggleMood(moodKey)">
          <view class="mood-info">
            <text class="mood-name">{{ getMoodName(moodKey) }}</text>
            <text class="mood-count">{{ group.tenses.length }}个时态</text>
          </view>
          <text class="toggle-icon">{{ expandedMoods[moodKey] ? '▼' : '▶' }}</text>
        </view>

        <!-- 语气展开后显示时态列表 -->
        <view v-if="expandedMoods[moodKey]" class="tenses-container">
          <!-- 每个时态一个卡片 -->
          <view v-for="tense in group.tenses" :key="tense.tense" class="tense-card card">
            <view class="tense-header" @click="toggleTense(moodKey, tense.tense)">
              <text class="tense-title">{{ tense.tenseName }}</text>
              <text class="toggle-icon">{{ isTenseExpanded(moodKey, tense.tense) ? '▼' : '▶' }}</text>
            </view>
            
            <!-- 时态展开后显示变位表格 -->
            <view v-if="isTenseExpanded(moodKey, tense.tense)" class="conjugation-table">
              <view 
                v-for="(conj, index) in tense.conjugations" 
                :key="`${tense.tense}-${conj.person}-${index}`" 
                class="conjugation-row"
              >
                <view class="person-label">{{ getPersonLabel(conj.person) }}</view>
                <view class="conjugated-form">{{ conj.conjugated_form }}</view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部操作按钮 -->
    <view class="action-bar">
      <view class="action-btn" @click="copyAll">
        <text class="btn-icon">📋</text>
        <text>复制全部</text>
      </view>
      <view class="action-btn primary" @click="startPractice">
        <text class="btn-icon">✏️</text>
        <text>开始练习</text>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast, showLoading, hideLoading } from '@/utils/common.js'

export default {
  data() {
    return {
      verbId: null,
      verbInfo: {
        infinitive: '',
        meaning: '',
        conjugationType: '',
        isIrregular: false
      },
      conjugations: [],
      groupedConjugations: {},
      expandedMoods: {},  // 记录每个语气的展开状态
      expandedTenses: {}  // 记录每个时态的展开状态 {moodKey: {tenseKey: true/false}}
    }
  },
  onLoad(options) {
    if (options.verbId) {
      this.verbId = parseInt(options.verbId)
      this.loadVerbDetail()
    } else {
      showToast('缺少动词ID', 'none')
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    }
  },
  methods: {
    async loadVerbDetail() {
      showLoading('加载中...')
      try {
        const res = await api.getVerbConjugations(this.verbId)
        if (res.success) {
          this.verbInfo = res.verb
          this.conjugations = res.conjugations
          this.groupConjugations()
        } else {
          showToast('加载失败', 'none')
        }
      } catch (error) {
        console.error('加载动词变位失败:', error)
        showToast('加载失败', 'none')
      } finally {
        hideLoading()
      }
    },

    // 按语气和时态分组变位
    groupConjugations() {
      const groups = {}
      
      this.conjugations.forEach(conj => {
        const moodKey = conj.mood
        if (!groups[moodKey]) {
          groups[moodKey] = {
            mood: moodKey,
            tenses: {}
          }
        }
        
        const tenseKey = conj.tense
        if (!groups[moodKey].tenses[tenseKey]) {
          groups[moodKey].tenses[tenseKey] = {
            tense: tenseKey,
            tenseName: this.getTenseName(tenseKey),
            conjugations: []
          }
        }
        
        groups[moodKey].tenses[tenseKey].conjugations.push(conj)
      })
      
      // 转换为数组格式，并对人称排序
      Object.keys(groups).forEach(moodKey => {
        const tenseArray = Object.values(groups[moodKey].tenses)
        tenseArray.forEach(tense => {
          tense.conjugations.sort((a, b) => this.getPersonOrder(a.person) - this.getPersonOrder(b.person))
        })
        groups[moodKey].tenses = tenseArray
      })
      
      this.groupedConjugations = groups
      
      // 初始化折叠状态（第一个语气默认展开，其他折叠）
      this.expandedMoods = {}
      this.expandedTenses = {}
      const moodKeys = Object.keys(groups)
      moodKeys.forEach((moodKey, index) => {
        // 第一个语气默认展开
        this.expandedMoods[moodKey] = index === 0
        this.expandedTenses[moodKey] = {}
        groups[moodKey].tenses.forEach(tense => {
          // 时态默认全部折叠
          this.expandedTenses[moodKey][tense.tense] = false
        })
      })
    },

    // 切换语气展开/折叠
    toggleMood(moodKey) {
      this.expandedMoods[moodKey] = !this.expandedMoods[moodKey]
      // 强制更新视图
      this.$forceUpdate()
    },

    // 切换时态展开/折叠
    toggleTense(moodKey, tenseKey) {
      if (!this.expandedTenses[moodKey]) {
        this.expandedTenses[moodKey] = {}
      }
      this.expandedTenses[moodKey][tenseKey] = !this.expandedTenses[moodKey][tenseKey]
      // 强制更新视图
      this.$forceUpdate()
    },

    // 检查时态是否展开
    isTenseExpanded(moodKey, tenseKey) {
      return this.expandedTenses[moodKey] && this.expandedTenses[moodKey][tenseKey]
      
      this.groupedConjugations = groups
    },

    // 获取语气名称
    getMoodName(mood) {
      const moodMap = {
        'indicativo': '直陈式',
        'subjuntivo': '虚拟式',
        'imperativo': '命令式',
        'indicativo_compuesto': '直陈式复合时态',
        'subjuntivo_compuesto': '虚拟式复合时态'
      }
      return moodMap[mood] || mood
    },

    // 获取时态名称
    getTenseName(tense) {
      const tenseMap = {
        '现在时': '现在时 (Presente)',
        '简单过去时': '简单过去时 (Pretérito)',
        '过去未完成时': '过去未完成时 (Imperfecto)',
        '将来时': '将来时 (Futuro)',
        '条件式': '条件式 (Condicional)',
        '现在完成时': '现在完成时 (Pretérito Perfecto)',
        '过去完成时': '过去完成时 (Pluscuamperfecto)',
        '将来完成时': '将来完成时 (Futuro Perfecto)',
        '条件完成时': '条件完成时 (Condicional Perfecto)',
        '虚拟式现在时': '虚拟式现在时 (Presente)',
        '虚拟式过去时': '虚拟式过去时 (Imperfecto)',
        '虚拟式现在完成时': '虚拟式现在完成时 (Pretérito Perfecto)',
        '虚拟式过去完成时': '虚拟式过去完成时 (Pluscuamperfecto)'
      }
      return tenseMap[tense] || tense
    },

    // 获取人称标签
    getPersonLabel(person) {
      const personMap = {
        'yo': 'yo (我)',
        'tú': 'tú (你)',
        'él/ella/usted': 'él/ella/usted (他/她/您)',
        'nosotros': 'nosotros (我们)',
        'vosotros': 'vosotros (你们)',
        'ellos/ellas/ustedes': 'ellos/ellas/ustedes (他们/她们/您们)',
        'vos': 'vos (你-拉美)',
        'tú (afirmativo)': 'tú (你-肯定命令)',
        'tú (negativo)': 'tú (你-否定命令)',
        'usted': 'usted (您)',
        'nosotros/nosotras': 'nosotros/nosotras (我们)',
        'vosotros/vosotras': 'vosotros/vosotras (你们)',
        'ustedes': 'ustedes (您们)'
      }
      return personMap[person] || person
    },

    // 获取人称排序顺序
    getPersonOrder(person) {
      const order = {
        'yo': 1,
        'tú': 2,
        'vos': 2.5,
        'él/ella/usted': 3,
        'usted': 3,
        'nosotros': 4,
        'nosotros/nosotras': 4,
        'vosotros': 5,
        'vosotros/vosotras': 5,
        'ellos/ellas/ustedes': 6,
        'ustedes': 6,
        'tú (afirmativo)': 2.1,
        'tú (negativo)': 2.2
      }
      return order[person] || 99
    },

    // 复制所有变位
    copyAll() {
      let text = `${this.verbInfo.infinitive} - ${this.verbInfo.meaning}\n\n`
      
      Object.keys(this.groupedConjugations).forEach(moodKey => {
        const group = this.groupedConjugations[moodKey]
        text += `【${this.getMoodName(moodKey)}】\n`
        
        group.tenses.forEach(tense => {
          text += `\n${tense.tenseName}\n`
          tense.conjugations.forEach(conj => {
            text += `  ${this.getPersonLabel(conj.person)}: ${conj.conjugated_form}\n`
          })
        })
        text += '\n'
      })
      
      // 在uni-app中复制到剪贴板
      uni.setClipboardData({
        data: text,
        success: () => {
          showToast('已复制到剪贴板', 'success')
        },
        fail: () => {
          showToast('复制失败', 'none')
        }
      })
    },

    // 开始练习这个动词
    startPractice() {
      uni.navigateTo({
        url: `/pages/practice/practice?verbIds=${this.verbId}&practiceMode=custom`
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 20rpx;
  padding-bottom: 140rpx;
}

/* 动词信息卡片 */
.verb-info-card {
  margin-bottom: 30rpx;
  padding: 30rpx;
}

.verb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15rpx;
}

.verb-infinitive {
  font-size: 48rpx;
  font-weight: bold;
  color: #2c3e50;
}

.verb-badges {
  display: flex;
  gap: 15rpx;
}

.badge {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
}

.badge-type {
  background-color: #e3f2fd;
  color: #1976d2;
}

.badge-irregular {
  background-color: #fff3e0;
  color: #f57c00;
}

.verb-meaning {
  font-size: 32rpx;
  color: #666;
}

/* 变位部分 */
.conjugation-section {
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #2c3e50;
  padding: 20rpx 0;
  margin-bottom: 20rpx;
}

/* 语气分组 */
.mood-group {
  margin-bottom: 20rpx;
}

.mood-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 25rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  cursor: pointer;
  transition: all 0.3s;
}

.mood-header:active {
  opacity: 0.8;
  transform: scale(0.98);
}

.mood-info {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.mood-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.mood-count {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.9);
  padding: 6rpx 16rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20rpx;
}

.toggle-icon {
  font-size: 28rpx;
  color: #fff;
  transition: transform 0.3s;
}

.tenses-container {
  margin-top: 20rpx;
  padding: 0 10rpx;
}

/* 时态卡片 */
.tense-card {
  margin-bottom: 15rpx;
  padding: 0;
  overflow: hidden;
}

.tense-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #f8f9fa;
  padding: 25rpx 30rpx;
  cursor: pointer;
  transition: all 0.3s;
}

.tense-header:active {
  background-color: #e9ecef;
}

.tense-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #495057;
}

/* 变位表格 */
.conjugation-table {
  padding: 0;
  border-top: 2rpx solid #e9ecef;
}

.conjugation-row {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  background-color: #fff;
}

.conjugation-row {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.conjugation-row:last-child {
  border-bottom: none;
}

.person-label {
  flex: 0 0 280rpx;
  font-size: 26rpx;
  color: #666;
}

.conjugated-form {
  flex: 1;
  font-size: 30rpx;
  font-weight: 500;
  color: #2c3e50;
}

/* 底部操作栏 */
.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background-color: #fff;
  padding: 20rpx;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 25rpx;
  margin: 0 10rpx;
  background-color: #f8f9fa;
  border-radius: 20rpx;
  font-size: 28rpx;
  color: #495057;
}

.action-btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.btn-icon {
  margin-right: 10rpx;
  font-size: 32rpx;
}

/* 卡片样式 */
.card {
  background-color: #fff;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}
</style>
