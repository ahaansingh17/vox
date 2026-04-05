import { Worker } from 'worker_threads'
import { join } from 'path'
import { app } from 'electron'
import { logger } from '../../core/logger'
import { emitAll } from '../../ipc/shared'

const EMBEDDING_DIM = 384

let worker = null
let ready = false
let initPromise = null
let nextId = 0
const pending = new Map()

const cache = new Map()
const CACHE_MAX = 512

function getCacheDir() {
  return join(app.getPath('userData'), 'models', 'embeddings')
}

function getWorkerPath() {
  const base = app.getAppPath().replace('app.asar', 'app.asar.unpacked')
  return join(base, 'out/main/embed.worker.js')
}

function ensureWorker() {
  if (worker) return
  worker = new Worker(getWorkerPath())

  worker.on('message', (msg) => {
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error))
      else resolve(msg.embedding)
      return
    }
    if (msg.type === 'status') {
      emitAll('models:embed-status', { status: msg.status })
    }
    if (msg.type === 'progress') {
      emitAll('models:embed-progress', { file: msg.file, loaded: msg.loaded, total: msg.total })
    }
    if (msg.type === 'ready') {
      ready = true
      emitAll('models:embed-status', { status: 'ready' })
      logger.info('[embed] Embedding model ready')
    }
    if (msg.type === 'error') {
      emitAll('models:embed-status', { status: 'error', message: msg.message })
      logger.error('[embed] Worker error:', msg.message)
    }
  })

  worker.on('error', (err) => {
    logger.error('[embed] Worker crashed:', err.message)
    for (const { reject } of pending.values()) reject(err)
    pending.clear()
    worker = null
    ready = false
    initPromise = null
  })

  worker.on('exit', (code) => {
    if (code !== 0) logger.warn('[embed] Worker exited with code', code)
    worker = null
    ready = false
    initPromise = null
  })
}

export async function initEmbeddings() {
  if (ready) return
  if (initPromise) return initPromise

  initPromise = new Promise((resolve) => {
    ensureWorker()
    const onReady = (msg) => {
      if (msg.type === 'ready') {
        worker.off('message', onReady)
        resolve()
      }
    }
    worker.on('message', onReady)
    worker.postMessage({ type: 'init', cacheDir: getCacheDir() })
  })

  return initPromise
}

export async function embedText(text) {
  if (!text || typeof text !== 'string') return null

  const trimmed = text.trim()
  if (!trimmed) return null

  if (cache.has(trimmed)) return cache.get(trimmed)

  if (!ready) {
    try {
      await initEmbeddings()
    } catch (err) {
      logger.warn('[embed] Init failed:', err.message)
      return null
    }
  }

  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    worker.postMessage({ type: 'embed', id, text: trimmed })
  }).then((embedding) => {
    if (cache.size >= CACHE_MAX) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }
    cache.set(trimmed, embedding)
    return embedding
  })
}

export function isEmbeddingReady() {
  return ready
}

export function getEmbeddingDim() {
  return EMBEDDING_DIM
}

export function destroyEmbeddings() {
  if (worker) {
    worker.terminate()
    worker = null
  }
  ready = false
  initPromise = null
  pending.clear()
  cache.clear()
}
