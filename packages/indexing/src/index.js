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
export { setLogger } from './telemetry/logger.js'
export { setSentryCapture } from './telemetry/sentry.js'
export {
  ALL_KNOWLEDGE_TOOLS,
  listIndexedFilesTool,
  readIndexedFileTool,
  searchIndexedContextTool
} from './tools.js'
