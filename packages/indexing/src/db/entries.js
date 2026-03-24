import { buildPathPrefixPattern, getKnowledgeDb, indexingDbState } from './prepared.js'
export const dbLoadAllEntries = () => indexingDbState.entries.loadAll.all()
export const dbGetEntry = (filePath) => indexingDbState.entries.get.get(filePath) || null
export const dbLoadEntryPathsByFolder = (folderPath) =>
  indexingDbState.entries.loadPathsByFolder.all(folderPath).map((row) => row.path)
export const dbLoadEntriesByPathPrefix = (basePath) =>
  indexingDbState.entries.loadByPathPrefix.all(buildPathPrefixPattern(basePath))
export const dbLoadEntryPathsByPathPrefix = (basePath) =>
  indexingDbState.entries.loadPathsByPathPrefix
    .all(buildPathPrefixPattern(basePath))
    .map((row) => row.path)
export const dbDeleteEntries = (paths) => {
  const knowledgeDb = getKnowledgeDb()
  knowledgeDb.transaction(() => {
    for (const filePath of paths) {
      indexingDbState.entries.delete.run(filePath)
    }
  })()
}
export const dbLoadAllPendingDeletes = () => indexingDbState.pendingDeletes.loadAll.all()
export const dbLoadPendingDeletePathsByFolder = (folderPath) =>
  indexingDbState.pendingDeletes.loadPathsByFolder.all(folderPath).map((row) => row.path)
export const dbUpsertPending = (filePath, folderPath, queuedAt) => {
  indexingDbState.pendingDeletes.upsert.run(filePath, folderPath, queuedAt)
}
export const dbDeletePendings = (paths) => {
  const knowledgeDb = getKnowledgeDb()
  knowledgeDb.transaction(() => {
    for (const filePath of paths) {
      indexingDbState.pendingDeletes.delete.run(filePath)
    }
  })()
}
export const dbClearEntriesAndPendingDeletes = () => {
  getKnowledgeDb().exec('DELETE FROM entries; DELETE FROM pending_deletes;')
}
export const dbKvGet = (key) => {
  const row = indexingDbState.kv.get.get(key)
  return row ? row.value : null
}
export const dbKvSet = (key, value) => {
  indexingDbState.kv.set.run(key, value)
}
export const dbKvDelete = (key) => {
  indexingDbState.kv.delete.run(key)
}
