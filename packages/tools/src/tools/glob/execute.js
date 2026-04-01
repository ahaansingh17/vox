import { exec } from 'child_process'
import os from 'os'
import path from 'path'
import { clampNumber } from '../../core/schema.js'
import { resolveLocalPath } from '../fs/execute.js'

function escapeShellArg(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'"
}

export async function globLocal(args, { signal } = {}) {
  const pattern = String(args?.pattern || '').trim()
  if (!pattern) throw new Error('pattern is required.')

  const searchPath = args?.path ? resolveLocalPath(args.path) : os.homedir()
  const maxResults = clampNumber(args?.maxResults, 100, 1, 1000)

  const excludes = [
    '-not',
    '-path',
    '*/\\.git/*',
    '-not',
    '-path',
    '*/node_modules/*',
    '-not',
    '-path',
    '*/__pycache__/*',
    '-not',
    '-path',
    '*/.next/*'
  ]

  const findName = pattern.includes('/') ? '-path' : '-name'
  const cmd = [
    'find',
    escapeShellArg(searchPath),
    '-maxdepth',
    '10',
    ...excludes,
    findName,
    escapeShellArg(pattern),
    '-type',
    'f',
    '2>/dev/null',
    '|',
    'head',
    '-n',
    String(maxResults)
  ].join(' ')

  return new Promise((resolve) => {
    const child = exec(
      cmd,
      {
        timeout: 15_000,
        maxBuffer: 4 * 1024 * 1024,
        cwd: searchPath
      },
      (_error, stdout) => {
        if (signal) signal.removeEventListener('abort', onAbort)
        const output = String(stdout || '').trim()
        const files = output ? output.split('\n').filter(Boolean) : []

        const relative = files.map((f) => {
          try {
            return path.relative(searchPath, f)
          } catch {
            return f
          }
        })

        resolve({
          pattern,
          path: searchPath,
          fileCount: relative.length,
          truncated: relative.length >= maxResults,
          files: relative
        })
      }
    )

    const onAbort = () => {
      try {
        child.kill('SIGTERM')
      } catch {
        void 0
      }
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
  })
}
