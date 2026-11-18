/*
 * Adivasi Suraksha - API catch-all route.
 *
 * Maps every /api/* request to the shared handler ported from serve.js. Runs on
 * the Node runtime in `next dev` and on Cloudflare Workers (Node.js
 * compatibility) when deployed with @opennextjs/cloudflare.
 *
 * Note: do not add `export const runtime = "edge"`; the OpenNext Cloudflare
 * adapter runs the Node.js runtime.
 */
import { handleApi } from "@/api-handler.js";

export const dynamic = "force-dynamic";

export function GET(request) {
  return handleApi(request);
}

export function OPTIONS(request) {
  return handleApi(request);
}

export async function HEAD(request) {
  const response = await handleApi(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
