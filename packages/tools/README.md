# @info-arnav/vox-tools

Core tool infrastructure for Vox: exec utilities, schema validation, builtins (filesystem, shell, fetch), document builders (Word, PDF, PPTX), LLM tool definitions, and the tool registry.

## Install

```sh
npm install @info-arnav/vox-tools
```

Peer dependency: `electron >= 28`

## Packages

| Export                           | Contents                      |
| -------------------------------- | ----------------------------- |
| `@info-arnav/vox-tools`          | All core exports              |
| `@info-arnav/vox-tools/exec`     | Exec utilities                |
| `@info-arnav/vox-tools/schema`   | Validation helpers            |
| `@info-arnav/vox-tools/network`  | URL safety checks             |
| `@info-arnav/vox-tools/registry` | Tool registry                 |
| `@info-arnav/vox-tools/builtins` | fs + shell + fetch tools      |
| `@info-arnav/vox-tools/docs`     | Word / PDF / PPTX builders    |
| `@info-arnav/vox-tools/defs`     | All built-in tool definitions |

## Registry

The registry holds all registered tools (builtins + MCP) and dispatches `run()` calls.

```js
import {
  registerBuiltins,
  registerMcp,
  unregisterMcp,
  closeAllMcp,
  getDeclarations,
  run,
  setOnChange,
  setLogger
} from '@info-arnav/vox-tools/registry'

setLogger(logger)
setOnChange(() => {
  /* tool list changed */
})

registerBuiltins(executors, definitions)

const { client, tools } = await connectMcpServer(server)
registerMcp(server, client, tools)

const result = await run('read_file', { path: '~/notes.md' }, { signal })
```

## Builtins

```js
import { loadBuiltinTools, ALL_BUILTIN_DEFINITIONS } from '@info-arnav/vox-tools/builtins'

const executors = loadBuiltinTools({ scratchDir: '/tmp/vox' })
registerBuiltins(executors, ALL_BUILTIN_DEFINITIONS)
```

Built-in tools: `write_file`, `read_file`, `list_directory`, `delete_path`, `get_scratch_dir`, `run_command`, `fetch_webpage`.

## Document Builders

```js
import { createWordDocument, createPdfDocument, createPresentationDocument } from '@info-arnav/vox-tools/docs'

await createWordDocument({ path: '~/report.docx', content: '# Title\n\nBody text.' })
await createPdfDocument({ path: '~/report.pdf', content: '# Title\n\nBody text.' })
await createPresentationDocument({ path: '~/slides.pptx', slides: [...] })
```

## Exec Utilities

```js
import {
  execAsync,
  execAbortable,
  esc,
  writeTempScript,
  cleanupTemp
} from '@info-arnav/vox-tools/exec'

const { stdout } = await execAsync('ls -la', { timeout: 10_000 })
const { stdout } = await execAbortable('long-cmd', { timeout: 30_000 }, signal)
```

## Tool Definitions

Pre-built JSON Schema definitions for use with any LLM function-calling API.

```js
import {
  FS_TOOL_DEFINITIONS,
  WORD_TOOL_DEFINITIONS,
  KNOWLEDGE_TOOL_DEFINITIONS
} from '@info-arnav/vox-tools/defs'
```

## License

MIT
