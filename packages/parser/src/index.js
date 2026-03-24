import path from 'node:path'
import parseDocx from './formats/docx.js'
import parsePdf from './formats/pdf.js'
import parsePptx from './formats/pptx.js'
import parseXlsx from './formats/xlsx.js'
import parseOpenDoc from './formats/opendoc.js'
import parseRtf from './formats/rtf.js'

export { default as parseDocx } from './formats/docx.js'
export { default as parsePdf } from './formats/pdf.js'
export { default as parsePptx } from './formats/pptx.js'
export { default as parseXlsx } from './formats/xlsx.js'
export { default as parseOpenDoc } from './formats/opendoc.js'
export { default as parseRtf } from './formats/rtf.js'

export const PARSED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.odt',
  '.odp',
  '.ods',
  '.rtf',
  '.doc',
  '.docm',
  '.ppt',
  '.pptm',
  '.xls',
  '.xlsm'
])

const PARSERS = {
  '.pdf': parsePdf,
  '.docx': parseDocx,
  '.pptx': parsePptx,
  '.xlsx': parseXlsx,
  '.odt': parseOpenDoc,
  '.odp': parseOpenDoc,
  '.ods': parseOpenDoc,
  '.rtf': parseRtf
}

export async function readDocumentFile(filePath, maxChars = 60000) {
  const ext = path.extname(filePath).toLowerCase()
  const parser = PARSERS[ext]
  if (!parser) {
    return { text: '', unsupported: true, unsupportedReason: `Unsupported document format: ${ext}` }
  }
  try {
    const result = await parser(filePath, maxChars)
    return { text: result?.text || '', truncated: result?.truncated || false }
  } catch (err) {
    return {
      text: '',
      unsupported: true,
      unsupportedReason: `Failed to extract text from ${ext}: ${err?.message || 'unknown error'}`
    }
  }
}
