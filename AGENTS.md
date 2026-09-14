# AGENTS.md

Quickshell plugin for the Omarchy shell: a bar widget + panel that lists VMware
Workstation library VMs and runs `vmrun` power/guest actions.

## Layout

- `manifest.json` — plugin id, entry points, bar-widget settings schema
- `Panel.qml` — bar icon + panel UI (entry point `barWidget`)
- `Service.qml` — polling and process management (`vmrun`, inventory, `.vmss` probe)
- `Model.js` — pure logic: parsing, state, commands, shell-quote helpers
- `check.js` — behavioral spec (plain Node, no framework)
- `assets/` — icons

## Validate before finishing any change

```sh
node check.js
omarchy plugin validate .
```

`check.js` is the spec — when changing behavior, update the `eq(...)` assertions
alongside the code. There is no linter or typecheck for this repo.

## Activating changes (IMPORTANT)

The repo is symlinked into the shell's plugin directory:

```
~/.config/omarchy/plugins/io.github.cavanaug.vmware-workstation -> <this repo>
```

Edits are therefore live immediately. After making changes, activate them with:

1. **Saved files hot-reload automatically.** Saving any file under
   `~/.config/omarchy/plugins/` (including through the symlink) reloads plugin
   code. Small QML tweaks usually appear on the next bar/panel interaction.
2. **If a change fails to apply**, force a rescan:
   ```sh
   omarchy-shell shell rescanPlugins
   ```
3. **For a guaranteed clean reload, restart the shell:**
   ```sh
   omarchy restart shell
   ```

Always finish with `omarchy restart shell` when a change touches `manifest.json`,
settings schema/defaults, assets, or anything that did not appear after a save —
these are only picked up on a full shell restart.

## Verifying a change

```sh
omarchy-shell io.github.cavanaug.vmware-workstation toggle   # open/close the panel
omarchy-shell io.github.cavanaug.vmware-workstation refresh  # force a poll
omarchy-shell io.github.cavanaug.vmware-workstation status   # dump VM rows + errors
```

Also `open`, `close`, `show`, `hide`. Right-click the bar icon forces a refresh.

## Conventions

- QML/JS only; no build step. Keep `Model.js` pure and covered by `check.js`.
- All UI text that can contain VM names or `vmrun` output must use
  `textFormat: Text.PlainText`.
- Shell-facing process calls use argv arrays; anything built as a shell string
  must go through `Model.shellQuote`.
- Secret material on a command line (`vmrun -vp`) is allowed only through the
  opt-in `keyringPassword` setting (default off; see README Security notes).
  Never add another path that puts secrets in argv — vmrun has no other
  interface, which is exactly why the trade-off must stay explicit.
