const USE_IN_APP_IME_KEY = 'useInAppIME'
const defaultUseInAppIME = true

const listeners = new Set()

export function getUseInAppIME() {
  try {
    const cached = uni.getStorageSync(USE_IN_APP_IME_KEY)
    if (cached === '' || cached === null || cached === undefined) {
      return defaultUseInAppIME
    }
    return Boolean(cached)
  } catch (error) {
    console.warn('读取内置输入法设置失败，使用默认值', error)
  }
  return defaultUseInAppIME
}

export function setUseInAppIME(value) {
  const normalized = Boolean(value)
  try {
    uni.setStorageSync(USE_IN_APP_IME_KEY, normalized)
  } catch (error) {
    console.error('保存内置输入法设置失败', error)
  }
  listeners.forEach((listener) => {
    try {
      listener(normalized)
    } catch (e) {
      console.error('内置输入法设置监听器错误', e)
    }
  })
  return normalized
}

export function subscribeUseInAppIME(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getDefaultUseInAppIME() {
  return defaultUseInAppIME
}
