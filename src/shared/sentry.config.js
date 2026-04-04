export const sentryDsn =
  'https://b3683e43a9118d6f7405b4cb4c9f6f49@o487448.ingest.us.sentry.io/4511096423710720'

const macPathPattern = /\/Users\/[^/\s"'`]+(?:\/[^/\s"'`]+)*/g
const linuxPathPattern = /\/home\/[^/\s"'`]+(?:\/[^/\s"'`]+)*/g
const windowsPathPattern = /[A-Za-z]:\\Users\\[^\\\s"'`]+(?:\\[^\\\s"'`]+)*/g
const fileUrlPattern = /file:\/\/\/[^/\s"'`]+(?:\/[^/\s"'`]+)*/g

const sanitizeString = (value) =>
  String(value)
    .replace(macPathPattern, '[path]')
    .replace(linuxPathPattern, '[path]')
    .replace(windowsPathPattern, '[path]')
    .replace(fileUrlPattern, 'file:///[path]')

const sanitizeValue = (value, seen = new WeakSet()) => {
  if (typeof value === 'string') {
    return sanitizeString(value)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  if (seen.has(value)) {
    return value
  }

  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, seen))
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry, seen)])
  )
}

export const sentryBeforeSend = (event) => sanitizeValue(event)

export const isSentryEnabled = (isDev) => !isDev && !process.env.SENTRY_DISABLED
