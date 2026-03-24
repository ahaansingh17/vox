import {
  bootIndexingRuntime,
  getIndexingStatus,
  shutdownIndexingRuntime
} from '../runtime/sync/lifecycle.js'
import {
  addIndexFolder,
  getTrackedIndexFolders,
  rebuildIndexing,
  removeIndexFolder,
  removeIndexedFolderData,
  resetIndexingState
} from '../runtime/sync/actions.js'
import {
  getIndexedChildren,
  listIndexedFilesForTool,
  readIndexedFileForTool
} from '../query/api.js'
import { searchIndexedContextForTool } from '../db/search.js'
import { closeKnowledgeDb } from '../db/db.js'
import { destroyParserWorker } from '../parser/pool.js'
import {
  captureUtilityException,
  captureUtilityMessage,
  flushUtilitySentry,
  initUtilitySentry,
  setUtilitySentry
} from '../telemetry/worker.js'
setUtilitySentry({
  init: () => {},
  captureException: (error, context) => {
    process.parentPort?.postMessage({
      type: 'telemetry',
      level: 'exception',
      error: { message: error?.message, stack: error?.stack, code: error?.code },
      context
    })
  },
  captureMessage: (message, context) => {
    process.parentPort?.postMessage({
      type: 'telemetry',
      level: 'message',
      message: String(message),
      context
    })
  },
  flush: async () => {}
})
initUtilitySentry('indexing-child')
const METHOD_HANDLERS = {
  addIndexFolder,
  bootIndexingRuntime,
  getIndexedChildren,
  getIndexingStatus,
  getTrackedIndexFolders,
  listIndexedFilesForTool,
  readIndexedFileForTool,
  rebuildIndexing,
  removeIndexFolder,
  removeIndexedFolderData,
  resetIndexingState,
  searchIndexedContextForTool,
  shutdownIndexingRuntime
}
const formatProcessError = (error) => ({
  code: error?.code || 'INDEXING_PROCESS_ERROR',
  message: error?.message || 'Unexpected indexing process error.'
})
const sendProcessMessage = (message) => {
  process.parentPort.postMessage(message)
}
const releaseProcessResources = () => {
  destroyParserWorker()
  closeKnowledgeDb()
}
const flushAndExit = async (code) => {
  try {
    await flushUtilitySentry(2000)
  } catch {
    void 0
  }
  process.exit(code)
}
process.on('uncaughtException', async (error) => {
  captureUtilityException(error, {
    process: 'indexing-child',
    area: 'indexing-process',
    phase: 'uncaught-exception'
  })
  await flushAndExit(1)
})
process.on('unhandledRejection', async (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  captureUtilityException(error, {
    process: 'indexing-child',
    area: 'indexing-process',
    phase: 'unhandled-rejection'
  })
  await flushAndExit(1)
})
process.parentPort.on('message', async ({ data: message }) => {
  if (!message || message.type !== 'request') {
    return
  }
  const method = String(message.method || '')
  if (!Object.hasOwn(METHOD_HANDLERS, method)) {
    captureUtilityMessage(`Unknown indexing process method: ${message.method}`, {
      process: 'indexing-child',
      area: 'indexing-process',
      phase: 'unknown-method',
      level: 'error'
    })
    sendProcessMessage({
      type: 'response',
      requestId: message.requestId,
      success: false,
      error: {
        code: 'INDEXING_PROCESS_METHOD_NOT_FOUND',
        message: `Unknown indexing process method: ${message.method}`
      }
    })
    return
  }
  try {
    const handler = METHOD_HANDLERS[method]
    const data = await handler(message.payload || {})
    sendProcessMessage({
      type: 'response',
      requestId: message.requestId,
      success: true,
      data
    })
    if (message.method === 'shutdownIndexingRuntime') {
      releaseProcessResources()
      await flushAndExit(0)
    }
  } catch (error) {
    captureUtilityException(error, {
      process: 'indexing-child',
      area: 'indexing-process',
      phase: 'request',
      context: {
        method: String(message.method || '')
      }
    })
    sendProcessMessage({
      type: 'response',
      requestId: message.requestId,
      success: false,
      error: formatProcessError(error)
    })
  }
})
sendProcessMessage({
  type: 'ready'
})
