# Minimal Watch (minwatch)

A minimal, battery-saving watchface for [Bangle.js 2](https://banglejs.com/) smartwatch.

## Features

- **Time** — large 4x font, 24h format
- **Date** — short day + date, auto-truncates if too long for screen
- **Calendar week** — ISO week number (CW)
- **Battery bar** — 10-segment color-coded bar (red ≤20%, yellow ≤40%, green >40%)
- **Steps** — daily step count from hardware pedometer
- **Weather** — temperature + icon from [owmweather](https://banglejs.com/apps/?id=owmweather) app
- **Charging indicator** — yellow plug icon in bottom-right corner when charging

## Design Philosophy

- **Transflective LCD optimized** — light/white background reflects ambient light, reducing backlight need and saving battery
- **Minimal redraws** — updates once per minute via `setInterval`
- **Power saving** — HRM disabled, event-driven charging detection, cached storage reads
- **Robust** — per-element error isolation, one element failing won't hide others

## Installation

### Via Web Loader (recommended)
1. Open the [Bangle.js App Loader](https://banglejs.com/apps) in Chrome/Edge/Opera
2. Click **More... → Load app from URL**
3. Enter: `http://<your-termux-ip>:8080` (requires the included `serve.py` running)
4. Find "Minimal Watch" and click Install

### Manual
1. Connect to Bangle.js via Web IDE or App Loader
2. Upload `app.js` as `minwatch.app.js`
3. Upload `app-icon.js` as `minwatch.img` (with evaluate flag)

## Dependencies

- **[owmweather](https://banglejs.com/apps/?id=owmweather)** — required for weather data (optional, weather section hidden if not installed)

## Screen Layout

```
┌─────────────────┐
│   [widgets]     │
│                 │
│    14:30        │ ← Time (6x8, scale 4)
│   Fri 18/07     │ ← Date (6x8, scale 2)
│    CW 29        │ ← Calendar week
│  ▮▮▮▮▮▮▮▮▮▯    │ ← Battery bar (10 segments)
│   ⛅ 22°C       │ ← Weather icon + temp
│   1234 steps    │ ← Step count
│              ⚡ │ ← Charging indicator
└─────────────────┘
```

## Configuration

No configuration needed. Weather requires the owmweather app to be installed and configured with an OpenWeatherMap API key.

## Version History

See [ChangeLog](ChangeLog) for full version history.

Current version: **0.21**

## License

MIT
