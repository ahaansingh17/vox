import { readZipEntries, stripTags, truncate } from './xml.js'
export default async (filePath, maxChars) => {
  const entries = await readZipEntries(filePath, /^content\.xml$/i)
  if (!entries.length)
    return {
      text: '',
      truncated: false
    }
  const text = stripTags(entries[0].text)
  return truncate(text, maxChars)
}
