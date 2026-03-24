import { watch } from 'node:fs'
import { opendir } from 'node:fs/promises'
import path from 'node:path'
import { IGNORED_DIRECTORIES } from '../core/constants.js'
import { appendEvent, state } from '../core/state.js'
const RECURSIVE_WATCH_SUPPORTED = true
const normalizeChangedPath = (basePath, fileName) => {
  const normalizedName = String(fileName || '').trim()
  if (!normalizedName) {
    return basePath
  }
  return path.resolve(basePath, normalizedName)
}
const isIgnoredDirectory = (directoryName) => IGNORED_DIRECTORIES.has(String(directoryName || ''))
const closeWatcherHandle = (watcherHandle) => {
  if (!watcherHandle) {
    return
  }
  try {
    watcherHandle.close()
  } catch {
    return
  }
}
const collectDirectoryPaths = async (rootFolder) => {
  const directories = [rootFolder]
  const pendingDirectories = [rootFolder]
  while (pendingDirectories.length) {
    const currentFolder = pendingDirectories.pop()
    let directoryHandle
    try {
      directoryHandle = await opendir(currentFolder)
    } catch {
      continue
    }
    for await (const entry of directoryHandle) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || isIgnoredDirectory(entry.name)) {
        continue
      }
      const absolutePath = path.join(currentFolder, entry.name)
      directories.push(absolutePath)
      pendingDirectories.push(absolutePath)
    }
  }
  return directories
}
const createRecursiveFolderWatcher = (folderPath, onWatchEvent) => {
  const watcher = watch(
    folderPath,
    {
      recursive: true
    },
    (eventType, fileName) => {
      onWatchEvent({
        folderPath,
        changedPath: normalizeChangedPath(folderPath, fileName),
        needsWatcherRefresh: false,
        shouldHealRoot: eventType === 'rename'
      })
    }
  )
  watcher.on('error', () => {
    onWatchEvent({
      folderPath,
      changedPath: folderPath,
      needsWatcherRefresh: true
    })
  })
  return {
    close() {
      watcher.close()
    }
  }
}
const createDirectoryWatcher = (folderPath, directoryPath, onWatchEvent) => {
  const watcher = watch(directoryPath, (eventType, fileName) => {
    onWatchEvent({
      folderPath,
      changedPath: normalizeChangedPath(directoryPath, fileName),
      needsWatcherRefresh: eventType === 'rename' || !fileName,
      shouldHealRoot: eventType === 'rename'
    })
  })
  watcher.on('error', () => {
    onWatchEvent({
      folderPath,
      changedPath: directoryPath,
      needsWatcherRefresh: true
    })
  })
  return watcher
}
const createFallbackFolderWatcher = async (folderPath, onWatchEvent) => {
  const directoryPaths = await collectDirectoryPaths(folderPath)
  const watchers = directoryPaths.map((directoryPath) =>
    createDirectoryWatcher(folderPath, directoryPath, onWatchEvent)
  )
  return {
    close() {
      for (const watcher of watchers) {
        watcher.close()
      }
    }
  }
}
const createFolderWatcher = async (folderPath, onWatchEvent) => {
  if (RECURSIVE_WATCH_SUPPORTED) {
    try {
      return createRecursiveFolderWatcher(folderPath, onWatchEvent)
    } catch {
      return createFallbackFolderWatcher(folderPath, onWatchEvent)
    }
  }
  return createFallbackFolderWatcher(folderPath, onWatchEvent)
}
export const clearFolderWatchers = () => {
  for (const watcherHandle of state.folderWatchers.values()) {
    closeWatcherHandle(watcherHandle)
  }
  state.folderWatchers.clear()
}
export const refreshFolderWatcher = async (folderPath, onWatchEvent) => {
  closeWatcherHandle(state.folderWatchers.get(folderPath))
  state.folderWatchers.delete(folderPath)
  try {
    const watcherHandle = await createFolderWatcher(folderPath, onWatchEvent)
    state.folderWatchers.set(folderPath, watcherHandle)
  } catch (error) {
    appendEvent('warning', `Failed to watch ${folderPath}: ${error?.message || 'Unknown error'}`)
  }
}
export const syncFolderWatchers = async (folders, onWatchEvent) => {
  const nextFolders = new Set(folders)
  for (const [folderPath, watcherHandle] of state.folderWatchers.entries()) {
    if (nextFolders.has(folderPath)) {
      continue
    }
    closeWatcherHandle(watcherHandle)
    state.folderWatchers.delete(folderPath)
  }
  for (const folderPath of folders) {
    if (state.folderWatchers.has(folderPath)) {
      continue
    }
    await refreshFolderWatcher(folderPath, onWatchEvent)
  }
}
