const KNOWLEDGE_TOOL_NAMES = new Set([
  'list_indexed_files',
  'read_indexed_file',
  'search_indexed_context'
])

const SAFE_MODULES = new Set(['path', 'url', 'querystring', 'crypto', 'util', 'buffer', 'os'])

export async function executeElectronTool(name, args) {
  switch (name) {
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
      const { storeGet, storeSet } = await import('../storage/store.js')
      const current = storeGet('vox.user.info') || {}
      const key = String(args?.info_key || '').trim()
      if (!key) return JSON.stringify({ error: 'info_key is required' })
      current[key] = args?.info_value ?? ''
      storeSet('vox.user.info', current)
      return JSON.stringify({ saved: true, key })
    }
    case 'spawn_task': {
      const { enqueueTask, waitForTaskCompletion } = await import('../chat/task.queue.js')
      const { getToolDefinitions } = await import('../chat/chat.session.js')
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
      return JSON.stringify({ taskId, status: 'spawned' })
    }
    case 'get_task': {
      const { getTaskDetail } = await import('../chat/task.queue.js')
      const detail = getTaskDetail(String(args?.taskId || ''))
      if (!detail) return JSON.stringify({ error: 'Task not found' })
      return JSON.stringify(detail)
    }
    case 'search_tasks': {
      const { listTaskHistory } = await import('../chat/task.queue.js')
      const { searchTasksFts } = await import('../storage/tasks.db.js')
      if (args?.query) {
        const results = searchTasksFts(args.query)
        return JSON.stringify({ tasks: results, has_more: false })
      }
      return JSON.stringify(listTaskHistory({ status: args?.status || null }))
    }
    default: {
      if (KNOWLEDGE_TOOL_NAMES.has(name)) {
        const { listIndexedFilesForTool, readIndexedFileForTool, searchIndexedContextForTool } =
          await import('@vox-ai-app/indexing')
        if (name === 'list_indexed_files') return listIndexedFilesForTool(args)
        if (name === 'read_indexed_file') return readIndexedFileForTool(args)
        if (name === 'search_indexed_context') return searchIndexedContextForTool(args)
      }

      const { executeMcpTool, getMcpToolDefinitions } = await import('../mcp/mcp.service.js')
      const mcpDefs = getMcpToolDefinitions()
      if (mcpDefs.some((t) => t.name === name)) {
        return executeMcpTool(name, args)
      }

      const { storeGet } = await import('../storage/store.js')
      const customTools = storeGet('customTools') || []
      const custom = customTools.find((t) => t.name === name && t.is_enabled !== false)
      if (custom) {
        if (custom.source_type === 'http_webhook' && custom.webhook_url) {
          const { getToolSecrets } = await import('../storage/secrets.js')
          const secrets = getToolSecrets(name)
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
            body: JSON.stringify(args || {})
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
            args: args || {},
            require: sandboxedRequire,
            console: { log: () => {}, warn: () => {}, error: () => {} },
            Promise,
            JSON,
            Math,
            Date,
            result: undefined
          }
          createContext(sandbox)
          const wrapped = `(async function(args) { ${custom.source_code} })(args).then(r => { result = r }).catch(e => { result = { error: e.message } })`
          await runInContext(wrapped, sandbox, { timeout: 10_000 })
          const result = sandbox.result
          return typeof result === 'string' ? result : JSON.stringify(result ?? null)
        }
        throw new Error(`Custom tool "${name}" has no executable source`)
      }

      throw new Error(`No handler for tool: ${name}`)
    }
  }
}
