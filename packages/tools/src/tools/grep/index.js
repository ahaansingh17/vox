import { definition } from './def.js'
import { grepLocal } from './execute.js'

export const grepLocalTool = { definition, execute: () => grepLocal }
export { definition as GREP_TOOL_DEFINITION, grepLocal }
