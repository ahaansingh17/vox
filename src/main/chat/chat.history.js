import { summarizeText } from '../ai/llm.bridge'
import { CONTEXT_CHAR_THRESHOLD, CONTEXT_KEEP_RECENT_CHARS } from '../ai/config'
import { getMessages, saveSummaryCheckpoint, loadSummaryCheckpoint } from '../storage/messages.db'
import { logger } from '../logger'

let _summarizing = false
let _conversationSummary = null
let _summaryCoversUpToId = null
let _summaryLoaded = false

export function ensureSummaryLoaded() {
  if (_summaryLoaded) return
  _summaryLoaded = true
  try {
    const checkpoint = loadSummaryCheckpoint()
    if (checkpoint) {
      _conversationSummary = checkpoint.summary
      _summaryCoversUpToId = checkpoint.checkpointId
    }
  } catch (err) {
    logger.warn('[chat] Failed to load summary checkpoint:', err.message)
  }
}

function keepRecentByChars(messages) {
  let charCount = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    charCount += messages[i].content?.length || 0
    if (charCount > CONTEXT_KEEP_RECENT_CHARS) {
      return messages.slice(i + 1)
    }
  }
  return messages
}

export async function maybeSummarize() {
  if (_summarizing) return
  ensureSummaryLoaded()

  const allMessages = getMessages()
  const totalChars = allMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0)
  if (totalChars < CONTEXT_CHAR_THRESHOLD) return

  const recentMessages = keepRecentByChars(allMessages)
  const recentIds = new Set(recentMessages.map((m) => m.id))
  const olderMessages = allMessages.filter((m) => !recentIds.has(m.id))
  if (olderMessages.length === 0) return

  _summarizing = true
  try {
    const prevSummary = _conversationSummary ? `Previous summary: ${_conversationSummary}\n\n` : ''
    const newContent = olderMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')

    const summary = await summarizeText(
      prevSummary + newContent,
      'Summarize this conversation concisely. Preserve key decisions, facts shared by the user, and task outcomes:'
    )

    _conversationSummary = summary
    _summaryCoversUpToId = olderMessages[olderMessages.length - 1]?.id || null

    try {
      saveSummaryCheckpoint(_conversationSummary, _summaryCoversUpToId)
    } catch (err) {
      logger.warn('[chat] Failed to persist summary:', err.message)
    }
  } catch (err) {
    logger.warn('[chat] Summarization failed:', err.message)
  } finally {
    _summarizing = false
  }
}

export function sanitizeHistory(messages) {
  if (!messages.length) return messages
  const result = [...messages]

  while (result.length > 0) {
    const last = result[result.length - 1]
    if (last.role === 'assistant' && (!last.content || !last.content.trim())) {
      result.pop()
      continue
    }
    if (last.role === 'tool' || last.role === 'tool_result') {
      result.pop()
      continue
    }
    break
  }

  while (result.length > 0) {
    const last = result[result.length - 1]
    if (last.role === 'assistant' && last.content?.includes('"tool_call"')) {
      result.pop()
      continue
    }
    break
  }

  const cleaned = []
  for (let i = 0; i < result.length; i++) {
    const msg = result[i]
    if (msg.role === 'tool' || msg.role === 'tool_result') {
      const prev = cleaned[cleaned.length - 1]
      if (!prev || prev.role !== 'assistant') continue
    }
    if (msg.role === 'assistant' && msg.content?.includes('"tool_call"')) {
      const next = result[i + 1]
      if (!next || (next.role !== 'tool' && next.role !== 'tool_result')) continue
    }
    cleaned.push(msg)
  }

  return cleaned
}

export function buildContextHistory(allMessages) {
  ensureSummaryLoaded()

  if (!_conversationSummary || !_summaryCoversUpToId) {
    return allMessages.map((m) => ({ role: m.role, content: m.content }))
  }
  const summaryIdx = allMessages.findIndex((m) => m.id === _summaryCoversUpToId)
  const recent = summaryIdx >= 0 ? allMessages.slice(summaryIdx + 1) : allMessages
  return [
    { role: 'assistant', content: `[Summary of earlier conversation]\n${_conversationSummary}` },
    ...recent.map((m) => ({ role: m.role, content: m.content }))
  ]
}

export function resetSummaryState() {
  _conversationSummary = null
  _summaryCoversUpToId = null
  _summaryLoaded = true
}
