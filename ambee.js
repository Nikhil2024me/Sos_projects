#!/usr/bin/env node
/**
 * Adivasi Suraksha - Ambee air quality proxy.
 *
 * The Ambee key is private and must never reach the browser. This module reads
 * it from server-secrets.js (blocked by serve.js) or the AMBEE_KEY environment
 * variable. The browser asks /api/air?district=... and gets only the reading.
 *
 * Ambee's evaluation plan is about 100 calls/day, so:
 *   - one district is fetched at a time,
 *   - a successful reading is cached for an hour,
 *   - a failed reading is cached for ten minutes,
 *   - a daily limit (default 80) protects the rest of the quota,
 *   - when the limit is reached, stale cached data is still served if present.
 *
 * Endpoint:
 *   GET https://api.ambeedata.com/latest/by-lat-lng?lat=..&lng=..
 *   Headers: x-api-key: ..., Content-Type: application/json
 */
"use strict";

const CONFIG = require("./config");
const Logic = require("./logic");

// Secrets come from the environment only: set AMBEE_KEY in .env.local for local
// development, or in the Cloudflare Pages project settings in production.

const CACHE_TTL_MS = (CONFIG.ambee.cacheMinutes || 60) * 60 * 1000;
const FAILURE_TTL_MS = (CONFIG.ambee.failureCacheMinutes || 10) * 60 * 1000;
const STALE_MAX_MS = 12 * 60 * 60 * 1000;
const DAILY_LIMIT = Math.max(1, Number(CONFIG.ambee.dailyLimit) || 80);

const cache = new Map();
let callsToday = 0;
let budgetDay = "";
let quotaExhausted = false;
let lastError = "";

class AirError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "AirError";
    this.status = status || 503;
    this.code = code || "air_unavailable";
  }
}

function key() {
  return String(process.env.AMBEE_KEY || "").trim();
}

function todayKey() {
  return Logic.isoDateInZone(Date.now(), CONFIG.weather.timezone || "Asia/Kolkata");
}

function budget() {
  const day = todayKey();
  if (day !== budgetDay) {
    budgetDay = day;
    callsToday = 0;
    quotaExhausted = false;
  }
  return {
    day,
    used: callsToday,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - callsToday),
    exhausted: quotaExhausted || callsToday >= DAILY_LIMIT
  };
}

function categoryKey(aqi) {
  const value = Number(aqi);
  if (!Number.isFinite(value)) return "unknown";
  if (value <= 50) return "good";
  if (value <= 100) return "moderate";
  if (value <= 150) return "sensitive";
  if (value <= 200) return "unhealthy";
  if (value <= 300) return "veryUnhealthy";
  return "hazardous";
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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

function stationFrom(raw, region) {
  if (!raw) return null;
  const lat = numberOrNull(raw.lat);
  const lon = numberOrNull(raw.lng);
  return {
    name: raw.placeName || raw.city || raw.division || null,
    city: raw.city || null,
    district: raw.division || null,
    state: raw.state || null,
    postalCode: raw.postalCode || null,
    lat: lat,
    lon: lon,
    distanceKm: lat != null && lon != null
      ? round(Logic.haversineKm(region.lat, region.lon, lat, lon), 1)
      : null
  };
}

function readingFrom(raw, region) {
  if (!raw) return null;
  const aqi = numberOrNull(raw.AQI != null ? raw.AQI : raw.aqi);
  if (aqi == null) return null;
  const info = raw.aqiInfo || raw.aqi_info || {};
  const pm25 = numberOrNull(raw.PM25 != null ? raw.PM25 : raw.pm25);
  const thresholds = CONFIG.thresholds.air;
  return {
    available: true,
    value: {
      aqi: Math.round(aqi),
      category: info.category || null,
      categoryKey: categoryKey(aqi),
      severity: Logic.severityFor(aqi, thresholds) || "safe",
      pollutant: info.pollutant || null,
      concentration: numberOrNull(info.concentration),
      pm25: pm25,
      pm10: numberOrNull(raw.PM10 != null ? raw.PM10 : raw.pm10),
      no2: numberOrNull(raw.NO2 != null ? raw.NO2 : raw.no2),
      so2: numberOrNull(raw.SO2 != null ? raw.SO2 : raw.so2),
      co: numberOrNull(raw.CO != null ? raw.CO : raw.co),
      ozone: numberOrNull(raw.OZONE != null ? raw.OZONE : raw.ozone),
      updatedAt: raw.updatedAt || raw.timestamp || null,
      station: stationFrom(raw, region),
      thresholds: thresholds
    }
  };
}

function cachedReading(region) {
  const item = cache.get(region.id);
  if (!item) return null;
  const age = Date.now() - item.at;
  if (item.value) {
    // Only a reading inside the one-hour window is fresh. Older readings are
    // kept as a fallback when a refresh fails (see staleReading), not served
    // indefinitely.
    if (age <= CACHE_TTL_MS) return { value: item.value, cached: true, stale: false };
  }
  if (item.error && item.failedAt && Date.now() - item.failedAt <= FAILURE_TTL_MS) {
    throw new AirError(item.error.message, item.error.status, item.error.code);
  }
  if (item.error && !item.value && age <= FAILURE_TTL_MS) {
    throw new AirError(item.error.message, item.error.status, item.error.code);
  }
  if (item.noData && age <= FAILURE_TTL_MS) {
    return {
      available: false,
      reason: item.reason || "no_data",
      message: item.message || "Ambee has no air quality station reading for this location.",
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

function remember(region, value) {
  cache.set(region.id, { at: Date.now(), value: value });
}

function rememberFailure(region, error) {
  const existing = cache.get(region.id);
  const failure = { message: error.message, status: error.status, code: error.code };
  if (existing && existing.value) {
    // Keep the last good reading so a later request can use it as a stale
    // fallback, but remember the recent failure to avoid hammering Ambee.
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

async function callAmbee(region) {
  if (!key()) {
    throw new AirError(
      "Ambee is not configured. Set the AMBEE_KEY environment variable.",
      503,
      "not_configured"
    );
  }

  const state = budget();
  if (state.exhausted) {
    throw new AirError(
      "The Ambee daily call limit has been reached. Cached readings are still available.",
      429,
      "quota_exceeded"
    );
  }

  const url = new URL(CONFIG.ambee.baseUrl);
  url.searchParams.set("lat", String(region.lat));
  url.searchParams.set("lng", String(region.lon));

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(5000, Number(CONFIG.ambee.timeoutMs) || 15000)
  );

  callsToday += 1;
  let response;
  let text;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "x-api-key": key(),
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "AdivasiSuraksha/1.0 (school project air quality proxy)"
      }
    });
    text = await response.text();
  } catch (error) {
    const reason = error && error.name === "AbortError" ? "timed out" : error.message;
    throw new AirError("Could not reach Ambee (" + reason + ").", 503, "upstream_unreachable");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    throw new AirError("The Ambee API key is invalid or has been reset.", 502, "invalid_key");
  }
  if (response.status === 422 || response.status === 429) {
    quotaExhausted = true;
    throw new AirError(
      "The Ambee quota or rate limit has been reached. Try again later or use cached data.",
      429,
      "quota_exceeded"
    );
  }
  if (!response.ok) {
    throw new AirError(
      "Ambee returned HTTP " + response.status + ".",
      502,
      "upstream_error"
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AirError("Ambee returned an unexpected response.", 502, "bad_response");
  }

  const list = Array.isArray(json.stations)
    ? json.stations
    : Array.isArray(json.data)
      ? json.data
      : [];
  const value = readingFrom(list[0], region);
  if (!value) {
    const missing = {
      available: false,
      reason: "no_data",
      message: "Ambee has no air quality station reading for this location."
    };
    cache.set(region.id, {
      at: Date.now(),
      noData: true,
      reason: missing.reason,
      message: missing.message
    });
    return missing;
  }
  remember(region, value.value);
  return {
    available: true,
    value: value.value,
    cached: false,
    stale: false
  };
}

function responseFor(region, result) {
  const state = budget();
  return Object.assign({
    v: 1,
    provider: "Ambee",
    service: "Air Quality API",
    district: districtPublic(region),
    fetchedAt: new Date().toISOString(),
    note:
      "Hourly air quality near the district centre. Smoke, dust and traffic can change it quickly. " +
      "It is an extra reading, not part of the five-hazard alarm count.",
    quota: {
      used: state.used,
      limit: state.limit,
      remaining: state.remaining
    }
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
        aqi: result.value.aqi,
        category: result.value.category,
        categoryKey: result.value.categoryKey,
        severity: result.value.severity,
        pollutant: result.value.pollutant,
        concentration: result.value.concentration,
        pm25: result.value.pm25,
        pm10: result.value.pm10,
        no2: result.value.no2,
        so2: result.value.so2,
        co: result.value.co,
        ozone: result.value.ozone,
        updatedAt: result.value.updatedAt,
        station: result.value.station,
        thresholds: result.value.thresholds,
        cached: Boolean(result.cached),
        stale: Boolean(result.stale)
      });
}

/**
 * Look up one district. Throws AirError for configuration, quota or upstream
 * failures. A location with no station returns available:false with HTTP 200.
 */
async function getAirQuality(value) {
  const region = resolveRegion(value);
  if (!region) {
    throw new AirError("Unknown district. Use /api/districts for the list.", 404, "unknown_district");
  }

  const cached = cachedReading(region);
  if (cached) {
    return responseFor(region, cached);
  }

  try {
    const result = await callAmbee(region);
    return responseFor(region, result);
  } catch (error) {
    if (!(error instanceof AirError)) throw error;
    lastError = error.message;
    if (error.code !== "quota_exceeded" && error.code !== "not_configured") {
      rememberFailure(region, error);
    }
    // If a refresh fails (quota, outage, bad key), the last good reading is
    // still useful for a few hours. It is clearly marked stale in the payload.
    const stale = staleReading(region);
    if (stale) return responseFor(region, stale);
    throw error;
  }
}

/**
 * Fail-soft version for the LoRa/device feed. A missing Ambee reading never
 * stops the five-hazard disaster packet from going out.
 */
async function getAirForRegion(region) {
  try {
    const data = await getAirQuality(region.id);
    return Object.assign({}, data, { error: null });
  } catch (error) {
    return {
      v: 1,
      provider: "Ambee",
      available: false,
      reason: error.code || "air_unavailable",
      message: error.message,
      district: districtPublic(region),
      error: error.code || "air_unavailable",
      quota: (function () {
        const state = budget();
        return { used: state.used, limit: state.limit, remaining: state.remaining };
      })()
    };
  }
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

function getStatus() {
  const state = budget();
  return {
    configured: Boolean(key()),
    provider: "Ambee",
    endpoint: CONFIG.ambee.baseUrl,
    cacheMinutes: CONFIG.ambee.cacheMinutes,
    dailyLimit: DAILY_LIMIT,
    callsToday: state.used,
    remaining: state.remaining,
    quotaExhausted: quotaExhausted,
    cachedDistricts: cache.size,
    lastError: lastError || null
  };
}

module.exports = {
  AirError,
  getAirQuality,
  getAirForRegion,
  getStatus,
  categoryKey
};
