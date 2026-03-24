import path from 'path'
import { clampNumber } from '../schema.js'
import { resolveLocalPath } from '../builtins/fs.js'
export { clampNumber, resolveLocalPath }
export const resolvePathInputFromPayload = (payload) => {
  const safePayload = payload && typeof payload === 'object' ? payload : {}
  const directCandidates = [
    safePayload.path,
    safePayload.filePath,
    safePayload.file_path,
    safePayload.targetPath,
    safePayload.target_path,
    safePayload.outputPath,
    safePayload.output_path
  ]
  for (const candidate of directCandidates) {
    const normalized = String(candidate || '').trim()
    if (normalized) return normalized
  }
  const filenameCandidates = [
    safePayload.filename,
    safePayload.fileName,
    safePayload.name,
    safePayload.outputName,
    safePayload.output_name
  ]
  const directoryCandidates = [
    safePayload.directory,
    safePayload.dir,
    safePayload.folder,
    safePayload.parentPath,
    safePayload.parent_path
  ]
  let filename = ''
  let directory = ''
  for (const candidate of filenameCandidates) {
    const normalized = String(candidate || '').trim()
    if (normalized) {
      filename = normalized
      break
    }
  }
  for (const candidate of directoryCandidates) {
    const normalized = String(candidate || '').trim()
    if (normalized) {
      directory = normalized
      break
    }
  }
  if (filename && directory) return path.join(directory, filename)
  if (filename) return filename
  return ''
}
export const resolveDocxPath = (inputPath) => {
  const resolvedPath = resolveLocalPath(inputPath)
  const ext = path.extname(resolvedPath).toLowerCase()
  if (ext === '.docx') return resolvedPath
  if (!ext) return `${resolvedPath}.docx`
  return resolvedPath
}
export const resolvePathWithExtension = (inputPath, extension) => {
  const normalizedExt = String(extension || '')
    .trim()
    .toLowerCase()
  if (!normalizedExt.startsWith('.')) throw new Error('Extension must start with a dot.')
  const resolvedPath = resolveLocalPath(inputPath)
  const currentExt = path.extname(resolvedPath).toLowerCase()
  if (currentExt === normalizedExt) return resolvedPath
  if (!currentExt) return `${resolvedPath}${normalizedExt}`
  return resolvedPath
}
export const normalizeHexColor = (value, fallback = '000000') => {
  const normalized = String(value || '')
    .trim()
    .replace(/^#/, '')
  if (/^[0-9a-f]{6}$/i.test(normalized)) return normalized.toUpperCase()
  return String(fallback || '000000')
    .trim()
    .replace(/^#/, '')
    .toUpperCase()
}
export const normalizeBlockStyle = (style) => {
  const safeStyle = style && typeof style === 'object' ? style : {}
  return {
    size: clampNumber(safeStyle.size, null, 8, 72),
    color: safeStyle.color ? normalizeHexColor(safeStyle.color, '222222') : '',
    bold: Boolean(safeStyle.bold),
    italic: Boolean(safeStyle.italic),
    align: safeStyle.align,
    indent: clampNumber(safeStyle.indent, 0, 0, 2000),
    spacingBefore: clampNumber(safeStyle.spacingBefore, 0, 0, 120),
    spacingAfter: clampNumber(safeStyle.spacingAfter, 8, 0, 120)
  }
}
export const resolveDocumentContent = (payload) => {
  const safePayload = payload && typeof payload === 'object' ? payload : {}
  const candidateValues = [
    safePayload.content,
    safePayload.body,
    safePayload.text,
    safePayload.markdown,
    safePayload.document
  ]
  for (const value of candidateValues) {
    if (value == null) continue
    const normalized = String(value)
    if (normalized.trim()) return normalized
  }
  for (const value of candidateValues) {
    if (value != null) return String(value)
  }
  return ''
}
export const parseBlocksFromContent = (content) => {
  if (!String(content || '').trim()) return []
  const lines = String(content || '').split(/\r?\n/)
  return lines.map((line) => {
    const normalizedLine = String(line || '')
    if (!normalizedLine.trim())
      return {
        type: 'separator',
        text: ''
      }
    if (normalizedLine.startsWith('### '))
      return {
        type: 'heading',
        level: 3,
        text: normalizedLine.replace(/^###\s+/, '')
      }
    if (normalizedLine.startsWith('## '))
      return {
        type: 'heading',
        level: 2,
        text: normalizedLine.replace(/^##\s+/, '')
      }
    if (normalizedLine.startsWith('# '))
      return {
        type: 'heading',
        level: 1,
        text: normalizedLine.replace(/^#\s+/, '')
      }
    if (normalizedLine.startsWith('- ') || normalizedLine.startsWith('* '))
      return {
        type: 'bullet',
        text: normalizedLine.replace(/^[-*]\s+/, '')
      }
    if (normalizedLine.startsWith('> '))
      return {
        type: 'quote',
        text: normalizedLine.replace(/^>\s+/, '')
      }
    return {
      type: 'paragraph',
      text: normalizedLine
    }
  })
}
export const normalizeStructuredBlocks = (payload) => {
  const resolvedContent = resolveDocumentContent(payload)
  const sourceBlocks = Array.isArray(payload?.blocks)
    ? payload.blocks
    : parseBlocksFromContent(resolvedContent)
  return sourceBlocks
    .map((block) => {
      const safeBlock =
        block && typeof block === 'object'
          ? block
          : {
              text: String(block || '')
            }
      const rawType = String(safeBlock.type || 'paragraph')
        .trim()
        .toLowerCase()
      const type = ['heading', 'paragraph', 'bullet', 'quote', 'separator'].includes(rawType)
        ? rawType
        : 'paragraph'
      const level = clampNumber(safeBlock.level, 1, 1, 4)
      const text = String(safeBlock.text || '')
      const items = Array.isArray(safeBlock.items)
        ? safeBlock.items.map((item) => String(item || '').trim()).filter(Boolean)
        : []
      return {
        type,
        level,
        text,
        items,
        style: normalizeBlockStyle(safeBlock.style)
      }
    })
    .filter((block) => block.type === 'separator' || block.text.trim() || block.items.length > 0)
}
export const toDocxHalfPoints = (points) => Math.round(Number(points || 0) * 2)
export const toDocxTwips = (points) => Math.round(Number(points || 0) * 20)
