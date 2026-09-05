/**
 * Trip Budget Planner - Local Web Server + Data Persistence + PWA
 * Run: node server.js
 * Data is saved to data.json (safe from browser cache clears).
 */
const http = require("http");
const fs   = require("fs");
const path = require("path");
const os   = require("os");

const PORT      = 3000;
const ROOT      = __dirname;
const DATA_FILE = path.join(ROOT, "data.json");

const MIME = {
  ".html":"text/html; charset=utf-8",
  ".css" :"text/css; charset=utf-8",
  ".js"  :"application/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".png" :"image/png",
  ".jpg" :"image/jpeg",
  ".svg" :"image/svg+xml",
  ".webp":"image/webp",
};

/* ---- data helpers ---- */
function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return null; }
}
function writeData(data) {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
  return true;
}

/* ---- request handler ---- */
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  /* ---- API ---- */
  if (url === "/api/ping") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, version: "1.1" }));
    return;
  }

  if (url === "/api/data" && req.method === "GET") {
    const data = readData();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data || {}));
    return;
  }

  if (url === "/api/data" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        writeData(JSON.parse(body));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  /* ---- Static files ---- */
  const filePath = url === "/" ? path.join(ROOT, "index.html")
                               : path.join(ROOT, url);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found: " + url); return; }
    const ext  = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    // sw.js must never be cached — browsers need the latest version always
    const cc   = (url === "/sw.js") ? "no-store, no-cache, must-revalidate" : "no-store";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": cc });
    res.end(data);
  });
});

/* ---- startup ---- */
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces))
    for (const i of ifaces[name])
      if (i.family === "IPv4" && !i.internal) return i.address;
  return "localhost";
}

server.listen(PORT, "0.0.0.0", () => {
  const ip       = getLocalIP();
  const existing = readData();
  const trips    = (existing && existing.trips) ? existing.trips.length : 0;
  const mobile   = "http://" + ip + ":" + PORT;

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   ✈️   Trip Budget Planner  —  Running!     ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  console.log("  💻  Desktop  ->  http://localhost:" + PORT);
  console.log("  📱  Mobile   ->  " + mobile + "\n");
  console.log("  ── Install on phone (one-time, same WiFi) ─────");
  console.log("  1. Open  " + mobile + "  in Chrome or Safari");
  console.log("  2. Chrome : tap ⋮ → 'Add to Home Screen'");
  console.log("     Safari : tap Share ⬆ → 'Add to Home Screen'");
  console.log("  3. App icon added — works OFFLINE from now on ✅");
  console.log("  ────────────────────────────────────────────────\n");
  console.log("  💾  " + (trips > 0 ? trips + " trip(s) loaded from data.json" : "No data yet — saves on first use") + "\n");
  console.log("  Press Ctrl+C to stop.\n");

  try { require("child_process").exec("start http://localhost:" + PORT); } catch(_) {}
});
