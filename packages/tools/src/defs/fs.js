export const FS_TOOL_DEFINITIONS = [
  {
    name: 'write_local_file',
    description:
      "Create or update a local file on the user's machine. Supports text and base64 payloads for binary files (docx, pptx, images, zip, etc.).",
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Target file path. Supports absolute paths and ~/ shortcuts.'
        },
        content: {
          type: 'string',
          description:
            'File content. For text files provide plain text. For binary writes, provide base64 content and set encoding to base64.'
        },
        encoding: {
          type: 'string',
          description: 'Content encoding: utf8 or base64. Defaults to utf8.'
        },
        append: {
          type: 'boolean',
          description: 'Append content instead of overwrite. Defaults to false.'
        },
        createParents: {
          type: 'boolean',
          description: 'Create missing parent directories automatically. Defaults to true.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'read_local_file',
    description:
      "Read a local file directly from the user's machine by path. Automatically extracts readable text from documents (PDF, DOCX, PPTX, XLSX, ODT, ODP, ODS, RTF). Supports plain text mode and base64 mode for other binary files.",
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Target file path. Supports absolute paths and ~/ shortcuts.'
        },
        maxChars: {
          type: 'integer',
          description: 'Maximum number of characters to return (default 60000, max 120000).'
        },
        maxBytes: {
          type: 'integer',
          description:
            'Maximum bytes to return when encoding is base64 (default 120000, max 500000).'
        },
        encoding: {
          type: 'string',
          description: 'Read encoding: utf8 or base64. Defaults to utf8.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'list_local_directory',
    description:
      "List files and folders from a local directory on the user's machine (ls-style output).",
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Directory path to inspect. Supports absolute paths and ~/ shortcuts. Defaults to home directory.'
        },
        includeHidden: {
          type: 'boolean',
          description: 'Include dotfiles and hidden entries. Defaults to false.'
        },
        includeDetails: {
          type: 'boolean',
          description: 'Include size and modified timestamp for each entry. Defaults to true.'
        },
        limit: {
          type: 'integer',
          description: 'Maximum entries to return (default 300, max 2000).'
        }
      }
    }
  },
  {
    name: 'delete_local_path',
    description:
      "Delete a local file or folder on the user's machine. Use only when the user explicitly asks to delete/remove something.",
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Target file or folder path. Supports absolute paths and ~/ shortcuts.'
        },
        recursive: {
          type: 'boolean',
          description: 'Allow deleting directories recursively. Defaults to true.'
        },
        force: {
          type: 'boolean',
          description: 'Ignore missing files and best-effort delete. Defaults to false.'
        },
        dryRun: {
          type: 'boolean',
          description: 'Preview only without deleting. Defaults to false.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'run_local_command',
    description:
      "Run any shell command on the user's local macOS machine. Use this for anything that needs to interact with the local OS: opening applications, running scripts, automating the desktop, managing files, installing packages, starting servers, or any other system-level task. There is no restriction on what commands can be run — use whatever tools macOS provides (osascript, bash, python, node, etc.). For long-running or bulk operations increase timeoutMs.",
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute.'
        },
        cwd: {
          type: 'string',
          description:
            'Working directory path (absolute or ~/ shortcut). Defaults to home directory.'
        },
        timeoutMs: {
          type: 'integer',
          description: 'Execution timeout in milliseconds (default 120000, max 600000).'
        },
        maxOutputChars: {
          type: 'integer',
          description: 'Maximum output characters returned per stream (default 50000, max 200000).'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'get_scratch_dir',
    description:
      "Create and return a dedicated temporary working directory for this task. Use this for any intermediate or cache files the agent needs during processing — do NOT scatter temp files across the user's home directory. Returns the absolute path of the created folder.",
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Optional identifier for the folder (e.g. a task name slug). A random ID is used if omitted. Reuse the same id within a task to get back the same directory.'
        }
      }
    }
  }
]
