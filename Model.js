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
