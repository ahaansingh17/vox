export function getSetting(db, key) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key)
  return row ? row.value : undefined
}

export function getSettingJson(db, key, fallback = null) {
  const raw = getSetting(db, key)
  if (raw === undefined) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function setSetting(db, key, value) {
  const now = new Date().toISOString()
  const raw = JSON.stringify(value)
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, raw, now)
  return value
}

export function deleteSetting(db, key) {
  return db.prepare(`DELETE FROM settings WHERE key = ?`).run(key).changes > 0
}

export function getAllSettings(db) {
  const rows = db.prepare(`SELECT key, value FROM settings`).all()
  const result = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}
