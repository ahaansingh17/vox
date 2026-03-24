import { enqueueScreen } from '../../queue.js'
import {
  ensureAccessibility,
  CHAR_CODES,
  KEY_CODES,
  pyTypeText,
  pyKeyCode,
  pyCharKey,
  runPy
} from './helpers.js'

export const typeText = ({ text }, { signal } = {}) =>
  enqueueScreen(async () => {
    ensureAccessibility()
    if (!text) throw new Error('"text" is required.')
    await runPy(pyTypeText(text), signal)
    return { action: 'type', length: text.length }
  })

export const keyPress = ({ key, modifiers = [] }, { signal } = {}) =>
  enqueueScreen(async () => {
    ensureAccessibility()
    if (!key) throw new Error('"key" is required.')
    const keyLower = String(key).toLowerCase().trim()
    const mods = (Array.isArray(modifiers) ? modifiers : [modifiers]).filter(Boolean)
    const keyCode = KEY_CODES[keyLower] ?? CHAR_CODES[keyLower]
    if (keyCode !== undefined) {
      await runPy(pyKeyCode(keyCode, mods), signal)
    } else {
      const b64 = Buffer.from(keyLower, 'utf8').toString('base64')
      await runPy(pyCharKey(b64, mods), signal)
    }
    return { action: 'key_press', key, modifiers: mods }
  })
