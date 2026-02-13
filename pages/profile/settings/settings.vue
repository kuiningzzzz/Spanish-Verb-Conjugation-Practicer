<template>
  <view class="settings-container">
    <!-- 练习设置分组 -->
    <view class="section-group">
      <view class="section-header">
        <text class="section-title">练习设置</text>
        <text class="section-subtitle">影响练习题的生成</text>
      </view>

      <view class="settings-card">
        <view class="card-header">
          <text class="card-title">人称设置</text>
          <text class="card-subtitle">影响练习题中是否包含特定人称</text>
        </view>

        <view class="setting-item">
          <view class="item-info">
            <text class="item-title">包含 vosotros</text>
            <text class="item-desc">西班牙地区常用的复数第二人称</text>
          </view>
          <switch :checked="pronounSettings.includeVosotros" @change="onVosotrosChange" color="#8B0012" />
        </view>

        <view class="setting-item">
          <view class="item-info">
            <text class="item-title">包含 vos</text>
            <text class="item-desc">拉美部分地区使用的第二人称</text>
          </view>
          <switch :checked="pronounSettings.includeVos" @change="onVosChange" color="#8B0012" />
        </view>
      </view>

      <view class="settings-card">
        <view class="card-header">
          <text class="card-title">语气与时态设置</text>
          <text class="card-subtitle">影响练习题中语气和时态</text>
        </view>

        <view class="setting-item">
          <view class="item-info">
            <view class="item-title-row">
              <text class="item-title">减少罕见时态的出现</text>
              <view class="mode-info-button" @click.stop="openRareTenseInfoModal">
                <text class="mode-info-button-text">i</text>
              </view>
            </view>
            <text class="item-desc">关闭后，所有选择练习的时态都将以同等频率出现</text>
          </view>
          <switch :checked="practiceGenerationSettings.reduceRareTenseFrequency" @change="onReduceRareTenseFrequencyChange" color="#8B0012" />
        </view>

        <view class="setting-item clickable" @click="openDefaultTenseSelector">
          <view class="item-info">
            <text class="item-title">更改默认选择练习的时态</text>
            <text class="item-desc">进入练习页面时默认勾选这些时态</text>
          </view>
          <view class="item-action">
            <text class="action-text">{{ selectedDefaultTenses.length }} 项</text>
            <text class="action-arrow">›</text>
          </view>
        </view>
      </view>

    </view>

    <!-- 界面设置 -->
    <view class="section-group">
      <view class="section-header">
        <text class="section-title">界面设置</text>
        <text class="section-subtitle">调整界面交互与输入体验</text>
      </view>

      <view class="settings-card">
        <view class="card-header">
          <text class="card-title">输入法设置</text>
          <text class="card-subtitle">内置西语输入法设置</text>
        </view>

        <view class="setting-item">
          <view class="item-info">
            <text class="item-title">启用内置输入法</text>
            <text class="item-desc">开启后，查词和练习输入将不再弹出系统键盘</text>
          </view>
          <switch :checked="useInAppIME" @change="onUseInAppIMEChange" color="#8B0012" />
        </view>
      </view>
    </view>

    <!-- 隐私设置 -->
    <view class="section-group">
      <view class="section-header">
        <text class="section-title">隐私设置</text>
        <text class="section-subtitle">控制你的信息隐私</text>
      </view>

      <view class="settings-card">
        <view class="card-header">
          <text class="card-title">可见性设置</text>
          <text class="card-subtitle">控制你数据的可见性</text>
        </view>

        <view class="setting-item">
          <view class="item-info">
            <text class="item-title">参与排行榜</text>
            <text class="item-desc">关闭后，其他用户将无法在排行榜中看到你</text>
          </view>
          <switch :checked="participateInLeaderboard" @change="onLeaderboardChange" color="#8B0012" />
        </view>
      </view>
    </view>

    <view v-if="showDefaultTenseSelector" class="selector-overlay" @click="closeDefaultTenseSelector">
      <view class="selector-sheet" @click.stop>
        <view class="selector-header">
          <text class="selector-title">默认选择练习时态</text>
          <text class="selector-subtitle">勾选后将作为进入练习页面时的默认时态</text>
        </view>

        <scroll-view scroll-y class="selector-scroll">
          <view class="mood-accordion">
            <view v-for="mood in tenseMoodOptions" :key="mood.value" class="mood-panel">
              <view class="mood-panel-header" @click="toggleTenseMoodPanel(mood.value)">
                <text class="mood-panel-title">{{ mood.label }}</text>
                <view class="mood-panel-right">
                  <text class="mood-panel-count">已选{{ getSelectedDefaultTenseCountByMood(mood.value) }}项</text>
                  <text class="mood-panel-arrow">{{ expandedTenseMoodPanels[mood.value] ? '▲' : '▼' }}</text>
                </view>
              </view>
              <view v-if="expandedTenseMoodPanels[mood.value]" class="mood-panel-body">
                <view class="mood-actions">
                  <button class="mini-btn" @click.stop="selectAllDefaultTensesInMood(mood.value)">全选</button>
                  <button class="mini-btn secondary" @click.stop="clearDefaultTensesInMood(mood.value)">清除</button>
                </view>
                <view class="tense-list">
                  <view
                    v-for="tense in getDefaultTensesByMood(mood.value)"
                    :key="tense.value"
                    class="tense-item"
                    @click="toggleDefaultTense(tense.value)"
                  >
                    <text class="tense-check">{{ selectedDefaultTenses.includes(tense.value) ? '☑' : '☐' }}</text>
                    <text :class="['tense-label', isThirdClassTense(tense.value) ? 'tense-label-dimmed' : '']">{{ tense.label }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="selector-actions">
          <button class="selector-btn secondary" @click="resetDefaultTenseSelector">恢复默认</button>
          <button class="selector-btn" @click="saveDefaultTenseSelector">保存</button>
        </view>
      </view>
    </view>

    <view class="modal" v-if="showRareTenseInfoModal" @click="closeRareTenseInfoModal">
      <view class="modal-content rare-tense-modal" @click.stop>
        <text class="rare-tense-modal-title">出现频率说明</text>

        <view class="rare-tense-section">
          <text class="rare-tense-section-title">根据经验，我们将适当减少以下时态出现的频率：</text>
          <view class="rare-tense-list">
            <text
              v-for="tense in secondClassTenseLabels"
              :key="`second-${tense}`"
              class="rare-tense-item"
            >
              {{ tense }}
            </text>
          </view>
        </view>

        <view class="rare-tense-section">
          <text class="rare-tense-section-title">我们将大幅减少以下时态出现的频率：</text>
          <view class="rare-tense-list">
            <text
              v-for="tense in thirdClassTenseLabels"
              :key="`third-${tense}`"
              class="rare-tense-item"
            >
              {{ tense }}
            </text>
          </view>
        </view>

        <button class="selector-btn rare-tense-close-btn" @click="closeRareTenseInfoModal">我知道了</button>
      </view>
    </view>
  </view>
</template>

<script>
import {
  getPronounSettings,
  setPronounSettings,
  getPracticeGenerationSettings,
  setPracticeGenerationSettings,
  getPracticeTenseSelectionSettings,
  setPracticeTenseSelectionSettings,
  getDefaultPracticeSelectedTenses
} from '@/utils/settings.js'
import { getUseInAppIME, setUseInAppIME } from '@/utils/ime/settings-store.js'
import { showToast, showLoading, hideLoading } from '@/utils/common.js'
import api from '@/utils/api.js'

export default {
  data() {
    return {
      pronounSettings: getPronounSettings(),
      practiceGenerationSettings: getPracticeGenerationSettings(),
      showDefaultTenseSelector: false,
      showRareTenseInfoModal: false,
      selectedDefaultTenses: [],
      expandedTenseMoodPanels: {},
      secondClassTenseKeys: [
        'pluscuamperfecto',
        'futuro_perfecto',
        'condicional_perfecto',
        'subjuntivo_imperfecto',
        'subjuntivo_perfecto'
      ],
      thirdClassTenseKeys: [
        'preterito_anterior',
        'subjuntivo_futuro',
        'subjuntivo_pluscuamperfecto',
        'subjuntivo_futuro_perfecto'
      ],
      tenseMoodOptions: [
        { value: 'indicativo', label: 'Indicativo 陈述式' },
        { value: 'subjuntivo', label: 'Subjuntivo 虚拟式' },
        { value: 'condicional', label: 'Condicional 条件式' },
        { value: 'imperativo', label: 'Imperativo 命令式' }
      ],
      defaultTenseOptions: [
        { value: 'presente', label: 'Presente（陈述式 一般现在时）', mood: 'indicativo' },
        { value: 'perfecto', label: 'Pretérito Perfecto（陈述式 现在完成时）', mood: 'indicativo' },
        { value: 'imperfecto', label: 'Pretérito Imperfecto（陈述式 过去未完成时）', mood: 'indicativo' },
        { value: 'preterito', label: 'Pretérito Indefinido（陈述式 简单过去时）', mood: 'indicativo' },
        { value: 'futuro', label: 'Futuro Imperfecto（陈述式 将来未完成时）', mood: 'indicativo' },
        { value: 'pluscuamperfecto', label: 'Pretérito Pluscuamperfecto（陈述式 过去完成时）', mood: 'indicativo' },
        { value: 'futuro_perfecto', label: 'Futuro Perfecto（陈述式 将来完成时）', mood: 'indicativo' },
        { value: 'preterito_anterior', label: 'Pretérito Anterior（陈述式 前过去时）', mood: 'indicativo' },
        { value: 'subjuntivo_presente', label: 'Presente（虚拟式 现在时）', mood: 'subjuntivo' },
        { value: 'subjuntivo_imperfecto', label: 'Pretérito Imperfecto（虚拟式 过去未完成时）', mood: 'subjuntivo' },
        { value: 'subjuntivo_perfecto', label: 'Pretérito Perfecto（虚拟式 现在完成时）', mood: 'subjuntivo' },
        { value: 'subjuntivo_pluscuamperfecto', label: 'Pretérito Pluscuamperfecto（虚拟式 过去完成时）', mood: 'subjuntivo' },
        { value: 'subjuntivo_futuro', label: 'Futuro（虚拟式 将来未完成时）', mood: 'subjuntivo' },
        { value: 'subjuntivo_futuro_perfecto', label: 'Futuro Perfecto（虚拟式 将来完成时）', mood: 'subjuntivo' },
        { value: 'condicional', label: 'Condicional Simple（简单条件式）', mood: 'condicional' },
        { value: 'condicional_perfecto', label: 'Condicional Compuesto（复合条件式）', mood: 'condicional' },
        { value: 'imperativo_afirmativo', label: 'Imperativo（命令式）', mood: 'imperativo' },
        { value: 'imperativo_negativo', label: 'Imperativo Negativo（否定命令式）', mood: 'imperativo' }
      ],
      participateInLeaderboard: true,
      useInAppIME: getUseInAppIME()
    }
  },
  onShow() {
    this.pronounSettings = getPronounSettings()
    this.practiceGenerationSettings = getPracticeGenerationSettings()
    this.useInAppIME = getUseInAppIME()
    this.selectedDefaultTenses = getPracticeTenseSelectionSettings().selectedTenses
    this.loadUserSettings()
  },
  computed: {
    secondClassTenseLabels() {
      return this.secondClassTenseKeys
        .map(key => this.getTenseLabelByValue(key))
        .filter(Boolean)
    },
    thirdClassTenseLabels() {
      return this.thirdClassTenseKeys
        .map(key => this.getTenseLabelByValue(key))
        .filter(Boolean)
    }
  },
  methods: {
    openRareTenseInfoModal() {
      this.showRareTenseInfoModal = true
    },
    closeRareTenseInfoModal() {
      this.showRareTenseInfoModal = false
    },
    getTenseLabelByValue(tenseValue) {
      const target = this.defaultTenseOptions.find(item => item.value === tenseValue)
      return target ? target.label : tenseValue
    },
    openDefaultTenseSelector() {
      this.selectedDefaultTenses = [...getPracticeTenseSelectionSettings().selectedTenses]
      const allExpanded = {}
      this.tenseMoodOptions.forEach((mood) => {
        allExpanded[mood.value] = true
      })
      this.expandedTenseMoodPanels = allExpanded
      this.showDefaultTenseSelector = true
    },
    closeDefaultTenseSelector() {
      this.showDefaultTenseSelector = false
    },
    toggleTenseMoodPanel(mood) {
      this.$set(this.expandedTenseMoodPanels, mood, !this.expandedTenseMoodPanels[mood])
    },
    getDefaultTensesByMood(mood) {
      return this.defaultTenseOptions.filter(t => t.mood === mood)
    },
    getSelectedDefaultTenseCountByMood(mood) {
      const ids = this.getDefaultTensesByMood(mood).map(t => t.value)
      return ids.filter(id => this.selectedDefaultTenses.includes(id)).length
    },
    isThirdClassTense(tense) {
      return [
        'preterito_anterior',
        'subjuntivo_futuro',
        'subjuntivo_pluscuamperfecto',
        'subjuntivo_futuro_perfecto'
      ].includes(tense)
    },
    toggleDefaultTense(tense) {
      const idx = this.selectedDefaultTenses.indexOf(tense)
      if (idx > -1) {
        this.selectedDefaultTenses.splice(idx, 1)
      } else {
        this.selectedDefaultTenses.push(tense)
      }
    },
    selectAllDefaultTensesInMood(mood) {
      this.getDefaultTensesByMood(mood).forEach((tense) => {
        if (!this.selectedDefaultTenses.includes(tense.value)) {
          this.selectedDefaultTenses.push(tense.value)
        }
      })
    },
    clearDefaultTensesInMood(mood) {
      const keys = new Set(this.getDefaultTensesByMood(mood).map(t => t.value))
      this.selectedDefaultTenses = this.selectedDefaultTenses.filter(t => !keys.has(t))
    },
    resetDefaultTenseSelector() {
      this.selectedDefaultTenses = [...getDefaultPracticeSelectedTenses()]
    },
    saveDefaultTenseSelector() {
      if (this.selectedDefaultTenses.length === 0) {
        showToast('请至少选择一个默认时态', 'none')
        return
      }
      const updated = setPracticeTenseSelectionSettings({
        selectedTenses: this.selectedDefaultTenses
      })
      this.selectedDefaultTenses = [...updated.selectedTenses]
      this.showDefaultTenseSelector = false
      showToast('默认时态已保存', 'success')
    },
    async loadUserSettings() {
      try {
        const res = await api.getUserInfo()
        if (res.success) {
          // participate_in_leaderboard 为 1 表示参与，0 表示不参与
          this.participateInLeaderboard = res.user.participate_in_leaderboard === 1
        }
      } catch (error) {
        console.error('加载用户设置失败:', error)
      }
    },
    onVosotrosChange(event) {
      const updated = setPronounSettings({
        ...this.pronounSettings,
        includeVosotros: event.detail.value
      })
      this.pronounSettings = updated
      showToast(`已${updated.includeVosotros ? '开启' : '关闭'} vosotros`, 'success')
    },
    onVosChange(event) {
      const updated = setPronounSettings({
        ...this.pronounSettings,
        includeVos: event.detail.value
      })
      this.pronounSettings = updated
      showToast(`已${updated.includeVos ? '开启' : '关闭'} vos`, 'success')
    },
    onReduceRareTenseFrequencyChange(event) {
      const updated = setPracticeGenerationSettings({
        ...this.practiceGenerationSettings,
        reduceRareTenseFrequency: event.detail.value
      })
      this.practiceGenerationSettings = updated
      showToast(`已${updated.reduceRareTenseFrequency ? '开启' : '关闭'}减少罕见时态`, 'success')
    },
    async onLeaderboardChange(event) {
      const newValue = event.detail.value
      showLoading('保存中...')
      
      try {
        const res = await api.updateLeaderboardSetting({
          participateInLeaderboard: newValue
        })
        hideLoading()
        
        if (res.success) {
          this.participateInLeaderboard = newValue
          showToast(`已${newValue ? '参与' : '退出'}排行榜`, 'success')
        } else {
          showToast('设置失败，请重试', 'error')
          // 恢复原值
          this.participateInLeaderboard = !newValue
        }
      } catch (error) {
        hideLoading()
        console.error('更新排行榜设置失败:', error)
        showToast('设置失败，请重试', 'error')
        // 恢复原值
        this.participateInLeaderboard = !newValue
      }
    },
    onUseInAppIMEChange(event) {
      const newValue = event.detail.value
      this.useInAppIME = setUseInAppIME(newValue)
      showToast(`已${this.useInAppIME ? '开启' : '关闭'}输入法`, 'success')
    }
  }
}
</script>

<style scoped>
.settings-container {
  min-height: 100vh;
  padding: 30rpx 32rpx 60rpx;
  background: #f8f8f8;
}

.section-group {
  margin-bottom: 40rpx;
}

.section-header {
  margin-bottom: 20rpx;
  padding: 0 8rpx;
}

.section-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #1f2430;
  margin-bottom: 8rpx;
}

.section-subtitle {
  display: block;
  font-size: 26rpx;
  color: #7786b7;
  line-height: 1.5;
}

.settings-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 12rpx 30rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #f0f0f0;
  margin-bottom: 16rpx;
}

.settings-card:last-child {
  margin-bottom: 0;
}

.card-header {
  margin-bottom: 12rpx;
}

.card-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #2d2f33;
  margin-bottom: 6rpx;
}

.card-subtitle {
  display: block;
  font-size: 24rpx;
  color: #7786b7;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 0;
  border-bottom: 1rpx solid #f1f2f6;
}

.setting-item:last-child {
  border-bottom: none;
}

.item-info {
  flex: 1;
  margin-right: 20rpx;
}

.item-title {
  display: block;
  font-size: 30rpx;
  color: #1f2430;
  font-weight: 600;
  margin-bottom: 4rpx;
}

.item-title-row {
  display: flex;
  align-items: center;
  margin-bottom: 4rpx;
}

.item-title-row .item-title {
  margin-bottom: 0;
}

.mode-info-button {
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  border: 2rpx solid #8B0012;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10rpx;
  background: #fff;
}

.mode-info-button-text {
  font-size: 22rpx;
  line-height: 1;
  color: #8B0012;
  font-weight: 600;
}

.item-desc {
  display: block;
  font-size: 24rpx;
  color: #8c93a5;
}

.setting-item.clickable {
  cursor: pointer;
}

.item-action {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.action-text {
  font-size: 24rpx;
  color: #8c93a5;
}

.action-arrow {
  font-size: 34rpx;
  color: #8c93a5;
  line-height: 1;
}

.selector-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-end;
  z-index: 999;
}

.selector-sheet {
  width: 100%;
  max-height: 86vh;
  background: #fff;
  border-top-left-radius: 26rpx;
  border-top-right-radius: 26rpx;
  padding: 24rpx;
}

.selector-header {
  margin-bottom: 16rpx;
}

.selector-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #2d2f33;
}

.selector-subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #7786b7;
}

.selector-scroll {
  max-height: 62vh;
}

.mood-accordion {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.mood-panel {
  border: 1rpx solid #eceff5;
  border-radius: 14rpx;
  background: #fff;
}

.mood-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx;
}

.mood-panel-title {
  font-size: 27rpx;
  color: #1f2430;
  font-weight: 600;
}

.mood-panel-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.mood-panel-count {
  font-size: 23rpx;
  color: #8c93a5;
}

.mood-panel-arrow {
  font-size: 22rpx;
  color: #8B0012;
}

.mood-panel-body {
  border-top: 1rpx solid #f1f2f6;
  padding: 14rpx 16rpx 18rpx;
}

.mood-actions {
  display: flex;
  justify-content: flex-start;
  gap: 10rpx;
  margin-bottom: 12rpx;
}

.mini-btn {
  min-width: 104rpx;
  height: 58rpx;
  border-radius: 10rpx;
  background: #8B0012;
  color: #fff;
  font-size: 22rpx;
  line-height: 58rpx;
  padding: 0 14rpx;
}

.mini-btn.secondary {
  background: #fff;
  color: #8B0012;
  border: 1rpx solid #8B0012;
}

.mini-btn::after {
  border: none;
}

.tense-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.tense-item {
  display: flex;
  align-items: center;
  padding: 10rpx 8rpx;
  border-radius: 8rpx;
  background: #fafbfe;
}

.tense-check {
  font-size: 28rpx;
  color: #8B0012;
  width: 34rpx;
}

.tense-label {
  font-size: 24rpx;
  color: #1f2430;
  line-height: 1.45;
}

.tense-label-dimmed {
  color: #9aa0a6;
}

.selector-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.selector-btn {
  flex: 1;
  height: 74rpx;
  line-height: 74rpx;
  border-radius: 12rpx;
  background: #8B0012;
  color: #fff;
  font-size: 26rpx;
}

.selector-btn.secondary {
  background: #fff;
  color: #8B0012;
  border: 1rpx solid #8B0012;
}

.selector-btn::after {
  border: none;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24rpx;
  box-sizing: border-box;
}

.modal-content {
  width: 72%;
  max-width: 620rpx;
  background: #fff;
  border-radius: 18rpx;
  padding: 42rpx 30rpx;
  box-sizing: border-box;
}

.rare-tense-modal-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #8B0012;
  text-align: center;
  margin-bottom: 24rpx;
}

.rare-tense-modal {
  max-height: 82vh;
  overflow-y: auto;
}

.rare-tense-section {
  margin-bottom: 18rpx;
}

.rare-tense-section:last-of-type {
  margin-bottom: 0;
}

.rare-tense-section-title {
  display: block;
  font-size: 26rpx;
  line-height: 1.55;
  color: #2d2f33;
  margin-bottom: 12rpx;
}

.rare-tense-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.rare-tense-item {
  display: block;
  font-size: 24rpx;
  color: #465067;
  line-height: 1.45;
  padding: 8rpx 12rpx;
  background: #fff8f8;
  border: 1rpx solid #f0d0d0;
  border-radius: 10rpx;
}

.rare-tense-close-btn {
  margin-top: 20rpx;
}
</style>
