import { promisify } from 'util'
import { exec } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
export const EXEC_TIMEOUT = 120_000
export const execAsync = promisify(exec)
export const execAbortable = (command, options = {}, signal) => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'))
      return
    }
    const child = exec(command, options, (error, stdout, stderr) => {
      if (signal) signal.removeEventListener('abort', onAbort)
      if (error) {
        const err = new Error(error.message)
        err.stdout = stdout
        err.stderr = stderr
        err.code = error.code
        err.killed = error.killed
        err.signal = error.signal
        err.aborted = signal?.aborted
        reject(err)
      } else {
        resolve({
          stdout,
          stderr
        })
      }
    })
    const onAbort = () => {
      try {
        child.kill('SIGTERM')
      } catch {
        void 0
      }
    }
    if (signal)
      signal.addEventListener('abort', onAbort, {
        once: true
      })
  })
}
export const esc = (s) =>
  String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
export const shellEsc = (s) => String(s || '').replace(/'/g, "'\\''")
export const psEsc = (s) => String(s || '').replace(/'/g, "''")
export const writeTempScript = async (content, ext) => {
  const file = path.join(
    os.tmpdir(),
    `vox_script_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  )
  await fs.writeFile(file, content, 'utf8')
  return file
}
export const cleanupTemp = (file) => fs.unlink(file).catch(() => {})
export const parseTabSeparated = (stdout) =>
  String(stdout || '')
    .split('\n')
    .map((line) => {
      const [name, email] = line.split('\t')
      return {
        name: name?.trim(),
        email: email?.trim()
      }
    })
    .filter((r) => r.name && r.email)
