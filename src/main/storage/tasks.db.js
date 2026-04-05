import {
  upsertTask as _upsertTask,
  getTask as _getTask,
  loadTasks as _loadTasks,
  appendTaskActivity as _appendTaskActivity,
  loadTaskActivity as _loadTaskActivity,
  loadAllTaskActivity as _loadAllTaskActivity
} from '@vox-ai-app/storage/tasks'
import {
  insertPattern as _insertPattern,
  searchPatternsFts as _searchPatternsFts
} from '@vox-ai-app/storage/patterns'
import { getDb } from './db.js'
import { vectorUpsert, vectorSearch } from './vectors.db.js'

export const upsertTask = (task) => _upsertTask(getDb(), task)
export const getTask = (id) => _getTask(getDb(), id)
export const loadTasks = () => _loadTasks(getDb())
export const appendTaskActivity = (activity) => _appendTaskActivity(getDb(), activity)
export const loadTaskActivity = (taskId) => _loadTaskActivity(getDb(), taskId)
export const loadAllTaskActivity = () => _loadAllTaskActivity(getDb())

export function getUnreportedTerminalTasks() {
  return getDb()
    .prepare(
      `SELECT id, instructions, status, result, error
       FROM tasks
       WHERE status IN ('completed', 'failed', 'aborted', 'incomplete')
         AND context_injected = 0
       ORDER BY updated_at ASC`
    )
    .all()
    .map((row) => ({
      id: row.id,
      instructions: row.instructions,
      status: row.status,
      result: row.result || '',
      error: row.error || ''
    }))
}

export function markTaskReported(id) {
  getDb().prepare(`UPDATE tasks SET context_injected = 1 WHERE id = ?`).run(String(id))
}

export function searchTasksFts(query) {
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
        `SELECT task_id, instructions, result
         FROM tasks_fts
         WHERE tasks_fts MATCH ?
         ORDER BY bm25(tasks_fts)
         LIMIT 10`
      )
      .all(terms)
      .map((row) => ({
        id: row.task_id,
        instructions: row.instructions,
        result: row.result || ''
      }))
  } catch {
    return []
  }
}

export function insertKnowledgePattern(id, trigger, solution, taskId = null) {
  _insertPattern(getDb(), { id, trigger, solution, taskId })
}

export function searchKnowledgePatterns(query) {
  return _searchPatternsFts(getDb(), query)
}

const TASK_COLLECTION = 'tasks'
const PATTERN_COLLECTION = 'knowledge'
const TASK_THRESHOLD = 0.4
const PATTERN_THRESHOLD = 0.35

async function getEmbed() {
  const mod = await import('../ai/embeddings/embed.js')
  return mod
}

export async function indexTaskEmbedding(id, instructions, result) {
  try {
    const text = `${instructions || ''} ${result || ''}`.trim()
    if (!text) return
    const { embedText } = await getEmbed()
    const embedding = await embedText(text)
    if (!embedding) return
    vectorUpsert(TASK_COLLECTION, id, embedding, {
      id,
      instructions: instructions || '',
      result: (result || '').slice(0, 2000),
      text
    })
  } catch {
    /* best-effort */
  }
}

export async function indexPatternEmbedding(id, trigger, solution) {
  try {
    const text = `${trigger || ''} ${solution || ''}`.trim()
    if (!text) return
    const { embedText } = await getEmbed()
    const embedding = await embedText(text)
    if (!embedding) return
    vectorUpsert(PATTERN_COLLECTION, id, embedding, {
      id,
      trigger: trigger || '',
      solution: solution || '',
      text
    })
  } catch {
    /* best-effort */
  }
}

export async function searchTasksSemantic(query, topK = 5) {
  if (!query?.trim()) return []

  try {
    const { embedText, isEmbeddingReady } = await getEmbed()
    if (!isEmbeddingReady()) return searchTasksFts(query).slice(0, topK)

    const queryEmbedding = await embedText(query)
    if (!queryEmbedding) return searchTasksFts(query).slice(0, topK)

    const results = vectorSearch(TASK_COLLECTION, queryEmbedding, query, topK)
    const filtered = results.filter((r) => r.score >= TASK_THRESHOLD)

    if (filtered.length === 0) return searchTasksFts(query).slice(0, topK)

    return filtered.map((r) => ({
      id: r.metadata?.id || r.id,
      instructions: r.metadata?.instructions || '',
      result: r.metadata?.result || '',
      score: r.score
    }))
  } catch {
    return searchTasksFts(query).slice(0, topK)
  }
}

export async function searchPatternsSemantic(query, topK = 5) {
  if (!query?.trim()) return []

  try {
    const { embedText, isEmbeddingReady } = await getEmbed()
    if (!isEmbeddingReady()) return searchKnowledgePatterns(query).slice(0, topK)

    const queryEmbedding = await embedText(query)
    if (!queryEmbedding) return searchKnowledgePatterns(query).slice(0, topK)

    const results = vectorSearch(PATTERN_COLLECTION, queryEmbedding, query, topK)
    const filtered = results.filter((r) => r.score >= PATTERN_THRESHOLD)

    if (filtered.length === 0) return searchKnowledgePatterns(query).slice(0, topK)

    return filtered.map((r) => ({
      id: r.metadata?.id || r.id,
      trigger: r.metadata?.trigger || '',
      solution: r.metadata?.solution || '',
      score: r.score
    }))
  } catch {
    return searchKnowledgePatterns(query).slice(0, topK)
  }
}
