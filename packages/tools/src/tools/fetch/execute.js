import { convert } from 'html-to-text'
import { assertPublicUrl, isPrivateHost } from '../../core/network.js'
import dns from 'dns/promises'

async function assertPublicUrlResolved(url) {
  assertPublicUrl(url)
  const parsed = new URL(url)
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) return
  try {
    const { address } = await dns.lookup(hostname)
    if (isPrivateHost(address)) {
      throw new Error(`DNS resolved to private address (${address}). Request blocked.`)
    }
  } catch (e) {
    if (e.message.includes('private address')) throw e
  }
}

export function execute(ctx) {
  return async (args) => {
    const url = args?.url
    if (!url)
      return {
        error: 'url is required'
      }
    if (ctx?.sendEvent)
      ctx.sendEvent('status', {
        message: `Reading: ${url}`
      })
    try {
      await assertPublicUrlResolved(url)
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VoxBot/1.0; +https://vox-ai.chat)',
          Accept: 'text/html,application/xhtml+xml,text/plain'
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000)
      })

      if ([301, 302, 307, 308].includes(res.status)) {
        const location = res.headers.get('location')
        return {
          url,
          redirected: true,
          status: res.status,
          location,
          content: `Redirected (${res.status}) to: ${location}. Fetch the new URL to get content.`
        }
      }

      if (!res.ok)
        return {
          error: `Fetch failed with status ${res.status}`,
          status: res.status
        }
      const html = await res.text()
      const text = convert(html, {
        wordwrap: false,
        preserveNewlines: false
      })
      return {
        url,
        status: res.status,
        content: text
      }
    } catch (err) {
      return {
        error: err.message
      }
    }
  }
}
