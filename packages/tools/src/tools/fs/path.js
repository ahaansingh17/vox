import os from 'os'
import path from 'path'

export function resolveLocalPath(inputPath) {
  const raw = String(inputPath || '').trim()
  if (!raw) throw new Error('Path is required.')
  const expanded =
    raw === '~' || raw.startsWith('~/') || raw.startsWith('~\\')
      ? path.join(os.homedir(), raw.slice(1))
      : raw
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(os.homedir(), expanded)
}

const BLOCKED_PATHS = new Set([
  '/',
  ...({
    darwin: ['/System', '/usr', '/bin', '/sbin', '/var', '/etc', '/Applications', '/Library'],
    linux: ['/usr', '/bin', '/sbin', '/var', '/etc', '/boot', '/sys', '/proc'],
    win32: ['C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)']
  }[process.platform] ?? [])
])

export function isBlockedPath(target) {
  const normalized = path.resolve(target)
  return BLOCKED_PATHS.has(normalized) || normalized === os.homedir()
}
