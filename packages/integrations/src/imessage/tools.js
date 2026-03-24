import { IMESSAGE_TOOL_DEFINITIONS } from './def.js'
import { listConversations, listContacts } from './mac/data.js'
import { sendReply } from './mac/reply.js'

const DARWIN_ONLY = () => {
  throw new Error('iMessage is only available on macOS.')
}

const listImessageConversations = async () => {
  const conversations = listConversations()
  return { conversations }
}

const listImessageContacts = async () => {
  const contacts = listContacts()
  return { contacts }
}

const sendImessage = async ({ handle, text }) => {
  if (!handle) throw new Error('"handle" is required.')
  if (!text) throw new Error('"text" is required.')
  await sendReply(handle, String(text))
  return { ok: true, handle }
}

const macExecutors = {
  list_imessage_conversations: (_ctx) => listImessageConversations,
  list_imessage_contacts: (_ctx) => listImessageContacts,
  send_imessage: (_ctx) => sendImessage
}

const executors =
  process.platform === 'darwin'
    ? macExecutors
    : {
        list_imessage_conversations: (_ctx) => DARWIN_ONLY,
        list_imessage_contacts: (_ctx) => DARWIN_ONLY,
        send_imessage: (_ctx) => DARWIN_ONLY
      }

export const IMESSAGE_TOOLS = IMESSAGE_TOOL_DEFINITIONS.map((def) => ({
  definition: def,
  execute: executors[def.name]
}))
