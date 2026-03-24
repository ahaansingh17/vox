import Database from 'better-sqlite3'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import {
  dbCountKnowledgeMatches,
  dbClearKnowledge,
  dbDeleteKnowledgeDocuments,
  dbGetKnowledgeDocument,
  dbReplaceKnowledgeDocument,
  dbSearchKnowledge,
  dbTouchKnowledgeDocument
} from './documents.js'
import {
  dbClearEntriesAndPendingDeletes,
  dbDeleteEntries,
  dbDeletePendings,
  dbGetEntry,
  dbKvDelete,
  dbKvGet,
  dbKvSet,
  dbLoadAllEntries,
  dbLoadAllPendingDeletes,
  dbLoadEntriesByPathPrefix,
  dbLoadEntryPathsByFolder,
  dbLoadEntryPathsByPathPrefix,
  dbLoadPendingDeletePathsByFolder,
  dbUpsertPending
} from './entries.js'
import { prepareKnowledgeDb } from './schema.js'
import { indexingDbState, resetKnowledgeDbState } from './state.js'
const resolveKnowledgeDbDirectory = () => {
  const userDataPath = String(process.env.VOX_USER_DATA_PATH || '').trim()
  if (!userDataPath) {
    throw new Error('VOX_USER_DATA_PATH is required before opening the knowledge DB.')
  }
  return userDataPath
}
export const openKnowledgeDb = async () => {
  if (indexingDbState.db) return
  const dir = resolveKnowledgeDbDirectory()
  await mkdir(dir, {
    recursive: true
  })
  indexingDbState.db = new Database(path.join(dir, 'knowledge-index.db'))
  prepareKnowledgeDb()
}
export const closeKnowledgeDb = () => {
  if (!indexingDbState.db) return
  indexingDbState.db.close()
  resetKnowledgeDbState()
}
export {
  dbClearEntriesAndPendingDeletes,
  dbCountKnowledgeMatches,
  dbDeleteEntries,
  dbDeleteKnowledgeDocuments,
  dbDeletePendings,
  dbGetEntry,
  dbGetKnowledgeDocument,
  dbKvDelete,
  dbKvGet,
  dbKvSet,
  dbLoadAllEntries,
  dbLoadAllPendingDeletes,
  dbLoadEntriesByPathPrefix,
  dbLoadEntryPathsByFolder,
  dbLoadEntryPathsByPathPrefix,
  dbLoadPendingDeletePathsByFolder,
  dbReplaceKnowledgeDocument,
  dbSearchKnowledge,
  dbTouchKnowledgeDocument,
  dbUpsertPending,
  dbClearKnowledge
}
