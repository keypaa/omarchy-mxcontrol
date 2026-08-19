# MX Control

**Logi Options+ for the [Omarchy](https://omarchy.org/) bar.**

A first-class Quattro plugin for Logitech MX mice and keyboards — MX Master, Anywhere, Vertical, Ergo, Lift, MX Keys, and the rest of the family — over Bluetooth, USB-C, Bolt, Unifying, Nano, and Lightspeed.

It lives inside the long-running `omarchy-shell` process. It never starts a second Quickshell instance.

<p align="center">
  <img src="preview.png" alt="MX Control panel on Omarchy: MX Master 3S over Bluetooth, 1000 DPI with 8K preset, SmartShift, invert scroll, and high-resolution scroll" width="420">
</p>

## Install

Review the code first. Plugins run unsandboxed as your user.

```sh
omarchy plugin add https://github.com/zachwilke/omarchy-mxcontrol.git
```

That clones the repo into `~/.config/omarchy/plugins/io.github.zachwilke.mx/` and leaves it **disabled**. Read the files, then:

```sh
omarchy plugin enable io.github.zachwilke.mx
omarchy pkg add solaar
```

Or do both in one step after you have reviewed the source:

```sh
omarchy plugin add https://github.com/zachwilke/omarchy-mxcontrol.git --enable
omarchy pkg add solaar
```

Solaar is optional until you want to change settings. Without it the bar still lists connected MX devices. After installing Solaar, reconnect the device (or toggle its Bluetooth channel / unplug and replug the receiver) so the hidraw udev rules apply.

Move the widget if you want it somewhere else:

```sh
omarchy bar move io.github.zachwilke.mx --section right
```

`omarchy plugin add` only clones files and toggles enabled state. It does not run install hooks, does not use sudo, and does not overwrite your Hyprland or Solaar config.

## Remove

```sh
omarchy plugin disable io.github.zachwilke.mx
omarchy plugin remove io.github.zachwilke.mx
```

Removal deletes the plugin checkout and takes the widget out of the bar. On unload the helper stops and clears `$XDG_RUNTIME_DIR/omarchy-mx/` (status, command, and lock files).

Left in place on purpose:

| Path | Why it stays |
| --- | --- |
| `solaar` package | Shared system package; other tools may use it |
| `~/.config/solaar/` | Your saved device profiles |
| Device onboard settings | DPI, SmartShift, remaps live on the hardware |

Nothing in `~/.config/hypr/` or the rest of `~/.config/omarchy/` is rewritten except the bar layout entry that `omarchy plugin remove` already owns.

## Usage

| Input | Action |
| --- | --- |
| Left click | Open or close the panel |
| Right click | Refresh discovery |
| Hover **i** | Explain that setting |
| Escape | Close the panel |
| `j` / `k` | Move the panel cursor |
| Enter | Activate the focused control |
| `r` | Refresh |

```sh
omarchy-shell shell summon io.github.zachwilke.mx '{}'
omarchy-shell shell hide io.github.zachwilke.mx
```

### What you can change

- Battery and connection (Bluetooth, USB, Bolt, Unifying, Lightspeed)
- Sensitivity in 50 DPI steps, including **8K** (8000 DPI)
- SmartShift (ratchet vs free-spin) and its threshold
- Scroll invert and high-resolution scroll
- Thumb-wheel invert
- Easy Switch hosts
- Button remaps the device exposes
- Keyboard extras such as Fn swap and backlight

## Configure

Settings live on the bar layout entry in `~/.config/omarchy/shell.json`. The plugin does not keep a separate config file.

| Key | Default | Meaning |
| --- | --- | --- |
| `refreshIntervalSec` | `120` | How often to rescan hidraw when the helper is idle |
| `selectedDevice` | `""` | Preferred device id; empty prefers the mouse |

## Dependencies

| Dependency | Required | Why |
| --- | --- | --- |
| Omarchy 4 / Quattro | Yes | Plugin host |
| Python 3 | Yes | Ships with Arch |
| [Solaar](https://github.com/pwr-Solaar/Solaar) | For writes | HID++ read/write via `logitech_receiver` |

Install Solaar with `omarchy pkg add solaar`. The panel can open that command in a terminal for you.

## Privileges

The helper talks to `/dev/hidraw*` as your user. Solaar’s udev rules grant that access. The plugin never launches a second Quickshell process and never writes system files on install.

The optional **Reload udev** button opens a terminal so *you* can enter a password for `udevadm`. That is the only privileged path, and it is never run automatically.

## Develop

```sh
omarchy plugin validate .
python3 mxctl.py discover
python3 mxctl.py cleanup
```

Saved files under `~/.config/omarchy/plugins/io.github.zachwilke.mx/` reload automatically. If a change looks stale:

```sh
omarchy-shell shell rescanPlugins
omarchy restart shell
```

## License

[GPL-2.0-or-later](LICENSE). Copyright © 2026 Zach Wilke.

The Python helper imports Solaar’s `logitech_receiver` library, which is also GPL. See [Solaar](https://github.com/pwr-Solaar/Solaar).
