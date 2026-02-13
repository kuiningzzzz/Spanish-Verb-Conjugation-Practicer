<template>
  <view v-if="visible" class="ime-overlay" @tap="handleMaskTap">
    <view class="ime-panel" @tap.stop>
      <view v-if="popup.visible" class="ime-popup">
        <view
          v-for="(variant, index) in popup.variants"
          :key="`variant-${index}`"
          class="ime-variant"
          :class="{ 'is-highlight': index === popup.highlightIndex }"
          @tap.stop="handleVariantSelect(variant)"
        >
          {{ variant }}
        </view>
      </view>

      <view class="ime-rows">
        <view v-for="(row, rowIndex) in rows" :key="`row-${rowIndex}`" class="ime-row">
          <view
            v-for="key in row"
            :key="key.id"
            class="ime-key"
            :class="keyClass(key)"
            @touchstart.stop="onKeyTouchStart(key)"
            @touchend.stop="onKeyTouchEnd(key)"
            @touchcancel.stop="onKeyTouchCancel"
            @tap.stop="onKeyTap(key)"
          >
            <text class="ime-key-label" :class="{ 'is-bold': key.bold }">{{ key.label }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getSpanishLayout, getNumSymbolLayout } from '@/utils/ime/keyboard-layout.js'
import { IMECore } from '@/utils/ime/ime-core.js'
import { subscribeActiveTarget, setActiveTarget } from '@/utils/ime/focus-controller.js'
import { getUseInAppIME, subscribeUseInAppIME } from '@/utils/ime/settings-store.js'

const imeCore = new IMECore()
const LONG_PRESS_MS = 380

export default {
  name: 'InAppKeyboardHost',
  data() {
    return {
      visible: false,
      rows: [],
      shiftState: 'OFF',
      layoutMode: 'alpha',
      longPressTimer: null,
      longPressTriggered: false,
      pressedKey: null,
      tapConsumed: false,
      suppressNextTap: false,
      popup: {
        visible: false,
        variants: [],
        highlightIndex: 0
      },
      popupHeight: 0,
      unsubscribeFocus: null,
      unsubscribeCore: null,
      unsubscribeSettings: null
    }
  },
  created() {
    this.rows = getSpanishLayout(this.shiftState)
    this.unsubscribeCore = imeCore.subscribe((snapshot) => {
      this.shiftState = snapshot.shiftState
      this.rows = this.layoutMode === 'alpha' ? getSpanishLayout(this.shiftState) : getNumSymbolLayout()
    })
    this.unsubscribeFocus = subscribeActiveTarget((target) => {
      if (!getUseInAppIME()) {
        this.hideKeyboard()
        return
      }
      if (target) {
        imeCore.attachTarget(target)
        this.visible = true
        this.layoutMode = 'alpha'
        this.rows = getSpanishLayout(this.shiftState)
        this.$emit('visibility-change', true)
        this.updateKeyboardHeight()
      } else {
        this.hideKeyboard()
      }
    })
    this.unsubscribeSettings = subscribeUseInAppIME((value) => {
      if (!value) {
        this.hideKeyboard()
      }
    })
  },
  beforeDestroy() {
    if (this.unsubscribeFocus) this.unsubscribeFocus()
    if (this.unsubscribeCore) this.unsubscribeCore()
    if (this.unsubscribeSettings) this.unsubscribeSettings()
    this.clearLongPressTimer()
  },
  methods: {
    keyClass(key) {
      return {
        'is-func': key.type === 'FUNC',
        'is-wide': key.wide,
        'is-narrow': key.narrow,
        'is-numsym': key.isNumSym,
        'is-num': key.isNumber,
        'is-aux': key.isAux,
        'is-space': key.isSpace,
        'is-shift-active': key.action === 'SHIFT' && this.shiftState !== 'OFF',
        'is-shift-lock': key.action === 'SHIFT' && this.shiftState === 'LOCK'
      }
    },
    handleMaskTap() {
      this.hideKeyboard()
      setActiveTarget(null)
    },
    hideKeyboard() {
      this.visible = false
      this.layoutMode = 'alpha'
      this.popup.visible = false
      this.popup.variants = []
      this.popup.highlightIndex = 0
      this.popupHeight = 0
      imeCore.detachTarget()
      this.$emit('visibility-change', false)
      this.$emit('height-change', 0)
      this.$emit('popup-height-change', 0)
    },
    onKeyTouchStart(key) {
      this.pressedKey = key
      this.longPressTriggered = false
      this.clearLongPressTimer()

      if (key.type === 'CHAR' && key.variants && key.variants.length > 0) {
        this.longPressTimer = setTimeout(() => {
          this.longPressTriggered = true
          this.showVariants(key)
        }, LONG_PRESS_MS)
      }
    },
    onKeyTouchEnd(key) {
      this.clearLongPressTimer()
      if (this.popup.visible) {
        if (key && key.type === 'FUNC') {
          this.handleKeyPress(key)
        }
        this.longPressTriggered = false
        return
      }
      if (this.tapConsumed) {
        this.tapConsumed = false
        return
      }
      this.longPressTriggered = false
      this.pressedKey = null
    },
    onKeyTouchCancel() {
      this.clearLongPressTimer()
      this.hidePopup()
      this.longPressTriggered = false
      this.pressedKey = null
      this.tapConsumed = false
      this.suppressNextTap = false
    },
    onKeyTap(key) {
      if (this.longPressTriggered) return
      if (this.suppressNextTap) {
        this.suppressNextTap = false
        return
      }
      if (this.popup.visible) return
      this.handleKeyPress(key)
    },
    handleKeyPress(key) {
      if (!key) return
      if (this.popup.visible) {
        if (key.action === 'LEFT') {
          this.suppressNextTap = true
          this.moveVariantHighlight(-1)
          return
        }
        if (key.action === 'RIGHT') {
          this.suppressNextTap = true
          this.moveVariantHighlight(1)
          return
        }
        if (key.action === 'SPACE') {
          this.suppressNextTap = true
          this.commitHighlightedVariant()
          return
        }
        if (key.action === 'ENTER') {
          this.suppressNextTap = true
          this.commitHighlightedVariant()
          return
        }
        if (key.action === 'BACKSPACE') {
          this.suppressNextTap = true
          this.hidePopup()
          return
        }
        return
      }
      if (key.type === 'CHAR') {
        imeCore.insert(key.output)
        return
      }
      switch (key.action) {
        case 'SHIFT':
          imeCore.toggleShift()
          break
        case 'BACKSPACE':
          imeCore.deleteBackward()
          break
        case 'SPACE':
          imeCore.insert(' ')
          break
        case 'LEFT':
          imeCore.moveCursor(-1)
          break
        case 'RIGHT':
          imeCore.moveCursor(1)
          break
        case 'ENTER':
          this.handleSubmit()
          break
        case 'NUMSYM':
          this.layoutMode = 'num'
          this.rows = getNumSymbolLayout()
          this.updateKeyboardHeight()
          break
        case 'RETURN':
          this.layoutMode = 'alpha'
          this.rows = getSpanishLayout(this.shiftState)
          this.updateKeyboardHeight()
          break
        default:
          break
      }
    },
    handleSubmit() {
      const target = imeCore.getTarget()
      imeCore.commit()
      if (target && target.onSubmit) {
        target.onSubmit(imeCore.getText())
      }
    },
    showVariants(key) {
      if (!key || !key.variants || key.variants.length === 0) return
      const shiftActive = this.shiftState !== 'OFF'
      const highlightIndex = this.getVariantHighlightIndex(key.variants, shiftActive)
      this.popup.visible = true
      this.popup.variants = key.variants
      this.popup.highlightIndex = highlightIndex
      this.updatePopupHeight()
    },
    hidePopup() {
      this.popup.visible = false
      this.popup.variants = []
      this.popup.highlightIndex = 0
      this.popupHeight = 0
      this.$emit('popup-height-change', 0)
    },
    handleVariantSelect(variant) {
      if (!variant) return
      imeCore.insert(variant, false)
      this.hidePopup()
    },
    moveVariantHighlight(delta) {
      if (!this.popup.visible || !this.popup.variants.length) return
      const count = this.popup.variants.length
      const next = (this.popup.highlightIndex + delta + count) % count
      this.popup.highlightIndex = next
    },
    commitHighlightedVariant() {
      if (!this.popup.visible || !this.popup.variants.length) return
      const variant = this.popup.variants[this.popup.highlightIndex]
      if (!variant) return
      imeCore.insert(variant, false)
      this.hidePopup()
    },
    getVariantHighlightIndex(variants, shiftActive) {
      if (!variants || variants.length === 0) return 0
      if (!shiftActive) return 0
      const index = variants.findIndex((item) => item === item.toUpperCase())
      return index >= 0 ? index : 0
    },
    clearLongPressTimer() {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer)
        this.longPressTimer = null
      }
    },
    updatePopupHeight() {
      this.$nextTick(() => {
        const query = uni.createSelectorQuery().in(this)
        query.select('.ime-popup').boundingClientRect((rect) => {
          const height = rect && rect.height ? rect.height : 0
          this.popupHeight = height
          this.$emit('popup-height-change', height)
        }).exec()
      })
    },
    updateKeyboardHeight() {
      this.$nextTick(() => {
        const query = uni.createSelectorQuery().in(this)
        query.select('.ime-panel').boundingClientRect((rect) => {
          const height = rect && rect.height ? rect.height : 0
          this.$emit('height-change', height)
        }).exec()
      })
    }
  }
}
</script>

<style scoped>
.ime-overlay {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}

.ime-panel {
  width: 100%;
  background: #8b0012;
  padding: 24rpx 20rpx 36rpx;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  box-shadow: none;
}

.ime-popup {
  background: rgba(255, 255, 255, 0.12);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  border-radius: 22rpx;
  padding: 12rpx 16rpx;
  display: flex;
  justify-content: center;
  margin-bottom: 18rpx;
  backdrop-filter: blur(8rpx);
}

.ime-variant {
  min-width: 64rpx;
  padding: 10rpx 16rpx;
  margin: 0 8rpx;
  text-align: center;
  font-size: 32rpx;
  color: #fef8f2;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16rpx;
  border: 1rpx solid transparent;
}

.ime-variant.is-highlight {
  background: #f7c77b;
  color: #2c1b0f;
  border-color: rgba(255, 255, 255, 0.7);
  font-weight: 700;
}

.ime-rows {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.ime-row {
  display: flex;
  gap: 12rpx;
  justify-content: center;
}

.ime-key {
  flex: 1;
  min-height: 86rpx;
  background: #ffffff;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  border: 1rpx solid rgba(255, 255, 255, 0.6);
  color: #8b0012;
}

.ime-key.is-wide {
  flex: 1.6;
}

.ime-key.is-narrow {
  flex: 0.7;
}

.ime-key.is-func {
  background: #fff0f0;
  color: #8b0012;
  border: none;
  box-shadow: none;
}

.ime-key.is-numsym {
  background: #fff0f0;
  color: #8b0012;
  border: none;
  box-shadow: none;
}

.ime-key.is-num {
  background: #ffffff;
  color: #8b0012;
}

.ime-key.is-aux {
  background: #fff0f0;
  color: #8b0012;
  border: none;
  box-shadow: none;
}

.ime-key.is-space {
  background: #fff0f0;
  color: #8b0012;
  border: none;
  box-shadow: none;
}

.ime-key.is-shift-active {
  background: #f7c77b;
  color: #2c1b0f;
}

.ime-key.is-shift-lock {
  position: relative;
}

.ime-key.is-shift-lock::after {
  content: '';
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 12rpx;
  height: 12rpx;
  background: #8b0012;
  border-radius: 999rpx;
}


.ime-key-label {
  font-family: 'Noto Serif', 'Georgia', serif;
  font-size: 30rpx;
  font-weight: 600;
}

.ime-key-label.is-bold {
  font-weight: 800;
}
</style>
