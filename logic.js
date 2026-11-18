/*
 * Adivasi Suraksha — pure data logic.
 * Kept separate from the DOM so the alert rules can be tested in Node.
 */
var SurveillanceLogic = (function () {
  "use strict";

  var SEVERITY_RANK = { safe: 0, watch: 1, warning: 2, severe: 3 };
  var HAZARD_ORDER = ["fire", "rain", "wind", "heat", "quake"];

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad;
    var dLon = (lon2 - lon1) * toRad;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
  }

  function distanceToRegion(fire, region) {
    return haversineKm(fire.lat, fire.lon, region.lat, region.lon);
  }

  function isoDateInZone(ts, timeZone) {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(ts));
    var out = { year: "0000", month: "00", day: "00" };
    parts.forEach(function (part) {
      if (part.type === "year") out.year = part.value;
      if (part.type === "month") out.month = part.value;
      if (part.type === "day") out.day = part.value;
    });
    return out.year + "-" + out.month + "-" + out.day;
  }

  function severityFor(value, thresholds) {
    if (value == null || !isFinite(value)) return null;
    if (value >= thresholds.severe) return "severe";
    if (value >= thresholds.warning) return "warning";
    if (value >= thresholds.watch) return "watch";
    return null;
  }

  function rank(severity) {
    return SEVERITY_RANK[severity] || 0;
  }

  function maxSeverity(severities) {
    return severities.reduce(function (best, sev) {
      return rank(sev) > rank(best) ? sev : best;
    }, "safe");
  }

  function parseFirmsCsv(text, sourceId, options) {
    if (!text || !text.trim()) return [];
    options = options || {};
    var minModis = options.minModisConfidence == null ? 30 : options.minModisConfidence;
    var lines = text.split(/\r?\n/).filter(function (line) { return line.trim() !== ""; });
    if (!lines.length) return [];

    var header = lines[0].split(",").map(function (h) { return h.trim(); });
    if (header[0] !== "latitude") {
      // Unexpected payload (HTML error page, etc.)
      return [];
    }
    var col = {};
    header.forEach(function (name, i) { col[name] = i; });

    var fires = [];
    for (var i = 1; i < lines.length; i++) {
      var f = lines[i].split(",");
      if (f.length < 12) continue;
      var lat = parseFloat(f[col.latitude]);
      var lon = parseFloat(f[col.longitude]);
      var date = (f[col.acq_date] || "").trim();
      var time = (f[col.acq_time] || "").trim();
      if (!isFinite(lat) || !isFinite(lon) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

      var hhmm = time.padStart(4, "0");
      var ts = Date.parse(date + "T" + hhmm.slice(0, 2) + ":" + hhmm.slice(2, 4) + ":00Z");
      if (!isFinite(ts)) continue;

      var rawConfidence = (f[col.confidence] || "").trim();
      var isNumericConfidence = /^\d+(\.\d+)?$/.test(rawConfidence);
      var confidence = isNumericConfidence
        ? Number(rawConfidence)
        : ({ l: 30, n: 70, h: 95 }[rawConfidence.toLowerCase()] || 60);
      // MODIS reports 0–100; low values are often industry or false alarms.
      if (isNumericConfidence && confidence < minModis) continue;
      // VIIRS low-confidence detections are noisy.
      if (!isNumericConfidence && rawConfidence.toLowerCase() === "l") continue;

      fires.push({
        id: sourceId + "-" + i,
        lat: lat,
        lon: lon,
        ts: ts,
        date: date,
        time: hhmm,
        satellite: (f[col.satellite] || "").trim(),
        instrument: (f[col.instrument] || "").trim(),
        confidence: confidence,
        confidenceRaw: rawConfidence,
        frp: parseFloat(f[col.frp]) || 0,
        brightness: parseFloat(f[col.bright_ti4]) || 0,
        daynight: (f[col.daynight] || "").trim(),
        source: sourceId
      });
    }
    fires.sort(function (a, b) { return b.ts - a.ts; });
    return fires;
  }

  function normalizeWeatherJson(json, regions) {
    var arr = Array.isArray(json) ? json : [json];
    var byId = {};
    regions.forEach(function (region, i) {
      var w = arr[i];
      if (w && w.daily && Array.isArray(w.daily.time)) {
        byId[region.id] = {
          elevation: w.elevation,
          current: w.current || null,
          daily: w.daily,
          currentUnits: w.current_units || {},
          dailyUnits: w.daily_units || {}
        };
      }
    });
    return byId;
  }

  function parseQuakesGeoJson(json, bbox) {
    if (!json || !Array.isArray(json.features)) return [];
    var quakes = [];
    json.features.forEach(function (feature) {
      var p = feature.properties || {};
      var coords = feature.geometry && feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      var lon = coords[0];
      var lat = coords[1];
      if (
        lat < bbox.minLat || lat > bbox.maxLat ||
        lon < bbox.minLon || lon > bbox.maxLon
      ) return;
      if (p.mag == null) return;
      quakes.push({
        id: feature.id,
        mag: p.mag,
        place: p.place,
        time: p.time,
        depth: coords.length > 2 ? coords[2] : null,
        lat: lat,
        lon: lon,
        url: p.url
      });
    });
    quakes.sort(function (a, b) { return b.time - a.time; });
    return quakes;
  }

  /**
   * Build the USGS FDSN query URL for the rolling window and India bbox.
   * Kept here so the browser and the device feed ask USGS for the same data.
   */
  function quakeFeedUrl(config, now) {
    var quakes = (config && config.quakes) || {};
    var base = quakes.baseUrl || quakes.url;
    if (!base) return "";
    var days = quakes.maxAgeDays == null ? 7 : quakes.maxAgeDays;
    var start = new Date((now || Date.now()) - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    var params = [
      "format=geojson",
      "minmagnitude=" + (quakes.minMagnitude == null ? 4 : quakes.minMagnitude),
      "starttime=" + start
    ];
    var box = quakes.bbox;
    if (box) {
      if (box.minLat != null) params.push("minlatitude=" + box.minLat);
      if (box.maxLat != null) params.push("maxlatitude=" + box.maxLat);
      if (box.minLon != null) params.push("minlongitude=" + box.minLon);
      if (box.maxLon != null) params.push("maxlongitude=" + box.maxLon);
    }
    return base + (base.indexOf("?") === -1 ? "?" : "&") + params.join("&");
  }

  function weatherCategory(code) {
    if (code == null) return "unknown";
    if (code === 0) return "clear";
    if (code === 1 || code === 2) return "partly";
    if (code === 3) return "cloudy";
    if (code === 45 || code === 48) return "fog";
    if (code >= 51 && code <= 57) return "drizzle";
    if (code >= 61 && code <= 65) return code >= 65 ? "heavyRain" : "rain";
    if (code === 66 || code === 67) return "heavyRain";
    if (code >= 71 && code <= 77) return "snow";
    if (code >= 80 && code <= 82) return code === 82 ? "heavyRain" : "rain";
    if (code === 85 || code === 86) return "snow";
    if (code >= 95 && code <= 99) return "storm";
    return "unknown";
  }

  function weatherWindow(weather, now, days, timeZone) {
    if (!weather || !weather.daily || !Array.isArray(weather.daily.time)) return [];
    var daily = weather.daily;
    var today = isoDateInZone(now || Date.now(), timeZone);
    var out = [];
    for (var i = 0; i < daily.time.length && out.length < (days || 3); i++) {
      var date = daily.time[i];
      if (date < today) continue;
      out.push({
        date: date,
        code: daily.weather_code ? daily.weather_code[i] : null,
        tmax: daily.temperature_2m_max ? daily.temperature_2m_max[i] : null,
        tmin: daily.temperature_2m_min ? daily.temperature_2m_min[i] : null,
        precip: daily.precipitation_sum ? daily.precipitation_sum[i] : null,
        precipProb: daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null,
        gust: daily.wind_gusts_10m_max ? daily.wind_gusts_10m_max[i] : null
      });
    }
    return out;
  }

  function bestDay(days, field, mode) {
    var best = null;
    days.forEach(function (day) {
      var value = day[field];
      if (value == null || !isFinite(value)) return;
      if (!best) {
        best = { day: day, value: value };
        return;
      }
      var better = mode === "min" ? value < best.value : value > best.value;
      if (better) best = { day: day, value: value };
    });
    return best;
  }

  function computeRegionAlerts(region, fires, quakes, weather, config, now) {
    now = now || Date.now();
    var thresholds = config.thresholds;
    var timeZone = config.weather && config.weather.timezone ? config.weather.timezone : "Asia/Kolkata";
    var radius = config.fireRadiusKm || 40;
    var alerts = [];

    // --- Forest fires (last 24 hours around the district centre) ---
    var fireCount = 0;
    var nearestFire = null;
    var latestFire = null;
    var dayMs = 24 * 60 * 60 * 1000;
    (fires || []).forEach(function (fire) {
      var age = now - fire.ts;
      if (age > dayMs || age < -60 * 60 * 1000) return;
      var distance = distanceToRegion(fire, region);
      if (distance > radius) return;
      fireCount += 1;
      if (!nearestFire || distance < nearestFire.distanceKm) {
        nearestFire = { fire: fire, distanceKm: distance };
      }
      if (!latestFire || fire.ts > latestFire.ts) latestFire = fire;
    });
    var fireSeverity = severityFor(fireCount, thresholds.fire);
    if (fireSeverity) {
      alerts.push({
        type: "fire",
        severity: fireSeverity,
        data: {
          count: fireCount,
          nearestKm: nearestFire ? nearestFire.distanceKm : null,
          latestTime: latestFire ? latestFire.ts : null,
          radius: radius
        }
      });
    }

    var days = weatherWindow(weather, now, 3, timeZone);

    // --- Rain / flood risk (next 3 days) ---
    var rainBest = bestDay(days, "precip", "max");
    if (rainBest) {
      var rainSeverity = severityFor(rainBest.value, thresholds.rain);
      if (rainSeverity) {
        alerts.push({
          type: "rain",
          severity: rainSeverity,
          data: {
            mm: rainBest.value,
            date: rainBest.day.date,
            probability: rainBest.day.precipProb
          }
        });
      }
    }

    // --- Heat (next 3 days; lower thresholds in the hills) ---
    var elevation = weather && weather.elevation != null ? weather.elevation : 0;
    var heatThresholds = elevation >= 1000 ? thresholds.heat.hills : thresholds.heat.plains;
    var heatBest = bestDay(days, "tmax", "max");
    if (heatBest) {
      var heatSeverity = severityFor(heatBest.value, heatThresholds);
      if (heatSeverity) {
        alerts.push({
          type: "heat",
          severity: heatSeverity,
          data: {
            maxC: heatBest.value,
            date: heatBest.day.date,
            hill: elevation >= 1000
          }
        });
      }
    }

    // --- Storm / strong wind / lightning (next 3 days) ---
    var windBest = bestDay(days, "gust", "max");
    var thunderDay = null;
    days.forEach(function (day) {
      if (!thunderDay && day.code != null && day.code >= 95 && day.code <= 99) {
        thunderDay = day;
      }
    });
    var windSeverity = windBest ? severityFor(windBest.value, thresholds.wind) : null;
    var thunder = !!thunderDay;
    if (windSeverity) {
      alerts.push({
        type: "wind",
        severity: windSeverity,
        data: {
          gust: windBest.value,
          date: windBest.day.date,
          thunder: thunder
        }
      });
    } else if (thunder) {
      alerts.push({
        type: "wind",
        severity: "watch",
        data: {
          gust: null,
          date: thunderDay.date,
          thunder: true
        }
      });
    }

    // --- Earthquakes (last 7 days; USGS feed is already 4.5+) ---
    var q = thresholds.quake;
    var qualifying = null;
    var maxAge = (config.quakes && config.quakes.maxAgeDays ? config.quakes.maxAgeDays : 7) * dayMs;
    (quakes || []).forEach(function (quake) {
      if (now - quake.time > maxAge) return;
      var distance = haversineKm(quake.lat, quake.lon, region.lat, region.lon);
      var severity = null;
      if (quake.mag >= q.severeMag && distance <= q.severeDist) severity = "severe";
      else if (quake.mag >= q.warningMag && distance <= q.warningDist) severity = "warning";
      else if (quake.mag >= q.watchMag && distance <= q.watchDist) severity = "watch";
      else if (quake.mag >= q.smallMag && distance <= q.smallDist) severity = "watch";
      if (!severity) return;
      if (
        !qualifying ||
        rank(severity) > rank(qualifying.severity) ||
        (rank(severity) === rank(qualifying.severity) && distance < qualifying.distanceKm)
      ) {
        qualifying = { quake: quake, distanceKm: distance, severity: severity };
      }
    });
    if (qualifying) {
      alerts.push({
        type: "quake",
        severity: qualifying.severity,
        data: {
          mag: qualifying.quake.mag,
          distanceKm: qualifying.distanceKm,
          date: isoDateInZone(qualifying.quake.time, timeZone),
          time: qualifying.quake.time,
          place: qualifying.quake.place,
          depth: qualifying.quake.depth,
          url: qualifying.quake.url
        }
      });
    }

    alerts.sort(function (a, b) {
      var diff = rank(b.severity) - rank(a.severity);
      if (diff !== 0) return diff;
      return HAZARD_ORDER.indexOf(a.type) - HAZARD_ORDER.indexOf(b.type);
    });

    return {
      alerts: alerts,
      severity: maxSeverity(alerts.map(function (a) { return a.severity; }))
    };
  }

  function buildSnapshot(config, places, fires, quakes, weatherById, now) {
    now = now || Date.now();
    var regions = places.map(function (region) {
      var weather = weatherById ? weatherById[region.id] : null;
      var result = computeRegionAlerts(region, fires, quakes, weather, config, now);
      return {
        id: region.id,
        name: region.name,
        state: region.state,
        tier: region.tier || "tribal",
        lat: region.lat,
        lon: region.lon,
        alerts: result.alerts,
        severity: result.severity,
        weather: weather
      };
    });
    var latestFire = 0;
    (fires || []).forEach(function (f) { if (f.ts > latestFire) latestFire = f.ts; });
    return {
      generatedAt: now,
      regions: regions,
      totalFires: (fires || []).length,
      latestFire: latestFire || null
    };
  }

  function countHazards(regions) {
    var hazards = ["fire", "rain", "heat", "wind", "quake"];
    var out = {};
    hazards.forEach(function (type) {
      out[type] = { districts: 0, warningPlus: 0, maxSeverity: "safe" };
    });
    var actionCount = 0;
    var watchCount = 0;
    var severeCount = 0;
    var alertCount = 0;

    regions.forEach(function (region) {
      if (rank(region.severity) >= rank("warning")) actionCount += 1;
      if (region.severity === "severe") severeCount += 1;
      if (region.severity === "watch") watchCount += 1;
      alertCount += region.alerts.length;
      var seen = {};
      region.alerts.forEach(function (alert) {
        var h = out[alert.type];
        if (!h || seen[alert.type]) return;
        seen[alert.type] = true;
        h.districts += 1;
        if (rank(alert.severity) >= rank("warning")) h.warningPlus += 1;
        if (rank(alert.severity) > rank(h.maxSeverity)) h.maxSeverity = alert.severity;
      });
    });

    return {
      byHazard: out,
      actionCount: actionCount,
      watchCount: watchCount,
      severeCount: severeCount,
      alertCount: alertCount
    };
  }

  function topAlert(region) {
    if (!region || !region.alerts || !region.alerts.length) return null;
    return region.alerts[0];
  }

  function findNearestRegion(regions, lat, lon) {
    var best = null;
    (regions || []).forEach(function (region) {
      var distance = haversineKm(lat, lon, region.lat, region.lon);
      if (!best || distance < best.distanceKm) {
        best = { region: region, distanceKm: distance };
      }
    });
    return best;
  }

  function sortRegions(regions) {
    return regions.slice().sort(function (a, b) {
      // Tribal districts are promoted: they always sort above cities, then by
      // severity, then alert count, then name.
      var tier = (a.tier === "city" ? 1 : 0) - (b.tier === "city" ? 1 : 0);
      if (tier !== 0) return tier;
      var diff = rank(b.severity) - rank(a.severity);
      if (diff !== 0) return diff;
      diff = b.alerts.length - a.alerts.length;
      if (diff !== 0) return diff;
      return a.name.en.localeCompare(b.name.en);
    });
  }

  return {
    SEVERITY_RANK: SEVERITY_RANK,
    HAZARD_ORDER: HAZARD_ORDER,
    haversineKm: haversineKm,
    distanceToRegion: distanceToRegion,
    isoDateInZone: isoDateInZone,
    severityFor: severityFor,
    rank: rank,
    maxSeverity: maxSeverity,
    parseFirmsCsv: parseFirmsCsv,
    normalizeWeatherJson: normalizeWeatherJson,
    parseQuakesGeoJson: parseQuakesGeoJson,
    quakeFeedUrl: quakeFeedUrl,
    weatherCategory: weatherCategory,
    weatherWindow: weatherWindow,
    computeRegionAlerts: computeRegionAlerts,
    buildSnapshot: buildSnapshot,
    countHazards: countHazards,
    topAlert: topAlert,
    findNearestRegion: findNearestRegion,
    sortRegions: sortRegions
  };
})();

if (typeof window !== "undefined") {
  window.SurveillanceLogic = SurveillanceLogic;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = SurveillanceLogic;
}
