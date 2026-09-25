import QtQuick
import qs.Commons

// lazygit-style activity indicator: a single braille dot-pattern glyph
// cycling through spinner frames (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) — the dots appear to
// chase around the cell. One Text + one frame Timer; sized via `fontSize`
// because braille patterns only read well above body text size.
// The timer only ticks while visible.
Text {
  id: root

  property color dotColor: Color.accent
  property real fontSize: Style.font.icon
  property int frameMs: 90
  readonly property var frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

  textFormat: Text.PlainText
  text: frames[frame % frames.length]
  color: dotColor
  font.family: Style.font.family
  font.pixelSize: fontSize

  property int frame: 0

  Timer {
    interval: root.frameMs
    running: root.visible
    repeat: true
    onTriggered: root.frame++
  }
}
