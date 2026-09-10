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

eq("slots running", M.slotsEnabled("running"), [true, true, false, true, true, true])
eq("slots suspended", M.slotsEnabled("suspended"), [true, false, true, false, false, false])
eq("slots off", M.slotsEnabled("off"), [false, false, true, false, false, false])
eq("slots missing", M.slotsEnabled("missing"), [false, false, false, false, false, false])
eq("slotsMask running", M.slotsMask("running"), 59)
eq("slotsMask suspended", M.slotsMask("suspended"), 5)
eq("slotsMask off", M.slotsMask("off"), 4)

eq("status idle suspended", M.statusLabel("suspended", 0, "", "/a.vmx"), "suspended")
eq("status resuming", M.statusLabel("suspended", 3, "/a.vmx", "/a.vmx"), "resuming")
eq("status starting", M.statusLabel("off", 3, "/a.vmx", "/a.vmx"), "starting")
eq("status other vm stays idle", M.statusLabel("suspended", 3, "/a.vmx", "/b.vmx"), "suspended")
eq("status powering off", M.statusLabel("running", 1, "/a.vmx", "/a.vmx"), "powering off")
eq("status suspending", M.statusLabel("running", 2, "/a.vmx", "/a.vmx"), "suspending")
eq("status shutting down", M.statusLabel("running", 4, "/a.vmx", "/a.vmx"), "shutting down")
eq("status guest sleeping", M.statusLabel("running", 5, "/a.vmx", "/a.vmx"), "sleeping")
eq("status restarting", M.statusLabel("running", 6, "/a.vmx", "/a.vmx"), "restarting")
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
eq("no slot does not hold", M.shouldHoldPending(0, "suspended"), false)
eq("hard tooltip PowerOff", M.hardTooltip(1), "PowerOff")
eq("hard tooltip Suspend", M.hardTooltip(2), "Suspend")
eq("hard tooltip Resume", M.hardTooltip(3), "Resume")
eq("guest word Shutdown", M.guestWord(4), "Shutdown")
eq("guest word Sleep", M.guestWord(5), "Sleep")
eq("guest word Restart", M.guestWord(6), "Restart")

eq("slot 1 stop hard",
  M.commandForSlot(1, "/a.vmx"),
  ["vmrun", "-T", "ws", "stop", "/a.vmx", "hard"])
eq("slot 2 suspend hard",
  M.commandForSlot(2, "/a.vmx"),
  ["vmrun", "-T", "ws", "suspend", "/a.vmx", "hard"])
eq("slot 3 start gui",
  M.commandForSlot(3, "/a.vmx"),
  ["vmrun", "-T", "ws", "start", "/a.vmx", "gui"])
eq("slot 4 stop soft",
  M.commandForSlot(4, "/a.vmx"),
  ["vmrun", "-T", "ws", "stop", "/a.vmx", "soft"])
eq("slot 5 suspend soft",
  M.commandForSlot(5, "/a.vmx"),
  ["vmrun", "-T", "ws", "suspend", "/a.vmx", "soft"])
eq("slot 6 reset soft",
  M.commandForSlot(6, "/a.vmx"),
  ["vmrun", "-T", "ws", "reset", "/a.vmx", "soft"])
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
eq("keyring script passes -vp", wrap.indexOf("vmrun -T ws -vp") !== -1, true)
eq("keyring script keeps start args", /'start' '\/a\.vmx' 'gui'/.test(wrap), true)

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
eq("actions use keyring wrapper", service.indexOf("vmrunWithKeyringScript") !== -1, true)
eq("slot 1 does not launch Workstation on the vmx", service.indexOf("Model.startGuiCommand") === -1, true)
eq("action errors read stdout", service.indexOf("formatActionError") !== -1, true)
eq("actions start with Process.exec", service.indexOf("actionProcess.exec(argv)") !== -1, true)
eq("pending holds until polled state matches", service.indexOf("shouldHoldPending") !== -1, true)
eq("pending slot clears when settled", service.indexOf("pendingSlot = 0") !== -1, true)

var panel = fs.readFileSync("./Panel.qml", "utf8")
eq("row status uses statusLabel", panel.indexOf("Model.statusLabel") !== -1, true)
eq("hard actions use tooltips", panel.indexOf("Model.hardTooltip") !== -1, true)
eq("guest actions use guest words as tooltips", panel.indexOf("Model.guestWord") !== -1, true)
eq("column headers Hypervisor and GuestOS", panel.indexOf('"Hypervisor"') !== -1 && panel.indexOf('"GuestOS"') !== -1, true)
eq("header columns size to labels and buttons", panel.indexOf("hyperColWidth") !== -1 && panel.indexOf("guestColWidth") !== -1, true)

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

var bin = fs.mkdtempSync(path.join(os.tmpdir(), "vmrun-wrap-"))
fs.writeFileSync(path.join(bin, "secret-tool"), "#!/bin/sh\necho stubpw\n", { mode: 0o755 })
fs.writeFileSync(path.join(bin, "vmrun"), "#!/bin/sh\nprintf '%s\\n' \"$*\"\n", { mode: 0o755 })
fs.writeFileSync(path.join(bin, "command"), "#!/bin/sh\nexit 0\n", { mode: 0o755 })
var wrapped = execFileSync("bash", ["-c", M.vmrunWithKeyringScript(["vmrun", "-T", "ws", "stop", "/a.vmx", "hard"])], {
  encoding: "utf8",
  env: Object.assign({}, process.env, { PATH: bin + ":" + process.env.PATH })
}).replace(/^\s+|\s+$/g, "")
eq("keyring wrapper injects -vp from secret-tool", wrapped, "-T ws -vp stubpw stop /a.vmx hard")


if (fails) {
  console.error(fails + " failed")
  process.exit(1)
}
console.log("ok")
