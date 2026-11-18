# Adivasi Suraksha (आदिवासी सुरक्षा)

**Disaster early warning for tribal India — a warning for the last village.**

A multilingual (English, Hindi and 10 regional languages) [Next.js](https://nextjs.org/) web app that turns live satellite, weather and earthquake data into simple, local warnings for 30 tribal-majority districts of India. It runs on Node.js in development (`next dev`) and deploys to Cloudflare with the [OpenNext](https://opennext.js.org/cloudflare) adapter.

This is a student project about disaster resilience. It is **not** an official government warning service. In an emergency, call **112**.

---

## What the site does

- Shows a live map of satellite fire detections, earthquake epicentres and district alert levels.
- Switches between **street and satellite** map views, with a **fullscreen** button for a village projector or large screen.
- Draws a **Bhuvan (ISRO) shortest road route** from the user’s location to the selected district, when the start and end are in the same state.
- Calculates **Forest fire, Heavy rain/flood, Heatwave, Storm/lightning and Earthquake** signals for 30 tribal districts, with **32 nearby cities** monitored as a secondary layer.
- Keeps **tribal villages first**: they drive the national summary, the LoRa packet and the default view, while cities are one tap away in the **Cities** scope.
- Adds an **Ambee air-quality reading (AQI and PM2.5)** for the selected district, clearly marked as extra information and not part of the alarm.
- Adds a **NASA GPM IMERG satellite-rainfall reading** for the latest completed day, also marked as extra information for the web dashboard only.
- Adds a **Wider hazards** card with extra context from **GDACS**, **NASA EONET** and **ReliefWeb**. These are situational-awareness feeds only: they never change the alarm or the LoRa packet.
- Explains every alert in plain language, with immediate “do this now” steps.
- Provides 3-day local forecasts, safety guides, emergency helplines, WhatsApp sharing and a printable village notice.
- Works in **English, Hindi and 10 regional languages** (Bengali, Marathi, Odia, Telugu, Tamil, Gujarati, Kannada, Malayalam, Assamese and Punjabi), remembers the chosen language, and caches the last good data for up to 24 hours.
- Finds the nearest covered district using the browser’s location (with permission).
- Refreshes automatically every 10 minutes; no login, cookies, ads or trackers.
- Exposes a **21–22-byte LoRa packet** and a JSON feed for an ESP32 gateway, so a village with no internet can receive the alert over radio. An optional sixth digit carries air quality.

### Districts covered (30)

Central India: Bastar, Dantewada, Jhabua, Dindori, Alirajpur, Khunti, Gumla, West Singhbhum, Koraput, Malkangiri, Kandhamal, Mayurbhanj, Gadchiroli, Nandurbar, Dahod, Banswara, Paderu (ASR), Bhadrachalam.

North-East: Karbi Anglong, Dima Hasao, West Garo Hills, Mon, Tamenglong, Lunglei, Dhalai, Tirap.

South and Himalaya: Wayanad, Nilgiris, Kinnaur, Pithoragarh.

Alerts are calculated around each **district centre**, within a 40 km radius. This keeps the data honest: a fire in a neighbouring district is not reported as if it were in your village.

### Cities (secondary coverage)

The dashboard also monitors **32 cities** for the same five hazards — Hyderabad, Warangal, Visakhapatnam, Vijayawada, Raipur, Bhubaneswar, Cuttack, Ranchi, Jamshedpur, Kolkata, Siliguri, Guwahati, Silchar, Shillong, Imphal, Aizawl, Agartala, Itanagar, Kohima, Gangtok, Nagpur, Mumbai, Pune, Ahmedabad, Surat, Jaipur, Bhopal, Patna, Delhi, Chennai, Bengaluru and Kochi.

Cities are deliberately **secondary**:

- the national summary, hazard statistics and the default district list cover the **30 tribal districts** only;
- the **Cities** and **All places** scopes in the alerts section reveal the cities, each tagged with a `City` badge (tribal districts show a `Tribal` badge in the All view);
- city map markers are smaller and never pulse;
- the **LoRa packet and the ESP32 feed stay tribal-only** — a city is never sent over the radio link.

---

## Quick start

1. Install [Node.js](https://nodejs.org/) 20.9 or newer.
2. Install dependencies and start the Next.js dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open **http://localhost:3000**.

`npm run dev` copies the browser assets (`config.js`, `app.js`, `styles.css`,
`vendor/leaflet/…`) into `public/` first — see `scripts/sync-public.mjs`. The
source of truth for those files is still the repository root.

Optional secrets (only needed for the four server-side features) go in
`.env.local`:

```
AMBEE_KEY=...            # /api/air   (air quality)
EARTHDATA_TOKEN=...      # /api/gpm   (NASA GPM rainfall)
RELIEFWEB_APPNAME=...    # /api/hazards (ReliefWeb v2)
BHUVAN_TOKEN=...         # /api/route (optional; also in config.js)
```

Without them the dashboard still works; the affected cards simply report
"not configured".

### ESP32 / LoRa device feed (optional)

`serve.js` is kept for the LAN device feed. On a machine the gateway can reach:

```bash
node serve.js 5173
```

It prints a LAN address such as:

```
Device feed (use from the ESP32 on the same Wi-Fi):
  http://192.168.1.5:5173/api/lora?district=bastar
```

The Next.js API serves the same endpoints (`/api/lora`, `/api/alerts`,
`/api/health`, …) on port 3000, so `serve.js` is only needed if you want the
radio feed on a separate, LAN-only process.

### Deploying to Cloudflare (Workers, via git)

The app deploys with the [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare)
(Cloudflare Pages' `next-on-pages` adapter is deprecated and does not support
Next.js 16).

- **Config:** `wrangler.jsonc` (Worker name `adivasi-suraksha`, `nodejs_compat`,
  static assets bound to `ASSETS`) and `open-next.config.ts`.
- **Build command:** `npm run build` (runs the asset sync, then `next build`).
- **Deploy:** `npm run deploy` (builds and publishes), or connect the repository
  in the Cloudflare dashboard (Workers → Builds) and deploy the `ADWS-WEB`
  branch automatically.
- **Preview locally in the Workers runtime:** `npm run preview`.
- **Secrets:** set `AMBEE_KEY`, `EARTHDATA_TOKEN`, `RELIEFWEB_APPNAME` and
  `BHUVAN_TOKEN` in the Cloudflare project settings (or `wrangler secret put`);
  they are read from the environment at runtime. Never commit `.env.local` /
  `.dev.vars`.

For a plain static host (no server features), `next build` with
`output: 'export'` would be needed; the default build keeps the API routes.

---

## ESP32 / LoRa village link

The website is the dashboard; the radio link is for the village. `serve.js` turns the same live alerts into a compact packet:

```
AS1,18,2,20000,162006                 five disaster hazards
AS2,18,2,200002,171230                same, plus one air-quality digit
 |   |  |  ||||| |  |
 |   |  |  ||||| |  +-- time DDHHMM IST
 |   |  |  ||||| +----- air quality 0-3 (AS2 only; extra information)
 |   |  |  |||||------- fire, rain, wind, heat, quake severity (0-3)
 |   |  +-------------- overall alarm severity (0 safe, 1 watch, 2 warning, 3 severe)
 |   +----------------- district index (1-30)
 +--------------------- protocol version
```

The packet is at most 22 bytes, so it fits a single LoRa frame. **AS1** is used when no Ambee reading is available; **AS2** adds the air digit. The air digit is informational and never raises the overall alarm or sounds the village buzzer. The packet always carries one of the **30 tribal districts** (indexes 01–30); the extra cities are dashboard-only and are never sent over the radio. The data path is:

```
NASA FIRMS / Open-Meteo / USGS / Ambee
        ↓
serve.js on a PC with internet
        ↓ Wi-Fi HTTP (one small line)
gateway ESP32 + SX1278
        ↓ LoRa 433 MHz
village ESP32 + SX1278 → LED / buzzer / serial
```

Endpoints:

| Endpoint | Returns |
| --- | --- |
| `/api/health` | feed readiness, cache age, source status, Ambee quota, GPM status and wider-hazard status |
| `/api/districts` | 30 districts with their packet index |
| `/api/alerts` | all districts, severities and AS1 packets |
| `/api/alerts?district=bastar` | one district with alerts, weather and air; AS1/AS2 packet |
| `/api/lora?district=bastar` | `text/plain` packet for the radio |
| `/api/lora?district=bastar&format=json` | packet plus decoded fields and air summary |
| `/api/air?district=bastar` | cached Ambee air quality for one district |
| `/api/gpm?district=bastar` | cached NASA GPM IMERG rainfall for one district |
| `/api/hazards?district=bastar` | nearby GDACS/EONET events plus South Asia ReliefWeb disasters (extra context, never an alarm input) |
| `/api/route?fromLat=17.385&fromLon=78.487&to=bhadrachalam` | Bhuvan road route as GeoJSON |
| `/api/route?lat1=17.385&lon1=78.487&lat2=17.969&lon2=80.470` | route between two coordinates |

Full wiring, Arduino sketches and troubleshooting are in **[`device/README.md`](device/README.md)**. The sketches are in `device/gateway_esp32/` (Wi-Fi + LoRa transmitter) and `device/village_esp32/` (receiver + LED/buzzer).

### Bhuvan route key

The site uses the **ISRO Bhuvan Shortest Path API** for the “Route from my location” button. The key is in `config.js` under `bhuvan.key`. The server proxy in `route.js` keeps browser CORS out of the way.

Two important limits come from Bhuvan itself:

- **Same state only.** The start and end points must be in the same Indian state. A route from Bastar (Chhattisgarh) to Bhadrachalam (Telangana) is rejected.
- **One-day token.** Bhuvan tokens expire daily. Generate a fresh **Routing** token at <https://bhuvan-app1.nrsc.gov.in/api/> and replace `config.js` → `bhuvan.key`, or set the `BHUVAN_TOKEN` environment variable before starting `serve.js`.
- Some states return an empty geometry even with a valid token. The site reports “Bhuvan has no road route for this district” instead of drawing a broken line.

Like the FIRMS key, `config.js` is served to the browser, so the Bhuvan token is visible in the page source. It is a free, one-day token, so that is acceptable for a class project. For a public deployment, remove `bhuvan.key` from `config.js` and set `BHUVAN_TOKEN` on the server instead; `route.js` checks the environment variable first.

The route is a road reference, not a live traffic or evacuation order. Check local conditions before travelling.

---

## Data sources

| Hazard | Source | Details |
| --- | --- | --- |
| Fire / heat detections | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) | Near-real-time VIIRS NOAA-20 (375 m), MODIS (1 km) and VIIRS SNPP, last 2 days, India bounding box `68,6,98,37` |
| Rain, heat, humidity, wind | [Open-Meteo](https://open-meteo.com/) | Current conditions plus 4-day daily forecast for all 30 district centres in one request |
| Earthquakes | [USGS FDSN event query](https://earthquake.usgs.gov/fdsnws/event/1/query) | `format=geojson&minmagnitude=4`, rolling last 7 days, filtered to the India region |
| Map background | [Esri World Street Map](https://www.esri.com/) | Primary street basemap, with attribution; no API key |
| Satellite background | [Esri World Imagery](https://www.esri.com/) | Satellite view in the map style switch; no API key |
| Map fallback | [OpenStreetMap France](https://openstreetmap.fr/) | Used automatically if Esri street tiles fail |
| Road route | [Bhuvan (ISRO)](https://bhuvan-app1.nrsc.gov.in/api/) | Shortest Path API through the local `route.js` proxy |
| Air quality | [Ambee](https://www.getambee.com/) | Hourly AQI and PM2.5 near the selected district centre, through the local `/api/air` proxy |
| Observed rainfall | [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg) | Early Run daily rainfall (mm/day) sampled around the district centre, through the local `/api/gpm` proxy |
| Wider hazards (nearby) | [GDACS](https://www.gdacs.org/) | Current Orange/Red events plus Green non-wildfire events near the district, through the local `/api/hazards` proxy |
| Wider hazards (events) | [NASA EONET](https://eonet.gsfc.nasa.gov/) | Open natural events (storms, floods, volcanoes, wildfires) with the latest position, distance-filtered |
| Wider hazards (regional) | [ReliefWeb](https://reliefweb.int/) | South Asia humanitarian disasters through API **v2**; needs an approved appname |

The map library is [Leaflet 1.9.4](https://leafletjs.com/), vendored locally so the site does not depend on a CDN. Map tiles still require internet access.

> **Why not the standard OSM tile server?** OpenStreetMap's volunteer tile server now returns a **403 “Access blocked”** tile to apps that do not meet its tile usage policy — including some `file://`, embedded-preview and local-network pages. The site now uses Esri as the primary basemap and OSM France as a fallback, both with visible attribution. If you prefer OSM, serve the site over HTTP with a normal Referer and apply for a tile provider that permits your traffic.

### Languages

The interface ships in **English, Hindi and 10 regional languages**: Bengali (`bn`), Marathi (`mr`), Odia (`or`), Telugu (`te`), Tamil (`ta`), Gujarati (`gu`), Kannada (`kn`), Malayalam (`ml`), Assamese (`as`) and Punjabi (`pa`). The switcher is a compact language selector in the header; the choice is remembered in `localStorage`.

- `i18n.js` holds the complete English and Hindi dictionaries and the resolver.
- `i18n.langs.js` holds one partial pack per regional language plus local **district and state names**.
- Missing strings **fall back to Hindi, then English**, so a partial pack is safe. The resolver builds one complete dictionary per language at load time, which keeps nested lookups (guides, helplines, methodology) working.
- Place names fall back per district, so a pack can be added incrementally.

**To add or extend a language:** add an entry to `LANGS.meta` and a pack under a matching code in `i18n.langs.js`. Add the district/state names in `LANGS.regionNames` / `LANGS.stateNames`. Then run `node test/i18n-check.js` — it verifies every pack's placeholders, unknown keys and place names.

### Alert thresholds

| Hazard | Watch | Warning | Severe |
| --- | --- | --- | --- |
| Forest fire (detections within 40 km / 24 h) | 1 | 5 | 12 |
| Heavy rain (daily total) | 40 mm | 80 mm | 120 mm |
| Heatwave — plains (daily max) | 40 °C | 43 °C | 46 °C |
| Heatwave — hills ≥ 1000 m (daily max) | 30 °C | 33 °C | 36 °C |
| Storm (wind gusts) | 50 km/h | 70 km/h | 90 km/h |
| Earthquake | M5.0+ within 300 km, or M4.5+ within 150 km | M5.5+ within 300 km | M6.5+ within 600 km |
| Air quality AQI (extra digit) | 101 | 151 | 201 |

The air-quality row is only used to label the extra AS2 digit. It does **not** raise the overall alarm, the LED or the buzzer. The five disaster hazards remain the alarm sources.

Thunderstorm weather codes can also raise a storm watch/warning. The exact rules live in `logic.js`; the threshold table is shown in the site’s “How alerts are calculated” section.

**Important:** a fire alert counts satellite heat detections, not unique fires. One fire can be seen by more than one satellite or over several passes. Cloud cover and satellite overpass timing can hide small fires.

---

## Configuration

Edit **`config.js`**:

- `firms.key` — NASA FIRMS `MAP_KEY`.
- `firms.sources` — satellite feeds, in priority order.
- `firms.bbox`, `firms.days`, `firms.maxPoints` — area and volume controls.
- `thresholds` — watch/warning/severe levels.
- `fireRadiusKm` — district alert radius.
- `refreshMinutes` — auto-refresh interval.
- `cacheMaxAgeHours` — how long saved data may be reused.
- `bhuvan.key` — ISRO Bhuvan Routing token; expires after one day.
- `ambee` — Ambee endpoint, cache minutes and the daily-call guard (80 by default).
- `gpm` — NASA GPM IMERG dataset, CMR/OPeNDAP endpoints, cache minutes and the 5×5 sample box.
- `quakes` — USGS FDSN base URL, `minMagnitude` (4) and the India `bbox` used to build the rolling query.
- `hazards` — wider-hazard sources (GDACS RSS, NASA EONET, ReliefWeb v2), the `radiusKm` distance filter, item limit and cache minutes.
- `thresholds.air` — US EPA AQI bands used only for the extra AS2 air digit.
- `map` — centre, zoom, `tileProviders` (street + fallback), `satelliteProviders`, attribution and bounds.

Translations, guides, helplines and the methodology text are in **`i18n.js`**. Region names and coordinates are in `config.js`.

### NASA FIRMS API key

The key in `config.js` is used directly by the browser, so **anyone who opens the site can see it**. That is acceptable for a free, rate-limited FIRMS `MAP_KEY`, but it is not suitable for a paid or private key.

For a high-traffic public deployment:

1. Put a small serverless proxy in front of FIRMS (Cloudflare Worker, Netlify Function, Vercel Function, etc.).
2. Keep the real key in the server environment, not in the repository.
3. Change `firms.baseUrl` in `config.js` to the proxy URL.
4. Add caching and rate limiting at the proxy.

Never commit paid cloud credentials, and rotate the key if it is abused. A free replacement key can be requested from NASA FIRMS.

### Ambee air-quality key

The Ambee key is **private**, so it is deliberately not in `config.js`. It lives in **`server-secrets.js`**, which `serve.js` refuses to send to a browser (and which `.gitignore` excludes), or in the `AMBEE_KEY` environment variable:

```powershell
$env:AMBEE_KEY = "your-ambee-key"
node serve.js
```

`server-secrets.js` is read only by `ambee.js` on the server. Never import it from `app.js`, and never rename it to a file that the static handler would serve. If the file is missing and `AMBEE_KEY` is not set, the air card shows “Ambee is not configured” and the five-hazard alerts keep working.

The evaluation key allows about **100 calls/day**. To stay inside that limit:

- the server fetches **one district at a time**, only when the page or ESP32 asks for it;
- a successful reading is cached for **60 minutes**;
- a failed reading is cached for 10 minutes;
- the server stops calling Ambee after **80 calls/day** and serves cached data where possible;
- the browser does not request air quality for all 30 districts at once.

The Ambee key is not part of the static deployment. If you upload only the dashboard to GitHub Pages or Netlify, the rest of the site works but `/api/air` will be missing. Run `serve.js` (or an equivalent serverless proxy that keeps the key private) when you want the air card and the AS2 LoRa digit.

Ambee returns a station reading for the district centre, which may be a few kilometres away. Treat it as context, not a measurement from the village itself.

### NASA GPM satellite rainfall

The **NASA GPM IMERG Early Run** adds an observed-rainfall reading for the latest completed UTC day. Like the air reading, it is **extra information**: it does not change the five-hazard alarm, the AS1/AS2 packet or the village buzzer.

The Earthdata token is private and lives in **`server-secrets.js`** as `earthdataToken`, or in the `EARTHDATA_TOKEN` environment variable. It is never written to `config.js` or sent to the browser.

**One-time setup (required):** NASA GES DISC requires the account owner to approve the application before any data can be read:

1. Sign in as the Earthdata user that owns the token.
2. Open <https://urs.earthdata.nasa.gov/approve_app?client_id=e2WVk8Pw6weeLUKZYOxvTQ>, or use **Profile → EULAs** on the Earthdata Login site. If you do not remember the password, use **Forgot Password** on the login page.
3. Approve **NASA GESDISC DATA ARCHIVE**, then press **Try again** on the rainfall card (or restart `serve.js`).

Until that approval is done, `/api/gpm` returns HTTP 403 with `error: "eula_required"` and the approval link, and the dashboard shows a setup card instead of a fake number.

How the proxy works:

- NASA **CMR** finds the newest `GPM_3IMERGDE.07` daily granule.
- NASA's cloud **OPeNDAP** returns only a **5×5 cell** ASCII box (0.1° ≈ 11 km) around the district centre, not the global file.
- The reading is cached for **6 hours**, because IMERG Early Run updates about once a day.
- `available: false` means no valid cells were returned (for example all ocean/fill); it is not treated as zero rain.

The data can lag by roughly a day and represents an area average near the district centre, not a rain gauge in the village. If the cloud OPeNDAP path is unavailable, the five-hazard feed, air card and LoRa packet keep working.

### Wider hazards (GDACS, NASA EONET, ReliefWeb)

The **Wider hazards** card is extra web-only context. It is deliberately **not** an alarm input and is **not** sent in the LoRa packet, so a distant cyclone or a regional drought cannot sound the village buzzer.

- **GDACS RSS** — current Orange/Red events plus Green non-wildfire events (cyclones, floods, drought, volcanoes, earthquakes). Green forest fires are skipped because NASA FIRMS already covers local fires.
- **NASA EONET** — open natural events (storms, floods, volcanoes, wildfires) with their latest position. Events rarely fall inside India, so this source is often empty locally.
- **ReliefWeb** — South Asia humanitarian disasters, shown as regional context with no coordinates.

GDACS and EONET items are distance-filtered with `config.hazards.radiusKm` (1200 km by default). Each source has its own short cache and failure handling, so one failing service does not hide the others.

**ReliefWeb setup:** the v1 API is **decommissioned** (HTTP 410) and v2 requires a pre-approved `appname`. Request one at <https://apidoc.reliefweb.int/parameters#appname>, then put it in `server-secrets.js` as `reliefwebAppname`, or set the `RELIEFWEB_APPNAME` environment variable. Until then, `/api/hazards` reports `reliefweb: not_configured` and GDACS/EONET keep working. The appname is server-only and never appears in `config.js`.

A local, private **`apis.txt`** lists every provider key, endpoint, expiry and quota note. It is blocked by `serve.js` and excluded by `.gitignore`; never upload it or commit it.

---

## Testing

Start the local server first, then run:

```powershell
node test/i18n-check.js      # translation completeness, placeholders, config, SVG references
node test/live-check.js      # live FIRMS / Open-Meteo / USGS request and alert-engine check
node test/api-check.js       # ESP32/LoRa feed: endpoints, AS1/AS2 packets, decoding, size limit
node test/ambee-check.js     # Ambee key, AQI payload, one-hour cache and quota guard
node test/gpm-check.js       # NASA GPM IMERG payload, cache, EULA message and secret block
node test/hazards-check.js   # GDACS/EONET parsers offline, plus /api/hazards when the server is up
node test/route-check.js      # Bhuvan key, route GeoJSON, caching and same-state errors
node test/browser-check.js   # headless Chrome/Edge smoke test, screenshots and interactions
```

`api-check.js` is the device-feed test. It fetches `/api/alerts`, checks all 30 AS1 packets against the alert list, verifies the 51-byte LoRa limit, then checks that a per-district request adds the AS2 air digit when Ambee is available. It writes `test/api-report.json`.

`ambee-check.js` makes only two live air requests. It verifies `/api/air`, the AQI/category/severity fields, the one-hour cache (the second request must not spend another Ambee call), unknown-district errors and the `server-secrets.js` block. It writes `test/ambee-report.json`.

`gpm-check.js` verifies the GPM configuration, the private-file blocks, unknown-district handling, the `/api/gpm` payload and its six-hour cache. If the GES DISC EULA is still pending, it checks the clear `eula_required` response and approval link instead. It writes `test/gpm-report.json` and never prints the Earthdata token.

`hazards-check.js` runs the GDACS RSS and EONET JSON parsers offline against small samples, checks the distance filter and severity mapping, and then (if `serve.js` is running) checks `/api/hazards` for a district, the per-source status block and the 404/400 errors. It writes `test/hazards-report.json`.

`route-check.js` calls the live Bhuvan API through `/api/route`, checks that the returned line starts and ends near the requested places, verifies caching, and tests the readable errors for cross-state requests. It writes `test/route-report.json`. Run it on the day of a demo: if it reports `invalid_token`, refresh the one-day token in `config.js`.

`browser-check.js` needs Chrome or Edge installed. It tests:

- initial load, map tiles, district markers and statistics
- English/Hindi/regional switching, language packs and missing translation keys
- search, hazard filters, layer toggles, tribal/city scopes and district selection
- the Ambee air-quality card in English and Hindi (using a local stub, so the trial quota is not spent)
- the NASA GPM rainfall card in English and Hindi (local stub, no Earthdata call)
- the wider-hazards card in English and Hindi (local GDACS/EONET/ReliefWeb stub, no live calls)
- street/satellite basemap switching and fullscreen enter/exit
- Bhuvan route button presence on a selected district
- copy, WhatsApp share text and printable notice
- geolocation, offline cache fallback and mobile layout
- console errors and uncaught exceptions

Results are written to `test/browser-report.json`; screenshots go to `test/screenshots/`.

The live check can be slow or empty during satellite processing delays. A zero-fire result is valid.

---

## Project structure

```
index.html            Page markup, SVG icon sprite
styles.css            Design system, responsive and print styles
app.js                Browser application: API calls, map, rendering, sharing
config.js             Regions, thresholds, API endpoints and map settings
i18n.js               English and Hindi text, guides, helplines, methodology and the language resolver
i18n.langs.js         Regional language packs (bn, mr, or, te, ta, gu, kn, ml, as, pa) and local place names
logic.js              Pure alert engine and data parsers (also testable in Node)
feed.js               Server-side live feed, caching and AS1/AS2 packet encoder
ambee.js              Server-only Ambee air-quality proxy, cache and quota guard
gpm.js                Server-only NASA GPM IMERG rainfall proxy, cache and EULA message
hazards.js            Server-only GDACS / NASA EONET / ReliefWeb wider-hazard proxy
server-secrets.js     Private Ambee key, Earthdata token and ReliefWeb appname (blocked by serve.js, excluded by .gitignore)
route.js              Bhuvan routing proxy, validation, cache and GeoJSON
serve.js              Zero-dependency site, air, route and device-API server
start.bat             Windows launcher for the local server
favicon.svg           Site icon
vendor/leaflet/       Leaflet 1.9.4 (local copy)
device/               ESP32 gateway + village receiver sketches and wiring guide
test/                 Live, translation, API and browser checks
```

---

## Limitations and safety notes

- This is a **community early-warning aid**, not an official warning. Always follow IMD, NDMA and your district administration.
- Satellite and forecast data can be delayed, incomplete or wrong. Clouds can hide fires; forecasts can change.
- Alerts describe conditions near a district centre, not every village in the district.
- The site needs internet access for live data and map tiles. Cached alerts can still be read offline.
- The LoRa link is a **one-way test link**: the gateway needs Wi-Fi, the village receiver only needs power and radio range. It shows severity, hazard type and time; it does not carry full sentences.
- Air quality is an **extra AS2 digit**, not part of the alarm. It comes from an Ambee station near the district centre, may lag by an hour, and the trial key has a small daily quota.
- NASA GPM rainfall is an **extra web reading only**. It covers the latest completed day, is an area average near the district centre, may lag by about a day, and is not sent in the LoRa packet.
- GDACS, NASA EONET and ReliefWeb are **extra web context only**. They are not alarm inputs, are not sent in the LoRa packet, and ReliefWeb needs an approved appname before it can be read.
- The Bhuvan route is not a live traffic, landslide or flood-avoidance service. It only works inside one state, and the access token expires after one day.
- The device API and route proxy have no login and are meant for a local network. Run them on a trusted PC or school server, not on the open internet.
- There are no push notifications or SMS alerts. Volunteers should share the WhatsApp/print notice through local networks.
- District boundaries and coordinates are approximate and intended for community guidance.

## Credits

Built as a student project for disaster resilience in India’s tribal districts.

- NASA FIRMS — fire and thermal anomaly data
- Open-Meteo — weather forecasts
- USGS Earthquake Hazards Program — earthquake feed (FDSN event query)
- Ambee — air quality index and pollutant readings
- NASA GPM IMERG (GES DISC) — observed daily rainfall
- GDACS / European Commission JRC — global disaster alerts
- NASA EONET — open natural events
- ReliefWeb / UN OCHA — humanitarian disaster context
- Esri — street and satellite map tiles
- ISRO Bhuvan — shortest road route
- OpenStreetMap contributors — map data
- Leaflet — BSD-2-Clause licensed mapping library

Please respect each provider’s attribution and usage policies. OpenStreetMap standard tiles are suitable for low-traffic use; a high-traffic public deployment should use a commercial tile provider or self-host tiles.
