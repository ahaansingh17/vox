import { INDEX_ENGINE_VERSION } from '../runtime/core/constants.js'
import { getKnowledgeDb, indexingDbState } from './state.js'
const INDEX_ENGINE_VERSION_KEY = 'index.engine.version'
const clearIndexTables = () => {
  getKnowledgeDb().exec(`
    DELETE FROM entries;
    DELETE FROM documents;
    DELETE FROM chunks_fts;
    DELETE FROM chunks;
    DELETE FROM pending_deletes;
  `)
}
const syncIndexEngineVersion = () => {
  const version = indexingDbState.kv.get?.get(INDEX_ENGINE_VERSION_KEY)?.value || null
  if (version === INDEX_ENGINE_VERSION) {
    return
  }
  clearIndexTables()
  indexingDbState.kv.set.run(INDEX_ENGINE_VERSION_KEY, INDEX_ENGINE_VERSION)
}
export const prepareKnowledgeDb = () => {
  const knowledgeDb = getKnowledgeDb()
  knowledgeDb.pragma('journal_mode = WAL')
  knowledgeDb.pragma('synchronous = NORMAL')
  knowledgeDb.pragma('cache_size = -4000')
  knowledgeDb.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      path TEXT PRIMARY KEY,
      folder_path TEXT NOT NULL,
      kind TEXT NOT NULL,
      size INTEGER NOT NULL,
      mtime_ms INTEGER NOT NULL,
      indexed_at TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS entries_folder_path_idx ON entries(folder_path);
    CREATE TABLE IF NOT EXISTS pending_deletes (
      path TEXT PRIMARY KEY,
      folder_path TEXT NOT NULL,
      queued_at TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS pending_deletes_folder_path_idx ON pending_deletes(folder_path);
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS documents (
      path TEXT PRIMARY KEY,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      text TEXT NOT NULL,
      char_count INTEGER NOT NULL
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS chunks_path_idx ON chunks(path);
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      chunk_id UNINDEXED,
      path,
      text,
      tokenize = 'unicode61'
    );
  `)
  indexingDbState.entries = {
    loadAll: knowledgeDb.prepare('SELECT * FROM entries'),
    get: knowledgeDb.prepare('SELECT * FROM entries WHERE path = ?'),
    loadPathsByFolder: knowledgeDb.prepare('SELECT path FROM entries WHERE folder_path = ?'),
    loadByPathPrefix: knowledgeDb.prepare('SELECT * FROM entries WHERE path LIKE ? ORDER BY path'),
    loadPathsByPathPrefix: knowledgeDb.prepare(
      'SELECT path FROM entries WHERE path LIKE ? ORDER BY path'
    ),
    upsert: knowledgeDb.prepare(
      'INSERT OR REPLACE INTO entries (path, folder_path, kind, size, mtime_ms, indexed_at) VALUES (?,?,?,?,?,?)'
    ),
    delete: knowledgeDb.prepare('DELETE FROM entries WHERE path = ?')
  }
  indexingDbState.pendingDeletes = {
    loadAll: knowledgeDb.prepare('SELECT * FROM pending_deletes'),
    loadPathsByFolder: knowledgeDb.prepare(
      'SELECT path FROM pending_deletes WHERE folder_path = ?'
    ),
    upsert: knowledgeDb.prepare(
      'INSERT OR REPLACE INTO pending_deletes (path, folder_path, queued_at) VALUES (?,?,?)'
    ),
    delete: knowledgeDb.prepare('DELETE FROM pending_deletes WHERE path = ?')
  }
  indexingDbState.kv = {
    get: knowledgeDb.prepare('SELECT value FROM kv WHERE key = ?'),
    set: knowledgeDb.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?,?)'),
    delete: knowledgeDb.prepare('DELETE FROM kv WHERE key = ?')
  }
  indexingDbState.documents = {
    get: knowledgeDb.prepare('SELECT chunk_count, content_hash FROM documents WHERE path = ?'),
    upsert: knowledgeDb.prepare(
      'INSERT OR REPLACE INTO documents (path, chunk_count, content_hash) VALUES (?,?,?)'
    ),
    delete: knowledgeDb.prepare('DELETE FROM documents WHERE path = ?'),
    deleteChunksByPath: knowledgeDb.prepare('DELETE FROM chunks WHERE path = ?'),
    deleteFtsByPath: knowledgeDb.prepare('DELETE FROM chunks_fts WHERE path = ?'),
    insertChunk: knowledgeDb.prepare(
      'INSERT OR REPLACE INTO chunks (id, path, ordinal, text, char_count) VALUES (?,?,?,?,?)'
    ),
    insertFts: knowledgeDb.prepare('INSERT INTO chunks_fts (chunk_id, path, text) VALUES (?,?,?)')
  }
  syncIndexEngineVersion()
}
