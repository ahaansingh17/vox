let AdmZip = null
const getZip = async () => {
  if (!AdmZip) {
    const mod = await import('adm-zip')
    AdmZip = mod?.default || mod
  }
  return AdmZip
}
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
export const extractTagContent = (xml, tag) => {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi')
  const parts = []
  let m
  while ((m = regex.exec(xml)) !== null) {
    const text = m[1].trim()
    if (text) parts.push(decode(text))
  }
  return parts.join(' ')
}
export const stripTags = (xml) =>
  decode(
    xml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
export const readZipEntries = async (filePath, pattern) => {
  const Zip = await getZip()
  const zip = new Zip(filePath)
  return zip
    .getEntries()
    .filter((e) => pattern.test(e.entryName))
    .sort((a, b) =>
      a.entryName.localeCompare(b.entryName, undefined, {
        numeric: true
      })
    )
    .map((e) => ({
      name: e.entryName,
      text: e.getData().toString('utf-8')
    }))
}
export const truncate = (raw, maxChars) => {
  const truncated = raw.length > maxChars
  return {
    text: truncated ? raw.slice(0, maxChars) : raw,
    truncated
  }
}
