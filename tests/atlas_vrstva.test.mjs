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

// ------------------------------------------------ menu, uložení, editor, řazení
console.log("\n6) Menu rosteru, věta o uložení, úprava kusu, řazení, akce");
const ui = await browser.newPage({ viewport: { width: 1400, height: 950 } });
ui.on("pageerror", (e) => chyby.push("ui: " + String(e)));
await ui.goto(`http://localhost:${PORT}/`);
await ui.waitForFunction(() => window.__pgo && window.__atlasTest, null, { timeout: 60000 });
const stav = await ui.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  P.setRows([
    { pokemon: "Garchomp", cp: 4357, level: 48, ivAtk: 14, ivDef: 15, ivSta: 15, star: true },
    { pokemon: "Azumarill", cp: 1482, level: 24.5, ivAtk: 0, ivDef: 15, ivSta: 15 },
    { pokemon: "Registeel", cp: 2480, level: 26, ivAtk: 1, ivDef: 15, ivSta: 14 },
    { pokemon: "Medicham", cp: 1450, level: 40, ivAtk: 5, ivDef: 15, ivSta: 14 },
    { pokemon: "Rattata", cp: 100, level: 5, ivAtk: 3, ivDef: 3, ivSta: 3 }
  ]);
  await cekej(1200);
  A.go("roster");
  A.refresh();
  await cekej(800);
  const out = {};
  const menu = document.querySelector(".atlas-roster-commands");
  const smazat = document.getElementById("clearUnstarredBtn");
  const vse = document.getElementById("clearBtn");
  out.smazatVMenu = !!(menu && smazat && menu.contains(smazat));
  out.smazatPredVse = !!(smazat && vse && smazat.nextElementSibling === vse);
  const disp = (id) => { const e = document.getElementById(id); return e ? getComputedStyle(e).display : "chybi"; };
  out.saveState = disp("saveState");
  out.backupWarn = (document.getElementById("backupState") || {}).className || "";
  out.backupState = disp("backupState");
  const radek = document.getElementById("backupState") && document.getElementById("backupState").parentElement;
  out.radekHledani = radek ? getComputedStyle(radek).display : "chybi";
  // úprava kusu: nabídka útoků druhu
  const garchomp = P.getRows().filter((r) => r.pokemon === "Garchomp")[0];
  A.openDetail(garchomp.id);
  await cekej(1000);
  out.why = !!document.querySelector(".atlas-verdict-first .d-why");
  out.duvody = !!document.querySelector(".atlas-verdict-first .d-duvody");
  out.hlavaTip = (document.querySelector(".atlas-verdict-first .d-verdict>b") || { getAttribute: () => "" }).getAttribute("data-tip") || "";
  window.AtlasEditRow(garchomp.id);
  await cekej(300);
  const form = document.getElementById("atlasRowEditor");
  const nazvy = (pol) => pol.map((e) => ((e.querySelector(".uv-nazev") || {}).textContent || "").trim());
  const otevriVyber = async (k) => {
    const tl = form && form.querySelector('[data-utok-obal="' + k + '"] .uv-pole');
    if (!tl) return [];
    tl.click();
    await cekej(250);
    return [...document.querySelectorAll(".uv-seznam .uv-polozka")];
  };
  out.vyberu = form ? form.querySelectorAll(".atlas-utok-vyber .uv-pole").length : 0;
  out.skryte = form ? ["fastMove", "charged1", "charged2"].every((k) => form.elements[k].type === "hidden") : false;
  const rychle = await otevriVyber("fastMove");
  // seznam musí být NAD oknem detailu, jinak ho nejde vidět ani kliknout myší
  const seznam = document.querySelector(".uv-seznam");
  if (seznam) {
    const sr = seznam.getBoundingClientRect();
    const nahore = document.elementFromPoint(sr.left + 20, sr.top + 15);
    out.seznamNahore = !!(nahore && seznam.contains(nahore));
  }
  out.fast = nazvy(rychle);
  out.fastTyp = rychle.some((e) => e.querySelector(".uv-typ"));
  out.fastSila = rychle.some((e) => /síla|PvP/.test(e.textContent));
  const mud = rychle.filter((e) => /Mud Shot/.test(e.textContent))[0];
  if (mud) { mud.click(); await cekej(250); }
  out.fastHodnota = form ? form.elements.fastMove.value : "";
  out.charged = nazvy(await otevriVyber("charged2"));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await cekej(150);
  if (form) {
    form.elements.pokemon.value = "Machamp";
    form.elements.pokemon.dispatchEvent(new Event("change", { bubbles: true }));
    await cekej(150);
    out.fastMachamp = nazvy(await otevriVyber("fastMove"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    form.remove();
  }
  out.fold = !!document.querySelector(".atlas-storage-fold");
  const warn = document.getElementById("zalWarn");
  out.warnVDetails = !!(warn && warn.closest("details"));
  A.closeDetail();
  await cekej(300);
  // řazení
  const sel = document.getElementById("atlasSort");
  out.volby = [...sel.options].map((o) => o.value);
  const vyber = async (v) => {
    sel.value = v;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    await cekej(700);
    const comp = P.getComputed(), rows = P.getRows();
    return [...document.querySelectorAll(".atlas-row")].map((k) => {
      const r = rows.filter((x) => x.id === k.dataset.atlasDetail)[0];
      const gl = (comp[r.id].pvpLigy || []).filter((l) => l.liga === "GL")[0];
      return { jmeno: r.pokemon, gl: gl && gl.rank ? gl.rank : null };
    });
  };
  out.glVzestupne = await vyber("liga:GL:1");
  out.sortKey = P.snapshot().sortKey;
  out.glSestupne = await vyber("liga:GL:-1");
  out.jmenoZA = (await vyber("pokemon:-1")).map((x) => x.jmeno);
  out.puvodni = await vyber("");
  out.sortKeyPo = P.snapshot().sortKey;
  // akce: správný tvar
  A.go("home");
  await cekej(900);
  out.akce = [...document.querySelectorAll("#atlasHome small")].map((e) => e.textContent.trim())
    .filter((t) => /^\d+ akc/.test(t));
  return out;
});
check("„Smazat neoznačené“ je v menu Správa rosteru hned nad „Vymazat vše“",
  stav.smazatVMenu && stav.smazatPredVse, JSON.stringify([stav.smazatVMenu, stav.smazatPredVse]));
check("věta o uložení není vidět", stav.saveState === "none", stav.saveState);
check("oranžový řádek „Bez zálohy“ není vidět (varování dělá žlutý box)", stav.backupState === "none" && stav.radekHledani === "none",
  stav.backupState + " / " + stav.radekHledani);
check("vysvětlení verdiktu se neopakuje pod štítky (je v bublině nadpisu)",
  stav.duvody && !stav.why && stav.hlavaTip.length > 10, JSON.stringify([stav.duvody, stav.why, stav.hlavaTip.slice(0, 60)]));
check("úprava kusu má hezký výběr útoků (3 pole, hodnoty ve skrytých polích)",
  stav.vyberu === 3 && stav.skryte, JSON.stringify([stav.vyberu, stav.skryte]));
check("…rychlé útoky jen toho druhu, s typem a silou",
  stav.fast.indexOf("Mud Shot") > -1 && stav.fast.indexOf("Counter") === -1 && stav.fastTyp && stav.fastSila,
  JSON.stringify([stav.fast, stav.fastTyp, stav.fastSila]));
check("…vybraný útok se propíše do formuláře", stav.fastHodnota === "Mud Shot", stav.fastHodnota);
check("…seznam útoků je vidět nad oknem detailu", stav.seznamNahore === true, String(stav.seznamNahore));
check("…i nabité útoky druhu", stav.charged.indexOf("Earthquake") > -1, JSON.stringify(stav.charged));
check("…a po změně druhu se nabídka přepočítá", (stav.fastMachamp || []).indexOf("Counter") > -1,
  JSON.stringify(stav.fastMachamp));
check("prázdné rozbalovátko „Uložení a zálohování“ zmizelo a varování je vidět bez rozbalování",
  !stav.fold && !stav.warnVDetails, JSON.stringify([stav.fold, stav.warnVDetails]));
check("řazení nabízí obě směry i jednotlivé ligy",
  ["pokemon:1", "pokemon:-1", "cp:1", "cp:-1", "ivPct:1", "ivPct:-1", "level:1", "level:-1",
    "liga:LC:1", "liga:GL:1", "liga:GL:-1", "liga:UL:1", "liga:ML:-1",
    "scanDate:-1", "scanDate:1", "catchDate:-1", "catchDate:1"].every((v) => stav.volby.indexOf(v) > -1),
  JSON.stringify(stav.volby));
const sGl = stav.glVzestupne.filter((x) => x.gl !== null).map((x) => x.gl);
check("Great League: nejlepší první — pořadí roste a kusy bez GL jsou na konci",
  stav.sortKey === "liga:GL" && sGl.length >= 2 && sGl.every((v, i) => !i || v >= sGl[i - 1])
    && stav.glVzestupne.findIndex((x) => x.gl === null) >= sGl.length - 0,
  JSON.stringify(stav.glVzestupne));
const sGlD = stav.glSestupne.filter((x) => x.gl !== null).map((x) => x.gl);
check("Great League: nejhorší první — pořadí klesá", sGlD.every((v, i) => !i || v <= sGlD[i - 1]),
  JSON.stringify(stav.glSestupne));
check("jméno Z–A", stav.jmenoZA.every((j, i) => !i || j.localeCompare(stav.jmenoZA[i - 1], "cs") <= 0),
  JSON.stringify(stav.jmenoZA));
check("„Původní řazení“ řazení opravdu zruší", !stav.sortKeyPo, String(stav.sortKeyPo));
const tvar = (n) => n >= 1 && n <= 4 ? "akce" : "akcí";
check("počet akcí je česky správně (1–4 akce, 0 a 5+ akcí)",
  stav.akce.length >= 1 && stav.akce.every((t) => { const n = parseInt(t, 10); return t === n + " " + tvar(n); }),
  JSON.stringify(stav.akce));
await ui.close();

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
