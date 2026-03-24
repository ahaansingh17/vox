import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'

const HOME = process.env.HOME
const MESSAGES_DB = `${HOME}/Library/Messages/chat.db`
const AB_DIR = join(HOME, 'Library/Application Support/AddressBook')

export const canReadDb = () => {
  try {
    const db = new Database(MESSAGES_DB, { readonly: true, fileMustExist: true })
    db.close()
    return true
  } catch {
    return false
  }
}

export const queryNewMessages = (afterRowId) => {
  const db = new Database(MESSAGES_DB, { readonly: true, fileMustExist: true })
  try {
    return db
      .prepare(
        `SELECT m.ROWID, m.text,
                CASE
                  WHEN m.is_from_me = 0 THEN h.id
                  ELSE COALESCE(
                    (
                      SELECT h2.id FROM chat_message_join cmj
                      JOIN chat_handle_join chj ON chj.chat_id = cmj.chat_id
                      JOIN handle h2 ON h2.ROWID = chj.handle_id
                      WHERE cmj.message_id = m.ROWID
                      LIMIT 1
                    ),
                    (
                      SELECT REPLACE(REPLACE(REPLACE(c.chat_identifier, 'iMessage;-;', ''), 'SMS;-;', ''), 'tel:', '')
                      FROM chat_message_join cmj2
                      JOIN chat c ON c.ROWID = cmj2.chat_id
                      WHERE cmj2.message_id = m.ROWID
                      LIMIT 1
                    )
                  )
                END AS reply_handle
         FROM message m
         LEFT JOIN handle h ON m.handle_id = h.ROWID
         WHERE m.ROWID > ?
           AND m.text IS NOT NULL AND m.text != ''
         ORDER BY m.ROWID ASC`
      )
      .all(afterRowId)
  } finally {
    db.close()
  }
}

export const getMaxRowId = () => {
  const db = new Database(MESSAGES_DB, { readonly: true, fileMustExist: true })
  try {
    const row = db.prepare(`SELECT MAX(ROWID) AS maxId FROM message`).get()
    return row?.maxId ?? 0
  } finally {
    db.close()
  }
}

export const listConversations = () => {
  const db = new Database(MESSAGES_DB, { readonly: true, fileMustExist: true })
  try {
    const rows = db
      .prepare(
        `SELECT h.id AS handle_id,
                MAX(m.date) AS last_date,
                (SELECT text FROM message WHERE handle_id = h.ROWID AND text IS NOT NULL AND text != '' ORDER BY date DESC LIMIT 1) AS snippet
         FROM handle h
         JOIN message m ON m.handle_id = h.ROWID
         WHERE m.text IS NOT NULL
         GROUP BY h.id
         ORDER BY last_date DESC
         LIMIT 50`
      )
      .all()
    return rows.map((r) => ({
      handle: r.handle_id,
      snippet: r.snippet ? String(r.snippet).slice(0, 80) : ''
    }))
  } finally {
    db.close()
  }
}

const findAddressBookDbs = () => {
  const dbs = []
  const main = join(AB_DIR, 'AddressBook-v22.abcddb')
  if (existsSync(main)) dbs.push(main)
  try {
    const sources = join(AB_DIR, 'Sources')
    for (const entry of readdirSync(sources)) {
      const p = join(sources, entry, 'AddressBook-v22.abcddb')
      if (existsSync(p)) dbs.push(p)
    }
  } catch {
    void 0
  }
  return dbs
}

const CONTACTS_QUERY = `
  SELECT COALESCE(r.ZNAME, TRIM(COALESCE(r.ZFIRSTNAME,'') || ' ' || COALESCE(r.ZLASTNAME,''))) AS name,
         p.ZFULLNUMBER AS handle
  FROM ZABCDRECORD r
  JOIN ZABCDPHONENUMBER p ON p.ZOWNER = r.Z_PK
  WHERE name != '' AND handle IS NOT NULL AND handle != ''
  UNION ALL
  SELECT COALESCE(r.ZNAME, TRIM(COALESCE(r.ZFIRSTNAME,'') || ' ' || COALESCE(r.ZLASTNAME,''))) AS name,
         e.ZADDRESS AS handle
  FROM ZABCDRECORD r
  JOIN ZABCDEMAILADDRESS e ON e.ZOWNER = r.Z_PK
  WHERE name != '' AND handle IS NOT NULL AND handle != ''
  ORDER BY name ASC
  LIMIT 500`

export const listContacts = (onError) => {
  const seen = new Set()
  const results = []
  for (const dbPath of findAddressBookDbs()) {
    try {
      const db = new Database(dbPath, { readonly: true, fileMustExist: true })
      try {
        for (const row of db.prepare(CONTACTS_QUERY).all()) {
          const key = `${row.name}|${row.handle}`
          if (!seen.has(key)) {
            seen.add(key)
            results.push({ name: row.name, handle: row.handle })
          }
        }
      } finally {
        db.close()
      }
    } catch (err) {
      onError?.(err)
    }
  }
  return results
}
