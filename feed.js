#!/usr/bin/env node
/**
 * Adivasi Suraksha - live alert feed for devices.
 *
 * The website calculates alerts in the browser. An ESP32 or LoRa module cannot
 * run that code, so this module repeats the same fetch -> parse -> alert steps
 * on the server and exposes small payloads through serve.js.
 *
 * The result is cached for CONFIG.refreshMinutes. If an upstream API is down,
 * the last good snapshot is served for up to CONFIG.cacheMaxAgeHours.
 *
 * Packet formats:
 *   AS1,<district 01-30>,<overall 0-3>,<fire><rain><wind><heat><quake>,<DDHHMM>
 *   AS2,<district 01-30>,<overall 0-3>,<fire><rain><wind><heat><quake><air>,<DDHHMM>
 *
 * AS2 is used when an Ambee air-quality reading is available. The air digit is
 * additional information: the overall alarm and buzzer still follow the five
 * disaster hazards, so ordinary city pollution does not sound an emergency
 * alarm all day. Both versions fit one LoRa frame.
 *
 * Severity codes: 0 safe, 1 watch, 2 warning, 3 severe.
 */
"use strict";

const CONFIG = require("./config");
const Logic = require("./logic");
const ambee = require("./ambee");
const gpm = require("./gpm");
const hazards = require("./hazards");

const UPSTREAM_TIMEOUT_MS = 20000;
const REFRESH_MS = CONFIG.refreshMinutes * 60 * 1000;
const STALE_MAX_MS = CONFIG.cacheMaxAgeHours * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 60 * 1000;

const PACKET_VERSION = "AS2";
const PACKET_VERSION_LEGACY = "AS1";
const ALARM_HAZARDS = ["fire", "rain", "wind", "heat", "quake"];
const PACKET_HAZARDS = ALARM_HAZARDS.concat(["air"]);
const SEVERITIES = ["safe", "watch", "warning", "severe"];
const DISTRICT_INDEX = new Map(CONFIG.regions.map((region, i) => [region.id, i + 1]));

let cache = null;
let inflight = null;
let lastFailureAt = 0;
let lastFailureMessage = "";

class FeedError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "FeedError";
    this.status = status || 503;
  }
}

function firmsUrl(source) {
  return CONFIG.firms.baseUrl + "/" + CONFIG.firms.key + "/" + source + "/" + CONFIG.firms.bbox + "/" + CONFIG.firms.days;
}

function weatherUrl() {
  const params = new URLSearchParams();
  params.set("latitude", CONFIG.regions.map((region) => region.lat).join(","));
  params.set("longitude", CONFIG.regions.map((region) => region.lon).join(","));
  params.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m");
  params.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max");
  params.set("timezone", CONFIG.weather.timezone);
  params.set("forecast_days", String(CONFIG.weather.forecastDays));
  return CONFIG.weather.baseUrl + "?" + params.toString();
}

async function fetchWithTimeout(url, type) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AdivasiSuraksha/1.0 (school project device feed)" }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return type === "json" ? response.json() : response.text();
  } finally {
    clearTimeout(timer);
  }
}

function fetchText(url) {
  return fetchWithTimeout(url, "text");
}

function fetchJson(url) {
  return fetchWithTimeout(url, "json");
}

/**
 * Fetch all upstream feeds and build a fresh snapshot. On success, replaces the
 * cache. Throws only when there is no usable data at all.
 */
async function refresh() {
  const previous = cache;
  const [firmsReplies, weatherReplies, quakeReplies] = await Promise.all([
    Promise.allSettled(CONFIG.firms.sources.map((source) => fetchText(firmsUrl(source)))),
    Promise.allSettled([fetchJson(weatherUrl())]),
    Promise.allSettled([fetchJson(Logic.quakeFeedUrl(CONFIG))])
  ]);
  const weatherReply = weatherReplies[0];
  const quakeReply = quakeReplies[0];

  const sources = { firms: "error", weather: "error", quakes: "error" };
  let fires = previous ? previous.fires : [];
  let quakes = previous ? previous.quakes : [];
  let weatherById = previous ? previous.weatherById : null;

  /* ---- Satellite fire detections ---- */
  let freshFires = [];
  let firmsSuccesses = 0;
  firmsReplies.forEach((reply, index) => {
    if (reply.status !== "fulfilled") return;
    firmsSuccesses += 1;
    try {
      freshFires = freshFires.concat(Logic.parseFirmsCsv(reply.value, CONFIG.firms.sources[index], {
        minModisConfidence: CONFIG.firms.minModisConfidence
      }));
    } catch (error) {
      console.error("[feed] FIRMS parse failed:", CONFIG.firms.sources[index], error.message);
    }
  });
  if (firmsSuccesses > 0) {
    fires = freshFires.sort((a, b) => b.ts - a.ts).slice(0, CONFIG.firms.maxPoints);
    sources.firms = "live";
  } else if (previous) {
    sources.firms = "saved";
  }

  /* ---- Weather forecast ---- */
  if (weatherReply.status === "fulfilled") {
    const fresh = Logic.normalizeWeatherJson(weatherReply.value, CONFIG.regions);
    const count = Object.keys(fresh).length;
    if (count > 0) {
      if (count < CONFIG.regions.length && previous && previous.weatherById) {
        CONFIG.regions.forEach((region) => {
          if (!fresh[region.id] && previous.weatherById[region.id]) {
            fresh[region.id] = previous.weatherById[region.id];
          }
        });
      }
      weatherById = fresh;
      sources.weather = count === CONFIG.regions.length ? "live" : "partial";
    } else if (previous) {
      sources.weather = "saved";
    }
  } else if (previous) {
    sources.weather = "saved";
  }

  /* ---- Earthquakes ---- */
  if (quakeReply.status === "fulfilled") {
    quakes = Logic.parseQuakesGeoJson(quakeReply.value, CONFIG.quakes.bbox);
    sources.quakes = "live";
  } else if (previous) {
    sources.quakes = "saved";
  }

  if (sources.firms === "error" && sources.weather === "error" && sources.quakes === "error") {
    throw new FeedError("All upstream feeds are unavailable.");
  }

  const now = Date.now();
  const snapshot = Logic.buildSnapshot(CONFIG, CONFIG.regions, fires, quakes, weatherById, now);

  cache = {
    snapshot,
    fires,
    quakes,
    weatherById,
    fetchedAt: now,
    sources,
    partial: Object.keys(sources).some((key) => sources[key] !== "live")
  };
  lastFailureAt = 0;
  lastFailureMessage = "";

  console.log(
    "[feed] refreshed:",
    sources.firms, "/", sources.weather, "/", sources.quakes,
    "-", snapshot.totalFires, "fires"
  );
  return view(cache);
}

function view(entry, forceStale, error) {
  const age = Date.now() - entry.fetchedAt;
  return {
    snapshot: entry.snapshot,
    sources: entry.sources,
    fetchedAt: entry.fetchedAt,
    stale: Boolean(forceStale) || age >= REFRESH_MS,
    error: error || null
  };
}

/**
 * Return a current snapshot, using the 10 minute cache and coalescing parallel
 * requests. Serves stale data for up to 24 hours if upstream fails.
 */
async function getFeed() {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < REFRESH_MS) {
    return view(cache);
  }

  if (cache && cache.lastFailureAt && now - cache.lastFailureAt < RETRY_AFTER_FAILURE_MS) {
    return view(cache, true, cache.lastFailureMessage);
  }

  if (!cache && lastFailureAt && now - lastFailureAt < RETRY_AFTER_FAILURE_MS) {
    throw new FeedError(lastFailureMessage || "Upstream feeds are unavailable.");
  }

  if (!inflight) {
    inflight = (async () => {
      try {
        return await refresh();
      } catch (error) {
        lastFailureAt = Date.now();
        lastFailureMessage = error.message;
        if (cache && Date.now() - cache.fetchedAt < STALE_MAX_MS) {
          cache.lastFailureAt = Date.now();
          cache.lastFailureMessage = error.message;
          console.error("[feed] upstream failed, serving saved data:", error.message);
          return view(cache, true, error.message);
        }
        throw error;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

function resolveDistrict(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const byId = CONFIG.regionById[text.toLowerCase()];
  if (byId) return byId;
  if (/^\d+$/.test(text)) {
    const index = Number(text);
    if (index >= 1 && index <= CONFIG.regions.length) return CONFIG.regions[index - 1];
  }
  return null;
}

function istStamp(ts) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CONFIG.weather.timezone || "Asia/Kolkata",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(ts));
  const pick = (type) => {
    const part = parts.find((item) => item.type === type);
    return part ? part.value : "00";
  };
  return pick("day") + pick("hour") + pick("minute");
}

/**
 * Encode one district into the LoRa packet. Kept under 51 bytes so it fits a
 * single LoRa packet at common spreading factors.
 */
function encodeLoraPacket(region, generatedAt, air) {
  const index = DISTRICT_INDEX.get(region.id);
  if (!index) throw new Error("Unknown district: " + region.id);
  const hazards = ALARM_HAZARDS.map((type) => {
    const alert = region.alerts.find((item) => item.type === type);
    return alert ? String(Logic.rank(alert.severity)) : "0";
  });

  const hasAir = Boolean(air && air.available && air.severity);
  if (hasAir) hazards.push(String(Logic.rank(air.severity)));

  return [
    hasAir ? PACKET_VERSION : PACKET_VERSION_LEGACY,
    String(index).padStart(2, "0"),
    String(Logic.rank(region.severity)),
    hazards.join(""),
    istStamp(generatedAt || Date.now())
  ].join(",");
}

/**
 * Decode and validate a packet. Used by the API (format=json) and the tests.
 * AS1 (five hazards) and AS2 (five hazards plus air) are both accepted.
 */
function decodeLoraPacket(packet) {
  const text = String(packet == null ? "" : packet).trim();
  const bytes = new TextEncoder().encode(text).length;
  const fail = (error) => ({ valid: false, error, bytes, raw: text });
  const parts = text.split(",");
  if (parts.length !== 5) return fail("Expected 5 comma-separated fields");

  const version = parts[0];
  const hasAir = version === PACKET_VERSION;
  if (!hasAir && version !== PACKET_VERSION_LEGACY) return fail("Unknown packet version");

  const index = Number(parts[1]);
  const overall = Number(parts[2]);
  const hazardCodes = parts[3];
  const stamp = parts[4];
  const digitCount = hasAir ? 6 : 5;

  if (!Number.isInteger(index) || index < 1 || index > CONFIG.regions.length) {
    return fail("District index out of range");
  }
  if (!Number.isInteger(overall) || overall < 0 || overall > 3) {
    return fail("Overall severity must be 0-3");
  }
  if (!new RegExp("^[0-3]{" + digitCount + "}$").test(hazardCodes)) {
    return fail("Hazard field must be " + digitCount + " digits 0-3");
  }
  if (!/^\d{6}$/.test(stamp)) return fail("Time must be DDHHMM");

  const region = CONFIG.regions[index - 1];
  const hazards = {};
  ALARM_HAZARDS.forEach((type, i) => {
    hazards[type] = SEVERITIES[Number(hazardCodes[i])];
  });
  hazards.air = hasAir ? SEVERITIES[Number(hazardCodes[5])] : null;

  return {
    valid: true,
    bytes,
    raw: text,
    version: version,
    hasAir: hasAir,
    districtIndex: index,
    districtId: region.id,
    district: region.name.en,
    overall: SEVERITIES[overall],
    hazards,
    timestamp: {
      day: Number(stamp.slice(0, 2)),
      hour: Number(stamp.slice(2, 4)),
      minute: Number(stamp.slice(4, 6)),
      timeZone: CONFIG.weather.timezone || "Asia/Kolkata"
    }
  };
}

function round(value, digits) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const factor = Math.pow(10, digits == null ? 1 : digits);
  return Math.round(Number(value) * factor) / factor;
}

function weatherSummary(weather) {
  if (!weather) return null;
  const current = weather.current || {};
  const daily = weather.daily || {};
  const days = [];
  if (Array.isArray(daily.time)) {
    for (let i = 0; i < daily.time.length && i < 4; i++) {
      days.push({
        date: daily.time[i],
        weatherCode: daily.weather_code ? daily.weather_code[i] : null,
        maxC: round(daily.temperature_2m_max ? daily.temperature_2m_max[i] : null, 1),
        minC: round(daily.temperature_2m_min ? daily.temperature_2m_min[i] : null, 1),
        rainMm: round(daily.precipitation_sum ? daily.precipitation_sum[i] : null, 1),
        rainChance: daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null,
        gustKmh: round(daily.wind_gusts_10m_max ? daily.wind_gusts_10m_max[i] : null, 1)
      });
    }
  }
  return {
    elevationM: weather.elevation == null ? null : Math.round(weather.elevation),
    now: {
      tempC: round(current.temperature_2m, 1),
      feelsC: round(current.apparent_temperature, 1),
      humidity: round(current.relative_humidity_2m, 0),
      rainMm: round(current.precipitation, 1),
      weatherCode: current.weather_code == null ? null : current.weather_code,
      windKmh: round(current.wind_speed_10m, 1),
      gustKmh: round(current.wind_gusts_10m, 1)
    },
    daily: days
  };
}

function generatedIso(feed) {
  return new Date(feed.snapshot.generatedAt).toISOString();
}

function airSummary(air) {
  if (!air) return null;
  return {
    available: Boolean(air.available),
    provider: "Ambee",
    aqi: air.aqi == null ? null : air.aqi,
    category: air.category || null,
    categoryKey: air.categoryKey || null,
    severity: air.severity || null,
    pollutant: air.pollutant || null,
    pm25: air.pm25 == null ? null : air.pm25,
    pm10: air.pm10 == null ? null : air.pm10,
    station: air.station || null,
    updatedAt: air.updatedAt || null,
    cached: Boolean(air.cached),
    stale: Boolean(air.stale),
    reason: air.reason || null,
    message: air.message || null,
    thresholds: air.thresholds || CONFIG.thresholds.air
  };
}

function districtPayload(feed, region, air) {
  const live = feed.snapshot.regions.find((item) => item.id === region.id);
  if (!live) throw new FeedError("District data is not available.");
  return {
    v: 1,
    generatedAt: generatedIso(feed),
    fetchedAt: new Date(feed.fetchedAt).toISOString(),
    stale: feed.stale,
    sources: feed.sources,
    district: {
      index: DISTRICT_INDEX.get(region.id),
      id: region.id,
      name: region.name.en,
      nameHi: region.name.hi,
      state: region.state.en,
      stateHi: region.state.hi,
      tier: region.tier || "tribal",
      lat: region.lat,
      lon: region.lon
    },
    severity: live.severity,
    alerts: live.alerts.map((alert) => {
      const data = Object.assign({}, alert.data);
      if (data.nearestKm != null) data.nearestKm = round(data.nearestKm, 1);
      if (data.distanceKm != null) data.distanceKm = round(data.distanceKm, 1);
      return Object.assign({ hazard: alert.type, severity: alert.severity }, data);
    }),
    weather: weatherSummary(live.weather),
    air: airSummary(air),
    packet: encodeLoraPacket(live, feed.snapshot.generatedAt, air)
  };
}

async function getDistrictAlert(value) {
  const region = resolveDistrict(value);
  if (!region) throw new FeedError("Unknown district. Use /api/districts for the list.", 404);
  const feed = await getFeed();
  const air = await ambee.getAirForRegion(region);
  return districtPayload(feed, region, air);
}

async function getLora(value) {
  const region = resolveDistrict(value);
  if (!region) throw new FeedError("Unknown district. Use /api/districts for the list.", 404);
  const feed = await getFeed();
  const live = feed.snapshot.regions.find((item) => item.id === region.id);
  const air = await ambee.getAirForRegion(region);
  const packet = encodeLoraPacket(live, feed.snapshot.generatedAt, air);
  return {
    v: 1,
    district: {
      index: DISTRICT_INDEX.get(region.id),
      id: region.id,
      name: region.name.en,
      state: region.state.en
    },
    generatedAt: generatedIso(feed),
    stale: feed.stale,
    sources: feed.sources,
    packet,
    bytes: new TextEncoder().encode(packet).length,
    air: airSummary(air),
    decoded: decodeLoraPacket(packet)
  };
}

async function getAllAlerts() {
  const feed = await getFeed();
  const snapshot = feed.snapshot;
  return {
    v: 1,
    generatedAt: generatedIso(feed),
    fetchedAt: new Date(feed.fetchedAt).toISOString(),
    stale: feed.stale,
    sources: feed.sources,
    totalFires: snapshot.totalFires,
    latestFire: snapshot.latestFire ? new Date(snapshot.latestFire).toISOString() : null,
    summary: Logic.countHazards(snapshot.regions),
    districts: snapshot.regions.map((region) => ({
      index: DISTRICT_INDEX.get(region.id),
      id: region.id,
      name: region.name.en,
      nameHi: region.name.hi,
      state: region.state.en,
      tier: region.tier || "tribal",
      severity: region.severity,
      packet: encodeLoraPacket(region, snapshot.generatedAt),
      alerts: region.alerts.map((alert) => ({
        hazard: alert.type,
        severity: alert.severity
      }))
    }))
  };
}

function getDistricts() {
  return {
    v: 1,
    count: CONFIG.regions.length,
    note: "Use the index or id in /api/alerts?district=... and /api/lora?district=...",
    districts: CONFIG.regions.map((region, i) => ({
      index: i + 1,
      id: region.id,
      name: region.name.en,
      nameHi: region.name.hi,
      state: region.state.en,
      stateHi: region.state.hi,
      tier: region.tier || "tribal",
      lat: region.lat,
      lon: region.lon
    }))
  };
}

function getHealth() {
  const ageSeconds = cache ? Math.max(0, Math.floor((Date.now() - cache.fetchedAt) / 1000)) : null;
  return {
    ok: true,
    ready: Boolean(cache),
    app: CONFIG.appName,
    version: CONFIG.version,
    districts: CONFIG.regions.length,
    generatedAt: cache ? new Date(cache.snapshot.generatedAt).toISOString() : null,
    ageSeconds,
    stale: cache ? ageSeconds * 1000 >= REFRESH_MS : true,
    sources: cache ? cache.sources : null,
    lastError: lastFailureMessage || null,
    air: ambee.getStatus(),
    gpm: gpm.getStatus(),
    hazards: hazards.getStatus(),
    packetFormat: "AS1,district(01-30),overall(0-3),FRWHQ(0-3 each),DDHHMM or AS2 with an extra air digit",
    packetMaxBytes: 51
  };
}

module.exports = {
  FeedError,
  PACKET_HAZARDS,
  PACKET_VERSION,
  PACKET_VERSION_LEGACY,
  ALARM_HAZARDS,
  DISTRICT_INDEX,
  resolveDistrict,
  encodeLoraPacket,
  decodeLoraPacket,
  getFeed,
  getHealth,
  getDistricts,
  getAllAlerts,
  getDistrictAlert,
  getLora
};
