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
} from './fs.js'
export { runLocalCommandTool, SHELL_TOOL_DEFINITION, runLocalCommand } from './shell.js'
export { fetchWebpageTool, FETCH_TOOL_DEFINITION } from './fetch.js'
import { FS_TOOLS } from './fs.js'
import { runLocalCommandTool } from './shell.js'
import { fetchWebpageTool } from './fetch.js'
export const ALL_BUILTIN_TOOLS = [...FS_TOOLS, runLocalCommandTool, fetchWebpageTool]
export const ALL_BUILTIN_DEFINITIONS = ALL_BUILTIN_TOOLS.map((t) => t.definition)
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
