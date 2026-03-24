import { parentPort } from 'worker_threads'
import path from 'path'
import parsePdf from './parsers/pdf.js'
import parseDocx from './parsers/docx.js'
import parsePptx from './parsers/pptx.js'
import parseXlsx from './parsers/xlsx.js'
import parseOpenDoc from './parsers/opendoc.js'
import parseRtf from './parsers/rtf.js'
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
parentPort.on('message', async ({ id, filePath, maxChars }) => {
  try {
    const ext = path.extname(filePath).toLowerCase()
    const parser = PARSERS[ext]
    if (!parser) throw new Error(`Unsupported format: ${ext}`)
    const result = await parser(filePath, maxChars)
    parentPort.postMessage({
      id,
      ...result
    })
  } catch (err) {
    parentPort.postMessage({
      id,
      error: err.message
    })
  }
})
