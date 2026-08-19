import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

BarWidget {
  id: root
  moduleName: "io.github.zachwilke.mx"

  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false
  readonly property color barForeground: bar ? bar.barForeground : Color.foreground
  readonly property color iconColor: {
    if (!mx.hasDevice) return Qt.darker(barForeground, 1.55)
    if (mx.batteryLow) return bar && bar.urgent ? bar.urgent : Color.urgent
    return mx.online ? barForeground : Qt.darker(barForeground, 1.55)
  }

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function toggle() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function refresh() {
    mx.refresh()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    if ("mx" in target) target.mx = mx
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  Service {
    id: mx
    settings: root.settings
  }

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  IpcHandler {
    target: "io.github.zachwilke.mx"

    function refresh(): void { root.broadcast("refresh") }
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.toggle() }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: {
      if (!mx.hasDevice) return mx.installed ? "No MX device" : "MX Control — install Solaar"
      var name = Model.hidDisplayName(mx.selectedDevice, "MX")
      var link = Model.connectionLabel(mx.selectedDevice)
      var battery = mx.batteryPercent >= 0 ? (" · " + mx.batteryPercent + "%") : ""
      return name + (link ? (" · " + link) : "") + battery
    }
    iconComponent: Component {
      MxIcon {
        iconSize: Style.bar.iconCanvas
        color: root.iconColor
        cutoutColor: root.bar ? root.bar.background : Color.background
        lowBattery: mx.batteryLow
        badgeColor: root.bar && root.bar.urgent ? root.bar.urgent : Color.urgent
      }
    }
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.RightButton) root.refresh()
      else root.toggle()
    }
  }
}
