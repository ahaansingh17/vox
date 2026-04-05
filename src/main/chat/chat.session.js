import { randomUUID } from 'crypto'
import { getDeclarations } from '@vox-ai-app/tools/registry'
import {
  sendChatMessage,
  abortChat,
  waitForChatResult,
  getLlmStatus,
  summarizeText
} from '../ai/llm/bridge'
import { CONTEXT_CHAR_THRESHOLD, CONTEXT_KEEP_RECENT_CHARS } from '../ai/config'
import {
  getMessages,
  getMessagesBeforeId,
  appendMessage,
  saveSummaryCheckpoint,
  loadSummaryCheckpoint,
  indexMessageEmbedding
} from '../storage/messages.db'
import { storeGet } from '../storage/store'
import { listTools } from '@vox-ai-app/storage/tools'
import { getDb } from '../storage/db'
import { getConversationUserInfo } from '../storage/messages.db'
import { emitAll } from '../ipc/shared'
import { definition as spawnDef } from './spawn.tool'
import { getMcpToolDefinitions } from '../mcp/mcp.service'
import { getUnreportedTerminalTasks, markTaskReported } from '../storage/tasks.db'
import { logger } from '../core/logger'
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

const FIND_TOOLS_DEF = {
  name: 'find_tools',
  description:
    'Search for available custom tools by name or capability. Returns matching tools with name, description, source_type, and parameter schema. Call this before run_tool to discover custom tools.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Name or natural language description of the capability you need.'
      }
    },
    required: ['query']
  }
}

const RUN_TOOL_DEF = {
  name: 'run_tool',
  description:
    'Execute a custom tool by exact name. Call find_tools first to discover the tool and get its parameter schema, then call run_tool with the correct args.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Exact tool name as returned by find_tools.'
      },
      args: {
        type: 'object',
        description: 'Arguments matching the tool parameter schema.'
      },
      timeoutMs: {
        type: 'number',
        description:
          'Optional execution timeout in milliseconds. Defaults to 30000 for webhooks, 10000 for JS functions.'
      }
    },
    required: ['name']
  }
}

const MANAGE_TOOL_DEF = {
  name: 'manage_tool',
  description:
    'Create, update, or delete a custom tool that will be saved and reusable in future tasks. Use this when the current task reveals a reusable capability worth persisting. After creating a tool, immediately call run_tool to test it — if it errors, update the source_code and retry until it works.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'update', 'delete'],
        description: 'The operation to perform.'
      },
      id: {
        type: 'string',
        description: 'Tool ID or name — required for update and delete.'
      },
      name: {
        type: 'string',
        description: 'Unique name (lowercase, underscores). Required for create.'
      },
      description: {
        type: 'string',
        description: 'What this tool does. Required for create.'
      },
      parameters: {
        type: 'object',
        description: 'JSON Schema for the tool input parameters.'
      },
      source_type: {
        type: 'string',
        enum: ['js_function', 'http_webhook', 'desktop'],
        description: 'Execution environment. Required for create.'
      },
      source_code: {
        type: 'string',
        description:
          'JavaScript source code for js_function/desktop tools. The code receives an `args` object and should return or resolve a value.'
      },
      webhook_url: {
        type: 'string',
        description: 'URL for http_webhook tools.'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags for categorization.'
      },
      is_enabled: {
        type: 'boolean',
        description: 'Set to false to disable a tool without deleting it.'
      }
    },
    required: ['action']
  }
}

function buildToolDefinitions() {
  const defs = [...getDeclarations()]

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
      'Search past background tasks by semantic similarity or filter by status. Use query for natural language search, status to filter.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query to search task instructions and results'
        },
        status: {
          type: 'string',
          enum: ['completed', 'failed', 'aborted', 'running', 'queued', 'incomplete'],
          description: 'Filter by task status'
        }
      }
    }
  })
  defs.push({
    name: 'search_messages',
    description:
      'Search past conversation messages by semantic similarity. Use this to recall what the user said or what you discussed previously.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query to search conversation history'
        },
        limit: { type: 'number', description: 'Max results to return (default 10)' }
      },
      required: ['query']
    }
  })

  let hasMcpTools = false
  try {
    hasMcpTools = getMcpToolDefinitions().length > 0
  } catch {
    /* mcp not ready */
  }

  const hasCustomTools = (() => {
    try {
      return listTools(getDb(), true).length > 0
    } catch {
      return false
    }
  })()

  if (hasCustomTools || hasMcpTools) {
    defs.push(FIND_TOOLS_DEF)
    defs.push(RUN_TOOL_DEF)
  }

  defs.push(MANAGE_TOOL_DEF)

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
  return rows.map((m) => ({
    id: `db-${m.id}`,
    dbId: m.id,
    role: m.role,
    content: m.content,
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
  const base = storeGet('systemPrompt') ?? buildDefaultSystemPrompt()
  const userInfo = getConversationUserInfo()
  if (!userInfo || Object.keys(userInfo).length === 0) return base
  return `${base}\n\nKnown user information:\n${JSON.stringify(userInfo, null, 2)}`
}

function appendUserMessageToConversation(content, requestId) {
  const userMsgRow = appendMessage('user', content)
  void indexMessageEmbedding(userMsgRow?.id, 'user', content)

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
    _summaryCoversUpToId = olderMessages[olderMessages.length - 1]?.id ?? null

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
      (task.result ? `Result: ${task.result}` : task.error ? `Error: ${task.error}` : '')
    const row = appendMessage('assistant', body)
    void indexMessageEmbedding(row?.id, 'assistant', body)
    markTaskReported(task.id)
  }
}

async function prepareMessage(content) {
  if (!content?.trim())
    throw Object.assign(new Error('Message content required'), { code: 'VALIDATION_ERROR' })

  const requestId = randomUUID()
  let systemPrompt = getSystemPrompt()

  try {
    const { searchTasksSemantic, searchPatternsSemantic } = await import('../storage/tasks.db.js')
    const [pastTasks, patterns] = await Promise.all([
      searchTasksSemantic(content, 3).catch(() => []),
      searchPatternsSemantic(content, 3).catch(() => [])
    ])
    const sections = []
    if (pastTasks.length > 0) {
      sections.push(
        'Relevant past tasks:\n' +
          pastTasks
            .map((t) => `- "${t.instructions}" → ${String(t.result || '').slice(0, 300)}`)
            .join('\n')
      )
    }
    if (patterns.length > 0) {
      sections.push(
        'Known solutions:\n' +
          patterns.map((p) => `- When: "${p.trigger}" → Try: "${p.solution}"`).join('\n')
      )
    }
    if (sections.length > 0) {
      systemPrompt += '\n\n' + sections.join('\n\n')
    }
  } catch {
    /* retrieval is best-effort */
  }

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

  try {
    const { finalText, streamId } = await waitForChatResult(requestId)
    if (finalText) {
      const row = appendMessage('assistant', finalText)
      void indexMessageEmbedding(row?.id, 'assistant', finalText)
      void maybeSummarize()
      emitAll('chat:event', {
        type: 'msg:complete',
        data: {
          streamId: streamId || requestId,
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
    } else {
      emitAll('chat:event', {
        type: 'msg:complete',
        data: { streamId: streamId || requestId }
      })
    }
  } catch (err) {
    logger.warn('[chat] Message result failed:', err.message)
    emitAll('chat:event', {
      type: 'msg:complete',
      data: { streamId: requestId }
    })
  }

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
  if (finalText) {
    const row = appendMessage('assistant', finalText)
    void indexMessageEmbedding(row?.id, 'assistant', finalText)
  }
  return finalText || ''
}

export function abort() {
  abortChat()
}

const WELCOME_MESSAGE =
  "Hey! I'm Vox, your personal AI assistant running right here on your machine. I can search your files, draft emails, create documents, run code, and more. Just ask."

export function getStoredMessagesPage(limit = MESSAGE_PAGE_SIZE) {
  const rows = getMessages(undefined, limit + 1)
  if (rows.length === 0) {
    appendMessage('assistant', WELCOME_MESSAGE)
    const seeded = getMessages(undefined, limit + 1)
    return buildPage(seeded, limit)
  }
  return buildPage(rows, limit)
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
      state: llm.ready ? 'ready' : llm.loading || !llm.error ? 'loading' : 'error',
      connected: true,
      sessionReady: llm.ready,
      mode: _currentMode,
      queuedMessages: 0,
      lastError: llm.error ?? null
    }
  }
}
