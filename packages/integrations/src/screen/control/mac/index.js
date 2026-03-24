import { clipboard } from 'electron'
export * from './mouse.js'
export * from './keyboard.js'
export * from './apps.js'

export const clipboardRead = () => ({ text: clipboard.readText() })
export const clipboardWrite = ({ text }) => {
  clipboard.writeText(String(text || ''))
  return { ok: true }
}
