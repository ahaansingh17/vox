import { getKnowledgeDb, indexingDbState } from './prepared.js'
export const dbGetKnowledgeDocument = (filePath) =>
  indexingDbState.documents.get.get(filePath) || null
export const dbTouchKnowledgeDocument = ({
  path,
  folderPath,
  kind,
  size,
  mtimeMs,
  indexedAt,
  contentHash,
  chunkCount
}) => {
  const knowledgeDb = getKnowledgeDb()
  knowledgeDb.transaction(() => {
    indexingDbState.entries.upsert.run(path, folderPath, kind, size, mtimeMs, indexedAt)
    indexingDbState.documents.upsert.run(path, chunkCount, contentHash)
  })()
}
export const dbReplaceKnowledgeDocument = (document, chunks) => {
  const knowledgeDb = getKnowledgeDb()
  knowledgeDb.transaction(() => {
    indexingDbState.documents.deleteFtsByPath.run(document.path)
    indexingDbState.documents.deleteChunksByPath.run(document.path)
    indexingDbState.documents.delete.run(document.path)
    indexingDbState.entries.upsert.run(
      document.path,
      document.folderPath,
      document.kind,
      document.size,
      document.mtimeMs,
      document.indexedAt
    )
    indexingDbState.documents.upsert.run(document.path, chunks.length, document.contentHash)
    for (const chunk of chunks) {
      indexingDbState.documents.insertChunk.run(
        chunk.id,
        chunk.path,
        chunk.ordinal,
        chunk.text,
        chunk.charCount
      )
      indexingDbState.documents.insertFts.run(chunk.id, chunk.path, chunk.text)
    }
  })()
}
export const dbDeleteKnowledgeDocuments = (paths) => {
  const knowledgeDb = getKnowledgeDb()
  knowledgeDb.transaction(() => {
    for (const filePath of paths) {
      indexingDbState.documents.deleteFtsByPath.run(filePath)
      indexingDbState.documents.deleteChunksByPath.run(filePath)
      indexingDbState.documents.delete.run(filePath)
      indexingDbState.entries.delete.run(filePath)
    }
  })()
}
export const dbClearKnowledge = () => {
  getKnowledgeDb().exec('DELETE FROM chunks_fts; DELETE FROM chunks; DELETE FROM documents;')
}
export const dbCountKnowledgeMatches = (matchQuery, normalizedPrefix = '') => {
  const sql = `
    SELECT COUNT(*) AS total
    FROM chunks_fts
    JOIN chunks ON chunks.id = chunks_fts.chunk_id
    JOIN entries ON entries.path = chunks.path
    WHERE chunks_fts MATCH ?
      ${normalizedPrefix ? 'AND chunks.path LIKE ?' : ''}
  `
  const params = normalizedPrefix ? [matchQuery, `${normalizedPrefix}%`] : [matchQuery]
  const row = getKnowledgeDb()
    .prepare(sql)
    .get(...params)
  return Number(row?.total || 0)
}
export const dbSearchKnowledge = (matchQuery, { normalizedPrefix = '', limit, offset }) => {
  const sql = `
    SELECT
      chunks.id AS chunk_id,
      chunks.path AS path,
      chunks.ordinal AS ordinal,
      chunks.text AS text,
      snippet(chunks_fts, 2, '<<', '>>', ' ... ', 24) AS snippet,
      bm25(chunks_fts) AS rank
    FROM chunks_fts
    JOIN chunks ON chunks.id = chunks_fts.chunk_id
    JOIN entries ON entries.path = chunks.path
    WHERE chunks_fts MATCH ?
      ${normalizedPrefix ? 'AND chunks.path LIKE ?' : ''}
    ORDER BY rank
    LIMIT ?
    OFFSET ?
  `
  const params = normalizedPrefix
    ? [matchQuery, `${normalizedPrefix}%`, limit, offset]
    : [matchQuery, limit, offset]
  return getKnowledgeDb()
    .prepare(sql)
    .all(...params)
}
