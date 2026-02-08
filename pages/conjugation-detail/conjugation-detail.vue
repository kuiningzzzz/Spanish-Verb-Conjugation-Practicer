<template>
  <view class="container">
    <!-- 顶部动词信息卡片 -->
    <view class="verb-info-card card">
      <view class="verb-header">
        <view class="verb-left">
          <text class="verb-infinitive">{{ verbInfo.infinitive }}{{ verbInfo.isReflexive ? '(se)' : '' }}</text>
          <view class="verb-badges">
            <view class="badge badge-type">{{ verbInfo.conjugationType }}</view>
            <view v-if="verbInfo.isIrregular" class="badge badge-irregular">Irreg.</view>
            <view v-if="verbInfo.isReflexive" class="badge badge-reflexive">Prnl.</view>
          </view>
        </view>
        <view class="favorite-icon" @click="toggleFavorite">
          <text class="star-icon" :class="{ 'favorited': isFavorited }">★</text>
        </view>
      </view>
      <text class="verb-meaning">{{ verbInfo.meaning }}</text>
      
      <!-- 动词形式 -->
      <view class="verb-forms">
        <view v-if="verbInfo.gerund" class="verb-form-item">
          <text class="form-label">Gerundio（副动词）:</text>
          <text class="form-value">{{ verbInfo.gerund }}</text>
        </view>
        <view v-if="verbInfo.participle" class="verb-form-item">
          <text class="form-label">Participio（过去分词）:</text>
          <text class="form-value">{{ getParticipleForms() }}</text>
        </view>
      </view>
    </view>

    <!-- 变位表格 -->
    <view class="conjugation-section">
      <view class="section-title">📋 完整变位表</view>

      <!-- 反身代词变位（仅反身动词显示） -->
      <view v-if="verbInfo.isReflexive" class="mood-group">
        <view class="mood-header" @click="toggleReflexivePronouns">
          <text class="mood-name">Pronombres Reflexivos (反身代词变位)</text>
          <view class="mood-right">
            <text class="mood-count">7 personas</text>
            <text class="toggle-icon">{{ showReflexivePronouns ? '▼' : '▶' }}</text>
          </view>
        </view>

        <!-- 反身代词表格 -->
        <view v-if="showReflexivePronouns" class="tenses-container">
          <view class="tense-card card">
            <view class="conjugation-table">
              <view 
                v-for="(pronoun, index) in reflexivePronouns" 
                :key="pronoun.person"
              >
                <!-- vos人称前添加分隔标签 -->
                <view v-if="pronoun.person === 'vos'" class="vos-divider">
                  <view class="divider-line"></view>
                  <text class="divider-text">特殊变位</text>
                  <view class="divider-line"></view>
                </view>
                
                <view :class="['conjugation-row', pronoun.person === 'vos' ? 'vos-row' : '']">
                  <view class="person-label">{{ pronoun.person }}</view>
                  <view class="conjugated-form">{{ pronoun.pronoun }}</view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 按语气分组显示 -->
      <view v-for="(group, moodKey) in groupedConjugations" :key="moodKey" class="mood-group">
        <view class="mood-header" @click="toggleMood(moodKey)">
          <text class="mood-name">{{ getMoodName(moodKey) }}</text>
          <view class="mood-right">
            <text class="mood-count">{{ group.tenses.length }}个时态</text>
            <text class="toggle-icon">{{ expandedMoods[moodKey] ? '▼' : '▶' }}</text>
          </view>
        </view>

        <!-- 语气展开后显示时态列表 -->
        <view v-if="expandedMoods[moodKey]" class="tenses-container">
          <!-- 每个时态一个卡片 -->
          <view v-for="tense in group.tenses" :key="tense.tense" class="tense-card card">
            <view class="tense-header" @click="toggleTense(moodKey, tense.tense)">
              <text class="tense-title">
                <text :class="tense.tenseDisplay.dimmed ? 'tense-cn-dimmed' : ''">{{ tense.tenseDisplay.es }}</text>
                <text :class="['tense-cn', tense.tenseDisplay.dimmed ? 'tense-cn-dimmed' : '']">（{{ tense.tenseDisplay.cn }}）</text>
              </text>
              <text class="toggle-icon">{{ isTenseExpanded(moodKey, tense.tense) ? '▼' : '▶' }}</text>
            </view>
            
            <!-- 时态展开后显示变位表格 -->
            <view v-if="isTenseExpanded(moodKey, tense.tense)" class="conjugation-table">
              <view 
                v-for="(conj, index) in tense.conjugations" 
                :key="`${tense.tense}-${conj.person}-${index}`" 
              >
                <!-- vos人称前添加分隔标签 -->
                <view v-if="isVosPerson(conj.person)" class="vos-divider">
                  <view class="divider-line"></view>
                  <text class="divider-text">特殊变位</text>
                  <view class="divider-line"></view>
                </view>
                
                <view :class="['conjugation-row', isVosPerson(conj.person) ? 'vos-row' : '']">
                  <view class="person-label">{{ getPersonLabel(conj.person) }}</view>
                  <view class="conjugated-form">{{ conj.conjugated_form }}</view>
                </view>
              </view>
            </view>
          </view>
        </view>
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
        isIrregular: false,
        isReflexive: false,
        gerund: '',
        participle: '',
        participleForms: []
      },
      conjugations: [],
      groupedConjugations: {},
      expandedMoods: {},  // 记录每个语气的展开状态
      expandedTenses: {},  // 记录每个时态的展开状态 {moodKey: {tenseKey: true/false}}
      isFavorited: false,  // 收藏状态
      showReflexivePronouns: true,  // 反身代词表格展开状态
      reflexivePronouns: [
        { person: 'yo', pronoun: 'me' },
        { person: 'tú', pronoun: 'te' },
        { person: 'él/ella/usted', pronoun: 'se' },
        { person: 'nosotros', pronoun: 'nos' },
        { person: 'vosotros', pronoun: 'os' },
        { person: 'ellos/ellas/ustedes', pronoun: 'se' },
        { person: 'vos', pronoun: 'te' }
      ]
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
          // 检查收藏状态
          this.checkFavoriteStatus()
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
        const moodKey = this.getDisplayMoodKey(conj.mood, conj.tense)
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
            tenseDisplay: this.getTenseDisplay(tenseKey, moodKey),
            conjugations: []
          }
        }
        
        // 检查是否已存在该人称
        const existingConj = groups[moodKey].tenses[tenseKey].conjugations.find(c => c.person === conj.person)
        if (existingConj) {
          // 合并多个变位形式，用 / 分隔
          existingConj.conjugated_form += ' / ' + conj.conjugated_form
        } else {
          groups[moodKey].tenses[tenseKey].conjugations.push(conj)
        }
      })
      
      // 转换为数组格式，并对人称排序
      const orderedGroups = {}
      Object.keys(groups)
        .sort((a, b) => this.getMoodOrder(a) - this.getMoodOrder(b))
        .forEach(moodKey => {
        const tenseArray = Object.values(groups[moodKey].tenses)
          .sort((a, b) => this.getTenseOrder(moodKey, a.tense) - this.getTenseOrder(moodKey, b.tense))
        tenseArray.forEach(tense => {
          tense.conjugations.sort((a, b) => this.getPersonOrder(a.person) - this.getPersonOrder(b.person))
        })
          orderedGroups[moodKey] = {
            ...groups[moodKey],
            tenses: tenseArray
          }
      })
      
      this.groupedConjugations = orderedGroups
      
      // 初始化折叠状态（第一个语气默认展开，其他折叠）
      this.expandedMoods = {}
      this.expandedTenses = {}
      const moodKeys = Object.keys(orderedGroups)
      moodKeys.forEach((moodKey, index) => {
        // 第一个语气默认展开
        this.expandedMoods[moodKey] = index === 0
        this.expandedTenses[moodKey] = {}
        orderedGroups[moodKey].tenses.forEach(tense => {
          // 时态默认全部折叠
          this.expandedTenses[moodKey][tense.tense] = false
        })
      })
    },

    getDisplayMoodKey(rawMood, rawTense) {
      if (rawTense === '条件式' || rawTense === '条件完成时') return '条件式'
      if (rawMood === '陈述式' || rawMood === '复合陈述式') return '陈述式'
      if (rawMood === '虚拟式' || rawMood === '复合虚拟式') return '虚拟式'
      if (rawMood === '命令式') return '命令式'
      return rawMood
    },

    getMoodOrder(mood) {
      const order = {
        '陈述式': 1,
        '虚拟式': 2,
        '条件式': 3,
        '命令式': 4
      }
      return order[mood] || 99
    },

    getTenseOrder(mood, tense) {
      const orderMap = {
        '陈述式': {
          '现在时': 1,
          '现在完成时': 2,
          '未完成过去时': 3,
          '简单过去时': 4,
          '将来时': 5,
          '过去完成时': 6,
          '将来完成时': 7,
          '先过去时': 8
        },
        '虚拟式': {
          '虚拟现在时': 1,
          '虚拟过去时': 2,
          '虚拟现在完成时': 3,
          '虚拟过去完成时': 4,
          '虚拟将来时': 5,
          '虚拟将来完成时': 6
        },
        '条件式': {
          '条件式': 1,
          '条件完成时': 2
        },
        '命令式': {
          '肯定命令式': 1,
          '否定命令式': 2
        }
      }

      const moodOrder = orderMap[mood] || {}
      return moodOrder[tense] || 99
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
        '陈述式': 'Indicativo (陈述式)',
        '条件式': 'Condicional (条件式)',
        '虚拟式': 'Subjuntivo (虚拟式)',
        '命令式': 'Imperativo (命令式)'
      }
      return moodMap[mood] || mood
    },

    // 获取时态显示（西语 + 中文）
    getTenseDisplay(tense, mood) {
      const tenseMapByMood = {
        '陈述式': {
          '现在时': { es: 'Presente', cn: '陈述式 一般现在时' },
          '现在完成时': { es: 'Pretérito Perfecto', cn: '陈述式 现在完成时' },
          '未完成过去时': { es: 'Pretérito Imperfecto', cn: '陈述式 过去未完成时' },
          '简单过去时': { es: 'Pretérito Indefinido', cn: '陈述式 简单过去时' },
          '过去完成时': { es: 'Pretérito Pluscuamperfecto', cn: '陈述式 过去完成时' },
          '将来时': { es: 'Futuro Imperfecto', cn: '陈述式 将来未完成时' },
          '将来完成时': { es: 'Futuro Perfecto', cn: '陈述式 将来完成时' },
          '先过去时': { es: 'Pretérito Anterior', cn: '陈述式 近逾过去时' }
        },
        '虚拟式': {
          '虚拟现在时': { es: 'Presente', cn: '虚拟式 现在时' },
          '虚拟过去时': { es: 'Pretérito Imperfecto', cn: '虚拟式 过去未完成时' },
          '虚拟将来时': { es: 'Futuro', cn: '虚拟式 将来时' },
          '虚拟现在完成时': { es: 'Pretérito Perfecto', cn: '虚拟式 现在完成时' },
          '虚拟过去完成时': { es: 'Pretérito Pluscuamperfecto', cn: '虚拟式 过去完成时' },
          '虚拟将来完成时': { es: 'Futuro Perfecto', cn: '虚拟式 将来完成时' }
        },
        '条件式': {
          '条件式': { es: 'Condicional Simple', cn: '简单条件式' },
          '条件完成时': { es: 'Condicional Compuesto', cn: '复合条件式' }
        },
        '命令式': {
          '肯定命令式': { es: 'Imperativo', cn: '命令式' },
          '否定命令式': { es: 'Imperativo Negativo', cn: '否定命令式' }
        }
      }

      const moodMap = tenseMapByMood[mood] || {}
      const display = moodMap[tense]
      if (!display) {
        return { es: tense, cn: tense, dimmed: false }
      }

      const dimmedKeys = new Set([
        '陈述式|先过去时',
        '虚拟式|虚拟将来时',
        '虚拟式|虚拟过去完成时',
        '虚拟式|虚拟现在完成时',
        '虚拟式|虚拟将来完成时'
      ])
      const dimmed = dimmedKeys.has(`${mood}|${tense}`)

      return {
        es: display.es,
        cn: display.cn,
        dimmed
      }
    },

    // 获取人称标签
    getPersonLabel(person) {
      const personMap = {
        'yo': 'yo',
        'tú': 'tú',
        'él/ella/usted': 'él/ella/usted',
        'nosotros': 'nosotros',
        'vosotros': 'vosotros',
        'ellos/ellas/ustedes': 'ellos/ellas/ustedes',
        'vos': 'vos',
        'tú (afirmativo)': 'tú (afirmativo)',
        'tú (negativo)': 'tú (negativo)',
        'usted': 'usted',
        'nosotros/nosotras': 'nosotros/nosotras',
        'vosotros/vosotras': 'vosotros/vosotras',
        'ustedes': 'ustedes'
      }
      return personMap[person] || person
    },

    // 获取人称排序顺序
    getPersonOrder(person) {
      const order = {
        'yo': 1,
        'tú': 2,
        'él/ella/usted': 3,
        'usted': 3,
        'nosotros': 4,
        'nosotros/nosotras': 4,
        'vosotros': 5,
        'vosotros/vosotras': 5,
        'ellos/ellas/ustedes': 6,
        'ustedes': 6,
        'tú (afirmativo)': 2.1,
        'tú (negativo)': 2.2,
        'vos': 100  // vos放到最后（拉美专用）
      }
      return order[person] || 99
    },

    // 检查是否是vos人称（用于添加分隔线）
    isVosPerson(person) {
      return person === 'vos'
    },

    // 获取所有过去分词形式
    getParticipleForms() {
      if (this.verbInfo.participleForms && this.verbInfo.participleForms.length > 0) {
        return this.verbInfo.participleForms.join(' / ')
      }
      return this.verbInfo.participle || ''
    },

    // 切换反身代词表格展开/折叠
    toggleReflexivePronouns() {
      this.showReflexivePronouns = !this.showReflexivePronouns
    },

    // 检查收藏状态
    async checkFavoriteStatus() {
      try {
        const res = await api.checkFavorite(this.verbId)
        if (res.success) {
          this.isFavorited = res.isFavorited
        }
      } catch (error) {
        console.error('检查收藏状态失败:', error)
      }
    },

    // 切换收藏状态
    async toggleFavorite() {
      try {
        if (this.isFavorited) {
          // 取消收藏
          const res = await api.removeFavorite({ verbId: this.verbId })
          if (res.success) {
            this.isFavorited = false
            showToast('已取消收藏', 'success')
          }
        } else {
          // 添加收藏
          const res = await api.addFavorite({ verbId: this.verbId })
          if (res.success) {
            this.isFavorited = true
            showToast('收藏成功', 'success')
          }
        }
      } catch (error) {
        console.error('收藏操作失败:', error)
        showToast('操作失败', 'none')
      }
    }
  }
}
</script>

<style scoped>
  .container {
    min-height: 100vh;
    background-color: #f5f7fa;
    padding: 20rpx;
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

.verb-left {
  display: flex;
  align-items: center;
  gap: 15rpx;
  flex: 1;
}

.verb-infinitive {
  font-size: 48rpx;
  font-weight: bold;
  color: #2c3e50;
}

.favorite-icon {
  flex-shrink: 0;
  padding: 10rpx;
  cursor: pointer;
}

.star-icon {
  font-size: 56rpx;
  color: #d9d9d9;
  transition: all 0.3s ease;
}

.star-icon.favorited {
  color: #fadb14;
  text-shadow: 0 0 10rpx rgba(250, 219, 20, 0.5);
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

.badge-reflexive {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.verb-meaning {
  font-size: 32rpx;
  color: #666;
  margin-bottom: 25rpx;
}

.verb-forms {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.verb-form-item {
  display: flex;
  align-items: center;
  gap: 15rpx;
}

.form-label {
  font-size: 26rpx;
  color: #999;
  font-weight: 500;
  flex-shrink: 0;
}

.form-value {
  font-size: 28rpx;
  color: #2c3e50;
  font-weight: 600;
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
  background: #8B0012;
  border-radius: 20rpx;
  cursor: pointer;
  transition: all 0.3s;
  gap: 20rpx;
}

.mood-header:active {
  opacity: 0.8;
  transform: scale(0.98);
}

.mood-name {
  flex: 1;
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
  min-width: 0;
  word-break: break-word;
}

.mood-right {
  display: flex;
  align-items: center;
  gap: 15rpx;
  flex-shrink: 0;
}

.mood-count {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.9);
  padding: 6rpx 16rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20rpx;
  white-space: nowrap;
}

.toggle-icon {
  font-size: 28rpx;
  color: #fff;
  transition: transform 0.3s;
  flex-shrink: 0;
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

.tense-cn {
  color: #495057;
}

.tense-cn-dimmed {
  color: #9aa0a6;
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

.conjugation-row:last-child {
  border-bottom: none;
}

/* vos人称分隔器 */
.vos-divider {
  display: flex;
  align-items: center;
  margin: 20rpx 30rpx 10rpx;
  gap: 15rpx;
}

.divider-line {
  flex: 1;
  height: 1rpx;
  background: linear-gradient(to right, transparent, #d0d0d0, transparent);
}

.divider-text {
  font-size: 22rpx;
  color: #999;
  padding: 4rpx 12rpx;
  background-color: #f5f5f5;
  border-radius: 10rpx;
  white-space: nowrap;
}

/* vos人称行样式 */
.conjugation-row.vos-row {
  background-color: #fafafa;
}

.conjugation-row.vos-row .person-label {
  color: #999;
}

.conjugation-row.vos-row .conjugated-form {
  color: #666;
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

/* 卡片样式 */
.card {
  background-color: #fff;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}
</style>
