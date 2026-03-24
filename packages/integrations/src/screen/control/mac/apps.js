import { enqueueScreen } from '../../queue.js'
import {
  ensureAccessibility,
  UI_ELEMENTS_SCRIPT,
  LONG_TIMEOUT,
  execAbortable,
  writeTmp,
  cleanTmp
} from './helpers.js'

export const getUiElements = ({ app, maxElements } = {}, { signal } = {}) =>
  enqueueScreen(async () => {
    ensureAccessibility()
    const limit = Math.max(1, Math.min(1000, Number(maxElements) || 200))
    let script = UI_ELEMENTS_SCRIPT
    if (app) {
      script = UI_ELEMENTS_SCRIPT.replace(
        'var proc = se.processes.whose({ frontmost: true })[0];',
        `var proc = se.processes.whose({ name: "${String(app).replace(/"/g, '\\"')}" })[0];`
      )
    }
    const file = await writeTmp(script, 'js')
    try {
      const { stdout } = await execAbortable(
        `osascript -l JavaScript "${file}"`,
        { timeout: LONG_TIMEOUT },
        signal
      )
      const all = JSON.parse(stdout.trim())
      const elements = Array.isArray(all) ? all : (all?.elements ?? [])
      const total = elements.length
      return { elements: elements.slice(0, limit), total, truncated: total > limit }
    } catch (err) {
      throw new Error(`UI element inspection failed: ${err?.message || err}`)
    } finally {
      await cleanTmp(file)
    }
  })

export const focusApp = async ({ app }, { signal } = {}) => {
  await execAbortable(`open -a ${JSON.stringify(app)}`, { timeout: 10_000 }, signal)
  return { action: 'focus_app', app }
}

export const launchApp = async ({ app, args = [] }, { signal } = {}) => {
  const argStr =
    Array.isArray(args) && args.length
      ? ` --args ${args.map((a) => JSON.stringify(a)).join(' ')}`
      : ''
  await execAbortable(`open -a ${JSON.stringify(app)}${argStr}`, { timeout: 15_000 }, signal)
  return { action: 'launch_app', app }
}

export const listApps = async (_, { signal } = {}) => {
  const { stdout } = await execAbortable('ls /Applications/', { timeout: 10_000 }, signal)
  const apps = stdout
    .trim()
    .split('\n')
    .filter((a) => a.endsWith('.app'))
    .map((a) => a.replace(/\.app$/, ''))
  return { apps }
}
