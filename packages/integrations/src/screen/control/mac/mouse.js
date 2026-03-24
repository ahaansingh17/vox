import { enqueueScreen } from '../../queue.js'
import {
  ensureAccessibility,
  pyClick,
  pyMove,
  pyDrag,
  pyScroll,
  pyGetMousePos,
  runPy
} from './helpers.js'

export const clickAt = ({ x, y, button = 'left', count = 1 }, { signal } = {}) =>
  enqueueScreen(async () => {
    ensureAccessibility()
    const xInt = Math.round(Number(x))
    const yInt = Math.round(Number(y))
    const btn = button === 'right' ? 'right' : 'left'
    const clicks = Math.max(1, Math.min(3, Number(count)))
    await runPy(pyClick(xInt, yInt, btn, clicks), signal)
    return { action: 'click', x: xInt, y: yInt, button: btn, count: clicks }
  })

export const moveMouse = ({ x, y }, { signal } = {}) =>
  enqueueScreen(async () => {
    ensureAccessibility()
    const xInt = Math.round(Number(x))
    const yInt = Math.round(Number(y))
    await runPy(pyMove(xInt, yInt), signal)
    return { action: 'move', x: xInt, y: yInt }
  })

export const scroll = ({ x, y, deltaX = 0, deltaY = -3 }, { signal } = {}) =>
  enqueueScreen(async () => {
    ensureAccessibility()
    const xInt = Math.round(Number(x))
    const yInt = Math.round(Number(y))
    const dx = Math.round(Number(deltaX))
    const dy = Math.round(Number(deltaY))
    await runPy(pyScroll(xInt, yInt, dx, dy), signal)
    return { action: 'scroll', x: xInt, y: yInt, deltaX: dx, deltaY: dy }
  })

export const drag = ({ fromX, fromY, toX, toY }, { signal } = {}) =>
  enqueueScreen(async () => {
    ensureAccessibility()
    const x1 = Math.round(Number(fromX))
    const y1 = Math.round(Number(fromY))
    const x2 = Math.round(Number(toX))
    const y2 = Math.round(Number(toY))
    await runPy(pyDrag(x1, y1, x2, y2), signal)
    return { action: 'drag', from: { x: x1, y: y1 }, to: { x: x2, y: y2 } }
  })

export const getMousePosition = (_, { signal } = {}) =>
  enqueueScreen(async () => {
    const { stdout } = await runPy(pyGetMousePos(), signal)
    const [x, y] = stdout.trim().split(',').map(Number)
    return { x: x ?? 0, y: y ?? 0 }
  })
