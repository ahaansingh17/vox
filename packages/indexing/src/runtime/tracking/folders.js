import { homedir } from 'node:os'
import path from 'node:path'
export { isSameOrNestedPath } from '../core/utils.js'
import { stat } from 'node:fs/promises'
import { openKnowledgeDb } from '../../db/db.js'
import { kvDelete, kvGet, kvSet } from '../../db/metadata.js'
const INDEX_FOLDERS_KEY = 'indexing.folders'
const INDEX_FOLDERS_INITIALIZED_KEY = 'indexing.folders.initialized'
const isDirectoryPath = async (folderPath) => {
  try {
    const folderStats = await stat(folderPath)
    return folderStats.isDirectory()
  } catch {
    return false
  }
}
const normalizeStoredFolders = (foldersInput) => {
  if (!Array.isArray(foldersInput)) {
    return []
  }
  const uniqueFolders = []
  const seenFolders = new Set()
  for (const value of foldersInput) {
    const normalizedPath = path.resolve(String(value || '').trim())
    if (!normalizedPath) {
      continue
    }
    const normalizedKey = normalizedPath.toLowerCase()
    if (seenFolders.has(normalizedKey)) {
      continue
    }
    seenFolders.add(normalizedKey)
    uniqueFolders.push(normalizedPath)
  }
  return uniqueFolders
}
export const validateTrackedFolders = async (foldersInput) => {
  const normalizedFolders = normalizeStoredFolders(foldersInput)
  const validFolders = []
  for (const folderPath of normalizedFolders) {
    if (await isDirectoryPath(folderPath)) {
      validFolders.push(folderPath)
    }
  }
  return validFolders
}
const resolveDefaultIndexFolders = async () => {
  const homePath = homedir()
  const candidateFolders = []
  if (homePath) {
    for (const folderName of ['Documents', 'Downloads']) {
      candidateFolders.push(path.join(homePath, folderName))
    }
  }
  if (!candidateFolders.length) {
    if (homePath) {
      candidateFolders.push(homePath)
    }
  }
  return validateTrackedFolders(candidateFolders)
}
const readStoredFolders = () => {
  const rawValue = kvGet(INDEX_FOLDERS_KEY)
  if (rawValue === null) {
    return []
  }
  try {
    return JSON.parse(rawValue)
  } catch {
    return []
  }
}
const persistTrackedFolders = (folders) => {
  kvSet(INDEX_FOLDERS_KEY, JSON.stringify(folders))
  kvSet(INDEX_FOLDERS_INITIALIZED_KEY, '1')
}
export const getStoredTrackedFolders = async () => {
  await openKnowledgeDb()
  const initialized = kvGet(INDEX_FOLDERS_INITIALIZED_KEY) === '1'
  if (!initialized) {
    const defaultFolders = await resolveDefaultIndexFolders()
    persistTrackedFolders(defaultFolders)
    return defaultFolders
  }
  const validFolders = await validateTrackedFolders(readStoredFolders())
  persistTrackedFolders(validFolders)
  return validFolders
}
export const setStoredTrackedFolders = async (foldersInput) => {
  await openKnowledgeDb()
  const validFolders = await validateTrackedFolders(foldersInput)
  persistTrackedFolders(validFolders)
  return validFolders
}
export const resetStoredTrackedFolders = async () => {
  await openKnowledgeDb()
  kvDelete(INDEX_FOLDERS_KEY)
  kvDelete(INDEX_FOLDERS_INITIALIZED_KEY)
}
