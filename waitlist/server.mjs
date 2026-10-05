// Peanut Gallery waitlist: one POST endpoint that stores an email in SQLite.
// No dependencies; Node 24's built-in node:sqlite. Emails never leave this box.
//
//   POST /waitlist  {email, channel?, website?}  -> 200 {ok:true}
//   GET  /healthz                                -> 200 ok
//
// Coolify serves it at peanutgallery.gg/api and strips the /api prefix,
// so both /waitlist and /api/waitlist are accepted.

import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || "/data/waitlist.db";
const ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || "https://peanutgallery.gg,https://www.peanutgallery.gg")
    .split(",").map((s) => s.trim()).filter(Boolean),
);
const MAX_BODY = 2048;
const PER_IP_PER_HOUR = 5;

const db = new DatabaseSync(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  channel TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)`);
const insert = db.prepare("INSERT OR IGNORE INTO signups (email, channel) VALUES (?, ?)");

// Rough on purpose: stops one address hammering the form, nothing more.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > PER_IP_PER_HOUR;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, ts] of hits) if (ts.every((t) => now - t >= 3600_000)) hits.delete(ip);
}, 600_000).unref();

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

function send(res, status, body, extra = {}) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...extra });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) reject(Object.assign(new Error("too large"), { status: 413 }));
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parse(req, raw) {
  const type = (req.headers["content-type"] || "").split(";")[0].trim();
  if (type === "application/json") return JSON.parse(raw || "{}");
  if (type === "application/x-www-form-urlencoded") return Object.fromEntries(new URLSearchParams(raw));
  throw new Error("unsupported content type");
}

const server = createServer(async (req, res) => {
  const path = (req.url || "/").split("?")[0].replace(/^\/api/, "") || "/";
  if (req.method === "GET" && path === "/healthz") return send(res, 200, { ok: true });
  if (path !== "/waitlist") return send(res, 404, { error: "not found" });
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });
  if (!ORIGINS.has(req.headers.origin || "")) return send(res, 403, { error: "forbidden" });

  // Cloudflare overwrites CF-Connecting-IP; X-Forwarded-For's first hop is
  // whatever the client claims, so it is never trusted here.
  const ip = String(req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "").trim();
  if (limited(ip)) return send(res, 429, { error: "Too many tries. Give it an hour." });

  let form;
  try {
    form = parse(req, await readBody(req));
  } catch (e) {
    if (e.status === 413) return send(res, 413, { error: "That's too long." }, { connection: "close" });
    return send(res, 400, { error: "Couldn't read that." });
  }
  // Honeypot: people never see this field, bots fill it in.
  if (form.website) return send(res, 200, { ok: true });

  const email = String(form.email || "").trim().toLowerCase();
  const channel = String(form.channel || "").trim().slice(0, 80) || null;
  if (email.length > 254 || !EMAIL.test(email)) {
    return send(res, 400, { error: "That email doesn't look right." });
  }
  insert.run(email, channel);
  // Same answer whether or not the email was already on the list.
  return send(res, 200, { ok: true });
});

server.listen(PORT, () => console.log(`waitlist listening on :${PORT}, db ${DB_PATH}`));
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => server.close(() => { db.close(); process.exit(0); }));
