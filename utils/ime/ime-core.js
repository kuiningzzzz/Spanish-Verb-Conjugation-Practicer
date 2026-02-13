const SHIFT_OFF = 'OFF'
const SHIFT_ONCE = 'ONCE'
const SHIFT_LOCK = 'LOCK'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function applyShiftToChar(char, shiftState) {
  if (shiftState === SHIFT_OFF) return char
  return char.toUpperCase()
}

export class IMECore {
  constructor() {
    this.textBuffer = ''
    this.cursor = 0
    this.shiftState = SHIFT_OFF
    this.target = null
    this.listeners = new Set()
  }

  attachTarget(target) {
    this.target = target
    const text = target ? target.getText() : ''
    const cursor = target ? target.getCursor() : 0
    this.textBuffer = text || ''
    this.cursor = clamp(cursor || 0, 0, this.textBuffer.length)
    this.emit()
  }

  detachTarget() {
    this.target = null
    this.emit()
  }

  getText() {
    return this.textBuffer
  }

  getCursor() {
    return this.cursor
  }

  getShiftState() {
    return this.shiftState
  }

  getTarget() {
    return this.target
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit() {
    const snapshot = {
      text: this.textBuffer,
      cursor: this.cursor,
      shiftState: this.shiftState,
      hasTarget: Boolean(this.target)
    }
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot)
      } catch (e) {
        console.error('IMECore listener error', e)
      }
    })
  }

  insert(char, applyShift = true) {
    if (!this.target) return
    if (!char) return
    const output = applyShift ? applyShiftToChar(char, this.shiftState) : char
    const before = this.textBuffer.slice(0, this.cursor)
    const after = this.textBuffer.slice(this.cursor)
    this.textBuffer = `${before}${output}${after}`
    this.cursor += output.length
    if (this.shiftState === SHIFT_ONCE) {
      this.shiftState = SHIFT_OFF
    }
    this.commit()
  }

  deleteBackward() {
    if (!this.target) return
    if (this.cursor <= 0) return
    const before = this.textBuffer.slice(0, this.cursor - 1)
    const after = this.textBuffer.slice(this.cursor)
    this.textBuffer = `${before}${after}`
    this.cursor = clamp(this.cursor - 1, 0, this.textBuffer.length)
    this.commit()
  }

  moveCursor(delta) {
    if (!this.target) return
    this.cursor = clamp(this.cursor + delta, 0, this.textBuffer.length)
    this.commit()
  }

  toggleShift() {
    if (this.shiftState === SHIFT_OFF) {
      this.shiftState = SHIFT_ONCE
    } else if (this.shiftState === SHIFT_ONCE) {
      this.shiftState = SHIFT_LOCK
    } else {
      this.shiftState = SHIFT_OFF
    }
    this.emit()
  }

  commit() {
    if (!this.target) return
    this.target.setText(this.textBuffer)
    this.target.setCursor(this.cursor)
    this.emit()
  }

  resetShift() {
    this.shiftState = SHIFT_OFF
    this.emit()
  }
}

export const SHIFT_STATES = {
  OFF: SHIFT_OFF,
  ONCE: SHIFT_ONCE,
  LOCK: SHIFT_LOCK
}
