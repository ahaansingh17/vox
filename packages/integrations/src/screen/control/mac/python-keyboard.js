const MOD_FLAGS_PY = `MOD_FLAGS = {
    'command': Quartz.kCGEventFlagMaskCommand,
    'cmd': Quartz.kCGEventFlagMaskCommand,
    'shift': Quartz.kCGEventFlagMaskShift,
    'option': Quartz.kCGEventFlagMaskAlternate,
    'alt': Quartz.kCGEventFlagMaskAlternate,
    'control': Quartz.kCGEventFlagMaskControl,
    'ctrl': Quartz.kCGEventFlagMaskControl,
}`

export const pyTypeText = (text) => {
  const b64 = Buffer.from(text, 'utf8').toString('base64')
  return `
import Quartz, time, base64
text = base64.b64decode('${b64}').decode('utf-8')
src = Quartz.CGEventSourceCreate(Quartz.kCGEventSourceStateHIDSystemState)
for char in text:
    e = Quartz.CGEventCreateKeyboardEvent(src, 0, True)
    Quartz.CGEventKeyboardSetUnicodeString(e, 1, char)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
    time.sleep(0.01)
    e = Quartz.CGEventCreateKeyboardEvent(src, 0, False)
    Quartz.CGEventKeyboardSetUnicodeString(e, 1, char)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
    time.sleep(0.02)
`
}

export const pyKeyCode = (keyCode, mods) => `
import Quartz, time
${MOD_FLAGS_PY}
flags = 0
for m in ${JSON.stringify(mods)}:
    flags |= MOD_FLAGS.get(m.lower(), 0)
src = Quartz.CGEventSourceCreate(Quartz.kCGEventSourceStateHIDSystemState)
e = Quartz.CGEventCreateKeyboardEvent(src, ${keyCode}, True)
if flags:
    Quartz.CGEventSetFlags(e, flags)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
time.sleep(0.05)
e = Quartz.CGEventCreateKeyboardEvent(src, ${keyCode}, False)
if flags:
    Quartz.CGEventSetFlags(e, flags)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
`

export const pyCharKey = (b64, mods) => `
import Quartz, time, base64
${MOD_FLAGS_PY}
flags = 0
for m in ${JSON.stringify(mods)}:
    flags |= MOD_FLAGS.get(m.lower(), 0)
text = base64.b64decode('${b64}').decode('utf-8')
src = Quartz.CGEventSourceCreate(Quartz.kCGEventSourceStateHIDSystemState)
for char in text:
    e = Quartz.CGEventCreateKeyboardEvent(src, 0, True)
    Quartz.CGEventKeyboardSetUnicodeString(e, 1, char)
    if flags:
        Quartz.CGEventSetFlags(e, flags)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
    time.sleep(0.01)
    e = Quartz.CGEventCreateKeyboardEvent(src, 0, False)
    Quartz.CGEventKeyboardSetUnicodeString(e, 1, char)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
    time.sleep(0.02)
`
