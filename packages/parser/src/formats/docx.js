import { readZipEntries, extractTagContent, truncate } from './xml.js'
export default async (filePath, maxChars) => {
  const entries = await readZipEntries(filePath, /^word\/(document|header\d*|footer\d*)\.xml$/i)
  const parts = []
  let totalLen = 0
  for (const entry of entries) {
    if (totalLen >= maxChars) break
    const text = extractTagContent(entry.text, 'w:t')
    if (text) {
      parts.push(text)
      totalLen += text.length
    }
  }
  return truncate(parts.join('\n'), maxChars)
}
