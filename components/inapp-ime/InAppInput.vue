<template>
  <view
    class="inapp-input"
    :id="inputId"
    :class="{ 'is-focused': isFocused, 'is-disabled': disabled }"
    @tap="handleTap"
  >
    <view class="inapp-text" :class="textAlignClass">
      <text v-if="!localText" class="inapp-placeholder">{{ placeholder }}</text>
      <text class="inapp-before">{{ displayBefore }}</text>
      <view v-if="isFocused" class="inapp-caret" />
      <text class="inapp-after">{{ displayAfter }}</text>
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
      unsubscribeFocus: null
    }
  },
  computed: {
    displayBefore() {
      return this.localText.slice(0, this.cursor)
    },
    displayAfter() {
      return this.localText.slice(this.cursor)
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
      }
    }
    this.unsubscribeFocus = subscribeActiveTarget((target) => {
      const wasFocused = this.isFocused
      this.isFocused = target === this.inputTarget
      if (this.isFocused && !wasFocused) {
        this.$emit('focus')
      }
      if (!this.isFocused && wasFocused) {
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
      setActiveTarget(this.inputTarget)
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
.inapp-after {
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
