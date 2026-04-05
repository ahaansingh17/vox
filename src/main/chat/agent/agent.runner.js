import { randomUUID } from 'crypto'
import { createJournal } from './journal/journal.schema.js'
import { createJournalTool } from './journal/journal.tool.js'
import { createStallDetector } from './detectors/stall.detector.js'
import { createRepetitionDetector } from './detectors/repetition.detector.js'
import { validateToolResult, buildValidationPrompt } from './detectors/result.validator.js'
import { buildAgentPrompt } from './prompts/system.prompt.js'
import { planningPrompt, journalPrompt, postActionPrompt } from './prompts/iteration.prompts.js'
import { createReadResultTool, storeResult, STORE_THRESHOLD } from './result.store.js'
import { summarizeIfNeeded } from './summarize.js'
import { streamChat } from '../../ai/llm/client.js'
import { CONTEXT_KEEP_RECENT_CHARS } from '../../ai/config.js'

const VERIFY_INTERVAL = 3
const JOURNAL_TOOL_NAME = 'update_journal'
const STALL_GIVE_UP_THRESHOLD = 6
const MAX_COMPRESSION_ATTEMPTS = 2
const MAX_ITERATIONS = 50
const MAX_NO_PROGRESS_ITERATIONS = 3

function isContextLengthError(err) {
  return /context|token|length|exceed/i.test(err?.message || '')
}

async function compressMessages(messages, summarize) {
  const condensed = await summarizeIfNeeded(messages, {
    threshold: 0,
    keepRecentChars: CONTEXT_KEEP_RECENT_CHARS,
    summarize,
    promptPrefix:
      'Summarize this task execution history concisely. Preserve key findings, decisions, tool outputs, and any context needed to continue the task:',
    summaryLabel: 'Summary of earlier work'
  })
  return condensed
}

function buildTools(toolMap, ...extraTools) {
  const tools = new Map(toolMap)
  for (const tool of extraTools) {
    tools.set(tool.definition.name, { definition: tool.definition, execute: tool.execute() })
  }
  return {
    definitions: [...tools.values()].map((t) => t.definition),
    execute: async (name, args, { signal } = {}) => {
      const tool = tools.get(name)
      if (!tool) throw new Error(`Unknown tool: ${name}`)
      return tool.execute(args, { signal })
    }
  }
}

function withResultStore(tools, taskId) {
  const readResultTool = createReadResultTool(taskId)
  return {
    definitions: [...tools.definitions, readResultTool.definition],
    execute: async (name, args, opts) => {
      if (name === readResultTool.definition.name) return readResultTool.execute()(args, opts)
      const output = await tools.execute(name, args, opts)
      const serialized = typeof output === 'string' ? output : JSON.stringify(output)
      if (serialized.length > STORE_THRESHOLD) {
        const resultId = storeResult(taskId, serialized)
        const preview = serialized.slice(0, 800)
        return (
          `[Result stored — tool: ${name}, size: ${Math.ceil(serialized.length / 1000)}k chars, id: ${resultId}]\n` +
          `Preview:\n${preview}${serialized.length > 800 ? '…' : ''}\n\n` +
          `Call read_result("${resultId}") to read in 20k-char chunks.`
        )
      }
      return serialized
    }
  }
}

function summarizeResult(result) {
  if (!result) return 'no result'
  if (typeof result === 'string') return result.slice(0, 100)
  if (result.error) return `error: ${result.error}`
  if (result.exitCode !== undefined)
    return result.exitCode === 0 ? 'success' : `exit ${result.exitCode}`
  return 'completed'
}

function selectPrompt(state, journal) {
  const { planningComplete, lastToolName, lastToolResult, actionsSincePlan } = state
  if (!planningComplete) return planningPrompt(journal)
  const shouldVerify =
    lastToolName && actionsSincePlan > 0 && actionsSincePlan % VERIFY_INTERVAL === 0
  if (shouldVerify) return postActionPrompt(lastToolName, summarizeResult(lastToolResult))
  return journalPrompt(journal)
}

function updatePlanningState(state, journal) {
  if (!state.planningComplete && journal.currentPlan) {
    state.planningComplete = true
    state.actionsSincePlan = 0
    return true
  }
  if (state.planningComplete && state.lastToolName && state.lastToolName !== JOURNAL_TOOL_NAME) {
    state.actionsSincePlan++
  }
  return false
}

export { buildAgentPrompt, fetchPastContext, fetchKnowledgePatterns, recordBlockerPatterns }

async function fetchPastContext(instructions) {
  try {
    const { searchTasksSemantic } = await import('../../storage/tasks.db.js')
    const results = await searchTasksSemantic(instructions, 3)
    if (results.length === 0) return null
    return results
      .map((t) => `- "${t.instructions}" → ${String(t.result || '').slice(0, 500)}`)
      .join('\n')
  } catch {
    return null
  }
}

async function fetchKnowledgePatterns(instructions) {
  try {
    const { searchPatternsSemantic } = await import('../../storage/tasks.db.js')
    const results = await searchPatternsSemantic(instructions, 5)
    if (results.length === 0) return null
    return results.map((p) => `- When: "${p.trigger}" → Try: "${p.solution}"`).join('\n')
  } catch {
    return null
  }
}

async function recordBlockerPatterns(journal) {
  if (!journal.done || journal.blockersEncountered.length === 0) return
  try {
    const { insertKnowledgePattern, indexPatternEmbedding } =
      await import('../../storage/tasks.db.js')
    const solution = journal.doneReason || journal.completed.at(-1) || ''
    if (!solution) return
    for (const blocker of journal.blockersEncountered) {
      const id = randomUUID()
      const trigger = String(blocker).slice(0, 500)
      const sol = solution.slice(0, 500)
      insertKnowledgePattern(id, trigger, sol)
      indexPatternEmbedding(id, trigger, sol).catch(() => {})
    }
  } catch {
    /* pattern recording is best-effort */
  }
}

export async function runAgentLoop({
  taskId,
  systemPrompt,
  instructions: _instructions,
  context: _context,
  toolDefinitions,
  executeToolFn,
  signal,
  emit,
  summarize
}) {
  const journal = createJournal()
  const stallDetector = createStallDetector()
  const repetitionDetector = createRepetitionDetector()

  const toolMap = new Map(
    toolDefinitions.map((def) => [
      def.name,
      {
        definition: def,
        execute: async (args, opts) => executeToolFn(def.name, args, opts?.signal)
      }
    ])
  )

  const journalTool = createJournalTool(journal, (j) =>
    emit({ type: 'journal_update', journal: j })
  )
  const tools = withResultStore(buildTools(toolMap, journalTool), taskId)

  const messages = [{ role: 'system', content: systemPrompt }]

  const state = {
    planningComplete: false,
    actionsSincePlan: 0,
    lastToolName: null,
    lastToolResult: null,
    lastArgs: null
  }

  let pendingCorrection = null
  let compressionAttempts = 0
  let iterations = 0
  let noProgressCount = 0
  let lastJournalSnapshot = JSON.stringify(journal)
  let repetitionWarnings = 0
  let realToolCallCount = 0
  let consecutiveJournalCount = 0

  while (true) {
    if (signal?.aborted) throw new Error('Task cancelled')
    if (++iterations > MAX_ITERATIONS) {
      emit({ type: 'thought', content: 'Max iterations reached, stopping.' })
      break
    }

    let iterationPrompt = selectPrompt(state, journal)
    if (pendingCorrection) {
      iterationPrompt = pendingCorrection + '\n\n' + iterationPrompt
      pendingCorrection = null
    }

    messages.push({ role: 'user', content: iterationPrompt })

    let pendingThought = ''

    while (true) {
      try {
        let roundText = ''
        const toolCalls = []

        for await (const event of streamChat({
          messages,
          tools: tools.definitions,
          signal
        })) {
          if (event.type === 'text') {
            roundText += event.content
            pendingThought += event.content
            emit({ type: 'text', content: event.content })
          } else if (event.type === 'tool_call') {
            toolCalls.push(event)
          }
        }

        if (toolCalls.length === 0) {
          if (roundText) messages.push({ role: 'assistant', content: roundText })
          break
        }

        const assistantMsg = {
          role: 'assistant',
          content: roundText || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id || `call_${randomUUID().slice(0, 8)}`,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args) }
          }))
        }
        messages.push(assistantMsg)

        for (let i = 0; i < toolCalls.length; i++) {
          const tc = toolCalls[i]
          state.lastToolName = tc.name
          state.lastArgs = tc.args
          emit({ type: 'tool_call', name: tc.name, args: tc.args })

          let result
          try {
            result = await tools.execute(tc.name, tc.args, { signal })
          } catch (err) {
            result = JSON.stringify({ error: err.message })
          }
          const serialized = typeof result === 'string' ? result : JSON.stringify(result)
          state.lastToolResult = serialized

          if (tc.name === JOURNAL_TOOL_NAME) {
            consecutiveJournalCount++
            if (consecutiveJournalCount >= 3) {
              pendingCorrection =
                (pendingCorrection ? pendingCorrection + '\n\n' : '') +
                'You have called update_journal multiple times without executing any real tool. Execute a tool now or mark done=true if the task is complete.'
            }
          } else {
            consecutiveJournalCount = 0
            realToolCallCount++
            repetitionDetector.record(tc.name, tc.args, serialized)
            const warnings = validateToolResult(tc.name, serialized)
            if (warnings.length) {
              const prompt = buildValidationPrompt(tc.name, warnings)
              if (prompt)
                pendingCorrection = (pendingCorrection ? pendingCorrection + '\n\n' : '') + prompt
            }
          }

          emit({ type: 'tool_result', name: tc.name, result: serialized })

          messages.push({
            role: 'tool',
            tool_call_id: assistantMsg.tool_calls[i]?.id,
            content: serialized
          })
        }
      } catch (err) {
        if (
          summarize &&
          isContextLengthError(err) &&
          compressionAttempts < MAX_COMPRESSION_ATTEMPTS
        ) {
          compressionAttempts++
          try {
            const compressed = await compressMessages(messages, summarize)
            messages.length = 0
            messages.push(...compressed)
          } catch (compressErr) {
            throw new Error(`Context too large and compression failed: ${compressErr.message}`)
          }
        } else {
          throw err
        }
      }
    }

    if (pendingThought.trim()) {
      emit({ type: 'thought', content: pendingThought.trim() })
    }

    const currentSnapshot = JSON.stringify(journal)
    if (currentSnapshot === lastJournalSnapshot) {
      noProgressCount++
      if (noProgressCount >= MAX_NO_PROGRESS_ITERATIONS) {
        emit({
          type: 'thought',
          content: 'No progress after multiple iterations — journal unchanged. Stopping.'
        })
        journal.done = true
        journal.doneReason = 'Agent could not make progress on this task.'
        break
      }
    } else {
      noProgressCount = 0
      lastJournalSnapshot = currentSnapshot
    }

    const repetition = repetitionDetector.detectRepetition()
    if (repetition) {
      if (repetition.type === 'same_failing_action') break
      repetitionWarnings++
      if (repetitionWarnings >= 2) {
        emit({ type: 'thought', content: 'Stuck in a loop — same action repeated. Stopping.' })
        journal.done = true
        journal.doneReason = 'Task stopped due to repeated identical actions.'
        break
      }
      pendingCorrection = (pendingCorrection ? pendingCorrection + '\n\n' : '') + repetition.message
    }

    updatePlanningState(state, journal)

    if (journal.done && realToolCallCount === 0) {
      journal.done = false
      journal.doneReason = ''
      pendingCorrection =
        'You marked done=true but never executed any tools. You must actually perform actions (execute_code, list_directory, etc.) to complete the task — not just plan. Execute your plan now.'
    }
    if (journal.done) break

    const { stalledFor, nudge } = stallDetector.check(journal, state.planningComplete)
    if (stalledFor >= STALL_GIVE_UP_THRESHOLD) break
    if (nudge) pendingCorrection = (pendingCorrection ? pendingCorrection + '\n\n' : '') + nudge
  }

  const summary = journal.doneReason || journal.completed.at(-1) || journal.understanding || ''
  return { summary, done: journal.done, journal }
}
