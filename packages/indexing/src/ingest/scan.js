import path from 'node:path'
import { lstat, stat } from 'node:fs/promises'
import { detectFileKind, isUnchangedFile } from './files.js'
import { walkFiles } from './walker.js'
import { getIndexedEntry } from '../db/metadata.js'
import { appendEvent, setStatus, state } from '../runtime/core/state.js'
const SCAN_YIELD_INTERVAL = 100
const SCAN_STATUS_INTERVAL = 50
const createScanAccumulator = (queue) => {
  let scannedDelta = 0
  let skippedUnsupportedDelta = 0
  let skippedUnchangedDelta = 0
  let queuedDelta = 0
  const flush = () => {
    if (
      scannedDelta === 0 &&
      skippedUnsupportedDelta === 0 &&
      skippedUnchangedDelta === 0 &&
      queuedDelta === 0
    ) {
      return
    }
    setStatus({
      scannedFiles: state.indexingStatus.scannedFiles + scannedDelta,
      skippedUnsupported: state.indexingStatus.skippedUnsupported + skippedUnsupportedDelta,
      skippedUnchanged: state.indexingStatus.skippedUnchanged + skippedUnchangedDelta,
      queuedFiles: state.indexingStatus.queuedFiles + queuedDelta,
      queueSize: queue.size()
    })
    scannedDelta = 0
    skippedUnsupportedDelta = 0
    skippedUnchangedDelta = 0
    queuedDelta = 0
  }
  return {
    flush,
    incrementScanned() {
      scannedDelta += 1
    },
    incrementSkippedUnsupported() {
      skippedUnsupportedDelta += 1
    },
    incrementSkippedUnchanged() {
      skippedUnchangedDelta += 1
    },
    incrementQueued() {
      queuedDelta += 1
    }
  }
}
const queueIndexedFile = async (
  filePath,
  folderPath,
  queue,
  discoveredPaths,
  accumulator,
  forceRescan
) => {
  const fileKind = detectFileKind(filePath)
  if (!fileKind) {
    accumulator.incrementSkippedUnsupported()
    return
  }
  let fileStats
  try {
    const fileEntryStats = await lstat(filePath)
    if (fileEntryStats.isSymbolicLink() || !fileEntryStats.isFile()) {
      accumulator.incrementSkippedUnsupported()
      return
    }
    fileStats = fileEntryStats
  } catch {
    return
  }
  discoveredPaths.add(filePath)
  accumulator.incrementScanned()
  if (!forceRescan && isUnchangedFile(getIndexedEntry(filePath), fileStats, fileKind)) {
    accumulator.incrementSkippedUnchanged()
    return
  }
  await queue.push({
    filePath,
    folderPath,
    kind: fileKind,
    fileStats
  })
  state.pendingFilePaths.add(filePath)
  accumulator.incrementQueued()
}
export const pathExists = async (filePath) => {
  try {
    const fileEntryStats = await lstat(filePath)
    return !fileEntryStats.isSymbolicLink()
  } catch {
    return false
  }
}
export const scanIndexingScope = async (
  folderPath,
  scopePath,
  queue,
  discoveredPaths,
  { forceRescan = false } = {}
) => {
  if (state.cancelRequested) {
    return
  }
  let iterationCount = 0
  const accumulator = createScanAccumulator(queue)
  const normalizedScopePath = path.resolve(scopePath)
  const scopeStats = await stat(normalizedScopePath).catch(() => null)
  if (!scopeStats) {
    return
  }
  appendEvent(
    'info',
    normalizedScopePath === folderPath ? `Scanning ${folderPath}` : `Syncing ${normalizedScopePath}`
  )
  if (scopeStats.isFile()) {
    await queueIndexedFile(
      normalizedScopePath,
      folderPath,
      queue,
      discoveredPaths,
      accumulator,
      forceRescan
    )
    accumulator.flush()
    return
  }
  if (!scopeStats.isDirectory()) {
    return
  }
  for await (const filePath of walkFiles(normalizedScopePath)) {
    if (state.cancelRequested) {
      break
    }
    iterationCount += 1
    if (iterationCount % SCAN_YIELD_INTERVAL === 0) {
      accumulator.flush()
      await new Promise((resolve) => setImmediate(resolve))
    } else if (iterationCount % SCAN_STATUS_INTERVAL === 0) {
      accumulator.flush()
    }
    await queueIndexedFile(filePath, folderPath, queue, discoveredPaths, accumulator, forceRescan)
  }
  accumulator.flush()
}
export const scanFolders = async (folders, queue, discoveredPaths) => {
  for (const folderPath of folders) {
    if (state.cancelRequested) {
      break
    }
    await scanIndexingScope(folderPath, folderPath, queue, discoveredPaths)
  }
}
