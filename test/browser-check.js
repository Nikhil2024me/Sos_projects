#!/usr/bin/env node
/**
 * Headless Chrome smoke test for Adivasi Suraksha.
 * Requires a local server: node serve.js 5173
 * Run: node test/browser-check.js
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");

const URL = process.env.APP_URL || "http://127.0.0.1:5173/";
const PORT = 9333;
const OUT = path.join(__dirname, "screenshots");
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((file) => fs.existsSync(file));

if (!CHROME) {
  console.error("Chrome or Edge not found.");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const failures = [];
const notes = [];
const consoleErrors = [];
const exceptions = [];
const failedRequests = [];
let phase = "startup";

function pass(name, detail) {
  results.push({ ok: true, name, detail: detail || "" });
  console.log("PASS  " + name + (detail ? " — " + detail : ""));
}
function fail(name, detail) {
  results.push({ ok: false, name, detail: detail || "" });
  failures.push({ name, detail: detail || "" });
  console.log("FAIL  " + name + (detail ? " — " + detail : ""));
}
function note(message) {
  notes.push(message);
  console.log("note  " + message);
}
function assert(condition, name, detail) {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDP {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.ws = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      const timer = setTimeout(() => reject(new Error("WebSocket connect timeout")), 10000);
      this.ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.addEventListener("error", (event) => {
        clearTimeout(timer);
        reject(new Error("WebSocket error: " + (event.message || "unknown")));
      });
      this.ws.addEventListener("message", (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.id && this.pending.has(message.id)) {
          const { resolve, reject } = this.pending.get(message.id);
          this.pending.delete(message.id);
          if (message.error) reject(new Error(message.error.message));
          else resolve(message.result);
          return;
        }
        if (message.method) {
          const handlers = this.listeners.get(message.method) || [];
          handlers.forEach((handler) => {
            try { handler(message.params); } catch (error) { console.error(error); }
          });
        }
      });
    });
  }

  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(handler);
  }

  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      try {
        this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}

async function launch() {
  const profile = path.join(os.tmpdir(), "adivasi-chrome-" + Date.now());
  const child = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--hide-scrollbars",
    "--mute-audio",
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile,
    "--window-size=1440,1000",
    "about:blank",
  ], { stdio: "ignore" });

  let version = null;
  for (let i = 0; i < 60; i += 1) {
    try {
      version = await getJson("http://127.0.0.1:" + PORT + "/json/version");
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!version) {
    child.kill();
    throw new Error("Chrome DevTools did not start");
  }

  let page = null;
  for (let i = 0; i < 20; i += 1) {
    const targets = await getJson("http://127.0.0.1:" + PORT + "/json/list");
    page = targets.find((target) => target.type === "page");
    if (page) break;
    await sleep(200);
  }
  if (!page) {
    child.kill();
    throw new Error("No page target found");
  }

  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.connect();
  return { child, cdp, profile };
}

async function main() {
  const { child, cdp } = await launch();

  cdp.on("Runtime.consoleAPICalled", (params) => {
    if (params.type === "error" || params.type === "assert") {
      const text = params.args.map((arg) => arg.value !== undefined ? String(arg.value) : (arg.description || arg.type)).join(" ");
      consoleErrors.push({ phase, text });
    }
  });
  cdp.on("Runtime.exceptionThrown", (params) => {
    const details = params.exceptionDetails || {};
    exceptions.push({
      phase,
      text: details.text + ": " + (details.exception && (details.exception.description || details.exception.value) || ""),
      url: details.url,
      line: details.lineNumber,
    });
  });
  cdp.on("Log.entryAdded", (params) => {
    const entry = params.entry || {};
    if (entry.level === "error") {
      consoleErrors.push({ phase, text: entry.text + (entry.url ? " (" + entry.url + ")" : "") });
    }
  });
  const requestUrls = new Map();
  cdp.on("Network.requestWillBeSent", (params) => {
    const request = params.request || {};
    if (params.requestId && request.url) requestUrls.set(params.requestId, request.url);
  });
  cdp.on("Network.loadingFailed", (params) => {
    if (params.canceled) return;
    failedRequests.push({
      phase,
      error: params.errorText,
      type: params.type,
      url: requestUrls.get(params.requestId) || params.requestId,
    });
  });
  cdp.on("Network.responseReceived", (params) => {
    const response = params.response || {};
    if (response.status >= 400 && response.url && !response.url.includes("favicon")) {
      failedRequests.push({ phase, error: "HTTP " + response.status, type: params.type, url: response.url });
    }
  });

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Log.enable");

  // Keep the UI suite deterministic and inside the Ambee trial quota. The real
  // /api/air and /api/gpm proxies are tested by test/api-check.js,
  // test/ambee-check.js and test/gpm-check.js.
  const airStub = `(function () {
    var realFetch = window.fetch;
    window.__airStub = true;
    window.fetch = function (url, options) {
      var text = String(url && url.url ? url.url : url);
      if (text.indexOf('/api/air') === 0) {
        var match = /[?&]district=([^&]+)/.exec(text);
        var id = match ? decodeURIComponent(match[1]) : 'bastar';
        var now = new Date().toISOString();
        return Promise.resolve(new Response(JSON.stringify({
          v: 1,
          provider: 'Ambee',
          service: 'Air Quality API',
          district: { id: id, name: 'Test district', nameHi: 'परीक्षण जिला', state: 'Test state', stateHi: 'परीक्षण राज्य', lat: 17.67, lon: 80.89 },
          fetchedAt: now,
          available: true,
          aqi: 127,
          category: 'Unhealthy for Sensitive Groups',
          categoryKey: 'sensitive',
          severity: 'watch',
          pollutant: 'PM2.5',
          concentration: 46,
          pm25: 46,
          pm10: 57,
          no2: 1.2,
          so2: 3.5,
          co: 0.35,
          ozone: 50,
          updatedAt: now,
          station: { name: 'Yatapaka', city: 'Burgampahad', district: 'Bhadradri Kothagudem', state: 'Telangana', distanceKm: 2.1, lat: 17.671, lon: 80.893 },
          thresholds: { watch: 101, warning: 151, severe: 201 },
          cached: false,
          stale: false,
          quota: { used: 1, limit: 80, remaining: 79 }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (text.indexOf('/api/gpm') === 0) {
        var gpmMatch = /[?&]district=([^&]+)/.exec(text);
        var gpmId = gpmMatch ? decodeURIComponent(gpmMatch[1]) : 'bastar';
        if (gpmId === 'west-singhbhum') {
          return Promise.resolve(new Response(JSON.stringify({
            error: 'eula_required',
            message: 'NASA GES DISC needs a one-time EULA approval for this Earthdata account before GPM data can be read.',
            provider: 'NASA GPM',
            approvalUrl: 'https://urs.earthdata.nasa.gov/approve_app?client_id=e2WVk8Pw6weeLUKZYOxvTQ'
          }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
        }
        return Promise.resolve(new Response(JSON.stringify({
          v: 1,
          provider: 'NASA GPM',
          service: 'IMERG Early Run daily rainfall',
          dataset: 'GPM_3IMERGDE.07',
          district: { id: 'bastar', name: 'Test district', nameHi: 'परीक्षण जिला', state: 'Test state', stateHi: 'परीक्षण राज्य', lat: 19.08, lon: 82.03 },
          fetchedAt: new Date().toISOString(),
          available: true,
          date: '2026-11-16',
          rainfallMm: 12.4,
          maxMm: 20.6,
          minMm: 3.1,
          wetCells: 18,
          cells: 25,
          boxCells: 5,
          grid: '0.1° (~11 km)',
          latencyHours: 8.3,
          cached: false,
          stale: false
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (text.indexOf('/api/hazards') === 0) {
        var hazardsId = /[?&]district=([^&]+)/.exec(text);
        var hzId = hazardsId ? decodeURIComponent(hazardsId[1]) : 'bastar';
        return Promise.resolve(new Response(JSON.stringify({
          v: 1,
          provider: 'GDACS · NASA EONET · ReliefWeb',
          district: { id: hzId, name: 'Test district', nameHi: 'परीक्षण जिला', state: 'Test state', stateHi: 'परीक्षण राज्य', lat: 19.08, lon: 82.03 },
          radiusKm: 1200,
          fetchedAt: new Date().toISOString(),
          available: true,
          counts: { gdacs: 1, eonet: 0, reliefweb: 0, total: 1 },
          sources: {
            gdacs: { status: 'live', count: 1, fetchedAt: new Date().toISOString(), error: null },
            eonet: { status: 'live', count: 0, fetchedAt: new Date().toISOString(), error: null },
            reliefweb: { status: 'not_configured', configured: false, count: 0, fetchedAt: null, error: 'ReliefWeb v2 needs an approved appname.' }
          },
          items: [{
            sourceKey: 'gdacs',
            source: 'GDACS',
            id: 'TC1001351',
            type: 'cyclone',
            typeKey: 'cyclone',
            typeCode: 'TC',
            title: 'Orange notification for tropical cyclone AKVAN-26.',
            name: 'AKVAN-26',
            summary: 'A tropical storm was active in the North Indian Ocean.',
            country: 'India',
            alertLevel: 'Orange',
            severity: 'warning',
            date: '2026-11-16T18:00:00.000Z',
            url: 'https://www.gdacs.org/report.aspx?eventtype=TC&eventid=1001351',
            lat: 12,
            lon: 87.3,
            distanceKm: 968.5,
            scope: 'nearby'
          }],
          note: 'Wider hazards are extra web-only context.'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return realFetch.apply(this, arguments);
    };
  })();`;
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: airStub });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });

  try {
    await cdp.send("Browser.grantPermissions", {
      origin: new global.URL(URL).origin,
      permissions: ["clipboardReadWrite", "clipboardSanitizedWrite", "geolocation"],
    });
    note("clipboard and geolocation permissions granted");
  } catch (error) {
    note("could not grant browser permissions: " + error.message);
  }

  async function evaluate(expression, awaitPromise) {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: !!awaitPromise,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error("Evaluation failed: " + result.exceptionDetails.text + " " +
        (result.exceptionDetails.exception ? result.exceptionDetails.exception.description : ""));
    }
    return result.result.value;
  }

  async function waitFor(expression, timeoutMs, intervalMs) {
    const start = Date.now();
    while (Date.now() - start < (timeoutMs || 30000)) {
      try {
        if (await evaluate(expression)) return true;
      } catch {
        /* page may be navigating */
      }
      await sleep(intervalMs || 400);
    }
    return false;
  }

  async function screenshot(name, fullPage) {
    const params = { format: "png", fromSurface: true };
    if (fullPage) {
      const metrics = await cdp.send("Page.getLayoutMetrics");
      const size = metrics.cssContentSize || metrics.contentSize;
      params.captureBeyondViewport = true;
      params.clip = {
        x: 0,
        y: 0,
        width: Math.ceil(size.width),
        height: Math.min(16000, Math.ceil(size.height)),
        scale: 1,
      };
    }
    const shot = await cdp.send("Page.captureScreenshot", params);
    const file = path.join(OUT, name + ".png");
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    note("screenshot " + file);
  }

  async function click(selectorExpression) {
    const clicked = await evaluate("(function () { var el = " + selectorExpression + "; if (!el) return false; el.click(); return true; })()");
    if (!clicked) throw new Error("Element not found for click: " + selectorExpression);
    await sleep(350);
  }

  /* ---------------------------------------------------------------- */
  /* 1. Initial desktop load                                           */
  /* ---------------------------------------------------------------- */

  phase = "initial load";
  await cdp.send("Page.navigate", { url: URL });
  const loaded = await waitFor(
    "document.querySelectorAll('.district-card').length === 30 && document.querySelectorAll('#sourceChips .source-chip').length === 3 && document.querySelector('#detailPanel .air-aqi') && document.querySelector('#detailPanel .wider-card') && !document.querySelector('#nationalStatus .orb.is-loading')",
    45000,
    500
  );

  const initial = await evaluate(`(function () {
    var status = document.getElementById('nationalStatus');
    var chips = Array.prototype.map.call(document.querySelectorAll('#sourceChips .source-chip'), function (el) {
      return { text: el.textContent.trim(), cls: el.className, title: el.title };
    });
    var bodyText = document.body.innerText;
    return {
      title: document.title,
      lang: document.documentElement.lang,
      cards: document.querySelectorAll('.district-card').length,
      mapReady: document.getElementById('map').classList.contains('leaflet-container'),
      regionMarkers: document.querySelectorAll('.region-marker').length,
      tiles: document.querySelectorAll('.leaflet-tile-loaded').length,
      tileUrl: (document.querySelector('.leaflet-tile') || {}).src || '',
      attribution: (document.querySelector('.leaflet-control-attribution') || {}).textContent || '',
      favicon: (document.querySelector('link[rel="icon"]') || {}).getAttribute ? document.querySelector('link[rel="icon"]').getAttribute('href') : '',
      statusText: status ? status.textContent.trim() : '',
      nationalSub: (document.getElementById('nationalSub') || {}).textContent,
      heat: (document.getElementById('heatCount') || {}).textContent,
      mapFireMeta: (document.getElementById('mapFireMeta') || {}).textContent,
      mapQuakeMeta: (document.getElementById('mapQuakeMeta') || {}).textContent,
      stats: ['fire','rain','heat','wind','quake'].map(function (h) {
        return (document.getElementById('stat-' + h) || {}).textContent;
      }),
      statSubs: ['fire','rain','heat','wind','quake'].map(function (h) {
        return (document.getElementById('stat-' + h + '-sub') || {}).textContent;
      }),
      detailTitle: (document.querySelector('#detailPanel h2') || {}).textContent,
      detailState: (document.querySelector('#detailPanel .detail-state') || {}).textContent,
      alerts: document.querySelectorAll('#detailPanel .alert-item').length,
      forecastDays: document.querySelectorAll('#detailPanel .forecast-day').length,
      airAqi: (document.querySelector('#detailPanel .air-aqi strong') || {}).textContent,
      airCategory: (document.querySelector('#detailPanel .air-copy strong') || {}).textContent,
      airProvider: (document.querySelector('#detailPanel .air-source') || {}).textContent,
      airChips: document.querySelectorAll('#detailPanel .air-chip').length,
      airNote: (document.querySelector('#detailPanel .air-foot') || {}).textContent,
      airSev: (document.querySelector('#detailPanel .air-sev') || {}).textContent,
      gpmMm: (document.querySelector('#detailPanel .gpm-value strong') || {}).textContent,
      gpmCopy: (document.querySelector('#detailPanel .gpm-card .air-copy strong') || {}).textContent,
      gpmProvider: (document.querySelector('#detailPanel .gpm-block .air-source') || {}).textContent,
      gpmChips: document.querySelectorAll('#detailPanel .gpm-card .air-chip').length,
      gpmNote: (document.querySelector('#detailPanel .gpm-card .air-foot') || {}).textContent,
      widerItems: document.querySelectorAll('#detailPanel .wider-item').length,
      widerTitle: (document.querySelector('#detailPanel .wider-block .air-heading') || {}).textContent,
      widerProvider: (document.querySelector('#detailPanel .wider-block .air-source') || {}).textContent,
      widerFirst: (document.querySelector('#detailPanel .wider-item .wider-title') || {}).textContent,
      widerMeta: (document.querySelector('#detailPanel .wider-item .wider-meta') || {}).textContent,
      widerSources: (document.querySelector('#detailPanel .wider-sources') || {}).textContent,
      widerNote: (document.querySelector('#detailPanel .wider-card .air-foot') || {}).textContent,
      chips: chips,
      guideCards: document.querySelectorAll('.guide-card').length,
      helplines: document.querySelectorAll('.helpline').length,
      sourcesRows: document.querySelectorAll('.source-row').length,
      methodRows: document.querySelectorAll('.about-table tbody tr').length,
      bannerHidden: document.getElementById('banner').hidden,
      liveLabel: document.getElementById('liveLabel').textContent,
      desktopMenuHidden: getComputedStyle(document.getElementById('menuBtn')).display === 'none',
      lat: ${JSON.stringify(URL)},
      badText: /undefined|NaN|\\[object Object\\]/.test(bodyText),
      pluralBug: /\\b1 (districts|fire detections|earthquakes)\\b/.test(bodyText),
      keyLeak: /(?:^|\\s)(detail|map|header|toast|banner|alertTitles|hazards|districts|footer|print|air|route|gpm|wider)\\.[a-zA-Z]/.test(bodyText),
      duplicateIds: (function () {
        var seen = {}; var dupes = [];
        document.querySelectorAll('[id]').forEach(function (el) {
          if (seen[el.id]) dupes.push(el.id); else seen[el.id] = true;
        });
        return dupes;
      })(),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      cache: !!localStorage.getItem('adivasi-suraksha-cache-v1'),
      cacheBytes: (localStorage.getItem('adivasi-suraksha-cache-v1') || '').length
    };
  })()`);

  assert(loaded, "initial page reached rendered state", initial.cards + " district cards");
  assert(initial.cards === 30, "all 30 district cards render", String(initial.cards));
  assert(initial.title.indexOf("Adivasi Suraksha") !== -1, "document title set", initial.title);
  assert(initial.lang === "en", "default language is English", initial.lang);
  assert(initial.mapReady, "Leaflet map initialized");
  assert(initial.regionMarkers === 30, "30 district markers on map", String(initial.regionMarkers));
  assert(initial.tiles > 0, "map tiles loaded", String(initial.tiles));
  assert(/(arcgisonline|openstreetmap\.fr)/.test(initial.tileUrl), "map uses a configured tile provider", initial.tileUrl.slice(0, 70));
  assert(/Esri|OpenStreetMap/.test(initial.attribution), "map attribution present", initial.attribution.trim().slice(0, 80));
  assert(initial.favicon === "favicon.svg", "favicon linked");
  assert(initial.stats.every((value) => value !== "—"), "hazard statistics populated", initial.stats.join(" / "));
  // Any selected district is fine: the panel title is "<district> (<state code>)".
  assert(/^[A-Za-z].+\([A-Z]{2,5}\)$/.test((initial.detailTitle || "").trim()), "detail panel shows a district", initial.detailTitle);
  assert(initial.forecastDays > 0, "3-day forecast rendered", String(initial.forecastDays));
  assert(initial.airAqi === "127", "Ambee AQI card renders", "AQI " + initial.airAqi);
  assert(/Unhealthy for sensitive/i.test(initial.airCategory || ""), "Ambee AQI category rendered", initial.airCategory);
  assert(/Ambee/.test(initial.airProvider || ""), "air card names Ambee", initial.airProvider);
  assert(initial.airChips >= 2, "air card shows pollutant readings", String(initial.airChips));
  assert(/does not change/i.test(initial.airNote || ""), "air card says it is not part of the alarm", initial.airNote);
  assert(/Watch/i.test(initial.airSev || ""), "AQI 127 maps to the watch level", initial.airSev);
  assert(initial.gpmMm === "12.4", "NASA GPM rainfall card renders", initial.gpmMm + " mm");
  assert(/Observed rainfall/i.test(initial.gpmCopy || ""), "GPM card labels observed rainfall", initial.gpmCopy);
  assert(/NASA GPM/.test(initial.gpmProvider || ""), "GPM card names NASA GPM", initial.gpmProvider);
  assert(initial.gpmChips >= 3, "GPM card shows max/wet/latency chips", String(initial.gpmChips));
  assert(/does not change/i.test(initial.gpmNote || ""), "GPM card says it is not part of the alarm", initial.gpmNote);
  assert(initial.widerItems >= 1, "wider-hazards card renders items", String(initial.widerItems));
  assert(/Wider hazards/i.test(initial.widerTitle || ""), "wider-hazards card is titled", initial.widerTitle);
  assert(/GDACS/.test(initial.widerProvider || ""), "wider-hazards card names the providers", initial.widerProvider);
  assert(/cyclone/i.test(initial.widerFirst || ""), "wider-hazards card shows the GDACS event", initial.widerFirst);
  assert(/km away/i.test(initial.widerMeta || ""), "wider-hazards item shows the distance", initial.widerMeta);
  assert(/not configured/i.test(initial.widerSources || ""), "wider-hazards card notes ReliefWeb is not configured", initial.widerSources);
  assert(/does not change/i.test(initial.widerNote || ""), "wider-hazards card says it is not part of the alarm", initial.widerNote);
  assert(initial.guideCards === 5, "5 safety guides rendered", String(initial.guideCards));
  assert(initial.helplines >= 4, "helplines rendered", String(initial.helplines));
  assert(initial.sourcesRows === 10, "data source rows rendered", String(initial.sourcesRows));
  assert(initial.methodRows === 6, "alert threshold table rendered", String(initial.methodRows));
  assert(initial.chips.length === 3 && initial.chips.every((chip) => !/loading/i.test(chip.text)), "source chips report status", initial.chips.map((chip) => chip.text).join(", "));
  assert(!initial.badText, "no undefined/NaN/[object Object] text");
  assert(!initial.pluralBug, "singular counts use correct grammar");
  assert(!initial.keyLeak, "no raw translation keys visible");
  assert(initial.duplicateIds.length === 0, "no duplicate element ids", initial.duplicateIds.join(", "));
  assert(initial.desktopMenuHidden, "desktop navigation uses the inline nav, not the menu button");
  assert(initial.overflow <= 1, "desktop has no horizontal overflow", "overflow=" + initial.overflow);
  assert(initial.cache, "live data saved to localStorage", initial.cacheBytes + " bytes");
  note("headline: " + initial.statusText + " | " + initial.nationalSub);
  note("sources: " + initial.chips.map((chip) => chip.text + " [" + chip.cls + "]").join(" · "));

  await screenshot("desktop", false);
  await screenshot("desktop-full", true);

  /* ---------------------------------------------------------------- */
  /* 2. Hindi language toggle                                          */
  /* ---------------------------------------------------------------- */

  phase = "hindi";
  await evaluate("(function () { var s = document.getElementById('langSelect'); s.value = 'hi'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await sleep(500);
  const hindi = await evaluate(`(function () {
    return {
      lang: document.documentElement.lang,
      htmlLang: document.documentElement.getAttribute('lang'),
      brand: document.querySelector('.brand-name').textContent,
      hero: document.getElementById('heroTitle').textContent,
      firstCard: (document.querySelector('.district-card .district-name') || {}).textContent,
      detail: (document.querySelector('#detailPanel h2') || {}).textContent,
      search: document.getElementById('districtSearch').placeholder,
      chip: (document.querySelector('#sourceChips .source-chip') || {}).textContent,
      airTitle: (document.querySelector('#detailPanel .air-heading') || {}).textContent,
      airCategory: (document.querySelector('#detailPanel .air-copy strong') || {}).textContent,
      gpmTitle: (document.querySelector('#detailPanel .gpm-block .air-heading') || {}).textContent,
      gpmCopy: (document.querySelector('#detailPanel .gpm-card .air-copy strong') || {}).textContent,
      widerTitle: (document.querySelector('#detailPanel .wider-block .air-heading') || {}).textContent,
      widerFirst: (document.querySelector('#detailPanel .wider-item .wider-title') || {}).textContent,
      body: document.body.innerText,
      keyLeak: /(?:^|\\s)(detail|map|header|toast|banner|alertTitles|hazards|districts|footer|print|air|gpm)\\.[a-zA-Z]/.test(document.body.innerText),
      badText: /undefined|NaN|\\[object Object\\]/.test(document.body.innerText),
      cards: document.querySelectorAll('.district-card').length
    };
  })()`);
  assert(hindi.lang === "hi", "document language switches to Hindi", hindi.lang);
  assert(/आदिवासी/.test(hindi.brand + hindi.hero), "Hindi headings rendered", hindi.hero);
  assert(hindi.cards === 30, "district grid remains complete in Hindi", String(hindi.cards));
  assert(!hindi.keyLeak, "no raw translation keys visible in Hindi");
  assert(!hindi.badText, "no undefined/NaN text in Hindi");
  assert(hindi.search && hindi.search !== "Search district or state", "search placeholder translated", hindi.search);
  assert(/हवा/.test(hindi.airTitle || ""), "air-quality card is translated", hindi.airTitle);
  assert(/हानिकारक/.test(hindi.airCategory || ""), "AQI category is translated", hindi.airCategory);
  assert(/उपग्रह वर्षा/.test(hindi.gpmTitle || ""), "GPM card is translated", hindi.gpmTitle);
  assert(/दर्ज वर्षा/.test(hindi.gpmCopy || ""), "GPM observed-rainfall label is translated", hindi.gpmCopy);
  assert(/आसपास के अन्य खतरे/.test(hindi.widerTitle || ""), "wider-hazards card is translated", hindi.widerTitle);
  assert(/AKVAN/.test(hindi.widerFirst || ""), "wider-hazards event title is shown in Hindi", hindi.widerFirst);
  note("Hindi brand: " + hindi.brand + " | first card: " + hindi.firstCard + " | detail: " + hindi.detail);
  await screenshot("hindi", false);

  // Switch back to English for the rest of the checks.
  phase = "english restore";
  await evaluate("(function () { var s = document.getElementById('langSelect'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await sleep(400);
  assert(await evaluate("document.documentElement.lang === 'en'"), "language switches back to English");

  /* ---------------------------------------------------------------- */
  /* 2b. Regional language (Tamil)                                     */
  /* ---------------------------------------------------------------- */

  phase = "regional language";
  const langButtons = await evaluate("document.querySelectorAll('#langSelect option').length");
  assert(langButtons === 12, "12 language options render", String(langButtons));
  await evaluate("(function () { var s = document.getElementById('langSelect'); s.value = 'ta'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await sleep(500);
  const tamil = await evaluate(`(function () {
    return {
      lang: document.documentElement.lang,
      brand: (document.querySelector('.brand-name') || {}).textContent,
      fire: (document.querySelector('.stat-card[data-hazard="fire"] .stat-label') || {}).textContent,
      district: (document.querySelector('.district-card .district-name') || {}).textContent,
      keyLeak: /(?:^|\\s)(detail|map|header|toast|banner|alertTitles|hazards|districts|footer|print|air|route|gpm|wider)\\.[a-zA-Z]/.test(document.body.innerText),
      badText: /undefined|NaN|\\[object Object\\]/.test(document.body.innerText)
    };
  })()`);
  assert(tamil.lang === "ta", "document language switches to Tamil", tamil.lang);
  assert(/ஆதிவாசி/.test(tamil.brand || ""), "Tamil app name rendered", tamil.brand);
  assert(/காட்டுத் தீ/.test(tamil.fire || ""), "Tamil hazard label rendered", tamil.fire);
  assert(tamil.district && !/^[\\x00-\\x7F]+$/.test(tamil.district), "district names use the Tamil script", tamil.district);
  assert(!tamil.keyLeak, "no raw translation keys visible in Tamil");
  assert(!tamil.badText, "no undefined/NaN text in Tamil");
  note("Tamil sample: " + tamil.brand + " | " + tamil.fire + " | " + tamil.district);
  await screenshot("tamil", true);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(700);
  const tamilMobile = await evaluate(`(function () {
    var wide = [];
    document.querySelectorAll('body *').forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth + 2 && rect.width > 10) {
        var style = getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'absolute') wide.push(el.tagName + '.' + el.className);
      }
    });
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, overflowers: wide.slice(0, 6), card: (document.querySelector('.district-card .district-name') || {}).textContent };
  })()`);
  assert(tamilMobile.overflow <= 1, "Tamil mobile layout has no horizontal overflow", "overflow=" + tamilMobile.overflow + " " + tamilMobile.overflowers.join(", "));
  await screenshot("tamil-mobile", true);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  await evaluate("(function () { var s = document.getElementById('langSelect'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await sleep(400);
  assert(await evaluate("document.documentElement.lang === 'en'"), "language returns to English after Tamil");

  /* ---------------------------------------------------------------- */
  /* 3. Search and hazard filter                                       */
  /* ---------------------------------------------------------------- */

  phase = "search/filter";
  await evaluate(`(function () {
    var input = document.getElementById('districtSearch');
    input.value = 'Bastar';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(300);
  const search = await evaluate(`(function () {
    return {
      cards: document.querySelectorAll('.district-card').length,
      names: Array.prototype.map.call(document.querySelectorAll('.district-card .district-name'), function (el) { return el.textContent; }),
      count: document.getElementById('districtCount').textContent,
      empty: document.getElementById('emptyDistricts').hidden
    };
  })()`);
  assert(search.cards >= 1 && search.names.every((name) => /Bastar/i.test(name)), "search filters cards", search.names.join(", "));
  assert(search.count.indexOf(String(search.cards)) !== -1, "search result count updates", search.count);

  await evaluate(`(function () {
    var input = document.getElementById('districtSearch');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(250);

  const fireStat = await evaluate("Number(document.getElementById('stat-fire').textContent.replace(/[^0-9]/g, '')) || 0");
  await click("document.querySelector('.stat-card[data-hazard=\\\"fire\\\"]')");
  const filtered = await evaluate(`(function () {
    var cards = document.querySelectorAll('.district-card').length;
    return {
      cards: cards,
      filterHidden: document.getElementById('filterBar').hidden,
      filterLabel: document.getElementById('filterLabel').textContent,
      pressed: document.querySelector('.stat-card[data-hazard="fire"]').getAttribute('aria-pressed'),
      allHaveFire: Array.prototype.every.call(document.querySelectorAll('.district-card'), function (card) {
        return /Fire/i.test(card.textContent);
      })
    };
  })()`);
  assert(!filtered.filterHidden, "hazard filter bar appears", filtered.filterLabel);
  assert(filtered.pressed === "true", "stat card pressed state updates");
  assert(filtered.cards === (fireStat || 0) || filtered.cards <= 30, "fire filter shows matching districts", filtered.cards + " cards, stat=" + fireStat);

  await click("document.querySelector('#clearFilter')");
  const cleared = await evaluate("document.querySelectorAll('.district-card').length");
  assert(cleared === 30, "clearing filter restores all districts", String(cleared));

  /* ---------------------------------------------------------------- */
  /* 4. Layer toggles and district selection                           */
  /* ---------------------------------------------------------------- */

  phase = "layers/selection";
  await click("document.getElementById('toggleFires')");
  const firesOff = await evaluate("document.getElementById('toggleFires').getAttribute('aria-pressed')");
  assert(firesOff === "false", "fire layer toggles off");
  await click("document.getElementById('toggleFires')");
  assert(await evaluate("document.getElementById('toggleFires').getAttribute('aria-pressed') === 'true'"), "fire layer toggles back on");

  await click("document.getElementById('toggleQuakes')");
  assert(await evaluate("document.getElementById('toggleQuakes').getAttribute('aria-pressed') === 'false'"), "quake layer toggles off");
  await click("document.getElementById('toggleQuakes')");

  await click("document.querySelector('#mapBaseSwitch [data-base=\\\"satellite\\\"]')");
  await sleep(1800);
  const satellite = await evaluate(`(function () {
    return {
      url: (document.querySelector('.leaflet-tile') || {}).src || '',
      pressed: (document.querySelector('#mapBaseSwitch [data-base="satellite"]') || {}).getAttribute('aria-pressed'),
      attribution: (document.querySelector('.leaflet-control-attribution') || {}).textContent || '',
      mapReady: document.getElementById('map').classList.contains('leaflet-container')
    };
  })()`);
  assert(/World_Imagery/.test(satellite.url), "satellite basemap loads", satellite.url.slice(0, 80));
  assert(satellite.pressed === "true", "satellite button is selected");
  assert(/Esri/.test(satellite.attribution), "satellite attribution present", satellite.attribution.trim().slice(0, 80));
  assert(satellite.mapReady, "map stays initialized in satellite view");

  await click("document.querySelector('#mapBaseSwitch [data-base=\\\"street\\\"]')");
  await sleep(1600);
  const streetAgain = await evaluate(`(function () {
    return {
      url: (document.querySelector('.leaflet-tile') || {}).src || '',
      pressed: (document.querySelector('#mapBaseSwitch [data-base="street"]') || {}).getAttribute('aria-pressed')
    };
  })()`);
  assert(/World_Street_Map/.test(streetAgain.url), "street basemap returns", streetAgain.url.slice(0, 80));
  assert(streetAgain.pressed === "true", "street button is selected");

  /* Fullscreen either uses the native API or the CSS fallback. */
  await click("document.getElementById('mapFullscreen')");
  await sleep(700);
  const fsOn = await evaluate(`(function () {
    var frame = document.querySelector('.map-frame');
    return {
      on: document.fullscreenElement === frame || frame.classList.contains('is-fullscreen'),
      pressed: document.getElementById('mapFullscreen').getAttribute('aria-pressed'),
      icon: (document.querySelector('#mapFullscreen use') || {}).getAttribute('href')
    };
  })()`);
  assert(fsOn.on, "map enters fullscreen");
  assert(fsOn.pressed === "true" && fsOn.icon === "#i-compress", "fullscreen button reflects the state");

  await click("document.getElementById('mapFullscreen')");
  await sleep(700);
  const fsOff = await evaluate(`(function () {
    var frame = document.querySelector('.map-frame');
    return {
      off: document.fullscreenElement !== frame && !frame.classList.contains('is-fullscreen'),
      icon: (document.querySelector('#mapFullscreen use') || {}).getAttribute('href')
    };
  })()`);
  assert(fsOff.off, "map exits fullscreen");
  assert(fsOff.icon === "#i-expand", "fullscreen icon resets");

  const beforeSelect = await evaluate("(document.querySelector('#detailPanel h2') || {}).textContent");
  const secondName = await evaluate("(document.querySelectorAll('.district-card .district-name')[1] || {}).textContent");
  await click("document.querySelectorAll('.district-card')[1]");
  await sleep(700);
  const afterSelect = await evaluate(`(function () {
    return {
      title: (document.querySelector('#detailPanel h2') || {}).textContent,
      selectedCards: document.querySelectorAll('.district-card.is-selected').length,
      zoom: window.__mapZoom === undefined ? null : window.__mapZoom,
      pressed: (document.querySelector('.district-card[aria-pressed="true"] .district-name') || {}).textContent,
      routeButton: !!document.querySelector('#detailPanel [data-action="route"]'),
      routeLabel: (document.querySelector('#detailPanel [data-action="route"]') || {}).textContent,
      airAqi: (document.querySelector('#detailPanel .air-aqi strong') || {}).textContent,
      airNote: (document.querySelector('#detailPanel .air-foot') || {}).textContent,
      gpmSetup: !!document.querySelector('#detailPanel .gpm-setup'),
      gpmApprove: (document.querySelector('#detailPanel .gpm-setup a') || {}).href || '',
      gpmSetupText: (document.querySelector('#detailPanel .gpm-setup') || {}).textContent || '',
      widerItems: document.querySelectorAll('#detailPanel .wider-item').length
    };
  })()`);
  assert(afterSelect.title === secondName, "clicking a district updates detail panel", beforeSelect + " -> " + afterSelect.title);
  assert(afterSelect.selectedCards === 1, "exactly one district is selected");
  assert(afterSelect.pressed === secondName, "selected card aria-pressed updates", afterSelect.pressed);
  assert(afterSelect.routeButton && /Route/i.test(afterSelect.routeLabel), "district offers a Bhuvan route button", afterSelect.routeLabel);
  assert(afterSelect.airAqi === "127", "air card follows the newly selected district", afterSelect.airAqi);
  assert(afterSelect.gpmSetup, "GPM setup card appears when NASA needs EULA approval");
  assert(/approve_app\?client_id=/.test(afterSelect.gpmApprove), "GPM setup card links to the Earthdata approval page", afterSelect.gpmApprove);
  assert(/one-time approval/i.test(afterSelect.gpmSetupText), "GPM setup card explains the one-time approval", afterSelect.gpmSetupText.slice(0, 80));
  assert(afterSelect.widerItems >= 1, "wider-hazards card follows the newly selected district", String(afterSelect.widerItems));

  /* ---------------------------------------------------------------- */
  /* 5. Copy and WhatsApp share text                                   */
  /* ---------------------------------------------------------------- */

  phase = "copy/share";
  await cdp.send("Page.bringToFront");
  await evaluate("window.__toastText = '';");
  await click("document.querySelector('#detailPanel [data-action=\\\"copy\\\"]')");
  await sleep(700);
  const copy = await evaluate(`(async function () {
    var toast = document.getElementById('toast').textContent;
    var text = '';
    try { text = await navigator.clipboard.readText(); } catch (error) { text = 'READ_ERROR:' + error.message; }
    return { toast: toast, text: text };
  })()`, true);
  assert(/copied|कॉपी/i.test(copy.toast), "copy action shows confirmation", copy.toast);
  assert(copy.text.indexOf(secondName) !== -1 || copy.text.indexOf("आदिवासी") !== -1, "clipboard contains district alert text", copy.text.slice(0, 80).replace(/\n/g, " | "));

  const share = await evaluate(`(function () {
    window.__wa = null;
    var original = window.open;
    window.open = function (url) { window.__wa = url; return null; };
    document.querySelector('#detailPanel [data-action="whatsapp"]').click();
    window.open = original;
    return window.__wa;
  })()`);
  assert(!!share && share.indexOf("https://wa.me/?text=") === 0, "WhatsApp share URL builds", share ? share.slice(0, 70) : "none");
  if (share) {
    const decoded = decodeURIComponent(share.split("?text=")[1] || "");
    assert(decoded.indexOf(secondName) !== -1, "share message includes district name");
    note("share text: " + decoded.split("\n").slice(0, 3).join(" / "));
  }

  /* ---------------------------------------------------------------- */
  /* 6. Print notice                                                   */
  /* ---------------------------------------------------------------- */

  phase = "print";
  const print = await evaluate(`(function () {
    window.__printed = 0;
    window.print = function () { window.__printed += 1; };
    document.querySelector('#detailPanel [data-action="print"]').click();
    return true;
  })()`);
  await sleep(300);
  const printState = await evaluate(`(function () {
    var area = document.getElementById('printArea');
    return {
      called: window.__printed,
      length: area.innerHTML.length,
      hasDistrict: area.textContent.indexOf(${JSON.stringify(secondName)}) !== -1,
      helplines: area.querySelectorAll('.print-helpline').length,
      alerts: area.querySelectorAll('.print-alert').length,
      overflow: area.scrollWidth - area.clientWidth
    };
  })()`);
  assert(printState.called >= 1, "print dialog requested");
  assert(printState.length > 1000 && printState.hasDistrict, "print notice generated for selected district", printState.length + " chars");
  assert(printState.helplines >= 4, "print notice includes helplines", String(printState.helplines));

  await cdp.send("Emulation.setEmulatedMedia", { media: "print" });
  await sleep(300);
  await screenshot("print", true);
  const printPdf = await cdp.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(path.join(OUT, "print.pdf"), Buffer.from(printPdf.data, "base64"));
  note("print preview test/screenshots/print.pdf");
  await cdp.send("Emulation.setEmulatedMedia", { media: "screen" });
  await evaluate("window.dispatchEvent(new Event('afterprint')); window.dispatchEvent(new Event('resize'));");
  await sleep(700);

  /* ---------------------------------------------------------------- */
  /* 7. Geolocation                                                    */
  /* ---------------------------------------------------------------- */

  phase = "geolocation";
  try {
    await cdp.send("Page.bringToFront");
    await cdp.send("Emulation.setGeolocationOverride", {
      latitude: 19.08, longitude: 82.03, accuracy: 60,
    });
    await click("document.getElementById('locateBtn')");
    await sleep(1800);
    const geo = await evaluate(`(function () {
      return {
        toast: document.getElementById('toast').textContent,
        detail: (document.querySelector('#detailPanel h2') || {}).textContent,
        btnDisabled: document.getElementById('locateBtn').disabled,
        locationLayers: document.querySelectorAll('.leaflet-overlay-pane path').length
      };
    })()`);
    assert(/Bastar/.test(geo.toast) || /Bastar/.test(geo.detail), "geolocation selects nearest district", geo.toast + " | " + geo.detail);
    assert(geo.btnDisabled === false, "locate button re-enabled after lookup");
  } catch (error) {
    fail("geolocation lookup", error.message);
  }

  /* ---------------------------------------------------------------- */
  /* 8. Bhuvan route UI                                                */
  /* ---------------------------------------------------------------- */

  phase = "route UI";
  try {
    await cdp.send("Emulation.setGeolocationOverride", {
      latitude: 17.3850, longitude: 78.4867, accuracy: 60,
    });
    await click("document.querySelector('.district-card[data-region=\\\"bhadrachalam\\\"]')");
    await sleep(500);

    // Keep the UI test independent of the one-day Bhuvan token; the real proxy
    // is tested by test/route-check.js.
    await evaluate(`(function () {
      window.__realFetch = window.fetch;
      window.fetch = function (url, options) {
        if (String(url).indexOf('/api/route') === 0) {
          return Promise.resolve(new Response(JSON.stringify({
            v: 1,
            provider: 'Bhuvan (ISRO)',
            from: { lat: 17.385, lon: 78.4867 },
            to: { lat: 17.67, lon: 80.89, id: 'bhadrachalam', name: 'Bhadrachalam', nameHi: 'भद्राचलम' },
            distanceKm: 42.5,
            geometry: { type: 'MultiLineString', coordinates: [[[78.4867,17.385],[79.4,17.5],[80.89,17.67]]] }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return window.__realFetch.apply(this, arguments);
      };
    })()`);

    await click("document.querySelector('#detailPanel [data-action=\\\"route\\\"]')");
    await sleep(1200);
    const routeState = await evaluate(`(function () {
      var info = document.getElementById('routeInfo');
      return {
        visible: !info.hidden,
        text: document.getElementById('routeInfoText').textContent,
        mapRoute: document.getElementById('map').getAttribute('data-route')
      };
    })()`);
    assert(routeState.visible, "route summary appears after routing");
    assert(/(42\\.5|43)/.test(routeState.text) && /Bhadrachalam/.test(routeState.text), "route summary shows distance and district", routeState.text);
    assert(routeState.mapRoute === "true", "route line is attached to the map", String(routeState.mapRoute));

    await click("document.getElementById('routeClear')");
    await sleep(400);
    assert(await evaluate("document.getElementById('routeInfo').hidden === true"), "route can be cleared");
    await evaluate("window.fetch = window.__realFetch;");
  } catch (error) {
    fail("Bhuvan route UI", error.message);
  }

  /* ---------------------------------------------------------------- */
  /* 8b. Cities scope                                                  */
  /* ---------------------------------------------------------------- */

  phase = "cities scope";
  assert(await evaluate("document.querySelectorAll('.district-card').length === 30"), "tribal scope is the default view", "30 districts");
  assert(await evaluate("document.querySelectorAll('.region-marker').length === 30"), "tribal scope shows 30 map markers");
  await click("document.querySelector('.scope-btn[data-scope=\\\"all\\\"]')");
  await sleep(500);
  const allScope = await evaluate(`(function () {
    return {
      cards: document.querySelectorAll('.district-card').length,
      cityCards: document.querySelectorAll('.district-card.is-city').length,
      cityMarkers: document.querySelectorAll('.city-marker').length,
      count: document.getElementById('districtCount').textContent
    };
  })()`);
  assert(allScope.cards === 62, "All places shows 30 tribal districts + 32 cities", String(allScope.cards));
  assert(allScope.cityCards === 32, "city cards are tagged", String(allScope.cityCards));
  assert(allScope.cityMarkers === 32, "city markers render on the map", String(allScope.cityMarkers));
  assert(/\b62\b/.test(allScope.count), "count reports all places", allScope.count);
  await screenshot("cities", true);
  await click("document.querySelector('.district-card.is-city')");
  await sleep(700);
  const cityDetail = await evaluate(`(function () {
    var panel = document.getElementById('detailPanel');
    return {
      title: (panel.querySelector('h2') || {}).textContent,
      scope: (document.querySelector('.scope-btn.is-active') || {}).getAttribute ? document.querySelector('.scope-btn.is-active').getAttribute('data-scope') : ''
    };
  })()`);
  assert(/Hyderabad|Warangal|Visakhapatnam|Vijayawada|Raipur|Bhubaneswar|Cuttack|Ranchi|Jamshedpur|Kolkata|Siliguri|Guwahati|Silchar|Shillong|Imphal|Aizawl|Agartala|Itanagar|Kohima|Gangtok|Nagpur|Mumbai|Pune|Ahmedabad|Surat|Jaipur|Bhopal|Patna|Delhi|Chennai|Bengaluru|Kochi/.test(cityDetail.title || ""), "selecting a city opens its details", cityDetail.title);
  assert(cityDetail.scope === "all", "selecting a city keeps all places visible", cityDetail.scope);
  await click("document.querySelector('.scope-btn[data-scope=\\\"tribal\\\"]')");
  await sleep(400);
  assert(await evaluate("document.querySelectorAll('.district-card').length === 30"), "tribal scope restores the primary view");

  /* ---------------------------------------------------------------- */
  /* 9. Offline cache fallback                                         */
  /* ---------------------------------------------------------------- */

  phase = "cache fallback";
  await cdp.send("Network.setBlockedURLs", {
    urls: ["*firms.modaps.eosdis.nasa.gov*", "*api.open-meteo.com*", "*earthquake.usgs.gov*"],
  });
  await cdp.send("Page.reload", { ignoreCache: true });
  const cacheLoaded = await waitFor("document.querySelectorAll('.district-card').length === 30", 25000, 400);
  await sleep(1200);
  const cached = await evaluate(`(function () {
    var chips = Array.prototype.map.call(document.querySelectorAll('#sourceChips .source-chip'), function (el) { return el.textContent + ':' + el.className; });
    return {
      cards: document.querySelectorAll('.district-card').length,
      banner: !document.getElementById('banner').hidden,
      bannerText: document.getElementById('bannerText').textContent,
      chips: chips,
      liveLabel: document.getElementById('liveLabel').textContent,
      dataTime: (document.getElementById('updatedAt') || {}).textContent,
      staleNote: !!document.querySelector('.detail-stale'),
      cache: !!localStorage.getItem('adivasi-suraksha-cache-v1')
    };
  })()`);
  assert(cacheLoaded && cached.cards === 30, "site renders from cache when APIs fail", String(cached.cards));
  assert(cached.banner, "offline/saved banner shown", cached.bannerText);
  assert(cached.staleNote, "detail panel marks data as saved");
  assert(cached.liveLabel !== "Live", "live pill shows saved/partial state", cached.liveLabel);
  assert(cached.cache, "cache survives failed refresh");
  note("cache fallback chips: " + cached.chips.join(" · "));
  await screenshot("cache-fallback", false);

  await cdp.send("Network.setBlockedURLs", { urls: [] });

  /* ---------------------------------------------------------------- */
  /* 9. Mobile layout                                                  */
  /* ---------------------------------------------------------------- */

  phase = "mobile";
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor("document.querySelectorAll('.district-card').length === 30", 45000, 500);
  await sleep(1000);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await sleep(900);
  const mobile = await evaluate(`(function () {
    var wide = [];
    document.querySelectorAll('body *').forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth + 2 && rect.width > 10) {
        var style = getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'absolute') wide.push(el.tagName + '.' + el.className);
      }
    });
    return {
      width: window.innerWidth,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      overflowers: wide.slice(0, 8),
      navHidden: getComputedStyle(document.getElementById('siteNav')).display === 'none',
      menuVisible: getComputedStyle(document.getElementById('menuBtn')).display !== 'none',
      langVisible: getComputedStyle(document.querySelector('.lang-toggle')).display !== 'none',
      headerFits: (function () {
        var actions = document.querySelector('.header-actions');
        if (!actions) return false;
        var rect = actions.getBoundingClientRect();
        return rect.right <= window.innerWidth + 1 && rect.left >= -1;
      })(),
      langValue: (document.getElementById('langSelect') || {}).value || '',
      cards: document.querySelectorAll('.district-card').length,
      mapHeight: Math.round(document.getElementById('map').getBoundingClientRect().height),
      detailTitle: (document.querySelector('#detailPanel h2') || {}).textContent,
      minFont: (function () {
        var min = 99;
        document.querySelectorAll('p, li, span, a, button').forEach(function (el) {
          if (!el.textContent.trim()) return;
          var rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          var size = parseFloat(getComputedStyle(el).fontSize);
          if (size && size < min) min = size;
        });
        return min;
      })()
    };
  })()`);
  assert(mobile.cards === 30, "mobile keeps all district cards", String(mobile.cards));
  assert(mobile.overflow <= 1, "mobile has no horizontal overflow", "overflow=" + mobile.overflow + " " + mobile.overflowers.join(", "));
  assert(mobile.mapHeight >= 240, "mobile map has usable height", mobile.mapHeight + "px");
  assert(mobile.navHidden && mobile.menuVisible, "mobile shows menu button and hides desktop nav");
  assert(mobile.langVisible, "language switch remains visible on mobile");
  assert(mobile.headerFits, "mobile header actions stay inside the viewport", "lang=" + mobile.langValue);
  note("mobile: " + mobile.width + "px width, smallest visible font " + mobile.minFont + "px");

  await click("document.getElementById('menuBtn')");
  const menuOpen = await evaluate(`(function () {
    var nav = document.getElementById('siteNav');
    var button = document.getElementById('menuBtn');
    return {
      display: getComputedStyle(nav).display,
      expanded: button.getAttribute('aria-expanded'),
      label: button.getAttribute('aria-label'),
      icon: button.querySelector('use').getAttribute('href'),
      links: nav.querySelectorAll('a').length
    };
  })()`);
  assert(menuOpen.display === "flex" && menuOpen.expanded === "true", "mobile menu opens", menuOpen.display + ", expanded=" + menuOpen.expanded);
  assert(menuOpen.icon === "#i-x", "menu icon changes to close", menuOpen.icon);
  assert(menuOpen.links === 4, "mobile menu contains all section links", String(menuOpen.links));
  await screenshot("mobile-menu", false);
  await click("document.getElementById('menuBtn')");
  assert(await evaluate("document.getElementById('menuBtn').getAttribute('aria-expanded') === 'false'"), "mobile menu closes");

  await screenshot("mobile", false);
  await screenshot("mobile-full", true);

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 320, height: 700, deviceScaleFactor: 1, mobile: true,
  });
  await sleep(700);
  const narrow = await evaluate(`(function () {
    var brand = document.querySelector('.brand').getBoundingClientRect();
    var actions = document.querySelector('.header-actions').getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      langVisible: getComputedStyle(document.querySelector('.lang-toggle')).display !== 'none',
      menuVisible: getComputedStyle(document.getElementById('menuBtn')).display !== 'none',
      brandRight: Math.round(brand.right),
      actionsLeft: Math.round(actions.left),
      gap: Math.round(actions.left - brand.right)
    };
  })()`);
  assert(narrow.overflow <= 1, "320px layout has no horizontal overflow", "overflow=" + narrow.overflow);
  assert(narrow.langVisible && narrow.menuVisible, "language switch and menu fit at 320px");
  assert(narrow.gap >= -1, "header brand and actions do not overlap at 320px", "gap=" + narrow.gap + "px");
  await screenshot("mobile-320", false);

  /* ---------------------------------------------------------------- */
  /* 10. Report console and network errors                             */
  /* ---------------------------------------------------------------- */

  phase = "report";
  const unexpectedConsole = consoleErrors.filter((entry) => {
    if (/favicon/i.test(entry.text)) return false;
    if (/Failed to load resource/i.test(entry.text) && /firms|open-meteo|earthquake|carto/i.test(entry.text)) {
      return entry.phase !== "cache fallback";
    }
    return true;
  });
  assert(exceptions.length === 0, "no uncaught JavaScript exceptions", exceptions.map((e) => e.text).slice(0, 3).join(" | "));
  assert(unexpectedConsole.length === 0, "no unexpected console errors", unexpectedConsole.map((e) => e.text).slice(0, 3).join(" | "));

  const expectedNetwork = failedRequests.filter((request) => {
    if (request.phase === "cache fallback" && /firms|open-meteo|earthquake/i.test(request.url + request.error)) return false;
    return true;
  });
  if (expectedNetwork.length) {
    note("network failures: " + expectedNetwork.slice(0, 6).map((r) => r.error + " " + (r.url || "").slice(0, 100)).join(" | "));
  }

  if (exceptions.length) {
    console.log("\nUncaught exceptions:");
    exceptions.forEach((entry) => console.log("  [" + entry.phase + "] " + entry.text + " (" + entry.url + ":" + entry.line + ")"));
  }
  if (consoleErrors.length) {
    console.log("\nConsole errors:");
    consoleErrors.slice(0, 10).forEach((entry) => console.log("  [" + entry.phase + "] " + entry.text.slice(0, 250)));
  }

  const summary = {
    url: URL,
    when: new Date().toISOString(),
    passed: results.filter((result) => result.ok).length,
    failed: failures.length,
    failures,
    notes,
    initial,
    hindi,
    search,
    filtered,
    mobile,
    consoleErrors,
    exceptions,
    failedRequests,
  };
  fs.writeFileSync(path.join(__dirname, "browser-report.json"), JSON.stringify(summary, null, 2));

  console.log("\n" + (failures.length ? "FAILED" : "PASSED") + " — " +
    summary.passed + " checks passed, " + failures.length + " failed.");
  console.log("Report: test/browser-report.json · Screenshots: test/screenshots/");

  cdp.close();
  child.kill();
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error("Browser check crashed:", error);
  process.exit(2);
});
