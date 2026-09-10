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
  // ponytail: lexical only—no symlink/.. resolution, so divergent inventory/vmrun paths can look off; upgrade the Service probe to realpath both.
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
  if (state === "running") return [true, true, false, true, true, true]
  if (state === "suspended") return [true, false, true, false, false, false]
  if (state === "off") return [false, false, true, false, false, false]
  return [false, false, false, false, false, false]
}

function slotsMask(state) {
  var bits = slotsEnabled(state)
  var mask = 0
  for (var i = 0; i < bits.length; i++) {
    if (bits[i]) mask |= (1 << i)
  }
  return mask
}

function statusLabel(state, pendingSlot, pendingVmx, vmx) {
  var slot = Number(pendingSlot)
  if (slot && sameVmx(vmx, pendingVmx)) {
    if (slot === 1) return "powering off"
    if (slot === 2) return "suspending"
    if (slot === 3) return state === "suspended" ? "resuming" : "starting"
    if (slot === 4) return "shutting down"
    if (slot === 5) return "sleeping"
    if (slot === 6) return "restarting"
  }
  if (state === "missing") return "off"
  return String(state || "off")
}

// Keep the busy word after vmrun exits until a poll sees the new power
// state. Resume returns while .vmss still exists, so clearing on exit
// flickers "resuming" → "suspended" → "running".
function shouldHoldPending(slot, observedState) {
  slot = Number(slot)
  var state = String(observedState || "")
  if (slot === 1 || slot === 4) return state !== "off" && state !== "missing"
  if (slot === 2 || slot === 5) return state !== "suspended"
  if (slot === 3) return state !== "running"
  return false
}

function hardTooltip(slot) {
  slot = Number(slot)
  if (slot === 1) return "PowerOff"
  if (slot === 2) return "Suspend"
  if (slot === 3) return "Resume"
  return ""
}

function guestWord(slot) {
  slot = Number(slot)
  if (slot === 4) return "Shutdown"
  if (slot === 5) return "Sleep"
  if (slot === 6) return "Restart"
  return ""
}

function commandForSlot(slot, vmx) {
  var path = String(vmx || "")
  slot = Number(slot)
  if (slot === 1) return ["vmrun", "-T", "ws", "stop", path, "hard"]
  if (slot === 2) return ["vmrun", "-T", "ws", "suspend", path, "hard"]
  if (slot === 3) return ["vmrun", "-T", "ws", "start", path, "gui"]
  if (slot === 4) return ["vmrun", "-T", "ws", "stop", path, "soft"]
  if (slot === 5) return ["vmrun", "-T", "ws", "suspend", path, "soft"]
  if (slot === 6) return ["vmrun", "-T", "ws", "reset", path, "soft"]
  return []
}

function openWorkstationCommand() {
  return ["omarchy-launch-or-focus", "^vmware$", "/usr/bin/vmware"]
}

function formatActionError(stdout, stderr, code) {
  var out = String(stdout || "").replace(/^\s+|\s+$/g, "")
  if (out) return out
  var err = String(stderr || "").replace(/^\s+|\s+$/g, "")
  if (err) return err
  return "vmrun failed (exit " + Number(code) + ")"
}

function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'"
}

function vmrunWithKeyringScript(cmd) {
  var argv = cmd || []
  var rest = argv.slice(3)
  var vmx = ""
  for (var i = 0; i < rest.length; i++) {
    if (/\.vmx$/i.test(String(rest[i] || ""))) {
      vmx = String(rest[i])
      break
    }
  }
  var args = []
  for (var j = 0; j < rest.length; j++) args.push(shellQuote(rest[j]))
  var quoted = args.join(" ")
  return [
    "vmx=" + shellQuote(vmx),
    "pw=",
    "if command -v secret-tool >/dev/null 2>&1; then",
    "  pw=$(secret-tool lookup path \"$vmx\" 2>/dev/null || true)",
    "  if [ -z \"$pw\" ]; then",
    "    guid=$(sed -n 's/^encryptedVM\\.guid = \"\\(.*\\)\"/\\1/p' \"$vmx\" 2>/dev/null | head -n 1)",
    "    [ -n \"$guid\" ] && pw=$(secret-tool lookup encryptedVM.guid \"$guid\" 2>/dev/null || true)",
    "  fi",
    "fi",
    "if [ -n \"$pw\" ]; then",
    "  exec vmrun -T ws -vp \"$pw\" " + quoted,
    "fi",
    "exec vmrun -T ws " + quoted
  ].join("\n")
}

function vmssProbeScript(vmxPaths) {
  var parts = []
  var paths = vmxPaths || []
  for (var i = 0; i < paths.length; i++) {
    var p = String(paths[i] || "")
    if (!p) continue
    parts.push("p=" + shellQuote(p))
    parts.push("d=$(dirname -- \"$p\")")
    parts.push("b=$(basename -- \"$p\")")
    parts.push("b=${b%.vmx}")
    parts.push("b=${b%.VMX}")
    parts.push("found=")
    parts.push("for s in \"$d/$b\".vmss \"$d/$b\".VMSS \"$d/$b\"-*.vmss \"$d/$b\"-*.VMSS; do")
    parts.push("  [ -f \"$s\" ] && found=1 && break")
    parts.push("done")
    parts.push("[ -n \"$found\" ] && printf '%s\\n' \"$p\"")
  }
  parts.push("true")
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
    slotsMask: slotsMask,
    statusLabel: statusLabel,
    shouldHoldPending: shouldHoldPending,
    hardTooltip: hardTooltip,
    guestWord: guestWord,
    commandForSlot: commandForSlot,
    openWorkstationCommand: openWorkstationCommand,
    formatActionError: formatActionError,
    shellQuote: shellQuote,
    vmrunWithKeyringScript: vmrunWithKeyringScript,
    vmssProbeScript: vmssProbeScript,
    runningCount: runningCount
  }
}
