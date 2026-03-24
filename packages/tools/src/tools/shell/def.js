export const definition = {
  name: 'run_local_command',
  description:
    "Run a shell command on the user's local machine. Use for anything that needs OS interaction: running scripts, managing files, installing packages, starting servers, etc.",
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute.' },
      cwd: {
        type: 'string',
        description: 'Working directory (absolute or ~/). Defaults to home directory.'
      },
      timeoutMs: {
        type: 'integer',
        description: 'Timeout in milliseconds (default 120000, max 600000).'
      },
      maxOutputChars: {
        type: 'integer',
        description: 'Max output characters per stream (default 50000, max 200000).'
      }
    },
    required: ['command']
  }
}
