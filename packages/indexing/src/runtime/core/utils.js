import path from 'node:path'
export const isRetriableError = (error) => {
  const statusCode = Number(error?.status || 0)
  const errorCode = String(error?.code || '')
  if (statusCode === 429 || statusCode >= 500) {
    return true
  }
  return (
    errorCode === 'NETWORK_ERROR' ||
    errorCode === 'REQUEST_TIMEOUT' ||
    errorCode === 'SQLITE_BUSY' ||
    errorCode === 'EBUSY' ||
    errorCode === 'EMFILE' ||
    errorCode === 'ENFILE'
  )
}
export const isInsideFolder = (filePath, folderPath) => {
  const relative = path.relative(folderPath, filePath)
  if (!relative) {
    return false
  }
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}
export const isInsideOrSamePath = (candidatePath, rootPath) => {
  const relative = path.relative(rootPath, candidatePath)
  if (!relative) {
    return true
  }
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}
export const chunkArray = (items, chunkSize) => {
  const result = []
  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(items.slice(index, index + chunkSize))
  }
  return result
}
