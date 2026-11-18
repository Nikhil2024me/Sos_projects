#!/usr/bin/env node
/**
 * Live test for the NASA GPM IMERG rainfall proxy.
 * Requires: node serve.js 5173
 * Run: node test/gpm-check.js
 *
 * If the Earthdata account has not yet approved the GES DISC EULA, the test
 * verifies the clear setup error and exits successfully with a note. Once the
 * approval is done it verifies the real rainfall payload and its cache.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const config = require("../config");
const gpm = require("../gpm");

const BASE = (process.env.API_BASE || "http://127.0.0.1:5173").replace(/\/+$/, "");
const OUT = path.join(__dirname, "gpm-report.json");
const DISTRICT = process.env.GPM_DISTRICT || "bastar";
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

  /* ---- Configuration without exposing the token ---- */
  assert(config.gpm && config.gpm.collectionConceptId, "config includes the GPM collection");
  assert(config.gpm.dataset === "GPM_3IMERGDE.07", "config uses IMERG Early Run daily", config.gpm.dataset);
  assert(config.gpm.cacheMinutes >= 60, "GPM cache covers the daily update", config.gpm.cacheMinutes + " minutes");
  assert(/approve_app\?client_id=/.test(config.gpm.approvalUrl || ""), "config includes the GES DISC approval URL");
  assert(!/eyJ0eXAi/.test(fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8")), "Earthdata token is not in browser config.js");

  /* ---- Offline parser and grid maths ---- */
  const sample = [
    "precipitation.precipitation[0][2618][1088], 0.0, 1.2, 2.5, 0.4, 0.0",
    "precipitation.precipitation[0][2619][1088], -9999.0, 3.1, 4.2, 0.0, 0.0",
    "precipitation.precipitation[0][2620][1088], 0.5, 0.6, 0.7, 0.8, 0.9"
  ].join("\n");
  const parsed = gpm._internal.parseAscii(sample);
  assert(parsed.length === 14, "OPeNDAP ASCII parser keeps every non-fill cell", parsed.length + " values");
  assert(Math.abs(parsed[0]) < 1e-6 && parsed[1] === 1.2, "parser reads values after the row header", parsed.slice(0, 3).join(", "));
  assert(!parsed.some((value) => value <= -9998), "parser drops the -9999 fill value");

  const sampleRegion = config.regions.filter((item) => item.id === DISTRICT)[0] || config.regions[0];
  const subset = gpm._internal.subsetUrl({ opendapUrl: "https://example.test/granule" }, sampleRegion);
  const decoded = decodeURIComponent(subset.url);
  assert(decoded.indexOf(".ascii?precipitation") !== -1, "GPM subset URL requests ASCII precipitation");
  assert(/\[0:1:0\]/.test(decoded), "GPM subset keeps a single time step");
  assert(subset.lat0 <= subset.latIndex && subset.latIndex <= subset.lat1, "GPM latitude index is inside the sample box");
  assert(subset.lon0 <= subset.lonIndex && subset.lonIndex <= subset.lon1, "GPM longitude index is inside the sample box");

  /* ---- Private files ---- */
  const secrets = await request("/server-secrets.js");
  assert(secrets.status === 404, "server-secrets.js is not served", String(secrets.status));
  const apis = await request("/apis.txt");
  assert(apis.status === 404, "apis.txt is not served", String(apis.status));
  const apisDot = await request("/./apis.txt");
  assert(apisDot.status === 404, "normalized apis.txt path is blocked", String(apisDot.status));

  /* ---- Parameter handling ---- */
  const missing = await getJson("/api/gpm");
  assert(missing.result.status === 400, "GET /api/gpm without district returns 400", String(missing.result.status));

  const unknown = await getJson("/api/gpm?district=atlantis");
  assert(unknown.result.status === 404, "unknown district returns 404", String(unknown.result.status));
  assert(unknown.json && unknown.json.error === "unknown_district", "unknown district error is labelled", unknown.json && unknown.json.error);

  /* ---- One district, twice ---- */
  const first = await getJson("/api/gpm?district=" + encodeURIComponent(DISTRICT));
  assert(first.result.cors === "*", "GPM endpoint sends CORS header");

  if (first.result.status === 403 && first.json && first.json.error === "eula_required") {
    pass("GPM endpoint returns a clear EULA setup message", first.json.message);
    assert(/approve_app\?client_id=/.test(first.json.approvalUrl || ""), "EULA error includes the approval link");
    note("NASA GPM is not live yet. Approve the GES DISC EULA at " + config.gpm.approvalUrl + " and run this test again.");
  } else {
    assert(first.result.status === 200, "GET /api/gpm returns 200", String(first.result.status));
    assert(first.result.type.indexOf("application/json") !== -1, "GPM endpoint returns JSON", first.result.type);

    if (first.result.status !== 200 || !first.json) {
      throw new Error("GPM endpoint did not return JSON (HTTP " + first.result.status + ")");
    }

    const rain = first.json;
    assert(rain.v === 1, "GPM payload has version 1");
    assert(rain.provider === "NASA GPM", "GPM payload names NASA GPM", rain.provider);
    assert(rain.dataset === config.gpm.dataset, "GPM payload names the dataset", rain.dataset);
    assert(rain.district && rain.district.id === DISTRICT, "GPM payload is for the requested district", rain.district && rain.district.id);

    if (rain.available) {
      assert(/^\d{4}-\d{2}-\d{2}$/.test(rain.date || ""), "GPM includes the observation date", rain.date);
      assert(Number.isFinite(rain.rainfallMm) && rain.rainfallMm >= 0, "GPM rainfall is numeric", String(rain.rainfallMm));
      assert(Number.isFinite(rain.maxMm) && rain.maxMm >= rain.rainfallMm, "GPM max cell is at least the mean", String(rain.maxMm));
      assert(rain.cells > 0 && rain.cells <= 121, "GPM sample has a small cell count", String(rain.cells));
      assert(rain.wetCells >= 0 && rain.wetCells <= rain.cells, "GPM wet-cell count is valid", rain.wetCells + "/" + rain.cells);
      assert(/0\.1/.test(rain.grid || ""), "GPM reports the 0.1-degree grid", rain.grid);
      assert(rain.latencyHours == null || rain.latencyHours >= 0, "GPM latency is not negative", String(rain.latencyHours));
      note("GPM rainfall for " + rain.district.name + " on " + rain.date + ": " + rain.rainfallMm +
        " mm (max " + rain.maxMm + " mm), " + rain.wetCells + "/" + rain.cells + " wet cells");

      const second = await getJson("/api/gpm?district=" + encodeURIComponent(DISTRICT));
      assert(second.result.status === 200, "second GPM request returns 200", String(second.result.status));
      if (second.json) {
        assert(second.json.cached === true, "second GPM request is served from cache");
        assert(second.json.rainfallMm === rain.rainfallMm, "cached GPM rainfall matches", String(second.json.rainfallMm));
      }
    } else {
      note("GPM returned no rainfall reading: " + rain.reason + " — " + rain.message);
    }
  }

  /* ---- Index lookup ---- */
  const districts = await getJson("/api/districts");
  const entry = districts.json && districts.json.districts.filter((item) => item.id === DISTRICT)[0];
  if (entry) {
    const byIndex = await getJson("/api/gpm?district=" + entry.index);
    if (byIndex.result.status === 403 && byIndex.json && byIndex.json.error === "eula_required") {
      pass("district index reaches the GPM endpoint (EULA pending)", String(byIndex.result.status));
    } else {
      assert(byIndex.result.status === 200, "district index works for GPM", String(byIndex.result.status));
      assert(byIndex.json && byIndex.json.district.id === DISTRICT, "index resolves to the same GPM district", byIndex.json && byIndex.json.district.id);
    }
  } else {
    fail("district list does not include " + DISTRICT);
  }

  /* ---- Health ---- */
  const health = await getJson("/api/health");
  assert(health.json && health.json.gpm && health.json.gpm.configured === true, "health reports GPM configured");
  assert(health.json && health.json.gpm.dataset === config.gpm.dataset, "health reports the GPM dataset", String(health.json && health.json.gpm.dataset));
  if (health.json && health.json.gpm.tokenExpiresAt) {
    const expires = Date.parse(health.json.gpm.tokenExpiresAt);
    assert(Number.isFinite(expires) && expires > Date.now(), "Earthdata token has not expired", health.json.gpm.tokenExpiresAt);
  }

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
    eulaPending: notes.some((message) => /EULA/.test(message))
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log("\n" + (failed.length ? "FAILED" : "PASSED") + " - " + report.passed + " checks passed, " + failed.length + " failed.");
  console.log("Report: test/gpm-report.json");
  process.exitCode = failed.length ? 1 : 0;
})().catch((error) => {
  console.error("\nGPM test crashed:", error.message);
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
  console.log("Report: test/gpm-report.json");
  process.exitCode = 1;
});
