/**
 * Malý server pro zkoušení appky v prohlížeči.
 *
 * Spuštění:  node tools/server.mjs
 * Pak:       http://localhost:8778/pokemon_tracker_TEST.html
 *
 * Je tu kvůli přihlášení k OneDrivu: z otevřeného souboru na disku
 * (`file://`) se přihlásit nedá a adresa, na kterou se Microsoft vrací,
 * musí přesně sedět s tím, co je v registraci aplikace — proto zrovna
 * port 8778. Zastaví se Ctrl+C.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "web-app");
const PORT = 8778;
const VYCHOZI = "pokemon_tracker_TEST.html";

const TYPY = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

http.createServer((req, res) => {
  const cesta = decodeURIComponent(req.url.split("?")[0]);
  const soubor = path.join(KOREN, cesta === "/" ? VYCHOZI : cesta);
  // Mimo web-app se nic nevydává, ani přes „..“ v adrese.
  if (!soubor.startsWith(KOREN) || !fs.existsSync(soubor) || fs.statSync(soubor).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Tenhle soubor tu není.");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPY[path.extname(soubor)] || "application/octet-stream" });
  res.end(fs.readFileSync(soubor));
}).listen(PORT, () => {
  console.log("Appka běží na http://localhost:" + PORT + "/" + VYCHOZI);
  console.log("Zastavit se dá Ctrl+C.");
});
