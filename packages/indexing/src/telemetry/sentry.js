let _capture = () => {}
export const captureMainException = (...args) => _capture(...args)
export const setSentryCapture = (fn) => {
  _capture = fn
}
