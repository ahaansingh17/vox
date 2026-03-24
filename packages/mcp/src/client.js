import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { makeTransport } from './transport.js'
import { persistSessionId, clearSessionId } from './session.js'
export { parseCommand, makeTransport } from './transport.js'
export { getStoredSessionId, persistSessionId, clearSessionId } from './session.js'

const CLIENT_INFO = { name: 'vox', version: '1.0.0' }
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

export const terminateStaleSession = async (server, sessionId) => {
  if (server.transport !== 'http' || !sessionId) return
  try {
    const headers = { 'mcp-session-id': sessionId }
    if (server.auth_header) headers['Authorization'] = server.auth_header
    await fetch(new URL(server.url), { method: 'DELETE', headers })
    _log.info({ serverId: server.id, sessionId }, 'mcp: terminated stale session')
  } catch (err) {
    _log.warn(
      { serverId: server.id, err: err.message },
      'mcp: stale session DELETE failed (ignored)'
    )
  } finally {
    clearSessionId(server.id)
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
