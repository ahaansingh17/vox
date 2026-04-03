import { randomUUID } from 'crypto'

export const DEFAULT_CONVERSATION_ID = 'main'

function getConversationId(conversationId) {
  const normalized = String(conversationId || '').trim()
  return normalized || DEFAULT_CONVERSATION_ID
}

function normalizeLimit(limit) {
  const parsed = Number.parseInt(limit, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeBeforeId(beforeId) {
  if (!beforeId) return null
  return String(beforeId).trim() || null
}

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  }
}

export function ensureConversation(db, conversationId = DEFAULT_CONVERSATION_ID) {
  const id = getConversationId(conversationId)
  const now = new Date().toISOString()

  db.prepare(
    `
    INSERT INTO conversations (id, created_at, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `
  ).run(id, now, now)

  return db
    .prepare(
      `
    SELECT id, created_at, updated_at
    FROM conversations
    WHERE id = ?
  `
    )
    .get(id)
}

export function touchConversation(db, conversationId = DEFAULT_CONVERSATION_ID) {
  const id = getConversationId(conversationId)
  const now = new Date().toISOString()

  db.prepare(
    `
    INSERT INTO conversations (id, created_at, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
  `
  ).run(id, now, now)

  return db
    .prepare(
      `
    SELECT id, created_at, updated_at
    FROM conversations
    WHERE id = ?
  `
    )
    .get(id)
}

export function appendMessage(db, role, content, conversationId = DEFAULT_CONVERSATION_ID) {
  const convId = getConversationId(conversationId)
  const msgId = randomUUID()
  const now = new Date().toISOString()
  const normalizedRole = String(role || '').trim() || 'user'
  const normalizedContent = String(content ?? '')

  touchConversation(db, convId)

  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(msgId, convId, normalizedRole, normalizedContent, now)

  return mapRow(
    db
      .prepare(
        `SELECT id, conversation_id, role, content, created_at
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
        `SELECT id, conversation_id, role, content, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC, id ASC`
      )
      .all(id)
      .map(mapRow)
  }

  return db
    .prepare(
      `SELECT id, conversation_id, role, content, created_at
       FROM (
         SELECT id, conversation_id, role, content, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?
       )
       ORDER BY created_at ASC, id ASC`
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
  const normalizedBeforeId = normalizeBeforeId(beforeId)
  const normalizedLimit = normalizeLimit(limit) || 50

  if (!normalizedBeforeId) {
    return []
  }

  const anchor = db
    .prepare(`SELECT created_at, id FROM messages WHERE id = ? AND conversation_id = ?`)
    .get(normalizedBeforeId, convId)

  if (!anchor) return []

  return db
    .prepare(
      `SELECT id, conversation_id, role, content, created_at
       FROM (
         SELECT id, conversation_id, role, content, created_at
         FROM messages
         WHERE conversation_id = ?
           AND (created_at < ? OR (created_at = ? AND id < ?))
         ORDER BY created_at DESC, id DESC
         LIMIT ?
       )
       ORDER BY created_at ASC, id ASC`
    )
    .all(convId, anchor.created_at, anchor.created_at, anchor.id, normalizedLimit)
    .map(mapRow)
}

export function clearMessages(db, conversationId = DEFAULT_CONVERSATION_ID) {
  const id = getConversationId(conversationId)
  ensureConversation(db, id)
  return db
    .prepare(
      `
    DELETE FROM messages
    WHERE conversation_id = ?
  `
    )
    .run(id)
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
  ).run(summary, checkpointId, new Date().toISOString(), id)
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
