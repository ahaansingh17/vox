export function validateArgs(schema, args) {
  if (!schema?.properties) return []
  const issues = []
  const required = schema.required ?? []
  for (const field of required) {
    if (args[field] === undefined || args[field] === null) {
      issues.push(`"${field}" is required`)
    }
  }
  for (const [key, def] of Object.entries(schema.properties)) {
    const val = args[key]
    if (val === undefined || val === null) continue
    const expected = def.type
    const actual = Array.isArray(val) ? 'array' : typeof val
    if (expected && actual !== expected) {
      issues.push(`"${key}" must be ${expected}, got ${actual}`)
    }
    if (def.enum && !def.enum.includes(val)) {
      issues.push(`"${key}" must be one of: ${def.enum.join(', ')}`)
    }
    if (typeof val === 'string') {
      if (typeof def.minLength === 'number' && val.length < def.minLength) {
        issues.push(`"${key}" must be at least ${def.minLength} characters`)
      }
      if (typeof def.maxLength === 'number' && val.length > def.maxLength) {
        issues.push(`"${key}" must be at most ${def.maxLength} characters`)
      }
    }
    if (typeof val === 'number') {
      if (typeof def.minimum === 'number' && val < def.minimum) {
        issues.push(`"${key}" must be >= ${def.minimum}`)
      }
      if (typeof def.maximum === 'number' && val > def.maximum) {
        issues.push(`"${key}" must be <= ${def.maximum}`)
      }
    }
  }
  return issues
}
export function assertValidDefinition(def) {
  if (!def || typeof def !== 'object') {
    throw new Error('Tool definition must be an object')
  }
  if (!def.name || typeof def.name !== 'string') {
    throw new Error('Tool definition must have a string "name"')
  }
  if (!def.description || typeof def.description !== 'string') {
    throw new Error('Tool definition must have a string "description"')
  }
  if (def.parameters && typeof def.parameters !== 'object') {
    throw new Error('Tool definition "parameters" must be an object if present')
  }
}
export function clampNumber(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, min), max)
}
