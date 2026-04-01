import { exec } from 'child_process'
import os from 'os'
import { clampNumber } from '../../core/schema.js'
import { resolveLocalPath } from '../fs/execute.js'

const DANGEROUS_PATTERNS = [
  /;\s*rm\s+-rf\s+\//i,
  /;\s*mkfs\b/i,
  /;\s*dd\s+if=.*of=\/dev\//i,
  />\s*\/dev\/sd[a-z]/i,
  /\|\s*sh\b/i,
  /\|\s*bash\b/i,
  /curl\b.*\|\s*(sh|bash)\b/i,
  /wget\b.*\|\s*(sh|bash)\b/i
]

const READ_ONLY_COMMANDS = new Set([
  'cat',
  'head',
  'tail',
  'less',
  'more',
  'wc',
  'sort',
  'uniq',
  'cut',
  'tr',
  'grep',
  'rg',
  'ag',
  'ack',
  'find',
  'locate',
  'which',
  'whereis',
  'type',
  'ls',
  'tree',
  'du',
  'df',
  'file',
  'stat',
  'realpath',
  'readlink',
  'echo',
  'printf',
  'true',
  'false',
  'test',
  'pwd',
  'date',
  'whoami',
  'uname',
  'hostname',
  'env',
  'printenv',
  'id',
  'groups',
  'jq',
  'yq',
  'awk',
  'sed',
  'diff',
  'comm',
  'tee'
])

function getLeadingCommand(cmd) {
  const trimmed = cmd.trim()
  const parts = trimmed.split(/[\s|;&]+/)
  return parts[0]?.replace(/^(sudo\s+)?/, '').trim() || ''
}

function isDangerous(command) {
  return DANGEROUS_PATTERNS.some((p) => p.test(command))
}

export function isReadOnlyCommand(command) {
  const lead = getLeadingCommand(command)
  return READ_ONLY_COMMANDS.has(lead)
}

export async function runLocalCommand(args, { signal } = {}) {
  const command = String(args?.command || '').trim()
  if (!command) throw new Error('Command is required.')
  if (isDangerous(command)) {
    throw new Error('Command blocked: potentially destructive pattern detected.')
  }
  if (signal?.aborted) {
    return {
      command,
      cwd: '',
      exitCode: 1,
      timedOut: false,
      aborted: true,
      durationMs: 0,
      stdout: '',
      stderr: 'Aborted before execution'
    }
  }
  const cwd = args?.cwd ? resolveLocalPath(args.cwd) : os.homedir()
  const timeoutMs = clampNumber(args?.timeoutMs, 120000, 1000, 600000)
  const maxOutputChars = clampNumber(args?.maxOutputChars, 50000, 1000, 200000)
  const background = Boolean(args?.background)

  if (background) {
    const { spawn } = await import('child_process')
    const child = spawn(command, [], {
      cwd,
      shell: true,
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return {
      command,
      cwd,
      background: true,
      pid: child.pid
    }
  }

  const startedAt = Date.now()
  return new Promise((resolve) => {
    let stdoutChunks = ''
    let stderrChunks = ''
    const child = exec(command, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024
    })

    child.stdout?.on('data', (chunk) => {
      stdoutChunks += chunk
    })
    child.stderr?.on('data', (chunk) => {
      stderrChunks += chunk
    })

    child.on('close', (code, sig) => {
      if (signal) signal.removeEventListener('abort', onAbort)
      clearTimeout(progressTimer)
      const durationMs = Date.now() - startedAt
      const stdoutFull = stdoutChunks
      const stderrFull = stderrChunks
      const safeStdout = stdoutFull.slice(0, maxOutputChars)
      const safeStderr = stderrFull.slice(0, maxOutputChars)
      const wasAborted = signal?.aborted
      const timedOut = !wasAborted && sig === 'SIGTERM' && durationMs >= timeoutMs * 0.9

      resolve({
        command,
        cwd,
        exitCode: code ?? 1,
        timedOut,
        aborted: Boolean(wasAborted),
        durationMs,
        stdout: wasAborted ? '' : safeStdout,
        stderr: wasAborted ? 'Aborted by user' : safeStderr,
        stdoutTruncated: stdoutFull.length > safeStdout.length,
        stderrTruncated: stderrFull.length > safeStderr.length
      })
    })

    child.on('error', (error) => {
      if (signal) signal.removeEventListener('abort', onAbort)
      clearTimeout(progressTimer)
      const durationMs = Date.now() - startedAt
      resolve({
        command,
        cwd,
        exitCode: 1,
        timedOut: false,
        aborted: Boolean(signal?.aborted),
        durationMs,
        stdout: stdoutChunks.slice(0, maxOutputChars),
        stderr: error.message,
        stdoutTruncated: false,
        stderrTruncated: false
      })
    })
    const onAbort = () => {
      try {
        if (process.platform === 'win32') {
          exec(`taskkill /pid ${child.pid} /T /F`)
        } else {
          child.kill('SIGTERM')
        }
      } catch {
        void 0
      }
    }
    if (signal)
      signal.addEventListener('abort', onAbort, {
        once: true
      })

    const PROGRESS_THRESHOLD_MS = 2000
    const progressTimer = setTimeout(() => {
      if (args?._onProgress) {
        args._onProgress(`Still running (${Math.round((Date.now() - startedAt) / 1000)}s)...`)
      }
    }, PROGRESS_THRESHOLD_MS)
  })
}
