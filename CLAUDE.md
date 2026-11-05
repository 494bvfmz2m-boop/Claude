# Project notes for Claude

## Screen guide: "where do I click…?"

When the user asks **"where do I click to …"**, **"show me where … is"**, or anything similar about something on their screen, do this every time, with no detours:

1. **Shoot.** Run `python3 screen-guide/guide.py shot` (on Windows, `python` if `python3` isn't found). It writes `screen-guide/latest.png` and `screen-guide/latest-grid.png`, the same image with a percentage grid.
2. **Look.** Open `screen-guide/latest-grid.png` with the Read tool and look at it yourself. Don't guess from memory of how the app usually looks.
3. **Find** the exact control the user means. Read its centre off the grid as X% (left to right) and Y% (top to bottom), to one decimal place. Percentages are used because Retina screenshots are 2x and images shown to you may be scaled.
4. **Point.** Run `python3 screen-guide/guide.py point X Y "Label"` with a 2-4 word label, such as "Trash", "Wi-Fi menu" or "Save button". It draws the arrow (tip exactly on X%, Y%) into `screen-guide/pointed.png`, saves a close-up `pointed-zoom.png`, and opens the result for the user. Check `pointed-zoom.png`. If the tip isn't on the control, correct X/Y and point again.
5. **Answer in one short line, like a butler:** "Right there, sir." Nothing else, unless the control isn't on screen. Then say so in one line and suggest how to reveal it, for example "It's hidden, sir; open the Apple menu first."

Notes:
- This needs Claude Code running **on the user's own computer**. A cloud session can't see their screen.
- macOS: the terminal running Claude Code needs **Screen Recording** permission (System Settings → Privacy & Security → Screen Recording).
- Screenshots stay local: `screen-guide/*.png` is git-ignored and never committed.
