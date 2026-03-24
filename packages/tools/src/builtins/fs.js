import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import { clampNumber } from '../schema.js'
function resolveLocalPath(inputPath) {
  const raw = String(inputPath || '').trim()
  if (!raw) throw new Error('Path is required.')
  const expanded =
    raw === '~' || raw.startsWith('~/') || raw.startsWith('~\\')
      ? path.join(os.homedir(), raw.slice(1))
      : raw
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(os.homedir(), expanded)
}
const BLOCKED_PATHS = new Set([
  '/',
  '/System',
  '/usr',
  '/bin',
  '/sbin',
  '/var',
  '/etc',
  '/Applications',
  '/Library'
])
function isBlockedPath(target) {
  const normalized = path.resolve(target)
  return BLOCKED_PATHS.has(normalized) || normalized === os.homedir()
}
const writeFileDef = {
  name: 'write_local_file',
  description:
    "Create or update a local file on the user's machine. Supports text and base64 payloads for binary files.",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Target file path. Supports absolute paths and ~/ shortcuts.'
      },
      content: {
        type: 'string',
        description: 'File content. For binary writes, provide base64 and set encoding to base64.'
      },
      encoding: {
        type: 'string',
        description: 'Content encoding: utf8 or base64. Defaults to utf8.'
      },
      append: {
        type: 'boolean',
        description: 'Append instead of overwrite. Defaults to false.'
      },
      createParents: {
        type: 'boolean',
        description: 'Create missing parent directories. Defaults to true.'
      }
    },
    required: ['path']
  }
}
const readFileDef = {
  name: 'read_local_file',
  description:
    "Read a local file from the user's machine. Returns text content (utf8) or base64 for binary files.",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Target file path. Supports absolute paths and ~/ shortcuts.'
      },
      maxChars: {
        type: 'integer',
        description: 'Maximum characters to return in utf8 mode (default 60000, max 120000).'
      },
      maxBytes: {
        type: 'integer',
        description: 'Maximum bytes to return in base64 mode (default 120000, max 500000).'
      },
      encoding: {
        type: 'string',
        description: 'Read encoding: utf8 or base64. Defaults to utf8.'
      }
    },
    required: ['path']
  }
}
const listDirDef = {
  name: 'list_local_directory',
  description: "List files and folders from a local directory on the user's machine.",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path. Supports absolute paths and ~/ shortcuts. Defaults to home.'
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include dotfiles. Defaults to false.'
      },
      includeDetails: {
        type: 'boolean',
        description: 'Include size and modified time. Defaults to true.'
      },
      limit: {
        type: 'integer',
        description: 'Max entries to return (default 300, max 2000).'
      }
    }
  }
}
const deletePathDef = {
  name: 'delete_local_path',
  description:
    'Delete a local file or folder. Use only when the user explicitly asks to delete something.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Target file or folder path.'
      },
      recursive: {
        type: 'boolean',
        description: 'Allow deleting directories recursively. Defaults to true.'
      },
      force: {
        type: 'boolean',
        description: 'Ignore missing files. Defaults to false.'
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview only, no deletion. Defaults to false.'
      }
    },
    required: ['path']
  }
}
const scratchDirDef = {
  name: 'get_scratch_dir',
  description:
    'Create a dedicated temp working directory for this task. Returns the absolute path.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Optional folder identifier. Random ID used if omitted.'
      }
    }
  }
}
async function writeLocalFile(args) {
  const targetPath = resolveLocalPath(args?.path)
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
  if (shouldAppend) {
    await fs.appendFile(targetPath, buf)
  } else {
    await fs.writeFile(targetPath, buf)
  }
  const stats = await fs.stat(targetPath)
  return {
    path: targetPath,
    bytesWritten: buf.length,
    fileSize: stats.size,
    mode: shouldAppend ? 'append' : 'overwrite',
    encoding
  }
}
async function readLocalFile(args) {
  const targetPath = resolveLocalPath(args?.path)
  const enc = String(args?.encoding || 'utf8')
    .trim()
    .toLowerCase()
  const encoding = enc === 'base64' ? 'base64' : 'utf8'
  const fileStats = await fs.stat(targetPath)
  const fileBuffer = await fs.readFile(targetPath)
  if (encoding === 'base64') {
    return {
      path: targetPath,
      content: fileBuffer.toString('base64'),
      encoding,
      truncated: false,
      returnedBytes: fileBuffer.length,
      size: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString()
    }
  }
  const text = fileBuffer.toString('utf8')
  return {
    path: targetPath,
    content: text,
    encoding,
    truncated: false,
    size: fileStats.size,
    modifiedAt: fileStats.mtime.toISOString()
  }
}
async function listLocalDirectory(args) {
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
async function deleteLocalPath(args) {
  const targetPath = resolveLocalPath(args?.path)
  const recursive = args?.recursive !== false
  const force = Boolean(args?.force)
  const dryRun = Boolean(args?.dryRun)
  if (isBlockedPath(targetPath)) throw new Error('Refusing to delete a system or root directory.')
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
async function getScratchDir(args) {
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
export const writeLocalFileTool = {
  definition: writeFileDef,
  execute: () => writeLocalFile
}
export const readLocalFileTool = {
  definition: readFileDef,
  execute: () => readLocalFile
}
export const listLocalDirectoryTool = {
  definition: listDirDef,
  execute: () => listLocalDirectory
}
export const deleteLocalPathTool = {
  definition: deletePathDef,
  execute: () => deleteLocalPath
}
export const getScratchDirTool = {
  definition: scratchDirDef,
  execute: () => getScratchDir
}
export const FS_TOOLS = [
  writeLocalFileTool,
  readLocalFileTool,
  listLocalDirectoryTool,
  deleteLocalPathTool,
  getScratchDirTool
]
export const FS_TOOL_DEFINITIONS = FS_TOOLS.map((t) => t.definition)
export {
  resolveLocalPath,
  writeLocalFile,
  readLocalFile,
  listLocalDirectory,
  deleteLocalPath,
  getScratchDir
}
