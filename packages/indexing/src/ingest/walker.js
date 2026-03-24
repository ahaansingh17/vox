import { opendir } from 'node:fs/promises'
import path from 'node:path'
import { IGNORED_DIRECTORIES } from '../runtime/core/constants.js'
const shouldIgnoreDir = (dirName) => {
  if (!dirName) {
    return false
  }
  return IGNORED_DIRECTORIES.has(dirName)
}
export async function* walkFiles(rootFolder) {
  const pendingFolders = [rootFolder]
  while (pendingFolders.length) {
    const currentFolder = pendingFolders.pop()
    let directoryHandle
    try {
      directoryHandle = await opendir(currentFolder)
    } catch {
      continue
    }
    const entries = []
    for await (const entry of directoryHandle) {
      entries.push(entry)
    }
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue
      }
      const absolutePath = path.join(currentFolder, entry.name)
      if (entry.isDirectory()) {
        if (!shouldIgnoreDir(entry.name)) {
          pendingFolders.push(absolutePath)
        }
        continue
      }
      if (!entry.isFile()) {
        continue
      }
      yield absolutePath
    }
  }
}
