export const definition = {
  name: 'glob_local',
  readOnly: true,
  description:
    "Find files matching a glob pattern on the user's machine. Use for discovering files by name or extension across directories.",
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern, e.g. "**/*.js", "src/**/*.ts", "*.md".'
      },
      path: {
        type: 'string',
        description: 'Base directory to search from. Defaults to home directory.'
      },
      maxResults: {
        type: 'integer',
        description: 'Maximum files to return (default 100, max 1000).'
      }
    },
    required: ['pattern']
  }
}
