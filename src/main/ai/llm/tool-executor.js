import { ALL_TOOLS } from '@vox-ai-app/tools'
import { registerAll, run as runRegistryTool } from '@vox-ai-app/tools/registry'
import { validateArgs } from '@vox-ai-app/tools/schema'
import { ALL_INTEGRATION_TOOLS } from '@vox-ai-app/integrations'
import { ALL_KNOWLEDGE_TOOLS } from '@vox-ai-app/indexing'
import { logger } from '../../core/logger'

const SAFE_MODULES = new Set(['path', 'url', 'querystring', 'crypto', 'util', 'buffer', 'os'])

registerAll([...ALL_TOOLS, ...ALL_INTEGRATION_TOOLS, ...ALL_KNOWLEDGE_TOOLS])

function tokenize(str) {
  return str
    .toLowerCase()
    .split(/[\s_\-./]+/)
    .filter(Boolean)
}

function fuzzyScore(query, name, description) {
  const qTokens = tokenize(query)
  if (qTokens.length === 0) return 0
  const nameTokens = tokenize(name)
  const descTokens = tokenize(description)
  const allTokens = [...nameTokens, ...descTokens].filter((t) => t.length >= 2)
  let score = 0
  for (const qt of qTokens) {
    if (qt.length < 2) continue
    if (nameTokens.some((t) => t === qt)) {
      score += 3
      continue
    }
    if (nameTokens.some((t) => t.length >= 2 && (t.includes(qt) || qt.includes(t)))) {
      score += 2
      continue
    }
    if (allTokens.some((t) => t.includes(qt) || qt.includes(t))) {
      score += 1
      continue
    }
  }
  return score / qTokens.length
}

export async function executeElectronTool(name, args) {
  switch (name) {
    case 'find_tools': {
      const { listTools } = await import('@vox-ai-app/storage/tools')
      const { getDb } = await import('../../storage/db.js')
      const { getMcpToolDefinitions } = await import('../../mcp/mcp.service.js')
      const customTools = listTools(getDb(), true)
      const query = String(args?.query || '').trim()
      const allTools = [
        ...customTools.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description || '',
          source_type: t.sourceType || 'unknown',
          parameters: t.parameters || { type: 'object', properties: {} }
        })),
        ...getMcpToolDefinitions().map((t) => ({
          id: t.name,
          name: t.name,
          description: t.description || '',
          source_type: 'mcp',
          parameters: t.parameters || { type: 'object', properties: {} }
        }))
      ]
      if (!query) return JSON.stringify({ tools: allTools })
      const scored = allTools
        .map((t) => ({ ...t, _score: fuzzyScore(query, t.name, t.description) }))
        .filter((t) => t._score > 0)
        .sort((a, b) => b._score - a._score)
      scored.forEach((t) => delete t._score)
      return JSON.stringify({ tools: scored })
    }
    case 'run_tool': {
      const toolName = String(args?.name || '').trim()
      if (!toolName) return JSON.stringify({ error: 'name is required' })
      const toolArgs = args?.args || {}
      const { getToolByName } = await import('@vox-ai-app/storage/tools')
      const { getDb } = await import('../../storage/db.js')
      const custom = getToolByName(getDb(), toolName)
      if (custom && custom.isEnabled) {
        const issues = validateArgs(custom.parameters, toolArgs)
        if (issues.length)
          return JSON.stringify({ error: 'invalid_args', issues, schema: custom.parameters })
        return executeCustomTool(
          {
            source_type: custom.sourceType,
            source_code: custom.sourceCode,
            webhook_url: custom.webhookUrl,
            webhook_headers: custom.webhookHeaders,
            name: custom.name
          },
          toolArgs
        )
      }
      const { executeMcpTool, getMcpToolDefinitions } = await import('../../mcp/mcp.service.js')
      const mcpDefs = getMcpToolDefinitions()
      const mcpDef = mcpDefs.find((t) => t.name === toolName)
      if (mcpDef) {
        const issues = validateArgs(mcpDef.parameters || mcpDef.inputSchema, toolArgs)
        if (issues.length)
          return JSON.stringify({
            error: 'invalid_args',
            issues,
            schema: mcpDef.parameters || mcpDef.inputSchema
          })
        return executeMcpTool(toolName, toolArgs)
      }
      return JSON.stringify({
        error: `No tool named "${toolName}" found. Call find_tools to discover available tools.`
      })
    }
    case 'manage_tool': {
      const { createTool, updateTool, deleteTool, getTool, getToolByName } =
        await import('@vox-ai-app/storage/tools')
      const { getDb } = await import('../../storage/db.js')
      const { invalidateToolDefinitions } = await import('../../chat/chat.session.js')
      const action = String(args?.action || '').trim()
      if (!['create', 'update', 'delete'].includes(action)) {
        return JSON.stringify({ ok: false, error: 'action must be create, update, or delete' })
      }
      const db = getDb()
      if (action === 'create') {
        const toolName = String(args?.name || '').trim()
        if (!toolName) return JSON.stringify({ ok: false, error: 'name is required for create' })
        if (getToolByName(db, toolName)) {
          return JSON.stringify({
            ok: false,
            error: `Tool "${toolName}" already exists. Use update instead.`
          })
        }
        let params = args?.parameters || { type: 'object', properties: {} }
        if (Array.isArray(params)) {
          const properties = {}
          const required = []
          for (const p of params) {
            properties[p.name] = { type: p.type || 'string', description: p.description || '' }
            if (p.required) required.push(p.name)
          }
          params = { type: 'object', properties, ...(required.length ? { required } : {}) }
        }
        const newTool = createTool(db, {
          name: toolName,
          description: args?.description || '',
          parameters: params,
          sourceType: args?.source_type || 'js_function',
          sourceCode: args?.source_code || '',
          webhookUrl: args?.webhook_url || '',
          tags: args?.tags || [],
          isEnabled: true
        })
        invalidateToolDefinitions()
        return JSON.stringify({ ok: true, tool: newTool })
      }
      if (action === 'update') {
        const id = args?.id || args?.name
        if (!id) return JSON.stringify({ ok: false, error: 'id or name is required for update' })
        let existing = getTool(db, id) || getToolByName(db, id)
        if (!existing) return JSON.stringify({ ok: false, error: `Tool "${id}" not found` })
        const updates = {}
        if (args?.description !== undefined) updates.description = args.description
        if (args?.parameters !== undefined) {
          let params = args.parameters
          if (Array.isArray(params)) {
            const properties = {}
            const required = []
            for (const p of params) {
              properties[p.name] = { type: p.type || 'string', description: p.description || '' }
              if (p.required) required.push(p.name)
            }
            params = { type: 'object', properties, ...(required.length ? { required } : {}) }
          }
          updates.parameters = params
        }
        if (args?.source_code !== undefined) updates.sourceCode = args.source_code
        if (args?.webhook_url !== undefined) updates.webhookUrl = args.webhook_url
        if (args?.tags !== undefined) updates.tags = args.tags
        if (args?.is_enabled !== undefined) updates.isEnabled = args.is_enabled
        const updated = updateTool(db, existing.id, updates)
        invalidateToolDefinitions()
        return JSON.stringify({ ok: true, tool: updated })
      }
      const id = args?.id || args?.name
      if (!id) return JSON.stringify({ ok: false, error: 'id or name is required for delete' })
      const existing = getTool(db, id) || getToolByName(db, id)
      if (!existing) return JSON.stringify({ ok: false, error: `Tool "${id}" not found` })
      deleteTool(db, existing.id)
      invalidateToolDefinitions()
      return JSON.stringify({ ok: true, deleted: existing.name })
    }
    case 'pick_file':
    case 'get_file_path': {
      const { dialog } = await import('electron')
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: args?.filters
      })
      return result.canceled ? null : result.filePaths[0]
    }
    case 'pick_directory': {
      const { dialog } = await import('electron')
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      return result.canceled ? null : result.filePaths[0]
    }
    case 'save_user_info': {
      const { getConversationUserInfo, setConversationUserInfo } =
        await import('../../storage/messages.db.js')
      const current = getConversationUserInfo()
      const key = String(args?.info_key || '').trim()
      if (!key) return JSON.stringify({ error: 'info_key is required' })
      current[key] = args?.info_value ?? ''
      setConversationUserInfo(current)
      return JSON.stringify({ saved: true, key })
    }
    case 'spawn_task': {
      const { enqueueTask, waitForTaskCompletion } = await import('../../chat/task.queue.js')
      const { getToolDefinitions } = await import('../../chat/chat.session.js')
      const { randomUUID: uuid } = await import('crypto')
      const taskId = uuid()
      enqueueTask({
        taskId,
        instructions: args?.instructions || '',
        context: args?.context || '',
        toolDefinitions: getToolDefinitions()
      })
      if (args?.waitForResult) {
        const timeout = Math.min(Math.max(Number(args.timeoutMs) || 300000, 1000), 600000)
        const outcome = await waitForTaskCompletion(taskId, timeout)
        return JSON.stringify(outcome)
      }
      return {
        result: JSON.stringify({ id: taskId, status: 'spawned' }),
        endTurn: true,
        message: 'On it — working in the background.'
      }
    }
    case 'get_task': {
      const { getTaskDetail } = await import('../../chat/task.queue.js')
      const detail = getTaskDetail(String(args?.taskId || ''))
      if (!detail) return JSON.stringify({ error: 'Task not found' })
      return JSON.stringify(detail)
    }
    case 'search_tasks': {
      const { listTaskHistory } = await import('../../chat/task.queue.js')
      if (args?.query) {
        const { searchTasksSemantic } = await import('../../storage/tasks.db.js')
        const results = await searchTasksSemantic(args.query, 5)
        return JSON.stringify({ tasks: results, has_more: false })
      }
      return JSON.stringify(listTaskHistory({ status: args?.status || null }))
    }
    case 'search_messages': {
      const query = String(args?.query || '').trim()
      if (!query) return JSON.stringify({ error: 'query is required' })
      const { searchMessagesSemantic } = await import('../../storage/messages.db.js')
      const results = await searchMessagesSemantic(query, Number(args?.limit) || 10)
      return JSON.stringify({ messages: results, count: results.length })
    }
    case 'schedule_task': {
      const { addSchedule } = await import('../../scheduler/scheduler.service.js')
      const schedule = addSchedule({
        expr: args?.cron_expression,
        tz: args?.timezone || null,
        prompt: args?.instructions,
        once: args?.once === true
      })
      return JSON.stringify({ id: schedule.id, status: 'scheduled', cronExpr: schedule.cronExpr })
    }
    case 'list_schedules': {
      const { getSchedules } = await import('../../scheduler/scheduler.service.js')
      return JSON.stringify({ schedules: getSchedules() })
    }
    case 'remove_schedule': {
      const { removeSchedule } = await import('../../scheduler/scheduler.service.js')
      removeSchedule(String(args?.schedule_id || ''))
      return JSON.stringify({ removed: true })
    }
    default: {
      logger.info(`[tool-executor] Dispatching tool: ${name}`)

      try {
        const result = await runRegistryTool(name, args)
        logger.info(`[tool-executor] Registry handled: ${name}`)
        return typeof result === 'string' ? result : JSON.stringify(result ?? null)
      } catch (registryErr) {
        if (!registryErr?.message?.includes('Unknown desktop tool')) {
          return JSON.stringify({ error: registryErr.message })
        }
      }

      throw new Error(`No handler for tool: ${name}`)
    }
  }
}

async function executeCustomTool(custom, toolArgs) {
  if (custom.source_type === 'http_webhook' && custom.webhook_url) {
    const { getToolSecrets } = await import('../../storage/secrets.js')
    const secrets = getToolSecrets(custom.name)
    const headers = { 'Content-Type': 'application/json', ...(custom.webhook_headers || {}) }
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === 'string' && v.startsWith('secret:')) {
        const secretKey = v.slice(7)
        headers[k] = secrets[secretKey] || v
      }
    }
    const resp = await fetch(custom.webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(toolArgs || {}),
      signal: AbortSignal.timeout(30_000)
    })
    return await resp.text()
  }
  if (
    (custom.source_type === 'js_function' || custom.source_type === 'desktop') &&
    custom.source_code
  ) {
    const { createContext, runInContext } = await import('vm')
    const { createRequire } = await import('module')
    const vmRequire = createRequire(import.meta.url)
    const sandboxedRequire = (mod) => {
      if (!SAFE_MODULES.has(mod)) {
        throw new Error(`Module "${mod}" is not allowed in custom tool sandbox`)
      }
      return vmRequire(mod)
    }
    const sandbox = {
      args: toolArgs || {},
      require: sandboxedRequire,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      Promise,
      JSON,
      Math,
      Date,
      __resolve: undefined,
      __reject: undefined
    }
    createContext(sandbox)
    const wrapped = `new Promise((resolve, reject) => { __resolve = resolve; __reject = reject; (async function(args) { ${custom.source_code} })(args).then(__resolve).catch(__reject) })`
    const resultPromise = runInContext(wrapped, sandbox, { timeout: 10_000 })
    const result = await resultPromise
    return typeof result === 'string' ? result : JSON.stringify(result ?? null)
  }
  throw new Error(`Custom tool "${custom.name}" has no executable source`)
}
