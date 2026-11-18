/*
 * Adivasi Suraksha — configuration
 * ---------------------------------
 * NASA FIRMS API key lives here. This is a free, rate-limited key intended for
 * map/dashboard use. It is visible to anyone who opens the site, so do not put a
 * paid cloud key in a public frontend. See README.md for deployment notes.
 */
(function (root) {
  "use strict";

  var CONFIG = {
    appName: "Adivasi Suraksha",
    version: "1.0.0",

    firms: {
      key: "06b8b21238895b990cea5cea17509e7c",
      baseUrl: "https://firms.modaps.eosdis.nasa.gov/api/area/csv",
      // west,south,east,north
      bbox: "68,6,98,37",
      days: 2,
      // VIIRS is 375 m; MODIS is 1 km. SNPP is included even though it may be
      // empty during processing delays, so the other feeds keep the site alive.
      sources: ["VIIRS_NOAA20_NRT", "MODIS_NRT", "VIIRS_SNPP_NRT"],
      minModisConfidence: 30,
      maxPoints: 9000
    },

    weather: {
      baseUrl: "https://api.open-meteo.com/v1/forecast",
      timezone: "Asia/Kolkata",
      forecastDays: 4
    },

    quakes: {
      // USGS FDSN event query. feed.js and app.js add format=geojson,
      // minmagnitude, a rolling starttime and the bbox below.
      baseUrl: "https://earthquake.usgs.gov/fdsnws/event/1/query",
      minMagnitude: 4,
      bbox: { minLat: 6, maxLat: 37, minLon: 68, maxLon: 98 },
      maxDistanceKm: 300,
      maxAgeDays: 7
    },

    /*
     * Wider hazards (extra web-only situational awareness).
     *
     * GDACS, NASA EONET and ReliefWeb are not alarm inputs. They add context
     * from outside the district, such as a cyclone farther along the coast or
     * a regional drought. They never change the five-hazard alarm or the LoRa
     * packet.
     *
     * ReliefWeb v1 was decommissioned. v2 requires an approved appname in
     * server-secrets.js (reliefwebAppname) or RELIEFWEB_APPNAME. Without one,
     * that source reports not_configured and the other two still work.
     */
    hazards: {
      radiusKm: 1200,
      maxItems: 6,
      cacheMinutes: 30,
      failureCacheMinutes: 5,
      timeoutMs: 20000,
      gdacs: {
        url: "https://www.gdacs.org/xml/rss.xml",
        maxItems: 6
      },
      eonet: {
        baseUrl: "https://eonet.gsfc.nasa.gov/api/v3/events",
        days: 30,
        maxItems: 6
      },
      reliefweb: {
        baseUrl: "https://api.reliefweb.int/v2/disasters",
        limit: 40,
        maxItems: 3,
        countries: [
          "India", "Pakistan", "Nepal", "Bangladesh", "Bhutan",
          "Sri Lanka", "Myanmar", "Afghanistan", "Maldives"
        ]
      }
    },

    /*
     * ISRO Bhuvan Shortest Path API.
     *
     * The access token is valid for one day only. When it expires, generate a
     * fresh "Routing" token at https://bhuvan-app1.nrsc.gov.in/api/ and replace
     * the value below (or set the BHUVAN_TOKEN environment variable).
     *
     * Bhuvan only routes between two points in the same state, and a few
     * states have no road-network coverage. The server proxy in route.js turns
     * those cases into clear errors.
     */
    bhuvan: {
      key: "ebb45646cdba1701f1e6ee98e7ade0ca76884c9e",
      routingUrl: "https://bhuvan-app1.nrsc.gov.in/api/routing/curl_routing_state.php",
      timeoutMs: 30000
    },

    /*
     * Ambee air quality (server-only key).
     *
     * The private key is NOT in this file. It lives in server-secrets.js,
     * which serve.js refuses to send to a browser, or in AMBEE_KEY. The
     * evaluation plan allows about 100 calls/day, so the server fetches one
     * district at a time and caches the result for an hour. The dailyLimit
     * guard stops the site from using up the whole trial by accident.
     */
    ambee: {
      baseUrl: "https://api.ambeedata.com/latest/by-lat-lng",
      timeoutMs: 15000,
      cacheMinutes: 60,
      failureCacheMinutes: 10,
      dailyLimit: 80
    },

    /*
     * NASA GPM IMERG Early Run daily rainfall (server-only token).
     *
     * The Earthdata token lives in server-secrets.js or EARTHDATA_TOKEN. NASA
     * GES DISC also requires a one-time EULA approval for the account before
     * the token can read data; gpm.js reports that as a clear setup message.
     * This is an extra observed-rainfall reading and does not change the
     * five-hazard alarm or the LoRa packet.
     */
    gpm: {
      provider: "NASA GPM IMERG Early Run",
      dataset: "GPM_3IMERGDE.07",
      collectionConceptId: "C2723754850-GES_DISC",
      cmrUrl: "https://cmr.earthdata.nasa.gov/search/granules.json",
      cloudOpendapBase: "https://opendap.earthdata.nasa.gov",
      approvalUrl: "https://urs.earthdata.nasa.gov/approve_app?client_id=e2WVk8Pw6weeLUKZYOxvTQ",
      timeoutMs: 30000,
      cacheMinutes: 360,
      failureCacheMinutes: 15,
      // Half-width of the district sample box in 0.1-degree IMERG cells.
      boxCells: 2
    },

    // Alerts describe conditions near the district centre, in this radius.
    fireRadiusKm: 40,
    refreshMinutes: 10,
    cacheKey: "adivasi-suraksha-cache-v1",
    cacheMaxAgeHours: 24,

    thresholds: {
      fire: { watch: 1, warning: 5, severe: 12 },
      rain: { watch: 40, warning: 80, severe: 120 },
      heat: {
        plains: { watch: 40, warning: 43, severe: 46 },
        hills: { watch: 30, warning: 33, severe: 36 }
      },
      wind: { watch: 50, warning: 70, severe: 90 },
      // US EPA AQI bands. Ambee returns the same AQI standard by default.
      air: { watch: 101, warning: 151, severe: 201 },
      quake: {
        watchMag: 5.0,
        watchDist: 300,
        warningMag: 5.5,
        warningDist: 300,
        severeMag: 6.5,
        severeDist: 600,
        smallMag: 4.5,
        smallDist: 150
      }
    },

    map: {
      center: [22.6, 80.8],
      zoom: 4,
      // Tried in order. If a provider is blocked or unreachable, the map
      // switches to the next one automatically. All need no API key.
      //
      // OSM's official tile server now returns "403 Access blocked" for apps
      // that do not meet its tile policy (including some file:// and embedded
      // previews), so Esri is the primary basemap and OSM France is the
      // community fallback.
      tileProviders: [
        {
          id: "esri",
          name: "Esri World Street Map",
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
          attribution: 'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> — Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, and the GIS User Community',
          maxZoom: 19
        },
        {
          id: "osm-fr",
          name: "OpenStreetMap France",
          url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, tiles by <a href="https://openstreetmap.fr/" target="_blank" rel="noopener">OSM France</a>',
          maxZoom: 19,
          subdomains: "abc"
        }
      ],
      // Esri World Imagery is a free, no-key satellite basemap. If it fails,
      // the map returns to the street basemap with a short message.
      satelliteProviders: [
        {
          id: "esri-imagery",
          name: "Esri World Imagery",
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          attribution: 'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> — Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, Aerogrid, IGN, IGP, and the GIS User Community',
          maxZoom: 19
        }
      ],
      bounds: [[6.5, 68], [35.5, 97.5]]
    }
  };

  /*
   * 30 tribal-majority or high-tribal-population districts, spread across
   * central India, the North-East, the Nilgiris and the Himalaya.
   * Coordinates are district headquarters / district centres, rounded.
   */
  CONFIG.regions = [
    { id: "bastar",        name: { en: "Bastar",             hi: "बस्तर" },            state: { en: "Chhattisgarh",     hi: "छत्तीसगढ़" },      lat: 19.08, lon: 82.03 },
    { id: "dantewada",     name: { en: "Dantewada",          hi: "दंतेवाड़ा" },         state: { en: "Chhattisgarh",     hi: "छत्तीसगढ़" },      lat: 18.90, lon: 81.35 },
    { id: "jhabua",        name: { en: "Jhabua",             hi: "झाबुआ" },             state: { en: "Madhya Pradesh",   hi: "मध्य प्रदेश" },    lat: 22.77, lon: 74.59 },
    { id: "dindori",       name: { en: "Dindori",            hi: "डिंडोरी" },           state: { en: "Madhya Pradesh",   hi: "मध्य प्रदेश" },    lat: 22.94, lon: 81.08 },
    { id: "alirajpur",     name: { en: "Alirajpur",          hi: "अलीराजपुर" },         state: { en: "Madhya Pradesh",   hi: "मध्य प्रदेश" },    lat: 22.30, lon: 74.35 },
    { id: "khunti",        name: { en: "Khunti",             hi: "खूंटी" },             state: { en: "Jharkhand",        hi: "झारखंड" },         lat: 23.07, lon: 85.28 },
    { id: "gumla",         name: { en: "Gumla",              hi: "गुमला" },             state: { en: "Jharkhand",        hi: "झारखंड" },         lat: 23.04, lon: 84.54 },
    { id: "west-singhbhum",name: { en: "West Singhbhum",     hi: "पश्चिमी सिंहभूम" },   state: { en: "Jharkhand",        hi: "झारखंड" },         lat: 22.55, lon: 85.80 },
    { id: "koraput",       name: { en: "Koraput",            hi: "कोरापुट" },           state: { en: "Odisha",           hi: "ओडिशा" },          lat: 18.81, lon: 82.71 },
    { id: "malkangiri",    name: { en: "Malkangiri",         hi: "मलकानगिरी" },         state: { en: "Odisha",           hi: "ओडिशा" },          lat: 18.35, lon: 81.89 },
    { id: "kandhamal",     name: { en: "Kandhamal",          hi: "कंधमाल" },            state: { en: "Odisha",           hi: "ओडिशा" },          lat: 20.47, lon: 84.23 },
    { id: "mayurbhanj",    name: { en: "Mayurbhanj",         hi: "मयूरभंज" },           state: { en: "Odisha",           hi: "ओडिशा" },          lat: 21.94, lon: 86.73 },
    { id: "gadchiroli",    name: { en: "Gadchiroli",         hi: "गढ़चिरौली" },         state: { en: "Maharashtra",      hi: "महाराष्ट्र" },     lat: 20.18, lon: 80.00 },
    { id: "nandurbar",     name: { en: "Nandurbar",          hi: "नंदुरबार" },          state: { en: "Maharashtra",      hi: "महाराष्ट्र" },     lat: 21.37, lon: 74.24 },
    { id: "dahod",         name: { en: "Dahod",              hi: "दाहोद" },             state: { en: "Gujarat",          hi: "गुजरात" },         lat: 22.83, lon: 74.25 },
    { id: "banswara",      name: { en: "Banswara",           hi: "बांसवाड़ा" },         state: { en: "Rajasthan",        hi: "राजस्थान" },       lat: 23.55, lon: 74.44 },
    { id: "paderu",        name: { en: "Paderu (ASR)",       hi: "पादेरु (ASR)" },      state: { en: "Andhra Pradesh",   hi: "आंध्र प्रदेश" },   lat: 18.08, lon: 82.67 },
    { id: "bhadrachalam",  name: { en: "Bhadrachalam",       hi: "भद्राचलम" },          state: { en: "Telangana",        hi: "तेलंगाना" },       lat: 17.67, lon: 80.89 },
    { id: "karbi-anglong", name: { en: "Karbi Anglong",      hi: "कार्बी आंगलोंग" },    state: { en: "Assam",            hi: "असम" },            lat: 25.83, lon: 93.43 },
    { id: "dima-hasao",    name: { en: "Dima Hasao",         hi: "दिमा हसाओ" },         state: { en: "Assam",            hi: "असम" },            lat: 25.17, lon: 93.02 },
    { id: "west-garo-hills",name:{ en: "West Garo Hills",    hi: "पश्चिमी गारो पहाड़ियाँ" }, state: { en: "Meghalaya",   hi: "मेघालय" },         lat: 25.51, lon: 90.22 },
    { id: "mon",           name: { en: "Mon",                hi: "मोन" },               state: { en: "Nagaland",         hi: "नागालैंड" },       lat: 26.75, lon: 94.83 },
    { id: "tamenglong",    name: { en: "Tamenglong",         hi: "तामेंगलोंग" },        state: { en: "Manipur",          hi: "मणिपुर" },         lat: 24.98, lon: 93.50 },
    { id: "lunglei",       name: { en: "Lunglei",            hi: "लुंगलेई" },            state: { en: "Mizoram",          hi: "मिज़ोरम" },        lat: 22.89, lon: 92.73 },
    { id: "dhalai",        name: { en: "Dhalai",             hi: "धलाई" },              state: { en: "Tripura",          hi: "त्रिपुरा" },       lat: 23.94, lon: 91.85 },
    { id: "tirap",         name: { en: "Tirap",              hi: "तिरप" },              state: { en: "Arunachal Pradesh",hi: "अरुणाचल प्रदेश" }, lat: 27.02, lon: 95.48 },
    { id: "wayanad",       name: { en: "Wayanad",            hi: "वायनाड" },            state: { en: "Kerala",           hi: "केरल" },           lat: 11.61, lon: 76.08 },
    { id: "nilgiris",      name: { en: "Nilgiris",           hi: "नीलगिरि" },           state: { en: "Tamil Nadu",       hi: "तमिलनाडु" },       lat: 11.41, lon: 76.70 },
    { id: "kinnaur",       name: { en: "Kinnaur",            hi: "किन्नौर" },           state: { en: "Himachal Pradesh", hi: "हिमाचल प्रदेश" },  lat: 31.54, lon: 78.27 },
    { id: "pithoragarh",   name: { en: "Pithoragarh",        hi: "पिथौरागढ़" },         state: { en: "Uttarakhand",      hi: "उत्तराखंड" },      lat: 29.58, lon: 80.22 }
  ];

  // A quick lookup used by the UI and tests.
  CONFIG.regionById = {};
  CONFIG.regions.forEach(function (region) {
    CONFIG.regionById[region.id] = region;
  });

  /*
   * Coverage model.
   *
   * The 30 tribal districts are the primary focus: they hold LoRa packet
   * indexes 01-30, they drive the national summary and the village receiver,
   * and they are always listed first. The extra cities are monitored on the
   * web dashboard only, so a nearby city can be checked without diluting the
   * tribal early-warning signal.
   */
  CONFIG.regions.forEach(function (region) { region.tier = "tribal"; });

  CONFIG.cities = [
    { id: "hyderabad",     name: { en: "Hyderabad",     hi: "हैदराबाद" },      state: { en: "Telangana",         hi: "तेलंगाना" },        lat: 17.385, lon: 78.487 },
    { id: "warangal",      name: { en: "Warangal",      hi: "वरंगल" },         state: { en: "Telangana",         hi: "तेलंगाना" },        lat: 17.968, lon: 79.594 },
    { id: "visakhapatnam", name: { en: "Visakhapatnam", hi: "विशाखापत्तनम" },  state: { en: "Andhra Pradesh",    hi: "आंध्र प्रदेश" },   lat: 17.687, lon: 83.219 },
    { id: "vijayawada",    name: { en: "Vijayawada",    hi: "विजयवाड़ा" },     state: { en: "Andhra Pradesh",    hi: "आंध्र प्रदेश" },   lat: 16.507, lon: 80.648 },
    { id: "raipur",        name: { en: "Raipur",        hi: "रायपुर" },        state: { en: "Chhattisgarh",      hi: "छत्तीसगढ़" },      lat: 21.251, lon: 81.630 },
    { id: "bhubaneswar",   name: { en: "Bhubaneswar",   hi: "भुवनेश्वर" },     state: { en: "Odisha",            hi: "ओडिशा" },          lat: 20.296, lon: 85.825 },
    { id: "cuttack",       name: { en: "Cuttack",       hi: "कटक" },           state: { en: "Odisha",            hi: "ओडिशा" },          lat: 20.463, lon: 85.883 },
    { id: "ranchi",        name: { en: "Ranchi",        hi: "राँची" },         state: { en: "Jharkhand",         hi: "झारखंड" },         lat: 23.344, lon: 85.310 },
    { id: "jamshedpur",    name: { en: "Jamshedpur",    hi: "जमशेदपुर" },      state: { en: "Jharkhand",         hi: "झारखंड" },         lat: 22.804, lon: 86.203 },
    { id: "kolkata",       name: { en: "Kolkata",       hi: "कोलकाता" },       state: { en: "West Bengal",       hi: "पश्चिम बंगाल" },   lat: 22.573, lon: 88.364 },
    { id: "siliguri",      name: { en: "Siliguri",      hi: "सिलीगुड़ी" },     state: { en: "West Bengal",       hi: "पश्चिम बंगाल" },   lat: 26.727, lon: 88.395 },
    { id: "guwahati",      name: { en: "Guwahati",      hi: "गुवाहाटी" },      state: { en: "Assam",             hi: "असम" },            lat: 26.145, lon: 91.736 },
    { id: "silchar",       name: { en: "Silchar",       hi: "सिलचर" },         state: { en: "Assam",             hi: "असम" },            lat: 24.833, lon: 92.778 },
    { id: "shillong",      name: { en: "Shillong",      hi: "शिलांग" },        state: { en: "Meghalaya",         hi: "मेघालय" },         lat: 25.579, lon: 91.883 },
    { id: "imphal",        name: { en: "Imphal",        hi: "इंफाल" },         state: { en: "Manipur",           hi: "मणिपुर" },         lat: 24.817, lon: 93.937 },
    { id: "aizawl",        name: { en: "Aizawl",        hi: "आइजोल" },         state: { en: "Mizoram",           hi: "मिज़ोरम" },        lat: 23.727, lon: 92.718 },
    { id: "agartala",      name: { en: "Agartala",      hi: "अगरतला" },        state: { en: "Tripura",           hi: "त्रिपुरा" },       lat: 23.831, lon: 91.286 },
    { id: "itanagar",      name: { en: "Itanagar",      hi: "ईटानगर" },        state: { en: "Arunachal Pradesh", hi: "अरुणाचल प्रदेश" }, lat: 27.084, lon: 93.605 },
    { id: "kohima",        name: { en: "Kohima",        hi: "कोहिमा" },        state: { en: "Nagaland",          hi: "नागालैंड" },       lat: 25.675, lon: 94.108 },
    { id: "gangtok",       name: { en: "Gangtok",       hi: "गंगटोक" },        state: { en: "Sikkim",            hi: "सिक्किम" },        lat: 27.339, lon: 88.606 },
    { id: "nagpur",        name: { en: "Nagpur",        hi: "नागपुर" },        state: { en: "Maharashtra",       hi: "महाराष्ट्र" },     lat: 21.146, lon: 79.088 },
    { id: "mumbai",        name: { en: "Mumbai",        hi: "मुंबई" },         state: { en: "Maharashtra",       hi: "महाराष्ट्र" },     lat: 19.076, lon: 72.877 },
    { id: "pune",          name: { en: "Pune",          hi: "पुणे" },          state: { en: "Maharashtra",       hi: "महाराष्ट्र" },     lat: 18.520, lon: 73.856 },
    { id: "ahmedabad",     name: { en: "Ahmedabad",     hi: "अहमदाबाद" },      state: { en: "Gujarat",           hi: "गुजरात" },         lat: 23.023, lon: 72.571 },
    { id: "surat",         name: { en: "Surat",         hi: "सूरत" },          state: { en: "Gujarat",           hi: "गुजरात" },         lat: 21.170, lon: 72.831 },
    { id: "jaipur",        name: { en: "Jaipur",        hi: "जयपुर" },         state: { en: "Rajasthan",         hi: "राजस्थान" },       lat: 26.912, lon: 75.787 },
    { id: "bhopal",        name: { en: "Bhopal",        hi: "भोपाल" },         state: { en: "Madhya Pradesh",    hi: "मध्य प्रदेश" },    lat: 23.259, lon: 77.413 },
    { id: "patna",         name: { en: "Patna",         hi: "पटना" },          state: { en: "Bihar",             hi: "बिहार" },          lat: 25.594, lon: 85.137 },
    { id: "delhi",         name: { en: "Delhi",         hi: "दिल्ली" },        state: { en: "Delhi",             hi: "दिल्ली" },         lat: 28.614, lon: 77.209 },
    { id: "chennai",       name: { en: "Chennai",       hi: "चेन्नई" },        state: { en: "Tamil Nadu",        hi: "तमिलनाडु" },       lat: 13.083, lon: 80.271 },
    { id: "bengaluru",     name: { en: "Bengaluru",     hi: "बेंगलुरु" },      state: { en: "Karnataka",         hi: "कर्नाटक" },        lat: 12.972, lon: 77.594 },
    { id: "kochi",         name: { en: "Kochi",         hi: "कोच्चि" },        state: { en: "Kerala",            hi: "केरल" },           lat: 9.931,  lon: 76.267 }
  ];
  CONFIG.cities.forEach(function (city) { city.tier = "city"; });

  // Tribal districts first, then cities. The browser computes alerts for all
  // places; the device feed keeps using CONFIG.regions only.
  CONFIG.places = CONFIG.regions.concat(CONFIG.cities);
  CONFIG.placeById = {};
  CONFIG.places.forEach(function (place) {
    CONFIG.placeById[place.id] = place;
  });

  root.APP_CONFIG = CONFIG;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = CONFIG;
  }
})(typeof window !== "undefined" ? window : globalThis);
