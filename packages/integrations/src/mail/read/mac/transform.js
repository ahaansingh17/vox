import { uuidFromUrl } from './accounts.js'

export const escapeLike = (s) => s.replace(/%/g, '\\%').replace(/_/g, '\\_')

export const localISODate = (ms) => {
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

export const rowToEmail = (row, accountMap) => {
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

export const parseBodyOutput = (raw) => {
  if (!raw || raw === 'NOT_FOUND') return { found: false, body: null, attachments: [] }
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
  return { found: true, id, body, attachments }
}
