import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import { clampNumber } from '../../core/schema.js'
import { readDocumentFile, PARSED_EXTENSIONS } from '@vox-ai-app/parser'
import { resolveLocalPath, isBlockedPath } from './path.js'
import { readState } from './read.state.js'
export { resolveLocalPath }

const BLOCKED_DEVICE_PREFIXES = ['/dev/', '/proc/', '/sys/class/', '/sys/block/']
const BLOCKED_DEVICE_EXACT = new Set([
  '/dev/zero',
  '/dev/null',
  '/dev/random',
  '/dev/urandom',
  '/dev/stdin',
  '/dev/stdout',
  '/dev/stderr'
])

function isDevicePath(p) {
  const normalized = path.resolve(p)
  if (BLOCKED_DEVICE_EXACT.has(normalized)) return true
  return BLOCKED_DEVICE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

async function findSimilarFiles(targetPath) {
  try {
    const dir = path.dirname(targetPath)
    const base = path.basename(targetPath).toLowerCase()
    const entries = await fs.readdir(dir).catch(() => [])
    return entries
      .filter((name) => {
        const lower = name.toLowerCase()
        if (lower === base) return false
        const dist = levenshtein(lower, base)
        return dist <= 3 || lower.includes(base) || base.includes(lower)
      })
      .slice(0, 5)
      .map((name) => path.join(dir, name))
  } catch {
    return []
  }
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[b.length][a.length]
}
export async function writeLocalFile(args) {
  const targetPath = resolveLocalPath(args?.path)
  if (isBlockedPath(targetPath)) {
    throw new Error('Refusing to write to a system or root directory.')
  }
  const enc = String(args?.encoding || 'utf8')
    .trim()
    .toLowerCase()
  const encoding = enc === 'base64' ? 'base64' : 'utf8'
  const raw = args?.content == null ? '' : String(args.content)
  const buf = encoding === 'base64' ? Buffer.from(raw, 'base64') : Buffer.from(raw, 'utf8')
  const shouldAppend = Boolean(args?.append)
  const createParents = args?.createParents !== false
  if (createParents)
    await fs.mkdir(path.dirname(targetPath), {
      recursive: true
    })
  const tracked = readState.get(targetPath)
  if (tracked && !shouldAppend) {
    try {
      const currentStat = await fs.stat(targetPath)
      if (currentStat.mtimeMs > tracked.mtimeMs) {
        throw new Error(
          'File was modified since last read. Re-read the file before writing to avoid overwriting changes.'
        )
      }
    } catch (e) {
      if (e?.code !== 'ENOENT') throw e
    }
  }
  if (shouldAppend) {
    await fs.appendFile(targetPath, buf)
  } else {
    await fs.writeFile(targetPath, buf)
  }
  const stats = await fs.stat(targetPath)
  readState.set(targetPath, { mtimeMs: stats.mtimeMs })
  return {
    path: targetPath,
    bytesWritten: buf.length,
    fileSize: stats.size,
    mode: shouldAppend ? 'append' : 'overwrite',
    encoding
  }
}
export async function readLocalFile(args) {
  const targetPath = resolveLocalPath(args?.path)

  if (isDevicePath(targetPath)) {
    throw new Error('Reading device files is not allowed.')
  }

  const enc = String(args?.encoding || 'utf8')
    .trim()
    .toLowerCase()
  const encoding = enc === 'base64' ? 'base64' : 'utf8'
  const ext = path.extname(targetPath).toLowerCase()

  let fileStats
  try {
    fileStats = await fs.stat(targetPath)
  } catch (e) {
    if (e?.code === 'ENOENT') {
      const similar = await findSimilarFiles(targetPath)
      const hint = similar.length
        ? ` Did you mean one of these?\n${similar.map((s) => `  - ${s}`).join('\n')}`
        : ''
      throw new Error(`File not found: ${targetPath}${hint}`)
    }
    throw e
  }

  readState.set(targetPath, { mtimeMs: fileStats.mtimeMs })

  const useLineRange =
    encoding !== 'base64' &&
    !PARSED_EXTENSIONS.has(ext) &&
    (args?.startLine !== undefined || args?.endLine !== undefined)

  if (encoding !== 'base64' && PARSED_EXTENSIONS.has(ext)) {
    const reqOffset = Number(args?.offset)
    const offset = Number.isFinite(reqOffset) && reqOffset > 0 ? Math.floor(reqOffset) : 0
    const reqLen = Number(args?.length)
    const length =
      Number.isFinite(reqLen) && reqLen > 0 ? Math.min(Math.floor(reqLen), 60000) : 30000
    const readResult = await readDocumentFile(targetPath)
    if (readResult?.unsupported) {
      throw new Error(
        `Could not extract text from ${ext} file: ${readResult.unsupportedReason || 'unsupported format'}`
      )
    }
    const fullText = String(readResult?.text || '')
    const content = fullText.slice(offset, offset + length)
    const remaining = Math.max(0, fullText.length - offset - content.length)
    return {
      path: targetPath,
      content,
      encoding: 'utf8',
      format: ext.slice(1),
      offset,
      length: content.length,
      remaining,
      total: fullText.length,
      size: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString()
    }
  }

  const fileBuffer = await fs.readFile(targetPath)

  if (encoding === 'base64') {
    const reqOffset = Number(args?.offset)
    const offset = Number.isFinite(reqOffset) && reqOffset > 0 ? Math.floor(reqOffset) : 0
    const reqLen = Number(args?.length)
    const length =
      Number.isFinite(reqLen) && reqLen > 0 ? Math.min(Math.floor(reqLen), 500000) : 120000
    const buf = fileBuffer.subarray(offset, offset + length)
    const remaining = Math.max(0, fileBuffer.length - offset - buf.length)
    return {
      path: targetPath,
      content: buf.toString('base64'),
      encoding,
      offset,
      length: buf.length,
      remaining,
      total: fileBuffer.length,
      size: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString()
    }
  }

  const text = fileBuffer.toString('utf8')

  if (useLineRange) {
    const lines = text.split('\n')
    const startLine = Math.max(1, Math.floor(Number(args?.startLine) || 1))
    const endLine = Math.min(lines.length, Math.floor(Number(args?.endLine) || lines.length))
    const selected = lines.slice(startLine - 1, endLine)
    const content = selected.join('\n')
    return {
      path: targetPath,
      content,
      encoding: 'utf8',
      startLine,
      endLine,
      totalLines: lines.length,
      size: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString()
    }
  }

  const reqOffset = Number(args?.offset)
  const offset = Number.isFinite(reqOffset) && reqOffset > 0 ? Math.floor(reqOffset) : 0
  const reqLen = Number(args?.length)
  const length = Number.isFinite(reqLen) && reqLen > 0 ? Math.min(Math.floor(reqLen), 60000) : 30000
  const content = text.slice(offset, offset + length)
  const remaining = Math.max(0, text.length - offset - content.length)
  return {
    path: targetPath,
    content,
    encoding,
    offset,
    length: content.length,
    remaining,
    total: text.length,
    size: fileStats.size,
    modifiedAt: fileStats.mtime.toISOString()
  }
}
export async function listLocalDirectory(args) {
  const targetPath = args?.path ? resolveLocalPath(args.path) : os.homedir()
  const includeHidden = Boolean(args?.includeHidden)
  const includeDetails = args?.includeDetails !== false
  const limit = clampNumber(args?.limit, 300, 1, 2000)
  const stats = await fs.stat(targetPath)
  if (!stats.isDirectory()) throw new Error('Path is not a directory.')
  const raw = await fs.readdir(targetPath, {
    withFileTypes: true
  })
  const visible = raw.filter((e) => includeHidden || !e.name.startsWith('.'))
  visible.sort((a, b) => {
    const ta = a.isDirectory() ? 0 : 1
    const tb = b.isDirectory() ? 0 : 1
    return ta !== tb ? ta - tb : a.name.localeCompare(b.name)
  })
  const selected = visible.slice(0, limit)
  const entries = await Promise.all(
    selected.map(async (entry) => {
      const p = path.join(targetPath, entry.name)
      const type = entry.isDirectory()
        ? 'directory'
        : entry.isFile()
          ? 'file'
          : entry.isSymbolicLink()
            ? 'symlink'
            : 'other'
      const item = {
        name: entry.name,
        path: p,
        type
      }
      if (!includeDetails) return item
      try {
        const s = await fs.stat(p)
        return {
          ...item,
          size: s.size,
          modifiedAt: s.mtime.toISOString()
        }
      } catch {
        return item
      }
    })
  )
  return {
    path: targetPath,
    includeHidden,
    total: visible.length,
    returned: entries.length,
    truncated: visible.length > entries.length,
    entries
  }
}
export async function deleteLocalPath(args) {
  const targetPath = resolveLocalPath(args?.path)
  const recursive = args?.recursive !== false
  const force = Boolean(args?.force)
  const dryRun = Boolean(args?.dryRun)
  if (isBlockedPath(targetPath)) throw new Error('Refusing to delete a system or root directory.')
  let realTarget
  try {
    realTarget = await fs.realpath(targetPath)
  } catch (e) {
    if (e?.code === 'ENOENT')
      return {
        path: targetPath,
        existed: false,
        deleted: false,
        type: 'missing',
        dryRun
      }
    throw e
  }
  if (isBlockedPath(realTarget)) {
    throw new Error('Refusing to delete: symlink resolves to a protected system path.')
  }
  let existingStats = null
  try {
    existingStats = await fs.lstat(targetPath)
  } catch (e) {
    if (e?.code === 'ENOENT')
      return {
        path: targetPath,
        existed: false,
        deleted: false,
        type: 'missing',
        dryRun
      }
    throw e
  }
  const type = existingStats.isDirectory()
    ? 'directory'
    : existingStats.isFile()
      ? 'file'
      : existingStats.isSymbolicLink()
        ? 'symlink'
        : 'other'
  if (dryRun)
    return {
      path: targetPath,
      existed: true,
      deleted: false,
      type,
      dryRun: true,
      recursive: existingStats.isDirectory() ? recursive : false,
      force
    }
  if (existingStats.isDirectory()) {
    if (!recursive)
      throw new Error('Path is a directory. Set recursive=true to delete directories.')
    await fs.rm(targetPath, {
      recursive: true,
      force
    })
  } else {
    try {
      await fs.unlink(targetPath)
    } catch (e) {
      if (!(force && e?.code === 'ENOENT')) throw e
    }
  }
  return {
    path: targetPath,
    existed: true,
    deleted: true,
    type,
    recursive: existingStats.isDirectory() ? recursive : false,
    force
  }
}
export async function getScratchDir(args) {
  const dirId = String(args?.id || '').trim() || randomUUID()
  const base = String(args?.baseDir || '').trim() || path.join(os.tmpdir(), 'vox-scratch')
  const dirPath = path.join(base, dirId)
  await fs.mkdir(dirPath, {
    recursive: true
  })
  return {
    path: dirPath
  }
}
