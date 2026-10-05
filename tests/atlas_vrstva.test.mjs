/**
 * Testy vzhledové vrstvy Atlas — běží proti TEST verzi (engine + web-app/atlas/).
 *
 * Hlavní sada (web_app.test.mjs) je napsaná pro vzhled enginu. Na TEST verzi
 * neprojde: vrstva přestavuje stránku (Export v menu „Správa rosteru“, karty
 * místo tabulky…). Tady se proto testuje to, co dělá vrstva sama a co do ní
 * přidal Claude: štítky důvodů v kartách, detail, hlavička, evoluční řada.
 *
 * Spuštění:
 *   python tools/sync_reference.py --test
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
  console.log("\nSpusť: python tools/sync_reference.py --test");
  process.exit(1);
}
const html = fs.readFileSync(TEST_APP, "utf8");
check("obsahuje vrstvu Atlas", html.indexOf("ATLAS JS START") > -1);
const casTest = fs.statSync(TEST_APP).mtimeMs;
const zdroje = ["web-app/atlas/atlas.js", "web-app/atlas/atlas.css", "web-app/pokemon_tracker_app.html"];
const starsi = zdroje.filter((f) => fs.statSync(path.join(ROOT, f)).mtimeMs > casTest + 1000);
check("je novější než atlas.js, atlas.css a engine", starsi.length === 0,
  "novější zdroj: " + starsi.join(", ") + " — spusť sync_reference.py --test");

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

/* Cekani na podminku misto pevneho spanku. Horni mez je stejna jako
   puvodni pevne cekani, takze test neni netrpelivejsi nez driv — jen se
   nepreceka, kdyz uz je hotovo. */
const AZ = `(async (podminka, max) => {
  const konec = Date.now() + max;
  while (Date.now() < konec) {
    try { if (podminka()) return true; } catch (e) { /* jeste se kresli */ }
    await new Promise((r) => setTimeout(r, 25));
  }
  try { return !!podminka(); } catch (e) { return false; }
})`;

async function otevri(sirka, radky = ROSTER) {
  const page = await browser.newPage({ viewport: { width: sirka, height: 950 } });
  page.on("pageerror", (e) => chyby.push(sirka + " px: " + String(e)));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__pgo && window.__atlasTest, null, { timeout: 60000 });
  await page.evaluate(async ({ rows, azSrc }) => {
    const P = window.__pgo, A = window.__atlasTest;
    const az = eval(azSrc);
    P.setRows(rows);
    // Rozbor je hotovy, kdyz zna kazdy kus; u prazdneho rosteru hned.
    await az(() => Object.keys(P.getComputed()).length >= rows.length, 1200);
    A.go("roster");
    A.refresh();
    // Vykresleno je, kdyz stoji dlazdice za kazdy kus.
    await az(() => document.querySelectorAll(".atlas-roster-tile").length >= rows.length, 900);
    // I u prazdneho rosteru se necha vrstva dokreslit.
    await new Promise((r) => setTimeout(r, 120));
  }, { rows: radky, azSrc: AZ });
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
check("„Vylepšený“ stojí hned před „Upravit tohoto Pokémona“", dPc.barPredEdit, JSON.stringify(dPc));
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
  // Napred na nej najed: bublina se prepne na tenhle stupen a preskoci
  // jinam, takze klik dopadne na kus, ne na bublinu predchoziho stupne.
  await metang.hover();
  await pc.waitForTimeout(350);
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
  const vse = document.getElementById("clearBtn");
  // "Smazat neoznacene" zmizelo s hvezdickou; v menu ma zustat mazani vseho.
  out.smazatVMenu = !document.getElementById("clearUnstarredBtn");
  out.smazatPredVse = !!(menu && vse && menu.contains(vse));
  const disp = (id) => { const e = document.getElementById(id); return e ? getComputedStyle(e).display : "chybi"; };
  out.saveState = disp("saveState");
  out.backupWarn = (document.getElementById("backupState") || {}).className || "";
  out.backupState = disp("backupState");
  const radek = document.getElementById("backupState") && document.getElementById("backupState").parentElement;
  out.radekHledani = radek ? getComputedStyle(radek).display : "chybi";
  // Lišta je od A-007 v obalu .atlas-roster-fixed-controls, v enginu je jen jedna.
  const lista = document.querySelector(".card.roster .toolbar");
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
  // Ceske sklonovani poctu: Prehled uz zadny pocet akci neukazuje (ma ho
  // Astrin kalendar), stejny pomocnik ale hlida okno pri odchodu z cisteni
  // („Mas rozdelano 1 kus / 2 kusy / 5 kusu").
  out.tvary = [];
  for (const kolik of [1, 2, 5]) {
    P.boxOtevrit();
    { const o = document.getElementById("appOknoOk");
      if (o && !document.getElementById("appOkno").hidden) o.click(); }
    await cekej(500);
    for (let i = 0; i < kolik; i++) { P.boxRozhodnout("keep"); await cekej(120); }
    document.getElementById("bmClose").click();
    await cekej(400);
    const h = document.querySelector(".bm-zeptat h3");
    out.tvary.push(h ? h.textContent.trim() : "(nic)");
    const zpet = document.getElementById("bmPokracovat");
    if (zpet) zpet.click();
    await cekej(200);
    P.boxZavritNatvrdo();
    await cekej(200);
  }
  return out;
});
check("„Smazat neoznačené“ s hvězdičkou zmizelo a „Vymazat vše“ zůstalo v menu Správa rosteru",
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
check("počet kusů je česky správně (1 kus, 2 kusy, 5 kusů)",
  stav.tvary.length === 3
    && /Máš rozděláno 1 kus$/.test(stav.tvary[0])
    && /Máš rozděláno 2 kusy$/.test(stav.tvary[1])
    && /Máš rozděláno 5 kusů$/.test(stav.tvary[2]),
  JSON.stringify(stav.tvary));
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
// 100 % je až za přepínači: plyne z IV, nedá se přepnout, a kdyby stálo
// mezi nimi, posunulo by u dokonalého kusu všechny ostatní značky.
const PORADI_TAGU = ["SHADOW", "PURIFIED", "DMAX", "CUTE", "SHINY", "100%", "LUCKY"];
const vPoradi = (t) => { const i = t.map((x) => PORADI_TAGU.indexOf(x)).filter((x) => x > -1); return i.every((v, k) => !k || v > i[k - 1]); };
check("značky u jména v kartě: DMAX, 100%, CUTE",
  d7.tagy.indexOf("DMAX") > -1 && d7.tagy.indexOf("100%") > -1 && d7.tagy.indexOf("CUTE") > -1 && vPoradi(d7.tagy),
  JSON.stringify(d7.tagy));
// V hlavičce detailu jdou automatické značky (LEG, MYT, UB, 100 %) až za
// osobní: jinak je legendární nebo dokonalý kus posune a oko je hledá
// pokaždé jinde.
const PORADI_DETAIL = ["SHADOW", "PURIFIED", "DMAX", "CUTE", "SHINY", "LUCKY", "LEG", "MYT", "UB", "100%"];
const vPoradiDetail = (t) => {
  const i = t.map((x) => PORADI_DETAIL.indexOf(x)).filter((x) => x > -1);
  return i.every((v, k) => !k || v > i[k - 1]);
};
check("…i v detailu, kde automatické značky stojí až za osobními",
  vPoradiDetail(d7.detailTagy) && d7.detailTagy.indexOf("100%") === d7.detailTagy.length - 1,
  JSON.stringify(d7.detailTagy));
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
  const sestavy = utokyRhydon ? [...utokyRhydon.querySelectorAll(".atlas-sestava")] : [];
  out.sestavy = { radku: sestavy.length,
    chipu: sestavy.map((x) => x.querySelectorAll(".d-move").length),
    barevne: sestavy.every((x) => [...x.querySelectorAll(".d-type")].every((t) => !!t.style.background)),
    predpony: sestavy.some((x) => /Teď|Po evo/.test(x.textContent)),
    klice: sestavy.map((x) => x.dataset.sestava),
    tipy: sestavy.every((x) => !!x.getAttribute("data-tip")),
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
// Hodnoty IV jsou v pruzích vedle, v hlavičce je jeden výrazný řádek (Lukáš 19. 9.).
check("nahoře jeden řádek CP · level · IV procento, čísla bez „.0“",
  d8.identita.some((t) => /^4\s357 CP · L48 · 98 %$/.test(t)) && !d8.identita.some((t) => /^IV \d/.test(t)),
  JSON.stringify(d8.identita));
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
check("…sestavy jsou barevné chipy bez předpony, nic se neopakuje a vejde se to",
  d8.sestavy.radku >= 1 && d8.sestavy.chipu.every((n) => n >= 2) && d8.sestavy.barevne
    && !d8.sestavy.predpony && new Set(d8.sestavy.klice).size === d8.sestavy.klice.length
    && d8.sestavy.tipy && d8.sestavy.prepad === 0,
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
  // Sloupce hlavičky si výšku řídí obsahem (shadow kus má řádek navíc, útoků
  // může být šest) — hlídá se u nich jen pozice a šířka.
  const merPozice = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return Math.round(r.top) + "/" + Math.round(r.width); };
  const bloky = { identita: ".atlas-detail-identity", verdikt: ".atlas-verdict-radek",
    znacky: ".detail-title", evoluce: ".atlas-evolution-column", prvniSekce: "[data-detail-section]",
    vyuziti: ".atlas-vyuziti" };
  const blokyPozice = { staty: ".atlas-ident-stats", utoky: ".atlas-ident-utoky" };
  const out = { kusy: [], pokryti: 0, cena: [] };
  for (const r of P.getRows()) {
    A.openDetail(r.id);
    await cekej(700);
    const m = document.getElementById("atlasModal");
    const zaznam = { jm: r.pokemon };
    Object.keys(bloky).forEach((k) => { zaznam[k] = mer(m.querySelector(bloky[k])); });
    Object.keys(blokyPozice).forEach((k) => { zaznam[k] = merPozice(m.querySelector(blokyPozice[k])); });
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

// ------------------------------- čištění boxu ukazuje stejný rozbor jako detail
console.log("\n10) Čištění boxu má stejný rozbor jako detail kusu");
const ROSTER10 = [
  { pokemon: "Rhydon", cp: 1811, level: 20, ivAtk: 15, ivDef: 14, ivSta: 15, fastMove: "Mud Slap", charged1: "Earthquake" },
  { pokemon: "Garchomp", cp: 4357, level: 48, ivAtk: 14, ivDef: 15, ivSta: 15, fastMove: "Dragon Tail", charged1: "Earth Power", dynamax: "Ano" },
  { pokemon: "Eevee", cp: 800, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 },
  // Umbreon má ligu, kterou hraje se slabým pořadím — jediný „červený" stav.
  { pokemon: "Umbreon", cp: 1504, level: 24, ivAtk: 10, ivDef: 12, ivSta: 12 }
];
async function boxKontrola(page) {
  return page.evaluate(async () => {
    const P = window.__pgo;
    const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
    document.getElementById("boxModeBtn").click();
    await cekej(350);
    { const ok = document.getElementById("appOknoOk");
      if (ok && !document.getElementById("appOkno").hidden) ok.click(); }
    await cekej(900);
    // „vidět" = má výšku a není průhledné (sbalené bloky se schovávají přes max-height)
    const vidno = (s) => { const e = document.querySelector(s); if (!e || e.offsetParent === null) return false;
      return e.getBoundingClientRect().height > 2 && getComputedStyle(e).opacity !== "0"; };
    const prebytek = () => { const s = document.querySelector(".bm-scroll"); return Math.max(0, s.scrollHeight - s.clientHeight); };
    const rozbor = () => {
      const b = document.querySelector("#bmBody .atlas-box-rozbor");
      if (!b) return null;
      return { jmeno: (b.querySelector(".atlas-ident-text h2") || {}).textContent || "",
        staty: b.querySelectorAll(".atlas-ident-stats > .d-box").length,
        utoky: vidno(".atlas-box-rozbor .atlas-ident-utoky"),
        verdikt: vidno(".atlas-box-rozbor .atlas-verdict-radek"),
        krok: !!b.querySelector(".atlas-krok"),
        znacky: b.querySelectorAll(".detail-title .rarity-chip").length,
        vyhoda: !!b.querySelector(".detail-title .atlas-vyhoda"),
        ligyTag: (b.querySelector("[data-detail-section=ligy]") || {}).tagName || "",
        ligyVidet: vidno(".atlas-box-rozbor [data-detail-section=ligy]"),
        evoluceVidet: vidno(".atlas-box-rozbor .atlas-evolution-column"),
        vyuzitiVidet: vidno(".atlas-box-rozbor .atlas-vyuziti"),
        vyuziti: b.querySelectorAll(".atlas-vyuziti .d-role").length,
        // hlavička musí stát v obou stavech stejně (obrázek, jméno, staty)
        panel: (() => { const e = document.querySelector(".bm-panel"); const r = e.getBoundingClientRect();
          return [Math.round(r.width), Math.round(r.height)]; })(),
        // značky musí začínat na stejném místě i u kusu s jedním typem
        znackaX: (() => { const e = b.querySelector(".detail-title .rarity-chip"); return e ? Math.round(e.getBoundingClientRect().left) : -1; })(),
        typu: b.querySelectorAll(".detail-title .d-type:not(.atlas-typ-mezera)").length,
        // nadpisy všech čtyř sloupců (i popisek formy) začínají na stejné výšce
        nadpisyY: [...new Set([...b.querySelectorAll(".atlas-ident-stats .d-box-h, .atlas-ident-utoky .d-box-h")]
          .map((e) => Math.round(e.getBoundingClientRect().top)))],
        formaY: (() => { const e = b.querySelector(".atlas-ident-text .atlas-eyebrow");
          return e ? Math.round(e.getBoundingClientRect().top) : -1; })(),
        // útoky nesmí být prázdné ani přetékat — každý kus má doporučené útoky
        utokuChipu: b.querySelectorAll(".atlas-ident-utoky .d-move").length,
        utokyPretek: (() => { const e = b.querySelector(".atlas-ident-utoky");
          return e ? Math.max(0, e.scrollHeight - e.clientHeight) : -1; })(),
        utokyKdy: [...b.querySelectorAll(".atlas-ident-utoky .atlas-sestava-kdy")].map((e) => e.textContent),
        // evoluční řada: šipky a vystředěné stupně
        sipka: (() => { const e = b.querySelector(".d-evo-sip");
          return e ? Math.round(parseFloat(getComputedStyle(e).fontSize)) : -1; })(),
        evoStred: (() => { const st = [...b.querySelectorAll(".d-evo-stupen")];
          const sl = b.querySelector(".atlas-evolution-column .d-evo");
          if (!st.length || !sl) return -1;
          const s = sl.getBoundingClientRect();
          return Math.max(...st.map((e) => { const r = e.getBoundingClientRect();
            return Math.abs((r.left + r.width / 2) - (s.left + s.width / 2)); })); })(),
        // útoky: popisek vlevo, útoky pod sebou a všechny na stejné svislici
        utokySloupcu: b.querySelectorAll(".atlas-ident-utoky .atlas-sestava-utoky").length,
        utokyX: [...new Set([...b.querySelectorAll(".atlas-ident-utoky .d-move")]
          .map((e) => Math.round(e.getBoundingClientRect().left)))],
        typRadku: [...new Set([...b.querySelectorAll(".atlas-ident-utoky .d-type")]
          .map((e) => Math.round(e.getBoundingClientRect().height)))],
        // staty, IV a strop jsou plovoucí text bez rámečku
        statyRam: [...new Set([...b.querySelectorAll(".atlas-ident-stats > .d-box")]
          .map((e) => getComputedStyle(e).borderTopWidth + "|" + getComputedStyle(e).backgroundColor))],
        // ligy: řádky stejně vysoké a text se do nich vejde
        ligyVysky: [...new Set([...b.querySelectorAll(".d-ligy-tab .d-lg-in")]
          .map((e) => Math.round(e.getBoundingClientRect().height)))],
        ligyPretek: Math.max(0, ...[...b.querySelectorAll(".d-ligy-tab .d-lg-in")]
          .map((e) => e.scrollHeight - e.clientHeight), 0),
        ligyLinka: [...new Set([...(([...b.querySelectorAll(".d-ligy-tab tr")].pop() || { children: [] }).children)]
          .map((e) => Math.round(parseFloat(getComputedStyle(e).borderBottomWidth))))],
        // herní využití: hodnota nikdy nezalomená na druhý řádek
        vyuzitiRadku: [...new Set([...b.querySelectorAll(".atlas-vyuziti .d-role-v")]
          .map((e) => Math.round(e.getBoundingClientRect().height)))],
        // evoluce: obrázky mají pevný rámeček a stejný počet stupňů =
        // stejné pozice (větvené řady se tím řídit nemusí)
        evoRamu: b.querySelectorAll(".atlas-evolution-column .atlas-evo-ram").length,
        evoHusty: !!b.querySelector(".atlas-evolution-column .d-evo.husty"),
        evoY: (() => { const pan = document.querySelector(".bm-panel");
          if (!pan) return []; const pr = pan.getBoundingClientRect();
          return [...b.querySelectorAll(".atlas-evolution-column .atlas-evo-ram")]
            .map((e) => Math.round(e.getBoundingClientRect().top - pr.top)); })(),
        // pruh kvality patří do širokého detailu, v boxu ukusuje místo
        ligyPruh: b.querySelectorAll(".d-ligy-tab .d-lg-bar").length > 0
          && [...b.querySelectorAll(".d-ligy-tab .d-lg-bar")].some((e) => e.getBoundingClientRect().width > 0),
        // tabulka lig: slabé buňky mají podbarvení a poslední řádek nemá linku
        ligySlaby: (() => { const e = b.querySelector(".d-ligy-tab td.d-lg-slaby");
          return e ? getComputedStyle(e).backgroundColor : ""; })(),
        ligyPosledni: (() => { const r = [...b.querySelectorAll(".d-ligy-tab tr")].pop();
          const c = r && r.querySelector("td");
          return c ? Math.round(parseFloat(getComputedStyle(c).borderBottomWidth)) : -1; })(),
        hlavicka: [".atlas-ident-obr", ".atlas-ident-text h2", ".atlas-ident-stats", ".atlas-ident-utoky"]
          .map((s) => { const e = b.querySelector(s); if (!e) return [-1, -1]; const r = e.getBoundingClientRect();
            return [Math.round(r.left), Math.round(r.width)]; }) };
    };
    const out = { sbalene: [], rozbalene: [],
      // Rozbor je vzdy cely, takze na nizkem okne muze presahnout. Co
      // presahnout NESMI, jsou tlacitka Pustit/Nechat pod nim.
      tlacitkaVidet: (function () {
        const d = document.getElementById("bmDrop"), k = document.getElementById("bmKeep");
        if (!d || !k) return false;
        const rd = d.getBoundingClientRect(), rk = k.getBoundingClientRect();
        return rd.bottom <= window.innerHeight + 1 && rk.bottom <= window.innerHeight + 1
          && rd.height > 10 && rk.height > 10;
      })(),
      zamek: getComputedStyle(document.body).overflow === "hidden",
      schovane: ["#bmBody > .bm-head", "#bmBody > .bm-verdikt", "#bmBody > .bm-why", "#bmBody > .bm-roles", "#bmBody > .bm-ligy"].filter((s) => vidno(s)),
      // Lišta „ve hře jsem s ním něco udělal" patří nad evoluční řadu:
      // v pruhu postupu měnila jeho šířku podle počtu tlačítek.
      hraPruh: (function () {
        const pruh = document.querySelector("#boxMode .atlas-box-rozbor > .hra-pruh");
        const evo = document.querySelector("#boxMode .atlas-evolution-column");
        if (!pruh || !evo) return false;
        // Lista sedi v hornim okraji sloupce s evoluci; sam strom zacina
        // pod ni. Merit proti okraji sloupce uz proto nedava smysl.
        const strom = evo.querySelector("summary, .d-evo") || evo;
        return !document.querySelector("#boxMode .bm-top .hra-pruh")
          && pruh.getBoundingClientRect().bottom <= strom.getBoundingClientRect().top + 4;
      })(),
      pozice: (document.getElementById("bmPos") || {}).textContent || "" };
    for (let i = 0; i < 4; i++) {
      out.sbalene.push({ r: rozbor(), prebytek: prebytek() });
      document.getElementById("bmKeep").click();
      await cekej(650);
    }
    out.prvni = out.sbalene[0].r;
    out.druhy = out.sbalene[1].r;
    out.pozice2 = (document.getElementById("bmPos") || {}).textContent || "";
    P.boxZavritNatvrdo();
    await cekej(250);
    document.getElementById("boxModeBtn").click();
    await cekej(350);
    { const ok = document.getElementById("appOknoOk");
      if (ok && !document.getElementById("appOkno").hidden) ok.click(); }
    await cekej(800);
    document.getElementById("bmVicBtn")?.click();
    await cekej(800);
    for (let i = 0; i < 4; i++) {
      out.rozbalene.push({ r: rozbor(), prebytek: prebytek() });
      document.getElementById("bmKeep").click();
      await cekej(650);
    }
    P.boxZavritNatvrdo();
    return out;
  });
}
const p10 = await otevri(1500, ROSTER10);
await p10.setViewportSize({ width: 1500, height: 1000 });
const d10 = await boxKontrola(p10);
await p10.close();
check("čištění boxu vykreslí rozbor jako v detailu (hlavička, staty, útoky, verdikt, značky, využití)",
  !!d10.prvni && d10.prvni.staty === 3 && d10.prvni.utoky && d10.prvni.verdikt && d10.prvni.krok
    && d10.prvni.znacky >= 4 && d10.prvni.vyhoda && d10.prvni.vyuziti === 4, JSON.stringify(d10.prvni));
check("…a nic z toho nezůstane ve staré podobě (zjednodušené bloky enginu jsou schované)",
  d10.schovane.length === 0, d10.schovane.join(", "));
check("…lišta „ve hře jsem s ním něco udělal“ stojí nad evoluční řadou",
  d10.hraPruh, String(d10.hraPruh));
check("…a po rozhodnutí se přepne na další kus se stejným rozborem",
  !!d10.druhy && d10.druhy.jmeno !== d10.prvni.jmeno && d10.druhy.staty === 3 && d10.druhy.utoky
    && d10.pozice2 !== d10.pozice,
  JSON.stringify({ prvni: d10.prvni.jmeno, druhy: d10.druhy && d10.druhy.jmeno }));
// Rozbor uz se nesbaluje: hned je videt vsechno vcetne tabulky lig.
check("rozbor je hned cely — rozhodování, evoluční řada i tabulka Lig",
  [...d10.sbalene, ...d10.rozbalene].every((x) => x.r && x.r.vyuzitiVidet && x.r.verdikt
    && x.r.evoluceVidet && x.r.ligyVidet && x.r.utoky && x.r.staty === 3 && x.r.ligyTag === "SECTION"),
  JSON.stringify(d10.sbalene.map((x) => x.r && [x.r.vyuzitiVidet, x.r.ligyVidet, x.r.evoluceVidet, x.r.utoky])));
// Hlavička se rozbalením nesmí hnout ani zmenšit (pár pixelů z centrování panelu tolerujeme).
check("…a hlavička zůstane v obou stavech na stejném místě a ve stejné velikosti",
  d10.sbalene.every((x, i) => x.r.hlavicka.every((v, k) =>
    Math.abs(v[0] - d10.rozbalene[i].r.hlavicka[k][0]) <= 4 && Math.abs(v[1] - d10.rozbalene[i].r.hlavicka[k][1]) <= 4)),
  JSON.stringify({ sbalene: d10.sbalene.map((x) => x.r.hlavicka), rozbalene: d10.rozbalene.map((x) => x.r.hlavicka) }));
check("panel čištění boxu má v každém stavu pevnou velikost",
  new Set(d10.sbalene.map((x) => x.r.panel.join("x"))).size === 1
    && new Set(d10.rozbalene.map((x) => x.r.panel.join("x"))).size === 1,
  JSON.stringify({ sbalene: d10.sbalene.map((x) => x.r.panel), rozbalene: d10.rozbalene.map((x) => x.r.panel) }));
check("…a značky začínají na stejném místě i u kusu s jedním typem",
  new Set(d10.sbalene.map((x) => x.r.znackaX)).size === 1
    && d10.sbalene.some((x) => x.r.typu === 1) && d10.sbalene.some((x) => x.r.typu === 2),
  JSON.stringify(d10.sbalene.map((x) => [x.r.jmeno, x.r.typu, x.r.znackaX])));
check("v čištění boxu se neobjeví posuvník (ani rozbalené, 1500×1000)",
  d10.sbalene.every((x) => x.prebytek === 0) && d10.rozbalene.every((x) => x.prebytek === 0),
  JSON.stringify({ sbalene: d10.sbalene.map((x) => x.prebytek), rozbalene: d10.rozbalene.map((x) => x.prebytek) }));
const p10b = await otevri(1400, ROSTER10);
await p10b.setViewportSize({ width: 1400, height: 900 });
const d10b = await boxKontrola(p10b);
await p10b.close();
check("…a na nižším okně (1400×900) zůstanou vidět rozhodovací tlačítka",
  d10b.tlacitkaVidet === true, JSON.stringify(d10b.tlacitkaVidet));
// Čtyři boxy hlavičky (staty, IV, strop, útoky) musí mít pořád stejnou výšku
// a útoky nesmí být nikdy prázdné — doporučené útoky má každý kus.
// Nadpisy čtyř sloupců i popisek formy stojí na jednom řádku a mezi kusy se
// nehnou (sbalený a rozbalený stav mají každý svou výšku panelu).
check("nadpisy sloupců hlavičky stojí na řádku s formou a nehýbou se mezi kusy",
  [d10.sbalene, d10.rozbalene].every((stav) => stav.every((x) => x.r.nadpisyY.length === 1
      && Math.abs(x.r.formaY - x.r.nadpisyY[0]) <= 2)
    && new Set(stav.map((x) => x.r.nadpisyY[0])).size === 1),
  JSON.stringify([...d10.sbalene, ...d10.rozbalene].map((x) => [x.r.jmeno, x.r.nadpisyY, x.r.formaY])));
// Popisek řádku po evoluci nese jméno vyvinuté formy (u Eevee je to jediné,
// co řekne, o kterou z osmi jde); „teď“ a „má“ jsou řádky současného kusu.
check("…box útoků má vždycky obsah, nepřetéká a rozlišuje současné útoky od těch po evoluci",
  [...d10.sbalene, ...d10.rozbalene].every((x) => x.r.utokuChipu >= 2 && x.r.utokyPretek === 0)
    && [...d10.sbalene, ...d10.rozbalene].some((x) =>
      x.r.utokyKdy.some((k) => k !== "teď" && k !== "má")),
  JSON.stringify([...d10.sbalene, ...d10.rozbalene].map((x) => [x.r.jmeno, x.r.utokuChipu, x.r.utokyPretek, x.r.utokyKdy])));
check("evoluční řada je vystředěná",
  d10.sbalene.every((x) => x.r.evoStred <= 2) && d10.rozbalene.every((x) => x.r.evoStred <= 2),
  JSON.stringify({ sbalene: d10.sbalene.map((x) => [x.r.jmeno, x.r.evoStred, x.r.sipka]),
    rozbalene: d10.rozbalene.map((x) => [x.r.jmeno, x.r.evoStred, x.r.sipka]) }));
check("v rozbalené tabulce lig má slabá liga podbarvení a poslední řádek nemá linku",
  d10.rozbalene.some((x) => x.r.ligySlaby && !/^rgba\(0, 0, 0, 0\)$/.test(x.r.ligySlaby))
    && d10.rozbalene.every((x) => x.r.ligyPosledni === 0),
  JSON.stringify(d10.rozbalene.map((x) => [x.r.jmeno, x.r.ligySlaby, x.r.ligyPosledni])));
const vse10 = [...d10.sbalene, ...d10.rozbalene];
check("útoky stojí pod sebou, popisek vlevo a typ se nikdy nezalomí",
  vse10.every((x) => x.r.utokySloupcu >= 1 && x.r.utokyX.length === 1 && x.r.typRadku.length === 1),
  JSON.stringify(vse10.map((x) => [x.r.jmeno, x.r.utokySloupcu, x.r.utokyX, x.r.typRadku])));
check("staty, IV a strop jsou plovoucí text bez rámečku",
  vse10.every((x) => x.r.statyRam.length === 1 && /^0px\|rgba\(0, 0, 0, 0\)$/.test(x.r.statyRam[0])),
  JSON.stringify(vse10.map((x) => [x.r.jmeno, x.r.statyRam])));
check("řádky tabulky lig jsou stejně vysoké i se třemi řádky textu",
  d10.rozbalene.every((x) => x.r.ligyVysky.length === 1 && x.r.ligyPretek === 0)
    && new Set(d10.rozbalene.map((x) => x.r.ligyVysky[0])).size === 1,
  JSON.stringify(d10.rozbalene.map((x) => [x.r.jmeno, x.r.ligyVysky, x.r.ligyPretek])));
check("…a pod posledním řádkem tabulky lig nezůstane kus linky",
  d10.rozbalene.every((x) => x.r.ligyLinka.every((v) => v === 0)),
  JSON.stringify(d10.rozbalene.map((x) => [x.r.jmeno, x.r.ligyLinka])));
check("v herním využití se hodnota vejde na jeden řádek",
  vse10.every((x) => x.r.vyuzitiRadku.length === 1),
  JSON.stringify(vse10.map((x) => [x.r.jmeno, x.r.vyuzitiRadku])));
check("ikony evoluční řady mají pevný rámeček a při stejném počtu stupňů stejné místo",
  vse10.every((x) => x.r.evoRamu > 0)
    // Zaokrouhlení při dělení pruhů dá občas rozdíl 1 px; skoky, které se
    // hlídají, byly desítky pixelů.
    && (() => { const skupiny = {};
      d10.sbalene.filter((x) => !x.r.evoHusty).forEach((x) => {
        (skupiny[x.r.evoY.length] = skupiny[x.r.evoY.length] || []).push(x.r.evoY); });
      return Object.keys(skupiny).some((k) => skupiny[k].length > 1)
        && Object.keys(skupiny).every((k) => skupiny[k].every((y) =>
          y.every((v, i) => Math.abs(v - skupiny[k][0][i]) <= 2))); })(),
  JSON.stringify(d10.sbalene.map((x) => [x.r.jmeno, x.r.evoHusty, x.r.evoY])));
check("…a pruh kvality v úzkém sloupci boxu nezabírá místo",
  d10.rozbalene.every((x) => x.r.ligyPruh === false),
  JSON.stringify(d10.rozbalene.map((x) => [x.r.jmeno, x.r.ligyPruh])));
// Dva kusy téhož druhu za sebou: evoluční řada se nesmí skládat znovu,
// jinak se obrázky načítají a v přechodu problikávají.
const pBlik = await otevri(1500, [
  { pokemon: "Rhydon", cp: 1811, level: 20, ivAtk: 15, ivDef: 14, ivSta: 15 },
  { pokemon: "Rhydon", cp: 1500, level: 18, ivAtk: 10, ivDef: 10, ivSta: 10 },
  { pokemon: "Garchomp", level: 15, ivAtk: 14, ivDef: 15, ivSta: 15 }
]);
const dBlik = await pBlik.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("boxModeBtn").click();
  await cekej(900);
  // předěl sekce drží ruku — v testu ho odklikneme
  { const ok = document.getElementById("appOknoOk");
    if (ok && !document.getElementById("appOkno").hidden) ok.click(); }
  await cekej(250);
  const znacka = () => document.querySelector("#bmBody .atlas-evolution-column");
  const prvni = znacka();
  if (!prvni) return { chyba: "bez evoluční řady" };
  prvni.dataset.blikTest = "1";
  const jm = () => (document.querySelector("#bmBody .atlas-ident-text h2") || {}).textContent || "";
  const a = jm();
  document.getElementById("bmKeep").click();
  await cekej(700);
  const stejny = { jmeno: [a, jm()], drzi: !!(znacka() && znacka().dataset.blikTest) };
  document.getElementById("bmKeep").click();
  await cekej(700);
  const jiny = { jmeno: jm(), drzi: !!(znacka() && znacka().dataset.blikTest) };
  window.__pgo.boxZavritNatvrdo();
  return { stejny, jiny };
});
await pBlik.close();
check("u dvou kusů téhož druhu se evoluční řada nepřekresluje (ikony neproblikávají)",
  !dBlik.chyba && dBlik.stejny.drzi === true && dBlik.jiny.drzi === false,
  JSON.stringify(dBlik));
check("pod otevřeným čištěním boxu se stránka neroluje (žádný posuvník vpravo)",
  d10.zamek === true, String(d10.zamek));

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

// ------------------------------------------------- dodělávky v detailu
// Detail má vypadat jako rozbor v čištění boxu: ligy uzavřené linkou, čtyři
// buňky pod nimi ne nalepené, evoluční sloupec přes celou výšku obsahu a
// útoky celé — Eevee jich ukáže tři sestavy (má / teď / po evoluci).
console.log("\n7) Detail — ligy, evoluční sloupec, útoky");
const pDet = await otevri(1500, [
  { pokemon: "Eevee", cp: 900, level: 20, ivAtk: 14, ivDef: 15, ivSta: 15,
    fastMove: "Quick Attack", charged1: "Last Resort", charged2: "Swift" },
  { pokemon: "Azumarill", cp: 1500, level: 30, ivAtk: 0, ivDef: 15, ivSta: 15 },
  { pokemon: "Machamp", cp: 3000, level: 35, ivAtk: 15, ivDef: 14, ivSta: 13 },
]);
const dDet = await pDet.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  A.openDetail(P.getRows().filter((r) => r.pokemon === "Eevee")[0].id);
  await new Promise((r) => setTimeout(r, 1400));
  const r = (sel) => {
    const e = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { t: Math.round(b.top), b: Math.round(b.bottom) };
  };
  const ligy = [...document.querySelectorAll("#atlasDetailContent .atlas-detail-section")]
    .filter((e) => e.querySelector(".d-ligy-tab"))[0];
  const utoky = document.querySelector(".atlas-drawer .atlas-ident-utoky");
  return {
    verdikt: r(".atlas-verdict-radek"),
    bunky: r("#atlasDetailContent .d-roles.atlas-vyuziti"),
    evo: r("#atlasDetailContent .atlas-evolution-column"),
    // Sekce lig je bez rámečku (22. 9.) — linka patří pod hlavičku sloupců.
    ligySpodni: (function () {
      const th = ligy ? ligy.querySelector(".d-ligy-tab tr:first-child > th") : null;
      return th ? parseFloat(getComputedStyle(th).borderBottomWidth) : -1;
    })(),
    ligy: r(ligy),
    evoVnitrniLinka: [...document.querySelectorAll("#atlasDetailContent .atlas-evolution-column .d-evo")]
      .some((e) => parseFloat(getComputedStyle(e).borderTopWidth) > 0
        || parseFloat(getComputedStyle(e).borderBottomWidth) > 0),
    utoky: utoky ? { scroll: utoky.scrollHeight, klient: utoky.clientHeight,
      sestav: document.querySelectorAll(".atlas-drawer .atlas-sestava").length } : null,
    // Měří se RÁMEČEK, ne <img>: sprite má vlastní zvětšení, takže jeho
    // vlastní rámec z obalu vyčuhuje (a obal ho ořízne).
    sprite: r(".atlas-drawer .atlas-detail-identity .atlas-ident-obr"),
    hlavicka: r(".atlas-drawer .atlas-detail-identity"),
  };
});
await pDet.close();
check("tabulka lig má linku pod hlavičkou sloupců", dDet.ligySpodni >= 1, JSON.stringify(dDet.ligySpodni));
check("…a čtyři buňky pod nimi nejsou nalepené",
  dDet.bunky && dDet.ligy && dDet.bunky.t - dDet.ligy.b >= 18,
  JSON.stringify({ ligy: dDet.ligy, bunky: dDet.bunky }));
check("evoluční sloupec začíná u verdiktu a končí se spodkem buněk",
  dDet.evo && dDet.verdikt && dDet.bunky
  && Math.abs(dDet.evo.t - dDet.verdikt.t) <= 2 && Math.abs(dDet.evo.b - dDet.bunky.b) <= 2,
  JSON.stringify({ evo: dDet.evo, verdikt: dDet.verdikt, bunky: dDet.bunky }));
check("…a nemá v sobě linku navíc", dDet.evoVnitrniLinka === false, String(dDet.evoVnitrniLinka));
// Dřív tu byly tři řádky: co kus má, nejlepší sestava jeho druhu a sestava
// po evoluci. Prostřední zmizel — u kusu s vyplněnými útoky ho nesla už šipka
// u jeho vlastních útoků a byla to duplikace. Podstatné zůstává: co je tam,
// se vejde celé.
check("sestavy útoků se vejdou celé (nic se neuřízne)",
  dDet.utoky && dDet.utoky.sestav >= 2 && dDet.utoky.scroll <= dDet.utoky.klient + 1,
  JSON.stringify(dDet.utoky));
check("…a ikona zůstane na střed hlavičky",
  dDet.sprite && dDet.hlavicka
  && Math.abs((dDet.sprite.t + dDet.sprite.b) / 2 - (dDet.hlavicka.t + dDet.hlavicka.b) / 2) <= 3,
  JSON.stringify({ sprite: dDet.sprite, hlavicka: dDet.hlavicka }));

// ------------------------------------------------ úpravy kusu a lišta příkazů
console.log("\n8) Úprava kusu, lišta příkazů, popis v evoluční řadě");
const pUpr = await otevri(1720, [
  { pokemon: "Jolteon", cp: 2218, level: 27.5, ivAtk: 14, ivDef: 11, ivSta: 12, note: "Jo1d82" },
  { pokemon: "Tyrunt", cp: 570, level: 13, ivAtk: 14, ivDef: 9, ivSta: 4, forma: "Shadow" },
  { pokemon: "Machamp", cp: 3000, level: 35, ivAtk: 15, ivDef: 14, ivSta: 13 },
]);
const dUpr = await pUpr.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const r = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), w: Math.round(b.width) };
  };
  // lišta příkazů: „projít box" místo „čistit box" a nabídka nad rosterem
  const tlacitko = (document.getElementById("boxModeBtn") || {}).textContent || "";
  const menu = document.querySelector(".atlas-roster-commands");
  menu.open = true;
  menu.dispatchEvent(new Event("toggle"));
  await cekej(150);
  const panelPozice = getComputedStyle(menu.lastElementChild).position;
  const panel = menu.lastElementChild.getBoundingClientRect();
  const nadRosterem = document.elementFromPoint(panel.x + 20, panel.y + 20);
  const lista = document.querySelector(".atlas-roster-fixed-controls");
  const posuv = lista ? lista.scrollHeight - lista.clientHeight : 0;
  menu.open = false;
  menu.dispatchEvent(new Event("toggle"));

  // detail se otevřením úprav nesmí hnout
  const id = P.getRows().filter((x) => x.pokemon === "Jolteon")[0].id;
  A.openDetail(id);
  await cekej(1200);
  const pred = { hlavicka: r(".atlas-drawer .atlas-detail-identity"), verdikt: r(".atlas-verdict-radek") };
  window.AtlasEditRow(id);
  await cekej(600);
  const po = { hlavicka: r(".atlas-drawer .atlas-detail-identity"), verdikt: r(".atlas-verdict-radek") };
  const editor = document.getElementById("atlasRowEditor");
  const editorRect = r("#atlasRowEditor");
  const drawer = r(".atlas-drawer");
  const out = {
    tlacitko: tlacitko.trim(),
    panelFixed: panelPozice,
    nadRosterem: nadRosterem ? String(nadRosterem.tagName) : "nic",
    posuv,
    nehnulo: JSON.stringify(pred) === JSON.stringify(po),
    vedle: !!editor && editor.classList.contains("atlas-editor-vedle")
      && !!editorRect && !!drawer && editorRect.l + editorRect.w <= drawer.l,
    checkboxy: document.querySelectorAll("#atlasRowEditor input[type=checkbox]").length,
    prazdnyUtok: [...document.querySelectorAll("#atlasRowEditor .uv-jmeno")]
      .every((e) => !/útok/i.test(e.textContent)),
  };
  editor.remove();
  // popis pod ikonou v evoluční řadě se nesmí ořezávat
  A.openDetail(P.getRows().filter((x) => x.pokemon === "Tyrunt")[0].id);
  await cekej(1200);
  out.popis = [...document.querySelectorAll("#atlasDetailContent .atlas-evo-popis")]
    .map((e) => e.scrollHeight - e.clientHeight);
  out.podminka = [...document.querySelectorAll("#atlasDetailContent .d-evo-kus u")]
    .map((e) => Math.round(e.getBoundingClientRect().height));
  return out;
});
await pUpr.close();
check("v liště příkazů je „Projít pokémony“", /Projít pokémony/.test(dUpr.tlacitko), dUpr.tlacitko);
check("nabídka „Správa rosteru“ stojí nad rosterem a nedělá posuvník",
  dUpr.panelFixed === "fixed" && dUpr.nadRosterem === "BUTTON" && dUpr.posuv === 0,
  JSON.stringify(dUpr));
check("úprava kusu se otevře vedle detailu a detailem nehne",
  dUpr.vedle === true && dUpr.nehnulo === true, JSON.stringify(dUpr));
check("…bez zaškrtávátek značek a bez popisku v prázdném výběru útoku",
  dUpr.checkboxy === 0 && dUpr.prazdnyUtok === true, JSON.stringify(dUpr));
check("popis pod ikonou v evoluční řadě se neořezává",
  dUpr.popis.every((v) => v <= 0) && dUpr.podminka.every((v) => v >= 12),
  JSON.stringify({ popis: dUpr.popis, podminka: dUpr.podminka }));

// ---------------------------------- nadpisy, tečky u útoků, rozvětvená řada
console.log("\n9) Nadpisy, tečky u útoků, rozvětvená řada");
const pMix = await otevri(1720, [
  { pokemon: "Machamp", cp: 3000, level: 35, ivAtk: 15, ivDef: 14, ivSta: 13,
    fastMove: "Karate Chop", charged1: "Cross Chop" },
  { pokemon: "Eevee", cp: 900, level: 20, ivAtk: 14, ivDef: 15, ivSta: 15,
    fastMove: "Quick Attack", charged1: "Last Resort" },
  { pokemon: "Azumarill", cp: 1500, level: 30, ivAtk: 0, ivDef: 15, ivSta: 15 },
]);
const dMix = await pMix.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  out.eyebrowRoster = document.querySelectorAll(".atlas-heading .atlas-eyebrow").length;
  out.ctaRoster = document.querySelectorAll(".atlas-heading .atlas-cta").length;
  A.go("home");
  await cekej(600);
  out.eyebrowHome = document.querySelectorAll(".atlas-heading .atlas-eyebrow").length;
  out.ctaHome = document.querySelectorAll(".atlas-heading .atlas-cta").length;
  A.go("roster"); A.refresh();
  await cekej(700);
  // tečka u útoku podle toho, jak je dobrý
  A.openDetail(P.getRows().filter((r) => r.pokemon === "Machamp")[0].id);
  await cekej(1200);
  out.tecky = [...document.querySelectorAll(".atlas-drawer .atlas-utok-radek")].map((e) =>
    ((e.querySelector(".atlas-utok-tecka") || {}).dataset || {}).stav + "|"
    + (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 20));
  // rozvětvená řada: dlaždice musí být čitelně široké
  A.openDetail(P.getRows().filter((r) => r.pokemon === "Eevee")[0].id);
  await cekej(1200);
  const kusy = [...document.querySelectorAll("#atlasDetailContent .d-evo.husty .d-evo-kus")];
  out.sirkaDlazdic = kusy.map((e) => Math.round(e.getBoundingClientRect().width));
  out.sirkaPodminek = [...document.querySelectorAll("#atlasDetailContent .d-evo-kus u.d-evo-podminka")]
    .map((e) => Math.round(e.getBoundingClientRect().width));
  return out;
});
await pMix.close();
check("„GO ATLAS · TESTOVACÍ VERZE“ nad nadpisem už není",
  dMix.eyebrowRoster === 0 && dMix.eyebrowHome === 0, JSON.stringify(dMix));
check("tlačítko „Projít pokémony“ u nadpisu je jen na Přehledu",
  dMix.ctaHome === 1 && dMix.ctaRoster === 0, JSON.stringify(dMix));
check("u útoku svítí tečka podle jeho kvality",
  dMix.tecky.some((x) => x.startsWith("dobry|")) && dMix.tecky.some((x) => x.startsWith("preucit|")),
  JSON.stringify(dMix.tecky));
check("rozvětvená řada má čitelně široké dlaždice i podmínky",
  dMix.sirkaDlazdic.length >= 6 && dMix.sirkaDlazdic.every((v) => v >= 95)
  && dMix.sirkaPodminek.every((v) => v >= 60),
  JSON.stringify({ dlazdice: dMix.sirkaDlazdic, podminky: dMix.sirkaPodminek }));

// ------------------------- editor, jeden řádek štítků, poslední sken, shiny
console.log("\n10) Editor, štítky na jednom řádku, poslední sken");
const pEd = await otevri(1720, [
  { pokemon: "Diancie", cp: 2300, level: 25, ivAtk: 14, ivDef: 14, ivSta: 14,
    fastMove: "Rock Throw", charged1: "Moonblast", charged2: "Rock Slide",
    scanDate: "2026-09-10 10:00" },
  { pokemon: "Azumarill", cp: 1500, level: 30, ivAtk: 0, ivDef: 15, ivSta: 15,
    shiny: "Ano", scanDate: "2026-09-21 19:30" },
  { pokemon: "Machamp", cp: 3000, level: 35, ivAtk: 15, ivDef: 14, ivSta: 13 },
]);
const dEd = await pEd.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const rows = P.getRows(), c = P.getComputed();
  // poslední naskenovaný kus
  out.posledni = rows.filter((r) => c[r.id].posledniSken).map((r) => r.pokemon);
  // Stitek "POSLEDNI SKEN" byl nejdelsi ze vsech a s druhym uz se na radek
  // nevesel. Ted je to ramecek kolem dlazdice — hledat se da dal.
  out.znackaVDlazdici = document.querySelectorAll("#atlasRoster .atlas-roster-tile[data-sken]").length;
  out.stitekVDlazdici = document.querySelectorAll("#atlasRoster .rarity-chip.r-SKEN").length;
  // shiny má vlastní obrázek (a náhrady za ním)
  A.openDetail(rows.filter((r) => r.pokemon === "Azumarill")[0].id);
  await cekej(1200);
  const sprite = document.querySelector(".atlas-drawer .d-sprite");
  out.shinySrc = sprite ? /\.s\.icon\.png$/.test(sprite.getAttribute("src")) : false;
  out.shinyZaloha = sprite ? String(sprite.dataset.zaloha || "").split("|").length : 0;
  // editor: zámek plachty, lícování s hlavičkou, přilepení
  A.openDetail(rows.filter((r) => r.pokemon === "Diancie")[0].id);
  await cekej(1200);
  window.AtlasEditRow(rows.filter((r) => r.pokemon === "Diancie")[0].id);
  await cekej(600);
  const form = document.getElementById("atlasRowEditor");
  const drawer = document.querySelector(".atlas-drawer");
  const hlavicka = document.querySelector(".atlas-drawer .atlas-detail-identity");
  out.zamek = document.body.classList.contains("atlas-edituje")
    && getComputedStyle(drawer).pointerEvents === "none";
  out.lici = Math.abs(form.getBoundingClientRect().top - hlavicka.getBoundingClientRect().top) <= 2;
  out.prilepeny = Math.round(form.getBoundingClientRect().right)
    >= Math.round(drawer.getBoundingClientRect().left) - 10;
  form.querySelector("[data-editor-cancel]").click();
  await cekej(300);
  out.poZavreni = document.body.classList.contains("atlas-edituje");
  return out;
});
// štítky a „silný proti" na jednom řádku i na užším okně
await pEd.setViewportSize({ width: 1150, height: 950 });
await pEd.waitForTimeout(500);
const dRadek = await pEd.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  A.openDetail(P.getRows().filter((r) => r.pokemon === "Diancie")[0].id);
  await new Promise((r) => setTimeout(r, 1300));
  const t = document.querySelector("#atlasDetailContent .detail-title");
  const v = t.querySelector(".atlas-vyhoda"), prvni = t.querySelector(".d-type,.rarity-chip");
  return { jedenRadek: Math.abs(v.getBoundingClientRect().top - prvni.getBoundingClientRect().top) < 8,
    vic: (v.querySelector(".atlas-vyhoda-vic") || {}).textContent || "" };
});
await pEd.close();
check("poslední naskenovaný kus je označený",
  dEd.posledni.length === 1 && dEd.posledni[0] === "Azumarill"
    && dEd.znackaVDlazdici === 1 && dEd.stitekVDlazdici === 0,
  JSON.stringify(dEd));
check("shiny kus má vlastní obrázek i náhrady za ním",
  dEd.shinySrc === true && dEd.shinyZaloha >= 2, JSON.stringify(dEd));
check("editor zamkne plachtu, lícuje s hlavičkou a je přilepený",
  dEd.zamek === true && dEd.lici === true && dEd.prilepeny === true && dEd.poZavreni === false,
  JSON.stringify(dEd));
check("značky a „silný proti“ zůstanou na jednom řádku i na úzkém okně",
  dRadek.jedenRadek === true && /^\+\d+$/.test(dRadek.vic), JSON.stringify(dRadek));

// ------------------- vzhled kusu, útoky po očištění, panel čištění, Přehled
console.log("\n11) Vzhled kusu, útoky po očištění, panel čištění");
const pVz = await otevri(1600, [
  { pokemon: "Machamp", cp: 3000, level: 35, ivAtk: 15, ivDef: 14, ivSta: 13,
    forma: "Shadow", fastMove: "Counter", charged1: "Frustration" },
  { pokemon: "Pyroar", cp: 1800, level: 25, ivAtk: 12, ivDef: 12, ivSta: 12, pohlavi: "Samice" },
  { pokemon: "Azumarill", cp: 1500, level: 30, ivAtk: 0, ivDef: 15, ivSta: 15,
    shiny: "Ano", scanDate: "2026-09-21 19:30" },
  { pokemon: "Eevee", cp: 900, level: 20, ivAtk: 14, ivDef: 15, ivSta: 15,
    dynamax: "Ano", cute: "Ano" },
]);
const dVz = await pVz.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const adresa = (jm) => {
    const r = P.getRows().find((x) => x.pokemon === jm);
    const m = /src="([^"]+)"/.exec(P.atlasObrazek(r) || "");
    return m ? m[1] : "";
  };
  out.shiny = /\.s\.icon\.png$/.test(adresa("Azumarill"));
  // Samice se jmenuje dvěma způsoby: „…g2…" (gen 1–5) a „…fFEMALE…" (gen 6+).
  out.zena = /\.(g2|fFEMALE)\.icon\.png$/.test(adresa("Pyroar"));
  // útoky po očištění
  A.openDetail(P.getRows().find((r) => r.pokemon === "Machamp").id);
  await cekej(1300);
  out.sestavy = [...document.querySelectorAll(".atlas-drawer .atlas-sestava")].map((e) =>
    ((e.querySelector(".atlas-sestava-kdy") || {}).textContent || "") + ": "
    + [...e.querySelectorAll(".d-move-jm")].map((x) => x.textContent).join(" + "));
  // evoluční řada v detailu bez rámečku
  const evo = document.querySelector("#atlasDetailContent .atlas-evolution-column");
  const cs = getComputedStyle(evo);
  out.evoBezRamecku = parseFloat(cs.borderTopWidth) === 0
    && (cs.backgroundColor === "rgba(0, 0, 0, 0)" || cs.backgroundColor === "transparent");
  // pohlaví v úpravě kusu
  window.AtlasEditRow(P.getRows().find((r) => r.pokemon === "Pyroar").id);
  await cekej(500);
  out.pohlavi = (document.querySelector("#atlasRowEditor select[name=pohlavi]") || {}).value || "";
  document.getElementById("atlasRowEditor").querySelector("[data-editor-cancel]").click();
  await cekej(300);
  // Přehled: karta posledního skenu
  A.go("home");
  await cekej(900);
  out.karta = /Azumarill/.test((document.querySelector(".atlas-posledni-sken") || {}).textContent || "");
  A.go("roster"); A.refresh();
  await cekej(700);
  // panel čištění: lišta akcí celá vidět, verdikt má pevnou výšku
  P.boxOtevrit();
  await cekej(1100);
  const ok = document.getElementById("appOknoOk");
  if (ok && !document.getElementById("appOkno").hidden) ok.click();
  await cekej(400);
  const vyska = [];
  for (let i = 0; i < 3; i++) {
    const pruh = document.querySelector("#boxMode .atlas-box-rozbor>.hra-pruh");
    const telo = document.getElementById("bmBody");
    if (pruh && telo) {
      // Lista lezi nad evolucni radou, tedy nad telem panelu — merit ji
      // proti `#bmBody` uz nedava smysl. Co platit musi: cela je uvnitr
      // panelu, nic z ni neni useknute.
      const panel = document.querySelector(".bm-panel");
      const rp = pruh.getBoundingClientRect(), rpanel = panel.getBoundingClientRect();
      out.pruhCely = rp.top >= rpanel.top - 1 && rp.bottom <= rpanel.bottom + 1
        && rp.left >= rpanel.left - 1 && rp.right <= rpanel.right + 1
        && rp.height > 10 && !!telo;
    }
    const v = document.querySelector("#boxMode .atlas-verdict-radek");
    if (v) vyska.push(Math.round(v.getBoundingClientRect().height));
    P.boxRozhodnout("keep");
    await cekej(250);
  }
  out.verdiktStejny = new Set(vyska).size === 1;
  out.vysky = vyska;
  P.boxZavritNatvrdo();
  return out;
});
await pVz.close();
check("shiny a samice mají vlastní obrázek", dVz.shiny === true && dVz.zena === true, JSON.stringify(dVz));
check("shadow kus ukáže i útoky po očištění (Return místo Frustration)",
  dVz.sestavy.some((x) => /po očištění/.test(x) && /Return/.test(x)), JSON.stringify(dVz.sestavy));
check("evoluční řada v detailu je bez rámečku", dVz.evoBezRamecku === true, String(dVz.evoBezRamecku));
check("pohlaví se dá nastavit v úpravě kusu", dVz.pohlavi === "Samice", dVz.pohlavi);
check("poslední skenovaný kus je i na Přehledu", dVz.karta === true, String(dVz.karta));
check("lišta akcí v čištění se neořezává", dVz.pruhCely === true, String(dVz.pruhCely));
check("…a verdikt má pořád stejnou výšku", dVz.verdiktStejny === true, JSON.stringify(dVz.vysky));

// ----------------------------------------------- hlášky musí být vidět
// Okno s hláškou appky stojí v HTML uvnitř karty rosteru — a tu vzhledová
// vrstva schovává. Hláška pak byla „otevřená", ale neviditelná a neklikatelná:
// import, potvrzení i varování o neuloženém rosteru se tvářily, že se nic
// neděje. Okno proto patří přímo na <body>.
console.log("\n6) Hlášky appky");
const pOkno = await otevri(1400);
const dOkno = await pOkno.evaluate(async () => {
  const okno = document.getElementById("appOkno");
  const rodic = okno ? okno.parentElement.tagName : "nic";
  window.__pgo.setRows([]);            // vyvolá hlášku o prázdném rosteru
  const tl = document.getElementById("zalWarnZachrana");
  // hláška se pustí napřímo, ať test nezávisí na tom, co zrovna appka řekne
  document.getElementById("appOknoText").textContent = "zkouška";
  okno.hidden = false;
  const ok = document.getElementById("appOknoOk");
  const r = ok.getBoundingClientRect();
  const nahore = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  okno.hidden = true;
  return {
    rodic,
    sirka: Math.round(r.width),
    nahore: nahore ? (nahore.id || nahore.className || nahore.tagName) : "nic",
    vstupSkryty: document.getElementById("appOknoVstupBox").offsetParent === null,
    maTlacitkoZachrany: !!tl,
  };
});
await pOkno.close();
check("okno s hláškou visí přímo na <body>", dOkno.rodic === "BODY", JSON.stringify(dOkno));
check("…a dá se na něj kliknout i přes vzhledovou vrstvu",
  dOkno.sirka > 0 && dOkno.nahore === "appOknoOk", JSON.stringify(dOkno));
check("…a u obyčejné hlášky není vidět textové pole",
  dOkno.vstupSkryty === true, JSON.stringify(dOkno));

// --------------------------------------- detail: bubliny, Esc, přidávání
// Drobnosti, které se po předchozí várce rozbily nebo chyběly: popisná věta
// pod nadpisem stránky, dvě bubliny o tomtéž u útoků, Escape zavírající
// rovnou detail (a nechávající viset rozbalenou nabídku) a okno „Přidat
// pokémona", které vypadalo úplně jinak než úprava kusu.
console.log("\n7) Detail: bubliny, Escape a přidávání");
const pDr = await otevri(820);
const dDr = await pDr.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { podnadpisy: [] };
  for (const g of ["home", "roster", "teams", "invest", "events", "settings"]) {
    A.go(g); await cekej(250);
    out.podnadpisy.push(document.querySelectorAll("#atlasHeading p").length);
  }
  A.go("roster"); A.refresh(); await cekej(500);

  // kus bez útoků: jedna bublina u celé sekce, vykřičník svoji nemá
  const bez = P.getRows().filter((r) => !r.fastMove || !r.charged1)[0];
  A.openDetail(bez.id); await cekej(1400);
  const box = document.querySelector(".atlas-drawer .atlas-ident-utoky");
  out.utokyTip = box ? box.getAttribute("data-tip") : "";
  out.vykricnikTitle = (document.querySelector(".atlas-drawer .atlas-utoky-chybi") || {}).title || "";

  // štítky verdiktu drží jeden řádek, zbytek je pod „+N"
  const radek = document.querySelector("#atlasDetailContent .dv-radek");
  out.radku = radek ? radek.getAttribute("data-radku") : null;
  out.poEvo = /po evo/.test(radek ? radek.textContent : "");
  out.chipRadku = radek
    ? new Set([...radek.querySelectorAll(".dv-chip:not([hidden])")].map((e) => e.offsetTop)).size : null;
  out.vic = radek ? (radek.querySelector(".dv-vic") || {}).textContent : "";
  out.skryto = radek ? radek.querySelectorAll(".dv-chip[hidden]:not(.dv-vic)").length : 0;

  // číslo statu sedí u pruhu, ne u kraje buňky
  const bar = document.querySelector(".atlas-drawer .atlas-ident-stats .d-bar");
  if (bar) {
    const track = bar.querySelector(".d-bar-track").getBoundingClientRect();
    const val = bar.querySelector(".d-bar-v").getBoundingClientRect();
    out.kPruhu = Math.round(val.left - track.right);
    out.zaCislem = Math.round(bar.getBoundingClientRect().right - val.right);
  }

  // Escape po vrstvách: nejdřív úprava, teprve pak detail
  window.AtlasEditRow(P.getRows()[0].id); await cekej(500);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await cekej(350);
  out.poPrvnimEsc = { editor: !!document.getElementById("atlasRowEditor"),
    detail: !document.getElementById("atlasModal").hidden };
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await cekej(350);
  out.poDruhemEsc = !document.getElementById("atlasModal").hidden;

  // odstranění kusu zavře i detail
  A.openDetail(P.getRows()[0].id); await cekej(900);
  const pred = P.getRows().length;
  window.AtlasSmazatKus(P.getRows()[0].id); await cekej(350);
  document.getElementById("appOknoOk").click(); await cekej(600);
  out.smazano = pred - P.getRows().length;
  out.detailZavreny = document.getElementById("atlasModal").hidden;

  // „Přidat pokémona": stejný výběr útoků, žádné pole o gymu
  const btn = [...document.querySelectorAll("button")].filter((b) => /Přidat pokémona/i.test(b.textContent))[0];
  if (btn) btn.click();
  await cekej(500);
  const jm = document.getElementById("rbName");
  if (jm) { jm.value = "Machamp"; jm.dispatchEvent(new Event("change", { bubbles: true })); }
  await cekej(900);
  const rb = document.getElementById("rucniBox");
  const hod = document.getElementById("rbHod");
  out.pridat = { vyberu: rb ? rb.querySelectorAll(".atlas-utok-vyber").length : 0,
    gymSkryty: hod && hod.closest("label") ? !!hod.closest("label").hidden : null };
  return out;
});
await pDr.close();
check("pod nadpisem stránky už není popisná věta",
  dDr.podnadpisy.every((n) => n === 0), JSON.stringify(dDr.podnadpisy));
check("kus bez útoků má jednu bublinu u celé sekce",
  /Útoky nemáš vyplněné/.test(dDr.utokyTip) && /Doplň útoky v úpravě pokémona/.test(dDr.utokyTip)
    && dDr.vykricnikTitle === "", JSON.stringify({ tip: dDr.utokyTip, v: dDr.vykricnikTitle }));
check("štítky verdiktu drží jeden řádek a zbytek je pod „+N“",
  dDr.radku === "1" && dDr.chipRadku === 1 && (dDr.skryto === 0 || /^\+\d+$/.test(dDr.vic)),
  JSON.stringify({ radku: dDr.radku, chipRadku: dDr.chipRadku, vic: dDr.vic, skryto: dDr.skryto }));
check("ve štítku verdiktu už nestojí „po evo“", dDr.poEvo === false, String(dDr.poEvo));
check("číslo statu sedí u pruhu a mezera je až za ním",
  dDr.kPruhu >= 0 && dDr.kPruhu <= 10 && dDr.zaCislem >= dDr.kPruhu * 2,
  JSON.stringify({ kPruhu: dDr.kPruhu, zaCislem: dDr.zaCislem }));
check("Escape zavře nejdřív úpravu, až potom detail",
  dDr.poPrvnimEsc.editor === false && dDr.poPrvnimEsc.detail === true && dDr.poDruhemEsc === false,
  JSON.stringify({ prvni: dDr.poPrvnimEsc, druhy: dDr.poDruhemEsc }));
check("po odstranění kusu se detail zavře",
  dDr.smazano === 1 && dDr.detailZavreny === true, JSON.stringify(dDr));
check("„Přidat pokémona“ má stejný výběr útoků a nemá pole o gymu",
  dDr.pridat.vyberu === 3 && dDr.pridat.gymSkryty === true, JSON.stringify(dDr.pridat));

// ------------------------- staty, nabídky a paměť smazaných
// Pruhy statů a IV musí být stejně dlouhé (s `width:auto` u čísla si délku
// určoval počet cifer), nabídka útoků nesmí skončit pod oknem ani přežít
// okno, ze kterého vzešla, a příkazy nemají bubliny.
console.log("\n8) Staty, nabídky útoků a paměť smazaných");
const pSt = await otevri(1500);
const dSt = await pSt.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  out.pamet = document.getElementById("discardKeepDays").value;
  out.moznosti = [...document.getElementById("discardKeepDays").options].map((o) => o.value);

  A.openDetail(P.getRows()[0].id);
  await cekej(1500);
  const zmer = (box) => {
    const bar = box.querySelector(".d-bar");
    const tr = bar.querySelector(".d-bar-track").getBoundingClientRect();
    const v = bar.querySelector(".d-bar-v").getBoundingClientRect();
    return { pruh: Math.round(tr.width), kPruhu: Math.round(v.left - tr.right),
      zaCislem: Math.round(bar.getBoundingClientRect().right - v.right) };
  };
  const boxy = [...document.querySelectorAll(".atlas-drawer .atlas-ident-stats .d-box")]
    .filter((b) => b.querySelector(".d-bar"));
  out.staty = zmer(boxy[0]);
  out.iv = zmer(boxy[1]);

  const sum = document.querySelector("#atlasDetailContent .atlas-evolution-column>summary");
  const kus = document.querySelector("#atlasDetailContent .d-evo-kus");
  const a = sum.getBoundingClientRect(), b = kus.getBoundingClientRect();
  out.nadpisOd = Math.round((a.left + a.width / 2) - (b.left + b.width / 2));

  out.titulky = [...document.querySelectorAll(".atlas-drawer-header button")]
    .map((x) => x.title || "").filter(Boolean);

  // Escape: rozbalená nabídka útoků padá první, okno pod ní zůstává
  window.AtlasEditRow(P.getRows()[0].id);
  await cekej(600);
  const pole = document.querySelector("#atlasRowEditor .uv-pole");
  pole.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  pole.click();
  await cekej(400);
  out.nabidkaOtevrena = !!document.querySelector(".uv-seznam");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await cekej(350);
  out.poEsc = { nabidka: !!document.querySelector(".uv-seznam"),
    editor: !!document.getElementById("atlasRowEditor") };
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await cekej(350);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await cekej(350);

  // „Přidat pokémona": nabídka útoků nad oknem, po zavření nezůstane viset
  const btn = [...document.querySelectorAll("button")].filter((x) => /Přidat pokémona/i.test(x.textContent))[0];
  btn.click();
  await cekej(600);
  const jm = document.getElementById("rbName");
  jm.value = "Machamp";
  jm.dispatchEvent(new Event("change", { bubbles: true }));
  await cekej(900);
  const pole2 = document.querySelector("#rucniBox .uv-pole");
  if (!pole2) { out.pridat = { chyba: "okno nemá výběr útoků" }; return out; }
  pole2.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  pole2.click();
  await cekej(450);
  const seznam = document.querySelector(".uv-seznam");
  if (!seznam) { out.pridat = { chyba: "nabídka se neotevřela" }; return out; }
  const r = seznam.getBoundingClientRect();
  const nahore = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + 12));
  out.pridat = { nadOknem: !!(nahore && nahore.closest && nahore.closest(".uv-seznam")) };
  const zrusit = [...document.querySelectorAll("#rucniBox button")].filter((x) => /Zrušit/.test(x.textContent))[0];
  zrusit.click();
  await cekej(450);
  out.pridat.zbylaNabidka = !!document.querySelector(".uv-seznam");
  return out;
});
await pSt.close();
check("paměť smazaných drží 3 dny, ne měsíc",
  dSt.pamet === "3" && dSt.moznosti.indexOf("3") === 0, JSON.stringify(dSt.moznosti));
check("pruh statů a IV je stejně dlouhý",
  dSt.staty.pruh === dSt.iv.pruh && dSt.staty.pruh >= 70,
  JSON.stringify({ staty: dSt.staty, iv: dSt.iv }));
check("číslo sedí u pruhu stejně u statů i IV a mezera za ním je větší",
  dSt.staty.kPruhu === dSt.iv.kPruhu && dSt.staty.zaCislem >= dSt.staty.kPruhu * 2,
  JSON.stringify({ staty: dSt.staty, iv: dSt.iv }));
check("nadpis evoluční řady stojí nad ní", Math.abs(dSt.nadpisOd) <= 6, String(dSt.nadpisOd));
check("příkazy v hlavičce detailu nemají bubliny",
  dSt.titulky.length === 0, JSON.stringify(dSt.titulky));
check("Escape zavře nejdřív rozbalenou nabídku útoků",
  dSt.nabidkaOtevrena === true && dSt.poEsc.nabidka === false && dSt.poEsc.editor === true,
  JSON.stringify(dSt.poEsc));
check("nabídka útoků v „Přidat pokémona“ je nad oknem a nepřežije ho",
  dSt.pridat.nadOknem === true && dSt.pridat.zbylaNabidka === false,
  JSON.stringify(dSt.pridat));

// „+N" v úzkém detailu: seznam bez visící pomlčky a bez opakované věty
const pPlus = await otevri(820);
const dPlus = await pPlus.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  A.openDetail(P.getRows()[0].id);
  await cekej(1500);
  const vic = document.querySelector("#atlasDetailContent .dv-vic");
  const tip = vic && !vic.hidden ? (vic.getAttribute("data-tip") || "") : "";
  const pom = document.createElement("div");
  pom.innerHTML = tip;
  return { text: vic ? vic.textContent : "", tip,
    radky: pom.textContent.split(/[\n·]/).map((x) => x.trim()).filter(Boolean) };
});
await pPlus.close();
check("bublina „+N“ nikde nekončí visící pomlčkou",
  dPlus.radky.length > 0 && dPlus.radky.every((x) => !/[—-]\s*$/.test(x)),
  JSON.stringify(dPlus.radky).slice(0, 220));
check("…a neopakuje tutéž větu o evoluci dvakrát",
  (dPlus.tip.match(/Platí až po evoluci/g) || []).length === 0,
  dPlus.tip.replace(/<[^>]+>/g, " ").slice(0, 260));

// ------------------- hlavička detailu, strop ligy a bublina „+N"
// Křížek si bral vlastní řádek, „Upravit tohoto Pokémona" bylo tučnější
// a tmavší než zbytek řady, řádek ligy měl pod sebou třetí (žlutý) řádek,
// který se ořezával, a „+N" říkalo míň než štítek sám.
console.log("\n9) Hlavička detailu, strop ligy a „+N“");
const pHl = await otevri(1500, [
  { pokemon: "Swampert", cp: 2492, level: 32, ivAtk: 4, ivDef: 14, ivSta: 14,
    fastMove: "Mud Shot", charged1: "Hydro Cannon", charged2: "Earthquake" },
  { pokemon: "Eevee", cp: 536, level: 20, ivAtk: 8, ivDef: 0, ivSta: 12 },
]);
const dHl = await pHl.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  A.openDetail(P.getRows().filter((r) => r.pokemon === "Swampert")[0].id);
  await cekej(1600);
  const out = {};

  const h = document.querySelector(".atlas-drawer-header");
  const tl = [...h.querySelectorAll(":scope>button,:scope>.hra-pruh>button")];
  const topy = tl.map((b) => b.getBoundingClientRect().top);
  out.rozptyl = Math.round(Math.max(...topy) - Math.min(...topy));
  const posledni = [...h.children].filter((e) => e.tagName !== "NAV").pop();
  out.krizekPosledni = !!(posledni && posledni.matches('[data-atlas-action="close"]'));
  const styl = (b) => {
    const c = getComputedStyle(b);
    return c.fontWeight + "|" + c.backgroundColor;
  };
  const vyvin = tl.filter((b) => /Vylepšen|Vyvinut/.test(b.textContent))[0];
  const uprav = document.getElementById("atlasEditPokemon");
  out.stejnyVzhled = !!(vyvin && uprav) && styl(vyvin) === styl(uprav);
  out.styly = vyvin && uprav ? [styl(vyvin), styl(uprav)] : "nic";

  // strop ligy: jeden řádek, stejné písmo jako zbytek řádku
  const varovani = document.querySelector("#atlasDetailContent .d-lg-varovani");
  out.strop = varovani ? varovani.textContent.trim() : "(bez stropu)";
  const cena = varovani ? varovani.closest(".d-lg-cena") : null;
  out.vRadku = !!cena;
  out.stejnePismo = cena
    ? getComputedStyle(varovani).fontSize === getComputedStyle(cena).fontSize : false;
  out.radekCely = cena
    ? cena.textContent.replace(/\s+/g, " ").trim() : "";
  return out;
});
await pHl.close();
check("příkazy v hlavičce drží jeden řádek a křížek je až za nimi",
  dHl.rozptyl <= 10 && dHl.krizekPosledni === true,
  JSON.stringify({ rozptyl: dHl.rozptyl, krizek: dHl.krizekPosledni }));
check("„Upravit tohoto Pokémona“ vypadá stejně jako ostatní příkazy",
  dHl.stejnyVzhled === true, JSON.stringify(dHl.styly));
check("strop ligy stojí v řádku s cenou, ne na vlastním",
  dHl.vRadku === true && /je strop ligy/.test(dHl.strop) && /hotový · L32 je strop ligy → /.test(dHl.radekCely),
  JSON.stringify({ strop: dHl.strop, radek: dHl.radekCely }));
check("…a nečouhá z něj větším písmem", dHl.stejnePismo === true, String(dHl.stejnePismo));

const pPl = await otevri(820, [{ pokemon: "Eevee", cp: 536, level: 20, ivAtk: 8, ivDef: 0, ivSta: 12 }]);
const dPl = await pPl.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  await new Promise((r) => setTimeout(r, 300));
  A.openDetail(P.getRows()[0].id);
  await new Promise((r) => setTimeout(r, 1600));
  const vic = document.querySelector("#atlasDetailContent .dv-vic");
  if (!vic || vic.hidden) return { text: "(bez +N)" };
  const pom = document.createElement("div");
  pom.innerHTML = vic.getAttribute("data-tip") || "";
  return { text: vic.textContent, seznamu: pom.querySelectorAll(".tip-seznam").length,
    obsah: pom.textContent.replace(/\s+/g, " ") };
});
await pPl.close();
check("bublina „+N“ ukáže celé bubliny schovaných štítků",
  /^\+\d+$/.test(dPl.text) && dPl.seznamu >= 1 && /drží \(1 z \d/.test(dPl.obsah || ""),
  JSON.stringify({ text: dPl.text, seznamu: dPl.seznamu }) + " " + (dPl.obsah || "").slice(0, 150));

const pPos = await otevri(1400);
const dPos = await pPos.evaluate(async () => {
  const P = window.__pgo;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = [...document.querySelectorAll("button")].filter((x) => /Přidat pokémona/i.test(x.textContent))[0];
  btn.click();
  await cekej(600);
  const jm = document.getElementById("rbName");
  jm.value = "Machamp";
  jm.dispatchEvent(new Event("change", { bubbles: true }));
  await cekej(900);
  const pole = document.querySelector("#rucniBox .uv-pole");
  if (!pole) return { chyba: "okno nemá výběr útoků" };
  pole.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  pole.click();
  await cekej(450);
  const seznam = document.querySelector(".uv-seznam");
  if (!seznam) return { chyba: "nabídka se neotevřela" };
  const c = getComputedStyle(seznam);
  return { sirka: c.scrollbarWidth, barva: c.scrollbarColor };
});
await pPos.close();
check("nabídka útoků má tenký posuvník appky, ne systémový",
  dPos.sirka === "thin" && /rgba\(0, 0, 0, 0\)|transparent/.test(dPos.barva || ""),
  JSON.stringify(dPos));

// ---------------- široká bublina, křížek, Escape a rozbor v boxu
// Bublina „+N" se nedá rolovat (jakmile myš sjede ze štítku, zmizí), takže
// dlouhý seznam musí jít do sloupců, ne pod posuvník. Ukazatel postupu
// v čištění poskakoval, protože ikona vedle něj mění glyf.
console.log("\n10) Široká bublina, křížek, Escape a rozbor v boxu");
const pSi = await otevri(1500);
const dSi = await pSi.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};

  // dlouhý seznam: bublina se sází do sloupců a vejde se do okna
  const vic = document.querySelector("#atlasRoster .dv-vic") || document.createElement("span");
  let h = '<div class="tip-hlava">Další důvody</div>';
  for (let i = 0; i < 6; i++) {
    h += '<div class="tip-skupina"><div class="tip-hlava">Typ ' + i + ' 11/6</div>'
      + '<ol class="tip-seznam">';
    for (let j = 1; j <= 6; j++) h += "<li><b>Kus " + j + "</b> 189 CP</li>";
    h += "</ol></div>";
  }
  if (!vic.isConnected) document.body.append(vic);
  vic.hidden = false;
  vic.setAttribute("data-tip", h);
  vic.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  await cekej(500);
  const b = [...document.querySelectorAll(".tip-bublina")].find((e) => /Další důvody/.test(e.textContent));
  if (b) {
    const r = b.getBoundingClientRect(), c = getComputedStyle(b);
    out.bublina = { siroka: b.classList.contains("tip-siroka"),
      sloupcu: Math.max(1, Math.round(r.width / 316)),
      prepad: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1,
      posuvnik: c.overflow,
      vejdeSe: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 };
  } else out.bublina = "(bublina nenalezena)";
  vic.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
  await cekej(200);

  // křížek uprostřed tlačítka
  A.openDetail(P.getRows()[0].id);
  await cekej(1400);
  const zav = document.querySelector('.atlas-drawer-header [data-atlas-action="close"]');
  const ikona = zav.querySelector("svg") || zav.firstElementChild;
  const rb = zav.getBoundingClientRect(), ri = ikona.getBoundingClientRect();
  out.krizek = { dx: Math.round((ri.left + ri.width / 2) - (rb.left + rb.width / 2)),
    dy: Math.round((ri.top + ri.height / 2) - (rb.top + rb.height / 2)) };
  zav.click();
  await cekej(500);

  // Escape zavře „Přidat pokémona"
  const pridat = [...document.querySelectorAll("button")].filter((x) => /Přidat pokémona/i.test(x.textContent))[0];
  pridat.click();
  await cekej(600);
  const otevreno = !document.getElementById("rucniBox").hidden;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await cekej(500);
  out.rucni = { otevreno, poEsc: !document.getElementById("rucniBox").hidden };

  // čištění boxu: ukazatel postupu a vzhled bez rámečků
  A.go("home"); A.refresh();
  await cekej(700);
  document.querySelector('[data-click="boxModeBtn"]').click();
  await cekej(1500);
  const ok = document.getElementById("appOknoOk");
  if (ok && !document.getElementById("appOkno").hidden) ok.click();
  await cekej(900);
  const sirka = () => Math.round(document.querySelector(".bm-progress").getBoundingClientRect().width);
  // Rozbor uz se neprepina; ukazatel postupu musi drzet delku i pri
  // prechodu na dalsi kus.
  const pred = sirka();
  window.__pgo.boxRozhodnout("keep");
  await cekej(800);
  const po = sirka();
  window.__pgo.boxZpet();
  await cekej(800);
  out.pruh = [pred, po, sirka()];
  out.rozborVzdy = !!(document.getElementById("bmVic") || {}).open
    && !document.getElementById("bmVicBtn");
  const st = (s) => { const e = document.querySelector(".atlas-box-rozbor " + s);
    if (!e) return null; const c = getComputedStyle(e);
    return { border: c.borderTopWidth, bg: c.backgroundColor, zarovnani: c.textAlign }; };
  out.evoSloupec = st(".atlas-evolution-column");
  out.evoNadpis = st(".atlas-evolution-column>summary");
  // Lista sedi primo ve sloupci s evoluci jako jeho prvni radek — driv se
  // pripinala na mrizku rozboru pres `grid-area`, kde ale ta oblast vubec
  // neni, a podle sirky okna zmizela z dohledu.
  out.prikazyNadRadou = (() => {
    const bar = document.querySelector(".atlas-box-rozbor > .hra-pruh");
    const evo = document.querySelector(".atlas-box-rozbor .atlas-evolution-column");
    const strom = evo ? (evo.querySelector("summary, .d-evo") || evo) : null;
    if (!bar || !strom) return null;
    return bar.getBoundingClientRect().bottom <= strom.getBoundingClientRect().top + 4;
  })();
  P.boxZavritNatvrdo();
  return out;
});
await pSi.close();
check("bublina „+N“ se sází do sloupců a nemá posuvník",
  dSi.bublina && dSi.bublina.siroka === true && dSi.bublina.sloupcu >= 2
    && dSi.bublina.prepad === false && dSi.bublina.posuvnik === "hidden",
  JSON.stringify(dSi.bublina));
check("…a vejde se celá do okna", dSi.bublina && dSi.bublina.vejdeSe === true,
  JSON.stringify(dSi.bublina));
check("křížek sedí uprostřed tlačítka",
  Math.abs(dSi.krizek.dx) <= 1 && Math.abs(dSi.krizek.dy) <= 1, JSON.stringify(dSi.krizek));
check("Escape zavře i okno „Přidat pokémona“",
  dSi.rucni.otevreno === true && dSi.rucni.poEsc === false, JSON.stringify(dSi.rucni));
check("ukazatel postupu nemění délku mezi kusy",
  new Set(dSi.pruh).size === 1, JSON.stringify(dSi.pruh));
check("rozbor v čištění je vždy celý a nejde sbalit",
  dSi.rozborVzdy === true, String(dSi.rozborVzdy));
check("rozbor v boxu je bez rámečků jako detail",
  dSi.evoSloupec && dSi.evoSloupec.border === "0px"
    && dSi.evoNadpis && dSi.evoNadpis.zarovnani === "center",
  JSON.stringify({ sloupec: dSi.evoSloupec, nadpis: dSi.evoNadpis }));
check("…a příkazy zůstaly nad evoluční řadou",
  dSi.prikazyNadRadou === true, String(dSi.prikazyNadRadou));

// ------------------ čištění boxu: nic se při rozbalení neposouvá
// Sbalený a rozbalený stav měly jiná odsazení, takže se při přepnutí
// posunula tabulka lig i tlačítka. Čtyři buňky dole se ve sbaleném stavu
// zalamovaly vedle sebe a doporučený krok byl celý barevný.
console.log("\n11) Čištění boxu: stabilní rozložení a vzhled jako v detailu");
for (const sirkaBox of [1600, 1280, 950]) {
  const pBox = await otevri(sirkaBox);
  const dBox = await pBox.evaluate(async () => {
    const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
    const A = window.__atlasTest;
    A.go("home"); A.refresh(); await cekej(700);
    document.querySelector('[data-click="boxModeBtn"]').click();
    await cekej(1500);
    const ok = document.getElementById("appOknoOk");
    if (ok && !document.getElementById("appOkno").hidden) ok.click();
    await cekej(900);
    // Sprity evolucni rady se mezi druhy lisi (jina delka rady), to neni posun.
    const SEL = [".bm-top", ".bm-progress", ".atlas-detail-identity", ".atlas-verdict-radek",
      ".atlas-vyuziti", ".atlas-vyuziti>.d-role", ".bm-actions", "#bmDrop",
      ".atlas-evolution-column", ".d-ligy-tab"];
    const snap = () => {
      const o = {};
      SEL.forEach((s) => { const e = document.querySelector(".box-mode " + s);
        if (!e) { o[s] = "(není)"; return; }
        const r = e.getBoundingClientRect();
        o[s] = [Math.round(r.left), Math.round(r.top), Math.round(r.width)].join(","); });
      return o;
    };
    const sbaleno = snap();
    const roleTop = () => { const e = document.querySelector(".box-mode .atlas-vyuziti>.d-role");
      return e ? [...e.children].map((x) => Math.round(x.getBoundingClientRect().top)) : []; };
    const roleSbaleno = roleTop();
    // Rozbor se uz neprepina; hlavicka a ukazatel musi drzet misto i pri
    // prechodu na dalsi kus.
    window.__pgo.boxRozhodnout("keep");
    await cekej(900);
    const rozbaleno = snap();
    // Vodorovne se nesmi hnout nic. Svisle smi klesnout jen to, co je POD
    // tabulkou lig — tim, ze se tabulka objevi (o to prave jde).
    const vodorovne = SEL.filter((s) => {
      const a = String(sbaleno[s]).split(","), b = String(rozbaleno[s]).split(",");
      return a[0] !== b[0] || a[2] !== b[2];
    });
    const NAD = [".bm-top", ".bm-progress", ".atlas-detail-identity", ".atlas-verdict-radek"];
    const svisle = NAD.filter((s) => sbaleno[s] !== rozbaleno[s]);
    const posunute = vodorovne.concat(svisle);
    const krok = document.querySelector(".box-mode .atlas-krok .d-roles-akce>.d-role");
    const kr = krok ? getComputedStyle(krok) : null;
    window.__pgo.boxZavritNatvrdo();
    return { posunute, roleSbaleno,
      krok: kr ? { bg: kr.backgroundColor, bt: kr.borderTopWidth, bl: kr.borderLeftWidth } : null };
  });
  await pBox.close();
  check(`přechod na další kus nic neposune (${sirkaBox} px)`,
    dBox.posunute.length === 0, JSON.stringify(dBox.posunute));
  if (sirkaBox === 1600) {
    check("čtyři buňky mají nadpis nad hodnotou i ve sbaleném stavu",
      dBox.roleSbaleno.length === 2 && dBox.roleSbaleno[0] !== dBox.roleSbaleno[1],
      JSON.stringify(dBox.roleSbaleno));
    check("doporučený krok není celý barevný, jen proužek vlevo",
      !!dBox.krok && /rgba\(0, 0, 0, 0\)|transparent/.test(dBox.krok.bg)
        && dBox.krok.bt === "0px" && dBox.krok.bl === "3px",
      JSON.stringify(dBox.krok));
  }
}

// přejmenování příkazů
const pNaz = await otevri(1400);
const dNaz = await pNaz.evaluate(() => ({
  tlacitka: [...document.querySelectorAll("button")].map((b) => b.textContent.trim())
    .filter((t) => /Projít/.test(t)),
  roster: [...document.querySelectorAll("h2")].map((e) => e.textContent.trim())
    .filter((t) => /Roster/.test(t)),
  starky: /Projít box|co s kterým pokémonem/.test(document.body.innerText),
}));
await pNaz.close();
check("příkaz se jmenuje „Projít pokémony“",
  dNaz.tlacitka.length > 0 && dNaz.tlacitka.every((t) => t === "Projít pokémony")
    && dNaz.starky === false, JSON.stringify(dNaz.tlacitka));
check("nadpis tabulky je jen „Roster“",
  dNaz.roster.length === 1 && dNaz.roster[0] === "Roster", JSON.stringify(dNaz.roster));

// ------------- „Ne" červeně, sjednocené příkazy a značky bez posunu
console.log("\n12) Červená u „Ne“, sjednocené příkazy a stabilní značky");
const pCer = await otevri(1700, [
  { pokemon: "Gardevoir", cp: 2209, level: 25.5, ivAtk: 12, ivDef: 14, ivSta: 13,
    fastMove: "Confusion", charged1: "Psychic" },
  { pokemon: "Sawk", cp: 1500, level: 25, ivAtk: 10, ivDef: 10, ivSta: 10,
    fastMove: "Low Kick", charged1: "Close Combat" },
  { pokemon: "Charizard", cp: 2813, level: 40, ivAtk: 12, ivDef: 12, ivSta: 12,
    fastMove: "Fire Spin", charged1: "Blast Burn" },
]);
const dCer = await pCer.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};

  // příkazy nad rosterem mají stejné písmo i tvar
  out.prikazy = [...document.querySelectorAll("button, summary")]
    .filter((b) => /Přidat pokémona|Projít pokémony|Zrušit filtry|Doplnit útoky|Správa rosteru/.test(b.textContent)
      && b.getBoundingClientRect().height > 5)
    .map((b) => { const c = getComputedStyle(b);
      return c.fontSize + "/" + c.fontWeight + "/" + c.borderRadius; });

  // čtyři buňky: „Ne" má červený proužek
  A.openDetail(P.getRows()[0].id);
  await cekej(1500);
  out.bunky = [...document.querySelectorAll("#atlasDetailContent .d-roles.atlas-vyuziti>.d-role")]
    .map((e) => ({ ne: /(muted|critical)/.test(e.className), bar: getComputedStyle(e).borderLeftColor }));
  document.querySelector('.atlas-drawer-header [data-atlas-action="close"]').click();
  await cekej(500);

  // čištění: rozbor je vždy celý a vlastní značky drží místo
  A.go("home"); A.refresh(); await cekej(700);
  document.querySelector('[data-click="boxModeBtn"]').click();
  await cekej(1500);
  const ok = document.getElementById("appOknoOk");
  if (ok && !document.getElementById("appOkno").hidden) ok.click();
  await cekej(900);
  out.rozborVzdy = { tlacitko: !!document.getElementById("bmVicBtn"),
    otevreno: !!(document.getElementById("bmVic") || {}).open,
    ligyVidet: (() => { const e = document.querySelector(".box-mode [data-detail-section=ligy]");
      return !!e && e.getBoundingClientRect().height > 2 && getComputedStyle(e).opacity !== "0"; })() };
  out.znacky = [];
  out.bunkyBox = [];
  for (let i = 0; i < 3; i++) {
    const chip = document.querySelector(".box-mode .detail-title .rarity-chip");
    out.znacky.push(chip ? Math.round(chip.getBoundingClientRect().left) : null);
    out.bunkyBox.push([...document.querySelectorAll(".box-mode .d-roles.atlas-vyuziti>.d-role")]
      .filter((e) => /(muted|critical)/.test(e.className))
      .map((e) => getComputedStyle(e).borderLeftColor));
    P.boxRozhodnout("keep");
    await cekej(800);
  }

  // okno při odchodu: všechny tři příkazy vypadají stejně
  P.boxZavritNatvrdo();
  await cekej(300);
  document.querySelector('[data-click="boxModeBtn"]').click();
  await cekej(1400);
  const ok2 = document.getElementById("appOknoOk");
  if (ok2 && !document.getElementById("appOkno").hidden) ok2.click();
  await cekej(800);
  P.boxRozhodnout("keep");
  await cekej(700);
  document.getElementById("bmClose").click();
  await cekej(700);
  out.odchod = [...document.querySelectorAll(".bm-zeptat .actions button")]
    .map((b) => { const c = getComputedStyle(b); return c.backgroundColor + "/" + c.color; });
  P.boxZavritNatvrdo();
  return out;
});
await pCer.close();
check("příkazy nad rosterem mají stejné písmo i tvar",
  dCer.prikazy.length >= 4 && new Set(dCer.prikazy).size === 1, JSON.stringify(dCer.prikazy));
check("„Ne“ má v detailu červený proužek",
  dCer.bunky.filter((x) => x.ne).length > 0
    && dCer.bunky.filter((x) => x.ne).every((x) => /208, 59, 59|var\(--status-critical\)/.test(x.bar)),
  JSON.stringify(dCer.bunky));
check("…a stejně tak v čištění boxu",
  dCer.bunkyBox.flat().length > 0
    && dCer.bunkyBox.flat().every((b) => /208, 59, 59/.test(b)), JSON.stringify(dCer.bunkyBox));
check("rozbor v čištění je celý hned a nejde sbalit",
  dCer.rozborVzdy.tlacitko === false && dCer.rozborVzdy.otevreno === true
    && dCer.rozborVzdy.ligyVidet === true, JSON.stringify(dCer.rozborVzdy));
check("vlastní značky začínají u každého kusu na stejném místě",
  dCer.znacky.every((x) => x !== null) && new Set(dCer.znacky).size === 1,
  JSON.stringify(dCer.znacky));
check("okno při odchodu z čištění má tři rovnocenné příkazy",
  dCer.odchod.length === 3 && new Set(dCer.odchod).size === 1, JSON.stringify(dCer.odchod));

// ------------------------------- schovaná tabulka se nestaví
console.log("\n21) schovaná tabulka se nestaví a pořadí vede motor");
const pTab = await otevri(1400);
const dTab = await pTab.evaluate(async () => {
  const P = window.__pgo;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const idsDlazdic = () => [...document.querySelectorAll(".atlas-row")]
    .map((el) => el.dataset.atlasDetail).join("|");
  const out = { kusu: P.getRows().length };
  out.dlazdic = document.querySelectorAll(".atlas-row").length;
  out.radku = document.querySelectorAll("#tbody tr").length;
  out.poradiSedi = P.atlasPoradi ? P.atlasPoradi().join("|") === idsDlazdic() : false;

  // Řazení se musí promítnout do seznamu i bez řádků tabulky.
  P.atlasSort("cp", -1);
  await cekej(300);
  out.poRazeni = P.atlasPoradi().join("|") === idsDlazdic();
  const cpDlazdic = [...document.querySelectorAll(".atlas-row")]
    .map((el) => Number(String(el.querySelector(".atlas-num").textContent).replace(/[^0-9]/g, "")));
  out.sestupne = cpDlazdic.every((v, i) => i === 0 || cpDlazdic[i - 1] >= v);

  // Hledání taky — filtr běží v motoru, seznam ho musí převzít.
  const hledat = document.getElementById("searchInput");
  hledat.value = "Pikachu";
  hledat.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(500);
  out.poHledani = document.querySelectorAll(".atlas-row").length;
  out.poHledaniSedi = P.atlasPoradi().join("|") === idsDlazdic();
  hledat.value = "";
  hledat.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(500);

  // Pata postranni listy: popisek o oddelenych profilech uz tam neni,
  // misto nej je cislo verze.
  out.pata = document.querySelector(".atlas-side-foot").textContent;
  out.verze = P.verze ? P.verze() : null;
  out.znacka = (document.getElementById("atlasCrumbVerze") || {}).textContent;

  // Přepnutí na klasickou tabulku řádky dostaví.
  document.body.classList.remove("atlas-compact");
  await cekej(400);
  out.poPrepnuti = document.querySelectorAll("#tbody tr[data-row-id]").length;
  document.body.classList.add("atlas-compact");
  await cekej(300);
  return out;
});
await pTab.close();
check("schovaná tabulka se vůbec nestaví", dTab.radku === 0, JSON.stringify(dTab));
check("…a seznam kusů přesto sedí na pořadí z motoru",
  dTab.dlazdic === dTab.kusu && dTab.poradiSedi, JSON.stringify(dTab));
check("řazení se promítne i bez řádků tabulky",
  dTab.poRazeni && dTab.sestupne, JSON.stringify(dTab));
check("hledání taky", dTab.poHledani > 0 && dTab.poHledani < dTab.kusu && dTab.poHledaniSedi,
  JSON.stringify(dTab));
check("přepnutí na klasickou tabulku řádky dostaví", dTab.poPrepnuti === dTab.kusu,
  JSON.stringify(dTab));
check("v patě už není popisek o oddělených profilech",
  dTab.pata.indexOf("Oddělené profily") === -1, dTab.pata);
check("číslo verze je i nahoře v záhlaví",
  dTab.znacka === "v" + dTab.verze, dTab.znacka + " vs " + dTab.verze);
check("…zato je tam číslo verze",
  /^\d+\.\d+$/.test(String(dTab.verze)) && dTab.pata.indexOf("verze " + dTab.verze) > -1,
  dTab.verze + " | " + dTab.pata);

// ------------------------------- karta události neroste s oknem
console.log("\n22) karta události na Přehledu neroste s širokým oknem");
async function kartaUdalosti(sirka) {
  const page = await otevri(sirka);
  const v = await page.evaluate(async () => {
    window.__atlasTest.go("home");
    await new Promise((r) => setTimeout(r, 1200));
    const karta = document.querySelector("#atlasHome .atlas-event-card");
    const art = document.querySelector("#atlasHome .atlas-event-art");
    return { karta: karta ? Math.round(karta.getBoundingClientRect().height) : null,
      art: art ? Math.round(art.getBoundingClientRect().height) : null };
  });
  await page.close();
  return v;
}
// Vystredovani spritu (az 1,55x) patri do rosteru, ne na celostrankovou
// ilustraci — ta uz ramecek vyplnuje sama a jen by se nafoukla. Projevi se
// to az na skutecnem profilu, takze se to tu vyvola natvrdo.
const pVys = await otevri(2210);
const dVys = await pVys.evaluate(async () => {
  window.__atlasTest.go("home");
  await new Promise((r) => setTimeout(r, 1200));
  const vsechny = [...document.querySelectorAll("#atlasHome img")];
  if (!vsechny.length) return { chyba: "zadny obrazek" };
  const img = vsechny[0];
  const pred = Math.round(img.getBoundingClientRect().height);
  vsechny.forEach((i) => { i.style.transform = "translate(2%, -3%) scale(1.55)"; });
  return { pred, po: Math.round(img.getBoundingClientRect().height),
    computed: getComputedStyle(img).transform };
});
await pVys.close();
check("vystredovani spritu obrazek na Prehledu nenafoukne",
  dVys.pred > 0 && dVys.pred === dVys.po && dVys.computed === "none",
  JSON.stringify(dVys));

const k1600 = await kartaUdalosti(1600);
const k2400 = await kartaUdalosti(2400);
check("karta má na 1600 i 2400 px stejnou výšku",
  k1600.karta !== null && k1600.karta === k2400.karta,
  JSON.stringify({ px1600: k1600, px2400: k2400 }));
check("…a obrázek v ní taky",
  k1600.art !== null && k1600.art === k2400.art,
  JSON.stringify({ px1600: k1600, px2400: k2400 }));

// ------------------------------- útoky v hlavičce, opakované uložení, úprava v úzkém okně
console.log("\n23) útoky bez duplicit, opakované uložení a úprava v úzkém okně");
const pU = await otevri(1800, [
  { pokemon: "Graveler", level: 20, ivAtk: 10, ivDef: 10, ivSta: 10,
    fastMove: "Mud Shot", charged1: "Rock Blast" },
  { pokemon: "Machamp", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 }
]);
const dU = await pU.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  A.openDetail(P.getRows()[0].id);
  await cekej(1500);
  const box = document.querySelector(".atlas-ident-utoky");
  out.radky = [...box.querySelectorAll(".atlas-sestava")].map((r) => ({
    kdy: (r.querySelector(".atlas-sestava-kdy") || {}).textContent,
    utoky: [...r.querySelectorAll(".d-move-jm")].map((e) => e.textContent),
    sipky: [...r.querySelectorAll(".atlas-utok-lepsi")].map((e) => e.textContent.trim())
  }));
  out.utokuCelkem = box.querySelectorAll(".d-move").length;
  out.tecky = [...box.querySelectorAll(".atlas-utok-tecka:not(.atlas-utok-mezera)")]
    .map((x) => x.dataset.stav + "=" + getComputedStyle(x).backgroundColor);
  return out;
});
await pU.close();
check("kus s útoky už nemá pod sebou zopakovanou sestavu téhož druhu",
  dU.radky.length === 2 && dU.radky[0].kdy === "má" && dU.utokuCelkem === 4,
  JSON.stringify(dU.radky));
check("…a zůstala jen sestava po evoluci",
  /golem/i.test(String(dU.radky[1].kdy)), JSON.stringify(dU.radky[1]));
check("útok, který se před evolucí nepřeučuje, nemá šipku na lepší",
  dU.radky[0].sipky.length === 1, JSON.stringify(dU.radky[0]));
check("…a jeho tečka má vlastní barvu, ne základní",
  dU.tecky.some((x) => x.indexOf("poEvoluci=") === 0)
    && !dU.tecky.some((x) => /=rgba\(0, 0, 0, 0\)/.test(x)), JSON.stringify(dU.tecky));

const pE = await otevri(2200, [
  { pokemon: "Jellicent", level: 25, ivAtk: 12, ivDef: 12, ivSta: 12,
    fastMove: "Hex", charged1: "Shadow Ball", pohlavi: "Samec" }
]);
const dE = await pE.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  A.openDetail(P.getRows()[0].id);
  await cekej(1200);
  // Ulozit znamena hotovo: formular se zavre. Tam a zpatky se proto dela
  // na dvakrat — drive to slo v jednom otevrenem formulari a druhe ulozeni
  // se porovnavalo porad proti stavu pri otevreni, takze neudelalo nic.
  const ulozit = async (v) => {
    window.AtlasEditRow(P.getRows()[0].id);
    await cekej(900);
    const f = document.getElementById("atlasRowEditor");
    f.elements.pohlavi.value = v;
    f.elements.pohlavi.dispatchEvent(new Event("change", { bubbles: true }));
    f.requestSubmit();
    await cekej(1200);
    return { hodnota: P.getRows()[0].pohlavi,
      zavreno: !document.getElementById("atlasRowEditor") };
  };
  return { prvni: await ulozit("Samice"), druhe: await ulozit("Samec") };
});
await pE.close();
check("uložení zapíše a úpravy se zavřou",
  dE.prvni.hodnota === "Samice" && dE.prvni.zavreno === true, JSON.stringify(dE.prvni));
check("…a po dalším otevření jde hodnota vrátit zpátky",
  dE.druhe.hodnota === "Samec" && dE.druhe.zavreno === true, JSON.stringify(dE.druhe));

const pN = await otevri(1000, [
  { pokemon: "Jellicent", level: 25, ivAtk: 12, ivDef: 12, ivSta: 12,
    fastMove: "Hex", charged1: "Shadow Ball" }
]);
const dN = await pN.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  A.openDetail(P.getRows()[0].id);
  await cekej(1200);
  window.AtlasEditRow(P.getRows()[0].id);
  await cekej(1200);
  const f = document.getElementById("atlasRowEditor");
  const cp = f.elements.cp;
  cp.focus(); cp.value = "1234";
  cp.dispatchEvent(new Event("input", { bubbles: true }));
  const hlava = document.querySelector(".atlas-drawer-header");
  return { vDrawer: !!f.closest(".atlas-drawer"),
    filtrFormulare: getComputedStyle(f).filter,
    filtrHlavicky: getComputedStyle(hlava).filter,
    lzePsat: document.activeElement === cp && cp.value === "1234" };
});
await pN.close();
check("v úzkém okně jde formulář úprav použít a není zasedlý",
  dN.vDrawer === true && dN.filtrFormulare === "none" && dN.lzePsat === true,
  JSON.stringify(dN));
check("…zato příkazy nad ním zasedlé jsou",
  dN.filtrHlavicky !== "none", JSON.stringify(dN));

// ------------------------------- Vyhledávání: hledání nahoře, údaje až na vyžádání
console.log("\n24) Vyhledávání: jedno hledání, identita druhu, údaje v rozbalovátku");
const pH = await otevri(1800);
const dH = await pH.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const out = {};
  const pole = document.getElementById("prohName");
  out.poleVZahlavi = !!pole.closest(".atlas-hledani-hlava");
  out.udajeZavrene = !document.querySelector(".atlas-hledani-udaje").open;
  out.vymazatUvnitr = !!document.getElementById("prohClear").closest(".atlas-hledani-udaje");
  out.identitaSkryta = document.querySelector(".atlas-hledani-identita").hidden;

  pole.value = "Buzzwole";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  pole.dispatchEvent(new Event("change", { bubbles: true }));
  await cekej(1500);
  const id = document.querySelector(".atlas-hledani-identita");
  out.identita = id.textContent.replace(/\s+/g, " ").trim();
  out.typuVIdentite = id.querySelectorAll(".d-type").length;
  // Odkud shiny pada je o klik dal (navrh V2) — tlacitkem, tedy i klavesnici.
  {
    const b = id.querySelector("[data-shiny-vic]");
    out.shinyTlacitko = !!b;
    if (b) { b.click(); await cekej(500); }
    const id2 = document.querySelector(".atlas-hledani-identita");
    out.shinyZdroje = id2 ? id2.textContent.replace(/\s+/g, " ").trim() : "";
    const b2 = id2 && id2.querySelector("[data-shiny-vic]");
    if (b2) { b2.click(); await cekej(300); }
  }
  // Jmeno a typy uz nese pruh identity; engine je kreslil znovu hned pod nim.
  out.duplicitniNadpis = [...document.querySelectorAll("#prohOut .detail-title")]
    .filter((el) => el.getClientRects().length).length;

  // Prepnuti na vlastni kus otevre udaje a prepise znacku rezimu.
/** Zalozka "Muj kus" JE prepinac rezimu — vlastni tlacitka uz nejsou. */
function naKus() {
  const b = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
    .filter((x) => /Můj kus/.test(x.textContent))[0];
  if (b) b.click();
}
  naKus();
  await cekej(500);
  out.poPrepnutiOtevrene = document.querySelector(".atlas-hledani-udaje").open;
  out.znackaRezimu = (document.querySelector(".atlas-hledani-rezim-znacka") || {}).textContent;

  // Krizek vycisti pole i identitu.
  document.querySelector("[data-hledani-zrus]").click();
  await cekej(600);
  out.poVymazani = { hodnota: pole.value,
    identitaSkryta: document.querySelector(".atlas-hledani-identita").hidden };
  return out;
});
await pH.close();
// Formulář kusu má vlastní záložku, takže se neschovává do rozbalovátka —
// schované je celou dobu, dokud si člověk tu záložku neotevře.
check("hledání je nahoře a formulář kusu není v cestě",
  dH.poleVZahlavi && dH.vymazatUvnitr && dH.identitaSkryta,
  JSON.stringify({ pole: dH.poleVZahlavi, vymazat: dH.vymazatUvnitr,
    identita: dH.identitaSkryta }));
check("identita druhu řekne, jestli shiny je",
  /Shiny/.test(dH.identita) && dH.typuVIdentite === 2, dH.identita);
check("…a odkud padá, to řekne po kliknutí",
  dH.shinyTlacitko === true
    && /volná příroda|raid|vajíčko|výzkum|evoluce|fotka|zatím neobjevil|nic neříká/.test(dH.shinyZdroje),
  dH.shinyZdroje);
check("…a raidová čísla v ní nejsou, ta patří pod Raidy",
  !/Raidový úlovek/.test(dH.identita), dH.identita);
check("…a engine už jméno s typy nekreslí podruhé",
  dH.duplicitniNadpis === 0, String(dH.duplicitniNadpis));
check("přepnutí na vlastní kus otevře údaje a změní značku",
  dH.poPrepnutiOtevrene === true && /kusu/.test(String(dH.znackaRezimu)),
  JSON.stringify({ otevrene: dH.poPrepnutiOtevrene, znacka: dH.znackaRezimu }));
check("křížek vyčistí pole i identitu",
  dH.poVymazani.hodnota === "" && dH.poVymazani.identitaSkryta === true,
  JSON.stringify(dH.poVymazani));

// ------------------------------- hledání v rosteru: štítky v poli
console.log("\n25) roster: štítky se skládají do hledacího pole");
const pS = await otevri(1700, [
  { pokemon: "Lapras", level: 30, ivAtk: 15, ivDef: 15, ivSta: 15,
    fastMove: "Ice Shard", charged1: "Surf" },
  { pokemon: "Mamoswine", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
    fastMove: "Powder Snow", charged1: "Avalanche" },
  { pokemon: "Machamp", level: 30, ivAtk: 15, ivDef: 15, ivSta: 15,
    fastMove: "Counter", charged1: "Dynamic Punch", shiny: "Ano" },
  { pokemon: "Blissey", level: 30, ivAtk: 10, ivDef: 15, ivSta: 15,
    fastMove: "Pound", charged1: "Dazzling Gleam" },
  { pokemon: "Rattata", level: 5, ivAtk: 3, ivDef: 3, ivSta: 3 }
]);
const dS = await pS.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const pole = document.getElementById("searchInput");
  const navrhy = document.querySelector(".atlas-navrhy");
  if (!pole.closest(".atlas-hledani-roster") || !navrhy) return { chyba: "pole není přestavěné" };
  const stav = () => ({
    kosticky: [...document.querySelectorAll(".atlas-kostka")]
      .map((k) => k.textContent.replace("\u2715", "").trim()),
    text: pole.value, dlazdic: document.querySelectorAll(".atlas-row").length });
  const napis = async (text) => {
    pole.focus();
    pole.value = text;
    pole.dispatchEvent(new Event("input", { bubbles: true }));
    await cekej(500);
  };
  const enter = async () => {
    pole.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await cekej(700);
  };
  const out = { start: stav() };
  await napis("Ice");
  out.navrhy = [...navrhy.querySelectorAll("button")]
    .map((b) => b.textContent.replace(/\s+/g, " ").trim());
  await enter();
  out.poPrvnim = stav();
  await napis("100");
  await enter();
  out.poDruhem = stav();
  // Volny text vedle stitku funguje dal.
  await napis("Lap");
  out.sTextem = stav();
  // Backspace v prazdnem poli odebere posledni kosticku.
  await napis("");
  pole.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
  await cekej(700);
  out.poBackspace = stav();
  return out;
});
await pS.close();
check("pole nabídne štítek podle napsaného textu",
  Array.isArray(dS.navrhy) && dS.navrhy.some((x) => /Ice/.test(x)), JSON.stringify(dS.navrhy));
check("vybraný štítek zůstane v poli a vyčistí text",
  dS.poPrvnim && dS.poPrvnim.kosticky.join() === "Ice" && dS.poPrvnim.text === ""
    && dS.poPrvnim.dlazdic === 2, JSON.stringify(dS.poPrvnim));
check("druhý štítek se přidá za něj a platí průnik",
  dS.poDruhem && dS.poDruhem.kosticky.length === 2 && dS.poDruhem.dlazdic === 1,
  JSON.stringify(dS.poDruhem));
check("vedle štítků jde dál psát jméno druhu",
  dS.sTextem && dS.sTextem.text === "Lap" && dS.sTextem.kosticky.length === 2,
  JSON.stringify(dS.sTextem));
check("backspace v prázdném poli odebere poslední štítek",
  dS.poBackspace && dS.poBackspace.kosticky.length === 1 && dS.poBackspace.dlazdic === 2,
  JSON.stringify(dS.poBackspace));

/* Role jako kostičky a štítek, který si řadí sám.

   Když je v hledacím poli štítek ligy nebo typu, je seřazeno od nejlepšího
   a role by to jen přebila — kostička proto zašedne. Dřív šla zmáčknout,
   rozsvítila se a v rosteru se nezměnilo nic. */
const pR = await otevri(1700, [
  { pokemon: "Lapras", level: 30, ivAtk: 15, ivDef: 15, ivSta: 15,
    fastMove: "Ice Shard", charged1: "Surf" },
  { pokemon: "Mamoswine", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
    fastMove: "Powder Snow", charged1: "Avalanche" },
  { pokemon: "Machamp", level: 30, ivAtk: 15, ivDef: 15, ivSta: 15,
    fastMove: "Counter", charged1: "Dynamic Punch" },
  { pokemon: "Blissey", level: 30, ivAtk: 10, ivDef: 15, ivSta: 15,
    fastMove: "Pound", charged1: "Dazzling Gleam" },
  { pokemon: "Snorlax", level: 30, ivAtk: 12, ivDef: 14, ivSta: 15,
    fastMove: "Lick", charged1: "Body Slam" }
]);
const dR = await pR.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const filtr = document.getElementById("filterSelect");
  const role = () => [...document.querySelectorAll("[data-role]")].map((b) =>
    b.dataset.role + (b.disabled ? ":šedá" : "") + (b.getAttribute("aria-pressed") === "true" ? ":zap" : ""));
  const dlazdic = () => document.querySelectorAll(".atlas-row").length;
  const out = { filtrVidet: !!filtr && filtr.getClientRects().length > 0,
    start: role(), vsech: dlazdic() };
  document.querySelector('[data-role="gym"]').click();
  await cekej(900);
  out.poGymu = { role: role(), dlazdic: dlazdic() };
  document.querySelector('[data-role="gym"]').click();
  await cekej(900);
  out.poVypnuti = { role: role(), dlazdic: dlazdic() };
  out.pridanStitek = window.AtlasHledaniPridej("Ice");
  await cekej(900);
  out.seStitkem = { role: role(), dlazdic: dlazdic() };
  document.querySelector(".atlas-kostka button").click();
  await cekej(900);
  out.bezStitku = { role: role(), dlazdic: dlazdic() };
  return out;
});
await pR.close();
check("rozbalovátko „Zobrazit: vše“ v rosteru není",
  dR.filtrVidet === false, String(dR.filtrVidet));
check("role „Gym“ nechá jen gymové obránce",
  dR.poGymu.dlazdic > 0 && dR.poGymu.dlazdic < dR.vsech
    && dR.poGymu.role.join() === "pvp,raid,gym:zap,mega", JSON.stringify(dR.poGymu));
check("druhé kliknutí roli vypne a vrátí celý roster",
  dR.poVypnuti.dlazdic === dR.vsech && dR.poVypnuti.role.join() === "pvp,raid,gym,mega",
  JSON.stringify(dR.poVypnuti));
check("štítek typu role zašedne — sám už řadí od nejlepšího",
  dR.pridanStitek === true
    && dR.seStitkem.role.join() === "pvp:šedá,raid:šedá,gym:šedá,mega:šedá",
  JSON.stringify(dR.seStitkem));
check("…a po odebrání štítku jsou role zase k mání",
  dR.bezStitku.role.join() === "pvp,raid,gym,mega" && dR.bezStitku.dlazdic === dR.vsech,
  JSON.stringify(dR.bezStitku));

/* Čištění boxu: příkazy „ve hře jsem s ním něco udělal" i Upravit.

   Lišta se dřív připínala na mřížku rozboru přes `grid-area`, jenže ta
   oblast v mřížce vůbec není — prvek skončil v implicitní stopě u hlavičky
   a podle šířky okna zmizel z dohledu. Upravit v čištění chybělo úplně,
   přestože je to tatáž otázka jako v plachtě („tohle nesedí, oprav to"). */
const pPr = await otevri(1900, [
  { pokemon: "Ralts", cp: 400, level: 18, ivAtk: 14, ivDef: 14, ivSta: 14 },
  { pokemon: "Machop", cp: 500, level: 18, ivAtk: 14, ivDef: 14, ivSta: 14, forma: "Shadow" }
]);
const dPr = await pPr.evaluate(async () => {
  const P = window.__pgo;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("boxModeBtn").click();
  await cekej(1600);
  const zavri = [...document.querySelectorAll("#boxMode button")]
    .find((b) => /Jdeme|Pokra|Zav|OK|Rozum/i.test(b.textContent));
  if (zavri) { zavri.click(); await cekej(800); }
  const stav = () => {
    const bar = document.querySelector("#boxMode .atlas-box-rozbor > .hra-pruh");
    const evo = document.querySelector("#boxMode .atlas-evolution-column");
    const strom = evo ? (evo.querySelector("summary, .d-evo") || evo) : null;
    /* Kolik radku lista zabira: tlacitka, ktera zacinaji ve stejne vysce,
       jsou na jednom radku. Na dvou uz by prekryla nadpis evolucni rady. */
    const vysky = bar ? [...new Set([...bar.querySelectorAll("button")]
      .map((b) => Math.round(b.getBoundingClientRect().top)))] : [];
    return { tlacitka: bar ? [...bar.querySelectorAll("button")].map((b) => b.textContent.trim()) : [],
      radku: vysky.length,
      nadRadou: !!(bar && strom
        && bar.getBoundingClientRect().bottom <= strom.getBoundingClientRect().top + 4),
      vBoxu: !!(bar && bar.getBoundingClientRect().height > 10) };
  };
  const out = { prvni: stav() };
  P.boxRozhodnout("keep");
  await cekej(1100);
  out.shadow = stav();
  P.boxZavritNatvrdo();
  return out;
});
await pPr.close();
check("v čištění je příkaz „Vyvinutý“ i „Vylepšený“",
  dPr.prvni.tlacitka.some((x) => /Vyvinut/.test(x))
    && dPr.prvni.tlacitka.some((x) => /Vylep/.test(x)), JSON.stringify(dPr.prvni));
check("…a u shadow kusu k tomu očista",
  dPr.shadow.tlacitka.some((x) => /Očišt/.test(x)), JSON.stringify(dPr.shadow));
// Ctyri prikazy se musi vejit na jeden radek — jinak prekryji nadpis
// evolucni rady, nad kterou lista stoji.
check("…a všechny příkazy stojí na jednom řádku",
  dPr.shadow.radku === 1, JSON.stringify(dPr.shadow));
check("…a Upravit, které tam dřív nebylo vůbec",
  dPr.prvni.tlacitka.some((x) => /Upravit/.test(x)), JSON.stringify(dPr.prvni.tlacitka));
check("…celá lišta je vidět a stojí nad evoluční řadou",
  dPr.prvni.vBoxu === true && dPr.prvni.nadRadou === true, JSON.stringify(dPr.prvni));

/* Druhý nabitý útok pod „+": co si k tomu kusu dokoupit. */
const pDN = await otevri(1800, [
  { pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15,
    fastMove: "Bubble", charged1: "Ice Beam" }
]);
const dDN = await pDN.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  A.openDetail(P.getRows()[0].id);
  await new Promise((r) => setTimeout(r, 1400));
  const plus = document.querySelector(".atlas-drawer .atlas-sestava-plus");
  return { je: !!plus,
    popisek: plus ? (plus.querySelector(".atlas-sestava-kdy") || {}).textContent : "",
    utok: plus ? [...plus.querySelectorAll(".d-move-jm")].map((e) => e.textContent).join(",") : "",
    tip: plus ? (plus.dataset.tip || "") : "" };
});
await pDN.close();
check("kus bez druhého nabitého dostane návrh, co dokoupit",
  dDN.je === true && dDN.popisek === "+" && dDN.utok.length > 0, JSON.stringify(dDN));
check("…a bublina řekne, že do raidu se to nepřidává",
  /raid/i.test(dDN.tip) && /lize/i.test(dDN.tip), dDN.tip);

/* Level se v úpravách nezadává — dopočítá se z CP a IV.
   CP je funkce (staty druhu, IV, level) a nic jiného, takže level z nich
   vyjde zpětně. Zároveň to hlídá, že zadaná kombinace ve hře existuje. */
const pLv = await otevri(1800, [
  { pokemon: "Machamp", cp: 2600, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 }
]);
const dLv = await pLv.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  A.openDetail(P.getRows()[0].id);
  await cekej(1200);
  window.AtlasEditRow(P.getRows()[0].id);
  await cekej(800);
  const f = document.getElementById("atlasRowEditor");
  if (!f) return { chyba: "editor se neotevřel" };
  const stav = () => ({ level: f.elements.level.value,
    readonly: f.elements.level.readOnly,
    hlaska: (f.querySelector("[role=status]") || {}).textContent || "" });
  const nastav = async (pole, hodnota) => {
    f.elements[pole].value = String(hodnota);
    f.elements[pole].dispatchEvent(new Event("input", { bubbles: true }));
    await cekej(200);
  };
  const out = { start: stav() };
  await nastav("cp", 2255);
  out.nesmysl = stav();
  await nastav("cp", 2600);
  out.zpet = stav();
  f.requestSubmit();
  await cekej(900);
  out.ulozeno = { level: P.getRows()[0].level, cp: P.getRows()[0].cp };
  return out;
});
await pLv.close();
check("level se v úpravách nezadává, jen ukazuje",
  dLv.start.readonly === true, JSON.stringify(dLv.start));
check("…a dopočítá se z CP a IV", dLv.start.level === "30", JSON.stringify(dLv.start));
check("kombinace, která ve hře nemůže existovat, se pozná",
  dLv.nesmysl.level === "" && /neexistuje/.test(dLv.nesmysl.hlaska),
  JSON.stringify(dLv.nesmysl));
check("…a po opravě čísel se level zase dopočítá",
  dLv.zpet.level === "30" && dLv.zpet.hlaska === "", JSON.stringify(dLv.zpet));
check("uložení zapíše dopočítaný level",
  dLv.ulozeno.level === "30" || dLv.ulozeno.level === 30, JSON.stringify(dLv.ulozeno));

/* Šipka k doporučenému útoku: v plachtě vede shora dolů a pak doprava,
   protože doporučení stojí pod útokem, ke kterému patří. */
const pSip = await otevri(1800, [
  { pokemon: "Zapdos", cp: 3056, level: 31.5, ivAtk: 15, ivDef: 14, ivSta: 10,
    fastMove: "Charge Beam", charged1: "Zap Cannon" }
]);
const dSip2 = await pSip.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  A.openDetail(P.getRows()[0].id);
  await new Promise((r) => setTimeout(r, 1300));
  const sip = document.querySelector(".atlas-drawer .atlas-ident-utoky .atlas-utok-lepsi");
  if (!sip) return { chyba: "šipka není" };
  return { znak: getComputedStyle(sip, "::before").content,
    text: sip.textContent.trim(), tip: (sip.dataset.tip || "").slice(0, 60) };
});
await pSip.close();
check("šipka k doporučenému útoku vede shora dolů a pak doprava",
  /\u21b3|↳/.test(dSip2.znak || ""), JSON.stringify(dSip2.znak));
check("…a u ní stojí jen jméno útoku, bez druhé šipky v textu",
  !/[→↳]/.test(dSip2.text || ""), dSip2.text);

console.log("\n26) okno Novinky: tlačítko, body a snímky");
const pNov = await otevri(1400, [
  { pokemon: "Azumarill", level: 25, ivAtk: 10, ivDef: 12, ivSta: 14 }
]);
const dNov = await pNov.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const P = window.__pgo;
  const zaznam = P.novinkyVerze();
  const tlacitko = document.querySelector('[data-click="novinkyBtn"]');
  if (!tlacitko) return { chyba: "tlačítko Novinky v liště není" };
  // Na testu se okno samo neotevírá — při ladění by překáželo.
  const samoPredtim = !!document.getElementById("novinkyOkno");
  if (!zaznam) {
    /* Verze, ke které se novinky teprve píšou. Okno nemá co ukázat —
       tlačítko to musí říct, ne mlčet. */
    tlacitko.click();
    await cekej(500);
    const hlaska = (document.getElementById("appOknoText") || {}).textContent || "";
    const ok = document.getElementById("appOknoOk");
    if (ok) ok.click();
    return { prazdna: true, samoPredtim, hlaska,
      okno: !!document.getElementById("novinkyOkno") };
  }
  tlacitko.click();
  await cekej(700);
  const plachta = document.getElementById("novinkyOkno");
  if (!plachta) return { chyba: "okno se neotevřelo" };
  const okno = plachta.querySelector(".novinky-okno");
  const body = [...plachta.querySelectorAll(".novinky-seznam > li")];
  const obrazky = [...plachta.querySelectorAll(".novinky-obrazek img")];
  const sirkaOkna = okno.getBoundingClientRect().width;
  const out = {
    samoPredtim,
    bodu: body.length,
    zaznamBodu: zaznam ? zaznam.body.length : 0,
    zaznamObrazku: zaznam ? zaznam.body.filter((b) => b && b.obrazek).length : 0,
    // Hvězdičky jsou zápis tučného písma, ne text k přečtení.
    hvezdicky: body.some((li) => li.textContent.indexOf("**") >= 0),
    tucnych: plachta.querySelectorAll(".novinky-seznam b").length,
    obrazku: obrazky.length,
    nactenych: obrazky.filter((i) => i.complete && i.naturalWidth > 0).length,
    vlastniData: obrazky.every((i) => (i.getAttribute("src") || "").slice(0, 11) === "data:image/"),
    presahuje: obrazky.some((i) => i.getBoundingClientRect().width > sirkaOkna),
    bezPopisku: obrazky.every((i) => i.getAttribute("alt") === ""),
    // V appce nesmí být kód: ani cesta k souboru, ani název funkce.
    kod: /[a-z_]+\.(js|py|json|html)|window\.|function |data\/|tools\//.test(
      plachta.querySelector(".novinky-seznam").textContent)
  };
  plachta.querySelector("[data-novinky-ok]").click();
  await cekej(400);
  out.zavrelo = !document.getElementById("novinkyOkno");
  // Viděl jsem — podruhé se samo neotevře, tlačítkem ano.
  out.samoPodruhe = P.ukazNovinky(false);
  out.tlacitkemPodruhe = P.ukazNovinky();
  document.getElementById("novinkyOkno")?.remove();
  return out;
});
await pNov.close();
check("okno Novinky otevře tlačítko v liště", !dNov.chyba, dNov.chyba || "");
check("…samo od sebe se na testu neotevře", dNov.samoPredtim === false, JSON.stringify(dNov.samoPredtim));
if (dNov.prazdna) {
  check("…bez novinek pro verzi se okno neukáže", dNov.okno === false, "");
  check("…a tlačítko to řekne lidsky", /novinky/i.test(dNov.hlaska), dNov.hlaska);
} else {
check("…ukáže všechny body verze", dNov.bodu > 0 && dNov.bodu === dNov.zaznamBodu,
  dNov.bodu + " z " + dNov.zaznamBodu);
check("…tučné části jsou tučné, ne hvězdičky",
  dNov.hvezdicky === false && dNov.tucnych >= 1, JSON.stringify([dNov.hvezdicky, dNov.tucnych]));
check("…u bodů se ukážou snímky",
  dNov.obrazku === dNov.zaznamObrazku && dNov.nactenych === dNov.obrazku,
  dNov.nactenych + " nactenych, " + dNov.obrazku + " v okne, "
    + dNov.zaznamObrazku + " napsanych");
check("…snímky jsou v appce, ne stažené odjinud", dNov.vlastniData === true, "");
check("…a vejdou se do okna", dNov.presahuje === false, "");
check("…čtečka je přeskočí, text je nad nimi", dNov.bezPopisku === true, "");
check("…v textu není ani kousek kódu", dNov.kod === false, "");
check("…zavření si appka zapamatuje",
  dNov.zavrelo === true && dNov.samoPodruhe === false && dNov.tlacitkemPodruhe === true,
  JSON.stringify([dNov.zavrelo, dNov.samoPodruhe, dNov.tlacitkemPodruhe]));
}

/* Snímky se zapékají do appky při sestavení, takže je nejde ověřit jen
   přes okno: pro verzi bez novinek by se žádné nevykreslily a chyba
   v zapékání by prošla. Kontroluje se proto rovnou to, co je v souboru —
   ať je otevřená kterákoli verze. */
const novinkyData = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "novinky.json"), "utf8"));
const verzeTestu = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "verze.json"), "utf8")).test;
const sObrazkem = ((novinkyData[verzeTestu] || {}).body || [])
  .filter((b) => b && b.obrazek).length;
const zdrojNovinek = fs.readFileSync(TEST_APP, "utf8");
const zapecenych = (zdrojNovinek.match(/"obrazek":"data:image\//g) || []).length;
/* Hned po nasazení má nová testovací verze novinky prázdné — to není chyba.
   Hlídá se tedy obojí: když snímky jsou, musí být zapečené jako data;
   když nejsou, nesmí v appce zůstat ani odkaz na soubor. */
check("snímky z novinek jsou zapečené v appce, ne odkazem na soubor",
  sObrazkem > 0 ? zapecenych === sObrazkem : zapecenych === 0,
  zapecenych + " z " + sObrazkem + " (verze " + verzeTestu + ")");
check("…a starší verze se do appky netahají",
  !zdrojNovinek.includes('"2.8":{"nadpis"'), "2.8 by v appce lezelo zbytecne");
check("…a jméno souboru v appce nezůstalo",
  !/"obrazek":"[a-z0-9-]+"/.test(zdrojNovinek), "");

console.log("\n27) pruh nové verze: sedí nad lištou a čeká na rozdělanou práci");
const pVer = await otevri(1400, [
  { pokemon: "Machamp", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
    fastMove: "Counter", charged1: "Dynamic Punch" },
  { pokemon: "Azumarill", level: 24, ivAtk: 10, ivDef: 15, ivSta: 15 }
]);
const dVer = await pVer.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const P = window.__pgo, A = window.__atlasTest;
  P.verzeZkontroluj({ verze: "9.9", sestaveno: "2026-10-01 10:00" });
  await cekej(300);
  const pruh = document.getElementById("verzePruh");
  if (!pruh) return { chyba: "pruh se neukázal" };
  const lista = document.querySelector(".atlas-top");
  const r = pruh.getBoundingClientRect(), l = lista.getBoundingClientRect();
  const out = {
    nahore: Math.round(r.top) === 0,
    pres: Math.round(r.width) >= Math.round(window.innerWidth) - 20,
    // Lišta Atlasu je fixed — musí se o pruh posunout, ne zmizet pod ním.
    listaPod: Math.round(l.top) >= Math.round(r.bottom) - 1,
    promenna: getComputedStyle(document.body).getPropertyValue("--verze-pruh-h").trim(),
    naStart: P.verzeStav().obnoveniPlanovano
  };
  // Detail kusu je okno vrstvy — engine o něm sám neví.
  A.openDetail(P.getRows()[0].id);
  await cekej(700);
  out.priDetailu = P.verzeStav();
  A.closeDetail();
  await cekej(500);
  out.poDetailu = P.verzeStav().obnoveniPlanovano;
  // Úprava kusu taky.
  window.AtlasEditRow(P.getRows()[0].id);
  await cekej(700);
  out.priUprave = P.verzeStav().rozdelane;
  const zrus = document.querySelector("[data-editor-cancel]");
  if (zrus) zrus.click();
  await cekej(500);
  out.poUprave = P.verzeStav().obnoveniPlanovano;
  // Import.
  document.getElementById("toggleImportBtn").click();
  await cekej(700);
  out.priImportu = P.verzeStav().rozdelane;
  const zavri = document.querySelector("#atlasImportDialog header button");
  if (zavri) zavri.click();
  await cekej(500);
  out.poImportu = P.verzeStav().obnoveniPlanovano;
  // Ať se stránka pod testem neobnoví, než ji zavřeme.
  pruh.querySelector("[data-verze-pozdeji]").click();
  return out;
});
await pVer.close();
check("pruh nové verze je nahoře přes celou šířku",
  !dVer.chyba && dVer.nahore === true && dVer.pres === true, dVer.chyba || JSON.stringify(dVer));
check("…a horní lišta Atlasu se o něj posune", dVer.listaPod === true, JSON.stringify(dVer));
check("…výška pruhu je hlášená ve stylu", /^\d+px$/.test(dVer.promenna || ""), dVer.promenna);
check("…bez rozdělané práce se obnovení naplánuje", dVer.naStart === true, "");
check("otevřený detail kusu obnovení pozdrží",
  dVer.priDetailu.obnoveniPlanovano === false && /detail/i.test(dVer.priDetailu.rozdelane),
  JSON.stringify(dVer.priDetailu));
check("…po zavření detailu se zase naplánuje", dVer.poDetailu === true, "");
check("rozepsaná úprava kusu obnovení pozdrží", /uprav/i.test(dVer.priUprave || ""), dVer.priUprave);
check("…po zrušení úpravy se zase naplánuje", dVer.poUprave === true, "");
check("otevřený import obnovení pozdrží", /import/i.test(dVer.priImportu || ""), dVer.priImportu);
check("…po zavření importu se zase naplánuje", dVer.poImportu === true, "");

console.log("\n28) Přehled: karty se čtou po řádcích a říkají, co akce přináší");
const pKar = await otevri(1600, [
  { pokemon: "Machamp", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 }
]);
const dKar = await pKar.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__atlasTest.go("home");
  await cekej(1200);
  const karty = [...document.querySelectorAll("#atlasHome .atlas-event-card")];
  if (karty.length < 2) return { chyba: "karty nejsou" };
  const radek = (k, sel) => {
    const e = k.querySelector(sel);
    return e ? Math.round(e.getBoundingClientRect().top - k.getBoundingClientRect().top) : null;
  };
  const C = window.AtlasCalendar, P = window.__pgo;
  const dnes = new Date();
  const dnesek = new Date(dnes.getFullYear(), dnes.getMonth(), dnes.getDate());
  const vybrane = C.featured();
  const kratka = (e) => Math.round((new Date(e[4]) - new Date(e[3])) / 86400000) + 1 <= 7;
  return {
    karet: karty.length,
    nazvy: karty.map((k) => (k.querySelector("h3") || {}).textContent),
    // Stav, nazev i termin musi u vsech karet zacinat ve stejne vysce,
    // i kdyz se jeden nazev zalomi na dva radky.
    stavy: karty.map((k) => radek(k, ".atlas-event-status")),
    nadpisy: karty.map((k) => radek(k, "h3")),
    terminy: karty.map((k) => radek(k, ".atlas-event-date")),
    zalomenych: karty.filter((k) => {
      const h = k.querySelector("h3");
      return h && h.getBoundingClientRect().height
        / parseFloat(getComputedStyle(h).lineHeight) > 1.5;
    }).length,
    prinosy: karty.map((k) => ((k.querySelector(".atlas-event-prinos") || {}).textContent || "").trim()),
    // Prvni karta ma byt dnesni kratka akce, ne sezona, ktera "taky bezi".
    prvniBeziDnes: vybrane[0]
      ? C.overlap(vybrane[0], dnesek, new Date(dnesek.getFullYear(), dnesek.getMonth(), dnesek.getDate() + 1))
      : null,
    prvniKratka: vybrane[0] ? kratka(vybrane[0]) : null,
    dlouheAzZaKratkymi: (() => {
      const delky = vybrane.map(kratka);
      return delky.indexOf(false) === -1 || delky.indexOf(false) > delky.lastIndexOf(true);
    })(),
    // Prinos se nevymysli: bud bonus z platneho okna, nebo potvrzeny druh,
    // nebo se rekne, ze to v datech neni.
    prinosZDat: vybrane.every((e) => {
      const p = window.AtlasEventUI.prinos(e);
      if (p === "Podrobnosti ve zdroji") return true;
      const druhy = window.AtlasEventUI.names(e).filter((n) => P.dexKeyOf(n));
      if (druhy.some((n) => p.indexOf(n) > -1)) return true;
      const okno = window.AtlasEventUI.oknoDne(e);
      const bonus = ((okno || [])[2] || {}).bonus || [];
      return bonus.some((x) => Array.isArray(x) && x[1] !== -1 && String(x[0]).trim() === p);
    })
  };
});
await pKar.close();
check("Přehled ukáže tři karty", !dKar.chyba && dKar.karet === 3, dKar.chyba || String(dKar.karet));
check("…stav začíná u všech ve stejné výšce",
  new Set(dKar.stavy).size === 1, JSON.stringify(dKar.stavy));
check("…stejně tak název a termín",
  new Set(dKar.nadpisy).size === 1 && new Set(dKar.terminy).size === 1,
  JSON.stringify([dKar.nadpisy, dKar.terminy]));
check("…a drží to i s názvem na dva řádky", dKar.zalomenych >= 1, String(dKar.zalomenych));
check("…každá karta říká, co akce přináší",
  dKar.prinosy.length === 3 && dKar.prinosy.every((x) => x.length > 0),
  JSON.stringify(dKar.prinosy));
check("…a ten přínos je z dat, ne vymyšlený", dKar.prinosZDat === true, JSON.stringify(dKar.prinosy));
check("nahoře stojí dnešní krátká akce, ne dlouhá sezóna",
  dKar.prvniKratka === true && dKar.dlouheAzZaKratkymi === true,
  JSON.stringify({ dnes: dKar.prvniBeziDnes, kratka: dKar.prvniKratka }));

console.log("\n29) Vyhledávání: raidová fakta pod Raidy, kus zvlášť, evoluce vedle");
const pVysl29 = await otevri(1600, [
  { pokemon: "Machamp", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 }
]);
const dVysl29 = await pVysl29.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const pole = document.getElementById("prohName");
  const klik = async (sel) => { const b = document.querySelector(sel); if (b) b.click(); await cekej(400); };
  pole.value = "Charizard";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1100);
  const out = {};
  // Raidova fakta nepatri do PvP ani do identity — jsou o raidech.
  out.vPvp = { raid: document.querySelectorAll(".atlas-vysledek-raid").length,
    identita: document.querySelectorAll(".atlas-hledani-raid").length };
  await klik('[data-role="raid"]');
  const blok = document.querySelector(".atlas-vysledek-raid");
  out.vRaidu = { je: !!blok,
    cisel: blok ? blok.querySelectorAll(".atlas-vysledek-raid-cp > span").length : 0,
    text: blok ? blok.textContent.replace(/\s+/g, " ") : "" };
  // Fokus prezije prepnuti role.
  const gym = document.querySelector('[data-role="gym"]');
  if (gym) { gym.focus(); gym.click(); await cekej(400); }
  out.fokus = (document.activeElement.dataset || {}).role || "(pryc)";
  await klik('[data-role="pvp"]');
  // Evolucni moznosti vedle tabulky, podminky videt rovnou.
  pole.value = "Eevee";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1100);
  {
    const zal = document.querySelector('[data-sekce-prepnout="evoluce"]');
    if (zal) { zal.click(); await cekej(500); }
  }
  const evo = document.querySelector(".atlas-evo");
  out.evo = { je: !!evo,
    // Strom ukazuje celou radu: vstup i vsech osm vetvi.
    kusu: evo ? evo.querySelectorAll(".atlas-evo-dlazdice").length : 0,
    obrazku: evo ? evo.querySelectorAll(".atlas-evo-obr").length : 0,
    // Bez vybrane cesty se zadna cena nedosazuje.
    vyzva: evo ? (evo.querySelector("[data-evo-vyzva]") || {}).textContent || "" : "",
    // Evoluce maji vlastni zalozku — nestoji vedle tabulky, ale misto ni.
    vlastniZalozka: !!(evo && evo.closest('[data-sekce="evoluce"]')) };
  {
    const b = document.querySelector('[data-evo-cil="umbreon"]');
    if (b) { b.click(); await cekej(500); }
    const ev2 = document.querySelector(".atlas-evo");
    out.evo.podminkyPo = ev2 ? [...ev2.querySelectorAll(".atlas-evo-krok span")]
      .map((d) => d.textContent.trim()) : [];
    if (b) { b.click(); await cekej(300); }
  }
  // Kusovy rezim prida sloupec o kusu, rezim druhu ho zase sebere.
/** Zalozka "Muj kus" JE prepinac rezimu — vlastni tlacitka uz nejsou. */
function naKus() {
  const b = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
    .filter((x) => /Můj kus/.test(x.textContent))[0];
  if (b) b.click();
}
  /* Zalozka "Muj kus" rezim ZAPINA; zpatky na druh se jde vymazanim udaju,
     aby clovek o svuj kus neprisel jen tim, ze se podiva do vysledku. */
  const rezim = (k) => {
    if (k === "kus") {
      const b = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
        .filter((x) => /Můj kus/.test(x.textContent))[0];
      if (b) b.click();
      return;
    }
    // Vymazani CP a IV: appka pozna, ze uz neni s cim pocitat. `prohClear`
    // by smazal i jmeno druhu a zmizel by cely vysledek.
    ["prohCp", "prohA", "prohD", "prohS"].forEach((id) => {
      const e = document.getElementById(id);
      if (e) { e.value = ""; e.dispatchEvent(new Event("input", { bubbles: true })); }
    });
  };
  rezim("kus");
  await cekej(400);
  const nastav = (id, v) => { const e = document.getElementById(id); e.value = v;
    e.dispatchEvent(new Event("input", { bubbles: true })); };
  nastav("prohCp", "500"); nastav("prohA", "15"); nastav("prohD", "15"); nastav("prohS", "15");
  await cekej(1200);
  out.kus = { hlavicka: [...document.querySelectorAll(".atlas-vysledek-tab thead th")]
      .map((t) => t.textContent),
    radek: (document.querySelector(".atlas-vysledek-tab tr.je-vstup") || {}).textContent || "" };
  rezim("druh");
  await cekej(900);
  // Ctvrty sloupec je sipka bez nadpisu; "Tvuj kus" je ten paty.
  out.druh = { sloupcu: document.querySelectorAll(".atlas-vysledek-tab thead th").length };
  return out;
});
await pVysl29.close();
check("raidová fakta nejsou v PvP ani v identitě",
  dVysl29.vPvp.raid === 0 && dVysl29.vPvp.identita === 0, JSON.stringify(dVysl29.vPvp));
check("…a pod Raidy nestojí věta, co je jinde potřetí",
  dVysl29.vRaidu.je === false, dVysl29.vRaidu.text.slice(0, 60));
check("fokus přežije přepnutí role", dVysl29.fokus === "gym", dVysl29.fokus);
check("evoluční možnosti mají vlastní záložku",
  dVysl29.evo.je === true && dVysl29.evo.vlastniZalozka === true,
  JSON.stringify({ je: dVysl29.evo.je, zalozka: dVysl29.evo.vlastniZalozka }));
check("…jako strom: vstup a všech osm větví",
  dVysl29.evo.kusu === 9 && dVysl29.evo.obrazku === 9,
  JSON.stringify([dVysl29.evo.kusu, dVysl29.evo.obrazku]));
check("…bez vybrané cesty se nic nedosazuje",
  /Vyber evoluci a cílový level/.test(dVysl29.evo.vyzva), dVysl29.evo.vyzva);
check("…a po výběru je vidět podmínka právě té cesty",
  dVysl29.evo.podminkyPo.length === 1 && /v noci/.test(dVysl29.evo.podminkyPo[0]),
  JSON.stringify(dVysl29.evo.podminkyPo));
const pojmenovane = (h) => h.filter((x) => x.trim().length > 0);
check("kusový režim přidá sloupec o konkrétním kusu",
  pojmenovane(dVysl29.kus.hlavicka).length === 4
    && /Tvůj kus/.test(dVysl29.kus.hlavicka.join(" ")),
  JSON.stringify(dVysl29.kus.hlavicka));
check("…a řekne o něm jen to, co jde spočítat",
  /% IV|IV #|nedá se spočítat/.test(dVysl29.kus.radek), dVysl29.kus.radek.slice(0, 80));
check("…v režimu druhu ten sloupec zase zmizí", dVysl29.druh.sloupcu === 4,
  String(dVysl29.druh.sloupcu));

console.log("\n30) Vlastní kus: formulář přijede do pohledu a IV rank nese ligu");
const pKus30 = await otevri(1440, [
  { pokemon: "Machamp", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 }
]);
const dKus30 = await pKus30.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const pole = document.getElementById("prohName");
  pole.value = "Azumarill";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1300);
  const out = { pred: { scroll: Math.round(window.scrollY) } };
/** Zalozka "Muj kus" JE prepinac rezimu — vlastni tlacitka uz nejsou. */
function naKus() {
  const b = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
    .filter((x) => /Můj kus/.test(x.textContent))[0];
  if (b) b.click();
}
  naKus();
  await cekej(1200);
  const cp = document.getElementById("prohCp");
  out.poPrepnuti = {
    fokus: document.activeElement ? document.activeElement.id : "",
    otevrene: !!document.querySelector(".atlas-hledani-udaje[open]"),
    // Přepnutí režimu otevře záložku s formulářem — musí být vidět.
    zalozka: (document.querySelector('[data-sekce-prepnout="kus"]') || {})
      .getAttribute ? document.querySelector('[data-sekce-prepnout="kus"]')
        .getAttribute("aria-selected") : "",
    cpVidet: (() => { const r = cp.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight; })()
  };
  const nastav = (id, v) => { const e = document.getElementById(id); e.value = v;
    e.dispatchEvent(new Event("input", { bubbles: true })); };
  nastav("prohCp", "1400"); nastav("prohA", "0"); nastav("prohD", "15"); nastav("prohS", "15");
  await cekej(1400);
  {
    const zal = document.querySelector('[data-sekce-prepnout="prehled"]');
    if (zal) { zal.click(); await cekej(500); }
  }
  const bunka = () => (document.querySelector(".atlas-vysledek-tab tr.je-vstup td:nth-child(4)") || {})
    .textContent || "";
  out.great = bunka();
  const ul = document.querySelector('[data-liga="ultra"]');
  if (ul) { ul.click(); await cekej(600); }
  out.ultra = bunka();
  const raid = document.querySelector('[data-role="raid"]');
  if (raid) { raid.click(); await cekej(600); }
  out.raid = bunka();
  // Zpátky na výsledky.
  const pvp = document.querySelector('[data-role="pvp"]');
  if (pvp) { pvp.click(); await cekej(400); }
  const zalKus = document.querySelector('[data-sekce-prepnout="kus"]');
  if (zalKus) { zalKus.click(); await cekej(500); }
  const zpet = document.querySelector("[data-zpet-vysledky]");
  out.tlacitkoZpet = !!zpet;
  if (zpet) { zpet.click(); await cekej(600); }
  out.poZpet = { zalozka: (document.querySelector('[data-sekce-prepnout="prehled"]') || {})
    .getAttribute ? document.querySelector('[data-sekce-prepnout="prehled"]')
      .getAttribute("aria-selected") : "" };
  return out;
});
await pKus30.close();
check("přepnutí na vlastní kus otevře jeho záložku a formulář je vidět",
  dKus30.poPrepnuti.otevrene === true && dKus30.poPrepnuti.zalozka === "true"
    && dKus30.poPrepnuti.cpVidet === true, JSON.stringify(dKus30.poPrepnuti));
check("…a fokus sedne na CP", dKus30.poPrepnuti.fokus === "prohCp", dKus30.poPrepnuti.fokus);
check("IV rank v tabulce nese jméno vybrané ligy",
  /Great League/.test(dKus30.great) && /Ultra League/.test(dKus30.ultra)
    && dKus30.great !== dKus30.ultra,
  JSON.stringify([dKus30.great, dKus30.ultra]));
check("…a v roli bez ligového limitu se nepočítá",
  !/IV #/.test(dKus30.raid), dKus30.raid);
check("z formuláře vede cesta zpátky na výsledky",
  dKus30.tlacitkoZpet === true && dKus30.poZpet.zalozka === "true",
  JSON.stringify([dKus30.tlacitkoZpet, dKus30.poZpet.zalozka]));

console.log("\n31) Pás CP při 100 % IV a kotvy na sekce");
const pCp31 = await otevri(1440, [
  { pokemon: "Machamp", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 }
]);
const dCp31 = await pCp31.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const P = window.__pgo;
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const pole = document.getElementById("prohName");
  pole.value = "Eevee";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1400);
  const pas = document.querySelector(".atlas-cp-pas");
  const bunky = pas ? [...pas.querySelectorAll(".atlas-cp-bunka")] : [];
  const out = {
    je: !!pas,
    // Pás patří mezi identitu a výsledky, ne až pod ně.
    poradi: pas ? [pas.previousElementSibling.className, pas.nextElementSibling.className] : [],
    // Popisek je nad cislem a level pod nim — ctou se oba.
    popisky: bunky.map((b) => ((b.querySelector("span") || {}).textContent || "")
      + " · " + ((b.querySelector("i") || {}).textContent || "")),
    hodnoty: bunky.map((b) => (b.querySelector("b") || {}).textContent || ""),
    // Čísla musí sedět s tím, co spočítá engine.
    // Levely jdou vzestupne; raid a vejce jsou tataz hodnota (L20) a stoji
    // v jedne bunce.
    sediSEnginem: [15, 20, 25, 40].every((lvl, i) => {
      const cp = P.atlasCP("Eevee", lvl);
      return String(cp == null ? "—" : cp) === (bunky[i]
        ? (bunky[i].querySelector("b") || {}).textContent : "");
    }),
    pozn: (pas && pas.querySelector(".atlas-cp-pozn") || {}).textContent || "",
    kotvy: [...document.querySelectorAll(".atlas-sekce-zalozky button")].map((b) => b.textContent.trim())
  };
  // Pod Raidy se pás CP neopakuje.
  const raid = document.querySelector('[data-role="raid"]');
  if (raid) { raid.click(); await cekej(600); }
  const blok = document.querySelector(".atlas-vysledek-raid");
  out.raidBlok = blok ? blok.textContent.replace(/\s+/g, " ").trim() : "";
  out.raidCisla = blok ? blok.querySelectorAll(".atlas-vysledek-raid-cp").length : -1;
  const pvp = document.querySelector('[data-role="pvp"]');
  if (pvp) { pvp.click(); await cekej(400); }
  return out;
});
await pCp31.close();
check("pás CP stojí mezi identitou a záložkami sekcí",
  dCp31.je === true && /identita/.test(dCp31.poradi[0]) && /sekce/.test(dCp31.poradi[1]),
  JSON.stringify(dCp31.poradi));
check("…má čtyři buňky od nejnižšího levelu po nejvyšší",
  dCp31.popisky.length === 4
    && /Výzkum · L15/.test(dCp31.popisky[0])
    && /Raid a vejce · L20/.test(dCp31.popisky[1])
    && /L25/.test(dCp31.popisky[2])
    && /Strop · L40/.test(dCp31.popisky[3]),
  JSON.stringify(dCp31.popisky));
check("…čísla sedí s tím, co spočítá engine", dCp31.sediSEnginem === true,
  JSON.stringify(dCp31.hodnoty));
check("…a pod pásem už nestojí vysvětlující věta",
  dCp31.pozn === "", dCp31.pozn.slice(0, 70));
check("pod Raidy se pás CP neopakuje",
  dCp31.raidCisla === -1 && dCp31.raidBlok === "", dCp31.raidBlok.slice(0, 80));
check("záložky sekcí stojí v pevném pořadí",
  dCp31.kotvy.join("|") === "Přehled|Typy|Evoluce|Rozbor|Můj kus",
  JSON.stringify(dCp31.kotvy));

console.log("\n31b) Záložka sekce přepne obsah a přenese fokus");
const pKot31 = await otevri(820, [
  { pokemon: "Machamp", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 }
]);
const dKot31 = await pKot31.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const pole = document.getElementById("prohName");
  pole.value = "Eevee";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1400);
  const panel = (k) => document.querySelector('.atlas-sekce-panel[data-sekce="' + k + '"]');
  const out = { prehledVidet: panel("prehled") ? !panel("prehled").hidden : null,
    evoluceVidet: panel("evoluce") ? !panel("evoluce").hidden : null };
  const b = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
    .find((x) => /Evoluce/.test(x.textContent));
  out.kotvaJe = !!b;
  if (b) { b.click(); await cekej(700); }
  out.poKliknuti = { prehled: panel("prehled") ? !panel("prehled").hidden : null,
    evoluce: panel("evoluce") ? !panel("evoluce").hidden : null,
    obrazku: document.querySelectorAll(".atlas-evo-obr").length };
  out.fokus = document.activeElement
    ? (document.activeElement.className || document.activeElement.tagName) : "";
  return out;
});
await pKot31.close();
check("na začátku je vidět Přehled, ne evoluce",
  dKot31.prehledVidet === true && dKot31.evoluceVidet === false,
  JSON.stringify([dKot31.prehledVidet, dKot31.evoluceVidet]));
check("…záložka Evoluce obsah přepne",
  dKot31.kotvaJe === true && dKot31.poKliknuti.evoluce === true
    && dKot31.poKliknuti.prehled === false && dKot31.poKliknuti.obrazku === 9,
  JSON.stringify(dKot31.poKliknuti));
check("…a přenese na ni fokus", /atlas-sekce-panel/.test(dKot31.fokus), dKot31.fokus);

console.log("\n32) Záložka Typy: obojím směrem a bez vymyšlených counterů");
const pTyp32 = await otevri(1440, []);
const dTyp32 = await pTyp32.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const pole = document.getElementById("prohName");
  pole.value = "Charizard";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1400);
  const zal = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
    .find((b) => /Typy/.test(b.textContent));
  const out = { zalozkaJe: !!zal };
  if (zal) { zal.click(); await cekej(600); }
  const sek = document.querySelector(".atlas-typy");
  out.je = !!sek;
  out.nadpisy = sek ? [...sek.querySelectorAll("h4")].map((h) => h.textContent) : [];
  out.radky = sek ? [...sek.querySelectorAll(".atlas-typy-radek")].map((r) => ({
    popis: (r.querySelector("b") || {}).textContent,
    nasobek: (r.querySelector(".atlas-typy-nasobek") || {}).textContent || "",
    chipu: r.querySelectorAll(".d-type, .atlas-typy-kombinace").length
  })) : [];
  // Chipy nesmi stat kazdy na vlastnim radku.
  out.chipyVRadku = sek ? (() => {
    const r = sek.querySelector('[data-bez-cisla] .atlas-typy-chipy');
    if (!r) return null;
    const y = [...r.children].map((c) => Math.round(c.getBoundingClientRect().top));
    return new Set(y).size;
  })() : null;
  out.pozn = sek ? [...sek.querySelectorAll(".atlas-typy-pozn")].map((x) => x.textContent) : [];
  // Prazdny roster: tlacitko to rekne, nevykresli vymysleny tym.
  const b = document.querySelector("[data-counter-rezim]");
  out.tlacitko = !!b;
  if (b) { b.click(); await cekej(500); }
  out.poKliknuti = {
    hlaska: (document.querySelector("[data-counter-hlaska]") || {}).textContent || "",
    rosterBeze: window.__pgo.getRows().length
  };
  return out;
});
await pTyp32.close();
check("Typy mají vlastní záložku a dvě části",
  dTyp32.zalozkaJe === true && dTyp32.je === true
    && /Čím ho zasáhneš/.test(dTyp32.nadpisy.join(" "))
    && /Kam se hodí jeho útoky/.test(dTyp32.nadpisy.join(" ")),
  JSON.stringify(dTyp32.nadpisy));
check("…obrana je po skupinách s násobkem",
  dTyp32.radky.some((r) => /Dvojnásobná slabina/.test(r.popis) && /2,56/.test(r.nasobek))
    && dTyp32.radky.some((r) => /Dvojnásobná odolnost/.test(r.popis)),
  JSON.stringify(dTyp32.radky.slice(0, 3)));
check("…a říká se, že násobky platí pro kombinaci typů",
  /kombinaci typů/.test(dTyp32.pozn.join(" ")), dTyp32.pozn[0] || "");
check("…útočná část se počítá z doporučené sestavy",
  /doporučené sestavy/.test(dTyp32.pozn.join(" ")), dTyp32.pozn[1] || "");
check("…kombinace typů stojí vedle sebe, ne po jedné na řádek",
  dTyp32.chipyVRadku !== null && dTyp32.chipyVRadku <= 2, String(dTyp32.chipyVRadku));
check("counter vede do rosteru a u prázdného to řekne",
  dTyp32.tlacitko === true && /naimportuj roster/.test(dTyp32.poKliknuti.hlaska)
    && dTyp32.poKliknuti.rosterBeze === 0,
  JSON.stringify(dTyp32.poKliknuti));

console.log("\n33) Obrázky druhů sedí v rámečku, ne rámeček v obrázku");
// Engine sprite posouva a zvetsuje transformem na samotnem <img>. Kdyz ma
// obrazek sam pozadi a odsazeni, zvetsi se s nim i ramecek — proto ramecek
// musi byt obal a obrazek v nem jen vyplnovat plochu.
for (const sirka33 of [1440, 390]) {
  const p33 = await otevri(sirka33, []);
  const d33 = await p33.evaluate(async (jeMobil) => {
    const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__pgoZalozka("prohlidkaCard");
    await cekej(1200);
    const pole = document.getElementById("prohName");
    pole.value = "Magby";
    pole.dispatchEvent(new Event("input", { bubbles: true }));
    await cekej(1600);
    const out = { ramecky: [], obrazekSTridou: 0 };
    const zmer = (sel) => {
      // Trida nesmi sedet na <img> — tam by ji engine roztahl spolu se spritem.
      out.obrazekSTridou += document.querySelectorAll("img" + sel).length;
      const ram = document.querySelector("span" + sel);
      if (!ram) { out.ramecky.push({ sel, chybi: true }); return; }
      const im = ram.querySelector("img");
      const sr = getComputedStyle(ram), si = im ? getComputedStyle(im) : null;
      const vnitrek = ram.clientWidth - parseFloat(sr.paddingLeft) - parseFloat(sr.paddingRight);
      out.ramecky.push({ sel, sirka: Math.round(ram.getBoundingClientRect().width),
        overflow: sr.overflow, obrazekJe: !!im,
        vyplnuje: si ? Math.abs(parseFloat(si.width) - vnitrek) <= 1 : false,
        obrazekBezPozadi: si ? (si.paddingLeft === "0px"
          && /rgba\(0, 0, 0, 0\)|transparent/.test(si.backgroundColor)) : false,
        vystredeno: im ? im.dataset.vystredeno || "" : "" });
    };
    // Merit se musi na VIDITELNE zalozce: skryta ma nulovou sirku.
    zmer(".atlas-hledani-obr");
    zmer(".atlas-vysledek-obr");
    if (!jeMobil) {
      const z = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
        .find((b) => /Evoluce/.test(b.textContent));
      if (z) { z.click(); await cekej(700); }
      zmer(".atlas-evo-obr");
    }
    return out;
  }, sirka33 === 390);
  await p33.close();
  const jm = sirka33 + " px";
  check(jm + ": obrázek druhu je vždy v obalu, ne sám rámečkem",
    d33.obrazekSTridou === 0 && d33.ramecky.every((r) => !r.chybi && r.obrazekJe),
    JSON.stringify(d33));
  check(jm + ": obal ořezává a obrázek ho vyplňuje bez vlastního pozadí",
    d33.ramecky.every((r) => r.overflow === "hidden" && r.vyplnuje && r.obrazekBezPozadi),
    JSON.stringify(d33.ramecky));
  check(jm + ": engine dostal obrázky k vystředění",
    d33.ramecky.every((r) => r.vystredeno === "1"),
    JSON.stringify(d33.ramecky.map((r) => [r.sel, r.vystredeno])));
  if (sirka33 === 390) {
    const ident = d33.ramecky.find((r) => r.sel === ".atlas-hledani-obr");
    check("390 px: identita má obrázek pod 60 px, jak chce návrh V3",
      ident && ident.sirka <= 60 && ident.sirka >= 44, JSON.stringify(ident));
  }
}

console.log("\n34) Evoluce a náklady: jedna cesta, poctivé podmínky, mega zvlášť");
const pEvo34 = await otevri(1440, []);
const dEvo34 = await pEvo34.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const napis = async (druh) => {
    const pole = document.getElementById("prohName");
    pole.value = druh;
    pole.dispatchEvent(new Event("input", { bubbles: true }));
    await cekej(1500);
  };
  const doEvoluce = async () => {
    const z = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
      .find((b) => /Evoluce/.test(b.textContent));
    if (z) { z.click(); await cekej(600); }
  };
  const text = () => (document.querySelector(".atlas-evo-detail") || {}).textContent || "";
  const cena = () => {
    const out = {};
    document.querySelectorAll(".atlas-evo-radek").forEach((r) => {
      out[(r.querySelector("dt") || {}).textContent] = (r.querySelector("dd") || {}).textContent;
    });
    return out;
  };
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const out = {};

  await napis("Charmander");
  await doEvoluce();
  // Strom: tri patra po sobe a mega na vlastni vetvi.
  out.pater = document.querySelectorAll(".atlas-evo-patro").length;
  out.sipek = document.querySelectorAll(".atlas-evo-sipka").length;
  const mega = document.querySelector(".atlas-evo-mega");
  out.mega = { je: !!mega,
    popis: mega ? (mega.querySelector(".atlas-evo-mega-popis") || {}).textContent : "",
    dlazdic: mega ? mega.querySelectorAll("[data-evo-mega]").length : 0,
    carkovane: mega
      ? getComputedStyle(mega.querySelector("[data-evo-mega]")).borderTopStyle : "" };
  // Zadna cesta: zadna cena.
  out.bezVyberu = { vyzva: !!document.querySelector("[data-evo-vyzva]"),
    radku: document.querySelectorAll(".atlas-evo-radek").length };

  // Cesta Charmander -> Charizard: dva kroky, obojí bez další podmínky.
  const cil = document.querySelector('[data-evo-cil="charizard"]');
  if (cil) { cil.click(); await cekej(600); }
  out.cesta = { kroku: document.querySelectorAll(".atlas-evo-krok").length,
    text: text().replace(/\s+/g, " "), cena: cena() };
  // L50 pripocte XL zvlast, ne do beznych bonbonu.
  const l50 = document.querySelector('[data-evo-level="50"]');
  if (l50) { l50.click(); await cekej(600); }
  out.l50 = cena();

  // Mega: energie zvlast, nikdy scitana s bonbony.
  const mg = document.querySelector("[data-evo-mega]");
  if (mg) { mg.click(); await cekej(600); }
  out.poMega = { text: text().replace(/\s+/g, " "), cena: cena() };

  // Predmet u evoluce se ukaze jako vlastni polozka.
  await napis("Slowpoke");
  await doEvoluce();
  const king = [...document.querySelectorAll("[data-evo-cil]")]
    .find((b) => /Slowking/.test(b.textContent));
  if (king) { king.click(); await cekej(600); }
  out.predmet = { je: !!king, cena: cena(), text: text().replace(/\s+/g, " ") };

  // Prepnuti druhu nesmi nechat vybranou evoluci predchoziho.
  await napis("Magby");
  await doEvoluce();
  out.poZmene = { vyzva: !!document.querySelector("[data-evo-vyzva]"),
    vybranych: document.querySelectorAll('[data-evo-cil][aria-pressed="true"]').length };
  return out;
});
await pEvo34.close();
check("strom je po patrech a mega visí na vlastní čárkované větvi",
  dEvo34.pater === 3 && dEvo34.sipek === 2 && dEvo34.mega.je === true
    && dEvo34.mega.dlazdic === 2 && dEvo34.mega.carkovane === "dashed"
    && /Dočasná mega forma/.test(dEvo34.mega.popis),
  JSON.stringify(dEvo34.mega));
check("bez vybrané cesty se žádná cena nepočítá",
  dEvo34.bezVyberu.vyzva === true && dEvo34.bezVyberu.radku === 0,
  JSON.stringify(dEvo34.bezVyberu));
check("cena platí pro JEDNU cestu a jmenuje odkud kam",
  dEvo34.cesta.kroku === 2 && /Charmander L1 → Charizard L40/.test(dEvo34.cesta.text)
    && dEvo34.cesta.cena["Prach"] && dEvo34.cesta.cena["Bonbóny"],
  JSON.stringify([dEvo34.cesta.kroku, dEvo34.cesta.cena]));
check("…a u ověřeně bezpodmínečné evoluce nepadne „stačí bonbóny“",
  /žádnou další podmínku data neuvádějí/.test(dEvo34.cesta.text)
    && !/stačí bonbóny/.test(dEvo34.cesta.text),
  dEvo34.cesta.text.slice(0, 120));
check("L50 přidá XL bonbóny jako vlastní řádek",
  !dEvo34.cesta.cena["XL bonbóny"] && !!dEvo34.l50["XL bonbóny"]
    && dEvo34.l50["Bonbóny"] === dEvo34.cesta.cena["Bonbóny"],
  JSON.stringify(dEvo34.l50));
check("mega energie stojí zvlášť a neplete se s bonbóny",
  /Mega energie poprvé/.test(dEvo34.poMega.text) && /Dočasná forma/.test(dEvo34.poMega.text)
    && !dEvo34.poMega.cena["Bonbóny"] && !dEvo34.poMega.cena["Prach"],
  JSON.stringify(dEvo34.poMega.cena));
check("předmět u evoluce je vlastní položka ceny",
  dEvo34.predmet.je === true && /Rock/.test(dEvo34.predmet.cena["Předmět"] || ""),
  JSON.stringify(dEvo34.predmet.cena));
check("změna druhu zahodí vybranou cestu předchozího",
  dEvo34.poZmene.vyzva === true && dEvo34.poZmene.vybranych === 0,
  JSON.stringify(dEvo34.poZmene));

console.log("\n35) Rozbor: využití a útoky, nic dvakrát");
const pRoz35 = await otevri(1440, []);
const dRoz35 = await pRoz35.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const pole = document.getElementById("prohName");
  pole.value = "Charizard";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1600);
  const z = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
    .find((b) => /Rozbor/.test(b.textContent));
  if (z) { z.click(); await cekej(700); }
  const panel = document.querySelector('.atlas-sekce-panel[data-sekce="rozbor"]');
  const videt = (el) => !!el && getComputedStyle(el).display !== "none"
    && el.getBoundingClientRect().height > 0;
  const najdi = (text) => [...panel.querySelectorAll(".d-sec-h")]
    .find((el) => new RegExp(text).test(el.textContent));
  const out = {
    naCoJe: videt(najdi("Na co je")),
    utoky: videt(najdi("Nejlepší útoky")),
    // Tohle uz ma vlastni zalozku — v rozboru by to bylo podruhe.
    ligy: videt(najdi("Ligy podrobně")),
    typy: videt(najdi("Proti čemu")),
    evoluce: videt(panel.querySelector(".d-evo-side")),
    // Verdikt nechat/pustit sem nepatri: ten plati jen v kontextu rosteru.
    verdikt: [...panel.querySelectorAll("*")].filter((el) => !el.children.length
      && /Ponechat|Zahodit|Pustit/.test(el.textContent || "")).length,
    // Zaverecne odstavce uz v Rozboru nejsou — zalozky jsou na dosah.
    odkaz: (panel.querySelector(".atlas-rozbor-pozn") || {}).textContent || "",
    hlavicka: !!panel.querySelector(".d-verdict-row"),
    hint: !!panel.querySelector(".proh-hint")
  };
  return out;
});
await pRoz35.close();
check("v Rozboru zůstalo využití a útoky",
  dRoz35.naCoJe === true && dRoz35.utoky === true, JSON.stringify(dRoz35));
check("…ligy, evoluce ani typy tam nestojí podruhé",
  dRoz35.ligy === false && dRoz35.evoluce === false && dRoz35.typy === false,
  JSON.stringify([dRoz35.ligy, dRoz35.evoluce, dRoz35.typy]));
check("…žádný druhý verdikt nechat/pustit mimo roster",
  dRoz35.verdikt === 0, String(dRoz35.verdikt));
check("…ani hlavička a závěrečné odstavce, co jen opakují okolí",
  dRoz35.odkaz === "" && dRoz35.hlavicka === false && dRoz35.hint === false,
  JSON.stringify([dRoz35.odkaz.slice(0, 40), dRoz35.hlavicka, dRoz35.hint]));

console.log("\n36) Cena evoluce u vlastního kusu: od jeho levelu, ne od vymyšleného");
const pKus36 = await otevri(1440, []);
const dKus36 = await pKus36.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const nastav = (id, v) => { const e = document.getElementById(id); e.value = v;
    e.dispatchEvent(new Event("input", { bubbles: true })); };
  const doEvoluce = async () => {
    const z = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
      .find((b) => /Evoluce/.test(b.textContent));
    if (z) { z.click(); await cekej(700); }
    const c = document.querySelector('[data-evo-cil="magmortar"]');
    if (c && c.getAttribute("aria-pressed") !== "true") { c.click(); await cekej(700); }
    const det = document.querySelector(".atlas-evo-detail");
    const cena = {};
    document.querySelectorAll(".atlas-evo-radek").forEach((r) => {
      cena[(r.querySelector("dt") || {}).textContent] = (r.querySelector("dd") || {}).textContent;
    });
    return { hlavicka: (det.querySelector("h5") || {}).textContent || "",
      text: det.textContent.replace(/\s+/g, " "), cena };
  };
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const pole = document.getElementById("prohName");
  pole.value = "Magby";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1500);
  const out = { druh: await doEvoluce() };
/** Zalozka "Muj kus" JE prepinac rezimu — vlastni tlacitka uz nejsou. */
function naKus() {
  const b = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
    .filter((x) => /Můj kus/.test(x.textContent))[0];
  if (b) b.click();
}
  naKus();
  await cekej(900);
  nastav("prohCp", "600"); nastav("prohLv", "22");
  nastav("prohA", "15"); nastav("prohD", "15"); nastav("prohS", "15");
  await cekej(1500);
  out.kus = await doEvoluce();
  // CP a IV, ze kterych level nevyjde: appka nesmi tvrdit, ze kus je L1.
  nastav("prohLv", ""); nastav("prohCp", "600");
  await cekej(1500);
  out.bezLevelu = await doEvoluce();
  out.bezLevelu.level = (window.__pgoProhlidkaKus() || {}).level;
  return out;
});
await pKus36.close();
check("druhový režim je výslovně ukázka od L1",
  /Magby L1 →/.test(dKus36.druh.hlavicka) && /Ukázkový model od L1/.test(dKus36.druh.text),
  dKus36.druh.hlavicka);
check("…kusový počítá od skutečného levelu kusu",
  /Magby L22 →/.test(dKus36.kus.hlavicka) && !/Ukázkový model/.test(dKus36.kus.text)
    && dKus36.kus.cena["Prach"] !== dKus36.druh.cena["Prach"],
  JSON.stringify([dKus36.kus.hlavicka, dKus36.kus.cena["Prach"], dKus36.druh.cena["Prach"]]));
check("…a když level z CP a IV nevyjde, řekne to místo mlčení",
  dKus36.bezLevelu.level === null
    && /Level kusu se z CP a IV spočítat nedá/.test(dKus36.bezLevelu.text),
  dKus36.bezLevelu.text.slice(0, 120));

console.log("\n37) Čištění boxu: úprava jako okno nad ním, rámeček se vejde, shadow má Frustration");
const pCis37 = await otevri(1440, [
  { pokemon: "Reshiram", cp: 1461, level: 13, ivAtk: 12, ivDef: 8, ivSta: 15,
    forma: "Shadow", fastMove: "Fire Fang", charged1: "" }
]);
const dCis37 = await pCis37.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("novinkyOkno")?.remove();
  document.getElementById("boxModeBtn").click();
  await cekej(1500);
  // uvodni hlaska sekce pryc, jinak drzi ruku
  const ok = document.querySelector("#appOkno button, .app-okno button");
  if (ok) { ok.click(); await cekej(700); }
  document.getElementById("novinkyOkno")?.remove();
  const out = { pozicePred: (document.getElementById("bmPos") || {}).textContent || "" };
  // Ramecek "tady jsi" se kresli dovnitr, takze ho orezani sloupce nesebere.
  const tady = document.querySelector("#boxMode .d-evo-kus.tady");
  if (tady) {
    const st = getComputedStyle(tady);
    out.tady = { outline: st.outlineWidth, stin: st.boxShadow,
      // dlazdice sedi na okraji sloupce, ktery ma overflow:hidden
      naOkraji: Math.round(tady.getBoundingClientRect().left)
        === Math.round(tady.closest(".d-evo").getBoundingClientRect().left) };
  }
  const evoPred = document.querySelector("#boxMode .d-evo");
  out.evoSirkaPred = evoPred ? Math.round(evoPred.getBoundingClientRect().width) : 0;
  // Upravit otevre okno NAD cistenim, ne vlozku do sloupce s evoluci.
  const u = document.querySelector("#boxMode [data-box-edit]");
  out.tlacitko = !!u;
  if (u) { u.click(); await cekej(900); }
  const okno = document.getElementById("atlasRowEditorDialog");
  const form = document.getElementById("atlasRowEditor");
  const evoPo = document.querySelector("#boxMode .d-evo");
  out.okno = { je: !!okno, formVNem: !!(okno && form && okno.contains(form)),
    vSloupci: !!(form && form.closest(".atlas-box-rozbor")),
    nadCistenim: okno ? Number(getComputedStyle(okno).zIndex) : null,
    evoSirkaPo: evoPo ? Math.round(evoPo.getBoundingClientRect().width) : 0 };
  // Shadow kus: Frustration je v nabidce, i kdyz ho learnset nema.
  const pole = document.querySelector('[data-utok-obal="charged1"] .uv-pole');
  if (pole) { pole.click(); await cekej(600); }
  const seznam = document.querySelector(".uv-seznam");
  out.nabidka = {
    polozky: [...document.querySelectorAll(".uv-seznam .uv-radek, .uv-seznam button")]
      .map((x) => x.textContent.replace(/\s+/g, " ").trim()),
    // Nabidka musi zustat NAD oknem, jinak z ni nejde vybrat.
    nahore: seznam ? Number(getComputedStyle(seznam).zIndex)
      > Number(getComputedStyle(document.getElementById("atlasRowEditorDialog")).zIndex) : null
  };
  // Psani do policka nesmi rozhodovat o kusech pod oknem.
  const jmeno = document.querySelector('#atlasRowEditor [name="pokemon"]');
  if (jmeno) {
    jmeno.focus();
    ["d", "p"].forEach((k) => jmeno.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true })));
    await cekej(400);
  }
  out.pozicePoPsani = (document.getElementById("bmPos") || {}).textContent || "";
  // Esc nejdriv zavre rozbalenou nabidku — rozepsana uprava zustane.
  const esc = () => (document.getElementById("atlasRowEditorDialog") || document.body)
    .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  esc();
  await cekej(500);
  out.poPrvnimEsc = { nabidka: !!document.querySelector(".uv-seznam"),
    okno: !!document.getElementById("atlasRowEditorDialog") };
  // Teprve druhy Esc zavre okno — a cisteni pod nim bezi dal.
  esc();
  await cekej(500);
  out.poEsc = { okno: !!document.getElementById("atlasRowEditorDialog"),
    cisteni: !document.getElementById("boxMode").hidden };
  return out;
});
await pCis37.close();
check("označení „tady jsi“ se kreslí dovnitř, takže ho ořez sloupce nesebere",
  dCis37.tady && dCis37.tady.outline === "0px" && /inset/.test(dCis37.tady.stin),
  JSON.stringify(dCis37.tady));
check("Upravit otevře okno nad čištěním, ne vložku do evoluční řady",
  dCis37.tlacitko === true && dCis37.okno.je === true && dCis37.okno.formVNem === true
    && dCis37.okno.vSloupci === false
    && dCis37.okno.evoSirkaPo === dCis37.evoSirkaPred,
  JSON.stringify(dCis37.okno));
check("…a nabídka útoků zůstane nad oknem, jinak z ní nejde vybrat",
  dCis37.nabidka.nahore === true, String(dCis37.nabidka.nahore));
check("shadow kus nabízí Frustration, i když ho druh v learnsetu nemá",
  dCis37.nabidka.polozky.some((t) => /Frustration/.test(t)),
  JSON.stringify(dCis37.nabidka.polozky.slice(0, 8)));
check("psaní do formuláře nerozhoduje o kusech pod oknem",
  dCis37.pozicePoPsani === dCis37.pozicePred,
  JSON.stringify([dCis37.pozicePred, dCis37.pozicePoPsani]));
check("Esc zavře nejdřív nabídku útoků, rozepsaná úprava zůstane",
  dCis37.poPrvnimEsc.nabidka === false && dCis37.poPrvnimEsc.okno === true,
  JSON.stringify(dCis37.poPrvnimEsc));
check("…a teprve pak úpravu, ne celé čištění",
  dCis37.poEsc.okno === false && dCis37.poEsc.cisteni === true,
  JSON.stringify(dCis37.poEsc));

// Vlajka testovaciho sestaveni. Kdyz se vlozi na spatne misto (drive ji
// sestaveni psalo pred PRVNI vyskyt "<body" v souboru — trefilo i zminku
// v komentari vrstvy), tvari se test jako produkce: samo se otevre okno
// Novinky a testovaci popisky zmizi.
const pVlajka = await otevri(1200, []);
const dVlajka = await pVlajka.evaluate(() => ({
  vlajka: window.__ATLAS_TEST_BUILD === true,
  nazev: window.__ATLAS_TEST_NAZEV || ""
}));
await pVlajka.close();
check("testovací sestavení se hlásí jako testovací",
  dVlajka.vlajka === true && /TEST/.test(dVlajka.nazev), JSON.stringify(dVlajka));

console.log("\n38) Čištění na telefonu: rozhoduje se podle kusu, ne podle evoluční řady");
const pMob38 = await otevri(390, [
  { pokemon: "Garchomp", cp: 2800, level: 30, ivAtk: 14, ivDef: 13, ivSta: 12,
    fastMove: "Mud Shot", charged1: "Outrage" },
  { pokemon: "Eevee", cp: 500, level: 20, ivAtk: 12, ivDef: 12, ivSta: 12,
    fastMove: "Quick Attack", charged1: "Last Resort" }
]);
const dMob38 = await pMob38.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("novinkyOkno")?.remove();
  document.getElementById("boxModeBtn").click();
  await cekej(1500);
  const ok = document.querySelector("#appOkno button, .app-okno button");
  if (ok) { ok.click(); await cekej(700); }
  document.getElementById("novinkyOkno")?.remove();
  const videt = (sel) => { const el = document.querySelector(sel);
    if (!el) return null;
    const q = el.getBoundingClientRect();
    return getComputedStyle(el).display !== "none" && q.width > 0 && q.height > 0; };
  const body = document.querySelector("#boxMode .bm-body");
  const prvky = [...document.querySelectorAll("#boxMode .bm-body > *")]
    .filter((el) => getComputedStyle(el).display !== "none")
    .map((el) => ({ trida: el.className.slice(0, 20),
      w: Math.round(el.getBoundingClientRect().width) }));
  return {
    // Rozbor z plachty se na uzke okno nevejde — na telefonu se nekresli.
    rozbor: videt("#boxMode .atlas-box-rozbor"),
    // Zato to, podle ceho se rozhoduje, videt musi.
    hlava: videt("#boxMode .bm-head"),
    verdikt: videt("#boxMode .bm-verdikt"),
    role: videt("#boxMode .bm-roles"),
    // Prikazy "ve hre jsem s nim neco udelal" vcetne Upravit.
    pruh: videt("#boxMode .hra-pruh"),
    upravit: videt("#boxMode [data-box-edit]"),
    tlacitka: videt("#boxMode #bmDrop") && videt("#boxMode #bmKeep"),
    // Nic nesmi prelezt do strany.
    doStrany: body ? body.scrollWidth > body.clientWidth + 2 : null,
    sirky: prvky, sirkaOkna: window.innerWidth
  };
});
await pMob38.close();
check("na telefonu je vidět kus, verdikt i role",
  dMob38.hlava === true && dMob38.verdikt === true && dMob38.role === true,
  JSON.stringify(dMob38));
check("…rozbor s evoluční řadou se tam nekreslí",
  dMob38.rozbor === false, String(dMob38.rozbor));
check("…příkazy „ve hře“ i Upravit zůstanou po ruce",
  dMob38.pruh === true && dMob38.upravit === true,
  JSON.stringify([dMob38.pruh, dMob38.upravit]));
check("…tlačítka Pustit/Nechat jsou vidět a nic neleze do strany",
  dMob38.tlacitka === true && dMob38.doStrany === false
    && dMob38.sirky.every((x) => x.w <= dMob38.sirkaOkna),
  JSON.stringify(dMob38.sirky));

console.log("\n39) Vyhledávání: po vybrání druhu pole pustí kurzor");
const pFok39 = await otevri(1440, []);
const dFok39 = await pFok39.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("novinkyOkno")?.remove();
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const pole = document.getElementById("prohName");
  const panel = () => [...document.querySelectorAll("div")]
    .filter((d) => d.querySelector(".druh-polozka"))[0] || null;
  const otevreny = () => { const p2 = panel(); return !!(p2 && !p2.hidden); };
  pole.focus();
  pole.value = "Magb";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(600);
  const out = { pripsani: otevreny() };
  // Vyber z nabidky: hledani skoncilo, kurzor uz v poli nema co delat.
  const polozka = panel().querySelector(".druh-polozka");
  polozka.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  await cekej(900);
  out.poVyberu = { nabidka: otevreny(), fokus: document.activeElement === pole,
    hodnota: pole.value };
  // Napsane presne jmeno uz nabidka nema co nabizet — a hlavne by
  // prekryvala obsah pod polem.
  pole.focus();
  pole.value = "Magmar";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(700);
  out.poPresnemJmenu = otevreny();
  pole.value = "Magm";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(700);
  out.poNedopsanem = otevreny();
  return out;
});
await pFok39.close();
check("našeptávač se otevře psaním", dFok39.pripsani === true, JSON.stringify(dFok39));
check("…po výběru druhu se zavře a pole pustí kurzor",
  dFok39.poVyberu.nabidka === false && dFok39.poVyberu.fokus === false
    && /Magby|Magmar|Magmortar/.test(dFok39.poVyberu.hodnota),
  JSON.stringify(dFok39.poVyberu));
check("…napsané přesné jméno nabídku neotvírá, rozepsané ano",
  dFok39.poPresnemJmenu === false && dFok39.poNedopsanem === true,
  JSON.stringify([dFok39.poPresnemJmenu, dFok39.poNedopsanem]));

console.log("\n40) Identita druhu: shiny přepíná jen obrázek, staty jsou z pokédexu");
const pSh40 = await otevri(1440, []);
const dSh40 = await pSh40.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("novinkyOkno")?.remove();
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const pole = document.getElementById("prohName");
  const napis = async (jm) => { pole.value = jm;
    pole.dispatchEvent(new Event("input", { bubbles: true })); await cekej(1600); };
  const snimek = () => {
    const im = document.querySelector(".atlas-hledani-obr img");
    const radky = [...document.querySelectorAll(".atlas-staty-radek")].map((r) => ({
      popis: (r.querySelector("span") || {}).textContent,
      hodnota: Number((r.querySelector("b") || {}).textContent),
      sirka: (r.querySelector("i") || {}).style.width }));
    return { obrazek: im ? im.getAttribute("src") : "", staty: radky,
      cp: [...document.querySelectorAll(".atlas-cp-bunka b")].map((b) => b.textContent),
      tabulka: (document.querySelector(".atlas-vysledek-tab") || {}).textContent || "" };
  };
  await napis("Eevee");
  const out = { pred: snimek() };
  out.tlacitko = !!document.querySelector("[data-shiny-obrazek]");
  document.querySelector("[data-shiny-obrazek]").click();
  await cekej(900);
  out.po = snimek();
  // Prepnuti druhu vraci bezny obrazek: o shiny jineho druhu to nic nerika.
  await napis("Magmar");
  out.jinyDruh = { shiny: /\.s\.icon/.test(snimek().obrazek),
    staty: snimek().staty.map((x) => x.hodnota) };
  // Druh bez shiny prepinac nenabizi — slibil by obrazek, ktery ve hre neni.
  await napis("Phione");
  out.bezShiny = { tlacitko: !!document.querySelector("[data-shiny-obrazek]"),
    stav: (document.querySelector("[data-shiny] button span") || {}).textContent || "" };
  return out;
});
await pSh40.close();
check("u druhu se shiny je přepínač obrázku",
  dSh40.tlacitko === true && /\.icon\.png/.test(dSh40.pred.obrazek)
    && !/\.s\.icon/.test(dSh40.pred.obrazek), dSh40.pred.obrazek.slice(-30));
check("…přepne se JEN obrázek, čísla druhu zůstanou",
  /\.s\.icon\.png/.test(dSh40.po.obrazek)
    && JSON.stringify(dSh40.po.cp) === JSON.stringify(dSh40.pred.cp)
    && dSh40.po.tabulka === dSh40.pred.tabulka,
  JSON.stringify([dSh40.po.obrazek.slice(-24), dSh40.po.cp, dSh40.pred.cp]));
check("…a po přepnutí druhu se vrací běžný obrázek",
  dSh40.jinyDruh.shiny === false, String(dSh40.jinyDruh.shiny));
check("staty druhu jsou tři pruhy s hodnotami z pokédexu",
  dSh40.pred.staty.length === 3
    && dSh40.pred.staty.map((x) => x.popis).join("|") === "Útok|Obrana|HP"
    && dSh40.pred.staty.every((x) => x.hodnota > 0 && /%$/.test(x.sirka))
    && dSh40.jinyDruh.staty.join() !== dSh40.pred.staty.map((x) => x.hodnota).join(),
  JSON.stringify(dSh40.pred.staty));
check("druh bez shiny přepínač nenabízí",
  dSh40.bezShiny.tlacitko === false, JSON.stringify(dSh40.bezShiny));

console.log("\n41) Vyhledávání: prázdná tabulka se nahradí rolí, kde pořadí je");
const pLiga41 = await otevri(1440, []);
const dLiga41 = await pLiga41.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("novinkyOkno")?.remove();
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const pole = document.getElementById("prohName");
  const napis = async (jm) => { pole.value = jm;
    pole.dispatchEvent(new Event("input", { bubbles: true })); await cekej(1600); };
  const stav = () => ({
    liga: (document.querySelector(".atlas-vysledek-ligy [aria-pressed=true]") || {}).textContent || "",
    radku: document.querySelectorAll(".atlas-vysledek-tab tbody tr").length,
    presun: (document.querySelector(".atlas-vysledek-presun") || {}).textContent || "",
    prazdno: !!document.querySelector(".atlas-vysledek-prazdno")
  });
  await napis("Magby");
  const lc = document.querySelector('[data-liga="little"]');
  if (lc) { lc.click(); await cekej(700); }
  const out = { volba: stav() };
  // Tinkaton v Little Cupu poradi nema — misto prazdna se ukaze liga, kde ho ma.
  await napis("Tinkaton");
  out.jiny = stav();
  // Rucni volba se respektuje: kliknuti na Little Cup ji nechá prazdnou i s hlaskou.
  const lc2 = document.querySelector('[data-liga="little"]');
  if (lc2) { lc2.click(); await cekej(700); }
  out.rucne = stav();
  return out;
});
await pLiga41.close();
check("vybraná liga zůstane, dokud v ní pořadí je",
  /Little Cup/.test(dLiga41.volba.liga) && dLiga41.volba.radku > 0
    && dLiga41.volba.presun === "", JSON.stringify(dLiga41.volba));
check("…u druhu, který v ní pořadí nemá, se ukáže ta, kde ho má",
  !/Little Cup/.test(dLiga41.jiny.liga) && dLiga41.jiny.radku > 0
    && dLiga41.jiny.prazdno === false
    && /pořadí nemá/.test(dLiga41.jiny.presun),
  JSON.stringify(dLiga41.jiny));
check("…ruční volba se nepřepisuje: appka v ní zůstane a neříká, že přepnula",
  // Od té doby, co se ukáže celá evoluční řada, není tabulka prázdná ani
  // tam, kde nikdo pořadí nemá — řádky stojí s „v téhle lize nemá pořadí“.
  // Podstatné je, že ruční volbu appka nepřepsala.
  /Little Cup/.test(dLiga41.rucne.liga) && dLiga41.rucne.presun === "",
  JSON.stringify(dLiga41.rucne));

console.log("\n42) Lucky kus, který drží roli, je zelený — ne oranžový");
const pLuck42 = await otevri(1440, [
  { pokemon: "Mimikyu Disguised", cp: 2058, level: 36.5, ivAtk: 13, ivDef: 12, ivSta: 12,
    forma: "Lucky", fastMove: "Shadow Claw", charged1: "Shadow Ball" }
]);
const dLuck42 = await pLuck42.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("novinkyOkno")?.remove();
  const r = window.__pgo.getRows()[0];
  window.__atlasTest.openDetail(r.id);
  await cekej(1400);
  const v = document.querySelector(".atlas-drawer .atlas-verdict-first");
  return { tone: v ? v.dataset.verdict : null,
    text: v ? v.textContent.replace(/\s+/g, " ").trim().slice(0, 50) : "" };
});
await pLuck42.close();
check("roli váží víc než značka Lucky",
  dLuck42.tone === "good" && /Ponechat/.test(dLuck42.text), JSON.stringify(dLuck42));

console.log("\n43) Simulace vylepšení: počítá, ale do rosteru nesahá");
const pSim43 = await otevri(1500, [
  { pokemon: "Omanyte", cp: 600, level: 20, ivAtk: 14, ivDef: 13, ivSta: 12,
    fastMove: "Water Gun", charged1: "Rock Blast" }
]);
const dSim43 = await pSim43.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("novinkyOkno")?.remove();
  const r = window.__pgo.getRows()[0];
  const pred = JSON.stringify(window.__pgo.getRows());
  window.__atlasTest.openDetail(r.id);
  await cekej(1500);
  const tl = document.getElementById("atlasSimPokemon");
  const out = { tlacitko: !!tl };
  if (tl) { tl.click(); await cekej(900); }
  const okno = document.getElementById("atlasSimOkno");
  out.okno = !!okno;
  if (!okno) return out;
  const cisla = () => [...okno.querySelectorAll(".atlas-sim-souhrn>div b")].map((x) => x.textContent.trim());
  out.start = cisla();
  out.radku = okno.querySelectorAll(".atlas-sim-tabulka tbody tr").length;
  // Evoluce + L50: cena roste a pribydou XL.
  const evo = [...okno.querySelectorAll("[data-sim-druh]")].find((x) => /Omastar/.test(x.textContent));
  if (evo) { evo.click(); await cekej(600); }
  const l50 = okno.querySelector('[data-sim-level="50"]');
  if (l50) { l50.click(); await cekej(600); }
  out.poEvoluci = cisla();
  out.xlText = [...okno.querySelectorAll(".atlas-sim-souhrn>div")].map((x) => x.textContent).join(" ");
  // Pul levelu dolu i nahoru.
  const dolu = okno.querySelector('[data-sim-krok="-0.5"]');
  if (dolu) { dolu.click(); await cekej(500); }
  out.poKroku = (okno.querySelector(".atlas-sim-level") || {}).textContent || "";
  out.rosterStejny = JSON.stringify(window.__pgo.getRows()) === pred;
  return out;
});
await pSim43.close();
check("na detailu je tlačítko Simulace a otevře okno",
  dSim43.tlacitko === true && dSim43.okno === true, JSON.stringify(dSim43));
check("…ukáže CP, prach, bonbóny a kroky po půl levelech",
  dSim43.radku > 10 && dSim43.start.length === 4 && dSim43.start.every((x) => x !== "—"),
  JSON.stringify([dSim43.start, dSim43.radku]));
check("…evoluce a L50 cenu zvednou a přidají XL",
  Number(dSim43.poEvoluci[1].replace(/\D/g, "")) > Number(dSim43.start[1].replace(/\D/g, ""))
    && Number(dSim43.poEvoluci[3].replace(/\D/g, "")) > 0
    && /z toho .* za evoluci/.test(dSim43.xlText),
  JSON.stringify([dSim43.start, dSim43.poEvoluci]));
check("…půl levelu jde ubrat a roster zůstane nedotčený",
  /L49,5|L49.5/.test(dSim43.poKroku) && dSim43.rosterStejny === true,
  JSON.stringify([dSim43.poKroku, dSim43.rosterStejny]));

console.log("\n44) Akce: štítky a omezení ze zdroje");
const pAk44 = await otevri(1400, []);
const dAk44 = await pAk44.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("novinkyOkno")?.remove();
  const data = window.__pgo.eventsData();
  const i = data.events.findIndex((e) => e[8] && (e[8].stitky || []).length);
  const sOmezenim = data.events.findIndex((e) => e[8] && e[8].omezeni);
  window.AtlasEventUI.open(sOmezenim >= 0 ? sOmezenim : i);
  await cekej(800);
  return { stitky: [...document.querySelectorAll(".atlas-event-stitek")].map((x) => x.textContent),
    omezeni: (document.querySelector(".atlas-event-omezeni") || {}).textContent || "",
    // Omezeni ("jen v nekterych zemich") zrovna nemusi mit zadna akce —
    // pak neni co kontrolovat a test by padal na datech, ne na kodu.
    jeOmezeni: sOmezenim >= 0,
    vsechnyMajiStitky: data.events.every((e) => e[8] && (e[8].stitky || []).length) };
});
await pAk44.close();
check("akce nese štítky ze zdroje",
  dAk44.stitky.length > 0 && dAk44.vsechnyMajiStitky === true, JSON.stringify(dAk44.stitky));
check("…a omezení se píše s odkazem na zdroj, nepřeložené",
  dAk44.jeOmezeni ? /Omezení podle zdroje/.test(dAk44.omezeni) : true,
  dAk44.jeOmezeni ? dAk44.omezeni.slice(0, 80) : "(žádná akce teď omezení nemá)");

console.log("\n45) Jiné formy druhu stojí vedle evoluce, ne v ní");
const pFor45 = await otevri(1440, []);
const dFor45 = await pFor45.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("novinkyOkno")?.remove();
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1200);
  const pole = document.getElementById("prohName");
  pole.value = "Zygarde";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1600);
  const z = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
    .find((b) => /Evoluce/.test(b.textContent));
  if (z) { z.click(); await cekej(800); }
  const formy = [...document.querySelectorAll("[data-evo-forma]")].map((x) => x.textContent.replace(/\s+/g, " ").trim());
  const out = { formy, pozn: (document.querySelector(".atlas-evo-formy .atlas-evo-pozn") || {}).textContent || "",
    cile: document.querySelectorAll("[data-evo-cil]").length };
  const prvni = document.querySelector("[data-evo-forma]");
  if (prvni) { prvni.click(); await cekej(1500); }
  out.poKliknuti = document.getElementById("prohName").value;
  return out;
});
await pFor45.close();
check("Zygarde nemá evoluci, ale formy ano",
  dFor45.formy.length >= 2 && dFor45.cile === 0
    && dFor45.formy.some((x) => /10 %|Complete/.test(x)),
  JSON.stringify(dFor45.formy));
check("…a je u nich napsané, že evoluce to není",
  /Evoluce to není/.test(dFor45.pozn), dFor45.pozn.slice(0, 70));
check("…klepnutí na formu ji otevře jako vlastní hledání",
  /Zygarde/.test(dFor45.poKliknuti) && dFor45.poKliknuti !== "Zygarde",
  dFor45.poKliknuti);

console.log("\n46) Simulace: strop ligy a Escape po vrstvách");
const pSim46 = await otevri(1440, [
  { pokemon: "Zygarde (50 %)", cp: 1429, level: 15, ivAtk: 11, ivDef: 13, ivSta: 15 }
]);
const dSim46 = await pSim46.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const zyg = P.getRows()[0];
  A.openDetail(zyg.id);
  await cekej(1100);
  window.AtlasSimulace(zyg.id);
  await cekej(800);
  const okno = () => document.querySelector(".atlas-sim-okno");
  const detail = () => document.querySelector(".atlas-drawer:not([hidden]), #atlasDrawer:not([hidden])");
  const out = {};
  out.strop = [...document.querySelectorAll(".atlas-sim-pozn")]
    .map((x) => x.textContent.replace(/\s+/g, " ").trim())
    .filter((t) => /Strop ligy/.test(t))[0] || "";
  out.pred = { sim: !!okno(), detail: !!detail() };
  // Escape mimo okno simulace: zavrit se ma simulace, ne detail pod ni.
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await cekej(450);
  out.po = { sim: !!okno(), detail: !!detail() };
  return out;
});
await pSim46.close();
check("simulace říká, kam až se dá vylepšit kvůli lize",
  /Great League \(1 ?500\) do L/.test(dSim46.strop) && /Ultra League/.test(dSim46.strop),
  dSim46.strop.slice(0, 120));
check("Escape zavře nejdřív simulaci, detail zůstane",
  dSim46.pred.sim === true && dSim46.pred.detail === true
    && dSim46.po.sim === false && dSim46.po.detail === true,
  JSON.stringify(dSim46));

console.log("\n47) Značka DUPLIKÁT? a bublina s kusy druhu");
const pDup47 = await otevri(1440, [
  { pokemon: "Rattata", cp: 100, level: 5, ivAtk: 3, ivDef: 3, ivSta: 3 },
  { pokemon: "Rattata", cp: 240, level: 15, ivAtk: 3, ivDef: 3, ivSta: 3 },
  { pokemon: "Rattata", cp: 310, level: 20, ivAtk: 4, ivDef: 5, ivSta: 6 },
  { pokemon: "Rattata", cp: 320, level: 21, ivAtk: 7, ivDef: 5, ivSta: 6 }
]);
const dDup47 = await pDup47.evaluate(async () => {
  const P = window.__pgo, A = window.__atlasTest;
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  const comp = P.getComputed();
  const id = Object.keys(comp).filter((k) => comp[k].duplikatPodezreni)[0];
  A.openDetail(id);
  await cekej(1200);
  const znacky = () => [...document.querySelectorAll(".detail-title .rarity-chip")]
    .map((e) => e.textContent.trim() + (e.classList.contains("vypnuto") ? "(off)" : ""));
  const out = { pred: znacky() };
  const btn = document.querySelector(".duplikat-prepinac");
  out.jeTlacitko = !!btn;
  if (btn) { btn.click(); await cekej(900); }
  out.po = znacky();
  out.over = !!P.getComputed()[id].duplikatOver;
  const kop = document.querySelector(".d-kopie");
  out.kopie = kop ? kop.textContent.trim() : null;
  out.kopieTip = kop ? (kop.getAttribute("data-tip") || "") : "";
  return out;
});
await pDup47.close();
check("DUPLIKÁT? je poslední značka a dá se vypnout",
  dDup47.jeTlacitko === true
    && dDup47.pred[dDup47.pred.length - 1] === "DUPLIKÁT?"
    && dDup47.po[dDup47.po.length - 1] === "DUPLIKÁT?(off)" && dDup47.over === true,
  JSON.stringify(dDup47.pred) + " → " + JSON.stringify(dDup47.po));
check("u „#N z M\" je bublina se všemi kusy druhu",
  /^#\d+ z \d+$/.test(dDup47.kopie || "") && /Tvoje kusy druhu/.test(dDup47.kopieTip)
    && /tenhle kus/.test(dDup47.kopieTip),
  (dDup47.kopie || "") + " | " + dDup47.kopieTip.slice(0, 90));

console.log("\n48) Vyhledávání po úklidu a režim proti druhu");
const pHled48 = await otevri(1440, [
  { pokemon: "Machop", cp: 600, level: 20, ivAtk: 14, ivDef: 13, ivSta: 12,
    fastMove: "Karate Chop", charged1: "Cross Chop" },
  { pokemon: "Gyarados", cp: 2800, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14,
    fastMove: "Dragon Tail", charged1: "Aqua Tail" },
  { pokemon: "Alakazam", cp: 2500, level: 30, ivAtk: 15, ivDef: 13, ivSta: 13,
    fastMove: "Confusion", charged1: "Psychic" }
]);
const dHled48 = await pHled48.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("novinkyOkno")?.remove();
  const out = {};
  // Nabidka: "Co chytat" zmizelo, kalendar je v korenu.
  const menu = [...document.querySelectorAll("[data-menu-route],[data-menu-group]")]
    .map((b2) => b2.textContent.trim());
  out.coChytat = menu.some((x) => /Co chytat/.test(x));
  // Kalendar stoji hned pod Pokemony, nad Rozpoctem.
  out.poradi = menu.slice(0, 4);
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1300);
  const karta = document.querySelector('[data-atlas-hledani="1"]');
  // Dokud se nic nehleda, nad vysledky nesmi stat prazdny pruh.
  out.prazdnaVyska = Math.round(
    karta.querySelector(".atlas-hledani-identita").getBoundingClientRect().height);
  out.rezimTlacitka = karta.querySelectorAll("[data-rezim]").length;
  const pole = document.getElementById("prohName");
  pole.value = "Machop";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1800);
  out.pocasi = [...document.querySelectorAll(".atlas-cp-pocasi .atlas-pocasi")]
    .map((e) => e.textContent.trim());
  // Pocasi stoji u nadpisu bunky, aby cisla zustala na stejne vysce.
  out.pocasiVHlavicce = !!document.querySelector(".atlas-cp-hlava .atlas-cp-pocasi");
  const bunky = [...document.querySelectorAll(".atlas-cp-bunka b")]
    .map((e) => Math.round(e.getBoundingClientRect().top));
  out.rozjezdCisel = bunky.length ? Math.max(...bunky) - Math.min(...bunky) : -1;
  // Vysvetlujici vety pod pasem CP a pod hodnocenim druhu uz tam nejsou.
  out.vetaPodPasem = !!document.querySelector(".atlas-cp-pozn");
  out.vetaPodHodnocenim = !!document.querySelector(".atlas-hledani-kde small");
  // Karta druhu (obrazek, staty, prepinac shiny) musi po vyhledani BYT.
  const ident = karta.querySelector(".atlas-hledani-identita");
  out.identita = Math.round(ident.getBoundingClientRect().height) > 40
    && !!ident.querySelector(".atlas-staty")
    && !!ident.querySelector(".atlas-shiny-prepinac");
  /* V tabulce roli stoji cela evolucni rada a u kazdeho clanku krome
     hledaneho je pojmenovany prikaz "Vyhledat <druh>". */
  out.radky = [...document.querySelectorAll(".atlas-vysledek-tab tbody tr")]
    .map((t) => t.children[0].textContent.replace(/\s+/g, " ").trim());
  out.akce = [...document.querySelectorAll(".atlas-vysledek-hledat")].map((x) => x.textContent.trim());
  const zal = () => [...document.querySelectorAll(".atlas-sekce-zalozky button")];
  zal().find((b2) => /Rozbor/.test(b2.textContent)).click();
  await cekej(800);
  const panelR = document.querySelector('.atlas-sekce-panel[data-sekce="rozbor"]');
  out.rozborZbytky = ["​.d-verdict-row", ".proh-hint", ".atlas-rozbor-pozn", ".d-utoky-druh .d-note"]
    .map((sel) => sel.replace("​", ""))
    .filter((sel) => !!panelR.querySelector(sel));
  zal().find((b2) => /Můj kus/.test(b2.textContent)).click();
  await cekej(900);
  const ud = document.querySelector(".atlas-hledani-udaje");
  out.mujKus = { otevrene: ud.open, summary: ud.querySelector("summary").offsetParent !== null,
    rezim: karta.dataset.atlasRezim };
  zal().find((b2) => /Evoluce/.test(b2.textContent)).click();
  await cekej(900);
  const cil = document.querySelector("[data-evo-cil]");
  if (cil) { cil.click(); await cekej(900); }
  // Kombinace typu u "Kam se hodi jeho utoky" jsou pulene stitky — a maji
  // mit stejny tvar i vysku jako stitek jednoho typu.
  out.kombi = document.querySelectorAll(".atlas-typ-kombi2").length;
  {
    const jeden = document.querySelector(".atlas-typy-chipy .d-type:not(.atlas-typ-kombi)");
    const dva = document.querySelector(".atlas-typ-kombi2");
    out.tvar = (jeden && dva) ? {
      stejnyTvar: getComputedStyle(jeden).borderRadius === getComputedStyle(dva).borderRadius,
      rozdilVysky: Math.abs(Math.round(jeden.getBoundingClientRect().height)
        - Math.round(dva.getBoundingClientRect().height)) } : null;
  }
  // Radky tabulky maji delici cary a vybrany radek prouzek vlevo.
  {
    const radky = [...document.querySelectorAll(".atlas-vysledek-tab tbody tr")];
    // Delici cara se kresli stinem, ne `border-top`: pri `border-collapse`
    // se u prvniho sloupce objevila jen pod obsahem a radek mel diry.
    out.linky = radky.slice(1).every((t) => /inset/.test(getComputedStyle(t.children[0]).boxShadow));
    const vstup = document.querySelector(".atlas-vysledek-tab tr.je-vstup");
    // Hledany druh se pozna podbarvenim; obrazek nesmi lezet na okraji.
    out.vstupPodbarveny = vstup
      ? getComputedStyle(vstup.children[0]).backgroundColor !== "rgba(0, 0, 0, 0)" : null;
    out.odsazeni = vstup ? getComputedStyle(vstup.children[0]).paddingLeft : null;
  }
  /* Clanek rady, kam se z hledaneho druhu nedojde, se da aspon vyhledat.
     U Machopa (prvni stupen) takovy neni — vsechno je pred nim, ne za nim —
     takze se to zkousi na Machampovi, kde pred nim stoji dva. */
  out.jinam = await (async () => {
    const pole2 = document.getElementById("prohName");
    pole2.value = "Machamp";
    pole2.dispatchEvent(new Event("input", { bubbles: true }));
    await cekej(1600);
    const zal2 = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
      .filter((x) => /Evoluce/.test(x.textContent))[0];
    if (zal2) { zal2.click(); await cekej(700); }
    return document.querySelectorAll(".atlas-evo-jinam[data-evo-hledat]").length;
  })();
  /* Po prepnuti na Machampa (vyse) se vyber cile zrusil — prikaz
     "Vyhledat <cil>" se ukazuje az k vybranemu cili. */
  {
    const pole3 = document.getElementById("prohName");
    pole3.value = "Machop";
    pole3.dispatchEvent(new Event("input", { bubbles: true }));
    await cekej(1600);
    const zal3 = [...document.querySelectorAll(".atlas-sekce-zalozky button")]
      .filter((x) => /Evoluce/.test(x.textContent))[0];
    if (zal3) { zal3.click(); await cekej(700); }
    const cil3 = document.querySelector("[data-evo-cil]");
    if (cil3) { cil3.click(); await cekej(800); }
  }
  const hledat = document.querySelector(".atlas-evo-hledat[data-evo-hledat]");
  out.hledatPopis = hledat ? hledat.textContent.trim() : null;
  if (hledat) { hledat.click(); await cekej(1800); }
  out.poHledani = document.getElementById("prohName").value;
  // Rezim proti druhu: pruh, skore, zruseni.
  zal().find((b2) => /Typy/.test(b2.textContent)).click();
  await cekej(800);
  const counter = document.querySelector("[data-counter-rezim]");
  if (counter) { counter.click(); await cekej(1500); }
  const pruh = document.getElementById("atlasProtiPruh");
  out.proti = pruh ? pruh.textContent.replace(/\s+/g, " ").trim() : null;
  out.skore = [...document.querySelectorAll(".atlas-proti-skore")].map((e) => e.textContent.trim());
  if (pruh) { pruh.querySelector("[data-proti-zrus]").click(); await cekej(900); }
  out.poZruseni = !document.getElementById("atlasProtiPruh");
  return out;
});
await pHled48.close();
check("„Co chytat\" je pryč a Kalendář s Vyhledáváním stojí hned pod Pokémony",
  dHled48.coChytat === false
    && dHled48.poradi.join(",") === "Přehled,Pokémoni,Kalendář,Vyhledávání",
  JSON.stringify(dHled48.poradi));
check("karta druhu se statusy a přepínačem shiny zůstává",
  dHled48.identita === true, JSON.stringify(dHled48.identita));
check("v tabulce rolí stojí celá evoluční řada s příkazem Vyhledat",
  dHled48.radky.length >= 2
    && dHled48.radky.filter((x) => /Hledaný druh/.test(x)).length === 1
    && dHled48.akce.length === dHled48.radky.length - 1
    && dHled48.akce.every((x) => /^Vyhledat /.test(x)),
  JSON.stringify([dHled48.radky, dHled48.akce]));
check("půlený štítek má stejný tvar i výšku jako štítek jednoho typu",
  !!dHled48.tvar && dHled48.tvar.stejnyTvar === true && dHled48.tvar.rozdilVysky <= 1,
  JSON.stringify(dHled48.tvar));
check("řádky výsledků mají dělicí čáry, podbarvení a odsazený obrázek",
  dHled48.linky === true && dHled48.vstupPodbarveny === true
    && parseFloat(dHled48.odsazeni) >= 6,
  JSON.stringify([dHled48.linky, dHled48.vstupPodbarveny, dHled48.odsazeni]));
check("kombinace typů jsou půlené štítky a celá řada jde otevřít",
  dHled48.kombi > 0 && dHled48.jinam > 0,
  JSON.stringify([dHled48.kombi, dHled48.jinam]));
check("bez hledání nad výsledky nic prázdného nestojí a přepínač režimu je pryč",
  dHled48.prazdnaVyska === 0 && dHled48.rezimTlacitka === 0,
  JSON.stringify([dHled48.prazdnaVyska, dHled48.rezimTlacitka]));
check("u „Raid s počasím\" stojí počasí jako odznáček vedle nadpisu",
  dHled48.pocasi.length > 0 && dHled48.pocasiVHlavicce === true
    && dHled48.rozjezdCisel <= 3,
  JSON.stringify([dHled48.pocasi, dHled48.pocasiVHlavicce, dHled48.rozjezdCisel]));
check("vysvětlující věty pod pásem CP a pod hodnocením druhu jsou pryč",
  dHled48.vetaPodPasem === false && dHled48.vetaPodHodnocenim === false,
  JSON.stringify([dHled48.vetaPodPasem, dHled48.vetaPodHodnocenim]));
check("Rozbor neopakuje hlavičku ani závěrečné odstavce",
  dHled48.rozborZbytky.length === 0, JSON.stringify(dHled48.rozborZbytky));
check("záložka Můj kus je rovnou otevřená a přepíná režim",
  dHled48.mujKus.otevrene === true && dHled48.mujKus.summary === false
    && dHled48.mujKus.rezim === "kus", JSON.stringify(dHled48.mujKus));
check("z evoluční řady jde vyhledat jiný článek",
  /Vyhledat/.test(dHled48.hledatPopis || "") && /Macho/.test(dHled48.poHledani || "")
    && dHled48.poHledani !== "Machop",
  (dHled48.hledatPopis || "") + " → " + (dHled48.poHledani || ""));
check("režim proti druhu má pruh, skóre a jde zrušit",
  /Proti /.test(dHled48.proti || "") && dHled48.skore.length > 0
    && /%/.test(dHled48.skore[0]) && dHled48.poZruseni === true,
  (dHled48.proti || "").slice(0, 70) + " | " + JSON.stringify(dHled48.skore.slice(0, 3)));

console.log("\n49) Psaní, typ u raidů a telefon");
const pMob49 = await otevri(390, []);
const dMob49 = await pMob49.evaluate(async () => {
  const cekej = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("novinkyOkno")?.remove();
  window.__pgoZalozka("prohlidkaCard");
  await cekej(1300);
  const pole = document.getElementById("prohName");
  const out = {};
  pole.value = "Muk (Alolan)";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1800);
  // Rozepsany text nesmi smazat, co uz je nalezene; prazdne pole ano.
  pole.value = "Muk (Alola";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(800);
  out.poRozepsani = { karta: !document.querySelector(".atlas-hledani-identita").hidden,
    jmeno: (document.querySelector(".atlas-hledani-kdo h3") || {}).textContent };
  pole.value = "Muk (Alolan)";
  pole.dispatchEvent(new Event("input", { bubbles: true }));
  await cekej(1500);
  // Typ, za ktery druh v raidu stoji — bez nej vypadaly radky stejne.
  const raid = [...document.querySelectorAll("[data-role]")].filter((b) => /Raidy/.test(b.textContent))[0];
  if (raid) { raid.click(); await cekej(900); }
  out.raidTypy = [...document.querySelectorAll(".atlas-vysledek-tab tbody tr")]
    .map((t) => [...t.querySelectorAll(".atlas-vysledek-role-typ")].map((x) => x.textContent.trim()).join("+"));
  // Telefon: pas CP 2x2 a radek tabulky se nelame po slovech.
  const bunky = [...document.querySelectorAll(".atlas-cp-bunka")].map((x) => {
    const r = x.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top) };
  });
  out.cpRadky = [...new Set(bunky.map((x) => x.y))].length;
  out.cpSloupce = [...new Set(bunky.map((x) => x.x))].length;
  const prvni = document.querySelector(".atlas-vysledek-tab tbody tr");
  out.vyskaRadku = prvni ? Math.round(prvni.getBoundingClientRect().height) : null;
  out.prepad = document.documentElement.scrollWidth > document.documentElement.clientWidth;
  out.akceVidet = !!document.querySelector(".atlas-vysledek-hledat")
    && document.querySelector(".atlas-vysledek-hledat").offsetParent !== null;
  return out;
});
await pMob49.close();
check("rozepsaný text nesmaze, co už je nalezené",
  dMob49.poRozepsani.karta === true && /Muk/.test(dMob49.poRozepsani.jmeno || ""),
  JSON.stringify(dMob49.poRozepsani));
check("v raidech říká každý řádek, za který typ stojí",
  dMob49.raidTypy.length > 0 && dMob49.raidTypy.every((x) => x.length > 0),
  JSON.stringify(dMob49.raidTypy));
check("na telefonu je pás CP 2×2 a tabulka se neláme po slovech",
  dMob49.cpRadky === 2 && dMob49.cpSloupce === 2 && dMob49.vyskaRadku < 280
    && dMob49.prepad === false && dMob49.akceVidet === true,
  JSON.stringify([dMob49.cpRadky, dMob49.cpSloupce, dMob49.vyskaRadku, dMob49.prepad]));

check("žádná chyba JavaScriptu", chyby.length === 0, chyby.join(" | "));

await browser.close();
server.close();
console.log(`\n${passed} kontrol prošlo, ${failures.length} selhalo`);
if (failures.length) {
  failures.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
