import { PPTX_TOOL_DEFINITIONS } from './def.js'
import { createPresentationDocument } from './execute.js'

export const pptxDocumentTool = {
  definition: PPTX_TOOL_DEFINITIONS[0],
  execute: (_ctx) => createPresentationDocument
}
export { PPTX_TOOL_DEFINITIONS, createPresentationDocument }
