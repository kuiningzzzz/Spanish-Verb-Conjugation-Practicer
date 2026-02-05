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
  return {
    id: `Key-${char}`,
    type: 'CHAR',
    label: charLabel(char, shiftState),
    output: char,
    variants: VARIANTS[char] || []
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

export function getVariantList(key) {
  return key && key.variants ? key.variants : []
}
