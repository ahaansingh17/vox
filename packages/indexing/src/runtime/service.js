import { pickIndexFolder } from './sync/lifecycle.js'
import { invokeIndexingProcess, shutdownIndexingProcess } from '../process/host.js'
export const bootIndexingRuntime = async () => invokeIndexingProcess('bootIndexingRuntime')
export const shutdownIndexingRuntime = async () => shutdownIndexingProcess()
export const getTrackedIndexFolders = async () => invokeIndexingProcess('getTrackedIndexFolders')
export const addIndexFolder = async (payload) => invokeIndexingProcess('addIndexFolder', payload)
export const removeIndexFolder = async (payload) =>
  invokeIndexingProcess('removeIndexFolder', payload)
export const rebuildIndexing = async () => invokeIndexingProcess('rebuildIndexing')
export const resetIndexingState = async () => invokeIndexingProcess('resetIndexingState')
export const getIndexingStatus = async () => invokeIndexingProcess('getIndexingStatus')
export const getIndexedChildren = async (payload) =>
  invokeIndexingProcess('getIndexedChildren', payload)
export const listIndexedFilesForTool = async (payload) =>
  invokeIndexingProcess('listIndexedFilesForTool', payload)
export const readIndexedFileForTool = async (payload) =>
  invokeIndexingProcess('readIndexedFileForTool', payload)
export const removeIndexedFolderData = async (payload) =>
  invokeIndexingProcess('removeIndexedFolderData', payload)
export const searchIndexedContextForTool = async (payload) =>
  invokeIndexingProcess('searchIndexedContextForTool', payload)
export { pickIndexFolder }
