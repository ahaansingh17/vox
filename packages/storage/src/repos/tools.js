import { randomUUID } from 'crypto'

function mapTool(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    parameters: JSON.parse(row.parameters),
    sourceType: row.source_type,
    sourceCode: row.source_code || null,
    webhookUrl: row.webhook_url || null,
    webhookHeaders: JSON.parse(row.webhook_headers),
    isEnabled: !!row.is_enabled,
    tags: JSON.parse(row.tags),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function createTool(db, tool) {
  const id = tool.id || randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO tools (id, name, description, parameters, source_type, source_code,
      webhook_url, webhook_headers, is_enabled, tags, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    String(tool.name),
    String(tool.description || ''),
    JSON.stringify(tool.parameters || { type: 'object', properties: {} }),
    String(tool.sourceType || 'js_function'),
    tool.sourceCode || null,
    tool.webhookUrl || null,
    JSON.stringify(tool.webhookHeaders || {}),
    tool.isEnabled === false ? 0 : 1,
    JSON.stringify(tool.tags || []),
    tool.version || 1,
    now,
    now
  )

  return getTool(db, id)
}

export function updateTool(db, id, updates) {
  const existing = getTool(db, id)
  if (!existing) return null

  const now = new Date().toISOString()
  const merged = { ...existing, ...updates, updatedAt: now }

  db.prepare(
    `UPDATE tools SET name = ?, description = ?, parameters = ?, source_type = ?,
      source_code = ?, webhook_url = ?, webhook_headers = ?, is_enabled = ?,
      tags = ?, version = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    String(merged.name),
    String(merged.description || ''),
    JSON.stringify(merged.parameters || { type: 'object', properties: {} }),
    String(merged.sourceType || 'js_function'),
    merged.sourceCode || null,
    merged.webhookUrl || null,
    JSON.stringify(merged.webhookHeaders || {}),
    merged.isEnabled === false ? 0 : 1,
    JSON.stringify(merged.tags || []),
    merged.version || 1,
    now,
    id
  )

  return getTool(db, id)
}

export function deleteTool(db, id) {
  return db.prepare(`DELETE FROM tools WHERE id = ?`).run(id)
}

export function getTool(db, id) {
  return mapTool(db.prepare(`SELECT * FROM tools WHERE id = ?`).get(id))
}

export function getToolByName(db, name) {
  return mapTool(db.prepare(`SELECT * FROM tools WHERE name = ?`).get(name))
}

export function listTools(db, enabledOnly = false) {
  if (enabledOnly) {
    return db.prepare(`SELECT * FROM tools WHERE is_enabled = 1`).all().map(mapTool)
  }
  return db.prepare(`SELECT * FROM tools ORDER BY name ASC`).all().map(mapTool)
}

export function upsertTool(db, tool) {
  const existing = tool.id ? getTool(db, tool.id) : getToolByName(db, tool.name)
  if (existing) {
    return updateTool(db, existing.id, tool)
  }
  return createTool(db, tool)
}
