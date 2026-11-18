#!/usr/bin/env node
/**
 * Adivasi Suraksha - ISRO Bhuvan routing proxy.
 *
 * The Bhuvan Shortest Path API does not send CORS headers for browser use, so
 * the page calls this module through serve.js instead. The token stays in one
 * place and an expired token produces a readable error.
 *
 * API used:
 *   GET https://bhuvan-app1.nrsc.gov.in/api/routing/curl_routing_state.php
 *       ?lat1=..&lon1=..&lat2=..&lon2=..&token=..
 *   Header: Content-Type: application/x-www-form-urlencoded
 *
 * Limitations of the Bhuvan service:
 *   - Both points must be in the same Indian state.
 *   - Some states (for example Chhattisgarh at the time of writing) return an
 *     empty geometry even though the token is valid.
 *   - The token expires after one day.
 */
"use strict";

const CONFIG = require("./config");
const Logic = require("./logic");
const Feed = require("./feed");

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_LIMIT = 60;
const routeCache = new Map();

class RouteError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "RouteError";
    this.status = status || 502;
    this.code = code || "route_unavailable";
  }
}

function round(value, digits) {
  const factor = Math.pow(10, digits == null ? 5 : digits);
  return Math.round(Number(value) * factor) / factor;
}

function number(value, name) {
  if (value == null || String(value).trim() === "") {
    throw new RouteError("Missing " + name + ".", 400, "missing_parameter");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new RouteError(name + " must be a number.", 400, "invalid_parameter");
  }
  return parsed;
}

function coordinate(lat, lon) {
  if (lat < -90 || lat > 90) throw new RouteError("Latitude is out of range.", 400, "invalid_parameter");
  if (lon < -180 || lon > 180) throw new RouteError("Longitude is out of range.", 400, "invalid_parameter");
  return { lat: round(lat, 6), lon: round(lon, 6) };
}

function token() {
  return String(process.env.BHUVAN_TOKEN || (CONFIG.bhuvan && CONFIG.bhuvan.key) || "").trim();
}

function cacheKey(from, to) {
  return [from.lat, from.lon, to.lat, to.lon].map((value) => value.toFixed(5)).join(",");
}

function readCache(key) {
  const entry = routeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    routeCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key, value) {
  if (routeCache.size >= CACHE_LIMIT) {
    const oldest = routeCache.keys().next().value;
    routeCache.delete(oldest);
  }
  routeCache.set(key, { at: Date.now(), value });
}

function upstreamMessage(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function parseBhuvanBody(text) {
  const cleaned = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!cleaned) {
    throw new RouteError("Bhuvan returned an empty response.", 502, "empty_response");
  }

  // The API returns these as plain text, not JSON.
  if (/invalid_token|access token provided is invalid|token.*(invalid|expired)/i.test(cleaned)) {
    throw new RouteError(
      "The Bhuvan access token is invalid or expired. Generate a new Routing token at bhuvan-app1.nrsc.gov.in/api and update config.js.",
      502,
      "invalid_token"
    );
  }
  if (/same state/i.test(cleaned)) {
    throw new RouteError(
      "Bhuvan can only route between two points in the same state. Move the start point closer to the district.",
      422,
      "same_state"
    );
  }
  if (/please provide latitudes/i.test(cleaned)) {
    throw new RouteError("Bhuvan did not receive valid start and end coordinates.", 422, "bad_coordinates");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new RouteError(
      "Bhuvan routing returned an unexpected response: " + upstreamMessage(cleaned),
      502,
      "bad_response"
    );
  }
}

function extractLines(geoJson) {
  if (!geoJson || !Array.isArray(geoJson.features)) return [];
  const lines = [];

  function addLine(coords) {
    if (!Array.isArray(coords) || coords.length < 2) return;
    const points = [];
    coords.forEach((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return;
      const lon = Number(pair[0]);
      const lat = Number(pair[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
      points.push([round(lon, 6), round(lat, 6)]);
    });
    if (points.length >= 2) lines.push(points);
  }

  geoJson.features.forEach((feature) => {
    const geometry = feature && feature.geometry;
    if (!geometry) return;
    if (geometry.type === "LineString") addLine(geometry.coordinates);
    if (geometry.type === "MultiLineString") {
      (geometry.coordinates || []).forEach(addLine);
    }
  });

  return lines;
}

function distanceKm(lines) {
  let total = 0;
  lines.forEach((line) => {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      total += Logic.haversineKm(a[1], a[0], b[1], b[0]);
    }
  });
  return Math.round(total * 10) / 10;
}

async function fetchBhuvan(from, to) {
  const key = token();
  if (!key) {
    throw new RouteError(
      "Bhuvan routing is not configured. Add a Routing token in config.js or set BHUVAN_TOKEN.",
      503,
      "token_missing"
    );
  }

  const url = new URL(CONFIG.bhuvan.routingUrl);
  url.searchParams.set("lat1", String(from.lat));
  url.searchParams.set("lon1", String(from.lon));
  url.searchParams.set("lat2", String(to.lat));
  url.searchParams.set("lon2", String(to.lon));
  url.searchParams.set("token", key);

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(5000, Number(CONFIG.bhuvan.timeoutMs) || 30000)
  );

  let response;
  let text;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "AdivasiSuraksha/1.0 (school project routing proxy)"
      }
    });
    text = await response.text();
  } catch (error) {
    const reason = error && error.name === "AbortError" ? "timed out" : error.message;
    throw new RouteError("Could not reach Bhuvan routing (" + reason + ").", 502, "upstream_unreachable");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new RouteError(
      "Bhuvan routing returned HTTP " + response.status + ": " + upstreamMessage(text),
      502,
      "upstream_error"
    );
  }

  const geoJson = parseBhuvanBody(text);
  if (geoJson && geoJson.error) {
    const detail = geoJson.error_description || geoJson.error;
    if (/token/i.test(String(geoJson.error))) {
      throw new RouteError(
        "The Bhuvan access token is invalid or expired. Generate a new Routing token and update config.js.",
        502,
        "invalid_token"
      );
    }
    throw new RouteError("Bhuvan routing error: " + detail, 502, "upstream_error");
  }

  const lines = extractLines(geoJson);
  if (!lines.length) {
    throw new RouteError(
      "Bhuvan has no road route for this pair. The service only covers some states, and both points must be in the same state.",
      422,
      "no_route"
    );
  }

  return {
    lines,
    distanceKm: distanceKm(lines)
  };
}

async function getRoute(input) {
  const params = input || {};
  const tokenValue = token();
  if (!tokenValue) {
    throw new RouteError(
      "Bhuvan routing is not configured. Add a Routing token in config.js or set BHUVAN_TOKEN.",
      503,
      "token_missing"
    );
  }

  const from = coordinate(
    number(params.fromLat != null ? params.fromLat : params.lat1, "fromLat"),
    number(params.fromLon != null ? params.fromLon : params.lon1, "fromLon")
  );

  let to;
  let district = null;
  if (params.to != null && String(params.to).trim() !== "") {
    district = Feed.resolveDistrict(params.to);
    if (!district) {
      throw new RouteError("Unknown district. Use /api/districts for the list.", 404, "unknown_district");
    }
    to = coordinate(Number(district.lat), Number(district.lon));
  } else {
    to = coordinate(
      number(params.lat2, "lat2"),
      number(params.lon2, "lon2")
    );
  }

  const key = cacheKey(from, to);
  const cached = readCache(key);
  if (cached) return Object.assign({ cached: true }, cached);

  const result = await fetchBhuvan(from, to);
  const value = {
    v: 1,
    provider: "Bhuvan (ISRO)",
    service: "Shortest Path API",
    from: from,
    to: Object.assign({}, to, district ? {
      id: district.id,
      index: Feed.DISTRICT_INDEX.get(district.id),
      name: district.name.en,
      nameHi: district.name.hi,
      state: district.state.en,
      stateHi: district.state.hi
    } : {}),
    distanceKm: result.distanceKm,
    points: result.lines.reduce((sum, line) => sum + line.length, 0),
    geometry: {
      type: "MultiLineString",
      coordinates: result.lines
    },
    fetchedAt: new Date().toISOString(),
    note: "Bhuvan routing works only inside one state. Check the route against local conditions before travelling."
  };

  writeCache(key, value);
  return value;
}

function getStatus() {
  return {
    configured: Boolean(token()),
    endpoint: CONFIG.bhuvan && CONFIG.bhuvan.routingUrl,
    limits: [
      "both points must be in the same state",
      "some states have no road-network coverage",
      "the access token expires after one day"
    ]
  };
}

module.exports = {
  RouteError,
  getRoute,
  getStatus
};
