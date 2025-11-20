// 通用工具函数

/**
 * 格式化日期
 */
export function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second)
}

/**
 * 显示提示消息
 */
export function showToast(title, icon = 'none', duration = 2000) {
  // 对于长文本，增加显示时长，并且不限制文本长度
  const finalDuration = title.length > 10 ? 3000 : duration
  
  uni.showToast({
    title,
    icon,
    duration: finalDuration,
    mask: false  // 不显示透明蒙层，避免阻挡用户操作
  })
}

/**
 * 显示加载中
 */
export function showLoading(title = '加载中...') {
  uni.showLoading({
    title,
    mask: true
  })
}

/**
 * 隐藏加载
 */
export function hideLoading() {
  uni.hideLoading()
}

/**
 * 确认对话框
 */
export function showConfirm(content, title = '提示') {
  return new Promise((resolve, reject) => {
    uni.showModal({
      title,
      content,
      success: (res) => {
        if (res.confirm) {
          resolve()
        } else {
          reject()
        }
      }
    })
  })
}

/**
 * 模态对话框（返回 true/false）
 */
export function showModal(title = '提示', content = '') {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm)
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

/**
 * 存储数据
 */
export function setStorage(key, value) {
  try {
    uni.setStorageSync(key, value)
    return true
  } catch (e) {
    console.error('存储失败:', e)
    return false
  }
}

/**
 * 获取存储数据
 */
export function getStorage(key) {
  try {
    return uni.getStorageSync(key)
  } catch (e) {
    console.error('读取失败:', e)
    return null
  }
}

/**
 * 移除存储数据
 */
export function removeStorage(key) {
  try {
    uni.removeStorageSync(key)
    return true
  } catch (e) {
    console.error('删除失败:', e)
    return false
  }
}

/**
 * 打乱数组
 */
export function shuffleArray(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 计算学习天数
 */
export function calculateStudyDays(startDate) {
  const start = new Date(startDate)
  const now = new Date()
  const diff = now - start
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
