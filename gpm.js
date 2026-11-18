#!/usr/bin/env node
/**
 * Adivasi Suraksha - NASA GPM IMERG observed-rainfall proxy.
 *
 * The Earthdata token is private and lives in server-secrets.js (blocked by
 * serve.js) or the EARTHDATA_TOKEN environment variable. The browser asks
 * /api/gpm?district=... and gets only the rainfall summary.
 *
 * Data path:
 *   1. NASA CMR finds the newest IMERG Early Run daily granule for India.
 *   2. NASA's cloud OPeNDAP returns a tiny ASCII subset around the district
 *      centre (5x5 cells at 0.1 degrees), not the whole global file.
 *
 * This is an extra observed-rainfall reading. It is deliberately not part of
 * the five-hazard alarm or the LoRa packet.
 *
 * NASA GES DISC requires a one-time EULA approval for the Earthdata account.
 * Until that is done, the endpoint returns a clear eula_required message with
 * the approval link instead of failing silently.
 */
"use strict";

const CONFIG = require("./config");
const Logic = require("./logic");

// The Earthdata token is private and read from the environment only:
// EARTHDATA_TOKEN in .env.local (dev) or Cloudflare Pages settings (prod).

const CACHE_TTL_MS = (CONFIG.gpm.cacheMinutes || 360) * 60 * 1000;
const FAILURE_TTL_MS = (CONFIG.gpm.failureCacheMinutes || 15) * 60 * 1000;
const STALE_MAX_MS = 48 * 60 * 60 * 1000;
const GRANULE_TTL_MS = 30 * 60 * 1000;
const CELL_DEG = 0.1;
const LAT_MIN = -89.95;
const LON_MIN = -179.95;
const LAT_COUNT = 1800;
const LON_COUNT = 3600;
const FILL_VALUE = -9999;

const cache = new Map();
let granuleCache = null;
let lastError = "";

class GpmError extends Error {
  constructor(message, status, code, extra) {
    super(message);
    this.name = "GpmError";
    this.status = status || 503;
    this.code = code || "gpm_unavailable";
    Object.assign(this, extra || {});
  }
}

function token() {
  return String(process.env.EARTHDATA_TOKEN || "").trim();
}

// Works in Node and in the edge runtime (no Buffer required).
function decodeBase64Url(segment) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  if (typeof atob === "function") return atob(padded);
  if (typeof Buffer !== "undefined") return Buffer.from(segment, "base64url").toString("binary");
  return "";
}

function tokenExpiresAt() {
  const parts = token().split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return payload.exp ? new Date(payload.exp * 1000).toISOString() : null;
  } catch {
    return null;
  }
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

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(5000, Number(CONFIG.gpm.timeoutMs) || 30000)
  );
  try {
    return await fetch(url, Object.assign({ signal: controller.signal }, options || {}));
  } catch (error) {
    const reason = error && error.name === "AbortError" ? "timed out" : error.message;
    throw new GpmError("Could not reach NASA GPM (" + reason + ").", 503, "upstream_unreachable");
  } finally {
    clearTimeout(timer);
  }
}

async function latestGranule() {
  if (granuleCache && Date.now() - granuleCache.at <= GRANULE_TTL_MS) {
    return granuleCache.value;
  }

  const url = new URL(CONFIG.gpm.cmrUrl);
  url.searchParams.set("collection_concept_id", CONFIG.gpm.collectionConceptId);
  url.searchParams.set("sort_key", "-start_date");
  url.searchParams.set("page_size", "1");

  const response = await fetchWithTimeout(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "AdivasiSuraksha/1.0 (school project GPM rainfall proxy)"
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new GpmError(
      "NASA CMR returned HTTP " + response.status + " while looking for IMERG data.",
      502,
      "cmr_error"
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GpmError("NASA CMR returned an unexpected response.", 502, "bad_response");
  }

  const entry = json.feed && Array.isArray(json.feed.entry) ? json.feed.entry[0] : null;
  if (!entry) {
    throw new GpmError("NASA CMR has no recent IMERG Early Run granule.", 503, "no_granule");
  }

  const link = (entry.links || []).find((item) =>
    /opendap\.earthdata\.nasa\.gov/i.test(item.href || "") &&
    /opendap/i.test((item.title || "") + " " + (item.rel || ""))
  ) || (entry.links || []).find((item) => /opendap\.earthdata\.nasa\.gov/i.test(item.href || ""));

  if (!link) {
    throw new GpmError("NASA CMR did not provide an OPeNDAP link for the latest IMERG granule.", 502, "no_opendap");
  }

  const value = {
    id: entry.id,
    title: entry.title,
    timeStart: entry.time_start,
    timeEnd: entry.time_end,
    opendapUrl: link.href
  };
  granuleCache = { at: Date.now(), value: value };
  return value;
}

function cellIndex(value, min, count) {
  const index = Math.round((Number(value) - min) / CELL_DEG);
  return Math.max(0, Math.min(count - 1, index));
}

function subsetUrl(granule, region) {
  const box = Math.max(0, Math.min(5, Number(CONFIG.gpm.boxCells) || 2));
  const latIndex = cellIndex(region.lat, LAT_MIN, LAT_COUNT);
  const lonIndex = cellIndex(region.lon, LON_MIN, LON_COUNT);
  const lat0 = Math.max(0, latIndex - box);
  const lat1 = Math.min(LAT_COUNT - 1, latIndex + box);
  const lon0 = Math.max(0, lonIndex - box);
  const lon1 = Math.min(LON_COUNT - 1, lonIndex + box);
  const constraint = "precipitation" + encodeURIComponent(
    "[0:1:0][" + lon0 + ":1:" + lon1 + "][" + lat0 + ":1:" + lat1 + "]"
  );
  return {
    url: granule.opendapUrl + ".ascii?" + constraint,
    latIndex: latIndex,
    lonIndex: lonIndex,
    lat0: lat0,
    lat1: lat1,
    lon0: lon0,
    lon1: lon1,
    box: box
  };
}

function parseAscii(text) {
  // OPeNDAP ASCII prints one row per line:
  //   precipitation.precipitation[0][2618][1088], 0.0, 0.0, 1.2, ...
  // Every row starts with the variable name and its indices, then a comma.
  // Splitting on the first comma keeps all values, not only the first cell.
  const values = [];
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const comma = trimmed.indexOf(",");
    if (comma === -1) continue;
    if (!/^[A-Za-z_][\w.-]*(?:\[[^\]]*\])+\s*,/.test(trimmed)) continue;
    for (const part of trimmed.slice(comma + 1).split(",")) {
      const value = Number(part.trim());
      if (Number.isFinite(value)) values.push(value);
    }
  }
  return values.filter((value) => value > FILL_VALUE + 1);
}

function summarize(values, region, granule, subset) {
  if (!values.length) {
    return {
      available: false,
      reason: "no_data",
      message: "NASA IMERG returned no valid rainfall cells around this district."
    };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const max = Math.max.apply(null, values);
  const min = Math.min.apply(null, values);
  const wet = values.filter((value) => value >= 0.1).length;
  const timeEnd = granule.timeEnd ? Date.parse(granule.timeEnd) : NaN;
  const latency = Number.isFinite(timeEnd)
    ? Math.max(0, (Date.now() - timeEnd) / (60 * 60 * 1000))
    : null;
  return {
    available: true,
    value: {
      date: String(granule.timeStart || "").slice(0, 10),
      rainfallMm: round(mean, 1),
      maxMm: round(max, 1),
      minMm: round(min, 1),
      wetCells: wet,
      cells: values.length,
      boxCells: subset.box * 2 + 1,
      lat: region.lat,
      lon: region.lon,
      grid: "0.1° (~11 km)",
      latencyHours: round(latency, 1),
      granule: granule.title,
      sourceUrl: granule.opendapUrl
    }
  };
}

async function approvalUrlFromDmrpp(text) {
  // The cloud OPeNDAP error for a missing EULA hides the real reason inside the
  // DMR++ fetch. Read that small sidecar with the same token to classify it.
  const match = String(text || "").match(
    /https:\/\/data\.gesdisc\.earthdata\.nasa\.gov\/[^\s"'<>]+\.dmrpp/i
  );
  if (!match) return null;
  try {
    const response = await fetchWithTimeout(match[0], {
      headers: {
        "Authorization": "Bearer " + token(),
        "Accept": "application/json, text/plain",
        "User-Agent": "AdivasiSuraksha/1.0 (school project GPM rainfall proxy)"
      }
    });
    const body = await response.text();
    if (!/EULA Acceptance Failure|approve_app\?client_id=/i.test(body)) return null;
    const url = body.match(
      /https:\/\/urs\.earthdata\.nasa\.gov\/approve_app\?client_id=[A-Za-z0-9]+/i
    );
    return url ? url[0].replace(/\\\//g, "/") : CONFIG.gpm.approvalUrl;
  } catch {
    return null;
  }
}

async function callGpm(region) {
  if (!token()) {
    throw new GpmError(
      "NASA Earthdata is not configured. Set the EARTHDATA_TOKEN environment variable.",
      503,
      "not_configured"
    );
  }

  const granule = await latestGranule();
  const subset = subsetUrl(granule, region);
  const response = await fetchWithTimeout(subset.url, {
    redirect: "manual",
    headers: {
      "Authorization": "Bearer " + token(),
      "Accept": "text/plain",
      "User-Agent": "AdivasiSuraksha/1.0 (school project GPM rainfall proxy)"
    }
  });
  const text = await response.text();

  const eula = /EULA Acceptance Failure|approve_app\?client_id=/i.test(text);
  if (eula) {
    throw new GpmError(
      "NASA GES DISC needs a one-time EULA approval for this Earthdata account before GPM data can be read.",
      403,
      "eula_required",
      { approvalUrl: CONFIG.gpm.approvalUrl }
    );
  }
  if (response.status === 401 || /HTTP Basic: Access denied|invalid_token/i.test(text)) {
    throw new GpmError(
      "The NASA Earthdata token was rejected. Generate a new token or check EARTHDATA_TOKEN.",
      502,
      "invalid_token"
    );
  }
  if (response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308) {
    throw new GpmError(
      "NASA OPeNDAP redirected to a login page. The Earthdata token is missing or expired.",
      502,
      "invalid_token"
    );
  }
  if (!response.ok && /Failed to read the DMR\+\+/i.test(text)) {
    const approvalUrl = await approvalUrlFromDmrpp(text);
    if (approvalUrl) {
      throw new GpmError(
        "NASA GES DISC needs a one-time EULA approval for this Earthdata account before GPM data can be read.",
        403,
        "eula_required",
        { approvalUrl: approvalUrl }
      );
    }
  }
  if (response.status === 404) {
    throw new GpmError("NASA OPeNDAP could not find the latest IMERG granule.", 503, "no_granule");
  }
  if (!response.ok) {
    throw new GpmError(
      "NASA OPeNDAP returned HTTP " + response.status + " for the IMERG subset.",
      502,
      "upstream_error"
    );
  }

  const values = parseAscii(text);
  const result = summarize(values, region, granule, subset);
  if (result.available) {
    result.value.sourceUrl = granule.opendapUrl;
    cache.set(region.id, { at: Date.now(), value: result.value });
  } else {
    cache.set(region.id, {
      at: Date.now(),
      noData: true,
      reason: result.reason,
      message: result.message
    });
  }
  return result;
}

function cachedReading(region) {
  const item = cache.get(region.id);
  if (!item) return null;
  const age = Date.now() - item.at;
  if (item.value && age <= CACHE_TTL_MS) {
    return { value: item.value, cached: true, stale: false };
  }
  if (item.error && item.failedAt && Date.now() - item.failedAt <= FAILURE_TTL_MS) {
    throw new GpmError(item.error.message, item.error.status, item.error.code, {
      approvalUrl: item.error.approvalUrl
    });
  }
  if (item.error && !item.value && age <= FAILURE_TTL_MS) {
    throw new GpmError(item.error.message, item.error.status, item.error.code, {
      approvalUrl: item.error.approvalUrl
    });
  }
  if (item.noData && age <= FAILURE_TTL_MS) {
    return {
      available: false,
      reason: item.reason || "no_data",
      message: item.message || "NASA IMERG has no rainfall reading for this location.",
      cached: true
    };
  }
  return null;
}

function staleReading(region) {
  const item = cache.get(region.id);
  if (!item || !item.value) return null;
  const age = Date.now() - item.at;
  if (age <= STALE_MAX_MS) return { value: item.value, cached: true, stale: true };
  return null;
}

function rememberFailure(region, error) {
  const existing = cache.get(region.id);
  const failure = {
    message: error.message,
    status: error.status,
    code: error.code,
    approvalUrl: error.approvalUrl
  };
  if (existing && existing.value) {
    cache.set(region.id, {
      at: existing.at,
      value: existing.value,
      failedAt: Date.now(),
      error: failure
    });
    return;
  }
  cache.set(region.id, { at: Date.now(), error: failure });
}

function responseFor(region, result) {
  return Object.assign({
    v: 1,
    provider: "NASA GPM",
    service: "IMERG Early Run daily rainfall",
    dataset: CONFIG.gpm.dataset,
    district: districtPublic(region),
    fetchedAt: new Date().toISOString(),
    note:
      "Satellite-observed rainfall for the latest completed UTC day, sampled from IMERG 0.1-degree cells around the district centre. " +
      "It is an extra reading, not part of the five-hazard alarm or the LoRa packet."
  }, result.available === false
    ? {
        available: false,
        reason: result.reason,
        message: result.message,
        cached: Boolean(result.cached),
        stale: Boolean(result.stale)
      }
    : {
        available: true,
        date: result.value.date,
        rainfallMm: result.value.rainfallMm,
        maxMm: result.value.maxMm,
        minMm: result.value.minMm,
        wetCells: result.value.wetCells,
        cells: result.value.cells,
        boxCells: result.value.boxCells,
        grid: result.value.grid,
        latencyHours: result.value.latencyHours,
        granule: result.value.granule,
        sourceUrl: result.value.sourceUrl,
        cached: Boolean(result.cached),
        stale: Boolean(result.stale)
      });
}

async function getRainfall(value) {
  const region = resolveRegion(value);
  if (!region) {
    throw new GpmError("Unknown district. Use /api/districts for the list.", 404, "unknown_district");
  }

  const cached = cachedReading(region);
  if (cached) return responseFor(region, cached);

  try {
    const result = await callGpm(region);
    return responseFor(region, result);
  } catch (error) {
    if (!(error instanceof GpmError)) throw error;
    lastError = error.message;
    // Do not cache setup problems: after the user approves the GES DISC EULA,
    // the next retry should reach NASA immediately instead of waiting.
    if (error.code !== "not_configured" && error.code !== "eula_required") {
      rememberFailure(region, error);
    }
    const stale = staleReading(region);
    if (stale) return responseFor(region, stale);
    throw error;
  }
}

async function getRainForRegion(region) {
  try {
    const data = await getRainfall(region.id);
    return Object.assign({}, data, { error: null });
  } catch (error) {
    return {
      v: 1,
      provider: "NASA GPM",
      available: false,
      reason: error.code || "gpm_unavailable",
      message: error.message,
      district: districtPublic(region),
      error: error.code || "gpm_unavailable",
      approvalUrl: error.approvalUrl || null
    };
  }
}

function getStatus() {
  return {
    configured: Boolean(token()),
    provider: "NASA GPM",
    dataset: CONFIG.gpm.dataset,
    collection: CONFIG.gpm.collectionConceptId,
    endpoint: CONFIG.gpm.cloudOpendapBase,
    cacheMinutes: CONFIG.gpm.cacheMinutes,
    cachedDistricts: cache.size,
    tokenExpiresAt: tokenExpiresAt(),
    eulaApprovalUrl: CONFIG.gpm.approvalUrl,
    lastError: lastError || null
  };
}

module.exports = {
  GpmError,
  getRainfall,
  getRainForRegion,
  getStatus,
  // Small pure helpers exposed for the offline part of the test suite.
  _internal: { parseAscii, subsetUrl, cellIndex }
};
