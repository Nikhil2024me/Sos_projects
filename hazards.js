#!/usr/bin/env node
/**
 * Adivasi Suraksha - wider hazards proxy (GDACS, NASA EONET, ReliefWeb).
 *
 * These feeds add context from outside the district: a cyclone along the
 * coast, a regional drought, a large flood in a neighbouring country. They are
 * deliberately NOT part of the five-hazard alarm or the LoRa packet. The
 * village buzzer continues to follow fire, rain, wind, heat and earthquake
 * only.
 *
 * Sources:
 *   GDACS RSS          https://www.gdacs.org/xml/rss.xml
 *   NASA EONET v3      https://eonet.gsfc.nasa.gov/api/v3/events
 *   ReliefWeb v2       https://api.reliefweb.int/v2/disasters
 *
 * ReliefWeb v1 has been decommissioned. v2 needs an approved appname. The
 * appname is server-side only (server-secrets.js -> reliefwebAppname, or the
 * RELIEFWEB_APPNAME environment variable). Without one, ReliefWeb reports
 * "not_configured" and GDACS/EONET continue to work.
 *
 * Endpoint:
 *   GET /api/hazards?district=bastar
 */
"use strict";

const CONFIG = require("./config");
const Logic = require("./logic");

// ReliefWeb needs an approved appname, read from the environment only:
// RELIEFWEB_APPNAME in .env.local (dev) or Cloudflare Pages settings (prod).

const CACHE_TTL_MS = (CONFIG.hazards.cacheMinutes || 30) * 60 * 1000;
const FAILURE_TTL_MS = (CONFIG.hazards.failureCacheMinutes || 5) * 60 * 1000;
const RADIUS_KM = Number(CONFIG.hazards.radiusKm) || 1200;
const MAX_ITEMS = Math.max(1, Number(CONFIG.hazards.maxItems) || 6);
const TIMEOUT_MS = Math.max(5000, Number(CONFIG.hazards.timeoutMs) || 20000);

const SOURCE_NAMES = {
  gdacs: "GDACS",
  eonet: "NASA EONET",
  reliefweb: "ReliefWeb"
};

const GDACS_TYPES = {
  EQ: "earthquake",
  TC: "cyclone",
  FL: "flood",
  VO: "volcano",
  DR: "drought",
  WF: "wildfire",
  TS: "tsunami",
  LS: "landslide",
  FF: "flood"
};

const EONET_TYPES = {
  wildfires: "wildfire",
  severeStorms: "storm",
  floods: "flood",
  volcanoes: "volcano",
  earthquakes: "earthquake",
  drought: "drought",
  landslides: "landslide",
  temperatureExtremes: "heat",
  dustHaze: "dust",
  seaLakeIce: "ice",
  snow: "snow",
  waterColor: "other",
  manmade: "other"
};

const SEVERITY_RANK = { severe: 3, warning: 2, watch: 1, info: 0 };

const cache = {
  gdacs: null,
  eonet: null,
  reliefweb: null
};
const inflight = { gdacs: null, eonet: null, reliefweb: null };

let lastError = "";

class HazardError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "HazardError";
    this.status = status || 503;
    this.code = code || "hazards_unavailable";
  }
}

function appname() {
  return String(process.env.RELIEFWEB_APPNAME || "").trim();
}

function round(value, digits) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const factor = Math.pow(10, digits == null ? 1 : digits);
  return Math.round(Number(value) * factor) / factor;
}

function districtPublic(region) {
  return {
    id: region.id,
    name: region.name.en,
    nameHi: region.name.hi,
    state: region.state.en,
    stateHi: region.state.hi,
    lat: region.lat,
    lon: region.lon
  };
}

function resolveRegion(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (CONFIG.regionById[text.toLowerCase()]) return CONFIG.regionById[text.toLowerCase()];
  if (/^\d+$/.test(text)) {
    const index = Number(text);
    if (index >= 1 && index <= CONFIG.regions.length) return CONFIG.regions[index - 1];
  }
  return null;
}

async function fetchWithTimeout(url, type, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": type === "json" ? "application/json" : "application/xml, text/xml, */*",
        "User-Agent": "AdivasiSuraksha/1.0 (school project wider hazards proxy)"
      }
    });
    if (!response.ok) {
      throw new HazardError(
        label + " returned HTTP " + response.status + ".",
        502,
        "upstream_error"
      );
    }
    return type === "json" ? response.json() : response.text();
  } catch (error) {
    if (error instanceof HazardError) throw error;
    const reason = error && error.name === "AbortError" ? "timed out" : error.message;
    throw new HazardError(
      "Could not reach " + label + " (" + reason + ").",
      503,
      "upstream_unreachable"
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Small parsing helpers                                               */
/* ------------------------------------------------------------------ */

function decodeXml(text) {
  return String(text == null ? "" : text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    })
    .replace(/&#(\d+);/g, (match, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (match, name) => {
      return {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " "
      }[name.toLowerCase()] || match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function xmlField(item, tag) {
  const escaped = String(tag).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(item).match(
    new RegExp("<" + escaped + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + escaped + ">", "i")
  );
  return match ? decodeXml(match[1]) : "";
}

function parseDate(value) {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
}

function truncate(text, limit) {
  const clean = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return clean.slice(0, Math.max(0, limit - 1)).replace(/[\s,.;:-]+$/, "") + "…";
}

function severityForAlert(level) {
  switch (String(level || "").toLowerCase()) {
    case "red": return "severe";
    case "orange": return "warning";
    case "green": return "watch";
    default: return "info";
  }
}

function capitalize(value) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";
}

/* ------------------------------------------------------------------ */
/* GDACS RSS                                                           */
/* ------------------------------------------------------------------ */

function gdacsPoint(item) {
  const georss = xmlField(item, "georss:point");
  if (georss) {
    const parts = georss.split(/[\s,]+/).map(Number);
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { lat: parts[0], lon: parts[1] };
    }
  }

  const lat = Number(xmlField(item, "geo:lat") || xmlField(item, "gdacs:latitude"));
  const lon = Number(xmlField(item, "geo:long") || xmlField(item, "gdacs:longitude"));
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat: lat, lon: lon };
  return null;
}

function parseGdacsXml(xml) {
  const items = [];
  const blocks = String(xml || "").match(/<item\b[^>]*>([\s\S]*?)<\/item>/gi) || [];

  for (const block of blocks) {
    const item = block.replace(/^<item\b[^>]*>/i, "").replace(/<\/item>$/i, "");
    const isCurrent = xmlField(item, "gdacs:iscurrent").toLowerCase() !== "false";
    if (!isCurrent) continue;

    const typeCode = xmlField(item, "gdacs:eventtype").toUpperCase();
    const alertLevel = capitalize(xmlField(item, "gdacs:alertlevel"));
    // Local satellites already cover green forest fires. Keep green events of
    // other types because droughts, floods and volcanoes matter at a distance.
    if (typeCode === "WF" && alertLevel === "Green") continue;

    const point = gdacsPoint(item);
    if (!point) continue;

    const typeKey = GDACS_TYPES[typeCode] || "other";
    const title = xmlField(item, "title") || (alertLevel + " " + typeKey + " event");
    const description = truncate(xmlField(item, "description"), 220);
    const eventName = xmlField(item, "gdacs:eventname");
    const eventId = xmlField(item, "gdacs:eventid");
    const guid = xmlField(item, "guid");
    const date = parseDate(
      xmlField(item, "gdacs:fromdate") ||
      xmlField(item, "pubDate") ||
      xmlField(item, "gdacs:dateadded")
    );
    const url = xmlField(item, "link") || (eventId
      ? "https://www.gdacs.org/report.aspx?eventtype=" + typeCode + "&eventid=" + eventId
      : null);

    items.push({
      sourceKey: "gdacs",
      source: SOURCE_NAMES.gdacs,
      id: guid || (typeCode + eventId),
      type: typeKey,
      typeKey: typeKey,
      typeCode: typeCode || null,
      title: truncate(title, 200),
      name: eventName || null,
      summary: description,
      country: xmlField(item, "gdacs:country") || null,
      alertLevel: alertLevel || null,
      severity: severityForAlert(alertLevel),
      date: date,
      url: url,
      lat: point.lat,
      lon: point.lon,
      distanceKm: null,
      scope: "nearby"
    });
  }

  return items;
}

async function fetchGdacs() {
  const xml = await fetchWithTimeout(CONFIG.hazards.gdacs.url, "text", "GDACS");
  return parseGdacsXml(xml);
}

/* ------------------------------------------------------------------ */
/* NASA EONET                                                          */
/* ------------------------------------------------------------------ */

function collectPositions(node, out) {
  if (!Array.isArray(node)) return;
  if (node.length >= 2 && typeof node[0] === "number" && typeof node[1] === "number") {
    out.push([node[0], node[1]]);
    return;
  }
  node.forEach((child) => collectPositions(child, out));
}

function geometryPoint(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  const positions = [];
  collectPositions(geometry.coordinates, positions);
  const valid = positions.filter((pair) =>
    Number.isFinite(pair[0]) && Number.isFinite(pair[1]) &&
    pair[1] >= -90 && pair[1] <= 90 &&
    pair[0] >= -180 && pair[0] <= 180
  );
  if (!valid.length) return null;
  const lat = valid.reduce((sum, pair) => sum + pair[1], 0) / valid.length;
  const lon = valid.reduce((sum, pair) => sum + pair[0], 0) / valid.length;
  return { lat: lat, lon: lon };
}

function latestGeometry(geometry) {
  if (!Array.isArray(geometry) || !geometry.length) return null;
  const ordered = geometry.slice().sort((a, b) => {
    return (Date.parse(b && b.date) || 0) - (Date.parse(a && a.date) || 0);
  });
  for (const entry of ordered) {
    if (entry && geometryPoint(entry)) return entry;
  }
  return null;
}

function parseEonetJson(json) {
  const events = json && Array.isArray(json.events) ? json.events : [];
  const items = [];

  for (const event of events) {
    const geometry = latestGeometry(event.geometry);
    if (!geometry) continue;
    const point = geometryPoint(geometry);
    if (!point) continue;

    const category = (Array.isArray(event.categories) && event.categories[0]) || {};
    const typeKey = EONET_TYPES[category.id] || "other";
    const source = (Array.isArray(event.sources) && event.sources[0]) || {};
    const date = parseDate(geometry.date || event.closed);

    items.push({
      sourceKey: "eonet",
      source: SOURCE_NAMES.eonet,
      id: event.id || null,
      type: typeKey,
      typeKey: typeKey,
      typeCode: category.id || null,
      title: truncate(event.title || category.title || "NASA EONET event", 200),
      name: null,
      summary: truncate(event.description || category.title || "", 220),
      country: null,
      alertLevel: null,
      severity: "info",
      date: date,
      url: event.link || source.url || null,
      lat: point.lat,
      lon: point.lon,
      distanceKm: null,
      scope: "nearby",
      magnitude: geometry.magnitudeValue == null
        ? null
        : geometry.magnitudeValue + (geometry.magnitudeUnit ? " " + geometry.magnitudeUnit : "")
    });
  }

  return items;
}

async function fetchEonet() {
  const url = new URL(CONFIG.hazards.eonet.baseUrl);
  url.searchParams.set("status", "open");
  url.searchParams.set("days", String(CONFIG.hazards.eonet.days || 30));
  const json = await fetchWithTimeout(url, "json", "NASA EONET");
  return parseEonetJson(json);
}

/* ------------------------------------------------------------------ */
/* ReliefWeb v2                                                        */
/* ------------------------------------------------------------------ */

function reliefwebCountryNames(fields) {
  const names = [];
  const add = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    if (typeof value === "string") {
      names.push(value);
      return;
    }
    if (value.name) names.push(value.name);
  };
  add(fields.country);
  add(fields.primary_country);
  return names.filter((name, index) => names.indexOf(name) === index);
}

function isSouthAsia(names) {
  const wanted = (CONFIG.hazards.reliefweb.countries || []).map((name) => name.toLowerCase());
  return names.some((name) => {
    const text = String(name || "").toLowerCase();
    return wanted.some((country) => text === country || text.indexOf(country) !== -1);
  });
}

function reliefwebType(fields) {
  const type = fields.type;
  if (Array.isArray(type) && type.length) {
    return type[0] && type[0].name ? type[0].name : null;
  }
  return type && type.name ? type.name : null;
}

function parseReliefWebJson(json) {
  const rows = json && Array.isArray(json.data) ? json.data : [];
  const items = [];

  for (const row of rows) {
    const fields = (row && row.fields) || {};
    const countries = reliefwebCountryNames(fields);
    if (!isSouthAsia(countries)) continue;

    const status = String(fields.status || "").toLowerCase();
    if (status === "past") continue;

    const date = parseDate(
      (fields.date && (fields.date.changed || fields.date.created)) ||
      fields.date ||
      fields.updated
    );
    const typeName = reliefwebType(fields);
    const title = fields.name || fields.title || typeName || "ReliefWeb disaster";

    items.push({
      sourceKey: "reliefweb",
      source: SOURCE_NAMES.reliefweb,
      id: row.id == null ? null : String(row.id),
      type: "disaster",
      typeKey: "other",
      typeCode: typeName,
      title: truncate(title, 200),
      name: null,
      summary: truncate(fields.description || (typeName ? typeName + " disaster" : ""), 220),
      country: countries.join(", ") || null,
      alertLevel: null,
      severity: "info",
      date: date,
      url: fields.url || (row.id == null ? null : "https://reliefweb.int/disaster/" + row.id),
      lat: null,
      lon: null,
      distanceKm: null,
      scope: "regional",
      status: status || null,
      disasterType: typeName || null
    });
  }

  return items;
}

async function fetchReliefWeb() {
  const approved = appname();
  if (!approved) {
    throw new HazardError(
      "ReliefWeb v2 needs an approved appname. Set the RELIEFWEB_APPNAME environment variable.",
      503,
      "reliefweb_not_configured"
    );
  }

  const url = new URL(CONFIG.hazards.reliefweb.baseUrl);
  url.searchParams.set("appname", approved);
  url.searchParams.set("limit", String(CONFIG.hazards.reliefweb.limit || 40));
  url.searchParams.append("sort[]", "date:desc");
  ["name", "title", "date", "url", "country", "primary_country", "status", "type", "description"]
    .forEach((field) => url.searchParams.append("fields[include][]", field));

  const json = await fetchWithTimeout(url, "json", "ReliefWeb");
  return parseReliefWebJson(json);
}

/* ------------------------------------------------------------------ */
/* Source cache                                                        */
/* ------------------------------------------------------------------ */

const fetchers = {
  gdacs: fetchGdacs,
  eonet: fetchEonet,
  reliefweb: fetchReliefWeb
};

function cachedSource(name) {
  const entry = cache[name];
  if (!entry) return null;
  const age = Date.now() - entry.at;

  if (entry.items && !entry.failedAt && age <= CACHE_TTL_MS) {
    return {
      status: "live",
      items: entry.items,
      fetchedAt: entry.at,
      error: null
    };
  }

  const failedAge = entry.failedAt ? Date.now() - entry.failedAt : Infinity;
  if (failedAge <= FAILURE_TTL_MS) {
    if (entry.items && entry.items.length) {
      return {
        status: "saved",
        items: entry.items,
        fetchedAt: entry.at,
        error: entry.error || null
      };
    }
    return {
      status: entry.errorCode === "reliefweb_not_configured" ? "not_configured" : "error",
      items: [],
      fetchedAt: null,
      error: entry.error || null
    };
  }

  return null;
}

async function loadSource(name) {
  const cached = cachedSource(name);
  if (cached) return cached;

  if (inflight[name]) return inflight[name];

  inflight[name] = (async () => {
    try {
      const items = await fetchers[name]();
      cache[name] = {
        at: Date.now(),
        items: items,
        failedAt: 0,
        error: "",
        errorCode: ""
      };
      return {
        status: "live",
        items: items,
        fetchedAt: cache[name].at,
        error: null
      };
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      const code = error && error.code ? error.code : "upstream_error";
      lastError = message;
      const previous = cache[name];

      if (previous && previous.items && previous.items.length) {
        cache[name] = Object.assign({}, previous, {
          failedAt: Date.now(),
          error: message,
          errorCode: code
        });
        return {
          status: "saved",
          items: previous.items,
          fetchedAt: previous.at,
          error: message
        };
      }

      cache[name] = {
        at: Date.now(),
        items: [],
        failedAt: Date.now(),
        error: message,
        errorCode: code
      };
      return {
        status: code === "reliefweb_not_configured" ? "not_configured" : "error",
        items: [],
        fetchedAt: null,
        error: message
      };
    } finally {
      inflight[name] = null;
    }
  })();

  return inflight[name];
}

/* ------------------------------------------------------------------ */
/* District view                                                       */
/* ------------------------------------------------------------------ */

function withDistance(item, region) {
  if (item.lat == null || item.lon == null) {
    return Object.assign({}, item, { distanceKm: null });
  }
  return Object.assign({}, item, {
    distanceKm: round(Logic.haversineKm(item.lat, item.lon, region.lat, region.lon), 1)
  });
}

function compareItems(a, b) {
  const severity = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
  if (severity !== 0) return severity;

  const da = a.distanceKm == null ? Number.POSITIVE_INFINITY : a.distanceKm;
  const db = b.distanceKm == null ? Number.POSITIVE_INFINITY : b.distanceKm;
  if (da !== db) return da - db;

  return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);
}

function sourceSummary(result, included) {
  return {
    status: result.status,
    count: included,
    fetchedAt: result.fetchedAt ? new Date(result.fetchedAt).toISOString() : null,
    error: result.error || null
  };
}

async function getForDistrict(value) {
  const region = resolveRegion(value);
  if (!region) {
    throw new HazardError("Unknown district. Use /api/districts for the list.", 404, "unknown_district");
  }

  const [gdacs, eonet, reliefweb] = await Promise.all([
    loadSource("gdacs"),
    loadSource("eonet"),
    loadSource("reliefweb")
  ]);

  const nearby = []
    .concat(gdacs.items.map((item) => withDistance(item, region)))
    .concat(eonet.items.map((item) => withDistance(item, region)))
    .filter((item) => item.distanceKm != null && item.distanceKm <= RADIUS_KM);

  // ReliefWeb has no coordinates. Its South Asia disasters are regional
  // context, so they follow the nearby items instead of pretending to be local.
  const regional = reliefweb.items.map((item) => Object.assign({}, item, { distanceKm: null }));

  const items = nearby.concat(regional)
    .sort(compareItems)
    .slice(0, MAX_ITEMS);

  const countFor = (sourceKey) => items.filter((item) => item.sourceKey === sourceKey).length;
  const sources = {
    gdacs: sourceSummary(gdacs, countFor("gdacs")),
    eonet: sourceSummary(eonet, countFor("eonet")),
    reliefweb: Object.assign(sourceSummary(reliefweb, countFor("reliefweb")), {
      configured: Boolean(appname())
    })
  };

  const available = ["live", "saved"].indexOf(gdacs.status) !== -1 ||
    ["live", "saved"].indexOf(eonet.status) !== -1 ||
    ["live", "saved"].indexOf(reliefweb.status) !== -1;

  return {
    v: 1,
    provider: "GDACS · NASA EONET · ReliefWeb",
    district: districtPublic(region),
    radiusKm: RADIUS_KM,
    fetchedAt: new Date().toISOString(),
    available: available,
    counts: {
      gdacs: countFor("gdacs"),
      eonet: countFor("eonet"),
      reliefweb: countFor("reliefweb"),
      total: items.length
    },
    sources: sources,
    items: items,
    note:
      "Wider hazards are extra web-only context from GDACS, NASA EONET and ReliefWeb. " +
      "They never change the five-hazard alarm or the LoRa packet."
  };
}

function getStatus() {
  const source = (name) => {
    const entry = cache[name];
    if (!entry) {
      return {
        status: "idle",
        count: 0,
        fetchedAt: null,
        lastError: null
      };
    }
    const failed = Boolean(entry.failedAt && entry.error);
    const count = entry.items ? entry.items.length : 0;
    let status;
    if (failed) {
      if (entry.errorCode === "reliefweb_not_configured") status = "not_configured";
      else status = count ? "saved" : "error";
    } else {
      status = entry.items ? "cached" : "idle";
    }
    return {
      status: status,
      count: count,
      fetchedAt: entry.at ? new Date(entry.at).toISOString() : null,
      lastError: failed ? entry.error : null
    };
  };

  return {
    configured: true,
    provider: "GDACS, NASA EONET, ReliefWeb",
    radiusKm: RADIUS_KM,
    maxItems: MAX_ITEMS,
    cacheMinutes: CONFIG.hazards.cacheMinutes,
    sources: {
      gdacs: source("gdacs"),
      eonet: source("eonet"),
      reliefweb: Object.assign(source("reliefweb"), {
        configured: Boolean(appname())
      })
    },
    lastError: lastError || null
  };
}

module.exports = {
  HazardError,
  getForDistrict,
  getStatus,
  // Pure helpers for the offline part of the test suite.
  _internal: {
    parseGdacsXml,
    parseEonetJson,
    parseReliefWebJson,
    gdacsPoint,
    geometryPoint,
    latestGeometry,
    isSouthAsia,
    severityForAlert,
    withDistance,
    compareItems
  }
};
