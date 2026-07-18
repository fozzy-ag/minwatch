# Bangle.js 2 Development Reference

Living document — update as new discoveries are made. Last updated: v0.17 (2026-07-18).

---

## 1. Hardware & Display

- **Screen**: 176×176 pixels
- **Display type**: Transflective LCD (LPM013M126A) — **NOT OLED**
  - Pixel colors do NOT affect power draw directly
  - Power savings come from backlight reduction, not dark pixels
  - Lighter/white backgrounds reflect ambient light → less backlight needed → better battery
  - Therefore **light theme is the battery-saving choice** on this display
- **Widget bar**: Top of screen, approximately 24px tall
  - Use `Bangle.appRect.y` and `Bangle.appRect.h` for actual usable area (don't hardcode 24/152)
  - `Bangle.appRect` is available after `Bangle.setUI()` is called

## 2. Graphics API Gotchas

- **`g.reset()`** resets ALL state: font, color, fontAlign, etc. You must re-set everything after calling it
- **`g.setColor(color)`** uses 16-bit RGB565 format:
  - `0xF800` = red, `0x07E0` = green, `0x001F` = blue
  - `0xFFFF` = white, `0x0000` = black, `0xC618` = grey (battery bar empty)
  - `0xFE60` = yellow (battery bar low)
- **`g.fillRect(x1, y1, x2, y2)`** — coords are inclusive corners, not width/height
- **`g.clearRect()`** may not use background color — use `g.setColor(0xFFFF); g.fillRect(...)` for reliable fill
- **`g.drawString(text, x, y, true)`** — 4th param `true` draws a solid background behind text (prevents bleed-through from previous draws)
- **`g.getWidth()` / `g.getHeight()`** return screen dimensions (176×176)

## 3. Font Metrics & Alignment

- **`"6x8"` font**: 6px wide, 8px tall per character at scale 1
  - Scale 2: 12×16px per char
  - Scale 4: 24×32px per char
- **`g.setFontHeight()`**: Returns actual pixel height of current font — **use this, don't hardcode**
- **`g.setFontAlign(x, y)`**:
  - x: `-1` = left, `0` = center, `1` = right
  - y: `-1` = top, `0` = middle, `1` = bottom
  - With `setFontAlign(0, -1)`: text center-horizontally, y coord = TOP of text
- **Width calculation**: `g.stringWidth(text)` returns pixel width if needed

## 4. Layout & Centering

- **Never hardcode Y positions** — calculate dynamically:
  ```js
  var appTop = Bangle.appRect ? Bangle.appRect.y : 24;
  var appH = Bangle.appRect ? Bangle.appRect.h : H - 24;
  var totalH = th + sh + sh + bh + gap * 5;  // sum of all element heights + gaps
  var y = appTop + (appH - totalH) / 2 + 16;  // +16 is manual fine-tune offset
  ```
- **Vertical centering offset**: A +16px offset was needed for perceived centering (empirical, likely due to widget bar visual weight)
- **Horizontal centering**: Use `g.setFontAlign(0, -1)` then draw at `x = W/2` (or `W >> 1`)
- **Weather icons extend ~8px above text position** — account for this in total height calculation (add 8 to weather section height)
- **Group centering**: When icon + text are a group (e.g., weather), center the group as a whole, not individually
- **Battery bar centering**: 10 segments × 10px wide + 9 gaps × 2px = 118px total. Center offset = 59px from center

## 5. Timer & Update Behavior

- **`setTimeout` with long delays is unreliable** — JS engine may be suspended
- **`setInterval(draw, 60000)` works reliably** when clock mode is active
- **DO NOT call timer setup from inside `draw()`** — it resets the interval every update
- **Lock/LCD power handlers** (`Bangle.on('lock'...)`, `Bangle.on('lcdPower'...)`) may or may not fire depending on firmware — timer-based approach is safer
- **Keep timer logic simple**: set once at init, never touch from draw()

```js
let drawInterval;
// ... define draw() ...
Bangle.setUI({mode:"clock", remove:function() {
  if (drawInterval !== undefined) { clearInterval(drawInterval); drawInterval = undefined; }
}});
draw();
drawInterval = setInterval(draw, 60000);
```

## 6. Initialization Order

The correct order matters:

```js
// 1. Disable sensors to save power
if (Bangle.setHRMPower) Bangle.setHRMPower(0, "appname");

// 2. Set UI mode BEFORE draw() and setInterval
Bangle.setUI({mode:"clock", remove:function() { clearInterval(drawInterval); }});

// 3. Initial clear
g.setColor(0xFFFF);
g.fillRect(0, 0, g.getWidth(), g.getHeight());

// 4. Load and draw widgets
Bangle.loadWidgets();
Bangle.drawWidgets();

// 5. First draw
draw();

// 6. Start interval AFTER first draw
drawInterval = setInterval(draw, 60000);
```

- `Bangle.setUI({mode:"clock"})` tells the system this is a clock app (keeps screen on, handles button, etc.)
- Must be called **before** `draw()` and `setInterval`

## 7. Storage & Data Reading

- **`require("Storage").readJSON()` can throw** — always wrap in try/catch
- **Cache storage reads** — don't read the same file twice in one draw cycle
- **Cache `require()` calls** — store `require("locale")` result in a variable at init, not per-draw
- **Use TTL caching for infrequent data** — flash reads cost 10-50ms; don't re-read every 60s if data changes hourly
- **Weather data** (from owmweather app): `require("Storage").readJSON("weather.json")`
  - Structure: `wd.weather.temp` (Kelvin), `wd.weather.code` (OWM code)
  - Changes ~every 30 min from phone companion — cache with 5-minute TTL

```js
var lc = require("locale");
var cachedWeather = null;
var cachedWeatherTime = 0;

function getWeather() {
  var now = Date.now();
  if (cachedWeather !== null && now - cachedWeatherTime < 300000) return cachedWeather;
  var wd = null;
  try { wd = require("Storage").readJSON("weather.json"); } catch(e) {}
  var w = wd && wd.weather ? wd.weather : null;
  cachedWeather = w && w.temp !== undefined ? w : null;
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

## 10. Step Counter

- `Bangle.getStepCount()` returns total steps for the day
- No setup required — hardware pedometer runs independently
- Returns 0 if no data

## 11. Charging Detection

- **`Bangle.isCharging()`** — returns boolean, can be polled
- **`Bangle.on('charging', function(charging) {...})`** — event-based, fires on state change
- Event-driven is preferred: zero overhead when not charging
- Guard both with existence checks for emulator compatibility
- Clean up with `Bangle.removeAllListeners('charging')` in remove handler
- Note: This is only available on Bangle.js smartwatches (not emulator)
- **Call `isCharging()` AFTER `Bangle.setUI()`** — firmware may not have charging state ready before then
- **Always draw charging icon OUTSIDE the outer try/catch** — if any content error occurs, the icon still renders
- **Position icon in empty space** — below all content, avoid overlap with weather/steps text

## 12. Battery

- `E.getBattery()` returns percentage (0–100)
- Battery bar: 10 segments, 10px wide, 2px gap between segments
- Color coding: red (≤20%), yellow (≤40%), green (>40%)
- Grey (`0xC618`) for empty segments

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
  ```
- **Wrap Storage reads in try/catch** — emulator may not have all files
- `Bangle.appRect` may not be available — provide fallback (e.g., `var appTop = Bangle.appRect ? Bangle.appRect.y : 24;`)

## 15. Code Style & Performance

- **Cache everything**: locale, storage reads, font height measurements
- **TTL caching**: for data that changes rarely (weather: 5min, week number: by day), avoid repeated flash reads
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

## 16. App Loader & Distribution

### File Structure
```
minwatch/
  app.js            Main watchface code
  metadata.json     App metadata (version, dependencies, storage mapping)
  app-icon.js       JS-evaluated icon (for BangleApps)
  app.png           48×48 PNG icon (for App Loader preview)
  ChangeLog         BangleApps-format changelog (newest first, NO extension)
  CHANGELOG.md      Human-readable changelog (optional, for repo)
```

### Version Sync — CRITICAL
Version must match across ALL of these files:
1. `metadata.json` → `"version": "X.YZ"`
2. `apps.json` → entry for the app id
3. **`apps.local.json`** → entry for the app id — **THIS is what the App Loader actually reads**

### `apps.local.json` vs `apps.json`
- `loader.js` line 10: `Const.APPS_JSON_FILE = "apps.local.json";`
- The App Loader reads **`apps.local.json`**, NOT `apps.json`
- When regenerating with `generate.js`, it overwrites `apps.json` but may NOT touch `apps.local.json`
- **You must update `apps.local.json` separately**, or the App Loader shows stale version
- Closing and reopening the browser tab may still be needed (JS memory cache persists even with no-cache headers)

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

### HTTP Server for Testing
- Serve from BangleApps root directory
- Must set no-cache headers: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- Browser JS cache persists even with no-cache headers — **close tab and reopen** to see changes
- Python example: `serve.py` in app directory

## 17. Dependencies

- **owmweather** (for weather data) — listed in metadata.json `"dependencies"`
- **No other external dependencies** — all other APIs are built into Bangle.js firmware
- Weather gracefully degrades: if owmweather not installed, weather section is simply not drawn

## 18. Power Saving Checklist

1. Light/white background (transflective LCD efficiency)
2. Disable HRM with `Bangle.setHRMPower(0, "appname")`
3. Don't poll sensors unnecessarily
4. Use `setInterval` for updates (not continuous loops)
5. Cache all reads — minimize Storage/require() calls per draw
6. Use TTL caching for infrequent data (weather: 5min, week num: by day)
7. Minimal redraw area — don't overdraw widget regions
8. Short/efficient locale format (`1` parameter)
9. Event-driven state detection (charging) instead of polling
10. Draw overlays (charging icon) outside main try/catch so they always render

---

*Update this document as new discoveries are made during development.*
