# @vox-ai-app/storage

Local persistence for Vox: conversations, messages, tasks, settings, tool registry, MCP servers, schedules, secrets, patterns, and vector embeddings. Built on SQLite via `better-sqlite3` with WAL mode and automatic migrations.

## Install

```sh
npm install @vox-ai-app/storage
```

## Exports

| Export                             | Contents                        |
| ---------------------------------- | ------------------------------- |
| `@vox-ai-app/storage`              | All exports                     |
| `@vox-ai-app/storage/db`           | Database lifecycle (open/close) |
| `@vox-ai-app/storage/messages`     | Conversations and messages      |
| `@vox-ai-app/storage/tasks`        | Task and task activity storage  |
| `@vox-ai-app/storage/tools`        | Custom tool definitions         |
| `@vox-ai-app/storage/settings`     | Key-value settings persistence  |
| `@vox-ai-app/storage/mcp-servers`  | MCP server configurations       |
| `@vox-ai-app/storage/schedules`    | Scheduled job persistence       |
| `@vox-ai-app/storage/tool-secrets` | Encrypted tool secret storage   |
| `@vox-ai-app/storage/patterns`     | Conversation pattern storage    |
| `@vox-ai-app/storage/vectors`      | Vector embedding storage        |

## Database

```js
import { openDb, closeDb } from '@vox-ai-app/storage/db'

const db = openDb('/path/to/storage.db')
closeDb('/path/to/storage.db')
```

The database uses WAL journal mode and foreign keys. Schema is managed via migrations in `src/migrations/`.

## Messages

```js
import {
  ensureConversation,
  appendMessage,
  getMessages,
  getMessagesBeforeId,
  clearMessages,
  saveSummaryCheckpoint,
  loadSummaryCheckpoint
} from '@vox-ai-app/storage/messages'

ensureConversation(db, 'main')
appendMessage(db, 'user', 'Hello', 'main')
appendMessage(db, 'assistant', 'Hi there!', 'main')

const messages = getMessages(db, 'main', 50)
const older = getMessagesBeforeId(db, messages[0].id, 'main', 20)

saveSummaryCheckpoint(db, 'summary text', 42, 'main')
const { summary, checkpointId } = loadSummaryCheckpoint(db, 'main')

clearMessages(db, 'main')
```

## Tasks

```js
import {
  upsertTask,
  getTask,
  loadTasks,
  appendTaskActivity,
  loadTaskActivity
} from '@vox-ai-app/storage/tasks'

upsertTask(db, {
  taskId: 'abc-123',
  instructions: 'Summarize the document',
  status: 'running'
})

const task = getTask(db, 'abc-123')
const allTasks = loadTasks(db)

appendTaskActivity(db, {
  id: 'act-1',
  taskId: 'abc-123',
  type: 'tool_call',
  name: 'read_local_file',
  timestamp: new Date().toISOString(),
  data: { path: '~/doc.md' }
})

const activity = loadTaskActivity(db, 'abc-123')
```

## Settings

```js
import { getSetting, setSetting, getAllSettings, deleteSetting } from '@vox-ai-app/storage/settings'

setSetting(db, 'theme', 'dark')
const theme = getSetting(db, 'theme')
const all = getAllSettings(db)
deleteSetting(db, 'theme')
```

## License

MIT
