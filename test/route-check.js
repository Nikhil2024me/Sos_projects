#!/usr/bin/env node
/**
 * Live test for the ISRO Bhuvan routing proxy.
 * Requires: node serve.js 5173
 * Run: node test/route-check.js
 *
 * Bhuvan access tokens expire after one day. If these tests report
 * "invalid_token", generate a fresh Routing token at
 * https://bhuvan-app1.nrsc.gov.in/api/ and update config.js.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const CONFIG = require("../config");

const BASE = (process.env.API_BASE || "http://127.0.0.1:5173").replace(/\/+$/, "");
const OUT = path.join(__dirname, "route-report.json");
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

async function request(pathname) {
  const response = await fetch(BASE + pathname);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // The assertion below reports invalid JSON.
  }
  return { status: response.status, text, json, type: response.headers.get("content-type") || "" };
}

function near(value, target, tolerance) {
  return Math.abs(Number(value) - Number(target)) <= tolerance;
}

(async () => {
  console.log("Testing " + BASE + "\n");

  /* ---- Same-state route: Hyderabad to Bhadrachalam (Telangana) ---- */
  const started = Date.now();
  const route = await request("/api/route?fromLat=17.3850&fromLon=78.4867&to=bhadrachalam");
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  note("Bhuvan route response in " + seconds + "s");

  assert(route.status === 200, "GET /api/route returns 200", String(route.status));
  assert(route.type.startsWith("application/json"), "route response is JSON", route.type);
  assert(route.json && route.json.v === 1, "route payload has version 1");
  assert(route.json && route.json.provider === "Bhuvan (ISRO)", "provider is Bhuvan (ISRO)", route.json && route.json.provider);
  assert(route.json && route.json.to && route.json.to.id === "bhadrachalam", "route resolves the requested district", route.json && route.json.to && route.json.to.name);
  assert(route.json && route.json.to && route.json.to.index === 18, "route includes the LoRa district index", String(route.json && route.json.to && route.json.to.index));
  assert(route.json && route.json.geometry && route.json.geometry.type === "MultiLineString", "geometry is a MultiLineString", route.json && route.json.geometry && route.json.geometry.type);
  assert(route.json && route.json.distanceKm > 200 && route.json.distanceKm < 400, "route distance is plausible", route.json && route.json.distanceKm + " km");
  assert(route.json && route.json.points > 100, "route contains a full road path", route.json && route.json.points + " points");

  const lines = (route.json && route.json.geometry && route.json.geometry.coordinates) || [];
  const all = lines.flat();
  const first = all[0];
  const last = all[all.length - 1];
  assert(first && near(first[0], 78.4867, 0.02) && near(first[1], 17.3850, 0.02), "route starts near the requested origin", JSON.stringify(first));
  assert(last && near(last[0], 80.89, 0.05) && near(last[1], 17.67, 0.05), "route ends at the district centre", JSON.stringify(last));

  const cached = await request("/api/route?fromLat=17.3850&fromLon=78.4867&to=bhadrachalam");
  assert(cached.status === 200 && cached.json && cached.json.cached === true, "repeated route uses the server cache");

  /* ---- A second covered state, to prove routing is not hard-coded ---- */
  const pune = await request("/api/route?fromLat=18.5204&fromLon=73.8567&to=nandurbar");
  assert(pune.status === 200 || pune.status === 422, "second state is handled cleanly", String(pune.status));
  if (pune.status === 200) {
    assert(pune.json && pune.json.distanceKm > 100, "second route has a distance", pune.json && pune.json.distanceKm + " km");
  } else {
    note("Pune to Nandurbar is outside Bhuvan coverage: " + (pune.json && pune.json.error));
  }

  /* ---- Raw coordinate form ---- */
  const raw = await request("/api/route?lat1=17.3850&lon1=78.4867&lat2=17.9689&lon2=79.5941");
  assert(raw.status === 200, "raw lat/lon route form returns 200", String(raw.status));
  assert(raw.json && raw.json.geometry && raw.json.geometry.coordinates.length > 0, "raw route has geometry");
  assert(raw.json && raw.json.distanceKm > 0, "raw route has a distance", raw.json && raw.json.distanceKm + " km");

  /* ---- Known Bhuvan limitations ---- */
  const otherState = await request("/api/route?fromLat=19.08&fromLon=82.03&to=bhadrachalam");
  assert(otherState.status === 422, "cross-state route returns 422", String(otherState.status));
  assert(otherState.json && otherState.json.error === "same_state", "cross-state error is explained", otherState.json && otherState.json.error);

  const unknown = await request("/api/route?fromLat=17.385&fromLon=78.487&to=atlantis");
  assert(unknown.status === 404, "unknown district returns 404", String(unknown.status));
  assert(unknown.json && unknown.json.error === "unknown_district", "unknown district is labelled");

  const missing = await request("/api/route?to=bhadrachalam");
  assert(missing.status === 400, "missing coordinates return 400", String(missing.status));

  const invalid = await request("/api/route?fromLat=abc&fromLon=78.487&to=bhadrachalam");
  assert(invalid.status === 400, "non-numeric coordinate returns 400", String(invalid.status));

  /* ---- Index advertises the endpoint ---- */
  const api = await request("/api");
  assert(api.status === 200 && api.json && api.json.endpoints && Object.keys(api.json.endpoints).some((key) => key.indexOf("/api/route") === 0), "API index lists the route endpoint");

  const token = CONFIG.bhuvan && CONFIG.bhuvan.key ? CONFIG.bhuvan.key : "";
  note("Bhuvan token configured: " + (token ? token.slice(0, 8) + "… (" + token.length + " chars)" : "no"));
  note("Bhuvan token expires after one day; refresh it in config.js.");
  note("Bhuvan only routes inside one state; Chhattisgarh returned no route during testing.");

  const failed = checks.filter((check) => !check.ok);
  const report = {
    base: BASE,
    checkedAt: new Date().toISOString(),
    durationSeconds: Number(seconds),
    passed: checks.length - failed.length,
    failed: failed.length,
    checks,
    notes,
    sample: route.json && {
      provider: route.json.provider,
      distanceKm: route.json.distanceKm,
      points: route.json.points,
      lines: lines.length,
      from: route.json.from,
      to: route.json.to
    }
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log("\n" + (failed.length ? "FAILED" : "PASSED") + " - " + report.passed + " checks passed, " + failed.length + " failed.");
  console.log("Report: test/route-report.json");
  process.exitCode = failed.length ? 1 : 0;
})().catch((error) => {
  console.error("\nRoute test crashed:", error.message);
  fs.writeFileSync(OUT, JSON.stringify({
    base: BASE,
    checkedAt: new Date().toISOString(),
    passed: checks.filter((check) => check.ok).length,
    failed: checks.filter((check) => !check.ok).length + 1,
    checks,
    notes,
    error: error.message
  }, null, 2));
  console.log("Report: test/route-report.json");
  process.exitCode = 1;
});
