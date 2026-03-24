import { SCREEN_TOOL_DEFINITIONS } from './def.js'
import { captureFullScreen, captureRegion } from './capture/index.js'
import {
  clickAt,
  moveMouse,
  typeText,
  keyPress,
  scroll,
  drag,
  getMousePosition,
  getUiElements,
  clipboardRead,
  clipboardWrite,
  focusApp,
  launchApp,
  listApps
} from './control/index.js'
import { acquireScreen, releaseScreen } from './queue.js'

const DARWIN_ONLY = () => {
  throw new Error('Screen tools are only available on macOS.')
}

const isDarwin = process.platform === 'darwin'
const guard = (fn) => (isDarwin ? fn : DARWIN_ONLY)

const executors = {
  capture_full_screen: (_ctx) => guard(captureFullScreen),
  capture_region: (_ctx) => guard(captureRegion),
  click_at: (_ctx) => guard(clickAt),
  move_mouse: (_ctx) => guard(moveMouse),
  type_text: (_ctx) => guard(typeText),
  key_press: (_ctx) => guard(keyPress),
  scroll: (_ctx) => guard(scroll),
  drag: (_ctx) => guard(drag),
  get_mouse_position: (_ctx) => guard(getMousePosition),
  get_ui_elements: (_ctx) => guard(getUiElements),
  clipboard_read: (_ctx) => clipboardRead,
  clipboard_write: (_ctx) => clipboardWrite,
  focus_app: (_ctx) => guard(focusApp),
  launch_app: (_ctx) => guard(launchApp),
  list_apps: (_ctx) => guard(listApps),
  acquire_screen: (_ctx) => acquireScreen,
  release_screen: (_ctx) => releaseScreen
}

export const SCREEN_TOOLS = SCREEN_TOOL_DEFINITIONS.map((def) => ({
  definition: def,
  execute: executors[def.name]
}))
