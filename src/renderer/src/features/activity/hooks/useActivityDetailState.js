import { useMemo } from 'react'
import { useTaskDetail } from './useTaskDetail'
import {
  elapsedLabel,
  mergeSteps,
  computeEffectiveStatus,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL
} from '../utils/task.utils'

function getLatestThought(taskEvents, isRunning) {
  if (!isRunning) return ''
  return String(
    taskEvents.findLast((event) => event.type === 'agent.thinking')?.data?.thought || ''
  ).trim()
}

function normalizeEvent(e) {
  let name = ''
  if (typeof e.name === 'string') name = e.name
  else if (typeof e.data.name === 'string') name = e.data.name

  let plan = ''
  if (typeof e.plan === 'string') plan = e.plan
  else if (typeof e.data.plan === 'string') plan = e.data.plan

  return {
    id: e.id,
    taskId: e.taskId,
    type: e.type,
    name,
    createdAt: e.createdAt,
    result: e.result,
    plan,
    done: e.data.done === true,
    data: e.data
  }
}

function getExitCode(resultEvent) {
  if (resultEvent == null) return undefined
  const r = resultEvent.result
  if (r == null || typeof r !== 'object') return undefined
  return r.exitCode
}

function buildTimeline(taskEvents) {
  if (taskEvents.length === 0) return []

  const normalized = taskEvents.map(normalizeEvent)
  const calls = normalized.filter((e) => e.type === 'tool_call' || e.type === 'task.request')
  const results = normalized.filter((e) => e.type === 'tool_result')
  const journals = normalized.filter((e) => e.type === 'journal')

  const usedResultIds = new Set()
  const raw = []

  for (const call of calls) {
    const matched = results.find((r) => !usedResultIds.has(r.id) && r.name === call.name)
    if (matched) usedResultIds.add(matched.id)

    raw.push({
      call,
      result: matched,
      repeatCount: 1,
      at: call.createdAt
    })
  }

  for (const j of journals) {
    const d = j.data
    raw.push({
      call: {
        name: 'update_journal',
        type: 'tool_call',
        args: {
          understanding: d.understanding,
          currentPlan: d.currentPlan,
          completed: d.completed,
          blockers: d.blockers,
          discoveries: d.discoveries,
          done: d.done === true,
          doneReason: d.doneReason
        },
        data: d
      },
      result: null,
      at: j.createdAt,
      repeatCount: 1
    })
  }

  raw.sort((a, b) => a.at.localeCompare(b.at))

  const items = []
  for (const entry of raw) {
    const last = items.length > 0 ? items[items.length - 1] : null
    if (last !== null && entry.call.name === last.call.name) {
      const exitCode = getExitCode(entry.result)
      const isFailing = exitCode !== undefined && exitCode !== 0
      const lastExitCode = getExitCode(last.result)
      const lastFailing = lastExitCode !== undefined && lastExitCode !== 0

      if (entry.call.name === 'update_journal') {
        const entryPlan = entry.call.args.currentPlan
        const lastPlan = last.call.args.currentPlan
        if (entryPlan === lastPlan) {
          last.repeatCount += 1
          continue
        }
      } else if (isFailing && lastFailing) {
        last.repeatCount += 1
        last.call = entry.call
        last.result = entry.result
        continue
      }
    }

    items.push(entry)
  }

  return items
}

export function useActivityDetailState({ taskId, liveTask, taskEvents }) {
  const { fetched, loading, error } = useTaskDetail(taskId, liveTask?.status)

  const dbTask = fetched
  const rawStatus = liveTask?.status || dbTask?.status || 'running'
  const effectiveStatus = computeEffectiveStatus(rawStatus, dbTask)
  const isRunning = effectiveStatus === 'running' || effectiveStatus === 'spawned'
  const canResume = effectiveStatus === 'failed' || effectiveStatus === 'incomplete'
  const finalResult = dbTask?.result || ''
  const instructions = liveTask?.spawnInstructions || dbTask?.instructions || ''
  const createdAt = liveTask?.spawnedAt || dbTask?.created_at || ''
  const completedAt = liveTask?.completedAt || dbTask?.completed_at || ''
  const errorMsg = dbTask?.error || dbTask?.abort_reason || liveTask?.error || ''
  const elapsed = elapsedLabel(createdAt, completedAt || (isRunning ? null : completedAt))
  const steps = mergeSteps(dbTask?.steps)
  const color = TASK_STATUS_COLOR[effectiveStatus] || 'muted'
  const label = TASK_STATUS_LABEL[effectiveStatus] || effectiveStatus
  const liveCurrentPlan = liveTask?.currentPlan || ''

  const effectiveTaskEvents = useMemo(
    () => (taskEvents.length > 0 ? taskEvents : dbTask?.activityLog || []),
    [taskEvents, dbTask]
  )

  const latestThought = useMemo(
    () => getLatestThought(effectiveTaskEvents, isRunning),
    [effectiveTaskEvents, isRunning]
  )

  const timeline = useMemo(() => buildTimeline(effectiveTaskEvents), [effectiveTaskEvents])

  return {
    fetched,
    loading,
    error,
    dbTask,
    finalResult,
    effectiveStatus,
    isRunning,
    canResume,
    instructions,
    createdAt,
    completedAt,
    errorMsg,
    elapsed,
    steps,
    color,
    label,
    liveCurrentPlan,
    latestThought,
    timeline
  }
}
