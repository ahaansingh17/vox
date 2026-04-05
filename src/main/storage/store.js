import {
  getSettingJson,
  setSetting,
  deleteSetting,
  getAllSettings
} from '@vox-ai-app/storage/settings'
import { getDb } from './db.js'

export const storeGet = (key) => getSettingJson(getDb(), key)
export const storeSet = (key, value) => setSetting(getDb(), key, value)
export const storeDelete = (key) => deleteSetting(getDb(), key)
export const storeGetAll = () => getAllSettings(getDb())
