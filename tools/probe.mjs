/**
 * Ladicí sonda: nahraje roster ze souboru a vypíše, jak ho appka rozdělila.
 * Není to test — slouží k tomu, aby se při ladění nemusela pouštět celá sada.
 *
 * Spuštění:  node tools/probe.mjs "cesta/k/rosteru.csv"
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "web-app");
const PORT = 8791;

const require = createRequire(import.meta.url);
const chromium = require(
  fs.existsSync(path.resolve(ROOT, "node_modules/playwright"))
    ? path.resolve(ROOT, "node_modules/playwright")
    : path.resolve(ROOT, "../playwright-day2/node_modules/playwright")
).chromium;

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(WEB_DIR, rel === "/" ? "pokemon_tracker_app.html" : rel);
  if (!file.startsWith(WEB_DIR) || !fs.existsSync(file)) { res.writeHead(404).end("nope"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
await page.goto(`http://localhost:${PORT}/pokemon_tracker_app.html`);
await page.waitForFunction(() => !!window.__pgo);

const csv = fs.readFileSync(process.argv[2], "utf8");
const out = await page.evaluate((text) => {
  const P = window.__pgo;
  P.setDiscarded([]);
  P.importText(text);
  P.finishImport(true);
  const c = P.getComputed(), rows = P.getRows();
  const verdikty = {};
  rows.forEach((r) => {
    const k = c[r.id].keep;
    verdikty[k] = (verdikty[k] || 0) + 1;
  });
  document.getElementById("rozpocetCard").open = true;
  return {
    kusu: rows.length,
    verdikty,
    tabulka: document.getElementById("rozpocetBody").textContent
      .replace(/\n{2,}/g, "\n").replace(/[ \t]+/g, " ").trim(),
    mezery: rows.filter((r) => c[r.id].jeMezera).map((r) => r.pokemon + " " + r.cp),
  };
}, csv);

console.log("kusů:", out.kusu);
console.log("verdikty:", JSON.stringify(out.verdikty, null, 1));
console.log("\n--- karta Role ---\n" + out.tabulka);
console.log("\n--- díry (" + out.mezery.length + ") ---\n" + out.mezery.join(", "));

await browser.close();
server.close();
