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
        return !document.querySelector("#boxMode .bm-top .hra-pruh")
          && pruh.getBoundingClientRect().bottom <= evo.getBoundingClientRect().top + 1;
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
  { pokemon: "Garchomp", cp: 4357, level: 48, ivAtk: 14, ivDef: 15, ivSta: 15 }
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
check("tři sestavy útoků se vejdou celé (nic se neuřízne)",
  dDet.utoky && dDet.utoky.sestav >= 3 && dDet.utoky.scroll <= dDet.utoky.klient + 1,
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
  out.znackaVDlazdici = document.querySelectorAll("#atlasRoster .rarity-chip.r-SKEN").length;
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
  dEd.posledni.length === 1 && dEd.posledni[0] === "Azumarill" && dEd.znackaVDlazdici === 1,
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
  const vyvin = tl.filter((b) => /Vylepšil|Vyvinul/.test(b.textContent))[0];
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
  out.prikazyNadRadou = (() => {
    const bar = document.querySelector(".atlas-box-rozbor .hra-pruh");
    const evo = document.querySelector(".atlas-box-rozbor .atlas-evolution-column");
    if (!bar || !evo) return null;
    return bar.getBoundingClientRect().bottom <= evo.getBoundingClientRect().top + 4;
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
  const vsechny = [...document.querySelectorAll(
    "#atlasHome .atlas-boss-art img, #atlasHome .atlas-event-art img")];
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

check("žádná chyba JavaScriptu", chyby.length === 0, chyby.join(" | "));

await browser.close();
server.close();
console.log(`\n${passed} kontrol prošlo, ${failures.length} selhalo`);
if (failures.length) {
  failures.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
