const LOCK_TTL_MS = 30_000
let _tail = Promise.resolve()
let _sessionId = null
let _lockExpiry = null
let _lockTimer = null
const _clearLock = () => {
  _sessionId = null
  _lockExpiry = null
  if (_lockTimer) {
    clearTimeout(_lockTimer)
    _lockTimer = null
  }
}
const _renewLock = () => {
  if (!_sessionId) return
  if (_lockTimer) clearTimeout(_lockTimer)
  _lockExpiry = Date.now() + LOCK_TTL_MS
  _lockTimer = setTimeout(_clearLock, LOCK_TTL_MS)
}
const _isLockExpired = () => _lockExpiry !== null && Date.now() > _lockExpiry
export const enqueueScreen = (fn) => {
  _renewLock()
  const task = _tail.then(fn)
  _tail = task.catch(() => {})
  return task
}
export const acquireScreen = ({ sessionId, force = false }) => {
  if (_sessionId && _sessionId !== sessionId && !_isLockExpired() && !force) {
    throw Object.assign(
      new Error(`Screen is in use by session "${_sessionId}". Release it first or wait.`),
      {
        code: 'SCREEN_LOCKED',
        holder: _sessionId
      }
    )
  }
  _clearLock()
  _sessionId = sessionId
  _renewLock()
  return {
    sessionId
  }
}
export const releaseScreen = ({ sessionId }) => {
  if (_sessionId === sessionId) _clearLock()
  return {
    ok: true
  }
}
export const getScreenSession = () => ({
  sessionId: _sessionId,
  expiresAt: _lockExpiry,
  ttlMs: _lockExpiry ? Math.max(0, _lockExpiry - Date.now()) : null
})
