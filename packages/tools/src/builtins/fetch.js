import { convert } from 'html-to-text'
import { assertPublicUrl } from '../network.js'
const definition = {
  name: 'fetch_webpage',
  readOnly: true,
  description:
    'Fetch a webpage and extract its text content. Use after web_search to read a specific result, or when the user provides a URL.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch.'
      }
    },
    required: ['url']
  }
}
function execute(ctx) {
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
      assertPublicUrl(url)
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VoxBot/1.0; +https://vox-ai.chat)',
          Accept: 'text/html,application/xhtml+xml,text/plain'
        },
        signal: AbortSignal.timeout(10_000)
      })
      if (!res.ok)
        return {
          error: `Fetch failed with status ${res.status}`
        }
      const html = await res.text()
      const text = convert(html, {
        wordwrap: false,
        preserveNewlines: false
      })
      return {
        url,
        content: text
      }
    } catch (err) {
      return {
        error: err.message
      }
    }
  }
}
export const fetchWebpageTool = {
  definition,
  execute
}
export { definition as FETCH_TOOL_DEFINITION }
