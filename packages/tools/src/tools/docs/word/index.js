import { WORD_TOOL_DEFINITIONS } from './def.js'
import { createWordDocument } from './execute.js'

export const wordDocumentTool = {
  definition: WORD_TOOL_DEFINITIONS[0],
  execute: () => (payload) => createWordDocument(payload)
}
export { WORD_TOOL_DEFINITIONS, createWordDocument }
