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

async function otevri(sirka, radky = ROSTER) {
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
  }, radky);
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
      evoSummary: (document.querySelector(".atlas-evolution-column > summary") || {}).textContent || "",
      krokPod: (() => { const v = document.querySelector(".atlas-verdict-first"), k = document.querySelector(".atlas-krok");
        return v && k ? k.getBoundingClientRect().top >= v.getBoundingClientRect().bottom - 1 : null; })()
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
  const lista = document.querySelector(".card.roster > .toolbar");
  const profil = lista && lista.querySelector(".profile-box");
  out.listaSkryta = lista ? getComputedStyle(lista).display : "chybi";
  if (profil) {
    profil.hidden = false;
    out.listaSProfilem = getComputedStyle(lista).display;
    profil.hidden = true;
  }
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
check("prázdná lišta pod rosterem není vidět, dokud se neotevře profil",
  stav.listaSkryta === "none" && stav.listaSProfilem && stav.listaSProfilem !== "none",
  JSON.stringify([stav.listaSkryta, stav.listaSProfilem]));
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

// ------------------------------------- tmavý režim, detail kusu, pořadí štítků
console.log("\n7) Tmavý režim, detail bez souhrnu, krok vedle verdiktu, pořadí značek");
const GYA = [
  { pokemon: "Gyarados", cp: 3834, level: 50, ivAtk: 15, ivDef: 15, ivSta: 15,
    fastMove: "Dragon Breath", charged1: "Crunch", charged2: "Aqua Tail", cute: "Ano", dynamax: "Ano" },
  { pokemon: "Metagross", cp: 3700, level: 40, ivAtk: 15, ivDef: 15, ivSta: 14, fastMove: "Bullet Punch", charged1: "Meteor Mash" },
  { pokemon: "Rattata", cp: 100, level: 5, ivAtk: 3, ivDef: 3, ivSta: 3 }
];
const vzhled = await otevri(1400, GYA);
const d7 = await vzhled.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { tema: document.documentElement.dataset.theme,
    modeText: (document.querySelector(".atlas-mode") || {}).textContent || "" };
  const radek = [...document.querySelectorAll(".atlas-row")].find((k) => /Gyarados/.test(k.textContent));
  out.tagy = radek ? [...radek.querySelectorAll(".atlas-roster-tag")].map((e) => e.textContent.trim()) : [];
  const gya = P.getRows().find((r) => r.pokemon === "Gyarados");
  A.openDetail(gya.id);
  await cekej(1200);
  const m = document.getElementById("atlasModal");
  const verd = m.querySelector(".atlas-verdict-first"), krok = m.querySelector(".atlas-krok");
  const vr = verd && verd.getBoundingClientRect(), kr = krok && krok.getBoundingClientRect();
  const sloupec = m.querySelector(".atlas-detail-column");
  out.journey = !!m.querySelector(".atlas-journey");
  out.coted = !!m.querySelector("[data-detail-section=coted]");
  out.krok = krok ? { spolecnyRadek: verd.parentElement === krok.parentElement && Math.abs(vr.top - kr.top) < 4,
    vedle: kr.left >= vr.right, uzsi: vr.width < sloupec.getBoundingClientRect().width * 0.6,
    karet: krok.querySelectorAll(".d-role").length } : null;
  const naco = m.querySelector(".atlas-vyuziti");
  out.karty = naco ? [...naco.querySelectorAll(".d-role-h")].map((e) => e.textContent) : [];
  // karty rolí vedle sebe v jednom řádku, stejně široké, bez textu
  const karty7 = naco ? [...naco.querySelectorAll(".d-role")].map((k) => k.getBoundingClientRect()) : [];
  out.kartyRadek = karty7.length === 4 && karty7.every((r) => Math.abs(r.top - karty7[0].top) < 2
    && Math.abs(r.width - karty7[0].width) < 2 && Math.abs(r.height - karty7[0].height) < 2);
  out.kartyText = naco ? naco.querySelectorAll(".d-role-p").length : -1;
  // statistiky, IV a strop CP v hlavičce vedle jména
  const identita7 = m.querySelector(".atlas-detail-identity");
  const boxy = [...m.querySelectorAll(".atlas-detail-identity .atlas-ident-stats > .d-box")].map((b) => b.getBoundingClientRect());
  const jmeno7 = m.querySelector("#atlasDetailTitle").getBoundingClientRect();
  out.statsVedle = boxy.length >= 2 && boxy.every((r) => Math.abs(r.top - boxy[0].top) < 4);
  out.statsVHlavicce = boxy.length === 3 && boxy.every((r) => r.left > jmeno7.right && r.top < jmeno7.bottom
    && r.bottom <= identita7.getBoundingClientRect().bottom + 1);
  out.statsSekce = !!m.querySelector("[data-detail-section=stats]");
  out.statsBoxu = boxy.length;
  out.detailTagy = [...m.querySelectorAll(".detail-title .rarity-chip, .detail-title .atlas-lucky-tag")].map((e) => e.textContent.trim());
  A.closeDetail();
  // přepínač motivu: světlý si appka pamatuje
  const prepinac = document.querySelector('[data-atlas-action="theme"]');
  if (prepinac) prepinac.click();
  out.poKliku = document.documentElement.dataset.theme;
  return out;
});
check("tmavý režim je výchozí", d7.tema === "dark", String(d7.tema));
check("nad seznamem už není popisek „Zobrazení rosteru“", !/Zobrazení rosteru/.test(d7.modeText), d7.modeText);
const PORADI_TAGU = ["SHADOW", "PURIFIED", "DMAX", "100%", "CUTE", "SHINY", "LUCKY"];
const vPoradi = (t) => { const i = t.map((x) => PORADI_TAGU.indexOf(x)).filter((x) => x > -1); return i.every((v, k) => !k || v > i[k - 1]); };
check("značky u jména v kartě: DMAX, 100%, CUTE",
  d7.tagy.indexOf("DMAX") > -1 && d7.tagy.indexOf("100%") > -1 && d7.tagy.indexOf("CUTE") > -1 && vPoradi(d7.tagy),
  JSON.stringify(d7.tagy));
check("…i v detailu stejně", vPoradi(d7.detailTagy) && d7.detailTagy.indexOf("100%") > -1, JSON.stringify(d7.detailTagy));
check("detail nemá souhrnný box Využití / Krok / Cena / Chybí", !d7.journey, String(d7.journey));
check("doporučený krok stojí vedle verdiktu, ne v sekci dole",
  !d7.coted && d7.krok && d7.krok.spolecnyRadek && d7.krok.vedle && d7.krok.karet >= 1, JSON.stringify(d7));
check("…a verdikt je užší (méně než 60 % sloupce)", d7.krok && d7.krok.uzsi, JSON.stringify(d7.krok));
check("herní využití: PvP, Raid, Gym, Mega",
  JSON.stringify(d7.karty) === JSON.stringify(["PvP", "Raid", "Gym — obránce", "Mega"]), JSON.stringify(d7.karty));
check("…vedle sebe v jednom řádku, stejně široké a vysoké, bez textu", d7.kartyRadek && d7.kartyText === 0,
  JSON.stringify({ radek: d7.kartyRadek, text: d7.kartyText }));
check("statistiky, IV a strop CP stojí vedle sebe", d7.statsVedle && d7.statsBoxu === 3, JSON.stringify(d7));
check("…nahoře v hlavičce vedle jména a obrázku, sekce dole není", d7.statsVHlavicce && !d7.statsSekce,
  JSON.stringify({ hlavicka: d7.statsVHlavicce, sekce: d7.statsSekce }));
await vzhled.reload();
await vzhled.waitForFunction(() => window.__pgo && window.__atlasTest, null, { timeout: 60000 });
const temaPoReloadu = await vzhled.evaluate(() => document.documentElement.dataset.theme);
check("…přepínač přepne na světlý a po načtení si ho pamatuje", d7.poKliku === "light" && temaPoReloadu === "light",
  d7.poKliku + " → " + temaPoReloadu);
await vzhled.close();

// ------------------------------- IV nahoře, klávesy, značky, pod čarou, evoluce
console.log("\n8) IV u hodnot, šipky a A/D, značky jako typy, pouštěný kus, evoluční řada");
const S8 = [
  { pokemon: "Garchomp", cp: 4357, level: "48.0", ivAtk: "14.0", ivDef: "15.0", ivSta: "15.0",
    fastMove: "Dragon Tail", charged1: "Earth Power", dynamax: "Ano", cute: "Ano" },
  { pokemon: "Garchomp", cp: 2000, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10, dynamax: "Ano" },
  { pokemon: "Garchomp", cp: 1900, level: 20, ivAtk: 8, ivDef: 10, ivSta: 10, dynamax: "Ano" },
  { pokemon: "Heracross", cp: 2800, level: 35, ivAtk: 12, ivDef: 13, ivSta: 14 },
  { pokemon: "Rattata", cp: 100, level: 5, ivAtk: 3, ivDef: 3, ivSta: 3 },
  { pokemon: "Rhydon", cp: 1811, level: 20, ivAtk: 15, ivDef: 14, ivSta: 15 }
];
const p8 = await otevri(1400, S8);
const d8 = await p8.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const st = (e) => { const c = getComputedStyle(e); return { t: e.textContent.trim(), h: Math.round(e.getBoundingClientRect().height),
    fs: c.fontSize, r: c.borderRadius }; };
  const out = {};
  const rows = P.getRows();
  const g1 = rows.find((r) => r.cp === 4357), g3 = rows.find((r) => r.cp === 1900);
  const karta = [...document.querySelectorAll(".atlas-row")].find((k) => k.dataset.atlasDetail === g1.id);
  out.kartaTyp = st(karta.querySelector(".atlas-roster-type"));
  out.kartaZnacky = [...karta.querySelectorAll(".atlas-roster-tag")].map(st);
  const karta3 = [...document.querySelectorAll(".atlas-row")].find((k) => k.dataset.atlasDetail === g3.id);
  out.karta3 = { pod: karta3.querySelectorAll(".dv-pod").length, small: !!karta3.querySelector(".atlas-decision small") };
  A.openDetail(g1.id);
  await cekej(1200);
  const m = document.getElementById("atlasModal");
  out.identita = [...m.querySelectorAll(".atlas-detail-identity p")].map((p) => p.textContent.trim());
  const stats = m.querySelector(".atlas-ident-stats");
  const box = (re) => [...stats.querySelectorAll(".d-box")].find((b) => re.test((b.querySelector(".d-box-h") || {}).textContent || ""));
  out.ivPoznamka = !!box(/^IV/).querySelector(".d-note");
  out.stropText = !!box(/^Strop/).querySelector(".d-proc");
  // „Výhoda" z typového pokrytí jako typy vpravo na řádku značek
  const titulek = m.querySelector(".detail-title");
  const vyhoda = titulek.querySelector(".atlas-vyhoda");
  const posledniZnacka = [...titulek.querySelectorAll(".rarity-chip, .atlas-lucky-tag")].pop();
  out.vyhoda = { je: !!vyhoda, typu: vyhoda ? vyhoda.querySelectorAll(".pk-typ").length : 0,
    tip: !!(vyhoda && vyhoda.getAttribute("data-tip")),
    // zarovnané doprava: poslední prvek řádku a u pravého okraje (i když se řádek zalomí)
    vpravo: !!(vyhoda && titulek.lastElementChild === vyhoda && posledniZnacka
      && Math.abs(vyhoda.getBoundingClientRect().right - titulek.getBoundingClientRect().right) < 30) };
  out.pokrytiVyhoda = m.querySelectorAll(".d-pokryti-radek:not(.d-pokryti-pozor)").length;
  out.pokrytiVyrusi = m.querySelectorAll(".d-pokryti-pozor").length;
  // LUCKY se chová jako ostatní vypnuté značky
  const luckyVyp = titulek.querySelector(".atlas-lucky-tag:not(.active)");
  const znackaVyp = titulek.querySelector(".rarity-chip.vypnuto");
  out.lucky = luckyVyp && znackaVyp
    ? { l: getComputedStyle(luckyVyp).backgroundColor, z: getComputedStyle(znackaVyp).backgroundColor }
    : null;
  out.gutter = getComputedStyle(document.querySelector(".atlas-drawer")).scrollbarGutter;
  out.sirkaDlouhy = Math.round(m.querySelector(".atlas-detail-identity").getBoundingClientRect().width);
  out.detailTyp = st(m.querySelector(".detail-title .d-type"));
  out.detailZnacky = [...m.querySelectorAll(".detail-title .rarity-chip, .detail-title .atlas-lucky-tag")].map(st);
  out.karty = [...m.querySelectorAll(".atlas-vyuziti .d-role")].map((k) => Math.round(k.getBoundingClientRect().height));
  out.kartyTop = [...m.querySelectorAll(".atlas-vyuziti .d-role")].map((k) => Math.round(k.getBoundingClientRect().top));
  // útoky a nejlepší sestava v hlavičce, ne v sekci dole
  const utokyBox = m.querySelector(".atlas-detail-identity .atlas-ident-utoky");
  out.utoky = utokyBox ? { utoku: utokyBox.querySelectorAll(".d-move").length,
    sestav: utokyBox.querySelectorAll(".atlas-sestava").length,
    tip: !!utokyBox.getAttribute("data-tip"),
    prepad: Math.max(0, utokyBox.scrollHeight - utokyBox.clientHeight),
    vHlavicce: utokyBox.getBoundingClientRect().bottom <= m.querySelector(".atlas-detail-identity").getBoundingClientRect().bottom + 1 } : null;
  out.sekceDole = [...m.querySelectorAll("[data-detail-section]")].map((x) => x.dataset.detailSection);
  const ligyBlok = m.querySelector("[data-detail-section=ligy]");
  out.ligy = ligyBlok ? { tag: ligyBlok.tagName.toLowerCase(),
    nadpis: ((ligyBlok.querySelector(".atlas-sekce-nadpis") || {}).textContent || "").trim(),
    sbalitelne: !!ligyBlok.querySelector("summary"), tabulka: !!ligyBlok.querySelector(".d-ligy-tab") } : null;
  // pořadí v hlavičce: staty, IV, strop a až za nimi útoky
  const statyBox = m.querySelector(".atlas-ident-stats");
  out.poradiHlavicky = !!(utokyBox && statyBox
    && utokyBox.getBoundingClientRect().left >= statyBox.getBoundingClientRect().right - 1);
  // obrázek se po změření zvětšuje — musí zůstat ve svém okénku a nehnout hlavičkou
  const obal = m.querySelector(".atlas-detail-identity .atlas-ident-obr");
  const hlavicka = m.querySelector(".atlas-detail-identity");
  const img = obal ? obal.querySelector("img") : null;
  const predVyska = Math.round(hlavicka.getBoundingClientRect().height);
  if (img) img.style.transform = "translate(25%, -30%) scale(1.55)";
  out.obrazek = obal ? { overflow: getComputedStyle(obal).overflow,
    w: Math.round(obal.getBoundingClientRect().width), h: Math.round(obal.getBoundingClientRect().height),
    vyskaPred: predVyska, vyskaPo: Math.round(hlavicka.getBoundingClientRect().height) } : null;
  if (img) img.style.transform = "";
  out.tipDmax = ([...m.querySelectorAll(".atlas-verdict-first .dv-chip")].find((e) => e.textContent === "Dynamax") || { getAttribute: () => "" })
    .getAttribute("data-tip");
  A.closeDetail();
  A.openDetail(g3.id);
  await cekej(1200);
  out.zahodit = { pod: m.querySelectorAll(".atlas-verdict-first .dv-pod").length,
    why: !!m.querySelector(".atlas-verdict-first .d-why"),
    hlavaTip: !!m.querySelector(".atlas-verdict-first .d-verdict>b[data-tip]") };
  A.closeDetail();
  A.closeDetail();
  A.openDetail(rows.find((r) => r.pokemon === "Rattata").id);
  await cekej(1200);
  out.sirkaKratky = Math.round(m.querySelector(".atlas-detail-identity").getBoundingClientRect().width);
  A.closeDetail();
  A.openDetail(rows.find((r) => r.pokemon === "Rhydon").id);
  await cekej(1200);
  const krok8 = [...m.querySelectorAll(".atlas-krok .d-role")].map((k) => ({ h: k.querySelector(".d-role-h").textContent,
    r: k.getBoundingClientRect() }));
  const verd8 = m.querySelector(".atlas-verdict-first").getBoundingClientRect();
  const utokyRhydon = m.querySelector(".atlas-ident-utoky");
  out.sestavy = { radku: utokyRhydon ? utokyRhydon.querySelectorAll(".atlas-sestava").length : 0,
    text: utokyRhydon ? [...utokyRhydon.querySelectorAll(".atlas-sestava")].map((x) => x.textContent.trim()) : [],
    tipy: utokyRhydon ? [...utokyRhydon.querySelectorAll(".atlas-sestava")].every((x) => !!x.getAttribute("data-tip")) : false,
    prepad: utokyRhydon ? Math.max(0, utokyRhydon.scrollHeight - utokyRhydon.clientHeight) : -1 };
  out.krok = { karty: krok8.map((k) => k.h), vedle: krok8.length >= 2 && krok8.every((k, i) => !i || (Math.abs(k.r.top - krok8[0].r.top) < 2
      && k.r.left >= krok8[i - 1].r.right)),
    stejnaVyska: krok8.every((k) => Math.abs(k.r.height - krok8[0].r.height) < 2),
    vpravoOdVerdiktu: krok8.every((k) => k.r.left >= verd8.right) };
  A.closeDetail();
  A.openDetail(rows.find((r) => r.pokemon === "Heracross").id);
  await cekej(1200);
  out.heracross = { sloupec: !!m.querySelector(".atlas-evolution-column"), kusu: m.querySelectorAll(".atlas-evolution-column .d-evo-kus").length };
  A.closeDetail();
  A.openDetail(g1.id);
  await cekej(1000);
  return out;
});
const pozice = () => p8.evaluate(() => (document.querySelector(".atlas-detail-paging span") || {}).textContent || "");
const klavesy = [await pozice()];
for (const k of ["ArrowRight", "d", "a", "ArrowLeft"]) {
  await p8.keyboard.press(k);
  await p8.waitForTimeout(900);
  klavesy.push(await pozice());
}
// psaní do pole detail nelistuje
await p8.evaluate(() => { const i = document.createElement("input"); i.id = "zkouskaKlaves"; document.getElementById("atlasDetailContent").append(i); i.focus(); });
await p8.keyboard.press("d");
await p8.waitForTimeout(600);
klavesy.push(await pozice());
await p8.close();
check("nahoře IV s procentem za tečkou a čísla bez „.0“",
  d8.identita.some((t) => t === "IV 14 / 15 / 15 · 98 %") && d8.identita.some((t) => /L48$/.test(t)), JSON.stringify(d8.identita));
check("pod pruhy IV už není procento a ve stropu není vysvětlující text", !d8.ivPoznamka && !d8.stropText, JSON.stringify(d8));
check("šipky a A/D listují detailem (1 → 2 → 3 → 2 → 1)",
  JSON.stringify(klavesy.slice(0, 5).map((t) => t.split(" / ")[0])) === JSON.stringify(["1", "2", "3", "2", "1"]), JSON.stringify(klavesy));
check("…ale ne při psaní do pole", klavesy[5] === klavesy[4], JSON.stringify(klavesy));
check("značky v kartě mají výšku, písmo a zaoblení typového štítku",
  d8.kartaZnacky.length >= 2 && d8.kartaZnacky.every((z) => z.h === d8.kartaTyp.h && z.fs === d8.kartaTyp.fs && z.r === d8.kartaTyp.r),
  JSON.stringify({ typ: d8.kartaTyp, znacky: d8.kartaZnacky }));
check("…i v detailu",
  d8.detailZnacky.length >= 4 && d8.detailZnacky.every((z) => z.h === d8.detailTyp.h && z.fs === d8.detailTyp.fs && z.r === d8.detailTyp.r),
  JSON.stringify({ typ: d8.detailTyp, znacky: d8.detailZnacky }));
check("útoky a nejlepší sestava jsou v hlavičce a nepřetečou",
  !!d8.utoky && d8.utoky.utoku >= 1 && d8.utoky.tip
    && d8.utoky.prepad === 0 && d8.utoky.vHlavicce, JSON.stringify(d8.utoky));
check("…u kusu s evolucí jsou v nich obě nejlepší sestavy (teď i po evoluci) a vejdou se",
  d8.sestavy.radku === 2 && d8.sestavy.tipy && d8.sestavy.prepad === 0
    && /^Teď/.test(d8.sestavy.text[0]) && /^Po evo/.test(d8.sestavy.text[1]),
  JSON.stringify(d8.sestavy));
check("…a sekce Útoky, Nejlepší sestava a Herní využití dole nejsou",
  ["utoky", "sestavy", "naco", "stats", "proti", "coted"].every((k) => d8.sekceDole.indexOf(k) === -1),
  JSON.stringify(d8.sekceDole));
check("„Ligy“ se jmenují jen Ligy a nejdou sbalit",
  !!d8.ligy && d8.ligy.tag === "section" && d8.ligy.nadpis === "Ligy" && !d8.ligy.sbalitelne && d8.ligy.tabulka,
  JSON.stringify(d8.ligy));
check("v hlavičce jsou útoky až za statistikami (vpravo)", d8.poradiHlavicky, String(d8.poradiHlavicky));
check("obrázek kusu je v pevném okénku a ani zvětšený nehne hlavičkou",
  !!d8.obrazek && d8.obrazek.overflow === "hidden" && d8.obrazek.w === 150 && d8.obrazek.h === 150
    && d8.obrazek.vyskaPred === d8.obrazek.vyskaPo, JSON.stringify(d8.obrazek));
check("herní využití: čtyři karty v jednom řádku, stejně vysoké", d8.karty.length === 4
  && d8.karty.every((h) => h === d8.karty[0]) && d8.kartyTop.every((t) => t === d8.kartyTop[0]),
  JSON.stringify({ vysky: d8.karty, top: d8.kartyTop }));
check("Vylepšit a Evolvovat stojí vedle sebe vedle verdiktu, stejně vysoké",
  d8.krok.karty.join() === "Vylepšit,Evolvovat" && d8.krok.vedle && d8.krok.stejnaVyska && d8.krok.vpravoOdVerdiktu,
  JSON.stringify(d8.krok));
check("štítek Dynamax má v bublině pořadí v Max Battle", /Max Dragon/.test(d8.tipDmax) && /tenhle kus/.test(d8.tipDmax),
  d8.tipDmax.replace(/<[^>]+>/g, " ").slice(0, 200));
check("pouštěný kus: v kartě štítky pod čarou místo textu", d8.karta3.pod >= 1 && !d8.karta3.small, JSON.stringify(d8.karta3));
check("…v detailu taky, a vysvětlující věta je v bublině nadpisu",
  d8.zahodit.pod >= 1 && !d8.zahodit.why && d8.zahodit.hlavaTip, JSON.stringify(d8.zahodit));
check("„silný proti“ stojí vpravo na řádku značek a má bublinu",
  d8.vyhoda.je && d8.vyhoda.typu >= 2 && d8.vyhoda.tip && d8.vyhoda.vpravo, JSON.stringify(d8.vyhoda));
check("…a sekce typového pokrytí v detailu není vůbec",
  d8.pokrytiVyhoda === 0 && d8.pokrytiVyrusi === 0, JSON.stringify({ vyhoda: d8.pokrytiVyhoda, vyrusi: d8.pokrytiVyrusi }));
check("LUCKY vypadá jako ostatní vypnuté značky", !!d8.lucky && d8.lucky.l === d8.lucky.z, JSON.stringify(d8.lucky));
check("detail drží místo pro posuvník, takže šířka neskáče",
  d8.gutter === "stable" && d8.sirkaDlouhy === d8.sirkaKratky,
  JSON.stringify({ gutter: d8.gutter, dlouhy: d8.sirkaDlouhy, kratky: d8.sirkaKratky }));
check("druh bez evoluce má sloupec evoluční řady se sebou samým",
  d8.heracross.sloupec && d8.heracross.kusu === 1, JSON.stringify(d8.heracross));

// ------------------------------------- detail nesmí při listování skákat
console.log("\n9) Pevné rozložení detailu (nic neskáče mezi kusy)");
const S9 = [
  { pokemon: "Rhydon", cp: 1811, level: 20, ivAtk: 15, ivDef: 14, ivSta: 15, fastMove: "Mud Slap", charged1: "Earthquake" },
  { pokemon: "Blissey", cp: 3161, level: 35, ivAtk: 14, ivDef: 13, ivSta: 10, fastMove: "Pound", charged1: "Hyper Beam" },
  { pokemon: "Thundurus Incarnate", cp: 1860, level: 20, ivAtk: 13, ivDef: 15, ivSta: 7, forma: "Shadow" },
  { pokemon: "Garchomp", cp: 4357, level: 48, ivAtk: 14, ivDef: 15, ivSta: 15, fastMove: "Dragon Tail", charged1: "Earth Power", dynamax: "Ano" },
  { pokemon: "Rattata", cp: 100, level: 5, ivAtk: 3, ivDef: 3, ivSta: 3 },
  { pokemon: "Heracross", cp: 2800, level: 35, ivAtk: 12, ivDef: 13, ivSta: 14 }
];
const p9 = await otevri(1500, S9);
const d9 = await p9.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const mer = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return Math.round(r.top) + "/" + Math.round(r.height) + "/" + Math.round(r.width); };
  const bloky = { identita: ".atlas-detail-identity", staty: ".atlas-ident-stats", verdikt: ".atlas-verdict-radek",
    znacky: ".detail-title", evoluce: ".atlas-evolution-column", prvniSekce: "[data-detail-section]",
    vyuziti: ".atlas-vyuziti", utoky: ".atlas-ident-utoky" };
  const out = { kusy: [], pokryti: 0, cena: [] };
  for (const r of P.getRows()) {
    A.openDetail(r.id);
    await cekej(700);
    const m = document.getElementById("atlasModal");
    const zaznam = { jm: r.pokemon };
    Object.keys(bloky).forEach((k) => { zaznam[k] = mer(m.querySelector(bloky[k])); });
    if (m.querySelector(".d-pokryti")) out.pokryti++;
    const vylepsit = [...m.querySelectorAll(".atlas-krok .d-role")].find((k) => /Vylepšit/.test(k.textContent));
    const popis = vylepsit ? vylepsit.querySelector(".d-role-p") : null;
    if (popis) out.cena.push({ jm: r.pokemon, text: popis.textContent.trim(),
      radku: Math.round(popis.getBoundingClientRect().height / parseFloat(getComputedStyle(popis).lineHeight)) });
    out.kusy.push(zaznam);
    A.closeDetail();
    await cekej(120);
  }
  return out;
});
await p9.close();
const nestabilni = Object.keys(d9.kusy[0]).filter((k) => k !== "jm"
  && new Set(d9.kusy.map((x) => x[k])).size > 1);
check("při listování detailem nic nemění pozici ani velikost",
  nestabilni.length === 0,
  JSON.stringify(nestabilni.map((k) => k + ": " + d9.kusy.map((x) => x.jm.slice(0, 8) + " " + x[k]).join(" | "))));
check("sekce „Typové pokrytí“ v detailu není", d9.pokryti === 0, String(d9.pokryti));
check("cena vylepšení je krátká a na jednom řádku",
  d9.cena.length > 0 && d9.cena.every((c) => /^L\d+ · .+ \+ \d+ candy( \+ \d+ XL)?$/.test(c.text) && c.radku === 1),
  JSON.stringify(d9.cena));

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
check("na telefonu je doporučený krok pod verdiktem, ne vedle", dTel.krokPod === true, JSON.stringify(dTel));
await tel.close();

check("žádná chyba JavaScriptu", chyby.length === 0, chyby.join(" | "));

await browser.close();
server.close();
console.log(`\n${passed} kontrol prošlo, ${failures.length} selhalo`);
if (failures.length) {
  failures.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
