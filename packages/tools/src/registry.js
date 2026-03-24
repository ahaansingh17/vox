import { connectMcpServer } from '@info-arnav/vox-mcp'

const EXECUTE_TIMEOUT_MS = 30_000
const flat = new Map()
const mcpSlots = new Map()
let _onChange = null
let _changeTimer = null
let _log = console

export const setLogger = (l) => {
  _log = l
}

function notifyChange() {
  if (!_onChange) return
  clearTimeout(_changeTimer)
  _changeTimer = setTimeout(() => {
    try {
      _onChange()
    } catch {
      void 0
    }
  }, 100)
}

export const setOnChange = (fn) => {
  _onChange = fn
}

export const isMcpRegistered = (serverId) => mcpSlots.has(serverId)

export const registerBuiltins = (executors, definitions) => {
  for (const def of definitions) {
    if (!executors[def.name]) continue
    flat.set(def.name, {
      type: 'builtin',
      name: def.name,
      description: def.description ?? def.name,
      parameters: def.parameters ?? {
        type: 'object',
        properties: {}
      },
      execute: (args, { signal } = {}) =>
        executors[def.name](args, {
          signal
        })
    })
  }
}

export const registerMcp = (server, client, tools) => {
  _removeMcpEntries(server.id)
  mcpSlots.set(server.id, {
    client,
    server,
    tools,
    reconnecting: null
  })
  for (const tool of tools) {
    flat.set(tool.name, {
      type: 'mcp',
      serverId: server.id,
      name: tool.name,
      description: tool.description ?? tool.name,
      parameters: tool.inputSchema ?? {
        type: 'object',
        properties: {}
      },
      execute: _makeMcpExecutor(server.id, tool.name)
    })
  }
  _log.info(
    {
      serverId: server.id,
      count: tools.length
    },
    'registry: MCP server registered'
  )
  notifyChange()
}

export const closeAllMcp = async () => {
  await Promise.allSettled(Array.from(mcpSlots.keys()).map((id) => unregisterMcp(id)))
}

export const unregisterMcp = async (serverId) => {
  const slot = mcpSlots.get(serverId)
  if (slot) {
    await slot.client.close().catch(() => {})
    mcpSlots.delete(serverId)
  }
  _removeMcpEntries(serverId)
  notifyChange()
}

function _removeMcpEntries(serverId) {
  for (const [name, entry] of flat.entries()) {
    if (entry.type === 'mcp' && entry.serverId === serverId) {
      flat.delete(name)
    }
  }
}

function _makeMcpExecutor(serverId, toolName) {
  return async (args, { signal } = {}) => {
    if (signal?.aborted) throw new Error('Task aborted')
    const slot = mcpSlots.get(serverId)
    if (!slot) throw new Error(`MCP server ${serverId} is not registered`)
    const timeoutMs =
      Number(args?.timeoutMs || args?.timeout_ms || args?.timeout) || EXECUTE_TIMEOUT_MS
    try {
      return await _callMcpTool(slot.client, toolName, args, timeoutMs, signal)
    } catch (err) {
      if (!_isConnectionError(err)) throw err
      if (!slot.reconnecting) {
        slot.reconnecting = connectMcpServer(slot.server)
          .then(({ client }) => {
            slot.client = client
            slot.reconnecting = null
            _log.info(
              {
                serverId,
                toolName
              },
              'registry: MCP reconnected'
            )
          })
          .catch((e) => {
            slot.reconnecting = null
            throw e
          })
      }
      await slot.reconnecting
      return await _callMcpTool(mcpSlots.get(serverId).client, toolName, args, timeoutMs, signal)
    }
  }
}

function _isConnectionError(err) {
  const msg = String(err?.message || '')
  return (
    msg.includes('No active MCP client') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('process exited') ||
    msg.includes('transport closed') ||
    msg.includes('WebSocket') ||
    msg.includes('fetch failed')
  )
}

async function _callMcpTool(client, toolName, args, timeoutMs, signal) {
  let result
  try {
    const callPromise = withTimeout(
      client.callTool({
        name: toolName,
        arguments: args ?? {}
      }),
      timeoutMs,
      `MCP tool "${toolName}"`
    )
    if (signal) {
      result = await Promise.race([
        callPromise,
        new Promise((_, reject) => {
          if (signal.aborted) {
            reject(new Error('Task aborted'))
            return
          }
          signal.addEventListener('abort', () => reject(new Error('Task aborted')), {
            once: true
          })
        })
      ])
    } else {
      result = await callPromise
    }
  } catch (err) {
    const msg = err?.message || String(err)
    _log.warn(
      {
        toolName,
        err: msg
      },
      'registry: MCP callTool error'
    )
    if (_isConnectionError(err)) throw err
    return {
      ok: false,
      error: msg
    }
  }
  const content = result?.content
  const text = Array.isArray(content)
    ? content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n')
    : JSON.stringify(result)
  if (result?.isError)
    return {
      ok: false,
      error: text
    }
  return {
    ok: true,
    result: text
  }
}

export const getDeclarations = () =>
  Array.from(flat.values()).map((e) => ({
    name: e.name,
    description: e.description,
    parameters: e.parameters
  }))

export const run = async (toolName, args, { signal } = {}) => {
  if (signal?.aborted) throw new Error('Task aborted')
  const name = String(toolName || '')
  const entry = flat.get(name)
  if (!entry) throw new Error(`Unknown desktop tool: ${toolName}`)
  return entry.execute(args ?? {}, {
    signal
  })
}

function withTimeout(promise, ms, label) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    })
  ]).finally(() => clearTimeout(timer))
}
