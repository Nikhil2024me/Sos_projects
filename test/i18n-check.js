#!/usr/bin/env node
/**
 * Static checks for config, translations and template keys.
 * Run: node test/i18n-check.js
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const config = require(path.join(root, "config.js"));
const i18n = require(path.join(root, "i18n.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

let failures = 0;
let warnings = 0;

function fail(message) {
  failures += 1;
  console.log("FAIL  " + message);
}

function warn(message) {
  warnings += 1;
  console.log("WARN  " + message);
}

function ok(message) {
  console.log("ok    " + message);
}

function leaves(object, prefix) {
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    const full = prefix ? prefix + "." + key : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, leaves(value, full));
    } else {
      result[full] = value;
    }
  }
  return result;
}

function getPath(object, pathString) {
  return pathString.split(".").reduce((value, key) => {
    return value && typeof value === "object" ? value[key] : undefined;
  }, object);
}

function placeholders(value) {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

/* ------------------------------------------------------------------ */
/* 1. Config sanity                                                    */
/* ------------------------------------------------------------------ */

const regions = config.regions || [];
if (regions.length !== 30) fail("expected 30 regions, found " + regions.length);
else ok("30 regions configured");

if (new Set(regions.map((r) => r.id)).size !== regions.length) fail("duplicate region id");
else ok("region ids are unique");

regions.forEach((region) => {
  ["id", "name", "state", "lat", "lon"].forEach((key) => {
    if (region[key] == null) fail("region " + region.id + " missing " + key);
  });
  if (!region.name || !region.name.en || !region.name.hi) fail("region " + region.id + " missing bilingual name");
  if (!region.state || !region.state.en || !region.state.hi) fail("region " + region.id + " missing bilingual state");
  if (!(region.lat >= 6 && region.lat <= 37 && region.lon >= 68 && region.lon <= 98)) {
    fail("region " + region.id + " is outside the FIRMS bbox");
  }
  if (region.tier !== "tribal") fail("region " + region.id + " is not tagged as tribal");
});

/* Extra monitored cities (web dashboard only; never sent over LoRa). */
const cities = config.cities || [];
if (!cities.length) {
  fail("expected monitored cities, found none");
} else {
  const seen = new Set(regions.map((r) => r.id));
  cities.forEach((city) => {
    ["id", "name", "state", "lat", "lon"].forEach((key) => {
      if (city[key] == null) fail("city " + city.id + " missing " + key);
    });
    if (!city.name || !city.name.en || !city.name.hi) fail("city " + city.id + " missing bilingual name");
    if (!city.state || !city.state.en || !city.state.hi) fail("city " + city.id + " missing bilingual state");
    if (city.tier !== "city") fail("city " + city.id + " is not tagged as a city");
    if (seen.has(city.id)) fail("city id clashes with another place: " + city.id);
    seen.add(city.id);
    if (!(city.lat >= 6 && city.lat <= 37 && city.lon >= 68 && city.lon <= 98)) {
      fail("city " + city.id + " is outside the covered bbox");
    }
  });
  if (!Array.isArray(config.places) || config.places.length !== regions.length + cities.length) {
    fail("places list is incomplete");
  } else if (!config.placeById || Object.keys(config.placeById).length !== config.places.length) {
    fail("placeById lookup is incomplete");
  } else {
    ok(cities.length + " cities monitored alongside " + regions.length + " tribal districts");
  }
}

if (!/^[a-f0-9]{32}$/i.test(config.firms.key)) fail("FIRMS key format looks wrong");
else ok("FIRMS key format valid");

const bhuvanKey = String(process.env.BHUVAN_TOKEN || (config.bhuvan && config.bhuvan.key) || "").trim();
if (!config.bhuvan || !config.bhuvan.routingUrl) fail("bhuvan.routingUrl missing");
else if (!/^[a-f0-9]{40}$/i.test(bhuvanKey)) fail("Bhuvan routing key format looks wrong");
else ok("Bhuvan routing key format valid" + (process.env.BHUVAN_TOKEN ? " (environment override)" : ""));

if (!config.quakes || !(config.quakes.baseUrl || config.quakes.url)) fail("quakes.baseUrl missing");
else if (!(config.quakes.minMagnitude >= 1)) fail("quakes.minMagnitude must be at least 1");
else if (!config.quakes.bbox || config.quakes.bbox.minLat == null) fail("quakes.bbox missing");
else ok("USGS FDSN earthquake query configured (M" + config.quakes.minMagnitude + "+)");
if (!config.weather || !config.weather.baseUrl) fail("weather.baseUrl missing");

if (!config.hazards) {
  fail("hazards config missing");
} else {
  const hz = config.hazards;
  if (!(hz.radiusKm >= 1)) fail("hazards.radiusKm must be at least 1");
  if (!(hz.maxItems >= 1)) fail("hazards.maxItems must be at least 1");
  if (!(hz.cacheMinutes >= 1)) fail("hazards.cacheMinutes must be at least 1");
  if (!hz.gdacs || !/gdacs\.org\/xml\/rss\.xml/.test(hz.gdacs.url || "")) fail("hazards.gdacs.url missing");
  else if (!hz.eonet || !/eonet\.gsfc\.nasa\.gov/.test(hz.eonet.baseUrl || "")) fail("hazards.eonet.baseUrl missing");
  else if (!hz.reliefweb || !/api\.reliefweb\.int\/v2\/disasters/.test(hz.reliefweb.baseUrl || "")) fail("hazards.reliefweb.baseUrl must use the v2 API");
  else if (!Array.isArray(hz.reliefweb.countries) || !hz.reliefweb.countries.length) fail("hazards.reliefweb.countries missing");
  else ok("wider hazards configured (GDACS RSS, NASA EONET v3, ReliefWeb v2, " + hz.radiusKm + " km radius)");
  if (/reliefweb|appname/i.test(fs.readFileSync(path.join(root, "config.js"), "utf8")) && /reliefwebAppname\s*:\s*"[^"]/.test(fs.readFileSync(path.join(root, "config.js"), "utf8"))) {
    fail("a ReliefWeb appname leaked into browser config.js");
  }
}

if (!config.ambee || !config.ambee.baseUrl) {
  fail("ambee.baseUrl missing");
} else {
  if (!(config.ambee.cacheMinutes >= 1)) fail("ambee.cacheMinutes must be at least 1");
  if (!(config.ambee.failureCacheMinutes >= 1)) fail("ambee.failureCacheMinutes must be at least 1");
  if (!(config.ambee.dailyLimit >= 1 && config.ambee.dailyLimit <= 80)) {
    fail("ambee.dailyLimit must stay within the trial guard (1-80)");
  }
  ok("Ambee air quality configured with a " + config.ambee.dailyLimit + "-call daily guard");
}

if (!config.gpm || !config.gpm.collectionConceptId) {
  fail("gpm.collectionConceptId missing");
} else if (!config.gpm.dataset || !config.gpm.cloudOpendapBase || !config.gpm.cmrUrl) {
  fail("gpm dataset/endpoint settings are incomplete");
} else if (!/approve_app\?client_id=/.test(config.gpm.approvalUrl || "")) {
  fail("gpm.approvalUrl must point at the Earthdata EULA approval page");
} else if (!(config.gpm.cacheMinutes >= 1)) {
  fail("gpm.cacheMinutes must be at least 1");
} else if (!/f78034ed|eyJ0eXAi/.test(fs.readFileSync(path.join(root, "config.js"), "utf8"))) {
  ok("NASA GPM IMERG configured; server-only Earthdata token is not in config.js");
} else {
  fail("a private API token leaked into browser config.js");
}

const airThresholds = config.thresholds && config.thresholds.air;
if (!airThresholds) {
  fail("thresholds.air missing");
} else if (!(airThresholds.watch < airThresholds.warning && airThresholds.warning < airThresholds.severe)) {
  fail("air thresholds must increase from watch to severe");
} else if (airThresholds.watch !== 101 || airThresholds.warning !== 151 || airThresholds.severe !== 201) {
  fail("air thresholds should match the US EPA AQI bands");
} else {
  ok("AQI thresholds follow the US EPA bands");
}

const serverSource = fs.readFileSync(path.join(root, "serve.js"), "utf8");
if (!/server-secrets\.js/.test(serverSource)) fail("serve.js does not block server-secrets.js");
else ok("server-secrets.js is blocked by the static server");
if (!fs.existsSync(path.join(root, ".gitignore")) || !/server-secrets\.js/.test(fs.readFileSync(path.join(root, ".gitignore"), "utf8"))) {
  warn(".gitignore does not exclude server-secrets.js");
}
if (!config.map || !Array.isArray(config.map.tileProviders) || !config.map.tileProviders.length) {
  fail("map.tileProviders missing");
} else {
  config.map.tileProviders.forEach((provider, index) => {
    if (!provider.id || !provider.url || !provider.attribution) {
      fail("map.tileProviders[" + index + "] is incomplete");
    }
    if (provider.url.indexOf("{z}") === -1 || provider.url.indexOf("{x}") === -1 || provider.url.indexOf("{y}") === -1) {
      fail("map.tileProviders[" + index + "] URL is missing tile placeholders");
    }
  });
  ok(config.map.tileProviders.length + " map tile providers configured");
}

if (!config.map || !Array.isArray(config.map.satelliteProviders) || !config.map.satelliteProviders.length) {
  fail("map.satelliteProviders missing");
} else {
  config.map.satelliteProviders.forEach((provider, index) => {
    if (!provider.id || !provider.url || !provider.attribution) {
      fail("map.satelliteProviders[" + index + "] is incomplete");
    }
    if (provider.url.indexOf("{z}") === -1 || provider.url.indexOf("{x}") === -1 || provider.url.indexOf("{y}") === -1) {
      fail("map.satelliteProviders[" + index + "] URL is missing tile placeholders");
    }
  });
  ok(config.map.satelliteProviders.length + " satellite tile providers configured");
}

/* ------------------------------------------------------------------ */
/* 2. Translation completeness and placeholders                        */
/* ------------------------------------------------------------------ */

const en = leaves(i18n.en, "");
const hi = leaves(i18n.hi, "");

Object.keys(en).forEach((key) => {
  if (hi[key] === undefined) fail("Hindi missing key: " + key);
});
Object.keys(hi).forEach((key) => {
  if (en[key] === undefined) warn("English missing key present in Hindi: " + key);
});

const enPlaceholders = {};
Object.keys(en).forEach((key) => { enPlaceholders[key] = placeholders(en[key]); });
Object.keys(hi).forEach((key) => {
  if (en[key] === undefined) return;
  const a = enPlaceholders[key].join(",");
  const b = placeholders(hi[key]).join(",");
  if (a !== b) fail("placeholder mismatch at " + key + ": en {" + a + "} hi {" + b + "}");
});

if (en["guides.items"] || hi["guides.items"]) fail("guides.items should be an object, not a leaf");

["fire", "flood", "heat", "quake", "storm"].forEach((guide) => {
  ["en", "hi"].forEach((lang) => {
    const item = getPath(i18n[lang], "guides.items." + guide);
    if (!item) fail(lang + " guide missing: " + guide);
    else {
      if (!item.title) fail(lang + " guide " + guide + " missing title");
      if (!Array.isArray(item.do) || !item.do.length) fail(lang + " guide " + guide + " missing do list");
      if (!Array.isArray(item.dont) || !item.dont.length) fail(lang + " guide " + guide + " missing dont list");
    }
  });
});

if (!Array.isArray(getPath(i18n.en, "helplines.items")) || !getPath(i18n.en, "helplines.items").length) {
  fail("English helplines missing");
}
if (!Array.isArray(getPath(i18n.hi, "helplines.items")) || !getPath(i18n.hi, "helplines.items").length) {
  fail("Hindi helplines missing");
}
if (!Array.isArray(getPath(i18n.en, "about.rows")) || !getPath(i18n.en, "about.rows").length) {
  fail("English alert threshold table missing");
}

ok("translation key sets checked (" + Object.keys(en).length + " English leaves)");

/* ------------------------------------------------------------------ */
/* 2b. Regional language packs                                         */
/* ------------------------------------------------------------------ */

const languages = i18n.languages || [];
if (!languages.length) {
  fail("i18n.languages is empty");
} else if (languages[0].code !== "en") {
  fail("English must be the first language");
} else {
  ok(languages.length + " languages configured: " + languages.map((l) => l.code).join(", "));
}

languages.forEach((item) => {
  if (!item.short || !item.english || !item.locale) fail("language " + item.code + " metadata is incomplete");
  if (!i18n[item.code]) fail("language " + item.code + " has no dictionary");
  if (!i18n.resolved || !i18n.resolved[item.code]) fail("language " + item.code + " was not resolved");
});

if (i18n.resolved) {
  languages.forEach((item) => {
    const code = item.code;
    const resolved = i18n.resolved[code];
    if (!resolved) return;
    const merged = leaves(resolved, "");
    const missing = Object.keys(en).filter((key) => merged[key] === undefined);
    if (missing.length) fail(code + " resolved dictionary is missing " + missing.length + " key(s): " + missing.slice(0, 4).join(", "));
    // Only the strings a pack actually supplies are checked; the rest fall back.
    if (code === "en" || code === "hi") return;
    const supplied = leaves(i18n[code], "");
    Object.keys(supplied).forEach((key) => {
      if (en[key] === undefined) {
        fail(code + " pack has unknown key: " + key);
        return;
      }
      const expected = placeholders(en[key]).join(",");
      const actual = placeholders(merged[key]).join(",");
      if (expected !== actual) fail(code + " placeholder mismatch at " + key + ": en {" + expected + "} got {" + actual + "}");
    });
  });
}

const allStates = [...new Set(regions.map((r) => r.state.en))];
languages.forEach((item) => {
  const code = item.code;
  if (code === "en" || code === "hi") return;
  const regionPack = i18n.regionNames && i18n.regionNames[code];
  const statePack = i18n.stateNames && i18n.stateNames[code];
  if (!regionPack) {
    warn(code + " has no local district names (falls back to Hindi)");
    return;
  }
  regions.forEach((region) => {
    if (!regionPack[region.id]) fail(code + " district name missing: " + region.id);
  });
  allStates.forEach((state) => {
    if (!statePack || !statePack[state]) fail(code + " state name missing: " + state);
  });
});
ok(languages.length + " language packs and their local place names checked");

/* ------------------------------------------------------------------ */
/* 3. Keys used in index.html                                          */
/* ------------------------------------------------------------------ */

const htmlAttrKeys = [...htmlSource.matchAll(/data-i18n(?:-placeholder|-aria|-title)?="([^"]+)"/g)].map((m) => m[1]);
const uniqueHtmlKeys = [...new Set(htmlAttrKeys)];
uniqueHtmlKeys.forEach((key) => {
  if (typeof en[key] !== "string") fail("index.html uses missing key: " + key);
  if (typeof hi[key] !== "string") fail("index.html uses key missing in Hindi: " + key);
});
ok(uniqueHtmlKeys.length + " template translation keys checked");

/* ------------------------------------------------------------------ */
/* 4. Keys used in app.js                                              */
/* ------------------------------------------------------------------ */

const literalKeys = [...new Set([...appSource.matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]))]
  .filter((key) => !key.endsWith("."));
literalKeys.forEach((key) => {
  if (typeof en[key] !== "string") fail("app.js uses missing key: " + key);
  if (typeof hi[key] !== "string") fail("app.js uses key missing in Hindi: " + key);
});
ok(literalKeys.length + " literal translation keys checked");

// Keys selected through a ternary cannot be found by the literal scan above.
["national.needActionOne", "national.watchOnlyOne", "map.shownOne", "map.quakesShownOne"].forEach((key) => {
  if (typeof en[key] !== "string") fail("app.js uses missing singular key: " + key);
  if (typeof hi[key] !== "string") fail("app.js uses singular key missing in Hindi: " + key);
});

// Dynamic key families: t("prefix." + value) or t("hazards." + type)
const dynamicFamilies = [...new Set([...appSource.matchAll(/\bt\(\s*"([^"]+)\."\s*\+/g)].map((m) => m[1]))];
const expectedDynamic = ["hazards", "severities", "alertTitles", "weather", "air.categories"];
expectedDynamic.forEach((family) => {
  if (!dynamicFamilies.includes(family)) warn("expected dynamic key family not detected: " + family);
});
dynamicFamilies.forEach((family) => {
  if (!getPath(i18n.en, family)) fail("dynamic key family missing: " + family);
  if (!getPath(i18n.hi, family)) fail("dynamic key family missing in Hindi: " + family);
});

["fire", "rain", "heat", "wind", "quake"].forEach((hazard) => {
  ["hazards", "alertTitles", "alertDetail"].forEach((family) => {
    if (getPath(i18n.en, family + "." + hazard) === undefined && hazard !== "rain") {
      if (!(family === "alertDetail" && hazard === "rain")) fail("missing " + family + "." + hazard);
    }
  });
});

["safe", "watch", "warning", "severe"].forEach((severity) => {
  if (getPath(i18n.en, "severities." + severity) === undefined) fail("missing severity: " + severity);
  if (getPath(i18n.hi, "severities." + severity) === undefined) fail("missing Hindi severity: " + severity);
});

["clear", "partly", "cloudy", "fog", "drizzle", "rain", "heavyRain", "snow", "storm", "unknown"].forEach((category) => {
  if (getPath(i18n.en, "weather." + category) === undefined) fail("missing weather label: " + category);
  if (getPath(i18n.hi, "weather." + category) === undefined) fail("missing Hindi weather label: " + category);
});

["good", "moderate", "sensitive", "unhealthy", "veryUnhealthy", "hazardous", "unknown"].forEach((category) => {
  if (getPath(i18n.en, "air.categories." + category) === undefined) fail("missing AQI category label: " + category);
  if (getPath(i18n.hi, "air.categories." + category) === undefined) fail("missing Hindi AQI category label: " + category);
});

["live", "saved", "partial", "connecting", "offline"].forEach((key) => {
  if (getPath(i18n.en, "header." + key) === undefined) fail("missing header." + key);
  if (getPath(i18n.hi, "header." + key) === undefined) fail("missing Hindi header." + key);
});

if (!config.regionById || Object.keys(config.regionById).length !== regions.length) {
  fail("regionById lookup is incomplete");
}

ok(dynamicFamilies.length + " dynamic key families checked");

/* ------------------------------------------------------------------ */
/* 5. Static markup sanity                                             */
/* ------------------------------------------------------------------ */

const useIds = [...new Set([...htmlSource.matchAll(/<use href="#([^"]+)"/g)].map((m) => m[1]))];
const symbolIds = [...new Set([...htmlSource.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]))];
const missingSymbols = [...new Set([...appSource.matchAll(/icon\(\s*"([^"]+)"/g)].map((m) => m[1]))].filter((id) => !symbolIds.includes(id));
useIds.forEach((id) => {
  if (!symbolIds.includes(id) && !id.startsWith("i-")) fail("missing SVG symbol: " + id);
});
missingSymbols.forEach((id) => fail("app.js references missing SVG symbol: " + id));
ok((symbolIds.length) + " SVG symbols checked");

if (!htmlSource.includes("app.js") || !htmlSource.includes("logic.js") || !htmlSource.includes("i18n.js")) {
  fail("index.html is missing a script reference");
}

/* ------------------------------------------------------------------ */

console.log("\n" + (failures ? "FAILED" : "PASSED") + " — " + failures + " failure(s), " + warnings + " warning(s).");
process.exit(failures ? 1 : 0);
