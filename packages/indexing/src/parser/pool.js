import { join } from 'path'
let worker = null
let nextId = 0
let consecutiveErrors = 0
const MAX_CONSECUTIVE_ERRORS = 3
const pending = new Map()
const queue = []
let draining = false
const resolveAppPath = () => {
  const appPath = String(process.env.VOX_APP_PATH || '').trim()
  if (!appPath) {
    throw new Error('VOX_APP_PATH is required before starting the parser worker.')
  }
  return appPath
}
const unpackedApp = () => resolveAppPath().replace('app.asar', 'app.asar.unpacked')
const workerPath = () => join(unpackedApp(), 'out/main/indexing.parser.worker.js')
const getWorker = () => {
  if (!worker) {
    const { Worker } = require('worker_threads')
    worker = new Worker(workerPath())
    worker.on('message', ({ id, text, truncated, error }) => {
      const cb = pending.get(id)
      pending.delete(id)
      if (cb) {
        if (error) cb.reject(new Error(error))
        else
          cb.resolve({
            text,
            truncated
          })
      }
      consecutiveErrors = 0
      draining = false
      drainQueue()
    })
    worker.on('error', (err) => {
      for (const cb of pending.values()) cb.reject(err)
      pending.clear()
      worker = null
      draining = false
      consecutiveErrors++
      if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
        drainQueue()
      } else {
        for (const { reject } of queue) reject(new Error('parser worker failed repeatedly'))
        queue.length = 0
      }
    })
  }
  return worker
}
const drainQueue = () => {
  if (draining || queue.length === 0) return
  draining = true
  const { id, filePath, maxChars, resolve, reject } = queue.shift()
  pending.set(id, {
    resolve,
    reject
  })
  getWorker().postMessage({
    id,
    filePath,
    maxChars
  })
}
export const parseOfficeInWorker = (filePath, maxChars) =>
  new Promise((resolve, reject) => {
    const id = nextId++
    queue.push({
      id,
      filePath,
      maxChars,
      resolve,
      reject
    })
    drainQueue()
  })
export const destroyParserWorker = () => {
  if (worker) {
    worker.terminate()
    worker = null
  }
  consecutiveErrors = 0
  for (const cb of pending.values()) cb.reject(new Error('parser worker destroyed'))
  pending.clear()
  for (const { reject } of queue) reject(new Error('parser worker destroyed'))
  queue.length = 0
  draining = false
}
