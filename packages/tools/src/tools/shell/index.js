import { definition } from './def.js'
import { runLocalCommand } from './execute.js'

export const runLocalCommandTool = { definition, execute: () => runLocalCommand }
export { definition as SHELL_TOOL_DEFINITION, runLocalCommand }
