# @vox-ai-app/storage

Local persistence for Vox: conversations, messages, tasks, task activity, and key-value config. Built on SQLite via `better-sqlite3` with WAL mode.

## Install

```sh
npm install @vox-ai-app/storage
```

## Exports

| Export                         | Contents                        |
| ------------------------------ | ------------------------------- |
| `@vox-ai-app/storage`          | All exports                     |
| `@vox-ai-app/storage/db`       | Database lifecycle (open/close) |
| `@vox-ai-app/storage/messages` | Conversations and messages      |
| `@vox-ai-app/storage/config`   | Key-value config persistence    |
| `@vox-ai-app/storage/tasks`    | Task and task activity storage  |

## Database

```js
import { openDb, closeDb } from '@vox-ai-app/storage/db'

const db = openDb('/path/to/storage.db')
// tables are auto-created on first open

closeDb('/path/to/storage.db')
```

The database uses WAL journal mode and foreign keys. Tables for conversations, messages, tasks, and task activity are created automatically.

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

## Config

JSON file-based key-value store with atomic writes (write to temp, rename).

```js
import { configGet, configSet, configDelete, configGetAll } from '@vox-ai-app/storage/config'

configSet('/path/to/config.json', 'theme', 'dark')
const theme = configGet('/path/to/config.json', 'theme')
configDelete('/path/to/config.json', 'theme')
const all = configGetAll('/path/to/config.json')
```

## License

MIT
