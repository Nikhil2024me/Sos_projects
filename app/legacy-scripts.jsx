"use client";

/*
 * Adivasi Suraksha - legacy client bootstrap.
 *
 * The interactive dashboard is the original, dependency-free client bundle
 * (config.js, i18n*.js, logic.js, vendor Leaflet and app.js). Instead of
 * rewriting ~2,800 lines of battle-tested DOM code, we load those classic
 * scripts in order from /public inside the Next.js app shell.
 *
 * Order matters: app.js reads window.APP_CONFIG / window.APP_I18N /
 * window.SurveillanceLogic and needs the global Leaflet (window.L). We load
 * each file sequentially, then dispatch a synthetic DOMContentLoaded so
 * app.js boots even though the document already finished loading.
 */
import { useEffect } from "react";

const SCRIPTS = [
  "/config.js",
  "/i18n.langs.js",
  "/i18n.js",
  "/logic.js",
  "/vendor/leaflet/leaflet.js",
  "/app.js",
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-legacy="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.legacy = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.body.appendChild(script);
  });
}

let booted = false;

export default function LegacyScripts() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        for (const src of SCRIPTS) {
          await loadScript(src);
          if (cancelled) return;
        }
        if (cancelled || booted) return;
        booted = true;
        // app.js listens for DOMContentLoaded; the document is already ready.
        document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
      } catch (error) {
        console.error("Adivasi Suraksha: failed to load the dashboard client.", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
