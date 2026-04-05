export function normalizeLimit(limit, fallback = 50) {
  const parsed = Number.parseInt(limit, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function buildTaskObject(taskMeta, taskId) {
  const meta = taskMeta.get(taskId)
  if (!meta) return null
  const ts = new Date(meta.createdAt).toISOString()
  return {
    taskId,
    status: meta.status,
    completedCount: 0,
    currentPlan: meta.currentPlan || '',
    error: meta.error || '',
    resultPreview: meta.result ? String(meta.result).slice(0, 200) : '',
    spawnRequestedAt: ts,
    spawnedAt: ts,
    startedAt: ts,
    completedAt: meta.completedAt || '',
    spawnInstructions: meta.instructions,
    instructions: meta.instructions,
    spawnContext: meta.context || '',
    spawnArgsPreview: '',
    history: [],
    updatedAt: meta.updatedAt || ts
  }
}

export function buildTaskStatusResponse(task) {
  if (!task) return null

  return {
    id: task.taskId,
    taskId: task.taskId,
    status: task.status,
    instructions: task.instructions || task.spawnInstructions || '',
    result: task.resultPreview || '',
    created_at: task.spawnedAt || new Date().toISOString(),
    completed_at: task.completedAt || '',
    error: task.error || '',
    abort_reason: task.error || '',
    steps: [],
    current_plan: task.currentPlan || ''
  }
}

export function buildHistoryTask(task) {
  return {
    id: task.taskId,
    status: task.status,
    instructions: task.instructions || task.spawnInstructions || '',
    created_at: task.spawnedAt || new Date().toISOString(),
    completed_at: task.completedAt || '',
    current_plan: task.currentPlan || ''
  }
}

const VALID_ACTIVITY_TYPES = new Set([
  'tool_call',
  'tool_result',
  'text',
  'thought',
  'journal',
  'spawn',
  'error'
])

export function buildActivityEvent(taskId, event) {
  const type = event.type === 'journal_update' ? 'journal' : event.type
  if (!VALID_ACTIVITY_TYPES.has(type)) {
    throw new Error(`Unknown task activity type: "${event.type}"`)
  }

  const journal = event.journal
  let plan = null
  if (journal && typeof journal.currentPlan === 'string') plan = journal.currentPlan

  let result = null
  if (event.type === 'tool_result' && event.result !== undefined) result = event.result

  let data = { taskId, ...event }
  if (event.type === 'journal_update' && journal) {
    data = {
      taskId,
      understanding: journal.understanding,
      currentPlan: journal.currentPlan,
      completed: journal.completed,
      blockers: journal.blockers,
      discoveries: journal.discoveries,
      done: journal.done === true,
      doneReason: journal.doneReason
    }
  }

  return {
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    taskId,
    type,
    name: event.name,
    args: event.type === 'tool_call' ? JSON.stringify(event.args) : null,
    result,
    plan,
    createdAt: new Date().toISOString(),
    data
  }
}
