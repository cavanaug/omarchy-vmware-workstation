import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "io.github.cavanaug.vmware-workstation"
  ipcTarget: "io.github.cavanaug.vmware-workstation"
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
  readonly property int nameColWidth: Math.round(nameMetrics.averageCharacterWidth * 22)
  readonly property int iconBtnSize: Style.space(22)
  readonly property int iconGap: Style.space(4)
  readonly property int iconGroupWidth: iconBtnSize * 3 + iconGap * 2
  readonly property int groupGap: Style.space(36)
  readonly property int hyperColWidth: Math.max(iconGroupWidth, Math.round(headerMetrics.averageCharacterWidth * 10))
  readonly property int guestColWidth: Math.max(iconGroupWidth, Math.round(headerMetrics.averageCharacterWidth * 7))
  readonly property int listRowWidth: nameColWidth + Style.space(10) + hyperColWidth + groupGap + guestColWidth

  FontMetrics {
    id: nameMetrics
    font.family: root.fontFamily
    font.pixelSize: Style.font.body
  }

  FontMetrics {
    id: headerMetrics
    font.family: root.fontFamily
    font.pixelSize: Style.font.bodySmall
  }

  function openWorkstation() {
    Quickshell.execDetached(Model.openWorkstationCommand())
    root.close()
  }

  function slotGlyph(slot) {
    if (slot === 1) return "󰓛"
    if (slot === 2) return "󰏤"
    if (slot === 3) return "󰐊"
    if (slot === 4) return ""
    if (slot === 5) return "󰒲"
    return ""
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

  IpcHandler {
    target: root.ipcTarget
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.toggle() }
    function refresh(): string { vmware.refresh(); return "ok" }
    function status(): string {
      var lines = []
      for (var i = 0; i < vmware.vms.length; i++) {
        var v = vmware.vms[i]
        lines.push(String(v.name) + " " + String(v.state) + " mask=" + String(v.slotsMask))
      }
      if (vmware.lastError) lines.push(vmware.lastError)
      return lines.join("\n") || "none"
    }
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
    contentWidth: panel.fittedContentWidth(
      root.listRowWidth + panel.padding * 2
        + Border.left(panel.borderSpec) + Border.right(panel.borderSpec)
    )
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

        Item {
          width: parent.width
          height: (vmware.vms.length ? Style.font.bodySmall + Style.space(8) : 0) + root.visibleRows * root.rowHeight
          clip: true

          Column {
            anchors.fill: parent
            spacing: 0

            Row {
              visible: vmware.vms.length > 0
              width: listFlick.width - (root.scrollable ? Style.space(16) : 0)
              height: visible ? Style.font.bodySmall + Style.space(8) : 0
              spacing: Style.space(10)

              Item { width: root.nameColWidth; height: 1 }

              Row {
                height: parent.height
                spacing: 0

                Text {
                  width: root.hyperColWidth
                  height: parent.height
                  textFormat: Text.PlainText
                  text: "Hypervisor"
                  color: root.dim
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.bodySmall
                  horizontalAlignment: Text.AlignHCenter
                  verticalAlignment: Text.AlignVCenter
                }

                Item { width: root.groupGap; height: 1 }

                Text {
                  width: root.guestColWidth
                  height: parent.height
                  textFormat: Text.PlainText
                  text: "GuestOS"
                  color: root.dim
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.bodySmall
                  horizontalAlignment: Text.AlignHCenter
                  verticalAlignment: Text.AlignVCenter
                }
              }
            }

          Flickable {
            id: listFlick
            width: parent.width
            height: root.visibleRows * root.rowHeight
            contentWidth: width
            contentHeight: vmColumn.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            flickableDirection: Flickable.VerticalFlick
            interactive: root.scrollable
            ScrollBar.vertical: ScrollBar {
              policy: root.scrollable ? ScrollBar.AsNeeded : ScrollBar.AlwaysOff
            }

            Column {
              id: vmColumn
              width: listFlick.width - (root.scrollable ? Style.space(16) : 0)
              Repeater {
                model: vmware.vms
                delegate: Item {
                  required property var modelData
                  width: vmColumn.width
                  height: root.rowHeight
                  readonly property var vm: modelData

            Row {
              anchors.fill: parent
              spacing: Style.space(10)

              Column {
                width: root.nameColWidth
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
                    text: Model.statusLabel(vm.state, vmware.pendingSlot, vmware.pendingVmx, vm.vmx)
                    color: root.dim
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.bodySmall
                  }
                }
              }

              Row {
                spacing: 0
                anchors.verticalCenter: parent.verticalCenter

                Item {
                  width: root.hyperColWidth
                  height: root.iconBtnSize
                  Row {
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: root.iconGap
                    Repeater {
                      model: 3
                      VmActionButton {
                        required property int index
                        readonly property int slot: index + 1
                        size: root.iconBtnSize
                        iconText: root.slotGlyph(slot)
                        tooltipText: Model.hardTooltip(slot)
                        enabled: (Number(vm.slotsMask) & (1 << (slot - 1))) !== 0
                        foreground: root.foreground
                        fontFamily: root.fontFamily
                        onClicked: vmware.runSlot(Number(slot), String(vm.vmx))
                      }
                    }
                  }
                }

                Item { width: root.groupGap; height: 1 }

                Item {
                  width: root.guestColWidth
                  height: root.iconBtnSize
                  Row {
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: root.iconGap
                    Repeater {
                      model: 3
                      VmActionButton {
                        required property int index
                        readonly property int slot: index + 4
                        size: root.iconBtnSize
                        iconText: root.slotGlyph(slot)
                        tooltipText: Model.guestWord(slot)
                        iconOffsetX: slot === 5 ? -2 : 0
                        enabled: (Number(vm.slotsMask) & (1 << (slot - 1))) !== 0
                        foreground: root.foreground
                        fontFamily: root.fontFamily
                        onClicked: vmware.runSlot(Number(slot), String(vm.vmx))
                      }
                    }
                  }
                }
              }
            }
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
