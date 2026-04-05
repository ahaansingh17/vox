export function runMigrations(db, migrations) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      applied_at  TEXT    NOT NULL
    )
  `)

  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((r) => r.name)
  )

  const pending = migrations
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((m) => !applied.has(m.name))

  for (const migration of pending) {
    db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        migration.name,
        new Date().toISOString()
      )
    })()
  }
}
