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
    message: meta.message || '',
    resultPreview: meta.result ? String(meta.result).slice(0, 200) : '',
    spawnRequestedAt: ts,
    spawnedAt: ts,
    startedAt: ts,
    completedAt: meta.completedAt || '',
    failedAt: meta.failedAt || '',
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
    completed_at: task.completedAt || task.failedAt || '',
    error: task.message || '',
    abort_reason: task.message || '',
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
    completed_at: task.completedAt || task.failedAt || '',
    current_plan: task.currentPlan || ''
  }
}

export function buildActivityEvent(taskId, event) {
  return {
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    taskId,
    type: event.type,
    name: event.name,
    rawResult: event.type === 'tool_result' ? event.result || null : null,
    timestamp: new Date().toISOString(),
    data: { taskId, ...event }
  }
}
