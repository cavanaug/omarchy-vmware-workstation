import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "cavanaug.vmware"
  ipcTarget: "cavanaug.vmware"
  manageIpc: false

  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property color urgent: bar ? bar.urgent : Color.urgent
  readonly property color dim: Qt.darker(foreground, 1.55)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property bool themedIcon: String(setting("icon_style", "branded")) === "themed"
  readonly property url brandedIcon: Qt.resolvedUrl("assets/vmware-workstation.png")
  readonly property url themedIconSource: Qt.resolvedUrl("assets/mono/vmware-workstation.png")
  readonly property int rowHeight: Style.space(44)
  readonly property int visibleRows: Math.min(vmware.vms.length, 5)
  readonly property bool scrollable: vmware.vms.length > 5

  function openWorkstation() {
    Quickshell.execDetached(Model.openWorkstationCommand(gtkWhich.installed, hidpiWhich.installed))
  }

  function slotGlyph(slot) {
    if (slot === 1) return "󰐥"
    if (slot === 2) return "󰒲"
    if (slot === 3) return "󰜉"
    if (slot === 4) return "󰐊"
    if (slot === 5) return "󰓛"
    return "󰏤"
  }

  function slotTip(slot) {
    if (slot === 1) return "Power On / Resume"
    if (slot === 2) return "Power Off"
    if (slot === 3) return "Suspend"
    if (slot === 4) return "Shutdown (Guest)"
    if (slot === 5) return "Suspend (Guest)"
    return "Restart (Guest)"
  }

  function bulletColor(state) {
    if (state === "running") return Qt.tint(Color.popups.background, Qt.rgba(158 / 255, 206 / 255, 106 / 255, 0.55))
    if (state === "suspended") return Qt.tint(Color.popups.background, Qt.rgba(235 / 255, 146 / 255, 123 / 255, 0.45))
    return "transparent"
  }

  Service {
    id: vmware
    settings: root.settings
  }

  Process {
    id: gtkWhich
    running: true
    command: ["which", "gtk-launch"]
    property bool installed: false
    onExited: function (code) { gtkWhich.installed = code === 0 }
  }

  Process {
    id: hidpiWhich
    running: true
    command: ["test", "-f", (Quickshell.env("HOME") || "") + "/.local/bin/vmware-hidpi"]
    property bool installed: false
    onExited: function (code) { hidpiWhich.installed = code === 0 }
  }

  IpcHandler {
    target: root.ipcTarget
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.toggle() }
    function refresh(): string { vmware.refresh(); return "ok" }
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onOpenedChanged: if (opened) {
    if (panelFlick) panelFlick.contentY = 0
    vmware.refresh()
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: "VMware Workstation"
    iconComponent: Component {
      Item {
        MonoIcon {
          anchors.centerIn: parent
          width: Style.space(12)
          height: width
          source: root.themedIconSource
          tint: root.barForeground
          visible: root.themedIcon
        }
        Image {
          anchors.centerIn: parent
          width: Style.space(12)
          height: width
          source: root.brandedIcon
          sourceSize.width: 32
          sourceSize.height: 32
          fillMode: Image.PreserveAspectFit
          smooth: true
          visible: !root.themedIcon
        }
      }
    }
    onPressed: function (buttonCode) {
      if (buttonCode === Qt.RightButton) vmware.refresh()
      else root.toggle()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    contentWidth: panel.fittedContentWidth(Style.space(420))
    contentHeight: panel.fittedContentHeight(column.implicitHeight, Style.space(560))

    Flickable {
      id: panelFlick
      anchors.fill: parent
      contentWidth: width
      contentHeight: column.implicitHeight
      clip: true
      boundsBehavior: Flickable.StopAtBounds
      flickableDirection: Flickable.VerticalFlick
      interactive: contentHeight > height
      ScrollBar.vertical: ScrollBar {
        policy: root.scrollable ? ScrollBar.AsNeeded : ScrollBar.AlwaysOff
      }

      Column {
        id: column
        width: panelFlick.width - (root.scrollable ? Style.space(16) : 0)
        spacing: Style.space(12)

        PanelHero {
          id: hero
          width: parent.width
          title: "VMware Workstation"
          meta: "" + vmware.runningCount + " RUNNING"
          foreground: root.foreground
          fontFamily: root.fontFamily
          iconComponent: Component {
            Item {
              width: Style.font.display
              height: Style.font.display
              Image {
                anchors.fill: parent
                source: root.brandedIcon
                sourceSize.width: 48
                sourceSize.height: 48
                fillMode: Image.PreserveAspectFit
                smooth: true
              }
            }
          }
          trailingControl: Component {
            Button {
              iconText: "󰏌"
              text: "Open"
              tooltipText: "Open Workstation"
              foreground: hero.foreground
              fontFamily: hero.fontFamily
              onClicked: root.openWorkstation()
            }
          }
        }

        ListView {
          id: list
          width: parent.width
          height: root.visibleRows * root.rowHeight
          clip: true
          boundsBehavior: Flickable.StopAtBounds
          interactive: root.scrollable
          model: vmware.vms
          spacing: 0
          delegate: Item {
            width: list.width
            height: root.rowHeight
            readonly property var vm: modelData

            FontMetrics {
              id: nameMetrics
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
            }

            Row {
              anchors.fill: parent
              spacing: Style.space(10)

              Column {
                width: Math.round(nameMetrics.averageCharacterWidth * 22)
                anchors.verticalCenter: parent.verticalCenter
                spacing: Style.space(2)

                Text {
                  width: parent.width
                  textFormat: Text.PlainText
                  text: vm.name
                  color: root.foreground
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.body
                  elide: Text.ElideRight
                }

                Row {
                  spacing: Style.space(6)
                  Rectangle {
                    width: 7
                    height: 7
                    radius: 4
                    anchors.verticalCenter: parent.verticalCenter
                    color: (vm.state === "off" || vm.state === "missing") ? "transparent" : root.bulletColor(vm.state)
                    border.width: (vm.state === "off" || vm.state === "missing") ? 1 : 0
                    border.color: root.dim
                  }
                  Text {
                    textFormat: Text.PlainText
                    text: vm.state === "missing" ? "off" : vm.state
                    color: root.dim
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.bodySmall
                  }
                }
              }

              Row {
                spacing: Style.space(4)
                anchors.verticalCenter: parent.verticalCenter

                Repeater {
                  model: 3
                  VmActionButton {
                    required property int index
                    iconText: root.slotGlyph(index + 1)
                    tooltipText: root.slotTip(index + 1)
                    iconOffsetX: index === 1 ? -2 : 0
                    enabled: vm.enabled[index]
                    foreground: root.foreground
                    fontFamily: root.fontFamily
                    onClicked: vmware.runSlot(index + 1, vm.vmx)
                  }
                }

                Item { width: Style.space(8); height: 1 }

                Repeater {
                  model: 3
                  VmActionButton {
                    required property int index
                    iconText: root.slotGlyph(index + 4)
                    tooltipText: root.slotTip(index + 4)
                    enabled: vm.enabled[index + 3]
                    foreground: root.foreground
                    fontFamily: root.fontFamily
                    onClicked: vmware.runSlot(index + 4, vm.vmx)
                  }
                }
              }
            }
          }
        }

        Text {
          visible: vmware.lastError !== ""
          width: parent.width
          textFormat: Text.PlainText
          text: vmware.lastError
          color: root.urgent
          font.family: root.fontFamily
          font.pixelSize: Style.font.bodySmall
          wrapMode: Text.WordWrap
        }
      }
    }
  }
}
