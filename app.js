/*
 * Adivasi Suraksha — browser application.
 * Vanilla JS + Leaflet. No build step, no framework, no tracking.
 */
(function () {
  "use strict";

  var CONFIG = window.APP_CONFIG;
  var I18N = window.APP_I18N;
  var Logic = window.SurveillanceLogic;

  if (!CONFIG || !I18N || !Logic) {
    console.error("Adivasi Suraksha: configuration did not load.");
    return;
  }

  var TZ = CONFIG.weather.timezone || "Asia/Kolkata";
  var PLACES = CONFIG.places || CONFIG.regions;
  var HAZARDS = ["fire", "rain", "heat", "wind", "quake"];
  var LANG_KEY = "adivasi-suraksha-lang";
  var HAZARD_ICONS = { fire: "i-fire", rain: "i-rain", heat: "i-heat", wind: "i-wind", quake: "i-quake" };
  var GUIDE_KEY = { fire: "fire", rain: "flood", heat: "heat", wind: "storm", quake: "quake" };
  var GUIDE_ICON = { fire: "i-fire", flood: "i-rain", heat: "i-heat", quake: "i-quake", storm: "i-storm" };
  var SOURCE_URLS = [
    "https://firms.modaps.eosdis.nasa.gov/",
    "https://open-meteo.com/",
    "https://earthquake.usgs.gov/",
    "https://www.esri.com/",
    "https://bhuvan-app1.nrsc.gov.in/",
    "https://www.getambee.com/",
    "https://www.gdacs.org/",
    "https://eonet.gsfc.nasa.gov/",
    "https://reliefweb.int/"
  ];
  var SOURCE_ICONS = ["i-fire", "i-rain", "i-quake", "i-layers", "i-route", "i-air", "i-rain", "i-alert", "i-storm", "i-info"];

  var state = {
    lang: "en",
    snapshot: null,
    summary: null,
    selectedId: null,
    hazardFilter: null,
    scope: "tribal",
    search: "",
    layers: { fires: true, quakes: true },
    sources: { firms: "loading", weather: "loading", quakes: "loading" },
    sourceNotes: { firms: "", weather: "", quakes: "" },
    fires: [],
    quakes: [],
    weatherById: {},
    latestFire: null,
    lastUpdated: null,
    cacheTs: null,
    cached: null,
    fromCache: false,
    partial: false,
    loaded: false,
    loading: false,
    bannerDismissed: false,
    map: null,
    mapReady: false,
    baseLayer: "street",
    tileProviderIndex: 0,
    tileLayer: null,
    tileStats: null,
    tileSwitching: false,
    tileWatchdog: null,
    tileError: false,
    route: null,
    routeLayer: null,
    routeBusy: false,
    canvasRenderer: null,
    regionMarkers: {},
    layerGroups: { fires: null, quakes: null, regions: null, location: null, route: null },
    location: null,
    // Per-district Ambee readings. Kept in memory only so switching districts
    // does not spend the small daily API quota again.
    air: {},
    // Per-district NASA GPM observed-rainfall readings. Server-cached for six
    // hours; this map only avoids duplicate browser requests.
    gpm: {},
    // Per-district wider-hazard context (GDACS, NASA EONET, ReliefWeb). These
    // are extra web-only readings and never change the alarm or LoRa packet.
    hazards: {}
  };

  var toastTimer = null;

  document.addEventListener("DOMContentLoaded", init);

  /* ======================================================================
     Boot
     ====================================================================== */

  function init() {
    state.lang = initialLanguage();
    renderLanguageSelect();
    applyLanguage();
    initMap();
    bindEvents();
    renderStaticSections();
    renderAutoNote();
    renderSourceChips();
    renderInitialLoading();

    state.cached = readCache();
    if (state.cached) restoreCache(state.cached);

    loadAll({ initial: true });

    window.setInterval(autoRefreshTick, CONFIG.refreshMinutes * 60 * 1000);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("afterprint", function () {
      window.setTimeout(function () {
        if (state.map) state.map.invalidateSize();
      }, 80);
    });
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("resize", debounce(function () {
      if (window.innerWidth > 960) setMenu(false);
      if (state.map) state.map.invalidateSize();
    }, 180));
  }

  function initialLanguage() {
    var supported = (I18N.languages || []).map(function (item) { return item.code; });
    var fallback = supported.indexOf("en") === -1 ? (supported[0] || "en") : "en";
    try {
      var saved = window.localStorage.getItem(LANG_KEY);
      if (saved && supported.indexOf(saved) !== -1) return saved;
    } catch (e) { /* storage can be blocked */ }
    var nav = (navigator.language || navigator.userLanguage || "").toLowerCase();
    var prefix = nav.split("-")[0];
    if (supported.indexOf(prefix) !== -1) return prefix;
    return fallback;
  }

  function renderLanguageSelect() {
    var select = $("#langSelect");
    if (!select) return;
    select.innerHTML = (I18N.languages || []).map(function (item) {
      return '<option value="' + esc(item.code) + '" lang="' + esc(item.code) + '">' +
        esc(item.label || item.english || item.code) + "</option>";
    }).join("");
  }

  function currentDict() {
    if (I18N.resolved && I18N.resolved[state.lang]) return I18N.resolved[state.lang];
    return I18N[state.lang] || I18N.en;
  }

  function locale() {
    var value = currentDict().locale;
    if (value) return value;
    var item = (I18N.languages || []).filter(function (entry) { return entry.code === state.lang; })[0];
    return (item && item.locale) || (state.lang === "hi" ? "hi-IN" : "en-IN");
  }

  /**
   * District and state names. Packs in i18n.langs.js carry the local script;
   * anything missing falls back to Hindi and then English.
   */
  function districtLabel(region, lang) {
    if (!region) return "";
    var pack = I18N.regionNames && I18N.regionNames[lang];
    if (pack && pack[region.id]) return pack[region.id];
    return (region.name && (region.name[lang] || region.name.hi || region.name.en)) || region.id;
  }

  function stateLabel(region, lang) {
    if (!region) return "";
    var pack = I18N.stateNames && I18N.stateNames[lang];
    if (pack && region.state && pack[region.state.en]) return pack[region.state.en];
    return (region.state && (region.state[lang] || region.state.hi || region.state.en)) || "";
  }

  function t(path, vars) {
    var value = readPath(currentDict(), path);
    if (value == null) value = readPath(I18N.en, path);
    if (typeof value !== "string") return value == null ? path : value;
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, function (match, key) {
      return vars[key] != null ? String(vars[key]) : "";
    });
  }

  function readPath(object, path) {
    return path.split(".").reduce(function (value, key) {
      return value && typeof value === "object" ? value[key] : undefined;
    }, object);
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function icon(id, extraClass) {
    return '<svg class="icon' + (extraClass ? " " + extraClass : "") + '" aria-hidden="true"><use href="#' + id + '"></use></svg>';
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  /* ======================================================================
     Formatting
     ====================================================================== */

  function formatNumber(value) {
    var n = Number(value);
    if (!isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat(locale()).format(Math.round(n));
    } catch (e) {
      return String(Math.round(n));
    }
  }

  function formatDate(ts) {
    try {
      return new Intl.DateTimeFormat(locale(), {
        weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ
      }).format(new Date(ts || Date.now()));
    } catch (e) {
      return new Date(ts || Date.now()).toDateString();
    }
  }

  function formatTime(ts) {
    if (!ts) return "—";
    try {
      return new Intl.DateTimeFormat(locale(), {
        hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ
      }).format(new Date(ts)) + " IST";
    } catch (e) {
      return new Date(ts).toISOString().slice(11, 16) + " IST";
    }
  }

  function formatShortDateTime(ts) {
    if (!ts) return "—";
    try {
      return new Intl.DateTimeFormat(locale(), {
        day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
        hour12: true, timeZone: TZ
      }).format(new Date(ts)) + " IST";
    } catch (e) {
      return new Date(ts).toISOString().slice(0, 16).replace("T", " ") + " UTC";
    }
  }

  function dayKey(offsetDays) {
    return Logic.isoDateInZone(Date.now() + (offsetDays || 0) * 86400000, TZ);
  }

  function dayLabel(key) {
    if (!key) return "—";
    if (key === dayKey(0)) return t("detail.today");
    if (key === dayKey(1)) return t("detail.tomorrow");
    try {
      return new Intl.DateTimeFormat(locale(), {
        weekday: "short", day: "numeric", month: "short", timeZone: TZ
      }).format(new Date(key + "T12:00:00+05:30"));
    } catch (e) {
      return key;
    }
  }

  function round(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? Math.round(n) : (fallback == null ? "—" : fallback);
  }

  function wrapDegrees(value) {
    var n = Number(value);
    return isFinite(n) ? Math.round(n) + "°" : "—";
  }

  function weatherIconId(code) {
    var category = Logic.weatherCategory(code);
    var map = {
      clear: "i-sun", partly: "i-partly", cloudy: "i-cloud", fog: "i-fog",
      drizzle: "i-rain", rain: "i-rain", heavyRain: "i-rain", snow: "i-snow",
      storm: "i-storm", unknown: "i-cloud"
    };
    return map[category] || "i-cloud";
  }

  function weatherLabel(code) {
    return t("weather." + Logic.weatherCategory(code));
  }

  function severityLabel(severity) {
    return t("severities." + severity);
  }

  /* ======================================================================
     Language and static text
     ====================================================================== */

  function applyLanguage() {
    document.documentElement.lang = state.lang;
    document.title = t("meta.title");
    var metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute("content", t("meta.description"));

    $$("[data-i18n]").forEach(function (el) {
      var value = t(el.getAttribute("data-i18n"));
      if (typeof value === "string") el.textContent = value;
    });
    $$("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    $$("[data-i18n-aria]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    $$("[data-i18n-title]").forEach(function (el) {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    $(".brand").setAttribute("aria-label", t("brandAria"));
    $("#map").setAttribute("aria-label", t("map.title"));

    var languageSelect = $("#langSelect");
    if (languageSelect) languageSelect.value = state.lang;
    syncMenuLabel();
  }

  function setLanguage(lang) {
    if (!(I18N.resolved && I18N.resolved[lang]) || lang === state.lang) return;
    state.lang = lang;
    try { window.localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }

    applyLanguage();
    renderStaticSections();
    renderAutoNote();
    $("#printArea").innerHTML = "";

    if (state.snapshot) {
      renderAll();
    } else {
      renderInitialLoading();
      renderSourceChips();
      renderNational();
    }
    updatePill();
    updateBanner();

    if (!state.mapReady) {
      var mapLoading = $("#mapLoading");
      if (mapLoading) {
        mapLoading.innerHTML = "<span>" + esc(t("map.tilesError")) + "</span>";
      }
    }
  }

  function setMenu(open) {
    var nav = $("#siteNav");
    var button = $("#menuBtn");
    if (!nav || !button) return;
    var isOpen = !!open;
    nav.classList.toggle("is-open", isOpen);
    button.classList.toggle("is-open", isOpen);
    button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    button.setAttribute("aria-label", t(isOpen ? "header.menuClose" : "header.menu"));
    var use = button.querySelector("use");
    if (use) use.setAttribute("href", isOpen ? "#i-x" : "#i-menu");
  }

  function syncMenuLabel() {
    var nav = $("#siteNav");
    var button = $("#menuBtn");
    if (!nav || !button) return;
    var open = nav.classList.contains("is-open");
    button.setAttribute("aria-label", t(open ? "header.menuClose" : "header.menu"));
  }

  function renderStaticSections() {
    renderGuides();
    renderHelplines();
    renderAbout();
  }

  function renderAutoNote() {
    var note = $("#autoNote");
    if (note) note.textContent = t("national.auto", { min: CONFIG.refreshMinutes });
  }

  /* ======================================================================
     Network
     ====================================================================== */

  async function fetchWithTimeout(url, timeoutMs, allowHttpErrors) {
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, timeoutMs || 22000);
    try {
      var response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit"
      });
      if (!response.ok && !allowHttpErrors) throw new Error("HTTP " + response.status);
      return response;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function fetchText(url) {
    var response = await fetchWithTimeout(url);
    return response.text();
  }

  async function fetchJson(url) {
    var response = await fetchWithTimeout(url);
    return response.json();
  }

  function firmsUrl(source) {
    return CONFIG.firms.baseUrl + "/" + CONFIG.firms.key + "/" + source + "/" + CONFIG.firms.bbox + "/" + CONFIG.firms.days;
  }

  function buildWeatherUrl() {
    var params = new URLSearchParams();
    params.set("latitude", PLACES.map(function (r) { return r.lat; }).join(","));
    params.set("longitude", PLACES.map(function (r) { return r.lon; }).join(","));
    params.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m");
    params.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max");
    params.set("timezone", TZ);
    params.set("forecast_days", String(CONFIG.weather.forecastDays));
    return CONFIG.weather.baseUrl + "?" + params.toString();
  }

  async function loadAll(options) {
    options = options || {};
    if (state.loading) return;
    if (!navigator.onLine) {
      state.partial = true;
      state.loaded = true;
      updatePill();
      updateBanner();
      if (!state.snapshot) {
        renderDetailError();
        renderNational();
      }
      if (options.manual) showToast(t("toast.refreshFailed"));
      return;
    }

    state.loading = true;
    if (options.manual) state.bannerDismissed = false;
    if (options.initial) hideBanner();
    setProgress(true);
    setSpinning(true);
    updatePill();

    var anyLive = false;
    var firmsUsedFallback = false;
    var weatherUsedFallback = false;
    var quakesUsedFallback = false;
    var firmsSuccesses = 0;
    var firmsFailures = 0;
    var weatherCount = 0;

    state.sourceNotes = { firms: "", weather: "", quakes: "" };

    try {
      var replies = await Promise.all([
        Promise.allSettled(CONFIG.firms.sources.map(function (source) {
          return fetchText(firmsUrl(source));
        })),
        Promise.allSettled([fetchJson(buildWeatherUrl())]),
        Promise.allSettled([fetchJson(Logic.quakeFeedUrl(CONFIG))])
      ]);

      var firmsReplies = replies[0];
      var weatherReplies = replies[1];
      var quakeReplies = replies[2];

      /* ---- Satellite fire detections ---- */
      var fires = [];
      firmsReplies.forEach(function (reply, index) {
        if (reply.status === "fulfilled") {
          firmsSuccesses += 1;
          try {
            fires = fires.concat(Logic.parseFirmsCsv(reply.value, CONFIG.firms.sources[index], {
              minModisConfidence: CONFIG.firms.minModisConfidence
            }));
          } catch (e) {
            firmsFailures += 1;
          }
        } else {
          firmsFailures += 1;
        }
      });

      if (firmsSuccesses > 0) {
        fires.sort(function (a, b) { return b.ts - a.ts; });
        state.fires = fires.slice(0, CONFIG.firms.maxPoints);
        state.sources.firms = "live";
        anyLive = true;
      } else if (state.fires.length) {
        state.sources.firms = "saved";
        firmsUsedFallback = true;
      } else {
        state.sources.firms = "error";
      }
      if (firmsFailures) {
        state.sourceNotes.firms = firmsFailures + "/" + CONFIG.firms.sources.length + " feeds";
      }

      /* ---- Weather forecast ---- */
      var weatherReply = weatherReplies[0];
      var weatherById = null;
      if (weatherReply.status === "fulfilled") {
        weatherById = Logic.normalizeWeatherJson(weatherReply.value, PLACES);
        weatherCount = Object.keys(weatherById).length;
      }
      if (weatherById && weatherCount > 0) {
        var filledFromSaved = false;
        if (weatherCount < PLACES.length) {
          PLACES.forEach(function (region) {
            if (!weatherById[region.id] && state.weatherById && state.weatherById[region.id]) {
              weatherById[region.id] = state.weatherById[region.id];
              filledFromSaved = true;
            }
          });
        }
        state.weatherById = weatherById;
        state.sources.weather = (weatherCount < PLACES.length || filledFromSaved) ? "partial" : "live";
        if (state.sources.weather === "partial") {
          weatherUsedFallback = filledFromSaved;
          state.sourceNotes.weather = weatherCount + "/" + PLACES.length + " places";
        }
        anyLive = true;
      } else if (state.weatherById && Object.keys(state.weatherById).length) {
        state.sources.weather = "saved";
        weatherUsedFallback = true;
      } else {
        state.sources.weather = "error";
      }

      /* ---- Earthquakes ---- */
      var quakeReply = quakeReplies[0];
      if (quakeReply.status === "fulfilled") {
        state.quakes = Logic.parseQuakesGeoJson(quakeReply.value, CONFIG.quakes.bbox);
        state.sources.quakes = "live";
        anyLive = true;
      } else if (state.quakes.length) {
        state.sources.quakes = "saved";
        quakesUsedFallback = true;
      } else {
        state.sources.quakes = "error";
      }

      state.fromCache = firmsUsedFallback || weatherUsedFallback || quakesUsedFallback;
      state.partial = Object.keys(state.sources).some(function (key) {
        return ["saved", "error", "partial"].indexOf(state.sources[key]) !== -1;
      });
      state.lastUpdated = anyLive ? Date.now() : (state.cached && state.cached.ts ? state.cached.ts : Date.now());
      state.loaded = true;

      computeAndRender();
      if (anyLive) saveCache();

      if (!state.partial) {
        state.bannerDismissed = false;
        hideBanner();
      } else {
        updateBanner();
      }
      if (options.manual) {
        showToast(state.partial ? t("toast.refreshFailed") : t("toast.refreshed"));
      }
    } catch (error) {
      console.error("Adivasi Suraksha refresh failed", error);
      state.partial = true;
      state.loaded = true;
      if (!state.snapshot) {
        state.sources = { firms: "error", weather: "error", quakes: "error" };
        renderDetailError();
        renderNational();
        renderSourceChips();
      }
      updateBanner();
      if (options.manual) showToast(t("toast.refreshFailed"));
    } finally {
      state.loading = false;
      setProgress(false);
      setSpinning(false);
      updatePill();
    }
  }

  function tribalRegions(list) {
    return (list || []).filter(function (region) { return region.tier !== "city"; });
  }

  function cityRegions(list) {
    return (list || []).filter(function (region) { return region.tier === "city"; });
  }

  function placesInScope() {
    if (!state.snapshot) return [];
    if (state.scope === "cities") return cityRegions(state.snapshot.regions);
    if (state.scope === "all") return state.snapshot.regions;
    return tribalRegions(state.snapshot.regions);
  }

  function computeAndRender() {
    var snapshot = Logic.buildSnapshot(CONFIG, PLACES, state.fires, state.quakes, state.weatherById, Date.now());
    state.snapshot = snapshot;
    // The national summary and hazard statistics stay focused on the tribal
    // districts; cities are shown when the Cities scope is selected.
    state.summary = Logic.countHazards(tribalRegions(snapshot.regions));
    state.latestFire = snapshot.latestFire;

    if (!state.selectedId || !CONFIG.placeById[state.selectedId]) {
      var sorted = Logic.sortRegions(tribalRegions(snapshot.regions));
      var topWithAlerts = sorted.filter(function (region) { return region.alerts.length; })[0];
      state.selectedId = topWithAlerts ? topWithAlerts.id : (CONFIG.regionById.bastar ? "bastar" : snapshot.regions[0].id);
    }

    renderAll();
  }

  function renderAll() {
    renderNational();
    renderStats();
    renderSourceChips();
    renderDetail();
    renderDistrictGrid();
    renderMapData();
    renderMapFoot();
    renderAutoNote();
    updateBanner();
    refreshRouteText();
    updateFullscreenButton();
  }

  function saveCache() {
    if (!state.fires.length && !state.quakes.length && !Object.keys(state.weatherById).length) return;
    var payload = {
      v: 1,
      ts: Date.now(),
      fires: state.fires.slice(0, CONFIG.firms.maxPoints),
      quakes: state.quakes,
      weatherById: state.weatherById
    };
    try {
      window.localStorage.setItem(CONFIG.cacheKey, JSON.stringify(payload));
      state.cached = payload;
      state.cacheTs = payload.ts;
    } catch (e) {
      try {
        payload.fires = payload.fires.slice(0, 3000);
        window.localStorage.setItem(CONFIG.cacheKey, JSON.stringify(payload));
        state.cached = payload;
        state.cacheTs = payload.ts;
      } catch (e2) {
        state.cached = payload;
      }
    }
  }

  function readCache() {
    try {
      var raw = window.localStorage.getItem(CONFIG.cacheKey);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.v !== 1 || !data.ts) return null;
      if (Date.now() - data.ts > CONFIG.cacheMaxAgeHours * 3600 * 1000) return null;
      if (!Array.isArray(data.fires) || !Array.isArray(data.quakes) || !data.weatherById) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function restoreCache(cache) {
    state.fires = Array.isArray(cache.fires) ? cache.fires : [];
    state.quakes = Array.isArray(cache.quakes) ? cache.quakes : [];
    state.weatherById = cache.weatherById || {};
    state.sources = { firms: "saved", weather: "saved", quakes: "saved" };
    state.fromCache = true;
    state.partial = true;
    state.cacheTs = cache.ts;
    state.lastUpdated = cache.ts;
    state.loaded = true;
    computeAndRender();
  }

  /* ======================================================================
     National overview + statistics
     ====================================================================== */

  function renderInitialLoading() {
    var status = $("#nationalStatus");
    if (status) {
      status.innerHTML = '<span class="orb is-loading"></span><span>' + esc(t("detail.loading")) + "</span>";
    }
    var sub = $("#nationalSub");
    if (sub) sub.textContent = t("national.loadingSub");
    var date = $("#nationalDate");
    if (date) date.textContent = formatDate(Date.now());
    var heat = $("#heatCount");
    if (heat) heat.textContent = "—";
    var updated = $("#updatedAt");
    if (updated) updated.textContent = "—";

    var panel = $("#detailPanel");
    if (panel) {
      panel.setAttribute("aria-busy", "true");
      panel.innerHTML = '<div class="detail-loading"><span class="spinner"></span><span>' + esc(t("detail.loading")) + "</span></div>";
    }

    var latest = $("#latestPass");
    if (latest) latest.textContent = t("map.loading");
    var fireMeta = $("#mapFireMeta");
    if (fireMeta) fireMeta.textContent = "";
    var quakeMeta = $("#mapQuakeMeta");
    if (quakeMeta) quakeMeta.textContent = "";
  }

  function renderNational() {
    if (!state.snapshot) {
      if (!state.loading) {
        var status = $("#nationalStatus");
        if (status) {
          status.innerHTML = '<span class="orb sev-warning"></span><span>' + esc(t("header.offline")) + "</span>";
        }
        var sub = $("#nationalSub");
        if (sub) sub.textContent = t("detail.error");
      }
      return;
    }

    var summary = state.summary;
    var sorted = Logic.sortRegions(tribalRegions(state.snapshot.regions));
    var top = sorted.filter(function (region) { return region.alerts.length; })[0] || null;
    var headline;
    var orb;
    var subText;

    if (summary.actionCount > 0) {
      headline = t(summary.actionCount === 1 ? "national.needActionOne" : "national.needAction", { n: summary.actionCount });
      orb = summary.severeCount > 0 ? "severe" : "warning";
    } else if (summary.watchCount > 0) {
      headline = t(summary.watchCount === 1 ? "national.watchOnlyOne" : "national.watchOnly", { n: summary.watchCount });
      orb = "watch";
    } else {
      headline = t("national.clear");
      orb = "safe";
    }

    if (top) {
      subText = t("national.highest", {
        severity: severityLabel(top.alerts[0].severity),
        hazard: t("hazards." + top.alerts[0].type),
        district: districtLabel(top, state.lang)
      });
    } else {
      subText = t("national.clearSub");
    }

    var statusEl = $("#nationalStatus");
    if (statusEl) {
      statusEl.textContent = "";
      var orbEl = document.createElement("span");
      orbEl.className = "orb sev-" + orb;
      var textEl = document.createElement("span");
      textEl.textContent = headline;
      statusEl.appendChild(orbEl);
      statusEl.appendChild(textEl);
    }

    var subEl = $("#nationalSub");
    if (subEl) subEl.textContent = subText;
    var dateEl = $("#nationalDate");
    if (dateEl) dateEl.textContent = formatDate(Date.now());
    var heatEl = $("#heatCount");
    if (heatEl) heatEl.textContent = formatNumber(state.snapshot.totalFires);
    var updatedEl = $("#updatedAt");
    if (updatedEl) updatedEl.textContent = state.lastUpdated ? formatTime(state.lastUpdated) : "—";
  }

  function renderStats() {
    if (!state.snapshot || !state.summary) return;
    HAZARDS.forEach(function (hazard) {
      var info = state.summary.byHazard[hazard];
      var number = $("#stat-" + hazard);
      var sub = $("#stat-" + hazard + "-sub");
      var card = $('.stat-card[data-hazard="' + hazard + '"]');
      if (number) number.textContent = formatNumber(info.districts);
      if (sub) {
        if (info.warningPlus > 0) {
          sub.textContent = t("stats.atAction", { n: info.warningPlus });
        } else if (info.districts > 0) {
          sub.textContent = t("stats.onWatch", { n: info.districts });
        } else {
          sub.textContent = t("stats.noSignal");
        }
      }
      if (card) {
        var active = state.hazardFilter === hazard;
        card.classList.toggle("is-active", active);
        card.setAttribute("aria-pressed", active ? "true" : "false");
      }
    });
  }

  function renderSourceChips() {
    var container = $("#sourceChips");
    if (!container) return;
    var sources = [
      { key: "firms", short: "FIRMS", full: "NASA FIRMS" },
      { key: "weather", short: "Weather", full: "Open-Meteo" },
      { key: "quakes", short: "Quakes", full: "USGS" }
    ];

    container.innerHTML = sources.map(function (source) {
      var status = state.sources[source.key] || "loading";
      var statusClass = "";
      var statusText;
      if (status === "saved" || status === "partial") statusClass = "is-saved";
      else if (status === "error") statusClass = "is-error";
      else if (status === "loading") statusClass = "is-loading";

      if (status === "live") statusText = t("header.sourceLive");
      else if (status === "saved") statusText = t("header.sourceSaved");
      else if (status === "partial") statusText = t("header.sourceSaved");
      else if (status === "error") statusText = t("header.sourceError");
      else statusText = t("header.connecting");

      var note = state.sourceNotes[source.key];
      var title = source.full + " — " + statusText + (note ? " · " + note : "");
      return '<span class="source-chip ' + statusClass + '" title="' + esc(title) + '"><i></i>' + esc(source.short) + "</span>";
    }).join("");
  }

  /* ======================================================================
     District detail
     ====================================================================== */

  function selectedRegion() {
    if (!state.snapshot || !state.selectedId) return null;
    return state.snapshot.regions.filter(function (region) {
      return region.id === state.selectedId;
    })[0] || null;
  }

  function renderDetail() {
    var panel = $("#detailPanel");
    if (!panel) return;

    if (!state.snapshot) {
      if (state.loading) {
        panel.setAttribute("aria-busy", "true");
        panel.innerHTML = '<div class="detail-loading"><span class="spinner"></span><span>' + esc(t("detail.loading")) + "</span></div>";
      } else {
        renderDetailError();
      }
      return;
    }

    var region = selectedRegion();
    if (!region) {
      panel.setAttribute("aria-busy", "false");
      panel.innerHTML =
        '<div class="detail-empty">' +
          '<span class="detail-empty-icon">' + icon("i-pin") + "</span>" +
          "<h2>" + esc(t("detail.choose")) + "</h2>" +
          "<p>" + esc(t("detail.chooseSub")) + "</p>" +
        "</div>";
      return;
    }

    panel.setAttribute("aria-busy", "false");
    var name = districtLabel(region, state.lang);
    var stateName = stateLabel(region, state.lang);
    var alerts = region.alerts;
    var top = alerts.length ? alerts[0] : null;
    var severity = region.severity;
    var counts = alerts.length === 1 ? t("districts.signalOne") : t("districts.signals", { n: alerts.length });

    var banner = "";
    if (top) {
      banner =
        '<div class="detail-banner sev-' + severity + '">' +
          icon("i-alert") +
          '<div><strong>' + esc(severityLabel(severity)) + " · " + esc(counts) + "</strong>" +
          "<span>" + esc(t("alertTitles." + top.type)) + "</span></div>" +
        "</div>";
    }

    var alertsHtml = "";
    if (top) {
      alertsHtml =
        '<div class="detail-section-title"><span>' + esc(t("detail.alerts")) + "</span><span>" + esc(counts) + "</span></div>" +
        '<div class="alert-list">' + alerts.map(alertCardHtml).join("") + "</div>" +
        doNowHtml(top);
    } else {
      alertsHtml =
        '<div class="all-clear">' +
          '<span class="all-clear-icon">' + icon("i-check") + "</span>" +
          "<div><h3>" + esc(t("detail.allClearTitle")) + "</h3>" +
          "<p>" + esc(t("detail.noAlerts", { district: name })) + " " + esc(t("detail.noAlertsSub")) + "</p></div>" +
        "</div>" +
        '<div class="prep-tip"><strong>' + esc(t("detail.doNow")) + ":</strong> " + esc(t("detail.prep")) + "</div>";
    }

    var updatedText = state.lastUpdated ? t("detail.updated", { time: formatTime(state.lastUpdated) }) : "";
    var staleHtml = state.fromCache
      ? '<p class="detail-note detail-stale">' + icon("i-info") + esc(t("detail.stale", { time: formatShortDateTime(state.cacheTs || state.lastUpdated) })) + "</p>"
      : "";

    panel.innerHTML =
      '<div class="detail-head">' +
        "<div>" +
          '<p class="detail-eyebrow">' + esc(t("detail.eyebrow")) + "</p>" +
          "<h2>" + esc(name) + "</h2>" +
          '<p class="detail-state">' + esc(stateName) + " · " + Number(region.lat).toFixed(2) + "°N, " + Number(region.lon).toFixed(2) + "°E" +
            (updatedText ? " · " + esc(updatedText) : "") + "</p>" +
        "</div>" +
        '<span class="status-badge sev-' + severity + '">' + icon(severity === "safe" ? "i-check" : "i-alert") + "<span>" + esc(severityLabel(severity)) + "</span></span>" +
      "</div>" +
      banner +
      alertsHtml +
      forecastHtml(region) +
      airHtml(region) +
      gpmHtml(region) +
      widerHazardsHtml(region) +
      '<div class="detail-actions">' +
        '<button type="button" class="btn btn-primary" data-action="whatsapp">' + icon("i-chat") + "<span>" + esc(t("detail.share")) + "</span></button>" +
        '<button type="button" class="btn btn-quiet" data-action="route">' + icon("i-route") + "<span>" + esc(t("route.button")) + "</span></button>" +
        '<button type="button" class="btn btn-quiet" data-action="copy">' + icon("i-copy") + "<span>" + esc(t("detail.copy")) + "</span></button>" +
        '<button type="button" class="btn btn-quiet btn-print" data-action="print">' + icon("i-print") + "<span>" + esc(t("detail.print")) + "</span></button>" +
      "</div>" +
      '<p class="detail-note">' + icon("i-info") + esc(t("detail.radiusNote", { radius: CONFIG.fireRadiusKm })) + " " + esc(t("detail.dataLag")) + "</p>" +
      staleHtml;

    maybeLoadAir(region.id);
    maybeLoadGpm(region.id);
    maybeLoadHazards(region.id);
  }

  function renderDetailError() {
    var panel = $("#detailPanel");
    if (!panel) return;
    panel.setAttribute("aria-busy", "false");
    panel.innerHTML =
      '<div class="detail-error">' +
        icon("i-alert") +
        "<h2>" + esc(t("banner.title")) + "</h2>" +
        "<p>" + esc(t("detail.error")) + "</p>" +
        '<button type="button" class="btn btn-small" data-action="retry">' + esc(t("detail.retry")) + "</button>" +
      "</div>";
  }

  function alertCardHtml(alert) {
    return '<article class="alert-item sev-' + alert.severity + '">' +
      '<span class="alert-icon">' + icon(HAZARD_ICONS[alert.type] || "i-alert") + "</span>" +
      '<div class="alert-body">' +
        '<div class="alert-top"><h3>' + esc(t("alertTitles." + alert.type)) + "</h3>" +
        '<span class="sev-tag">' + esc(severityLabel(alert.severity)) + "</span></div>" +
        '<p class="alert-detail">' + esc(alertDescription(alert)) + "</p>" +
      "</div>" +
    "</article>";
  }

  function alertDescription(alert) {
    var data = alert.data || {};
    switch (alert.type) {
      case "fire":
        return t("alertDetail." + (data.count === 1 ? "fireOne" : "fire"), {
          count: data.count,
          radius: data.radius,
          nearest: round(data.nearestKm),
          time: formatShortDateTime(data.latestTime)
        });
      case "rain":
        return t("alertDetail.rain", {
          mm: round(data.mm),
          day: dayLabel(data.date)
        });
      case "heat":
        return t("alertDetail.heat", {
          c: round(data.maxC),
          day: dayLabel(data.date)
        });
      case "wind":
        if (data.thunder && data.gust != null) {
          return t("alertDetail.windStorm", { gust: round(data.gust), day: dayLabel(data.date) });
        }
        if (data.thunder) {
          return t("alertDetail.stormOnly", { day: dayLabel(data.date) });
        }
        return t("alertDetail.wind", { gust: round(data.gust), day: dayLabel(data.date) });
      case "quake":
        return t("alertDetail.quake", {
          mag: Number(data.mag).toFixed(1),
          dist: round(data.distanceKm),
          day: dayLabel(data.date)
        });
      default:
        return "";
    }
  }

  function doNowHtml(topAlert) {
    var guideKey = GUIDE_KEY[topAlert.type] || "fire";
    var guide = currentDict().guides && currentDict().guides.items[guideKey];
    var actions = guide && Array.isArray(guide.do) ? guide.do.slice(0, 2) : [t("detail.prep")];
    return '<div class="do-now">' +
      '<div class="do-now-head">' + icon("i-shield") + "<span>" + esc(t("detail.doNow")) + "</span></div>" +
      "<p>" + esc(actions.join(" ")) + "</p>" +
    "</div>";
  }

  function forecastHtml(region) {
    var days = Logic.weatherWindow(region.weather, Date.now(), 3, TZ);
    var inner;
    if (!days.length) {
      inner = '<p class="forecast-empty">' + esc(t("detail.forecastUnavailable")) + "</p>";
    } else {
      inner = '<div class="forecast-grid">' + days.map(function (day) {
        var label = weatherLabel(day.code);
        return '<div class="forecast-day" title="' + esc(label) + '">' +
          '<span class="forecast-name">' + esc(dayLabel(day.date)) + "</span>" +
          '<svg class="icon forecast-icon" aria-hidden="true"><use href="#' + weatherIconId(day.code) + '"></use></svg>' +
          '<span class="forecast-temp">' + wrapDegrees(day.tmax) + " / " + wrapDegrees(day.tmin) + "</span>" +
          '<span class="forecast-rain">' + (day.precip > 0 ? esc(t("weather.rainAmount", { mm: round(day.precip) })) : "—") + "</span>" +
        "</div>";
      }).join("") + "</div>";
    }
    return '<div class="forecast"><div class="detail-section-title">' + esc(t("detail.forecast")) + "</div>" + inner + "</div>";
  }

  /* ======================================================================
     Ambee air quality (one district at a time, server-cached)
     ====================================================================== */

  function maybeLoadAir(id) {
    if (!id || !CONFIG.ambee) return;
    var entry = state.air[id];
    var now = Date.now();
    if (entry) {
      if (entry.status === "loading") return;
      if (entry.status === "ready" && now - entry.at < 10 * 60 * 1000) return;
      if (entry.status !== "ready" && now - entry.at < 2 * 60 * 1000) return;
    }
    if (!navigator.onLine) {
      state.air[id] = { status: "offline", at: now };
      if (state.selectedId === id) {
        window.setTimeout(function () {
          if (state.selectedId === id) renderDetail();
        }, 0);
      }
      return;
    }
    state.air[id] = {
      status: "loading",
      data: entry && entry.data ? entry.data : null,
      at: now
    };
    loadAir(id);
  }

  async function loadAir(id) {
    try {
      var response = await fetchWithTimeout("/api/air?district=" + encodeURIComponent(id), 20000, true);
      var payload = null;
      try { payload = await response.json(); } catch (e) { payload = null; }

      if (!response.ok) {
        state.air[id] = {
          status: payload && payload.error === "quota_exceeded" ? "quota" : "error",
          code: payload && payload.error,
          at: Date.now()
        };
      } else if (!payload || payload.available === false) {
        state.air[id] = { status: "unavailable", data: payload, at: Date.now() };
      } else {
        state.air[id] = { status: "ready", data: payload, at: Date.now() };
      }
    } catch (error) {
      state.air[id] = { status: "error", code: "network", at: Date.now() };
    }
    if (state.selectedId === id) renderDetail();
  }

  function airErrorText(code) {
    switch (code) {
      case "not_configured": return t("air.notConfigured");
      case "invalid_key": return t("air.invalidKey");
      case "quota_exceeded": return t("air.quota");
      case "upstream_unreachable": return t("air.offline");
      case "unknown_district": return t("air.noStation");
      case "network": return t("air.network");
      default: return t("air.error");
    }
  }

  function airRetryButton() {
    return '<button type="button" class="btn btn-small air-retry" data-action="air-retry">' +
      esc(t("air.retry")) + "</button>";
  }

  function airReadingHtml(data) {
    var category = t("air.categories." + (data.categoryKey || "unknown"));
    var station = data.station || {};
    var bits = [];
    if (station.name) bits.push(station.name);
    if (station.distanceKm != null) {
      bits.push(t("air.stationDistance", { km: round(station.distanceKm) }));
    }

    var chips = [];
    if (data.pm25 != null) chips.push('<span class="air-chip"><b>PM2.5</b> ' + esc(round(data.pm25)) + " µg/m³</span>");
    if (data.pm10 != null) chips.push('<span class="air-chip"><b>PM10</b> ' + esc(round(data.pm10)) + " µg/m³</span>");
    if (data.no2 != null) chips.push('<span class="air-chip"><b>NO₂</b> ' + esc(round(data.no2)) + " ppb</span>");

    var updated = data.updatedAt || data.fetchedAt;
    return '<div class="air-main">' +
        '<div class="air-aqi"><strong>' + esc(round(data.aqi)) + "</strong><span>AQI</span></div>" +
        '<div class="air-copy">' +
          "<strong>" + esc(category) + "</strong>" +
          "<span>" + (data.pollutant
            ? esc(t("air.mainPollutant", { pollutant: data.pollutant }))
            : esc(t("air.categoryOnly"))) + "</span>" +
        "</div>" +
        '<span class="air-sev">' + esc(severityLabel(data.severity || "safe")) + "</span>" +
      "</div>" +
      (chips.length ? '<div class="air-chips">' + chips.join("") + "</div>" : "") +
      (bits.length ? '<p class="air-station">' + icon("i-pin") + "<span>" + esc(bits.join(" · ")) + "</span></p>" : "") +
      (updated ? '<p class="air-updated">' + esc(t("air.updated", { time: formatShortDateTime(updated) })) + "</p>" : "") +
      (data.stale ? '<p class="air-stale">' + esc(t("air.stale")) + "</p>" : "");
  }

  function airHtml(region) {
    var entry = state.air[region.id] || { status: "idle" };
    var body;
    var stateClass = "";

    if (entry.status === "ready" && entry.data) {
      stateClass = " sev-" + (entry.data.severity || "safe");
      body = airReadingHtml(entry.data);
    } else if (entry.status === "unavailable") {
      body = '<p class="air-message">' + icon("i-info") + esc(t("air.noStation")) + "</p>";
    } else if (entry.status === "quota") {
      body = '<p class="air-message">' + icon("i-alert") + esc(t("air.quota")) + "</p>" + airRetryButton();
    } else if (entry.status === "error") {
      body = '<p class="air-message">' + icon("i-alert") + esc(airErrorText(entry.code)) + "</p>" + airRetryButton();
    } else if (entry.status === "offline") {
      body = '<p class="air-message">' + icon("i-wifi-off") + esc(t("air.offline")) + "</p>" + airRetryButton();
    } else {
      body = '<div class="air-loading"><span class="spinner"></span><span>' + esc(t("air.loading")) + "</span></div>";
    }

    return '<div class="air-block">' +
      '<div class="detail-section-title"><span class="air-heading">' + icon("i-air") +
        esc(t("air.title")) + '</span><span class="air-source">' + esc(t("air.provider")) + "</span></div>" +
      '<div class="air-card' + stateClass + '">' + body +
        '<div class="air-foot">' + icon("i-info") + "<span>" + esc(t("air.note")) + "</span></div>" +
      "</div>" +
    "</div>";
  }

  function retryAir() {
    var region = selectedRegion();
    if (!region) return;
    delete state.air[region.id];
    renderDetail();
  }

  /* ======================================================================
     NASA GPM IMERG observed rainfall (one district at a time, server-cached)
     ====================================================================== */

  function mmValue(value) {
    var n = Number(value);
    return isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : "—";
  }

  function maybeLoadGpm(id) {
    if (!id || !CONFIG.gpm) return;
    var entry = state.gpm[id];
    var now = Date.now();
    if (entry) {
      if (entry.status === "loading") return;
      if (entry.status === "ready" && now - entry.at < 30 * 60 * 1000) return;
      if (entry.status !== "ready" && now - entry.at < 2 * 60 * 1000) return;
    }
    if (!navigator.onLine) {
      state.gpm[id] = { status: "offline", at: now };
      return;
    }
    state.gpm[id] = {
      status: "loading",
      data: entry && entry.data ? entry.data : null,
      at: now
    };
    loadGpm(id);
  }

  async function loadGpm(id) {
    try {
      var response = await fetchWithTimeout("/api/gpm?district=" + encodeURIComponent(id), 35000, true);
      var payload = null;
      try { payload = await response.json(); } catch (e) { payload = null; }

      if (!response.ok) {
        if (payload && payload.error === "eula_required") {
          state.gpm[id] = {
            status: "setup",
            approvalUrl: payload.approvalUrl || (CONFIG.gpm && CONFIG.gpm.approvalUrl),
            at: Date.now()
          };
        } else {
          state.gpm[id] = {
            status: "error",
            code: payload && payload.error,
            at: Date.now()
          };
        }
      } else if (!payload || payload.available === false) {
        state.gpm[id] = { status: "unavailable", data: payload, at: Date.now() };
      } else {
        state.gpm[id] = { status: "ready", data: payload, at: Date.now() };
      }
    } catch (error) {
      state.gpm[id] = { status: "error", code: "network", at: Date.now() };
    }
    if (state.selectedId === id) renderDetail();
  }

  function gpmHtml(region) {
    var entry = state.gpm[region.id];
    if (!entry) return "";

    if (entry.status === "setup") {
      var approval = entry.approvalUrl || (CONFIG.gpm && CONFIG.gpm.approvalUrl) || "";
      return '<div class="air-block gpm-block">' +
        '<div class="detail-section-title"><span class="air-heading">' + icon("i-rain") +
          esc(t("gpm.title")) + '</span><span class="air-source">' + esc(t("gpm.provider")) + "</span></div>" +
        '<div class="air-card gpm-card gpm-setup">' +
          '<p class="air-message">' + icon("i-alert") +
            "<span><strong>" + esc(t("gpm.setupTitle")) + "</strong><br>" + esc(t("gpm.setupBody")) + "</span></p>" +
          '<div class="gpm-actions">' +
            (approval ? '<a class="btn btn-small" href="' + esc(approval) + '" target="_blank" rel="noopener">' + esc(t("gpm.approve")) + "</a>" : "") +
            '<button type="button" class="btn btn-small btn-quiet" data-action="gpm-retry">' + esc(t("gpm.retry")) + "</button>" +
          "</div>" +
        "</div>" +
      "</div>";
    }

    if (entry.status !== "ready" || !entry.data || !entry.data.available) {
      if (entry.status === "loading" || !entry.status) return "";
      var message = entry.status === "offline"
        ? t("gpm.offline")
        : entry.status === "unavailable"
          ? t("gpm.unavailable")
          : t("gpm.error");
      return '<div class="air-block gpm-block">' +
        '<div class="detail-section-title"><span class="air-heading">' + icon("i-rain") +
          esc(t("gpm.title")) + '</span><span class="air-source">' + esc(t("gpm.provider")) + "</span></div>" +
        '<div class="air-card gpm-card gpm-muted">' +
          '<p class="air-message">' + icon("i-info") + "<span>" + esc(message) + "</span></p>" +
          '<div class="gpm-actions">' +
            '<button type="button" class="btn btn-small btn-quiet" data-action="gpm-retry">' + esc(t("gpm.retry")) + "</button>" +
          "</div>" +
        "</div>" +
      "</div>";
    }
    var data = entry.data;
    var chips = [];
    chips.push('<span class="air-chip"><b>' + esc(t("gpm.max")) + "</b> " + esc(mmValue(data.maxMm)) + " mm</span>");
    chips.push('<span class="air-chip"><b>' + esc(t("gpm.wet")) + "</b> " + esc(data.wetCells) + "/" + esc(data.cells) + "</span>");
    if (data.latencyHours != null) {
      chips.push('<span class="air-chip"><b>' + esc(t("gpm.latency")) + "</b> " + esc(round(data.latencyHours)) + " h</span>");
    }

    return '<div class="air-block gpm-block">' +
      '<div class="detail-section-title"><span class="air-heading">' + icon("i-rain") +
        esc(t("gpm.title")) + '</span><span class="air-source">' + esc(t("gpm.provider")) + "</span></div>" +
      '<div class="air-card gpm-card">' +
        '<div class="air-main">' +
          '<div class="air-aqi gpm-value"><strong>' + esc(mmValue(data.rainfallMm)) + "</strong><span>mm</span></div>" +
          '<div class="air-copy">' +
            "<strong>" + esc(t("gpm.observed")) + "</strong>" +
            "<span>" + esc(t("gpm.dateLine", { date: dayLabel(data.date) })) + "</span>" +
          "</div>" +
          '<span class="air-sev">' + esc(t("gpm.extra")) + "</span>" +
        "</div>" +
        '<div class="air-chips">' + chips.join("") + "</div>" +
        (data.stale ? '<p class="air-stale">' + esc(t("gpm.stale")) + "</p>" : "") +
        '<div class="air-foot">' + icon("i-info") + "<span>" + esc(t("gpm.note")) + "</span></div>" +
      "</div>" +
    "</div>";
  }

  function retryGpm() {
    var region = selectedRegion();
    if (!region) return;
    delete state.gpm[region.id];
    renderDetail();
  }

  /* ======================================================================
     Wider hazards: GDACS, NASA EONET, ReliefWeb (extra web context)
     ====================================================================== */

  function maybeLoadHazards(id) {
    if (!id || !CONFIG.hazards) return;
    var entry = state.hazards[id];
    var now = Date.now();
    if (entry) {
      if (entry.status === "loading") return;
      if (entry.status === "ready" && now - entry.at < 15 * 60 * 1000) return;
      if (entry.status !== "ready" && now - entry.at < 2 * 60 * 1000) return;
    }
    if (!navigator.onLine) {
      state.hazards[id] = { status: "offline", at: now };
      window.setTimeout(function () {
        if (state.selectedId === id) renderDetail();
      }, 0);
      return;
    }
    state.hazards[id] = {
      status: "loading",
      data: entry && entry.data ? entry.data : null,
      at: now
    };
    loadHazards(id);
  }

  async function loadHazards(id) {
    try {
      var response = await fetchWithTimeout("/api/hazards?district=" + encodeURIComponent(id), 25000, true);
      var payload = null;
      try { payload = await response.json(); } catch (e) { payload = null; }

      if (!response.ok) {
        state.hazards[id] = {
          status: "error",
          code: payload && payload.error,
          at: Date.now()
        };
      } else {
        state.hazards[id] = { status: "ready", data: payload, at: Date.now() };
      }
    } catch (error) {
      state.hazards[id] = { status: "error", code: "network", at: Date.now() };
    }
    if (state.selectedId === id) renderDetail();
  }

  function widerTypeLabel(item) {
    var key = item && item.typeKey ? item.typeKey : "other";
    return t("wider.types." + key);
  }

  function widerItemHtml(item) {
    var headline = widerTypeLabel(item);
    if (item.alertLevel) headline = item.alertLevel + " · " + headline;

    var meta = [];
    if (item.country) meta.push(item.country);
    if (item.distanceKm != null) {
      meta.push(t("wider.distance", { km: round(item.distanceKm) }));
    } else if (item.scope === "regional") {
      meta.push(t("wider.regional"));
    }
    if (item.date) meta.push(formatShortDateTime(item.date));

    var inner =
      '<span class="wider-badge">' + esc(item.source || "") + "</span>" +
      '<span class="wider-main">' +
        '<span class="wider-headline">' + esc(headline) + "</span>" +
        '<strong class="wider-title">' + esc(item.title || "") + "</strong>" +
        (meta.length ? '<span class="wider-meta">' + esc(meta.join(" · ")) + "</span>" : "") +
      "</span>" +
      icon("i-external");

    var className = "wider-item" + (item.severity && item.severity !== "info" ? " sev-" + item.severity : "");
    if (item.url && /^https?:\/\//.test(item.url)) {
      return '<a class="' + className + '" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' +
        inner + "</a>";
    }
    return '<div class="' + className + '">' + inner + "</div>";
  }

  function widerSourceLine(data) {
    var sources = data.sources || {};
    var bits = ["gdacs", "eonet", "reliefweb"].map(function (key) {
      var source = sources[key] || {};
      var name = key === "eonet" ? "EONET" : key === "reliefweb" ? "ReliefWeb" : "GDACS";
      var status = source.status;
      if (status === "live") return name + " " + t("wider.live");
      if (status === "saved") return name + " " + t("wider.saved");
      if (status === "not_configured") return name + " " + t("wider.notConfigured");
      return name + " " + t("wider.failed");
    });
    return bits.join(" · ");
  }

  function widerHazardsHtml(region) {
    var entry = state.hazards[region.id];
    if (!entry) return "";

    var heading = '<div class="detail-section-title"><span class="air-heading">' + icon("i-alert") +
      esc(t("wider.title")) + '</span><span class="air-source">' + esc(t("wider.provider")) + "</span></div>";

    if (entry.status === "loading" && !entry.data) return "";

    if (entry.status !== "ready" || !entry.data) {
      var message = entry.status === "offline" ? t("wider.offline") : t("wider.error");
      return '<div class="air-block wider-block">' + heading +
        '<div class="air-card wider-card wider-muted">' +
          '<p class="air-message">' + icon(entry.status === "offline" ? "i-wifi-off" : "i-info") +
            "<span>" + esc(message) + "</span></p>" +
          '<div class="gpm-actions">' +
            '<button type="button" class="btn btn-small btn-quiet" data-action="hazards-retry">' + esc(t("wider.retry")) + "</button>" +
          "</div>" +
        "</div>" +
      "</div>";
    }

    var data = entry.data;
    var items = Array.isArray(data.items) ? data.items : [];
    var body;

    if (!data.available && !items.length) {
      body = '<p class="air-message">' + icon("i-wifi-off") +
        "<span>" + esc(t("wider.allFailed")) + "</span></p>" +
        '<div class="gpm-actions">' +
          '<button type="button" class="btn btn-small btn-quiet" data-action="hazards-retry">' + esc(t("wider.retry")) + "</button>" +
        "</div>";
    } else if (!items.length) {
      body = '<p class="air-message">' + icon("i-check") +
        "<span>" + esc(t("wider.empty", { radius: data.radiusKm || CONFIG.hazards.radiusKm })) + "</span></p>";
    } else {
      body = '<div class="wider-list">' + items.map(widerItemHtml).join("") + "</div>";
    }

    return '<div class="air-block wider-block">' + heading +
      '<div class="air-card wider-card">' +
        body +
        '<p class="wider-sources">' + esc(widerSourceLine(data)) + "</p>" +
        '<div class="air-foot">' + icon("i-info") + "<span>" + esc(t("wider.note")) + "</span></div>" +
      "</div>" +
    "</div>";
  }

  function retryHazards() {
    var region = selectedRegion();
    if (!region) return;
    delete state.hazards[region.id];
    renderDetail();
  }

  /* ======================================================================
     District grid, search and filters
     ====================================================================== */

  function renderDistrictGrid() {
    var grid = $("#districtGrid");
    if (!grid) return;
    if (!state.snapshot) return;

    var regions = Logic.sortRegions(placesInScope());
    var query = state.search.toLocaleLowerCase();
    var filtered = regions.filter(function (region) {
      if (state.hazardFilter && !region.alerts.some(function (alert) { return alert.type === state.hazardFilter; })) {
        return false;
      }
      if (!query) return true;
      return (region.name.en + " " + region.name.hi + " " + region.state.en + " " + region.state.hi)
        .toLocaleLowerCase().indexOf(query) !== -1;
    });

    grid.innerHTML = filtered.map(function (region) {
      var selected = region.id === state.selectedId;
      var isCity = region.tier === "city";
      var tags = [];
      region.alerts.forEach(function (alert) {
        if (tags.indexOf(alert.type) === -1) tags.push(alert.type);
      });
      var tagHtml = tags.slice(0, 3).map(function (type) {
        return '<span class="tag hz-' + type + '">' + esc(t("hazards." + type)) + "</span>";
      }).join("");
      if (tags.length > 3) tagHtml += '<span class="tag">+' + (tags.length - 3) + "</span>";

      var signals = region.alerts.length === 0
        ? t("districts.allClear")
        : (region.alerts.length === 1 ? t("districts.signalOne") : t("districts.signals", { n: region.alerts.length }));

      var tierBadge = state.scope === "all"
        ? '<span class="tier-badge is-' + (isCity ? "city" : "tribal") + '">' + esc(t(isCity ? "tier.city" : "tier.tribal")) + "</span>"
        : "";

      return '<button type="button" class="district-card sev-' + region.severity + (isCity ? " is-city" : "") + (selected ? " is-selected" : "") + '"' +
        ' data-region="' + esc(region.id) + '" data-tier="' + (isCity ? "city" : "tribal") + '" aria-pressed="' + (selected ? "true" : "false") + '">' +
        '<span class="district-top">' +
          '<span class="district-dot"></span>' +
          '<span class="district-name">' + esc(districtLabel(region, state.lang)) + "</span>" +
          tierBadge +
          '<span class="district-sev">' + esc(severityLabel(region.severity)) + "</span>" +
        "</span>" +
        '<span class="district-state">' + esc(stateLabel(region, state.lang)) + "</span>" +
        (tagHtml ? '<span class="district-tags">' + tagHtml + "</span>" : "") +
        '<span class="district-foot"><span>' + esc(signals) + "</span>" +
          '<span class="view">' + esc(t("districts.view")) + icon("i-arrow-right") + "</span></span>" +
      "</button>";
    }).join("");

    var count = $("#districtCount");
    if (count) count.textContent = t("districts.showing", { shown: filtered.length, total: regions.length });

    $$("#scopeBar .scope-btn").forEach(function (button) {
      var active = button.getAttribute("data-scope") === state.scope;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    var empty = $("#emptyDistricts");
    if (empty) empty.hidden = filtered.length !== 0;

    var filterBar = $("#filterBar");
    if (filterBar) filterBar.hidden = !state.hazardFilter;
    var filterLabel = $("#filterLabel");
    if (filterLabel) {
      filterLabel.textContent = state.hazardFilter
        ? t("districts.filter", { hazard: t("hazards." + state.hazardFilter) })
        : "";
    }
  }

  /* ======================================================================
     Map
     ====================================================================== */

  function initMap() {
    var mapElement = $("#map");
    if (!mapElement || typeof window.L === "undefined") {
      renderMapFallback();
      return;
    }
    try {
      state.map = window.L.map(mapElement, {
        zoomControl: false,
        minZoom: 3,
        maxZoom: 16,
        maxBounds: [[2, 58], [42, 108]],
        maxBoundsViscosity: 0.6,
        preferCanvas: true
      });
      state.map.setView(CONFIG.map.center, CONFIG.map.zoom);
      window.L.control.zoom({ position: "bottomright" }).addTo(state.map);

      state.baseLayer = "street";
      state.tileProviderIndex = 0;
      updateBaseLayerButtons();
      updateFullscreenButton();
      addTileLayer();
      state.map.fitBounds(CONFIG.map.bounds, { padding: [18, 18] });

      state.map.whenReady(function () {
        state.mapReady = true;
        hideMapLoading();
        window.setTimeout(function () {
          if (state.map) state.map.invalidateSize();
        }, 180);
      });
      state.canvasRenderer = window.L.canvas({ padding: 0.5 });
    } catch (e) {
      console.error("Map initialization failed", e);
      renderMapFallback();
    }
  }

  function activeTileProviders() {
    if (state.baseLayer === "satellite") {
      return CONFIG.map.satelliteProviders || [];
    }
    return CONFIG.map.tileProviders || [];
  }

  function addTileLayer() {
    var providers = activeTileProviders();
    if (!state.map || !providers.length) {
      if (state.baseLayer === "satellite") fallbackToStreet();
      else failTileProviders();
      return;
    }
    if (state.tileProviderIndex >= providers.length) {
      if (state.baseLayer === "satellite") fallbackToStreet();
      else failTileProviders();
      return;
    }

    var provider = providers[state.tileProviderIndex];
    var stats = { errors: 0, loads: 0 };
    state.tileStats = stats;

    var options = {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom || 19,
      detectRetina: true
    };
    if (provider.subdomains) options.subdomains = provider.subdomains;

    var layer = window.L.tileLayer(provider.url, options);
    state.tileLayer = layer;

    layer.on("tileload", function () {
      if (state.tileLayer !== layer) return;
      stats.loads += 1;
      if (stats.loads >= 3 && state.tileError) {
        state.tileError = false;
        hideMapLoading();
      }
    });

    layer.on("tileerror", function () {
      if (state.tileLayer !== layer) return;
      stats.errors += 1;
      var broken = stats.errors >= 4 && (stats.loads === 0 || stats.errors > stats.loads * 2);
      if (broken) switchTileProvider();
    });

    layer.addTo(state.map);

    // If the network silently hangs, switch instead of waiting forever.
    window.clearTimeout(state.tileWatchdog);
    state.tileWatchdog = window.setTimeout(function () {
      if (state.tileLayer !== layer) return;
      if (stats.loads === 0) switchTileProvider();
    }, 10000);
  }

  function switchTileProvider() {
    var providers = activeTileProviders();
    if (!state.map || state.tileSwitching) return;
    if (state.tileProviderIndex >= providers.length - 1) {
      if (state.baseLayer === "satellite") fallbackToStreet();
      else failTileProviders();
      return;
    }

    state.tileSwitching = true;
    window.clearTimeout(state.tileWatchdog);
    if (state.tileLayer) state.map.removeLayer(state.tileLayer);

    state.tileProviderIndex += 1;
    var next = providers[state.tileProviderIndex];
    addTileLayer();
    showToast(t("map.tilesSwitched", { provider: next.name }));

    window.setTimeout(function () {
      state.tileSwitching = false;
    }, 1200);
  }

  function fallbackToStreet() {
    if (!state.map || state.baseLayer !== "satellite") return;
    state.baseLayer = "street";
    state.tileProviderIndex = 0;
    state.tileError = false;
    state.tileSwitching = false;
    window.clearTimeout(state.tileWatchdog);
    if (state.tileLayer) {
      state.map.removeLayer(state.tileLayer);
      state.tileLayer = null;
    }
    updateBaseLayerButtons();
    addTileLayer();
    showToast(t("map.satelliteFailed"));
  }

  function setBaseLayer(mode) {
    if (!state.map || (mode !== "street" && mode !== "satellite")) return;
    if (state.baseLayer === mode) return;
    state.baseLayer = mode;
    state.tileProviderIndex = 0;
    state.tileError = false;
    state.tileSwitching = false;
    window.clearTimeout(state.tileWatchdog);
    if (state.tileLayer) {
      state.map.removeLayer(state.tileLayer);
      state.tileLayer = null;
    }
    updateBaseLayerButtons();
    addTileLayer();
  }

  function updateBaseLayerButtons() {
    var group = $("#mapBaseSwitch");
    if (!group) return;
    Array.prototype.forEach.call(group.querySelectorAll("[data-base]"), function (button) {
      var on = button.getAttribute("data-base") === state.baseLayer;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function failTileProviders() {
    if (!state.map) return;
    window.clearTimeout(state.tileWatchdog);
    state.tileError = true;
    if (state.tileLayer) {
      state.map.removeLayer(state.tileLayer);
      state.tileLayer = null;
    }
    hideMapLoading();
    showToast(t("map.tilesError"));
  }

  function retryTileProviders() {
    if (!state.map) return;
    window.clearTimeout(state.tileWatchdog);
    if (state.tileLayer) state.map.removeLayer(state.tileLayer);
    state.tileLayer = null;
    state.tileProviderIndex = 0;
    state.tileError = false;
    state.tileSwitching = false;
    addTileLayer();
  }

  function renderMapFallback() {
    var loading = $("#mapLoading");
    if (loading) {
      loading.hidden = false;
      loading.innerHTML = "<span>" + esc(t("map.tilesError")) + "</span>";
    }
  }

  /* ---- Fullscreen map -------------------------------------------------- */

  function mapFrameElement() {
    return document.querySelector(".map-frame");
  }

  function isMapFullscreen() {
    var frame = mapFrameElement();
    if (!frame) return false;
    return document.fullscreenElement === frame || frame.classList.contains("is-fullscreen");
  }

  function updateFullscreenButton() {
    var button = $("#mapFullscreen");
    if (!button) return;
    var on = isMapFullscreen();
    var use = button.querySelector("use");
    if (use) use.setAttribute("href", on ? "#i-compress" : "#i-expand");
    var label = on ? "map.exitFullscreen" : "map.fullscreen";
    button.setAttribute("title", t(label));
    button.setAttribute("aria-label", t(label));
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function fallbackFullscreen(on) {
    var frame = mapFrameElement();
    if (!frame) return;
    frame.classList.toggle("is-fullscreen", on);
    document.body.classList.toggle("map-fullscreen-open", on);
    updateFullscreenButton();
    if (state.map) {
      window.setTimeout(function () {
        if (state.map) state.map.invalidateSize();
      }, 120);
    }
  }

  function toggleMapFullscreen() {
    var frame = mapFrameElement();
    if (!frame) return;

    if (isMapFullscreen()) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(function () {
          fallbackFullscreen(false);
        });
      } else {
        fallbackFullscreen(false);
      }
      return;
    }

    if (typeof frame.requestFullscreen === "function") {
      var request;
      try {
        request = frame.requestFullscreen();
      } catch (error) {
        fallbackFullscreen(true);
        return;
      }
      if (request && typeof request.then === "function") {
        request.catch(function () {
          fallbackFullscreen(true);
        });
      }
    } else {
      fallbackFullscreen(true);
    }
  }

  function handleFullscreenChange() {
    var frame = mapFrameElement();
    if (!frame) return;
    // Native fullscreen uses the :fullscreen style; the class is only for the
    // fallback, so remove it either way.
    frame.classList.remove("is-fullscreen");
    document.body.classList.remove("map-fullscreen-open");
    updateFullscreenButton();
    if (state.map) {
      window.setTimeout(function () {
        if (state.map) state.map.invalidateSize();
      }, 120);
    }
  }

  /* ---- Bhuvan route ---------------------------------------------------- */

  function routeErrorText(code) {
    switch (code) {
      case "invalid_token": return t("route.tokenExpired");
      case "token_missing": return t("route.tokenMissing");
      case "same_state": return t("route.sameState");
      case "no_route": return t("route.noRoute");
      case "unknown_district": return t("route.needDistrict");
      default: return t("route.unavailable");
    }
  }

  function setRouteBusy(busy) {
    state.routeBusy = busy;
    var button = document.querySelector('#detailPanel [data-action="route"]');
    if (button) {
      button.disabled = busy;
      button.setAttribute("aria-busy", busy ? "true" : "false");
    }
  }

  function currentPosition() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject({ code: 0 });
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 300000
      });
    });
  }

  async function routeToSelected() {
    var region = selectedRegion();
    if (!region) {
      showToast(t("route.needDistrict"));
      return;
    }
    if (state.routeBusy) return;

    setRouteBusy(true);
    showToast(t("route.locating"));

    try {
      var position;
      try {
        position = await currentPosition();
      } catch (error) {
        showToast(t(error && error.code === 1 ? "route.geoDenied" : "route.geoUnsupported"));
        return;
      }

      var lat = position.coords.latitude;
      var lon = position.coords.longitude;
      showToast(t("route.loading"));

      var url = "/api/route?fromLat=" + encodeURIComponent(lat) +
        "&fromLon=" + encodeURIComponent(lon) +
        "&to=" + encodeURIComponent(region.id);
      var response;
      try {
        response = await fetchWithTimeout(url, 35000);
      } catch (error) {
        showToast(t("route.serverOnly"));
        return;
      }

      var data = null;
      try {
        data = await response.json();
      } catch (error) {
        showToast(t("route.serverOnly"));
        return;
      }

      if (!response.ok || data.error) {
        showToast(routeErrorText(data && data.error));
        return;
      }

      renderRoute(data, region);
    } finally {
      setRouteBusy(false);
    }
  }

  function clearRouteLayer() {
    var mapElement = $("#map");
    if (mapElement) mapElement.removeAttribute("data-route");
    if (!state.map || !state.routeLayer) {
      state.routeLayer = null;
      return;
    }
    state.map.removeLayer(state.routeLayer);
    state.routeLayer = null;
  }

  function clearRoute(silent) {
    clearRouteLayer();
    state.route = null;
    var info = $("#routeInfo");
    if (info) info.hidden = true;
    if (!silent) showToast(t("route.clear"));
  }

  function refreshRouteText() {
    if (!state.route) return;
    var text = $("#routeInfoText");
    if (!text) return;
    var data = state.route;
    var region = data.to && data.to.id ? (CONFIG.placeById[data.to.id] || CONFIG.regionById[data.to.id]) : selectedRegion();
    var name = region
      ? districtLabel(region, state.lang)
      : (data.to && data.to.name) || "";
    text.textContent = t("route.summary", {
      km: formatNumber(data.distanceKm),
      district: name
    });
  }

  function renderRoute(data, region) {
    if (!state.map || !window.L || !data || !data.geometry) return;
    var L = window.L;
    clearRouteLayer();

    var group = L.featureGroup();
    var style = { color: "#fffdf7", weight: 9, opacity: 0.9, lineCap: "round", lineJoin: "round" };
    L.geoJSON({ type: "Feature", geometry: data.geometry, properties: {} }, { style: style }).addTo(group);
    L.geoJSON({ type: "Feature", geometry: data.geometry, properties: {} }, {
      style: { color: "#1d6b47", weight: 4.5, opacity: 1, lineCap: "round", lineJoin: "round" }
    }).addTo(group);

    if (data.from) {
      L.circleMarker([data.from.lat, data.from.lon], {
        radius: 6, color: "#fffdf7", weight: 2, fillColor: "#2c5d86", fillOpacity: 1
      }).addTo(group).bindTooltip(t("route.button"), { direction: "top", offset: [0, -7] });
    }
    var toLat = data.to && data.to.lat != null ? data.to.lat : region.lat;
    var toLon = data.to && data.to.lon != null ? data.to.lon : region.lon;
    L.circleMarker([toLat, toLon], {
      radius: 6, color: "#fffdf7", weight: 2, fillColor: "#1d6b47", fillOpacity: 1
    }).addTo(group).bindTooltip(districtLabel(region, state.lang), { direction: "top", offset: [0, -7] });

    group.addTo(state.map);
    state.routeLayer = group;
    state.layerGroups.route = group;
    state.route = data;
    var mapElement = $("#map");
    if (mapElement) mapElement.setAttribute("data-route", "true");
    state.map.fitBounds(group.getBounds(), { padding: [34, 34] });

    var info = $("#routeInfo");
    refreshRouteText();
    if (info) info.hidden = false;
    showToast(t("route.ready", { km: formatNumber(data.distanceKm) }));
  }

  function hideMapLoading() {
    var loading = $("#mapLoading");
    if (loading) loading.hidden = true;
  }

  function renderMapData() {
    if (!state.map) return;
    renderFireLayer();
    renderQuakeLayer();
    renderRegionMarkers();
    window.setTimeout(function () {
      if (state.map) state.map.invalidateSize();
    }, 30);
  }

  function regionIcon(region, selected) {
    var isCity = region.tier === "city";
    var pulse = !isCity && (region.severity === "warning" || region.severity === "severe") ? " pulse" : "";
    var size = isCity ? 20 : 26;
    return window.L.divIcon({
      className: "region-marker" + (isCity ? " city-marker" : ""),
      html: '<span class="region-dot sev-' + region.severity + pulse + (selected ? " is-selected" : "") + (isCity ? " is-city" : "") + '"></span>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  function regionTooltip(region) {
    var top = region.alerts[0];
    var html = '<span class="map-tooltip-title">' + esc(districtLabel(region, state.lang)) + "</span>" +
      '<span class="map-tooltip-sub">' + esc(stateLabel(region, state.lang)) + " · " + esc(severityLabel(region.severity)) + "</span>";
    if (top) {
      html += '<span class="map-tooltip-sub">' + esc(t("alertTitles." + top.type)) + "</span>";
    }
    return html;
  }

  function renderRegionMarkers() {
    if (!state.map) return;
    var L = window.L;
    if (state.layerGroups.regions) {
      state.map.removeLayer(state.layerGroups.regions);
      state.layerGroups.regions = null;
    }
    state.regionMarkers = {};
    if (!state.snapshot) return;

    var selected = state.selectedId;
    var scoped = placesInScope();
    var regions = scoped.filter(function (r) { return r.id !== selected; });
    var selectedRegionData = scoped.filter(function (r) { return r.id === selected; });
    regions = regions.concat(selectedRegionData);

    var group = L.layerGroup();
    regions.forEach(function (region) {
      var isSelected = region.id === selected;
      var marker = L.marker([region.lat, region.lon], {
        icon: regionIcon(region, isSelected),
        title: districtLabel(region, state.lang),
        zIndexOffset: isSelected ? 1000 : 0,
        keyboard: true
      });
      marker.bindTooltip(regionTooltip(region), {
        direction: "top",
        offset: [0, -10],
        opacity: 1
      });
      marker.on("click", function () {
        selectRegion(region.id, "map");
      });
      marker.addTo(group);
      state.regionMarkers[region.id] = marker;
    });
    group.addTo(state.map);
    state.layerGroups.regions = group;
  }

  function refreshRegionMarkers() {
    if (!state.snapshot) return;
    Object.keys(state.regionMarkers).forEach(function (id) {
      var region = state.snapshot.regions.filter(function (r) { return r.id === id; })[0];
      var marker = state.regionMarkers[id];
      if (!region || !marker) return;
      var isSelected = id === state.selectedId;
      marker.setIcon(regionIcon(region, isSelected));
      marker.setZIndexOffset(isSelected ? 1000 : 0);
      marker.setTooltipContent(regionTooltip(region));
    });
  }

  function renderFireLayer() {
    if (!state.map) return;
    var L = window.L;
    if (state.layerGroups.fires) {
      state.map.removeLayer(state.layerGroups.fires);
      state.layerGroups.fires = null;
    }
    if (!state.layers.fires || !state.fires.length) return;

    if (!state.canvasRenderer) state.canvasRenderer = L.canvas({ padding: 0.5 });
    var group = L.layerGroup();
    var now = Date.now();

    state.fires.forEach(function (fire) {
      var ageHours = (now - fire.ts) / 3600000;
      var color = ageHours <= 6 ? "#f2a51f" : ageHours <= 24 ? "#e2681f" : "#b9521c";
      var radius = 2.2 + Math.min(3.4, Math.log10((fire.frp || 0) + 1) * 1.45);
      var marker = L.circleMarker([fire.lat, fire.lon], {
        renderer: state.canvasRenderer,
        radius: radius,
        color: color,
        weight: 0,
        fillColor: color,
        fillOpacity: ageHours <= 24 ? 0.78 : 0.52,
        interactive: true,
        bubblingMouseEvents: false
      });
      marker.bindPopup(function () { return firePopupHtml(fire); }, { maxWidth: 280 });
      marker.addTo(group);
    });
    group.addTo(state.map);
    state.layerGroups.fires = group;
  }

  function nearestRegion(lat, lon) {
    return Logic.findNearestRegion(PLACES, lat, lon);
  }

  function firePopupHtml(fire) {
    var near = nearestRegion(fire.lat, fire.lon);
    var district = near ? districtLabel(near.region, state.lang) : "—";
    var distance = near ? round(near.distanceKm) : "—";
    var conf = (fire.confidenceRaw || "").trim();
    var confText = /^\d+$/.test(conf) ? conf + "%" : (conf ? conf.toUpperCase() : "");
    return '<strong class="map-popup-title">' + esc(t("map.firePopup")) + "</strong>" +
      '<span class="map-popup-sub">' + esc(t("map.firePopupMeta", { distance: distance, district: district, time: formatShortDateTime(fire.ts) })) + "</span>" +
      '<span class="map-popup-meta">' + esc(t("map.frp", { frp: Number(fire.frp || 0).toFixed(1) })) + "</span>" +
      '<span class="map-popup-meta">' + esc((fire.satellite || "") + " · " + (fire.instrument || "")) + "</span>" +
      (confText ? '<span class="map-popup-meta">' + esc(t("map.confidence", { value: confText })) + "</span>" : "");
  }

  function renderQuakeLayer() {
    if (!state.map) return;
    var L = window.L;
    if (state.layerGroups.quakes) {
      state.map.removeLayer(state.layerGroups.quakes);
      state.layerGroups.quakes = null;
    }
    if (!state.layers.quakes || !state.quakes.length) return;

    var group = L.layerGroup();
    state.quakes.forEach(function (quake) {
      var marker = L.marker([quake.lat, quake.lon], {
        icon: L.divIcon({
          className: "quake-marker",
          html: '<span class="quake-symbol"></span>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        }),
        title: "M" + Number(quake.mag).toFixed(1),
        keyboard: true
      });
      marker.bindTooltip("M" + Number(quake.mag).toFixed(1), { direction: "top", offset: [0, -8] });
      marker.bindPopup(function () { return quakePopupHtml(quake); }, { maxWidth: 280 });
      marker.addTo(group);
    });
    group.addTo(state.map);
    state.layerGroups.quakes = group;
  }

  function quakePopupHtml(quake) {
    var near = nearestRegion(quake.lat, quake.lon);
    var district = near ? districtLabel(near.region, state.lang) : "—";
    var distance = near ? round(near.distanceKm) : "—";
    var depth = quake.depth == null ? "—" : round(quake.depth);
    var link = "";
    if (quake.url && /^https?:\/\//.test(quake.url)) {
      link = '<a class="map-popup-link" href="' + esc(quake.url) + '" target="_blank" rel="noopener noreferrer">' +
        esc(t("map.quakeLink")) + " " + icon("i-external") + "</a>";
    }
    return '<strong class="map-popup-title">' + esc(t("map.quakePopup", { mag: Number(quake.mag).toFixed(1) })) + "</strong>" +
      '<span class="map-popup-sub">' + esc(quake.place || "") + "</span>" +
      '<span class="map-popup-meta">' + esc(t("map.quakeMeta", {
        distance: distance,
        district: district,
        depth: depth,
        time: formatShortDateTime(quake.time)
      })) + "</span>" +
      (link ? '<span class="map-popup-meta">' + link + "</span>" : "");
  }

  function renderMapFoot() {
    var latest = $("#latestPass");
    var fireMeta = $("#mapFireMeta");
    var quakeMeta = $("#mapQuakeMeta");
    if (!latest) return;
    if (!state.snapshot) {
      latest.textContent = t("map.loading");
      if (fireMeta) fireMeta.textContent = "";
      if (quakeMeta) quakeMeta.textContent = "";
      return;
    }
    latest.textContent = state.latestFire
      ? t("map.latest", { time: formatShortDateTime(state.latestFire) })
      : t("map.noFires");
    if (fireMeta) {
      fireMeta.textContent = t(state.fires.length === 1 ? "map.shownOne" : "map.shown", { n: formatNumber(state.fires.length) }) +
        (state.sources.firms === "saved" ? " · " + t("header.saved") : "");
    }
    if (quakeMeta) {
      quakeMeta.textContent = t(state.quakes.length === 1 ? "map.quakesShownOne" : "map.quakesShown", { n: formatNumber(state.quakes.length) });
    }
  }

  function flyMapTo(lat, lon, zoom, options) {
    if (!state.map) return;
    // The map can be hidden while printing (size 0×0). Calling flyTo then
    // throws inside Leaflet because it divides by the map size.
    state.map.invalidateSize();
    var size = state.map.getSize();
    if (!size || !size.x || !size.y) return;
    state.map.flyTo([lat, lon], zoom, options);
  }

  function selectRegion(id, source) {
    var place = CONFIG.placeById[id] || CONFIG.regionById[id];
    if (!place) return;
    if (place.tier === "city" && state.scope === "tribal") state.scope = "all";
    if (state.route && state.route.to && state.route.to.id && state.route.to.id !== id) {
      clearRoute(true);
    }
    state.selectedId = id;
    if (state.snapshot) {
      renderDetail();
      renderDistrictGrid();
      refreshRegionMarkers();
      var region = selectedRegion();
      if (region && state.map && (source === "card" || source === "locate")) {
        flyMapTo(region.lat, region.lon, Math.max(6, state.map.getZoom()), { duration: 0.8 });
      }
      if (source === "card" && window.matchMedia("(max-width: 960px)").matches) {
        window.setTimeout(function () {
          var panel = $("#detailPanel");
          if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    }
  }

  function showLocation(lat, lon, accuracy) {
    if (!state.map || !window.L) return;
    var L = window.L;
    if (state.layerGroups.location) {
      state.map.removeLayer(state.layerGroups.location);
      state.layerGroups.location = null;
    }
    var group = L.layerGroup();
    L.circle([lat, lon], {
      radius: Math.max(100, Math.min(accuracy || 150, 5000)),
      color: "#2c5d86",
      weight: 1,
      fillColor: "#2c5d86",
      fillOpacity: 0.08,
      interactive: false
    }).addTo(group);
    L.circleMarker([lat, lon], {
      radius: 7,
      color: "#fffdf7",
      weight: 2.5,
      fillColor: "#2c5d86",
      fillOpacity: 1
    }).addTo(group).bindTooltip(t("map.you"), { direction: "top", offset: [0, -8] });
    group.addTo(state.map);
    state.layerGroups.location = group;
    state.location = { lat: lat, lon: lon, accuracy: accuracy };
    flyMapTo(lat, lon, 7, { duration: 1 });
  }

  /* ======================================================================
     Guides, helplines and methodology
     ====================================================================== */

  function renderGuides() {
    var grid = $("#guideGrid");
    if (!grid) return;
    var guides = currentDict().guides;
    if (!guides || !guides.items) return;
    var order = ["fire", "flood", "heat", "quake", "storm"];

    grid.innerHTML = order.map(function (key, index) {
      var item = guides.items[key];
      if (!item) return "";
      var doList = (item.do || []).map(function (text) {
        return "<li>" + esc(text) + "</li>";
      }).join("");
      var dontList = (item.dont || []).map(function (text) {
        return "<li>" + esc(text) + "</li>";
      }).join("");
      return '<details class="guide-card"' + (index === 0 ? " open" : "") + ">" +
        "<summary>" +
          '<span class="guide-icon ' + key + '">' + icon(GUIDE_ICON[key]) + "</span>" +
          "<span>" + esc(item.title) + "</span>" +
          icon("i-chevron", "guide-chevron") +
        "</summary>" +
        '<div class="guide-body"><div class="guide-lists">' +
          "<div><h4 class=\"guide-list-title do\">" + icon("i-check") + esc(guides.do) + "</h4>" +
            '<ul class="guide-list do">' + doList + "</ul></div>" +
          "<div><h4 class=\"guide-list-title dont\">" + icon("i-x") + esc(guides.dont) + "</h4>" +
            '<ul class="guide-list dont">' + dontList + "</ul></div>" +
        "</div></div>" +
      "</details>";
    }).join("");
  }

  function renderHelplines() {
    var grid = $("#helplineGrid");
    if (!grid) return;
    var items = currentDict().helplines && currentDict().helplines.items;
    if (!items) return;
    grid.innerHTML = items.map(function (item) {
      return '<a class="helpline" href="tel:' + esc(item.num) + '">' +
        '<span class="helpline-num">' + esc(item.num) + "</span>" +
        '<span class="helpline-label">' + esc(item.label) + "</span>" +
        '<span class="helpline-desc">' + esc(item.desc) + "</span>" +
        '<span class="helpline-call">' + esc(t("helplines.call")) + icon("i-phone") + "</span>" +
      "</a>";
    }).join("");
  }

  function renderAbout() {
    var method = $("#methodContent");
    var sources = $("#sourcesContent");
    var about = currentDict().about;
    if (!about) return;

    if (method) {
      var rows = (about.rows || []).map(function (row) {
        return "<tr><td>" + esc(row.label) + "</td><td>" + esc(row.watch) + "</td><td>" + esc(row.warning) + "</td><td>" + esc(row.severe) + "</td></tr>";
      }).join("");
      method.innerHTML =
        "<p>" + esc(about.methodIntro) + "</p>" +
        '<div class="table-wrap"><table class="about-table"><thead><tr>' +
          "<th>" + esc(about.columns.hazard) + "</th>" +
          "<th>" + esc(about.columns.watch) + "</th>" +
          "<th>" + esc(about.columns.warning) + "</th>" +
          "<th>" + esc(about.columns.severe) + "</th>" +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
        '<p class="about-note">' + esc(about.note) + "</p>";
    }

    if (sources) {
      sources.innerHTML = (about.sources || []).map(function (source, index) {
        var url = SOURCE_URLS[index];
        var name = url
          ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + esc(source.name) + "</a>"
          : esc(source.name);
        return '<div class="source-row">' + icon(SOURCE_ICONS[index] || "i-layers") +
          "<div><strong>" + name + "</strong><span>" + esc(source.desc) + "</span></div></div>";
      }).join("");
    }
  }

  /* ======================================================================
     Connection state and banner
     ====================================================================== */

  function updatePill() {
    var pill = $("#livePill");
    var label = $("#liveLabel");
    if (!pill || !label) return;
    pill.classList.remove("is-saved", "is-offline");
    var statuses = Object.keys(state.sources).map(function (key) { return state.sources[key]; });
    var anyLive = statuses.indexOf("live") !== -1;

    if (!navigator.onLine) {
      pill.classList.add("is-offline");
      label.textContent = t("header.offline");
    } else if (state.loading) {
      label.textContent = t("header.connecting");
    } else if (state.partial) {
      if (!state.snapshot) {
        pill.classList.add("is-offline");
        label.textContent = t("header.offline");
      } else {
        pill.classList.add("is-saved");
        label.textContent = anyLive ? t("header.partial") : t("header.saved");
      }
    } else {
      label.textContent = t("header.live");
    }
  }

  function updateBanner() {
    var banner = $("#banner");
    if (!banner) return;
    var shouldShow = !navigator.onLine || (state.partial && state.loaded) || (!state.snapshot && state.loaded && !state.loading);
    if (!shouldShow || state.bannerDismissed) {
      banner.hidden = true;
      return;
    }
    var title = $("#bannerTitle");
    var text = $("#bannerText");
    if (!navigator.onLine) {
      if (title) title.textContent = t("header.offline");
      if (text) text.textContent = t("toast.offline");
    } else {
      if (title) title.textContent = t("banner.title");
      if (text) text.textContent = state.fromCache ? t("banner.body") : t("banner.partialBody");
    }
    banner.hidden = false;
  }

  function hideBanner() {
    var banner = $("#banner");
    if (banner) banner.hidden = true;
  }

  function setProgress(show) {
    var progress = $("#progressBar");
    if (progress) progress.hidden = !show;
  }

  function setSpinning(show) {
    var button = $("#refreshBtn");
    if (button) button.classList.toggle("is-spinning", !!show);
  }

  function handleOnline() {
    showToast(t("toast.online"));
    if (!state.loading) loadAll({ manual: false });
  }

  function handleOffline() {
    state.partial = true;
    updatePill();
    updateBanner();
    showToast(t("toast.offline"));
  }

  function handleVisibility() {
    if (document.hidden || state.loading || !state.lastUpdated) return;
    if (!navigator.onLine) return;
    if (Date.now() - state.lastUpdated > CONFIG.refreshMinutes * 60 * 1000) {
      loadAll({ auto: true });
    }
  }

  function autoRefreshTick() {
    if (document.hidden || state.loading) return;
    if (!navigator.onLine) {
      updatePill();
      return;
    }
    if (!state.lastUpdated || Date.now() - state.lastUpdated >= CONFIG.refreshMinutes * 60 * 1000) {
      loadAll({ auto: true });
    }
  }

  /* ======================================================================
     Sharing, copying and printing
     ====================================================================== */

  function siteUrl() {
    if (location.protocol === "http:" || location.protocol === "https:") {
      return location.origin + location.pathname;
    }
    return "";
  }

  function buildShareText() {
    var region = selectedRegion();
    if (!region) return "";
    var name = districtLabel(region, state.lang);
    var stateName = stateLabel(region, state.lang);
    var lines = [];
    lines.push(t("appName") + " — " + name + ", " + stateName);
    lines.push(t("severities.status") + ": " + severityLabel(region.severity));
    if (region.alerts.length) {
      region.alerts.forEach(function (alert) {
        lines.push("• " + t("alertTitles." + alert.type) + ": " + alertDescription(alert));
      });
    } else {
      lines.push(t("detail.noAlerts", { district: name }));
      lines.push(t("detail.noAlertsSub"));
    }
    var air = state.air[region.id];
    if (air && air.status === "ready" && air.data && air.data.available) {
      lines.push(t("air.share", {
        aqi: air.data.aqi,
        category: t("air.categories." + (air.data.categoryKey || "unknown"))
      }));
    }
    var gpm = state.gpm[region.id];
    if (gpm && gpm.status === "ready" && gpm.data && gpm.data.available) {
      lines.push(t("gpm.share", {
        date: dayLabel(gpm.data.date),
        mm: mmValue(gpm.data.rainfallMm),
        max: mmValue(gpm.data.maxMm)
      }));
    }
    var wider = state.hazards[region.id];
    if (wider && wider.status === "ready" && wider.data && Array.isArray(wider.data.items) && wider.data.items.length) {
      lines.push(t("wider.share", { count: wider.data.items.length }));
      var topWider = wider.data.items[0];
      lines.push("• " + topWider.source + ": " + topWider.title);
    }
    lines.push("112 · 108 · 101 · 1078");
    var url = siteUrl();
    if (url) lines.push(url);
    lines.push(t("footer.disclaimer"));
    return lines.join("\n");
  }

  function shareWhatsApp() {
    var text = buildShareText();
    if (!text) return;
    var url = "https://wa.me/?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener");
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        var ok = document.execCommand("copy");
        document.body.removeChild(area);
        if (ok) resolve();
        else reject(new Error("copy failed"));
      } catch (e) {
        document.body.removeChild(area);
        reject(e);
      }
    });
  }

  function copyAlert() {
    var text = buildShareText();
    if (!text) return;
    copyText(text).then(function () {
      showToast(t("toast.copied"));
    }).catch(function () {
      showToast(t("toast.copyFailed"));
    });
  }

  function printNotice() {
    var region = selectedRegion();
    if (!region) return;
    var name = districtLabel(region, state.lang);
    var stateName = stateLabel(region, state.lang);
    var top = region.alerts[0] || null;
    var alerts = region.alerts;
    var now = Date.now();
    var statusColor = { safe: "#2c7a58", watch: "#a97406", warning: "#c85516", severe: "#a92026" }[region.severity];
    var actions = [];

    if (top) {
      var guide = currentDict().guides.items[GUIDE_KEY[top.type]];
      if (guide && guide.do) actions = guide.do.slice(0, 3);
    }
    if (!actions.length) actions = [t("detail.prep"), t("about.officialText")];

    var alertHtml = alerts.length
      ? alerts.map(function (alert) {
          return '<div class="print-alert">' +
            '<div><div class="print-alert-title">' + esc(t("alertTitles." + alert.type)) + "</div>" +
              '<span class="print-alert-sev">' + esc(severityLabel(alert.severity)) + "</span></div>" +
            "<p>" + esc(alertDescription(alert)) + "</p>" +
          "</div>";
        }).join("")
      : '<p class="print-empty">' + esc(t("print.noSignals")) + "</p>";

    var helplines = currentDict().helplines.items.map(function (item) {
      return '<div class="print-helpline"><b>' + esc(item.num) + "</b><span>" + esc(item.label) + "</span></div>";
    }).join("");

    var logo = '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M24 3 43 9.5v13.2C43 34.6 34.7 42.4 24 45 13.3 42.4 5 34.6 5 22.7V9.5L24 3Z" fill="#173f30"/>' +
      '<path d="M24 11.5c4.7 4.4 8.4 7.6 8.4 13a8.4 8.4 0 1 1-16.8 0c0-3.7 2.3-6.2 4.4-8.1.1 2.5 1.2 3.8 3.1 4.8-.3-4-1-6.3.9-9.7Z" fill="#ffffff"/>' +
    "</svg>";

    $("#printArea").innerHTML =
      '<div class="print-head">' +
        '<div class="print-brand">' + logo +
          "<div><strong>" + esc(t("appName")) + "</strong><span>" + esc(t("tagline")) + "</span></div>" +
        "</div>" +
        '<div class="print-kind"><strong>' + esc(t("print.title")) + "</strong><span>" + esc(t("print.date", { date: formatDate(now) })) + "</span></div>" +
      "</div>" +
      '<div class="print-meta">' +
        "<span>" + esc(t("print.district", { district: name, state: stateName })) + "</span>" +
        "<span>" + esc(formatTime(now)) + "</span>" +
      "</div>" +
      '<div class="print-status" style="--print-sev:' + statusColor + '">' +
        "<div><strong>" + esc(t("print.status", { status: severityLabel(region.severity) })) + "</strong>" +
          (top ? "<span>" + esc(t("alertTitles." + top.type)) + "</span>" : "") + "</div>" +
        "<span>" + esc(t("appName")) + "</span>" +
      "</div>" +
      '<section class="print-section"><h2>' + esc(t("print.signals")) + "</h2>" + alertHtml + "</section>" +
      '<div class="print-two">' +
        '<section><h2>' + esc(t("print.actions")) + "</h2><ul class=\"print-list\">" +
          actions.map(function (action) { return "<li>" + esc(action) + "</li>"; }).join("") +
        "</ul></section>" +
        '<section><h2>' + esc(t("print.helplines")) + "</h2>" +
          '<div class="print-helplines">' + helplines + "</div>" +
          "<p>" + esc(t("print.sourceLine")) + "</p>" +
        "</section>" +
      "</div>" +
      '<div class="print-footer">' +
        "<p>" + esc(t("print.footer", { time: formatTime(now) })) + "</p>" +
        "<p>" + esc(siteUrl() || t("footer.data")) + "</p>" +
      "</div>";

    window.setTimeout(function () { window.print(); }, 80);
  }

  /* ======================================================================
     Geolocation
     ====================================================================== */

  function locateMe() {
    var button = $("#locateBtn");
    if (!navigator.geolocation) {
      showToast(t("toast.geoUnsupported"));
      return;
    }
    if (button) button.disabled = true;
    navigator.geolocation.getCurrentPosition(function (position) {
      if (button) button.disabled = false;
      var lat = position.coords.latitude;
      var lon = position.coords.longitude;
      showLocation(lat, lon, position.coords.accuracy);

      var near = nearestRegion(lat, lon);
      if (!near || near.distanceKm > 500) {
        showToast(t("toast.outside"));
        return;
      }
      state.selectedId = near.region.id;
      if (state.snapshot) {
        selectRegion(near.region.id, "locate");
      }
      showToast(t("toast.located", { district: districtLabel(near.region, state.lang) }));
    }, function (error) {
      if (button) button.disabled = false;
      showToast(t(error && error.code === 1 ? "toast.geoDenied" : "toast.geoUnsupported"));
    }, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 300000
    });
  }

  /* ======================================================================
     Events and utilities
     ====================================================================== */

  function bindEvents() {
    $("#refreshBtn").addEventListener("click", function () {
      loadAll({ manual: true });
    });

    var langSelect = $("#langSelect");
    if (langSelect) {
      langSelect.addEventListener("change", function () {
        setLanguage(langSelect.value);
      });
    }

    var scopeBar = $("#scopeBar");
    if (scopeBar) {
      scopeBar.addEventListener("click", function (event) {
        var button = event.target.closest("[data-scope]");
        if (!button) return;
        state.scope = button.getAttribute("data-scope");
        renderDistrictGrid();
        renderRegionMarkers();
      });
    }

    $("#menuBtn").addEventListener("click", function (event) {
      event.stopPropagation();
      setMenu(!$("#siteNav").classList.contains("is-open"));
    });
    $("#siteNav").addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });
    document.addEventListener("click", function (event) {
      var nav = $("#siteNav");
      var button = $("#menuBtn");
      if (!nav || !button || !nav.classList.contains("is-open")) return;
      if (!nav.contains(event.target) && !button.contains(event.target)) setMenu(false);
    });

    $("#locateBtn").addEventListener("click", locateMe);

    $$(".stat-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var hazard = card.getAttribute("data-hazard");
        state.hazardFilter = state.hazardFilter === hazard ? null : hazard;
        renderStats();
        renderDistrictGrid();
      });
    });

    $("#districtSearch").addEventListener("input", function (event) {
      state.search = event.target.value.trim();
      renderDistrictGrid();
    });

    $("#clearFilter").addEventListener("click", function () {
      state.hazardFilter = null;
      renderStats();
      renderDistrictGrid();
    });

    $("#districtGrid").addEventListener("click", function (event) {
      var card = event.target.closest("[data-region]");
      if (card) selectRegion(card.getAttribute("data-region"), "card");
    });

    $("#detailPanel").addEventListener("click", function (event) {
      var button = event.target.closest("[data-action]");
      if (!button) return;
      var action = button.getAttribute("data-action");
      if (action === "whatsapp") shareWhatsApp();
      else if (action === "route") routeToSelected();
      else if (action === "copy") copyAlert();
      else if (action === "print") printNotice();
      else if (action === "air-retry") retryAir();
      else if (action === "gpm-retry") retryGpm();
      else if (action === "hazards-retry") retryHazards();
      else if (action === "retry") loadAll({ manual: true });
    });

    $("#toggleFires").addEventListener("click", function () {
      state.layers.fires = !state.layers.fires;
      this.classList.toggle("is-on", state.layers.fires);
      this.setAttribute("aria-pressed", state.layers.fires ? "true" : "false");
      renderFireLayer();
    });

    $("#toggleQuakes").addEventListener("click", function () {
      state.layers.quakes = !state.layers.quakes;
      this.classList.toggle("is-on", state.layers.quakes);
      this.setAttribute("aria-pressed", state.layers.quakes ? "true" : "false");
      renderQuakeLayer();
    });

    $("#mapReset").addEventListener("click", function () {
      if (state.tileError) retryTileProviders();
      if (state.map) state.map.fitBounds(CONFIG.map.bounds, { padding: [18, 18] });
    });

    $("#mapBaseSwitch").addEventListener("click", function (event) {
      var button = event.target.closest("[data-base]");
      if (button) setBaseLayer(button.getAttribute("data-base"));
    });

    $("#mapFullscreen").addEventListener("click", toggleMapFullscreen);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    $("#routeClear").addEventListener("click", function () {
      clearRoute(false);
    });

    $("#bannerRetry").addEventListener("click", function () {
      loadAll({ manual: true });
    });
    $("#bannerClose").addEventListener("click", function () {
      state.bannerDismissed = true;
      hideBanner();
    });

    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        hideBanner();
        setMenu(false);
        if (!document.fullscreenElement && isMapFullscreen()) fallbackFullscreen(false);
      }
    });
  }

  function showToast(message) {
    var toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 3000);
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var context = this;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () { fn.apply(context, args); }, wait);
    };
  }
})();
