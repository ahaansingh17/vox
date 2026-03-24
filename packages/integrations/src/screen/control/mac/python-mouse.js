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

export const pyGetMousePos = () => `
import Quartz
event = Quartz.CGEventCreate(None)
pos = Quartz.CGEventGetLocation(event)
print(f"{int(pos.x)},{int(pos.y)}")
`
