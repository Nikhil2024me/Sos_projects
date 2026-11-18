#!/usr/bin/env node
/**
 * Live test for the ESP32 / LoRa device feed.
 * Requires: node serve.js 5173
 * Run: node test/api-check.js
 *
 * The first /api/lora call can take ~20 seconds while the server fetches the
 * NASA FIRMS, Open-Meteo and USGS feeds.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const feed = require("../feed");

const BASE = (process.env.API_BASE || "http://127.0.0.1:5173").replace(/\/+$/, "");
const OUT = path.join(__dirname, "api-report.json");
const checks = [];
const notes = [];

function pass(name, detail) {
  checks.push({ ok: true, name, detail: detail || "" });
  console.log("PASS  " + name + (detail ? " — " + detail : ""));
}
function fail(name, detail) {
  checks.push({ ok: false, name, detail: detail || "" });
  console.log("FAIL  " + name + (detail ? " — " + detail : ""));
}
function assert(condition, name, detail) {
  if (condition) pass(name, detail);
  else fail(name, detail);
}
function note(message) {
  notes.push(message);
  console.log("note  " + message);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(pathname, options) {
  const response = await fetch(BASE + pathname, options || {});
  const text = await response.text();
  return {
    status: response.status,
    type: response.headers.get("content-type") || "",
    cors: response.headers.get("access-control-allow-origin"),
    retryAfter: response.headers.get("retry-after"),
    text
  };
}

async function getJson(pathname) {
  const result = await request(pathname);
  let json = null;
  try {
    json = JSON.parse(result.text);
  } catch {
    // The assertion below reports the invalid body.
  }
  return { result, json };
}

async function waitForFeed() {
  for (let attempt = 1; attempt <= 60; attempt++) {
    try {
      const { result, json } = await getJson("/api/alerts");
      if (result.status === 200 && json && Array.isArray(json.districts) && json.districts.length === 30) {
        return { result, json, attempts: attempt };
      }
      note("feed not ready (HTTP " + result.status + "), retry " + attempt + "/60");
    } catch (error) {
      note("feed not reachable (" + error.message + "), retry " + attempt + "/60");
    }
    await sleep(1000);
  }
  throw new Error("Feed did not become ready within 60 seconds. Is node serve.js running?");
}

(async () => {
  console.log("Testing " + BASE + "\n");

  /* ---- Health before the first fetch ---- */
  const healthBefore = await getJson("/api/health");
  assert(healthBefore.result.status === 200, "GET /api/health returns 200");
  assert(healthBefore.json && healthBefore.json.app === "Adivasi Suraksha", "health identifies the app");
  assert(healthBefore.json && healthBefore.json.districts === 30, "health reports 30 districts");
  assert(healthBefore.result.cors === "*", "API sends CORS header");

  /* ---- Warm the feed ---- */
  const feedStart = Date.now();
  const all = await waitForFeed();
  const allJson = all.json;
  const warmSeconds = ((Date.now() - feedStart) / 1000).toFixed(1);
  note("first full feed ready in " + warmSeconds + "s (attempt " + all.attempts + ")");

  assert(all.result.status === 200, "GET /api/alerts returns 200");
  assert(allJson.v === 1, "alerts payload has version 1");
  assert(!Number.isNaN(Date.parse(allJson.generatedAt)), "generatedAt is a valid ISO time", allJson.generatedAt);
  assert(typeof allJson.stale === "boolean", "stale flag present", String(allJson.stale));
  assert(allJson.sources && allJson.sources.firms, "source status present", JSON.stringify(allJson.sources));
  assert(allJson.districts.length === 30, "all 30 districts returned");

  const indexes = allJson.districts.map((d) => d.index).sort((a, b) => a - b);
  assert(indexes.every((n, i) => n === i + 1), "district indexes are 1..30");
  const ids = new Set(allJson.districts.map((d) => d.id));
  assert(ids.size === 30, "district ids are unique", String(ids.size));

  const packets = allJson.districts.map((d) => d.packet);
  const uniquePackets = new Set(packets);
  assert(uniquePackets.size === 30, "each district has its own packet", uniquePackets.size + "/30");
  assert(packets.every((p) => /^AS1,\d{2},[0-3],[0-3]{5},\d{6}$/.test(p)), "all-district packets use AS1 (no air digit)");

  const sizes = packets.map((p) => Buffer.byteLength(p, "utf8"));
  const maxSize = Math.max(...sizes);
  assert(maxSize <= 51, "all packets fit one LoRa frame (≤ 51 bytes)", "max " + maxSize + " bytes");

  let decodeFailures = 0;
  let severityMismatches = 0;
  allJson.districts.forEach((district) => {
    const decoded = feed.decodeLoraPacket(district.packet);
    if (!decoded.valid || decoded.districtId !== district.id || decoded.overall !== district.severity) {
      decodeFailures += 1;
      return;
    }
    const expected = {};
    district.alerts.forEach((alert) => {
      expected[alert.hazard] = alert.severity;
    });
    feed.ALARM_HAZARDS.forEach((hazard) => {
      if ((expected[hazard] || "safe") !== decoded.hazards[hazard]) severityMismatches += 1;
    });
  });
  assert(decodeFailures === 0, "every packet decodes to the right district and severity", decodeFailures + " failures");
  assert(severityMismatches === 0, "packet hazard digits match the alert list", severityMismatches + " mismatches");

  const warnings = allJson.districts.filter((d) => d.severity === "warning" || d.severity === "severe");
  note("districts at warning+: " + (warnings.map((d) => d.name + " (" + d.severity + ")").join(", ") || "none"));
  note("sample packet: " + allJson.districts[0].name + " → " + allJson.districts[0].packet);
  note("max packet length: " + maxSize + " bytes");

  /* ---- District detail ---- */
  const target = warnings[0] || allJson.districts[0];
  const detail = await getJson("/api/alerts?district=" + encodeURIComponent(target.id));
  assert(detail.result.status === 200, "GET /api/alerts?district=<id> returns 200");
  assert(detail.json && detail.json.district.id === target.id, "detail is for the requested district", target.id);
  assert(detail.json && /^AS[12],\d{2},[0-3],[0-3]{5,6},\d{6}$/.test(detail.json.packet), "detail packet is valid AS1/AS2", detail.json && detail.json.packet);
  assert(detail.json && Array.isArray(detail.json.alerts), "detail includes an alerts array");
  assert(detail.json && detail.json.weather && detail.json.weather.now, "detail includes current weather");
  assert(detail.json && detail.json.district.index >= 1 && detail.json.district.index <= 30, "detail includes a valid packet index", String(detail.json && detail.json.district.index));

  const detailDecoded = detail.json && feed.decodeLoraPacket(detail.json.packet);
  assert(detailDecoded && detailDecoded.valid, "detail packet decodes", detailDecoded && detailDecoded.error);
  if (detail.json && detail.json.air && detail.json.air.available) {
    assert(detail.json.packet.startsWith("AS2,"), "detail uses AS2 when Ambee air is available", detail.json.packet);
    assert(detailDecoded.hazards.air === detail.json.air.severity, "AS2 air digit matches the Ambee severity", detailDecoded.hazards.air);
    assert(Number.isFinite(detail.json.air.aqi), "detail includes the Ambee AQI", String(detail.json.air.aqi));
  } else {
    assert(detail.json && detail.json.packet.startsWith("AS1,"), "detail falls back to AS1 without air data", detail.json && detail.json.packet);
    note("Ambee air was not available for the detail check: " + (detail.json && detail.json.air && detail.json.air.reason));
  }

  const byIndex = await getJson("/api/alerts/" + target.index);
  assert(byIndex.result.status === 200, "district index works in the path", "/api/alerts/" + target.index);
  assert(byIndex.json && byIndex.json.district.id === target.id, "index resolves to the same district", target.id);

  /* ---- LoRa text and JSON forms ---- */
  const loraText = await request("/api/lora?district=" + encodeURIComponent(target.id));
  assert(loraText.status === 200, "GET /api/lora returns 200");
  assert(loraText.type.startsWith("text/plain"), "LoRa endpoint is text/plain", loraText.type);
  assert(loraText.text === detail.json.packet, "text endpoint returns the same packet as district detail", JSON.stringify(loraText.text));
  assert(loraText.text.indexOf("\n") === -1, "packet text has no trailing newline");

  const loraJsonResponse = await getJson("/api/lora?district=" + encodeURIComponent(target.id) + "&format=json");
  assert(loraJsonResponse.result.status === 200, "GET /api/lora?format=json returns 200");
  assert(loraJsonResponse.json && loraJsonResponse.json.decoded && loraJsonResponse.json.decoded.valid, "JSON form includes a valid decoded packet");
  assert(loraJsonResponse.json && loraJsonResponse.json.packet === loraText.text, "JSON form packet matches the text form");
  assert(loraJsonResponse.json && loraJsonResponse.json.bytes <= 51, "JSON form reports packet bytes", String(loraJsonResponse.json && loraJsonResponse.json.bytes));
  assert(loraJsonResponse.json && Object.prototype.hasOwnProperty.call(loraJsonResponse.json, "air"), "JSON form includes the Ambee air summary");

  /* ---- Ambee air quality ---- */
  const air = await getJson("/api/air?district=" + encodeURIComponent(target.id));
  assert(air.result.status === 200, "GET /api/air returns 200", String(air.result.status));
  assert(air.json && air.json.provider === "Ambee", "air payload names Ambee", air.json && air.json.provider);
  assert(air.json && air.json.district && air.json.district.id === target.id, "air payload is for the requested district", target.id);
  assert(air.json && air.json.quota && Number.isFinite(air.json.quota.used) && Number.isFinite(air.json.quota.limit), "air payload includes the daily quota", JSON.stringify(air.json && air.json.quota));
  assert(air.json && air.json.quota.limit <= 80, "air daily guard is at most 80 calls", String(air.json && air.json.quota.limit));
  if (air.json && air.json.available) {
    assert(Number.isFinite(air.json.aqi) && air.json.aqi >= 0, "air payload includes a numeric AQI", String(air.json.aqi));
    assert(typeof air.json.categoryKey === "string" && air.json.categoryKey.length > 0, "air payload includes an AQI category", air.json.categoryKey);
    assert(["safe", "watch", "warning", "severe"].indexOf(air.json.severity) !== -1, "air payload maps AQI to a severity", air.json.severity);
    note("air quality for " + target.name + ": AQI " + air.json.aqi + " (" + air.json.category + ")");
  } else {
    note("air endpoint returned no station reading: " + air.json.reason);
  }

  const airUnknown = await getJson("/api/air?district=atlantis");
  assert(airUnknown.result.status === 404, "unknown district returns 404 for air", String(airUnknown.result.status));
  assert(airUnknown.json && airUnknown.json.error === "unknown_district", "air error is labelled", airUnknown.json && airUnknown.json.error);

  const airMissing = await getJson("/api/air");
  assert(airMissing.result.status === 400, "GET /api/air without district returns 400", String(airMissing.result.status));

  /* ---- NASA GPM IMERG observed rainfall ---- */
  const gpm = await getJson("/api/gpm?district=" + encodeURIComponent(target.id));
  if (gpm.result.status === 403 && gpm.json && gpm.json.error === "eula_required") {
    pass("GPM endpoint reports the one-time EULA setup", gpm.json.message);
    assert(/approve_app\?client_id=/.test(gpm.json.approvalUrl || ""), "GPM EULA error includes the approval link");
    note("NASA GPM data is waiting for GES DISC EULA approval; the five-hazard feed and LoRa packet are unaffected.");
  } else {
    assert(gpm.result.status === 200, "GET /api/gpm returns 200", String(gpm.result.status));
    assert(gpm.json && gpm.json.provider === "NASA GPM", "GPM payload names NASA GPM", gpm.json && gpm.json.provider);
    assert(gpm.json && gpm.json.district && gpm.json.district.id === target.id, "GPM payload is for the requested district", target.id);
    if (gpm.json && gpm.json.available) {
      assert(/^\d{4}-\d{2}-\d{2}$/.test(gpm.json.date || ""), "GPM payload includes the observation date", gpm.json.date);
      assert(Number.isFinite(gpm.json.rainfallMm) && gpm.json.rainfallMm >= 0, "GPM payload includes rainfall in mm", String(gpm.json.rainfallMm));
      assert(Number.isFinite(gpm.json.maxMm) && gpm.json.maxMm >= gpm.json.rainfallMm, "GPM max cell is at least the mean", String(gpm.json.maxMm));
      assert(gpm.json.cells > 0 && gpm.json.wetCells >= 0 && gpm.json.wetCells <= gpm.json.cells, "GPM wet-cell counts are valid", gpm.json.wetCells + "/" + gpm.json.cells);
      note("GPM rainfall for " + target.name + " on " + gpm.json.date + ": " + gpm.json.rainfallMm + " mm (max " + gpm.json.maxMm + " mm)");
      const gpmSecond = await getJson("/api/gpm?district=" + encodeURIComponent(target.id));
      assert(gpmSecond.json && gpmSecond.json.cached === true, "second GPM request is served from cache");
    } else {
      note("GPM endpoint returned no rainfall reading: " + (gpm.json && gpm.json.reason));
    }
  }

  const gpmUnknown = await getJson("/api/gpm?district=atlantis");
  assert(gpmUnknown.result.status === 404, "unknown district returns 404 for GPM", String(gpmUnknown.result.status));
  const gpmMissing = await getJson("/api/gpm");
  assert(gpmMissing.result.status === 400, "GET /api/gpm without district returns 400", String(gpmMissing.result.status));

  /* ---- Wider hazards (GDACS, NASA EONET, ReliefWeb) ---- */
  const wider = await getJson("/api/hazards?district=" + encodeURIComponent(target.id));
  assert(wider.result.status === 200, "GET /api/hazards returns 200", String(wider.result.status));
  assert(wider.json && /GDACS/.test(wider.json.provider || ""), "hazards payload names the providers", wider.json && wider.json.provider);
  assert(wider.json && wider.json.district && wider.json.district.id === target.id, "hazards payload is for the requested district", target.id);
  assert(wider.json && wider.json.sources && wider.json.sources.gdacs && wider.json.sources.eonet && wider.json.sources.reliefweb, "hazards payload reports every source");
  assert(wider.json && Array.isArray(wider.json.items), "hazards payload has an items array");
  assert(wider.json && wider.json.radiusKm > 0, "hazards payload includes the radius", String(wider.json && wider.json.radiusKm));
  if (wider.json && wider.json.items) {
    const badDistance = wider.json.items.filter((item) => item.sourceKey !== "reliefweb" && (item.distanceKm == null || item.distanceKm > wider.json.radiusKm));
    assert(!badDistance.length, "hazards keeps nearby items inside the radius", wider.json.items.length + " item(s)");
    note("wider hazards for " + target.name + ": " + wider.json.items.length + " item(s); GDACS " +
      (wider.json.sources.gdacs || {}).status + ", EONET " + (wider.json.sources.eonet || {}).status +
      ", ReliefWeb " + (wider.json.sources.reliefweb || {}).status);
  }
  if (wider.json && wider.json.sources && wider.json.sources.reliefweb) {
    if (wider.json.sources.reliefweb.configured === false) {
      assert(wider.json.sources.reliefweb.status === "not_configured", "ReliefWeb reports not_configured until an appname exists", wider.json.sources.reliefweb.status);
    } else {
      note("ReliefWeb is configured with an appname");
    }
  }

  const widerUnknown = await getJson("/api/hazards?district=atlantis");
  assert(widerUnknown.result.status === 404, "unknown district returns 404 for hazards", String(widerUnknown.result.status));
  const widerMissing = await getJson("/api/hazards");
  assert(widerMissing.result.status === 400, "GET /api/hazards without district returns 400", String(widerMissing.result.status));

  const health = await getJson("/api/health");
  assert(health.json && health.json.air && health.json.air.configured === true, "health reports Ambee as configured");
  assert(health.json && health.json.air.dailyLimit <= 80, "health reports the air daily limit", String(health.json && health.json.air.dailyLimit));
  assert(health.json && health.json.gpm && health.json.gpm.configured === true, "health reports NASA GPM as configured");
  assert(health.json && health.json.gpm.dataset === "GPM_3IMERGDE.07", "health reports the GPM dataset", String(health.json && health.json.gpm.dataset));
  assert(health.json && health.json.hazards && health.json.hazards.sources, "health reports wider-hazard status");

  /* ---- Districts list and errors ---- */
  const districts = await getJson("/api/districts");
  assert(districts.result.status === 200, "GET /api/districts returns 200");
  assert(districts.json && districts.json.count === 30 && districts.json.districts.length === 30, "district list has 30 entries");
  assert(districts.json && districts.json.districts.every((d) => d.id && d.index), "district list has ids and indexes");

  const unknown = await getJson("/api/alerts?district=atlantis");
  assert(unknown.result.status === 404, "unknown district returns 404", String(unknown.result.status));
  assert(unknown.json && unknown.json.error === "unknown_district", "unknown district error is labelled", unknown.json && unknown.json.error);

  const missing = await getJson("/api/lora");
  assert(missing.result.status === 400, "missing district returns 400", String(missing.result.status));

  const missingRoute = await getJson("/api/does-not-exist");
  assert(missingRoute.result.status === 404, "unknown API route returns 404", String(missingRoute.result.status));

  const preflight = await request("/api/lora?district=bastar", { method: "OPTIONS" });
  assert(preflight.status === 204, "OPTIONS preflight returns 204", String(preflight.status));
  assert(preflight.cors === "*", "OPTIONS preflight allows CORS");

  /* ---- Website still served ---- */
  const home = await request("/");
  assert(home.status === 200, "website still returns 200");
  assert(home.type.startsWith("text/html"), "website is still served as HTML", home.type);

  /* ---- Report ---- */
  const failed = checks.filter((c) => !c.ok);
  const report = {
    base: BASE,
    checkedAt: new Date().toISOString(),
    durationSeconds: Number(((Date.now() - feedStart) / 1000).toFixed(1)),
    passed: checks.length - failed.length,
    failed: failed.length,
    checks,
    notes,
    feed: {
      generatedAt: allJson.generatedAt,
      stale: allJson.stale,
      sources: allJson.sources,
      totalFires: allJson.totalFires,
      warningDistricts: warnings.map((d) => ({ name: d.name, severity: d.severity, packet: d.packet }))
    }
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log("\n" + (failed.length ? "FAILED" : "PASSED") + " - " + report.passed + " checks passed, " + failed.length + " failed.");
  console.log("Report: test/api-report.json");
  process.exitCode = failed.length ? 1 : 0;
})().catch((error) => {
  console.error("\nAPI test crashed:", error.message);
  const failed = checks.filter((c) => !c.ok).length + 1;
  fs.writeFileSync(OUT, JSON.stringify({
    base: BASE,
    checkedAt: new Date().toISOString(),
    passed: checks.length,
    failed,
    checks,
    notes,
    error: error.message
  }, null, 2));
  console.log("Report: test/api-report.json");
  process.exitCode = 1;
});
