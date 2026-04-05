export const name = '001_initial_schema'

export function up(db) {
  db.exec(`
    CREATE TABLE conversations (
      id                    TEXT    PRIMARY KEY,
      title                 TEXT,
      user_info             TEXT    NOT NULL DEFAULT '{}',
      context_summary       TEXT,
      context_checkpoint_id TEXT,
      created_at            TEXT    NOT NULL,
      updated_at            TEXT    NOT NULL
    );

    CREATE TABLE messages (
      sort_order        INTEGER PRIMARY KEY AUTOINCREMENT,
      id                TEXT    NOT NULL UNIQUE,
      conversation_id   TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role              TEXT    NOT NULL CHECK(role IN ('user','assistant','system','tool','tool_result')),
      content           TEXT    NOT NULL,
      tokens            INTEGER,
      created_at        TEXT    NOT NULL,
      updated_at        TEXT    NOT NULL
    );

    CREATE INDEX idx_messages_conversation
      ON messages(conversation_id, sort_order);

    CREATE TABLE tasks (
      id                TEXT    PRIMARY KEY,
      instructions      TEXT    NOT NULL DEFAULT '',
      context           TEXT    NOT NULL DEFAULT '',
      status            TEXT    NOT NULL DEFAULT 'queued'
                        CHECK(status IN ('queued','running','completed','incomplete','failed','aborted')),
      current_plan      TEXT    NOT NULL DEFAULT '',
      result            TEXT,
      error             TEXT,
      abort_reason      TEXT,
      provider          TEXT,
      model             TEXT,
      context_injected  INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT    NOT NULL,
      updated_at        TEXT    NOT NULL,
      completed_at      TEXT
    );

    CREATE INDEX idx_tasks_created
      ON tasks(created_at DESC, id DESC);

    CREATE INDEX idx_tasks_status
      ON tasks(status, created_at DESC);

    CREATE TABLE task_activity (
      id          TEXT    PRIMARY KEY,
      task_id     TEXT    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL CHECK(type IN ('tool','spawn','success','error','info','step')),
      name        TEXT,
      result      TEXT,
      data        TEXT    NOT NULL DEFAULT '{}',
      created_at  TEXT    NOT NULL
    );

    CREATE INDEX idx_task_activity_task
      ON task_activity(task_id, created_at ASC, id ASC);

    CREATE VIRTUAL TABLE tasks_fts USING fts5(
      task_id UNINDEXED,
      instructions,
      result,
      tokenize = 'unicode61'
    );

    CREATE TRIGGER tasks_fts_insert AFTER INSERT ON tasks BEGIN
      INSERT INTO tasks_fts(task_id, instructions, result)
      VALUES (NEW.id, NEW.instructions, COALESCE(NEW.result, ''));
    END;

    CREATE TRIGGER tasks_fts_update AFTER UPDATE OF instructions, result ON tasks BEGIN
      DELETE FROM tasks_fts WHERE task_id = OLD.id;
      INSERT INTO tasks_fts(task_id, instructions, result)
      VALUES (NEW.id, NEW.instructions, COALESCE(NEW.result, ''));
    END;

    CREATE TRIGGER tasks_fts_delete AFTER DELETE ON tasks BEGIN
      DELETE FROM tasks_fts WHERE task_id = OLD.id;
    END;

    CREATE VIRTUAL TABLE messages_fts USING fts5(
      message_id UNINDEXED,
      role UNINDEXED,
      content,
      tokenize = 'unicode61'
    );

    CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(message_id, role, content)
      VALUES (NEW.id, NEW.role, NEW.content);
    END;

    CREATE TRIGGER messages_fts_update AFTER UPDATE OF content ON messages BEGIN
      DELETE FROM messages_fts WHERE message_id = OLD.id;
      INSERT INTO messages_fts(message_id, role, content)
      VALUES (NEW.id, NEW.role, NEW.content);
    END;

    CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE message_id = OLD.id;
    END;

    CREATE TABLE tools (
      id              TEXT    PRIMARY KEY,
      name            TEXT    NOT NULL UNIQUE CHECK(length(name) BETWEEN 1 AND 64),
      description     TEXT    NOT NULL DEFAULT '',
      parameters      TEXT    NOT NULL DEFAULT '{"type":"object","properties":{}}',
      source_type     TEXT    NOT NULL CHECK(source_type IN ('js_function','http_webhook','desktop')),
      source_code     TEXT,
      webhook_url     TEXT,
      webhook_headers TEXT    NOT NULL DEFAULT '{}',
      is_enabled      INTEGER NOT NULL DEFAULT 1,
      tags            TEXT    NOT NULL DEFAULT '[]',
      version         INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT    NOT NULL,
      updated_at      TEXT    NOT NULL
    );

    CREATE INDEX idx_tools_enabled
      ON tools(is_enabled) WHERE is_enabled = 1;

    CREATE TABLE tool_secrets (
      id              TEXT    PRIMARY KEY,
      tool_id         TEXT    NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
      key             TEXT    NOT NULL,
      encrypted_value TEXT    NOT NULL,
      created_at      TEXT    NOT NULL,
      updated_at      TEXT    NOT NULL,
      UNIQUE(tool_id, key)
    );

    CREATE INDEX idx_tool_secrets_tool
      ON tool_secrets(tool_id);

    CREATE TABLE mcp_servers (
      id              TEXT    PRIMARY KEY,
      name            TEXT    NOT NULL,
      transport       TEXT    NOT NULL CHECK(transport IN ('stdio','sse','http')),
      command         TEXT,
      args            TEXT    NOT NULL DEFAULT '[]',
      url             TEXT,
      env             TEXT    NOT NULL DEFAULT '{}',
      is_enabled      INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT    NOT NULL,
      updated_at      TEXT    NOT NULL
    );

    CREATE TABLE settings (
      key         TEXT    PRIMARY KEY,
      value       TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL
    );

    CREATE TABLE schedules (
      id          TEXT    PRIMARY KEY,
      cron_expr   TEXT    NOT NULL,
      timezone    TEXT,
      prompt      TEXT    NOT NULL,
      channel     TEXT,
      is_enabled  INTEGER NOT NULL DEFAULT 1,
      once        INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL
    );

    CREATE TABLE vectors (
      id              TEXT    NOT NULL,
      collection      TEXT    NOT NULL,
      embedding       BLOB    NOT NULL,
      metadata        TEXT    NOT NULL DEFAULT '{}',
      created_at      TEXT    NOT NULL,
      updated_at      TEXT    NOT NULL,
      PRIMARY KEY (id, collection)
    );

    CREATE INDEX idx_vectors_collection
      ON vectors(collection);

    CREATE TABLE knowledge_patterns (
      id          TEXT    PRIMARY KEY,
      task_id     TEXT    REFERENCES tasks(id) ON DELETE SET NULL,
      trigger     TEXT    NOT NULL,
      solution    TEXT    NOT NULL,
      created_at  TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL
    );

    CREATE VIRTUAL TABLE patterns_fts USING fts5(
      pattern_id UNINDEXED,
      trigger,
      solution,
      tokenize = 'unicode61'
    );

    CREATE TRIGGER patterns_fts_insert AFTER INSERT ON knowledge_patterns BEGIN
      INSERT INTO patterns_fts(pattern_id, trigger, solution)
      VALUES (NEW.id, NEW.trigger, NEW.solution);
    END;

    CREATE TRIGGER patterns_fts_update AFTER UPDATE OF trigger, solution ON knowledge_patterns BEGIN
      DELETE FROM patterns_fts WHERE pattern_id = OLD.id;
      INSERT INTO patterns_fts(pattern_id, trigger, solution)
      VALUES (NEW.id, NEW.trigger, NEW.solution);
    END;

    CREATE TRIGGER patterns_fts_delete AFTER DELETE ON knowledge_patterns BEGIN
      DELETE FROM patterns_fts WHERE pattern_id = OLD.id;
    END;
  `)
}
