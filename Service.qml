import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Bluetooth
import qs.Commons
import "Model.js" as Model

Item {
  id: root

  property var settings: ({})

  property bool installed: false
  property bool accessible: false
  property bool refreshing: false
  property bool daemonWanted: false
  property bool userPicked: false
  property bool hasHidppSnapshot: false
  property string statusText: "Checking…"
  property string message: ""
  property string lastError: ""
  property string actionStatus: ""
  property var devices: []
  property var adapters: []
  property var pendingWrites: []
  property string selectedId: ""

  readonly property string runtimeDir: {
    var dir = Quickshell.env("XDG_RUNTIME_DIR")
    return dir && dir !== "" ? dir + "/omarchy-mx" : "/tmp/omarchy-mx"
  }
  readonly property string statusPath: runtimeDir + "/status.json"
  readonly property string cmdPath: runtimeDir + "/cmd.json"
  readonly property int refreshIntervalSec: intSetting("refreshIntervalSec", 120, 10, 3600)
  readonly property string preferredId: String(setting("selectedDevice", selectedId || ""))
  readonly property bool busy: discoverProcess.running || cmdProcess.running
  readonly property string helperPath: resolvedHelper()
  readonly property var bluetoothDevices: Bluetooth.devices ? Bluetooth.devices.values : []
  readonly property var displayDevices: Model.mergeBluetoothBattery(devices, bluetoothDevices)
  readonly property var selectedDevice: Model.pickDefaultDevice(displayDevices, preferredId, userPicked)
  readonly property bool hidppReady: Model.isWritableDevice(selectedDevice)
  readonly property int batteryPercent: Model.batteryPercent(selectedDevice)
  readonly property bool batteryLow: Model.batteryLow(selectedDevice)
  readonly property bool online: !!(selectedDevice && selectedDevice.online !== false)
  readonly property bool hasDevice: !!selectedDevice

  function setting(name, fallback) {
    var value = settings ? settings[name] : undefined
    return value === undefined || value === null ? fallback : value
  }

  function intSetting(name, fallback, min, max) {
    var n = parseInt(String(setting(name, fallback)), 10)
    if (!isFinite(n)) n = fallback
    if (n < min) n = min
    if (n > max) n = max
    return n
  }

  function resolvedHelper() {
    var url = String(Qt.resolvedUrl("mxctl.py"))
    if (url.indexOf("file://") === 0) url = decodeURIComponent(url.substring(7))
    return url
  }

  function applyStatus(raw) {
    var parsed = Model.parseStatus(raw)
    var next = parsed.devices || []
    var nextHasHidpp = false
    for (var i = 0; i < next.length; i++) {
      if (Model.isWritableDevice(next[i])) nextHasHidpp = true
    }
    // A sysfs discover snapshot must not replace a live HID++ read.
    if (hasHidppSnapshot && !nextHasHidpp) return
    var merged = Model.applyPendingWrites(next, pendingWrites)
    next = merged.devices
    pendingWrites = merged.writes
    installed = parsed.installed === true
    accessible = parsed.accessible === true
    devices = next
    adapters = parsed.adapters || []
    hasHidppSnapshot = nextHasHidpp
    message = String(parsed.message || "")
    var picked = Model.pickDefaultDevice(next, preferredId, userPicked)
    if (picked && picked.id) selectedId = String(picked.id)
    lastError = parsed.ok ? String(parsed.lastError || "") : parsed.message
    statusText = !installed ? "Solaar not installed"
      : (!accessible ? "Waiting for device access"
      : (!hasDevice ? "No MX device" : (selectedDevice.name || "MX")))
  }

  function discover() {
    if (discoverProcess.running || helperPath === "") return
    refreshing = true
    discoverProcess.command = ["python3", helperPath, "discover"]
    discoverProcess.running = true
  }

  function ensureDaemon() {
    daemonWanted = true
  }

  function refresh() {
    if (daemonWanted) {
      if (daemon.running) writeCmd({ op: "refresh" })
      statusFile.reload()
      return
    }
    discover()
  }

  function selectDevice(id) {
    userPicked = true
    selectedId = String(id || "")
  }

  function setSetting(name, value, key) {
    if (!selectedDevice || selectedDevice.readonly) return
    ensureDaemon()
    var write = {
      device: String(selectedDevice.id),
      name: String(name),
      key: key === undefined || key === null ? "" : String(key),
      value: value,
      ts: Date.now()
    }
    var nextWrites = []
    for (var i = 0; i < pendingWrites.length; i++) {
      var existing = pendingWrites[i]
      if (existing.name === write.name && existing.device === write.device && String(existing.key || "") === write.key)
        continue
      nextWrites.push(existing)
    }
    nextWrites.push(write)
    pendingWrites = nextWrites
    devices = Model.patchDeviceSetting(devices, write.device, write.name, write.value, write.key)
    writeCmd({
      op: "set",
      device: write.device,
      setting: write.name,
      key: write.key,
      value: write.value
    })
  }

  function writeCmd(cmd) {
    if (cmdProcess.running) return
    var json = JSON.stringify(cmd)
    cmdProcess.command = ["bash", "-lc", "mkdir -p -- " + shellQuote(runtimeDir) + " && printf %s " + shellQuote(json) + " > " + shellQuote(cmdPath)]
    cmdProcess.running = true
  }

  function shellQuote(value) {
    return "'" + String(value || "").replace(/'/g, "'\\''") + "'"
  }

  function installSolaar() {
    Quickshell.execDetached(["omarchy-launch-tui", "omarchy", "pkg", "add", "solaar"])
    actionStatus = "Opening a terminal to install Solaar…"
    actionStatusTimer.restart()
  }

  function triggerUdev() {
    Quickshell.execDetached(["omarchy-launch-tui", "sudo", "bash", "-lc", "udevadm control --reload-rules && udevadm trigger"])
    actionStatus = "Reloading device permissions…"
    actionStatusTimer.restart()
  }

  Component.onCompleted: {
    mkdirProcess.running = true
    discover()
  }

  FileView {
    id: statusFile
    path: root.statusPath
    watchChanges: true
    printErrors: false
    onLoaded: root.applyStatus(text())
    onLoadFailed: if (!root.daemonWanted) root.discover()
    onFileChanged: reload()
  }

  Process {
    id: mkdirProcess
    running: false
    command: ["bash", "-lc", "mkdir -p -- " + root.shellQuote(root.runtimeDir)]
  }

  Timer {
    id: statusPoll
    interval: 400
    repeat: true
    running: root.daemonWanted && !root.hasHidppSnapshot
    onTriggered: statusFile.reload()
  }

  Process {
    id: daemon
    running: root.daemonWanted
    command: ["python3", root.helperPath, "serve"]
  }

  Process {
    id: discoverProcess
    running: false
    command: []
    stdout: StdioCollector {
      id: discoverStdout
      waitForEnd: true
      onStreamFinished: {
        root.refreshing = false
        if (text) root.applyStatus(text)
      }
    }
    onExited: root.refreshing = false
  }

  Process {
    id: cmdProcess
    running: false
    command: []
  }

  Timer {
    id: actionStatusTimer
    interval: 2800
    repeat: false
    onTriggered: root.actionStatus = ""
  }

  Timer {
    id: plugWatch
    interval: 3000
    repeat: true
    running: !root.daemonWanted
    onTriggered: root.discover()
  }
}
