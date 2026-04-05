import { spawn, execSync } from 'child_process'
import { join } from 'path'
import {
  existsSync,
  mkdirSync,
  chmodSync,
  writeFileSync,
  readFileSync,
  createWriteStream,
  renameSync,
  rmSync
} from 'fs'
import { app } from 'electron'
import { logger } from '../../core/logger'
import { emitAll } from '../../ipc/shared'

const DEFAULT_PORT = 19741
const HEALTH_POLL_MS = 300
const MAX_HEALTH_POLLS = 400
const LLAMA_SERVER_VERSION = 'b8635'

let _process = null
let _port = DEFAULT_PORT
let _modelPath = null
let _ready = false
let _onProgress = null

function getBinDir() {
  const dir = join(app.getPath('userData'), 'bin')
  mkdirSync(dir, { recursive: true })
  return dir
}

function getManagedBinaryPath() {
  return join(getBinDir(), 'llama-server')
}

function getVersionFilePath() {
  return join(getBinDir(), 'llama-server.version')
}

function getInstalledVersion() {
  try {
    return readFileSync(getVersionFilePath(), 'utf-8').trim()
  } catch {
    return null
  }
}

function getAssetName() {
  const arch = process.arch
  if (process.platform === 'darwin') {
    return arch === 'arm64'
      ? `llama-${LLAMA_SERVER_VERSION}-bin-macos-arm64.tar.gz`
      : `llama-${LLAMA_SERVER_VERSION}-bin-macos-x64.tar.gz`
  }
  if (process.platform === 'linux') {
    return arch === 'arm64'
      ? `llama-${LLAMA_SERVER_VERSION}-bin-ubuntu-arm64.tar.gz`
      : `llama-${LLAMA_SERVER_VERSION}-bin-ubuntu-x64.tar.gz`
  }
  return arch === 'arm64'
    ? `llama-${LLAMA_SERVER_VERSION}-bin-win-cpu-arm64.zip`
    : `llama-${LLAMA_SERVER_VERSION}-bin-win-cpu-x64.zip`
}

function getDownloadUrl() {
  return `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_SERVER_VERSION}/${getAssetName()}`
}

function findBinary() {
  const bundled = join(
    app.getAppPath().replace('app.asar', 'app.asar.unpacked'),
    'resources',
    'llama-server'
  )
  if (existsSync(bundled)) return bundled

  const managed = getManagedBinaryPath()
  if (existsSync(managed) && getInstalledVersion() === LLAMA_SERVER_VERSION) return managed

  const brewArm = '/opt/homebrew/bin/llama-server'
  if (existsSync(brewArm)) return brewArm

  const brewIntel = '/usr/local/bin/llama-server'
  if (existsSync(brewIntel)) return brewIntel

  return null
}

export async function ensureBinary() {
  const existing = findBinary()
  if (existing) return existing

  logger.info(`[llm.server] llama-server not found, downloading ${LLAMA_SERVER_VERSION}...`)
  emitAll('engine:status', { status: 'downloading', version: LLAMA_SERVER_VERSION })

  const binDir = getBinDir()
  const binaryPath = getManagedBinaryPath()
  const assetName = getAssetName()
  const tmpArchive = join(binDir, assetName + '.tmp')
  const tmpExtract = join(binDir, 'extract-tmp')

  try {
    const url = getDownloadUrl()
    const resp = await fetch(url, { redirect: 'follow' })
    if (!resp.ok) throw new Error(`Failed to download llama-server: HTTP ${resp.status}`)

    const totalBytes = parseInt(resp.headers.get('content-length') || '0', 10)
    let downloaded = 0

    const fileStream = createWriteStream(tmpArchive)
    const reader = resp.body.getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fileStream.write(Buffer.from(value))
      downloaded += value.byteLength
      if (totalBytes > 0) {
        const pct = Math.round((downloaded / totalBytes) * 100)
        emitAll('engine:progress', { percent: pct, downloadedBytes: downloaded, totalBytes })
      }
    }

    fileStream.end()
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve)
      fileStream.on('error', reject)
      if (fileStream.writableFinished) resolve()
    })

    mkdirSync(tmpExtract, { recursive: true })

    if (assetName.endsWith('.tar.gz')) {
      execSync(`tar xzf "${tmpArchive}" -C "${tmpExtract}"`)
    } else {
      execSync(`unzip -o "${tmpArchive}" -d "${tmpExtract}"`)
    }

    const found = execSync(`find "${tmpExtract}" -name "llama-server" -type f | head -1`, {
      encoding: 'utf-8'
    }).trim()
    if (!found) throw new Error('llama-server binary not found in archive')

    if (existsSync(binaryPath)) rmSync(binaryPath)
    renameSync(found, binaryPath)
    chmodSync(binaryPath, 0o755)

    if (process.platform === 'darwin') {
      try {
        execSync(`xattr -dr com.apple.quarantine "${binaryPath}"`)
      } catch {
        /* ok */
      }
    }

    writeFileSync(getVersionFilePath(), LLAMA_SERVER_VERSION)

    logger.info('[llm.server] Installed llama-server', LLAMA_SERVER_VERSION, 'at', binaryPath)
    emitAll('engine:status', { status: 'ready', version: LLAMA_SERVER_VERSION })
    return binaryPath
  } catch (err) {
    logger.error('[llm.server] Binary install failed:', err.message)
    emitAll('engine:status', { status: 'error', error: err.message })
    throw err
  } finally {
    try {
      rmSync(tmpArchive, { force: true })
    } catch {
      /* ok */
    }
    try {
      rmSync(tmpExtract, { recursive: true, force: true })
    } catch {
      /* ok */
    }
  }
}

export function getPort() {
  return _port
}

export function getBaseUrl() {
  return `http://127.0.0.1:${_port}`
}

export function isReady() {
  return _ready
}

export function getModelPath() {
  return _modelPath
}

async function waitForHealth() {
  let processExited = false
  const onExit = () => {
    processExited = true
  }
  _process?.on('exit', onExit)

  try {
    for (let i = 0; i < MAX_HEALTH_POLLS; i++) {
      if (processExited || !_process) {
        throw new Error('llama-server process exited before becoming healthy')
      }
      try {
        const resp = await fetch(`${getBaseUrl()}/health`)
        if (resp.ok) {
          const body = await resp.json()
          if (body.status === 'ok') return true
        }
      } catch {
        // server not up yet
      }
      await new Promise((r) => setTimeout(r, HEALTH_POLL_MS))
    }
    throw new Error('llama-server failed to become healthy')
  } finally {
    _process?.removeListener('exit', onExit)
  }
}

export async function startServer(modelPath, { contextSize = 32768, nGpuLayers = -1, port } = {}) {
  if (_process) {
    await stopServer()
  }

  _port = port || DEFAULT_PORT
  _modelPath = modelPath
  _ready = false

  try {
    const pids = execSync(`lsof -ti :${_port}`, { encoding: 'utf-8' }).trim()
    if (pids) {
      logger.warn(`[llm.server] Killing stale process(es) on port ${_port}: ${pids}`)
      for (const pid of pids.split('\n').filter(Boolean)) {
        try {
          process.kill(Number(pid), 'SIGKILL')
        } catch {
          /* pid already gone */
        }
      }
      await new Promise((r) => setTimeout(r, 300))
    }
  } catch {
    // no process on port — expected
  }

  const binary = await ensureBinary()

  const args = [
    '-m',
    modelPath,
    '--port',
    String(_port),
    '-c',
    String(contextSize),
    '-ngl',
    String(nGpuLayers),
    '--jinja',
    '--no-webui',
    '-fa',
    'auto',
    '--slots',
    '-np',
    '1'
  ]

  logger.info('[llm.server] Starting:', binary, args.join(' '))

  _process = spawn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  })

  let progressSent = 0

  _process.stderr.on('data', (data) => {
    const line = data.toString()
    const progressMatch = line.match(/llama_model_load:\s+(\d+(?:\.\d+)?)%/)
    if (progressMatch) {
      const pct = Math.round(parseFloat(progressMatch[1]))
      if (pct > progressSent) {
        progressSent = pct
        _onProgress?.(pct)
      }
    }
    if (line.includes('error') || line.includes('Error')) {
      logger.warn('[llm.server]', line.trim())
    }
  })

  _process.stdout.on('data', (data) => {
    const line = data.toString()
    if (line.includes('error') || line.includes('Error')) {
      logger.warn('[llm.server]', line.trim())
    }
  })

  _process.on('exit', (code, signal) => {
    logger.info(`[llm.server] Exited code=${code} signal=${signal}`)
    _process = null
    _ready = false
  })

  _process.on('error', (err) => {
    logger.error('[llm.server] Spawn error:', err.message)
    _process = null
    _ready = false
  })

  await waitForHealth()
  _ready = true
  logger.info('[llm.server] Server ready on port', _port)
}

export async function stopServer() {
  if (!_process) return
  const proc = _process
  _process = null
  _ready = false
  _modelPath = null

  proc.kill('SIGTERM')

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL')
      } catch {
        /* already exited */
      }
      resolve()
    }, 5000)
    proc.on('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

export function onLoadProgress(handler) {
  _onProgress = handler
}

export function getProcess() {
  return _process
}
