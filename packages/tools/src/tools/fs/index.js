import {
  writeLocalFileDef,
  readLocalFileDef,
  listLocalDirectoryDef,
  deleteLocalPathDef,
  getScratchDirDef,
  FS_TOOL_DEFINITIONS
} from './def.js'
import { editLocalFileDef } from './edit.def.js'
import {
  resolveLocalPath,
  writeLocalFile,
  readLocalFile,
  listLocalDirectory,
  deleteLocalPath,
  getScratchDir
} from './execute.js'
import { editLocalFile } from './edit.execute.js'

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
export const editLocalFileTool = { definition: editLocalFileDef, execute: () => editLocalFile }

export const FS_TOOLS = [
  writeLocalFileTool,
  readLocalFileTool,
  editLocalFileTool,
  listLocalDirectoryTool,
  deleteLocalPathTool,
  getScratchDirTool
]

export {
  FS_TOOL_DEFINITIONS,
  resolveLocalPath,
  writeLocalFile,
  readLocalFile,
  editLocalFile,
  listLocalDirectory,
  deleteLocalPath,
  getScratchDir
}
