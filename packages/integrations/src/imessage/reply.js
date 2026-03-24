import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec)

let _log = console

export const setLogger = (logger) => {
  _log = logger
}

const writeTmp = async (content, ext) => {
  const file = path.join(os.tmpdir(), `vox_ims_${Date.now()}.${ext}`)
  await fs.writeFile(file, content, 'utf8')
  return file
}

const escapeAppleScript = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const toAppleScriptString = (s) => {
  const lines = escapeAppleScript(s).split('\n')
  if (lines.length === 1) return `"${lines[0]}"`
  return lines.map((l) => `"${l}"`).join(' & return & ')
}

export const sendReply = async (handle, text, filePaths = []) => {
  const handleEsc = escapeAppleScript(handle)
  const textExpr = toAppleScriptString(text)

  const sendText = text
    ? `
  try
    send ${textExpr} to buddy "${handleEsc}" of service "iMessage"
    set sent to true
  end try
  if not sent then
    try
      send ${textExpr} to buddy "${handleEsc}" of (first service)
      set sent to true
    end try
  end if`
    : ''

  const sendFiles = filePaths
    .map((p) => {
      const pEsc = escapeAppleScript(p)
      return `
  try
    send POSIX file "${pEsc}" to buddy "${handleEsc}" of service "iMessage"
    set sent to true
  end try`
    })
    .join('')

  const script = `tell application "Messages"
  set sent to false
${sendText}
${sendFiles}
  if not sent then
    error "Could not send reply to ${handleEsc}"
  end if
end tell`

  const scriptFile = await writeTmp(script, 'scpt')
  try {
    await execAsync(`osascript "${scriptFile}"`, { timeout: 15_000 })
    _log.info('[imessage] Reply sent to', handle, 'files:', filePaths.length)
  } finally {
    await fs.unlink(scriptFile).catch(() => {})
  }
}
