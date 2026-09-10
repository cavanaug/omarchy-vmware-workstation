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

var service = fs.readFileSync("./Service.qml", "utf8")
eq("refresh is not aggregate busy gated", service.indexOf("if (busy)") === -1, true)
eq("actions are independently gated", service.indexOf("if (!installed || actionProcess.running || !vmx) return") !== -1, true)
eq("exits defer refresh", (service.match(/delayedRefresh\.restart\(\)/g) || []).length, 2)
eq("poll watchdog covers every process",
  ["whichProcess", "listProcess", "vmssProcess", "actionProcess"].every(function (name) {
    return new RegExp("if \\(" + name + "\\.running[^\\n]+\\) " + name + "\\.running = false").test(service)
  }),
  true)

if (fails) {
  console.error(fails + " failed")
  process.exit(1)
}
console.log("ok")
