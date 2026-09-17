/**
 * Testy vzhledové vrstvy Atlas — běží proti TEST verzi (engine + web-app/atlas/).
 *
 * Hlavní sada (web_app.test.mjs) je napsaná pro vzhled enginu. Na TEST verzi
 * neprojde: vrstva přestavuje stránku (Export v menu „Správa rosteru“, karty
 * místo tabulky…). Tady se proto testuje to, co dělá vrstva sama a co do ní
 * přidal Claude: štítky důvodů v kartách, detail, hlavička, evoluční řada.
 *
 * Spuštění:
 *   python tools/sync_reference.py --test --s-obrazky
 *   node tests/atlas_vrstva.test.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "web-app");
const TEST_APP = path.join(WEB_DIR, "pokemon_tracker_TEST.html");
const PORT = 8781;

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
  throw new Error("Playwright nenalezen: " + PLAYWRIGHT_CANDIDATES.join(", "));
}

let passed = 0;
const failures = [];
function check(nazev, ok, detail) {
  if (ok) { passed++; console.log("  ok   " + nazev); }
  else {
    failures.push(nazev + (detail !== undefined ? " → " + detail : ""));
    console.log("  FAIL " + nazev + (detail !== undefined ? " → " + detail : ""));
  }
}

// --- sestavení musí být čerstvé, jinak se testuje stará vrstva ---
console.log("\n1) TEST verze je sestavená z aktuálních souborů");
const existuje = fs.existsSync(TEST_APP);
check("web-app/pokemon_tracker_TEST.html existuje", existuje, TEST_APP);
if (!existuje) {
  console.log("\nSpusť: python tools/sync_reference.py --test --s-obrazky");
  process.exit(1);
}
const html = fs.readFileSync(TEST_APP, "utf8");
check("obsahuje vrstvu Atlas", html.indexOf("ATLAS JS START") > -1);
const casTest = fs.statSync(TEST_APP).mtimeMs;
const zdroje = ["web-app/atlas/atlas.js", "web-app/atlas/atlas.css", "web-app/pokemon_tracker_app.html"];
const starsi = zdroje.filter((f) => fs.statSync(path.join(ROOT, f)).mtimeMs > casTest + 1000);
check("je novější než atlas.js, atlas.css a engine", starsi.length === 0,
  "novější zdroj: " + starsi.join(", ") + " — spusť sync_reference.py --test --s-obrazky");

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(WEB_DIR, rel === "/" ? "pokemon_tracker_TEST.html" : rel);
  if (!file.startsWith(WEB_DIR) || !fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));
const browser = await loadChromium().launch();
const chyby = [];

const ROSTER = [
  { pokemon: "Metagross", cp: 3700, level: 40, ivAtk: 15, ivDef: 15, ivSta: 14, fastMove: "Bullet Punch", charged1: "Meteor Mash" },
  { pokemon: "Blissey", cp: 2700, level: 40, ivAtk: 10, ivDef: 15, ivSta: 15 },
  { pokemon: "Beldum", cp: 500, level: 20, ivAtk: 15, ivDef: 15, ivSta: 14 },
  { pokemon: "Pikachu", cp: 300, level: 10, ivAtk: 5, ivDef: 5, ivSta: 5, cute: "Ano" },
  { pokemon: "Rattata", cp: 100, level: 5, ivAtk: 3, ivDef: 3, ivSta: 3 }
];

async function otevri(sirka) {
  const page = await browser.newPage({ viewport: { width: sirka, height: 950 } });
  page.on("pageerror", (e) => chyby.push(sirka + " px: " + String(e)));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__pgo && window.__atlasTest, null, { timeout: 60000 });
  await page.evaluate(async (rows) => {
    const P = window.__pgo, A = window.__atlasTest;
    P.setRows(rows);
    await new Promise((r) => setTimeout(r, 1200));
    A.go("roster");
    A.refresh();
    await new Promise((r) => setTimeout(r, 900));
  }, ROSTER);
  return page;
}

/** Karty rosteru: štítky, „+N" a souhrn u pouštěného kusu. */
async function karty(page) {
  return page.evaluate(() => {
    const P = window.__pgo, comp = P.getComputed(), rows = P.getRows();
    return [...document.querySelectorAll(".atlas-row")].map((k) => {
      const r = rows.filter((x) => x.id === k.dataset.atlasDetail)[0];
      if (!r) return null;
      const c = comp[r.id], vic = k.querySelector(".dv-vic");
      return { jmeno: r.pokemon, keepGood: !!c.keepGood, duvodu: (c.duvody || []).length,
        videt: [...k.querySelectorAll(".dv-chip:not(.dv-vic)")].filter((e) => !e.hidden).length,
        vic: vic && !vic.hidden ? Number(vic.textContent.replace("+", "")) : 0,
        vicTip: vic && !vic.hidden ? vic.getAttribute("data-tip") || "" : "",
        small: !!k.querySelector(".atlas-decision small"),
        tipy: [...k.querySelectorAll(".dv-chip[data-tip]")].length };
    }).filter(Boolean);
  });
}

/** Detail Beldumu: hlavička, verdikt, evoluční řada. */
async function detail(page) {
  return page.evaluate(async () => {
    const P = window.__pgo, A = window.__atlasTest;
    const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
    const beldum = P.getRows().filter((r) => r.pokemon === "Beldum")[0];
    A.openDetail(beldum.id);
    await cekej(1200);
    const bar = document.querySelector(".atlas-drawer-header .hra-pruh");
    const edit = document.getElementById("atlasEditPokemon");
    return {
      barPredEdit: !!(bar && edit && bar.nextElementSibling === edit),
      stejnyRadek: bar && edit ? Math.abs(bar.getBoundingClientRect().top - edit.getBoundingClientRect().top) < 12 : null,
      souhrn: !!document.querySelector(".atlas-role-summary"),
      stitku: document.querySelectorAll(".atlas-verdict-first .d-duvody .dv-chip:not(.dv-vic)").length,
      duvodu: (P.getComputed()[beldum.id].duvody || []).length,
      subVedle: !!document.querySelector(".atlas-verdict-first .d-sub"),
      evoNadpisu: [...document.querySelectorAll(".atlas-evolution-column .d-box-h")]
        .filter((e) => e.getClientRects().length).length,
      evoSummary: (document.querySelector(".atlas-evolution-column > summary") || {}).textContent || ""
    };
  });
}

// ----------------------------------------------------------------- počítač
console.log("\n2) Karty rosteru (1400 px)");
const pc = await otevri(1400);
const kPc = await karty(pc);
const kept = kPc.filter((k) => k.keepGood);
check("ponechané kusy mají štítky místo souhrnu rolí",
  kept.length >= 3 && kept.every((k) => k.videt >= 1 && !k.small), JSON.stringify(kPc));
check("…nic se neztratí: vidět + „+N“ = všechny důvody",
  kept.every((k) => k.videt + k.vic === k.duvodu), JSON.stringify(kept));
check("…každý štítek má bublinu", kept.every((k) => k.tipy >= k.videt), JSON.stringify(kept));
check("pouštěný kus má dál textový souhrn",
  kPc.filter((k) => !k.keepGood).every((k) => k.small), JSON.stringify(kPc));

console.log("\n3) Detail kusu (1400 px)");
const dPc = await detail(pc);
check("verdikt v detailu má všechny štítky", dPc.stitku === dPc.duvodu, dPc.stitku + " vs " + dPc.duvodu);
check("zdvojený text verdiktu (souhrn keepSub) je pryč", !dPc.souhrn && !dPc.subVedle, JSON.stringify(dPc));
check("„Vylepšil jsem ho“ stojí hned před „Upravit tohoto Pokémona“", dPc.barPredEdit, JSON.stringify(dPc));
check("…ve stejném řádku", dPc.stejnyRadek === true, JSON.stringify(dPc));
check("evoluční řada má jeden nadpis", dPc.evoNadpisu === 0 && /Evoluční řada/.test(dPc.evoSummary),
  JSON.stringify(dPc));

console.log("\n4) Evoluční řada: bublina a klik");
const stupne = pc.locator(".atlas-evolution-column .d-evo-kus[data-tip]");
const posledni = stupne.last();
await posledni.hover();
await pc.waitForTimeout(400);
const tip = await pc.evaluate(() => {
  const t = document.getElementById("atlasEvoTooltip");
  const el = [...document.querySelectorAll(".atlas-evolution-column .d-evo-kus[data-tip]")].pop();
  let pravy = document.documentElement.clientWidth;
  for (let s = el && el.parentElement; s && s !== document.body; s = s.parentElement) {
    const cs = getComputedStyle(s);
    if (/(auto|scroll)/.test(cs.overflowY) && s.scrollHeight > s.clientHeight) {
      pravy = Math.min(pravy, s.getBoundingClientRect().left + s.clientLeft + s.clientWidth);
      break;
    }
  }
  return { videt: !!t && !t.hidden, pravy: t ? Math.round(t.getBoundingClientRect().right) : null,
    obsah: Math.round(pravy) };
});
check("bublina evoluční řady je vidět", tip.videt, JSON.stringify(tip));
check("…a nezajede pod posuvník panelu", tip.videt && tip.pravy <= tip.obsah, JSON.stringify(tip));
const metang = pc.locator('.atlas-evolution-column .d-evo-kus.evo-klikaci[data-druh="Metang"]').first();
let dialog = { otevreny: false, nadpis: "" };
if (await metang.count()) {
  await metang.click();
  await pc.waitForTimeout(400);
  dialog = await pc.evaluate(() => {
    const box = document.getElementById("hraBox");
    return { otevreny: !!box && !box.hidden, nadpis: (document.getElementById("hraNadpis") || {}).textContent || "" };
  });
  await pc.evaluate(() => window.__pgo.hraZavri());
}
check("klik na další stupeň otevře dialog evoluce", dialog.otevreny && /Metang/.test(dialog.nadpis),
  JSON.stringify(dialog));
await pc.close();

// ----------------------------------------------------------------- telefon
console.log("\n5) Telefon (390 px)");
const tel = await otevri(390);
const kTel = await karty(tel);
check("na telefonu mají karty štítky a nic se neztratí",
  kTel.filter((k) => k.keepGood).every((k) => k.videt >= 1 && k.videt + k.vic === k.duvodu), JSON.stringify(kTel));
const dTel = await detail(tel);
check("na telefonu je lišta změn na vlastním řádku nad „Upravit“",
  dTel.barPredEdit && dTel.stejnyRadek === false, JSON.stringify(dTel));
const sirkaStranky = await tel.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("stránka nemá vodorovný posuvník", sirkaStranky <= 1, String(sirkaStranky));
await tel.close();

check("žádná chyba JavaScriptu", chyby.length === 0, chyby.join(" | "));

await browser.close();
server.close();
console.log(`\n${passed} kontrol prošlo, ${failures.length} selhalo`);
if (failures.length) {
  failures.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
