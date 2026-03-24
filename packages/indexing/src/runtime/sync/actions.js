import path from 'node:path'
import { clearKnowledgeStore } from '../../db/search.js'
import { clearIndexMetadata } from '../../db/metadata.js'
import { createInitialStatus, state } from '../core/state.js'
import {
  getStoredTrackedFolders,
  isSameOrNestedPath,
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
import { removeIndexedFolderData } from '../../query/api.js'
import { applyTrackedFolders, getIndexingStatus } from './lifecycle.js'
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
