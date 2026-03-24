import { FS_TOOLS } from './fs/index.js'
import { runLocalCommandTool } from './shell/index.js'
import { fetchWebpageTool } from './fetch/index.js'
import { wordDocumentTool } from './docs/word/index.js'
import { pdfDocumentTool } from './docs/pdf/index.js'
import { pptxDocumentTool } from './docs/pptx/index.js'

export const ALL_TOOLS = [
  ...FS_TOOLS,
  runLocalCommandTool,
  fetchWebpageTool,
  wordDocumentTool,
  pdfDocumentTool,
  pptxDocumentTool
]

export { FS_TOOLS } from './fs/index.js'
export { runLocalCommandTool } from './shell/index.js'
export { fetchWebpageTool } from './fetch/index.js'
export { wordDocumentTool } from './docs/word/index.js'
export { pdfDocumentTool } from './docs/pdf/index.js'
export { pptxDocumentTool } from './docs/pptx/index.js'
