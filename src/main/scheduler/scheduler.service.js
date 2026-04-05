import {
  scheduleJob,
  cancelJob,
  cancelAllJobs,
  listJobs,
  computeNextRun
} from '@vox-ai-app/scheduler'
import {
  saveSchedule as dbSaveSchedule,
  removeSchedule as dbRemoveSchedule,
  getSchedule as dbGetSchedule,
  listSchedules as dbListSchedules
} from '@vox-ai-app/storage/schedules'
import { getDb } from '../storage/db'
import { logger } from '../core/logger'

let _agentHandler = null

export function setSchedulerAgentHandler(handler) {
  _agentHandler = handler
}

function handleScheduledRun(id, meta) {
  logger.info(`[scheduler] Triggering scheduled run: ${id}`)
  const schedule = dbGetSchedule(getDb(), id)
  if (!schedule) return

  if (_agentHandler) {
    _agentHandler({
      scheduleId: id,
      prompt: schedule.prompt,
      channel: schedule.channel || null,
      meta
    })
  }

  if (schedule.once) {
    logger.info(`[scheduler] One-shot schedule ${id} fired, removing`)
    removeSchedule(id)
  }
}

export function initScheduler() {
  const saved = dbListSchedules(getDb())
  let restored = 0

  for (const schedule of saved) {
    if (!schedule.isEnabled) continue
    try {
      scheduleJob(
        schedule.id,
        { expr: schedule.cronExpr, tz: schedule.timezone },
        handleScheduledRun
      )
      restored++
    } catch (err) {
      logger.warn(`[scheduler] Failed to restore schedule ${schedule.id}:`, err)
    }
  }

  logger.info(`[scheduler] Restored ${restored}/${saved.length} schedules`)
}

export function addSchedule(config) {
  const id = config.id || `sched_${Date.now()}`
  const schedule = dbSaveSchedule(getDb(), {
    id,
    cronExpr: config.expr,
    timezone: config.tz || null,
    prompt: config.prompt,
    channel: config.channel || null,
    isEnabled: config.enabled !== false,
    once: config.once === true
  })

  if (schedule.isEnabled) {
    scheduleJob(id, { expr: schedule.cronExpr, tz: schedule.timezone }, handleScheduledRun)
  }

  return schedule
}

export function removeSchedule(id) {
  cancelJob(id)
  dbRemoveSchedule(getDb(), id)
}

export function getSchedules() {
  const saved = dbListSchedules(getDb())
  const running = listJobs()
  const runningMap = new Map(running.map((j) => [j.id, j]))

  return saved.map((s) => ({
    ...s,
    nextRun: runningMap.get(s.id)?.nextRun || computeNextRun(s.cronExpr, s.timezone)
  }))
}

export async function destroyScheduler() {
  cancelAllJobs()
}
