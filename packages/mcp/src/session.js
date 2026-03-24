import fs from 'fs'
import path from 'path'

function _sessionsFilePath() {
  const base = process.env.VOX_USER_DATA_PATH
  if (!base) return null
  return path.join(base, 'mcp-sessions.json')
}

function _loadSessions() {
  try {
    const p = _sessionsFilePath()
    if (!p) return {}
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}

function _saveSessions(map) {
  try {
    const p = _sessionsFilePath()
    if (!p) return
    fs.writeFileSync(p, JSON.stringify(map), 'utf8')
  } catch {
    void 0
  }
}

export const getStoredSessionId = (serverId) => _loadSessions()[serverId] ?? null

export const persistSessionId = (serverId, sessionId) => {
  const map = _loadSessions()
  map[serverId] = sessionId
  _saveSessions(map)
}

export const clearSessionId = (serverId) => {
  const map = _loadSessions()
  delete map[serverId]
  _saveSessions(map)
}
