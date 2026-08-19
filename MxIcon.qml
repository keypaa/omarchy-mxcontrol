import QtQuick
import qs.Commons

// Compact MX Master silhouette: body, MagSpeed wheel, thumb scoop.
Item {
  id: root

  property real iconSize: Style.font.icon
  property color color: Color.foreground
  property color cutoutColor: Color.background
  property bool lowBattery: false
  property color badgeColor: Color.urgent

  width: iconSize
  height: iconSize
  implicitWidth: iconSize
  implicitHeight: iconSize

  readonly property real bodyW: iconSize * 0.62
  readonly property real bodyH: iconSize * 0.86

  Rectangle {
    id: body
    width: root.bodyW
    height: root.bodyH
    radius: width * 0.46
    color: root.color
    anchors.horizontalCenter: parent.horizontalCenter
    anchors.verticalCenter: parent.verticalCenter
    anchors.horizontalCenterOffset: root.iconSize * 0.04
  }

  Rectangle {
    width: body.width * 0.16
    height: body.height * 0.28
    radius: width / 2
    color: root.cutoutColor
    opacity: 0.92
    anchors.horizontalCenter: body.horizontalCenter
    anchors.top: body.top
    anchors.topMargin: body.height * 0.16
  }

  Rectangle {
    width: body.width * 0.34
    height: body.height * 0.42
    radius: width * 0.5
    color: root.color
    opacity: 0.55
    anchors.right: body.left
    anchors.rightMargin: -body.width * 0.18
    anchors.verticalCenter: body.verticalCenter
    anchors.verticalCenterOffset: body.height * 0.06
  }

  Rectangle {
    visible: root.lowBattery
    width: Math.max(7, root.iconSize * 0.42)
    height: width
    radius: width / 2
    color: root.badgeColor
    anchors.right: parent.right
    anchors.bottom: parent.bottom
    border.width: Math.max(1, Style.normalBorderWidth)
    border.color: root.cutoutColor

    Text {
      anchors.centerIn: parent
      text: "!"
      color: root.cutoutColor
      font.family: Style.font.family
      font.pixelSize: Math.max(6, parent.height * 0.72)
      font.bold: true
    }
  }
}
