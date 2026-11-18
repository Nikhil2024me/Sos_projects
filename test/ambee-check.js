#!/usr/bin/env node
/**
 * Live test for the Ambee air-quality proxy.
 * Requires: node serve.js 5173
 * Run: node test/ambee-check.js
 *
 * This deliberately makes only two air requests. The server caches a district
 * for an hour, so the second request must not spend another Ambee call from
 * the small evaluation quota.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const config = require("../config");

const BASE = (process.env.API_BASE || "http://127.0.0.1:5173").replace(/\/+$/, "");
const OUT = path.join(__dirname, "ambee-report.json");
const DISTRICT = process.env.AIR_DISTRICT || "bastar";
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

async function request(pathname, options) {
  const response = await fetch(BASE + pathname, options || {});
  const text = await response.text();
  return {
    status: response.status,
    type: response.headers.get("content-type") || "",
    cors: response.headers.get("access-control-allow-origin"),
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

(async () => {
  console.log("Testing " + BASE + "\n");

  /* ---- Configuration sanity without touching the network ---- */
  assert(config.ambee && config.ambee.baseUrl, "config includes the Ambee endpoint");
  assert(config.ambee.cacheMinutes >= 1, "server cache is enabled", config.ambee.cacheMinutes + " minutes");
  assert(config.ambee.dailyLimit <= 80, "daily guard preserves part of the trial quota", String(config.ambee.dailyLimit));
  assert(!/f78034ed/.test(fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8")), "Ambee key is not in browser config.js");

  /* ---- Secret files must not be downloadable ---- */
  const secrets = await request("/server-secrets.js");
  assert(secrets.status === 404, "server-secrets.js is not served", String(secrets.status));
  const secretsCase = await request("/SERVER-SECRETS.JS");
  assert(secretsCase.status === 404, "server-secrets.js is blocked case-insensitively", String(secretsCase.status));
  const secretsDot = await request("/./server-secrets.js");
  assert(secretsDot.status === 404, "normalized secret path is blocked", String(secretsDot.status));

  /* ---- Missing and unknown district handling ---- */
  const missing = await getJson("/api/air");
  assert(missing.result.status === 400, "GET /api/air without district returns 400", String(missing.result.status));

  const unknown = await getJson("/api/air?district=atlantis");
  assert(unknown.result.status === 404, "unknown district returns 404", String(unknown.result.status));
  assert(unknown.json && unknown.json.error === "unknown_district", "unknown district error is labelled", unknown.json && unknown.json.error);

  /* ---- One district, twice: the second must be cached ---- */
  const first = await getJson("/api/air?district=" + encodeURIComponent(DISTRICT));
  assert(first.result.status === 200, "GET /api/air returns 200", String(first.result.status));
  assert(first.result.cors === "*", "air endpoint sends CORS header");
  assert(first.result.type.indexOf("application/json") !== -1, "air endpoint returns JSON", first.result.type);

  if (first.result.status !== 200 || !first.json) {
    throw new Error("Air endpoint did not return JSON (HTTP " + first.result.status + ")");
  }

  const air = first.json;
  assert(air.v === 1, "air payload has version 1");
  assert(air.provider === "Ambee", "air payload names Ambee", air.provider);
  assert(air.district && air.district.id === DISTRICT, "air payload is for the requested district", air.district && air.district.id);
  assert(air.quota && air.quota.limit === config.ambee.dailyLimit, "quota limit matches config", JSON.stringify(air.quota));
  assert(air.quota.used >= 1 && air.quota.used <= air.quota.limit, "quota usage is in range", air.quota.used + "/" + air.quota.limit);

  if (air.available) {
    assert(Number.isFinite(air.aqi) && air.aqi >= 0, "AQI is numeric", String(air.aqi));
    assert(typeof air.category === "string" && air.category.length > 1, "AQI category is present", air.category);
    assert(["good", "moderate", "sensitive", "unhealthy", "veryUnhealthy", "hazardous"].indexOf(air.categoryKey) !== -1, "AQI category key is known", air.categoryKey);
    assert(["safe", "watch", "warning", "severe"].indexOf(air.severity) !== -1, "AQI severity is valid", air.severity);
    assert(Number.isFinite(air.pm25), "PM2.5 reading is present", String(air.pm25));
    assert(air.thresholds && air.thresholds.watch === config.thresholds.air.watch, "air payload includes the AQI thresholds");
    note("air quality for " + air.district.name + ": AQI " + air.aqi + " (" + air.category + "), PM2.5 " + air.pm25);
  } else {
    note("Ambee returned no station reading: " + air.reason + " — " + air.message);
  }

  const second = await getJson("/api/air?district=" + encodeURIComponent(DISTRICT));
  assert(second.result.status === 200, "second air request returns 200", String(second.result.status));
  if (second.json) {
    assert(second.json.cached === true, "second request is served from the hour-long cache");
    assert(second.json.quota.used === air.quota.used, "cached request does not spend another Ambee call",
      air.quota.used + " → " + second.json.quota.used);
    if (air.available && second.json.available) {
      assert(second.json.aqi === air.aqi, "cached AQI matches", String(second.json.aqi));
    }
  }

  /* ---- Index lookup maps to the same district ---- */
  const districts = await getJson("/api/districts");
  const entry = districts.json.districts.filter((item) => item.id === DISTRICT)[0];
  if (entry) {
    const byIndex = await getJson("/api/air?district=" + entry.index);
    assert(byIndex.result.status === 200, "district index works for air", String(byIndex.result.status));
    assert(byIndex.json && byIndex.json.district.id === DISTRICT, "index resolves to the same air district", byIndex.json && byIndex.json.district.id);
  } else {
    fail("district list does not include " + DISTRICT);
  }

  /* ---- Health reports the Ambee state ---- */
  const health = await getJson("/api/health");
  assert(health.json && health.json.air && health.json.air.configured === true, "health reports Ambee configured");
  assert(health.json && health.json.air.cachedDistricts >= 1, "health reports cached air districts", String(health.json && health.json.air.cachedDistricts));
  assert(health.json && health.json.packetMaxBytes <= 51, "packet size limit is still respected", String(health.json && health.json.packetMaxBytes));

  /* ---- Report ---- */
  const failed = checks.filter((item) => !item.ok);
  const report = {
    base: BASE,
    checkedAt: new Date().toISOString(),
    district: DISTRICT,
    passed: checks.length - failed.length,
    failed: failed.length,
    checks,
    notes,
    air: air.available ? {
      aqi: air.aqi,
      category: air.category,
      severity: air.severity,
      pm25: air.pm25,
      station: air.station && air.station.name,
      quota: air.quota
    } : { available: false, reason: air.reason, quota: air.quota }
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log("\n" + (failed.length ? "FAILED" : "PASSED") + " - " + report.passed + " checks passed, " + failed.length + " failed.");
  console.log("Report: test/ambee-report.json");
  process.exitCode = failed.length ? 1 : 0;
})().catch((error) => {
  console.error("\nAmbee test crashed:", error.message);
  const failed = checks.filter((item) => !item.ok).length + 1;
  fs.writeFileSync(OUT, JSON.stringify({
    base: BASE,
    checkedAt: new Date().toISOString(),
    passed: checks.length,
    failed,
    checks,
    notes,
    error: error.message
  }, null, 2));
  console.log("Report: test/ambee-report.json");
  process.exitCode = 1;
});
