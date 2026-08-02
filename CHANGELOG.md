# Minimal Watch - Changelog

## v0.50

- User test of v0.49 made things **worse**: the whole screen went LIGHT after the first minute (dark theme, always-on display); only the time reappeared when re-drawn at the next minute. The rest of the content stayed bright
- Reframed root cause: this is not a flush/code artifact — the MIP display's **undriven natural state is LIGHT**. Dark pixels decay toward light during static periods because EXTCOMIN maintenance runs at only 1.25Hz in power-save (poll auto-throttles 12.5Hz → 1.25Hz after 60s idle, while the backlight is off). Only re-driven pixels hold their state — which is exactly why the time field (redrawn every minute) stayed visible and everything else faded
- Fix: **full content-area clear + redraw every minute** so all pixels are re-driven each minute, matching the time field's proven behavior. Wake (`lcdPower on`) now triggers an immediate full redraw instead of deferring to the next minute
- Battery impact is negligible: ~10KB SPI per minute is microseconds of SPI activity
- Removed the `prev*` partial-redraw tracking (dead code with full redraws) and the `firstScheduled` mechanism from v0.49

## v0.49

- Driver analysis (Espruino `lcd_memlcd.c`): the Bangle.js 2 display is buffered, and on idle only the **modified row range** is flushed over SPI (partial-band flush). Full-area flushes are immune to the artifact
- The bar is a partially-flushed row band after a ~60s static period — self-corrects on the next flush. v0.47 showed it full-width (band cleared full-width), v0.48 time-field width (only string-box pixels changed)
- Fix: full content-area clear + redraw on the **first scheduled draw only**, then partial redraws resume
- Also fixed a latent bug: reset `prevSegments` on full clear so the battery bar always fully redraws (its per-segment skip would otherwise leave it blank after the full-area clear)
- Note: partial vs full redraw is effectively free battery-wise (~8KB SPI/min extra is microseconds of SPI activity)

## v0.48

- Removed the redundant full-width `clearRect(0, y, W-1, y+th-1)` before the time `drawString` — `drawString(..., true)` already clears exactly its own character cells
- The full-width band clear is the suspected cause of the pre-existing "debug bar" artifact that appeared on the first scheduled minute re-draw (0-1 min fine, minute 1-2 shows a bar, correct after that)

## v0.47

- Isolate step 1: v0.45 base + battery segment tracking (`prevSegments`) only — date caching removed
- v0.46 confirmed v0.40's changes blank the content at minute update; the visible bar is a pre-existing debugging element, not part of v0.40
- Testing which v0.40 sub-change breaks rendering on device

## v0.46

- Bisect step 3: v0.37 base + v0.40's date caching (`cachedDay`/`cachedDateStr` — skips locale calls on 1,439 of 1,440 daily draws) and battery segment tracking (`prevSegments` — only SPI-writes changed bar segments)
- v0.45 confirmed the charging-icon change is safe on-device

## v0.45

- Bisect step 2: v0.37 base + v0.39's charging-icon change (draw at init only, removed from draw()) — BLE interval dropped
- v0.44 confirmed the crash trigger: `NRF.setConnectionInterval(4000)` at init breaks the clock on load
- BLE interval battery win (~0.3-0.4mA) sacrificed; may revisit with a deferred variant later

## v0.44

- v0.37 confirmed working on-device
- Bisect step 1: v0.37 base + only change from v0.38 — `NRF.setConnectionInterval(4000)` (BLE connection interval fixed at 4s)
- If this crashes on-device, the BLE interval override is the crash trigger

## v0.37
- Event-driven step counting: switched from per-minute `getHealthStatus` polling to `Bangle.on('step')` handler — zero overhead when idle, step counter updates instantly on step detection

## v0.36
- Fixed step counter: switched from `Bangle.getStepCount()` (never resets) to `Bangle.getHealthStatus("day").steps` (resets at midnight)
- Added `|| 0` fallback for steps if health tracking is not enabled
- Removed `Bangle.setPollInterval(800)` — firmware already auto-throttles from 12.5Hz to1.25Hz after 60s inactivity; manual override was causing inaccurate step counting

## v0.35
- Cached font heights (`th`/`sh`) at init — no longer recomputed every draw call
- Added null guard for `g.clearRect(Bangle.appRect)` — prevents crash if appRect undefined (emulator edge case)

## v0.34
- Weather redraw skipped when data unchanged — icon and temp only redraw when weather cache refreshes (~1/hour), saving ~59 unnecessary clear+redraw cycles per hour

## v0.33
- Fixed calendar week display: replaced `Date.UTC()`/`getUTCDay()`/`setUTCDate()` (not supported in Espruino) with local time equivalents
- Fixed layout alignment: `appTop` now guaranteed to be >=24 to account for widget bar area

## v0.32
- Fixed dark theme rendering: replaced hardcoded `g.setColor(0)` with `g.theme.fg` for text/icons and `g.theme.bg` for charging icon clear rect — watchface was invisible on dark theme

## v0.31
- Fixed layout overflow: corrected `totalH` formula (weather height was inflated by 8px), removed hardcoded `+16` y-offset
- Added `lcdPower` handler: pauses draw timer on screen off, restarts on power-on via `queueDraw()`
- Fixed `prevHadWeather` update: moved before try block to prevent permanent full clearRect on early throw
- Fixed `E.getBattery()` called twice: single call, value passed to `drawBatteryBar`
- Fixed `clearRect` bounds: uses `appTop`/`appH` instead of hardcoded values
- Added `redraw:draw` to `setUI` for framework-initiated redraws
- Added `setPollInterval` feature guard for older firmware
- Added `w.temp` validation: `typeof` check prevents NaN display

## v0.30
- Removed redundant `g.reset()` in draw — all state is set explicitly after (setFont, setColor, setFontAlign)
- Added `w.code` existence check before `drawWeatherIcon` — prevents silent failure if owmweather changes field names

## v0.29
- Re-added `Bangle.setPollInterval(800)` — reduces accelerometer power from 0.3mA to 0.15mA
- v0.22 removal was about JS `accel` events, not the hardware pedometer (Kionix KX022 pedometer register runs independently)

## v0.28
- Reduced weather cache TTL from 5min to 60min — weather data updates hourly anyway, saves unnecessary Storage.read calls

## v0.27
- Per-element clear + selective redraw: only clears and redraws elements whose content actually changed
- Full content-area clear only happens when layout shifts (weather appear/disappear) — rare event
- Saves ~65% SPI pixel writes on typical minute: only time+steps regions cleared (8,448px) vs full content area (23,936px)
- Date, CW, battery bar, weather skipped when unchanged — MIP display retains their pixels with zero power
- Added state tracking: `prevTimeStr`, `prevDateStr`, `prevCW`, `prevBat`, `prevSteps`, `prevHadWeather`

## v0.26
- Power optimization: replaced `g.clearRect(Bangle.appRect)` with content-area-only clear (`g.clearRect(0, appTop+16, W-1, H-1)`)
- Saves ~10.5% SPI pixel writes per draw (23,936 vs 26,752 pixels) — the dominant power cost on MIP display
- Clear area covers all possible content positions (with/without weather) while skipping unused upper region
- Charging icon unaffected — draws its own white background independently

## v0.25
- Reverted draw() to v0.23 proven structure — fresh per-draw computation of appTop/appH/th/sh, per-element try/catch for fault isolation, g.reset() inside try after layout calc
- Kept init improvements from v0.24: deferred drawWidgets with setTimeout, removeListener (not removeAllListeners)

## v0.24.1
- Fixed v0.24 regression: only time and date were displayed — CW, battery, weather, steps were off-screen
- Root cause: `Bangle.appRect` was cached before `Bangle.loadWidgets()`, which may modify `appRect`. Cached values were stale, shifting all elements below date off-screen
- Fix: moved all init-time caching (appRect, font heights) after `Bangle.loadWidgets()` and `setTimeout(Bangle.drawWidgets, 0)`

## v0.24
- Cached `Bangle.appRect` (appTop, appH) at init instead of per-draw — removes 2 property lookups + 2 ternary checks per draw
- Cached font heights (th, sh) at init instead of per-draw — removes 2× `g.setFont()` + 2× `g.getFontHeight()` per draw
- Removed 6 inner try/catch blocks from draw body — outer try/catch still protects `queueDraw()` (antonclk pattern: zero try/catch)
- Moved `g.reset()` + `g.clearRect()` before the try block — ensures clean state even if pre-draw code throws
- Deferred `Bangle.drawWidgets` with `setTimeout(fn, 0)` — avoids blocking initial draw, widgets render after clock face (antonclk pattern)

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
