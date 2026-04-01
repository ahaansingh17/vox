export const definition = {
  name: 'grep_local',
  readOnly: true,
  description:
    "Search for a regex pattern across files in a directory on the user's machine. Returns matching lines with file paths and line numbers. Uses recursive search by default.",
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Regex pattern to search for.'
      },
      path: {
        type: 'string',
        description: 'Directory to search in. Defaults to home directory.'
      },
      glob: {
        type: 'string',
        description: 'File glob filter, e.g. "*.js" or "*.py". Searches all files if omitted.'
      },
      ignoreCase: {
        type: 'boolean',
        description: 'Case-insensitive matching. Defaults to true.'
      },
      contextLines: {
        type: 'integer',
        description: 'Number of context lines before and after each match (default 0, max 10).'
      },
      maxResults: {
        type: 'integer',
        description: 'Maximum number of matching lines to return (default 100, max 500).'
      }
    },
    required: ['pattern']
  }
}
