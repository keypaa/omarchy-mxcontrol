# MX Control

An [Omarchy](https://omarchy.org/) 4 / Quattro bar plugin that does the job of Logi Options+ for Logitech MX mice and keyboards.

It watches Bluetooth, USB-C wired, Logitech Bolt, Unifying, Nano, and Lightspeed receivers, and picks up adapters when you plug them in.

Click the mouse icon in the bar to open a settings panel:

- Battery and connection (Bluetooth, USB, Bolt, Unifying, Lightspeed)
- Every MX device Solaar can see, not only the one currently on Bluetooth
- Pointer sensitivity (DPI)
- SmartShift (MagSpeed ratchet / free-spin)
- Scroll and thumb-wheel invert
- Easy Switch host channels
- Button remapping (whatever the device exposes)
- Keyboard extras such as Fn swap and backlight when you select MX Keys

The plugin talks HID++ through [Solaar](https://github.com/pwr-Solaar/Solaar). It does not start a second Quickshell process.

## Install

```sh
omarchy plugin add https://github.com/zachwilke/omarchy-mxcontrol.git --enable
omarchy pkg add solaar
```

After Solaar is installed, reconnect the mouse (or toggle its Bluetooth channel) so the hidraw udev rules apply. Until then the panel will show the device name but cannot write settings.

Move the widget if you want it somewhere else:

```sh
omarchy bar move io.github.zachwilke.mx --section right
```

## Usage

- Left click the bar icon to open or close the panel
- Right click refreshes device state
- Escape closes the panel
- `j` / `k` move the panel cursor; Enter activates the focused control
- `r` refreshes

```sh
omarchy-shell shell summon io.github.zachwilke.mx '{}'
omarchy-shell shell hide io.github.zachwilke.mx
```

## Configure

`refreshIntervalSec` and `selectedDevice` live on the bar layout entry in `~/.config/omarchy/shell.json`.

```sh
omarchy bar move io.github.zachwilke.mx --section right
```

## Remove

```sh
omarchy plugin remove io.github.zachwilke.mx
```

Solaar is a shared system package and is not removed with the plugin.

## Develop

```sh
PLUGIN_ID="io.github.zachwilke.mx"
PLUGIN_DIR="$HOME/.config/omarchy/plugins/$PLUGIN_ID"
omarchy plugin validate .
qmllint -I "$OMARCHY_PATH/shell" BarWidget.qml Panel.qml Service.qml MxIcon.qml
python3 mxctl.py status
```

Copy or clone this repo into `~/.config/omarchy/plugins/io.github.zachwilke.mx/` to load it. Saved QML reloads automatically; `omarchy-shell shell rescanPlugins` forces discovery.

## Privileges

The helper only needs user access to the Logitech hidraw node. Solaar’s udev rules grant that. The plugin never runs as root. The optional “Reload udev” button opens a terminal so you can enter your password for `udevadm`.

## License

GPL-2.0-or-later. The Python helper imports Solaar’s `logitech_receiver` library.
