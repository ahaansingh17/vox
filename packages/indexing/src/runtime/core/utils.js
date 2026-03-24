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
export const isSameOrNestedPath = (parentPath, candidatePath) => {
  const relativePath = path.relative(parentPath, candidatePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}
export const chunkArray = (items, chunkSize) => {
  const result = []
  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(items.slice(index, index + chunkSize))
  }
  return result
}
