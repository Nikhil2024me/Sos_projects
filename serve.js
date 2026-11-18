#!/usr/bin/env node
/**
 * Adivasi Suraksha - zero-dependency local server.
 *
 * Serves the website and the live feed used by ESP32 / LoRa gateways.
 * Usage: node serve.js [port]
 *
 * The server listens on all interfaces by default so a device on the same
 * Wi-Fi can reach /api. Use HOST=127.0.0.1 to keep it local-only.
 */
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { exec } = require("node:child_process");
const feed = require("./feed");
const routes = require("./route");
const ambee = require("./ambee");
const gpm = require("./gpm");
const hazards = require("./hazards");

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 5173);
const HOST = process.env.HOST || "0.0.0.0";
const OPEN = process.argv.includes("--open") || process.env.OPEN_BROWSER === "1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".webmanifest": "application/manifest+json"
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function send(res, status, body, type) {
  res.writeHead(status, Object.assign({
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff"
  }, CORS));
  res.end(body);
}

function sendJson(res, status, data, extraHeaders) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }, CORS, extraHeaders || {}));
  res.end(body);
}

function sendText(res, status, body) {
  res.writeHead(status, Object.assign({
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }, CORS));
  res.end(body);
}

function apiIndex() {
  return {
    app: "Adivasi Suraksha",
    version: "1.0.0",
    purpose: "Live disaster alerts for ESP32 and LoRa village receivers.",
    endpoints: {
      "/api/health": "Server and feed status (does not fetch upstream data).",
      "/api/districts": "The 30 covered districts with their packet index.",
      "/api/alerts": "All districts with severity, alerts and packet.",
      "/api/alerts?district=bastar": "One district with weather and alert details.",
      "/api/alerts/<id>": "Same as above, district id in the path.",
      "/api/lora?district=bastar": "text/plain packet, ready to send over LoRa.",
      "/api/lora?district=bastar&format=json": "Packet plus decoded fields.",
      "/api/air?district=bastar": "Ambee air quality for one district (cached for an hour).",
      "/api/gpm?district=bastar": "NASA GPM IMERG observed rainfall for one district (cached for six hours).",
      "/api/hazards?district=bastar": "Extra wider-hazard context from GDACS, NASA EONET and ReliefWeb (never an alarm input).",
      "/api/route?fromLat=17.385&fromLon=78.487&to=bhadrachalam": "Bhuvan road route as GeoJSON (same-state routes only).",
      "/api/route?lat1=17.385&lon1=78.487&lat2=17.969&lon2=80.470": "Bhuvan route between two coordinates."
    },
    coverage: {
      tribalDistricts: 30,
      cities: 32,
      note: "The web dashboard covers 30 tribal districts plus 32 cities. The LoRa packet and the device feed carry the 30 tribal districts only (indexes 01-30); cities never go over the radio link."
    },
    packet: {
      format: "AS1,DD,OV,FRWHQ,DDHHMM or AS2,DD,OV,FRWHQK,DDHHMM",
      example: "AS2,18,2,200002,171230",
      fields: {
        AS1: "five-hazard packet without air quality",
        AS2: "same packet plus one Ambee air-quality digit",
        DD: "district index 01-30 (see /api/districts)",
        OV: "overall alarm severity: 0 safe, 1 watch, 2 warning, 3 severe",
        FRWHQK: "severity for fire, rain, wind, heat, earthquake, air (0-3)",
        DDHHMM: "data generation time in IST"
      },
      note: "The air digit is informational; it does not raise the alarm level.",
      maxBytes: 51
    },
    airQuality: {
      provider: "Ambee",
      quota: "Evaluation keys allow about 100 calls/day. The server caches one district for an hour and stops at 80 calls/day."
    },
    gpm: {
      provider: "NASA GPM IMERG Early Run (GES DISC)",
      access: "Earthdata token stored server-side. A one-time GES DISC EULA approval is required for the account.",
      use: "Observed daily rainfall near the district centre. Informational only; it does not change the five-hazard alarm or the LoRa packet."
    },
    hazards: {
      providers: ["GDACS", "NASA EONET", "ReliefWeb"],
      use: "Extra web-only situational awareness near the district. GDACS and NASA EONET are distance-filtered; ReliefWeb adds South Asia disasters. None of them change the five-hazard alarm or the LoRa packet.",
      reliefweb: "Uses v2 (v1 is decommissioned) and needs an approved appname in server-secrets.js or RELIEFWEB_APPNAME."
    },
    routing: {
      provider: "Bhuvan (ISRO) Shortest Path API",
      token: "configured in config.js; expires after one day",
      limits: "Both points must be in the same state. Some states have no road coverage."
    },
    warning: "LAN use only. The feed has no authentication; do not expose it to the internet."
  };
}

async function handleApi(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "method_not_allowed", allow: "GET, OPTIONS" }, { Allow: "GET, OPTIONS" });
  }

  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    return sendJson(res, 400, { error: "bad_request" });
  }

  const pathname = url.pathname.replace(/\/+$/, "") || "/api";
  const district = url.searchParams.get("district") || url.searchParams.get("d");

  try {
    if (pathname === "/api") {
      return sendJson(res, 200, apiIndex());
    }
    if (pathname === "/api/health") {
      return sendJson(res, 200, feed.getHealth());
    }
    if (pathname === "/api/districts") {
      return sendJson(res, 200, feed.getDistricts());
    }
    if (pathname === "/api/alerts") {
      if (district) return sendJson(res, 200, await feed.getDistrictAlert(district));
      return sendJson(res, 200, await feed.getAllAlerts());
    }
    const alertMatch = pathname.match(/^\/api\/alerts\/([^/]+)$/);
    if (alertMatch) {
      return sendJson(res, 200, await feed.getDistrictAlert(decodeURIComponent(alertMatch[1])));
    }
    if (pathname === "/api/air") {
      if (!district) {
        return sendJson(res, 400, {
          error: "district_required",
          hint: "Use /api/air?district=bastar or an index 1-30."
        });
      }
      return sendJson(res, 200, await ambee.getAirQuality(district));
    }
    if (pathname === "/api/gpm") {
      if (!district) {
        return sendJson(res, 400, {
          error: "district_required",
          hint: "Use /api/gpm?district=bastar or an index 1-30."
        });
      }
      return sendJson(res, 200, await gpm.getRainfall(district));
    }
    if (pathname === "/api/hazards") {
      if (!district) {
        return sendJson(res, 400, {
          error: "district_required",
          hint: "Use /api/hazards?district=bastar or an index 1-30."
        });
      }
      return sendJson(res, 200, await hazards.getForDistrict(district));
    }
    if (pathname === "/api/route") {
      const route = await routes.getRoute({
        fromLat: url.searchParams.get("fromLat") || url.searchParams.get("lat1"),
        fromLon: url.searchParams.get("fromLon") || url.searchParams.get("lon1"),
        lat2: url.searchParams.get("lat2"),
        lon2: url.searchParams.get("lon2"),
        to: url.searchParams.get("to") || url.searchParams.get("district") || url.searchParams.get("d")
      });
      return sendJson(res, 200, route);
    }
    if (pathname === "/api/lora") {
      if (!district) {
        return sendJson(res, 400, {
          error: "district_required",
          hint: "Use /api/lora?district=bastar or an index 1-30."
        });
      }
      const data = await feed.getLora(district);
      const wantsJson = url.searchParams.get("format") === "json" ||
        (req.headers.accept || "").includes("application/json");
      if (wantsJson) return sendJson(res, 200, data);
      return sendText(res, 200, data.packet);
    }
    return sendJson(res, 404, { error: "not_found", endpoints: "/api" });
  } catch (error) {
    const status = error.status || 503;
    console.error("[api]", error.message);
    if (error.name === "RouteError") {
      return sendJson(res, status, {
        error: error.code || "route_unavailable",
        message: error.message,
        provider: "Bhuvan (ISRO)",
        endpoints: "/api"
      }, status >= 500 ? { "Retry-After": "60" } : undefined);
    }
    if (error.name === "AirError") {
      return sendJson(res, status, {
        error: error.code || "air_unavailable",
        message: error.message,
        provider: "Ambee",
        endpoints: "/api"
      }, status >= 500 ? { "Retry-After": "60" } : undefined);
    }
    if (error.name === "GpmError") {
      return sendJson(res, status, {
        error: error.code || "gpm_unavailable",
        message: error.message,
        provider: "NASA GPM",
        approvalUrl: error.approvalUrl || null,
        endpoints: "/api"
      }, status >= 500 ? { "Retry-After": "60" } : undefined);
    }
    if (error.name === "HazardError") {
      return sendJson(res, status, {
        error: error.code || "hazards_unavailable",
        message: error.message,
        provider: "GDACS, NASA EONET, ReliefWeb",
        endpoints: "/api"
      }, status >= 500 ? { "Retry-After": "60" } : undefined);
    }
    return sendJson(res, status, {
      error: status === 404 ? "unknown_district" : "feed_unavailable",
      message: error.message,
      endpoints: "/api"
    }, status === 503 ? { "Retry-After": "60" } : undefined);
  }
}

function lanAddresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach((name) => {
    (interfaces[name] || []).forEach((entry) => {
      if (entry.family !== "IPv4" || entry.internal) return;
      if (entry.address.startsWith("169.254.")) return;
      addresses.push({ name, address: entry.address });
    });
  });
  return addresses;
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith("/api")) {
    handleApi(req, res);
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    return send(res, 400, "Bad request");
  }

  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.join(ROOT, urlPath);
  const relative = path.relative(ROOT, filePath);

  // Prevent path traversal outside the project root.
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return send(res, 403, "Forbidden");
  }

  // Never serve server-only secrets or the key inventory, even through a
  // normalized path such as /./server-secrets.js, and even on a
  // case-insensitive filesystem.
  const privateName = relative.toLowerCase();
  if (privateName === "server-secrets.js" || privateName === "apis.txt") {
    return send(res, 404, "Not found");
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, "Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`Adivasi Suraksha running at ${url}`);
  if (HOST === "0.0.0.0") {
    const addresses = lanAddresses();
    if (addresses.length) {
      console.log("Device feed (use from the ESP32 on the same Wi-Fi):");
      addresses.forEach((entry) => {
        console.log(`  http://${entry.address}:${PORT}/api/lora?district=bastar`);
      });
    } else {
      console.log("No LAN IPv4 address found. Connect this computer to Wi-Fi for the ESP32 feed.");
    }
  }
  if (HOST === "0.0.0.0") {
    console.log("If the ESP32 cannot connect, allow Node.js through the firewall on private networks.");
  }
  console.log("Press Ctrl+C to stop.");
  if (OPEN) {
    const command = process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
    exec(command, (error) => {
      if (error) console.log(`Open ${url} in your browser.`);
    });
  }
});
