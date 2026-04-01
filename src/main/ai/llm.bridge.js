import { Worker } from 'worker_threads'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { emitAll } from '../ipc/shared'
import { logger } from '../logger'
import { executeElectronTool } from './llm.tool-executor.js'
import {
  resetStreamState,
  setChatStreamHandlers,
  clearChatStreamHandlers,
  handleChatEventForRenderer
} from './llm.stream.js'

export { setChatStreamHandlers, clearChatStreamHandlers }

let worker = null
let _status = { ready: false, modelPath: null, loading: false, error: null }
let _shuttingDown = false
const pendingRequests = new Map()
const agentListeners = new Map()

let _restartAttempts = 0
let _healthCheckInterval = null
let _missedPongs = 0
const MAX_RESTART_ATTEMPTS = 3
const HEALTH_CHECK_INTERVAL_MS = 30_000

function workerPath() {
  const base = app.getAppPath().replace('app.asar', 'app.asar.unpacked')
  return join(base, 'out/main/llm.worker.js')
}

function spawnWorker() {
  if (worker || _shuttingDown) return

  worker = new Worker(workerPath())
  worker.on('message', handleWorkerMessage)
  worker.on('error', (err) => {
    logger.error('[llm.bridge] Worker error:', err)
    _status = { ready: false, modelPath: _status.modelPath, loading: false, error: err.message }
    emitAll('models:load-error', { message: err.message })
  })
  worker.on('exit', (code) => {
    stopHealthCheck()
    const prevModelPath = _status.modelPath
    worker = null
    _status = {
      ready: false,
      modelPath: prevModelPath,
      loading: false,
      error: code !== 0 ? `Worker exited: ${code}` : null
    }

    if (code !== 0 && !_shuttingDown) {
      logger.warn('[llm.bridge] Worker exited with code', code)

      if (prevModelPath && _restartAttempts < MAX_RESTART_ATTEMPTS) {
        _restartAttempts++
        logger.info(
          `[llm.bridge] Auto-restarting worker (attempt ${_restartAttempts}/${MAX_RESTART_ATTEMPTS})`
        )
        emitAll('models:restarting', { attempt: _restartAttempts })
        setTimeout(() => {
          if (_shuttingDown) return
          loadModel(prevModelPath).catch((err) => {
            logger.error('[llm.bridge] Auto-restart failed:', err)
            emitAll('models:load-error', { message: err.message })
          })
        }, 2000 * _restartAttempts)
      } else if (_restartAttempts >= MAX_RESTART_ATTEMPTS) {
        logger.error('[llm.bridge] Worker failed permanently after max restarts')
        emitAll('models:load-error', {
          message: 'AI worker failed to restart. Please reload the app.'
        })
      }
    }
  })
}

function post(msg) {
  if (_shuttingDown) return
  if (!worker) spawnWorker()
  if (worker) worker.postMessage(msg)
}

function stopHealthCheck() {
  if (_healthCheckInterval) {
    clearInterval(_healthCheckInterval)
    _healthCheckInterval = null
  }
  _missedPongs = 0
}

function startHealthCheck() {
  stopHealthCheck()
  _healthCheckInterval = setInterval(() => {
    if (!worker) {
      stopHealthCheck()
      return
    }
    _missedPongs++
    if (_missedPongs > 3) {
      logger.error('[llm.bridge] Worker health check failed — force terminating')
      stopHealthCheck()
      worker.terminate()
      return
    }
    post({ type: 'ping' })
  }, HEALTH_CHECK_INTERVAL_MS)
}

function handleWorkerMessage(msg) {
  switch (msg.type) {
    case 'ready':
      _status = { ready: true, modelPath: _status.modelPath, loading: false, error: null }
      _restartAttempts = 0
      startHealthCheck()
      post({ type: 'chat:prewarm' })
      break

    case 'prewarm:done':
      logger.info('[llm.bridge] Model ready (prewarmed):', _status.modelPath)
      emitAll('models:ready', { path: _status.modelPath })
      break

    case 'pong':
      _missedPongs = 0
      break

    case 'load-error':
      _status = { ready: false, modelPath: _status.modelPath, loading: false, error: msg.message }
      logger.error('[llm.bridge] Load error:', msg.message)
      emitAll('models:load-error', { message: msg.message })
      break

    case 'chat:event': {
      const { requestId, event } = msg
      handleChatEventForRenderer(requestId, event)

      if (event.type === 'chunk_end') {
        pendingRequests.get(requestId)?.resolve(event)
        pendingRequests.delete(requestId)
      } else if (event.type === 'error') {
        pendingRequests.get(requestId)?.reject(new Error(event.message))
        pendingRequests.delete(requestId)
      }
      break
    }

    case 'agent:event': {
      const { taskId, event } = msg

      emitAll('task:event', { taskId, ...event })

      const isInternalTool =
        (event.type === 'tool_call' || event.type === 'tool_result') &&
        event.name === 'update_journal'
      if (
        !isInternalTool &&
        (event.type === 'tool_call' ||
          event.type === 'tool_result' ||
          event.type === 'text' ||
          event.type === 'thought')
      ) {
        emitAll('chat:event', { type: event.type, data: { taskId, ...event } })
      }
      agentListeners.get(taskId)?.(event)
      break
    }

    case 'history':
      pendingRequests.get('history')?.resolve(msg.history)
      pendingRequests.delete('history')
      break

    case 'summarize:result':
      pendingRequests.get(msg.requestId)?.resolve(msg.result)
      pendingRequests.delete(msg.requestId)
      break

    case 'tool:execute': {
      const { callId, name, args } = msg
      executeElectronTool(name, args)
        .then((result) => post({ type: 'tool:result', callId, result }))
        .catch((err) => post({ type: 'tool:result', callId, error: err.message }))
      break
    }

    default:
      logger.warn('[llm.bridge] Unknown message from worker:', msg.type)
  }
}

export function getLlmStatus() {
  return { ..._status }
}

export async function loadModel(modelPath) {
  spawnWorker()
  _status = { ready: false, modelPath, loading: true, error: null }
  post({ type: 'init', modelPath })
  return waitForReady()
}

export async function reloadModel(modelPath) {
  _status = { ready: false, modelPath, loading: true, error: null }
  post({ type: 'reload', modelPath })
  return waitForReady()
}

function waitForReady(timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker?.off('message', oneShot)
      reject(new Error('Model load timeout'))
    }, timeoutMs)

    const oneShot = (msg) => {
      if (msg.type === 'ready') {
        clearTimeout(timer)
        worker?.off('message', oneShot)
        resolve()
      } else if (msg.type === 'load-error') {
        clearTimeout(timer)
        worker?.off('message', oneShot)
        reject(new Error(msg.message))
      }
    }
    if (worker) worker.on('message', oneShot)
    else reject(new Error('Worker not available'))
  })
}

export function prewarmChat() {
  if (!worker) return
  post({ type: 'chat:prewarm' })
}

export function sendChatMessage({ requestId, message, systemPrompt, history, toolDefinitions }) {
  post({ type: 'chat:send', requestId, message, systemPrompt, history, toolDefinitions })
}

export function waitForChatResult(requestId, timeoutMs = 300_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId)
      resolve({ finalText: null })
    }, timeoutMs)

    pendingRequests.set(requestId, {
      resolve: (data) => {
        clearTimeout(timer)
        resolve(data)
      },
      reject: (err) => {
        clearTimeout(timer)
        reject(err)
      }
    })
  })
}

export function abortChat() {
  post({ type: 'chat:abort' })
}

export async function clearChat() {
  resetStreamState()
  post({ type: 'chat:clear' })
}

export async function getChatHistory() {
  if (!worker) return []
  return new Promise((resolve) => {
    pendingRequests.set('history', { resolve, reject: () => resolve([]) })
    post({ type: 'chat:get-history' })
  })
}

export function summarizeText(text, promptPrefix) {
  if (!worker) return Promise.resolve(text)
  return new Promise((resolve) => {
    const requestId = randomUUID()
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId)
      resolve(text)
    }, 60_000)
    pendingRequests.set(requestId, {
      resolve: (result) => {
        clearTimeout(timer)
        resolve(result)
      },
      reject: () => {
        clearTimeout(timer)
        resolve(text)
      }
    })
    post({ type: 'summarize', requestId, text, promptPrefix })
  })
}

export function startAgent({ taskId, instructions, context, toolDefinitions }) {
  post({ type: 'agent:start', taskId, instructions, context, toolDefinitions })
}

export function abortAgent(taskId) {
  post({ type: 'agent:abort', taskId })
}

export function onAgentEvent(taskId, listener) {
  agentListeners.set(taskId, listener)
  return () => agentListeners.delete(taskId)
}

export function destroyWorker() {
  _shuttingDown = true
  stopHealthCheck()
  resetStreamState()
  for (const [key, pending] of pendingRequests) {
    pending.reject?.(new Error('Worker destroyed'))
    pendingRequests.delete(key)
  }
  worker?.terminate()
  worker = null
  _status = { ready: false, modelPath: null, loading: false, error: null }
}
