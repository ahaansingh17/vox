export const writeLocalFileDef = {
  name: 'write_local_file',
  description:
    "Create or update a local file on the user's machine. Supports text and base64 payloads for binary files.",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Target file path. Supports absolute paths and ~/ shortcuts.'
      },
      content: {
        type: 'string',
        description: 'File content. For binary writes, provide base64 and set encoding to base64.'
      },
      encoding: {
        type: 'string',
        description: 'Content encoding: utf8 or base64. Defaults to utf8.'
      },
      append: { type: 'boolean', description: 'Append instead of overwrite. Defaults to false.' },
      createParents: {
        type: 'boolean',
        description: 'Create missing parent directories. Defaults to true.'
      }
    },
    required: ['path']
  }
}

export const readLocalFileDef = {
  name: 'read_local_file',
  description:
    "Read a local file from the user's machine. Returns text content (utf8) or base64 for binary files. Supports pagination via offset/length — call again with a higher offset to read more.",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Target file path. Supports absolute paths and ~/ shortcuts.'
      },
      offset: {
        type: 'integer',
        description:
          'Character offset (utf8) or byte offset (base64) to start reading from. Default 0.'
      },
      length: {
        type: 'integer',
        description:
          'Number of characters (utf8, default 30000, max 60000) or bytes (base64, default 120000, max 500000) to return.'
      },
      encoding: { type: 'string', description: 'Read encoding: utf8 or base64. Defaults to utf8.' }
    },
    required: ['path']
  }
}

export const listLocalDirectoryDef = {
  name: 'list_local_directory',
  description: "List files and folders from a local directory on the user's machine.",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path. Supports absolute paths and ~/ shortcuts. Defaults to home.'
      },
      includeHidden: { type: 'boolean', description: 'Include dotfiles. Defaults to false.' },
      includeDetails: {
        type: 'boolean',
        description: 'Include size and modified time. Defaults to true.'
      },
      limit: { type: 'integer', description: 'Max entries to return (default 300, max 2000).' }
    }
  }
}

export const deleteLocalPathDef = {
  name: 'delete_local_path',
  description:
    'Delete a local file or folder. Use only when the user explicitly asks to delete something.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Target file or folder path.' },
      recursive: {
        type: 'boolean',
        description: 'Allow deleting directories recursively. Defaults to true.'
      },
      force: { type: 'boolean', description: 'Ignore missing files. Defaults to false.' },
      dryRun: { type: 'boolean', description: 'Preview only, no deletion. Defaults to false.' }
    },
    required: ['path']
  }
}

export const getScratchDirDef = {
  name: 'get_scratch_dir',
  description:
    'Create a dedicated temp working directory for this task. Returns the absolute path.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Optional folder identifier. Random ID used if omitted.' }
    }
  }
}

export const FS_TOOL_DEFINITIONS = [
  writeLocalFileDef,
  readLocalFileDef,
  listLocalDirectoryDef,
  deleteLocalPathDef,
  getScratchDirDef
]
