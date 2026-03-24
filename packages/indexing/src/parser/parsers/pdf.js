import { readFile } from 'fs/promises'
let extractText = null
const load = async () => {
  if (!extractText) {
    const mod = await import('unpdf')
    extractText = mod.extractText
  }
  return extractText
}
export default async (filePath, maxChars) => {
  const extract = await load()
  const data = new Uint8Array(await readFile(filePath))
  const { text } = await extract(data, {
    mergePages: true
  })
  const truncated = text.length > maxChars
  return {
    text: truncated ? text.slice(0, maxChars) : text,
    truncated
  }
}
