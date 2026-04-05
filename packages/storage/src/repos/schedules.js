import { randomUUID } from 'crypto'

function mapSchedule(row) {
  if (!row) return null
  return {
    id: row.id,
    cronExpr: row.cron_expr,
    timezone: row.timezone || null,
    prompt: row.prompt,
    channel: row.channel || null,
    isEnabled: !!row.is_enabled,
    once: !!row.once,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function saveSchedule(db, schedule) {
  const id = schedule.id || randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO schedules (id, cron_expr, timezone, prompt, channel, is_enabled, once, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       cron_expr = excluded.cron_expr,
       timezone = excluded.timezone,
       prompt = excluded.prompt,
       channel = excluded.channel,
       is_enabled = excluded.is_enabled,
       once = excluded.once,
       updated_at = excluded.updated_at`
  ).run(
    id,
    String(schedule.cronExpr || schedule.expr),
    schedule.timezone || schedule.tz || null,
    String(schedule.prompt),
    schedule.channel || null,
    schedule.isEnabled === false ? 0 : 1,
    schedule.once ? 1 : 0,
    now,
    now
  )

  return getSchedule(db, id)
}

export function removeSchedule(db, id) {
  return db.prepare(`DELETE FROM schedules WHERE id = ?`).run(id)
}

export function getSchedule(db, id) {
  return mapSchedule(db.prepare(`SELECT * FROM schedules WHERE id = ?`).get(id))
}

export function listSchedules(db) {
  return db.prepare(`SELECT * FROM schedules ORDER BY created_at ASC`).all().map(mapSchedule)
}
