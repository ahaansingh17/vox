import {
  ensureConversation as _ensureConversation,
  touchConversation as _touchConversation,
  appendMessage as _appendMessage,
  getMessages as _getMessages,
  getMessagesBeforeId as _getMessagesBeforeId,
  clearMessages as _clearMessages,
  saveSummaryCheckpoint as _saveSummaryCheckpoint,
  loadSummaryCheckpoint as _loadSummaryCheckpoint,
  clearSummaryCheckpoint as _clearSummaryCheckpoint,
  getConversationUserInfo as _getConversationUserInfo,
  setConversationUserInfo as _setConversationUserInfo
} from '@vox-ai-app/storage/messages'
import { getDb } from './db.js'
import { vectorUpsert, vectorSearch } from './vectors.db.js'

export const ensureConversation = (id) => _ensureConversation(getDb(), id)
export const touchConversation = (id) => _touchConversation(getDb(), id)
export const appendMessage = (role, content, conversationId) =>
  _appendMessage(getDb(), role, content, conversationId)
export const getMessages = (conversationId, limit) => _getMessages(getDb(), conversationId, limit)
export const getMessagesBeforeId = (beforeId, conversationId, limit) =>
  _getMessagesBeforeId(getDb(), beforeId, conversationId, limit)
export const clearMessages = (conversationId) => _clearMessages(getDb(), conversationId)
export const saveSummaryCheckpoint = (summary, checkpointId, conversationId) =>
  _saveSummaryCheckpoint(getDb(), summary, checkpointId, conversationId)
export const loadSummaryCheckpoint = (conversationId) =>
  _loadSummaryCheckpoint(getDb(), conversationId)
export const clearSummaryCheckpoint = (conversationId) =>
  _clearSummaryCheckpoint(getDb(), conversationId)
export const getConversationUserInfo = (conversationId) =>
  _getConversationUserInfo(getDb(), conversationId)
export const setConversationUserInfo = (userInfo, conversationId) =>
  _setConversationUserInfo(getDb(), userInfo, conversationId)

const MESSAGE_COLLECTION = 'messages'
const MESSAGE_THRESHOLD = 0.35

export function searchMessagesFts(query, topK = 10) {
  if (!query?.trim()) return []
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '')}"`)
    .join(' ')
  try {
    return getDb()
      .prepare(
        `SELECT f.message_id, f.role, f.content,
                m.created_at
         FROM messages_fts f
         JOIN messages m ON m.id = f.message_id
         WHERE messages_fts MATCH ?
         ORDER BY bm25(messages_fts)
         LIMIT ?`
      )
      .all(terms, topK)
      .map((row) => ({
        id: row.message_id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at
      }))
  } catch {
    return []
  }
}

export async function indexMessageEmbedding(messageId, role, content) {
  try {
    if (!content?.trim() || content.length < 20) return
    const { embedText } = await import('../ai/embeddings/embed.js')
    const embedding = await embedText(content)
    if (!embedding) return
    vectorUpsert(MESSAGE_COLLECTION, messageId, embedding, {
      id: messageId,
      role: role || '',
      content: content.slice(0, 2000),
      text: content.slice(0, 2000)
    })
  } catch {
    /* best-effort */
  }
}

export async function searchMessagesSemantic(query, topK = 10) {
  if (!query?.trim()) return []

  try {
    const { embedText, isEmbeddingReady } = await import('../ai/embeddings/embed.js')
    if (!isEmbeddingReady()) return searchMessagesFts(query, topK)

    const queryEmbedding = await embedText(query)
    if (!queryEmbedding) return searchMessagesFts(query, topK)

    const results = vectorSearch(MESSAGE_COLLECTION, queryEmbedding, query, topK)
    const filtered = results.filter((r) => r.score >= MESSAGE_THRESHOLD)

    if (filtered.length === 0) return searchMessagesFts(query, topK)

    return filtered.map((r) => ({
      id: r.metadata?.id || r.id,
      role: r.metadata?.role || '',
      content: r.metadata?.content || '',
      score: r.score
    }))
  } catch {
    return searchMessagesFts(query, topK)
  }
}
