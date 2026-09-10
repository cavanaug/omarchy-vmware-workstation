# GitHub and marketplace publication docs

**Date:** 2026-09-10
**Status:** Draft, awaiting review
**Location:** `~/wip_other/src_cavanaug/omarchy-vmware-workstation`

## Goal

Make this plugin look like a first-class Omarchy community plugin: user documentation, MIT license, marketplace preview still, and the marketplace-preferred plugin id. Stop short of creating the GitHub remote, pushing, or filing the omarchyplugins.com listing.

Quality bar: the five OmaPicks champions surveyed on 2026-09-09 (Notification Center, OmaConnect, Exposé, Vitals, Hardware Tooltip) plus [marketplace SUBMISSION.md](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/blob/main/SUBMISSION.md).

## Out of scope

- Creating `cavanaug/omarchy-vmware-workstation` on GitHub, pushing, or tagging a release
- Opening the omarchyplugins.com submission issue
- Widget behavior, settings schema keys, QML layout, or icon assets
- Deleting or rewriting `docs/superpowers/`
- CONTRIBUTING, badges, extra docs site, GIF demo
- Changing the human display name (`VMware Workstation`)

## Plugin identity

Marketplace prefers `io.github.user.plugin-name` and uses a hyphen in the last segment. Champions are mixed; this repo follows the marketplace form.

| Field | Value |
|---|---|
| Plugin id | `io.github.cavanaug.vmware-workstation` |
| Display name | `VMware Workstation` (unchanged) |
| Repo name (eventual) | `omarchy-vmware-workstation` |
| Shorthand in prose | `vmware-workstation` |

Replace every runtime id:

- `manifest.json` `"id"`
- `Panel.qml` `moduleName` and `ipcTarget`

Leave historical ids in already-written `docs/superpowers/plans/` and the 2026-09-09 design spec. Those are implementation history, not the public contract.

### Local install migration (this machine)

The plugin is already enabled as `cavanaug.vmware` with `icon_style: themed`.

1. Rename the symlink `~/.config/omarchy/plugins/cavanaug.vmware` → `~/.config/omarchy/plugins/io.github.cavanaug.vmware-workstation` (same target: this repo).
2. In `~/.config/omarchy/shell.json`, change the bar layout entry `id` from `cavanaug.vmware` to `io.github.cavanaug.vmware-workstation`. Keep `icon_style: themed` except during the screenshot step.
3. Run `omarchy restart shell`. Confirm the widget still appears on the right.

Do not edit `/usr/share/omarchy/`.

## Public tree

Visitors and the marketplace see the repository root. Add:

| File | Role |
|---|---|
| `README.md` | User docs (replace the current 13-line dev note) |
| `LICENSE` | MIT, Copyright (c) 2026 John Cavanaugh |
| `preview.png` | Marketplace card + README hero |

Existing QML, JS, `manifest.json` (id only), `assets/`, and `check.js` stay. No new documentation site.

## README

Champion order. No symlink-from-wip, no validate-the-checkout as the primary install path.

1. **Title** — VMware Workstation
2. **One sentence** — Lists the Workstation library in the Omarchy bar and runs power/guest actions through `vmrun`.
3. **Hero** — `![VMware Workstation panel](preview.png)`
4. **Install**

   ```sh
   omarchy plugin add https://github.com/cavanaug/omarchy-vmware-workstation.git --enable
   ```

   The URL is the intended public remote. Do not create that remote in this pass. One sentence that plugins run unsandboxed inside `omarchy-shell`.

5. **Requirements**
   - Omarchy Quattro with the shell plugin CLI
   - VMware Workstation so `vmrun` is on `PATH`
   - Library from `~/.vmware/inventory.vmls` (the plugin does not scan `~/vmware/`)

6. **What it does**
   - Bar icon (branded color mark or themed mono)
   - Click opens the panel: running count, **Open** launches Workstation via the desktop file
   - One row per inventory VM; three hypervisor actions then three guest actions; unavailable slots stay visible and dimmed

   | Group | Tooltip | When enabled |
   |---|---|---|
   | Hypervisor | PowerOff | running, suspended |
   | Hypervisor | Suspend | running |
   | Hypervisor | Resume | off, suspended (starts a powered-off VM) |
   | Guest | Shutdown | running |
   | Guest | Sleep | running |
   | Guest | Restart | running |

   Tooltips and enablement match `Model.js` (`hardTooltip` / `guestWord` / `slotsEnabled`), not the 2026-09-09 slot numbering. Guest actions stay enabled whenever the VM is running. The plugin does not probe VMware Tools; a missing Tools install fails the action and shows `lastError`.

7. **Settings** (Omarchy bar widget settings)

   | Setting | Default | |
   |---|---|---|
   | Bar icon | branded | `branded` (color Workstation mark) or `themed` (mono, tinted to the bar) |
   | Refresh interval (seconds) | 30 | 5–3600, step 5 |

8. **Update / remove**

   ```sh
   omarchy plugin update io.github.cavanaug.vmware-workstation
   omarchy plugin remove io.github.cavanaug.vmware-workstation
   ```

   Removal deletes the plugin checkout (or unlinks a symlink) and the `shell.json` entry. It does not delete VMs, `.vmx` files, or `~/.vmware/inventory.vmls`.

9. **Troubleshooting**
   - `vmrun is not installed or not on PATH.` — icon still shows; Open still works if Workstation is installed; list is empty
   - Empty panel, no error — inventory missing or empty
   - All six slots dimmed — `.vmx` path in inventory is missing on disk
   - Action error — one line under the list; next successful poll or action clears it

10. **Development** (two lines) — `node check.js`; `omarchy plugin validate .`

11. **License** — MIT. Not affiliated with, sponsored by, or endorsed by Broadcom or VMware.

Optional IPC, only if it stays one short paragraph: `omarchy-shell io.github.cavanaug.vmware-workstation toggle` (also `open`, `close`, `refresh`).

## Screenshots

One still: `preview.png` at the repository root.

1. Set the bar widget `icon_style` to `branded` in `~/.config/omarchy/shell.json` (currently `themed`).
2. Run `omarchy restart shell` so the color mark is on the bar.
3. Open the panel (`omarchy-shell io.github.cavanaug.vmware-workstation toggle`) with a representative VM list (at least one VM; running count visible; action row visible).
4. Capture with `grim` (or the Omarchy screenshot tool) into `preview.png` at the repo root. Include the open panel and enough of the bar to show the branded icon. One file only; retake if the icon is cropped out. No `docs/bar.png`. No GIF.
5. Restore `icon_style` to `themed` and run `omarchy restart shell` again.

`preview.png` is the marketplace preview (png/jpg/webp/avif at repo root) and the README hero. No manual resize beyond a normal screenshot.

## GitHub About (when the remote is created later)

Not done in this pass. Recorded so the README URL and a later `gh repo create` stay aligned:

| Field | Value |
|---|---|
| Owner/name | `cavanaug/omarchy-vmware-workstation` |
| Description | Workstation library and power/guest controls in the Omarchy bar. |
| Topics | `omarchy`, `omarchy-plugin`, `vmware`, `quickshell` |
| License | MIT |

## Marketplace listing (when submitted later)

Not done in this pass.

| Field | Value |
|---|---|
| Issue title | `[Plugin]: VMware Workstation` |
| Category | `System` |
| Tags | `bar`, `system`, `quickshell` |

## Success

- Root README has install **and** remove commands using the new id
- Root `LICENSE` exists
- Root `preview.png` exists and shows the branded bar icon and open panel
- `omarchy plugin validate .` still passes
- `node check.js` still passes
- After local id migration, the widget still loads on this machine with `icon_style: themed`
- No GitHub remote, no marketplace issue
