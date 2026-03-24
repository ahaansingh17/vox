import { lstat, stat } from 'node:fs/promises'
import path from 'node:path'
import { ensureIndexMetadataLoaded } from '../../db/metadata.js'
import { cloneStatus, state } from '../core/state.js'
import { RECONCILE_DEBOUNCE_MS } from '../core/constants.js'
import { kickPendingDeleteDrain } from './cleanup.js'
import { getStoredTrackedFolders, isSameOrNestedPath } from '../tracking/folders.js'
import {
  cancelIndexingReconcile,
  clearIndexingReconcileRuntime,
  scheduleFullIndexingReconcile,
  scheduleIndexingReconcile,
  syncIndexingRuntimeStatus,
  syncPeriodicReconcileTimer
} from './reconcile.js'
import { clearFolderWatchers, refreshFolderWatcher, syncFolderWatchers } from '../tracking/watch.js'
const resolveWatchScope = async (folderPath, changedPath, needsWatcherRefresh) => {
  if (needsWatcherRefresh) {
    await refreshFolderWatcher(folderPath, handleIndexingWatchEvent)
  }
  const normalizedChangedPath = path.resolve(changedPath || folderPath)
  if (!isSameOrNestedPath(folderPath, normalizedChangedPath)) {
    return folderPath
  }
  const entryStats = await lstat(normalizedChangedPath).catch(() => null)
  if (entryStats?.isSymbolicLink()) {
    return path.dirname(normalizedChangedPath)
  }
  const changedStats = await stat(normalizedChangedPath).catch(() => null)
  if (changedStats?.isDirectory()) {
    return normalizedChangedPath
  }
  if (changedStats?.isFile()) {
    return normalizedChangedPath
  }
  const parentPath = path.dirname(normalizedChangedPath)
  if (isSameOrNestedPath(folderPath, parentPath)) {
    return parentPath
  }
  return folderPath
}
const handleIndexingWatchEvent = (payload) => {
  const folderPath = path.resolve(String(payload?.folderPath || '').trim())
  if (!folderPath || !state.trackedFolders.includes(folderPath)) {
    return
  }
  void resolveWatchScope(folderPath, payload?.changedPath, payload?.needsWatcherRefresh).then(
    (scopePath) => {
      scheduleIndexingReconcile(folderPath, scopePath, {
        forceRescan: true
      })
      if (payload?.needsWatcherRefresh || payload?.shouldHealRoot) {
        scheduleIndexingReconcile(folderPath, folderPath, {
          delayMs: RECONCILE_DEBOUNCE_MS * 2
        })
      }
    }
  )
}
export const applyTrackedFolders = async (
  folders,
  { reconcileFolders = [], reconcileAll = false } = {}
) => {
  state.trackedFolders = [...folders]
  await syncFolderWatchers(folders, handleIndexingWatchEvent)
  syncPeriodicReconcileTimer()
  syncIndexingRuntimeStatus()
  if (reconcileAll) {
    scheduleFullIndexingReconcile(folders, 0)
    return
  }
  for (const folderPath of reconcileFolders) {
    scheduleIndexingReconcile(folderPath, folderPath, {
      delayMs: 0
    })
  }
}
export const getIndexingStatus = () => {
  if (!state.indexingStatus.reconciling && !state.indexingStatus.cancelling) {
    kickPendingDeleteDrain()
  }
  return cloneStatus()
}
export const pickIndexFolder = async () => {
  const { dialog } = await import('electron')
  const result = await dialog.showOpenDialog({
    title: 'Select folder to index',
    properties: ['openDirectory']
  })
  if (result.canceled || !result.filePaths?.length) {
    return {
      path: ''
    }
  }
  return {
    path: path.resolve(result.filePaths[0])
  }
}
export const bootIndexingRuntime = async () => {
  await ensureIndexMetadataLoaded()
  const folders = await getStoredTrackedFolders()
  await applyTrackedFolders(folders, {
    reconcileAll: folders.length > 0
  })
}
export const shutdownIndexingRuntime = async () => {
  await cancelIndexingReconcile('Stopping indexing...')
  clearIndexingReconcileRuntime()
  clearFolderWatchers()
  syncIndexingRuntimeStatus({
    running: false,
    watching: false,
    reconciling: false,
    cancelling: false
  })
}
