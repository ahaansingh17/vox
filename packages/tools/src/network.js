function isPrivateHost(hostname) {
  if (/^localhost$/i.test(hostname)) return true
  const v4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [, a, b] = v4.map(Number)
    return (
      a === 0 ||
      a === 127 ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    )
  }
  const stripped = hostname.replace(/^\[|\]$/g, '')
  return stripped === '::1' || /^fe[89ab]/i.test(stripped) || /^f[cd]/i.test(stripped)
}
export function assertPublicUrl(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are allowed')
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error('Requests to private or internal network addresses are not allowed')
  }
}
export { isPrivateHost }
