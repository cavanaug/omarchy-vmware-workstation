# VMware Workstation bar plugin

**Date:** 2026-09-09
**Status:** Approved design
**Location:** `~/wip_other/src_cavanaug/omarchy-vmware-workstation` (symlinked at `~/.config/omarchy/plugins/cavanaug.vmware`)

## Goal

Replace the invisible `vmware-tray` on Omarchy with a bar widget and popup that lists the Workstation library and runs power/guest actions through `vmrun`. Follow the Tailscale plugin shape. Do not edit `/usr/share/omarchy/`.

## Out of scope

- Per-VM Open / console attach (hero **Open** only)
- Reset (hard)
- D-Bus or in-process VIX
- Scanning `~/vmware/` for `.vmx` files
- A separate `kinds: ["service"]` / `keepLoaded` plugin
- `vmrun start … nogui` (may be revisited later)

## Architecture

Tailscale-shaped user plugin:

- `kinds: ["bar-widget"]`
- `id`: `cavanaug.vmware`
- `entryPoints.barWidget`: `Panel.qml`
- `Panel.qml` instantiates `Service.qml` (same pattern as `omarchy.tailscale`)
- Validate with `omarchy plugin validate ~/.config/omarchy/plugins/cavanaug.vmware`

| File | Role |
|---|---|
| `manifest.json` | Plugin id, bar-widget schema |
| `Service.qml` | Inventory, `vmrun` poll, actions |
| `Panel.qml` | Bar icon + popup |
| `Model.js` | Pure helpers (parse inventory, classify state, slot enable matrix) |
| `assets/vmware-workstation.png` | Official color mark (copy of `/usr/share/icons/hicolor/256x256/apps/vmware-workstation.png`) |
| `assets/mono/vmware-workstation.png` | Lighter monotone of that PNG (opaque pixels eroded `Disk:8`, then colorized white) |

Settings on the bar-widget schema:

| Key | Type | Default | Notes |
|---|---|---|---|
| `icon_style` | string enum `branded` \| `themed` | `branded` | Bar icon only |
| `refreshIntervalSec` | integer 5–3600 step 5 | `30` | Same bounds as Tailscale |

## UI

Theme tokens: `Color.popups`, `Color.tooltip`, `Style`. Font: JetBrains Mono Nerd Font (`Style.font.family`). Corner radius follows the shell (`Style.cornerRadius`).

### Bar

- 12px (`Style.space(12)`) Workstation mark.
- **branded:** stock color PNG.
- **themed:** lighter mono PNG, tinted with bar foreground (`MonoIcon` / mask), Syncthing-style.
- `BarIconButton` (same as Tailscale). Click opens the panel. No extra bar text.

### Panel

`PanelHero`:

- Leading icon: official **color** PNG at `Style.font.display` (24px), full weight. Not themed. Not the lighter bar asset.
- Title: `VMware Workstation` (bold, `Style.font.title`).
- Meta: `{N} RUNNING` in uppercase (`N` = count of running VMs; `0 RUNNING` when none).
- Trailing control: `Open` + glyph `󰏌`. Tooltip: `Open Workstation`. Click launches Workstation with no VM action: `gtk-launch vmware-workstation` so the user desktop file (`~/.local/share/applications/vmware-workstation.desktop` → HiDPI wrapper) is used. If `gtk-launch` is missing, `execDetached` `~/.local/bin/vmware-hidpi` if that exists, else `/usr/bin/vmware`.

No per-VM Open.

### List

- One row per inventory VM, inventory order.
- Default viewport: 5 rows. More VMs → scroll, with extra inset before the scrollbar (`padding` + `scrollbar-gutter` equivalent). Fewer VMs → panel shrinks; do not keep a 5-row empty hole.
- Name column width: **22ch** at `Style.font.body`, ellipsis (`Text.ElideRight`).
- Status under the name: muted word `running` / `suspended` / `off` with a 7px bullet. Running bullet: `Color` green `#9ece6a` mixed ~55% into popup background. Suspended: orange `#eb927b` mixed ~45% into background. Off: hollow circle, muted border. No color on action glyphs.

### Row actions

Six fixed 22px `PanelActionButton`s (`Style.space(22)`). Gap equal to one extra 8px column between slots 3 and 4. Unavailable slots stay visible and **dimmed** (`enabled: false`), not hidden.

Tooltips: `PanelActionButton.tooltipText` → `PanelToolTip` (400ms delay, theme tooltip colors). No legend. No native `title`.

Glyph `󰒲` is optically shifted **2px left, 0px down** (`horizontalCenterOffset: -2` or equivalent). Other glyphs stay geometrically centered.

| Slot | Action | Glyph | Tooltip |
|---|---|---|---|
| 1 | Power On / Resume | 󰐥 | Power On / Resume |
| 2 | Power Off (hard) | 󰒲 | Power Off |
| 3 | Suspend (hard) | 󰜉 | Suspend |
| 4 | Shutdown (Guest) | 󰐊 | Shutdown (Guest) |
| 5 | Suspend (Guest) | 󰓛 | Suspend (Guest) |
| 6 | Restart (Guest) | 󰏤 | Restart (Guest) |

Enable matrix (dim the rest):

| State | Enabled slots |
|---|---|
| running | 2, 3, 4, 5, 6 |
| suspended | 1, 2 |
| off | 1 |

## Data

`vmrun -T ws` only. One `Process` at a time (Tailscale). Poll every `refreshIntervalSec`. Refresh again when an action’s process exits.

### Inventory

Parse `~/.vmware/inventory.vmls`. For each `vmlistN.config` / `vmlistN.DisplayName` pair, emit `{ vmx, name }`. Skip entries whose config path is empty. Do not walk `~/vmware/`.

### Power state

For each VM, in this order:

1. **running** — `vmx` path appears in `vmrun -T ws list` output (skip the `Total running VMs:` header line; compare realpaths).
2. **suspended** — not running, and a `.vmss` file exists next to the `.vmx` (same basename).
3. **off** — otherwise.

### Actions

Working directory does not matter; pass the absolute `.vmx` path.

| Slot | Command |
|---|---|
| Power On / Resume | `vmrun -T ws start <vmx> gui` |
| Power Off | `vmrun -T ws stop <vmx> hard` |
| Suspend | `vmrun -T ws suspend <vmx> hard` |
| Shutdown (Guest) | `vmrun -T ws stop <vmx> soft` |
| Suspend (Guest) | `vmrun -T ws suspend <vmx> soft` |
| Restart (Guest) | `vmrun -T ws reset <vmx> soft` |

Guest soft ops stay enabled whenever the matrix says so. Do not probe VMware Tools. If `vmrun` fails, keep the slot as-is and set `lastError`.

## Empty and errors

- **`vmrun` missing:** bar icon still shows. Hero and Open still work if the desktop file / binary exists. List empty. `lastError`: `vmrun is not installed or not on PATH.`
- **Inventory missing or empty:** list empty, panel shrinks. No error string unless `vmrun` is also missing.
- **Action failure:** one short `lastError` line under the list (Tailscale-style). No dialog, no notification, no retry loop.
- **`.vmx` missing, still in inventory:** show `DisplayName`, dim all six slots. No `lastError` for that; dimming is the signal.

Clear `lastError` on the next successful poll or successful action.

## Testing

- `omarchy plugin validate ~/.config/omarchy/plugins/cavanaug.vmware`
- `Model.js` self-check (no framework): inventory parse fixture, classify running/suspended/off from a fake `vmrun list` + `.vmss` presence, enable-matrix for the three states. Fail the process on mismatch.

No live `vmrun` in the check. No extra QML test harness.
