export function groupMessages(messages) {
  const result = []
  let toolBuf = []

  const flushTools = () => {
    if (toolBuf.length > 0) {
      result.push({ kind: 'tool-group', tools: [...toolBuf] })
      toolBuf = []
    }
  }

  for (const msg of messages) {
    if (msg.role === 'tool') {
      toolBuf.push({
        id: msg.id,
        name: msg.toolName || 'Tool',
        status: msg.toolStatus || 'completed',
        input: msg.toolInput || ''
      })
    } else {
      flushTools()
      result.push({ kind: 'message', message: msg })
    }
  }
  flushTools()
  return result
}
