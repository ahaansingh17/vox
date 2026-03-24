import crypto from 'node:crypto'
import {
  KNOWLEDGE_CHUNK_MAX_CHARS,
  KNOWLEDGE_CHUNK_MIN_BREAK_CHARS,
  KNOWLEDGE_CHUNK_OVERLAP
} from '../runtime/core/constants.js'
const normalizeText = (text) =>
  String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\u0000')
    .join('')
    .trim()
const resolveBreakIndex = (slice) => {
  const candidates = [
    ['\n\n', 4],
    ['\n', 3],
    ['. ', 2],
    [' ', 1]
  ]
  let bestIndex = -1
  let bestPriority = 0
  for (const [token, priority] of candidates) {
    const tokenIndex = slice.lastIndexOf(token)
    if (tokenIndex < 0) continue
    const endPos = tokenIndex + token.length
    if (priority > bestPriority || (priority === bestPriority && endPos > bestIndex)) {
      bestIndex = endPos
      bestPriority = priority
    }
  }
  return bestIndex
}
export const hashKnowledgeText = (text) =>
  crypto
    .createHash('sha256')
    .update(String(text || ''))
    .digest('hex')
export const chunkKnowledgeText = (input) => {
  const text = normalizeText(input)
  if (!text) {
    return []
  }
  if (text.length <= KNOWLEDGE_CHUNK_MAX_CHARS) {
    return [text]
  }
  const chunks = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(text.length, start + KNOWLEDGE_CHUNK_MAX_CHARS)
    if (end < text.length) {
      const slice = text.slice(start, end)
      const preferredBreak = resolveBreakIndex(slice)
      if (preferredBreak >= KNOWLEDGE_CHUNK_MIN_BREAK_CHARS) {
        end = start + preferredBreak
      }
    }
    const chunk = text.slice(start, end).trim()
    if (chunk) {
      chunks.push(chunk)
    }
    if (end >= text.length) {
      break
    }
    start = Math.max(end - KNOWLEDGE_CHUNK_OVERLAP, start + 1)
  }
  return chunks
}
