# Bangle.js 2 Development Reference

Living document — update as new discoveries are made. Last updated: v0.39 (2026-07-27).

---

## 1. Hardware & Display

- **Screen**: 176×176 pixels
- **Battery**: 175 mAh lithium polymer
- **Display type**: Transflective LCD (LPM013M126A) — **NOT OLED**
  - Pixel colors do NOT affect power draw directly
  - Power savings come from backlight reduction, not dark pixels
  - Lighter/white backgrounds reflect ambient light → less backlight needed → better battery
  - Therefore **light theme is the battery-saving choice** on this display
- **Widget bar**: Top of screen, approximately 24px tall
  - Use `Bangle.appRect.y` and `Bangle.appRect.h` for actual usable area (don't hardcode 24/152)
  - `Bangle.appRect` is available after `Bangle.setUI()` is called
  - **Guard `appTop` with `Math.max(Bangle.appRect.y, 24)`** — some firmware versions return `y=0`, causing content to center in the full screen instead of below widgets

## 2. Graphics API Gotchas

- **`g.reset()`** resets ALL state: font, color, fontAlign, etc. You must re-set everything after calling it
- **`g.setColor(color)`** uses 16-bit RGB565 format on 16bpp graphics, BUT see Section 16 for icon gotcha:
  - `0xF800` = red, `0x07E0` = green, `0x001F` = blue
  - `0xFFFF` = white, `0x0000` = black, `0xC618` = grey (battery bar empty)
  - `0xFE60` = yellow (battery bar low)
  - **Use `g.theme.fg` and `g.theme.bg`** for text/icons — hardcoded `g.setColor(0)` is invisible on dark theme
  - **WARNING**: `Graphics.createArrayBuffer(w,h,8)` uses 8bpp RGB332, NOT 16-bit. Values like `0x07E0` get truncated to `0xE0` which is red in RGB332, not green. Use correct 8bpp values or use 16bpp buffers.
- **`g.fillRect(x1, y1, x2, y2)`** — coords are inclusive corners, not width/height
- **`g.clearRect()`** may not use background color — use `g.setColor(0xFFFF); g.fillRect(...)` for reliable fill
- **`g.drawString(text, x, y, true)`** — 4th param `true` draws a solid background behind text (prevents bleed-through from previous draws)
- **`g.getWidth()` / `g.getHeight()`** return screen dimensions (176×176)
- **Guard `g.clearRect(Bangle.appRect)` with null check** — throws outside try/catch if `Bangle.appRect` is undefined (emulator edge case)

## 3. Font Metrics & Alignment

- **`"6x8"` font**: 6px wide, 8px tall per character at scale 1
  - Scale 2: 12×16px per char
  - Scale 4: 24×32px per char
- **`g.getFontHeight()`**: Returns actual pixel height of current font — **cache at init, don't call per draw**
- **`g.setFontAlign(x, y)`**:
  - x: `-1` = left, `0` = center, `1` = right
  - y: `-1` = top, `0` = middle, `1` = bottom
  - With `setFontAlign(0, -1)`: text center-horizontally, y coord = TOP of text
- **Width calculation**: `g.stringWidth(text)` returns pixel width if needed

## 4. Layout & Centering

- **Never hardcode Y positions** — calculate dynamically:
  ```js
  let appTop = Bangle.appRect ? Math.max(Bangle.appRect.y, 24) : 24;
  let appH = Bangle.appRect ? Math.min(Bangle.appRect.h, H - 24) : H - 24;
  let totalH = th + sh + sh + bh + (hasWeather ? sh : 0) + sh + gap * (hasWeather ? 5 : 4);
  let y = appTop + (appH - totalH) / 2;
  ```
- **Gap count must match element count**: 6 elements = 5 gaps, 5 elements = 4 gaps. Using wrong count shifts layout.
- **Horizontal centering**: Use `g.setFontAlign(0, -1)` then draw at `x = W/2` (or `W >> 1`)
- **Weather icons extend ~8px above text position** — account for this in total height calculation (add 8 to weather section height)
- **Group centering**: When icon + text are a group (e.g., weather), center the group as a whole, not individually
- **Battery bar centering**: 10 segments × 10px wide + 9 gaps × 2px = 118px total. Center offset = 59px from center

## 5. Timer & Update Behavior

- **Recommended**: `setTimeout` aligned to minute boundary via `queueDraw()` pattern:
  ```js
  let drawTimeout;
  function queueDraw() {
    if (drawTimeout) clearTimeout(drawTimeout);
    drawTimeout = setTimeout(function() {
      drawTimeout = undefined;
      draw();
    }, Math.max(1, 60000 - (Date.now() % 60000)));
  }
  ```
- **Why `setTimeout` over `setInterval`**: `setInterval` drifts over time and can fire at wrong moments. `setTimeout` aligned to `Date.now() % 60000` fires exactly at the minute boundary.
- **`Math.max(1, ...)` guard**: Prevents 0ms timeout edge case when called exactly on the minute.
- **Always cancel before re-queue**: `clearTimeout(drawTimeout)` prevents duplicate timers.
- **DO NOT call timer setup from inside `draw()`** — it resets the timeout every update.
- **lcdPower handler**: Stop timer when screen off, restart + immediate redraw when on:
  ```js
  let onLcdPower = function(on) {
    if (on) queueDraw();
    else { if (drawTimeout) { clearTimeout(drawTimeout); drawTimeout = undefined; } }
  };
  ```

## 6. Initialization Order

The correct order matters:

```js
// 1. Disable sensors to save power
if (Bangle.setHRMPower) Bangle.setHRMPower(0, "appname");

// 2. Register event listeners
if (Bangle.on) Bangle.on('charging', onCharging);
if (Bangle.on) Bangle.on('lcdPower', onLcdPower);

// 3. Set UI mode BEFORE draw()
Bangle.setUI({mode:"clock", remove:function() {
  if (drawTimeout !== undefined) { clearTimeout(drawTimeout); drawTimeout = undefined; }
  if (Bangle.removeListener) Bangle.removeListener('charging', onCharging);
  if (Bangle.removeListener) Bangle.removeListener('lcdPower', onLcdPower);
}, redraw:draw});

// 4. Reset graphics and clear app area (guard against missing appRect)
g.reset();
if (Bangle.appRect) g.clearRect(Bangle.appRect);

// 5. Load and draw widgets (defer drawWidgets)
Bangle.loadWidgets();
setTimeout(Bangle.drawWidgets, 0);

// 6. Initial draw
draw();
```

- `Bangle.setUI({mode:"clock"})` tells the system this is a clock app (keeps screen on, handles button, etc.)
- Must be called **before** `draw()`
- `Bangle.setUI()` calls `g.reset()` internally (since firmware 2v16) — your draw code must re-set fonts/colors
- `redraw:draw` callback allows framework to request redraws (e.g., after theme changes)
- Defer `drawWidgets` with `setTimeout(fn, 0)` to avoid blocking initialization

## 7. Storage & Data Reading

- **`require("Storage").readJSON()` can throw** — always wrap in try/catch
- **Cache storage reads** — don't read the same file twice in one draw cycle
- **Cache `require()` calls** — store `require("locale")` result in a variable at init, not per-draw
- **Use TTL caching for infrequent data** — flash reads cost 10-50ms; don't re-read every 60s if data changes hourly
- **Weather data** (from owmweather app): `require("Storage").readJSON("weather.json")`
  - Structure: `wd.weather.temp` (Kelvin), `wd.weather.code` (OWM code)
  - Changes ~every 30 min from phone companion — cache with 60-minute TTL (matches external update frequency)

```js
let cachedWeather = null;
let cachedWeatherTime = 0;

function getWeather() {
  let now = Date.now();
  if (cachedWeather !== null && now - cachedWeatherTime < 3600000) return cachedWeather;
  let wd = null;
  try { wd = storage.readJSON("weather.json"); } catch(e) {}
  let w = wd && wd.weather ? wd.weather : null;
  cachedWeather = w && typeof w.temp === "number" ? w : null;
  cachedWeatherTime = now;
  return cachedWeather;
}
```

## 8. Locale Formatting

- `require("locale")` provides time/date formatting
- **Use `1` parameter for short format**:
  - `lc.time(date, 1)` → short time (e.g., "14:30")
  - `lc.date(date, 1)` → short date (e.g., "17/07")
  - `lc.dow(date, 1)` → short day name (e.g., "Fri")
- **Without `1`**: returns LONG format — can overflow screen width on 176px display

## 9. Weather (owmweather)

- **owmweather** app stores data in `weather.json` via `require("Storage")`
- **Temps in Kelvin**: `temp - 273.15` for Celsius
- **OWM weather codes** (NOT WMO — different ranges):
  - 200–232: Storm/thunderstorm
  - 300–531: Rain/drizzle
  - 600–622: Snow
  - 701–741: Fog/mist
  - 800: Clear/sun
  - 801–804: Cloudy
- **Weather section**: hide gracefully if owmweather not installed or no data (try/catch returns nothing)
- **`Math.round(w.temp - 273.15)`** for clean integer display with °C
- **Track weather display string** — only redraw icon+text when code or temp changes:
  ```js
  let wstr = w.code + "|" + Math.round(w.temp - 273.15);
  if (layoutChanged || wstr !== prevWeatherStr) {
    // clear and redraw
    prevWeatherStr = wstr;
  }
  ```

## 10. Step Counter

- **`Bangle.getStepCount()`** — returns total steps since boot, **never resets** (confirmed by gfwilliams in Discussion #3907)
- **`Bangle.getHealthStatus("day").steps`** — returns daily step count, **resets at midnight** (firmware `healthDaily` struct, `midnight` event)
- Use `Bangle.getHealthStatus("day").steps` for daily step display
- **Guard with `sc = sc || 0`** — prevents "undefined steps" if health tracking is not enabled
- No setup required — hardware pedometer runs independently
- `WIDGETS.wpedom.getSteps()` also returns daily steps (from pedometer widget), but `getHealthStatus` is faster (avoids storage scan)
- **`Bangle.getStepCount()` vs `Bangle.getHealthStatus("day").steps`**: Issue #1216 reported `getHealthStatus("day").steps` not resetting at midnight — this was a firmware bug, fixed and closed
- **Event-driven steps** (v0.37): Use `Bangle.on('step')` to update cached step count — no per-draw health API calls needed:
  ```js
  let cachedSteps = 0;
  function onStep() {
    try { cachedSteps = Bangle.getHealthStatus("day").steps || 0; } catch(e) {}
  }
  // Register before first draw
  if (Bangle.on) Bangle.on('step', onStep);
  onStep(); // initialize cache
  // In remove handler:
  if (Bangle.removeListener) Bangle.removeListener('step', onStep);
  ```
  - `Bangle.on('step')` does **NOT** prevent power save mode (unlike `Bangle.on('accel')`)
  - Firmware pedometer (Kionix KX022) runs independently of JS polling
  - Savings: one `getHealthStatus()` call per minute eliminated (negligible mA, but architecturally correct)

## 11. Charging Detection

- **`Bangle.isCharging()`** — returns boolean, can be polled
- **`Bangle.on('charging', function(charging) {...})`** — event-based, fires on state change
- Event-driven is preferred: zero overhead when not charging
- Guard both with existence checks for emulator compatibility
- Clean up with `Bangle.removeListener('charging', onCharging)` in remove handler (NOT `removeAllListeners`)
- Note: This is only available on Bangle.js smartwatches (not emulator)
- **Call `isCharging()` AFTER `Bangle.setUI()`** — firmware may not have charging state ready before then
- **Call `drawChargingIcon()` ONCE at init after `Bangle.isCharging()` check** — event handler updates it on state changes, no per-draw call needed (v0.39)
- **Position icon in empty space** — below all content, avoid overlap with weather/steps text

## 12. Battery

- `E.getBattery()` returns percentage (0–100)
- Battery bar: 10 segments, 10px wide, 2px gap between segments
- Color coding: red (≤20%), yellow (≤40%), green (>40%)
- Grey (`0xC618`) for empty segments
- **Call `E.getBattery()` once per draw** — pass value to `drawBatteryBar(y, filled)` instead of calling twice

```js
let filled = Math.round(E.getBattery() / 10);
for (let i = 0; i < 10; i++) {
  g.setColor(i < filled ? (filled <= 2 ? 0xF800 : filled <= 4 ? 0xFE60 : 0x07E0) : 0xC618);
  let x = cx - 59 + i * 12;
  g.fillRect(x, y, x + 9, y + 6);
}
```

## 13. HRM (Heart Rate Monitor)

- **Disable explicitly** to save power: `if (Bangle.setHRMPower) Bangle.setHRMPower(0, "appname")`
- **Guard with existence check** — `Bangle.setHRMPower` may not exist in emulator
- Similarly guard `Bangle.on(...)` calls that may not be available in all contexts

## 14. Emulator Compatibility

- Set `"allow_emulator": true` in metadata.json
- **Guard all hardware-specific APIs** with existence checks:
  ```js
  if (Bangle.setHRMPower) Bangle.setHRMPower(0, "minwatch");
  if (Bangle.on) Bangle.on('charging', onCharging);
  ```
- **Wrap Storage reads in try/catch** — emulator may not have all files
- `Bangle.appRect` may not be available — provide fallback (e.g., `var appTop = Bangle.appRect ? Bangle.appRect.y : 24;`)
- **Guard `g.clearRect(Bangle.appRect)`** — throws if `Bangle.appRect` is undefined: `if (Bangle.appRect) g.clearRect(Bangle.appRect);`

## 15. Code Style & Performance

- **Cache everything**: locale, storage reads, font height measurements
- **TTL caching**: for data that changes rarely (weather: 60min, week number: by day), avoid repeated flash reads
- **Per-section try/catch**: one element failure shouldn't hide others
- **Always restore graphics state in catch blocks** — if a section changes `g.setFontAlign()`, restore it in `catch` so downstream sections aren't affected:
  ```js
  try {
    g.setFontAlign(-1, -1);
    g.drawString(text, x, y, true);
    g.setFontAlign(0, -1);  // restore
  } catch(e) {
    g.setFontAlign(0, -1);  // restore even on error
  }
  ```
- **Use `g.stringWidth()` for text overflow checks** — not magic numbers:
  ```js
  if (g.stringWidth(dateStr) > W - 10) dateStr = fallback;
  ```
- **Reduce redundant calls** — don't call `setFont`/`setColor`/`setFontAlign` more than needed — only reset when switching contexts
- **Remove unused variables** — reduces memory footprint
- **Cache `W >> 1` as `cx`** — single variable instead of repeated bit shifts
- **Week number only changes once per day** — cache by date, skip calculation if same day
- **Cache font heights at init** — `g.setFont()` + `getFontHeight()` is expensive; measure once, store in variables
- **Cache static values at init**: `W`, `H`, `cx`, `gap`, `bh`, `th`, `sh` — never recalculate in draw()
- **Use `g.theme.fg` / `g.theme.bg`** — hardcoded colors break on dark theme
- **BLE connection interval**: `NRF.setConnectionInterval(interval)` — valid range 7.5ms–4000ms (BLE spec limit); default auto-adjusts 7.5ms active ↔ 200ms idle; fixed 4000ms saves ~0.3-0.4mA; NOT persisted across `save()` — must re-set via onInit (v0.38)

### Partial Redraw Pattern (v0.19)
The single biggest battery drain is **clearing and redrawing the entire screen every 60 seconds**. The optimized approach:

1. **Track last-drawn values** — only redraw when the value actually changed
2. **Clear only the affected region** — `g.fillRect()` behind the changed element, not the full 176×176 screen
3. **Set state explicitly** — don't call `g.reset()` in draw(); set font/color/align per section

```js
let prevTimeStr = "";
let prevDateStr = "";
let prevCW = -1;
let prevBat = -1;
let prevSteps = -1;
let prevWeatherStr = "";

function draw() {
  let date = new Date();
  let ts = lc.time(date, 1);

  g.setFontAlign(0, -1);
  g.setColor(g.theme.fg);

  // Only redraw time if it changed
  if (ts !== prevTimeStr) {
    g.setFont("6x8", 4);
    g.clearRect(0, y, W - 1, y + th - 1);
    g.drawString(ts, cx, y, true);
    prevTimeStr = ts;
  }
  y += th + gap;

  // Only redraw weather if code or temp changed
  let wstr = w.code + "|" + Math.round(w.temp - 273.15);
  if (wstr !== prevWeatherStr) {
    // clear and redraw
    prevWeatherStr = wstr;
  }
}
```

**Redraw frequency by element**:
| Element | Redraw trigger | Cost |
|---------|---------------|------|
| Time | Every minute (string change) | Medium — only 1 line |
| Date/CW | Once per day | Zero after first draw |
| Battery | When % changes (rarely) | Zero most draws |
| Weather | When code or temp changes (~1/hr) | Zero most draws |
| Steps | When count changes | Low — usually changes often |
| Charging | Event-driven only | Zero overhead |

**What NOT to do**:
- `g.reset()` on every draw — resets all state, expensive (Bangle.setUI already calls it at init)
- `g.fillRect(0, appTop, W, H)` on every draw — clears 176×152 pixels for nothing
- `g.setFont("6x8", 4); g.setFont("6x8", 2)` on every draw — cache font heights, set font only when switching
- Per-section try/catch when sections don't throw — consolidate into outer catch
- Hardcoded `g.setColor(0)` — use `g.theme.fg` / `g.theme.bg` for dark theme support

## 16. App Loader & Distribution

### File Structure
```
minwatch/
  app.js            Main watchface code
  metadata.json     App metadata (version, dependencies, storage mapping)
  app-icon.js       Icon — MUST use heatshrink-compressed format (see below)
  app.png           48×48 PNG icon (for App Loader preview on web)
  ChangeLog         BangleApps-format changelog (newest first, NO extension)
  CHANGELOG.md      Human-readable changelog (optional, for repo)
```

### App Icon Format — CRITICAL
The icon stored on the watch (`minwatch.img`) must be in **heatshrink-compressed binary format**. This is the standard used by every app in BangleApps:

```js
require("heatshrink").decompress(atob("mEwghC/AFeg...base64data..."))
```

**DO NOT** use `Graphics.createArrayBuffer()` + `g.asImage()`:
- 8bpp buffers (`createArrayBuffer(48,48,8)`) use RGB332 palette, NOT RGB565
- `setColor(0x07E0)` truncates to `0xE0` = **bright red**, not green
- This produces a broken/empty icon in the watch menu
- Minwatch was the only app in BangleApps using this pattern — it never worked correctly

**How to generate**: Use the BangleApps `webtools/imageconverter.js`:
```js
const imageconverter = require("BangleApps/webtools/imageconverter.js");
const heatshrink = require("BangleApps/webtools/heatshrink.js");
imageconverter.setHeatShrink(heatshrink);
const result = imageconverter.RGBAtoString(rgbaData, {
  width: 48, height: 48,
  mode: "4bit", transparent: true, compression: true, output: "string"
});
// result = 'require("heatshrink").decompress(atob("..."))'
```

**metadata.json storage entry** for the icon:
```json
{"name": "minwatch.img", "url": "app-icon.js", "evaluate": true}
```
The `evaluate: true` flag tells the App Loader to execute the JS on the watch and store the return value.

### apps.json Is a Jekyll Template — NOT Valid JSON
The upstream BangleApps repo's `apps.json` is a **Liquid/Jekyll template**, not parseable JSON:
```
---
{%- include_relative {{ apps.first }} -%}
...
---
```
**You CANNOT serve this directly.** Generate proper JSON by running:
```bash
cd BangleApps
bash bin/create_apps_json.sh           # generates apps.json
bash bin/create_apps_json.sh apps.local.json  # generates apps.local.json
```
This concatenates all `apps/*/metadata.json` files into a single JSON array.

### Version Sync — CRITICAL
Version must match across ALL of these files:
1. `metadata.json` → `"version": "X.YZ"`
2. `apps.json` → generated from metadata.json files (run `create_apps_json.sh`)
3. **`apps.local.json`** → generated from metadata.json files — **THIS is what the App Loader actually reads**

**Two directories must be updated — forget one and the loader shows stale version:**
- `minwatch/metadata.json`, `minwatch/apps.json`, `minwatch/apps.local.json` (repo copies)
- `BangleApps/apps/minwatch/metadata.json` (synced copy)
- `BangleApps/apps.json`, `BangleApps/apps.local.json` (served by loader on localhost:8080)

### `apps.local.json` vs `apps.json`
- `loader.js` line 10: `Const.APPS_JSON_FILE = "apps.local.json";`
- The App Loader reads **`apps.local.json`**, NOT `apps.json`
- Running `create_apps_json.sh` without args generates both files
- **You must regenerate after ANY metadata.json change**, or the App Loader shows stale version
- Closing and reopening the browser tab may still be needed (JS memory cache persists even with no-cache headers)
- **`apps.json` and `apps.local.json` are gitignored** — they live in the BangleApps directory, not the app repo

### Dependency Format in metadata.json
The key is the **app/module name**, the value is the **type**:
```json
"dependencies": {
  "owmweather": "app"
}
```
**NOT** `"app": "owmweather"` — that causes: `"Dependency type 'owmweather' not supported"`

Valid dependency types: `"app"`, `"module"`, `"widget"`, `"type"`

### ChangeLog Format
```
0.12: Description of what changed
0.11: Previous version description
...
0.01: Initial release
```
- Newest first
- No file extension
- Clicking the version number in the App Loader opens this file

### Local HTTP Server for Testing
- **Must serve from BangleApps root directory** — the App Loader UI (index.html, loader.js) lives there
- **Must set no-cache headers**: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- Serve on `0.0.0.0:8080` to allow phone access over WiFi
- Access from phone: `http://<termux-ip>:8080` (not `localhost`)
- `loader.js` only reads `apps.local.json` when `hostname === 'localhost'` — accessing via IP uses `apps.json`
- Browser JS cache persists even with no-cache headers — **close tab and reopen** to see changes
- Python example: `serve.py` in app directory

### Submitting to Official App Loader
1. Fork `espruino/BangleApps` on GitHub
2. Create branch from `upstream/master`
3. Copy app files to `apps/<appid>/`
4. Run `bash bin/create_apps_json.sh apps.local.json` to verify
5. Commit only app files (NOT apps.json — it's auto-generated by GitHub Pages)
6. Push branch, open PR to `espruino/BangleApps:master`
7. Token needs `repo` + `workflow` scopes for push (workflow files in .github/)

## 17. Dependencies

- **Format**: `"appname": "type"` in metadata.json (NOT `"type": "appname"`)
- **owmweather** (for weather data) — `"owmweather": "app"`
- **No other external dependencies** — all other APIs are built into Bangle.js firmware
- Weather gracefully degrades: if owmweather not installed, weather section is simply not drawn
- Valid types: `"app"` (installed app), `"module"` (JS module), `"widget"`, `"type"`

## 18. Apps vs Widgets — Key Differences

### Apps (Clocks, Launchers, etc.)
- **metadata.json type**: `"clock"` or `"launcher"` (or omit for general apps)
- **Storage name**: `<appid>.app.js` (e.g., `minwatch.app.js`)
- **Loaded**: On demand when user selects from launcher
- **Lifecycle**: `Bangle.setUI({mode:"clock", remove:function(){...}})` — handles screen on/off, button press
- **Can use**: `setInterval`, `setTimeout`, event handlers, full screen area
- **Can depend on**: Any app/module
- **Example**: `minwatch` — a clock app that uses full screen (176×176 minus widget bar)

### Widgets (Small persistent UI elements)
- **metadata.json type**: `"widget"`
- **Storage name**: MUST end in `.wid.js` (e.g., `widopenweather.wid.js`)
- **Loaded**: At boot, automatically by `Bangle.loadWidgets()` — runs in background
- **Lifecycle**: Framework calls `draw()` when needed — no `setUI()`, no timers
- **Can use**: Only `draw()` — no `setInterval` or `setTimeout` (framework manages redraw)
- **Constraints**:
  - **24px height** (widget bar height)
  - **22px width** (typical) — can be wider but should fit in widget bar
  - **No full-screen access** — must not draw outside widget bounds
  - **No lifecycle management** — framework handles show/hide
- **Can depend on**: Any app/module, but gracefully degrade if missing
- **Example**: `widopenweather` — weather widget showing temp + icon in 22×24px area

### Widget Storage Requirements
- Filename MUST end in `.wid.js` — otherwise auto-load at boot fails
- Widget name in metadata.json should follow `wid*` naming convention (e.g., `widopenweather`)
- `dependencies` field uses same format as apps: `"{"owmweather": "app"}`
- No `"icon"` or `"author"` fields needed in metadata (optional, can cause issues if malformed)

### Widget Design Pattern (from widcw/widcal)
- **Header** (y to y+8): Red background, white text — for temperature/date
- **Content** (y+9 to y+23): White background, colored icons — for weather icon
- **Dimensions**: 22px wide × 24px tall
- **Font**: `"6x8"` scale 1 for header text (6×8px per char)
- **Colors**: Red `0xF800`, white `0xFFFF`, black `0x0000`
- **Border**: Black outline on content area (light theme only)

### Widget vs App: When to Use Which
- **Widget**: Persistent status info visible at all times (battery, weather, steps, date)
- **App**: Full-screen functionality (clock face, settings, music player)
- **Widget can be**: Drawn by app via `Bangle.drawWidgets()` — app controls when widget redraws

## 19. Power Saving Checklist

1. Light/white background (transflective LCD efficiency)
2. Disable HRM with `Bangle.setHRMPower(0, "appname")`
3. Don't override accelerometer poll interval — firmware auto-throttles from 12.5Hz (80ms) to 1.25Hz (800ms) after 60s inactivity (confirmed in firmware source `jswrap_bangle.c`)
4. Use `setTimeout` aligned to minute boundary (not `setInterval` or continuous loops)
5. Cache all reads — minimize Storage/require() calls per draw
6. Use TTL caching for infrequent data (weather: 60min, week num: by day)
7. Minimal redraw area — don't overdraw widget regions
8. Short/efficient locale format (`1` parameter)
9. Event-driven state detection — use `Bangle.on('step')`, `Bangle.on('charging')`, `Bangle.on('lcdPower')` instead of polling
10. Draw overlays (charging icon) outside main try/catch so they always render
11. **Partial redraws** — track last values, only clear+redraw changed elements (v0.19)
12. **Never `g.reset()` in draw()** — Bangle.setUI already calls it at init; set state explicitly per section
13. **Never full-screen clear per draw** — clear only the region behind the changed element
14. **Cache font heights at init** — don't call `g.setFont()`/`getFontHeight()` per draw
15. **Cache static geometry** — `W`, `H`, `cx`, `gap`, `bh`, `th`, `sh` at init, never recalculate
16. **Use `g.theme.fg` / `g.theme.bg`** — hardcoded colors break on dark theme
17. **Skip weather redraw when unchanged** — track display string, only redraw when code or temp changes
18. **BLE connection interval** — `NRF.setConnectionInterval(4000)` overrides Espruino auto-adjustment (7.5ms↔200ms) with fixed 4s interval; saves ~0.3-0.4mA; safe when notifications unused and weather updates hourly (v0.38)

## 20. Widget Case Study: widopenweather

### Project Overview
- **Repository**: https://github.com/fozzy-ag/widopenweather
- **Purpose**: Display OpenWeatherMap temperature + weather icon in widget bar
- **Pattern**: Header (red) + Content (white) — borrowed from widcw/widcal

### Key Discoveries
1. **No `setUI()` for widgets** — framework manages lifecycle; don't call it
2. **No `setInterval()` in widgets** — framework calls `draw()` when needed
3. **Don't need `Bangle.loadWidgets()`** — framework auto-loads `.wid.js` files
4. **Widget draws on boot** — but only after `Bangle.loadWidgets()` is called by parent app
5. **Temperature storage format**: Kelvin (raw OWM API default, no units param in owmweather)
6. **Kelvin → Celsius**: `Math.round(temp - 273.15)` — don't use `locale.temp()` (encoding issues show Ä/Ö)
7. **Degree symbol problems**: Some fonts render ° as A/Ä — show digits only for reliability
8. **Empty `icon`/`author` fields** in metadata.json can cause issues — remove if not needed
9. **Orphaned code removal**: Don't leave `dirty`, `lcdPower` variables that aren't used — wastes memory
10. **Cached palettes**: Create once at startup (e.g., `paletteClear: require("heatshrink").decompress(...)`) — zero allocation per draw

### File Structure
```
widopenweather/
  widopenweather.js    Widget source (22×24px, no setUI, no timers)
  metadata.json        type:"widget", dependencies:{"owmweather":"app"}
  README.md            Credits to weather, widcw, widcal, owmweather
  screenshot.png       176×176 render showing widget context
```

### OWM Weather Icon Drawing
- Source: owmweather `lib.js` — efficient bitmap drawing using heatshrink-compressed icons
- Codes 200–804 map to specific weather conditions (see Section 9)
- Palettes cached at startup — `paletteSunny`, `paletteCloudy`, etc.
- Each palette is 2 colors: `palette[0]` = background, `palette[1]` = foreground

### GitHub Workflow
1. Create repo on GitHub (web UI)
2. Clone to local machine
3. Push commits with `git push`
4. README auto-renders on GitHub (Markdown)

### Credits Required
- **weather** by rigrig — original weather widget
- **widcw** by avanc — calendar week widget (header/content pattern)
- **widcal** by rigrig — calendar widget (layout template)
- **owmweather** by halemmerich — OWM weather provider (icon drawing code)

---

*Update this document as new discoveries are made during development.*
