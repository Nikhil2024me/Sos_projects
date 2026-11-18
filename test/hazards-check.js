#!/usr/bin/env node
/**
 * Test for the wider-hazard proxy (GDACS, NASA EONET, ReliefWeb).
 * Run: node test/hazards-check.js
 *
 * The parser checks are fully offline. The /api/hazards checks run only when
 * `node serve.js` is reachable; otherwise they are skipped with a note.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const config = require("../config");
const hazards = require("../hazards");

const BASE = (process.env.API_BASE || "http://127.0.0.1:5173").replace(/\/+$/, "");
const OUT = path.join(__dirname, "hazards-report.json");
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

const internal = hazards._internal;

/* ------------------------------------------------------------------ */
/* Offline: config and parser checks                                   */
/* ------------------------------------------------------------------ */

assert(config.hazards && config.hazards.radiusKm > 0, "hazards.radiusKm configured", String(config.hazards && config.hazards.radiusKm));
assert(/gdacs\.org\/xml\/rss\.xml/.test(config.hazards.gdacs.url), "GDACS RSS endpoint configured");
assert(/eonet\.gsfc\.nasa\.gov/.test(config.hazards.eonet.baseUrl), "NASA EONET v3 endpoint configured");
assert(/v2\/disasters/.test(config.hazards.reliefweb.baseUrl), "ReliefWeb v2 endpoint configured");
assert(!/v1\/disasters/.test(config.hazards.reliefweb.baseUrl), "ReliefWeb is not using the decommissioned v1 API");

assert(internal.severityForAlert("Red") === "severe", "GDACS Red maps to severe");
assert(internal.severityForAlert("Orange") === "warning", "GDACS Orange maps to warning");
assert(internal.severityForAlert("Green") === "watch", "GDACS Green maps to watch");

const gdacsXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:gdacs="http://www.gdacs.org" xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#" xmlns:georss="http://www.georss.org/georss">
<channel><title>Test</title>
<item>
  <title>Orange notification for tropical cyclone AKVAN-26.</title>
  <description>From 16/11/2026 to 17/11/2026 a tropical storm was active.</description>
  <link>http://www.gdacs.org/report.aspx?eventtype=TC&amp;eventid=1001351</link>
  <gdacs:iscurrent>true</gdacs:iscurrent>
  <gdacs:fromdate>Mon, 16 Nov 2026 18:00:00 GMT</gdacs:fromdate>
  <gdacs:eventid>1001351</gdacs:eventid>
  <gdacs:eventtype>TC</gdacs:eventtype>
  <gdacs:alertlevel>Orange</gdacs:alertlevel>
  <gdacs:eventname>AKVAN-26</gdacs:eventname>
  <gdacs:country>India</gdacs:country>
  <georss:point>12 87.3</georss:point>
</item>
<item>
  <title>Green forest fire notification in India</title>
  <gdacs:iscurrent>true</gdacs:iscurrent>
  <gdacs:eventtype>WF</gdacs:eventtype>
  <gdacs:alertlevel>Green</gdacs:alertlevel>
  <gdacs:country>India</gdacs:country>
  <georss:point>22.7 77.8</georss:point>
</item>
<item>
  <title>Green flood notification in Nepal</title>
  <gdacs:iscurrent>true</gdacs:iscurrent>
  <gdacs:eventtype>FL</gdacs:eventtype>
  <gdacs:alertlevel>Green</gdacs:alertlevel>
  <gdacs:country>Nepal</gdacs:country>
  <geo:Point><geo:lat>27.7</geo:lat><geo:long>85.3</geo:long></geo:Point>
</item>
<item>
  <title>Old Red earthquake in Indonesia</title>
  <gdacs:iscurrent>false</gdacs:iscurrent>
  <gdacs:eventtype>EQ</gdacs:eventtype>
  <gdacs:alertlevel>Red</gdacs:alertlevel>
  <gdacs:country>Indonesia</gdacs:country>
  <georss:point>-6.1 130.2</georss:point>
</item>
</channel></rss>`;

const gdacs = internal.parseGdacsXml(gdacsXml);
assert(gdacs.length === 2, "GDACS parser keeps Orange/Red plus Green non-wildfire events", gdacs.length + " items");
assert(gdacs.every((item) => item.sourceKey === "gdacs"), "GDACS items are tagged");
const cyclone = gdacs.find((item) => item.typeKey === "cyclone");
assert(cyclone && cyclone.severity === "warning" && cyclone.alertLevel === "Orange", "GDACS cyclone keeps its alert level", cyclone && cyclone.alertLevel);
assert(Math.abs(cyclone.lat - 12) < 0.001 && Math.abs(cyclone.lon - 87.3) < 0.001, "GDACS georss point parsed", cyclone.lat + "," + cyclone.lon);
assert(cyclone.url && cyclone.url.indexOf("eventid=1001351") !== -1, "GDACS link parsed and entities decoded", cyclone.url);
assert(!gdacs.some((item) => item.typeCode === "WF"), "GDACS green forest fire is skipped");

const eonetJson = {
  events: [
    {
      id: "EONET_1",
      title: "Tropical Cyclone Test",
      link: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1",
      categories: [{ id: "severeStorms", title: "Severe Storms" }],
      sources: [{ id: "JTWC", url: "https://example.test/storm" }],
      geometry: [
        { date: "2026-11-10T00:00:00Z", type: "Point", coordinates: [90, 15] },
        { date: "2026-11-14T00:00:00Z", type: "Point", coordinates: [88, 14] }
      ]
    },
    {
      id: "EONET_2",
      title: "Flood polygon test",
      categories: [{ id: "floods", title: "Floods" }],
      geometry: [
        { date: "2026-11-12T00:00:00Z", type: "Polygon", coordinates: [[[80, 20], [82, 20], [82, 22], [80, 22], [80, 20]]] }
      ]
    },
    { id: "EONET_3", title: "No geometry", categories: [{ id: "drought", title: "Drought" }], geometry: [] }
  ]
};
const eonet = internal.parseEonetJson(eonetJson);
assert(eonet.length === 2, "EONET parser skips events without geometry", eonet.length + " items");
const storm = eonet.find((item) => item.id === "EONET_1");
assert(storm && storm.lat === 14 && storm.lon === 88, "EONET uses the latest geometry", storm && storm.lat + "," + storm.lon);
const flood = eonet.find((item) => item.id === "EONET_2");
assert(flood && flood.typeKey === "flood" && flood.lat >= 20 && flood.lat <= 22 && flood.lon >= 80 && flood.lon <= 82, "EONET polygon position parsed inside the polygon", flood && flood.lat + "," + flood.lon);

const reliefwebJson = {
  data: [
    {
      id: 101,
      fields: {
        name: "India: Floods - Nov 2026",
        status: "ongoing",
        date: { created: "2026-11-15T00:00:00+00:00" },
        url: "https://reliefweb.int/disaster/fl-2026-000101-ind",
        country: [{ name: "India" }],
        primary_country: { name: "India" },
        type: [{ name: "Flood" }]
      }
    },
    {
      id: 102,
      fields: {
        name: "Philippines: Storm",
        status: "ongoing",
        date: { created: "2026-11-15T00:00:00+00:00" },
        country: [{ name: "Philippines" }]
      }
    },
    {
      id: 103,
      fields: {
        name: "Nepal: Past earthquake",
        status: "past",
        date: { created: "2026-10-01T00:00:00+00:00" },
        country: [{ name: "Nepal" }]
      }
    }
  ]
};
const reliefweb = internal.parseReliefWebJson(reliefwebJson);
assert(reliefweb.length === 1, "ReliefWeb keeps only current South Asia disasters", reliefweb.length + " items");
assert(reliefweb[0] && reliefweb[0].country === "India" && reliefweb[0].scope === "regional", "ReliefWeb item is regional", reliefweb[0] && reliefweb[0].country);
assert(reliefweb[0] && reliefweb[0].url === "https://reliefweb.int/disaster/fl-2026-000101-ind", "ReliefWeb link parsed");

const bastar = config.regionById.bastar;
const near = internal.withDistance(cyclone, bastar);
assert(near.distanceKm != null && near.distanceKm > 0, "distance filter computes a distance", near.distanceKm + " km");
const far = internal.withDistance({ lat: 60, lon: 10, severity: "info", date: "2026-11-01" }, bastar);
assert(far.distanceKm > config.hazards.radiusKm, "far event is outside the radius", Math.round(far.distanceKm) + " km");

const ordered = [far, near].sort(internal.compareItems);
assert(ordered[0] === near, "compareItems puts the higher severity or nearer event first");

/* ------------------------------------------------------------------ */
/* Live: /api/hazards (skipped when the server is not running)         */
/* ------------------------------------------------------------------ */

async function getJson(pathname) {
  const response = await fetch(BASE + pathname);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* reported by the assertion below */
  }
  return {
    status: response.status,
    type: response.headers.get("content-type") || "",
    cors: response.headers.get("access-control-allow-origin"),
    json
  };
}

(async () => {
  let online = true;
  try {
    const health = await getJson("/api/health");
    online = health.status === 200;
  } catch (error) {
    online = false;
    note("server not reachable at " + BASE + " (" + error.message + "); live checks skipped");
  }

  if (online) {
    const live = await getJson("/api/hazards?district=bastar");
    assert(live.status === 200, "GET /api/hazards returns 200", String(live.status));
    if (live.status === 200 && live.json) {
      assert(live.json.provider && /GDACS/.test(live.json.provider), "hazards payload names the providers", live.json.provider);
      assert(live.json.district && live.json.district.id === "bastar", "hazards payload is for the requested district");
      assert(live.json.sources && live.json.sources.gdacs && live.json.sources.eonet && live.json.sources.reliefweb, "hazards payload reports every source");
      assert(live.json.sources && live.json.sources.reliefweb && live.json.sources.reliefweb.configured === false, "ReliefWeb is not configured until an appname is set", String(live.json.sources && live.json.sources.reliefweb && live.json.sources.reliefweb.configured));
      assert(live.json.sources && live.json.sources.reliefweb && live.json.sources.reliefweb.status === "not_configured", "ReliefWeb reports not_configured", live.json.sources && live.json.sources.reliefweb && live.json.sources.reliefweb.status);
      assert(Array.isArray(live.json.items), "hazards payload has an items array");
      assert(live.json.radiusKm > 0, "hazards payload includes the radius", String(live.json.radiusKm));
      const badDistance = (live.json.items || []).filter((item) => item.sourceKey !== "reliefweb" && (item.distanceKm == null || item.distanceKm > live.json.radiusKm));
      assert(!badDistance.length, "every nearby hazard is inside the radius", (live.json.items || []).length + " items");
      note("live wider hazards: " + (live.json.items || []).length + " item(s); GDACS " + (live.json.sources.gdacs || {}).status + ", EONET " + (live.json.sources.eonet || {}).status + ", ReliefWeb " + (live.json.sources.reliefweb || {}).status);
    }

    const unknown = await getJson("/api/hazards?district=atlantis");
    assert(unknown.status === 404, "unknown district returns 404 for hazards", String(unknown.status));
    const missing = await getJson("/api/hazards");
    assert(missing.status === 400, "GET /api/hazards without district returns 400", String(missing.status));

    const health = await getJson("/api/health");
    assert(health.json && health.json.hazards && health.json.hazards.sources, "health reports wider-hazard status");
  }

  const failures = checks.filter((check) => !check.ok).length;
  fs.writeFileSync(OUT, JSON.stringify({
    base: BASE,
    online: online,
    generatedAt: new Date().toISOString(),
    failures: failures,
    checks: checks,
    notes: notes
  }, null, 2), "utf8");
  console.log("\n" + (failures ? "FAILED" : "PASSED") + " — " + checks.length + " check(s), " + failures + " failure(s). Report: test/hazards-report.json");
  process.exitCode = failures ? 1 : 0;
})();
