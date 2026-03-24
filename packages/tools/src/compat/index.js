export {
  writeLocalFileTool,
  readLocalFileTool,
  listLocalDirectoryTool,
  deleteLocalPathTool,
  getScratchDirTool,
  FS_TOOLS,
  FS_TOOL_DEFINITIONS,
  resolveLocalPath,
  writeLocalFile,
  readLocalFile,
  listLocalDirectory,
  deleteLocalPath,
  getScratchDir
} from '../tools/fs/index.js'
export {
  runLocalCommandTool,
  SHELL_TOOL_DEFINITION,
  runLocalCommand
} from '../tools/shell/index.js'
export { fetchWebpageTool, FETCH_TOOL_DEFINITION } from '../tools/fetch/index.js'

import { FS_TOOLS } from '../tools/fs/index.js'
import { runLocalCommandTool } from '../tools/shell/index.js'
import { fetchWebpageTool } from '../tools/fetch/index.js'
export const ALL_BUILTIN_TOOLS = [...FS_TOOLS, runLocalCommandTool, fetchWebpageTool]
export function loadBuiltinTools(ctx = {}, extras = []) {
  const tools = new Map()
  for (const tool of [...ALL_BUILTIN_TOOLS, ...extras]) {
    tools.set(tool.definition.name, {
      definition: tool.definition,
      execute: tool.execute(ctx)
    })
  }
  return tools
}
