let _overrides = {}

export const initUtilitySentry = (...args) => _overrides.init?.(...args)
export const captureUtilityException = (...args) => _overrides.captureException?.(...args)
export const captureUtilityMessage = (...args) => _overrides.captureMessage?.(...args)
export const flushUtilitySentry = async (...args) => _overrides.flush?.(...args)

export const setUtilitySentry = (fns) => {
  _overrides = fns || {}
}
