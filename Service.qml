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
  property string _actionOut: ""
  property string _actionErr: ""
  property int pendingSlot: 0
  property string pendingVmx: ""
  property double _pendingHoldUntilMs: 0
  property double _whichStartedMs: 0
  property double _listStartedMs: 0
  property double _vmssStartedMs: 0
  property double _actionStartedMs: 0

  function refresh() {
    if (!installed) {
      if (whichProcess.running) return
      whichProcess.command = ["which", "vmrun"]
      _whichStartedMs = Date.now()
      whichProcess.running = true
      return
    }
    if (_inventory.length === 0) return
    if (listProcess.running) return
    _listOut = ""
    _listErr = ""
    listProcess.command = ["vmrun", "-T", "ws", "list"]
    _listStartedMs = Date.now()
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
        slotsMask: Model.slotsMask(state)
      })
    }
    vms = rows
    settlePending()
  }

  function observedState(vmx) {
    var rows = vms
    for (var i = 0; i < rows.length; i++) {
      if (Model.sameVmx(rows[i].vmx, vmx)) return rows[i].state
    }
    return ""
  }

  function settlePending() {
    if (!pendingSlot) return
    if (!Model.shouldHoldPending(pendingSlot, observedState(pendingVmx))) {
      pendingSlot = 0
      pendingVmx = ""
      return
    }
    if (actionProcess.running) return
    if (_pendingHoldUntilMs && Date.now() >= _pendingHoldUntilMs) {
      pendingSlot = 0
      pendingVmx = ""
      return
    }
    delayedRefresh.restart()
  }

  function finishPoll(listText) {
    _running = Model.parseRunningList(listText)
    var paths = []
    for (var i = 0; i < _inventory.length; i++) paths.push(_inventory[i].vmx)
    if (paths.length === 0) {
      vms = []
      return
    }
    if (vmssProcess.running) return
    _vmssOut = ""
    vmssProcess.command = ["bash", "-c", Model.vmssProbeScript(paths) + "\nfor p in " + paths.map(function (p) { return Model.shellQuote(p) }).join(" ") + "; do [ -f \"$p\" ] || printf 'MISSING:%s\\n' \"$p\"; done"]
    _vmssStartedMs = Date.now()
    vmssProcess.running = true
  }

  function runSlot(slot, vmx) {
    if (!installed || actionProcess.running || !vmx) {
      if (!vmx) lastError = "missing vmx"
      else if (!installed) lastError = "vmrun is not installed or not on PATH."
      else lastError = "vmrun is busy"
      return
    }
    var cmd = Model.commandForSlot(Number(slot), String(vmx))
    if (!cmd.length) {
      lastError = "unknown action"
      return
    }
    var argv = ["bash", "-c", Model.vmrunWithKeyringScript(cmd)]
    _actionOut = ""
    _actionErr = ""
    pendingSlot = Number(slot)
    pendingVmx = String(vmx)
    _pendingHoldUntilMs = 0
    lastError = ""
    _actionStartedMs = Date.now()
    actionProcess.exec(argv)
  }

  function loadInventory(text) {
    _inventory = Model.parseInventory(text)
    if (_inventory.length === 0) {
      vms = []
      if (installed) lastError = ""
    }
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

  Timer {
    // Each poll is guarded only by its own process, so reap anything that never
    // exits before it can leave that part of the panel permanently stale.
    id: pollWatchdog
    readonly property int timeoutMs: 15000
    readonly property int actionTimeoutMs: 180000
    interval: 1000
    repeat: true
    running: root.busy
    onTriggered: {
      var now = Date.now()
      if (whichProcess.running && now - root._whichStartedMs >= timeoutMs) whichProcess.running = false
      if (listProcess.running && now - root._listStartedMs >= timeoutMs) listProcess.running = false
      if (vmssProcess.running && now - root._vmssStartedMs >= timeoutMs) vmssProcess.running = false
      if (actionProcess.running && now - root._actionStartedMs >= actionTimeoutMs) actionProcess.running = false
    }
  }

  Timer {
    id: delayedRefresh
    interval: 600
    repeat: false
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
      delayedRefresh.restart()
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
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root._actionOut = text
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: root._actionErr = text
    }
    onExited: function (code) {
      if (code !== 0) {
        root.pendingSlot = 0
        root.pendingVmx = ""
        root.lastError = Model.formatActionError(root._actionOut, root._actionErr, code)
      } else {
        root.lastError = ""
        if (Model.shouldHoldPending(root.pendingSlot, root.observedState(root.pendingVmx))) {
          root._pendingHoldUntilMs = Date.now() + 15000
        } else {
          root.pendingSlot = 0
          root.pendingVmx = ""
        }
      }
      delayedRefresh.restart()
    }
  }
}
