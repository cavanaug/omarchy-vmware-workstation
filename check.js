var M = require("./Model.js")
var fs = require("fs")
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

eq("slots running", M.slotsEnabled("running"), [true, true, false, true, true, true, false])
eq("slots suspended", M.slotsEnabled("suspended"), [true, false, true, false, false, false, true])
eq("slots off", M.slotsEnabled("off"), [false, false, true, false, false, false, true])
eq("slots missing", M.slotsEnabled("missing"), [false, false, false, false, false, false, false])
eq("slotsMask running", M.slotsMask("running"), 59)
eq("slotsMask suspended", M.slotsMask("suspended"), 69)
eq("slotsMask off", M.slotsMask("off"), 68)

eq("status idle suspended", M.statusLabel("suspended", 0, "", "/a.vmx"), "suspended")
eq("status resuming", M.statusLabel("suspended", 3, "/a.vmx", "/a.vmx"), "resuming")
eq("status starting", M.statusLabel("off", 3, "/a.vmx", "/a.vmx"), "starting")
eq("status other vm stays idle", M.statusLabel("suspended", 3, "/a.vmx", "/b.vmx"), "suspended")
eq("status powering off", M.statusLabel("running", 1, "/a.vmx", "/a.vmx"), "powering off")
eq("status suspending", M.statusLabel("running", 2, "/a.vmx", "/a.vmx"), "suspending")
eq("status shutting down", M.statusLabel("running", 4, "/a.vmx", "/a.vmx"), "shutting down")
eq("status guest sleeping", M.statusLabel("running", 5, "/a.vmx", "/a.vmx"), "sleeping")
eq("status restarting", M.statusLabel("running", 6, "/a.vmx", "/a.vmx"), "restarting")
eq("status guest startup from off", M.statusLabel("off", 7, "/a.vmx", "/a.vmx"), "starting")
eq("status guest startup from suspended", M.statusLabel("suspended", 7, "/a.vmx", "/a.vmx"), "resuming")
eq("status missing idle", M.statusLabel("missing", 0, "", "/gone.vmx"), "off")

eq("hold resume until running", M.shouldHoldPending(3, "suspended"), true)
eq("release resume once running", M.shouldHoldPending(3, "running"), false)
eq("hold resume from off until running", M.shouldHoldPending(3, "off"), true)
eq("hold hard suspend until suspended", M.shouldHoldPending(2, "running"), true)
eq("release hard suspend once suspended", M.shouldHoldPending(2, "suspended"), false)
eq("hold poweroff until off", M.shouldHoldPending(1, "running"), true)
eq("release poweroff once off", M.shouldHoldPending(1, "off"), false)
eq("release poweroff if missing", M.shouldHoldPending(1, "missing"), false)
eq("hold shutdown until off", M.shouldHoldPending(4, "running"), true)
eq("hold sleep until suspended", M.shouldHoldPending(5, "running"), true)
eq("restart does not hold after vmrun", M.shouldHoldPending(6, "running"), false)
eq("hold guest startup until running", M.shouldHoldPending(7, "off"), true)
eq("release guest startup once running", M.shouldHoldPending(7, "running"), false)
eq("no slot does not hold", M.shouldHoldPending(0, "suspended"), false)
eq("hard tooltip PowerOff", M.hardTooltip(1), "PowerOff")
eq("hard tooltip Suspend", M.hardTooltip(2), "Suspend")
eq("hard tooltip Resume", M.hardTooltip(3), "Resume")
eq("guest word Shutdown", M.guestWord(4), "Shutdown")
eq("guest word Sleep", M.guestWord(5), "Sleep")
eq("guest word Restart", M.guestWord(6), "Restart")
eq("guest word Startup", M.guestWord(7), "Startup")

eq("slot 1 stop hard",
  M.commandForSlot(1, "/a.vmx"),
  ["vmrun", "-T", "ws", "stop", "/a.vmx", "hard"])
eq("slot 2 suspend hard",
  M.commandForSlot(2, "/a.vmx"),
  ["vmrun", "-T", "ws", "suspend", "/a.vmx", "hard"])
eq("slot 3 start headless",
  M.commandForSlot(3, "/a.vmx"),
  ["vmrun", "-T", "ws", "start", "/a.vmx"])
eq("slot 4 stop soft",
  M.commandForSlot(4, "/a.vmx"),
  ["vmrun", "-T", "ws", "stop", "/a.vmx", "soft"])
eq("slot 5 suspend soft",
  M.commandForSlot(5, "/a.vmx"),
  ["vmrun", "-T", "ws", "suspend", "/a.vmx", "soft"])
eq("slot 6 reset soft",
  M.commandForSlot(6, "/a.vmx"),
  ["vmrun", "-T", "ws", "reset", "/a.vmx", "soft"])
eq("slot 7 startup", M.commandForSlot(7, "/a.vmx"), ["vmrun", "-T", "ws", "start", "/a.vmx"])
eq("slot 2 from string",
  M.commandForSlot("2", "/a.vmx"),
  ["vmrun", "-T", "ws", "suspend", "/a.vmx", "hard"])

eq("open focuses existing Workstation",
  M.openWorkstationCommand(),
  ["omarchy-launch-or-focus", "^vmware$", "/usr/bin/vmware"])

eq("formatActionError prefers stdout",
  M.formatActionError("Error: Cannot open VM: /a.vmx, A password is required for this operation\n", "", 255),
  "Error: Cannot open VM: /a.vmx, A password is required for this operation")
eq("formatActionError uses stderr",
  M.formatActionError("", "permission denied\n", 1),
  "permission denied")
eq("formatActionError includes exit code",
  M.formatActionError("", "", 255),
  "vmrun failed (exit 255)")

eq("shellQuote", M.shellQuote("a'b"), "'a'\\''b'")

var wrap = M.vmrunWithKeyringScript(["vmrun", "-T", "ws", "start", "/a.vmx", "gui"])
eq("keyring script looks up by path", wrap.indexOf("secret-tool lookup path") !== -1, true)
eq("keyring script looks up by guid", wrap.indexOf("encryptedVM.guid") !== -1, true)
eq("keyring script quotes vmx", wrap.indexOf("'/a.vmx'") !== -1, true)
eq("keyring script passes -vp", wrap.indexOf('-vp "$pw"') !== -1, true)
eq("keyring script keeps start args", /'start' '\/a\.vmx' 'gui'/.test(wrap), true)
eq("keyring script runs vmrun without pw when keyring empty", /exec 'vmrun' '-T' 'ws' 'start'/.test(wrap), true)
eq("keyring script tolerates any vmrun flag layout", /exec 'vmrun' 'stop' '\/b\.vmx'/.test(M.vmrunWithKeyringScript(["vmrun", "stop", "/b.vmx"])), true)

eq("runningCount",
  M.runningCount([{ state: "running" }, { state: "off" }, { state: "running" }]),
  2)

var service = fs.readFileSync("./Service.qml", "utf8")
eq("refresh is not aggregate busy gated", service.indexOf("if (busy)") === -1, true)
eq("actions are independently gated", service.indexOf("if (!installed || actionProcess.running || !vmx)") !== -1, true)
eq("exits defer refresh", (service.match(/delayedRefresh\.restart\(\)/g) || []).length >= 2, true)
eq("poll watchdog covers every process",
  ["whichProcess", "listProcess", "vmssProcess", "actionProcess"].every(function (name) {
    return new RegExp("if \\(" + name + "\\.running[^\\n]+\\) " + name + "\\.running = false").test(service)
  }),
  true)
eq("vm rows do not use enabled as a model key", service.indexOf("slotsMask:") !== -1, true)
eq("keyring wrapper present but opt-in", service.indexOf("vmrunWithKeyringScript") !== -1 && service.indexOf("keyringPassword ? [") !== -1, true)
eq("slot 1 does not launch Workstation on the vmx", service.indexOf("Model.startGuiCommand") === -1, true)
eq("action errors read stdout", service.indexOf("formatActionError") !== -1, true)
eq("actions start with Process.exec", service.indexOf("actionProcess.exec(argv)") !== -1, true)
eq("pending holds until polled state matches", service.indexOf("shouldHoldPending") !== -1, true)
eq("pending slot clears when settled", service.indexOf("pendingSlot = 0") !== -1, true)
eq("failing polls expire an overdue pending", service.indexOf("root.expirePending()") !== -1, true)

var panel = fs.readFileSync("./Panel.qml", "utf8")
eq("row status uses statusLabel", panel.indexOf("Model.statusLabel") !== -1, true)
eq("hard actions use tooltips", panel.indexOf("Model.hardTooltip") !== -1, true)
eq("guest actions use guest words as tooltips", panel.indexOf("Model.guestWord") !== -1, true)
eq("two-line headers with hard/soft subtitles", panel.indexOf('"GuestOS\\n(soft)"') !== -1 && panel.indexOf('"Hypervisor\\n(hard)"') !== -1, true)
var glyphFn = panel.slice(panel.indexOf("function slotGlyph"), panel.indexOf("function bulletColor"))
var glyphReturns = (glyphFn.match(/return "([^"]*)"/g) || [])
eq("slot glyphs cover slots 1-7 and empty fallback", glyphReturns.length === 8 && glyphReturns.slice(0, 7).every(function (r) { return r !== 'return ""' }) && glyphReturns[7] === 'return ""', true)
eq("startup icon is play", glyphCode(glyphReturns[6]), "f040a")
function glyphCode(ret) {
  var m = String(ret).match(/"(.*)"/)
  var c = m && m[1] ? m[1].codePointAt(0) : 0
  return c ? c.toString(16) : ""
}
eq("poweroff icon is power_plug_off_outline", glyphCode(glyphReturns[0]), "f1424")
eq("resume icon is power_plug", glyphCode(glyphReturns[2]), "f06a5")
eq("restart icon is md-restart", glyphCode(glyphReturns[5]), "f0709")
eq("glyphs are 1px over the icon token", (panel.match(/fontSize: Style\.font\.icon \+ 1/g) || []).length, 2)
eq("guest column first, hypervisor second", panel.indexOf('"GuestOS\\n(soft)"') < panel.indexOf('"Hypervisor\\n(hard)"') && panel.indexOf("model: [4, 5, 7, 6]") !== -1 && panel.indexOf("model: [4, 5, 7, 6]") < panel.indexOf("slot: index + 1"), true)
eq("guest order is shutdown sleep startup restart", panel.indexOf("model: [4, 5, 7, 6]") !== -1, true)
eq("pending vm disables its buttons", (panel.match(/enabled: \(Number\(vm\.slotsMask\) & \(1 << \(slot - 1\)\)\) !== 0 && !root\.vmBusy\(vm\.vmx\)/g) || []).length, 2)
eq("vmBusy gates on pendingSlot and sameVmx", panel.indexOf("function vmBusy") !== -1 && panel.indexOf("Model.sameVmx(vmware.pendingVmx, vmx)") !== -1, true)
eq("header columns size to labels and buttons", panel.indexOf("hyperColWidth") !== -1 && panel.indexOf("guestColWidth") !== -1, true)

var PLUGIN_ID = "io.github.cavanaug.vmware-workstation"
var manifest = JSON.parse(fs.readFileSync("./manifest.json", "utf8"))
eq("manifest id", manifest.id, PLUGIN_ID)
var keyringSchema = (manifest.barWidget.schema || []).filter(function (s) { return s.key === "keyringPassword" })[0] || {}
eq("keyringPassword is boolean and default off", keyringSchema.type === "boolean" && keyringSchema.defaultValue === false && manifest.barWidget.defaults.keyringPassword === false, true)
eq("panel moduleName", panel.indexOf('moduleName: "' + PLUGIN_ID + '"') !== -1, true)
eq("panel ipcTarget", panel.indexOf('ipcTarget: "' + PLUGIN_ID + '"') !== -1, true)
eq("LICENSE exists", fs.existsSync("./LICENSE"), true)
eq("LICENSE is MIT", fs.existsSync("./LICENSE") && fs.readFileSync("./LICENSE", "utf8").indexOf("MIT License") !== -1, true)
eq("LICENSE copyright", fs.existsSync("./LICENSE") && fs.readFileSync("./LICENSE", "utf8").indexOf("Copyright (c) 2026 John Cavanaugh") !== -1, true)

var readme = fs.readFileSync("./README.md", "utf8")
eq("README install git url", readme.indexOf("omarchy plugin add https://github.com/cavanaug/omarchy-vmware-workstation.git --enable") !== -1, true)
eq("README update command", readme.indexOf("omarchy plugin update io.github.cavanaug.vmware-workstation") !== -1, true)
eq("README remove command", readme.indexOf("omarchy plugin remove io.github.cavanaug.vmware-workstation") !== -1, true)
eq("README shows preview.png", readme.indexOf("preview.png") !== -1, true)
eq("README has no wip symlink", readme.indexOf("wip_other") === -1, true)
eq("preview.png exists", fs.existsSync("./preview.png"), true)

var os = require("os")
var path = require("path")
var { execFileSync } = require("child_process")
var dir = fs.mkdtempSync(path.join(os.tmpdir(), "vmss-"))
var vmx = path.join(dir, "a.vmx")
fs.writeFileSync(vmx, "")
fs.writeFileSync(path.join(dir, "a-deadbeef.vmss"), "")
var probe = path.join(dir, "probe.sh")
fs.writeFileSync(probe, M.vmssProbeScript([vmx]))
var probed = execFileSync("bash", [probe], { encoding: "utf8" }).replace(/^\s+|\s+$/g, "")
eq("uuid-suffixed .vmss counts as suspended", probed, vmx)

var dirCase = fs.mkdtempSync(path.join(os.tmpdir(), "vmss-case-"))
var vmxCase = path.join(dirCase, "b.Vmx")
fs.writeFileSync(vmxCase, "")
fs.writeFileSync(path.join(dirCase, "b.vmss"), "")
var probeCase = path.join(dirCase, "probe.sh")
fs.writeFileSync(probeCase, M.vmssProbeScript([vmxCase]))
var probedCase = execFileSync("bash", [probeCase], { encoding: "utf8" }).replace(/^\s+|\s+$/g, "")
eq("mixed-case .Vmx probes lowercase .vmss stem", probedCase, vmxCase)

var bin = fs.mkdtempSync(path.join(os.tmpdir(), "vmrun-wrap-"))
fs.writeFileSync(path.join(bin, "secret-tool"), "#!/bin/sh\necho stubpw\n", { mode: 0o755 })
fs.writeFileSync(path.join(bin, "vmrun"), "#!/bin/sh\nprintf '%s\\n' \"$*\"\n", { mode: 0o755 })
fs.writeFileSync(path.join(bin, "command"), "#!/bin/sh\nexit 0\n", { mode: 0o755 })
var wrapped = execFileSync("bash", ["-c", M.vmrunWithKeyringScript(["vmrun", "-T", "ws", "stop", "/a.vmx", "hard"])], {
  encoding: "utf8",
  env: Object.assign({}, process.env, { PATH: bin + ":" + process.env.PATH })
}).replace(/^\s+|\s+$/g, "")
eq("keyring wrapper injects -vp from secret-tool", wrapped, "-vp stubpw -T ws stop /a.vmx hard")

if (fails) {
  console.error(fails + " failed")
  process.exit(1)
}
console.log("ok")
