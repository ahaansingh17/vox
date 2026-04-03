import {
  startServer,
  stopServer,
  onLoadProgress,
  isReady,
  getModelPath,
  getProcess
} from './llm.server.js'
import { healthCheck, chatCompletion } from './llm.client.js'
import { emitAll } from '../ipc/shared'
import { logger } from '../logger'
import { CONTEXT_SIZE } from './config.js'

let _status = { ready: false, modelPath: null, loading: false, error: null }

let _restartAttempts = 0
let _healthCheckInterval = null
const MAX_RESTART_ATTEMPTS = 3
const HEALTH_CHECK_INTERVAL_MS = 30_000

function stopHealthCheck() {
  if (_healthCheckInterval) {
    clearInterval(_healthCheckInterval)
    _healthCheckInterval = null
  }
}

function startHealthCheckLoop() {
  stopHealthCheck()
  let missedChecks = 0
  _healthCheckInterval = setInterval(async () => {
    if (!isReady()) {
      stopHealthCheck()
      return
    }
    const ok = await healthCheck()
    if (ok) {
      missedChecks = 0
    } else {
      missedChecks++
      if (missedChecks > 3) {
        logger.error('[llm.bridge] Server health check failed — restarting')
        stopHealthCheck()
        const modelPath = getModelPath()
        if (modelPath && _restartAttempts < MAX_RESTART_ATTEMPTS) {
          _restartAttempts++
          emitAll('models:restarting', { attempt: _restartAttempts })
          loadModel(modelPath).catch((err) => {
            logger.error('[llm.bridge] Auto-restart failed:', err)
            emitAll('models:load-error', { message: err.message })
          })
        }
      }
    }
  }, HEALTH_CHECK_INTERVAL_MS)
}

export function getLlmStatus() {
  return { ..._status }
}

export async function loadModel(modelPath) {
  const _perfId = `[PERF] loadModel #${Date.now()}`
  console.time(_perfId)
  _status = { ready: false, modelPath, loading: true, error: null }
  emitAll('models:load-progress', { percent: 0 })

  onLoadProgress((percent) => {
    emitAll('models:load-progress', { percent })
  })

  try {
    console.time(`${_perfId} startServer`)
    await startServer(modelPath, { contextSize: CONTEXT_SIZE })
    console.timeEnd(`${_perfId} startServer`)
    _status = { ready: true, modelPath, loading: false, error: null }
    _restartAttempts = 0
    startHealthCheckLoop()
    logger.info('[llm.bridge] Model ready (llama-server):', modelPath)
    emitAll('models:load-progress', { percent: 100 })
    emitAll('models:ready', { path: modelPath })
  } catch (err) {
    _status = { ready: false, modelPath, loading: false, error: err.message }
    logger.error('[llm.bridge] Load error:', err.message)
    emitAll('models:load-error', { message: err.message })
    throw err
  } finally {
    console.timeEnd(_perfId)
  }
}

export async function reloadModel(modelPath) {
  return loadModel(modelPath)
}

let _prewarmToolProvider = null
let _prewarmPromptProvider = null
let _prewarmController = null

export function setPrewarmProviders(toolProvider, promptProvider) {
  _prewarmToolProvider = toolProvider
  _prewarmPromptProvider = promptProvider
}

export function cancelPrewarm() {
  if (_prewarmController) {
    _prewarmController.abort()
    _prewarmController = null
    logger.info('[llm.bridge] Prewarm cancelled — real message incoming')
  }
}

export async function prewarmChat() {
  if (!isReady()) return
  if (!_prewarmPromptProvider) {
    logger.warn('[llm.bridge] prewarm skipped — no providers set')
    return
  }
  console.time('[PERF] prewarmChat')
  _prewarmController = new AbortController()
  try {
    const systemPrompt = _prewarmPromptProvider()
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'hi' }
    ]
    await chatCompletion({
      messages,
      tools: undefined,
      stream: false,
      maxTokens: 1,
      signal: _prewarmController.signal
    })
    logger.info('[llm.bridge] Prewarm complete (system prompt only, no tools)')
  } catch (err) {
    if (_prewarmController?.signal?.aborted) {
      logger.info('[llm.bridge] Prewarm aborted')
    } else {
      logger.warn('[llm.bridge] Prewarm failed:', err.message)
    }
  } finally {
    _prewarmController = null
  }
  console.timeEnd('[PERF] prewarmChat')
}

export async function waitForReady(timeoutMs = 30_000, intervalMs = 500) {
  const _perfId = `[PERF] waitForReady #${Date.now()}`
  console.time(_perfId)

  if (isReady()) {
    console.timeEnd(_perfId)
    return true
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs))
    if (isReady()) {
      console.timeEnd(_perfId)
      return true
    }
    if (_status.error) {
      console.log(`${_perfId} bailing: _status.error = "${_status.error}"`)
      console.timeEnd(_perfId)
      return false
    }
    if (!_status.loading && !getProcess()) {
      console.log(`${_perfId} bailing: process dead and not loading`)
      console.timeEnd(_perfId)
      return false
    }
  }
  console.log(`${_perfId} timed out after ${timeoutMs}ms`)
  console.timeEnd(_perfId)
  return false
}

export function resetModelStatus() {
  _status = { ready: false, modelPath: null, loading: false, error: null }
}

export { stopHealthCheck, stopServer }
