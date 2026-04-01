import { definition } from './def.js'
import { runLocalCommand, isReadOnlyCommand } from './execute.js'

export const runLocalCommandTool = { definition, execute: () => runLocalCommand }
export { definition as SHELL_TOOL_DEFINITION, runLocalCommand, isReadOnlyCommand }
