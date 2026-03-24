import {
  writeLocalFileDef,
  readLocalFileDef,
  listLocalDirectoryDef,
  deleteLocalPathDef,
  getScratchDirDef,
  FS_TOOL_DEFINITIONS
} from './def.js'
import {
  resolveLocalPath,
  writeLocalFile,
  readLocalFile,
  listLocalDirectory,
  deleteLocalPath,
  getScratchDir
} from './execute.js'

export const writeLocalFileTool = { definition: writeLocalFileDef, execute: () => writeLocalFile }
export const readLocalFileTool = { definition: readLocalFileDef, execute: () => readLocalFile }
export const listLocalDirectoryTool = {
  definition: listLocalDirectoryDef,
  execute: () => listLocalDirectory
}
export const deleteLocalPathTool = {
  definition: deleteLocalPathDef,
  execute: () => deleteLocalPath
}
export const getScratchDirTool = { definition: getScratchDirDef, execute: () => getScratchDir }

export const FS_TOOLS = [
  writeLocalFileTool,
  readLocalFileTool,
  listLocalDirectoryTool,
  deleteLocalPathTool,
  getScratchDirTool
]

export {
  FS_TOOL_DEFINITIONS,
  resolveLocalPath,
  writeLocalFile,
  readLocalFile,
  listLocalDirectory,
  deleteLocalPath,
  getScratchDir
}
