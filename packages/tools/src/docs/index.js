export { createWordDocument } from './word.js'
export { createPdfDocument } from './pdf.js'
export { createPresentationDocument } from './pptx.js'
export {
  resolvePathInputFromPayload,
  resolveDocxPath,
  resolvePathWithExtension,
  normalizeHexColor,
  normalizeBlockStyle,
  resolveDocumentContent,
  parseBlocksFromContent,
  normalizeStructuredBlocks,
  toDocxHalfPoints,
  toDocxTwips
} from './utils.js'
