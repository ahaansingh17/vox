const _state = new Map()
const MAX_ENTRIES = 5000

export const readState = {
  set(filePath, info) {
    if (_state.size >= MAX_ENTRIES) {
      const oldest = _state.keys().next().value
      _state.delete(oldest)
    }
    _state.set(filePath, { mtimeMs: info.mtimeMs, ts: Date.now() })
  },

  get(filePath) {
    return _state.get(filePath) || null
  },

  clear() {
    _state.clear()
  }
}
