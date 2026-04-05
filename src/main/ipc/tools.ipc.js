import { registerHandler, createHandler } from './shared'
import { getMcpToolDefinitions } from '../mcp/mcp.service'
import { getDb } from '../storage/db'
import {
  listTools,
  createTool,
  updateTool,
  deleteTool,
  getToolByName
} from '@vox-ai-app/storage/tools'

const VALID_SOURCE_TYPES = new Set(['js_function', 'http_webhook', 'desktop', 'mcp'])
const TOOL_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/

function mcpDefsToTools(defs) {
  return defs.map((def) => ({
    id: `mcp:${def.name}`,
    name: def.name,
    description: def.description || '',
    sourceType: 'mcp',
    isEnabled: true
  }))
}

function allTools() {
  return [...listTools(getDb()), ...mcpDefsToTools(getMcpToolDefinitions())]
}

function validateToolData(data) {
  if (!data?.name || !TOOL_NAME_PATTERN.test(data.name)) {
    throw Object.assign(
      new Error('Tool name must start with a letter and contain only letters, numbers, _ or -'),
      { code: 'VALIDATION_ERROR' }
    )
  }
  if (data.sourceType && !VALID_SOURCE_TYPES.has(data.sourceType)) {
    throw Object.assign(new Error(`Invalid source_type: ${data.sourceType}`), {
      code: 'VALIDATION_ERROR'
    })
  }
}

export function registerToolsIpc() {
  registerHandler(
    'tools:list',
    createHandler(() => ({ tools: allTools(), has_more: false, next_cursor: null }))
  )

  registerHandler(
    'tools:search',
    createHandler((_e, { query } = {}) => {
      const q = (query || '').toLowerCase()
      const tools = q
        ? allTools().filter(
            (t) =>
              t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
          )
        : allTools()
      return { tools }
    })
  )

  registerHandler(
    'tools:create',
    createHandler((_e, data) => {
      validateToolData(data)
      const db = getDb()
      if (getToolByName(db, data.name)) {
        throw Object.assign(new Error(`Tool "${data.name}" already exists`), {
          code: 'DUPLICATE'
        })
      }
      return createTool(db, {
        name: data.name,
        description: data.description,
        parameters: data.parameters,
        sourceType: data.sourceType || data.source_type,
        sourceCode: data.sourceCode || data.source_code,
        webhookUrl: data.webhookUrl || data.webhook_url,
        webhookHeaders: data.webhookHeaders || data.webhook_headers,
        isEnabled: data.isEnabled ?? data.is_enabled ?? true,
        tags: data.tags
      })
    })
  )

  registerHandler(
    'tools:update',
    createHandler((_e, { id, data }) => {
      if (data?.name) validateToolData(data)
      const result = updateTool(getDb(), id, {
        ...data,
        sourceType: data?.sourceType || data?.source_type,
        isEnabled: data?.isEnabled ?? data?.is_enabled
      })
      if (!result) {
        throw Object.assign(new Error('Tool not found'), { code: 'NOT_FOUND' })
      }
      return result
    })
  )

  registerHandler(
    'tools:delete',
    createHandler((_e, { id }) => {
      deleteTool(getDb(), id)
      return { deleted: true }
    })
  )
}
