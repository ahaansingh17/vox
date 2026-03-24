import { PDF_TOOL_DEFINITIONS } from './def.js'
import { createPdfDocument } from './execute.js'

export const pdfDocumentTool = {
  definition: PDF_TOOL_DEFINITIONS[0],
  execute: (_ctx) => createPdfDocument
}
export { PDF_TOOL_DEFINITIONS, createPdfDocument }
