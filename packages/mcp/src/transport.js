import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export function parseCommand(command) {
  const parts = []
  let current = ''
  let inSingle = false
  let inDouble = false
  for (const ch of command) {
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
    else if (ch === ' ' && !inSingle && !inDouble) {
      if (current) {
        parts.push(current)
        current = ''
      }
    } else current += ch
  }
  if (current) parts.push(current)
  return parts
}

export function makeTransport(server) {
  const headers = {}
  if (server.auth_header) headers['Authorization'] = server.auth_header
  switch (server.transport) {
    case 'stdio': {
      const parts = parseCommand(server.command)
      if (!parts.length) throw new Error(`Invalid MCP command: "${server.command}"`)
      const env = {}
      let i = 0
      while (i < parts.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(parts[i])) {
        const eq = parts[i].indexOf('=')
        env[parts[i].slice(0, eq)] = parts[i].slice(eq + 1)
        i++
      }
      if (i >= parts.length)
        throw new Error(`Invalid MCP command (no executable): "${server.command}"`)
      return new StdioClientTransport({
        command: parts[i],
        args: parts.slice(i + 1),
        env: { ...process.env, ...env }
      })
    }
    case 'sse':
      return new SSEClientTransport(new URL(server.url), {
        eventSourceInit: { headers },
        requestInit: { headers }
      })
    case 'http':
      return new StreamableHTTPClientTransport(new URL(server.url), {
        requestInit: { headers }
      })
    default:
      throw new Error(`Unknown MCP transport: ${server.transport}`)
  }
}
