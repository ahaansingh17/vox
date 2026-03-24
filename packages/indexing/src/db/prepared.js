import path from 'node:path'
export const indexingDbState = {
  db: null,
  entries: {},
  pendingDeletes: {},
  kv: {},
  documents: {}
}
export const getKnowledgeDb = () => {
  if (!indexingDbState.db) {
    throw new Error('Knowledge DB is not open.')
  }
  return indexingDbState.db
}
export const resetKnowledgeDbState = () => {
  indexingDbState.db = null
  indexingDbState.entries = {}
  indexingDbState.pendingDeletes = {}
  indexingDbState.kv = {}
  indexingDbState.documents = {}
}
export const buildPathPrefixPattern = (basePath) =>
  `${basePath}${basePath.endsWith(path.sep) ? '' : path.sep}%`
