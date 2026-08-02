{
  let drawTimeout;
  let charging = false;
  let onCharging = function(c) {
    try { charging = c; drawChargingIcon(); } catch(e) {}
  };
  let lc = require("locale");
  let storage = require("Storage");
  let cachedWeather = null;
  let cachedWeatherTime = 0;
  let cachedWeekNum = -1;
  let cachedWeekKey = "";
  let prevTimeStr = "";
  let prevDateStr = "";
  let prevCW = -1;
  let prevBat = -1;
  let prevSteps = -1;
  let cachedSteps = 0;
  let prevHadWeather = false;
  let prevWeatherStr = "";
  let prevSegments = [];
  let firstScheduled = false;

  let W = g.getWidth(), H = g.getHeight();
  let cx = W >> 1;
  let gap = 8;
  let bh = 7;
  let th = g.setFont("6x8", 4).getFontHeight();
  let sh = g.setFont("6x8", 2).getFontHeight();

  function queueDraw() {
    if (drawTimeout) clearTimeout(drawTimeout);
    drawTimeout = setTimeout(function() {
      drawTimeout = undefined;
      draw();
    }, Math.max(1, 60000 - (Date.now() % 60000)));
  }

  function getWeekNumber(d) {
    let key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
    if (key === cachedWeekKey) return cachedWeekNum;
    let date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let dayNum = date.getDay() || 7;
    date.setDate(date.getDate() + 4 - dayNum);
    let yearStart = new Date(date.getFullYear(), 0, 1);
    cachedWeekNum = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    cachedWeekKey = key;
    return cachedWeekNum;
  }

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

  function onStep() {
    try { cachedSteps = Bangle.getHealthStatus("day").steps || 0; } catch(e) {}
  }

  function drawWeatherIcon(ox, oy, code) {
    if (code === undefined || code === null) return;
    g.setColor(g.theme.fg);
    if (code === 800) {
      g.fillCircle(ox, oy, 4);
      for (let i = 0; i < 8; i++) {
        let a = i * 0.785;
        g.drawLine(ox + Math.cos(a) * 6, oy + Math.sin(a) * 6,
                   ox + Math.cos(a) * 8, oy + Math.sin(a) * 8);
      }
    } else if (code >= 801 && code <= 804) {
      g.fillCircle(ox + 4, oy - 3, 3);
      g.fillCircle(ox - 2, oy, 5);
      g.fillCircle(ox + 4, oy, 4);
    } else if (code >= 701 && code <= 741) {
      g.drawLine(ox - 6, oy - 3, ox + 6, oy - 3);
      g.drawLine(ox - 4, oy, ox + 4, oy);
      g.drawLine(ox - 6, oy + 3, ox + 6, oy + 3);
    } else if ((code >= 300 && code <= 321) || (code >= 500 && code <= 531)) {
      g.fillCircle(ox - 2, oy - 2, 4);
      g.fillCircle(ox + 3, oy - 2, 3);
      g.fillCircle(ox, oy - 4, 3);
      g.fillPoly([ox-3,oy+2, ox-2,oy+5, ox-1,oy+2]);
      g.fillPoly([ox+1,oy+3, ox+2,oy+6, ox+3,oy+3]);
    } else if (code >= 600 && code <= 622) {
      g.fillCircle(ox - 2, oy - 2, 4);
      g.fillCircle(ox + 3, oy - 2, 3);
      g.fillCircle(ox, oy - 4, 3);
      g.fillCircle(ox - 3, oy + 3, 1);
      g.fillCircle(ox + 1, oy + 4, 1);
      g.fillCircle(ox + 4, oy + 3, 1);
    } else if (code >= 200 && code <= 232) {
      g.fillCircle(ox - 2, oy - 3, 4);
      g.fillCircle(ox + 3, oy - 3, 3);
      g.fillCircle(ox, oy - 5, 3);
      g.fillPoly([ox,oy, ox-2,oy+3, ox+1,oy+3, ox-1,oy+6]);
    } else {
      g.fillCircle(ox - 2, oy, 4);
      g.fillCircle(ox + 3, oy, 3);
      g.fillCircle(ox, oy - 2, 3);
    }
  }

  function drawBatteryBar(y, filled) {
    for (let i = 0; i < 10; i++) {
      let shouldFill = i < filled;
      let color = shouldFill ? (filled <= 2 ? 0xF800 : filled <= 4 ? 0xFE60 : 0x07E0) : 0xC618;
      if (prevSegments[i] !== color) {
        g.setColor(color);
        let x = cx - 59 + i * 12;
        g.fillRect(x, y, x + 9, y + 6);
        prevSegments[i] = color;
      }
    }
  }

  function drawChargingIcon() {
    let cx2 = W - 12, cy2 = 166;
    g.setColor(g.theme.bg);
    g.fillRect(W - 22, 158, W, 175);
    if (charging) {
      g.setColor(0xFE60);
      g.fillCircle(cx2, cy2 - 3, 3);
      g.fillRect(cx2 - 1, cy2, cx2 + 1, cy2 + 6);
      g.fillPoly([cx2 - 2, cy2 + 3, cx2, cy2 + 7, cx2 + 2, cy2 + 3]);
    }
  }

  function draw() {
    try {
      let appTop = Bangle.appRect ? Math.max(Bangle.appRect.y, 24) : 24;
      let appH = Bangle.appRect ? Math.min(Bangle.appRect.h, H - 24) : H - 24;
      let date = new Date();
      let w = getWeather();
      let hasWeather = w !== null;
      let totalH = th + sh + sh + bh + (hasWeather ? sh : 0) + sh + gap * 5;
      let y = appTop + (appH - totalH) / 2;
      let layoutChanged = hasWeather !== prevHadWeather;
      prevHadWeather = hasWeather;
      let fullClear = layoutChanged || firstScheduled;
      firstScheduled = false;
      g.setFontAlign(0, -1);
      g.setColor(g.theme.fg);
      if (fullClear) g.clearRect(0, appTop, W - 1, appTop + appH - 1);
      try {
        g.setFont("6x8", 4);
        let ts = lc.time(date, 1);
        if (fullClear || ts !== prevTimeStr) {
          g.drawString(ts, cx, y, true);
          prevTimeStr = ts;
        }
        y += th + gap;
      } catch(e) {}
      try {
        g.setFont("6x8", 2);
        let dateStr = lc.dow(date, 1) + " " + lc.date(date, 1);
        if (g.stringWidth(dateStr) > W - 10) dateStr = lc.date(date, 1);
        if (g.stringWidth(dateStr) > W - 10) dateStr = lc.dow(date, 1);
        if (fullClear || dateStr !== prevDateStr) {
          if (!fullClear) g.clearRect(0, y, W - 1, y + sh - 1);
          g.drawString(dateStr, cx, y, true);
          prevDateStr = dateStr;
        }
        y += sh + gap;
      } catch(e) { g.setFontAlign(0, -1); }
      try {
        g.setFont("6x8", 2);
        let cw = getWeekNumber(date);
        if (fullClear || cw !== prevCW) {
          if (!fullClear) g.clearRect(0, y, W - 1, y + sh - 1);
          g.drawString("CW " + cw, cx, y, true);
          prevCW = cw;
        }
        y += sh + gap;
      } catch(e) { g.setFontAlign(0, -1); }
      try {
        let bat = Math.round(E.getBattery() / 10);
        if (fullClear || bat !== prevBat) {
          if (fullClear) prevSegments = [];
          if (!fullClear) g.clearRect(cx - 59, y, cx + 60, y + bh - 1);
          drawBatteryBar(y, bat);
          prevBat = bat;
        }
        y += bh + gap;
      } catch(e) {}
      try {
        if (hasWeather) {
          let wstr = w.code + "|" + Math.round(w.temp - 273.15);
          if (fullClear || wstr !== prevWeatherStr) {
            if (!fullClear) g.clearRect(0, y, W - 1, y + sh + 7);
            if (w.code !== undefined) drawWeatherIcon(cx - 24, y + 8, w.code);
            g.setFontAlign(-1, -1);
            g.setFont("6x8", 2);
            g.drawString(Math.round(w.temp - 273.15) + "\u00B0C", cx - 11, y, true);
            g.setFontAlign(0, -1);
            prevWeatherStr = wstr;
          }
          y += sh + gap;
        }
      } catch(e) { g.setFontAlign(0, -1); }
      try {
        g.setFont("6x8", 2);
        let sc = cachedSteps;
        let ss = sc + " steps";
        if (fullClear || sc !== prevSteps) {
          if (!fullClear) g.clearRect(0, y, W - 1, y + sh - 1);
          g.drawString(ss, cx, y, true);
          prevSteps = sc;
        }
      } catch(e) {}
    } catch(e) {}
    queueDraw();
  }

  let onLcdPower = function(on) {
    if (on) queueDraw();
    else { if (drawTimeout) { clearTimeout(drawTimeout); drawTimeout = undefined; } }
  };

  if (Bangle.setHRMPower) Bangle.setHRMPower(0, "minwatch");

  if (Bangle.on) Bangle.on('charging', onCharging);
  if (Bangle.on) Bangle.on('lcdPower', onLcdPower);
  if (Bangle.on) Bangle.on('step', onStep);

  Bangle.setUI({mode:"clock", remove:function() {
    if (drawTimeout !== undefined) { clearTimeout(drawTimeout); drawTimeout = undefined; }
    if (Bangle.removeListener) Bangle.removeListener('charging', onCharging);
    if (Bangle.removeListener) Bangle.removeListener('lcdPower', onLcdPower);
    if (Bangle.removeListener) Bangle.removeListener('step', onStep);
  }, redraw:draw});
  g.reset();
  if (Bangle.appRect) g.clearRect(Bangle.appRect);
  Bangle.loadWidgets();
  setTimeout(Bangle.drawWidgets, 0);
  if (Bangle.isCharging) charging = Bangle.isCharging();
  drawChargingIcon();
  onStep();
  draw();
  firstScheduled = true;
}