import { definition } from './def.js'
import { globLocal } from './execute.js'

export const globLocalTool = { definition, execute: () => globLocal }
export { definition as GLOB_TOOL_DEFINITION, globLocal }
