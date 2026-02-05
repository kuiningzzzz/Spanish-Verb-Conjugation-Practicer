const LETTER_ROW_1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']
const LETTER_ROW_2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ']
const LETTER_ROW_3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm']

const VARIANTS = {
  a: ['á', 'Á'],
  e: ['é', 'É'],
  i: ['í', 'Í'],
  o: ['ó', 'Ó'],
  u: ['ú', 'ü', 'Ú', 'Ü'],
  n: ['ñ', 'Ñ'],
  '?': ['¿'],
  '!': ['¡']
}

function charLabel(char, shiftState) {
  if (shiftState === 'OFF') return char
  return char.toUpperCase()
}

function makeCharKey(char, shiftState) {
  const baseVariants = VARIANTS[char] ? [...VARIANTS[char]] : []
  const isLetter = /^[a-zñ]$/.test(char)
  if (isLetter) {
    baseVariants.push(char.toUpperCase(), char)
  }
  return {
    id: `Key-${char}`,
    type: 'CHAR',
    label: charLabel(char, shiftState),
    output: char,
    variants: baseVariants
  }
}

function makeNarrowCharKey(char, shiftState) {
  return {
    ...makeCharKey(char, shiftState),
    narrow: true
  }
}

function makeFuncKey(id, label, action, extra = {}) {
  return {
    id,
    type: 'FUNC',
    label,
    action,
    ...extra
  }
}

export function getSpanishLayout(shiftState) {
  return [
    LETTER_ROW_1.map((char) => makeCharKey(char, shiftState)),
    LETTER_ROW_2.map((char) => makeCharKey(char, shiftState)),
    [
      makeFuncKey('Key-Shift', 'Shift', 'SHIFT', { wide: true }),
      ...LETTER_ROW_3.map((char) => makeCharKey(char, shiftState)),
      makeFuncKey('Key-Backspace', '⌫', 'BACKSPACE', { wide: true })
    ],
    [
      makeFuncKey('Key-NumSym', '123!?', 'NUMSYM', { isNumSym: true, wide: true }),
      makeNarrowCharKey(',', shiftState),
      makeFuncKey('Key-Left', '◀', 'LEFT'),
      makeFuncKey('Key-Space', 'Space', 'SPACE', { wide: true }),
      makeFuncKey('Key-Right', '▶', 'RIGHT'),
      makeNarrowCharKey('.', shiftState),
      makeFuncKey('Key-Enter', 'Enter', 'ENTER', { wide: true })
    ]
  ]
}

export function getNumSymbolLayout() {
  return [
    [
      { id: 'Key-InvQ', type: 'CHAR', label: '¿', output: '¿', isAux: true },
      { id: 'Key-1', type: 'CHAR', label: '1', output: '1', isNumber: true },
      { id: 'Key-2', type: 'CHAR', label: '2', output: '2', isNumber: true },
      { id: 'Key-3', type: 'CHAR', label: '3', output: '3', isNumber: true },
      { id: 'Key-Backspace', type: 'FUNC', label: '⌫', action: 'BACKSPACE', isAux: true }
    ],
    [
      { id: 'Key-Q', type: 'CHAR', label: '?', output: '?', isAux: true },
      { id: 'Key-4', type: 'CHAR', label: '4', output: '4', isNumber: true },
      { id: 'Key-5', type: 'CHAR', label: '5', output: '5', isNumber: true },
      { id: 'Key-6', type: 'CHAR', label: '6', output: '6', isNumber: true },
      { id: 'Key-Dot', type: 'CHAR', label: '.', output: '.', isAux: true }
    ],
    [
      { id: 'Key-InvEx', type: 'CHAR', label: '¡', output: '¡', isAux: true },
      { id: 'Key-7', type: 'CHAR', label: '7', output: '7', isNumber: true },
      { id: 'Key-8', type: 'CHAR', label: '8', output: '8', isNumber: true },
      { id: 'Key-9', type: 'CHAR', label: '9', output: '9', isNumber: true },
      { id: 'Key-Comma', type: 'CHAR', label: ',', output: ',', isAux: true }
    ],
    [
      { id: 'Key-Ex', type: 'CHAR', label: '!', output: '!', isAux: true },
      { id: 'Key-Return', type: 'FUNC', label: '返回', action: 'RETURN', isAux: true },
      { id: 'Key-0', type: 'CHAR', label: '0', output: '0', isNumber: true },
      { id: 'Key-Space', type: 'FUNC', label: 'Space', action: 'SPACE', isAux: true, isSpace: true },
      { id: 'Key-Enter', type: 'FUNC', label: 'Enter', action: 'ENTER', isAux: true }
    ]
  ]
}

export function getVariantList(key) {
  return key && key.variants ? key.variants : []
}
