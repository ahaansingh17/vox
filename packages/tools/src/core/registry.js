import { makeMcpExecutor } from './mcp-executor.js'
import { validateArgs } from './schema.js'

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

export const registerAll = (tools, ctx) => {
  for (const tool of tools) {
    flat.set(tool.definition.name, {
      type: 'builtin',
      name: tool.definition.name,
      description: tool.definition.description ?? tool.definition.name,
      parameters: tool.definition.parameters ?? { type: 'object', properties: {} },
      execute: (args, opts) => tool.execute(ctx)(args, opts)
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
      execute: makeMcpExecutor(server.id, tool.name, (id) => mcpSlots.get(id), _log)
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
  const issues = validateArgs(entry.parameters, args ?? {})
  if (issues.length) throw new Error(`Invalid args for "${name}": ${issues.join('; ')}`)
  return entry.execute(args ?? {}, {
    signal
  })
}
