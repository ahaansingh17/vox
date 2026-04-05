import { randomUUID } from 'crypto'

function mapPattern(row) {
  if (!row) return null
  return {
    id: row.id,
    taskId: row.task_id || null,
    trigger: row.trigger,
    solution: row.solution,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function insertPattern(db, pattern) {
  const id = pattern.id || randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT OR REPLACE INTO knowledge_patterns (id, task_id, trigger, solution, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, pattern.taskId || null, String(pattern.trigger), String(pattern.solution), now, now)

  return getPattern(db, id)
}

export function getPattern(db, id) {
  return mapPattern(db.prepare(`SELECT * FROM knowledge_patterns WHERE id = ?`).get(id))
}

export function searchPatternsFts(db, query) {
  if (!query?.trim()) return []
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '')}"`)
    .join(' ')
  try {
    return db
      .prepare(
        `SELECT p.id, p.task_id, p.trigger, p.solution, p.created_at, p.updated_at
         FROM patterns_fts f
         JOIN knowledge_patterns p ON p.id = f.pattern_id
         WHERE f.patterns_fts MATCH ?
         ORDER BY bm25(f.patterns_fts)
         LIMIT 5`
      )
      .all(terms)
      .map(mapPattern)
  } catch {
    return []
  }
}
