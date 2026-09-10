# omarchy-vmware-workstation

Omarchy bar plugin for VMware Workstation (plugin id `cavanaug.vmware`). Lists the library and runs power/guest actions via `vmrun`.

Installed as a symlink:

```text
~/.config/omarchy/plugins/cavanaug.vmware → ~/wip_other/src_cavanaug/omarchy-vmware-workstation
```

Validate with `omarchy plugin validate ~/wip_other/src_cavanaug/omarchy-vmware-workstation`.
The CLI rejects the symlink install path.
Self-check: `node check.js`.
