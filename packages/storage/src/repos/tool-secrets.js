import { randomUUID } from 'crypto'

export function setToolSecret(db, toolId, key, encryptedValue) {
  const now = new Date().toISOString()
  const id = randomUUID()

  db.prepare(
    `INSERT INTO tool_secrets (id, tool_id, key, encrypted_value, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tool_id, key) DO UPDATE SET
       encrypted_value = excluded.encrypted_value,
       updated_at = excluded.updated_at`
  ).run(id, toolId, key, encryptedValue, now, now)
}

export function getToolSecrets(db, toolId) {
  return db.prepare(`SELECT key, encrypted_value FROM tool_secrets WHERE tool_id = ?`).all(toolId)
}

export function deleteToolSecret(db, toolId, key) {
  return db.prepare(`DELETE FROM tool_secrets WHERE tool_id = ? AND key = ?`).run(toolId, key)
}

export function deleteAllToolSecrets(db, toolId) {
  return db.prepare(`DELETE FROM tool_secrets WHERE tool_id = ?`).run(toolId)
}
