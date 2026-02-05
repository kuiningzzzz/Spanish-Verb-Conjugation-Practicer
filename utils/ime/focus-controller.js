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
