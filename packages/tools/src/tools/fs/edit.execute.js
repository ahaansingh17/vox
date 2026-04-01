import fs from 'fs/promises'
import path from 'path'
import { resolveLocalPath, isBlockedPath } from './path.js'
import { readState } from './read.state.js'

function normalizeQuotes(str) {
  return str.replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"')
}

function countOccurrences(content, searchStr) {
  if (!searchStr) return 0
  let count = 0
  let pos = 0
  const normContent = normalizeQuotes(content)
  const normSearch = normalizeQuotes(searchStr)
  while (true) {
    pos = normContent.indexOf(normSearch, pos)
    if (pos === -1) break
    count++
    pos += normSearch.length
  }
  return count
}

export async function editLocalFile(args) {
  const targetPath = resolveLocalPath(args?.path)
  const oldString = args?.old_string
  const newString = args?.new_string ?? ''
  const replaceAll = Boolean(args?.replace_all)

  if (oldString === undefined || oldString === null) {
    throw new Error('old_string is required')
  }

  if (isBlockedPath(targetPath)) {
    throw new Error('Refusing to edit a system or root path.')
  }

  const stat = await fs.stat(targetPath)
  if (!stat.isFile()) throw new Error('Path is not a file.')

  if (stat.size > 1024 * 1024 * 100) {
    throw new Error('File too large to edit (>100MB). Use write_local_file instead.')
  }

  const tracked = readState.get(targetPath)
  if (tracked && stat.mtimeMs > tracked.mtimeMs) {
    throw new Error(
      'File was modified since last read. Re-read the file before editing to get fresh content.'
    )
  }

  const content = await fs.readFile(targetPath, 'utf8')

  const occurrences = countOccurrences(content, oldString)

  if (occurrences === 0) {
    throw new Error(
      'old_string not found in file. Make sure it matches the file content exactly, including whitespace and indentation.'
    )
  }

  if (occurrences > 1 && !replaceAll) {
    throw new Error(
      `old_string matches ${occurrences} locations. Use replace_all=true to replace all, or provide a more specific old_string that matches exactly once.`
    )
  }

  const normContent = normalizeQuotes(content)
  const normSearch = normalizeQuotes(oldString)
  let updated
  if (replaceAll) {
    updated = normContent.split(normSearch).join(newString)
  } else {
    const idx = normContent.indexOf(normSearch)
    updated = content.slice(0, idx) + newString + content.slice(idx + normSearch.length)
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, updated, 'utf8')

  const newStat = await fs.stat(targetPath)
  readState.set(targetPath, { mtimeMs: newStat.mtimeMs })

  return {
    path: targetPath,
    replacements: replaceAll ? occurrences : 1,
    fileSize: newStat.size
  }
}
