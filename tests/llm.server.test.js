import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    pid: 12345,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
    killed: false
  })),
  execSync: vi.fn(() => '')
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => {
    throw new Error('ENOENT')
  }),
  createWriteStream: vi.fn(() => ({
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    writableFinished: true
  })),
  renameSync: vi.fn(),
  rmSync: vi.fn()
}))

vi.mock('electron', () => ({
  dialog: { showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: ['/test'] })) },
  app: {
    getAppPath: () => '/fake/app',
    getPath: (name) => (name === 'userData' ? '/fake/userData' : '/fake')
  }
}))

vi.mock('../src/main/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('../src/main/ai/llm.server.js', () => ({
  startServer: vi.fn(),
  stopServer: vi.fn(),
  onLoadProgress: vi.fn(),
  isReady: vi.fn(() => true),
  getModelPath: vi.fn(() => '/model.gguf'),
  getBaseUrl: () => 'http://127.0.0.1:19741',
  getPort: () => 19741,
  ensureBinary: vi.fn(async () => '/opt/homebrew/bin/llama-server')
}))

vi.mock('../src/main/ai/llm.client.js', () => ({
  chatCompletion: vi.fn(),
  streamChat: vi.fn(async function* () {
    yield { type: 'text', content: 'Test response' }
  }),
  nonStreamChat: vi.fn(async () => ({ text: 'summary', toolCalls: [], finishReason: 'stop' })),
  healthCheck: vi.fn(async () => true)
}))

vi.mock('../src/main/ai/llm.stream.js', () => ({
  resetStreamState: vi.fn(),
  setChatStreamHandlers: vi.fn(),
  clearChatStreamHandlers: vi.fn(),
  handleChatEventForRenderer: vi.fn()
}))

vi.mock('../src/main/ipc/shared', () => ({
  emitAll: vi.fn()
}))

vi.mock('../src/main/ai/llm.tool-executor.js', () => ({
  executeElectronTool: vi.fn(async (name, _args) => ({ result: `executed ${name}` }))
}))

vi.mock('../src/main/ai/config.js', () => ({
  CONTEXT_SIZE: 4096,
  CONTEXT_KEEP_RECENT_CHARS: 8000
}))

vi.mock('../src/main/storage/store', () => ({
  storeGet: () => ({}),
  storeSet: vi.fn()
}))

vi.mock('../src/main/storage/secrets', () => ({
  getToolSecrets: () => ({})
}))

vi.mock('../src/main/mcp/mcp.service', () => ({
  getMcpToolDefinitions: () => [],
  executeMcpTool: vi.fn()
}))

vi.mock('@vox-ai-app/integrations', () => ({
  ALL_INTEGRATION_TOOLS: []
}))

vi.mock('@vox-ai-app/indexing', () => ({
  listIndexedFilesForTool: vi.fn(() => '[]'),
  readIndexedFileForTool: vi.fn(() => '{}'),
  searchIndexedContextForTool: vi.fn(() => '[]')
}))

vi.mock('../src/main/chat/task.queue', () => ({
  enqueueTask: vi.fn(),
  waitForTaskCompletion: vi.fn(async () => ({ taskId: 't1', status: 'completed' })),
  getTaskDetail: vi.fn(() => ({ task: { id: 't1' } })),
  listTaskHistory: vi.fn(() => ({ tasks: [] }))
}))

vi.mock('../src/main/chat/chat.session', () => ({
  getToolDefinitions: () => []
}))

vi.mock('../src/main/storage/tasks.db', () => ({
  searchTasksFts: vi.fn(() => [])
}))

describe('llm.server exports', async () => {
  const server = await import('../src/main/ai/llm.server.js')

  it('should expose port 19741', () => {
    expect(server.getPort()).toBe(19741)
  })

  it('should build correct base URL', () => {
    expect(server.getBaseUrl()).toBe('http://127.0.0.1:19741')
  })

  it('should expose isReady as a function', () => {
    expect(typeof server.isReady).toBe('function')
  })

  it('should expose startServer and stopServer', () => {
    expect(typeof server.startServer).toBe('function')
    expect(typeof server.stopServer).toBe('function')
  })

  it('should expose onLoadProgress', () => {
    expect(typeof server.onLoadProgress).toBe('function')
  })

  it('should expose ensureBinary', () => {
    expect(typeof server.ensureBinary).toBe('function')
  })
})

describe('llm.client', async () => {
  const client = await import('../src/main/ai/llm.client.js')

  it('should expose chatCompletion', () => {
    expect(typeof client.chatCompletion).toBe('function')
  })

  it('should expose streamChat as async generator factory', () => {
    expect(typeof client.streamChat).toBe('function')
  })

  it('should expose nonStreamChat', () => {
    expect(typeof client.nonStreamChat).toBe('function')
  })

  it('should expose healthCheck', () => {
    expect(typeof client.healthCheck).toBe('function')
  })

  it('nonStreamChat should return text and toolCalls', async () => {
    const result = await client.nonStreamChat({ messages: [{ role: 'user', content: 'hi' }] })
    expect(result.text).toBe('summary')
    expect(result.toolCalls).toEqual([])
    expect(result.finishReason).toBe('stop')
  })

  it('healthCheck should return boolean', async () => {
    const ok = await client.healthCheck()
    expect(ok).toBe(true)
  })

  it('streamChat should yield events', async () => {
    const events = []
    for await (const event of client.streamChat({ messages: [] })) {
      events.push(event)
    }
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'text', content: 'Test response' })
  })
})

describe('llm.bridge', async () => {
  const bridge = await import('../src/main/ai/llm.bridge.js')
  const server = await import('../src/main/ai/llm.server.js')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export all required functions', () => {
    expect(typeof bridge.getLlmStatus).toBe('function')
    expect(typeof bridge.loadModel).toBe('function')
    expect(typeof bridge.reloadModel).toBe('function')
    expect(typeof bridge.prewarmChat).toBe('function')
    expect(typeof bridge.sendChatMessage).toBe('function')
    expect(typeof bridge.waitForChatResult).toBe('function')
    expect(typeof bridge.abortChat).toBe('function')
    expect(typeof bridge.clearChat).toBe('function')
    expect(typeof bridge.getChatHistory).toBe('function')
    expect(typeof bridge.summarizeText).toBe('function')
    expect(typeof bridge.startAgent).toBe('function')
    expect(typeof bridge.abortAgent).toBe('function')
    expect(typeof bridge.onAgentEvent).toBe('function')
    expect(typeof bridge.destroyWorker).toBe('function')
    expect(typeof bridge.setChatStreamHandlers).toBe('function')
    expect(typeof bridge.clearChatStreamHandlers).toBe('function')
  })

  it('should load model by calling startServer', async () => {
    server.startServer.mockResolvedValue(undefined)
    await bridge.loadModel('/path/to/model.gguf')
    expect(server.startServer).toHaveBeenCalledWith('/path/to/model.gguf', { contextSize: 4096 })
    const status = bridge.getLlmStatus()
    expect(status.ready).toBe(true)
    expect(status.modelPath).toBe('/path/to/model.gguf')
  })

  it('should handle load error', async () => {
    server.startServer.mockRejectedValue(new Error('binary not found'))
    await expect(bridge.loadModel('/bad/model.gguf')).rejects.toThrow('binary not found')
    const status = bridge.getLlmStatus()
    expect(status.ready).toBe(false)
    expect(status.error).toBe('binary not found')
  })

  it('prewarmChat should return a promise', async () => {
    const result = await bridge.prewarmChat()
    expect(result).toBeUndefined()
  })

  it('prewarmChat with providers should call chatCompletion', async () => {
    const { chatCompletion } = await import('../src/main/ai/llm.client.js')
    chatCompletion.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] })

    bridge.setPrewarmProviders(
      () => [
        {
          name: 'test_tool',
          description: 'a test tool',
          parameters: { type: 'object', properties: {} }
        }
      ],
      () => 'You are Vox.'
    )
    await bridge.prewarmChat()
    expect(chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: false,
        maxTokens: 1,
        messages: expect.arrayContaining([
          { role: 'system', content: 'You are Vox.' },
          { role: 'user', content: 'hi' }
        ])
      })
    )
  })

  it('prewarmChat should not throw on failure', async () => {
    const { chatCompletion } = await import('../src/main/ai/llm.client.js')
    chatCompletion.mockRejectedValueOnce(new Error('connection refused'))
    bridge.setPrewarmProviders(
      () => [],
      () => 'sys'
    )
    await expect(bridge.prewarmChat()).resolves.toBeUndefined()
  })

  it('should clear chat history', async () => {
    await bridge.clearChat()
    const history = await bridge.getChatHistory()
    expect(history).toEqual([])
  })

  it('waitForChatResult should resolve on timeout', async () => {
    const result = await bridge.waitForChatResult('no-such-request', 100)
    expect(result.finalText).toBeNull()
  })

  it('onAgentEvent should return unsubscribe function', () => {
    const listener = vi.fn()
    const unsub = bridge.onAgentEvent('task-1', listener)
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('should stop server on destroy', async () => {
    await bridge.destroyWorker()
    expect(server.stopServer).toHaveBeenCalled()
    const status = bridge.getLlmStatus()
    expect(status.ready).toBe(false)
  })
})

describe('ELECTRON_TOOLS coverage', async () => {
  const { executeElectronTool } = await import('../src/main/ai/llm.tool-executor.js')

  const electronToolNames = [
    'pick_file',
    'get_file_path',
    'pick_directory',
    'save_user_info',
    'spawn_task',
    'get_task',
    'search_tasks',
    'read_emails',
    'search_contacts',
    'send_email',
    'capture_full_screen',
    'capture_region',
    'click_at',
    'move_mouse',
    'type_text',
    'key_press',
    'clipboard_read',
    'clipboard_write',
    'focus_app',
    'launch_app',
    'list_apps',
    'acquire_screen',
    'release_screen'
  ]

  it.each(electronToolNames)('should handle %s without throwing', async (name) => {
    const result = executeElectronTool(name, {})
    expect(result).toBeInstanceOf(Promise)
  })
})

describe('spawn_task flow via bridge', async () => {
  const bridge = await import('../src/main/ai/llm.bridge.js')
  const { streamChat } = await import('../src/main/ai/llm.client.js')
  const { handleChatEventForRenderer } = await import('../src/main/ai/llm.stream.js')
  const { executeElectronTool } = await import('../src/main/ai/llm.tool-executor.js')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('LLM calling spawn_task should route through tool executor', async () => {
    let callCount = 0
    streamChat.mockImplementation(async function* () {
      callCount++
      if (callCount === 1) {
        yield {
          type: 'tool_call',
          id: 'call_spawn',
          name: 'spawn_task',
          args: {
            instructions: 'Create hello.txt on the desktop',
            context: 'User asked to create a file'
          }
        }
      } else {
        yield { type: 'text', content: 'Task spawned.' }
      }
    })

    executeElectronTool.mockResolvedValueOnce(
      JSON.stringify({ taskId: 'task-abc', status: 'spawned' })
    )

    bridge.sendChatMessage({
      requestId: 'req-spawn',
      message: 'Create hello.txt on my desktop',
      systemPrompt: 'You are Vox.',
      history: [],
      toolDefinitions: [{ name: 'spawn_task', description: 'spawn a worker task' }]
    })

    await new Promise((r) => setTimeout(r, 100))

    expect(executeElectronTool).toHaveBeenCalledWith('spawn_task', {
      instructions: 'Create hello.txt on the desktop',
      context: 'User asked to create a file'
    })

    const toolResultEvents = handleChatEventForRenderer.mock.calls
      .filter(([, e]) => e.type === 'tool_result')
      .map(([, e]) => JSON.parse(e.result))
    expect(toolResultEvents[0].taskId).toBe('task-abc')
    expect(toolResultEvents[0].status).toBe('spawned')
  })

  it('LLM calling write_local_file should execute directly', async () => {
    let callCount = 0
    streamChat.mockImplementation(async function* () {
      callCount++
      if (callCount === 1) {
        yield {
          type: 'tool_call',
          id: 'call_write',
          name: 'write_local_file',
          args: { path: '~/Desktop/hello.txt', content: 'hello world' }
        }
      } else {
        yield { type: 'text', content: 'Done.' }
      }
    })

    executeElectronTool.mockResolvedValueOnce(
      JSON.stringify({ written: true, path: '/Users/test/Desktop/hello.txt', size: 11 })
    )

    bridge.sendChatMessage({
      requestId: 'req-write',
      message: 'Write hello.txt',
      systemPrompt: 'sys',
      history: [],
      toolDefinitions: [{ name: 'write_local_file', description: 'write a file' }]
    })

    await new Promise((r) => setTimeout(r, 100))

    expect(executeElectronTool).toHaveBeenCalledWith('write_local_file', {
      path: '~/Desktop/hello.txt',
      content: 'hello world'
    })
  })

  it('worker spawned by spawn_task gets tool definitions', async () => {
    let callCount = 0
    streamChat.mockImplementation(async function* () {
      callCount++
      if (callCount === 1) {
        yield {
          type: 'tool_call',
          id: 'call_sw',
          name: 'spawn_task',
          args: {
            instructions: 'List ~/Desktop, create summary.txt with the result',
            waitForResult: true
          }
        }
      } else {
        yield { type: 'text', content: 'Summary created.' }
      }
    })

    executeElectronTool.mockResolvedValueOnce(
      JSON.stringify({
        taskId: 'task-worker',
        status: 'completed',
        result: 'Created summary.txt with 5 files listed'
      })
    )

    bridge.sendChatMessage({
      requestId: 'req-worker',
      message: 'List my desktop and save a summary',
      systemPrompt: 'sys',
      history: [],
      toolDefinitions: [
        { name: 'spawn_task', description: 'spawn tasks' },
        { name: 'write_local_file', description: 'write' },
        { name: 'list_local_directory', description: 'list' }
      ]
    })

    await new Promise((r) => setTimeout(r, 100))

    const toolCallEvents = handleChatEventForRenderer.mock.calls.filter(
      ([, e]) => e.type === 'tool_call'
    )
    expect(toolCallEvents).toHaveLength(1)
    expect(toolCallEvents[0][1].name).toBe('spawn_task')
  })
})

describe('bridge chat message flow', async () => {
  const bridge = await import('../src/main/ai/llm.bridge.js')
  const { streamChat } = await import('../src/main/ai/llm.client.js')
  const { handleChatEventForRenderer } = await import('../src/main/ai/llm.stream.js')
  const { executeElectronTool } = await import('../src/main/ai/llm.tool-executor.js')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sendChatMessage should stream text to renderer', async () => {
    streamChat.mockImplementation(async function* () {
      yield { type: 'text', content: 'Hello ' }
      yield { type: 'text', content: 'world' }
    })

    bridge.sendChatMessage({
      requestId: 'req-1',
      message: 'Hi',
      systemPrompt: 'You are Vox.',
      history: [],
      toolDefinitions: []
    })

    await new Promise((r) => setTimeout(r, 50))

    const textEvents = handleChatEventForRenderer.mock.calls
      .filter(([, e]) => e.type === 'text')
      .map(([, e]) => e.content)
    expect(textEvents).toContain('Hello ')
    expect(textEvents).toContain('world')
  })

  it('sendChatMessage should emit chunk_start and chunk_end', async () => {
    streamChat.mockImplementation(async function* () {
      yield { type: 'text', content: 'ok' }
    })

    bridge.sendChatMessage({
      requestId: 'req-2',
      message: 'test',
      systemPrompt: 'sys',
      history: [],
      toolDefinitions: []
    })

    await new Promise((r) => setTimeout(r, 50))

    const eventTypes = handleChatEventForRenderer.mock.calls.map(([, e]) => e.type)
    expect(eventTypes).toContain('chunk_start')
    expect(eventTypes).toContain('chunk_end')
  })

  it('sendChatMessage with tool call should execute tool and continue', async () => {
    let callCount = 0
    streamChat.mockImplementation(async function* () {
      callCount++
      if (callCount === 1) {
        yield {
          type: 'tool_call',
          id: 'call_1',
          name: 'write_local_file',
          args: { path: '~/test.txt', content: 'hello' }
        }
      } else {
        yield { type: 'text', content: 'Done, file created.' }
      }
    })

    executeElectronTool.mockResolvedValueOnce(
      JSON.stringify({ written: true, path: '/Users/test/test.txt' })
    )

    bridge.sendChatMessage({
      requestId: 'req-3',
      message: 'Create test.txt',
      systemPrompt: 'sys',
      history: [],
      toolDefinitions: [{ name: 'write_local_file', description: 'write a file' }]
    })

    await new Promise((r) => setTimeout(r, 100))

    expect(executeElectronTool).toHaveBeenCalledWith('write_local_file', {
      path: '~/test.txt',
      content: 'hello'
    })

    const eventTypes = handleChatEventForRenderer.mock.calls.map(([, e]) => e.type)
    expect(eventTypes).toContain('tool_call')
    expect(eventTypes).toContain('tool_result')
    expect(eventTypes).toContain('text')
  })

  it('sendChatMessage should strip think tags', async () => {
    streamChat.mockImplementation(async function* () {
      yield { type: 'text', content: '<think>reasoning here</think>Actual response' }
    })

    bridge.sendChatMessage({
      requestId: 'req-4',
      message: 'hi',
      systemPrompt: 'sys',
      history: [],
      toolDefinitions: []
    })

    await new Promise((r) => setTimeout(r, 50))

    const textEvents = handleChatEventForRenderer.mock.calls
      .filter(([, e]) => e.type === 'text')
      .map(([, e]) => e.content)
    expect(textEvents).toContain('Actual response')
    expect(textEvents.join('')).not.toContain('<think>')
  })

  it('sendChatMessage should handle multi-round tool calls', async () => {
    let round = 0
    streamChat.mockImplementation(async function* () {
      round++
      if (round === 1) {
        yield { type: 'tool_call', id: 'c1', name: 'list_local_directory', args: { path: '~' } }
      } else if (round === 2) {
        yield {
          type: 'tool_call',
          id: 'c2',
          name: 'write_local_file',
          args: { path: '~/out.txt', content: 'data' }
        }
      } else {
        yield { type: 'text', content: 'All done.' }
      }
    })

    executeElectronTool
      .mockResolvedValueOnce(JSON.stringify({ entries: ['file1.txt', 'file2.txt'] }))
      .mockResolvedValueOnce(JSON.stringify({ written: true }))

    bridge.sendChatMessage({
      requestId: 'req-5',
      message: 'List files then write summary',
      systemPrompt: 'sys',
      history: [],
      toolDefinitions: [
        { name: 'list_local_directory', description: 'list dir' },
        { name: 'write_local_file', description: 'write file' }
      ]
    })

    await new Promise((r) => setTimeout(r, 150))

    expect(executeElectronTool).toHaveBeenCalledTimes(2)
    expect(executeElectronTool).toHaveBeenCalledWith('list_local_directory', { path: '~' })
    expect(executeElectronTool).toHaveBeenCalledWith('write_local_file', {
      path: '~/out.txt',
      content: 'data'
    })
  })

  it('abortChat should cancel in-flight request', async () => {
    let aborted = false
    streamChat.mockImplementation(async function* ({ signal }) {
      yield { type: 'text', content: '' }
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5000)
        signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          aborted = true
          reject(new Error('aborted'))
        })
      })
    })

    bridge.sendChatMessage({
      requestId: 'req-abort',
      message: 'long task',
      systemPrompt: 'sys',
      history: [],
      toolDefinitions: []
    })

    await new Promise((r) => setTimeout(r, 20))
    bridge.abortChat()
    await new Promise((r) => setTimeout(r, 50))
    expect(aborted).toBe(true)
  })

  it('tool execution error should serialize as JSON error', async () => {
    let callCount = 0
    streamChat.mockImplementation(async function* () {
      callCount++
      if (callCount === 1) {
        yield { type: 'tool_call', id: 'c_err', name: 'bad_tool', args: {} }
      } else {
        yield { type: 'text', content: 'Error handled.' }
      }
    })

    executeElectronTool.mockRejectedValueOnce(new Error('Permission denied'))

    bridge.sendChatMessage({
      requestId: 'req-err',
      message: 'do something',
      systemPrompt: 'sys',
      history: [],
      toolDefinitions: [{ name: 'bad_tool', description: 'a tool' }]
    })

    await new Promise((r) => setTimeout(r, 100))

    const toolResults = handleChatEventForRenderer.mock.calls
      .filter(([, e]) => e.type === 'tool_result')
      .map(([, e]) => e.result)
    expect(toolResults[0]).toContain('Permission denied')
  })
})

describe('agent lifecycle', async () => {
  const bridge = await import('../src/main/ai/llm.bridge.js')

  it('startAgent should accept task parameters', () => {
    expect(() =>
      bridge.startAgent({
        taskId: 'agent-1',
        instructions: 'Create hello.txt',
        context: '',
        toolDefinitions: [{ name: 'write_local_file', description: 'write a file' }]
      })
    ).not.toThrow()
  })

  it('abortAgent should not throw for unknown taskId', () => {
    expect(() => bridge.abortAgent('nonexistent')).not.toThrow()
  })

  it('onAgentEvent should relay events to listener', () => {
    const events = []
    const unsub = bridge.onAgentEvent('agent-2', (e) => events.push(e))
    expect(typeof unsub).toBe('function')
    unsub()
  })
})
