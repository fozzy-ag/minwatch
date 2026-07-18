# Minimal Watch - Changelog

## v0.18
- Fix: watch menu icon was empty/broken — `app-icon.js` used `Graphics.createArrayBuffer()` with `0x07E0` (16-bit green) in 8bpp mode, which truncated to red (`0xE0`) in RGB332
- Replaced with standard `require("heatshrink").decompress(atob("..."))` format matching `app.png` exactly
- Uses 4-bit indexed color with transparency for compact, reliable icon storage

## v0.07
- Fix: removed `startTimer()` call from inside `draw()` — was resetting the interval on every draw, preventing auto-update
- Fix: simplified timer to plain `setInterval(draw, 60000)`, removed setTimeout→setInterval hybrid
- Fix: dynamic element spacing using `g.getFontHeight()` instead of hardcoded pixel positions
- Removed `"ram"` directives from functions

## v0.06
- Removed version number display from watchface
- Changed all text colors from dim `0x4208` to full black `0` for visibility on transflective LCD
- Moved `Bangle.setUI({mode:"clock"})` before first draw
- Added `lcdPower` event listener for screen on/off
- Switched timer from `setTimeout` chain to `setInterval` with `setTimeout` alignment

## v0.05
- Fix: version text was off-screen at `y=H-2` (y=174), moved to `y=165`
- Fix: date string truncated to 14 chars max if combined dow+date exceeds screen width
- Added explicit `setFontAlign(0, -1)` reset in CW block

## v0.04
- Added `lcdPower` event listener to trigger redraws on screen wake
- Bumped version for App Loader cache-busting

## v0.03
- Reduced time font from `6x8:5` (40px) to `6x8:4` (32px) to fix layout overflow
- Shifted all element positions up to fit within 176px screen
- Fixed date cut-off: changed `lc.date(date)` to `lc.date(date, 1)` for short format

## v0.02
- Added per-section `try/catch` around each visual element so one failure doesn't hide the rest
- Replaced `g.clearRect` with `g.fillRect` using explicit white background color
- Added version display for debugging

## v0.01
- Initial release
- Time, date, calendar week, battery bar, weather (OWM), step counter
- Battery bar: 10 segments, color-coded (red/yellow/green)
- Weather icons remapped from WMO to OWM code ranges (200-999)
- Kelvin→Celsius conversion for OWM temperature data
- Light theme (white background for transflective LCD efficiency)
- HRM disabled to save power
- Emulator guards for `Bangle.setHRMPower`, `Bangle.on`, storage reads
- Dependencies: `owmweather` app for weather data
