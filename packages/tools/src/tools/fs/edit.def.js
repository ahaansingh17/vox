export const editLocalFileDef = {
  name: 'edit_local_file',
  description:
    'Replace a specific string in a local file. Provide old_string (the exact text to find) and new_string (the replacement). Fails if old_string matches zero or more than one location unless replace_all is true. This is the preferred way to make targeted edits to files — avoids rewriting the entire file.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Target file path. Supports absolute paths and ~/ shortcuts.'
      },
      old_string: {
        type: 'string',
        description:
          'The exact text to find in the file. Must match exactly (including whitespace and indentation).'
      },
      new_string: {
        type: 'string',
        description: 'The replacement text. Use empty string to delete the matched text.'
      },
      replace_all: {
        type: 'boolean',
        description:
          'Replace all occurrences instead of requiring exactly one match. Defaults to false.'
      }
    },
    required: ['path', 'old_string', 'new_string']
  }
}
