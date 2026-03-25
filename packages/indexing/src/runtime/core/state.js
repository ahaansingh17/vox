import { STATUS_EVENT_LIMIT } from './constants.js'
export const createInitialStatus = () => ({
  running: false,
  watching: false,
  reconciling: false,
  cancelling: false,
  startedAt: null,
  finishedAt: null,
  lastReconciledAt: null,
  activeFolders: [],
  pendingScopes: 0,
  queueSize: 0,
  scannedFiles: 0,
  queuedFiles: 0,
  processedFiles: 0,
  indexedFiles: 0,
  skippedUnchanged: 0,
  skippedUnsupported: 0,
  failedFiles: 0,
  removedStale: 0,
  message: '',
  events: []
})
export const DELETION_SWEEP_COOLDOWN_MS = 30_000
export const state = {
  indexingStatus: createInitialStatus(),
  trackedFolders: [],
  cancelRequested: false,
  pendingDeleteDrainPromise: null,
  pendingDeleteDrainTimer: null,
  pendingFilePaths: new Set(),
  processingFilePaths: new Set(),
  deletionSweepByFolder: new Map(),
  folderWatchers: new Map(),
  pendingReconcileScopes: new Map(),
  reconcileTimer: null,
  reconcilePromise: null,
  fullReconcileTimer: null
}
export const cloneStatus = () => JSON.parse(JSON.stringify(state.indexingStatus))

let _onStatusChange = null
let _notifyTimer = null

export const setStatusChangeCallback = (fn) => {
  _onStatusChange = typeof fn === 'function' ? fn : null
}

export const setStatus = (patch) => {
  state.indexingStatus = {
    ...state.indexingStatus,
    ...patch
  }
  if (_onStatusChange) {
    if (_notifyTimer) clearTimeout(_notifyTimer)
    _notifyTimer = setTimeout(() => {
      _notifyTimer = null
      _onStatusChange(cloneStatus())
    }, 100)
  }
}
export const appendEvent = (level, message) => {
  const nextEvents = [
    ...state.indexingStatus.events,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level,
      message,
      at: new Date().toISOString()
    }
  ]
  setStatus({
    events: nextEvents.slice(-STATUS_EVENT_LIMIT)
  })
}
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export const waitForIndexingIdle = async (timeoutMs = 5000) => {
  const startedAt = Date.now()
  while (state.indexingStatus.reconciling || state.indexingStatus.cancelling) {
    if (Date.now() - startedAt >= timeoutMs) {
      break
    }
    await delay(100)
  }
}
