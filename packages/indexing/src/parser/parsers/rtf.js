import { readFile } from 'fs/promises'
import { truncate } from './xml.js'
const parse = (rtf) => {
  const parts = []
  let i = 0
  let depth = 0
  let skip = 0
  while (i < rtf.length) {
    if (rtf[i] === '{') {
      depth++
      const sub = rtf.substring(i + 1, i + 15)
      if (/^\\(fonttbl|colortbl|stylesheet|info|pict|object|fldinst)\b/.test(sub)) skip = depth
      i++
    } else if (rtf[i] === '}') {
      if (skip === depth) skip = 0
      depth--
      i++
    } else if (skip) {
      i++
    } else if (rtf[i] === '\\') {
      i++
      if (i >= rtf.length) break
      if (rtf[i] === "'") {
        const hex = rtf.substring(i + 1, i + 3)
        const code = parseInt(hex, 16)
        if (!isNaN(code)) parts.push(String.fromCharCode(code))
        i += 3
      } else {
        const m = rtf.substring(i).match(/^([a-z]+)-?\d* ?/i)
        if (m) {
          if (m[1] === 'par' || m[1] === 'line') parts.push('\n')
          else if (m[1] === 'tab') parts.push('\t')
          i += m[0].length
        } else {
          if (rtf[i] && rtf[i] !== '\r' && rtf[i] !== '\n') parts.push(rtf[i])
          i++
        }
      }
    } else if (rtf[i] === '\r' || rtf[i] === '\n') {
      i++
    } else {
      parts.push(rtf[i])
      i++
    }
  }
  return parts
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
export default async (filePath, maxChars) => {
  const raw = await readFile(filePath, 'utf-8')
  const text = parse(raw)
  return truncate(text, maxChars)
}
