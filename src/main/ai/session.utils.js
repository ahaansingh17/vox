import { z } from 'zod'

export function jsonSchemaToZod(schema) {
  if (!schema) return z.unknown()

  function convert(s) {
    if (!s) return z.unknown()
    let base
    switch (s.type) {
      case 'string':
        if (s.enum) base = z.enum(s.enum)
        else base = z.string()
        break
      case 'number':
      case 'integer':
        base = z.number()
        break
      case 'boolean':
        base = z.boolean()
        break
      case 'array':
        base = z.array(s.items ? convert(s.items) : z.unknown())
        break
      case 'object': {
        if (!s.properties) return z.record(z.unknown())
        const required = new Set(s.required || [])
        const shape = {}
        for (const [key, prop] of Object.entries(s.properties)) {
          const field = convert(prop)
          shape[key] = required.has(key) ? field : field.optional()
        }
        base = z.object(shape)
        break
      }
      default:
        base = z.unknown()
    }
    if (s.description) base = base.describe(s.description)
    return base
  }

  return convert(schema)
}

export async function* sessionPromptGen(session, userPrompt, functions, signal) {
  const queue = []
  let resolve = null
  let done = false
  let finalError = null

  const enqueue = (event) => {
    queue.push(event)
    if (resolve) {
      const r = resolve
      resolve = null
      r()
    }
  }

  const promptPromise = session
    .prompt(userPrompt, {
      functions: functions && Object.keys(functions).length > 0 ? functions : undefined,
      onTextChunk: (chunk) => enqueue({ type: 'text', content: chunk }),
      signal
    })
    .then(() => {
      done = true
      if (resolve) {
        const r = resolve
        resolve = null
        r()
      }
    })
    .catch((err) => {
      finalError = err
      done = true
      if (resolve) {
        const r = resolve
        resolve = null
        r()
      }
    })

  while (true) {
    if (queue.length > 0) {
      yield queue.shift()
    } else if (done) {
      break
    } else {
      await new Promise((r) => {
        resolve = r
      })
    }
  }

  await promptPromise
  if (finalError && finalError.name !== 'AbortError' && !signal?.aborted) throw finalError
}
