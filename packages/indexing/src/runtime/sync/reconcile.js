import path from 'node:path'
import { stat } from 'node:fs/promises'
import {
  FULL_RECONCILE_INTERVAL_MS,
  MAX_QUEUE_SIZE,
  RECONCILE_DEBOUNCE_MS,
  WORKER_CONCURRENCY
} from '../core/constants.js'
import { BoundedAsyncQueue } from '../core/queue.js'
import {
  appendEvent,
  createInitialStatus,
  setStatus,
  state,
  waitForIndexingIdle
} from '../core/state.js'
import { ensureIndexMetadataLoaded } from '../../db/metadata.js'
import { removeStaleIndexedPathsForScope } from './cleanup.js'
import { pathExists, scanIndexingScope } from '../../ingest/scan.js'
import { workerLoop } from '../../ingest/worker.js'
import { isSameOrNestedPath } from '../core/utils.js'
const buildScopeKey = (folderPath, scopePath) => `${folderPath}::${scopePath}`
const scheduleQueuedReconcile = (delayMs) => {
  if (state.reconcileTimer) {
    clearTimeout(state.reconcileTimer)
  }
  state.reconcileTimer = setTimeout(
    () => {
      state.reconcileTimer = null
      void runQueuedReconciles()
    },
    Math.max(0, delayMs)
  )
}
const syncRuntimeStatus = (patch = {}) => {
  const activeFolders = [...state.trackedFolders]
  const baseStatus = {
    running: activeFolders.length > 0,
    watching: activeFolders.length > 0,
    activeFolders,
    pendingScopes: state.pendingReconcileScopes.size
  }
  if (!Object.prototype.hasOwnProperty.call(patch, 'message')) {
    if (!state.indexingStatus.reconciling && !state.indexingStatus.cancelling) {
      baseStatus.message = activeFolders.length ? 'Watching for changes.' : 'No folders selected.'
    }
  }
  setStatus({
    ...baseStatus,
    ...patch
  })
}
const queueReconcileScope = (folderPath, scopePath, forceRescan = false) => {
  const normalizedFolderPath = path.resolve(folderPath)
  const normalizedScopePath = path.resolve(scopePath)
  if (!isSameOrNestedPath(normalizedFolderPath, normalizedScopePath)) {
    return
  }
  for (const [scopeKey, queuedScope] of state.pendingReconcileScopes.entries()) {
    if (queuedScope.folderPath !== normalizedFolderPath) {
      continue
    }
    if (isSameOrNestedPath(queuedScope.scopePath, normalizedScopePath)) {
      if (forceRescan && !queuedScope.forceRescan) {
        state.pendingReconcileScopes.set(scopeKey, {
          ...queuedScope,
          forceRescan: true
        })
      }
      return
    }
    if (isSameOrNestedPath(normalizedScopePath, queuedScope.scopePath)) {
      forceRescan = forceRescan || Boolean(queuedScope.forceRescan)
      state.pendingReconcileScopes.delete(scopeKey)
    }
  }
  state.pendingReconcileScopes.set(buildScopeKey(normalizedFolderPath, normalizedScopePath), {
    folderPath: normalizedFolderPath,
    scopePath: normalizedScopePath,
    forceRescan
  })
  syncRuntimeStatus()
}
const finalizeReconcileRun = ({ completed, failed, message }) => {
  const finishedAt = new Date().toISOString()
  syncRuntimeStatus({
    reconciling: false,
    cancelling: false,
    finishedAt,
    lastReconciledAt: completed && !failed ? finishedAt : state.indexingStatus.lastReconciledAt,
    queueSize: 0,
    message
  })
}
const runQueuedReconciles = async () => {
  if (state.reconcilePromise || state.pendingReconcileScopes.size === 0) {
    return state.reconcilePromise
  }
  const queuedScopes = [...state.pendingReconcileScopes.values()].sort((left, right) =>
    left.scopePath.localeCompare(right.scopePath)
  )
  state.pendingReconcileScopes.clear()
  state.reconcilePromise = (async () => {
    await ensureIndexMetadataLoaded()
    const activeFolders = [...state.trackedFolders]
    state.cancelRequested = false
    state.indexingStatus = {
      ...createInitialStatus(),
      running: activeFolders.length > 0,
      watching: activeFolders.length > 0,
      reconciling: true,
      startedAt: new Date().toISOString(),
      activeFolders,
      message:
        queuedScopes.length === 1
          ? `Syncing ${queuedScopes[0].scopePath}`
          : `Syncing ${queuedScopes.length} locations`
    }
    const queue = new BoundedAsyncQueue(MAX_QUEUE_SIZE)
    const workers = Array.from(
      {
        length: WORKER_CONCURRENCY
      },
      () => workerLoop(queue)
    )
    const scannedScopes = []
    try {
      for (const scope of queuedScopes) {
        if (state.cancelRequested) {
          break
        }
        const discoveredPaths = new Set()
        const scopeExists = await pathExists(scope.scopePath)
        if (scopeExists) {
          const scopeStats = await stat(scope.scopePath).catch(() => null)
          if (scopeStats?.isFile() || scopeStats?.isDirectory()) {
            await scanIndexingScope(scope.folderPath, scope.scopePath, queue, discoveredPaths, {
              forceRescan: Boolean(scope.forceRescan)
            })
          }
        }
        scannedScopes.push({
          scopePath: scope.scopePath,
          discoveredPaths
        })
      }
    } finally {
      queue.close()
    }
    await Promise.all(workers)
    if (state.cancelRequested) {
      appendEvent('warning', 'Indexing sync interrupted.')
      finalizeReconcileRun({
        completed: false,
        failed: false,
        message: activeFolders.length ? 'Watching for changes.' : 'No folders selected.'
      })
      return
    }
    for (const scope of scannedScopes) {
      await removeStaleIndexedPathsForScope(scope.scopePath, scope.discoveredPaths)
    }
    appendEvent('success', 'Index synced.')
    finalizeReconcileRun({
      completed: true,
      failed: false,
      message: activeFolders.length ? 'Watching for changes.' : 'No folders selected.'
    })
  })()
    .catch((error) => {
      appendEvent('error', `Indexing sync failed: ${error?.message || 'Unknown error'}`)
      finalizeReconcileRun({
        completed: false,
        failed: true,
        message: 'Indexing sync failed.'
      })
    })
    .finally(() => {
      state.reconcilePromise = null
      if (state.pendingReconcileScopes.size > 0) {
        scheduleQueuedReconcile(0)
      }
    })
  return state.reconcilePromise
}
export const syncIndexingRuntimeStatus = (patch = {}) => {
  syncRuntimeStatus(patch)
}
export const scheduleIndexingReconcile = (
  folderPath,
  scopePath = folderPath,
  { delayMs, forceRescan = false } = {}
) => {
  queueReconcileScope(folderPath, scopePath, forceRescan)
  scheduleQueuedReconcile(delayMs ?? RECONCILE_DEBOUNCE_MS)
}
export const scheduleFullIndexingReconcile = (folders, delayMs = 0) => {
  for (const folderPath of folders) {
    queueReconcileScope(folderPath, folderPath, false)
  }
  if (folders.length) {
    scheduleQueuedReconcile(delayMs)
  } else {
    syncRuntimeStatus()
  }
}
export const dropPendingReconcilesForFolder = (folderPath) => {
  for (const [scopeKey, queuedScope] of state.pendingReconcileScopes.entries()) {
    if (queuedScope.folderPath === folderPath) {
      state.pendingReconcileScopes.delete(scopeKey)
    }
  }
  syncRuntimeStatus()
}
export const cancelIndexingReconcile = async (message) => {
  if (state.reconcileTimer) {
    clearTimeout(state.reconcileTimer)
    state.reconcileTimer = null
  }
  if (!state.reconcilePromise) {
    state.pendingReconcileScopes.clear()
    syncRuntimeStatus({
      cancelling: false,
      reconciling: false,
      message
    })
    return
  }
  state.cancelRequested = true
  syncRuntimeStatus({
    cancelling: true,
    message
  })
  await waitForIndexingIdle()
  state.cancelRequested = false
}
export const syncPeriodicReconcileTimer = () => {
  if (state.fullReconcileTimer) {
    clearInterval(state.fullReconcileTimer)
    state.fullReconcileTimer = null
  }
  if (!state.trackedFolders.length) {
    return
  }
  state.fullReconcileTimer = setInterval(() => {
    scheduleFullIndexingReconcile(state.trackedFolders, RECONCILE_DEBOUNCE_MS)
  }, FULL_RECONCILE_INTERVAL_MS)
}
export const clearIndexingReconcileRuntime = () => {
  if (state.reconcileTimer) {
    clearTimeout(state.reconcileTimer)
    state.reconcileTimer = null
  }
  if (state.fullReconcileTimer) {
    clearInterval(state.fullReconcileTimer)
    state.fullReconcileTimer = null
  }
  state.pendingReconcileScopes.clear()
}
