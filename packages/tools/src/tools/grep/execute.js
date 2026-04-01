import { exec } from 'child_process'
import os from 'os'
import { clampNumber } from '../../core/schema.js'
import { resolveLocalPath } from '../fs/execute.js'

function escapeShellArg(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'"
}

export async function grepLocal(args, { signal } = {}) {
  const pattern = String(args?.pattern || '').trim()
  if (!pattern) throw new Error('pattern is required.')

  const searchPath = args?.path ? resolveLocalPath(args.path) : os.homedir()
  const ignoreCase = args?.ignoreCase !== false
  const contextLines = clampNumber(args?.contextLines, 0, 0, 10)
  const maxResults = clampNumber(args?.maxResults, 100, 1, 500)
  const glob = args?.glob ? String(args.glob).trim() : ''

  const parts = ['grep', '-rn', '--color=never']
  if (ignoreCase) parts.push('-i')
  if (contextLines > 0) parts.push(`-C ${contextLines}`)

  parts.push('-E')
  parts.push(escapeShellArg(pattern))

  if (glob) {
    parts.push('--include=' + escapeShellArg(glob))
  }

  parts.push('--exclude-dir=.git')
  parts.push('--exclude-dir=node_modules')
  parts.push('--exclude-dir=.svn')
  parts.push('--exclude-dir=__pycache__')
  parts.push('--exclude-dir=.next')
  parts.push('--exclude-dir=dist')
  parts.push('--exclude-dir=build')

  parts.push(escapeShellArg(searchPath))

  const cmd = parts.join(' ') + ` | head -n ${maxResults}`

  return new Promise((resolve) => {
    const child = exec(
      cmd,
      {
        timeout: 30_000,
        maxBuffer: 8 * 1024 * 1024,
        cwd: searchPath
      },
      (_error, stdout, _stderr) => {
        if (signal) signal.removeEventListener('abort', onAbort)
        const output = String(stdout || '').trim()
        const lines = output ? output.split('\n') : []
        const truncated = lines.length >= maxResults

        resolve({
          pattern,
          path: searchPath,
          matchCount: lines.length,
          truncated,
          maxResults,
          content: output || 'No matches found.'
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
