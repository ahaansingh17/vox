import path from 'node:path'
import { opendir, stat } from 'node:fs/promises'
import { detectFileKind, isUnchangedFile } from '../../ingest/files.js'
import { IGNORED_DIRECTORIES } from '../../runtime/core/constants.js'
import { state } from '../../runtime/core/state.js'
import { isSameOrNestedPath } from '../../runtime/core/utils.js'
const DIRECTORY_STATUS_PRIORITY = {
  indexing: 4,
  pending: 3,
  not_indexed: 2,
  indexed: 1,
  ignored: 0
}
const getMoreSevereStatus = (left, right) =>
  DIRECTORY_STATUS_PRIORITY[right] > DIRECTORY_STATUS_PRIORITY[left] ? right : left
export const toDirectoryStatusReason = (reason) => {
  if (reason === 'ignored-directory') {
    return 'Ignored directory'
  }
  return ''
}
export const toFileStatusReason = (reason) => {
  if (reason === 'unsupported-extension') {
    return 'Unsupported file type'
  }
  if (reason === 'symbolic-link') {
    return 'Symbolic link'
  }
  return ''
}
export const createIndexedEntryByPath = (entries) => {
  const entriesByPath = new Map()
  for (const entry of entries) {
    entriesByPath.set(entry.path, {
      folderPath: entry.folder_path,
      kind: entry.kind,
      size: entry.size,
      mtimeMs: entry.mtime_ms,
      indexedAt: entry.indexed_at
    })
  }
  return entriesByPath
}
export const createIndexedFileEntryByPath = (entries, basePath) => {
  const indexedFileEntryByPath = new Map()
  for (const indexedEntry of entries) {
    const indexedPath = indexedEntry.path
    if (!isSameOrNestedPath(basePath, indexedPath)) {
      continue
    }
    const relativeToBasePath = path.relative(basePath, indexedPath)
    if (
      !relativeToBasePath ||
      relativeToBasePath.startsWith('..') ||
      path.isAbsolute(relativeToBasePath)
    ) {
      continue
    }
    const pathSegments = relativeToBasePath.split(path.sep).filter(Boolean)
    if (pathSegments.length !== 1) {
      continue
    }
    indexedFileEntryByPath.set(path.join(basePath, pathSegments[0]), {
      folderPath: indexedEntry.folder_path,
      kind: indexedEntry.kind,
      size: indexedEntry.size,
      mtimeMs: indexedEntry.mtime_ms,
      indexedAt: indexedEntry.indexed_at
    })
  }
  return indexedFileEntryByPath
}
export const collectDirectChildNames = (pathsSet, basePath) => {
  const childNames = new Set()
  for (const indexedPath of pathsSet) {
    if (!isSameOrNestedPath(basePath, indexedPath)) {
      continue
    }
    const relativeToBasePath = path.relative(basePath, indexedPath)
    if (
      !relativeToBasePath ||
      relativeToBasePath.startsWith('..') ||
      path.isAbsolute(relativeToBasePath)
    ) {
      continue
    }
    const pathSegments = relativeToBasePath.split(path.sep).filter(Boolean)
    if (!pathSegments.length) {
      continue
    }
    childNames.add(pathSegments[0])
  }
  return childNames
}
export const summarizeDirectoryStatus = async (directoryPath, indexedEntryByPath) => {
  const directoryName = path.basename(directoryPath)
  if (IGNORED_DIRECTORIES.has(directoryName)) {
    return {
      status: 'ignored',
      statusReason: toDirectoryStatusReason('ignored-directory')
    }
  }
  let handle
  try {
    handle = await opendir(directoryPath)
  } catch {
    return {
      status: 'ignored',
      statusReason: 'Unreadable directory'
    }
  }
  let aggregateStatus = 'indexed'
  let aggregateReason = ''
  for await (const entry of handle) {
    const childPath = path.join(directoryPath, entry.name)
    if (entry.isSymbolicLink()) {
      continue
    }
    if (entry.isDirectory()) {
      const childSummary = await summarizeDirectoryStatus(childPath, indexedEntryByPath)
      aggregateStatus = getMoreSevereStatus(aggregateStatus, childSummary.status)
      if (childSummary.status !== 'indexed' && childSummary.statusReason) {
        aggregateReason = childSummary.statusReason
      }
      if (aggregateStatus === 'indexing') {
        return {
          status: aggregateStatus,
          statusReason: aggregateReason
        }
      }
      continue
    }
    if (!entry.isFile()) {
      continue
    }
    const fileKind = detectFileKind(childPath)
    if (!fileKind) {
      continue
    }
    if (state.processingFilePaths.has(childPath)) {
      return {
        status: 'indexing',
        statusReason: ''
      }
    }
    if (state.pendingFilePaths.has(childPath)) {
      aggregateStatus = getMoreSevereStatus(aggregateStatus, 'pending')
      continue
    }
    let fileStats
    try {
      fileStats = await stat(childPath)
    } catch {
      aggregateStatus = getMoreSevereStatus(aggregateStatus, 'not_indexed')
      continue
    }
    const indexedEntry = indexedEntryByPath.get(childPath)
    if (!indexedEntry || !isUnchangedFile(indexedEntry, fileStats, fileKind)) {
      return {
        status: 'not_indexed',
        statusReason: ''
      }
    }
  }
  return {
    status: aggregateStatus,
    statusReason: aggregateReason
  }
}
