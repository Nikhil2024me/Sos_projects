import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Adivasi Suraksha is fully dynamic (every /api response is computed from live
// upstream feeds), so no incremental cache is configured. Add an R2-backed
// incremental cache here if the app later needs ISR/static caching.
export default defineCloudflareConfig({});
