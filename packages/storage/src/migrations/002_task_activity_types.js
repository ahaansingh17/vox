export const name = '002_task_activity_types'

export function up(db) {
  db.exec(`
    CREATE TABLE task_activity_new (
      id          TEXT PRIMARY KEY,
      task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK(type IN (
        'tool_call','tool_result','text','thought',
        'journal','spawn','error'
      )),
      name        TEXT,
      args        TEXT,
      result      TEXT,
      plan        TEXT,
      data        TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL
    );

    INSERT INTO task_activity_new (id, task_id, type, name, args, result, plan, data, created_at)
    SELECT
      id,
      task_id,
      CASE type
        WHEN 'tool'    THEN 'tool_call'
        WHEN 'step'    THEN 'journal'
        WHEN 'info'    THEN 'text'
        WHEN 'success' THEN 'text'
        ELSE type
      END,
      name,
      NULL,
      result,
      NULL,
      data,
      created_at
    FROM task_activity;

    DROP TABLE task_activity;
    ALTER TABLE task_activity_new RENAME TO task_activity;

    CREATE INDEX idx_task_activity_task
      ON task_activity(task_id, created_at ASC, id ASC);
  `)
}
