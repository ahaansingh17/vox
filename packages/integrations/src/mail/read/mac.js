import Database from 'better-sqlite3'
import { readdirSync } from 'node:fs'
import { shell } from 'electron'
import {
  execAsync,
  execAbortable,
  esc,
  EXEC_TIMEOUT,
  writeTempScript,
  cleanupTemp
} from '@info-arnav/vox-tools/exec'
import { ensureAppleMailConfigured } from '../mac.shared.js'
const DB = `${process.env.HOME}/Library/Mail/V10/MailData/Envelope Index`
const MAIL_DIR = `${process.env.HOME}/Library/Mail/`
const SYNC_RETRY_DELAY = 2_000
const SYNC_MAX_RETRIES = 3
const FRESH_CACHE_TTL = 10_000
const ACCOUNT_CACHE_TTL = 60_000
let _accountCache = null
let _freshCache = null
const openFdaSettings = () => {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles')
}
export const openMailPermissionSettings = openFdaSettings
const throwFdaError = () => {
  openFdaSettings()
  throw Object.assign(
    new Error(
      'Vox needs Full Disk Access to read your emails. Opening System Settings → Privacy & Security → Full Disk Access — please enable it for Vox and try again.'
    ),
    {
      code: 'MAIL_FDA_REQUIRED'
    }
  )
}
const checkMailAccess = () => {
  try {
    readdirSync(MAIL_DIR)
    return true
  } catch {
    return false
  }
}
const getAccountMap = async (signal) => {
  if (_accountCache && Date.now() - _accountCache.ts < ACCOUNT_CACHE_TTL) {
    return _accountCache.map
  }
  await ensureAppleMailConfigured(signal)
  const script = `tell application "Mail"
  set output to ""
  repeat with a in every account
    set output to output & (id of a) & tab & (name of a) & tab & (email addresses of a) & linefeed
  end repeat
  return output
end tell`
  const scriptFile = await writeTempScript(script, 'scpt')
  try {
    const { stdout } = await execAbortable(
      `osascript "${scriptFile}"`,
      {
        timeout: 15_000
      },
      signal
    )
    const map = {}
    String(stdout)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        const parts = line.split('\t')
        if (parts.length >= 2) {
          const uuid = parts[0].trim().toUpperCase()
          const name = parts[1].trim()
          const email = (parts[2] || '').trim().toLowerCase()
          map[uuid] = {
            name,
            email
          }
        }
      })
    _accountCache = {
      map,
      ts: Date.now()
    }
    return map
  } finally {
    await cleanupTemp(scriptFile)
  }
}
const uuidFromUrl = (url) => {
  const m = url && url.match(/\/\/([0-9A-F-]{36})\//i)
  return m ? m[1].toUpperCase() : null
}
const sqlite = (sql, params = []) => {
  const db = new Database(DB, {
    readonly: true,
    fileMustExist: true
  })
  try {
    return db.prepare(sql).all(...params)
  } finally {
    db.close()
  }
}
const getLatestIds = async (signal) => {
  const script = `tell application "Mail"
  set output to ""
  repeat with acct in every account
    set mb to missing value
    try
      set mb to mailbox "INBOX" of acct
    end try
    if mb is missing value then
      try
        set mb to mailbox "Inbox" of acct
      end try
    end if
    if mb is not missing value then
      try
        set m to message 1 of mb
        set output to output & (id of acct) & tab & (id of m) & linefeed
      end try
    end if
  end repeat
  return output
end tell`
  const scriptFile = await writeTempScript(script, 'scpt')
  try {
    const { stdout } = await execAbortable(
      `osascript "${scriptFile}"`,
      {
        timeout: 15_000
      },
      signal
    )
    return String(stdout)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [, msgId] = line.split('\t')
        return msgId ? Number(msgId) : null
      })
      .filter(Boolean)
  } finally {
    await cleanupTemp(scriptFile)
  }
}
const checkIdsInDb = (ids) => {
  if (!ids.length) return true
  const placeholders = ids.map(() => '?').join(',')
  const row = sqlite(`SELECT COUNT(*) as count FROM messages WHERE ROWID IN (${placeholders})`, ids)
  return row[0]?.count === ids.length
}
const triggerSync = () => {
  const script = `tell application "Mail"
  repeat with acct in every account
    try
      synchronize acct
    end try
  end repeat
end tell`
  writeTempScript(script, 'scpt')
    .then((f) => execAsync(`osascript "${f}"`).finally(() => cleanupTemp(f)))
    .catch(() => {})
}
const ensureFresh = async (signal) => {
  if (_freshCache && Date.now() - _freshCache.ts < FRESH_CACHE_TTL) return
  let ids
  try {
    ids = await getLatestIds(signal)
  } catch {
    _freshCache = {
      ts: Date.now()
    }
    return
  }
  try {
    if (checkIdsInDb(ids)) {
      _freshCache = {
        ts: Date.now()
      }
      return
    }
  } catch {
    _freshCache = {
      ts: Date.now()
    }
    return
  }
  for (let i = 0; i < SYNC_MAX_RETRIES; i++) {
    triggerSync()
    await new Promise((r) => setTimeout(r, SYNC_RETRY_DELAY))
    try {
      if (checkIdsInDb(ids)) {
        _freshCache = {
          ts: Date.now()
        }
        return
      }
    } catch {
      break
    }
  }
  _freshCache = {
    ts: Date.now()
  }
}
const escapeLike = (s) => s.replace(/%/g, '\\%').replace(/_/g, '\\_')
const findAccount = (accountMap, query) => {
  const q = query.toLowerCase()
  return Object.entries(accountMap).find(
    ([, { name, email }]) => name.toLowerCase().includes(q) || email.includes(q)
  )
}
const localISODate = (ms) => {
  const d = new Date(ms)
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const pad = (n) => String(Math.abs(n)).padStart(2, '0')
  const local = new Date(ms - d.getTimezoneOffset() * 60_000)
  return (
    local.toISOString().slice(0, 19) +
    `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
  )
}
const rowToEmail = (row, accountMap) => {
  const uuid = uuidFromUrl(row.url)
  const acct = (uuid && accountMap[uuid]) || null
  const senderEmail = row.address || ''
  const senderName = row.comment || ''
  const sender = senderName ? `${senderName} <${senderEmail}>` : senderEmail
  const dateTs = row.date_received
  return {
    id: String(row.ROWID),
    subject: row.subject,
    sender,
    date: dateTs ? localISODate(dateTs * 1000) : null,
    read: row.read === 1,
    flagged: row.flagged === 1,
    account: acct ? acct.name : uuid || ''
  }
}
const parseBodyOutput = (raw) => {
  if (!raw || raw === 'NOT_FOUND')
    return {
      found: false,
      body: null,
      attachments: []
    }
  const bodyMarker = raw.indexOf('\n---BODY:')
  const attMarker = raw.lastIndexOf('\n---ATTACHMENTS:')
  let id
  let body = raw
  let attachments = []
  if (bodyMarker !== -1) {
    id = raw.slice(0, bodyMarker)
    body = attMarker !== -1 ? raw.slice(bodyMarker + 9, attMarker) : raw.slice(bodyMarker + 9)
  }
  if (attMarker !== -1) {
    const [, ...nameParts] = raw.slice(attMarker + 16).split(':')
    attachments = nameParts
      .join(':')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
  }
  return {
    found: true,
    id,
    body,
    attachments
  }
}
export const readEmailsMac = async (
  { folder = 'inbox', limit = 20, offset = 0, unreadOnly = false, search = '', account = '' },
  { signal } = {}
) => {
  if (!checkMailAccess()) throwFdaError()
  const [accountMap] = await Promise.all([getAccountMap(signal), ensureFresh(signal)])
  const conditions = ['AND m.deleted = 0']
  const params = []
  if (folder.toLowerCase() === 'inbox') {
    conditions.push(`AND (
      (mb.url LIKE '%/INBOX' OR mb.url LIKE '%/Inbox')
      OR
      (mb.url LIKE '%5BGmail%5D/All%20Mail' AND EXISTS (
        SELECT 1 FROM labels l
        JOIN mailboxes lmb ON l.mailbox_id = lmb.ROWID
        WHERE l.message_id = m.ROWID
        AND (lmb.url LIKE '%/INBOX' OR lmb.url LIKE '%/Inbox')
      ))
    )`)
  } else {
    conditions.push(`AND mb.url LIKE ? ESCAPE '\\'`)
    params.push(`%/${escapeLike(folder)}`)
  }
  if (unreadOnly) conditions.push('AND m.read = 0')
  if (search) {
    const s = escapeLike(search)
    conditions.push(
      `AND (s.subject LIKE ? ESCAPE '\\' OR a.address LIKE ? ESCAPE '\\' OR a.comment LIKE ? ESCAPE '\\')`
    )
    params.push(`%${s}%`, `%${s}%`, `%${s}%`)
  }
  if (account) {
    const entry = findAccount(accountMap, account)
    if (!entry) throw new Error(`No mail account matching "${account}" found.`)
    conditions.push(`AND mb.url LIKE ?`)
    params.push(`%${entry[0]}%`)
  }
  const sql = `
    SELECT m.ROWID, s.subject, a.address, COALESCE(a.comment, '') as comment, m.date_received, m.read, m.flagged, mb.url
    FROM messages m
    JOIN subjects s ON m.subject = s.ROWID
    JOIN addresses a ON m.sender = a.ROWID
    JOIN mailboxes mb ON m.mailbox = mb.ROWID
    WHERE 1=1
    ${conditions.join('\n    ')}
    ORDER BY m.date_received DESC
    LIMIT ? OFFSET ?`
  params.push(Number(limit), Number(offset))
  const rows = sqlite(sql, params)
  return rows.map((row) => rowToEmail(row, accountMap)).filter((r) => r.sender && r.subject)
}
export const getEmailBodyMac = async (
  { sender = '', subject = '', messageId = '' } = {},
  { signal } = {}
) => {
  if (!checkMailAccess()) throwFdaError()
  await ensureAppleMailConfigured(signal)
  const script = messageId
    ? `tell application "Mail"
  set targetId to ${Number(messageId)}
  repeat with acct in every account
    set mb to missing value
    try
      set mb to mailbox "INBOX" of acct
    end try
    if mb is missing value then
      try
        set mb to mailbox "Inbox" of acct
      end try
    end if
    if mb is not missing value then
      try
        set m to first message of mb whose id is targetId
        set attNames to ""
        repeat with att in mail attachments of m
          set attNames to attNames & name of att & ","
        end repeat
        return (id of m as string) & "\\n---BODY:" & content of m & "\\n---ATTACHMENTS:" & (count of mail attachments of m) & ":" & attNames
      end try
    end if
  end repeat
  repeat with acct in every account
    repeat with mb in every mailbox of acct
      try
        set m to first message of mb whose id is targetId
        set attNames to ""
        repeat with att in mail attachments of m
          set attNames to attNames & name of att & ","
        end repeat
        return (id of m as string) & "\\n---BODY:" & content of m & "\\n---ATTACHMENTS:" & (count of mail attachments of m) & ":" & attNames
      end try
    end repeat
  end repeat
  return "NOT_FOUND"
end tell`
    : `tell application "Mail"
  set sQ to "${esc(sender)}"
  set subQ to "${esc(subject)}"
  repeat with acct in every account
    set mb to missing value
    try
      set mb to mailbox "INBOX" of acct
    end try
    if mb is missing value then
      try
        set mb to mailbox "Inbox" of acct
      end try
    end if
    if mb is not missing value then
      try
        set n to 0
        repeat with m in (messages of mb)
          set ok to true
          if sQ is not "" and sender of m does not contain sQ then set ok to false
          if ok and subQ is not "" and subject of m does not contain subQ then set ok to false
          if ok then
            set attNames to ""
            repeat with att in mail attachments of m
              set attNames to attNames & name of att & ","
            end repeat
            return (id of m as string) & "\\n---BODY:" & content of m & "\\n---ATTACHMENTS:" & (count of mail attachments of m) & ":" & attNames
          end if
          set n to n + 1
          if n >= 50 then exit repeat
        end repeat
      end try
    end if
  end repeat
  return "NOT_FOUND"
end tell`
  const scriptFile = await writeTempScript(script, 'scpt')
  try {
    const { stdout } = await execAbortable(
      `osascript "${scriptFile}"`,
      {
        timeout: EXEC_TIMEOUT
      },
      signal
    )
    return parseBodyOutput(stdout.trim())
  } finally {
    await cleanupTemp(scriptFile)
  }
}
