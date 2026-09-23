/**
 * Porovná VÝPOČTY dvou sestavení appky.
 *
 * Když se sáhne na vykreslování nebo na stavbu tabulky, je potřeba umět
 * dokázat, že se čísla nezměnila — ne „vypadá to stejně", ale položku po
 * položce. Tenhle skript nasype do obou souborů tentýž roster a porovná
 * všechno, co engine spočítá: verdikty, ceny, procenta, plány, tahák,
 * seznam k chytání i frontu čištění boxu.
 *
 * Spuštění:
 *   node tools/porovnej_vypocty.mjs <stary.html> <novy.html>
 *   node tools/porovnej_vypocty.mjs                 (starý = HEAD~1)
 *
 * Skončí nulou, když se nic nezměnilo. Jinak vypíše první rozdíly.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PLAYWRIGHT_CANDIDATES = [
  path.resolve(ROOT, "node_modules/playwright"),
  path.resolve(ROOT, "../playwright-day2/node_modules/playwright"),
  path.resolve(ROOT, "../playwright-day2/node_modules/playwright-core"),
];

function loadChromium() {
  const require = createRequire(import.meta.url);
  for (const p of PLAYWRIGHT_CANDIDATES) {
    if (fs.existsSync(p)) return require(p).chromium;
  }
  throw new Error("Playwright nenalezen:\n  " + PLAYWRIGHT_CANDIDATES.join("\n  "));
}

const [stary, novy] = [
  process.argv[2] || "web-app/_pred.html",
  process.argv[3] || "web-app/pokemon_tracker_app.html",
];

/** Roster, který se sype do obou sestavení. Má být co nejpestřejší —
 *  porovnání je tak přísné, jak pestrý je vzorek. */
function fixture(druhy) {
  const rows = [];
  const formy = ["", "", "", "Shadow", "Purified", "Lucky"];
  for (let i = 0; i < druhy.length; i++) {
    const level = 5 + ((i * 7) % 46) / 2;          // 5 až 50, i půllevely
    const r = {
      pokemon: druhy[i],
      level: level,
      ivAtk: (i * 5) % 16, ivDef: (i * 11) % 16, ivSta: (i * 13) % 16,
      forma: formy[i % formy.length],
    };
    if (i % 7 === 0) { r.ivAtk = null; r.ivDef = null; r.ivSta = null; }  // IV neznámé
    if (i % 5 === 0) r.cute = "Ano";
    if (i % 6 === 0) r.dynamax = "Ano";
    if (i % 9 === 0) r.shiny = "Ano";
    if (i % 8 === 0) r.star = true;
    if (i % 11 === 0) r.note = "poznamka " + i;
    if (i % 4 === 0) { r.fastMove = ""; r.charged1 = ""; }               // bez útoků
    rows.push(r);
    if (i % 10 === 0) {                                                   // kopie druhu
      rows.push(Object.assign({}, r, { level: level > 20 ? level - 10 : level + 8,
        ivAtk: 15, ivDef: 15, ivSta: 15, cute: undefined, star: false }));
    }
  }
  return rows;
}

/** Všechno, co engine spočítá, v jednom objektu — s `id` nahrazenými
 *  pořadím, aby se náhodné identifikátory nepletly do porovnání. */
async function posbirej(page) {
  return page.evaluate((zdroj) => {
    const P = window.__pgo;
    const druhy = Object.keys(P.pokedex().species).sort().filter((_, i) => i % 5 === 0).slice(0, 160);
    const jmena = druhy.map((k) => P.dexEntry(k) && P.dexEntry(k).name).filter(Boolean);
    // eslint-disable-next-line no-new-func
    const rows = new Function("druhy", "return (" + zdroj + ")(druhy)")(jmena);
    P.setRows(rows);
    const porad = P.getRows().map((r) => r.id);
    const out = {
      pocet: P.getRows().length,
      computed: P.getRows().map((r) => P.getComputed()[r.id]),
      plan: P.getPlan(),
      keepList: P.getKeepList(),
      cheatSheet: P.getCheatSheet(),
      evolvePlan: P.getEvolvePlan(),
      coChytat: P.coChytat(),
      prachovyPlan: P.prachovyPlan(),
      poradi: (P.atlasPoradi ? P.atlasPoradi() : porad).map((id) => porad.indexOf(id)),
      bmSeznam: (P.bmSeznam ? P.bmSeznam() : []).map((x) => (x && x.id) || x),
    };
    let text = JSON.stringify(out);
    // `id` jsou pokaždé jiná — nahradí se pořadím, jinak by se lišilo všechno.
    porad.forEach((id, i) => { text = text.split(id).join("#" + i); });
    return text;
  }, fixture.toString());
}

/** První rozdíly v JSONu, ať je vidět CO se liší, ne jen ŽE se liší. */
function rozdily(a, b) {
  const ja = JSON.parse(a), jb = JSON.parse(b);
  const nalez = [];
  const projdi = (x, y, cesta) => {
    if (nalez.length >= 15) return;
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (x === null || y === null || typeof x !== "object" || typeof y !== "object") {
      nalez.push(cesta + ": " + JSON.stringify(x) + "  ->  " + JSON.stringify(y));
      return;
    }
    const klice = [...new Set([...Object.keys(x), ...Object.keys(y)])];
    for (const k of klice) projdi(x[k], y[k], cesta + "." + k);
  };
  projdi(ja, jb, "");
  return nalez;
}

const chromium = loadChromium();
const browser = await chromium.launch();
const chyby = [];
const otevri = async (soubor) => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (e) => chyby.push(soubor + ": " + String(e)));
  await page.goto(pathToFileURL(path.resolve(ROOT, soubor)).href);
  await page.waitForFunction(() => window.__pgo && window.__pgo.getRows, null, { timeout: 60000 });
  const data = await posbirej(page);
  await page.close();
  return data;
};

console.log("stary: " + stary);
console.log("novy:  " + novy);
const a = await otevri(stary);
const b = await otevri(novy);
await browser.close();

if (chyby.length) {
  console.log("\nCHYBY V KONZOLI:\n  " + chyby.join("\n  "));
}
if (a === b) {
  console.log("\nVypocty jsou shodne (" + JSON.parse(a).pocet + " kusu, "
    + a.length + " znaku porovnaneho JSONu).");
  process.exit(chyby.length ? 1 : 0);
}
const n = rozdily(a, b);
console.log("\nROZDILY (" + n.length + (n.length >= 15 ? "+" : "") + "):");
n.forEach((x) => console.log("  " + x));
process.exit(1);
