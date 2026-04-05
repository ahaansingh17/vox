import { safeStorage } from 'electron'
import {
  getToolSecrets as _getToolSecrets,
  setToolSecret as _setToolSecret,
  deleteToolSecret as _deleteToolSecret
} from '@vox-ai-app/storage/tool-secrets'
import { getToolByName } from '@vox-ai-app/storage/tools'
import { getDb } from './db.js'

function encryptValue(value) {
  if (!safeStorage.isEncryptionAvailable()) return value
  return safeStorage.encryptString(String(value)).toString('base64')
}

function decryptValue(encrypted) {
  if (!safeStorage.isEncryptionAvailable()) return encrypted
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return encrypted
  }
}

function resolveToolId(toolName) {
  const tool = getToolByName(getDb(), toolName)
  return tool?.id || null
}

export function getToolSecrets(toolName) {
  const toolId = resolveToolId(toolName)
  if (!toolId) return {}
  const rows = _getToolSecrets(getDb(), toolId)
  const result = {}
  for (const row of rows) {
    result[row.key] = decryptValue(row.encrypted_value)
  }
  return result
}

export function setToolSecret(toolName, key, value) {
  const toolId = resolveToolId(toolName)
  if (!toolId) return
  _setToolSecret(getDb(), toolId, key, encryptValue(value))
}

export function deleteToolSecret(toolName, key) {
  const toolId = resolveToolId(toolName)
  if (!toolId) return
  _deleteToolSecret(getDb(), toolId, key)
}

export function listToolSecretKeys(toolName) {
  const toolId = resolveToolId(toolName)
  if (!toolId) return []
  const rows = _getToolSecrets(getDb(), toolId)
  return rows.map((r) => r.key)
}
