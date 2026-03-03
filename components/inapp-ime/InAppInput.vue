<template>
  <view
    class="inapp-input"
    :id="inputId"
    :class="{ 'is-focused': isFocused, 'is-disabled': disabled }"
    @tap="handleTap"
  >
    <view class="inapp-text" :class="textAlignClass">
      <text v-if="!localText" class="inapp-placeholder">{{ placeholder }}</text>
      <text
        v-for="(char, index) in beforeChars"
        :key="'b-' + index"
        class="inapp-char"
        @tap.stop="handleCharTap(index + 1)"
      >{{ char }}</text>
      <view v-if="isFocused" class="inapp-caret" />
      <text
        v-for="(char, index) in afterChars"
        :key="'a-' + index"
        class="inapp-char"
        @tap.stop="handleCharTap(cursor + index)"
      >{{ char }}</text>
    </view>
  </view>
</template>

<script>
import { setActiveTarget, subscribeActiveTarget, getActiveTarget } from '@/utils/ime/focus-controller.js'
import { getUseInAppIME } from '@/utils/ime/settings-store.js'

export default {
  name: 'InAppInput',
  props: {
    value: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false
    },
    autoFocus: {
      type: Boolean,
      default: false
    },
    textAlign: {
      type: String,
      default: 'center'
    },
    inputId: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      localText: this.value || '',
      cursor: (this.value || '').length,
      isFocused: false,
      unsubscribeFocus: null,
      inputRect: null
    }
  },
  computed: {
    displayBefore() {
      return this.localText.slice(0, this.cursor)
    },
    displayAfter() {
      return this.localText.slice(this.cursor)
    },
    beforeChars() {
      return this.localText.slice(0, this.cursor).split('')
    },
    afterChars() {
      return this.localText.slice(this.cursor).split('')
    },
    textAlignClass() {
      return this.textAlign === 'left' ? 'align-left' : 'align-center'
    }
  },
  watch: {
    value(newValue) {
      if (newValue === this.localText) return
      this.localText = newValue || ''
      if (!this.isFocused) {
        this.cursor = this.localText.length
      } else if (this.cursor > this.localText.length) {
        this.cursor = this.localText.length
      }
    }
  },
  created() {
    this.inputTarget = {
      getText: () => this.localText,
      setText: (text) => {
        const next = text || ''
        this.localText = next
        this.$emit('input', next)
      },
      getCursor: () => this.cursor,
      setCursor: (pos) => {
        const nextPos = Math.max(0, Math.min(pos, this.localText.length))
        this.cursor = nextPos
      },
      onSubmit: (text) => {
        this.$emit('confirm', text)
      },
      // 由 InAppKeyboardHost 在遮罩点击时调用，用于光标重定位。
      // 若点击坐标落在本输入框内则处理并返回 true，否则返回 false。
      handleExternalTap: (point) => {
        if (!point || !this.inputRect) return false
        const { left, right, top, bottom } = this.inputRect
        if (point.x < left || point.x > right || point.y < top || point.y > bottom) return false
        // 坐标在输入框内，查询各字符的位置后计算光标落点
        const query = uni.createSelectorQuery().in(this)
        query.selectAll('.inapp-char').boundingClientRect((charRects) => {
          if (!charRects || charRects.length === 0) {
            this.cursor = 0
            return
          }
          let newCursor = 0
          for (let i = 0; i < charRects.length; i++) {
            const mid = charRects[i].left + charRects[i].width / 2
            if (point.x > mid) {
              newCursor = i + 1
            } else {
              break
            }
          }
          this.cursor = newCursor
        }).exec()
        return true
      }
    }
    this.unsubscribeFocus = subscribeActiveTarget((target) => {
      const wasFocused = this.isFocused
      this.isFocused = target === this.inputTarget
      if (this.isFocused && !wasFocused) {
        this.$emit('focus')
        // 缓存元素位置，供遮罩点击时判断坐标是否落在输入框内
        this.$nextTick(() => {
          const query = uni.createSelectorQuery().in(this)
          query.select('.inapp-input').boundingClientRect((rect) => {
            this.inputRect = rect
          }).exec()
        })
      }
      if (!this.isFocused && wasFocused) {
        this.inputRect = null
        this.$emit('blur')
      }
    })
  },
  mounted() {
    if (this.autoFocus && !this.disabled && getUseInAppIME()) {
      setTimeout(() => {
        setActiveTarget(this.inputTarget)
      }, 0)
    }
  },
  beforeDestroy() {
    if (this.unsubscribeFocus) {
      this.unsubscribeFocus()
      this.unsubscribeFocus = null
    }
    if (getActiveTarget() === this.inputTarget) {
      setActiveTarget(null)
    }
  },
  methods: {
    handleTap() {
      if (this.disabled) return
      if (!getUseInAppIME()) return
      // 点击输入框空白区域时激活并将光标移到末尾
      setActiveTarget(this.inputTarget)
      this.cursor = this.localText.length
    },
    handleCharTap(charIndex) {
      if (this.disabled) return
      if (!getUseInAppIME()) return
      setActiveTarget(this.inputTarget)
      // beforeChars[i] 点击时传入 i+1（光标置于字符右侧）
      // afterChars[i] 点击时传入 cursor+i（光标置于字符左侧）
      const pos = Math.max(0, Math.min(charIndex, this.localText.length))
      this.cursor = pos
    },
    focus() {
      if (this.disabled) return
      setActiveTarget(this.inputTarget)
    }
  }
}
</script>

<style scoped>
.inapp-input {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.inapp-input.is-disabled {
  opacity: 0.6;
}

.inapp-text {
  position: relative;
  width: 100%;
  min-height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-family: 'Noto Serif', 'Georgia', serif;
  color: inherit;
  font-size: inherit;
}

.inapp-text.align-left {
  justify-content: flex-start;
  text-align: left;
}

.inapp-text.align-center {
  justify-content: center;
  text-align: center;
}

.inapp-placeholder {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  color: #9aa3b2;
}

.inapp-before,
.inapp-after,
.inapp-char {
  white-space: pre;
}

.inapp-caret {
  width: 2rpx;
  height: 36rpx;
  background: #8B0012;
  margin: 0 2rpx;
  animation: caretBlink 1s step-end infinite;
}

@keyframes caretBlink {
  0%, 50% {
    opacity: 1;
  }
  50.01%, 100% {
    opacity: 0;
  }
}
</style>
