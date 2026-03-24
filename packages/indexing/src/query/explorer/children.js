import path from 'node:path'
import { opendir, stat } from 'node:fs/promises'
import { dbLoadEntriesByPathPrefix, openKnowledgeDb } from '../../db/db.js'
import { IGNORED_DIRECTORIES } from '../../runtime/core/constants.js'
import { detectFileKind, isUnchangedFile } from '../../ingest/files.js'
import { state } from '../../runtime/core/state.js'
import { isSameOrNestedPath } from '../../runtime/core/utils.js'
import { sweepDeletedIndexedPaths } from '../../runtime/sync/cleanup.js'
import {
  collectDirectChildNames,
  createIndexedEntryByPath,
  createIndexedFileEntryByPath,
  summarizeDirectoryStatus,
  toDirectoryStatusReason,
  toFileStatusReason
} from './children.helpers.js'
export const getIndexedChildren = async (payload) => {
  const rawFolderPath = String(payload?.folderPath || '').trim()
  if (!rawFolderPath) {
    throw new Error('Folder path is required.')
  }
  const normalizedFolderPath = path.resolve(rawFolderPath)
  const requestedBasePath = String(payload?.basePath || '').trim()
  const normalizedBasePath = requestedBasePath
    ? path.resolve(requestedBasePath)
    : normalizedFolderPath
  if (!isSameOrNestedPath(normalizedFolderPath, normalizedBasePath)) {
    throw new Error('Base path must be inside the selected folder.')
  }
  await sweepDeletedIndexedPaths(normalizedBasePath)
  await openKnowledgeDb()
  const indexedEntries = dbLoadEntriesByPathPrefix(normalizedBasePath)
  const indexedEntryByPath = createIndexedEntryByPath(indexedEntries)
  const indexedFileEntryByPath = createIndexedFileEntryByPath(indexedEntries, normalizedBasePath)
  const pendingChildNames = collectDirectChildNames(state.pendingFilePaths, normalizedBasePath)
  const processingChildNames = collectDirectChildNames(
    state.processingFilePaths,
    normalizedBasePath
  )
  const directoryEntries = []
  let directoryHandle
  try {
    directoryHandle = await opendir(normalizedBasePath)
  } catch {
    throw new Error('Unable to read folder contents.')
  }
  for await (const entry of directoryHandle) {
    directoryEntries.push(entry)
  }
  directoryEntries.sort((left, right) => left.name.localeCompare(right.name))
  const children = []
  for (const entry of directoryEntries) {
    const childPath = path.join(normalizedBasePath, entry.name)
    if (entry.isSymbolicLink()) {
      children.push({
        path: childPath,
        name: entry.name,
        type: 'file',
        fileKind: null,
        size: 0,
        indexedAt: null,
        status: 'ignored',
        statusReason: toFileStatusReason('symbolic-link')
      })
      continue
    }
    if (entry.isDirectory()) {
      const isIgnoredDirectory = IGNORED_DIRECTORIES.has(entry.name)
      let directoryStatus = isIgnoredDirectory ? 'ignored' : 'indexed'
      let directoryStatusReason = isIgnoredDirectory
        ? toDirectoryStatusReason('ignored-directory')
        : ''
      if (!isIgnoredDirectory) {
        if (processingChildNames.has(entry.name)) {
          directoryStatus = 'indexing'
        } else if (pendingChildNames.has(entry.name)) {
          directoryStatus = 'pending'
        } else {
          const directorySummary = await summarizeDirectoryStatus(childPath, indexedEntryByPath)
          directoryStatus = directorySummary.status
          directoryStatusReason = directorySummary.statusReason
        }
      }
      children.push({
        path: childPath,
        name: entry.name,
        type: 'directory',
        status: directoryStatus,
        statusReason: directoryStatusReason
      })
      continue
    }
    if (!entry.isFile()) {
      continue
    }
    let fileStats
    try {
      fileStats = await stat(childPath)
    } catch {
      continue
    }
    const detectedFileKind = detectFileKind(childPath)
    const indexedFileEntry = indexedFileEntryByPath.get(childPath)
    const isSupportedFile = Boolean(detectedFileKind)
    const fileStatus = !isSupportedFile
      ? 'ignored'
      : state.processingFilePaths.has(childPath)
        ? 'indexing'
        : state.pendingFilePaths.has(childPath)
          ? 'pending'
          : indexedFileEntry && isUnchangedFile(indexedFileEntry, fileStats, detectedFileKind)
            ? 'indexed'
            : 'not_indexed'
    children.push({
      path: childPath,
      name: entry.name,
      type: 'file',
      fileKind: detectedFileKind || indexedFileEntry?.kind || null,
      size: Number(fileStats.size || 0),
      mtimeMs: Number(fileStats.mtimeMs || 0),
      indexedAt: indexedFileEntry?.indexedAt || null,
      status: fileStatus,
      statusReason: isSupportedFile ? '' : toFileStatusReason('unsupported-extension')
    })
  }
  children.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1
    }
    return left.name.localeCompare(right.name)
  })
  return {
    folderPath: normalizedFolderPath,
    basePath: normalizedBasePath,
    children
  }
}
