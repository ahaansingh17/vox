import { randomUUID } from 'crypto'

export const DEFAULT_CONVERSATION_ID = 'main'

function getConversationId(conversationId) {
  if (!conversationId) return DEFAULT_CONVERSATION_ID
  const normalized = String(conversationId).trim()
  if (!normalized) throw new Error('conversationId cannot be an empty string')
  return normalized
}

function normalizeLimit(limit) {
  const parsed = Number.parseInt(limit, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    sortOrder: row.sort_order,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    tokens: row.tokens ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function ensureConversation(db, conversationId = DEFAULT_CONVERSATION_ID) {
  const id = getConversationId(conversationId)
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO conversations (id, created_at, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO NOTHING`
  ).run(id, now, now)

  return db
    .prepare(
      `SELECT id, title, user_info, context_summary, context_checkpoint_id, created_at, updated_at FROM conversations WHERE id = ?`
    )
    .get(id)
}

export function touchConversation(db, conversationId = DEFAULT_CONVERSATION_ID) {
  const id = getConversationId(conversationId)
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO conversations (id, created_at, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`
  ).run(id, now, now)

  return db
    .prepare(
      `SELECT id, title, user_info, context_summary, context_checkpoint_id, created_at, updated_at FROM conversations WHERE id = ?`
    )
    .get(id)
}

export function appendMessage(
  db,
  role,
  content,
  conversationId = DEFAULT_CONVERSATION_ID,
  tokens = null
) {
  const convId = getConversationId(conversationId)
  const msgId = randomUUID()
  const now = new Date().toISOString()
  if (!role) throw new Error('role is required')
  const normalizedRole = String(role).trim()
  if (!normalizedRole) throw new Error('role cannot be empty')
  const normalizedContent = String(content ?? '')

  touchConversation(db, convId)

  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, tokens, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(msgId, convId, normalizedRole, normalizedContent, tokens, now, now)

  return mapRow(
    db
      .prepare(
        `SELECT sort_order, id, conversation_id, role, content, tokens, created_at, updated_at
       FROM messages WHERE id = ?`
      )
      .get(msgId)
  )
}

export function getMessages(db, conversationId = DEFAULT_CONVERSATION_ID, limit) {
  const id = getConversationId(conversationId)
  const normalizedLimit = normalizeLimit(limit)

  if (!normalizedLimit) {
    return db
      .prepare(
        `SELECT sort_order, id, conversation_id, role, content, tokens, created_at, updated_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY sort_order ASC`
      )
      .all(id)
      .map(mapRow)
  }

  return db
    .prepare(
      `SELECT sort_order, id, conversation_id, role, content, tokens, created_at, updated_at
       FROM (
         SELECT sort_order, id, conversation_id, role, content, tokens, created_at, updated_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY sort_order DESC
         LIMIT ?
       )
       ORDER BY sort_order ASC`
    )
    .all(id, normalizedLimit)
    .map(mapRow)
}

export function getMessagesBeforeId(
  db,
  beforeId,
  conversationId = DEFAULT_CONVERSATION_ID,
  limit = 50
) {
  const convId = getConversationId(conversationId)
  const normalizedLimit = normalizeLimit(limit)
  if (!normalizedLimit) throw new Error('limit must be a positive integer')

  if (!beforeId) return []
  const normalizedBeforeId = String(beforeId).trim()
  if (!normalizedBeforeId) return []

  const anchor = db
    .prepare(`SELECT sort_order FROM messages WHERE id = ? AND conversation_id = ?`)
    .get(normalizedBeforeId, convId)

  if (!anchor) return []

  return db
    .prepare(
      `SELECT sort_order, id, conversation_id, role, content, tokens, created_at, updated_at
       FROM (
         SELECT sort_order, id, conversation_id, role, content, tokens, created_at, updated_at
         FROM messages
         WHERE conversation_id = ? AND sort_order < ?
         ORDER BY sort_order DESC
         LIMIT ?
       )
       ORDER BY sort_order ASC`
    )
    .all(convId, anchor.sort_order, normalizedLimit)
    .map(mapRow)
}

export function clearMessages(db, conversationId = DEFAULT_CONVERSATION_ID) {
  const id = getConversationId(conversationId)
  ensureConversation(db, id)
  return db.prepare(`DELETE FROM messages WHERE conversation_id = ?`).run(id)
}

export function saveSummaryCheckpoint(
  db,
  summary,
  checkpointId,
  conversationId = DEFAULT_CONVERSATION_ID
) {
  const id = getConversationId(conversationId)
  ensureConversation(db, id)
  db.prepare(
    `UPDATE conversations SET context_summary = ?, context_checkpoint_id = ?, updated_at = ? WHERE id = ?`
  ).run(summary || null, checkpointId || null, new Date().toISOString(), id)
}

export function loadSummaryCheckpoint(db, conversationId = DEFAULT_CONVERSATION_ID) {
  const id = getConversationId(conversationId)
  const row = db
    .prepare(`SELECT context_summary, context_checkpoint_id FROM conversations WHERE id = ?`)
    .get(id)
  if (!row || !row.context_summary) return null
  return { summary: row.context_summary, checkpointId: row.context_checkpoint_id }
}

export function clearSummaryCheckpoint(db, conversationId = DEFAULT_CONVERSATION_ID) {
  const id = getConversationId(conversationId)
  db.prepare(
    `UPDATE conversations SET context_summary = NULL, context_checkpoint_id = NULL, updated_at = ? WHERE id = ?`
  ).run(new Date().toISOString(), id)
}

export function getConversationUserInfo(db, conversationId = DEFAULT_CONVERSATION_ID) {
  const id = getConversationId(conversationId)
  const row = db.prepare(`SELECT user_info FROM conversations WHERE id = ?`).get(id)
  if (!row) return {}
  try {
    return JSON.parse(row.user_info)
  } catch {
    return {}
  }
}

export function setConversationUserInfo(db, userInfo, conversationId = DEFAULT_CONVERSATION_ID) {
  const id = getConversationId(conversationId)
  ensureConversation(db, id)
  db.prepare(`UPDATE conversations SET user_info = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(userInfo || {}),
    new Date().toISOString(),
    id
  )
}
