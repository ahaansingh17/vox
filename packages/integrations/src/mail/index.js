import { sendEmailMac, searchContactsMac } from './send/mac.js'
import { readEmailsMac, getEmailBodyMac } from './read/mac.js'
import {
  replyToEmailMac,
  forwardEmailMac,
  markEmailReadMac,
  flagEmailMac,
  deleteEmailMac,
  moveEmailMac,
  createDraftMac,
  saveAttachmentMac
} from './manage/mac.js'
const normalizeList = (v) => {
  if (!v) return []
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean)
  return String(v)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
export const sendEmail = async (payload) => {
  const to = normalizeList(payload?.to)
  if (!to.length) throw new Error('"to" is required.')
  const args = {
    to,
    cc: normalizeList(payload?.cc),
    bcc: normalizeList(payload?.bcc),
    subject: String(payload?.subject || '').trim(),
    body: String(payload?.body ?? payload?.text ?? payload?.content ?? '').trim(),
    attachments: normalizeList(payload?.attachments ?? payload?.attachment),
    account: String(payload?.account ?? '').trim() || undefined
  }
  return sendEmailMac(args)
}
export const readEmails = async (payload) => {
  const folder = String(payload?.folder ?? 'INBOX').trim()
  const limit = Math.min(Math.max(1, Number(payload?.limit ?? 20)), 200)
  const offset = Math.max(0, Number(payload?.offset ?? 0))
  const unreadOnly = Boolean(payload?.unread_only ?? payload?.unreadOnly ?? false)
  const search = String(payload?.search ?? '').trim()
  const account = String(payload?.account ?? '').trim() || undefined
  const args = {
    folder,
    limit,
    offset,
    unreadOnly,
    search,
    account
  }
  const messages = await readEmailsMac(args)
  return {
    folder,
    count: messages.length,
    messages
  }
}
export const searchContacts = async (payload) => {
  const query = String(payload?.query ?? payload?.name ?? payload?.q ?? '').trim()
  if (!query) throw new Error('"query" is required.')
  const contacts = await searchContactsMac(query)
  return {
    query,
    count: contacts.length,
    contacts
  }
}
export const getEmailBody = async (payload) => {
  const sender = String(payload?.sender ?? payload?.from ?? '').trim()
  const subject = String(payload?.subject ?? '').trim()
  const messageId = String(payload?.message_id ?? payload?.messageId ?? '').trim()
  const args = {
    sender,
    subject,
    messageId
  }
  return getEmailBodyMac(args)
}
export const replyToEmail = async (payload) => {
  const messageId = String(payload?.message_id ?? payload?.messageId ?? '').trim()
  if (!messageId) throw new Error('"message_id" is required.')
  const body = String(payload?.body ?? '').trim()
  if (!body) throw new Error('"body" is required.')
  const replyAll = Boolean(payload?.reply_all ?? payload?.replyAll ?? false)
  const account = String(payload?.account ?? '').trim() || undefined
  return replyToEmailMac({
    messageId,
    body,
    replyAll,
    account
  })
}
export const forwardEmail = async (payload) => {
  const messageId = String(payload?.message_id ?? payload?.messageId ?? '').trim()
  if (!messageId) throw new Error('"message_id" is required.')
  const to = normalizeList(payload?.to)
  if (!to.length) throw new Error('"to" is required.')
  const body = String(payload?.body ?? '').trim()
  const account = String(payload?.account ?? '').trim() || undefined
  return forwardEmailMac({
    messageId,
    to,
    body,
    account
  })
}
export const markEmailRead = async (payload) => {
  const messageId = String(payload?.message_id ?? payload?.messageId ?? '').trim()
  if (!messageId) throw new Error('"message_id" is required.')
  const read = payload?.read !== undefined ? Boolean(payload.read) : true
  return markEmailReadMac({
    messageId,
    read
  })
}
export const flagEmail = async (payload) => {
  const messageId = String(payload?.message_id ?? payload?.messageId ?? '').trim()
  if (!messageId) throw new Error('"message_id" is required.')
  const flagged = payload?.flagged !== undefined ? Boolean(payload.flagged) : true
  return flagEmailMac({
    messageId,
    flagged
  })
}
export const deleteEmail = async (payload) => {
  const messageId = String(payload?.message_id ?? payload?.messageId ?? '').trim()
  if (!messageId) throw new Error('"message_id" is required.')
  return deleteEmailMac({
    messageId
  })
}
export const moveEmail = async (payload) => {
  const messageId = String(payload?.message_id ?? payload?.messageId ?? '').trim()
  if (!messageId) throw new Error('"message_id" is required.')
  const targetFolder = String(payload?.target_folder ?? payload?.targetFolder ?? '').trim()
  if (!targetFolder) throw new Error('"target_folder" is required.')
  return moveEmailMac({
    messageId,
    targetFolder
  })
}
export const createDraft = async (payload) => {
  const to = normalizeList(payload?.to)
  if (!to.length) throw new Error('"to" is required.')
  return createDraftMac({
    to,
    subject: String(payload?.subject || '').trim(),
    body: String(payload?.body ?? payload?.text ?? payload?.content ?? '').trim(),
    cc: normalizeList(payload?.cc),
    bcc: normalizeList(payload?.bcc),
    attachments: normalizeList(payload?.attachments ?? payload?.attachment),
    account: String(payload?.account ?? '').trim() || undefined
  })
}
export const saveAttachment = async (payload) => {
  const messageId = String(payload?.message_id ?? payload?.messageId ?? '').trim()
  if (!messageId) throw new Error('"message_id" is required.')
  const attachmentName = String(payload?.attachment_name ?? payload?.attachmentName ?? '').trim()
  if (!attachmentName) throw new Error('"attachment_name" is required.')
  const savePath = String(payload?.save_path ?? payload?.savePath ?? '').trim() || undefined
  return saveAttachmentMac({
    messageId,
    attachmentName,
    savePath
  })
}
