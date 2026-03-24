import path from 'node:path'
import { createReadStream } from 'node:fs'
import { MAX_TEXT_CHARS, TEXT_EXTENSIONS } from '../runtime/core/constants.js'
import { parseOfficeInWorker } from '../parser/pool.js'
export const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.odt',
  '.odp',
  '.ods',
  '.rtf'
])
export const PARSED_DOCUMENT_EXTENSIONS = new Set([
  ...SUPPORTED_DOCUMENT_EXTENSIONS,
  '.doc',
  '.docm',
  '.ppt',
  '.pptm',
  '.xls',
  '.xlsm'
])
const readStructuredTextForIndex = async (filePath) => {
  const { text, truncated } = await parseOfficeInWorker(filePath, MAX_TEXT_CHARS)
  return {
    text,
    truncated,
    containsBinary: false
  }
}
export const normalizeFolderList = (foldersInput) => {
  const normalizedFolders = Array.isArray(foldersInput)
    ? foldersInput.map((folder) => path.resolve(String(folder || '').trim())).filter(Boolean)
    : []
  return [...new Set(normalizedFolders)]
}
export const detectFileKind = (filePath) => {
  const extension = path.extname(filePath).toLowerCase()
  if (TEXT_EXTENSIONS.has(extension)) {
    return 'text'
  }
  return null
}
export const isUnchangedFile = (entry, stats, fileKind) => {
  if (!entry) {
    return false
  }
  return (
    Number(entry.mtimeMs) === Number(stats.mtimeMs) &&
    Number(entry.size) === Number(stats.size) &&
    String(entry.kind || '') === fileKind
  )
}
export const readTextFileForIndex = async (filePath) => {
  const extension = path.extname(filePath).toLowerCase()
  if (PARSED_DOCUMENT_EXTENSIONS.has(extension)) {
    try {
      return await readStructuredTextForIndex(filePath)
    } catch (err) {
      return {
        text: '',
        truncated: false,
        containsBinary: false,
        unsupported: true,
        unsupportedReason: `Failed to extract text from ${extension}: ${err?.message || 'unknown error'}`
      }
    }
  }
  const stream = createReadStream(filePath, {
    encoding: 'utf8',
    highWaterMark: 64 * 1024
  })
  let text = ''
  let truncated = false
  let containsBinary = false
  try {
    for await (const chunk of stream) {
      if (chunk.includes('\u0000')) {
        containsBinary = true
        break
      }
      const availableChars = MAX_TEXT_CHARS - text.length
      if (availableChars <= 0) {
        truncated = true
        break
      }
      if (chunk.length <= availableChars) {
        text += chunk
      } else {
        text += chunk.slice(0, availableChars)
        truncated = true
        break
      }
    }
  } finally {
    stream.destroy()
  }
  return {
    text,
    truncated,
    containsBinary
  }
}
