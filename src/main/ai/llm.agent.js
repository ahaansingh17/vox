import { emitAll } from '../ipc/shared'
import { executeElectronTool } from './llm.tool-executor.js'

const agentListeners = new Map()
const agentControllers = new Map()

export function startAgent({ taskId, instructions, context, toolDefinitions, summarizeFn }) {
  runAgent({ taskId, instructions, context, toolDefinitions, summarizeFn }).catch((err) => {
    agentListeners.get(taskId)?.({ type: 'task.status', status: 'failed', message: err.message })
  })
}

async function runAgent({ taskId, instructions, context, toolDefinitions, summarizeFn }) {
  const { runAgentLoop, buildAgentPrompt, fetchPastContext, fetchKnowledgePatterns } =
    await import('../chat/agent/agent.runner.js')

  const controller = new AbortController()
  agentControllers.set(taskId, controller)
  const signal = controller.signal

  const [pastContext, knowledgePatterns] = await Promise.all([
    fetchPastContext(instructions).catch(() => null),
    fetchKnowledgePatterns(instructions).catch(() => null)
  ])
  const systemPrompt = buildAgentPrompt(instructions, context, pastContext, knowledgePatterns)

  const emit = (event) => {
    if (event.type !== 'task.status') {
      emitAll('task:event', { taskId, ...event })
    }
    const isInternalTool =
      (event.type === 'tool_call' || event.type === 'tool_result') &&
      event.name === 'update_journal'
    if (
      !isInternalTool &&
      (event.type === 'tool_call' ||
        event.type === 'tool_result' ||
        event.type === 'text' ||
        event.type === 'thought')
    ) {
      emitAll('chat:event', { type: event.type, data: { taskId, ...event } })
    }
    agentListeners.get(taskId)?.(event)
  }

  try {
    const { summary, done, journal } = await runAgentLoop({
      taskId,
      systemPrompt,
      instructions,
      context,
      toolDefinitions,
      executeToolFn: (name, args) => executeElectronTool(name, args),
      signal,
      emit,
      summarize: summarizeFn
    })

    if (journal) {
      const { recordBlockerPatterns } = await import('../chat/agent/agent.runner.js')
      await recordBlockerPatterns(journal).catch(() => {})
    }

    emit({
      type: 'task.status',
      status: done ? 'completed' : 'incomplete',
      result: summary
    })
  } catch (err) {
    emit({ type: 'task.status', status: 'failed', message: err.message })
  } finally {
    agentControllers.delete(taskId)
  }
}

export function abortAgent(taskId) {
  const controller = agentControllers.get(taskId)
  if (controller) {
    controller.abort()
    agentControllers.delete(taskId)
  }
}

export function onAgentEvent(taskId, listener) {
  agentListeners.set(taskId, listener)
  return () => agentListeners.delete(taskId)
}

export function abortAllAgents() {
  for (const [, controller] of agentControllers) {
    controller.abort()
  }
  agentControllers.clear()
}
