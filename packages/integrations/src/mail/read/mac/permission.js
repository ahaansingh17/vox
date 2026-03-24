import { readdirSync } from 'node:fs'
import { shell } from 'electron'

const MAIL_DIR = `${process.env.HOME}/Library/Mail/`

const openFdaSettings = () => {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles')
}

export const openMailPermissionSettings = openFdaSettings

export const checkMailAccess = () => {
  try {
    readdirSync(MAIL_DIR)
    return true
  } catch {
    return false
  }
}

export const throwFdaError = () => {
  openFdaSettings()
  throw Object.assign(
    new Error(
      'Vox needs Full Disk Access to read your emails. Opening System Settings → Privacy & Security → Full Disk Access — please enable it for Vox and try again.'
    ),
    { code: 'MAIL_FDA_REQUIRED' }
  )
}
