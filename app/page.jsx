/*
 * Adivasi Suraksha - home page markup.
 *
 * This is the original dashboard shell (index.html <body>) expressed as a React
 * component. The element ids are preserved exactly because the legacy client
 * application (app.js, loaded by <LegacyScripts />) drives these nodes directly.
 * See lib/ for shared logic and app/api/ for the ported feed endpoints.
 */
import LegacyScripts from "./legacy-scripts";

export default function Home() {
  return (
    <>
        <a className="skip-link" href="#alerts" data-i18n="skip">Skip to district alerts</a>

        <svg className="svg-sprite" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
          <symbol id="i-fire" viewBox="0 0 24 24">
            <path d="M12 22a6.5 6.5 0 0 0 6.5-6.5c0-3-1.7-5-3.4-6.9C13.6 6.9 12 4.9 12 2c-2.8 2.1-4.2 4.9-4.2 7.5 0 1.5.4 2.7 1.1 3.7-1.1.6-2.4 1.8-2.4 3.6A6.5 6.5 0 0 0 12 22Z"/>
            <path d="M12 22a3 3 0 0 0 3-3c0-1.6-1-2.7-2-3.8-.4-.4-.8-.9-1-1.4-1 1.1-2.1 2.4-2.1 4A3 3 0 0 0 12 22Z"/>
          </symbol>
          <symbol id="i-rain" viewBox="0 0 24 24">
            <path d="M6.5 15a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 17.5 8a4 4 0 0 1 .5 8H6.5Z"/>
            <path d="M8 18.5 7 21M12 18.5 11 21M16 18.5 15 21"/>
          </symbol>
          <symbol id="i-heat" viewBox="0 0 24 24">
            <path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z"/>
            <path d="M12 9v7"/>
          </symbol>
          <symbol id="i-wind" viewBox="0 0 24 24">
            <path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/>
          </symbol>
          <symbol id="i-quake" viewBox="0 0 24 24">
            <path d="M2 12h4l3-8 4 16 3-8h6"/>
          </symbol>
          <symbol id="i-air" viewBox="0 0 24 24">
            <path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/>
            <circle cx="5" cy="5" r=".7" fill="currentColor" stroke="none"/>
            <circle cx="19" cy="19" r=".7" fill="currentColor" stroke="none"/>
          </symbol>
          <symbol id="i-alert" viewBox="0 0 24 24">
            <path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/>
            <path d="M12 9v4M12 17h.01"/>
          </symbol>
          <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
          <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
          <symbol id="i-shield" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
            <path d="m9 12 2 2 4-4"/>
          </symbol>
          <symbol id="i-pin" viewBox="0 0 24 24">
            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/>
            <circle cx="12" cy="10" r="2.5"/>
          </symbol>
          <symbol id="i-phone" viewBox="0 0 24 24">
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>
          </symbol>
          <symbol id="i-share" viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>
          </symbol>
          <symbol id="i-copy" viewBox="0 0 24 24">
            <rect x="9" y="9" width="12" height="12" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </symbol>
          <symbol id="i-print" viewBox="0 0 24 24">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8" rx="1"/>
          </symbol>
          <symbol id="i-refresh" viewBox="0 0 24 24">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>
          </symbol>
          <symbol id="i-search" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.4-4.4"/>
          </symbol>
          <symbol id="i-locate" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2.5"/>
          </symbol>
          <symbol id="i-chevron" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
          <symbol id="i-sun" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
          </symbol>
          <symbol id="i-partly" viewBox="0 0 24 24">
            <circle cx="8" cy="8" r="3"/>
            <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>
            <path d="M8.5 20a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.5A3.5 3.5 0 0 1 18 20H8.5Z"/>
          </symbol>
          <symbol id="i-cloud" viewBox="0 0 24 24">
            <path d="M6.5 19a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 17.5 12a4 4 0 0 1 .5 7H6.5Z"/>
          </symbol>
          <symbol id="i-fog" viewBox="0 0 24 24">
            <path d="M6.5 15a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 17.5 8a4 4 0 0 1 .5 7H6.5Z"/>
            <path d="M4 19h16M7 22h10"/>
          </symbol>
          <symbol id="i-snow" viewBox="0 0 24 24">
            <path d="M6.5 14a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 17.5 7a4 4 0 0 1 .5 7H6.5Z"/>
            <path d="M8 18v4M6.3 19l3.4 2M9.7 19l-3.4 2M16 18v4M14.3 19l3.4 2M17.7 19l-3.4 2"/>
          </symbol>
          <symbol id="i-storm" viewBox="0 0 24 24">
            <path d="M6.5 15a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 17.5 8a4 4 0 0 1 .5 7H6.5Z"/>
            <path d="m13 13-3 5h4l-3 5"/>
          </symbol>
          <symbol id="i-clock" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
          </symbol>
          <symbol id="i-signal" viewBox="0 0 24 24">
            <path d="M2 20h.01M7 20a5 5 0 0 0-5-5M12 20a10 10 0 0 0-10-10"/>
          </symbol>
          <symbol id="i-info" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>
          </symbol>
          <symbol id="i-external" viewBox="0 0 24 24">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <path d="M15 3h6v6M10 14 21 3"/>
          </symbol>
          <symbol id="i-chat" viewBox="0 0 24 24">
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/>
          </symbol>
          <symbol id="i-wifi-off" viewBox="0 0 24 24">
            <path d="M1 1l22 22M16.7 16.7A6 6 0 0 0 12 15M5 12.5a10 10 0 0 1 4-2.3M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-9.8-2.7M8.5 16.4a5 5 0 0 1 5.3-.6M12 20h.01"/>
          </symbol>
          <symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
          <symbol id="i-layers" viewBox="0 0 24 24">
            <path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>
          </symbol>
          <symbol id="i-expand" viewBox="0 0 24 24">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>
          </symbol>
          <symbol id="i-compress" viewBox="0 0 24 24">
            <path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M8 21v-3a2 2 0 0 0-2-2H3M16 21v-3a2 2 0 0 1 2-2h3"/>
          </symbol>
          <symbol id="i-route" viewBox="0 0 24 24">
            <circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/>
            <path d="M8.5 19H14a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h2M15.5 5H10"/>
          </symbol>
          <symbol id="i-menu" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></symbol>
        </svg>

        <header className="site-header" id="top">
          <div className="wrap header-inner">
            <a className="brand" href="#top" aria-label="Adivasi Suraksha">
              <span className="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 48 48">
                  <path d="M24 3 43 9.5v13.2C43 34.6 34.7 42.4 24 45 13.3 42.4 5 34.6 5 22.7V9.5L24 3Z" fill="currentColor"/>
                  <path d="M24 11.5c4.7 4.4 8.4 7.6 8.4 13a8.4 8.4 0 1 1-16.8 0c0-3.7 2.3-6.2 4.4-8.1.1 2.5 1.2 3.8 3.1 4.8-.3-4-1-6.3.9-9.7Z" fill="#f8f1df"/>
                </svg>
              </span>
              <span className="brand-text">
                <span className="brand-name" data-i18n="appName">Adivasi Suraksha</span>
                <span className="brand-tag" data-i18n="tagline">Disaster early warning for tribal India</span>
              </span>
            </a>

            <nav className="site-nav" id="siteNav" aria-label="Sections" data-i18n-aria="nav.label">
              <a href="#alerts" data-i18n="nav.alerts">Alerts</a>
              <a href="#mapCard" data-i18n="nav.map">Map</a>
              <a href="#guides" data-i18n="nav.guides">Safety</a>
              <a href="#helplines" data-i18n="nav.help">Helplines</a>
            </nav>

            <div className="header-actions">
              <span className="live-pill" id="livePill"><span className="live-dot"></span><span id="liveLabel" data-i18n="header.live">Live</span></span>
              <div className="lang-toggle" id="langToggle" role="group" aria-label="Language" data-i18n-aria="header.language">
                <select className="lang-select" id="langSelect" aria-label="Language"></select>
              </div>
              <button type="button" className="icon-btn refresh-btn" id="refreshBtn" aria-label="Refresh live data" data-i18n-aria="header.refreshTitle" title="Refresh live data" data-i18n-title="header.refreshTitle">
                <svg className="icon"><use href="#i-refresh"/></svg>
              </button>
              <button type="button" className="icon-btn menu-btn" id="menuBtn" aria-expanded="false" aria-controls="siteNav" aria-label="Menu" data-i18n-aria="header.menu">
                <svg className="icon"><use href="#i-menu"/></svg>
              </button>
            </div>
          </div>
          <div className="progress" id="progressBar" hidden><span></span></div>
        </header>

        <main>
          <div className="wrap banner-wrap">
            <div className="banner" id="banner" role="status" hidden>
              <svg className="icon banner-icon"><use href="#i-alert"/></svg>
              <div className="banner-text">
                <strong id="bannerTitle">Some live data could not load</strong>
                <p id="bannerText">Showing the last saved information.</p>
              </div>
              <button type="button" className="btn btn-small" id="bannerRetry" data-i18n="banner.retry">Retry</button>
              <button type="button" className="icon-btn banner-close" id="bannerClose" aria-label="Dismiss" data-i18n-aria="banner.dismiss">
                <svg className="icon"><use href="#i-x"/></svg>
              </button>
            </div>
          </div>

          <section className="hero wrap" aria-labelledby="heroTitle">
            <div className="hero-copy">
              <p className="eyebrow"><span className="eyebrow-line"></span><span data-i18n="hero.eyebrow">Community disaster warning</span></p>
              <h1 id="heroTitle"><span data-i18n="hero.titleA">A warning for the</span> <span className="mark" data-i18n="hero.titleB">last village.</span></h1>
              <p className="hero-lead" data-i18n="hero.lead">Live satellite fire, flood, heat, storm and earthquake alerts for 30 tribal districts of India, in English, Hindi and 10 regional languages.</p>
              <div className="hero-actions">
                <button type="button" className="btn btn-primary" id="locateBtn">
                  <svg className="icon"><use href="#i-locate"/></svg>
                  <span data-i18n="hero.locate">Find my district</span>
                </button>
                <a className="btn btn-quiet" href="#alerts">
                  <span data-i18n="hero.browse">Browse districts</span>
                  <svg className="icon"><use href="#i-arrow-right"/></svg>
                </a>
              </div>
              <p className="hero-note"><svg className="icon"><use href="#i-shield"/></svg><span data-i18n="hero.note">Free · Works on a slow connection · No login</span></p>
            </div>

            <aside className="glance" id="glanceCard" aria-live="polite">
              <div className="glance-head">
                <span className="glance-label" data-i18n="national.label">Today at a glance</span>
                <span className="glance-date" id="nationalDate">—</span>
              </div>
              <div className="glance-status" id="nationalStatus"><span className="orb is-loading"></span><span>Reading live data…</span></div>
              <p className="glance-sub" id="nationalSub">This takes a few seconds.</p>
              <div className="glance-meta">
                <span><svg className="icon"><use href="#i-fire"/></svg><strong id="heatCount">—</strong><span data-i18n="national.heatDetections">Heat detections</span></span>
                <span><svg className="icon"><use href="#i-clock"/></svg><span id="updatedAt">—</span></span>
              </div>
              <div className="glance-foot">
                <span className="sources-label" data-i18n="national.sources">Sources</span>
                <div className="source-chips" id="sourceChips"></div>
              </div>
              <p className="glance-auto" id="autoNote">Auto-refresh every 10 min</p>
            </aside>
          </section>

          <section className="stats wrap" aria-labelledby="statsHeading">
            <div className="stats-head">
              <h2 id="statsHeading" data-i18n="stats.label">Hazard overview</h2>
              <p data-i18n="stats.hint">Tap a hazard to filter districts</p>
            </div>
            <div className="stat-grid">
              <button type="button" className="stat-card hz-fire" data-hazard="fire" aria-pressed="false">
                <span className="stat-icon"><svg className="icon"><use href="#i-fire"/></svg></span>
                <span className="stat-text">
                  <span className="stat-number" id="stat-fire">—</span>
                  <span className="stat-label" data-i18n="stats.fire">Forest fire</span>
                  <span className="stat-sub" id="stat-fire-sub">…</span>
                </span>
                <svg className="icon stat-chevron"><use href="#i-chevron"/></svg>
              </button>
              <button type="button" className="stat-card hz-rain" data-hazard="rain" aria-pressed="false">
                <span className="stat-icon"><svg className="icon"><use href="#i-rain"/></svg></span>
                <span className="stat-text">
                  <span className="stat-number" id="stat-rain">—</span>
                  <span className="stat-label" data-i18n="stats.rain">Heavy rain</span>
                  <span className="stat-sub" id="stat-rain-sub">…</span>
                </span>
                <svg className="icon stat-chevron"><use href="#i-chevron"/></svg>
              </button>
              <button type="button" className="stat-card hz-heat" data-hazard="heat" aria-pressed="false">
                <span className="stat-icon"><svg className="icon"><use href="#i-heat"/></svg></span>
                <span className="stat-text">
                  <span className="stat-number" id="stat-heat">—</span>
                  <span className="stat-label" data-i18n="stats.heat">Heatwave</span>
                  <span className="stat-sub" id="stat-heat-sub">…</span>
                </span>
                <svg className="icon stat-chevron"><use href="#i-chevron"/></svg>
              </button>
              <button type="button" className="stat-card hz-wind" data-hazard="wind" aria-pressed="false">
                <span className="stat-icon"><svg className="icon"><use href="#i-wind"/></svg></span>
                <span className="stat-text">
                  <span className="stat-number" id="stat-wind">—</span>
                  <span className="stat-label" data-i18n="stats.wind">Storm</span>
                  <span className="stat-sub" id="stat-wind-sub">…</span>
                </span>
                <svg className="icon stat-chevron"><use href="#i-chevron"/></svg>
              </button>
              <button type="button" className="stat-card hz-quake" data-hazard="quake" aria-pressed="false">
                <span className="stat-icon"><svg className="icon"><use href="#i-quake"/></svg></span>
                <span className="stat-text">
                  <span className="stat-number" id="stat-quake">—</span>
                  <span className="stat-label" data-i18n="stats.quake">Earthquake</span>
                  <span className="stat-sub" id="stat-quake-sub">…</span>
                </span>
                <svg className="icon stat-chevron"><use href="#i-chevron"/></svg>
              </button>
            </div>
          </section>

          <section className="main-grid wrap" aria-label="Live map and selected district" id="mapCard">
            <article className="map-card">
              <header className="card-head">
                <div>
                  <h2 data-i18n="map.title">Live hazard map</h2>
                  <p data-i18n="map.sub">Satellite fires, earthquake epicentres and district status</p>
                </div>
                <div className="layer-buttons">
                  <button type="button" className="layer-btn is-on" id="toggleFires" aria-pressed="true">
                    <span className="layer-dot fire"></span><span data-i18n="map.fires">Fires</span>
                  </button>
                  <button type="button" className="layer-btn is-on" id="toggleQuakes" aria-pressed="true">
                    <span className="layer-dot quake"></span><span data-i18n="map.quakes">Quakes</span>
                  </button>
                </div>
              </header>
              <div className="map-frame">
                <div id="map" role="application" aria-label="Map of live fire and earthquake hazards across India"></div>
                <div className="map-loading" id="mapLoading"><span className="spinner"></span><span data-i18n="map.loading">Loading map…</span></div>
                <div className="map-base-switch" id="mapBaseSwitch" role="group" aria-label="Map style" data-i18n-aria="map.style">
                  <button type="button" className="is-on" data-base="street" aria-pressed="true" data-i18n="map.street">Street</button>
                  <button type="button" data-base="satellite" aria-pressed="false" data-i18n="map.satellite">Satellite</button>
                </div>
                <button type="button" className="map-reset map-fullscreen" id="mapFullscreen" title="Fullscreen" data-i18n-title="map.fullscreen" aria-label="Fullscreen" data-i18n-aria="map.fullscreen">
                  <svg className="icon"><use href="#i-expand"/></svg>
                </button>
                <button type="button" className="map-reset" id="mapReset" title="Reset map" data-i18n-title="map.reset" aria-label="Reset map" data-i18n-aria="map.reset">
                  <svg className="icon"><use href="#i-layers"/></svg>
                </button>
                <div className="map-legend" id="mapLegend">
                  <span className="legend-title" data-i18n="map.legend">Region status</span>
                  <span className="legend-item"><i className="dot sev-safe"></i><span data-i18n="severities.safe">Safe</span></span>
                  <span className="legend-item"><i className="dot sev-watch"></i><span data-i18n="severities.watch">Watch</span></span>
                  <span className="legend-item"><i className="dot sev-warning"></i><span data-i18n="severities.warning">Warning</span></span>
                  <span className="legend-item"><i className="dot sev-severe"></i><span data-i18n="severities.severe">Severe</span></span>
                  <span className="legend-sep"></span>
                  <span className="legend-item fire-legend"><i className="dot fire-dot"></i><span data-i18n="map.legendFire">Fire detection</span></span>
                  <span className="legend-item quake-legend"><i className="dot quake-dot"></i><span data-i18n="map.legendQuake">Earthquake</span></span>
                </div>
              </div>
              <div className="route-info" id="routeInfo" hidden role="status" aria-live="polite">
                <span className="route-info-icon" aria-hidden="true"><svg className="icon"><use href="#i-route"/></svg></span>
                <span id="routeInfoText"></span>
                <button type="button" id="routeClear" title="Clear route" data-i18n-title="route.clear" aria-label="Clear route" data-i18n-aria="route.clear">
                  <svg className="icon"><use href="#i-x"/></svg>
                </button>
              </div>
              <footer className="map-foot">
                <span id="latestPass" className="map-foot-main">…</span>
                <span id="mapFireMeta">…</span>
                <span id="mapQuakeMeta">…</span>
              </footer>
            </article>

            <aside className="detail-card" id="detailPanel" aria-live="polite" aria-busy="true"></aside>
          </section>

          <section className="districts wrap" id="alerts" aria-labelledby="districtsHeading">
            <div className="section-head">
              <div>
                <p className="eyebrow"><span className="eyebrow-line"></span><span data-i18n="districts.eyebrow">Choose your area</span></p>
                <h2 id="districtsHeading" data-i18n="districts.title">Tribal districts we cover</h2>
                <p data-i18n="districts.sub">Alerts are calculated near the district centre. Tap a district for details.</p>
              </div>
              <label className="search-box">
                <svg className="icon"><use href="#i-search"/></svg>
                <input type="search" id="districtSearch" placeholder="Search district or state" data-i18n-placeholder="districts.search" autoComplete="off" />
              </label>
            </div>
            <div className="scope-bar" id="scopeBar" role="group" aria-label="Places shown" data-i18n-aria="districts.scopeLabel">
              <button type="button" className="scope-btn is-active" data-scope="tribal" aria-pressed="true" data-i18n="districts.scopeTribal">Tribal villages</button>
              <button type="button" className="scope-btn" data-scope="cities" aria-pressed="false" data-i18n="districts.scopeCities">Cities</button>
              <button type="button" className="scope-btn" data-scope="all" aria-pressed="false" data-i18n="districts.scopeAll">All places</button>
            </div>
            <div className="district-toolbar">
              <p id="districtCount">Showing 30 of 30 districts</p>
              <div className="filter-chip" id="filterBar" hidden>
                <span id="filterLabel">Filter: Fire</span>
                <button type="button" id="clearFilter" aria-label="Clear filter" data-i18n-aria="districts.clear">
                  <svg className="icon"><use href="#i-x"/></svg>
                </button>
              </div>
            </div>
            <div className="district-grid" id="districtGrid"></div>
            <p className="empty-state" id="emptyDistricts" hidden data-i18n="districts.empty">No districts match your search.</p>
          </section>

          <section className="guides wrap" id="guides" aria-labelledby="guidesHeading">
            <div className="section-head">
              <div>
                <p className="eyebrow"><span className="eyebrow-line"></span><span data-i18n="guides.eyebrow">Be prepared</span></p>
                <h2 id="guidesHeading" data-i18n="guides.title">Safety guides</h2>
                <p data-i18n="guides.sub">Simple steps that save lives. Learn them before an emergency.</p>
              </div>
            </div>
            <div className="guide-grid" id="guideGrid"></div>
          </section>

          <section className="emergency" id="helplines" aria-labelledby="helpHeading">
            <div className="wrap">
              <div className="emergency-head">
                <div>
                  <p className="eyebrow eyebrow-light"><span className="eyebrow-line"></span><span data-i18n="helplines.eyebrow">Emergency</span></p>
                  <h2 id="helpHeading" data-i18n="helplines.title">Save these numbers</h2>
                  <p data-i18n="helplines.sub">Calls are free. In immediate danger, call 112 first.</p>
                </div>
                <svg className="emergency-mark" aria-hidden="true" viewBox="0 0 24 24"><use href="#i-phone"/></svg>
              </div>
              <div className="helpline-grid" id="helplineGrid"></div>
            </div>
          </section>

          <section className="about wrap" id="about" aria-labelledby="aboutHeading">
            <div className="section-head">
              <div>
                <p className="eyebrow"><span className="eyebrow-line"></span><span data-i18n="about.title">About the alerts</span></p>
                <h2 id="aboutHeading" data-i18n="about.methodTitle">How alerts are calculated</h2>
              </div>
            </div>
            <div className="about-grid">
              <details className="about-card">
                <summary><span className="summary-icon"><svg className="icon"><use href="#i-info"/></svg></span><span data-i18n="about.methodTitle">How alerts are calculated</span><svg className="icon summary-chevron"><use href="#i-chevron"/></svg></summary>
                <div className="about-body" id="methodContent"></div>
              </details>
              <details className="about-card">
                <summary><span className="summary-icon"><svg className="icon"><use href="#i-signal"/></svg></span><span data-i18n="about.sourcesTitle">Data sources</span><svg className="icon summary-chevron"><use href="#i-chevron"/></svg></summary>
                <div className="about-body" id="sourcesContent"></div>
              </details>
            </div>
            <div className="disclaimer">
              <span className="disclaimer-icon"><svg className="icon"><use href="#i-alert"/></svg></span>
              <div>
                <h3 data-i18n="about.disclaimerTitle">Important</h3>
                <p data-i18n="about.disclaimerText">This is a community early-warning aid, not an official government service. Satellite and forecast data can be wrong or delayed. In an emergency, call 112 and follow your district administration.</p>
                <p className="official-line"><strong data-i18n="about.officialTitle">Official warnings</strong> <span data-i18n="about.officialText">Always check IMD and NDMA.</span></p>
                <div className="official-links">
                  <a href="https://mausam.imd.gov.in/" target="_blank" rel="noopener">IMD <svg className="icon"><use href="#i-external"/></svg></a>
                  <a href="https://ndma.gov.in/" target="_blank" rel="noopener">NDMA <svg className="icon"><use href="#i-external"/></svg></a>
                  <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noopener">NASA FIRMS <svg className="icon"><use href="#i-external"/></svg></a>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="site-footer">
          <div className="wrap footer-inner">
            <div className="footer-brand">
              <span className="brand-mark small" aria-hidden="true">
                <svg viewBox="0 0 48 48">
                  <path d="M24 3 43 9.5v13.2C43 34.6 34.7 42.4 24 45 13.3 42.4 5 34.6 5 22.7V9.5L24 3Z" fill="currentColor"/>
                  <path d="M24 11.5c4.7 4.4 8.4 7.6 8.4 13a8.4 8.4 0 1 1-16.8 0c0-3.7 2.3-6.2 4.4-8.1.1 2.5 1.2 3.8 3.1 4.8-.3-4-1-6.3.9-9.7Z" fill="#f8f1df"/>
                </svg>
              </span>
              <div>
                <strong>Adivasi Suraksha</strong>
                <p data-i18n="footer.made">Built for community volunteers, teachers and health workers in India's tribal districts.</p>
              </div>
            </div>
            <div className="footer-note">
              <p data-i18n="footer.data">Data: NASA FIRMS · Open-Meteo · USGS · Map: OpenStreetMap/CARTO</p>
              <p className="footer-warn"><svg className="icon"><use href="#i-alert"/></svg><span data-i18n="footer.disclaimer">Not an official warning service. Emergency: 112</span></p>
              <p className="footer-credit" data-i18n="footer.credit">A student project for disaster resilience.</p>
            </div>
          </div>
        </footer>

        <div className="toast" id="toast" role="status" aria-live="polite"></div>
        <section id="printArea" className="print-area" aria-hidden="true"></section>

        <noscript>
          <div className="noscript">This site needs JavaScript for live alerts. Emergency numbers: 112 (national), 108 (ambulance), 101 (fire), 1078 (disaster helpline).</div>
        </noscript>
      <LegacyScripts />
    </>
  );
}
