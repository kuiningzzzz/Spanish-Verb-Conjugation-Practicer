<template>
  <view class="page-root">
    <view
      class="search-container"
      :style="{
        paddingBottom: imeVisible ? imeHeight + 'px' : '',
        transform: imeLift ? 'translateY(-' + imeLift + 'px)' : ''
      }"
    >
    <!-- 搜索框 -->
    <view class="search-header">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <InAppInput
          v-if="useInAppIME"
          class="search-input"
          v-model="searchKeyword"
          placeholder="搜索单词原形或变位形式..."
          textAlign="left"
          :autoFocus="false"
          inputId="search-input"
          @focus="handleInAppFocus('search-input')"
          @input="onSearchInput"
          @confirm="performSearch"
        />
        <input
          v-else
          class="search-input"
          v-model="searchKeyword"
          placeholder="搜索单词原形或变位形式..."
          @input="onSearchInput"
          @confirm="performSearch"
        />
        <text v-if="searchKeyword" class="clear-btn" @click="clearSearch">✕</text>
      </view>
    </view>

    <!-- 搜索结果 -->
    <view v-if="showSearchResults" class="search-results">
      <!-- 精确匹配结果 -->
      <view v-if="hasExactResults" class="results-section">
        <!-- 原形精确匹配 -->
        <view
          v-for="verb in displayedExactInfinitive"
          :key="verb._key"
          class="result-item"
          @click="viewVerbDetail(verb)"
        >
          <view class="result-header">
            <text class="verb-infinitive">{{ formatInfinitive(verb) }}</text>
            <view class="verb-badges">
              <text v-if="verb.isReflexive" class="badge reflexive">Prnl.</text>
              <text v-if="verb.isIrregular" class="badge irregular">Irreg.</text>
              <text v-if="verb.hasTrUse" class="badge transitive">tr.</text>
              <text v-if="verb.hasIntrUse" class="badge intransitive">intr.</text>
            </view>
          </view>
          <text class="verb-meaning">{{ verb.meaning }}</text>
          <view class="verb-meta">
            <text class="meta-item">{{ verb.conjugationType }}</text>
          </view>
        </view>

        <!-- 变位精确匹配 -->
        <view
          v-for="verb in displayedExactConjugation"
          :key="verb._key"
          class="result-item"
          @click="viewVerbDetail(verb)"
        >
          <view class="result-header">
            <text class="verb-infinitive">{{ formatInfinitive(verb) }}</text>
            <view class="verb-badges">
              <text v-if="verb.isReflexive" class="badge reflexive">Prnl.</text>
              <text v-if="verb.isIrregular" class="badge irregular">Irreg.</text>
              <text v-if="verb.hasTrUse" class="badge transitive">tr.</text>
              <text v-if="verb.hasIntrUse" class="badge intransitive">intr.</text>
            </view>
          </view>
          <text class="verb-meaning">{{ verb.meaning }}</text>
          <!-- 显示匹配的变位 -->
          <view v-if="verb.matchedForm" class="matched-form-info">
            <text class="matched-form-label">匹配变位：</text>
            <text class="matched-form-text">{{ verb.matchedForm }}</text>
          </view>
          <view class="verb-meta">
            <text class="meta-item">{{ verb.conjugationType }}</text>
          </view>
        </view>

        <!-- 显示更多按钮（精确匹配） -->
        <view v-if="hasMoreExactResults" class="show-more-btn" @click="showMoreExact">
          显示更多 (剩余 {{ remainingExactCount }} 条)
        </view>
      </view>

      <!-- 模糊匹配结果 -->
      <view v-if="hasFuzzyResults" class="results-section fuzzy-section">
        <view class="section-title">
          <text>你想检索的单词还可能是：</text>
        </view>

        <!-- 原形模糊匹配 -->
        <view
          v-for="verb in displayedFuzzyInfinitive"
          :key="verb._key"
          class="result-item fuzzy-item"
          @click="viewVerbDetail(verb)"
        >
          <view class="result-header">
            <text class="verb-infinitive">{{ formatInfinitive(verb) }}</text>
            <view class="verb-badges">
              <text v-if="verb.isReflexive" class="badge reflexive">Prnl.</text>
              <text v-if="verb.isIrregular" class="badge irregular">Irreg.</text>
              <text v-if="verb.hasTrUse" class="badge transitive">tr.</text>
              <text v-if="verb.hasIntrUse" class="badge intransitive">intr.</text>
            </view>
          </view>
          <text class="verb-meaning">{{ verb.meaning }}</text>
          <view class="verb-meta">
            <text class="meta-item">{{ verb.conjugationType }}</text>
          </view>
        </view>

        <!-- 变位模糊匹配 -->
        <view
          v-for="verb in displayedFuzzyConjugation"
          :key="verb._key"
          class="result-item fuzzy-item"
          @click="viewVerbDetail(verb)"
        >
          <view class="result-header">
            <text class="verb-infinitive">{{ formatInfinitive(verb) }}</text>
            <view class="verb-badges">
              <text v-if="verb.isReflexive" class="badge reflexive">Prnl.</text>
              <text v-if="verb.isIrregular" class="badge irregular">Irreg.</text>
              <text v-if="verb.hasTrUse" class="badge transitive">tr.</text>
              <text v-if="verb.hasIntrUse" class="badge intransitive">intr.</text>
            </view>
          </view>
          <text class="verb-meaning">{{ verb.meaning }}</text>
          <!-- 显示匹配的变位 -->
          <view v-if="verb.matchedForm" class="matched-form-info">
            <text class="matched-form-label">匹配变位：</text>
            <text class="matched-form-text">{{ verb.matchedForm }}</text>
          </view>
          <view class="verb-meta">
            <text class="meta-item">{{ verb.conjugationType }}</text>
          </view>
        </view>

        <!-- 显示更多按钮（模糊匹配） -->
        <view v-if="hasMoreFuzzyResults" class="show-more-btn" @click="showMoreFuzzy">
          显示更多 (剩余 {{ remainingFuzzyCount }} 条)
        </view>
      </view>

      <!-- 无结果 -->
      <view v-if="!hasExactResults && !hasFuzzyResults" class="no-results">
        <text class="no-results-icon">🔍</text>
        <text class="no-results-text">未找到匹配的单词</text>
        <text class="no-results-hint">试试其他关键词或检查拼写</text>
      </view>
    </view>

    <!-- 搜索提示 / 历史 -->
    <view v-if="!showSearchResults && !searchKeyword">
      <view v-if="hasSearchHistory" class="history-section">
        <view class="section-title">
          <text>最近搜索</text>
        </view>
        <view
          v-for="(verb, index) in searchHistory"
          :key="verb._key"
          class="result-item history-item"
          @click="viewHistoryDetail(verb)"
        >
          <view class="result-header">
            <text class="verb-infinitive">{{ formatInfinitive(verb) }}</text>
            <view class="verb-badges">
              <text v-if="verb.isReflexive" class="badge reflexive">Prnl.</text>
              <text v-if="verb.isIrregular" class="badge irregular">Irreg.</text>
              <text v-if="verb.hasTrUse" class="badge transitive">tr.</text>
              <text v-if="verb.hasIntrUse" class="badge intransitive">intr.</text>
            </view>
          </view>
          <text class="verb-meaning">{{ verb.meaning }}</text>
          <view v-if="verb.matchedForm" class="matched-form-info">
            <text class="matched-form-label">匹配变位：</text>
            <text class="matched-form-text">{{ verb.matchedForm }}</text>
          </view>
          <view class="verb-meta">
            <text class="meta-item">{{ verb.conjugationType }}</text>
          </view>
          <view class="history-delete" @click.stop="deleteHistory(index)">删除</view>
        </view>
      </view>
      <view v-else class="search-tips">
        <view class="tip-item">
          <text class="tip-icon">💡</text>
          <text class="tip-text">输入动词原形，如 "hablar"</text>
        </view>
        <view class="tip-item">
          <text class="tip-icon">💡</text>
          <text class="tip-text">输入变位形式，如 "hablé"</text>
        </view>
        <view class="tip-item">
          <text class="tip-icon">💡</text>
          <text class="tip-text">支持模糊搜索和拼写容错</text>
        </view>
            <view class="tip-item">
          <text class="tip-icon">💡</text>
          <text class="tip-text">暂时只收录了《现代西班牙语第一册》的194个动词</text>
        </view>
      </view>
    </view>
    </view>
    <InAppKeyboardHost
      @height-change="onImeHeightChange"
      @visibility-change="onImeVisibilityChange"
      @popup-height-change="onImePopupHeightChange"
    />
  </view>
</template>

<script>
import api from '@/utils/api'
import { showToast } from '@/utils/common'
import { getUseInAppIME, subscribeUseInAppIME } from '@/utils/ime/settings-store.js'
import { setActiveTarget } from '@/utils/ime/focus-controller.js'
import InAppInput from '@/components/inapp-ime/InAppInput.vue'
import InAppKeyboardHost from '@/components/inapp-ime/InAppKeyboardHost.vue'

export default {
  components: {
    InAppInput,
    InAppKeyboardHost
  },
  data() {
    return {
      useInAppIME: getUseInAppIME(),
      imeVisible: false,
      imeHeight: 0,
      imePopupHeight: 0,
      imeLift: 0,
      focusedInputId: '',
      searchKeyword: '',
      showSearchResults: false,
      searchResults: {
        exactInfinitive: [],
        exactConjugation: [],
        fuzzyInfinitive: [],
        fuzzyConjugation: []
      },
      searchTimer: null,
      // 分页控制
      exactDisplayCount: 10, // 精确匹配默认显示10条
      fuzzyDisplayCount: 5,  // 模糊匹配默认显示5条
      searchHistory: [],
      unsubscribeImeSetting: null
    }
  },

  computed: {
    // 当前显示的精确匹配结果（原形）
    displayedExactInfinitive() {
      return this.searchResults.exactInfinitive.slice(0, this.exactDisplayCount)
    },
    
    // 当前显示的精确匹配结果（变位）
    displayedExactConjugation() {
      const remaining = this.exactDisplayCount - this.displayedExactInfinitive.length
      if (remaining <= 0) return []
      return this.searchResults.exactConjugation.slice(0, remaining)
    },
    
    // 当前显示的模糊匹配结果（原形）
    displayedFuzzyInfinitive() {
      return this.searchResults.fuzzyInfinitive.slice(0, this.fuzzyDisplayCount)
    },
    
    // 当前显示的模糊匹配结果（变位）
    displayedFuzzyConjugation() {
      const remaining = this.fuzzyDisplayCount - this.displayedFuzzyInfinitive.length
      if (remaining <= 0) return []
      return this.searchResults.fuzzyConjugation.slice(0, remaining)
    },
    
    // 是否有精确匹配结果
    hasExactResults() {
      return this.searchResults.exactInfinitive.length > 0 || 
             this.searchResults.exactConjugation.length > 0
    },
    
    // 是否有模糊匹配结果
    hasFuzzyResults() {
      return this.searchResults.fuzzyInfinitive.length > 0 || 
             this.searchResults.fuzzyConjugation.length > 0
    },
    
    // 是否有更多精确匹配结果
    hasMoreExactResults() {
      const totalExact = this.searchResults.exactInfinitive.length + 
                         this.searchResults.exactConjugation.length
      const displayed = this.displayedExactInfinitive.length + 
                        this.displayedExactConjugation.length
      return totalExact > displayed
    },
    
    // 剩余精确匹配结果数量
    remainingExactCount() {
      const totalExact = this.searchResults.exactInfinitive.length + 
                         this.searchResults.exactConjugation.length
      const displayed = this.displayedExactInfinitive.length + 
                        this.displayedExactConjugation.length
      return Math.max(0, totalExact - displayed)
    },
    
    // 是否有更多模糊匹配结果
    hasMoreFuzzyResults() {
      const totalFuzzy = this.searchResults.fuzzyInfinitive.length + 
                         this.searchResults.fuzzyConjugation.length
      const displayed = this.displayedFuzzyInfinitive.length + 
                        this.displayedFuzzyConjugation.length
      return totalFuzzy > displayed
    },
    
    // 剩余模糊匹配结果数量
    remainingFuzzyCount() {
      const totalFuzzy = this.searchResults.fuzzyInfinitive.length +
                         this.searchResults.fuzzyConjugation.length
      const displayed = this.displayedFuzzyInfinitive.length +
                        this.displayedFuzzyConjugation.length
      return Math.max(0, totalFuzzy - displayed)
    },

    // 是否有搜索历史
    hasSearchHistory() {
      return this.searchHistory.length > 0
    }
  },

  onShow() {
    this.scrollToTop()
    if (!this.unsubscribeImeSetting) {
      this.unsubscribeImeSetting = subscribeUseInAppIME((value) => {
        this.useInAppIME = value
        if (!value) {
          setActiveTarget(null)
        }
      })
    }
    this.loadSearchHistory()
  },
  onUnload() {
    setActiveTarget(null)
    if (this.unsubscribeImeSetting) {
      this.unsubscribeImeSetting()
      this.unsubscribeImeSetting = null
    }
  },
  onBackPress() {
    if (this.imeVisible) {
      setActiveTarget(null)
      return true
    }
    return false
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
    onImeHeightChange(height) {
      this.imeHeight = height || 0
      if (this.imeVisible && this.focusedInputId) {
        this.$nextTick(() => {
          this.ensureInputVisible(this.focusedInputId)
        })
      }
    },
    onImePopupHeightChange(height) {
      this.imePopupHeight = height || 0
      if (this.imeVisible && this.focusedInputId) {
        this.$nextTick(() => {
          this.ensureInputVisible(this.focusedInputId)
        })
      }
    },
    onImeVisibilityChange(visible) {
      this.imeVisible = visible
      if (!visible) {
        this.imeLift = 0
        this.imePopupHeight = 0
      }
      if (visible && this.focusedInputId) {
        this.$nextTick(() => {
          this.ensureInputVisible(this.focusedInputId)
        })
      }
    },
    handleInAppFocus(inputId) {
      this.focusedInputId = inputId
      this.ensureInputVisible(inputId)
    },
    ensureInputVisible(inputId) {
      if (!this.imeVisible || !this.imeHeight || !inputId) return
      const query = uni.createSelectorQuery().in(this)
      query.select(`#${inputId}`).boundingClientRect()
      query.exec((res) => {
        const rect = res[0]
        if (!rect) return
        const systemInfo = uni.getSystemInfoSync()
        const windowHeight = systemInfo.windowHeight || 0
      const keyboardTop = windowHeight - this.imeHeight - this.imePopupHeight
      const margin = 24
        const originalBottom = rect.bottom + this.imeLift
        const requiredLift = originalBottom > keyboardTop - margin ? originalBottom - (keyboardTop - margin) : 0
        this.imeLift = requiredLift
      })
    },
  
    formatInfinitive(verb) {
      if (!verb) return ''
      return verb.isReflexive ? `${verb.infinitive}(se)` : verb.infinitive
    },

    // 搜索输入处理（带防抖）
    onSearchInput() {
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
      }
      
      if (!this.searchKeyword || this.searchKeyword.trim().length < 2) {
        this.showSearchResults = false
        return
      }
      
      this.searchTimer = setTimeout(() => {
        this.performSearch()
      }, 300)
    },

    // 执行搜索
    async performSearch() {
      const keyword = this.searchKeyword.trim()
      
      if (keyword.length < 2) {
        showToast('请输入至少2个字符', 'none')
        return
      }

      // 重置显示数量
      this.exactDisplayCount = 10
      this.fuzzyDisplayCount = 5

      try {
        const res = await api.searchVerbs(keyword)
        if (res.success) {
          // 为每个结果添加唯一的 _key 属性，避免在模板中拼接字符串
          this.searchResults = {
            exactInfinitive: (res.exactInfinitive || []).map((v, i) => ({ ...v, _key: `exact-inf-${v.id}-${i}` })),
            exactConjugation: (res.exactConjugation || []).map((v, i) => ({ ...v, _key: `exact-conj-${v.id}-${i}` })),
            fuzzyInfinitive: (res.fuzzyInfinitive || []).map((v, i) => ({ ...v, _key: `fuzzy-inf-${v.id}-${i}` })),
            fuzzyConjugation: (res.fuzzyConjugation || []).map((v, i) => ({ ...v, _key: `fuzzy-conj-${v.id}-${i}` }))
          }
          this.showSearchResults = true
        }
      } catch (error) {
        console.error('搜索失败:', error)
        showToast('搜索失败', 'none')
      }
    },

    // 显示更多精确匹配结果
    showMoreExact() {
      this.exactDisplayCount += 10
    },
    
    // 显示更多模糊匹配结果
    showMoreFuzzy() {
      this.fuzzyDisplayCount += 5
    },

    // 清空搜索
    clearSearch() {
      this.searchKeyword = ''
      this.showSearchResults = false
      this.searchResults = {
        exactInfinitive: [],
        exactConjugation: [],
        fuzzyInfinitive: [],
        fuzzyConjugation: []
      }
      this.exactDisplayCount = 10
      this.fuzzyDisplayCount = 5
    },

    // 查看动词详情
    viewVerbDetail(verb) {
      this.addToSearchHistory(verb)
      uni.navigateTo({
        url: `/pages/conjugation-detail/conjugation-detail?verbId=${verb.id}`
      })
    },

    // 查看历史动词详情
    viewHistoryDetail(verb) {
      this.addToSearchHistory(verb)
      uni.navigateTo({
        url: `/pages/conjugation-detail/conjugation-detail?verbId=${verb.id}`
      })
    },

    // 载入搜索历史
    loadSearchHistory() {
      try {
        const history = uni.getStorageSync('verbSearchHistory') || []
        // 为历史记录也添加 _key
        this.searchHistory = Array.isArray(history) 
          ? history.map((v, i) => ({ ...v, _key: `history-${v.id}-${i}` }))
          : []
      } catch (error) {
        console.error('加载搜索历史失败:', error)
        this.searchHistory = []
      }
    },

    // 保存搜索历史
    saveSearchHistory() {
      uni.setStorageSync('verbSearchHistory', this.searchHistory)
    },

    // 添加到搜索历史
    addToSearchHistory(verb) {
      if (!verb || !verb.id) return

      const existingIndex = this.searchHistory.findIndex(item => item.id === verb.id)
      if (existingIndex !== -1) {
        this.searchHistory.splice(existingIndex, 1)
      }

      const historyItem = { ...verb, timestamp: Date.now() }
      this.searchHistory.unshift(historyItem)
      this.searchHistory = this.searchHistory.slice(0, 20)
      this.saveSearchHistory()
    },

    // 删除单条历史
    deleteHistory(index) {
      this.searchHistory.splice(index, 1)
      this.saveSearchHistory()
    }
  }
}
</script>

<style scoped>
.search-container {
  min-height: 100vh;
  background: #f8f9fa;
}

/* 搜索头部 */
.search-header {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  background: white;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  background: #f5f7fa;
  border-radius: 50rpx;
  padding: 20rpx 30rpx;
  transition: all 0.3s;
}

.search-box:focus-within {
  background: white;
  box-shadow: 0 0 0 2rpx #8B0012;
}

.search-icon {
  font-size: 40rpx;
  margin-right: 15rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.clear-btn {
  padding: 10rpx;
  color: #999;
  font-size: 32rpx;
  font-weight: bold;
}

/* 搜索结果 */
.search-results {
  padding: 20rpx 0;
}

.results-section {
  background: white;
  margin: 20rpx 30rpx;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
}

.fuzzy-section {
  margin-top: 40rpx;
  border-top: 4rpx dashed #e0e0e0;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #666;
  margin-bottom: 25rpx;
  padding-bottom: 15rpx;
  border-bottom: 2rpx solid #f0f0f0;
}


.result-item {
  padding: 30rpx 20rpx;
  background: #f9fafb;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  transition: all 0.3s;
}

.result-item:last-child {
  margin-bottom: 0;
}

.result-item:active {
  background: #f0f2f5;
  transform: scale(0.98);
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15rpx;
}

.verb-infinitive {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
  margin-right: 15rpx;
}

.verb-badges {
  display: flex;
  gap: 10rpx;
}

.badge {
  font-size: 20rpx;
  padding: 6rpx 16rpx;
  border-radius: 30rpx;
  white-space: nowrap;
}

.badge.reflexive {
  background: #ff6b6b;
  color: white;
}

.badge.irregular {
  background: #ff8c00;
  color: white;
}

.badge.transitive {
  background: #1e88e5;
  color: white;
}

.badge.intransitive {
  background: #43a047;
  color: white;
}

.irregular-badge {
  background: #ff6b6b;
  color: white;
  font-size: 20rpx;
  padding: 6rpx 16rpx;
  border-radius: 30rpx;
}

.verb-meaning {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 15rpx;
  display: block;
}

/* 变位形式匹配信息 */
.matched-form-info {
  background: #fff5f5;
  padding: 15rpx 20rpx;
  border-radius: 12rpx;
  margin-bottom: 15rpx;
  border-left: 4rpx solid #8B0012;
}

.matched-form-label {
  font-size: 24rpx;
  color: #999;
  margin-right: 10rpx;
}

.matched-form-text {
  font-size: 26rpx;
  color: #8B0012;
  font-weight: 600;
}


.verb-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 15rpx;
}

.meta-item {
  font-size: 24rpx;
  color: #999;
  background: white;
  padding: 8rpx 18rpx;
  border-radius: 20rpx;
}

.fuzzy-item {
  opacity: 0.9;
}

/* 显示更多按钮 */
.show-more-btn {
  margin-top: 30rpx;
  padding: 20rpx 40rpx;
  background: #8B0012;
  color: white;
  font-size: 28rpx;
  font-weight: 600;
  text-align: center;
  border-radius: 50rpx;
  box-shadow: 0 4rpx 15rpx rgba(139, 0, 18, 0.3);
  transition: all 0.3s;
}

.show-more-btn:active {
  transform: scale(0.95);
  box-shadow: 0 2rpx 10rpx rgba(139, 0, 18, 0.3);
}

/* 无结果 */
.no-results {
  text-align: center;
  padding: 100rpx 60rpx;
}

.no-results-icon {
  font-size: 120rpx;
  display: block;
  margin-bottom: 30rpx;
  opacity: 0.3;
}

.no-results-text {
  font-size: 32rpx;
  color: #666;
  display: block;
  margin-bottom: 15rpx;
}

.no-results-hint {
  font-size: 26rpx;
  color: #999;
  display: block;
}

/* 搜索提示 */
.search-tips {
  padding: 60rpx 50rpx;
}

.history-section {
  padding: 40rpx 30rpx 80rpx;
}

.history-item {
  position: relative;
  padding-bottom: 60rpx;
  margin-bottom: 30rpx;
  border: 2rpx solid #e8e8e8;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.history-delete {
  position: absolute;
  right: 30rpx;
  bottom: 20rpx;
  font-size: 26rpx;
  color: #ff6b6b;
  padding: 12rpx 20rpx;
  background: #ffecec;
  border-radius: 30rpx;
  box-shadow: 0 2rpx 8rpx rgba(255, 107, 107, 0.2);
}

.tip-item {
  display: flex;
  align-items: center;
  padding: 30rpx;
  background: white;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.tip-icon {
  font-size: 48rpx;
  margin-right: 20rpx;
}

.tip-text {
  font-size: 28rpx;
  color: #666;
}
</style>
