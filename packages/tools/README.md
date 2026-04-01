# @vox-ai-app/tools

Core tool infrastructure for Vox: registry, schema validation, builtins (filesystem, shell, fetch, grep, glob), document builders (Word, PDF, PPTX), exec utilities, and security primitives.

## Install

```sh
npm install @vox-ai-app/tools
```

Peer dependency: `electron >= 28`

## Exports

| Export                       | Contents                              |
| ---------------------------- | ------------------------------------- |
| `@vox-ai-app/tools`          | All core exports                      |
| `@vox-ai-app/tools/exec`     | Exec utilities (spawn, abort, escape) |
| `@vox-ai-app/tools/schema`   | Arg validation and definition checks  |
| `@vox-ai-app/tools/network`  | URL safety and SSRF prevention        |
| `@vox-ai-app/tools/registry` | Tool registry and dispatch            |

## Builtin Tools

### Filesystem

| Tool                   | Description                                                                    |
| ---------------------- | ------------------------------------------------------------------------------ |
| `read_local_file`      | Read files with offset/length or line-range (`startLine`/`endLine`) pagination |
| `write_local_file`     | Create or update files (utf8 or base64), with staleness checks                 |
| `edit_local_file`      | Targeted string replacement in files without rewriting the whole file          |
| `list_local_directory` | List directory contents with optional details                                  |
| `delete_local_path`    | Delete files or directories with symlink traversal protection                  |
| `get_scratch_dir`      | Get a temporary scratch directory                                              |

### Search

| Tool         | Description                                            |
| ------------ | ------------------------------------------------------ |
| `grep_local` | Regex search across files with context lines and globs |
| `glob_local` | Find files by glob pattern across directories          |

### Shell

| Tool                | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `run_local_command` | Execute shell commands with timeout, output limits, and background mode |

### Network

| Tool            | Description                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| `fetch_webpage` | Fetch and extract text from URLs with SSRF protection and redirect detection |

### Documents

| Tool                           | Description          |
| ------------------------------ | -------------------- |
| `create_word_document`         | Generate .docx files |
| `create_pdf_document`          | Generate .pdf files  |
| `create_presentation_document` | Generate .pptx files |

## Registry

The registry holds all registered tools (builtins + MCP) and dispatches `run()` calls. Arguments are validated against each tool's parameter schema before execution.

```js
import {
  registerAll,
  registerMcp,
  unregisterMcp,
  closeAllMcp,
  getDeclarations,
  run,
  setOnChange,
  setLogger
} from '@vox-ai-app/tools/registry'

setLogger(logger)
setOnChange(() => {})

registerAll(tools)

const { client, tools } = await connectMcpServer(server)
registerMcp(server, client, tools)

const result = await run('read_local_file', { path: '~/notes.md' }, { signal })
```

## Schema Validation

```js
import { validateArgs, assertValidDefinition, clampNumber } from '@vox-ai-app/tools/schema'

const issues = validateArgs(tool.definition.parameters, args)
assertValidDefinition(def)
```

`validateArgs` checks required fields, types, enums, `minLength`/`maxLength` for strings, and `minimum`/`maximum` for numbers.

## Security

The tools package includes several security layers:

- **SSRF prevention** — `assertPublicUrl` blocks private/internal IPs. `fetch_webpage` additionally resolves DNS and rejects responses where the hostname resolves to a private address.
- **Redirect detection** — Fetch uses `redirect: 'manual'` and surfaces redirect targets instead of following them silently.
- **Write path restrictions** — Writes to system directories (`/etc`, `/System`, `/usr`, etc.) are blocked.
- **Staleness checks** — Writes and edits compare the file's mtime against the last read to warn about concurrent modifications.
- **Device file blocking** — Reads/writes to device files (`/dev/`, `/proc/`, etc.) are rejected.
- **Symlink traversal protection** — `delete_local_path` resolves symlinks before checking path restrictions.
- **Shell dangerous pattern detection** — Commands containing `rm -rf /`, `mkfs`, `dd if=`, `:(){ :|:& };:`, and similar patterns are rejected.
- **Read-only classification** — Tools declare `readOnly: true` in their definition to enable safe parallel execution.

## Document Builders

```js
import { createWordDocument, createPdfDocument, createPresentationDocument } from '@vox-ai-app/tools'

await createWordDocument({ path: '~/report.docx', content: '# Title\n\nBody text.' })
await createPdfDocument({ path: '~/report.pdf', content: '# Title\n\nBody text.' })
await createPresentationDocument({ path: '~/slides.pptx', slides: [...] })
```

## Exec Utilities

```js
import { execAsync, execAbortable, esc, writeTempScript, cleanupTemp } from '@vox-ai-app/tools/exec'

const { stdout } = await execAsync('ls -la', { timeout: 10_000 })
const { stdout } = await execAbortable('long-cmd', { timeout: 30_000 }, signal)
```

## License

MIT
