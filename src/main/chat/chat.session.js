import { randomUUID } from 'crypto'
import { loadBuiltinTools } from '@vox-ai-app/tools'
import { ALL_INTEGRATION_TOOLS } from '@vox-ai-app/integrations'
import { ALL_KNOWLEDGE_TOOLS } from '@vox-ai-app/indexing'
import {
  sendChatMessage,
  abortChat,
  clearChat,
  waitForChatResult,
  getLlmStatus,
  summarizeText
} from '../ai/llm.bridge'
import { CONTEXT_CHAR_THRESHOLD, CONTEXT_KEEP_RECENT_CHARS } from '../ai/config'
import {
  getMessages,
  getMessagesBeforeId,
  appendMessage,
  clearMessages,
  saveSummaryCheckpoint,
  loadSummaryCheckpoint,
  clearSummaryCheckpoint
} from '../storage/messages.db'
import { storeGet } from '../storage/store'
import { emitAll } from '../ipc/shared'
import { definition as spawnDef } from './spawn.tool'
import { getMcpToolDefinitions } from '../mcp/mcp.service'
import { getUnreportedTerminalTasks, markTaskReported } from '../storage/tasks.db'
import { logger } from '../logger'
import { buildDefaultSystemPrompt } from './chat.prompts'

const SAVE_USER_INFO_DEF = {
  name: 'save_user_info',
  description:
    'Persist a piece of information about the user for future reference. Use this when the user tells you something about themselves that would be useful to remember (name, location, job, preferences, etc.).',
  parameters: {
    type: 'object',
    properties: {
      info_key: {
        type: 'string',
        description:
          'Short identifier for what this information is (e.g. "name", "location", "preferred_language", "occupation")'
      },
      info_value: {
        type: 'string',
        description: 'The value to store'
      }
    },
    required: ['info_key', 'info_value']
  }
}

const MESSAGE_PAGE_SIZE = 50

let _toolDefinitions = null

function buildToolDefinitions() {
  const defs = []

  try {
    const builtinMap = loadBuiltinTools()
    for (const t of builtinMap.values()) defs.push(t.definition)
  } catch (err) {
    logger.warn('[chat] Failed to load builtin tools:', err.message)
  }

  try {
    for (const t of ALL_INTEGRATION_TOOLS) defs.push(t.definition)
  } catch (err) {
    logger.warn('[chat] Failed to load integration tools:', err.message)
  }

  try {
    for (const t of ALL_KNOWLEDGE_TOOLS) defs.push(t.definition)
  } catch (err) {
    logger.warn('[chat] Failed to load knowledge tools:', err.message)
  }

  try {
    defs.push(...getMcpToolDefinitions())
  } catch (err) {
    logger.warn('[chat] Failed to load MCP tools:', err.message)
  }

  try {
    const customTools = storeGet('customTools') || []
    for (const t of customTools) {
      if (t.is_enabled !== false && t.name) {
        defs.push({
          name: t.name,
          description: t.description || '',
          parameters: t.parameters || { type: 'object', properties: {} }
        })
      }
    }
  } catch (err) {
    logger.warn('[chat] Failed to load custom tools:', err.message)
  }

  defs.push(spawnDef)
  defs.push(SAVE_USER_INFO_DEF)
  defs.push({
    name: 'get_task',
    description: 'Get the full details and result of a specific background task by its ID.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID to look up' }
      },
      required: ['taskId']
    }
  })
  defs.push({
    name: 'search_tasks',
    description:
      'Search past background tasks by keyword query or filter by status. Use query for semantic/keyword search, status to filter.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword search over task instructions and results' },
        status: {
          type: 'string',
          enum: ['completed', 'failed', 'aborted', 'running', 'queued', 'incomplete'],
          description: 'Filter by task status'
        }
      }
    }
  })
  _toolDefinitions = defs
  return defs
}

export function getToolDefinitions() {
  return _toolDefinitions || buildToolDefinitions()
}

export function invalidateToolDefinitions() {
  _toolDefinitions = null
}

function formatMessagesForRenderer(rows) {
  return rows.map((m, i) => ({
    id: `db-${m.id || i}`,
    dbId: m.id || null,
    role: m.role,
    content: String(m.content || ''),
    pending: false,
    streamId: null
  }))
}

function buildPage(rows, limit) {
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(rows.length - limit) : rows
  return {
    messages: formatMessagesForRenderer(pageRows),
    hasMore
  }
}

export function getSystemPrompt() {
  const base = storeGet('systemPrompt') || buildDefaultSystemPrompt()
  const userInfo = storeGet('vox.user.info') || {}
  if (Object.keys(userInfo).length === 0) return base
  return `${base}\n\nKnown user information:\n${JSON.stringify(userInfo, null, 2)}`
}

function appendUserMessageToConversation(content, requestId) {
  const userMsgRow = appendMessage('user', content)

  emitAll('chat:event', {
    type: 'msg:append',
    data: {
      message: {
        id: `db-${userMsgRow?.id || requestId}`,
        dbId: userMsgRow?.id || null,
        role: 'user',
        content,
        pending: false,
        streamId: null
      }
    }
  })
}

function dispatchMessage({ content, requestId, systemPrompt, history, toolDefinitions }) {
  appendUserMessageToConversation(content, requestId)

  sendChatMessage({
    requestId,
    message: content,
    systemPrompt,
    history,
    toolDefinitions
  })
}

function sanitizeHistory(messages) {
  if (!messages.length) return messages
  const result = [...messages]

  while (result.length > 0) {
    const last = result[result.length - 1]
    if (last.role === 'assistant' && last.content && last.content.length < 10) {
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

let _summarizing = false
let _conversationSummary = null
let _summaryCoversUpToId = null
let _summaryLoaded = false

function ensureSummaryLoaded() {
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

async function maybeSummarize() {
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

function buildContextHistory(allMessages) {
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

function injectUnreportedTasks() {
  const unreported = getUnreportedTerminalTasks()
  for (const task of unreported) {
    const label = task.status === 'completed' ? 'completed' : task.status
    const body =
      `[Background task ${label}]\nTask: ${task.instructions}\n` +
      (task.result ? `Result: ${task.result}` : task.message ? `Message: ${task.message}` : '')
    appendMessage('assistant', body)
    markTaskReported(task.taskId)
  }
}

async function prepareMessage(content) {
  if (!content?.trim())
    throw Object.assign(new Error('Message content required'), { code: 'VALIDATION_ERROR' })

  const requestId = randomUUID()
  const systemPrompt = getSystemPrompt()

  injectUnreportedTasks()

  const storedHistory = buildContextHistory(sanitizeHistory(getMessages()))
  const toolDefinitions = getToolDefinitions()

  return {
    requestId,
    systemPrompt,
    storedHistory,
    toolDefinitions
  }
}

export async function sendMessage({ content }) {
  const { requestId, systemPrompt, storedHistory, toolDefinitions } = await prepareMessage(content)

  dispatchMessage({
    content,
    requestId,
    systemPrompt,
    history: storedHistory,
    toolDefinitions
  })

  waitForChatResult(requestId)
    .then(({ finalText, streamId }) => {
      if (finalText) {
        const row = appendMessage('assistant', finalText)
        void maybeSummarize()
        emitAll('chat:event', {
          type: 'msg:complete',
          data: {
            streamId,
            dbId: row?.id || null,
            recovery: {
              id: `db-${row?.id}`,
              dbId: row?.id || null,
              role: 'assistant',
              content: finalText,
              pending: false,
              streamId: null
            }
          }
        })
      }
    })
    .catch((err) => {
      logger.warn('[chat] Message result failed:', err.message)
    })

  return { requestId }
}

export async function sendMessageAndWait({ content }) {
  const { requestId, systemPrompt, storedHistory, toolDefinitions } = await prepareMessage(content)

  dispatchMessage({
    content,
    requestId,
    systemPrompt,
    history: storedHistory,
    toolDefinitions
  })

  const { finalText } = await waitForChatResult(requestId)
  if (finalText) appendMessage('assistant', finalText)
  return finalText || ''
}

export function abort() {
  abortChat()
}

export async function clearConversation() {
  _conversationSummary = null
  _summaryCoversUpToId = null
  _summaryLoaded = true
  try {
    clearSummaryCheckpoint()
  } catch {
    /* */
  }
  await clearChat()
  clearMessages()
  emitAll('chat:event', { type: 'msg:replace-all', data: { messages: [], hasMore: false } })
}

export function getStoredMessagesPage(limit = MESSAGE_PAGE_SIZE) {
  return buildPage(getMessages(undefined, limit + 1), limit)
}

export function loadOlderStoredMessages(offsetId, limit = MESSAGE_PAGE_SIZE) {
  const page = buildPage(getMessagesBeforeId(offsetId, undefined, limit + 1), limit)
  if (page.messages.length > 0) {
    emitAll('chat:event', { type: 'msg:prepend', data: page })
  }
  return page
}

export function getStoredMessages(limit = MESSAGE_PAGE_SIZE) {
  return getStoredMessagesPage(limit).messages
}

let _currentMode = 'text'

export function setMode(mode) {
  _currentMode = mode
}

export function getChatStatus() {
  const llm = getLlmStatus()
  return {
    status: {
      state: llm.ready ? 'ready' : llm.loading ? 'loading' : 'error',
      connected: true,
      sessionReady: llm.ready,
      mode: _currentMode,
      queuedMessages: 0,
      lastError: llm.error || null
    }
  }
}
