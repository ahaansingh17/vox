import { getDeclarations } from '@vox-ai-app/tools/registry'
import { storeGet } from '../storage/store'
import { definition as spawnDef } from './spawn.tool'
import { getMcpToolDefinitions } from '../mcp/mcp.service'

const SAVE_USER_INFO_DEF = {
  name: 'save_user_info',
  description:
    'Persist a piece of information about the user for future reference. Use this when the user tells you something about themselves that would be useful to remember (name, location, job, preferences, etc.).',
  parameters: {
    type: 'object',
    properties: {
      info_key: {
        type: 'string',
        description:
          'Short identifier for what this information is (e.g. "name", "location", "preferred_language", "occupation")'
      },
      info_value: {
        type: 'string',
        description: 'The value to store'
      }
    },
    required: ['info_key', 'info_value']
  }
}

const FIND_TOOLS_DEF = {
  name: 'find_tools',
  description:
    'Search for available custom tools by name or capability. Returns matching tools with name, description, source_type, and parameter schema. Call this before run_tool to discover custom tools.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Name or natural language description of the capability you need.'
      }
    },
    required: ['query']
  }
}

const RUN_TOOL_DEF = {
  name: 'run_tool',
  description:
    'Execute a custom tool by exact name. Call find_tools first to discover the tool and get its parameter schema, then call run_tool with the correct args.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Exact tool name as returned by find_tools.'
      },
      args: {
        type: 'object',
        description: 'Arguments matching the tool parameter schema.'
      }
    },
    required: ['name']
  }
}

let _toolDefinitions = null

function buildToolDefinitions() {
  const defs = [...getDeclarations()]

  defs.push(spawnDef)
  defs.push(SAVE_USER_INFO_DEF)
  defs.push({
    name: 'get_task',
    description: 'Get the full details and result of a specific background task by its ID.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID to look up' }
      },
      required: ['taskId']
    }
  })
  defs.push({
    name: 'search_tasks',
    description:
      'Search past background tasks by keyword query or filter by status. Use query for semantic/keyword search, status to filter.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword search over task instructions and results' },
        status: {
          type: 'string',
          enum: ['completed', 'failed', 'aborted', 'running', 'queued', 'incomplete'],
          description: 'Filter by task status'
        }
      }
    }
  })

  let hasMcpTools = false
  try {
    hasMcpTools = getMcpToolDefinitions().length > 0
  } catch {
    /* MCP not ready */
  }

  const hasCustomTools = (() => {
    try {
      const ct = storeGet('customTools') || []
      return ct.some((t) => t.is_enabled !== false && t.name)
    } catch {
      return false
    }
  })()

  if (hasCustomTools || hasMcpTools) {
    defs.push(FIND_TOOLS_DEF)
    defs.push(RUN_TOOL_DEF)
  }

  _toolDefinitions = defs
  return defs
}

export function getToolDefinitions() {
  return _toolDefinitions || buildToolDefinitions()
}

export function invalidateToolDefinitions() {
  _toolDefinitions = null
}
