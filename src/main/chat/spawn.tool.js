export const definition = {
  name: 'spawn_task',
  description:
    'Delegate a task to a background worker agent. Use for any work that involves multiple steps, tool usage, or takes time (creating files, research, etc.). By default runs as fire-and-forget. Set waitForResult=true to block and receive the task result directly.',
  parameters: {
    type: 'object',
    properties: {
      instructions: {
        type: 'string',
        description:
          'Detailed natural-language instructions for the worker. Be specific about what to do and what tools to use.'
      },
      context: {
        type: 'string',
        description: 'Relevant conversation context the worker needs to complete the task.'
      },
      waitForResult: {
        type: 'boolean',
        description:
          'If true, blocks until the task completes and returns its result. Defaults to false (fire-and-forget).'
      },
      timeoutMs: {
        type: 'integer',
        description:
          'Max time to wait for result when waitForResult=true (default 300000 = 5 mins, max 600000).'
      }
    },
    required: ['instructions']
  }
}
