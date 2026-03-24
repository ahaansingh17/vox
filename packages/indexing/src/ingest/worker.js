import path from 'node:path'
import { MAX_RETRY_ATTEMPTS } from '../runtime/core/constants.js'
import { readTextFileForIndex } from './files.js'
import { upsertKnowledgeTextDocument } from '../db/search.js'
import { appendEvent, delay, setStatus, state } from '../runtime/core/state.js'
import { isRetriableError } from '../runtime/core/utils.js'
const upsertTextDocument = async (job) => {
  const textReadResult = await readTextFileForIndex(job.filePath)
  if (textReadResult.containsBinary || !String(textReadResult.text || '').trim()) {
    setStatus({
      skippedUnsupported: state.indexingStatus.skippedUnsupported + 1
    })
    return {
      indexed: false
    }
  }
  await upsertKnowledgeTextDocument({
    path: job.filePath,
    folderPath: job.folderPath,
    fileStats: job.fileStats,
    text: textReadResult.text
  })
  return {
    indexed: true
  }
}
export const processJobWithRetry = async (job) => {
  let attempt = 0
  while (attempt <= MAX_RETRY_ATTEMPTS) {
    if (state.cancelRequested) {
      return
    }
    try {
      const processResult = await upsertTextDocument(job)
      if (processResult?.indexed) {
        setStatus({
          indexedFiles: state.indexingStatus.indexedFiles + 1
        })
      }
      return
    } catch (error) {
      const canRetry = attempt < MAX_RETRY_ATTEMPTS && isRetriableError(error)
      if (canRetry) {
        attempt += 1
        appendEvent('warning', `Retrying ${path.basename(job.filePath)} (attempt ${attempt + 1})`)
        await delay(300 * 2 ** attempt)
        continue
      }
      setStatus({
        failedFiles: state.indexingStatus.failedFiles + 1
      })
      appendEvent(
        'error',
        `Failed ${path.basename(job.filePath)}: ${error?.message || 'Unknown error'}`
      )
      return
    }
  }
}
export const workerLoop = async (queue) => {
  while (true) {
    const nextJob = await queue.pop()
    if (!nextJob) {
      return
    }
    state.pendingFilePaths.delete(nextJob.filePath)
    state.processingFilePaths.add(nextJob.filePath)
    setStatus({
      queueSize: queue.size()
    })
    try {
      await processJobWithRetry(nextJob)
    } finally {
      state.processingFilePaths.delete(nextJob.filePath)
    }
    setStatus({
      processedFiles: state.indexingStatus.processedFiles + 1,
      queueSize: queue.size()
    })
  }
}
