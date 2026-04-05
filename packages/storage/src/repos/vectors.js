export function vectorUpsert(db, collection, id, embedding, metadata = {}) {
  const buffer = Buffer.from(new Float32Array(embedding).buffer)
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO vectors (id, collection, embedding, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id, collection)
     DO UPDATE SET embedding = excluded.embedding, metadata = excluded.metadata, updated_at = excluded.updated_at`
  ).run(id, collection, buffer, JSON.stringify(metadata), now, now)
}

export function vectorSearch(db, collection, queryEmbedding, queryText, topK = 5) {
  const rows = db
    .prepare(`SELECT id, embedding, metadata FROM vectors WHERE collection = ?`)
    .all(collection)

  if (rows.length === 0) return []

  const candidates = rows.map((row) => {
    const stored = new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / 4
    )
    const meta = JSON.parse(row.metadata)
    return {
      id: row.id,
      metadata: meta,
      score: cosineSimilarity(queryEmbedding, stored)
    }
  })

  const candidateLimit = Math.max(topK * 5, topK)
  candidates.sort((a, b) => b.score - a.score)
  const topCandidates = candidates.slice(0, candidateLimit)

  if (!queryText) return topCandidates.slice(0, topK)
  return rerankRows(topCandidates, queryText, topK)
}

export function vectorRemove(db, collection, id) {
  db.prepare(`DELETE FROM vectors WHERE collection = ? AND id = ?`).run(collection, id)
}

export function vectorCount(db, collection) {
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM vectors WHERE collection = ?`).get(collection)
  return row?.cnt || 0
}

function cosineSimilarity(a, b) {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

function tokenize(value) {
  if (typeof value !== 'string') return []
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/gu)
    .filter(Boolean)
}

function lexicalScore(queryText, candidateText) {
  const queryTokens = new Set(tokenize(queryText))
  if (queryTokens.size === 0) return 0
  const candidateTokens = new Set(tokenize(candidateText))
  if (candidateTokens.size === 0) return 0
  let overlap = 0
  for (const t of queryTokens) {
    if (candidateTokens.has(t)) overlap++
  }
  return overlap / Math.sqrt(queryTokens.size * candidateTokens.size)
}

function rerankRows(rows, queryText, topK) {
  const VECTOR_WEIGHT = 0.6
  const LEXICAL_WEIGHT = 0.3
  const PHRASE_BOOST = 0.1
  const normalizedQuery = String(queryText || '')
    .toLowerCase()
    .trim()

  return rows
    .map((row) => {
      const text = row.metadata?.text || row.metadata?.instructions || ''
      const lexical = lexicalScore(queryText, text)
      const vector = Math.max(0, row.score || 0)
      const phraseMatch = normalizedQuery.length > 0 && text.toLowerCase().includes(normalizedQuery)
      return {
        ...row,
        score: VECTOR_WEIGHT * vector + LEXICAL_WEIGHT * lexical + (phraseMatch ? PHRASE_BOOST : 0)
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}
