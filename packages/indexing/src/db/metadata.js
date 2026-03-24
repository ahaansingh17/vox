import {
  openKnowledgeDb,
  dbLoadAllPendingDeletes,
  dbGetEntry,
  dbLoadEntryPathsByFolder,
  dbLoadPendingDeletePathsByFolder,
  dbDeleteEntries,
  dbUpsertPending,
  dbDeletePendings,
  dbClearEntriesAndPendingDeletes,
  dbKvGet,
  dbKvSet,
  dbKvDelete
} from './db.js'
export const ensureIndexMetadataLoaded = async () => openKnowledgeDb()
export const clearIndexMetadata = () => {
  dbClearEntriesAndPendingDeletes()
}
export const getIndexedEntry = (filePath) => {
  const row = dbGetEntry(filePath)
  if (!row) {
    return null
  }
  return {
    folderPath: row.folder_path,
    kind: row.kind,
    size: Number(row.size),
    mtimeMs: Number(row.mtime_ms),
    indexedAt: row.indexed_at
  }
}
export const removeIndexedEntries = (paths, persist = true) => {
  if (persist && paths.length) dbDeleteEntries(paths)
}
export { dbLoadEntryPathsByFolder, dbLoadPendingDeletePathsByFolder }
export const addPendingDelete = (filePath, folderPath) => {
  const queuedAt = new Date().toISOString()
  dbUpsertPending(filePath, folderPath, queuedAt)
}
export const removePendingDeletes = (paths, persist = true) => {
  if (persist && paths.length) dbDeletePendings(paths)
}
export const loadPendingDeletePaths = () =>
  dbLoadAllPendingDeletes()
    .map((row) => String(row.path || '').trim())
    .filter(Boolean)
export const kvGet = (key) => dbKvGet(key)
export const kvSet = (key, value) => dbKvSet(key, value)
export const kvDelete = (key) => dbKvDelete(key)
