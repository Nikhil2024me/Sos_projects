/*
 * Adivasi Suraksha - HTTP API handler (Next.js route handlers / Node or edge).
 *
 * This is the serve.js `handleApi` function ported to a Web-standard
 * `Request -> Response` handler so it can run from a Next.js App Router catch-all
 * route (app/api/[...path]/route.js) on Node during `next dev` and on the edge
 * runtime when deployed to Cloudflare Pages.
 *
 * The upstream logic (feed.js, route.js, ambee.js, gpm.js, hazards.js) is
 * unchanged and shared with the ESP32/LoRa device feed and the test suite.
 */
import feed from "./feed.js";
import routes from "./route.js";
import ambee from "./ambee.js";
import gpm from "./gpm.js";
import hazards from "./hazards.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function sendJson(data, status = 200, extra) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...BASE_HEADERS,
      ...CORS,
      ...(extra || {}),
    },
  });
}

function sendText(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...BASE_HEADERS,
      ...CORS,
    },
  });
}

export function apiIndex() {
  return {
    app: "Adivasi Suraksha",
    version: "2.0.0",
    purpose: "Live disaster alerts for the web dashboard and ESP32 / LoRa village receivers.",
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
      "/api/route?lat1=17.385&lon1=78.487&lat2=17.969&lon2=80.470": "Bhuvan route between two coordinates.",
    },
    coverage: {
      tribalDistricts: 30,
      cities: 32,
      note: "The web dashboard covers 30 tribal districts plus 32 cities. The LoRa packet and the device feed carry the 30 tribal districts only (indexes 01-30); cities never go over the radio link.",
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
        DDHHMM: "data generation time in IST",
      },
      note: "The air digit is informational; it does not raise the alarm level.",
      maxBytes: 51,
    },
    airQuality: {
      provider: "Ambee",
      quota: "Evaluation keys allow about 100 calls/day. The server caches one district for an hour and stops at 80 calls/day.",
    },
    gpm: {
      provider: "NASA GPM IMERG Early Run (GES DISC)",
      access: "Earthdata token stored server-side (EARTHDATA_TOKEN). A one-time GES DISC EULA approval is required for the account.",
      use: "Observed daily rainfall near the district centre. Informational only; it does not change the five-hazard alarm or the LoRa packet.",
    },
    hazards: {
      providers: ["GDACS", "NASA EONET", "ReliefWeb"],
      use: "Extra web-only situational awareness near the district. GDACS and NASA EONET are distance-filtered; ReliefWeb adds South Asia disasters. None of them change the five-hazard alarm or the LoRa packet.",
      reliefweb: "Uses v2 (v1 is decommissioned) and needs an approved appname in RELIEFWEB_APPNAME.",
    },
    routing: {
      provider: "Bhuvan (ISRO) Shortest Path API",
      token: "configured in config.js or BHUVAN_TOKEN; expires after one day",
      limits: "Both points must be in the same state. Some states have no road coverage.",
    },
    warning: "The device feed has no authentication; keep it on a trusted network.",
  };
}

function errorResponse(error) {
  const status = error.status || 503;
  const retry = status >= 500 ? { "Retry-After": "60" } : undefined;

  if (error.name === "RouteError") {
    return sendJson(
      { error: error.code || "route_unavailable", message: error.message, provider: "Bhuvan (ISRO)", endpoints: "/api" },
      status,
      retry,
    );
  }
  if (error.name === "AirError") {
    return sendJson(
      { error: error.code || "air_unavailable", message: error.message, provider: "Ambee", endpoints: "/api" },
      status,
      retry,
    );
  }
  if (error.name === "GpmError") {
    return sendJson(
      { error: error.code || "gpm_unavailable", message: error.message, provider: "NASA GPM", approvalUrl: error.approvalUrl || null, endpoints: "/api" },
      status,
      retry,
    );
  }
  if (error.name === "HazardError") {
    return sendJson(
      { error: error.code || "hazards_unavailable", message: error.message, provider: "GDACS, NASA EONET, ReliefWeb", endpoints: "/api" },
      status,
      retry,
    );
  }
  return sendJson(
    { error: status === 404 ? "unknown_district" : "feed_unavailable", message: error.message, endpoints: "/api" },
    status,
    status === 503 ? { "Retry-After": "60" } : undefined,
  );
}

export async function handleApi(request) {
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (method !== "GET" && method !== "HEAD") {
    return sendJson({ error: "method_not_allowed", allow: "GET, OPTIONS" }, 405, { Allow: "GET, OPTIONS" });
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return sendJson({ error: "bad_request" }, 400);
  }

  const pathname = url.pathname.replace(/\/+$/, "") || "/api";
  const district = url.searchParams.get("district") || url.searchParams.get("d");

  try {
    if (pathname === "/api") return sendJson(apiIndex(), 200);
    if (pathname === "/api/health") return sendJson(feed.getHealth(), 200);
    if (pathname === "/api/districts") return sendJson(feed.getDistricts(), 200);
    if (pathname === "/api/alerts") {
      if (district) return sendJson(await feed.getDistrictAlert(district), 200);
      return sendJson(await feed.getAllAlerts(), 200);
    }
    const alertMatch = pathname.match(/^\/api\/alerts\/([^/]+)$/);
    if (alertMatch) return sendJson(await feed.getDistrictAlert(decodeURIComponent(alertMatch[1])), 200);

    if (pathname === "/api/air") {
      if (!district) {
        return sendJson({ error: "district_required", hint: "Use /api/air?district=bastar or an index 1-30." }, 400);
      }
      return sendJson(await ambee.getAirQuality(district), 200);
    }
    if (pathname === "/api/gpm") {
      if (!district) {
        return sendJson({ error: "district_required", hint: "Use /api/gpm?district=bastar or an index 1-30." }, 400);
      }
      return sendJson(await gpm.getRainfall(district), 200);
    }
    if (pathname === "/api/hazards") {
      if (!district) {
        return sendJson({ error: "district_required", hint: "Use /api/hazards?district=bastar or an index 1-30." }, 400);
      }
      return sendJson(await hazards.getForDistrict(district), 200);
    }
    if (pathname === "/api/route") {
      const route = await routes.getRoute({
        fromLat: url.searchParams.get("fromLat") || url.searchParams.get("lat1"),
        fromLon: url.searchParams.get("fromLon") || url.searchParams.get("lon1"),
        lat2: url.searchParams.get("lat2"),
        lon2: url.searchParams.get("lon2"),
        to: url.searchParams.get("to") || url.searchParams.get("district") || url.searchParams.get("d"),
      });
      return sendJson(route, 200);
    }
    if (pathname === "/api/lora") {
      if (!district) {
        return sendJson({ error: "district_required", hint: "Use /api/lora?district=bastar or an index 1-30." }, 400);
      }
      const data = await feed.getLora(district);
      const wantsJson =
        url.searchParams.get("format") === "json" ||
        (request.headers.get("accept") || "").includes("application/json");
      if (wantsJson) return sendJson(data, 200);
      return sendText(data.packet, 200);
    }
    return sendJson({ error: "not_found", endpoints: "/api" }, 404);
  } catch (error) {
    console.error("[api]", error && error.message);
    return errorResponse(error);
  }
}
