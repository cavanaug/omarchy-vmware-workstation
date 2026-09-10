# GitHub Publication Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the plugin marketplace-ready: new plugin id, MIT license, user README, and a branded `preview.png`, without creating a GitHub remote or filing a listing.

**Architecture:** Keep the existing bar-widget. Change only the public contract (`manifest.json` id, `Panel.qml` IPC names), add root `LICENSE` / `README.md` / `preview.png`, and migrate this machine's symlink plus `shell.json` id so the widget still loads. Extend `check.js` with publication-contract assertions (id, license, README install/remove, preview file).

**Tech Stack:** Omarchy shell plugin CLI, Node `check.js`, `grim` for the still, MIT license text.

**Spec:** `docs/superpowers/specs/2026-09-10-github-publication-docs-design.md`

## Global Constraints

- Plugin id is exactly `io.github.cavanaug.vmware-workstation`.
- Display name stays `VMware Workstation`.
- Shorthand in prose is `vmware-workstation`.
- Do not edit `/usr/share/omarchy/`.
- Do not create a GitHub remote, push, tag, or open an omarchyplugins.com issue.
- Do not delete or rewrite `docs/superpowers/` history files.
- Do not change widget behavior, settings schema keys, QML layout, or icon assets.
- Do not add `docs/bar.png`, a GIF, CONTRIBUTING, or badges.
- Do not git commit unless the human explicitly asks; skip every Commit step and continue.
- No new npm/pip packages. Node is only used to run `check.js`.
- This machine's bar entry is in **center** (not `defaultSection` right). Keep it in center. Current `icon_style` is `themed` except during the screenshot.

## File map

| Path | Responsibility |
|---|---|
| `check.js` | Existing Model/QML checks, plus publication-contract assertions |
| `manifest.json` | Plugin id only |
| `Panel.qml` | `moduleName` and `ipcTarget` only |
| `LICENSE` | MIT, Copyright (c) 2026 John Cavanaugh |
| `README.md` | User docs |
| `preview.png` | Marketplace + README hero |
| `~/.config/omarchy/plugins/io.github.cavanaug.vmware-workstation` | Renamed symlink to this repo |
| `~/.config/omarchy/shell.json` | Bar layout `id` for this widget |

---

### Task 1: Plugin id

**Files:**
- Modify: `check.js` (append publication id assertions after the existing `panel` reads)
- Modify: `manifest.json` line 3 `"id"`
- Modify: `Panel.qml` lines 11–12 `moduleName` and `ipcTarget`

**Interfaces:**
- Consumes: existing `check.js` `eq()` helper; `fs.readFileSync("./Panel.qml")` already assigned to `panel`
- Produces: runtime id `io.github.cavanaug.vmware-workstation` in manifest and Panel IPC

- [ ] **Step 1: Write the failing checks**

Insert these lines in `check.js` immediately after the existing `var panel = fs.readFileSync("./Panel.qml", "utf8")` block (after the `header columns size` assertion, before `var os = require("os")`):

```javascript
var PLUGIN_ID = "io.github.cavanaug.vmware-workstation"
var manifest = JSON.parse(fs.readFileSync("./manifest.json", "utf8"))
eq("manifest id", manifest.id, PLUGIN_ID)
eq("panel moduleName", panel.indexOf('moduleName: "' + PLUGIN_ID + '"') !== -1, true)
eq("panel ipcTarget", panel.indexOf('ipcTarget: "' + PLUGIN_ID + '"') !== -1, true)
```

Do not add LICENSE, README, or preview.png checks in this task.

- [ ] **Step 2: Run check to verify it fails**

Run: `node check.js`

Expected: FAIL `manifest id` (got `"cavanaug.vmware"`) and the two Panel assertions. Process exit 1.

- [ ] **Step 3: Change the id**

In `manifest.json`, set:

```json
"id": "io.github.cavanaug.vmware-workstation",
```

Leave `"name"`, `"author"`, `"version"`, `barWidget.displayName`, and schema untouched.

In `Panel.qml` lines 11–12, set:

```qml
  moduleName: "io.github.cavanaug.vmware-workstation"
  ipcTarget: "io.github.cavanaug.vmware-workstation"
```

- [ ] **Step 4: Run check and validate**

Run: `node check.js`

Expected: `ok`

Run: `omarchy plugin validate /home/cavanaug/wip_other/src_cavanaug/omarchy-vmware-workstation`

Expected: success (no reserved `omarchy.*` id, entry points exist).

- [ ] **Step 5: Commit**

Skip unless the human asked to commit.

```bash
git add check.js manifest.json Panel.qml
git commit -m "$(cat <<'EOF'
Use the marketplace-preferred plugin id.

EOF
)"
```

---

### Task 2: LICENSE

**Files:**
- Modify: `check.js` (LICENSE assertions next to the Task 1 publication checks)
- Create: `LICENSE`

**Interfaces:**
- Consumes: `eq()` in `check.js`
- Produces: root `LICENSE` file containing `MIT License` and `Copyright (c) 2026 John Cavanaugh`

- [ ] **Step 1: Write the failing checks**

Immediately after the Task 1 `PLUGIN_ID` assertions in `check.js`, add:

```javascript
eq("LICENSE exists", fs.existsSync("./LICENSE"), true)
eq("LICENSE is MIT", fs.existsSync("./LICENSE") && fs.readFileSync("./LICENSE", "utf8").indexOf("MIT License") !== -1, true)
eq("LICENSE copyright", fs.existsSync("./LICENSE") && fs.readFileSync("./LICENSE", "utf8").indexOf("Copyright (c) 2026 John Cavanaugh") !== -1, true)
```

- [ ] **Step 2: Run check to verify it fails**

Run: `node check.js`

Expected: FAIL `LICENSE exists`. Exit 1. Manifest id checks from Task 1 still pass.

- [ ] **Step 3: Add LICENSE**

Create `LICENSE` with this exact text (trailing newline):

```text
MIT License

Copyright (c) 2026 John Cavanaugh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Run check to verify it passes**

Run: `node check.js`

Expected: `ok`

- [ ] **Step 5: Commit**

Skip unless the human asked to commit.

```bash
git add LICENSE check.js
git commit -m "$(cat <<'EOF'
Add the MIT license file the marketplace requires.

EOF
)"
```

---

### Task 3: README

**Files:**
- Modify: `check.js` (README install/remove/preview assertions)
- Modify: `README.md` (replace entire file)

**Interfaces:**
- Consumes: plugin id `io.github.cavanaug.vmware-workstation`; action names from `Model.js` (`hardTooltip` / `guestWord` / `slotsEnabled`)
- Produces: user README with install URL `https://github.com/cavanaug/omarchy-vmware-workstation.git` and matching remove command

- [ ] **Step 1: Write the failing checks**

Immediately after the LICENSE assertions in `check.js`, add:

```javascript
var readme = fs.readFileSync("./README.md", "utf8")
eq("README install git url", readme.indexOf("omarchy plugin add https://github.com/cavanaug/omarchy-vmware-workstation.git --enable") !== -1, true)
eq("README update command", readme.indexOf("omarchy plugin update io.github.cavanaug.vmware-workstation") !== -1, true)
eq("README remove command", readme.indexOf("omarchy plugin remove io.github.cavanaug.vmware-workstation") !== -1, true)
eq("README shows preview.png", readme.indexOf("preview.png") !== -1, true)
eq("README has no wip symlink", readme.indexOf("wip_other") === -1, true)
```

Do not assert `preview.png` exists on disk in this task.

- [ ] **Step 2: Run check to verify it fails**

Run: `node check.js`

Expected: FAIL `README install git url` (current README is the 13-line symlink note). Exit 1.

- [ ] **Step 3: Replace README.md**

Write `README.md` with this exact content:

```markdown
# VMware Workstation

Lists the Workstation library in the Omarchy bar and runs power/guest actions through `vmrun`.

![VMware Workstation panel](preview.png)

## Install

Plugins run as unsandboxed code inside `omarchy-shell`. Only add repos you trust.

```sh
omarchy plugin add https://github.com/cavanaug/omarchy-vmware-workstation.git --enable
```

## Requirements

- [Omarchy](https://omarchy.org/) Quattro with the shell plugin CLI
- VMware Workstation so `vmrun` is on `PATH`
- Library entries in `~/.vmware/inventory.vmls` (this plugin does not scan `~/vmware/`)

## What it does

A Workstation mark on the bar. Click it for the panel: how many VMs are running, **Open** to launch Workstation, and one row per library VM.

Unavailable actions stay visible and dimmed.

| Group | Action | When enabled |
| --- | --- | --- |
| Hypervisor | PowerOff | running, suspended |
| Hypervisor | Suspend | running |
| Hypervisor | Resume | off, suspended (starts a powered-off VM) |
| Guest | Shutdown | running |
| Guest | Sleep | running |
| Guest | Restart | running |

Guest actions stay enabled whenever the VM is running. The plugin does not probe VMware Tools; if Tools is missing the action fails and the panel shows the error.

## Settings

Configure the widget in Omarchy bar settings.

| Setting | Default | |
| --- | --- | --- |
| Bar icon | branded | `branded` (color Workstation mark) or `themed` (mono, tinted to the bar) |
| Refresh interval (seconds) | 30 | 5–3600, step 5 |

## Update

```sh
omarchy plugin update io.github.cavanaug.vmware-workstation
```

## Remove

```sh
omarchy plugin remove io.github.cavanaug.vmware-workstation
```

Removal deletes the plugin checkout (or unlinks a symlink) and the `shell.json` entry. It does not delete VMs, `.vmx` files, or `~/.vmware/inventory.vmls`.

## Troubleshooting

- **`vmrun is not installed or not on PATH.`** The icon still shows. Open still works if Workstation is installed. The list is empty.
- **Empty panel, no error.** Inventory is missing or has no VMs.
- **All six actions dimmed.** The `.vmx` path in inventory is missing on disk.
- **Action error.** One line under the list. The next successful poll or action clears it.

Bind or script the panel with:

```sh
omarchy-shell io.github.cavanaug.vmware-workstation toggle
```

Also: `open`, `close`, `refresh`.

## Development

```sh
node check.js
omarchy plugin validate .
```

## License

MIT. See [LICENSE](LICENSE).

Not affiliated with, sponsored by, or endorsed by Broadcom or VMware.
```

- [ ] **Step 4: Run check to verify it passes**

Run: `node check.js`

Expected: `ok`

- [ ] **Step 5: Commit**

Skip unless the human asked to commit.

```bash
git add README.md check.js
git commit -m "$(cat <<'EOF'
Replace the dev README with user install and remove docs.

EOF
)"
```

---

### Task 4: Local id migration

**Files:**
- Modify: `~/.config/omarchy/shell.json` (bar layout entry id only)
- Rename: `~/.config/omarchy/plugins/cavanaug.vmware` → `~/.config/omarchy/plugins/io.github.cavanaug.vmware-workstation`

**Interfaces:**
- Consumes: Task 1 plugin id; existing symlink target `~/wip_other/src_cavanaug/omarchy-vmware-workstation`
- Produces: shell loads `io.github.cavanaug.vmware-workstation` from the renamed symlink; `icon_style` remains `themed`; widget stays in **center**

- [ ] **Step 1: Confirm the current symlink**

Run:

```sh
ls -l ~/.config/omarchy/plugins/cavanaug.vmware
readlink -f ~/.config/omarchy/plugins/cavanaug.vmware
```

Expected: symlink whose resolved path is `/home/cavanaug/wip_other/src_cavanaug/omarchy-vmware-workstation`. If it is not a symlink to this repo, stop.

- [ ] **Step 2: Rename the plugin directory**

```sh
mv ~/.config/omarchy/plugins/cavanaug.vmware ~/.config/omarchy/plugins/io.github.cavanaug.vmware-workstation
ls -l ~/.config/omarchy/plugins/io.github.cavanaug.vmware-workstation
```

Expected: same symlink target as before, new name.

- [ ] **Step 3: Update shell.json id**

Run this exact script (does not move the widget out of center, does not change `icon_style`):

```sh
python3 <<'PY'
import json
from pathlib import Path
p = Path.home() / ".config/omarchy/shell.json"
data = json.loads(p.read_text())
old, new = "cavanaug.vmware", "io.github.cavanaug.vmware-workstation"
n = 0
for section, widgets in data["bar"]["layout"].items():
    for w in widgets:
        if w.get("id") == old:
            w["id"] = new
            n += 1
            print("updated", section, "icon_style=", w.get("icon_style"))
if n != 1:
    raise SystemExit(f"expected exactly 1 layout entry, found {n}")
p.write_text(json.dumps(data, indent=2) + "\n")
PY
```

Expected stdout: `updated center icon_style= themed`

- [ ] **Step 4: Restart the shell and confirm**

Run: `omarchy restart shell`

Wait until the bar is back. Confirm:

- The Workstation mark is still on the **center** of the bar (themed / mono).
- `omarchy plugin list` shows `io.github.cavanaug.vmware-workstation` enabled.
- Clicking the icon still opens the panel.

If the widget vanished, the id or symlink is wrong — do not continue to Task 5.

- [ ] **Step 5: Commit**

Nothing in the git repo changed. Skip.

---

### Task 5: Branded preview.png

**Files:**
- Modify: `~/.config/omarchy/shell.json` (`icon_style` branded, then restore `themed`)
- Create: `preview.png`
- Modify: `check.js` (`preview.png exists` assertion)

**Interfaces:**
- Consumes: Task 4 migrated id; IPC `omarchy-shell io.github.cavanaug.vmware-workstation toggle`
- Produces: root `preview.png` showing the branded bar icon and open panel; bar left at `icon_style: themed`

- [ ] **Step 1: Write the failing check**

Immediately after the README assertions in `check.js`, add:

```javascript
eq("preview.png exists", fs.existsSync("./preview.png"), true)
```

- [ ] **Step 2: Run check to verify it fails**

Run: `node check.js`

Expected: FAIL `preview.png exists`. Exit 1.

- [ ] **Step 3: Switch the bar icon to branded and restart**

```sh
python3 <<'PY'
import json
from pathlib import Path
p = Path.home() / ".config/omarchy/shell.json"
data = json.loads(p.read_text())
pid = "io.github.cavanaug.vmware-workstation"
n = 0
for widgets in data["bar"]["layout"].values():
    for w in widgets:
        if w.get("id") == pid:
            w["icon_style"] = "branded"
            n += 1
if n != 1:
    raise SystemExit(f"expected 1 entry, found {n}")
p.write_text(json.dumps(data, indent=2) + "\n")
print("icon_style=branded")
PY
omarchy restart shell
```

Wait until the bar shows the **color** Workstation mark.

- [ ] **Step 4: Open the panel and capture**

From the repo root `/home/cavanaug/wip_other/src_cavanaug/omarchy-vmware-workstation`:

```sh
omarchy-shell io.github.cavanaug.vmware-workstation toggle
sleep 1
grim -g "$(slurp)" preview.png
```

Drag the region so it includes the branded bar icon and the open panel (hero, running count, at least one VM row, action buttons). One file only. No GIF.

If `slurp` is unavailable, capture the focused monitor instead:

```sh
mon=$(hyprctl -j monitors | jq -r '.[] | select(.focused==true) | .name')
grim -o "$mon" preview.png
```

Confirm `preview.png` is a non-empty PNG:

```sh
file preview.png
identify preview.png || true
```

- [ ] **Step 5: Restore themed and restart**

```sh
python3 <<'PY'
import json
from pathlib import Path
p = Path.home() / ".config/omarchy/shell.json"
data = json.loads(p.read_text())
pid = "io.github.cavanaug.vmware-workstation"
n = 0
for widgets in data["bar"]["layout"].values():
    for w in widgets:
        if w.get("id") == pid:
            w["icon_style"] = "themed"
            n += 1
if n != 1:
    raise SystemExit(f"expected 1 entry, found {n}")
p.write_text(json.dumps(data, indent=2) + "\n")
print("icon_style=themed")
PY
omarchy restart shell
```

Confirm the bar icon is mono/themed again.

- [ ] **Step 6: Run check and validate**

Run: `node check.js`

Expected: `ok`

Run: `omarchy plugin validate /home/cavanaug/wip_other/src_cavanaug/omarchy-vmware-workstation`

Expected: success.

- [ ] **Step 7: Commit**

Skip unless the human asked to commit.

```bash
git add preview.png check.js
git commit -m "$(cat <<'EOF'
Add the marketplace preview still of the branded panel.

EOF
)"
```

---

## Spec coverage

| Spec section | Task |
|---|---|
| Plugin id `io.github.cavanaug.vmware-workstation` | 1 |
| Local symlink + shell.json migration, keep themed | 4 |
| Widget still loads | 4 |
| LICENSE MIT John Cavanaugh 2026 | 2 |
| README outline (install, requirements, actions from Model.js, settings, update/remove, troubleshooting, IPC, development, disclaimer) | 3 |
| preview.png branded then restore themed | 5 |
| `node check.js` / `omarchy plugin validate` | 1, 5 |
| No GitHub remote / no marketplace issue | Global Constraints |
| No docs/superpowers rewrite, no behavior change | Global Constraints |
| GitHub About + listing metadata recorded only | Not this plan (spec: later) |
