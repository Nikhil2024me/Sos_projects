#!/usr/bin/env node
/*
 * Adivasi Suraksha - asset sync.
 *
 * Next.js only serves static files from /public, but the original project keeps
 * its browser assets at the repo root (config.js, app.js, styles.css, the
 * vendored Leaflet build, ...). This script copies them into public/ so the
 * classic <script> tags loaded by app/legacy-scripts.jsx keep working and the
 * original layout stays the single source of truth.
 *
 * Runs automatically before `next dev` and `next build` (see package.json).
 */
import { cp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");

const FILES = [
  "config.js",
  "i18n.langs.js",
  "i18n.js",
  "logic.js",
  "app.js",
  "styles.css",
  "favicon.svg",
];

const DIRS = ["vendor/leaflet"];

async function copy(rel) {
  const from = join(ROOT, rel);
  const to = join(PUBLIC, rel);
  if (!existsSync(from)) {
    console.warn(`[sync-public] missing ${rel}, skipped`);
    return 0;
  }
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
  return 1;
}

/* Cloudflare static-asset caching for the immutable Next.js bundles. */
const HEADERS = `/_next/static/*
  Cache-Control: public,max-age=31536000,immutable
`;

async function main() {
  await mkdir(PUBLIC, { recursive: true });
  let count = 0;
  for (const file of FILES) count += await copy(file);
  for (const dir of DIRS) count += await copy(dir);
  await writeFile(join(PUBLIC, "_headers"), HEADERS, "utf8");
  console.log(`[sync-public] copied ${count} browser asset(s) into public/`);
}

main().catch((error) => {
  console.error("[sync-public] failed:", error.message);
  process.exit(1);
});
