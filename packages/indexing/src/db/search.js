import path from 'node:path'
import {
  KNOWLEDGE_SEARCH_DEFAULT_PAGE_SIZE,
  KNOWLEDGE_SEARCH_MAX_PAGE_SIZE
} from '../runtime/core/constants.js'
import { chunkKnowledgeText, hashKnowledgeText } from '../ingest/chunk.js'
import {
  dbClearKnowledge,
  dbCountKnowledgeMatches,
  dbDeleteKnowledgeDocuments,
  dbGetKnowledgeDocument,
  dbReplaceKnowledgeDocument,
  dbSearchKnowledge,
  dbTouchKnowledgeDocument,
  openKnowledgeDb
} from './db.js'
const buildKnowledgeMatchQuery = (query) => {
  const tokens = String(query || '')
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/["*^:]/g, '').trim())
    .filter(Boolean)
    .filter((token) => !/^(AND|OR|NOT|NEAR)$/i.test(token))
  if (!tokens.length) {
    return ''
  }
  return tokens.map((token) => `"${token}"*`).join(' ')
}
const upsertKnowledgeDocument = async ({ path: filePath, folderPath, fileStats, text, kind }) => {
  await openKnowledgeDb()
  const normalizedText = String(text || '').trim()
  const contentHash = hashKnowledgeText(normalizedText)
  const indexedAt = new Date().toISOString()
  const document = {
    path: filePath,
    folderPath,
    kind,
    size: Number(fileStats.size),
    mtimeMs: Number(fileStats.mtimeMs),
    indexedAt,
    contentHash
  }
  const existingDocument = dbGetKnowledgeDocument(filePath)
  if (existingDocument?.content_hash === contentHash) {
    dbTouchKnowledgeDocument({
      ...document,
      chunkCount: Number(existingDocument.chunk_count || 0)
    })
    return {
      path: filePath,
      chunkCount: Number(existingDocument.chunk_count || 0)
    }
  }
  const chunks = chunkKnowledgeText(normalizedText).map((chunkText, index) => ({
    id: hashKnowledgeText(`${filePath}:${contentHash}:${index}`),
    path: filePath,
    ordinal: index,
    text: chunkText,
    charCount: chunkText.length
  }))
  dbReplaceKnowledgeDocument(document, chunks)
  return {
    path: filePath,
    chunkCount: chunks.length
  }
}
export const upsertKnowledgeTextDocument = async (payload) => {
  return upsertKnowledgeDocument({
    ...payload,
    kind: 'text'
  })
}
export const removeKnowledgeDocuments = async (paths) => {
  await openKnowledgeDb()
  const normalizedPaths = [
    ...new Set(paths.map((filePath) => String(filePath || '').trim()).filter(Boolean))
  ]
  if (!normalizedPaths.length) {
    return {
      removedCount: 0
    }
  }
  dbDeleteKnowledgeDocuments(normalizedPaths)
  return {
    removedCount: normalizedPaths.length
  }
}
export const clearKnowledgeStore = async () => {
  await openKnowledgeDb()
  dbClearKnowledge()
}
export const searchIndexedContextForTool = async (payload = {}) => {
  await openKnowledgeDb()
  const query = String(payload?.query || '').trim()
  if (!query) {
    throw new Error('Query is required.')
  }
  const page = Math.max(1, Number(payload?.page || 1))
  const pageSize = Math.min(
    KNOWLEDGE_SEARCH_MAX_PAGE_SIZE,
    Math.max(1, Number(payload?.pageSize || KNOWLEDGE_SEARCH_DEFAULT_PAGE_SIZE))
  )
  const prefix = String(payload?.prefix || '').trim()
  const normalizedPrefix = prefix ? path.resolve(prefix) : ''
  const matchQuery = buildKnowledgeMatchQuery(query)
  if (!matchQuery) {
    return {
      page,
      pageSize,
      total: 0,
      query,
      results: []
    }
  }
  const offset = (page - 1) * pageSize
  const total = dbCountKnowledgeMatches(matchQuery, normalizedPrefix)
  const rows = dbSearchKnowledge(matchQuery, {
    normalizedPrefix,
    limit: pageSize,
    offset
  })
  return {
    page,
    pageSize,
    total,
    query,
    results: rows.map((row) => ({
      chunkId: row.chunk_id,
      path: row.path,
      ordinal: Number(row.ordinal || 0),
      score: Number.isFinite(Number(row.rank)) ? Math.abs(Number(row.rank)) : null,
      snippet: String(row.snippet || row.text || '').trim()
    }))
  }
}
