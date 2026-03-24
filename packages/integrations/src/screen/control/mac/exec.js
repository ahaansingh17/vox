import { exec } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

const EXEC_TIMEOUT = 30_000

export const execAbortable = (command, options = {}, signal) => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'))
      return
    }
    const child = exec(command, options, (error, stdout, stderr) => {
      if (signal) signal.removeEventListener('abort', onAbort)
      if (error)
        reject(
          Object.assign(error, {
            stderr
          })
        )
      else
        resolve({
          stdout,
          stderr
        })
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

export const writeTmp = async (content, ext) => {
  const file = path.join(
    os.tmpdir(),
    `vox_ctrl_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  )
  await fs.writeFile(file, content, 'utf8')
  return file
}

export const cleanTmp = (file) => fs.unlink(file).catch(() => {})

export const runPy = async (script, signal, timeout = EXEC_TIMEOUT) => {
  const file = await writeTmp(script, 'py')
  try {
    return await execAbortable(
      `python3 "${file}"`,
      {
        timeout
      },
      signal
    )
  } finally {
    await cleanTmp(file)
  }
}
