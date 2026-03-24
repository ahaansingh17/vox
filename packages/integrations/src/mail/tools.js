import { MAIL_TOOL_DEFINITIONS } from './def.js'
import {
  sendEmail,
  readEmails,
  searchContacts,
  getEmailBody,
  replyToEmail,
  forwardEmail,
  markEmailRead,
  flagEmail,
  deleteEmail,
  moveEmail,
  createDraft,
  saveAttachment
} from './index.js'

const DARWIN_ONLY = () => {
  throw new Error('Mail tools are only available on macOS.')
}

const isDarwin = process.platform === 'darwin'

const executors = {
  read_emails: (_ctx) => (isDarwin ? readEmails : DARWIN_ONLY),
  search_contacts: (_ctx) => (isDarwin ? searchContacts : DARWIN_ONLY),
  send_email: (_ctx) => (isDarwin ? sendEmail : DARWIN_ONLY),
  get_email_body: (_ctx) => (isDarwin ? getEmailBody : DARWIN_ONLY),
  reply_to_email: (_ctx) => (isDarwin ? replyToEmail : DARWIN_ONLY),
  forward_email: (_ctx) => (isDarwin ? forwardEmail : DARWIN_ONLY),
  mark_email_read: (_ctx) => (isDarwin ? markEmailRead : DARWIN_ONLY),
  flag_email: (_ctx) => (isDarwin ? flagEmail : DARWIN_ONLY),
  delete_email: (_ctx) => (isDarwin ? deleteEmail : DARWIN_ONLY),
  move_email: (_ctx) => (isDarwin ? moveEmail : DARWIN_ONLY),
  create_draft: (_ctx) => (isDarwin ? createDraft : DARWIN_ONLY),
  save_attachment: (_ctx) => (isDarwin ? saveAttachment : DARWIN_ONLY)
}

export const MAIL_TOOLS = MAIL_TOOL_DEFINITIONS.map((def) => ({
  definition: def,
  execute: executors[def.name]
}))
