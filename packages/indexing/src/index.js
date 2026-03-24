export {
  bootIndexingRuntime,
  shutdownIndexingRuntime,
  getTrackedIndexFolders,
  addIndexFolder,
  removeIndexFolder,
  rebuildIndexing,
  resetIndexingState,
  getIndexingStatus,
  getIndexedChildren,
  listIndexedFilesForTool,
  readIndexedFileForTool,
  removeIndexedFolderData,
  searchIndexedContextForTool,
  pickIndexFolder
} from './runtime/service.js'
export { setLogger } from './logger.js'
export { setSentryCapture } from './sentry.js'
