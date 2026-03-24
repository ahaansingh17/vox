export const LONG_TIMEOUT = 60_000

export const UI_ELEMENTS_SCRIPT = `
ObjC.import('Foundation');
function collect(elem, depth, out) {
  if (depth > 5) return;
  var children;
  try { children = elem.entireContents(); } catch(e) { return; }
  for (var i = 0; i < children.length; i++) {
    var el = children[i];
    try {
      var role = '';
      try { role = el.role(); } catch(e) { continue; }
      var label = '';
      try { label = el.title(); } catch(e) {}
      if (!label) try { label = el.description(); } catch(e) {}
      if (!label) try { var v = el.value(); if (typeof v === 'string') label = v; } catch(e) {}
      var enabled = true;
      try { enabled = el.enabled(); } catch(e) {}
      var pos = { x: 0, y: 0 };
      try { var p = el.position(); pos = { x: p.x, y: p.y }; } catch(e) {}
      var size = { w: 0, h: 0 };
      try { var s = el.size(); size = { w: s.width, h: s.height }; } catch(e) {}
      var INTERACTIVE = ['AXButton','AXTextField','AXTextArea','AXCheckBox','AXRadioButton',
        'AXPopUpButton','AXComboBox','AXSlider','AXLink','AXMenuItem','AXMenu',
        'AXTab','AXCell','AXRow','AXStaticText'];
      if (label || INTERACTIVE.indexOf(role) !== -1) {
        out.push({ role: role, label: label, enabled: enabled,
          x: Math.round(pos.x), y: Math.round(pos.y),
          w: Math.round(size.w), h: Math.round(size.h) });
      }
      collect(el, depth + 1, out);
    } catch(e) {}
  }
}
var se = Application('System Events');
var proc = se.processes.whose({ frontmost: true })[0];
var appName = proc.name();
var wins = proc.windows();
var out = [];
for (var w = 0; w < Math.min(wins.length, 3); w++) {
  collect(wins[w], 0, out);
}
JSON.stringify({ app: appName, count: out.length, elements: out });
`
