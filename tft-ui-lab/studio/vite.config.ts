import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');

function layoutApi(): Plugin {
  return {
    name: 'memlab-layout-api',
    configureServer(server) {
      server.middlewares.use('/api/save-layout', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 2_000_000) req.destroy();
        });
        req.on('end', () => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(body);
          } catch {
            res.statusCode = 400;
            res.end('invalid JSON');
            return;
          }
          if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).screens)) {
            res.statusCode = 422;
            res.end('layout must contain a screens array');
            return;
          }
          const target = path.join(repo, 'shared', 'layout.json');
          const temp = `${target}.tmp`;
          fs.writeFileSync(temp, JSON.stringify(parsed, null, 2) + '\n');
          fs.renameSync(temp, target);
          execFile('node', ['tools/gen.mjs'], { cwd: repo }, (err, stdout, stderr) => {
            if (err) {
              res.statusCode = 500;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: String(err), stderr }));
              return;
            }
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, output: stdout.trim() }));
          });
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), layoutApi()],
  resolve: {
    alias: {
      '@shared': path.join(repo, 'shared'),
    },
  },
  server: {
    fs: { allow: [repo] },
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
