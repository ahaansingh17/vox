const TOOL_CALL_TAG = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g

export function parseTextToolCalls(text, toolNames) {
  const results = []
  const names = toolNames instanceof Set ? toolNames : new Set(toolNames || [])

  const stripped = text.replace(/<\/?tool_call>/g, '')

  if (names.size > 0) {
    for (const toolName of names) {
      const escaped = toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const marker = new RegExp(`"name"\\s*:\\s*"${escaped}"`)
      const markerMatch = marker.exec(stripped)
      if (!markerMatch) continue

      let braceStart = stripped.lastIndexOf('{', markerMatch.index)
      if (braceStart === -1) continue

      let depth = 0
      let braceEnd = -1
      for (let i = braceStart; i < stripped.length; i++) {
        if (stripped[i] === '{') depth++
        else if (stripped[i] === '}') {
          depth--
          if (depth === 0) {
            braceEnd = i
            break
          }
        }
      }
      if (braceEnd === -1) continue

      try {
        const parsed = JSON.parse(stripped.slice(braceStart, braceEnd + 1))
        if (parsed.name === toolName) {
          results.push({
            id: `call_${Math.random().toString(36).slice(2, 10)}`,
            name: parsed.name,
            args: parsed.arguments || parsed.parameters || {}
          })
        }
      } catch {
        /* malformed JSON */
      }
    }
  }

  if (results.length === 0) {
    TOOL_CALL_TAG.lastIndex = 0
    let match
    while ((match = TOOL_CALL_TAG.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim())
        if (parsed.name) {
          results.push({
            id: `call_${Math.random().toString(36).slice(2, 10)}`,
            name: parsed.name,
            args: parsed.arguments || parsed.parameters || {}
          })
        }
      } catch {
        /* malformed JSON */
      }
    }
  }

  return results
}

export function stripThinkTags(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '')
}

export function hasOpenThinkTag(text) {
  const lastOpen = text.lastIndexOf('<think>')
  const lastClose = text.lastIndexOf('</think>')
  return lastOpen > lastClose
}
