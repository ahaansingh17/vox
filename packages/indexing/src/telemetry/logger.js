let _log = {
  info: (...args) => console.log('[indexing]', ...args),
  warn: (...args) => console.warn('[indexing]', ...args),
  error: (...args) => console.error('[indexing]', ...args),
  debug: (...args) => console.debug('[indexing]', ...args)
}
export const logger = new Proxy(
  {},
  {
    get: (_, prop) => _log[prop] ?? (() => {})
  }
)
export const setLogger = (custom) => {
  _log = custom
}
