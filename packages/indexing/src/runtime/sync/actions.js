import path from 'node:path'
import { clearKnowledgeStore, removeKnowledgeDocuments } from '../../db/search.js'
import {
  clearIndexMetadata,
  dbLoadEntryPathsByFolder,
  dbLoadPendingDeletePathsByFolder,
  removeIndexedEntries,
  removePendingDeletes
} from '../../db/metadata.js'
import { appendEvent, createInitialStatus, state } from '../core/state.js'
import { isSameOrNestedPath } from '../core/utils.js'
import {
  getStoredTrackedFolders,
  resetStoredTrackedFolders,
  setStoredTrackedFolders
} from '../tracking/folders.js'
import {
  cancelIndexingReconcile,
  clearIndexingReconcileRuntime,
  dropPendingReconcilesForFolder,
  scheduleFullIndexingReconcile,
  syncIndexingRuntimeStatus
} from './reconcile.js'
import { clearFolderWatchers } from '../tracking/watch.js'
import { openKnowledgeDb } from '../../db/db.js'
import { applyTrackedFolders, getIndexingStatus } from './lifecycle.js'
export const removeIndexedFolderData = async (payload) => {
  const rawFolderPath = String(payload?.folderPath || '').trim()
  if (!rawFolderPath) {
    throw new Error('Folder path is required.')
  }
  if (state.indexingStatus.reconciling || state.indexingStatus.cancelling) {
    throw new Error('Wait for indexing to settle before removing a folder.')
  }
  const normalizedFolderPath = path.resolve(rawFolderPath)
  await openKnowledgeDb()
  const folderIndexedPaths = dbLoadEntryPathsByFolder(normalizedFolderPath)
  const folderQueuedPaths = dbLoadPendingDeletePathsByFolder(normalizedFolderPath)
  if (!folderIndexedPaths.length && !folderQueuedPaths.length) {
    return {
      folderPath: normalizedFolderPath,
      removedCount: 0
    }
  }
  if (folderIndexedPaths.length) {
    await removeKnowledgeDocuments(folderIndexedPaths)
    removeIndexedEntries(folderIndexedPaths, false)
  }
  if (folderQueuedPaths.length) {
    removePendingDeletes(folderQueuedPaths)
  }
  appendEvent(
    'info',
    `Removed ${folderIndexedPaths.length} indexed files from ${normalizedFolderPath}.`
  )
  state.deletionSweepByFolder.delete(normalizedFolderPath)
  return {
    folderPath: normalizedFolderPath,
    removedCount: folderIndexedPaths.length
  }
}
export const getTrackedIndexFolders = async () => {
  const shouldBootstrap = state.trackedFolders.length === 0 && state.folderWatchers.size === 0
  const folders = await getStoredTrackedFolders()
  await applyTrackedFolders(folders, {
    reconcileAll: shouldBootstrap && folders.length > 0
  })
  return folders
}
export const addIndexFolder = async (payload) => {
  const normalizedFolderPath = path.resolve(String(payload?.folderPath || '').trim())
  if (!normalizedFolderPath) {
    throw new Error('Folder path is required.')
  }
  const activeFolders = await getStoredTrackedFolders()
  if (
    activeFolders.some(
      (folderPath) => folderPath.toLowerCase() === normalizedFolderPath.toLowerCase()
    )
  ) {
    throw new Error('Folder already exists in access list.')
  }
  const overlappingFolder = activeFolders.find(
    (folderPath) =>
      isSameOrNestedPath(folderPath, normalizedFolderPath) ||
      isSameOrNestedPath(normalizedFolderPath, folderPath)
  )
  if (overlappingFolder) {
    throw new Error('Folder overlaps with an existing indexed folder.')
  }
  const nextFolders = await setStoredTrackedFolders([...activeFolders, normalizedFolderPath])
  await applyTrackedFolders(nextFolders, {
    reconcileFolders: [normalizedFolderPath]
  })
  return {
    folders: nextFolders,
    status: getIndexingStatus()
  }
}
export const removeIndexFolder = async (payload) => {
  const normalizedFolderPath = path.resolve(String(payload?.folderPath || '').trim())
  if (!normalizedFolderPath) {
    throw new Error('Folder path is required.')
  }
  const activeFolders = await getStoredTrackedFolders()
  const nextFolders = activeFolders.filter((folderPath) => folderPath !== normalizedFolderPath)
  if (nextFolders.length === activeFolders.length) {
    throw new Error('Folder not found.')
  }
  await cancelIndexingReconcile('Updating indexed folders...')
  dropPendingReconcilesForFolder(normalizedFolderPath)
  await removeIndexedFolderData({
    folderPath: normalizedFolderPath
  })
  const persistedFolders = await setStoredTrackedFolders(nextFolders)
  await applyTrackedFolders(persistedFolders)
  dropPendingReconcilesForFolder(normalizedFolderPath)
  return {
    folders: persistedFolders,
    status: getIndexingStatus()
  }
}
export const rebuildIndexing = async () => {
  await cancelIndexingReconcile('Rebuilding index...')
  state.cancelRequested = false
  state.pendingFilePaths.clear()
  state.processingFilePaths.clear()
  state.deletionSweepByFolder.clear()
  clearIndexMetadata()
  await clearKnowledgeStore()
  syncIndexingRuntimeStatus({
    finishedAt: null,
    lastReconciledAt: null,
    scannedFiles: 0,
    queuedFiles: 0,
    processedFiles: 0,
    indexedFiles: 0,
    skippedUnchanged: 0,
    skippedUnsupported: 0,
    failedFiles: 0,
    removedStale: 0
  })
  if (state.trackedFolders.length) {
    scheduleFullIndexingReconcile(state.trackedFolders, 0)
  }
  return getIndexingStatus()
}
export const resetIndexingState = async () => {
  await cancelIndexingReconcile('Resetting index...')
  clearIndexingReconcileRuntime()
  clearFolderWatchers()
  state.cancelRequested = false
  if (state.pendingDeleteDrainTimer) {
    clearTimeout(state.pendingDeleteDrainTimer)
    state.pendingDeleteDrainTimer = null
  }
  state.pendingFilePaths.clear()
  state.processingFilePaths.clear()
  state.deletionSweepByFolder.clear()
  clearIndexMetadata()
  await clearKnowledgeStore()
  await resetStoredTrackedFolders()
  state.trackedFolders = []
  state.indexingStatus = createInitialStatus()
  return getIndexingStatus()
}
