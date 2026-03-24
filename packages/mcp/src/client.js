import fs from 'fs'
import path from 'path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
const CLIENT_INFO = {
  name: 'vox',
  version: '1.0.0'
}
const CONNECT_TIMEOUT_MS = 30_000
let _log = console
export const setLogger = (logger) => {
  if (
    !logger ||
    typeof logger.info !== 'function' ||
    typeof logger.warn !== 'function' ||
    typeof logger.error !== 'function'
  ) {
    throw new TypeError('setLogger expects an object with info, warn, and error methods')
  }
  _log = logger
}
function _sessionsFilePath() {
  const base = process.env.VOX_USER_DATA_PATH
  if (!base) return null
  return path.join(base, 'mcp-sessions.json')
}
function _loadSessions() {
  try {
    const p = _sessionsFilePath()
    if (!p) return {}
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}
function _saveSessions(map) {
  try {
    const p = _sessionsFilePath()
    if (!p) return
    fs.writeFileSync(p, JSON.stringify(map), 'utf8')
  } catch {
    void 0
  }
}
export const getStoredSessionId = (serverId) => _loadSessions()[serverId] ?? null
export const persistSessionId = (serverId, sessionId) => {
  const map = _loadSessions()
  map[serverId] = sessionId
  _saveSessions(map)
}
export const clearSessionId = (serverId) => {
  const map = _loadSessions()
  delete map[serverId]
  _saveSessions(map)
}
export const terminateStaleSession = async (server, sessionId) => {
  if (server.transport !== 'http' || !sessionId) return
  try {
    const headers = {
      'mcp-session-id': sessionId
    }
    if (server.auth_header) headers['Authorization'] = server.auth_header
    await fetch(new URL(server.url), {
      method: 'DELETE',
      headers
    })
    _log.info(
      {
        serverId: server.id,
        sessionId
      },
      'mcp: terminated stale session'
    )
  } catch (err) {
    _log.warn(
      {
        serverId: server.id,
        err: err.message
      },
      'mcp: stale session DELETE failed (ignored)'
    )
  } finally {
    clearSessionId(server.id)
  }
}
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
        env: {
          ...process.env,
          ...env
        }
      })
    }
    case 'sse':
      return new SSEClientTransport(new URL(server.url), {
        eventSourceInit: {
          headers
        },
        requestInit: {
          headers
        }
      })
    case 'http':
      return new StreamableHTTPClientTransport(new URL(server.url), {
        requestInit: {
          headers
        }
      })
    default:
      throw new Error(`Unknown MCP transport: ${server.transport}`)
  }
}
export const connectMcpServer = async (server) => {
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await _doConnect(server)
    } catch (err) {
      if (!String(err?.message).includes('Server transport conflict')) throw err
      lastErr = err
      const delay = (attempt + 1) * 2000
      _log.warn(
        {
          serverId: server.id,
          attempt: attempt + 1,
          delay
        },
        'mcp: transport conflict, retrying'
      )
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}
async function _doConnect(server) {
  const transport = makeTransport(server)
  const client = new Client(CLIENT_INFO, {
    capabilities: {}
  })
  await Promise.race([
    client.connect(transport),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('MCP connect timed out')), CONNECT_TIMEOUT_MS)
    )
  ])
  let tools
  try {
    const result = await client.listTools()
    tools = result?.tools ?? []
  } catch (err) {
    if (err?.name === 'ZodError' || err?.errors) {
      _log.warn(
        {
          serverId: server.id,
          err: err.message
        },
        'mcp: listTools response invalid, defaulting to empty'
      )
      tools = []
    } else {
      throw err
    }
  }
  const sessionId = server.transport === 'http' ? transport.sessionId : undefined
  if (sessionId) persistSessionId(server.id, sessionId)
  _log.info(
    {
      serverId: server.id,
      transport: server.transport,
      count: tools.length
    },
    'mcp: connected'
  )
  return {
    client,
    tools
  }
}
