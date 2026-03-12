let activeTarget = null
const listeners = new Set()

export function setActiveTarget(target) {
  activeTarget = target || null
  listeners.forEach((listener) => {
    try {
      listener(activeTarget)
    } catch (e) {
      console.error('FocusController listener error', e)
    }
  })
}

export function getActiveTarget() {
  return activeTarget
}

export function subscribeActiveTarget(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 将遮罩点击坐标分发给当前聚焦的输入目标。
 * 若目标实现了 handleExternalTap(point) 且返回 true，
 * 说明点击已由输入框自行处理（光标重定位），调用方应跳过后续关闭逻辑。
 */
export function dispatchMaskTap(point) {
  if (activeTarget && typeof activeTarget.handleExternalTap === 'function') {
    return activeTarget.handleExternalTap(point)
  }
  return false
}
