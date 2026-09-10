# VMware Workstation Bar Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a user Omarchy bar widget whose source of truth is `~/wip_other/src_cavanaug/omarchy-vmware-workstation` (symlinked at `~/.config/omarchy/plugins/cavanaug.vmware`) that lists the Workstation library and runs power/guest actions via `vmrun`.

**Architecture:** Tailscale-shaped `bar-widget`: `Panel.qml` owns the bar button and popup; it instantiates `Service.qml`, which polls inventory + `vmrun` and runs one `Process` at a time. Pure helpers live in `Model.js` and are proven by a Node self-check before any QML is written.

**Tech Stack:** Quickshell QML (`qs.Ui` Panel, PanelHero, PanelActionButton, BarIconButton, PanelToolTip), `Quickshell.Io` Process/FileView, `vmrun -T ws`, JetBrains Mono Nerd Font, official Workstation PNG assets.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-09-vmware-bar-plugin-design.md` — follow it; do not invent features.
- Source of truth: `~/wip_other/src_cavanaug/omarchy-vmware-workstation`. `~/.config/omarchy/plugins/cavanaug.vmware` is a symlink to that repo; task paths under the plugins directory still apply.
- Do not edit `/usr/share/omarchy/`.
- Plugin id is exactly `cavanaug.vmware`.
- `vmrun start … gui` (not `nogui`).
- Commit after each task. Do not push unless asked.
- No new npm/pip packages. Node is only used to run `check.js`.
- Keyboard row-cursor navigation is out of scope (spec did not require it). Esc/close still uses the Panel base.

## File map

| Path | Responsibility |
|---|---|
| `~/.config/omarchy/plugins/cavanaug.vmware/Model.js` | Parse inventory, classify power state, slot matrix, vmrun argv, open-Workstation argv |
| `~/.config/omarchy/plugins/cavanaug.vmware/check.js` | Node self-check for Model.js; exit 1 on mismatch |
| `~/.config/omarchy/plugins/cavanaug.vmware/manifest.json` | bar-widget contract |
| `~/.config/omarchy/plugins/cavanaug.vmware/assets/vmware-workstation.png` | Official color 256px mark |
| `~/.config/omarchy/plugins/cavanaug.vmware/assets/mono/vmware-workstation.png` | Lighter white silhouette |
| `~/.config/omarchy/plugins/cavanaug.vmware/Service.qml` | FileView inventory, which/list/vmss/action Processes, `vms` + `lastError` |
| `~/.config/omarchy/plugins/cavanaug.vmware/MonoIcon.qml` | Colorize white PNG with bar foreground |
| `~/.config/omarchy/plugins/cavanaug.vmware/VmActionButton.qml` | PanelActionButton + `iconOffsetX` for `󰒲` |
| `~/.config/omarchy/plugins/cavanaug.vmware/Panel.qml` | Bar icon + popup |

---

### Task 1: Model.js (inventory, state, slots, commands)

**Files:**
- Create: `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/Model.js`
- Create: `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/check.js`

**Interfaces:**
- Consumes: nothing
- Produces: `parseInventory(text)`, `parseRunningList(text)`, `sameVmx(a, b)`, `vmssPath(vmx)`, `powerState(vmx, runningPaths, vmssExists, vmxExists)`, `slotsEnabled(state)`, `commandForSlot(slot, vmx)`, `openWorkstationCommand(gtkLaunchExists, hidpiExists)`, `shellQuote(s)`, `vmssProbeScript(vmxPaths)`, `runningCount(vms)`

- [ ] **Step 1: Write the failing self-check**

Create `check.js` with this exact content:

```javascript
var M = require("./Model.js")
var fails = 0

function eq(name, actual, expected) {
  var a = JSON.stringify(actual)
  var e = JSON.stringify(expected)
  if (a !== e) {
    fails += 1
    console.error("FAIL " + name + "\n  expected " + e + "\n  got      " + a)
  }
}

var inventory = [
  '.encoding = "UTF-8"',
  'vmlist2.config = "/home/u/vmware/b/b.vmx"',
  'vmlist2.DisplayName = "bravo"',
  'vmlist1.config = "/home/u/vmware/a/a.vmx"',
  'vmlist1.DisplayName = "alpha"',
  'vmlist3.config = ""',
  'vmlist3.DisplayName = "ghost"',
  'index.count = "0"',
  ""
].join("\n")

eq("parseInventory order by N, skip empty config",
  M.parseInventory(inventory),
  [
    { vmx: "/home/u/vmware/a/a.vmx", name: "alpha" },
    { vmx: "/home/u/vmware/b/b.vmx", name: "bravo" }
  ])

eq("parseRunningList skips header",
  M.parseRunningList("Total running VMs: 1\n/home/u/vmware/a/a.vmx\n"),
  ["/home/u/vmware/a/a.vmx"])

eq("sameVmx trims and collapses slashes",
  M.sameVmx("/home/u/vmware/a/a.vmx", "/home/u/vmware/a//a.vmx"),
  true)

eq("vmssPath",
  M.vmssPath("/home/u/vmware/a/a.vmx"),
  "/home/u/vmware/a/a.vmss")

eq("running beats vmss",
  M.powerState("/a.vmx", ["/a.vmx"], true, true),
  "running")
eq("suspended when vmss and not running",
  M.powerState("/a.vmx", [], true, true),
  "suspended")
eq("off when neither",
  M.powerState("/a.vmx", [], false, true),
  "off")
eq("missing vmx",
  M.powerState("/gone.vmx", [], false, false),
  "missing")

eq("slots running", M.slotsEnabled("running"), [false, true, true, true, true, true])
eq("slots suspended", M.slotsEnabled("suspended"), [true, true, false, false, false, false])
eq("slots off", M.slotsEnabled("off"), [true, false, false, false, false, false])
eq("slots missing", M.slotsEnabled("missing"), [false, false, false, false, false, false])

eq("slot 1 start gui",
  M.commandForSlot(1, "/a.vmx"),
  ["vmrun", "-T", "ws", "start", "/a.vmx", "gui"])
eq("slot 2 stop hard",
  M.commandForSlot(2, "/a.vmx"),
  ["vmrun", "-T", "ws", "stop", "/a.vmx", "hard"])
eq("slot 3 suspend hard",
  M.commandForSlot(3, "/a.vmx"),
  ["vmrun", "-T", "ws", "suspend", "/a.vmx", "hard"])
eq("slot 4 stop soft",
  M.commandForSlot(4, "/a.vmx"),
  ["vmrun", "-T", "ws", "stop", "/a.vmx", "soft"])
eq("slot 5 suspend soft",
  M.commandForSlot(5, "/a.vmx"),
  ["vmrun", "-T", "ws", "suspend", "/a.vmx", "soft"])
eq("slot 6 reset soft",
  M.commandForSlot(6, "/a.vmx"),
  ["vmrun", "-T", "ws", "reset", "/a.vmx", "soft"])

eq("open prefers gtk-launch",
  M.openWorkstationCommand(true, true),
  ["gtk-launch", "vmware-workstation"])
eq("open hidpi fallback",
  M.openWorkstationCommand(false, true),
  [require("os").homedir() + "/.local/bin/vmware-hidpi"])
eq("open vmware fallback",
  M.openWorkstationCommand(false, false),
  ["/usr/bin/vmware"])

eq("shellQuote", M.shellQuote("a'b"), "'a'\\''b'")

eq("runningCount",
  M.runningCount([{ state: "running" }, { state: "off" }, { state: "running" }]),
  2)

if (fails) {
  console.error(fails + " failed")
  process.exit(1)
}
console.log("ok")
```

- [ ] **Step 2: Run the check and confirm it fails**

Run:

```bash
node /home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/check.js
```

Expected: FAIL with `Cannot find module './Model.js'` (or equivalent).

- [ ] **Step 3: Write Model.js**

Create `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/Model.js` with this exact content:

```javascript
function parseInventory(text) {
  var byN = {}
  var lines = String(text || "").split(/\r?\n/)
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/^vmlist(\d+)\.(config|DisplayName)\s*=\s*"(.*)"\s*$/)
    if (!m) continue
    var n = m[1]
    if (!byN[n]) byN[n] = { vmx: "", name: "" }
    if (m[2] === "config") byN[n].vmx = m[3]
    else byN[n].name = m[3]
  }
  var keys = Object.keys(byN).sort(function (a, b) { return Number(a) - Number(b) })
  var out = []
  for (var k = 0; k < keys.length; k++) {
    var row = byN[keys[k]]
    if (!row.vmx) continue
    out.push({ vmx: row.vmx, name: row.name || row.vmx })
  }
  return out
}

function parseRunningList(text) {
  var lines = String(text || "").split(/\r?\n/)
  var out = []
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^\s+|\s+$/g, "")
    if (!line) continue
    if (/^Total running VMs:/i.test(line)) continue
    out.push(line)
  }
  return out
}

function normalizePath(p) {
  return String(p || "").replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "")
}

function sameVmx(a, b) {
  return normalizePath(a) === normalizePath(b)
}

function vmssPath(vmx) {
  return String(vmx || "").replace(/\.vmx$/i, ".vmss")
}

function powerState(vmx, runningPaths, vmssExists, vmxExists) {
  if (!vmxExists) return "missing"
  var running = runningPaths || []
  for (var i = 0; i < running.length; i++) {
    if (sameVmx(vmx, running[i])) return "running"
  }
  if (vmssExists) return "suspended"
  return "off"
}

function slotsEnabled(state) {
  if (state === "running") return [false, true, true, true, true, true]
  if (state === "suspended") return [true, true, false, false, false, false]
  if (state === "off") return [true, false, false, false, false, false]
  return [false, false, false, false, false, false]
}

function commandForSlot(slot, vmx) {
  var path = String(vmx || "")
  if (slot === 1) return ["vmrun", "-T", "ws", "start", path, "gui"]
  if (slot === 2) return ["vmrun", "-T", "ws", "stop", path, "hard"]
  if (slot === 3) return ["vmrun", "-T", "ws", "suspend", path, "hard"]
  if (slot === 4) return ["vmrun", "-T", "ws", "stop", path, "soft"]
  if (slot === 5) return ["vmrun", "-T", "ws", "suspend", path, "soft"]
  if (slot === 6) return ["vmrun", "-T", "ws", "reset", path, "soft"]
  return []
}

function openWorkstationCommand(gtkLaunchExists, hidpiExists) {
  if (gtkLaunchExists) return ["gtk-launch", "vmware-workstation"]
  if (hidpiExists) {
    var home = ""
    if (typeof Quickshell !== "undefined" && Quickshell.env) home = Quickshell.env("HOME") || ""
    else if (typeof process !== "undefined") home = require("os").homedir()
    return [home + "/.local/bin/vmware-hidpi"]
  }
  return ["/usr/bin/vmware"]
}

function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'"
}

function vmssProbeScript(vmxPaths) {
  var parts = ["set -e"]
  var paths = vmxPaths || []
  for (var i = 0; i < paths.length; i++) {
    var p = String(paths[i] || "")
    if (!p) continue
    parts.push("p=" + shellQuote(p))
    parts.push("s=${p%.vmx}")
    parts.push("s=${s%.VMX}.vmss")
    parts.push("[ -f \"$s\" ] && printf '%s\\n' \"$p\"")
  }
  return parts.join("\n")
}

function runningCount(vms) {
  var n = 0
  var rows = vms || []
  for (var i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i].state === "running") n += 1
  }
  return n
}

if (typeof module !== "undefined") {
  module.exports = {
    parseInventory: parseInventory,
    parseRunningList: parseRunningList,
    sameVmx: sameVmx,
    vmssPath: vmssPath,
    powerState: powerState,
    slotsEnabled: slotsEnabled,
    commandForSlot: commandForSlot,
    openWorkstationCommand: openWorkstationCommand,
    shellQuote: shellQuote,
    vmssProbeScript: vmssProbeScript,
    runningCount: runningCount
  }
}
```

- [ ] **Step 4: Run the check and confirm it passes**

Run:

```bash
node /home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/check.js
```

Expected: `ok` and exit 0.

---

### Task 2: Manifest and icons

**Files:**
- Create: `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/manifest.json`
- Create: `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/assets/vmware-workstation.png`
- Create: `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/assets/mono/vmware-workstation.png`

**Interfaces:**
- Consumes: nothing from Task 1
- Produces: plugin id `cavanaug.vmware`; settings keys `icon_style` (`branded` \| `themed`) and `refreshIntervalSec`; two PNG assets

- [ ] **Step 1: Write manifest.json**

```json
{
  "schemaVersion": 1,
  "id": "cavanaug.vmware",
  "name": "VMware Workstation",
  "version": "1.0.0",
  "author": "cavanaug",
  "license": "MIT",
  "description": "Workstation library and power/guest controls in the Omarchy bar.",
  "kinds": ["bar-widget"],
  "entryPoints": {
    "barWidget": "Panel.qml"
  },
  "barWidget": {
    "displayName": "VMware Workstation",
    "description": "List VMs from the Workstation inventory and run power or guest actions.",
    "category": "System",
    "allowMultiple": false,
    "defaultSection": "right",
    "defaults": {
      "icon_style": "branded",
      "refreshIntervalSec": 30
    },
    "schema": [
      {
        "key": "icon_style",
        "type": "enum",
        "label": "Bar icon",
        "options": ["branded", "themed"],
        "defaultValue": "branded"
      },
      {
        "key": "refreshIntervalSec",
        "type": "integer",
        "label": "Refresh interval (seconds)",
        "min": 5,
        "max": 3600,
        "step": 5,
        "defaultValue": 30
      }
    ]
  }
}
```

- [ ] **Step 2: Copy the official icon and build the lighter mono PNG**

Run:

```bash
PLUGIN=/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware
SRC=/usr/share/icons/hicolor/256x256/apps/vmware-workstation.png
mkdir -p "$PLUGIN/assets/mono"
cp "$SRC" "$PLUGIN/assets/vmware-workstation.png"
magick "$SRC" \( +clone -alpha extract -morphology Erode Disk:8 \) \
  -compose CopyOpacity -composite -fill white -colorize 100% \
  "PNG32:$PLUGIN/assets/mono/vmware-workstation.png"
identify "$PLUGIN/assets/vmware-workstation.png" "$PLUGIN/assets/mono/vmware-workstation.png"
```

Expected: first file `256 x 256` color PNG; second `256 x 256` gray+alpha (or RGBA) PNG.

- [ ] **Step 3: Confirm Model check still passes**

Run:

```bash
node /home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/check.js
```

Expected: `ok`

---

### Task 3: Service.qml

**Files:**
- Create: `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/Service.qml`

**Interfaces:**
- Consumes: `Model.parseInventory`, `parseRunningList`, `powerState`, `commandForSlot`, `vmssProbeScript`, `runningCount`; `settings.refreshIntervalSec`
- Produces: properties `installed`, `lastError`, `vms` (`[{ vmx, name, state, enabled: bool[6] }]`), `runningCount`; functions `refresh()`, `runSlot(slot, vmx)`

`vms` item shape later tasks rely on:

```javascript
{ vmx: string, name: string, state: "running"|"suspended"|"off"|"missing", enabled: [bool x6] }
```

- [ ] **Step 1: Write Service.qml**

Create `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/Service.qml`:

```qml
import QtQuick
import Quickshell
import Quickshell.Io
import "Model.js" as Model

Item {
  id: root

  property var settings: ({})
  property bool installed: false
  property string lastError: ""
  property var vms: []
  readonly property int runningCount: Model.runningCount(vms)
  readonly property int refreshIntervalSec: {
    var n = parseInt(String(settings && settings.refreshIntervalSec != null ? settings.refreshIntervalSec : 30), 10)
    if (!isFinite(n)) n = 30
    if (n < 5) n = 5
    if (n > 3600) n = 3600
    return n
  }
  readonly property string inventoryPath: (Quickshell.env("HOME") || "") + "/.vmware/inventory.vmls"
  readonly property bool busy: whichProcess.running || listProcess.running || vmssProcess.running || actionProcess.running

  property var _inventory: []
  property var _running: []
  property string _listOut: ""
  property string _listErr: ""
  property string _vmssOut: ""
  property string _actionErr: ""
  property int _pendingSlot: 0
  property string _pendingVmx: ""

  function refresh() {
    if (actionProcess.running) return
    if (!installed) {
      if (!whichProcess.running) {
        whichProcess.command = ["which", "vmrun"]
        whichProcess.running = true
      }
      return
    }
    if (listProcess.running) return
    _listOut = ""
    _listErr = ""
    listProcess.command = ["vmrun", "-T", "ws", "list"]
    listProcess.running = true
  }

  function applyMissingVmx(hits, missingPaths) {
    var running = _running
    var miss = missingPaths || []
    var rows = []
    for (var i = 0; i < _inventory.length; i++) {
      var ent = _inventory[i]
      var gone = false
      for (var m = 0; m < miss.length; m++) {
        if (Model.sameVmx(ent.vmx, miss[m])) { gone = true; break }
      }
      var vmss = false
      for (var h = 0; h < hits.length; h++) {
        if (Model.sameVmx(ent.vmx, hits[h])) { vmss = true; break }
      }
      var state = Model.powerState(ent.vmx, running, vmss, !gone)
      rows.push({
        vmx: ent.vmx,
        name: ent.name,
        state: state,
        enabled: Model.slotsEnabled(state)
      })
    }
    vms = rows
  }

  function finishPoll(listText) {
    _running = Model.parseRunningList(listText)
    lastError = ""
    var paths = []
    for (var i = 0; i < _inventory.length; i++) paths.push(_inventory[i].vmx)
    if (paths.length === 0) {
      vms = []
      return
    }
    if (vmssProcess.running) return
    _vmssOut = ""
    vmssProcess.command = ["bash", "-c", Model.vmssProbeScript(paths) + "\nfor p in " + paths.map(function (p) { return Model.shellQuote(p) }).join(" ") + "; do [ -f \"$p\" ] || printf 'MISSING:%s\\n' \"$p\"; done"]
    vmssProcess.running = true
  }

  function runSlot(slot, vmx) {
    if (!installed || actionProcess.running || !vmx) return
    var cmd = Model.commandForSlot(slot, vmx)
    if (!cmd.length) return
    _actionErr = ""
    _pendingSlot = slot
    _pendingVmx = vmx
    actionProcess.command = cmd
    actionProcess.running = true
  }

  function loadInventory(text) {
    _inventory = Model.parseInventory(text)
  }

  FileView {
    id: inventoryFile
    path: root.inventoryPath
    watchChanges: true
    printErrors: false
    onLoaded: {
      root.loadInventory(text())
      root.refresh()
    }
    onLoadFailed: {
      root.loadInventory("")
      root.refresh()
    }
    onFileChanged: reload()
  }

  Timer {
    interval: root.refreshIntervalSec * 1000
    repeat: true
    running: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  Process {
    id: whichProcess
    running: false
    stdout: StdioCollector { waitForEnd: true }
    stderr: StdioCollector { waitForEnd: true }
    onExited: function (code) {
      root.installed = code === 0
      if (!root.installed) {
        root.lastError = "vmrun is not installed or not on PATH."
        root.vms = []
        return
      }
      root.refresh()
    }
  }

  Process {
    id: listProcess
    running: false
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root._listOut = text
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: root._listErr = text
    }
    onExited: function (code) {
      if (code !== 0) {
        root.lastError = String(root._listErr || root._listOut || "vmrun list failed").replace(/^\s+|\s+$/g, "")
        return
      }
      root.finishPoll(root._listOut)
    }
  }

  Process {
    id: vmssProcess
    running: false
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root._vmssOut = text
    }
    onExited: function () {
      var hits = []
      var missing = []
      var lines = String(root._vmssOut || "").split(/\r?\n/)
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].replace(/^\s+|\s+$/g, "")
        if (!line) continue
        if (line.indexOf("MISSING:") === 0) missing.push(line.slice(8))
        else hits.push(line)
      }
      root.applyMissingVmx(hits, missing)
    }
  }

  Process {
    id: actionProcess
    running: false
    stdout: StdioCollector { waitForEnd: true }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: root._actionErr = text
    }
    onExited: function (code) {
      if (code !== 0) {
        root.lastError = String(root._actionErr || "vmrun failed").replace(/^\s+|\s+$/g, "")
      } else {
        root.lastError = ""
      }
      root.refresh()
    }
  }
}
```

The extra `MISSING:` loop in `finishPoll` marks gone `.vmx` files so `powerState(..., vmxExists=false)` returns `missing`.

- [ ] **Step 2: Re-run Model check**

```bash
node /home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/check.js
```

Expected: `ok`

---

### Task 4: Panel, action button, bar icon, enable

**Files:**
- Create: `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/MonoIcon.qml`
- Create: `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/VmActionButton.qml`
- Create: `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/Panel.qml`

**Interfaces:**
- Consumes: `Service.vms`, `Service.runningCount`, `Service.lastError`, `Service.installed`, `Service.runSlot(slot, vmx)`; `Model.slots` via `vm.enabled[i]`; `Model.openWorkstationCommand`; `Model.commandForSlot` unused in Panel; settings `icon_style`
- Produces: bar widget `cavanaug.vmware`

- [ ] **Step 1: Write MonoIcon.qml**

Copy the Syncthing colorizer (Omarchy does not ship `MonoIcon`):

```qml
import QtQuick
import QtQuick.Effects

Item {
  id: root
  property url source
  property color tint: "#ffffff"

  Image {
    id: image
    anchors.fill: parent
    source: root.source
    sourceSize.width: Math.round(width * Screen.devicePixelRatio)
    sourceSize.height: Math.round(height * Screen.devicePixelRatio)
    fillMode: Image.PreserveAspectFit
    smooth: true
    visible: false
    layer.enabled: true
  }

  MultiEffect {
    anchors.fill: image
    source: image
    colorization: 1.0
    colorizationColor: root.tint
  }
}
```

- [ ] **Step 2: Write VmActionButton.qml**

Copy `/usr/share/omarchy/shell/Ui/PanelActionButton.qml` into the plugin path, then:

1. Add `import qs.Ui` at the top (needed so `PanelToolTip` resolves from a plugin).
2. Add `property real iconOffsetX: 0`.
3. On the inner `Text`, add `anchors.horizontalCenterOffset: root.iconOffsetX`.

The Text block must be:

```qml
  Text {
    textFormat: Text.PlainText
    anchors.centerIn: parent
    anchors.horizontalCenterOffset: root.iconOffsetX
    text: root.iconText
    color: root.enabled
      ? (root._hot ? root.hoverColor : root.foreground)
      : Qt.darker(root.foreground, 2.0)
    font.family: root.fontFamily
    font.pixelSize: root.fontSize
  }
```

Leave every other line of PanelActionButton as in the source file.

- [ ] **Step 3: Write Panel.qml**

Create `/home/cavanaug/.config/omarchy/plugins/cavanaug.vmware/Panel.qml` with this exact content. The popup host is `KeyboardPanel` (same as Dropbox/Tailscale), not a raw `Popup`.

```qml
import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "cavanaug.vmware"
  ipcTarget: "cavanaug.vmware"
  manageIpc: false

  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property color urgent: bar ? bar.urgent : Color.urgent
  readonly property color dim: Qt.darker(foreground, 1.55)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property bool themedIcon: String(setting("icon_style", "branded")) === "themed"
  readonly property url brandedIcon: Qt.resolvedUrl("assets/vmware-workstation.png")
  readonly property url themedIconSource: Qt.resolvedUrl("assets/mono/vmware-workstation.png")
  readonly property int rowHeight: Style.space(44)
  readonly property int visibleRows: Math.min(vmware.vms.length, 5)
  readonly property bool scrollable: vmware.vms.length > 5

  function openWorkstation() {
    Quickshell.execDetached(Model.openWorkstationCommand(gtkWhich.installed, hidpiWhich.installed))
  }

  function slotGlyph(slot) {
    if (slot === 1) return "󰐥"
    if (slot === 2) return "󰒲"
    if (slot === 3) return "󰜉"
    if (slot === 4) return "󰐊"
    if (slot === 5) return "󰓛"
    return "󰏤"
  }

  function slotTip(slot) {
    if (slot === 1) return "Power On / Resume"
    if (slot === 2) return "Power Off"
    if (slot === 3) return "Suspend"
    if (slot === 4) return "Shutdown (Guest)"
    if (slot === 5) return "Suspend (Guest)"
    return "Restart (Guest)"
  }

  function bulletColor(state) {
    if (state === "running") return Qt.tint(Color.popups.background, Qt.rgba(158 / 255, 206 / 255, 106 / 255, 0.55))
    if (state === "suspended") return Qt.tint(Color.popups.background, Qt.rgba(235 / 255, 146 / 255, 123 / 255, 0.45))
    return "transparent"
  }

  Service {
    id: vmware
    settings: root.settings
  }

  Process {
    id: gtkWhich
    running: true
    command: ["which", "gtk-launch"]
    property bool installed: false
    onExited: function (code) { gtkWhich.installed = code === 0 }
  }

  Process {
    id: hidpiWhich
    running: true
    command: ["test", "-f", (Quickshell.env("HOME") || "") + "/.local/bin/vmware-hidpi"]
    property bool installed: false
    onExited: function (code) { hidpiWhich.installed = code === 0 }
  }

  IpcHandler {
    target: root.ipcTarget
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.toggle() }
    function refresh(): string { vmware.refresh(); return "ok" }
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onOpenedChanged: if (opened) {
    if (panelFlick) panelFlick.contentY = 0
    vmware.refresh()
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: "VMware Workstation"
    iconComponent: Component {
      Item {
        MonoIcon {
          anchors.centerIn: parent
          width: Style.space(12)
          height: width
          source: root.themedIconSource
          tint: root.barForeground
          visible: root.themedIcon
        }
        Image {
          anchors.centerIn: parent
          width: Style.space(12)
          height: width
          source: root.brandedIcon
          sourceSize.width: 32
          sourceSize.height: 32
          fillMode: Image.PreserveAspectFit
          smooth: true
          visible: !root.themedIcon
        }
      }
    }
    onPressed: function (buttonCode) {
      if (buttonCode === Qt.RightButton) vmware.refresh()
      else root.toggle()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    contentWidth: panel.fittedContentWidth(Style.space(420))
    contentHeight: panel.fittedContentHeight(column.implicitHeight, Style.space(560))

    Flickable {
      id: panelFlick
      anchors.fill: parent
      contentWidth: width
      contentHeight: column.implicitHeight
      clip: true
      boundsBehavior: Flickable.StopAtBounds
      flickableDirection: Flickable.VerticalFlick
      interactive: contentHeight > height
      ScrollBar.vertical: ScrollBar {
        policy: root.scrollable ? ScrollBar.AsNeeded : ScrollBar.AlwaysOff
      }

      Column {
        id: column
        width: panelFlick.width - (root.scrollable ? Style.space(16) : 0)
        spacing: Style.space(12)

        PanelHero {
          id: hero
          width: parent.width
          title: "VMware Workstation"
          meta: "" + vmware.runningCount + " RUNNING"
          foreground: root.foreground
          fontFamily: root.fontFamily
          iconComponent: Component {
            Image {
              width: Style.font.display
              height: Style.font.display
              source: root.brandedIcon
              sourceSize.width: 48
              sourceSize.height: 48
              fillMode: Image.PreserveAspectFit
              smooth: true
            }
          }
          trailingControl: Component {
            Button {
              iconText: "󰏌"
              text: "Open"
              tooltipText: "Open Workstation"
              foreground: hero.foreground
              fontFamily: hero.fontFamily
              onClicked: root.openWorkstation()
            }
          }
        }

        ListView {
          id: list
          width: parent.width
          height: root.visibleRows * root.rowHeight
          clip: true
          boundsBehavior: Flickable.StopAtBounds
          interactive: root.scrollable
          model: vmware.vms
          spacing: 0
          delegate: Item {
            width: list.width
            height: root.rowHeight
            readonly property var vm: modelData

            FontMetrics {
              id: nameMetrics
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
            }

            Row {
              anchors.fill: parent
              spacing: Style.space(10)

              Column {
                width: Math.round(nameMetrics.averageCharacterWidth * 22)
                anchors.verticalCenter: parent.verticalCenter
                spacing: Style.space(2)

                Text {
                  width: parent.width
                  textFormat: Text.PlainText
                  text: vm.name
                  color: root.foreground
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.body
                  elide: Text.ElideRight
                }

                Row {
                  spacing: Style.space(6)
                  Rectangle {
                    width: 7
                    height: 7
                    radius: 4
                    anchors.verticalCenter: parent.verticalCenter
                    color: (vm.state === "off" || vm.state === "missing") ? "transparent" : root.bulletColor(vm.state)
                    border.width: (vm.state === "off" || vm.state === "missing") ? 1 : 0
                    border.color: root.dim
                  }
                  Text {
                    textFormat: Text.PlainText
                    text: vm.state === "missing" ? "off" : vm.state
                    color: root.dim
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.bodySmall
                  }
                }
              }

              Row {
                spacing: Style.space(4)
                anchors.verticalCenter: parent.verticalCenter

                Repeater {
                  model: 3
                  VmActionButton {
                    required property int index
                    iconText: root.slotGlyph(index + 1)
                    tooltipText: root.slotTip(index + 1)
                    iconOffsetX: index === 1 ? -2 : 0
                    enabled: vm.enabled[index]
                    foreground: root.foreground
                    fontFamily: root.fontFamily
                    onClicked: vmware.runSlot(index + 1, vm.vmx)
                  }
                }

                Item { width: Style.space(8); height: 1 }

                Repeater {
                  model: 3
                  VmActionButton {
                    required property int index
                    iconText: root.slotGlyph(index + 4)
                    tooltipText: root.slotTip(index + 4)
                    enabled: vm.enabled[index + 3]
                    foreground: root.foreground
                    fontFamily: root.fontFamily
                    onClicked: vmware.runSlot(index + 4, vm.vmx)
                  }
                }
              }
            }
          }
        }

        Text {
          visible: vmware.lastError !== ""
          width: parent.width
          textFormat: Text.PlainText
          text: vmware.lastError
          color: root.urgent
          font.family: root.fontFamily
          font.pixelSize: Style.font.bodySmall
          wrapMode: Text.WordWrap
        }
      }
    }
  }
}
```

- [ ] **Step 4: Validate the plugin**

Run:

```bash
omarchy plugin validate /home/cavanaug/.config/omarchy/plugins/cavanaug.vmware
```

Expected: success, no schema errors. If it complains about missing `Panel.qml` or kinds, fix the file named in the error — do not edit `/usr/share/omarchy/`.

- [ ] **Step 5: Enable on the bar**

Run:

```bash
omarchy plugin enable cavanaug.vmware --section right
omarchy-shell shell rescanPlugins
```

Expected: widget appears on the right of the bar. Click it: hero says `VMware Workstation`, meta `N RUNNING`, Open tooltip `Open Workstation`, inventory rows, dimmed slots per matrix. Hover `󰒲` — tooltip `Power Off`, glyph 2px left. `check.js` still prints `ok`.

If enable says the id is unknown, the plugin directory or manifest `id` is wrong — fix that, then re-run enable.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| User plugin, no `/usr/share/omarchy` | 2–4 |
| Tailscale shape, `Panel` + `Service` | 3, 4 |
| `icon_style` branded default / themed | 2, 4 |
| `refreshIntervalSec` 30, 5–3600 | 2, 3 |
| Official color PNG + Disk:8 mono | 2 |
| Bar 12px branded/themed | 4 |
| PanelHero color 24px, title, `N RUNNING`, Open `󰏌` | 4 |
| Open via gtk-launch → hidpi → /usr/bin/vmware | 1, 4 |
| 22ch names, 5-row scroll, shrink | 4 |
| Status bullets + words | 4 |
| Six slots, gap, dim, glyphs, `󰒲` −2px x | 1, 4 |
| Enable matrix + missing vmx | 1, 3 |
| `vmrun -T ws` start gui / stop hard / suspend hard / stop soft / suspend soft / reset soft | 1, 3 |
| Inventory `.vmls` only | 1, 3 |
| running / `.vmss` / off | 1, 3 |
| lastError under list; vmrun missing copy | 3, 4 |
| `omarchy plugin validate` + Model self-check | 1, 4 |
| No nogui, no VIX, no per-VM Open, no hard reset | constraints |
