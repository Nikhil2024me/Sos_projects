/*
 * Dev utility: fetch the same live feeds the website uses and print what the
 * alert engine produces. Run with: node test/live-check.js
 */
const CONFIG = require("../config.js");
const Logic = require("../logic.js");

function weatherUrl() {
  const p = new URLSearchParams();
  p.set("latitude", CONFIG.regions.map((r) => r.lat).join(","));
  p.set("longitude", CONFIG.regions.map((r) => r.lon).join(","));
  p.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m");
  p.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max");
  p.set("timezone", CONFIG.weather.timezone);
  p.set("forecast_days", String(CONFIG.weather.forecastDays));
  return CONFIG.weather.baseUrl + "?" + p.toString();
}

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status + " " + url);
  return res.text();
}
async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status + " " + url);
  return res.json();
}

(async () => {
  const firmsUrls = CONFIG.firms.sources.map(
    (source) =>
      `${CONFIG.firms.baseUrl}/${CONFIG.firms.key}/${source}/${CONFIG.firms.bbox}/${CONFIG.firms.days}`
  );

  const [firmsResults, weatherResult, quakeResult] = await Promise.all([
    Promise.allSettled(firmsUrls.map(getText)),
    Promise.allSettled([getJson(weatherUrl())]),
    Promise.allSettled([getJson(Logic.quakeFeedUrl(CONFIG))])
  ]);

  let fires = [];
  firmsResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      const parsed = Logic.parseFirmsCsv(result.value, CONFIG.firms.sources[i], {
        minModisConfidence: CONFIG.firms.minModisConfidence
      });
      console.log(`FIRMS ${CONFIG.firms.sources[i]}: ${parsed.length} usable detections`);
      fires = fires.concat(parsed);
    } else {
      console.log(`FIRMS ${CONFIG.firms.sources[i]}: FAILED`);
    }
  });
  fires.sort((a, b) => b.ts - a.ts);
  console.log(`Total fires: ${fires.length}`);

  let weatherById = {};
  if (weatherResult[0].status === "fulfilled") {
    weatherById = Logic.normalizeWeatherJson(weatherResult[0].value, CONFIG.regions);
    console.log(`Weather: ${Object.keys(weatherById).length}/${CONFIG.regions.length} districts`);
  } else {
    console.log("Weather: FAILED");
  }

  let quakes = [];
  if (quakeResult[0].status === "fulfilled") {
    quakes = Logic.parseQuakesGeoJson(quakeResult[0].value, CONFIG.quakes.bbox);
    console.log(`Earthquakes in bbox: ${quakes.length}`);
  } else {
    console.log("Earthquakes: FAILED");
  }

  const snapshot = Logic.buildSnapshot(CONFIG, CONFIG.regions, fires, quakes, weatherById, Date.now());
  const summary = Logic.countHazards(snapshot.regions);
  console.log("\nSUMMARY", JSON.stringify(summary, null, 2));

  if (snapshot.latestFire) {
    console.log("Latest fire:", new Date(snapshot.latestFire).toISOString());
  }

  console.log("\nDISTRICTS WITH SIGNALS");
  Logic.sortRegions(snapshot.regions).forEach((region) => {
    if (!region.alerts.length) return;
    console.log(`\n${region.name.en} (${region.state.en}) — ${region.severity}`);
    region.alerts.forEach((a) => {
      console.log(`  ${a.severity.padEnd(7)} ${a.type}: ${JSON.stringify(a.data)}`);
    });
    const w = region.weather;
    if (w) {
      console.log("  days:", Logic.weatherWindow(w, Date.now(), 3, CONFIG.weather.timezone).map((d) => `${d.date} rain=${d.precip} max=${d.tmax} gust=${d.gust} code=${d.code}`).join(" | "));
    }
  });

  const clear = snapshot.regions.filter((r) => !r.alerts.length);
  console.log(`\nClear districts: ${clear.length}/${snapshot.regions.length}`);
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
