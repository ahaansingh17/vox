import { DELETE_DRAIN_RETRY_DELAY_MS, REMOVE_BATCH_SIZE } from '../core/constants.js'
import { dbLoadEntryPathsByPathPrefix, openKnowledgeDb } from '../../db/db.js'
import { removeKnowledgeDocuments } from '../../db/search.js'
import { appendEvent, DELETION_SWEEP_COOLDOWN_MS, setStatus, state } from '../core/state.js'
import { chunkArray } from '../core/utils.js'
import {
  ensureIndexMetadataLoaded,
  loadPendingDeletePaths,
  removeIndexedEntries,
  removePendingDeletes
} from '../../db/metadata.js'
import { pathExists } from '../../ingest/scan.js'
export const removeIndexedPaths = async (
  paths,
  {
    incrementRemovedStale = false,
    reportErrorsAsFailedFiles = false,
    contextLabel = 'cleanup'
  } = {}
) => {
  if (!paths.length || state.cancelRequested) {
    return {
      removedCount: 0,
      failedCount: 0
    }
  }
  await ensureIndexMetadataLoaded()
  let removedCount = 0
  let failedCount = 0
  const pathChunks = chunkArray(paths, REMOVE_BATCH_SIZE)
  for (const chunk of pathChunks) {
    if (state.cancelRequested) {
      break
    }
    try {
      await removeKnowledgeDocuments(chunk)
      removeIndexedEntries(chunk)
      removePendingDeletes(chunk)
      removedCount += chunk.length
    } catch (error) {
      failedCount += chunk.length
      appendEvent('error', `Failed ${contextLabel}: ${error?.message || 'Unknown error'}`)
    }
  }
  if (incrementRemovedStale && removedCount > 0) {
    setStatus({
      removedStale: state.indexingStatus.removedStale + removedCount
    })
  }
  if (reportErrorsAsFailedFiles && failedCount > 0) {
    setStatus({
      failedFiles: state.indexingStatus.failedFiles + failedCount
    })
  }
  return {
    removedCount,
    failedCount
  }
}
export const schedulePendingDeleteDrain = (delayMs = 0) => {
  if (state.pendingDeleteDrainTimer) {
    clearTimeout(state.pendingDeleteDrainTimer)
    state.pendingDeleteDrainTimer = null
  }
  if (delayMs <= 0) {
    void drainPendingDeletes()
    return
  }
  state.pendingDeleteDrainTimer = setTimeout(() => {
    state.pendingDeleteDrainTimer = null
    void drainPendingDeletes()
  }, delayMs)
}
export const drainPendingDeletes = async () => {
  if (state.pendingDeleteDrainPromise) {
    return state.pendingDeleteDrainPromise
  }
  state.pendingDeleteDrainPromise = (async () => {
    if (state.indexingStatus.reconciling || state.indexingStatus.cancelling) {
      schedulePendingDeleteDrain(DELETE_DRAIN_RETRY_DELAY_MS)
      return
    }
    await ensureIndexMetadataLoaded()
    const queuedPaths = loadPendingDeletePaths()
    if (!queuedPaths.length) {
      return
    }
    const cleanupResult = await removeIndexedPaths(queuedPaths, {
      contextLabel: 'queued folder cleanup'
    })
    const remainingCount = loadPendingDeletePaths().length
    if (remainingCount > 0) {
      const retryDelay = cleanupResult.failedCount > 0 ? DELETE_DRAIN_RETRY_DELAY_MS : 0
      schedulePendingDeleteDrain(retryDelay)
    }
  })()
    .catch((error) => {
      appendEvent('error', `Queued folder cleanup failed: ${error?.message || 'Unknown error'}`)
      schedulePendingDeleteDrain(DELETE_DRAIN_RETRY_DELAY_MS)
    })
    .finally(() => {
      state.pendingDeleteDrainPromise = null
    })
  return state.pendingDeleteDrainPromise
}
export const kickPendingDeleteDrain = () => {
  if (state.pendingDeleteDrainTimer || state.pendingDeleteDrainPromise) {
    return
  }
  void drainPendingDeletes()
}
export const removeStaleIndexedPathsForScope = async (scopePath, discoveredPaths) => {
  await openKnowledgeDb()
  const stalePaths = []
  for (const indexedPath of dbLoadEntryPathsByPathPrefix(scopePath)) {
    if (!discoveredPaths.has(indexedPath)) {
      stalePaths.push(indexedPath)
    }
  }
  if (!stalePaths.length || state.cancelRequested) {
    return
  }
  appendEvent('info', `Removing ${stalePaths.length} stale indexed files`)
  await removeIndexedPaths(stalePaths, {
    incrementRemovedStale: true,
    reportErrorsAsFailedFiles: true,
    contextLabel: 'stale cleanup'
  })
}
export const sweepDeletedIndexedPaths = async (folderPath) => {
  if (!folderPath || state.indexingStatus.reconciling || state.indexingStatus.cancelling) {
    return
  }
  const now = Date.now()
  const lastSweepAt = Number(state.deletionSweepByFolder.get(folderPath) || 0)
  if (now - lastSweepAt < DELETION_SWEEP_COOLDOWN_MS) {
    return
  }
  state.deletionSweepByFolder.set(folderPath, now)
  await openKnowledgeDb()
  const indexedPaths = dbLoadEntryPathsByPathPrefix(folderPath)
  if (!indexedPaths.length) {
    return
  }
  const missingPaths = []
  for (const pathChunk of chunkArray(indexedPaths, REMOVE_BATCH_SIZE)) {
    const checks = await Promise.all(
      pathChunk.map(async (indexedPath) => ({
        indexedPath,
        exists: await pathExists(indexedPath)
      }))
    )
    for (const checkResult of checks) {
      if (!checkResult.exists) {
        missingPaths.push(checkResult.indexedPath)
      }
    }
  }
  if (!missingPaths.length) {
    return
  }
  appendEvent('info', `Removing ${missingPaths.length} deleted indexed files`)
  await removeIndexedPaths(missingPaths, {
    incrementRemovedStale: true,
    reportErrorsAsFailedFiles: true,
    contextLabel: 'deleted-file cleanup'
  })
}
