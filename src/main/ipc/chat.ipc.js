import { registerHandler, createHandler } from './shared'
import {
  sendMessage,
  abort,
  clearConversation,
  loadOlderStoredMessages,
  getStoredMessagesPage,
  getChatStatus,
  setMode
} from '../chat/chat.session'
import {
  abortTask,
  getCachedActivityEvents,
  getCachedTasks,
  getTaskCacheStatus,
  getTaskDetail,
  listTaskHistory,
  loadTaskCachePage,
  refreshTaskCache,
  resumeTask
} from '../chat/task.queue'

export function registerChatIpc() {
  registerHandler(
    'chat:connect',
    createHandler(() => ({ status: getChatStatus().status }))
  )

  registerHandler(
    'chat:ensure-connected',
    createHandler(() => ({ status: getChatStatus().status }))
  )

  registerHandler(
    'chat:disconnect',
    createHandler(() => ({ ok: true }))
  )

  registerHandler(
    'chat:get-status',
    createHandler(() => getChatStatus())
  )

  registerHandler(
    'chat:send-message',
    createHandler(async (_e, payload) => {
      const _perfId = `[PERF] ipc:chat:send-message #${Date.now()}`
      console.time(_perfId)
      const result = await sendMessage(payload || {})
      console.timeEnd(_perfId)
      return result
    })
  )

  registerHandler(
    'chat:set-mode',
    createHandler((_e, { mode } = {}) => {
      if (mode) setMode(mode)
      return { ok: true }
    })
  )

  registerHandler(
    'chat:load-older',
    createHandler((_e, { offsetId } = {}) => loadOlderStoredMessages(offsetId))
  )

  registerHandler(
    'chat:abort',
    createHandler(() => {
      abort()
      return { aborted: true }
    })
  )

  registerHandler(
    'chat:clear',
    createHandler(async () => clearConversation())
  )

  registerHandler(
    'chat:get-messages',
    createHandler(() => getStoredMessagesPage())
  )

  registerHandler(
    'chat:get-message-cache-status',
    createHandler(() => {
      const page = getStoredMessagesPage()
      return { ready: true, count: page.messages.length, hasMore: page.hasMore }
    })
  )

  registerHandler(
    'task:list',
    createHandler((_e, params = {}) => listTaskHistory(params))
  )

  registerHandler(
    'task:get',
    createHandler((_e, { taskId } = {}) => {
      return getTaskDetail(taskId) || { task: null }
    })
  )

  registerHandler(
    'task:abort',
    createHandler((_e, { taskId } = {}) => {
      abortTask(taskId)
      return { aborted: true }
    })
  )

  registerHandler(
    'task:resume',
    createHandler(async (_e, { taskId } = {}) => resumeTask(taskId))
  )

  registerHandler(
    'task:get-cached-tasks',
    createHandler(() => ({ tasks: getCachedTasks() }))
  )

  registerHandler(
    'task:get-cached-activity',
    createHandler(() => ({ activity: getCachedActivityEvents() }))
  )

  registerHandler(
    'task:get-cache-status',
    createHandler(() => getTaskCacheStatus())
  )

  registerHandler(
    'task:load-and-cache',
    createHandler((_e, params = {}) => loadTaskCachePage(params))
  )

  registerHandler(
    'task:refresh-cache',
    createHandler(() => refreshTaskCache())
  )
}
