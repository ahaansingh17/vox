export const pyClick = (x, y, button = 'left', count = 1) => `
import sys, time
try:
    import Quartz
except ImportError:
    sys.exit(1)

x, y = ${x}, ${y}
count = ${count}
is_right = ${button === 'right' ? 'True' : 'False'}

btn  = Quartz.kCGMouseButtonRight   if is_right else Quartz.kCGMouseButtonLeft
down = Quartz.kCGEventRightMouseDown if is_right else Quartz.kCGEventLeftMouseDown
up   = Quartz.kCGEventRightMouseUp   if is_right else Quartz.kCGEventLeftMouseUp
pt   = Quartz.CGPoint(x, y)

for i in range(count):
    n = i + 1
    e = Quartz.CGEventCreateMouseEvent(None, down, pt, btn)
    Quartz.CGEventSetIntegerValueField(e, Quartz.kCGMouseEventClickState, n)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
    time.sleep(0.05)
    e = Quartz.CGEventCreateMouseEvent(None, up, pt, btn)
    Quartz.CGEventSetIntegerValueField(e, Quartz.kCGMouseEventClickState, n)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
    if i < count - 1:
        time.sleep(0.12)
`

export const pyMove = (x, y) => `
import Quartz
pt = Quartz.CGPoint(${x}, ${y})
e = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, pt, Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
`

export const pyScroll = (x, y, dx, dy) => `
import Quartz, time
pt = Quartz.CGPoint(${x}, ${y})
e = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, pt, Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
time.sleep(0.05)
e = Quartz.CGEventCreateScrollWheelEvent(None, Quartz.kCGScrollEventUnitLine, 2, ${dy}, ${dx})
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
`

export const pyDrag = (x1, y1, x2, y2) => `
import Quartz, time
p1 = Quartz.CGPoint(${x1}, ${y1})
p2 = Quartz.CGPoint(${x2}, ${y2})
e = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, p1, Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
time.sleep(0.08)
e = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDragged, p2, Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
time.sleep(0.05)
e = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, p2, Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
`

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

const MOD_FLAGS_PY = `MOD_FLAGS = {
    'command': Quartz.kCGEventFlagMaskCommand,
    'cmd': Quartz.kCGEventFlagMaskCommand,
    'shift': Quartz.kCGEventFlagMaskShift,
    'option': Quartz.kCGEventFlagMaskAlternate,
    'alt': Quartz.kCGEventFlagMaskAlternate,
    'control': Quartz.kCGEventFlagMaskControl,
    'ctrl': Quartz.kCGEventFlagMaskControl,
}`

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

export const pyGetMousePos = () => `
import Quartz
event = Quartz.CGEventCreate(None)
pos = Quartz.CGEventGetLocation(event)
print(f"{int(pos.x)},{int(pos.y)}")
`
