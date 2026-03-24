import { app, utilityProcess } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '../telemetry/logger.js'
import { captureMainException } from '../telemetry/sentry.js'
const PROCESS_READY_TIMEOUT_MS = 15_000
const indexingProcessState = {
  child: null,
  readyPromise: null,
  resolveReady: null,
  rejectReady: null,
  nextRequestId: 0,
  pendingRequests: new Map(),
  shuttingDown: false
}
const resolveIndexingProcessModulePath = () => {
  return join(app.getAppPath(), 'out/main/indexing.process.js')
}
const rejectPendingRequests = (error) => {
  for (const pending of indexingProcessState.pendingRequests.values()) {
    clearTimeout(pending.timeoutId)
    pending.reject(error)
  }
  indexingProcessState.pendingRequests.clear()
}
const resetIndexingProcessState = () => {
  indexingProcessState.child = null
  indexingProcessState.readyPromise = null
  indexingProcessState.resolveReady = null
  indexingProcessState.rejectReady = null
  indexingProcessState.shuttingDown = false
}
const handleIndexingProcessMessage = (message) => {
  if (!message || typeof message !== 'object') {
    return
  }
  if (message.type === 'ready') {
    indexingProcessState.resolveReady?.()
    indexingProcessState.resolveReady = null
    indexingProcessState.rejectReady = null
    return
  }
  if (message.type === 'telemetry') {
    if (message.level === 'exception') {
      const error = new Error(message.error?.message || 'Indexing child error')
      if (message.error?.stack) error.stack = message.error.stack
      if (message.error?.code) error.code = message.error.code
      captureMainException(error, message.context)
    } else {
      logger.warn('[indexing-child]', message.message, message.context)
    }
    return
  }
  if (message.type !== 'response') {
    return
  }
  const pending = indexingProcessState.pendingRequests.get(message.requestId)
  if (!pending) {
    return
  }
  clearTimeout(pending.timeoutId)
  indexingProcessState.pendingRequests.delete(message.requestId)
  if (message.success) {
    pending.resolve(message.data)
    return
  }
  const error = new Error(message.error?.message || 'Indexing process request failed.')
  error.code = message.error?.code || 'INDEXING_PROCESS_ERROR'
  pending.reject(error)
}
const spawnIndexingProcess = () => {
  const modulePath = resolveIndexingProcessModulePath()
  if (!existsSync(modulePath)) {
    const error = new Error(`Indexing process entry not found at ${modulePath}`)
    captureMainException(error, {
      area: 'indexing-host',
      phase: 'resolve-module-path'
    })
    throw error
  }
  const child = utilityProcess.fork(modulePath)
  child.on('message', handleIndexingProcessMessage)
  child.on('exit', (code) => {
    if (indexingProcessState.shuttingDown && (code === 0 || code === null)) {
      resetIndexingProcessState()
      return
    }
    const error = new Error(`Indexing process exited${code !== null ? ` with code ${code}` : ''}.`)
    indexingProcessState.rejectReady?.(error)
    rejectPendingRequests(error)
    captureMainException(error, {
      area: 'indexing-host',
      phase: 'child-exit',
      context: {
        code
      }
    })
    resetIndexingProcessState()
  })
  indexingProcessState.child = child
  indexingProcessState.readyPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error('Timed out waiting for indexing process to become ready.')
      captureMainException(error, {
        area: 'indexing-host',
        phase: 'ready-timeout',
        context: {
          modulePath
        }
      })
      reject(error)
    }, PROCESS_READY_TIMEOUT_MS)
    indexingProcessState.resolveReady = () => {
      clearTimeout(timeoutId)
      resolve()
    }
    indexingProcessState.rejectReady = (error) => {
      clearTimeout(timeoutId)
      reject(error)
    }
  })
  return indexingProcessState.readyPromise
}
export const ensureIndexingProcess = async () => {
  if (indexingProcessState.child && indexingProcessState.readyPromise) {
    return indexingProcessState.readyPromise
  }
  return spawnIndexingProcess()
}
export const invokeIndexingProcess = async (method, payload) => {
  await ensureIndexingProcess()
  const child = indexingProcessState.child
  if (!child) {
    const error = new Error('Indexing process is not connected.')
    captureMainException(error, {
      area: 'indexing-host',
      phase: 'disconnected',
      context: {
        method
      }
    })
    throw error
  }
  const requestId = ++indexingProcessState.nextRequestId
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      indexingProcessState.pendingRequests.delete(requestId)
      const error = new Error(`Timed out waiting for indexing process method ${method}.`)
      captureMainException(error, {
        area: 'indexing-host',
        phase: 'request-timeout',
        context: {
          method
        }
      })
      reject(error)
    }, 120_000)
    indexingProcessState.pendingRequests.set(requestId, {
      resolve,
      reject,
      timeoutId
    })
    child.postMessage({
      type: 'request',
      requestId,
      method,
      payload
    })
  })
}
export const shutdownIndexingProcess = async () => {
  if (!indexingProcessState.child) {
    return
  }
  indexingProcessState.shuttingDown = true
  try {
    await invokeIndexingProcess('shutdownIndexingRuntime')
  } catch (error) {
    captureMainException(error, {
      area: 'indexing-host',
      phase: 'shutdown'
    })
    logger.warn('[indexing-process] shutdown failed', error)
  }
  indexingProcessState.child?.kill()
}
