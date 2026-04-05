function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function stringifyJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback
  try {
    return JSON.stringify(value)
  } catch {
    return fallback
  }
}

function mapTask(row) {
  if (!row) return null
  return {
    id: row.id,
    instructions: row.instructions,
    context: row.context,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentPlan: row.current_plan,
    result: row.result,
    error: row.error || null,
    abortReason: row.abort_reason || null,
    provider: row.provider || null,
    model: row.model || null,
    contextInjected: !!row.context_injected,
    completedAt: row.completed_at || null
  }
}

function mapActivity(row) {
  if (!row) return null
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type,
    name: row.name || null,
    args: parseJson(row.args, row.args),
    result: parseJson(row.result, row.result),
    plan: row.plan || null,
    createdAt: row.created_at,
    data: parseJson(row.data, {})
  }
}

export function upsertTask(db, task) {
  const id = String(task?.id || '').trim()
  if (!id) throw new Error('task id is required.')

  const createdAt = String(task?.createdAt || new Date().toISOString())
  const updatedAt = String(task?.updatedAt || new Date().toISOString())

  db.prepare(
    `INSERT INTO tasks (
      id, instructions, context, status, created_at, updated_at,
      current_plan, result, error, abort_reason, provider, model,
      context_injected, completed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      instructions = excluded.instructions,
      context = excluded.context,
      status = excluded.status,
      updated_at = excluded.updated_at,
      current_plan = excluded.current_plan,
      result = excluded.result,
      error = excluded.error,
      abort_reason = excluded.abort_reason,
      provider = excluded.provider,
      model = excluded.model,
      context_injected = excluded.context_injected,
      completed_at = excluded.completed_at`
  ).run(
    id,
    String(task?.instructions || ''),
    String(task?.context || ''),
    String(task?.status || 'queued'),
    createdAt,
    updatedAt,
    String(task?.currentPlan || ''),
    task?.result == null ? null : String(task.result),
    task?.error == null ? null : String(task.error),
    task?.abortReason == null ? null : String(task.abortReason),
    task?.provider == null ? null : String(task.provider),
    task?.model == null ? null : String(task.model),
    task?.contextInjected ? 1 : 0,
    task?.completedAt == null ? null : String(task.completedAt)
  )

  return getTask(db, id)
}

export function getTask(db, id) {
  return mapTask(
    db
      .prepare(
        `SELECT id, instructions, context, status, created_at, updated_at,
              current_plan, result, error, abort_reason, provider, model,
              context_injected, completed_at
       FROM tasks WHERE id = ?`
      )
      .get(String(id || '').trim())
  )
}

export function loadTasks(db) {
  return db
    .prepare(
      `SELECT id, instructions, context, status, created_at, updated_at,
              current_plan, result, error, abort_reason, provider, model,
              context_injected, completed_at
       FROM tasks
       ORDER BY created_at DESC, id DESC`
    )
    .all()
    .map(mapTask)
}

export function appendTaskActivity(db, activity) {
  const id = String(activity?.id ?? '').trim()
  const taskId = String(activity?.taskId ?? '').trim()
  if (!id || !taskId) throw new Error('Task activity requires id and taskId.')

  const VALID_TYPES = new Set([
    'tool_call',
    'tool_result',
    'text',
    'thought',
    'journal',
    'spawn',
    'error'
  ])
  const type = String(activity?.type ?? '')
  if (!VALID_TYPES.has(type)) throw new Error(`Invalid task activity type: "${type}"`)

  db.prepare(
    `INSERT INTO task_activity (id, task_id, type, name, args, result, plan, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       task_id = excluded.task_id,
       type = excluded.type,
       name = excluded.name,
       args = excluded.args,
       result = excluded.result,
       plan = excluded.plan,
       data = excluded.data,
       created_at = excluded.created_at`
  ).run(
    id,
    taskId,
    type,
    activity?.name ? String(activity.name) : null,
    activity?.args ? String(activity.args) : null,
    stringifyJson(
      activity?.result,
      activity?.result === undefined ? null : String(activity.result)
    ),
    activity?.plan ? String(activity.plan) : null,
    stringifyJson(activity?.data ?? {}, '{}'),
    String(activity?.createdAt ?? new Date().toISOString())
  )

  return id
}

export function loadTaskActivity(db, taskId) {
  return db
    .prepare(
      `SELECT id, task_id, type, name, args, result, plan, data, created_at
       FROM task_activity
       WHERE task_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(String(taskId || '').trim())
    .map(mapActivity)
}

export function loadAllTaskActivity(db) {
  return db
    .prepare(
      `SELECT id, task_id, type, name, args, result, plan, data, created_at
       FROM task_activity
       ORDER BY created_at ASC, id ASC`
    )
    .all()
    .map(mapActivity)
}
