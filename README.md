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
