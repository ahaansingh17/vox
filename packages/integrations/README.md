# @info-arnav/vox-integrations

macOS system integrations for Vox: Apple Mail, Screen control, and iMessage. Each integration ships with tool implementations and LLM tool definitions.

Requires macOS. Each integration needs specific system permissions granted by the user.

## Install

```sh
npm install @info-arnav/vox-integrations
```

Peer dependency: `electron >= 28`

## Packages

| Export                                          | Contents                      |
| ----------------------------------------------- | ----------------------------- |
| `@info-arnav/vox-integrations`                  | All exports                   |
| `@info-arnav/vox-integrations/defs`             | All tool definitions          |
| `@info-arnav/vox-integrations/mail`             | Mail functions                |
| `@info-arnav/vox-integrations/screen`           | Screen capture + control      |
| `@info-arnav/vox-integrations/imessage`         | iMessage data, reply, service |
| `@info-arnav/vox-integrations/imessage/service` | Poll-loop watcher factory     |

## Mail

Requires **Automation permission** for Mail (System Settings → Privacy & Security → Automation).

```js
import {
  sendEmail,
  readEmails,
  searchContacts,
  replyToEmail
} from '@info-arnav/vox-integrations/mail'

const emails = await readEmails({ account: 'Work', folder: 'INBOX', limit: 20 })
await sendEmail({ to: 'user@example.com', subject: 'Hi', body: 'Hello.' })
await replyToEmail({ messageId: '...', body: 'Thanks!' })
```

Tool definitions:

```js
import { MAIL_TOOL_DEFINITIONS } from '@info-arnav/vox-integrations/defs'
```

## Screen

Requires **Accessibility permission** (System Settings → Privacy & Security → Accessibility).

```js
import {
  captureFullScreen,
  clickAt,
  typeText,
  getUiElements
} from '@info-arnav/vox-integrations/screen'
import { acquireScreen, releaseScreen } from '@info-arnav/vox-integrations/screen/queue'

const session = await acquireScreen()
try {
  const img = await captureFullScreen()
  await clickAt({ x: 100, y: 200 })
  await typeText({ text: 'Hello' })
} finally {
  await releaseScreen(session)
}
```

Tool definitions:

```js
import { SCREEN_TOOL_DEFINITIONS } from '@info-arnav/vox-integrations/defs'
```

## iMessage

Requires **Full Disk Access** (System Settings → Privacy & Security → Full Disk Access).

### Tool use (read conversations, send messages)

```js
import { listConversations, listContacts, sendReply } from '@info-arnav/vox-integrations/imessage'

const conversations = listConversations()
const contacts = listContacts()
await sendReply('+15551234567', 'Hello from Vox!')
```

### Gateway service (AI replies to incoming iMessages)

```js
import { createIMessageService } from '@info-arnav/vox-integrations/imessage/service'

const svc = createIMessageService({
  logger,
  onTranscript: (text, handle) => {
    /* emit to UI */
  },
  onOpenSettings: () => shell.openExternal('x-apple.systempreferences:...'),
  onMessage: async (text, handle) => {
    // call your AI here, return the reply string
    return await askAI(text)
  }
})

svc.start('my-passphrase')
// user sends "my-passphrase\nWhat's the weather?" → AI replies back
```

`onMessage` must return a `Promise<string | null>`. Returning `null` skips the reply. The service handles the 3-second poll loop and 90-second response timeout internally.

Tool definitions:

```js
import { IMESSAGE_TOOL_DEFINITIONS } from '@info-arnav/vox-integrations/defs'
```

## License

MIT
