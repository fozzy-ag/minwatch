# Minimal Watch - Changelog

## v0.23
- **CRITICAL**: `removeAllListeners('charging')` nukes ALL system listeners — replaced with `Bangle.removeListener` using stored handler reference
- Fixed charging listener leak — accumulates on every app re-entry without `removeListener` in `remove` callback
- Fixed `var` in block scope `{...}` leaking to global — replaced with `let` for proper block scoping
- Fixed `getWeekNumber` cache keyed on day-of-month — now keyed on year-month-day, doesn't break across month boundaries
- Fixed `queueDraw` timeout can be 0ms on exact minute boundary — clamped to minimum 1ms to prevent double-draw
- Wrapped `drawChargingIcon()` in try/catch inside charging event handler — prevents crash from corrupting state

## v0.22
- Reverted eval/RAM loading — was counterproductive (extra flash read + re-compilation on every app load)
- Removed `Bangle.setPollInterval(800)` — firmware already auto-throttles accelerometer after ~120s idle, manual override may interfere with step counting
- Moved `drawChargingIcon()` inside try/catch — prevents watchface freeze if charging icon throws
- Used `g.reset()` before `clearRect` in init — ensures correct background color
- Kept: `setTimeout` aligned to minute boundary, `g.clearRect(Bangle.appRect)`

## v0.21
- Split into loader (`app.js`) + main code (`main.js`) — main code loaded into RAM via eval to avoid SPI flash contention during draws
- `setTimeout` aligned to minute boundary instead of `setInterval` — redraws at :00 seconds, avoids drift
- `g.clearRect(Bangle.appRect)` instead of `g.fillRect()` — clears only app area, less SPI traffic
- `Bangle.setPollInterval(800)` — drops accelerometer from 12.5Hz to 1.25Hz, saves ~0.15mA
- HRM disabled, locale cached, weather cached with 5-min TTL

## v0.20
- Restored working v0.18 draw logic — v0.19 partial redraws had multiple bugs:
  - Extra `y += sh + gap` in else branch pushed battery/weather/steps off-screen on subsequent draws
  - Font scale 4 used for date stringWidth checks (should be scale 2)
  - No `g.reset()` caused font/color state to persist unpredictably between draws
- Kept safe optimizations: cached W, H, cx, gap, bh at init (not per-draw)
- Changed `drawWeatherIcon` params from `cx,cy` to `ox,oy` to avoid shadowing global `cx`

## v0.19
- Battery optimization: only redraw elements that actually changed
- Removed `g.reset()` and full-screen `g.fillRect` on every draw — was clearing 176×176 pixels every 60s
- Cached font heights at init instead of calling `g.setFont()`/`getFontHeight()` per-draw
- Time: redrawn every minute (only region behind text)
- Date/CW: redrawn once per day change
- Battery bar: only redraws when percentage changes
- Weather: only redraws when temperature string changes
- Steps: only redraws when count changes
- Removed per-section try/catch overhead — consolidated into single outer catch
- Font state set once at init, not reset per-draw

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
