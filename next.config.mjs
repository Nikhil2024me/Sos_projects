import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dashboard is driven by the legacy client bundle (app.js) through the
  // <LegacyScripts /> component. Disable React Strict Mode so its effect runs
  // once in development and the client boots a single time.
  reactStrictMode: false,

  // Images are not optimized (the site uses Leaflet tiles and inline SVG), so no
  // Cloudflare IMAGES binding is required.
  images: { unoptimized: true },
};

export default nextConfig;

// Lets `next dev` reach Cloudflare bindings and keeps local behaviour aligned
// with the Workers runtime used in production (see wrangler.jsonc).
initOpenNextCloudflareForDev();
