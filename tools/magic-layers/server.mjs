// Magic Layers — local server. Serves the app from ./app on 127.0.0.1 only (nothing is reachable from the network)
// and exposes one optional endpoint, /api/ai-assist, that is active only when an Anthropic API key is present.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const appDir = join(root, "app");
const PORT = Number(process.env.PORT || 4517);
const HOST = "127.0.0.1";

// Optional .env file next to this script: ANTHROPIC_API_KEY=sk-ant-...
if (existsSync(join(root, ".env"))) {
  for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".wasm": "application/wasm", ".bcmap": "application/octet-stream", ".pfb": "application/octet-stream", ".ttf": "font/ttf", ".icc": "application/vnd.iccprofile", ".gz": "application/gzip", ".ico": "image/x-icon", ".pdf": "application/pdf" };
const send = (res, status, body, headers = {}) => { res.writeHead(status, { "cache-control": "no-store", ...headers }); res.end(body); };
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { "content-type": "application/json; charset=utf-8" });

let aiModule = null;
async function ai() { if (aiModule === null) { try { aiModule = await import("./ai-assist.mjs"); } catch (e) { aiModule = false; console.warn("AI assist unavailable:", e.message); } } return aiModule; }

async function readBody(req, limit = 12 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw new Error("too_large"); chunks.push(c); }
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    // Only this computer may talk to the server.
    const origin = req.headers.origin, host = req.headers.host || "";
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return json(res, 403, { error: "forbidden" });
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return json(res, 403, { error: "forbidden" });   // no other site may reach it through this browser

    if (url.pathname === "/api/status") {
      const m = await ai();
      return json(res, 200, { ok: true, version: "1.10.0", ai: Boolean(m && process.env.ANTHROPIC_API_KEY), aiInstalled: Boolean(m) });
    }
    if (url.pathname === "/api/ai-assist" && req.method === "POST") {
      const m = await ai();
      if (!m) return json(res, 503, { error: "not_installed" });
      if (!process.env.ANTHROPIC_API_KEY) return json(res, 503, { error: "no_key" });
      let body; try { body = JSON.parse(await readBody(req)); } catch (e) { return json(res, 400, { error: e.message === "too_large" ? "too_large" : "bad_json" }); }
      const out = await m.assist(body);
      return json(res, out.status || 200, out.body);
    }
    if (url.pathname === "/api/storyline" && req.method === "POST") {
      if (!process.env.ANTHROPIC_API_KEY) return json(res, 503, { error: "no_key" });
      let mod; try { mod = await import("./ai-storyline.mjs"); } catch (e) { return json(res, 503, { error: "not_installed" }); }
      let body; try { body = JSON.parse(await readBody(req)); } catch (e) { return json(res, 400, { error: e.message === "too_large" ? "too_large" : "bad_json" }); }
      const out = await mod.review(body);
      return json(res, out.status || 200, out.body);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "method" });

    let p = decodeURIComponent(url.pathname);
    if (p === "/") p = "/index.html";
    if (p === "/auditor") p = "/auditor.html";
    if (p === "/charts") p = "/charts.html";
    if (p === "/proposals") p = "/proposals.html";
    if (p === "/benchmark") p = "/benchmark.html";
    const file = normalize(join(appDir, p));
    if (!file.startsWith(appDir + sep)) return send(res, 403, "Forbidden");
    let st; try { st = await stat(file); } catch (e) { return send(res, 404, "Not found"); }
    if (st.isDirectory()) return send(res, 404, "Not found");
    const data = await readFile(file);
    const immutable = p.startsWith("/vendor/") || p.startsWith("/fonts/");
    send(res, 200, req.method === "HEAD" ? "" : data, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": immutable ? "public, max-age=86400" : "no-store" });
  } catch (err) {
    console.error(err);
    json(res, 500, { error: "server" });
  }
});

const address = `http://localhost:${PORT}`;
function openBrowser() {
  if (process.env.NO_OPEN) return;
  const cmd = process.platform === "win32" ? `start "" "${address}"` : process.platform === "darwin" ? `open "${address}"` : `xdg-open "${address}"`;
  exec(cmd, () => {});
}

server.on("error", async (e) => {
  if (e.code === "EADDRINUSE") {
    // most often Magic Layers is simply running already: bring it to the front instead of failing
    try { const r = await fetch(`http://${HOST}:${PORT}/api/status`); const j = await r.json(); if (j && j.ok) { console.log(`\n  Magic Layers is already running: ${address}\n`); openBrowser(); setTimeout(() => process.exit(0), 400); return; } } catch (err) { /* another program has the port */ }
    console.error(`\n  Port ${PORT} is used by another program.\n  Start on another port, for example:  PORT=4600 node server.mjs   (Windows: set PORT=4600 && node server.mjs)\n`); process.exit(1);
  }
  throw e;
});
if (!existsSync(join(appDir, "vendor", "tesseract", "tesseract.min.js"))) {
  console.error("\n  The app's libraries are not installed yet.\n  Run this once in this folder (needs an internet connection):  npm install\n"); process.exit(1);
}
server.listen(PORT, HOST, () => {
  console.log(`\n  Magic Layers, Deck Auditor and Chart Builder are running.\n  Open ${address} in your browser.\n  Files stay on this computer. Close this window (or press Ctrl+C) to stop.\n`);
  if (!process.env.ANTHROPIC_API_KEY) console.log("  AI assist is off (optional). See README.md to switch it on.\n");
  openBrowser();
});
