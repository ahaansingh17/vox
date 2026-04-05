import { openDb, closeDb as _closeDb } from '@vox-ai-app/storage/db'
import { app } from 'electron'
import { join } from 'path'
import { logger } from '../core/logger'

let _dbPath = null

function getDbPath() {
  if (_dbPath) return _dbPath
  _dbPath = join(app.getPath('userData'), 'vox.db')
  return _dbPath
}

export function getDb() {
  return openDb(getDbPath())
}

export function closeDb() {
  _closeDb(getDbPath())
  logger.info('[db] Messages DB closed')
}
