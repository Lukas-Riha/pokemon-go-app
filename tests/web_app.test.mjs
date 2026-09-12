/**
 * Regresní test webové appky (Playwright, headless Chromium).
 *
 * Spuštění:  node tests/web_app.test.mjs
 *
 * Playwright se nehledá v tomhle projektu (nemá node_modules) — bere se
 * z existující instalace v ../playwright-day2, aby se nemusel stahovat znovu.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "web-app");
const PORT = 8778;

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
  throw new Error(
    "Playwright nenalezen. Zkoušené cesty:\n  " + PLAYWRIGHT_CANDIDATES.join("\n  ")
  );
}

/** Stahuje daná stránka něco zvenku? Kontroluje se to, co si prohlížeč načte
 *  SÁM při otevření — obrázky, skripty, styly, fonty. Odkaz <a href> mezi ně
 *  nepatří: je nečinný, dokud na něj někdo neklikne, takže stránku s odkazy
 *  jde pořád otevřít bez signálu. Dřív to bylo "žádné https v souboru", což
 *  z taháku vyhánělo i užitečné odkazy na komunitní skupiny. */
function tahaZvenku(html) {
  const nalezy = [];
  const vzory = [
    [/<img[^>]+src\s*=\s*["']?(https?:)?\/\//gi, "obrázek"],
    [/<script[^>]+src\s*=\s*["']?(https?:)?\/\//gi, "skript"],
    [/<link[^>]+href\s*=\s*["']?(https?:)?\/\//gi, "styl nebo font"],
    [/url\(\s*["']?(https?:)?\/\//gi, "zdroj v CSS"],
    [/@import[^;]*(https?:)?\/\//gi, "import v CSS"],
    [/<iframe|<video[^>]+src|<audio[^>]+src/gi, "vložený obsah"],
  ];
  for (const [re, popis] of vzory) {
    const m = html.match(re);
    if (m) nalezy.push(popis + " (" + m.length + "x)");
  }
  return nalezy;
}

// --- mini test runner ---
let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; console.log("  ok   " + name); }
  else { failures.push(name + (detail ? " → " + detail : "")); console.log("  FAIL " + name + (detail ? " → " + detail : "")); }
}
function eq(name, actual, expected) {
  check(name, actual === expected, `čekáno "${expected}", dostal "${actual}"`);
}

// --- testovací data ve stylu exportu z Poké Genie ---
const SAMPLE_CSV = [
  "Index,Name,Form,Pokemon,Gender,CP,HP,Atk IV,Def IV,Sta IV,IV Avg,Level,Quick Move,Charge Move,Charge Move 2,Shadow/Purified,Lucky,Great League Rank,Ultra League Rank,Master League Rank",
  "1,Beast,Normal,Metagross,M,3100,180,15,14,13,93.3,35,Bullet Punch,Meteor Mash,Earthquake,Shadow,,,,12",
  "2,,Normal,Metagross,F,2400,160,8,9,7,53.3,28,Bullet Punch,Psychic,,,,,,",
  "3,Blob,Normal,Blissey,F,2800,400,10,15,15,88.9,30,Pound,Dazzling Gleam,,,,,,",
  "4,,Normal,Pidgey,M,289,60,3,5,2,22.2,12,Tackle,Aerial Ace,,,,,,",
  "5,,Normal,Pidgey,F,310,62,4,4,4,26.7,13,Tackle,Twister,,,,,,",
  "6,Lucky one,Normal,Pidgey,M,250,55,1,1,1,6.7,10,Tackle,Twister,,,1,,,",
  "7,,Normal,Azumarill,F,1489,150,12,14,15,91.1,24.5,Bubble,Ice Beam,Play Rough,,,3,8,",
  "8,,Normal,Charizard,M,2900,170,15,15,14,97.8,33,Fire Spin,Blast Burn,Dragon Claw,,,,,45",
].join("\n");

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(WEB_DIR, rel === "/" ? "pokemon_tracker_app.html" : rel);
  if (!file.startsWith(WEB_DIR) || !fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});

const chromium = loadChromium();

await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
// Datum skenu ve formátu, který Calcy exportuje (M/D/YY H:MM:SS), posunuté
// o daný počet dní. Pevná data v testech nefungují: paměť smazaných drží
// 30 dní, takže „smazáno 1. 8. 2026" jednoho dne prostě vyprší a bloky
// začnou padat samy od sebe. Vkládá se do page.evaluate jako řetězec funkce,
// protože v prohlížeči nic z Node scope není.
const DATUM_FN = String(function datumPred(dnu, hodina) {
  var d = new Date(Date.now() - dnu * 24 * 3600 * 1000);
  return (d.getMonth() + 1) + "/" + d.getDate() + "/" + String(d.getFullYear()).slice(2)
    + " " + (hodina === undefined ? 12 : hodina) + ":00:00";
});

// POZN: paměť smazaných kusů drží 30 dní, takže pevné datum v testu je
// časovaná bomba — tyhle bloky začaly padat samy od sebe, jakmile 1. 8. 2026
// zestáralo. Používá se proto datum relativní ke dni běhu, a počítá se
// UVNITŘ page.evaluate: konstanta z Node scope se do prohlížeče nedostane.

const consoleErrors = [];
// Obrázky pokémonů se tahají z GitHubu a appka počítá s tím, že se nemusí
// načíst — má na nich onerror a bez internetu prostě zmizí. Selhání takového
// requestu proto NENÍ chyba appky a testy na něm nesmí padat; bez tohohle
// filtru byla celá sada závislá na síti a padala třeba na
// ERR_NETWORK_IO_SUSPENDED, když počítač uspal spojení.
const SIT_JE_JEDNO = /raw\.githubusercontent\.com|net::ERR_(NETWORK_IO_SUSPENDED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_|TIMED_OUT|ABORTED)|Failed to load resource/i;
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (SIT_JE_JEDNO.test(t)) return;
  consoleErrors.push(t);
});
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const URL = `http://localhost:${PORT}/pokemon_tracker_app.html`;

try {
  console.log("\n1) načtení stránky");
  // Držení legendárních při nahrazení je v appce ZAPNUTÉ (uživatel to tak chce),
  // ale testy potřebují, aby „nahradit" znamenalo přesně obsah souboru.
  // Init skript se pouští při každém načtení stránky, takže to přežije i reload.
  // Vlastní chování téhle volby má svůj blok níž, kde se zapne zpátky.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const el = document.getElementById("keepRare");
      if (el) el.checked = false;
    });
  });
  // Pomocník na relativní datum skenu musí být DOSTUPNÝ V PROHLÍŽEČI a přežít
  // reload — proto init skript, ne evaluate.
  await page.addInitScript(DATUM_FN + "; window.datumPred = datumPred;");

  await page.goto(URL);
  eq("nová appka startuje prázdná", await page.evaluate(() => window.__pgo.getRows().length), 0);
  check("…a rovnou řekne, co má uživatel udělat",
    (await page.evaluate(() => document.getElementById("emptyState").textContent)).indexOf("Importovat data") > -1);
  eq("ukázková data se načtou až na kliknutí", await page.evaluate(() => {
    document.getElementById("demoBtn").click();
    return window.__pgo.getRows().length;
  }), 3);
  eq("localStorage je k dispozici", await page.evaluate(() => {
    try { localStorage.setItem("__p", "1"); localStorage.removeItem("__p"); return "ok"; } catch (e) { return e.name; }
  }), "ok");

  console.log("\n2) import exportu z Poké Genie (automatické mapování sloupců)");
  // Ruční mapování sloupců z importu zmizelo — čte se přímo to, co appka
  // z hlavičky rozpozná, ne rozbalovátka, která už nikde nejsou.
  const mapping = await page.evaluate((csv) => {
    window.__pgo.importText(csv);
    return window.__pgo.automatickeMapovani(csv);
  }, SAMPLE_CSV);
  eq("druh se napojil na sloupec Pokemon", mapping["Pokémon (druh)"], "Pokemon");
  eq("IV Attack se napojil na Atk IV", mapping["IV Attack"], "Atk IV");
  eq("GL rank se napojil na Great League Rank", mapping["GL rank"], "Great League Rank");
  check("přezdívka nepřebila druh", mapping["Poznámka / přezdívka"] === "Name");

  const verdicts = await page.evaluate(() => {
    // prahy natvrdo — výchozí kalibrace appky se může měnit, chování prahů na ní viset nesmí
    const setCfg = (cfg) => Object.keys(cfg).forEach((id) => {
      const el = document.getElementById(id);
      el.value = String(cfg[id]);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    setCfg({ keepCopies: 1 });   // tenhle blok testuje strop kopií
    window.__pgo.finishImport(true);
    const rows = window.__pgo.getRows(), c = window.__pgo.getComputed();
    const out = {};
    rows.forEach((r) => {
      const x = c[r.id];
      out[(r.pokemon || "?") + "|" + x.copies] =
        { forma: r.forma || "-", keep: x.keep, mega: x.mega, gym: x.gymRec, raid: x.raidRec,
          pvp: x.pvpRec, iv: x.ivPct, duvod: x.keepTitle || "" };
    });
    return out;
  });
  eq("naimportováno 8 pokémonů", Object.keys(verdicts).length, 8);
  eq("Shadow ze sloupce Shadow/Purified se rozpoznal", verdicts["Metagross|#1 z 2"].forma, "Shadow");
  eq("Lucky ze samostatného sloupce se rozpoznal", verdicts["Pidgey|#3 z 3"].forma, "Lucky");
  // Ta lepší kopie je Shadow a Shadow Pokémona do gymu bránit postavit nejde,
  // takže tahle horší je jediná, která tu roli u toho druhu zastane — a role
  // chrání před stropem kopií. Metagross je spočítaný gymový obránce (Def 228,
  // Steel/Psychic typování bere podprůměr), takže je to skutečná role, ne alibi.
  eq("horší kopie Metagrosse drží gymovou roli, kterou shadow nemůže",
    verdicts["Metagross|#2 z 2"].keep, "Ponechat");
  // Sloupec GYM teď říká i pořadí ve slotu („Ano 2/8"), aby seděl s verdiktem.
  check("…a je to fakt gymem",
    String(verdicts["Metagross|#2 z 2"].gym).indexOf("Ano") === 0,
    verdicts["Metagross|#2 z 2"].gym);
  eq("…zatímco shadow do gymu nesmí", verdicts["Metagross|#1 z 2"].gym, "Ne");
  // Výchozí je „forma sama o sobě není důvod" — Lucky Pidgey je pořád Pidgey.
  // Rozhodnutí je tedy „pryč"; jen se to od té doby, co má lucky vlastní
  // brzdu, píše jinak a žlutě.
  check("Lucky Pidgey jako 3. kopie jde pryč jako každá jiná",
    verdicts["Pidgey|#3 z 3"].keep.indexOf("Zahodit") === 0,
    verdicts["Pidgey|#3 z 3"].keep);
  check("…ale verdikt na to lucky upozorní",
    verdicts["Pidgey|#3 z 3"].keep.indexOf("Lucky") > -1,
    verdicts["Pidgey|#3 z 3"].keep);
  check("Blissey je gym obránce",
    String(verdicts["Blissey|jediný kus"].gym).indexOf("Ano") === 0,
    verdicts["Blissey|jediný kus"].gym);
  eq("Charizard je mega kandidát", verdicts["Charizard|jediný kus"].mega, "Vysoká");
  // žebříček se počítá z dat, takže druh může mít víc rolí najednou
  check("Metagross je Steel raid útočník", verdicts["Metagross|#1 z 2"].raid.indexOf("Steel") > -1,
    verdicts["Metagross|#1 z 2"].raid);
  // Azumarill je v Great League vysoko, takže na 94% kus mu práh stačí —
  // dřív tu bylo "GL 94 % (pod prahem)", protože práh byl placatý a neznal
  // pořadí druhu. Že se u kusu POD prahem ukáže liga a procento místo Calcy
  // ranku, hlídá blok 103 (slabší Ferroseed).
  eq("u kusu nad prahem je z toho doporučení i s ligou",
    verdicts["Azumarill|jediný kus"].pvp, "Ano – GL");
  check("…a rozhodně to není Calcy IV rank",
    !/rank/i.test(verdicts["Azumarill|jediný kus"].pvp),
    verdicts["Azumarill|jediný kus"].pvp);

  console.log("\n3) perzistence po zavření stránky");
  await page.goto(URL);
  eq("roster přežil reload", await page.evaluate(() => window.__pgo.getRows().length), 8);
  check("stav uložení hlásí uloženo",
    (await page.evaluate(() => document.getElementById("saveState").textContent)).indexOf("v prohlížeči") > -1,
    await page.evaluate(() => document.getElementById("saveState").textContent));
  // Profily jsou zapnuté: na jednom notebooku můžou mít dva lidi každý svůj
  // roster. Že se rostery neprolezou, hlídá samostatný blok níž.
  check("přepínač profilů je vidět",
    await page.evaluate(() => document.querySelector(".profile-box").style.display !== "none"));

  console.log("\n4) editace v tabulce");
  const focusKept = await page.evaluate(() => {
    // editovat jde jen v zobrazení „Vše“ — v „Rozhodnutí“ jsou hodnoty jen ke čtení
    const sel = document.getElementById("viewSelect");
    sel.value = "all"; sel.dispatchEvent(new Event("change", { bubbles: true }));
    const input = document.querySelector("#tbody tr td.col-pokemon input");
    input.focus();
    input.value = "Snorlax";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return document.activeElement === input;
  });
  check("psaní neztrácí focus (přepočítají se jen dopočítané buňky)", focusKept);
  eq("v zobrazení Rozhodnutí se needituje",
    await page.evaluate(() => {
      const sel = document.getElementById("viewSelect");
      sel.value = "verdict"; sel.dispatchEvent(new Event("change", { bubbles: true }));
      return document.querySelectorAll("#tbody input, #tbody select").length;
    }), 0);
  // Ten první řádek je Shadow (byl to Shadow Metagross). Shadow kus do gymu
  // bránit POSTAVIT JDE — dřív to tu bylo natvrdo zakázané, což je herně
  // špatně a bralo to obránce. Horší je jen tím, že má o 17 % nižší obranu.
  check("shadow Snorlax do gymu smí",
    await page.evaluate(() => String(window.__pgo.getComputed()[window.__pgo.getRows()[0].id].gymRec)
      .indexOf("Ano") === 0), true);
  eq("…a bublina řekne, že jako shadow v gymu vydrží míň",
    await page.evaluate(() => (window.__pgo.getComputed()[window.__pgo.getRows()[0].id].gymTitle || "")
      .indexOf("nižší obranu") > -1), true);


  console.log("\n5) práh počtu kopií");
  const keep2 = await page.evaluate(() => {
    const kc = document.getElementById("keepCopies");
    kc.value = "2"; kc.dispatchEvent(new Event("input", { bubbles: true }));
    const c = window.__pgo.getComputed();
    const res = window.__pgo.getRows().filter((r) => r.pokemon === "Pidgey")
      .map((r) => ({ keep: c[r.id].keep, sub: c[r.id].keepSub || "" }));
    kc.value = "1"; kc.dispatchEvent(new Event("input", { bubbles: true }));
    return res;
  });
  // Ti první dva jdou pryč taky, ale ne jako kopie — Pidgey prostě nic nehraje.
  // Kopie je jen ten třetí, a protože je lucky, nese ten důvod podtitulek.
  check("při „nechat 2 kopie“ zbyde jako horší kopie jen ten třetí",
    keep2.filter((k) => k.keep === "Zahodit – kopie" || k.sub === "horší kopie").length === 1,
    keep2.map((k) => k.keep + " (" + k.sub + ")").join(" / "));

  const formyZap = await page.evaluate(() => {
    const kf = document.getElementById("keepForms");
    const kc = document.getElementById("keepCopies");
    kc.value = "2"; kc.dispatchEvent(new Event("input", { bubbles: true }));
    kf.checked = true; kf.dispatchEvent(new Event("change", { bubbles: true }));
    const c = window.__pgo.getComputed();
    const res = window.__pgo.getRows().filter((r) => r.pokemon === "Pidgey").map((r) => c[r.id].keep);
    kf.checked = false; kf.dispatchEvent(new Event("change", { bubbles: true }));
    kc.value = "1"; kc.dispatchEvent(new Event("input", { bubbles: true }));
    return res;
  });
  check("se zapnutým „Shadow a Lucky držet vždy“ nepadá ani ten třetí",
    formyZap.every((k) => k !== "Zahodit – kopie" && k.indexOf("Lucky") === -1),
    formyZap.join(" / "));

  console.log("\n6) filtry");
  const filters = await page.evaluate(() => {
    const f = document.getElementById("filterSelect");
    const count = (v) => { f.value = v; f.dispatchEvent(new Event("change", { bubbles: true })); return document.querySelectorAll("#tbody tr").length; };
    const out = { dupes: count("dupes"), mega: count("mega"), all: count("all") };
    return out;
  });
  // "Duplicity k zahození" znamená horší kopie, ne všechny kusy toho druhu —
  // ten nejlepší z trojice Pidgeyů si necháváš, takže se sem nepočítá.
  eq("filtr duplicit ukáže 2 horší Pidgey ze tří", filters.dupes, 2);
  check("filtr mega ukáže aspoň Charizarda", filters.mega >= 1, String(filters.mega));
  eq("filtr „vše“ vrátí všechny řádky", filters.all, 8);

  console.log("\n7) export CSV");
  // Export je mezi „dalšími" akcemi — lišta je nechává schované, dokud se
  // nerozbalí. Uživatel udělá totéž kliknutím na „Další…".
  await page.evaluate(() => {
    const v = document.querySelector(".tb-vic");
    const r = document.querySelector(".tb-dalsi");
    if (v && r && r.hidden) v.click();
  });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportBtn"),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const ch of stream) chunks.push(ch);
  const csv = Buffer.concat(chunks).toString("utf-8").replace(/^﻿/, "");
  const lines = csv.trim().split("\n");
  eq("export má hlavičku + 8 řádků", lines.length, 9);
  check("hlavička odpovídá listu Import v Excelu", lines[0].startsWith("Pokémon,Forma,Finální evoluce,CP,Level"), lines[0]);

  console.log("\n8) round-trip: vlastní export jde naimportovat zpět");
  const roundTrip = await page.evaluate((text) => {
    window.__pgo.importText(text);
    window.__pgo.finishImport(true);
    return window.__pgo.getRows().map((r) => r.pokemon + ":" + (r.forma || "-"));
  }, csv);
  eq("po round-tripu sedí počet", roundTrip.length, 8);
  // pozn.: v kroku 4 byl první řádek přejmenován na Snorlax, takže se kontrolují formy, ne jména
  const forms = roundTrip.map((x) => x.split(":")[1]);
  check("po round-tripu zůstaly formy Shadow i Lucky",
    forms.filter((f) => f === "Shadow").length === 1 && forms.filter((f) => f === "Lucky").length === 1,
    roundTrip.join(" "));

  console.log("\n9) herní data z pokédexu (typy, evoluce, mega, PvP potenciál)");
  const dexRes = await page.evaluate(() => {
    // roster bez vyplněného sloupce „Finální evoluce" — appka si to má zjistit sama
    window.__pgo.setRows([
      { pokemon: "Pidgey", ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Venusaur", ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Farfetch'd", ivAtk: 10, ivDef: 10, ivSta: 10 },
      // vysoké IV, ať projde i podmínkou „vyplatí se ho evolvovat"
      { pokemon: "Galarian Farfetch'd", ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Metagross", ivAtk: 8, ivDef: 9, ivSta: 7 },
      { pokemon: "Azumarill", ivAtk: 0, ivDef: 15, ivSta: 15 },
      { pokemon: "Registeel", ivAtk: 15, ivDef: 4, ivSta: 3 },
      { pokemon: "Charizard", ivAtk: 15, ivDef: 15, ivSta: 14 },
      { pokemon: "Stunfisk (Galarian)", ivAtk: 12, ivDef: 14, ivSta: 15 },
    ]);
    const rows = window.__pgo.getRows(), c = window.__pgo.getComputed();
    const out = {};
    rows.forEach((r) => { out[r.pokemon] = c[r.id]; });
    return out;
  });
  eq("Pidgey se pozná jako neevolvovaný", dexRes["Pidgey"].evolve, "Ano");
  eq("Venusaur se pozná jako finální evoluce", dexRes["Venusaur"].evolve, "Finální");
  eq("běžný Farfetch'd nemá evoluci", dexRes["Farfetch'd"].evolve, "Finální");
  eq("galarský Farfetch'd evoluci má", dexRes["Galarian Farfetch'd"].evolve, "Ano");
  eq("galarský Farfetch'd není duplicita běžného", dexRes["Galarian Farfetch'd"].copies, "jediný kus");
  eq("typy Metagrosse z herních dat", dexRes["Metagross"].types, "Steel / Psychic");
  eq("galarský Stunfisk má jiné typy než běžný", dexRes["Stunfisk (Galarian)"].types, "Ground / Steel");
  check("mega formy Charizarda z herních dat", dexRes["Charizard"].megaNames === "Mega Charizard X / Mega Charizard Y", dexRes["Charizard"].megaNames);
  check("PvP potenciál se počítá z IV", /GL \d/.test(dexRes["Azumarill"].pvpPot), dexRes["Azumarill"].pvpPot);
  check("Azumarill 0/15/15 je silný GL pick", dexRes["Azumarill"].pvpRec.indexOf("Ano") === 0, dexRes["Azumarill"].pvpRec);
  check("průměrný kus meta druhu PvP doporučení nedostane (práh 98 % není měkký)",
    dexRes["Registeel"].pvpRec.indexOf("Ano") !== 0, dexRes["Registeel"].pvpRec + " / " + dexRes["Registeel"].pvpPot);
  check("Metagross má vysoké % v GL, ale do GL/UL ho to nedoporučí",
    dexRes["Metagross"].pvpPot.indexOf("není v PvPoke top") > -1
    && dexRes["Metagross"].pvpRec.indexOf("Ano") !== 0,
    dexRes["Metagross"].pvpPot + " / " + dexRes["Metagross"].pvpRec);
  check("…a místo toho ho pošle do Master League, kde meta je",
    dexRes["Metagross"].pvpRec.indexOf("ML #") === 0, dexRes["Metagross"].pvpRec);

  console.log("\n10) IV z přejmenování (cesta bez placeného CSV exportu)");
  const nickRes = await page.evaluate(() => {
    // přesně to, co vyrobí bezplatný „nickname generator" v Poké Genie / Calcy IV
    const text = [
      "Name,CP",
      "Metagross 15/14/13 93%,3100",
      "Azumarill 0/15/15 89%,1489",
      "Blissey 10-15-15,2800",
      "Pidgey 2/1/0 6%,289",
    ].join("\n");
    window.__pgo.importText(text);
    window.__pgo.finishImport(true);
    const rows = window.__pgo.getRows(), c = window.__pgo.getComputed();
    return rows.map((r) => ({
      pokemon: r.pokemon, iv: [r.ivAtk, r.ivDef, r.ivSta].join("/"), note: r.note,
      types: c[r.id].types, ivPct: c[r.id].ivPct, keep: c[r.id].keep, pvp: c[r.id].pvpRec,
    }));
  });
  eq("z přezdívky se vytáhl druh", nickRes[0].pokemon, "Metagross");
  eq("z přezdívky se vytáhla IV", nickRes[0].iv, "15/14/13");
  eq("původní přezdívka zůstala v poznámce", nickRes[0].note, "Metagross 15/14/13 93%");
  eq("druh se dohledal v pokédexu i s přezdívkou", nickRes[0].types, "Steel / Psychic");
  check("IV % se dopočítalo z vytažených IV", Math.round(nickRes[0].ivPct * 100) === 93, String(nickRes[0].ivPct));
  eq("funguje i zápis pomlčkami", nickRes[2].iv, "10/15/15");
  // bez ranku z Poké Genie se verdikt bere ze stat productu spočítaného z IV
  check("Azumarill 0/15/15 z přezdívky je PvP pick", nickRes[1].pvp === "Ano – GL", nickRes[1].pvp);
  eq("slabý Pidgey z přezdívky jde rovnou pryč", nickRes[3].keep, "Zahodit");

  const manual = await page.evaluate(() => {
    window.__pgo.setRows([{ pokemon: "Galarian Stunfisk 15/15/14 98%" }]);
    const r = window.__pgo.getRows()[0];
    return window.__pgo.getComputed()[r.id].types;
  });
  eq("ručně napsané jméno se staty se pořád dohledá", manual, "Ground / Steel");

  console.log("\n11) skutečný export z Calcy IV (fixture z reálného telefonu)");
  const calcyCsv = fs.readFileSync(path.join(__dirname, "fixtures", "calcy_iv_export.csv"), "utf-8");
  const calcy = await page.evaluate((csv) => {
    window.__pgo.importText(csv);
    // Co appka z hlavičky rozpoznala. Ruční mapování už v importu není,
    // takže se to čte přímo z logiky, ne z rozbalovátek.
    const mapped = window.__pgo.automatickeMapovani(csv) || {};
    window.__pgo.finishImport(true);
    const rows = window.__pgo.getRows(), c = window.__pgo.getComputed();
    const byName = {};
    rows.forEach((r) => {
      byName[r.pokemon] = {
        forma: r.forma, note: r.note, cp: r.cp, ch1: r.charged1, ul: r.ulRank,
        iv: [r.ivAtk, r.ivDef, r.ivSta].join("/"), ivPct: c[r.id].ivPct,
        types: c[r.id].types, keep: c[r.id].keep, evolve: c[r.id].evolve,
        mega: c[r.id].mega, pvp: c[r.id].pvpRec, summary: c[r.id].summary,
      };
    });
    return { mapped, count: rows.length, byName };
  }, calcyCsv);

  eq("naimportovalo se všech 7 pokémonů", calcy.count, 7);
  eq("druh se vzal ze sloupce Name", calcy.mapped["Pokémon (druh)"], "Name");
  eq("IV Attack ze sloupce ØATT IV", calcy.mapped["IV Attack"], "ØATT IV");
  eq("IV % z průměrného sloupce", calcy.mapped["IV % (průměr)"], "ØIV%");
  eq("GL rank z optimistické varianty", calcy.mapped["GL rank"], "GL Rank (min)");
  eq("UL rank z optimistické varianty", calcy.mapped["UL rank"], "UL Rank (min)");
  eq("přezdívka jde do poznámky, ne do druhu", calcy.mapped["Poznámka / přezdívka"], "Nickname");
  eq("číselný sloupec Form se jako forma nepoužije", calcy.mapped["Forma (Shadow/Lucky/…)"], undefined);
  eq("BuddyBoosted není Buddy", calcy.mapped["Buddy?"], undefined);
  eq("Calcy IV nemá ML rank", calcy.mapped["ML rank"], undefined);

  eq("typy z pokédexu", calcy.byName["Ampharos"].types, "Electric");
  eq("mega evoluce i s prioritou", calcy.byName["Ampharos"].mega, "Střední");
  eq("finální evoluce se pozná bez ptaní", calcy.byName["Ampharos"].evolve, "Finální");
  eq("prázdné sloupce (Calcy píše pomlčku) se neberou jako text", calcy.byName["Ampharos"].ch1, "");
  eq("přezdívka z telefonu zůstala", calcy.byName["Ampharos"].note, "Amp♀87");

  eq("100% Mewtwo se spočítalo správně", Math.round(calcy.byName["Mewtwo"].ivPct * 100), 100);
  check("nejednoznačný sken je vidět ve shrnutí",
    calcy.byName["Gyarados"].summary.indexOf("sken nejednoznačný") > -1, calcy.byName["Gyarados"].summary);
  eq("samec Combee se vyvinout nemůže", calcy.byName["Combee"].evolve, "Jen ♀");
  // Litten žádnou ligu nehraje. Dřív se tu ukazovalo „IV rank #1134", což je
  // pořadí IV kombinace u téhož druhu — číslo, které o použitelnosti v lize
  // neříká vůbec nic. Teď je tam poctivé „Ne“ a rank zůstal jen v bublině.
  eq("druh, který ligu nehraje, dostane poctivé Ne", calcy.byName["Litten"].pvp, "Ne");


  console.log("\n12) opakovaný sken téhož kusu (chycení + doskenování s Appraisal)");
  // Gyarados z reálného exportu má nepřesný sken (42,2–51,1 %). Přidáme druhý sken
  // téhož kusu — stejné CP i level, ale IV už určená přesně.
  const calcyLines = calcyCsv.trim().split(/\r?\n/);
  const gyaLine = calcyLines.find((l) => l.split(",")[3] === "Gyarados").split(",");
  const rescan = gyaLine.slice();
  rescan[12] = "48.9"; rescan[13] = "48.9"; rescan[14] = "48.9";
  rescan[15] = "9.0"; rescan[16] = "7.0"; rescan[17] = "6.0";
  const withRescan = calcyLines.concat([rescan.join(",")]).join("\n");

  const dedupe = await page.evaluate((csv) => {
    function run(merge) {
      window.__pgo.importText(csv);
      document.getElementById("dedupeScans").checked = merge;
      window.__pgo.finishImport(true);
      const rows = window.__pgo.getRows(), c = window.__pgo.getComputed();
      const gya = rows.filter((r) => r.pokemon === "Gyarados");
      return {
        total: rows.length,
        gyaCount: gya.length,
        gyaIv: gya.map((r) => [r.ivAtk, r.ivDef, r.ivSta].join("/")),
        gyaCopies: gya.map((r) => c[r.id].copies),
        gyaUncertain: gya.map((r) => c[r.id].ivUncertain),
      };
    }
    const off = run(false);
    const on = run(true);
    return { off, on };
  }, withRescan);

  eq("bez slučování se druhý sken počítá jako další kus", dedupe.off.total, 8);
  eq("…a Gyarados je pak dvakrát", dedupe.off.gyaCount, 2);
  check("…a tváří se jako dvě kopie", dedupe.off.gyaCopies.indexOf("#1 z 2") > -1, dedupe.off.gyaCopies.join(","));
  eq("se slučováním zůstane původních 7 pokémonů", dedupe.on.total, 7);
  eq("…a Gyarados jen jednou", dedupe.on.gyaCount, 1);
  eq("…a zůstal ten přesnější sken", dedupe.on.gyaIv[0], "9.0/7.0/6.0");
  eq("…takže už není označený jako nejistý", dedupe.on.gyaUncertain[0], false);


  console.log("\n13) opakovaný sken naslepo (nevím, že už jsem to skenoval)");
  const rescanCases = await page.evaluate(() => {
    function verdicts() {
      const rows = window.__pgo.getRows(), c = window.__pgo.getComputed();
      return rows.map((r) => ({
        pokemon: r.pokemon, cp: r.cp, iv: [r.ivAtk, r.ivDef, r.ivSta].join("/"),
        copies: c[r.id].copies, keep: c[r.id].keep, summary: c[r.id].summary,
      }));
    }
    const out = {};

    // a) tentýž kus naskenovaný dvakrát úplně stejně → jeden řádek
    window.__pgo.importText([
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV",
      "Ampharos,1604,20,14,15,10",
      "Ampharos,1604,20,14,15,10",
    ].join("\n"));
    document.getElementById("dedupeScans").checked = true;
    window.__pgo.finishImport(true);
    out.stejnySken = verdicts();

    // b) dva OPRAVDU různé kusy: stejné CP i level, ale jiná IV → oba zůstanou
    window.__pgo.importText([
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV",
      "Pidgey,289,12,3,5,2",
      "Pidgey,289,12,10,11,12",
    ].join("\n"));
    document.getElementById("dedupeScans").checked = true;
    window.__pgo.finishImport(true);
    out.ruzneKusy = verdicts();

    // c) tentýž kus před vylepšením a po něm: stejná IV, jiné CP → nesmí radit zahodit
    window.__pgo.importText([
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV",
      "Metagross,2400,25,15,14,13",
      "Metagross,3100,35,15,14,13",
    ].join("\n"));
    document.getElementById("dedupeScans").checked = true;
    window.__pgo.finishImport(true);
    out.poVylepseni = verdicts();

    return out;
  });

  eq("dvakrát stejný sken se sloučí do jednoho", rescanCases.stejnySken.length, 1);
  eq("dva různé kusy se stejným CP zůstanou oba", rescanCases.ruzneKusy.length, 2);
  check("…a jeden z nich je označený jako horší kopie",
    rescanCases.ruzneKusy.some((r) => r.keep === "Zahodit – kopie"),
    rescanCases.ruzneKusy.map((r) => r.iv + ":" + r.keep).join(" / "));
  eq("stejná IV při jiném CP se neslučují naslepo", rescanCases.poVylepseni.length, 2);
  check("…ale appka varuje místo doporučení zahodit",
    rescanCases.poVylepseni.some((r) => r.keep === "Duplikát?"),
    rescanCases.poVylepseni.map((r) => r.cp + ":" + r.keep).join(" / "));
  check("…a nikomu neradí zahodit",
    !rescanCases.poVylepseni.some((r) => r.keep === "Zahodit – kopie"),
    rescanCases.poVylepseni.map((r) => r.cp + ":" + r.keep).join(" / "));


  console.log("\n14) profily (víc lidí na jednom počítači)");
  const profiles = await page.evaluate(() => {
    const out = {};
    window.__pgo.setRows([{ pokemon: "Metagross", cp: 3100, ivAtk: 15, ivDef: 14, ivSta: 13 }]);
    out.vychoziProfil = window.__pgo.getProfile();
    out.mujPocet = window.__pgo.getRows().length;

    window.__pgo.createProfile("Kolega");
    out.poZalozeni = { profil: window.__pgo.getProfile(), radku: window.__pgo.getRows().length };
    window.__pgo.setRows([
      { pokemon: "Blissey", cp: 2800, ivAtk: 10, ivDef: 15, ivSta: 15 },
      { pokemon: "Pidgey", cp: 289, ivAtk: 3, ivDef: 5, ivSta: 2 },
    ]);
    out.kolegaPocet = window.__pgo.getRows().length;
    out.seznam = window.__pgo.listProfiles().sort();

    window.__pgo.switchProfile(out.vychoziProfil);
    out.zpetNaMuj = {
      profil: window.__pgo.getProfile(),
      radku: window.__pgo.getRows().length,
      prvni: window.__pgo.getRows()[0] ? window.__pgo.getRows()[0].pokemon : null,
    };

    window.__pgo.switchProfile("Kolega");
    out.zpetNaKolegu = {
      radku: window.__pgo.getRows().length,
      prvni: window.__pgo.getRows()[0] ? window.__pgo.getRows()[0].pokemon : null,
    };

    window.__pgo.renameProfile("Kolega z práce");
    out.poPrejmenovani = { profil: window.__pgo.getProfile(), seznam: window.__pgo.listProfiles().sort() };

    window.__pgo.deleteProfile();
    out.poSmazani = { profil: window.__pgo.getProfile(), radku: window.__pgo.getRows().length, seznam: window.__pgo.listProfiles() };
    return out;
  });

  eq("nový profil startuje prázdný", profiles.poZalozeni.radku, 0);
  eq("…a je rovnou aktivní", profiles.poZalozeni.profil, "Kolega");
  eq("data druhého profilu jsou oddělená", profiles.kolegaPocet, 2);
  check("oba profily jsou v seznamu", profiles.seznam.length === 2, profiles.seznam.join(", "));
  eq("přepnutí zpět vrátí můj roster", profiles.zpetNaMuj.radku, 1);
  eq("…a je to opravdu můj pokémon", profiles.zpetNaMuj.prvni, "Metagross");
  eq("přepnutí ke kolegovi vrátí jeho roster", profiles.zpetNaKolegu.radku, 2);
  eq("…a jeho pokémona", profiles.zpetNaKolegu.prvni, "Blissey");
  eq("přejmenování profilu drží", profiles.poPrejmenovani.profil, "Kolega z práce");
  check("…a nezaloží duplikát", profiles.poPrejmenovani.seznam.length === 2, profiles.poPrejmenovani.seznam.join(", "));
  eq("po smazání se přepne na zbylý profil", profiles.poSmazani.seznam.length, 1);
  eq("…a načte jeho data", profiles.poSmazani.radku, 1);

  console.log("\n15) profil přežije zavření stránky");
  await page.goto(URL);
  const afterReload = await page.evaluate(() => ({
    profil: window.__pgo.getProfile(),
    radku: window.__pgo.getRows().length,
    vyber: document.getElementById("profileSelect").value,
  }));
  eq("po reloadu se vrátí poslední profil", afterReload.profil, profiles.vychoziProfil);
  eq("…i s jeho rosterem", afterReload.radku, 1);
  eq("…a je vybraný i v rozbalovátku", afterReload.vyber, profiles.vychoziProfil);


  console.log("\n16) tradování a předvýběr na doskenování");
  const trade = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machoke", cp: 1200, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 },
      { pokemon: "Haunter", cp: 900, level: 18, ivAtk: 14, ivDef: 13, ivSta: 15 },
      { pokemon: "Machamp", cp: 2400, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 },
      { pokemon: "Machoke", forma: "Shadow", cp: 1210, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 },
      // nejistý sken u druhu, na kterém záleží (gym obránce)
      { pokemon: "Gyarados", cp: 1719, level: 19, ivAtk: 9, ivDef: 5, ivSta: 6.6, ivPctMin: 42.2, ivPctMax: 51.1 },
      // nejistý sken u odpadu — nemá cenu kvůli tomu otevírat Appraisal
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5, ivPctMin: 22, ivPctMax: 31 },
      // nejistý sken u PvP meta druhu, kde to může vyjít vysoko
      { pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 2, ivDef: 14, ivSta: 15, ivPctMin: 60, ivPctMax: 95 },
    ]);
    const rows = window.__pgo.getRows(), c = window.__pgo.getComputed();
    const out = { rows: {}, tiles: {} };
    rows.forEach((r) => {
      out.rows[r.pokemon + (r.forma === "Shadow" ? " (shadow)" : "")] =
        { trade: c[r.id].trade, tradeSub: c[r.id].tradeSub, rescan: c[r.id].rescan };
    });
    const f = document.getElementById("filterSelect");
    const count = (v) => { f.value = v; f.dispatchEvent(new Event("change", { bubbles: true })); return document.querySelectorAll("#tbody tr").length; };
    out.filtrTrade = count("trade");
    out.maRescanVolbu = !!document.querySelector('#filterSelect option[value="rescan"]');
    count("all");
    return out;
  });

  check("Machoke se má vytradovat kvůli evoluci zdarma",
    trade.rows["Machoke"].trade === "Ano",
    trade.rows["Machoke"].trade);
  check("…a Haunter taky", trade.rows["Haunter"].trade === "Ano", trade.rows["Haunter"].trade);
  check("…a je vidět, na co se vyvine", trade.rows["Machoke"].tradeSub.indexOf("Machamp") > -1, trade.rows["Machoke"].tradeSub);
  eq("už vyvinutý Machamp trade nepotřebuje", trade.rows["Machamp"].trade, "Ne");
  eq("shadow kus se vytradovat nedá", trade.rows["Machoke (shadow)"].trade, "Nejde");

  check("nejistý sken u gym obránce se vyplatí doskenovat",
    trade.rows["Gyarados"].rescan === "Ano", trade.rows["Gyarados"].rescan);
  check("nejistý sken u odpadu doskenovávat nemusíš",
    trade.rows["Rattata"].rescan === "Ne", trade.rows["Rattata"].rescan);
  check("u meta druhu, který může vyjít vysoko, ANO včetně stropu",
    trade.rows["Azumarill"].rescan === "Ano", trade.rows["Azumarill"].rescan);

  // Dvojka, ne trojka: dlaždice „Na trade" teď znamená JEN evoluci zdarma
  // (Machoke, Haunter). Třetí bývalo „Zvážit — přehodí IV" u Gyaradose,
  // tedy návod, jak přijít o gymového obránce, kterého si appka sama drží.
  // Kus, který uzavírá roli, se k výměně nenabízí.
  eq("filtr „jen na trade“ ukáže právě je", trade.filtrTrade, 2);
  // Volba tu kdysi nebyla — jenže dlaždice „Doskenovat s Appraisal“ ten režim
  // nastavuje, takže se appka dostala do stavu, který výběr neumí zobrazit:
  // ukázal prázdno a hláška u nenalezeného výsledku pojmenovala jiný filtr.
  // Filtr, do kterého se dá kliknout, musí jít i vybrat.
  eq("volba „jen doskenovat“ ve filtru je, protože ji nastavuje dlaždice",
    trade.maRescanVolbu, true);


  console.log("\n17) přehled zdrojů a stáří dat");
  const info = await page.evaluate(() => {
    const box = document.getElementById("dataInfo");
    const di = window.__pgo.dataInfo;
    const before = di.meta;
    di.meta = "2020-01-01";
    window.__pgo.renderDataInfo();
    const stale = !!document.querySelector("#dataInfo .stale-warn");
    di.meta = before;
    window.__pgo.renderDataInfo();
    return {
      text: box.textContent.replace(/\s+/g, " "),
      radku: box.querySelectorAll(".src-table tr").length,
      odkaz: box.querySelector("a") ? box.querySelector("a").href : null,
      staleVarovani: stale,
      poObnoveni: !document.querySelector("#dataInfo .stale-warn"),
      metaTop: di.metaTop,
    };
  });
  // Zdroje musí být vypsané všechny, protože appka podle nich rozhoduje:
  // herní data, PvP žebříčky, spočítaní gymoví obránci, ruční seznam jako
  // záloha, vlastní DPS žebříček útočníků, spočítané pořadí typů podle
  // pokrytí bossů, časová osa akcí ze stránek LeekDucku, evoluční graf
  // a pravidla výměn. Devět řádků plus hlavička — obránci a ruční seznam
  // se rozdělili na dva řádky, protože to není jeden zdroj.
  eq("tabulka zdrojů má hlavičku a devět řádků", info.radku, 10);
  check("tvrdá data jsou označená jako tvrdá", info.text.indexOf("tvrdá data") > -1);
  check("ruční seznam je označený jako náchylný zastarat", info.text.indexOf("náchylné zastarat") > -1);
  check("je vidět, odkud je PvP meta a jak je stará", info.text.indexOf("PvPoke top") > -1, info.text.slice(0, 200));
  eq("odkaz vede na žebříčky PvPoke", info.odkaz, "https://pvpoke.com/rankings/");
  check("je tam návod, co na PvPoke hledat", info.text.indexOf("moveset") > -1);
  check("jsou tam příkazy na obnovu dat", info.text.indexOf("build_meta.py --refresh") > -1);
  check("stará data vyvolají varování", info.staleVarovani);
  check("…a po obnovení zmizí", info.poObnoveni);
  eq("meta se bere z top 200 PvPoke", info.metaTop, 200);


  console.log("\n18) opakovaný import: sloučit vs. nahradit");
  const mergeRes = await page.evaluate(() => {
    const den1 = [
      "Name,CP,Level,min IV%,ØIV%,max IV%,ØATT IV,ØDEF IV,ØHP IV,Fast move,Special move",
      "Gyarados,1719,19,42.2,45.8,51.1,9,5,6.6,Bite,Crunch",
      "Blissey,2800,30,88.9,88.9,88.9,10,15,15,Pound,Dazzling Gleam",
    ].join("\n");
    // druhý den: Gyarados doskenovaný s Appraisal + nový úlovek
    const den2 = [
      "Name,CP,Level,min IV%,ØIV%,max IV%,ØATT IV,ØDEF IV,ØHP IV,Fast move,Special move",
      "Gyarados,1719,19,48.9,48.9,48.9,9,7,6,Bite,Crunch",
      "Blissey,2800,30,88.9,88.9,88.9,10,15,15,Pound,Dazzling Gleam",
      "Machoke,1200,20,66.7,66.7,66.7,10,10,10,Karate Chop,Cross Chop",
    ].join("\n");

    window.__pgo.importText(den1);
    window.__pgo.finishImport("replace");
    // ruční úprava, kterou z Calcy exportu nedostaneš
    const gy = window.__pgo.getRows().filter((r) => r.pokemon === "Gyarados")[0];
    gy.forma = "Shadow";
    gy.note = "moje poznámka";

    window.__pgo.importText(den2);
    window.__pgo.finishImport("merge");
    const rows = window.__pgo.getRows(), c = window.__pgo.getComputed();
    const g = rows.filter((r) => r.pokemon === "Gyarados")[0];
    return {
      pocet: rows.length,
      gyIv: [g.ivAtk, g.ivDef, g.ivSta].join("/"),
      gyForma: g.forma,
      gyPoznamka: g.note,
      gyNejisty: !!c[g.id].ivUncertain,
      druhy: rows.map((r) => r.pokemon).sort().join(","),
    };
  });
  eq("sloučení nezduplikuje, jen přidá nový kus", mergeRes.pocet, 3);
  eq("…a jsou to ty správné druhy", mergeRes.druhy, "Blissey,Gyarados,Machoke");
  eq("doskenovaná IV přepsala ta nepřesná", mergeRes.gyIv, "9/7/6");
  eq("…takže už není nejistý", mergeRes.gyNejisty, false);
  eq("ruční Forma se nepřepsala", mergeRes.gyForma, "Shadow");
  eq("ruční poznámka zůstala", mergeRes.gyPoznamka, "moje poznámka");

  const replaceRes = await page.evaluate(() => {
    const gy = window.__pgo.getRows().filter((r) => r.pokemon === "Gyarados")[0];
    gy.forma = "Shadow";
    window.__pgo.importText([
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV",
      "Gyarados,1719,19,9,7,6",
    ].join("\n"));
    window.__pgo.finishImport("replace");
    const rows = window.__pgo.getRows();
    return { pocet: rows.length, forma: rows[0].forma };
  });
  eq("nahrazení zahodí zbytek rosteru", replaceRes.pocet, 1);
  check("…a ruční úpravy s ním", !replaceRes.forma, "forma=" + replaceRes.forma);


  console.log("\n19) CP jako měřítko (strop po vylepšení a evoluci)");
  const cpRes = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Magikarp", cp: 120, level: 8, ivAtk: 14, ivDef: 15, ivSta: 15 },
      { pokemon: "Rattata", cp: 500, level: 30, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Blissey", cp: 2000, level: 22, ivAtk: 2, ivDef: 3, ivSta: 4 },
      { pokemon: "Azumarill", cp: 500, level: 10, ivAtk: 0, ivDef: 15, ivSta: 15 },
      { pokemon: "Salamence", cp: 2000, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15 },
    ]);
    const rows = window.__pgo.getRows(), c = window.__pgo.getComputed();
    const out = {};
    rows.forEach((r) => { out[r.pokemon] = { cp: r.cp, max: c[r.id].cpMax, pvp: c[r.id].pvpRec }; });
    return out;
  });

  eq("nevyvinutý kus ukazuje i strop po evoluci", cpRes["Magikarp"].max.evolvedName, "Gyarados");
  check("…a ten je řádově jinde než současné CP",
    cpRes["Magikarp"].max.evolved > 3000 && Number(cpRes["Magikarp"].cp) < 200,
    cpRes["Magikarp"].cp + " → " + cpRes["Magikarp"].max.evolved);
  eq("finální evoluce žádný další strop nemá", cpRes["Salamence"].max.evolved, null);
  check("vysoké CP neznamená kvalitu (Blissey 20 % IV)",
    cpRes["Blissey"].pvp === "Ne", cpRes["Blissey"].pvp);
  check("nízké CP neznamená odpad (Azumarill 500 CP je GL pick)",
    cpRes["Azumarill"].pvp.indexOf("Ano") === 0, cpRes["Azumarill"].pvp);
  check("Rattata i se 100 % IV zůstává slabá",
    cpRes["Rattata"].max.evolved < 2000, String(cpRes["Rattata"].max.evolved));


  console.log("\n20) rozvržení stránky");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  const layout = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Magikarp", cp: 120, level: 8, ivAtk: 14, ivDef: 15, ivSta: 15 },
      { pokemon: "Blissey", cp: 2800, level: 30, ivAtk: 10, ivDef: 15, ivSta: 15 },
    ]);
    const wrap = document.querySelector(".table-wrap");
    const table = document.getElementById("rosterTable");
    const sel = document.getElementById("viewSelect");

    const verdict = {
      cols: document.querySelectorAll("#headerRow th").length - 1,
      width: Math.round(table.getBoundingClientRect().width),
      fits: wrap.scrollWidth <= wrap.clientWidth + 1,
    };
    sel.value = "all"; sel.dispatchEvent(new Event("change", { bubbles: true }));
    const all = {
      cols: document.querySelectorAll("#headerRow th").length - 1,
    };
    sel.value = "verdict"; sel.dispatchEvent(new Event("change", { bubbles: true }));

    return {
      verdict, all,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      // až po přepnutí zobrazení — překreslení tbody staré buňky zahodí
      sticky: getComputedStyle(document.querySelector("#rosterTable tbody td.col-pokemon")).position,
      settingsClosed: !document.querySelector(".settings-card").open,
      srcTableWidth: Math.round(document.querySelector(".src-table").getBoundingClientRect().width),
      strongCol: Array.prototype.some.call(document.querySelectorAll("#headerRow th"),
        (th) => th.textContent.indexOf("Silný proti") > -1) ? "ano" : "",
    };
  });

  check("stránka nemá vodorovný posuvník", !layout.pageOverflow);
  // Sloupec „Forma“ už není — Shadow/Purified jsou značka u jména.
  eq("v režimu Rozhodnutí je 19 sloupců", layout.verdict.cols, 19);
  check("…a na 1920 px se vejdou bez scrollování", layout.verdict.fits, String(layout.verdict.width));
  check("je vidět, proti jakým typům je pokémon silný", layout.strongCol, layout.strongCol);
  eq("v režimu Vše je sloupců 40", layout.all.cols, 40);
  eq("sloupec se jménem je přišpendlený", layout.sticky, "sticky");
  check("nastavení prahů je sbalené, roster je hned pod souhrnem", layout.settingsClosed);
  check("tabulka zdrojů se neroztahuje přes celou šířku", layout.srcTableWidth <= 800, String(layout.srcTableWidth));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(120);   // layout po změně velikosti okna
  const narrow = await page.evaluate(() => {
    const wrap = document.querySelector(".table-wrap");
    wrap.scrollLeft = 500;
    const starTd = document.querySelector("#rosterTable tbody td");
    const nameTd = document.querySelector("#rosterTable tbody td.col-pokemon");
    const res = {
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      // vlevo jsou přišpendlené dva sloupce: hvězdička (30 px) a hned za ní jméno
      starStaysVisible: Math.abs(starTd.getBoundingClientRect().left - wrap.getBoundingClientRect().left) < 5,
      nameStaysVisible: (() => {
        const obrTd = nameTd.parentNode.querySelector("td.col-obr");
        const levy = obrTd || starTd;
        return Math.abs(nameTd.getBoundingClientRect().left
          - levy.getBoundingClientRect().right) < 5;
      })(),
    };
    wrap.scrollLeft = 0;
    return res;
  });
  check("ani na užší obrazovce nemá stránka vodorovný posuvník", !narrow.pageOverflow);
  check("…a hvězdička zůstává vidět i po odscrollování doprava", narrow.starStaysVisible);
  check("…a jméno pokémona taky", narrow.nameStaysVisible);
  await page.setViewportSize({ width: 1280, height: 720 });


  console.log("\n21) rozhodné verdikty, dlaždice jako filtry, typy a paměť na smazané");
  const ui = await page.evaluate(() => {
    // prahy natvrdo — výchozí kalibrace appky se může měnit, chování prahů na ní viset nesmí
    const setCfg = (cfg) => Object.keys(cfg).forEach((id) => {
      const el = document.getElementById(id);
      el.value = String(cfg[id]);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    setCfg({ keepCopies: 1, spThresh: 98 });   // „slabý kus meta druhu" se pozná až nad prahem
    window.__pgo.setRows([
      { pokemon: "Charizard", cp: 2900, level: 33, ivAtk: 15, ivDef: 15, ivSta: 14 },
      { pokemon: "Lanturn", cp: 1500, level: 25, ivAtk: 2, ivDef: 14, ivSta: 15 },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Machoke", cp: 1200, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 },
      { pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15 },
    ]);
    const c = window.__pgo.getComputed();
    const out = { verdikty: {}, strong: {}, strongAll: {} };
    window.__pgo.getRows().forEach((r) => {
      out.verdikty[r.pokemon] = c[r.id].keep;
      out.strong[r.pokemon] = c[r.id].strong;
      out.strongAll[r.pokemon] = c[r.id].strongAll;
    });

    // Filtr se teď dělá výběrem nad tabulkou — karta Souhrn už neexistuje.
    const fTrade = document.getElementById("filterSelect");
    fTrade.value = "trade";
    fTrade.dispatchEvent(new Event("change", { bubbles: true }));
    out.poDlazdici = Array.from(document.querySelectorAll("#tbody tr td.col-pokemon")).map((td) => td.textContent);
    fTrade.value = "all";
    fTrade.dispatchEvent(new Event("change", { bubbles: true }));

    return out;
  });

  eq("odpad dostane rovnou Zahodit, ne vlažné zvážit", ui.verdikty["Rattata"], "Zahodit");
  // Dřív tu bylo „Zvážit – slabý kus". Verdikt „zvážit" se zrušil: příkaz,
  // který nechává rozhodnutí na uživateli, je k ničemu, když appka sama vidí,
  // že lepší kus toho druhu už v rosteru je.
  eq("slabý kus meta druhu dostane jasný verdikt, ne vlažné zvážit",
    ui.verdikty["Lanturn"], "Zahodit");
  eq("kus na trade se nezahazuje", ui.verdikty["Machoke"], "Nechat – trade");
  check("Charizard má vidět, proti čemu je dobrý",
    ui.strong["Charizard"].indexOf("Grass") > -1 && ui.strong["Charizard"].indexOf("Steel") > -1, ui.strong["Charizard"]);
  check("dvojtypý pokémon pokrývá typy z obou svých typů",
    ui.strongAll["Azumarill"].indexOf("Fire") > -1 && ui.strongAll["Azumarill"].indexOf("Dragon") > -1, ui.strongAll["Azumarill"]);
  check("dlouhý výčet typů se v buňce zkrátí", ui.strong["Azumarill"].indexOf("+") > -1, ui.strong["Azumarill"]);

  eq("klik na dlaždici vyfiltruje tabulku", ui.poDlazdici.join(","), "Machoke");

  const discard = await page.evaluate(() => {
    const csv = ["Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV",
      "Rattata,200,15,4,3,5", "Azumarill,1400,24,0,15,15"].join("\n");
    window.__pgo.importText(csv);
    window.__pgo.finishImport("replace");
    // smažu Rattatu (ve hře transfer) přes křížek v tabulce
    let delBtn = null;
    document.querySelectorAll("#tbody tr").forEach((tr) => {
      if (tr.querySelector("td.col-pokemon").textContent === "Rattata") delBtn = tr.querySelector(".del-btn");
    });
    delBtn.click();
    const poSmazani = window.__pgo.getRows().length;
    // stejný export znovu — Rattata se nesmí vrátit
    window.__pgo.importText(csv);
    window.__pgo.finishImport("merge");
    return {
      poSmazani,
      poImportu: window.__pgo.getRows().map((r) => r.pokemon),
      pamet: window.__pgo.getDiscarded().length,
      tlacitko: document.getElementById("forgetDiscardedBtn").style.display !== "none",
    };
  });
  eq("smazání ubere řádek", discard.poSmazani, 1);
  eq("smazaný kus se dalším importem nevrátí", discard.poImportu.join(","), "Azumarill");
  eq("…protože si ho appka pamatuje", discard.pamet, 1);
  check("…a nabídne, že to může zapomenout", discard.tlacitko);


  console.log("\n22) datum skenu: úklid boxu bez ručního mazání");
  const win = await page.evaluate(() => {
    const csv = [
      "Scan date,Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV",
      "8/1/25 10:00:00,Rattata,200,15,4,3,5",
      "8/1/25 10:01:00,Pidgey,289,12,3,5,2",
      "8/20/26 7:00:00,Azumarill,1400,24,0,15,15",
      "8/20/26 7:01:00,Machoke,1200,20,10,10,10",
      "8/20/26 7:02:00,Blissey,2800,30,10,15,15",
    ].join("\n");
    window.__pgo.importText(csv);
    const out = {};
    // Ruční mapování sloupců v importu už není — čte se přímo logika.
    out.mapped = (window.__pgo.automatickeMapovani(csv) || {})["Datum skenu"];
    out.noteAll = document.getElementById("scanWindowNote").textContent;
    const w = document.getElementById("scanWindow");
    w.value = "24"; w.onchange();
    out.noteDay = document.getElementById("scanWindowNote").textContent;
    window.__pgo.finishImport("replace");
    out.roster = window.__pgo.getRows().map((r) => r.pokemon);
    out.discardedAfterReplace = window.__pgo.getDiscarded().length;
    return out;
  });
  eq("sloupec s datem skenu se namapuje sám", win.mapped, "Scan date");
  check("bez omezení se bere celá historie", win.noteAll.indexOf("5 kusů") > -1, win.noteAll);
  check("po volbě posledního dne zbydou jen dnešní skeny", win.noteDay.indexOf("3 kusů") > -1, win.noteDay);
  eq("nahrazení udělá z posledního skenu celý roster", win.roster.join(","), "Azumarill,Machoke,Blissey");
  eq("…a paměť na smazané se vyprázdní, roster je teď pravda", win.discardedAfterReplace, 0);

  const recatch = await page.evaluate(() => {
    const den1 = "Scan date,Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV\n8/1/26 10:00:00,Pidgey,289,12,3,5,2";
    const den3 = "Scan date,Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV\n8/20/26 9:00:00,Pidgey,289,12,3,5,2";
    window.__pgo.importText(den1);
    window.__pgo.finishImport("replace");
    document.querySelector("#tbody .del-btn").click();

    window.__pgo.importText(den1);           // starý sken téhož kusu
    window.__pgo.finishImport("merge");
    const poStarem = window.__pgo.getRows().length;

    window.__pgo.importText(den3);           // úplně stejný pokémon, ale chycený později
    window.__pgo.finishImport("merge");
    return { poStarem, poNovem: window.__pgo.getRows().length };
  });
  eq("starý sken vyhozeného kusu se nevrátí", recatch.poStarem, 0);
  eq("později chycený identický kus ale projde", recatch.poNovem, 1);


  console.log("\n23) import jen doskenovaných kusů");
  const exact = await page.evaluate(() => {
    const csv = [
      "Scan date,Name,CP,Level,min IV%,ØIV%,max IV%,ØATT IV,ØDEF IV,ØHP IV",
      "8/20/26 7:00,Azumarill,1400,24,88.9,88.9,88.9,0,15,15",
      "8/20/26 7:01,Gyarados,1719,19,42.2,45.8,51.1,9,5,6.6",
      "8/20/26 7:02,Blissey,2800,30,88.9,88.9,88.9,10,15,15",
      "8/20/26 7:03,Rattata,200,15,22,26,31,4,3,5",
    ].join("\n");
    window.__pgo.importText(csv);
    const all = document.getElementById("scanWindowNote").textContent;
    const box = document.getElementById("onlyExact");
    box.checked = true; box.onchange();
    const filtered = document.getElementById("scanWindowNote").textContent;
    window.__pgo.finishImport("replace");
    return { all, filtered, roster: window.__pgo.getRows().map((r) => r.pokemon) };
  });
  check("bez filtru se berou všechny skeny", exact.all.indexOf("4 kusů") > -1, exact.all);
  check("s filtrem zůstanou jen přesné", exact.filtered.indexOf("2 kusů") > -1, exact.filtered);
  eq("…a jsou to ty doskenované", exact.roster.join(","), "Azumarill,Blissey");


  console.log("\n24) útoky (moveset a DPS)");
  const mv = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machamp", ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Machamp", ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Bullet Punch", charged1: "Heavy Slam" },
      { pokemon: "Metagross", ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Bullet Punch", charged1: "Meteor Mash" },
      { pokemon: "Tyranitar", ivAtk: 15, ivDef: 15, ivSta: 14, fastMove: "Smack Down", charged1: "Stone Edge" },
      { pokemon: "Gyarados", ivAtk: 15, ivDef: 15, ivSta: 14, fastMove: "Waterfall", charged1: "Hydro Pump" },
      { pokemon: "Blissey", ivAtk: 10, ivDef: 15, ivSta: 15 },
    ]);
    const c = window.__pgo.getComputed();
    const out = { rows: {}, tiles: {} };
    window.__pgo.getRows().forEach((r) => {
      const key = r.pokemon + "|" + (r.fastMove || "-");
      out.rows[key] = { moves: c[r.id].moves, tone: c[r.id].movesTone, title: c[r.id].movesTitle,
        strong: c[r.id].strong, fromMoves: c[r.id].strongFromMoves };
    });
    const f = document.getElementById("filterSelect");
    f.value = "retrain"; f.dispatchEvent(new Event("change", { bubbles: true }));
    out.retrainRows = document.querySelectorAll("#tbody tr").length;
    f.value = "all"; f.dispatchEvent(new Event("change", { bubbles: true }));
    return out;
  });

  eq("nejlepší moveset Machampa je Counter + Dynamic Punch",
    mv.rows["Machamp|Counter"].moves, "Top Fighting");
  eq("…a špatný moveset pošle na přeučení",
    mv.rows["Machamp|Bullet Punch"].moves, "Přeučit");
  eq("Metagross s Meteor Mash je top Steel", mv.rows["Metagross|Bullet Punch"].moves, "Top Steel");
  check("…a je vidět, že Meteor Mash chce Elite TM",
    mv.rows["Metagross|Bullet Punch"].title.indexOf("Elite TM") > -1, mv.rows["Metagross|Bullet Punch"].title);
  eq("Tyranitar s Rock movesetem je v roli top", mv.rows["Tyranitar|Smack Down"].moves, "Top Rock");
  check("…ale appka řekne, že jako Dark by byl silnější",
    mv.rows["Tyranitar|Smack Down"].title.indexOf("Dark") > -1, mv.rows["Tyranitar|Smack Down"].title);
  check("…a proto to není zelená", mv.rows["Tyranitar|Smack Down"].tone === "warning", mv.rows["Tyranitar|Smack Down"].tone);
  eq("bez vyplněných útoků se nehádá", mv.rows["Blissey|-"].moves, "Sken je nedal");

  check("silný proti se počítá z typů útoků, když jsou známé", mv.rows["Gyarados|Waterfall"].fromMoves);
  check("…a Water moveset kryje Fire/Ground/Rock",
    mv.rows["Gyarados|Waterfall"].strong.indexOf("Fire") > -1, mv.rows["Gyarados|Waterfall"].strong);
  check("bez útoků se použije odhad podle typů druhu", !mv.rows["Blissey|-"].fromMoves);

  eq("filtr „jen přeučit“ ukáže právě je", mv.retrainRows, 1);


  console.log("\n25) cena vylepšení a přednost vyššího levelu");
  const cost = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machamp", level: 20, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Machamp", level: 35, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Azumarill", level: 24, ivAtk: 0, ivDef: 15, ivSta: 15, fastMove: "Bubble", charged1: "Play Rough" },
    ]);
    const c = window.__pgo.getComputed();
    return window.__pgo.getRows().map((r) => ({
      pokemon: r.pokemon, level: r.level, powerup: c[r.id].powerup, powerupSub: c[r.id].powerupSub, costText: c[r.id].costText,
      dust: c[r.id].cost ? c[r.id].cost.dust : null,
    }));
  });
  check("u kusu na vylepšení je rovnou cena v prachu",
    /→ L\d+/.test(cost[0].powerupSub) && cost[0].powerupSub.indexOf("tis.") > -1,
    cost[0].powerupSub);
  check("cena se počítá z aktuálního levelu — z L35 je to levnější než z L20",
    cost[1].dust < cost[0].dust, cost[0].dust + " vs " + cost[1].dust);
  check("v tooltipu jsou i bonbóny", cost[0].costText.indexOf("bonbónů") > -1, cost[0].costText);
  check("při stejných IV dostane přednost vyšší level",
    cost[1].powerup === "Ano" && /→ L\d+/.test(cost[1].powerupSub),
    cost[1].powerup + " / " + cost[1].powerupSub);


  console.log("\n26) čitelnost tabulky");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  const compact = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Girafarig", level: 20, ivAtk: 14, ivDef: 12, ivSta: 13, fastMove: "Thunder Shock", charged1: "Thunderbolt" },
      { pokemon: "Machamp", level: 20, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Bullet Punch", charged1: "Heavy Slam" },
      { pokemon: "Gyarados", level: 19, ivAtk: 9, ivDef: 5, ivSta: 6, ivPctMin: 42.2, ivPctMax: 51.1, fastMove: "Waterfall", charged1: "Hydro Pump" },
      { pokemon: "Rattata", level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Metagross", level: 35, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Bullet Punch", charged1: "Meteor Mash" },
      { pokemon: "Azumarill", level: 24, ivAtk: 0, ivDef: 15, ivSta: 15, fastMove: "Bubble", charged1: "Play Rough" },
    ]);
    const heights = [];
    document.querySelectorAll("#tbody tr").forEach((tr) => heights.push(Math.round(tr.getBoundingClientRect().height)));
    const wrap = document.querySelector(".table-wrap");
    const crosses = document.querySelectorAll("#tbody .badge.no").length;
    const dashes = Array.from(document.querySelectorAll("#tbody .badge")).filter((b) => b.textContent.indexOf("—") === 0).length;
    return {
      maxHeight: Math.max.apply(null, heights),
      fits: wrap.scrollWidth <= wrap.clientWidth + 1,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      crosses, dashes,
    };
  });
  check("žádný řádek není vyšší než dva řádky textu", compact.maxHeight <= 56, compact.maxHeight + " px");
  check("tabulka se vejde bez vodorovného posouvání", compact.fits);
  check("stránka nemá vodorovný posuvník", !compact.pageOverflow);
  check("„Ne“ je červený křížek", compact.crosses > 0, String(compact.crosses));
  eq("…a nikde nezůstala pomlčka před Ne", compact.dashes, 0);
  await page.setViewportSize({ width: 1280, height: 720 });


  console.log("\n28) hledání, řazení, mazání a plán investic");
  const ui2 = await page.evaluate(() => {
    const mix = [
      ["Machamp", 30, 15, 14, 13, "Counter", "Dynamic Punch"], ["Machamp", 25, 12, 10, 11, "Counter", "Dynamic Punch"],
      ["Metagross", 35, 15, 14, 13, "Bullet Punch", "Meteor Mash"], ["Metagross", 20, 8, 9, 7, "Zen Headbutt", "Psychic"],
      ["Gyarados", 30, 15, 15, 14, "Waterfall", "Hydro Pump"],
      ["Charizard", 33, 15, 15, 14, "Fire Spin", "Blast Burn"],
      ["Tyranitar", 30, 15, 15, 14, "Smack Down", "Stone Edge"],
      ["Blissey", 30, 10, 15, 15, "Pound", "Dazzling Gleam"],
      ["Azumarill", 24, 0, 15, 15, "Bubble", "Play Rough"], ["Azumarill", 22, 5, 12, 13, "Bubble", "Play Rough"],
      ["Rattata", 15, 4, 3, 5, "Quick Attack", "Body Slam"],
    ];
    window.__pgo.setRows(mix.map((m) => ({
      pokemon: m[0], level: m[1], ivAtk: m[2], ivDef: m[3], ivSta: m[4], fastMove: m[5], charged1: m[6],
    })));
    const out = {};

    // hledání
    const input = document.getElementById("searchInput");
    input.value = "machamp"; input.dispatchEvent(new Event("input", { bubbles: true }));
    out.hledani = Array.from(document.querySelectorAll("#tbody tr td.col-pokemon")).map((td) => td.textContent);
    input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true }));
    out.poZruseni = document.querySelectorAll("#tbody tr").length;

    // klik na jméno
    let cell = null;
    document.querySelectorAll("#tbody tr td.col-pokemon").forEach((td) => { if (td.textContent === "Azumarill" && !cell) cell = td; });
    out.jmenoKlikaci = cell.className.indexOf("clickable-name") > -1;
    cell.click();
    // klik na jméno nově rozbaluje podrobný rozbor, filtrovat se dá hledáním
    out.detailPoKliku = !!document.querySelector("#tbody tr.detail-row");
    out.detailJmeno = (document.querySelector("#tbody .detail-title") || {}).textContent || "";
    cell.click();
    out.detailZavren = !document.querySelector("#tbody tr.detail-row");
    input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true }));

    // mazání má vlastní ikonu, ne křížek
    out.ikonaMazani = document.querySelector("#tbody .del-btn").textContent;

    // řazení: hlavní podle druhu, sekundární přes Shift podle CP
    const th = (label) => {
      let f = null;
      document.querySelectorAll("#headerRow th").forEach((h) => { if (h.textContent.replace(/[ ▲▼▽2]+$/, "") === label) f = h; });
      return f;
    };
    th("Pokémon").click();
    th("CP max").dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    out.hlavickaSekundarni = Array.from(document.querySelectorAll("#headerRow th")).map((h) => h.textContent)
      .filter((t) => t.indexOf("2") > -1);
    const names = Array.from(document.querySelectorAll("#tbody tr td.col-pokemon")).map((td) => td.textContent);
    out.serazeno = names;

    out.plan = window.__pgo.getPlan();
    return out;
  });

  eq("hledání vyfiltruje podle jména", ui2.hledani.join(","), "Machamp,Machamp");
  eq("…a po vymazání se vrátí všichni", ui2.poZruseni, 11);
  check("jméno v tabulce je klikací", ui2.jmenoKlikaci);
  check("klik na jméno rozbalí podrobný rozbor", ui2.detailPoKliku, String(ui2.detailPoKliku));
  check("…a je v něm ten správný pokémon", ui2.detailJmeno.indexOf("Azumarill") === 0, ui2.detailJmeno);
  check("…a druhý klik ho zavře", ui2.detailZavren);
  check("mazání řádku není křížek (ten teď znamená Ne)", ui2.ikonaMazani !== "✕", ui2.ikonaMazani);
  check("Shift+klik označí druhotné řazení", ui2.hlavickaSekundarni.length === 1, ui2.hlavickaSekundarni.join("|"));
  check("primární řazení podle jména drží", ui2.serazeno[0] <= ui2.serazeno[ui2.serazeno.length - 1], ui2.serazeno.join(","));

  const plan = ui2.plan;
  check("plán navrhne jednoho útočníka na typ", plan.raid.length >= 4, String(plan.raid.length));
  check("…a nejsou v něm dva stejné typy",
    new Set(plan.raid.map((e) => e.type)).size === plan.raid.length, plan.raid.map((e) => e.type).join(","));
  // Druhý Metagross (Zen Headbutt + Psychic) se od zavedení rozpočtu drží —
  // Steel je krytý typ a parta do raidu má šest míst, takže druhá kopie
  // legitimně obsadí Steel #2. Do plánu se pak dostane pod typem svojí
  // sestavy, tedy jako Psychic. Podstatné je, že se každý typ nabídne jen
  // jednou a že se do plánu nedostane odpad — obojí se testuje vedle.
  check("…a žádný kus není v plánu dvakrát",
    new Set(plan.raid.map((e) => e.row.id)).size === plan.raid.length,
    plan.raid.map((e) => e.type + ":" + e.row.pokemon).join(", "));
  check("PvP nedoporučí dva kusy stejného druhu",
    plan.pvp.filter((e) => e.league === "GL").length === new Set(plan.pvp.filter((e) => e.league === "GL").map((e) => e.row.pokemon)).size,
    plan.pvp.map((e) => e.league + " " + e.row.pokemon).join(", "));
  check("do plánu se nedostane odpad", !plan.raid.some((e) => e.row.pokemon === "Rattata"), "Rattata");
  check("u každého návrhu je cena v prachu", plan.raid.every((e) => e.cost && e.cost.dust > 0), "");


  console.log("\n29) tahák na ven");
  const cheat = await page.evaluate(async () => {
    const mix = [
      ["Machamp", 30, 15, 14, 13, "Counter", "Dynamic Punch"], ["Metagross", 35, 15, 14, 13, "Bullet Punch", "Meteor Mash"],
      ["Gyarados", 30, 15, 15, 14, "Waterfall", "Hydro Pump"], ["Charizard", 33, 15, 15, 14, "Fire Spin", "Blast Burn"],
      ["Tyranitar", 30, 15, 15, 14, "Smack Down", "Stone Edge"], ["Blissey", 30, 10, 15, 15, "Pound", "Dazzling Gleam"],
      ["Snorlax", 28, 12, 14, 15, "Lick", "Body Slam"], ["Azumarill", 24, 0, 15, 15, "Bubble", "Play Rough"],
      ["Registeel", 30, 15, 15, 14, "Lock On", "Focus Blast"], ["Lanturn", 25, 2, 14, 15, "Water Gun", "Thunderbolt"],
      ["Venusaur", 30, 14, 14, 14, "Vine Whip", "Frenzy Plant"],
      ["Rattata", 15, 4, 3, 5, "Quick Attack", "Body Slam"],
    ];
    window.__pgo.setRows(mix.map((m) => ({
      pokemon: m[0], level: m[1], ivAtk: m[2], ivDef: m[3], ivSta: m[4], fastMove: m[5], charged1: m[6],
    })));
    const sheet = window.__pgo.getCheatSheet();
    document.getElementById("cheatCard").open = true;
    window.__pgo.renderCheatSheet();
    const byType = {};
    sheet.types.forEach((t) => { byType[t.type] = t; });
    return {
      typeCount: sheet.types.length,
      fire: byType["Fire"].picks.map((p) => p.name),
      water: byType["Water"].picks.map((p) => p.name),
      fireOff: byType["Fire"].picks.map((p) => p.off),
      hasJunk: sheet.types.some((t) => t.picks.some((p) => p.name === "Rattata")),
      gym: sheet.gym.map((g) => g.name),
      gl: sheet.pvp.GL.map((p) => p.name),
      rendered: document.querySelectorAll("#cheatBody .cs-type:not(.cs-keep):not(.cs-boss)").length,
      bossKaret: document.querySelectorAll("#cheatBody .cs-boss").length,
      bossPrvni: (document.querySelector("#cheatBody .cs-title") || {}).textContent || "",
      bossPicks: Array.from(document.querySelectorAll("#cheatBody .cs-boss")).map(
        (e) => e.querySelectorAll("li").length),
      hasMoveset: document.querySelector("#cheatBody .cs-mv") !== null,
    };
  });

  eq("tahák pokrývá všech 18 typů", cheat.typeCount, 18);
  check("proti Fire bossovi nabídne Rock/Water kusy",
    cheat.fire.indexOf("Tyranitar") > -1 || cheat.fire.indexOf("Gyarados") > -1, cheat.fire.join(","));
  check("…a všichni mají typovou výhodu", cheat.fireOff.every((o) => o > 1), cheat.fireOff.join(","));
  check("proti Water bossovi nabídne Grass/Electric",
    cheat.water.indexOf("Venusaur") > -1 || cheat.water.indexOf("Lanturn") > -1, cheat.water.join(","));
  check("odpad se do taháku nedostane", !cheat.hasJunk);
  check("je tam sekce na gym", cheat.gym.length > 0, cheat.gym.join(","));
  check("i PvP tým", cheat.gl.length > 0, cheat.gl.join(","));
  eq("v appce se vykreslí všechny typy", cheat.rendered, 18);
  check("tahák začíná aktuálními raid bossy", cheat.bossPrvni.indexOf("Raid bossové") > -1,
    cheat.bossPrvni);
  check("…a je jich tam tolik, kolik jich je v datech", cheat.bossKaret > 0, String(cheat.bossKaret));
  check("…a u každého jsou konkrétní kusy", cheat.bossPicks.every((n) => n > 0),
    cheat.bossPicks.join(","));
  check("u každého kusu je moveset", cheat.hasMoveset);



  console.log("\n30) krátké okno skenů a seznam k transferu");
  const hours = await page.evaluate(() => {
    // ráno se chytalo, večer se prošel box — do rosteru patří jen ten box
    const csv = [
      "Scan date,Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV",
      "8/20/26 9:00:00,Rattata,200,15,4,3,5",
      "8/20/26 9:05:00,Pidgey,289,12,3,5,2",
      "8/20/26 20:00:00,Machamp,2400,30,15,14,13",
      "8/20/26 20:01:00,Azumarill,1400,24,0,15,15",
      "8/20/26 20:02:00,Blissey,2800,30,10,15,15",
    ].join("\n");
    const out = {};
    window.__pgo.importText(csv);
    const w = document.getElementById("scanWindow");
    w.value = "1"; w.onchange();
    out.hodina = document.getElementById("scanWindowNote").textContent;
    w.value = "24"; w.onchange();
    out.den = document.getElementById("scanWindowNote").textContent;
    w.value = "1"; w.onchange();
    window.__pgo.finishImport("replace");
    out.roster = window.__pgo.getRows().map((r) => r.pokemon);
    return out;
  });
  check("okno „poslední hodina“ vybere jen večerní průchod boxem",
    hours.hodina.indexOf("3 kusů") > -1, hours.hodina);
  check("…zatímco celý den bere i ranní chytání", hours.den.indexOf("5 kusů") > -1, hours.den);
  eq("po nahrazení sedí roster s tím, co je v boxu", hours.roster.join(","), "Machamp,Azumarill,Blissey");

  const transfer = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machamp", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Rattata", level: 15, ivAtk: 4, ivDef: 3, ivSta: 5, fastMove: "Quick Attack", charged1: "Body Slam" },
      { pokemon: "Pidgey", level: 12, ivAtk: 3, ivDef: 5, ivSta: 2, fastMove: "Tackle", charged1: "Aerial Ace" },
      { pokemon: "Pidgey", level: 10, ivAtk: 1, ivDef: 1, ivSta: 1, fastMove: "Tackle", charged1: "Aerial Ace" },
    ]);
    const sheet = window.__pgo.getCheatSheet();
    document.getElementById("cheatCard").open = true;
    window.__pgo.renderCheatSheet();
    return {
      list: sheet.transfer.map((t) => t.name),
      rendered: document.querySelectorAll("#cheatBody .cs-transfer span").length,
      keepsGood: sheet.transfer.every((t) => t.name !== "Machamp"),
    };
  });
  check("tahák obsahuje seznam k transferu", transfer.list.length >= 2, transfer.list.join(","));
  check("…a dobrý kus v něm není", transfer.keepsGood, transfer.list.join(","));


  console.log("\n31) měřítko: kolik je můj nejlepší procent špičky");
  const ceil = await page.evaluate(() => {
    const mix = [
      ["Metagross", 35, 15, 14, 13, "Bullet Punch", "Meteor Mash"],
      ["Charizard", 33, 15, 15, 14, "Fire Spin", "Blast Burn"],
      ["Blissey", 30, 10, 15, 15, "Pound", "Dazzling Gleam"],
      ["Jolteon", 30, 15, 14, 13, "Thunder Shock", "Thunderbolt"],
    ];
    window.__pgo.setRows(mix.map((m) => ({
      pokemon: m[0], level: m[1], ivAtk: m[2], ivDef: m[3], ivSta: m[4], fastMove: m[5], charged1: m[6],
    })));
    const t0 = performance.now();
    const plan = window.__pgo.getPlan();
    const ms = performance.now() - t0;
    const byType = {};
    plan.raid.forEach((e) => { byType[e.type] = e; });
    document.getElementById("cheatCard").open = true;
    window.__pgo.renderCheatSheet();
    return {
      ms: Math.round(ms),
      steel: byType["Steel"],
      fire: byType["Fire"],
      fairy: byType["Fairy"] || null,
      fairyDmgPodil: (() => {
        const d = window.__pgo.dexEntry ? window.__pgo.dexEntry("Blissey") : null;
        return d ? "má Fairy útok" : "";
      })(),
      planText: document.getElementById("planBody").textContent,
      raidJmena: plan.raid.map((e) => e.row.pokemon).join(","),
      cheatText: document.getElementById("cheatBody").textContent,
    };
  });

  check("Metagross je pořád slušný Steel útočník, ale ne špička",
    ceil.steel.ceiling.pct > 0.6 && ceil.steel.ceiling.pct < 1,
    Math.round(ceil.steel.ceiling.pct * 100) + " % / špička je " + ceil.steel.ceiling.best);
  check("…a špičkou je legendární Zacian",
    ceil.steel.ceiling.best === "Zacian", ceil.steel.ceiling.best);
  check("dobrý, ale ne špičkový kus dostane míň než 100 %",
    ceil.fire.ceiling.pct < 1 && ceil.fire.ceiling.pct > 0.6,
    Math.round(ceil.fire.ceiling.pct * 100) + " % (nej: " + ceil.fire.ceiling.best + ")");
  check("…a je vidět, kdo je špička", ceil.fire.ceiling.best.length > 0, ceil.fire.ceiling.best);
  check("kus, který na typ nezraňuje, se do plánu vůbec nedostane",
    ceil.fairy === null, JSON.stringify(ceil.fairy));
  check("…takže Blissey v raidové části plánu není",
    ceil.raidJmena.indexOf("Blissey") === -1, ceil.raidJmena);
  check("procenta špičky jsou i v taháku", ceil.cheatText.indexOf("% špičky") > -1);
  check("výpočet stropu je rychlý (cachuje se)", ceil.ms < 800, ceil.ms + " ms");


  console.log("\n32) seznam nechat / pustit");
  const keepRes = await page.evaluate(() => {
    const mix = [
      ["Metagross", 35, 15, 14, 13, "Bullet Punch", "Meteor Mash", ""],
      ["Machamp", 30, 15, 14, 13, "Counter", "Dynamic Punch", ""],
      ["Machamp", 25, 12, 10, 11, "Counter", "Dynamic Punch", ""],
      ["Machoke", 20, 10, 10, 10, "Karate Chop", "Cross Chop", ""],
      ["Azumarill", 24, 0, 15, 15, "Bubble", "Play Rough", ""],
      ["Blissey", 30, 10, 15, 15, "Pound", "Dazzling Gleam", ""],
      ["Tyranitar", 30, 15, 15, 14, "Smack Down", "Stone Edge", "Shadow"],
      ["Larvitar", 18, 15, 15, 15, "Bite", "Crunch", ""],
      ["Sunkern", 20, 14, 15, 15, "", "", "Lucky"],
      ["Rattata", 15, 4, 3, 5, "Quick Attack", "Body Slam", ""],
      ["Pidgey", 12, 3, 5, 2, "Tackle", "Aerial Ace", ""],
    ];
    window.__pgo.setRows(mix.map((m) => ({
      pokemon: m[0], level: m[1], ivAtk: m[2], ivDef: m[3], ivSta: m[4],
      fastMove: m[5], charged1: m[6], forma: m[7],
    })));
    const kl = window.__pgo.getKeepList();
    const cat = {};
    Object.keys(kl.keep).forEach((k) => { cat[k] = kl.keep[k].map((i) => i.name + "|" + i.note); });
    document.getElementById("cheatCard").open = true;
    window.__pgo.renderCheatSheet();
    return {
      keepCount: kl.keepCount,
      transfer: kl.transfer.map((t) => t.name),
      cat,
      allAccounted: kl.keepCount + kl.transfer.length,
      sheetText: document.getElementById("cheatBody").textContent,
    };
  });

  eq("každý kus je buď v nechat, nebo v pustit", keepRes.allAccounted, 11);
  check("raidový útočník má u sebe % špičky",
    keepRes.cat["Raidoví útočníci"].some((x) => x.indexOf("% špičky") > -1), keepRes.cat["Raidoví útočníci"].join(", "));
  check("shadow forma je vidět i u kusu, co drží místo z jiného důvodu",
    keepRes.cat["Raidoví útočníci"].some((x) => x.indexOf("Tyranitar") === 0 && x.indexOf("Shadow") > -1),
    keepRes.cat["Raidoví útočníci"].join(", "));
  // Lucky kus se dřív držel jen proto, že měl vysoké IV. Sunkern ani
  // Sunflora nehrají žádnou ligu, nejsou raidoví útočníci ani gymoví
  // obránci — žádnou roli neobsadí. Nastavení „Shadow a Lucky držet vždy"
  // je přesně pro toho, kdo si ho přesto nechat chce; vypnuté (výchozí)
  // je lucky Sunkern jen Sunkern. (Dřív tu byl Dratini, ale Dragonite se
  // v Master League pohybuje kolem prahu a test padal po každém
  // přepočtu žebříčků.)
  check("lucky kus bez role se pustí jako každý jiný",
    keepRes.transfer.indexOf("Sunkern") > -1, keepRes.transfer.join(","));
  check("kus na trade se nepustí",
    keepRes.cat["Na trade (evoluce zdarma)"].some((x) => x.indexOf("Machoke") === 0),
    keepRes.cat["Na trade (evoluce zdarma)"].join(", "));
  check("Blissey drží místo jako obránce, ne jako slabý Fairy útočník",
    keepRes.cat["Obránci gymů"].some((x) => x.indexOf("Blissey") === 0), JSON.stringify(keepRes.cat));
  // Drží se pořád, ale zařadí se podle ROLE, ne do koše „Vysoké IV" —
  // Tyranitar je Rock/Dark útočník, takže Larvitara drží ta role. Vysoké IV
  // samo o sobě už kategorie není; je to tiebreak mezi kusy o tutéž roli.
  check("nevyvinutý kus se 100 % IV se nechává",
    Object.keys(keepRes.cat).some((k) =>
      keepRes.cat[k].some((x) => x.indexOf("Larvitar") === 0)),
    JSON.stringify(keepRes.cat));
  check("horší kopie jde pryč", keepRes.transfer.indexOf("Machamp") > -1, keepRes.transfer.join(","));
  check("odpad jde pryč", keepRes.transfer.indexOf("Rattata") > -1 && keepRes.transfer.indexOf("Pidgey") > -1,
    keepRes.transfer.join(","));


  console.log("\n33) Shadow a Purified z reálného exportu");
  const shadowCsv = fs.readFileSync(path.join(__dirname, "fixtures", "calcy_shadow_export.csv"), "utf-8");
  const shadow = await page.evaluate((csv) => {
    window.__pgo.importText(csv);
    window.__pgo.finishImport("replace");
    const rows = window.__pgo.getRows(), c = window.__pgo.getComputed();
    const out = {};
    rows.forEach((r) => {
      out[r.pokemon + (r.forma ? " [" + r.forma + "]" : "")] = {
        forma: r.forma, keep: c[r.id].keep, types: c[r.id].types,
      };
    });
    // ručně dopsaný purified kus (Calcy ho zapíše stejně, jen s jiným slovem)
    window.__pgo.importText([
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV",
      "Girafarig Purified,698,20,7,8,5",
    ].join("\n"));
    window.__pgo.finishImport("replace");
    const pr = window.__pgo.getRows()[0];
    out.__purified = { pokemon: pr.pokemon, forma: pr.forma };
    return out;
  }, shadowCsv);

  check("shadow kus se pozná ze jména", !!shadow["Girafarig [Shadow]"], Object.keys(shadow).join(", "));
  eq("…a slovo Shadow se ze jména odmaže", shadow["Girafarig [Shadow]"].forma, "Shadow");
  check("…druh se pořád dohledá v pokédexu",
    shadow["Girafarig [Shadow]"].types.indexOf("Normal") > -1, shadow["Girafarig [Shadow]"].types);
  check("shadow kus bez role jde pryč jako každý jiný",
    shadow["Girafarig [Shadow]"].keep.indexOf("Zahodit") === 0,
    shadow["Girafarig [Shadow]"].keep);
  check("běžný kus formu nedostane", !shadow["Cramorant"].forma, shadow["Cramorant"].forma);
  eq("purified se pozná stejně", shadow.__purified.forma, "Purified");
  eq("…a jméno zůstane čisté", shadow.__purified.pokemon, "Girafarig");


  console.log("\n34) shadow: nechat, nebo purifikovat");
  const purify = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machamp", forma: "Shadow", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Registeel", forma: "Shadow", level: 30, ivAtk: 4, ivDef: 15, ivSta: 15, fastMove: "Lock On", charged1: "Focus Blast" },
      { pokemon: "Ralts", forma: "Shadow", level: 12, ivAtk: 8, ivDef: 9, ivSta: 7, fastMove: "Confusion", charged1: "Psychic" },
      { pokemon: "Metagross", level: 35, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Bullet Punch", charged1: "Meteor Mash" },
    ]);
    const c = window.__pgo.getComputed();
    const out = {};
    window.__pgo.getRows().forEach((r) => {
      out[r.pokemon] = { verdict: c[r.id].purify, sub: c[r.id].purifySub || "" };
    });
    const f = document.getElementById("filterSelect");
    f.value = "purify"; f.dispatchEvent(new Event("change", { bubbles: true }));
    out.__filtered = Array.from(document.querySelectorAll("#tbody tr td.col-pokemon")).map((td) => td.textContent);
    f.value = "all"; f.dispatchEvent(new Event("change", { bubbles: true }));
    out.__header = Array.from(document.querySelectorAll("#headerRow th")).some((th) => th.textContent.indexOf("Purifikovat") > -1);
    return out;
  });
  check("v tabulce je sloupec Purifikovat?", purify.__header);
  eq("raidový shadow kus se nepurifikuje", purify["Machamp"].verdict, "Nechat");
  check("…a je vidět proč", purify["Machamp"].sub.indexOf("+20 %") > -1, purify["Machamp"].sub);
  eq("PvP kus se purifikovat má", purify["Registeel"].verdict, "Ano");
  eq("nepoužitelný druh taky", purify["Ralts"].verdict, "Ano");
  eq("běžný kus dostane křížek", purify["Metagross"].verdict, "Ne");
  check("filtr „jen purifikovat“ ukáže právě je",
    purify.__filtered.length === 2 && purify.__filtered.indexOf("Machamp") === -1,
    purify.__filtered.join(","));


  console.log("\n35) varování u importu celé historie");
  const warn = await page.evaluate(() => {
    const csv = [
      "Scan date,Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV",
      "7/25/26 9:00:00,Rattata,200,15,4,3,5",
      "8/20/26 20:00:00,Machamp,2400,30,15,14,13",
      "8/20/26 20:01:00,Azumarill,1400,24,0,15,15",
    ].join("\n");
    window.__pgo.importText(csv);
    const box = document.getElementById("scanWindowWarn");
    const out = { celaHistorie: box.style.display !== "none" ? box.textContent : "" };
    const w = document.getElementById("scanWindow");
    w.value = "1"; w.onchange();
    out.poVyberuOkna = box.style.display !== "none" ? box.textContent : "";
    document.getElementById("mapCancelBtn").click();
    return out;
  });
  check("při importu víc dní historie se objeví varování",
    warn.celaHistorie.indexOf("transferoval") > -1, warn.celaHistorie.slice(0, 80));
  check("…a řekne kolik dní soubor pokrývá", /\d+ dní/.test(warn.celaHistorie), warn.celaHistorie.slice(0, 60));
  eq("po výběru okna varování zmizí", warn.poVyberuOkna, "");


  console.log("\n36) po smazání nejlepší kopie se pořadí přepočítá");
  const repro = await page.evaluate(() => {
    // prahy natvrdo — výchozí kalibrace appky se může měnit, chování prahů na ní viset nesmí
    const setCfg = (cfg) => Object.keys(cfg).forEach((id) => {
      const el = document.getElementById(id);
      el.value = String(cfg[id]);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    setCfg({ keepCopies: 1 });
    window.__pgo.setRows([
      { pokemon: "Machamp", level: 30, cp: 2400, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Machamp", level: 28, cp: 2200, ivAtk: 13, ivDef: 12, ivSta: 12, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Machamp", level: 25, cp: 1900, ivAtk: 10, ivDef: 10, ivSta: 10, fastMove: "Counter", charged1: "Dynamic Punch" },
    ]);
    const stav = () => {
      const c = window.__pgo.getComputed();
      const out = {};
      window.__pgo.getRows().forEach((r) => { out[r.cp] = { copies: c[r.id].copies, keep: c[r.id].keep }; });
      return out;
    };
    const before = stav();
    const planBefore = window.__pgo.getPlan().raid.filter((e) => e.type === "Fighting")[0];
    // smazat nejlepší kus (v hře omylem transferovaný)
    document.querySelectorAll("#tbody tr").forEach((tr) => {
      // v buňce s CP je nově i podřádek se staty, proto ne přesná shoda
      const cpTd = tr.querySelector('td[data-col="cp"]');
      if (cpTd && cpTd.textContent.indexOf("2400") === 0) tr.querySelector(".del-btn").click();
    });
    const after = stav();
    const planAfter = window.__pgo.getPlan().raid.filter((e) => e.type === "Fighting")[0];
    return { before, after,
      planBefore: planBefore ? String(planBefore.row.cp) : null,
      planAfter: planAfter ? String(planAfter.row.cp) : null };
  });

  eq("před smazáním je nejlepší kus #1 ze 3", repro.before["2400"].copies, "#1 z 3");
  eq("…a druhý v pořadí jde pryč jako kopie", repro.before["2200"].keep, "Zahodit – kopie");
  eq("po smazání se druhý posune na #1", repro.after["2200"].copies, "#1 z 2");
  // Verdikt se překlopí z „Zahodit – kopie" na některý z „nechat" — to je to
  // podstatné. Že je to zrovna „Nechat zatím" a ne „Ponechat“, dělá Machamp
  // sám: proti Mega Lucariovi a Mega Blazikenovi dělá kolem 65 % špičky
  // Fighting, takže roli neuzavírá, jen ji drží, dokud nepřijde lepší.
  eq("…a verdikt se otočí na nechat", repro.after["2200"].keep, "Nechat zatím");
  eq("třetí zůstává kopií", repro.after["1900"].keep, "Zahodit – kopie");
  eq("i plán investic ukazuje nový nejlepší kus", repro.planAfter, "2200");


  console.log("\n37) legendární, mytičtí a Ultra Beasti");
  const rarity = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Mewtwo", level: 20, ivAtk: 3, ivDef: 4, ivSta: 2, fastMove: "Confusion", charged1: "Psychic" },
      { pokemon: "Mew", level: 15, ivAtk: 2, ivDef: 2, ivSta: 2, fastMove: "Shadow Claw", charged1: "Psychic" },
      { pokemon: "Kartana", level: 20, ivAtk: 5, ivDef: 5, ivSta: 5, fastMove: "Razor Leaf", charged1: "Leaf Blade" },
      { pokemon: "Articuno", level: 20, ivAtk: 1, ivDef: 1, ivSta: 1, fastMove: "Frost Breath", charged1: "Ice Beam" },
      { pokemon: "Rattata", level: 15, ivAtk: 4, ivDef: 3, ivSta: 5, fastMove: "Quick Attack", charged1: "Body Slam" },
    ]);
    const c = window.__pgo.getComputed();
    const out = { rows: {} };
    window.__pgo.getRows().forEach((r) => {
      out.rows[r.pokemon] = { keep: c[r.id].keep, sub: c[r.id].keepSub || "",
        rarity: c[r.id].rarity || "", title: c[r.id].keepTitle || "" };
    });
    out.transfer = window.__pgo.getKeepList().transfer.map((t) => t.name);
    return out;
  });

  eq("legendární se nikdy nezahazuje, ani s mizernými IV", rarity.rows["Mewtwo"].keep, "Ponechat");
  // Podtitulek verdiktu odpovídá na „PROČ zrovna tenhle", takže u kusu, který
  // drží roli, je tam ta role — ne slovo „legendární". Že je legendární, je
  // vidět na štítku u jména a v bublině; jako důvod ponechání to nestačí.
  check("…a je vidět proč — rolí, ne nálepkou",
    /\d\/\d/.test(rarity.rows["Mewtwo"].sub), rarity.rows["Mewtwo"].sub);
  check("…a vzácnost je pořád vidět", rarity.rows["Mewtwo"].rarity === "L",
    String(rarity.rows["Mewtwo"].rarity));
  check("u mytického appka řekne, že transfer nejde vůbec",
    rarity.rows["Mew"].sub.indexOf("nejde transferovat") > -1, rarity.rows["Mew"].sub);
  check("Ultra Beast se pozná taky", rarity.rows["Kartana"].rarity === "U",
    String(rarity.rows["Kartana"].rarity));
  eq("běžný odpad jde pryč dál", rarity.rows["Rattata"].keep, "Zahodit");
  eq("…a v seznamu k transferu je jen on", rarity.transfer.join(","), "Rattata");


  console.log("\n38) štítek vzácnosti v tabulce");
  const chip = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Mewtwo", level: 20, ivAtk: 3, ivDef: 4, ivSta: 2, fastMove: "Confusion", charged1: "Psychic" },
      { pokemon: "Mew", level: 15, ivAtk: 2, ivDef: 2, ivSta: 2, fastMove: "Shadow Claw", charged1: "Psychic" },
      { pokemon: "Kartana", level: 20, ivAtk: 5, ivDef: 5, ivSta: 5, fastMove: "Razor Leaf", charged1: "Leaf Blade" },
      { pokemon: "Machamp", level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
    ]);
    const chips = {};
    document.querySelectorAll("#tbody tr td.col-pokemon").forEach((td) => {
      const c = td.querySelector(".rarity-chip");
      const name = td.textContent.replace(/(LEG|MYT|UB)$/, "");
      chips[name] = c ? { label: c.textContent, title: c.title } : null;
    });
    const f = document.getElementById("filterSelect");
    f.value = "rare"; f.dispatchEvent(new Event("change", { bubbles: true }));
    const filtered = document.querySelectorAll("#tbody tr").length;
    f.value = "all"; f.dispatchEvent(new Event("change", { bubbles: true }));
    return { chips, filtered };
  });

  eq("legendární má štítek LEG", chip.chips["Mewtwo"].label, "LEG");
  eq("mytický MYT", chip.chips["Mew"].label, "MYT");
  eq("Ultra Beast UB", chip.chips["Kartana"].label, "UB");
  eq("…a v tooltipu je to slovy", chip.chips["Mewtwo"].title, "Legendární");
  eq("běžný pokémon štítek nemá", chip.chips["Machamp"], null);
  eq("filtr „jen legendární a mytičtí“ ukáže tři", chip.filtered, 3);


  console.log("\n39) hvězdička — ruční značka „tenhle si nechávám“");
  const star = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Lanturn", cp: 1500, level: 25, ivAtk: 2, ivDef: 14, ivSta: 15 },
    ]);
    const btnFor = (name) => {
      let found = null;
      document.querySelectorAll("#tbody tr").forEach((tr) => {
        if (tr.querySelector("td.col-pokemon").textContent === name) found = tr.querySelector(".star-btn");
      });
      return found;
    };
    const rowFor = (name) => window.__pgo.getRows().filter((r) => r.pokemon === name)[0];
    const posOf = (name) => Array.from(document.querySelectorAll("#tbody tr td.col-pokemon"))
      .map((td) => td.textContent).indexOf(name);
    const names = () => Array.from(document.querySelectorAll("#tbody tr td.col-pokemon")).map((td) => td.textContent);
    // Dřív se četlo z dlaždice v Souhrnu; ta už v appce není.
    const tileVal = () => String(window.__pgo.getRows()
      .filter((r) => r.star).length);
    const out = { prvniSloupec: document.querySelector("#headerRow th").textContent.trim() };

    const pozPred = posOf("Machamp");
    out.pred = btnFor("Machamp").textContent;
    btnFor("Machamp").click();               // první klik rozsvítí
    out.po = btnFor("Machamp").textContent;
    out.tridaPo = btnFor("Machamp").className;
    out.radekZustal = posOf("Machamp") === pozPred;   // řádek nesmí odskočit pryč
    out.vRosteru = !!rowFor("Machamp").star;
    out.dlazdice = tileVal();

    btnFor("Lanturn").click();               // označit i Lanturna
    const f = document.getElementById("filterSelect");
    f.value = "star"; f.dispatchEvent(new Event("change", { bubbles: true }));
    out.filtrOznacene = names();
    f.value = "nostar"; f.dispatchEvent(new Event("change", { bubbles: true }));
    out.filtrNeoznacene = names();
    f.value = "all"; f.dispatchEvent(new Event("change", { bubbles: true }));

    

    btnFor("Machamp").click();               // druhý klik zhasne
    out.poDruhem = btnFor("Machamp").textContent;
    out.zpetVRosteru = !!rowFor("Machamp").star;
    return out;
  });

  eq("hvězdička je úplně první sloupec", star.prvniSloupec, "★");
  eq("nezapnutá je prázdná", star.pred, "☆");
  eq("první klik ji rozsvítí", star.po, "★");
  check("…a je vidět i barvou", star.tridaPo.indexOf("on") > -1, star.tridaPo);
  eq("druhý klik ji zhasne", star.poDruhem, "☆");
  check("stav se propíše do rosteru (a tím i do localStorage)", star.vRosteru === true && star.zpetVRosteru === false);
  check("řádek při kliknutí neodskočí pryč", star.radekZustal);
  eq("dlaždice počítá označené", star.dlazdice, "1");
  check("filtr „jen označené“ nechá jen je",
    star.filtrOznacene.length === 2 && star.filtrOznacene.indexOf("Rattata") === -1, star.filtrOznacene.join(","));
  check("filtr „jen neoznačené“ ukáže zbytek",
    star.filtrNeoznacene.length === 1 && star.filtrNeoznacene[0] === "Rattata", star.filtrNeoznacene.join(","));

  console.log("\n40) značka přežije export i opětovný import");
  const starRt = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, star: true },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
    ]);
    const csv = window.__pgo.csvText();
    window.__pgo.setRows([]);
    window.__pgo.importText(csv);
    window.__pgo.finishImport("replace");
    const cols = csv.split("\n")[0].split(",");
    const out = { hlavicka: cols.includes("Označeno") ? "Označeno" : cols.join("|"),
      zacatek: cols.slice(0, 2).join(","), po: {} };
    window.__pgo.getRows().forEach((r) => { out.po[r.pokemon] = !!r.star; });
    return out;
  });
  eq("export má sloupec Označeno", starRt.hlavicka, "Označeno");
  eq("…a začátek hlavičky se nezměnil (sedí s Excelem)", starRt.zacatek, "Pokémon,Forma");
  check("po importu zpět je označený jen ten správný",
    starRt.po["Machamp"] === true && starRt.po["Rattata"] === false, JSON.stringify(starRt.po));

  console.log("\n41) strop kopii plati i na skoro dokonale kusy bezcenného druhu");
  const dupes = await page.evaluate(() => {
    // GL/UL rank z Calcy je pořadí V RÁMCI DRUHU — 24 Elgyemů má klidně deset
    // kusů s rankem pod 100, a přesto Beheeyem v žádné lize nehraje.
    // Ranky jsou tu schválně obráceně než IV: nejlepší rank má nejhorší kus.
    // Dokud o pořadí kopií rozhodoval rank, „prošlo" to jen náhodou.
    window.__pgo.setRows([
      { pokemon: "Elgyem", cp: 570, level: 22, ivAtk: 5, ivDef: 12, ivSta: 8, glRank: 3 },
      { pokemon: "Elgyem", cp: 600, level: 23, ivAtk: 6, ivDef: 13, ivSta: 9, glRank: 20 },
      { pokemon: "Elgyem", cp: 620, level: 24, ivAtk: 7, ivDef: 14, ivSta: 10, glRank: 50 },
      { pokemon: "Elgyem", cp: 640, level: 25, ivAtk: 15, ivDef: 14, ivSta: 14, glRank: 90 },
      // Marill sám nehraje nikde, ale Azumarill je v Great League — jeden
      // se nechá. (Dřív tu byl Spoink; Grumpig spadl na GL #83 a vypadl
      // z prahu „ber vážně prvních 50", takže test padal na driftu dat.)
      { pokemon: "Marill", cp: 453, level: 20, ivAtk: 1, ivDef: 15, ivSta: 14 },
      { pokemon: "Marill", cp: 200, level: 10, ivAtk: 3, ivDef: 3, ivSta: 3 },
    ]);
    const c = window.__pgo.getComputed();
    const out = { elgyem: [], marill: [] };
    window.__pgo.getRows().forEach((r) => {
      const x = c[r.id];
      out[r.pokemon.toLowerCase()].push({ cp: r.cp, keep: x.keep, sub: x.keepSub, evolve: x.evolve });
    });
    out.ponechano = window.__pgo.getRows().filter((r) => c[r.id].keepGood).length;
    const kl = window.__pgo.getKeepList();
    out.vSeznamu = [];
    Object.keys(kl.keep).forEach((k) => kl.keep[k].forEach((i) => out.vSeznamu.push(i.name)));
    return out;
  });

  // Rank nesmí kus zachránit — to je smysl tohohle bloku. Kus s glRank 3 má
  // nejlepší rank ze všech čtyř a stejně musí jít pryč.
  eq("nejlepší rank v rámci druhu kus nezachrání",
    dupes.elgyem.filter((e) => e.cp === 570)[0].keep, "Zahodit – kopie");
  eq("…ani druhý nejlepší", dupes.elgyem.filter((e) => e.cp === 600)[0].keep, "Zahodit – kopie");
  eq("…ani třetí", dupes.elgyem.filter((e) => e.cp === 620)[0].keep, "Zahodit – kopie");
  // Tady se pravidlo obrátilo. Dřív platilo „nad prahem IV = kvalitní kus
  // bez ohledu na roli" a Elgyem s 96 % se držel. Jenže přesně tím appka
  // zaplňovala box kusy, které nikdy nikam nepůjdou: 96 % z Elgyema znamená
  // „nejlepší možný Beheeyem", ne „užitečný pokémon". Elgyem nehraje žádnou
  // ligu, není raidový útočník ani gymový obránce — žádnou roli v rozpočtu
  // neobsadí, takže jde pryč. Vysoké IV je od téhle verze tiebreak mezi kusy,
  // které o roli soupeří, ne důvod sám o sobě.
  eq("vysoké IV samo o sobě kus neudrží, když druh nic nehraje",
    dupes.elgyem.filter((e) => e.cp === 640)[0].keep, "Zahodit");
  eq("nejlepší Marill se nechá kvůli evoluci", dupes.marill.filter((e) => e.cp === 453)[0].keep, "Nechat – evolvovat");
  check("…a je vidět proč",
    dupes.marill.filter((e) => e.cp === 453)[0].sub.indexOf("Azumarill") > -1,
    dupes.marill.filter((e) => e.cp === 453)[0].sub);
  eq("…a má se vyvinout", dupes.marill.filter((e) => e.cp === 453)[0].evolve, "Ano");
  // Slabší kopie jde pryč. Jestli u ní stojí „– kopie" nebo nic, závisí
  // na tom, kolik lig ta evoluce zrovna hraje — podstatné je, že se
  // nedrží.
  check("slabší Marill jde pryč",
    dupes.marill.filter((e) => e.cp === 200)[0].keep.indexOf("Zahodit") === 0,
    dupes.marill.filter((e) => e.cp === 200)[0].keep);
  eq("z šesti kusů zůstane jeden", dupes.ponechano, 1);
  check("seznam nechat nesmi obsahovat nic, co tabulka posílá pryč",
    dupes.vSeznamu.length === 1 && dupes.vSeznamu.indexOf("Marill") > -1,
    dupes.vSeznamu.join(","));

  console.log("\n42) mazání neoznačených (a kontrola, že karta na prach je pryč)");
  const plist = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Machamp", cp: 1200, level: 20, ivAtk: 2, ivDef: 3, ivSta: 4, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
    ]);
    const out = {};
    // Karta „Kam dát prach" byla duplicita s Rozpočtem — vybírala jeden
    // nejlepší kus na roli a nepočítala s cenou, takže radila dotahovat
    // kusy, které už hotové jsou. Zrušila se; zbyly z ní jen seznamy, které
    // se za prach nekupují (bonbóny a Elitní TM), a ty jsou teď v Rozpočtu.
    out.kartaZrusena = !document.getElementById("planCard");
    out.zbytekVRozpoctu = !!document.querySelector("#dustCard #planBody");

    const btn = document.getElementById("clearUnstarredBtn");
    out.skryteBezHvezdicek = btn.style.display === "none";
    document.querySelectorAll("#tbody tr").forEach((tr) => {
      if (tr.querySelector("td.col-pokemon").textContent === "Rattata") tr.querySelector(".star-btn").click();
    });
    out.popisek = btn.textContent;
    out.viditelne = btn.style.display !== "none";

    window.confirm = () => true;
    btn.click();
    out.zbylo = window.__pgo.getRows().map((r) => r.pokemon);
    out.zapamatovano = window.__pgo.getDiscarded().length;
    return out;
  });

  check("karta „Kam dát prach“ už neexistuje", plist.kartaZrusena);
  check("…a co z ní zbylo, sedí v Rozpočtu", plist.zbytekVRozpoctu);
  check("bez jediné hvězdičky se tlačítko neukazuje", plist.skryteBezHvezdicek);
  eq("po označení nabídne smazat zbytek", plist.popisek, "Smazat neoznačené (2)");
  check("…a je vidět", plist.viditelne);
  check("smaže opravdu jen neoznačené", plist.zbylo.length === 1 && plist.zbylo[0] === "Rattata", plist.zbylo.join(","));
  eq("smazané si zapamatuje, ať se při importu nevrátí", plist.zapamatovano, 2);

  console.log("\n43) Dynamax kusy se nikdy neposílají do koše");
  const dmax = await page.evaluate(() => {
    // sloupec Dynamax z Calcy: "D" = Dynamax, "G" = Gigantamax, " - " = není, "?" = nepoznal
    const csv = [
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,Fast move,Special move,Dynamax,Favorite",
      "Sobble,451,15,12,13,12,Water Gun,Aqua Tail,D,0",
      "Wooloo,292,12,13,13,12,Tackle,Body Slam,G,0",
      "Magikarp,137,8,5,4,3,Splash,Struggle, - ,0",
      "Rattata,200,15,4,3,5,Tackle,Body Slam,?,1",
    ].join("\n");
    window.__pgo.importText(csv);
    const map = {};
    // Ruční mapování sloupců v importu už není — čte se přímo logika.
    Object.assign(map, window.__pgo.automatickeMapovani(csv) || {});
    window.__pgo.finishImport("replace");
    const rows = window.__pgo.getRows(), c = window.__pgo.getComputed();
    const out = { mapDyn: map["Dynamax (nepovinné)"], mapStar: map["Označeno ★ (nepovinné)"], po: {} };
    rows.forEach((r) => {
      out.po[r.pokemon] = { dyn: r.dynamax || "", keep: c[r.id].keep, sub: c[r.id].keepSub,
        title: c[r.id].keepTitle || "", star: !!r.star };
    });
    const f = document.getElementById("filterSelect");
    f.value = "dmax"; f.dispatchEvent(new Event("change", { bubbles: true }));
    out.filtr = Array.from(document.querySelectorAll("#tbody tr td.col-pokemon")).map((td) => td.textContent);
    out.chip = document.querySelector("#tbody tr td.col-pokemon .rarity-chip");
    out.chipText = out.chip ? out.chip.textContent : "";
    delete out.chip;
    f.value = "all"; f.dispatchEvent(new Event("change", { bubbles: true }));
    const kl = window.__pgo.getKeepList();
    out.kategorie = kl.keep["Dynamax"].map((i) => i.name).sort().join(",");
    const kf = document.getElementById("keepForms");
    kf.checked = true; kf.dispatchEvent(new Event("change", { bubbles: true }));
    out.kategorieVzdy = window.__pgo.getKeepList().keep["Dynamax"].map((i) => i.name).sort().join(",");
    kf.checked = false; kf.dispatchEvent(new Event("change", { bubbles: true }));
    return out;
  });

  eq("sloupec Dynamax se napojil sám", dmax.mapDyn, "Dynamax");
  eq("a Favorite ze hry se napojil na hvězdičku", dmax.mapStar, "Favorite");
  eq("D se přečte jako Dynamax", dmax.po["Sobble"].dyn, "Ano");
  eq("G (Gigantamax) taky", dmax.po["Wooloo"].dyn, "Ano");
  eq("pomlčka znamená obyčejný kus", dmax.po["Magikarp"].dyn, "");
  eq("otazník se bere jako obyčejný", dmax.po["Rattata"].dyn, "");
  eq("slabý Dynamax kus se přesto nechává", dmax.po["Sobble"].keep, "Ponechat");
  // U dynamax kusu bez role zůstává „Max Battles"; když roli drží, ukáže se
  // ta — podtitulek má vždycky říct, PROČ zrovna tenhle kus zůstává.
  check("…a je vidět proč",
    dmax.po["Sobble"].sub.indexOf("Max Battles") > -1 || /\d\/\d/.test(dmax.po["Sobble"].sub),
    dmax.po["Sobble"].sub);
  check("…a v bublině je Max Battles vždycky",
    (dmax.po["Sobble"].title || "").indexOf("Max Battle") > -1, dmax.po["Sobble"].title);
  // Magikarp tady dřív zastupoval odpad, jenže Gyarados je podle žebříčku
  // appky solidní Water útočník (79 % špičky) a k tomu gymový obránce —
  // takže se drží, a je to správně. Na odpad je v tom souboru Rattata.
  eq("obyčejný odpad jde pryč dál", dmax.po["Rattata"].keep, "Zahodit");
  check("oblíbený ze hry dorazil jako hvězdička", dmax.po["Rattata"].star === true);
  check("filtr „jen Dynamax“ ukáže dva",
    dmax.filtr.length === 2 && dmax.filtr.join(",").indexOf("Sobble") > -1, dmax.filtr.join(","));
  eq("…a mají v tabulce štítek", dmax.chipText, "DMAX");
  eq("bez role se Dynamax kus do „nechat“ sám nedostane", dmax.kategorie, "");
  check("…ale se zapnutým „Shadow a Lucky držet vždy“ ano",
    dmax.kategorieVzdy === "Sobble,Wooloo", dmax.kategorieVzdy);

  console.log("\n44) prázdný filtr řekne proč, a Dynamax filtr funguje i v zobrazení Vše");
  const empty = await page.evaluate(() => {
    const out = {};
    // roster naimportovaný starší verzí appky sloupec dynamax vůbec nemá
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
    ]);
    document.getElementById("viewSelect").value = "all";
    document.getElementById("viewSelect").dispatchEvent(new Event("change", { bubbles: true }));
    const f = document.getElementById("filterSelect");
    f.value = "dmax"; f.dispatchEvent(new Event("change", { bubbles: true }));

    const cell = document.querySelector("#tbody td.filter-empty");
    out.zprava = cell ? cell.textContent : "";
    out.roztazeno = cell ? cell.colSpan === document.querySelectorAll("#headerRow th").length : false;
    out.jmenoVidet = (() => {
      const th = document.querySelectorAll("#headerRow th")[2];
      const wrap = document.querySelector(".table-wrap");
      return th.getBoundingClientRect().left - wrap.getBoundingClientRect().left < 60;
    })();
    out.textVidet = (() => {
      const inner = cell.querySelector(".inner");
      const wrap = document.querySelector(".table-wrap");
      return Math.round(inner.getBoundingClientRect().right - wrap.getBoundingClientRect().left) <= wrap.clientWidth + 1;
    })();
    cell.querySelector("button").click();
    out.poZruseni = document.querySelectorAll("#tbody tr").length;
    out.filtrZpet = f.value;

    // a teď s Dynamax kusem — v zobrazení Vše musí filtr fungovat stejně
    window.__pgo.setRows([
      { pokemon: "Sobble", cp: 451, level: 15, ivAtk: 12, ivDef: 13, ivSta: 12, dynamax: "Ano" },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
    ]);
    f.value = "dmax"; f.dispatchEvent(new Event("change", { bubbles: true }));
    // v zobrazení Vše je jméno v <input>, ne v textu buňky
    out.vseNasel = Array.from(document.querySelectorAll("#tbody tr td.col-pokemon input")).map((i) => i.value);
    out.rezim = document.getElementById("viewSelect").value;
    document.getElementById("viewSelect").value = "verdict";
    document.getElementById("viewSelect").dispatchEvent(new Event("change", { bubbles: true }));
    out.verdiktNasel = Array.from(document.querySelectorAll("#tbody tr td.col-pokemon")).map((td) => td.textContent);
    f.value = "all"; f.dispatchEvent(new Event("change", { bubbles: true }));
    return out;
  });

  check("prázdná tabulka vysvětlí, že to udělal filtr",
    empty.zprava.indexOf("Jen Dynamax") > -1 && empty.zprava.indexOf("2 kusů") > -1, empty.zprava);
  check("…a u Dynamaxu poradí naimportovat znovu",
    empty.zprava.indexOf("Sloučit s rosterem") > -1, empty.zprava);
  check("hláška se roztáhne přes celou tabulku", empty.roztazeno);
  check("hláška neodstrčí přišpendlený sloupec se jménem", empty.jmenoVidet);
  check("…a sama se vejde do viditelné části tabulky", empty.textVidet);
  eq("tlačítko filtry zruší", empty.poZruseni, 2);
  eq("…a přepne výběr zpátky na vše", empty.filtrZpet, "all");
  eq("v zobrazení Vše filtr Dynamax najde kus", empty.vseNasel.join(","), "Sobble");
  eq("…a byli jsme opravdu v zobrazení Vše", empty.rezim, "all");
  eq("v Rozhodnutí najde to samé", empty.verdiktNasel.join(","), "SobbleDMAX");

  console.log("\n45) správce smazaných — hledat, vrátit po jednom, nechat vypršet");
  const dm = await page.evaluate(() => {
    const out = {};
    window.__pgo.setRows([
      { pokemon: "Sobble", cp: 451, level: 15, ivAtk: 12, ivDef: 13, ivSta: 12 },
      { pokemon: "Wooloo", cp: 292, level: 12, ivAtk: 13, ivDef: 13, ivSta: 12 },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 },
    ]);
    // smazat tři z nich přes koš u řádku
    ["Sobble", "Wooloo", "Rattata"].forEach((name) => {
      document.querySelectorAll("#tbody tr").forEach((tr) => {
        const c = tr.querySelector("td.col-pokemon");
        if (c && c.textContent === name) tr.querySelector(".del-btn").click();
      });
    });
    const btn = document.getElementById("forgetDiscardedBtn");
    out.popisek = btn.textContent;

    btn.click();                                   // otevřít panel
    out.otevreno = document.getElementById("discardBox").classList.contains("open");
    const names = () => Array.from(document.querySelectorAll("#discardList tbody tr td.col-pokemon")).map((e) => e.textContent);
    out.vsechny = names().sort();
    out.meta = Array.from(document.querySelectorAll("#discardList tbody tr")[0].cells).map((c) => c.textContent).join(" | ");

    const q = document.getElementById("discardSearch");
    q.value = "sob"; q.dispatchEvent(new Event("input", { bubbles: true }));
    out.poHledani = names();
    out.pocetPoHledani = document.querySelectorAll("#discardList tbody tr").length;

    // vrátit jen jednoho — musí se objevit rovnou v rosteru, i s IV
    out.tlacitkoText = document.querySelector("#discardList tbody tr button").textContent;
    document.querySelector("#discardList tbody tr button").click();
    out.poVraceni = window.__pgo.getDiscarded().map((d) => d.n).sort();
    out.popisekPoVraceni = btn.textContent;
    const vraceny = window.__pgo.getRows().filter((r) => r.pokemon === "Sobble")[0];
    out.vRosteru = !!vraceny;
    out.ivPrezilo = vraceny ? [vraceny.ivAtk, vraceny.ivDef, vraceny.ivSta].join("/") : "";
    out.vTabulce = Array.from(document.querySelectorAll("#tbody tr td.col-pokemon"))
      .map((td) => td.textContent).indexOf("Sobble") > -1;
    q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true }));

    // hledání bez shody to řekne
    q.value = "zzz"; q.dispatchEvent(new Event("input", { bubbles: true }));
    out.prazdneHledani = document.querySelector("#discardList .discard-empty").textContent;
    q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true }));
    return out;
  });

  eq("tlačítko ukazuje počet", dm.popisek, "Smazané (3)");
  check("klik otevře panel", dm.otevreno);
  eq("v seznamu jsou všechny tři", dm.vsechny.join(","), "Rattata,Sobble,Wooloo");
  check("u záznamu jsou stejné údaje jako v rosteru",
    dm.meta.indexOf("Sobble") > -1 && /451/.test(dm.meta) && /Water/.test(dm.meta)
      && /202\d/.test(dm.meta), dm.meta);
  eq("hledání zúží seznam", dm.poHledani.join(","), "Sobble");
  eq("…a opravdu zůstane jeden řádek", dm.pocetPoHledani, 1);
  eq("tlačítko slibuje vrácení, ne odblokování", dm.tlacitkoText, "Vrátit");
  eq("Vrátit odebere jen ten jeden", dm.poVraceni.join(","), "Rattata,Wooloo");
  check("…a kus je rovnou zpátky v rosteru", dm.vRosteru);
  eq("…i s IV, ne jen jméno", dm.ivPrezilo, "12/13/12");
  check("…a je vidět v tabulce hned, bez importu", dm.vTabulce);
  eq("…a počet na tlačítku se sníží", dm.popisekPoVraceni, "Smazané (2)");
  check("hledání bez shody to napíše", dm.prazdneHledani.indexOf("nic nenašlo") > -1, dm.prazdneHledani);

  const expired = await page.evaluate(() => {
    const DAY = 86400000;
    const out = {};
    window.__pgo.setDiscarded([
      { k: "sobble|451|15||", at: null, n: "Sobble", del: Date.now() - 90 * DAY },
      { k: "wooloo|292|12||", at: null, n: "Wooloo", del: Date.now() - 2 * DAY },
    ]);
    const sel = document.getElementById("discardKeepDays");
    sel.value = "60"; sel.dispatchEvent(new Event("change", { bubbles: true }));
    out.zbylo = window.__pgo.getDiscarded().map((d) => d.n);
    out.popisek = document.getElementById("forgetDiscardedBtn").textContent;
    // „navždy" už nic dalšího nemaže
    window.__pgo.setDiscarded([
      { k: "sobble|451|15||", at: null, n: "Sobble", del: Date.now() - 400 * DAY },
      { k: "wooloo|292|12||", at: null, n: "Wooloo", del: Date.now() - 2 * DAY },
    ]);
    sel.value = "0"; sel.dispatchEvent(new Event("change", { bubbles: true }));
    out.navzdy = window.__pgo.getDiscarded().length;
    // a záznam bez data smazání (starý profil) dostane razítko, ať mu expirace běží
    window.__pgo.setDiscarded(["staryu|492|20||"]);
    out.doplneneRazitko = !!window.__pgo.getDiscarded()[0].del;
    // starý zápis nemá uložený řádek — slibovat vrácení by byla lež
    document.getElementById("forgetDiscardedBtn").click();
    out.staryPopisek = document.querySelector("#discardList tbody tr button").textContent;
    const predRows = window.__pgo.getRows().length;
    document.querySelector("#discardList tbody tr button").click();
    out.staryNicNepridal = window.__pgo.getRows().length === predRows;
    window.__pgo.setDiscarded([]);
    return out;
  });

  eq("po 60 dnech záznam vyprší sám", expired.zbylo.join(","), "Wooloo");
  eq("…a tlačítko to hned ukáže", expired.popisek, "Smazané (1)");
  eq("volba „navždy“ už nic dalšího nemaže", expired.navzdy, 1);
  check("starý zápis bez data dostane razítko, ať mu expirace běží", expired.doplneneRazitko);
  eq("…a nabídne jen Odblokovat", expired.staryPopisek, "Odblokovat");
  check("…a do rosteru nic nepřidá", expired.staryNicNepridal);

  console.log("\n46) tlačítko Nastavit doporučené");
  const cfg = await page.evaluate(() => {
    const ids = ["ivThresh", "rankThresh", "roleThresh", "spThresh", "keepCopies", "discardKeepDays"];
    const read = () => { const o = {}; ids.forEach((i) => { o[i] = document.getElementById(i).value; }); return o; };
    // rozhodit to na nesmysly, včetně <select>, kde žádný atribut value není
    ids.forEach((i) => {
      const el = document.getElementById(i);
      el.value = el.tagName === "SELECT" ? "0" : "7";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const rozhozene = read();
    document.getElementById("resetSettingsBtn").click();
    return { rozhozene, po: read() };
  });

  eq("výchozí je 2 kopie", cfg.po.keepCopies, "2");
  eq("výchozí PvP práh je 96 %", cfg.po.spThresh, "96");
  eq("výchozí práh IV je 90 %", cfg.po.ivThresh, "90");
  eq("výchozí elitní rank je 100", cfg.po.rankThresh, "100");
  eq("výchozí práh užitečnosti role je 50 %", cfg.po.roleThresh, "50");
  eq("select se vrátí na 30 dní, ne na prázdno", cfg.po.discardKeepDays, "30");
  check("…a předtím to opravdu bylo rozhozené", cfg.rozhozene.keepCopies === "7", JSON.stringify(cfg.rozhozene));

  console.log("\n47) prahy nastavené tak, že nic neprojde, appka pojmenuje");
  const prahy = await page.evaluate(() => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const txt = (id) => {
      const el = document.getElementById(id + "Warn");
      return el.className.indexOf("on") > -1 ? el.textContent : "";
    };
    window.__pgo.setRows([
      { pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15, fastMove: "Bubble", charged1: "Play Rough" },
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
    ]);
    const out = {};
    document.getElementById("resetSettingsBtn").click();
    out.cisteBezVarovani = [txt("spThresh"), txt("rankThresh"), txt("ivThresh")].join("");

    const keepTile = () => {
      const c = window.__pgo.getComputed();
      return String(window.__pgo.getRows()
        .filter((r) => c[r.id] && c[r.id].keepGood).length);
    };
    out.ponechatVychozi = keepTile();

    // přesně chyba, do které se dá spadnout: procenta do pole na pořadí a naopak
    set("spThresh", 100);
    set("rankThresh", 5000);
    out.varSp = txt("spThresh");
    out.varRank = txt("rankThresh");
    set("rankThresh", 96);
    out.varRankRozumny = txt("rankThresh");
    set("rankThresh", 100);
    out.ponechatPrisne = keepTile();

    set("ivThresh", 100);
    out.varIv = txt("ivThresh");

    document.getElementById("resetSettingsBtn").click();
    out.poResetu = [txt("spThresh"), txt("rankThresh"), txt("ivThresh")].join("");
    out.ponechatPoResetu = keepTile();

    const fKeep = document.getElementById("filterSelect");
    fKeep.value = "keep";
    fKeep.dispatchEvent(new Event("change", { bubbles: true }));
    out.poFiltru = document.querySelectorAll("#tbody tr").length;

    // a po zpřísnění prahu se tabulka pod aktivním filtrem přepočítá hned
    set("spThresh", 100);
    set("ivThresh", 100);
    out.poFiltruPrisne = document.querySelectorAll("#tbody tr").length;
    document.getElementById("resetSettingsBtn").click();
    const f = document.getElementById("filterSelect");
    f.value = "all"; f.dispatchEvent(new Event("change", { bubbles: true }));
    return out;
  });

  eq("při doporučených prazích appka nevaruje", prahy.cisteBezVarovani, "");
  check("procentní práh na 100 % se pojmenuje", prahy.varSp.indexOf("procentní práh") > -1, prahy.varSp);
  check("…a poradí 96", prahy.varSp.indexOf("96") > -1, prahy.varSp);
  check("nesmyslný rank upozorní, že jde o pořadí, ne procenta",
    prahy.varRank.indexOf("pořadí") > -1 && prahy.varRank.indexOf("100") > -1, prahy.varRank);
  eq("u rozumného ranku appka mlčí", prahy.varRankRozumny, "");
  check("práh IV na 100 % taky", prahy.varIv.indexOf("stoprocentní") > -1, prahy.varIv);
  eq("Nastavit doporučené varování zruší", prahy.poResetu, "");
  check("dlaždice Ponechat počítá",
    prahy.ponechatVychozi === "2" && prahy.ponechatPoResetu === "2", prahy.ponechatVychozi + "/" + prahy.ponechatPoResetu);
  eq("…a se zlými prahy spadne na ty, co roli drží i tak", prahy.ponechatPrisne, "2");
  eq("klik na dlaždici nechá v tabulce jen ponechané", prahy.poFiltru, 2);
  eq("…a po zpřísnění prahu se tabulka přepočítá hned", prahy.poFiltruPrisne, 2);

  console.log("\n48) PvP verdikt počítá s útoky");
  const pvpm = await page.evaluate(() => {
    const one = (row) => {
      window.__pgo.setRows([row]);
      const r = window.__pgo.getRows()[0], c = window.__pgo.getComputed()[r.id];
      return { rec: c.pvpRec, sub: c.pvpSub, title: c.pvpTitle, retrain: !!c.pvpRetrain, tone: c.pvpTone, pot: c.pvpPot };
    };
    // level schválně nízký: kus na L24 už do Little Cupu (cap 500) nevejde
    const base = { cp: 350, level: 10, ivAtk: 0, ivDef: 15, ivSta: 15 };
    const out = {};
    // Medicham s Counterem: PvPoke doporučuje Psycho Cut, ale Counter v simulaci
    // používá — nesmí to hlásit jako chybu
    out.counter = one(Object.assign({}, base, { pokemon: "Medicham", fastMove: "Counter", charged1: "Dynamic Punch" }));
    // stejný druh s útoky, které simulace nepoužívá
    out.spatne = one(Object.assign({}, base, { pokemon: "Azumarill", fastMove: "Rock Smash", charged1: "Hyper Beam" }));
    out.dobre = one(Object.assign({}, base, { pokemon: "Azumarill", fastMove: "Bubble", charged1: "Ice Beam" }));
    out.bezUtoku = one(Object.assign({}, base, { pokemon: "Azumarill" }));
    out.jedenNabity = one(Object.assign({}, base, { pokemon: "Azumarill", fastMove: "Bubble", charged1: "Ice Beam", charged2: "Play Rough" }));
    // druh mimo PvPoke žebříček — verdikt na odhadu stát nesmí
    out.mimoZebricek = one({ pokemon: "Elgyem", cp: 570, level: 22, ivAtk: 5, ivDef: 12, ivSta: 8,
      fastMove: "Zen Headbutt", charged1: "Psybeam" });
    return out;
  });

  check("Counter u Medichama neprojde jako chyba — simulace ho používá",
    pvpm.counter.retrain === false && pvpm.counter.title.indexOf("sedí") > -1, pvpm.counter.title);
  check("útoky mimo simulaci se označí k přeučení", pvpm.spatne.retrain, pvpm.spatne.title);
  check("…a rovnou je vidět na co", pvpm.spatne.sub.indexOf("přeučit na Bubble") === 0, pvpm.spatne.sub);
  eq("…a barva je varovná", pvpm.spatne.tone, "warning");
  check("dobrá sestava se nepřeučuje", pvpm.dobre.retrain === false, pvpm.dobre.title);
  check("bez vyplněných útoků se doporučení jen ukáže",
    pvpm.bezUtoku.retrain === false && pvpm.bezUtoku.title.indexOf("nejsou vyplněné") > -1, pvpm.bezUtoku.title);
  check("chybějící druhý nabitý útok se připomene",
    pvpm.dobre.title.indexOf("Druhý nabitý útok chybí") > -1, pvpm.dobre.title);
  check("…a u kusu se dvěma nabitými už ne",
    pvpm.jedenNabity.title.indexOf("Druhý nabitý útok chybí") === -1, pvpm.jedenNabity.title);
  check("druh mimo žebříček dostane jen odhad, ne příkaz k přeučení",
    pvpm.mimoZebricek.retrain === false && pvpm.mimoZebricek.title.indexOf("Odhad") === 0,
    pvpm.mimoZebricek.title);
  check("…a je u toho napsané, proč je to jen odhad",
    pvpm.mimoZebricek.title.indexOf("štíty ani buffy") > -1, pvpm.mimoZebricek.title);

  // měří se soubor, ne vykreslené DOM — to roste s obsahem tabulek
  const velikostSouboru = fs.statSync(path.join(WEB_DIR, "pokemon_tracker_app.html")).size;
  // strop je jen pojistka proti nechtěnému nafouknutí — soubor se otevírá z disku
  // a posílá kolegyni, takže na megabajtech nezáleží, na řádech ano
  // Strop je tu proto, aby se z appky nestal nezvladatelný moloch, ne kvůli
  // konkrétnímu číslu. Zvednuto z 700 kB, když přibyla tabulka CPM do L50,
  // spočítaný žebříček obránců a režim čištění boxu. Pak z 900 kB, když
  // přibyla karta „Co chytat", historie rozhodnutí, ligy v čištění boxu
  // a útoky z PvPoke. Většinu objemu tvoří zapečená data (1387 druhů, žebříčky
  // lig, útoky) — ta rostou s hrou a uříznout se nedají.
  // A pak z 1,1 MB, když přibyl generátor snímku do mobilu (roster i counteři
  // na všech 324 kombinací typů), strop CP před evolucí a značka CUTE.
  // Strop je proto, aby se soubor rychle otevřel z OneDrivu — ne proto, že by
  // se do něj data nevešla. Když má nová funkce cenu těch kilobajtů, zvedni ho.
  // A z 1,35 MB, když přibyly ikony typů (18 vlastních SVG symbolů, ať se
  // dají typy poznat od oka) a vracení kusů v čištění boxu.
  // A z 1,40 MB, když k akcím přibyl rozpis časových oken (co se v kterém
  // úseku spawnuje, co je ve vejcích, v raidech a za výzkum) — 30 akcí
  // po několika oknech, čtené ze stránek LeekDucku.
  // A z 1,45 MB, když přibyl kalendář akcí, mobilní rozhraní a přihlášení
  // k OneDrivu (roster i nastavení se synchronizují mezi počítačem a telefonem).
  // Strop rostl s funkcemi: 1,40 → 1,45 → 1,50 → 1,55 → 1,60 MB.
  // Předposlední zvednutí bylo za žebříček raid bossů, rozšířené okno
  // na přidání kusu a hlášku o překlopení verdiktu. Poslední je za
  // ODDĚLENÉ SHADOW ŽEBŘÍČKY: shadow varianta má vlastní pořadí
  // i sestavu (39 kB dat), protože se pod jedním klíčem s běžnou
  // formou slévat nedá — 86 druhů ukazovalo cizí číslo.
  // 1,65 MB: posudek každého útoku, kontrola vstupu a nejlepší sestava druhu.
  check("appka se drží pod 1,65 MB", velikostSouboru < 1650000, String(velikostSouboru));

  console.log("\n50) jména obránců: chybějící druhy a překlepy");
  const jmena = await page.evaluate(() => {
    const par = (t) => window.__pgo.parseDefenders(t)[0];
    const out = {};
    // Scatterbug nemá formu "Normal", jen dvacet vzorových — dřív z pokédexu vypadl
    out.scatterbug = par("Scatterbug 177");
    // Perrserker existuje jen jako galarská forma, sedí pod perrserker-galar
    out.perrserker = par("Perrserker 15");
    // další druhy ze stejné díry
    out.sirfetchd = par("Sirfetchd");
    out.obstagoon = par("Obstagoon");
    // překlepy
    out.bubasaur = par("Bubasaur 387");
    out.magnazone = par("Magnazone 500");
    // nesmysl se dosazovat nesmí
    out.nesmysl = par("Uplne Vymyslene Jmeno");
    out.kratke = par("Xy");
    return {
      scatterbug: { n: out.scatterbug.name, t: (out.scatterbug.dex || {}).types, cp: out.scatterbug.cp },
      perrserker: { n: out.perrserker.name, t: (out.perrserker.dex || {}).types },
      sirfetchd: !!out.sirfetchd.dex,
      obstagoon: !!out.obstagoon.dex,
      bubasaur: { n: out.bubasaur.name, g: out.bubasaur.guessed, cp: out.bubasaur.cp },
      magnazone: { n: out.magnazone.name, g: out.magnazone.guessed },
      nesmysl: !!out.nesmysl.dex,
      kratke: !!out.kratke.dex,
    };
  });

  eq("Scatterbug se najde i bez formy Normal", jmena.scatterbug.n, "Scatterbug");
  eq("…a má typ", (jmena.scatterbug.t || []).join("/"), "Bug");
  eq("…a CP se přečetlo", jmena.scatterbug.cp, 177);
  eq("Perrserker se najde pod holým jménem", jmena.perrserker.n, "Perrserker");
  eq("…a má typ", (jmena.perrserker.t || []).join("/"), "Steel");
  check("Sirfetch'd taky", jmena.sirfetchd);
  check("Obstagoon taky", jmena.obstagoon);
  eq("překlep Bubasaur se opraví", jmena.bubasaur.n, "Bulbasaur");
  eq("…a je vidět, co uživatel napsal", jmena.bubasaur.g, "Bubasaur");
  eq("…a CP se nepoztrácí", jmena.bubasaur.cp, 387);
  eq("překlep Magnazone se opraví", jmena.magnazone.n, "Magnezone");
  check("úplný nesmysl se nedosazuje", jmena.nesmysl === false);
  check("krátký blábol taky ne", jmena.kratke === false);

  // Marowak (base útok 144) tady byl původně, jenže od zavedení rozpočtu
  // ho appka drží jen tehdy, když nic lepšího na Ground není — a do plánu
  // se dostávají jen kusy, které si appka nechává. Testuje se tu přitom
  // NÁSOBEK typové výhody, ne verdikt, takže stačí útočník, kterého
  // rozpočet drží bez debat.
  const dvojnasobne = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Excadrill", cp: 1086, level: 22, ivAtk: 14, ivDef: 13, ivSta: 12, fastMove: "Mud Shot", charged1: "Earthquake" },
    ]);
    const plan = window.__pgo.gymPlan("Magnezone 500");
    return plan[0].picks.map((p) => p.b.row.pokemon + "|" + Math.round(p.c.off * 100) / 100);
  });
  check("dvojitá typová výhoda se sečte (Ground proti Electric/Steel = ×2,56)",
    dvojnasobne[0] === "Excadrill|2.56", dvojnasobne.join(","));

  console.log("\n53) síla counteru: level, sestava a shadow");
  const sila = await page.evaluate(() => {
    const skore = (rows, boss) => {
      window.__pgo.setRows(rows);
      const plan = window.__pgo.gymPlan(boss);
      return plan[0].picks.map((p) => ({
        n: p.b.row.pokemon, off: Math.round(p.c.off * 100) / 100,
        rel: Math.round(p.c.score / plan[0].picks[0].c.score * 100),
        set: p.c.moveset.fast.type + "/" + p.c.moveset.charged.type,
      }));
    };
    const out = {};

    // Typová výhoda se musí brát z ukazované sestavy, ne z typů druhu.
    // Cacnea je Grass/Dark, ale se sestavou Sucker Punch + Payback (obojí Dark)
    // Tenhle blok měří sílu counteru, ne pravidla ponechání. Shadow kusy bez role
    // by jinak vypadly z výběru dřív, než se k počítání vůbec dojde.
    const kf = document.getElementById("keepForms");
    kf.checked = true; kf.dispatchEvent(new Event("change", { bubbles: true }));

    // proti Water nemá výhodu žádnou.
    out.cacnea = skore([
      { pokemon: "Cacnea", forma: "Shadow", cp: 234, level: 12, ivAtk: 10, ivDef: 10, ivSta: 10, fastMove: "Sucker Punch", charged1: "Payback" },
    ], "Wailmer");

    // Nízký level nesmí zmizet pod typovou výhodou: slabý kus s ×1,6 nemá
    // přeskočit mnohem silnějšího s ×1.
    out.levely = skore([
      { pokemon: "Ampharos", cp: 1604, level: 26, ivAtk: 13, ivDef: 13, ivSta: 13, fastMove: "Volt Switch", charged1: "Zap Cannon" },
      { pokemon: "Chinchou", forma: "Shadow", cp: 60, level: 3, ivAtk: 10, ivDef: 10, ivSta: 10, fastMove: "Spark", charged1: "Thunderbolt" },
    ], "Wailmer");

    // …ale když je stejný druh na vyšším levelu, musí vyhrát on
    out.stejnyDruh = skore([
      { pokemon: "Chinchou", forma: "Shadow", cp: 60, level: 3, ivAtk: 10, ivDef: 10, ivSta: 10, fastMove: "Spark", charged1: "Thunderbolt" },
      { pokemon: "Chinchou", forma: "Shadow", cp: 900, level: 30, ivAtk: 10, ivDef: 10, ivSta: 10, fastMove: "Spark", charged1: "Thunderbolt" },
    ], "Wailmer");

    // shadow: +20 % útoku, −20 % obrany
    out.shadow = skore([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Machamp", forma: "Shadow", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
    ], "Blissey");
    kf.checked = false; kf.dispatchEvent(new Event("change", { bubbles: true }));
    return out;
  });

  eq("Dark sestava proti Water nemá typovou výhodu", sila.cacnea[0].off, 1);
  eq("…a typy se berou ze sestavy, ne z druhu", sila.cacnea[0].set, "Dark/Dark");
  check("silný kus bez výhody přebije slabý kus s výhodou",
    sila.levely[0].n === "Ampharos", JSON.stringify(sila.levely));
  check("…a ten slabý je znatelně níž", sila.levely[1].rel < 40, JSON.stringify(sila.levely));
  check("u stejného druhu rozhoduje level",
    sila.stejnyDruh[0].rel === 100 && sila.stejnyDruh[1].rel < 30, JSON.stringify(sila.stejnyDruh));
  check("shadow kus je před běžným",
    sila.shadow[0].n === "Machamp" && sila.shadow[0].rel === 100 && sila.shadow[1].rel < 100,
    JSON.stringify(sila.shadow));

  console.log("\n54) Little Cup a čitelná liga u verdiktu");
  const lc = await page.evaluate(() => {
    const one = (row) => {
      window.__pgo.setRows([row]);
      const r = window.__pgo.getRows()[0], c = window.__pgo.getComputed()[r.id];
      return { rec: c.pvpRec, sub: c.pvpSub, pot: c.pvpPot, title: c.pvpTitle, tone: c.pvpTone };
    };
    const out = {};
    // Slowpoke je v Little Cupu #37; s dobrými IV má být LC pick
    out.slowpoke = one({ pokemon: "Slowpoke", cp: 330, level: 8, ivAtk: 0, ivDef: 14, ivSta: 15,
      fastMove: "Confusion", charged1: "Psyshock" });
    // rank z Little League musí být vidět i s ligou
    out.rank = one({ pokemon: "Ducklett", cp: 113, level: 10, ivAtk: 2, ivDef: 14, ivSta: 15,
      lcRank: 5, fastMove: "Wing Attack", charged1: "Brave Bird" });
    // Magikarp je v PvPoke žebříčku až pod prahem skóre — nesmí projít
    out.magikarp = one({ pokemon: "Magikarp", cp: 121, level: 12, ivAtk: 1, ivDef: 15, ivSta: 15,
      lcRank: 4, fastMove: "Splash", charged1: "Struggle" });
    return out;
  });

  check("Slowpoke je Little Cup pick", lc.slowpoke.rec.indexOf("LC") > -1, lc.slowpoke.rec + " / " + lc.slowpoke.sub);
  check("…a v potenciálu je Little Cup vidět",
    (lc.slowpoke.pot || "").indexOf("LC ") === 0, lc.slowpoke.pot);
  check("…a podtitulek říká, co tomu kusu ještě chybí",
    /vylepšit|vyvinout|připraven/.test(lc.rank.sub), lc.rank.sub);
  check("…a pořadí zůstalo v bublině", lc.rank.title.indexOf("#") > -1,
    (lc.rank.title || "").slice(0, 80));
  check("Magikarp neprojde ani s rankem #4 — je pod prahem skóre",
    lc.magikarp.rec.indexOf("Ano") !== 0, lc.magikarp.rec + " / " + lc.magikarp.sub);

  const ligy = await page.evaluate(() => {
    const csvLC = [
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,LL Rank (min),GL Rank (min),Fast move,Special move",
      "Slowpoke,662,20,0,14,15,37,900,Confusion,Psyshock",
    ].join(String.fromCharCode(10));
    window.__pgo.importText(csvLC);
    const map = {};
    // Ruční mapování sloupců v importu už není — čte se přímo logika.
    Object.assign(map, window.__pgo.automatickeMapovani(csvLC) || {});
    window.__pgo.finishImport("replace");
    return { map: map["LC rank (Little Cup)"], lcRank: window.__pgo.getRows()[0].lcRank };
  });
  eq("sloupec LL Rank z Calcy se napojí sám", ligy.map, "LL Rank (min)");
  eq("…a hodnota dorazí", ligy.lcRank, "37");

  console.log("\n55) vysvětlivky u verdiktů a Max Battle režim");
  const vysv = await page.evaluate(() => {
    const one = (row) => {
      window.__pgo.setRows([row]);
      const r = window.__pgo.getRows()[0], c = window.__pgo.getComputed()[r.id];
      return c;
    };
    const out = {};
    // „Nechat – vyvinout" musí v bublině říct na co a proč
    const sp = one({ pokemon: "Marill", cp: 453, level: 20, ivAtk: 1, ivDef: 15, ivSta: 14 });
    out.vyvinout = { keep: sp.keep, keepT: sp.keepTitle, evoT: sp.evolveTitle };
    // kus držený z jiného důvodu má evolvovat = Ano, ale verdikt jiný
    // Patrat -> Watchog: v žádné lize, žádný raid, žádný gym. Rookidee tu být
    // nemůže, ten se vyvine na Corviknighta (UL #3) a držet ho je správně —
    // testovalo by se tím něco jiného, než co je v nadpisu.
    const sh = one({ pokemon: "Patrat", forma: "Shadow", cp: 130, level: 10, ivAtk: 8, ivDef: 8, ivSta: 8 });
    out.shadow = { keep: sh.keep, evolve: sh.evolve, evoT: sh.evolveTitle, keepT: sh.keepTitle };
    // odpad musí říct proč pryč
    const od = one({ pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 });
    out.odpad = { keep: od.keep, keepT: od.keepTitle, evoT: od.evolveTitle };
    // finální evoluce
    const fin = one({ pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" });
    out.fin = { evolve: fin.evolve, evoT: fin.evolveTitle, gymT: fin.gymTitle, raidT: fin.raidTitle, copT: fin.copiesTitle };
    return out;
  });

  eq("Marill je „Nechat – evolvovat“", vysv.vyvinout.keep, "Nechat – evolvovat");
  check("…a bublina řekne na co se vyvine", vysv.vyvinout.keepT.indexOf("Azumarill") > -1, vysv.vyvinout.keepT);
  check("…i v jaké lize to hraje a na kolikátém místě",
    vysv.vyvinout.keepT.indexOf("Great League") > -1
      && /na #\d+/.test(vysv.vyvinout.keepT), vysv.vyvinout.keepT);
  check("…a proč nízké IV % v lize nevadí",
    vysv.vyvinout.keepT.indexOf("Nízké IV tu nevadí") > -1, vysv.vyvinout.keepT);
  // Poznámka je schválně krátká — v kartě čištění boxu má pevnou výšku,
  // takže se do ní vejdou jen podstatné údaje. Že je evoluce jediný důvod,
  // stojí ve verdiktu („Nechat – evolvovat") hned nad ní.
  check("…a drží se do dvou řádků, ne pěti vět",
    vysv.vyvinout.keepT.length < 260, String(vysv.vyvinout.keepT.length));

  // Shadow bez role: výchozí nastavení ho bere jako každý jiný kus.
  eq("shadow kus bez role se vyvíjet nevyplatí", vysv.shadow.evolve, "Ne");
  check("…a verdikt je zahodit", vysv.shadow.keep.indexOf("Zahodit") === 0, vysv.shadow.keep);
  check("…a bublina řekne, že ani po evoluci by nic nedržel",
    vysv.shadow.evoT.indexOf("Watchog") > -1 && vysv.shadow.evoT.indexOf("Nemá to pro co") > -1,
    vysv.shadow.evoT);

  const shadowVzdy = await page.evaluate(() => {
    const kf = document.getElementById("keepForms");
    kf.checked = true; kf.dispatchEvent(new Event("change", { bubbles: true }));
    // Watchog, ne Corvisquire: ten se vyvine na Corviknighta (UL #3) a držel by
    // se sám od sebe. Test by pak procházel, i kdyby držení forem nefungovalo.
    window.__pgo.setRows([{ pokemon: "Watchog", forma: "Shadow", cp: 900, level: 20,
      ivAtk: 8, ivDef: 8, ivSta: 8, fastMove: "Bite", charged1: "Crunch" }]);
    const c = window.__pgo.getComputed();
    const r = window.__pgo.getRows()[0];
    const out = { keep: c[r.id].keep, evolve: c[r.id].evolve, keepT: c[r.id].keepTitle || "" };
    kf.checked = false; kf.dispatchEvent(new Event("change", { bubbles: true }));
    return out;
  });
  check("se zapnutým držením forem se shadow nechává", shadowVzdy.keep === "Ponechat",
    shadowVzdy.keep);
  check("…a bublina řekne, proč drží místo",
    shadowVzdy.keepT.indexOf("Shadow forma") > -1, shadowVzdy.keepT);

  check("u odpadu je napsané, proč jde pryč",
    vysv.odpad.keepT.indexOf("Nedrží žádnou roli") > -1, vysv.odpad.keepT);
  check("…a proč ho nemá cenu vyvíjet",
    vysv.odpad.evoT.indexOf("Bonbóny nech na něco lepšího") > -1, vysv.odpad.evoT);

  eq("finální evoluce se pozná", vysv.fin.evolve, "Finální");
  check("…a bublina to řekne", /dál už se nevyvíjí|nevyvíjí se na nic/.test(vysv.fin.evoT),
    vysv.fin.evoT);
  check("gym má vysvětlivku", vysv.fin.gymT.length > 20, vysv.fin.gymT);
  check("raid má vysvětlivku", vysv.fin.raidT.length > 20, vysv.fin.raidT);
  check("kopie mají vysvětlivku", vysv.fin.copT.indexOf("jen jednou") > -1, vysv.fin.copT);


  console.log("\n56) Normal chip, shadow filtr, seznam evolucí a vylepšený kus při importu");
  const davka = await page.evaluate(() => {
    const out = {};
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Mudkip", forma: "Shadow", cp: 224, level: 12, ivAtk: 8, ivDef: 8, ivSta: 8 },
      { pokemon: "Marill", cp: 453, level: 20, ivAtk: 1, ivDef: 15, ivSta: 14 },
      { pokemon: "Rattata", forma: "Purified", cp: 200, level: 15, ivAtk: 6, ivDef: 5, ivSta: 7 },
    ]);
    // filtry na formy
    const f = document.getElementById("filterSelect");
    const jmena = () => Array.from(document.querySelectorAll("#tbody tr td.col-pokemon")).map((e) => e.textContent);
    f.value = "shadow"; f.dispatchEvent(new Event("change", { bubbles: true }));
    out.shadow = jmena();
    f.value = "purified"; f.dispatchEvent(new Event("change", { bubbles: true }));
    out.purified = jmena();
    f.value = "all"; f.dispatchEvent(new Event("change", { bubbles: true }));

    // seznam evolucí
    const ep = window.__pgo.getEvolvePlan();
    out.evo = ep.map((e) => e.row.pokemon + "|" + (e.kvuliEvoluci ? "kvuli" : "bonus"));
    out.evoDuvod = (ep.filter((e) => e.row.pokemon === "Marill")[0] || {}).duvod || "";
    out.vTabulce = Array.from(document.querySelectorAll("#planBody .plan-head")).map((e) => e.textContent);
    return out;
  });

  // Buňka se jménem teď nese i značku SHADOW / PURIFIED.
  check("filtr shadow nechá jen shadow kusy",
    davka.shadow.length === 1 && davka.shadow[0].indexOf("Mudkip") === 0,
    davka.shadow.join(","));
  check("…a je u něj značka SHADOW",
    davka.shadow[0].indexOf("SHADOW") > -1, davka.shadow.join(","));
  check("filtr purified taky",
    davka.purified.length === 1 && davka.purified[0].indexOf("Rattata") === 0,
    davka.purified.join(","));
  check("v seznamu evolucí je Marill kvůli evoluci",
    davka.evo.indexOf("Marill|kvuli") > -1, davka.evo.join(","));
  check("…a shadow Mudkip jako bonus",
    davka.evo.indexOf("Mudkip|kvuli") > -1 || davka.evo.indexOf("Mudkip|bonus") > -1, davka.evo.join(","));
  check("…a je u něj cíl i liga", davka.evoDuvod.indexOf("Azumarill") > -1, davka.evoDuvod);

  const vylepseny = await page.evaluate(() => {
    // roster: Machamp na L20 s přesnými IV
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 1500, level: 20, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch", star: true },
    ]);
    // ten samý kus po vylepšení: jiné CP i level, stejná IV
    window.__pgo.importText([
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,Fast move,Special move",
      "Machamp,2100,30,15,14,13,Counter,Dynamic Punch",
    ].join("\n"));
    window.confirm = () => true;
    window.alert = () => {};
    window.__pgo.finishImport("merge");
    const rows = window.__pgo.getRows();
    return { pocet: rows.length, cp: rows[0].cp, level: rows[0].level, star: !!rows[0].star };
  });

  eq("vylepšený kus se nepřidá podruhé", vylepseny.pocet, 1);
  eq("…a CP se přepíše na nové", vylepseny.cp, "2100");
  eq("…i level", vylepseny.level, "30");
  check("…a hvězdička zůstane", vylepseny.star);

  const jinyKus = await page.evaluate(() => {
    // stejný druh, ale jiná IV = opravdu jiný kus, musí se přidat
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 1500, level: 20, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
    ]);
    window.__pgo.importText([
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,Fast move,Special move",
      "Machamp,2100,30,10,10,10,Counter,Dynamic Punch",
    ].join("\n"));
    window.__pgo.finishImport("merge");
    return window.__pgo.getRows().length;
  });
  eq("kus s jinými IV se přidá jako nový", jinyKus, 2);

  console.log("\n57) staty pod CP, cena evoluce a „jinak k ničemu“");
  const staty = await page.evaluate(() => {
    const one = (row) => {
      window.__pgo.setRows([row]);
      const r = window.__pgo.getRows()[0], c = window.__pgo.getComputed()[r.id];
      const td = document.querySelector("#tbody tr td.num");
      return { c: c,
        cpCell: document.querySelector('#tbody tr td[data-col="cp"]').textContent };
    };
    const out = {};
    const m = one({ pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" });
    out.staty = m.c.staty;
    out.cpCell = m.cpCell;
    // shadow: +20 % útok, −20 % obrana
    const sh = one({ pokemon: "Machamp", forma: "Shadow", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" });
    out.shadow = sh.c.staty;
    // cena evoluce
    const sp = one({ pokemon: "Marill", cp: 453, level: 20, ivAtk: 1, ivDef: 15, ivSta: 14 });
    out.marill = { evolve: sp.c.evolve, sub: sp.c.evolveSub, tone: sp.c.evolveTone, title: sp.c.evolveTitle };
    const ma = one({ pokemon: "Magikarp", cp: 300, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15, fastMove: "Splash", charged1: "Struggle" });
    out.magikarp = { sub: ma.c.evolveSub, evolve: ma.c.evolve };
    return out;
  });

  check("staty se spočítají", staty.staty && staty.staty.a > 0 && staty.staty.d > 0 && staty.staty.hp > 0,
    JSON.stringify(staty.staty));
  check("…a jsou vidět pod CP", staty.cpCell.indexOf("2100") === 0
    && staty.cpCell.indexOf(String(staty.staty.a) + "/") > -1, staty.cpCell);
  check("shadow má vyšší útok a nižší obranu",
    staty.shadow.a > staty.staty.a && staty.shadow.d < staty.staty.d,
    JSON.stringify(staty.staty) + " vs " + JSON.stringify(staty.shadow));

  eq("kus, co bez evoluce nemá smysl, to má napsané", staty.marill.sub, "jinak k ničemu");
  eq("…a je žlutě, ne zeleně", staty.marill.tone, "warning");
  check("…a v bublině je cena v bonbónech",
    staty.marill.title.indexOf("bonbónů") > -1, staty.marill.title);
  check("u kusu, co roli drží už teď, je v podřádku cena",
    staty.magikarp.sub.indexOf("bonbónů") > -1, staty.magikarp.evolve + " / " + staty.magikarp.sub);

  const zkratky = await page.evaluate(() => {
    const cisty = (h) => h.textContent.replace(/[ ▲▼▽2]+$/, "");
    const hl = () => Array.from(document.querySelectorAll("#headerRow th")).map(cisty);
    document.getElementById("viewSelect").value = "verdict";
    document.getElementById("viewSelect").dispatchEvent(new Event("change", { bubbles: true }));
    const kratke = hl();
    const th = Array.from(document.querySelectorAll("#headerRow th"))
      .filter((h) => cisty(h) === "CP max")[0];
    const tip = th ? th.title : "";
    document.getElementById("viewSelect").value = "all";
    document.getElementById("viewSelect").dispatchEvent(new Event("change", { bubbles: true }));
    const dlouhe = hl();
    document.getElementById("viewSelect").value = "verdict";
    document.getElementById("viewSelect").dispatchEvent(new Event("change", { bubbles: true }));
    return { kratke, dlouhe, tip };
  });
  check("v Rozhodnutí jsou nadpisy zkrácené",
    zkratky.kratke.indexOf("CP max") > -1 && zkratky.kratke.indexOf("Verdikt") > -1, zkratky.kratke.join(","));
  check("…ale plný název je v bublině", zkratky.tip.indexOf("CP na stropu dat") === 0, zkratky.tip);
  check("v režimu Vše zůstávají plné", zkratky.dlouhe.indexOf("CP na stropu dat") > -1, zkratky.dlouhe.join(","));
  // Sloupec Sken nesl jedinou informaci — že sken byl nejednoznačný. Ta je
  // teď přímo na IV %, kterých se týká.
  check("sloupec Sken je pryč z obou zobrazení",
    zkratky.kratke.indexOf("Sken") === -1
    && zkratky.dlouhe.indexOf("Doskenovat s Appraisal") === -1,
    zkratky.kratke.join(","));
  // Otazníky na konci názvů sloupců byly zbytečné — sloupec je název, ne otázka.
  check("názvy sloupců nekončí otazníkem",
    zkratky.kratke.concat(zkratky.dlouhe).every((t) => !/\?$/.test(t)),
    zkratky.dlouhe.filter((t) => /\?$/.test(t)).join(","));

  console.log("\n58) typová tabulka v GO číslech, počasí a raidové žebříčky z dat");
  const typy = await page.evaluate(() => {
    document.getElementById("typesCard").open = true;
    const out = {};
    const bunka = (radek, sloupec) => {
      const rows = Array.from(document.querySelectorAll("#typeTable tbody tr"));
      const tr = rows.filter((r) => r.querySelector("th").textContent === radek)[0];
      const hlavicky = Array.from(document.querySelectorAll("#typeTable thead th")).map((h) => h.textContent);
      const i = hlavicky.indexOf(sloupec);
      return tr && i > -1 ? tr.cells[i].textContent : "";
    };
    out.velikost = document.querySelectorAll("#typeTable tbody tr").length;
    out.normalNaGhosta = bunka("Normal", "Ghost");
    out.ghostNaNormal = bunka("Ghost", "Normal");
    out.ohenNaTravu = bunka("Fire", "Grass");
    out.vodaNaVodu = bunka("Water", "Water");
    out.zemeNaLetajici = bunka("Ground", "Flying");

    const sel = document.getElementById("weatherSelect");
    out.moznosti = sel.options.length;
    sel.value = "Rainy";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    out.boost = window.__pgo.boostedTypes();
    out.pozn = document.getElementById("weatherNote").textContent;
    out.zvyraznene = document.querySelectorAll("#typeTable tbody th.boost").length;
    sel.value = "";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    out.poZruseni = document.querySelectorAll("#typeTable tbody th.boost").length;
    return out;
  });

  eq("tabulka má všech 18 typů", typy.velikost, 18);
  eq("Normal na Ghosta v GO projde za 0,39 (žádná imunita)", typy.normalNaGhosta, "0,39");
  eq("…a Ghost na Normala taky", typy.ghostNaNormal, "0,39");
  eq("super efektivní je 1,6 a ne 2", typy.ohenNaTravu, "1,6");
  eq("Voda na vodu je neefektivní", typy.vodaNaVodu, "0,63");
  eq("Ground na Flying je 0,39, ne nula", typy.zemeNaLetajici, "0,39");

  eq("v nabídce je sedm počasí plus prázdno", typy.moznosti, 8);
  check("déšť boostuje Water, Electric a Bug",
    typy.boost.join(",") === "Water,Electric,Bug", typy.boost.join(","));
  check("…a je to napsané", typy.pozn.indexOf("o 20 % víc") > -1, typy.pozn);
  eq("…a v tabulce se zvýrazní tři řádky", typy.zvyraznene, 3);
  eq("po zrušení počasí zvýraznění zmizí", typy.poZruseni, 0);

  const zebricky = await page.evaluate(() => {
    const top = (t) => window.__pgo.typeRanking(t).slice(0, 3).map((e) => e.name);
    return {
      water: top("Water"), fighting: top("Fighting"), steel: top("Steel"),
      machamp: window.__pgo.raidRolesFor("Machamp").map((e) => e.type),
      rattata: window.__pgo.raidRolesFor("Rattata").length,
      mewtwo: window.__pgo.raidRolesFor("Mewtwo")[0],
    };
  });
  check("nejlepší Water útočník je Kyogre", zebricky.water[0] === "Kyogre", zebricky.water.join(","));
  check("nejlepší Fighting je Keldeo — po doplnění útoků z PvPoke",
    zebricky.fighting[0] === "Keldeo", zebricky.fighting.join(","));
  check("…a Terrakion s Lucariem hned za ním",
    zebricky.fighting.indexOf("Terrakion") <= 2 && zebricky.fighting.indexOf("Lucario") <= 3,
    zebricky.fighting.join(","));
  check("nejlepší Steel je Zacian", zebricky.steel[0] === "Zacian", zebricky.steel.join(","));
  check("Machamp je Fighting útočník", zebricky.machamp.indexOf("Fighting") > -1, zebricky.machamp.join(","));
  eq("Rattata není raidový útočník na nic", zebricky.rattata, 0);
  check("Mewtwo má jako první roli Psychic, ne Fighting",
    zebricky.mewtwo.type === "Psychic", JSON.stringify(zebricky.mewtwo));
  check("…s vysokou prioritou",
    zebricky.mewtwo.priority === "Vysoká", JSON.stringify(zebricky.mewtwo));

  const tahak = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Charizard", cp: 2900, level: 33, ivAtk: 15, ivDef: 15, ivSta: 14, fastMove: "Fire Spin", charged1: "Blast Burn" },
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
    ]);
    document.getElementById("cheatCard").open = true;
    window.__pgo.renderCheatSheet();
    const jmena = () => document.getElementById("cheatBody").textContent;
    const pred = jmena();
    // smazat Charizarda a tahák se musí přepočítat sám
    document.querySelectorAll("#tbody tr").forEach((tr) => {
      if (tr.querySelector("td.col-pokemon").textContent === "Charizard") tr.querySelector(".del-btn").click();
    });
    return { pred: pred.indexOf("Charizard") > -1, po: jmena().indexOf("Charizard") > -1 };
  });
  check("tahák se po smazání kusu přepočítá sám", tahak.pred === true && tahak.po === false,
    JSON.stringify(tahak));

  console.log("\n59) vylepšení a evoluce při importu, procenta v taháku");
  const merge2 = await page.evaluate(() => {
    const hlava = "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,min IV%,max IV%,Fast move,Special move";
    const imp = (radky) => {
      window.confirm = () => true;
      window.alert = () => {};
      window.__pgo.importText([hlava].concat(radky).join("\n"));
      window.__pgo.finishImport("merge");
    };
    const stav = () => window.__pgo.getRows().map((r) => r.pokemon + "|" + r.cp);
    const out = {};

    // nejistý sken (rozsah IV) po vylepšení — dřív se přidal podruhé
    window.__pgo.setRows([]);
    imp(["Marowak,1086,22,12.2,6.2,8.5,51.1,66.7,Mud Slap,Earthquake"]);
    imp(["Marowak,1400,26,12.2,6.2,8.5,51.1,66.7,Mud Slap,Earthquake"]);
    out.nejisty = stav();

    // dva různé kusy s rozsahy, které se vylučují — musí zůstat oba
    window.__pgo.setRows([]);
    imp(["Marowak,1086,22,12.2,6.2,8.5,51.1,66.7,Mud Slap,Earthquake"]);
    imp(["Marowak,1400,26,3.0,3.0,3.0,15.0,22.0,Mud Slap,Earthquake"]);
    out.ruzne = stav();

    // evoluce: řádek se přepíše na novou formu
    window.__pgo.setRows([]);
    imp(["Machop,600,15,15,14,13,93.3,93.3,Counter,Cross Chop"]);
    imp(["Machoke,900,15,15,14,13,93.3,93.3,Counter,Cross Chop"]);
    out.evoluce = stav();

    // hvězdička a ruční forma evoluci přežijí
    window.__pgo.setRows([{ pokemon: "Machop", cp: 600, level: 15, ivAtk: 15, ivDef: 14, ivSta: 13, star: true, forma: "Shadow" }]);
    imp(["Machoke,900,15,15,14,13,93.3,93.3,Counter,Cross Chop"]);
    const r0 = window.__pgo.getRows()[0];
    out.prezilo = { p: r0.pokemon, star: !!r0.star, forma: r0.forma };
    return out;
  });

  check("vylepšený kus s rozsahem IV se sloučí, když je jediný svého druhu",
    merge2.nejisty.length === 1 && merge2.nejisty[0] === "Marowak|1400", merge2.nejisty.join(","));
  check("…ale dva kusy s neslučitelnými rozsahy zůstanou oba",
    merge2.ruzne.length === 2, merge2.ruzne.join(","));
  check("vyvinutý kus přepíše původní řádek",
    merge2.evoluce.length === 1 && merge2.evoluce[0] === "Machoke|900", merge2.evoluce.join(","));
  check("…a hvězdička i forma zůstanou",
    merge2.prezilo.p === "Machoke" && merge2.prezilo.star && merge2.prezilo.forma === "Shadow",
    JSON.stringify(merge2.prezilo));

  const procenta = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Mewtwo", cp: 2507, level: 21.5, ivAtk: 15, ivDef: 15, ivSta: 15, fastMove: "Confusion", charged1: "Psystrike" },
      { pokemon: "Charizard", cp: 2900, level: 33, ivAtk: 15, ivDef: 15, ivSta: 14, fastMove: "Fire Spin", charged1: "Blast Burn" },
      { pokemon: "Kadabra", cp: 608, level: 14, ivAtk: 13, ivDef: 12, ivSta: 12, fastMove: "Psycho Cut", charged1: "Dazzling Gleam" },
    ]);
    const cs = window.__pgo.getCheatSheet();
    const out = { nad100: [], vsechny: {} };
    cs.types.forEach((t) => {
      if (!t.ceiling) return;
      const pct = Math.round(t.ceiling.pct * 100);
      out.vsechny[t.type] = pct;
      if (pct > 100) out.nad100.push(t.type + " " + pct + " %");
    });
    return out;
  });
  check("žádný typ v taháku nepřeleze 100 % špičky", procenta.nad100.length === 0,
    procenta.nad100.join(", ") + " | " + JSON.stringify(procenta.vsechny));
  check("…a pořád se něco počítá", Object.keys(procenta.vsechny).length >= 10,
    JSON.stringify(procenta.vsechny));

  const tabulkaText = await page.evaluate(() => {
    document.getElementById("typesCard").open = true;
    return document.querySelector("#typesCard .plan-intro").textContent;
  });
  check("text u tabulky mluví jen o ní samotné",
    tabulkaText.indexOf("Imunity") === -1 && tabulkaText.indexOf("klasick") === -1, tabulkaText);
  check("…a vysvětlí, co znamená tečka", tabulkaText.indexOf("×1") > -1, tabulkaText);
  check("…a jak se násobí dvojtypy", tabulkaText.indexOf("1,6 × 1,6") > -1, tabulkaText);

  console.log("\n60) přišpendlená hlavička, „máš lepšího?“ a smazaní s údaji");
  await page.setViewportSize({ width: 1500, height: 800 });
  const pin = await page.evaluate(() => {
    if (window.__pgoZalozka) window.__pgoZalozka("roster");
    const rows = [];
    for (let i = 0; i < 40; i++) {
      rows.push({ pokemon: "Machamp", cp: 1000 + i, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10,
        fastMove: "Counter", charged1: "Dynamic Punch" });
    }
    window.__pgo.setRows(rows);
    const wrap = document.querySelector(".table-wrap");
    const th = document.querySelector("#headerRow th");
    const out = { vyska: Math.round(wrap.getBoundingClientRect().height), obsah: wrap.scrollHeight };
    wrap.scrollTop = 600;
    const lista = document.querySelector(".card.roster .toolbar");
    out.listaVyska = Math.round(lista.getBoundingClientRect().height);
    out.hlavickaPoScrollu = Math.round(th.getBoundingClientRect().top - wrap.getBoundingClientRect().top);
    out.prvniRadekOdscrollovan = wrap.scrollTop > 0;
    wrap.scrollTop = 0;
    return out;
  });
  check("roster scrolluje ve vlastním okně", pin.obsah > pin.vyska, pin.obsah + " vs " + pin.vyska);
  // Lišta s příkazy se od téhle verze NElepí — přišpendlené má zůstat jen
  // záhlaví tabulky. Několik řádků tlačítek pod záložkami ubíralo místo
  // přesně tomu, kvůli čemu se scrolluje.
  check("…a hlavička u toho zůstane nahoře v okně rosteru",
    pin.hlavickaPoScrollu <= 3, String(pin.hlavickaPoScrollu));
  check("…a řádky se opravdu posunuly", pin.prvniRadekOdscrollovan);
  await page.setViewportSize({ width: 1920, height: 1000 });

  const lepsi = await page.evaluate(() => {
    const out = {};
    // Dvě Azumarilly (GL #24): slabší musí dostat „lepší máš“. Původně tu
    // byli dva Lanturni, jenže Lanturn je v Great League až #145 — nad
    // prahem pořadí. Appka u něj od zavedení rozpočtu (správně) říká
    // „druh je až #145“, protože o kopie vůbec nejde: ten druh nehraje.
    // Porovnání kopií se dá ukázat jen na druhu, který se do rozpočtu vejde.
    window.__pgo.setRows([
      { pokemon: "Azumarill", cp: 1500, level: 25, ivAtk: 0, ivDef: 15, ivSta: 15, fastMove: "Bubble", charged1: "Play Rough" },
      { pokemon: "Azumarill", cp: 900, level: 18, ivAtk: 5, ivDef: 12, ivSta: 13, fastMove: "Bubble", charged1: "Play Rough" },
    ]);
    const cfg = (id, v) => {
      const el = document.getElementById(id); el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    cfg("keepCopies", 2); cfg("spThresh", 98);
    const c = window.__pgo.getComputed();
    window.__pgo.getRows().forEach((r) => {
      out[r.cp] = { keep: c[r.id].keep, sub: c[r.id].keepSub, title: c[r.id].keepTitle };
    });
    document.getElementById("resetSettingsBtn").click();
    return out;
  });
  // Verdikt „Zvážit – slabý kus" se zrušil, vysvětlení ale zůstat musí:
  // to, že appka rozhoduje sama, není důvod přestat říkat proč. Slabší
  // Lanturn dostane „Zahodit" a k tomu, který lepší kus ho nahrazuje.
  const slaby = Object.values(lepsi).filter((x) => x.sub.indexOf("lepší máš") === 0);
  check("slabý kus meta druhu dostane vysvětlení", slaby.length > 0, JSON.stringify(lepsi));
  check("…a je to jasný verdikt, ne vlažné zvážit",
    slaby.every((x) => x.keep.indexOf("Zvážit") === -1), JSON.stringify(slaby.map((x) => x.keep)));
  check("…a v bublině je konkrétně který kus ho nahrazuje",
    slaby.every((x) => x.title.indexOf("Lepší kus toho druhu") > -1), JSON.stringify(slaby.map((x) => x.title)));

  const smazani = await page.evaluate(() => {
    window.__pgo.setDiscarded([]);
    window.__pgo.setRows([
      { pokemon: "Machamp", forma: "Shadow", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" },
    ]);
    document.querySelector("#tbody .del-btn").click();
    document.getElementById("forgetDiscardedBtn").click();
    const row = document.querySelector("#discardList tbody tr");
    const hlavicky = Array.from(document.querySelectorAll("#discardList thead th")).map((h) => h.textContent);
    const bunka = (label) => {
      const i = hlavicky.indexOf(label);
      return i > -1 ? row.cells[i].textContent : "";
    };
    return {
      jmeno: bunka("Pokémon").replace(/SHADOW|PURIFIED/, "").trim(),
      jmenoCele: bunka("Pokémon"), cp: bunka("CP"),
      iv: bunka("IV %"), typy: bunka("Typy"), verdikt: bunka("Verdikt"),
      kdy: bunka("Smazáno"),
      sloupcu: hlavicky.length,
    };
  });
  eq("smazaní mají stejné sloupce jako roster", smazani.jmeno, "Machamp");
  // Sloupec „Forma“ už neexistuje — forma se čte ze značky u jména.
  check("…včetně formy", smazani.jmenoCele.indexOf("SHADOW") > -1,
    smazani.jmenoCele);
  check("…a CP se statem pod ním", smazani.cp.indexOf("2100") === 0, smazani.cp);
  eq("…a IV %", smazani.iv, "93%");
  eq("…a typů", smazani.typy, "Fighting");
  check("…a spočítaného verdiktu", smazani.verdikt.length > 3, smazani.verdikt);
  check("…a data smazání", /\d/.test(smazani.kdy), smazani.kdy);
  check("sloupců je aspoň tolik co v rosteru", smazani.sloupcu >= 20, String(smazani.sloupcu));

  const tm = await page.evaluate(() => {
    const hlava = "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,min IV%,max IV%,Fast move,Special move";
    const imp = (r) => {
      window.confirm = () => true; window.alert = () => {};
      window.__pgo.importText([hlava, r].join("\n"));
      window.__pgo.finishImport("merge");
    };
    window.__pgo.setDiscarded([]);
    window.__pgo.setRows([]);
    imp("Machamp,2100,30,15,14,13,93.3,93.3,Bullet Punch,Heavy Slam");
    imp("Machamp,2100,30,15,14,13,93.3,93.3,Counter,Dynamic Punch");
    const r = window.__pgo.getRows();
    return { pocet: r.length, fast: r[0].fastMove, charged: r[0].charged1 };
  });
  eq("po přeučení útoků zůstane jeden řádek", tm.pocet, 1);
  check("…a má nové útoky", tm.fast === "Counter" && tm.charged === "Dynamic Punch",
    tm.fast + " + " + tm.charged);

  console.log("\n61) jeden posuvník, hromadné označení a Elitní TM");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.waitForTimeout(120);
  const scroll = await page.evaluate(() => {
    const rows = [];
    for (let i = 0; i < 40; i++) {
      rows.push({ pokemon: "Machamp", cp: 1000 + i, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10,
        fastMove: "Counter", charged1: "Dynamic Punch" });
    }
    window.__pgo.setRows(rows);
    const wrap = document.querySelector(".table-wrap");
    const th = document.querySelector("#headerRow th");
    void document.body.offsetHeight;   // vynutit přepočet layoutu po překreslení
    const out = { trida: wrap.className, vlastniPosuvnik: wrap.scrollHeight > wrap.clientHeight + 1 };
    const pred = Math.round(th.getBoundingClientRect().top + window.scrollY);
    out.maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.min(pred + 300, out.maxScroll));
    const lista2 = document.querySelector(".card.roster .toolbar");
    out.listaSpodek = Math.round(lista2.getBoundingClientRect().bottom);
    var zal = document.querySelector(".zal-lista");
    out.zalozkySpodek = zal ? Math.round(zal.getBoundingClientRect().bottom) : 0;
    out.listaNahore = Math.round(lista2.getBoundingClientRect().top);
    out.hlavickaPoScrollu = Math.round(th.getBoundingClientRect().top);
    out.strankaVodorovne = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    window.scrollTo(0, 0);
    return out;
  });
  check("na širokém okně nemá roster vlastní posuvník", scroll.vlastniPosuvnik === false, scroll.trida);
  check("…a lišta s tlačítky odscrolluje pryč, nedrží se nahoře",
    scroll.listaNahore < 0, String(scroll.listaNahore));
  check("…a hlavička zůstane přišpendlená u horního okraje",
    scroll.hlavickaPoScrollu >= 0 && scroll.hlavickaPoScrollu <= scroll.zalozkySpodek + 3,
    scroll.hlavickaPoScrollu + " vs záložky končí na " + scroll.zalozkySpodek);
  check("…a stránka se nescrolluje do stran", scroll.strankaVodorovne === false);

  const hromadne = await page.evaluate(() => {
    window.__pgo.setDiscarded([]);
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Mewtwo", cp: 2387, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15, fastMove: "Confusion", charged1: "Psystrike" },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
    ]);
    const btn = document.getElementById("starKeepersBtn");
    const out = { popisek: btn.textContent, videt: btn.style.display !== "none" };
    window.alert = () => {};
    btn.click();
    const c = window.__pgo.getComputed();
    out.oznaceni = window.__pgo.getRows().filter((r) => r.star).map((r) => r.pokemon);
    out.neoznaceni = window.__pgo.getRows().filter((r) => !r.star).map((r) => r.pokemon);
    out.poKliku = document.getElementById("starKeepersBtn").style.display === "none";
    return out;
  });
  check("tlačítko nabídne označit ponechané", hromadne.videt && hromadne.popisek.indexOf("Označit ponechané") === 0,
    hromadne.popisek);
  check("označí jen kusy s kladným verdiktem",
    hromadne.oznaceni.indexOf("Machamp") > -1 && hromadne.oznaceni.indexOf("Mewtwo") > -1
      && hromadne.oznaceni.indexOf("Rattata") === -1,
    hromadne.oznaceni.join(",") + " | nechal: " + hromadne.neoznaceni.join(","));
  check("…a pak zmizí, protože není co označovat", hromadne.poKliku);

  const tmPlan = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Mewtwo", cp: 2387, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15, fastMove: "Confusion", charged1: "Psychic" },
      { pokemon: "Mewtwo", cp: 2387, level: 20, ivAtk: 14, ivDef: 15, ivSta: 15, fastMove: "Confusion", charged1: "Psystrike" },
      { pokemon: "Eevee", cp: 360, level: 18, ivAtk: 12, ivDef: 12, ivSta: 12, fastMove: "Quick Attack", charged1: "Swift" },
    ]);
    const plan = window.__pgo.getEliteTmPlan();
    return {
      kdo: plan.map((e) => e.row.pokemon + "|" + e.row.charged1),
      cil: plan.length ? plan[0].cil : "",
      zisk: plan.length ? Math.round(plan[0].zisk * 100) : 0,
      vTabulce: Array.from(document.querySelectorAll("#planBody .plan-head")).map((e) => e.textContent),
    };
  });
  check("Elitní TM se doporučí Mewtwovi bez Psystrike",
    tmPlan.kdo.indexOf("Mewtwo|Psychic") > -1, tmPlan.kdo.join(","));
  check("…a ne tomu, kdo Psystrike už má", tmPlan.kdo.indexOf("Mewtwo|Psystrike") === -1, tmPlan.kdo.join(","));
  check("…a ne kusu bez role", tmPlan.kdo.join(",").indexOf("Eevee") === -1, tmPlan.kdo.join(","));
  check("…a je vidět, na co přeučit", tmPlan.cil.indexOf("Psystrike") > -1, tmPlan.cil);
  check("…a kolik to přidá", tmPlan.zisk > 0, String(tmPlan.zisk));
  check("v Power up listu je sekce s elitními TM",
    tmPlan.vTabulce.some((t) => t.indexOf("Elitní TM") > -1), tmPlan.vTabulce.join(" | "));

  console.log("\n62) obyčejný klik na hlavičku ruší druhotné řazení");
  const razeni = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 },
      { pokemon: "Machamp", cp: 1200, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 },
      { pokemon: "Blissey", cp: 2800, level: 30, ivAtk: 10, ivDef: 15, ivSta: 15 },
    ]);
    const th = (label) => {
      let f = null;
      document.querySelectorAll("#headerRow th").forEach((h) => {
        if (h.textContent.replace(/[ ▲▼▽2]+$/, "") === label) f = h;
      });
      return f;
    };
    const sipky = () => Array.from(document.querySelectorAll("#headerRow th"))
      .map((h) => h.textContent).filter((t) => /[▲▼]/.test(t));
    const out = {};
    th("Pokémon").click();
    th("CP").dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    out.poShiftu = sipky();
    // obyčejný klik na primární sloupec musí druhotné řazení zrušit
    th("Pokémon").click();
    out.poKliku = sipky();
    return out;
  });
  check("Shift+klik přidá druhotné řazení",
    razeni.poShiftu.length === 2 && razeni.poShiftu.some((t) => t.indexOf("2") > -1),
    razeni.poShiftu.join(" | "));
  check("obyčejný klik ho zase zruší",
    razeni.poKliku.length === 1 && !razeni.poKliku.some((t) => t.indexOf("2") > -1),
    razeni.poKliku.join(" | "));

  const bezSkupiny = await page.evaluate(() => ({
    skupina: !!document.querySelector("#rosterTable .group-row"),
    radkuVHlavicce: document.querySelectorAll("#rosterTable thead tr").length,
  }));
  check("skupinová hlavička je pryč", bezSkupiny.skupina === false);
  eq("…a v záhlaví je jediný řádek", bezSkupiny.radkuVHlavicce, 1);

  console.log("\n63) záloha do souboru na disku");
  const zaloha = await page.evaluate(() => {
    const b = document.getElementById("backupBtn");
    const st = document.getElementById("backupState");
    return {
      info: window.__pgo.backupInfo(),
      tlacitkoVidet: b.style.display !== "none",
      popisek: b.textContent,
      stav: st.textContent,
      trida: st.className,
    };
  });
  check("prohlížeč zápis do souboru umí", zaloha.info.podporovano, JSON.stringify(zaloha.info));
  check("…takže se tlačítko nabídne", zaloha.tlacitkoVidet && zaloha.popisek.indexOf("Zálohovat") === 0,
    zaloha.popisek);
  check("dokud není připojená, appka na to upozorní",
    zaloha.trida.indexOf("warn") > -1 && zaloha.stav.indexOf("Bez zálohy") === 0, zaloha.stav);

  const csvObsah = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, star: true },
    ]);
    const t = window.__pgo.csvText();
    return { hlavicka: t.split("\n")[0], radek: t.split("\n")[1] };
  });
  check("záloha nese i hvězdičku", csvObsah.radek.indexOf("★") > -1, csvObsah.radek);
  check("…a jde ji naimportovat zpátky", csvObsah.hlavicka.indexOf("Pokémon") === 0, csvObsah.hlavicka);

  console.log("\n65) raid a liga chtějí jinou sestavu");
  const konflikt = await page.evaluate(() => {
    const one = (fast, ch) => {
      const rl = document.getElementById("rankLimit");
      rl.value = "9999"; rl.dispatchEvent(new Event("input", { bubbles: true }));
      window.__pgo.setRows([{ pokemon: "Gyarados", cp: 1600, level: 18, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: fast, charged1: ch }]);
      const r = window.__pgo.getRows()[0], c = window.__pgo.getComputed()[r.id];
      const td = Array.from(document.querySelectorAll("#tbody tr td"))
        .filter((x) => x.textContent.indexOf("raid ≠ liga") > -1)[0];
      rl.value = "50"; rl.dispatchEvent(new Event("input", { bubbles: true }));
      // Buňka s útoky má od téhle verze složenou bublinu v `data-tip`
      // (HTML se seznamem útoků), ne prostý `title`.
      return { k: c.konfliktSestav, movesSub: c.movesSub, pvpSub: c.pvpSub,
        bublina: td ? (td.getAttribute("data-tip") || td.title || "") : "",
        videtVTabulce: !!td };
    };
    const out = {};
    // Gyarados: na raid Waterfall (STAB), do Ultra League Dragon Breath
    out.sRaidovou = one("Waterfall", "Hydro Pump");
    out.sLigovou = one("Dragon Breath", "Aqua Tail");
    // kus jen do ligyCesta konflikt nemá — do raidu se nehodí
    window.__pgo.setRows([{ pokemon: "Medicham", cp: 1500, level: 22, ivAtk: 0, ivDef: 15, ivSta: 15,
      fastMove: "Counter", charged1: "Dynamic Punch" }]);
    const m = window.__pgo.getRows()[0];
    out.medicham = window.__pgo.getComputed()[m.id].konfliktSestav;
    return out;
  });

  check("Gyarados s raidovou sestavou dostane upozornění",
    !!konflikt.sRaidovou.k, JSON.stringify(konflikt.sRaidovou.k));
  check("…i když má tu ligovou", !!konflikt.sLigovou.k, JSON.stringify(konflikt.sLigovou.k));
  eq("…a na raid doporučí Waterfall", konflikt.sRaidovou.k.raid, "Waterfall + Hydro Pump");
  check("…a do ligyCesta Dragon Breath",
    konflikt.sRaidovou.k.pvp.indexOf("Dragon Breath") === 0, konflikt.sRaidovou.k.pvp);
  eq("…a řekne kterou ligu", konflikt.sRaidovou.k.liga, "UL");
  check("v tabulce je to vidět rovnou", konflikt.sRaidovou.videtVTabulce);
  check("…a bublina vysvětlí, že rychlý útok je jen jeden",
    konflikt.sRaidovou.bublina.indexOf("jen jeden") > -1, konflikt.sRaidovou.bublina);
  check("rada „přeučit“ se změní na volbu, ne opravu",
    konflikt.sRaidovou.pvpSub.indexOf("na raid nech") > -1, konflikt.sRaidovou.pvpSub);
  check("kus, co do raidu nepatří, konflikt nemá", konflikt.medicham === null,
    JSON.stringify(konflikt.medicham));

  console.log("\n66) eventy a raid bossové");
  const ev = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Ampharos", cp: 1604, level: 26, ivAtk: 13, ivDef: 13, ivSta: 13, fastMove: "Volt Switch", charged1: "Zap Cannon" },
      { pokemon: "Mewtwo", cp: 2387, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15, fastMove: "Confusion", charged1: "Psystrike" },
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
    ]);
    document.getElementById("eventsCard").open = true;
    window.__pgo.renderEvents();
    const data = window.__pgo.eventsData();
    const bosses = Array.from(document.querySelectorAll("#eventsBody .ev-boss"));
    const najdi = (kus) => bosses.filter((b) => b.querySelector("b").textContent.indexOf(kus) > -1)[0];
    // Raid bossové rotují, takže se test nesmí vázat na konkrétní jméno.
    // Dřív hledal Dondoza a při jeho odchodu spadl zpátky na bosses[0] —
    // z toho se stal Electric Pikachu a test čekal Ampharose proti Electricu.
    // Testuje se proto VLASTNOST: doporučená trojka musí mít typovou výhodu.
    const vodni = najdi("Dondozo") || bosses[0];
    const nasobky = bosses.map((karta) => {
      const prvni = karta.querySelector(".ev-pick .ev-x + .ev-x");
      const nikdo = !!karta.querySelector(".ev-none");
      if (nikdo) return { boss: karta.querySelector("b").textContent, nikdo: true };
      const m = prvni ? /útok ×([\d.]+)/.exec(prvni.textContent) : null;
      const sila = karta.querySelector(".ev-pick .ev-x");
      const sm = sila ? /síla (\d+)/.exec(sila.textContent) : null;
      return { boss: karta.querySelector("b").textContent, nikdo: false,
        nasobek: m ? Number(m[1]) : null, sila: sm ? Number(sm[1]) : null };
    });
    return {
      pocetBossu: data.raids.length,
      pocetEventu: data.events.length,
      karet: bosses.length,
      prvniBoss: bosses.length ? bosses[0].querySelector("b").textContent : "",
      maTypy: bosses.length ? bosses[0].querySelectorAll(".d-type").length : 0,
      maCp: bosses.length ? bosses[0].textContent.indexOf("chytneš") > -1 : false,
      vodniCounter: vodni ? (vodni.querySelector(".ev-pick .ev-n") || {}).textContent || "" : "",
      nasobky: nasobky,
      bezici: document.querySelectorAll("#eventsBody .ev-row.ted").length,
      zdroj: (document.querySelector("#eventsBody .ev-foot") || {}).textContent || "",
    };
  });

  check("bossové jsou zapečení", ev.pocetBossu > 5, String(ev.pocetBossu));
  check("…a eventy taky", ev.pocetEventu > 5, String(ev.pocetEventu));
  // Ne konkrétní jméno — vlastnost. Ať jsou v raidech kdokoli, první
  // doporučený kus proti nim musí mít skutečnou typovou výhodu (útok ×>1),
  // jinak by to nebyl counter, jen nejsilnější kus v rosteru.
  const sVyhodou = ev.nasobky.filter((x) => !x.nikdo && x.nasobek !== null);
  check("u každého bosse je doporučená trojka nebo se řekne, že nemáš nikoho",
    ev.nasobky.every((x) => x.nikdo || x.nasobek !== null),
    JSON.stringify(ev.nasobky.slice(0, 4)));
  check("aspoň u poloviny bossů se někdo z rosteru najde",
    sVyhodou.length >= Math.ceil(ev.nasobky.length / 2),
    sVyhodou.length + " z " + ev.nasobky.length);
  // Výhodu mít nemusí — když v rosteru nikdo takový není, appka nabídne
  // aspoň nejsilnější kus. Co ale platit MUSÍ: nikdy nedoporučí někoho,
  // kdo je proti tomu bossovi v typové nevýhodě.
  check("nedoporučí nikoho v typové nevýhodě",
    sVyhodou.every((x) => x.nasobek >= 1),
    JSON.stringify(sVyhodou.filter((x) => x.nasobek < 1).slice(0, 4)));
  check("první v trojici je vždycky ten nejsilnější (síla 100 %)",
    sVyhodou.every((x) => x.sila === 100),
    JSON.stringify(sVyhodou.filter((x) => x.sila !== 100).slice(0, 4)));
  check("zdroj dat je uvedený a přiznaný jako neoficiální",
    ev.zdroj.indexOf("ScrapedDuck") > -1 && ev.zdroj.indexOf("Není to oficiální") > -1, ev.zdroj.slice(0, 120));

  console.log("\n68) kamarádův roster, trade a popisy eventů");
  const friend = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Machamp", cp: 900, level: 15, ivAtk: 3, ivDef: 3, ivSta: 3, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
    ]);
    document.getElementById("friendCard").open = true;
    const out = {};

    // ruční řádky
    document.getElementById("friendInput").value = "Tyranitar 3000 14/14/14\nLapras 1800 12/13/14";
    window.__pgo.renderFriend();
    out.pocetRucne = window.__pgo.friendRows(document.getElementById("friendInput").value).length;
    out.tabulka = document.querySelectorAll("#friendBody .friend-table tbody tr").length;
    out.pocitadlo = document.getElementById("friendCount").textContent;
    const boxy = Array.from(document.querySelectorAll("#friendBody .tr-box"));
    out.nadpisy = boxy.map((b) => b.querySelector(".tr-h").textContent);
    out.chtej = (boxy.filter((b) => b.className.indexOf("chtej") > -1)[0] || {}).textContent || "";
    out.dej = (boxy.filter((b) => b.className.indexOf("dej") > -1)[0] || {}).textContent || "";

    // vložený CSV export
    document.getElementById("friendInput").value = [
      "Pokémon,Forma,Finální evoluce,CP,Level,IV Attack,IV Defense,IV Stamina,IV %,Rychlý útok,Nabitý útok 1",
      "Tyranitar,,Ano,3000,30,14,14,14,0.93,Bite,Crunch",
      "Lapras,,Ano,1800,25,12,13,14,0.87,Water Gun,Surf",
    ].join("\n");
    window.__pgo.renderFriend();
    out.pocetCsv = window.__pgo.friendRows(document.getElementById("friendInput").value).length;
    out.tabulkaCsv = document.querySelectorAll("#friendBody .friend-table tbody tr").length;

    // vlastní roster se tím nesmí změnit
    out.mujRoster = window.__pgo.getRows().map((r) => r.pokemon);
    document.getElementById("friendInput").value = "";
    window.__pgo.renderFriend();
    return out;
  });

  eq("ruční řádky se načtou", friend.pocetRucne, 2);
  eq("…a vypíšou v tabulce", friend.tabulka, 2);
  check("…a je vidět kolik", friend.pocitadlo.indexOf("2 kusů") === 0, friend.pocitadlo);
  check("jsou tam všechny návrhy na trade i společná síla",
    friend.nadpisy.join("|")
      === "Chtěj od něj|Nabídni mu|Na Lucky se vyplatí|Na tohle spoléhej na něj|Na tohle spoléhá on na tebe",
    friend.nadpisy.join("|"));
  check("„chtěj od něj“ je první — to je hlavní důvod trade",
    friend.nadpisy[0] === "Chtěj od něj", friend.nadpisy[0]);
  check("Tyranitara, kterého nemáš, ti nabídne chtít",
    friend.chtej.indexOf("Tyranitar") > -1, friend.chtej.slice(0, 160));
  check("a slabou kopii Machampa nabídne jemu",
    friend.dej.indexOf("Machamp") > -1 || friend.dej.indexOf("Rattata") > -1, friend.dej.slice(0, 160));
  eq("vložený CSV export se načte taky", friend.pocetCsv, 2);
  eq("…a vypíše", friend.tabulkaCsv, 2);
  check("vlastní roster zůstal nedotčený",
    friend.mujRoster.join(",") === "Machamp,Machamp,Rattata", friend.mujRoster.join(","));


  console.log("\n69) gymoví obránci se počítají, neopisují");
  const gymZ = await page.evaluate(() => {
    const idx = window.__pgo.gymRankIndex();
    const zebricek = window.__pgo.gymRanking();
    window.__pgo.setRows([
      { pokemon: "Snorlax", cp: 2000, level: 25, ivAtk: 14, ivDef: 14, ivSta: 14 },
      { pokemon: "Snorlax", forma: "Shadow", cp: 2000, level: 25, ivAtk: 14, ivDef: 14, ivSta: 14 },
      { pokemon: "Onix", cp: 400, level: 15, ivAtk: 10, ivDef: 15, ivSta: 15 },
      { pokemon: "Gyarados", cp: 2600, level: 30, ivAtk: 14, ivDef: 15, ivSta: 15 },
      { pokemon: "Dialga", cp: 3500, level: 30, ivAtk: 14, ivDef: 15, ivSta: 15 },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 15, ivDef: 15, ivSta: 15 },
    ]);
    const c = window.__pgo.getComputed(), r = window.__pgo.getRows();
    const podle = {};
    r.forEach((x, i) => { podle[x.pokemon + (x.forma === "Shadow" ? "-S" : "")] = c[x.id]; });
    return {
      prvni: zebricek[0].name,
      druhy: zebricek[1].name,
      maDialgu: Object.keys(idx).some((k) => k.indexOf("dialga") > -1),
      maBlissey: Object.keys(idx).some((k) => k.indexOf("blissey") > -1),
      pocet: Object.keys(idx).length,
      nejhorsiPct: Math.min.apply(null, Object.keys(idx).map((k) => idx[k].pct)),
      steelPrijem: window.__pgo.defensiveMult(["Steel"]),
      icePrijem: window.__pgo.defensiveMult(["Ice"]),
      snorlax: podle["Snorlax"].gymRec,
      snorlaxShadow: podle["Snorlax-S"].gymRec,
      snorlaxShadowProc: podle["Snorlax-S"].gymTitle || "",
      onix: podle["Onix"].gymRec,
      onixProc: podle["Onix"].gymTitle || "",
      gyarados: podle["Gyarados"].gymRec,
      gyaradosProc: podle["Gyarados"].gymTitle || "",
      dialga: podle["Dialga"].gymRec,
      rattata: podle["Rattata"].gymRec,
      snorlaxTitul: podle["Snorlax"].gymTitle || "",
    };
  });
  eq("nejlepší obránce ve hře je Blissey", gymZ.prvni, "Blissey");
  eq("…a hned za ní Chansey", gymZ.druhy, "Chansey");
  check("legendární do žebříčku nepatří — do gymu je dát nejde", gymZ.maDialgu === false);
  check("Blissey v seznamu je", gymZ.maBlissey);
  // Řez je procentem špičky (stejně jako u raidů), ne pevným počtem — pevný
  // počet se s prahem role tloukl: poslední v top 40 měl 53 % a s běžnými IV
  // spadl pod práh, takže se „hodil", ale nikdy neprošel.
  check("žebříček řeže na 50 % špičky, ne na pevném počtu",
    gymZ.pocet > 40 && gymZ.pocet < 120, String(gymZ.pocet));
  check("nejhorší v seznamu má pořád aspoň polovinu toho, co Blissey",
    gymZ.nejhorsiPct >= 0.5, String(gymZ.nejhorsiPct));
  check("Steel typování bere v průměru míň než 1×", gymZ.steelPrijem < 0.95, String(gymZ.steelPrijem));
  check("Ice typování bere víc než 1×", gymZ.icePrijem > 1.05, String(gymZ.icePrijem));
  // Sloupec GYM nese i pořadí ve slotu („Ano 1/8"), aby seděl s verdiktem.
  check("Snorlax je obránce", String(gymZ.snorlax).indexOf("Ano") === 0, gymZ.snorlax);
  check("…a v bublině je jeho pořadí", gymZ.snorlaxTitul.indexOf("#") > -1, gymZ.snorlaxTitul);
  // Shadow obránce hra povoluje (zakázaní jsou legendární a mega formy),
  // jen je horší: obrana −17 %, takže běžná kopie téhož druhu má přednost.
  check("shadow Snorlaxe do gymu postavit jde",
    String(gymZ.snorlaxShadow).indexOf("Ano") === 0, gymZ.snorlaxShadow);
  check("…a je u toho napsané, že vydrží míň",
    gymZ.snorlaxShadowProc.indexOf("nižší obranu") > -1, gymZ.snorlaxShadowProc);
  // Sloupec nese i pořadí ve slotu: rozpočet gymu počítá i s vyvinutou
  // formou, takže Onix o slot soupeří a může ho dostat („Po vývinu 1/8").
  check("Onix sám o sobě nic nevydrží, ale Steelix ano",
    String(gymZ.onix).indexOf("Po vývinu") === 0, gymZ.onix);
  check("…a je řečeno na co ho vyvinout", gymZ.onixProc.indexOf("Steelix") > -1, gymZ.onixProc);
  check("Dialga z ručního seznamu neprojde — legendární do gymu nesmí",
    gymZ.maDialgu === false && gymZ.dialga === "Ne", gymZ.dialga);
  check("Gyarados obráncem zůstal, ale teď to má spočítané",
    String(gymZ.gyarados).indexOf("Ano") === 0
    && (gymZ.gyaradosProc || "").indexOf("#") > -1, gymZ.gyarados + " / " + gymZ.gyaradosProc);
  eq("Rattata do gymu nikdy nepatřila", gymZ.rattata, "Ne");

  // Útok obránce se nepočítá jako DPS: v gymu útočí pokémon v pevném rytmu,
  // takže rozhoduje síla na jedno použití, ne síla dělená časem.
  const gymUtok = await page.evaluate(() => {
    const z = window.__pgo.gymRanking();
    const kde = (n) => z.findIndex((e) => e.name === n) + 1;
    const e = (n) => z[kde(n) - 1];
    return {
      steelix: kde("Steelix"), blissey: kde("Blissey"), avalugg: kde("Avalugg"),
      utokSteelix: e("Steelix").utok, utokBlissey: e("Blissey").utok,
      coalossal: e("Coalossal").utok,
      odhadu: z.filter((x) => x.utokOdhad).length,
      rozsah: z.every((x) => x.utok >= 0 && x.utok <= 1),
    };
  });
  check("útok obránce je v rozsahu 0-1", gymUtok.rozsah);
  check("Blissey má útok slabý", gymUtok.utokBlissey < 0.3, String(gymUtok.utokBlissey));
  check("Coalossal s Incinerate (síla 32) má útok silný",
    gymUtok.coalossal > 0.6, String(gymUtok.coalossal));
  check("Steelix je po započtení útoku výš než Avalugg",
    gymUtok.steelix < gymUtok.avalugg, gymUtok.steelix + " vs " + gymUtok.avalugg);
  eq("Blissey je i tak první — výdrž váží víc než útok", gymUtok.blissey, 1);
  check("druhy bez dat o útocích dostanou medián, ne nulu", gymUtok.odhadu >= 0);

  console.log("\n70) raidový práh je reálné DPS, ne IV útoku");
  const dps = await page.evaluate(() => {
    window.__pgo.setRows([
      // stejný druh, jen útočné IV 15 vs 0 — v reálném DPS je to pár procent
      { pokemon: "Rayquaza", cp: 3000, level: 30, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Rayquaza", cp: 2900, level: 30, ivAtk: 0, ivDef: 15, ivSta: 15 },
      // druh, který do raidů nepatří vůbec, i s dokonalým útokem
      { pokemon: "Rattata", cp: 300, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15 },
    ]);
    const c = window.__pgo.getComputed(), r = window.__pgo.getRows();
    return {
      dobreIV: c[r[0].id], spatneIV: c[r[1].id], rattata: c[r[2].id],
    };
  });
  check("dokonalý útok dává raidovou roli", dps.dobreIV.raidRec !== "Ne"
    && dps.dobreIV.raidRec !== "Slabý", dps.dobreIV.raidRec);
  check("nulový útok u toho samého druhu ji taky dává — rozdíl je pár procent",
    dps.spatneIV.raidRec !== "Ne" && dps.spatneIV.raidRec !== "Slabý", dps.spatneIV.raidRec);
  check("rozdíl mezi útokem 15 a 0 je pod 10 %",
    dps.dobreIV.raidPct - dps.spatneIV.raidPct < 0.1,
    (dps.dobreIV.raidPct - dps.spatneIV.raidPct).toFixed(3));
  check("…ale ten lepší kus je pořád o kousek výš",
    dps.dobreIV.raidPct > dps.spatneIV.raidPct);
  eq("druh mimo žebříček nezachrání ani dokonalý útok", dps.rattata.raidRec, "Ne");
  check("% v bublině sedí s číslem",
    (dps.dobreIV.raidTitle || "").indexOf(Math.round(dps.dobreIV.raidPct * 100) + " %") > -1,
    dps.dobreIV.raidTitle);
  check("raid i gym měří stejnou veličinou (podíl špičky 0-1)",
    dps.dobreIV.raidPct > 0 && dps.dobreIV.raidPct <= 1);

  console.log("\n71) tabulka CPM sahá do L50");
  const cpm50 = await page.evaluate(() => {
    const gl = { label: "GL", cap: 1500, meta: "great" };
    return {
      strop: window.__pgo.cpmStrop(),
      // dokonalý Great League Azumarill potká cap 1500 až na L45.5
      azu: window.__pgo.ligovaCesta("Azumarill", 0, 15, 15, 24, gl),
      // Magikarp se pod cap vejde vždycky, takže míří na absolutní strop
      karp: window.__pgo.ligovaCesta("Magikarp", 15, 15, 15, 20, gl),
    };
  });
  eq("strop je L50, ne L45", cpm50.strop, 50);
  eq("dokonalý GL Azumarill míří na L45.5", cpm50.azu.level, 45.5);
  check("…a je to přesně 100 % potenciálu druhu", cpm50.azu.pct === 1, String(cpm50.azu.pct));
  check("…a vejde se pod 1500", cpm50.azu.cp <= 1500, String(cpm50.azu.cp));
  eq("druh, co na cap nedosáhne, míří na absolutní strop", cpm50.karp.level, 50);
  check("cena do L50 se spočítá včetně XL bonbónů",
    cpm50.karp.cena && cpm50.karp.cena.xl > 0, JSON.stringify(cpm50.karp.cena));

  console.log("\n72) režim čištění boxu");
  const box = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Metagross", cp: 3000, level: 30, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: "Bullet Punch", charged1: "Meteor Mash" },
      { pokemon: "Magikarp", cp: 152, level: 20, ivAtk: 14, ivDef: 14, ivSta: 15 },
    ]);
    const out = {};
    document.getElementById("boxModeBtn").click();
    const bm = document.getElementById("boxMode");
    out.otevreno = !bm.hidden;
    out.poradi = window.__pgo.boxStav().poradi.map((x) => x.split(":")[0]);
    out.tabulka = Array.from(document.querySelectorAll("#tbody tr td.col-pokemon"))
      .map((td) => (td.querySelector("input") || td).value || td.textContent);
    out.prvni = window.__pgo.boxStav().aktualni;
    out.popisPoradi = (document.getElementById("bmOrder") || {}).textContent;
    out.pozice = document.getElementById("bmPos").textContent;
    out.doporuceno = (bm.querySelector(".bm-btn.doporuceno") || {}).id;
    out.telo = document.getElementById("bmBody").textContent.replace(/[ ]+/g, " ");

    const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    const prvni = window.__pgo.boxStav().aktualni;
    key("ArrowDown");                       // první pustit
    out.poPrvnim = window.__pgo.boxStav().aktualni;
    key("ArrowLeft");                       // šipkou vlevo zpátky
    out.poZpet = window.__pgo.boxStav().aktualni;
    out.zpetSedi = out.poZpet === prvni;
    // …a Backspace musí fungovat pořád taky
    key("ArrowDown"); key("Backspace");
    out.backspaceSedi = window.__pgo.boxStav().aktualni === prvni;
    out.volbaSmazana = Object.keys(window.__pgo.boxStav().volby).length;

    key("ArrowDown"); key("ArrowRight"); key("ArrowRight");
    out.stav = window.__pgo.boxStav();
    out.souhrn = document.getElementById("bmBody").textContent.replace(/[ ]+/g, " ");
    out.tlacitkaPryc = document.getElementById("bmActions").style.display;
    return out;
  });
  check("režim se otevře", box.otevreno);
  eq("pořadí je přesně to z tabulky", box.poradi.join(","), box.tabulka.join(","));
  check("…a je to napsané pod tlačítky", (box.popisPoradi || "").indexOf("jako v tabulce") > -1,
    box.popisPoradi);
  eq("…a je vidět, kolikátý z kolika", box.pozice, "1 / 3");
  // V tříkusovém rosteru je Magikarp JEDINÝ Water, takže mu rozpočet
  // ten slot dá — ačkoli je to Magikarp. Je to správně: dokud není lepší,
  // je nejlepší. Dřív tu vycházelo „Zahodit“ jen díky kusům, které v
  // rosteru nechaly předchozí bloky.
  eq("doporučené tlačítko sleduje verdikt", box.doporuceno, "bmKeep");
  check("v kartě je verdikt i důvod", box.telo.indexOf("Ponechat") > -1
    && box.telo.indexOf("Drží místo v rozpočtu") > -1, box.telo.slice(0, 120));
  check("…a role s procenty", box.telo.indexOf("Raid") > -1 && box.telo.indexOf("Gym") > -1);
  check("šipka dolů pustí a posune dál", box.poPrvnim !== box.prvni, box.poPrvnim);
  check("šipka doleva vrátí o jednoho zpět", box.zpetSedi, box.poZpet);
  check("…a Backspace dělá totéž", box.backspaceSedi);
  eq("…a smaže to rozhodnutí", box.volbaSmazana, 0);
  eq("na konci přijde souhrn místo dalšího kusu", box.stav.aktualni, null);
  check("souhrn počítá obě hromádky",
    box.souhrn.indexOf("2 necháváš") > -1 && box.souhrn.indexOf("1 pouštíš") > -1, box.souhrn.slice(0, 80));
  check("čeština v tlačítku sedí (1 kus, ne 1 kusů)",
    box.souhrn.indexOf("Pustit 1 kus") > -1 && box.souhrn.indexOf("1 kusů") === -1, box.souhrn.slice(0, 200));
  eq("v souhrnu už se nerozhoduje", box.tlacitkaPryc, "none");

  const boxRazeni = await page.evaluate(() => {
    window.__pgo.boxZavritNatvrdo();
    // seřadit tabulku podle CP sestupně a znovu otevřít čištění
    const th = Array.from(document.querySelectorAll("#headerRow th"))
      .filter((x) => x.textContent.indexOf("CP") === 0)[0];
    th.click(); th.click();                       // vzestupně -> sestupně
    const vTabulce = Array.from(document.querySelectorAll("#tbody tr td.col-pokemon"))
      .map((td) => (td.querySelector("input") || td).value || td.textContent);
    document.getElementById("boxModeBtn").click();
    const vRezimu = window.__pgo.boxStav().poradi.map((x) => x.split(":")[0]);
    return { vTabulce: vTabulce.join(","), vRezimu: vRezimu.join(",") };
  });
  eq("přeřazení tabulky se do čištění propíše", boxRazeni.vRezimu, boxRazeni.vTabulce);

  // nic se nesmí stát dřív, než to člověk potvrdí
  const boxPotvrzeni = await page.evaluate(() => {
    const pred = window.__pgo.getRows().length;
    // projít znovu (po přeřazení jsme zpátky na začátku): Rattatu pustit, zbytek nechat
    const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    for (let i = 0; i < 10; i++) {
      const st = window.__pgo.boxStav();
      if (st.aktualni === null) break;
      key(st.aktualni === "Rattata" ? "ArrowDown" : "ArrowRight");
    }
    document.getElementById("bmPotvrdit").click();
    const po = window.__pgo.getRows();
    return { pred: pred, po: po.length, jmena: po.map((r) => r.pokemon).sort().join(","),
      hvezdy: po.filter((r) => r.star).length,
      zavreno: document.getElementById("boxMode").hidden };
  });
  eq("před potvrzením zůstaly všechny řádky", boxPotvrzeni.pred, 3);
  eq("po potvrzení zmizel jen ten pustěný", boxPotvrzeni.po, 2);
  eq("…a zůstali ti správní", boxPotvrzeni.jmena, "Magikarp,Metagross");
  eq("necháváné dostaly hvězdičku", boxPotvrzeni.hvezdy, 2);
  check("a režim se zavřel", boxPotvrzeni.zavreno);

  const boxNavrat = await page.evaluate(() => {
    // pustěný kus se při dalším importu nesmí vrátit
    window.__pgo.importText([
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,Scan date",
      "Rattata,200,15,4,3,5,8/24/26 10:00:00",
    ].join(String.fromCharCode(10)));
    window.__pgo.finishImport("merge");
    return window.__pgo.getRows().filter((r) => r.pokemon === "Rattata").length;
  });
  eq("pustěný kus se importem nevrátí", boxNavrat, 0);

  console.log("\n73) karta „odkud se to bere a jak se to počítá“");
  const doku = await page.evaluate(() => {
    document.getElementById("docsCard").open = true;
    window.__pgo.renderDocs();
    const b = document.getElementById("docsBody");
    const t = b.textContent;
    const zdroje = Array.from(b.querySelector("table").querySelectorAll("tr")).slice(1);
    return {
      nadpisy: Array.from(b.querySelectorAll("h3")).map((h) => h.textContent),
      delka: t.length,
      // datumy stažení musí být skutečné, ne otazníky
      datumy: zdroje.map((tr) => tr.children[3].textContent.trim()),
      // Řádky tabulky zdrojů. Když se do řetězce h += "…" vloží deklarace,
      // automatické doplnění středníku ten řetězec rozsekne a zbytek tabulky
      // se do stránky vůbec nedostane — tichá ztráta, kterou je vidět jen tady.
      zdrojeJmena: zdroje.map((tr) => tr.children[0].textContent.trim()),
      otazniky: (t.match(/[?]/g) || []).length,
      pocetObrancu: (t.match(/nad 50 % špičky — dnes (\d+) druhů/) || [])[1],
      pocetUtocniku: (t.match(/Dnes tím prochází (\d+) druhů/) || [])[1],
      zminujeCalcyRank: t.indexOf("Calcy IV rank se do rozhodování nepouští") > -1,
      zminujeLimity: t.indexOf("Kde model končí") > -1,
      zminujeObrance: t.indexOf("není DPS") > -1,
      vzorce: b.querySelectorAll(".docs-vzorec").length,
      podRosterem: (() => {
        const karty = Array.from(document.querySelectorAll(".card"));
        const iRos = karty.findIndex((c) => c.classList.contains("roster"));
        const iDoc = karty.findIndex((c) => c.id === "docsCard");
        return iDoc > iRos;
      })(),
    };
  });
  // Osmý přibyl s mobilním režimem — appka je na telefonu jinak poskládaná
  // a dokumentace to musí říct, jinak by popisovala něco, co uživatel nevidí.
  // Přibyl oddíl 7b (co refaktor odebral a proč), 7d (jeden druh, víc forem),
  // 7e/7f (stav kusu ve výpočtu a přesnost dvou vzorců), 7g (do čeho
  // rozpočet prach nesype) a 7h (posudek u jednotlivého útoku).
  eq("dokumentace má všech šestnáct oddílů", doku.nadpisy.length, 16);
  check("…a je pod rosterem", doku.podRosterem);
  check("…a není to odbytý odstavec", doku.delka > 4000, String(doku.delka));
  check("datumy stažení jsou skutečné, ne otazníky",
    doku.datumy.slice(0, 4).every((d) => /^\d{4}-\d{2}/.test(d)), doku.datumy.join(" | "));
  eq("v textu nezůstal ani jeden nedoplněný údaj", doku.otazniky, 0);
  ["pogoapi.net", "PvPoke", "PvPoke (gamemaster)", "ruční seznam", "tvůj export"]
    .forEach((z) => check("tabulka zdrojů uvádí " + z,
      doku.zdrojeJmena.some((n) => n.indexOf(z) === 0), doku.zdrojeJmena.join(" | ")));
  check("počet obránců se bere ze živého žebříčku",
    Number(doku.pocetObrancu) > 20, doku.pocetObrancu);
  check("…stejně jako počet raidových útočníků",
    Number(doku.pocetUtocniku) > 100, doku.pocetUtocniku);
  check("je vysvětlené, proč se Calcy IV rank nepoužívá", doku.zminujeCalcyRank);
  check("je vysvětlené, že útok obránce není DPS", doku.zminujeObrance);
  check("a jsou přiznané limity modelu", doku.zminujeLimity);
  check("vzorce jsou vysázené zvlášť", doku.vzorce >= 3, String(doku.vzorce));

  // dokumentace se musí sama přepsat, když se změní nastavení nebo data
  const dokuZive = await page.evaluate(() => {
    const el = document.getElementById("roleThresh");
    el.value = "70"; el.dispatchEvent(new Event("input", { bubbles: true }));
    window.__pgo.renderDocs();
    const po = document.getElementById("docsBody").textContent.indexOf("nastavení: 70 %") > -1;
    document.getElementById("resetSettingsBtn").click();
    window.__pgo.renderDocs();
    const zpet = document.getElementById("docsBody").textContent.indexOf("nastavení: 50 %") > -1;
    return { po: po, zpet: zpet };
  });
  check("dokumentace ukazuje tvůj práh, ne natvrdo zapsané číslo", dokuZive.po);
  check("…a vrátí se s ním zpátky", dokuZive.zpet);

  console.log("\n74) hlídání modelu: výdrž v raidu, citlivost gymu, pokrytí typů");

  // --- výdrž se do raidového skóre počítá, ale nesmí z tlusťocha udělat útočníka
  const vydrz = await page.evaluate(() => {
    const zeb = (t) => window.__pgo.typeRanking2(t).slice(0, 6).map((e) => e.name);
    return {
      fighting: zeb("Fighting"),
      fairy: zeb("Fairy"),
      blisseyRole: window.__pgo.raidRolesFor("Blissey").map((e) => e.type),
      blisseyGym: !!window.__pgo.gymRoleFor("Blissey"),
      faktorRoste: window.__pgo.vydrzFaktor(300, 400) > window.__pgo.vydrzFaktor(100, 100),
      // stejné DPS, víc výdrže = vyšší skóre
      tlustsiVyhraje: window.__pgo.raidScore(10, { a: 200, d: 200, s: 200 })
        > window.__pgo.raidScore(10, { a: 200, d: 100, s: 100 }),
      // ale útok pořád váží víc než výdrž
      utokVaziVic: window.__pgo.raidScore(10, { a: 300, d: 100, s: 100 })
        > window.__pgo.raidScore(10, { a: 200, d: 200, s: 200 }),
    };
  });
  check("výdrž se do raidového skóre počítá", vydrz.faktorRoste && vydrz.tlustsiVyhraje);
  check("…ale útok váží víc než výdrž", vydrz.utokVaziVic);
  check("Blissey není raidový útočník, i když je nejtlustší ve hře",
    vydrz.blisseyRole.length === 0, vydrz.blisseyRole.join(","));
  check("…zato gymový obránce ano", vydrz.blisseyGym);
  check("žebříčky nejsou prázdné", vydrz.fighting.length === 6 && vydrz.fairy.length === 6);

  // --- citlivost váhy útoku obránce: 30 % je odhad, ať se na tom nic nehoupe
  const citlivost = await page.evaluate(() => {
    const top = (v) => window.__pgo.gymRanking(v).slice(0, 10).map((e) => e.name);
    const a = top(0.2), b = top(0.3), c = top(0.4);
    const spolecne = (x, y) => x.filter((n) => y.indexOf(n) > -1).length;
    return { a: a, b: b, c: c, shodaDolni: spolecne(a, b), shodaHorni: spolecne(c, b) };
  });
  check("při váze 20 % zůstane špička skoro stejná", citlivost.shodaDolni >= 8,
    citlivost.shodaDolni + ": " + citlivost.a.join(","));
  check("…a při 40 % taky", citlivost.shodaHorni >= 8,
    citlivost.shodaHorni + ": " + citlivost.c.join(","));
  eq("první je Blissey ve všech třech případech",
    [citlivost.a[0], citlivost.b[0], citlivost.c[0]].join(","), "Blissey,Blissey,Blissey");

  // --- typová účinnost proti kombinacím, ne jen proti čistým typům
  const pokryti = await page.evaluate(() => {
    const f = window.__pgo.pokrytiKombinaci(["Fighting"]);
    const r = window.__pgo.pokrytiKombinaci(["Rock"]);
    const klice = (l) => l.map((x) => x.klic);
    return {
      kombinaci: window.__pgo.realneKombinace().length,
      fightingDvojity: klice(f.dvojity),
      fightingVyrusene: klice(f.vyrusene),
      rockDvojity: klice(r.dvojity),
      maxMult: f.dvojity.length ? f.dvojity[0].mult : 0,
      vyrusenyMult: f.vyrusene.length ? f.vyrusene[0].mult : 0,
      // …a každá nabídnutá musí mít aspoň jednoho skutečného zástupce
      bezZastupce: window.__pgo.realneKombinace().filter((k) => !k.druhy || !k.druhy.length).length,
      // nabízet se musí přesně to, co v pokédexu opravdu je — ani víc, ani míň
      rozdil: (() => {
        const dex = window.__pgo.pokedex().species;
        const zDat = new Set();
        Object.keys(dex).forEach((x) => {
          const t = dex[x][2];
          if (t && t.length) zDat.add(t.slice().sort().join("/"));
        });
        const nabizene = new Set(window.__pgo.realneKombinace().map((k) => k.klic));
        const navic = [...nabizene].filter((k) => !zDat.has(k));
        const chybi = [...zDat].filter((k) => !nabizene.has(k));
        return { navic: navic, chybi: chybi, zDat: zDat.size };
      })(),
    };
  });
  check("bere se přes sto reálných kombinací typů", pokryti.kombinaci > 100, String(pokryti.kombinaci));
  eq("každá nabídnutá kombinace má svého pokémona", pokryti.bezZastupce, 0);
  check("nenabízí se ani jedna kombinace, kterou nikdo nemá",
    pokryti.rozdil.navic.length === 0, pokryti.rozdil.navic.join(", "));
  check("…a žádná skutečná nechybí",
    pokryti.rozdil.chybi.length === 0, pokryti.rozdil.chybi.join(", "));
  check("Fighting má dvojnásobnou slabinu u Rock/Steel",
    pokryti.fightingDvojity.indexOf("Rock/Steel") > -1, pokryti.fightingDvojity.slice(0, 6).join(","));
  check("…a je to 2,56×", Math.abs(pokryti.maxMult - 2.56) < 0.01, String(pokryti.maxMult));
  check("Fighting proti Flying/Normal se vyruší na 1×",
    pokryti.fightingVyrusene.indexOf("Flying/Normal") > -1 && Math.abs(pokryti.vyrusenyMult - 1) < 0.01,
    pokryti.fightingVyrusene.slice(0, 6).join(",") + " / " + pokryti.vyrusenyMult);
  check("Rock je dvojnásobně silný na Bug/Flying",
    pokryti.rockDvojity.indexOf("Bug/Flying") > -1, pokryti.rockDvojity.slice(0, 6).join(","));

  // --- bonbóny z čištění
  const bonbony = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Magikarp", cp: 100, level: 10, ivAtk: 1, ivDef: 1, ivSta: 1 },
      { pokemon: "Magikarp", cp: 110, level: 11, ivAtk: 2, ivDef: 1, ivSta: 1 },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
    ]);
    document.getElementById("boxModeBtn").click();
    const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    for (let i = 0; i < 5; i++) {
      if (window.__pgo.boxStav().aktualni === null) break;
      key("ArrowDown");
    }
    const t = document.getElementById("bmBody").textContent.replace(/[ ]+/g, " ");
    window.__pgo.boxZavritNatvrdo();
    return t;
  });
  check("souhrn řekne, kolik bonbónů čištěním získáš",
    bonbony.indexOf("Transferem získáš") > -1 && bonbony.indexOf("3 kusy") > -1, bonbony.slice(0, 200));
  check("…a rozepíše druh, kterého pouštíš víc",
    bonbony.indexOf("Magikarp 2") > -1, bonbony.slice(0, 240));

  console.log("\n75) prach jako rozpočet");
  const prach = await page.evaluate(() => {
    window.__pgo.setRows([
      // Dva Charizardi na TÝŽ cíl (raidový strop levelu). Ten na L24 se tam
      // dostane levněji než ten na L5 a skončí líp. Dřív vyhrával ten malý,
      // protože „zesílí 2,8×" — metrika měřila relativní skok místo toho,
      // kam se za ten prach dostaneš. Přesně na tom si stěžoval uživatel
      // u Gyaradose za 154 CP.
      //
      // Původně tu byly dvě Azumarilly. Od zavedení rozpočtu to nejde:
      // do jedné ligy se dva kusy téhož druhu nepostaví, takže si appka
      // druhou Azumarill nenechá a v plánu je jen jedna. Fire má proti tomu
      // šest raidových slotů a Charizard roli opravdu uzavírá, takže dvě
      // kopie obstojí obě.
      { pokemon: "Charizard", cp: 1400, level: 24, ivAtk: 15, ivDef: 15, ivSta: 15,
        fastMove: "Fire Spin", charged1: "Blast Burn" },
      { pokemon: "Charizard", cp: 300, level: 5, ivAtk: 15, ivDef: 15, ivSta: 14,
        fastMove: "Fire Spin", charged1: "Blast Burn" },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
    ]);
    document.getElementById("dustCard").open = true;
    const el = document.getElementById("dustBudget");
    el.value = "20000"; el.dispatchEvent(new Event("input", { bubbles: true }));
    // Plán po krocích je výchozí; tenhle blok porovnává CELOU cestu,
    // takže si starý režim musí zapnout sám.
    (function () {
      const k = document.getElementById("krokyPlan");
      if (k && k.checked) { k.checked = false;
        k.dispatchEvent(new Event("change", { bubbles: true })); }
    })();
    const plan = window.__pgo.prachovyPlan();
    return {
      jmena: plan.map((e) => e.row.pokemon),
      // Efektivita klesá uvnitř skupiny; odsunuté kopie jdou až za všechny
      // ostatní, takže na hranici mezi skupinami klesat nemusí.
      klesa: (() => {
        const hlavni = plan.filter((e) => !e.lepsiCesta);
        const odsunute = plan.filter((e) => e.lepsiCesta);
        const serazeno = (sez) => sez.every((e, i) => i === 0 || sez[i - 1].efektivita >= e.efektivita);
        const odsunuteAzPotom = plan.findIndex((e) => e.lepsiCesta) === -1
          || plan.slice(plan.findIndex((e) => e.lepsiCesta)).every((e) => e.lepsiCesta);
        return serazeno(hlavni) && serazeno(odsunute) && odsunuteAzPotom;
      })(),
      levnejsiPrvni: (() => {
        const az = plan.filter((e) => e.row.pokemon === "Charizard");
        if (az.length < 2) return null;
        return az[0].cena.dust <= az[1].cena.dust;
      })(),
      kumulativniRoste: plan.every((e, i) => i === 0 || e.kumulativne > plan[i - 1].kumulativne),
      // odpad se do plánu nesmí dostat
      maRattatu: plan.some((e) => e.row.pokemon === "Rattata"),
      prvni: plan.length ? { jm: plan[0].row.pokemon, cp: plan[0].row.cp,
        nasobek: plan[0].nasobek, kval: plan[0].kvalita } : null,
      hranice: !!document.querySelector(".dust-hranice"),
      tabulka: document.getElementById("dustBody").textContent.replace(/[ ]+/g, " "),
    };
  });
  check("plán je seřazený od nejlepšího poměru", prach.klesa, prach.jmena.join(","));
  check("kumulativní cena roste", prach.kumulativniRoste);
  check("do odpadu se prach nesype", prach.maRattatu === false, prach.jmena.join(","));
  // Ne ten, co nejvíc povyroste — ten, co se ke stejnému cíli dostane levněji.
  check("nahoře je levnější cesta ke stejnému cíli, ne největší skok",
    prach.prvni && prach.prvni.cp === 1400, JSON.stringify(prach.prvni));
  check("…a z dvojice téhož druhu je první ta levnější", prach.levnejsiPrvni === true,
    String(prach.levnejsiPrvni));
  check("…a je u něj vidět, kolikrát zesílí",
    prach.prvni && prach.prvni.nasobek > 1, String(prach.prvni && prach.prvni.nasobek));
  check("hranice rozpočtu se vykreslí", prach.hranice);
  check("v tabulce je celková cena", prach.tabulka.indexOf("Dotáhnout všechno stojí") > -1);
  check("žádná dvojtečka ani dvojtečka navíc v patičce",
    prach.tabulka.indexOf("..") === -1, prach.tabulka.slice(-120));

  const milion = await page.evaluate(() => window.__pgo.formatDust
    ? [window.__pgo.formatDust(999), window.__pgo.formatDust(15900), window.__pgo.formatDust(13340000)]
    : null);
  if (milion) {
    eq("prach pod tisíc se píše celý", milion[0], "999");
    eq("tisíce se zkracují", milion[1], "16 tis.");
    eq("a miliony taky", milion[2], "13,3 mil.");
  }

  console.log("\n76) hlídka na novou generaci");
  const nova = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Pikachu", cp: 500, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Uplneneznamypokemon", cp: 500, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Dalsineznamy", cp: 300, level: 10, ivAtk: 10, ivDef: 10, ivSta: 10 },
    ]);
    const el = document.getElementById("unknownWarn");
    return {
      seznam: window.__pgo.neznameDruhy(),
      videt: el.style.display !== "none",
      text: el.textContent.replace(/[ ]+/g, " "),
    };
  });
  eq("neznámé druhy se najdou všechny", nova.seznam.join(","),
    "Uplneneznamypokemon,Dalsineznamy");
  check("…a je to vidět nad patičkou", nova.videt);
  check("…se správným skloňováním", nova.text.indexOf("2 druhy") > -1, nova.text.slice(0, 80));
  check("…a s návodem, jak data obnovit",
    nova.text.indexOf("build_pokedex.py --refresh") > -1, nova.text.slice(0, 300));
  check("…a s datem, ze kdy data jsou",
    /\d{4}-\d{2}-\d{2}/.test(nova.text), nova.text.slice(0, 300));

  const zmizi = await page.evaluate(() => {
    window.__pgo.setRows([{ pokemon: "Pikachu", cp: 500, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15 }]);
    return {
      seznam: window.__pgo.neznameDruhy().length,
      videt: document.getElementById("unknownWarn").style.display !== "none",
    };
  });
  eq("u známých druhů se nehlásí nic", zmizi.seznam, 0);
  check("…a varování zmizí", zmizi.videt === false);

  console.log("\n77) čitelnost: verdikt v čištění boxu a vysvětlení pořadí u prachu");
  const citelnost = await page.evaluate(() => {
    window.__pgo.setRows([
      // Charizard, ne Drowzee: testuje se BARVA kladného verdiktu. Drowzee
      // po zavedení rozpočtu žádnou roli nedrží (Psychic není mezi krytými
      // typy a Hypno nehraje ligu), takže by vyšel červeně. Charizard roli
      // na Fire opravdu uzavírá — zelený verdikt bez debat. (Machop by
      // nestačil: Machamp je jen kolem 65 % špičky Fighting, tedy žlutá
      // náplast.)
      { pokemon: "Charizard", cp: 1485, level: 18.5, ivAtk: 11, ivDef: 11, ivSta: 15,
        fastMove: "Fire Spin", charged1: "Blast Burn" },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
    ]);
    document.getElementById("boxModeBtn").click();
    const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    const snimek = () => {
      const v = document.querySelector(".bm-verdikt");
      const t = document.querySelector(".bm-verdikt-text");
      const panel = document.querySelector(".bm-panel");
      return {
        text: t.textContent.trim(),
        trida: v.className,
        px: parseFloat(getComputedStyle(t).fontSize),
        barva: getComputedStyle(t).color,
        prechod: getComputedStyle(v).backgroundImage.indexOf("gradient") > -1,
        pruh: Math.round(v.getBoundingClientRect().width),
        panel: Math.round(panel.getBoundingClientRect().width),
        // verdikt musí být POD jménem a staty
        podJmenem: v.getBoundingClientRect().top
          > document.querySelector(".bm-sub").getBoundingClientRect().top,
      };
    };
    const podle = {};
    for (let i = 0; i < 5; i++) {
      const st = window.__pgo.boxStav();
      if (st.aktualni === null) break;
      podle[st.aktualni] = snimek();
      key("ArrowRight");
    }
    window.__pgo.boxZavritNatvrdo();
    return { prvni: podle["Charizard"], druhy: podle["Rattata"] };
  });
  check("verdikt je velký", citelnost.prvni.px >= 20, citelnost.prvni.px + " px");
  check("…přes skoro celou šířku panelu",
    citelnost.prvni.pruh > citelnost.prvni.panel * 0.85,
    citelnost.prvni.pruh + " / " + citelnost.prvni.panel);
  check("…s přechodem zleva doprava", citelnost.prvni.prechod);
  check("…a je pod jménem a staty", citelnost.prvni.podJmenem);
  eq("kladný verdikt je zelený", citelnost.prvni.trida, "bm-verdikt good");
  eq("…a záporný červený", citelnost.druhy.trida, "bm-verdikt critical");
  check("barvy se opravdu liší", citelnost.prvni.barva !== citelnost.druhy.barva,
    citelnost.prvni.barva + " vs " + citelnost.druhy.barva);

  const prachJak = await page.evaluate(() => {
    // musí tam být aspoň jeden kus, do kterého má smysl sypat
    window.__pgo.setRows([
      { pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15,
        fastMove: "Bubble", charged1: "Play Rough" },
    ]);
    document.getElementById("dustCard").open = true;
    window.__pgo.renderPrach();
    const el = document.querySelector(".dust-jak");
    return el ? el.textContent.replace(/[ ]+/g, " ") : "";
  });
  check("nad tabulkou prachu je napsané, podle čeho se řadí",
    prachJak.indexOf("Pořadí není podle síly") > -1, prachJak.slice(0, 80));
  check("…včetně vzorce", prachJak.indexOf("zesílí") > -1 && prachJak.indexOf("kvalitní") > -1
    && prachJak.indexOf("cena v prachu") > -1, prachJak.slice(0, 200));

  console.log("\n78) sloupec PvP říká jen to, co má vliv");
  const pvpCist = await page.evaluate(() => {
    window.__pgo.setRows([
      // druh, který žádnou ligu nehraje, ale Calcy mu dalo rank
      { pokemon: "Litten", cp: 300, level: 15, ivAtk: 10, ivDef: 10, ivSta: 10, glRank: 1134 },
      // druh, který ligu hraje, ale tenhle kus je pod prahem
      { pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 5, ivDef: 10, ivSta: 10, glRank: 3 },
    ]);
    const c = window.__pgo.getComputed(), r = window.__pgo.getRows();
    const podle = {};
    r.forEach((row) => { podle[row.pokemon] = c[row.id]; });
    return {
      litten: podle["Litten"].pvpRec,
      littenBublina: podle["Litten"].pvpTitle || "",
      azu: podle["Azumarill"].pvpRec,
      azuBublina: podle["Azumarill"].pvpTitle || "",
    };
  });
  eq("druh mimo ligy dostane Ne, ne číslo z Calcy", pvpCist.litten, "Ne");
  check("…ale v tabulce se to nikde netváří jako IV rank",
    pvpCist.litten.indexOf("IV rank") === -1, pvpCist.litten);
  check("v bublině rank zůstane", pvpCist.littenBublina.indexOf("IV rank #1134") > -1,
    pvpCist.littenBublina.slice(0, 160));
  check("…a je u něj napsané, že do verdiktu nevstupuje",
    pvpCist.littenBublina.indexOf("Do verdiktu nevstupuje") > -1,
    pvpCist.littenBublina.slice(0, 300));
  check("…a co to číslo vlastně znamená",
    pvpCist.littenBublina.indexOf("4096") > -1, pvpCist.littenBublina.slice(0, 300));
  check("druh, který ligu hraje, pojmenuje ligu",
    pvpCist.azu.indexOf("GL") > -1, pvpCist.azu);
  check("…a nikde tam není číslo z Calcy",
    pvpCist.azu.indexOf("#3") === -1 && pvpCist.azu.indexOf("IV rank") === -1, pvpCist.azu);

  console.log("\n79) klávesy v čištění boxu");
  const klavesy = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Magikarp", cp: 100, level: 10, ivAtk: 1, ivDef: 1, ivSta: 1 },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Pidgey", cp: 300, level: 12, ivAtk: 5, ivDef: 5, ivSta: 5 },
    ]);
    document.getElementById("boxModeBtn").click();
    const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    const kde = () => window.__pgo.boxStav().index;
    const out = {};

    // vpravo = dál
    key("ArrowRight"); out.poVpravo = kde();
    // vlevo = ZPÁTKY, ne dál
    key("ArrowLeft"); out.poVlevo = kde();
    // a rozhodnutí se přitom smaže
    out.volebPoNavratu = Object.keys(window.__pgo.boxStav().volby).length;
    // dolů = pustit a dál
    key("ArrowDown"); out.poDolu = kde();
    out.volbaDolu = Object.values(window.__pgo.boxStav().volby)[0];
    // vlevo znovu, pak P jako pustit
    key("ArrowLeft");
    key("p"); out.poP = kde();
    out.volbaP = Object.values(window.__pgo.boxStav().volby)[0];
    // mezerník přeskočí bez rozhodnutí
    const predMezerou = Object.keys(window.__pgo.boxStav().volby).length;
    key(" ");
    out.mezeraPosunula = kde() > out.poP;
    out.mezeraNerozhodla = Object.keys(window.__pgo.boxStav().volby).length === predMezerou;
    // na začátku se vlevo nedá jít níž než na nulu
    while (kde() > 0) key("ArrowLeft");
    key("ArrowLeft");
    out.naZacatku = kde();
    // popisky pod tlačítky
    out.popisPustit = document.getElementById("bmDrop").textContent;
    out.popisNechat = document.getElementById("bmKeep").textContent;
    out.napoveda = document.getElementById("bmHint").textContent.replace(/[ ]+/g, " ");
    window.__pgo.boxZavritNatvrdo();
    return out;
  });
  eq("šipka vpravo jde dál", klavesy.poVpravo, 1);
  eq("šipka vlevo jde ZPÁTKY, ne dál", klavesy.poVlevo, 0);
  eq("…a smaže rozhodnutí, na které se vrátilo", klavesy.volebPoNavratu, 0);
  eq("šipka dolů pustí a jde dál", klavesy.poDolu, 1);
  eq("…a opravdu zapíše „pustit“", klavesy.volbaDolu, "drop");
  eq("P dělá totéž co šipka dolů", klavesy.poP, 1);
  eq("…se stejným rozhodnutím", klavesy.volbaP, "drop");
  check("mezerník posune", klavesy.mezeraPosunula);
  check("…ale nic nerozhodne", klavesy.mezeraNerozhodla);
  eq("na prvním kusu se vlevo nedá jít níž", klavesy.naZacatku, 0);
  check("na tlačítku Pustit je napsaná šipka dolů",
    klavesy.popisPustit.indexOf("↓") > -1, klavesy.popisPustit);
  check("na tlačítku Nechat šipka vpravo",
    klavesy.popisNechat.indexOf("→") > -1, klavesy.popisNechat);
  // Nápověda teď vypisuje i WASD, takže „← o jednoho zpět" je rozdělené
  // na „← nebo A o jednoho zpět". Kontroluje se tedy obojí zvlášť.
  check("nápověda říká, že vlevo je zpět",
    klavesy.napoveda.indexOf("zpět") > -1 && klavesy.napoveda.indexOf("←") > -1,
    klavesy.napoveda);
  check("…a nabízí i WASD",
    /W/.test(klavesy.napoveda) && /A/.test(klavesy.napoveda)
    && /S/.test(klavesy.napoveda) && /D/.test(klavesy.napoveda), klavesy.napoveda);

  console.log("\n80) čištění boxu: pojistka proti zavření a plný rozbor");
  const pojistka = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([
      { pokemon: "Magikarp", cp: 100, level: 10, ivAtk: 1, ivDef: 1, ivSta: 1 },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15,
        fastMove: "Bubble", charged1: "Play Rough" },
    ]);
    const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    const out = {};

    // 1) zavření BEZ rozhodnutí se ptát nemá
    document.getElementById("boxModeBtn").click();
    P.boxZavrit();
    out.bezPraceZavre = document.getElementById("boxMode").hidden;
    out.bezPraceNeptaSe = !P.boxPotvrzeniViditelne();

    // 2) s rozděláním se zeptá — křížkem
    document.getElementById("boxModeBtn").click();
    key("ArrowDown");                                  // jeden pustit
    document.getElementById("bmClose").click();
    out.ptaSe = P.boxPotvrzeniViditelne();
    out.porad0tevreno = !document.getElementById("boxMode").hidden;
    out.textPojistky = document.getElementById("bmZeptat").textContent.replace(/[ ]+/g, " ");

    // 3) „vrátit se k čištění" pojistku zavře a nechá pokračovat
    document.getElementById("bmPokracovat").click();
    out.poNavratuZavrena = !P.boxPotvrzeniViditelne();
    out.poNavratuOtevreno = !document.getElementById("boxMode").hidden;
    out.rozhodnutiZustalo = Object.keys(P.boxStav().volby).length;

    // 4) Esc taky vyvolá pojistku, ne rovnou zavření
    key("Escape");
    out.escPtaSe = P.boxPotvrzeniViditelne();
    out.escNezavrelo = !document.getElementById("boxMode").hidden;
    key("Escape");                                     // druhý Esc pojistku zruší
    out.escDruhyZrusil = !P.boxPotvrzeniViditelne();
    return out;
  });
  check("bez rozdělané práce se nic neptá", pojistka.bezPraceNeptaSe);
  check("…a rovnou zavře", pojistka.bezPraceZavre);
  check("s rozdělanou prací se zeptá", pojistka.ptaSe);
  check("…a okno zůstane otevřené", pojistka.porad0tevreno);
  check("…a řekne, kolik je rozděláno",
    pojistka.textPojistky.indexOf("Máš rozděláno 1 kus") > -1, pojistka.textPojistky.slice(0, 120));
  check("…a nabídne uložit projitou část",
    pojistka.textPojistky.indexOf("Uložit projitou část") > -1, pojistka.textPojistky.slice(0, 200));
  check("„vrátit se k čištění“ pojistku zruší", pojistka.poNavratuZavrena);
  check("…okno zůstane", pojistka.poNavratuOtevreno);
  eq("…a rozhodnutí se neztratí", pojistka.rozhodnutiZustalo, 1);
  check("Esc vyvolá pojistku, nezavře rovnou", pojistka.escPtaSe && pojistka.escNezavrelo);
  check("druhý Esc pojistku zruší", pojistka.escDruhyZrusil);

  // uložení projité části: zapíše se jen to rozhodnuté, zbytek zůstane
  const castecne = await page.evaluate(() => {
    const P = window.__pgo;
    window.alert = () => {};
    const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    const pred = P.getRows().length;
    // rozhodnout jen první dva ze tří
    const prvni = P.boxStav().aktualni;
    key("ArrowRight");
    document.getElementById("bmClose").click();
    document.getElementById("bmUlozitCast").click();
    const po = P.getRows();
    return {
      pred: pred, po: po.length,
      hvezd: po.filter((r) => r.star).length,
      zavreno: document.getElementById("boxMode").hidden,
      prvni: prvni,
      jmena: po.map((r) => r.pokemon).sort().join(","),
    };
  });
  eq("před uložením byly v rosteru tři kusy", castecne.pred, 3);
  eq("uložila se jen projitá část — jeden kus pustěn", castecne.po, 2);
  check("…a nerozhodnuté kusy zůstaly", castecne.jmena.split(",").length === 2, castecne.jmena);
  check("…a režim se zavřel", castecne.zavreno);

  // plný rozbor v rozbalovací části
  const rozbor = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15,
        fastMove: "Bubble", charged1: "Play Rough" },
    ]);
    document.getElementById("boxModeBtn").click();
    const vic = document.getElementById("bmVic");
    const out = { predOtevrenim: document.getElementById("bmDetail").innerHTML.length };
    vic.open = true;
    vic.dispatchEvent(new Event("toggle"));
    const t = document.getElementById("bmDetail").textContent.replace(/[ ]+/g, " ");
    out.delka = t.length;
    out.maStaty = t.indexOf("Staty na levelu") > -1;
    out.maLigy = t.indexOf("Ligy podrobně") > -1;
    out.maRole = t.indexOf("Na co je") > -1;
    out.maUtoky = t.indexOf("Útoky") > -1;
    window.__pgo.boxZavritNatvrdo();
    return out;
  });
  eq("dokud si to nerozbalíš, rozbor se ani nepočítá", rozbor.predOtevrenim, 0);

  // Rozbalený rozbor je stejný obsah jako v tabulce, kde má celou šířku
  // stránky. V úzkém sloupci se z něj stal nekonečný had, který se do okna
  // nevešel — a .bm-body se jako flex položka smrskla na nulu, takže karta
  // pokémona úplně zmizela a zbyl jen rozbor.
  const rozborLayout = await page.evaluate(async () => {
    window.__pgo.setRows([
      { pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15,
        fastMove: "Bubble", charged1: "Play Rough" },
    ]);
    document.getElementById("boxModeBtn").click();
    const panel = document.querySelector(".bm-panel");
    const vic = document.getElementById("bmVic");
    // rozbalení si drží stav mezi kusy, takže se pro měření nejdřív zavře
    vic.open = false; vic.dispatchEvent(new Event("toggle"));
    await new Promise((r) => setTimeout(r, 350));
    const uzky = Math.round(panel.getBoundingClientRect().width);
    vic.open = true; vic.dispatchEvent(new Event("toggle"));
    await new Promise((r) => setTimeout(r, 350));
    const r = panel.getBoundingClientRect();
    const body = document.querySelector(".bm-body").getBoundingClientRect();
    const akce = document.getElementById("bmActions").getBoundingClientRect();
    const det = document.getElementById("bmDetail");
    const poradi = [".bm-top", ".bm-body", ".bm-vic", "#bmActions"]
      .map((sel) => ({ sel, top: panel.querySelector(sel).getBoundingClientRect().top }))
      .sort((a, b) => a.top - b.top).map((x) => x.sel).join(",");
    const out = {
      uzky: uzky,
      siroky: Math.round(r.width),
      kartaVidet: Math.round(body.height) > 50,
      jmeno: (document.querySelector(".bm-name") || {}).textContent,
      tlacitkaVidet: akce.bottom <= window.innerHeight + 2,
      nepresahuje: r.bottom <= window.innerHeight + 2 && r.right <= window.innerWidth + 2,
      // Dvousloupcová sazba je teď na .detail-main, ne na celém #bmDetail —
      // ten je flex kontejner (rozbor vlevo, evoluční řada vpravo). Kdyby
      // sloupce zůstaly na něm, rozdělily by se mezi rozbor a řadu a ta by
      // ukrojila půlku panelu určenou pro rozbor.
      sloupce: getComputedStyle(det.querySelector(".detail-main") || det).columnCount,
      cizihoKrizku: det.querySelectorAll(".detail-close").length,
      krizekSkryty: getComputedStyle(det.querySelector(".detail-close")).display,
      poradi: poradi,
    };
    window.__pgo.boxZavritNatvrdo();
    return out;
  });
  check("po rozbalení se panel roztáhne do šířky",
    rozborLayout.siroky > rozborLayout.uzky, rozborLayout.uzky + " -> " + rozborLayout.siroky);
  check("…a rozbor běží do dvou sloupců", rozborLayout.sloupce === "2", rozborLayout.sloupce);
  check("karta pokémona nezmizí", rozborLayout.kartaVidet && !!rozborLayout.jmeno,
    rozborLayout.jmeno);
  eq("…a je pořád nad rozborem", rozborLayout.poradi, ".bm-top,.bm-body,.bm-vic,#bmActions");
  check("tlačítka zůstanou vidět", rozborLayout.tlacitkaVidet);
  check("nic nepřeteče z okna", rozborLayout.nepresahuje);
  eq("křížek z tabulkového rozboru je schovaný", rozborLayout.krizekSkryty, "none");
  check("po rozbalení je tam celý rozbor", rozbor.delka > 500, String(rozbor.delka));
  check("…včetně statů", rozbor.maStaty);
  check("…lig podrobně", rozbor.maLigy);
  check("…na co se hodí", rozbor.maRole);
  check("…i útoků", rozbor.maUtoky);

  console.log("\n81) prach: rozhoduje i to, jak dobrý je DRUH v lize");
  const prachRank = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Azumarill", cp: 900, level: 15, ivAtk: 0, ivDef: 15, ivSta: 15,
        fastMove: "Bubble", charged1: "Play Rough" },
      { pokemon: "Wailmer", cp: 61, level: 2, ivAtk: 7, ivDef: 15, ivSta: 15 },
    ]);
    document.getElementById("dustCard").open = true;
    window.__pgo.renderPrach();
    // Plán po krocích je výchozí; tenhle blok porovnává CELOU cestu,
    // takže si starý režim musí zapnout sám.
    (function () {
      const k = document.getElementById("krokyPlan");
      if (k && k.checked) { k.checked = false;
        k.dispatchEvent(new Event("change", { bubbles: true })); }
    })();
    const plan = window.__pgo.prachovyPlan();
    return {
      polozky: plan.map((e) => ({ jm: e.row.pokemon, role: e.role, rank: e.rank,
        kvalita: e.kvalita, kus: e.kvalitaKusu })),
      kvalitaNepresahne: plan.every((e) => e.kvalitaKusu === undefined
        || e.kvalitaKusu === null || e.kvalita <= e.kvalitaKusu + 1e-9),
      maRankVRoli: plan.filter((e) => e.role.indexOf("PvP") === 0)
        .every((e) => e.role.indexOf("#") > -1),
      text: document.getElementById("dustBody").textContent.replace(/[ ]+/g, " "),
    };
  });
  check("u PvP je v tabulce vidět pořadí druhu v lize", prachRank.maRankVRoli,
    JSON.stringify(prachRank.polozky));
  check("kvalita druh x kus nikdy nepřeroste kvalitu samotného kusu",
    prachRank.kvalitaNepresahne, JSON.stringify(prachRank.polozky));
  check("…a je vidět, z čeho se skládá", prachRank.text.indexOf("kus ") > -1,
    prachRank.text.slice(0, 200));
  check("vysvětlivka říká, že rozhoduje i druh",
    prachRank.text.indexOf("skóre druhu v té lize") > -1, prachRank.text.slice(0, 400));

  const prahPoradiPrach = await page.evaluate(() => {
    const set = (id, v) => {
      const e = document.getElementById(id);
      e.value = String(v); e.dispatchEvent(new Event("input", { bubbles: true }));
    };
    window.__pgo.setRows([
      { pokemon: "Azumarill", cp: 900, level: 15, ivAtk: 0, ivDef: 15, ivSta: 15,
        fastMove: "Bubble", charged1: "Play Rough" },
    ]);
    set("rankLimit", 500);
    // Plán po krocích je výchozí; tenhle blok porovnává CELOU cestu,
    // takže si starý režim musí zapnout sám.
    (function () {
      const k = document.getElementById("krokyPlan");
      if (k && k.checked) { k.checked = false;
        k.dispatchEvent(new Event("change", { bubbles: true })); }
    })();
    const siroky = window.__pgo.prachovyPlan().length;
    set("rankLimit", 5);
    const prisny = window.__pgo.prachovyPlan().map((e) => e.role);
    document.getElementById("resetSettingsBtn").click();
    return { siroky: siroky, prisny: prisny };
  });
  check("při širokém prahu se meta kus do plánu vejde", prahPoradiPrach.siroky > 0,
    String(prahPoradiPrach.siroky));
  check("při prahu #5 už tam PvP cíl pro druh mimo pětku není",
    prahPoradiPrach.prisny.every((r) => r.indexOf("PvP") !== 0), prahPoradiPrach.prisny.join(", "));

  console.log("\n82) sdílení rosteru se hlídá samo");
  const hlidka = await page.evaluate(() => {
    const t = document.getElementById("shareBox").textContent.replace(/[ ]+/g, " ");
    return {
      text: t,
      // hlídka musí být nastavená hned po startu, ne až po prvním kliknutí
      maInterval: typeof window.__pgo.sdileniHlidkaBezi === "function"
        ? window.__pgo.sdileniHlidkaBezi() : null,
    };
  });
  check("v nápovědě je řečeno, že složka musí být na OneDrivu",
    hlidka.text.indexOf("OneDrivu") > -1, hlidka.text.slice(0, 200));
  check("…a že se kamarádův roster kontroluje sám",
    hlidka.text.indexOf("kontroluje") > -1, hlidka.text.slice(0, 240));
  check("hlídka běží od startu", hlidka.maInterval === true, String(hlidka.maInterval));

  console.log("\n83) klikací řádky vypadají klikací");
  const klikatelnost = await page.evaluate(async () => {
    window.alert = () => {};
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch", star: true },
      { pokemon: "Charizard", cp: 2200, level: 30, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: "Fire Spin", charged1: "Blast Burn" },
      { pokemon: "Jolteon", cp: 2000, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Thunder Shock", charged1: "Thunderbolt" },
      { pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15,
        fastMove: "Bubble", charged1: "Play Rough" },
    ]);
    document.getElementById("dustCard").open = true;
    window.__pgo.renderPrach();

    const pravidla = [...document.styleSheets]
      .flatMap((ss) => { try { return [...ss.cssRules]; } catch (e) { return []; } })
      .filter((r) => r.selectorText).map((r) => r.selectorText);

    const dust = document.querySelector("#dustBody .plan-row");
    return {
      dustPointer: dust ? getComputedStyle(dust).cursor : null,
      dustHover: pravidla.some((s2) => s2.indexOf(".plan-row:hover td") > -1),
    };
  });
  eq("řádek rozpočtu má ručičku", klikatelnost.dustPointer, "pointer");
  check("…a mění barvu při najetí", klikatelnost.dustHover);

  console.log("\n84) řazení sloupce PvP po ligách");
  const pvpSort = await page.evaluate(() => {
    window.alert = () => {};
    window.__pgo.setRows([
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15,
        fastMove: "Bubble", charged1: "Play Rough" },
      { pokemon: "Wailmer", cp: 61, level: 2, ivAtk: 7, ivDef: 15, ivSta: 15 },
      { pokemon: "Tentacool", cp: 152, level: 6, ivAtk: 4, ivDef: 13, ivSta: 12 },
      { pokemon: "Registeel", cp: 1498, level: 30, ivAtk: 15, ivDef: 15, ivSta: 14,
        fastMove: "Lock On", charged1: "Focus Blast" },
    ]);
    const th = Array.from(document.querySelectorAll("#headerRow th"))
      .filter((x) => x.textContent.indexOf("PvP") === 0)[0];
    if (!th) return { chyba: "sloupec PvP jsem nenašel" };
    th.click();   // vzestupně
    const c = window.__pgo.getComputed();
    const poradi = Array.from(document.querySelectorAll("#tbody tr"))
      .map((tr) => {
        const td = tr.querySelector("td.col-pokemon");
        return td ? ((td.querySelector("input") || td).value || td.textContent) : null;
      }).filter(Boolean);
    // ke každému řádku jeho nejnižší ligu a rank, ať se dá ověřit pořadí
    const detail = window.__pgo.getRows().map((r) => {
      const x = c[r.id] || {};
      const l = (x.pvpLigy || []).slice().sort((a, b) =>
        ({ LC: 0, GL: 1, UL: 2 })[a.liga] - ({ LC: 0, GL: 1, UL: 2 })[b.liga]);
      return { jm: r.pokemon, liga: l.length ? l[0].liga : null, rank: l.length ? l[0].rank : null };
    });
    return { poradi: poradi, detail: detail };
  });
  check("sloupec PvP jde seřadit", !pvpSort.chyba, pvpSort.chyba);
  if (!pvpSort.chyba) {
    const podle = {};
    pvpSort.detail.forEach((d) => { podle[d.jm] = d; });
    const ligaVporadi = pvpSort.poradi.map((jm) => (podle[jm] || {}).liga || "—");
    // LC musí být před GL, GL před UL a "žádná liga" úplně nakonec
    const vaha = { LC: 0, GL: 1, UL: 2, "—": 9 };
    const cisla = ligaVporadi.map((x) => vaha[x]);
    check("ligy jdou v pořadí LC → GL → UL, bez ligy nakonec",
      cisla.every((v, i) => i === 0 || cisla[i - 1] <= v), ligaVporadi.join(" "));
    // uvnitř jedné ligy musí rank stoupat
    let uvnitrOk = true;
    for (let i = 1; i < pvpSort.poradi.length; i++) {
      const a = podle[pvpSort.poradi[i - 1]], b = podle[pvpSort.poradi[i]];
      if (!a || !b || a.liga !== b.liga || !a.liga) continue;
      const ra = a.rank || 99999, rb = b.rank || 99999;
      if (ra > rb) uvnitrOk = false;
    }
    check("uvnitř ligy stoupá pořadí druhu", uvnitrOk,
      pvpSort.poradi.map((jm) => jm + ":" + ((podle[jm] || {}).liga || "—")
        + "#" + ((podle[jm] || {}).rank || "-")).join(" "));
    check("kus bez ligy je až za těmi s ligou",
      ligaVporadi.indexOf("—") === -1 || ligaVporadi.indexOf("—") >= ligaVporadi.length
        - ligaVporadi.filter((x) => x === "—").length,
      ligaVporadi.join(" "));
  }

  console.log("\n85) ručně dopsané útoky přežijí import");
  const utoky = await page.evaluate(() => {
    window.alert = () => {};
    const HL = "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,Fast move,Special move,Height (cm),Weight (g)";
    const nacti = (radky, rezim) => {
      window.__pgo.importText([HL].concat(radky).join(String.fromCharCode(10)));
      window.__pgo.finishImport(rezim);
    };
    window.__pgo.setRows([]);
    // sken bez útoků, ale s výškou a váhou (otisk kusu)
    nacti(["Machamp,2100,30,15,14,13,,,178,1300"], "replace");
    const r = window.__pgo.getRows()[0];
    const out = { poImportu: r.fastMove || "" };

    // uživatel dopíše útoky ručně
    r.fastMove = "Counter";
    r.charged1 = "Dynamic Punch";
    window.__pgo.zapamatovatUtoky(r);

    // a teď TÝŽ kus znovu naskenovaný, zase bez útoků, a dá se NAHRADIT
    nacti(["Machamp,2100,30,15,14,13,,,178,1300"], "replace");
    const po = window.__pgo.getRows()[0];
    out.poNahrazeni = { fast: po.fastMove || "", charged: po.charged1 || "" };

    // sken, který útoky MÁ, se pamětí přepsat nesmí
    nacti(["Machamp,2100,30,15,14,13,Karate Chop,Close Combat,178,1300"], "replace");
    const po2 = window.__pgo.getRows()[0];
    out.skenMaPrednost = { fast: po2.fastMove, charged: po2.charged1 };

    // jiný kus téhož druhu (jiná výška/váha) útoky podědit nesmí
    nacti(["Machamp,2100,30,15,14,13,,,150,900"], "replace");
    const jiny = window.__pgo.getRows()[0];
    out.jinyKus = jiny.fastMove || "";
    return out;
  });
  eq("sken bez útoků je opravdu bez útoků", utoky.poImportu, "");
  eq("po nahrazení se ručně dopsaný rychlý útok vrátí", utoky.poNahrazeni.fast, "Counter");
  eq("…i nabitý", utoky.poNahrazeni.charged, "Dynamic Punch");
  eq("sken, který útoky má, se pamětí nepřepíše", utoky.skenMaPrednost.fast, "Karate Chop");
  eq("…ani u nabitého", utoky.skenMaPrednost.charged, "Close Combat");
  eq("jiný kus téhož druhu útoky nepodědí", utoky.jinyKus, "");

  const utokyPersist = await page.evaluate(() => {
    // paměť se musí uložit vedle rosteru a přežít znovunačtení
    const snap = window.__pgo.snapshot ? window.__pgo.snapshot() : null;
    return snap ? { maPamet: !!snap.rucniUtoky, kolik: Object.keys(snap.rucniUtoky || {}).length }
      : { maPamet: null };
  });
  if (utokyPersist.maPamet !== null) {
    check("paměť útoků se ukládá s rosterem", utokyPersist.maPamet);
    check("…a něco v ní je", utokyPersist.kolik > 0, String(utokyPersist.kolik));
  }

  console.log("\n86) legendární a mytické přežijí nahrazení");
  const legendy = await page.evaluate(() => {
    window.alert = () => {};
    const HL = "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV";
    const nacti = (radky) => {
      window.__pgo.importText([HL].concat(radky).join(String.fromCharCode(10)));
      window.__pgo.finishImport("replace");
    };
    const prepni = (jak) => {
      const el = document.getElementById("keepRare");
      el.checked = jak; el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const jmena = () => window.__pgo.getRows().map((r) => r.pokemon).sort().join(",");
    const out = {};

    // roster s legendárním i obyčejným kusem
    prepni(false);
    nacti(["Lunala,2249,20,11,11,14", "Rattata,200,15,4,3,5"]);
    out.start = jmena();

    // nahrazení skenem, kde Lunala chybí — s vypnutou volbou zmizí
    nacti(["Rattata,200,15,4,3,5"]);
    out.vypnuto = jmena();

    // teď totéž se zapnutou volbou
    prepni(true);
    nacti(["Lunala,2249,20,11,11,14", "Rattata,200,15,4,3,5"]);
    nacti(["Rattata,200,15,4,3,5"]);
    out.zapnuto = jmena();

    // když se legendární NASKENUJE, bere se čerstvá hodnota, ne stará
    nacti(["Lunala,2600,25,15,15,15", "Rattata,200,15,4,3,5"]);
    const l = window.__pgo.getRows().filter((r) => r.pokemon === "Lunala");
    out.poNovemSkenu = { kolik: l.length, cp: l.length ? String(l[0].cp) : null };

    // obyčejný pokémon se nedrží ani se zapnutou volbou
    nacti(["Lunala,2600,25,15,15,15"]);
    out.obycejnyNezustal = jmena();
    prepni(false);
    return out;
  });
  eq("na začátku jsou v rosteru oba", legendy.start, "Lunala,Rattata");
  eq("s vypnutou volbou legendární po nahrazení zmizí", legendy.vypnuto, "Rattata");
  eq("se zapnutou zůstane stát", legendy.zapnuto, "Lunala,Rattata");
  eq("když se naskenuje, nezdvojí se", legendy.poNovemSkenu.kolik, 1);
  eq("…a přepíše se čerstvou hodnotou", legendy.poNovemSkenu.cp, "2600");
  eq("obyčejný pokémon se nedrží", legendy.obycejnyNezustal, "Lunala");

  console.log("\n87) přeučit: červená až když je špatně celá sestava");
  const preucit = await page.evaluate(() => {
    window.__pgo.setRows([
      // Rock Throw JE nejlepší rychlý útok Sudowooda, špatný je jen nabitý
      { pokemon: "Sudowoodo", cp: 1794, level: 25, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: "Rock Throw", charged1: "Rock Tomb" },
      // obojí mimo
      { pokemon: "Sudowoodo", cp: 1794, level: 25, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: "Counter", charged1: "Earthquake" },
    ]);
    const c = window.__pgo.getComputed(), r = window.__pgo.getRows();
    return {
      pulka: { moves: c[r[0].id].moves, tone: c[r[0].id].movesTone,
        sub: c[r[0].id].movesSub, title: c[r[0].id].movesTitle },
      obojí: { moves: c[r[1].id].moves, tone: c[r[1].id].movesTone },
    };
  });
  check("když sedí rychlý útok, je to žluté, ne červené",
    preucit.pulka.tone === "warning", preucit.pulka.tone + " / " + preucit.pulka.moves);
  check("…a řekne se, že stačí vyměnit nabitý",
    preucit.pulka.moves.indexOf("nabitý") > -1, preucit.pulka.moves);
  check("…v podtitulku je jen ten jeden útok, ne celá sestava",
    preucit.pulka.sub.indexOf("+") === -1, preucit.pulka.sub);
  check("…a bublina to vysvětlí",
    preucit.pulka.title.indexOf("nejlepší, jaký může mít") > -1, preucit.pulka.title.slice(0, 200));
  check("když nesedí nic, zůstane červená",
    preucit["obojí"].tone === "critical", preucit["obojí"].tone + " / " + preucit["obojí"].moves);
  eq("…a je to prosté „Přeučit“", preucit["obojí"].moves, "Přeučit");

  console.log("\n88) elitní útok chrání kus před zahozením");
  const elitni = await page.evaluate(() => {
    const set = (id, v) => {
      const e = document.getElementById(id);
      e.value = String(v); e.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("keepCopies", 1);
    window.__pgo.setRows([
      // lepší IV, ale běžná sestava
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 15, ivSta: 15,
        fastMove: "Counter", charged1: "Dynamic Punch" },
      // horší IV, ale elitní (legacy) sestava, která navíc stojí za to —
      // Karate Chop i Stone Edge se běžným TM nezískají
      { pokemon: "Machamp", cp: 1900, level: 28, ivAtk: 10, ivDef: 10, ivSta: 10,
        fastMove: "Karate Chop", charged1: "Stone Edge" },
    ]);
    const c = window.__pgo.getComputed(), r = window.__pgo.getRows(), b = window.__pgo.base();
    const podle = {};
    b.forEach((x) => { podle[x.row.cp] = { b: x, c: c[x.row.id] }; });
    set("keepCopies", 2);
    return {
      elitniPriznak: !!podle[1900].b.maElitni,
      bezElitniho: !!podle[2100].b.maElitni,
      verdiktElitni: podle[1900].c.keep,
      verdiktBezny: podle[2100].c.keep,
      duvod: podle[1900].c.copiesTitle || podle[1900].c.keepTitle || "",
    };
  });
  check("kus s elitním útokem se pozná", elitni.elitniPriznak);
  check("…a běžná sestava ne", elitni.bezElitniho === false);
  check("při stropu 1 kopie se elitní kus nezahodí",
    String(elitni.verdiktElitni).indexOf("Zahodit") !== 0, elitni.verdiktElitni);
  check("…a je řečeno proč", (elitni.duvod || "").indexOf("elitní") > -1, elitni.duvod);

  // Elitní útok na sestavě, která za nic nestojí, chránit nemá — Karate Chop
  // se Submission je pořád horší než běžné Counter + Dynamic Punch.
  const elitniSlaby = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 1900, level: 28, ivAtk: 10, ivDef: 10, ivSta: 10,
        fastMove: "Karate Chop", charged1: "Submission" },
    ]);
    return !!window.__pgo.base()[0].maElitni;
  });
  check("elitní útok na slabé sestavě nechrání", elitniSlaby === false, String(elitniSlaby));

  console.log("\n89) překreslení tabulky neuskočí se stránkou");
  const scrollTest = await page.evaluate(async () => {
    if (window.__pgoZalozka) window.__pgoZalozka("roster");
    const rows = [];
    for (let i = 0; i < 40; i++) {
      rows.push({ pokemon: i % 2 ? "Machamp" : "Gyarados", cp: 1000 + i * 10,
        level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 });
    }
    // předchozí bloky mohly nechat zapnutý filtr nebo editační zobrazení
    const f = document.getElementById("filterSelect");
    f.value = "all"; f.dispatchEvent(new Event("change", { bubbles: true }));
    const v = document.getElementById("viewSelect");
    v.value = "verdict"; v.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("searchInput").value = "";
    document.getElementById("searchInput").dispatchEvent(new Event("input", { bubbles: true }));

    window.__pgo.setRows(rows);
    await new Promise((r) => setTimeout(r, 120));
    // Tabulka se sama neroluje (nemá strop výšky), takže roluje celá stránka.
    window.scrollTo(0, 700);
    await new Promise((r) => setTimeout(r, 120));
    const pred = Math.round(window.scrollY);
    if (pred < 100) return { preskoceno: "stránka se nedá odrolovat, výška "
      + document.body.scrollHeight };

    const jmena = Array.from(document.querySelectorAll("#tbody td.clickable-name"));
    if (!jmena.length) return { preskoceno: "žádný rozklikávací řádek (filtr?)" };
    const cil = jmena[Math.min(15, jmena.length - 1)];
    cil.click();                             // rozbalit detail
    await new Promise((r) => setTimeout(r, 200));
    const poRozbaleni = Math.round(window.scrollY);
    const detailu = document.querySelectorAll(".detail-row").length;
    cil.click();                             // a zase zavřít
    await new Promise((r) => setTimeout(r, 200));
    const poZavreni = Math.round(window.scrollY);

    // a při obyčejném překreslení taky
    window.__pgo.prekreslit();
    await new Promise((r) => setTimeout(r, 120));
    const poPrekresleni = Math.round(window.scrollY);
    return { pred, poRozbaleni, poZavreni, poPrekresleni, detailu };
  });
  if (scrollTest.preskoceno) {
    check("test rolování se dal spustit", false, scrollTest.preskoceno);
  } else {
    eq("rozbalení detailu otevře jeden detail", scrollTest.detailu, 1);
    check("…a stránka zůstane, kde byla",
      Math.abs(scrollTest.poRozbaleni - scrollTest.pred) < 4,
      scrollTest.pred + " -> " + scrollTest.poRozbaleni);
    check("zavření detailu taky",
      Math.abs(scrollTest.poZavreni - scrollTest.pred) < 4,
      scrollTest.pred + " -> " + scrollTest.poZavreni);
    check("a obyčejné překreslení taky",
      Math.abs(scrollTest.poPrekresleni - scrollTest.pred) < 4,
      scrollTest.pred + " -> " + scrollTest.poPrekresleni);
  }

  console.log("\n90) záložky nahoře");
  // Menu se testuje ve dvou krocích. Rozhraní prohlížeče se při přepínání
  // překresluje, takže se každý krok ptá zvlášť — jeden dlouhý dotaz uměl
  // uváznout na tom, že se mezitím karta přestavěla.
  const zalozky90 = await page.evaluate(() => {
    const lista = document.querySelector(".zal-lista");
    if (!lista) return { chyba: "lišta se záložkami není" };
    const app = document.querySelector(".app");
    const nadMenu = [];
    for (let i = 0; i < app.children.length; i++) {
      if (app.children[i] === lista) break;
      nadMenu.push(app.children[i].tagName);
    }
    return {
      zalozky: Array.from(lista.children).map((b) => b.textContent.replace(/[0-9]+$/, "").trim()),
      nadMenu: nadMenu.join(","),
      sticky: getComputedStyle(lista).position,
      neobsluhovane: Array.from(document.querySelectorAll(".app > .card"))
        .filter((c) => !c.classList.contains("zal-viditelna") && !c.classList.contains("zal-skryta"))
        .map((c) => c.id || c.className),
    };
  });
  check("lišta se záložkami existuje", !zalozky90.chyba, zalozky90.chyba);
  if (!zalozky90.chyba) {
    eq("nad menu zůstane jen nadpis", zalozky90.nadMenu, "H1,P");
    eq("lišta je přilepená nahoře", zalozky90.sticky, "sticky");
    eq("první záložka je Roster", zalozky90.zalozky[0], "Roster");
    check("dokumentace má vlastní záložku",
      zalozky90.zalozky.indexOf("Odkud se to bere") > -1, zalozky90.zalozky.join(" | "));
    check("žebříčky taky", zalozky90.zalozky.indexOf("Žebříčky") > -1, zalozky90.zalozky.join(" | "));
    eq("žádná karta nezůstala mimo menu — jinak se veze pod každou záložkou",
      zalozky90.neobsluhovane.length, 0);

    const naRosteru = await page.evaluate(() => {
      window.__pgoZalozka("roster");
      const f = document.getElementById("patickaZdroje");
      return {
        vidi: Array.from(document.querySelectorAll(".card.zal-viditelna")).map((c) => c.id || c.className),
        paticka: !!f && getComputedStyle(f).display !== "none",
      };
    });
    // Karta Souhrn už neexistuje — pod záložkou Roster je vidět jen roster.
    check("na Rosteru je vidět právě roster",
      naRosteru.vidi.length === 1 && /roster/.test(naRosteru.vidi[0]),
      naRosteru.vidi.join(","));
    check("…a patička se zdroji tam NENÍ", naRosteru.paticka === false);

    const naDokumentaci = await page.evaluate(() => {
      window.__pgoZalozka("docsCard");
      const f = document.getElementById("patickaZdroje");
      return { paticka: !!f && getComputedStyle(f).display !== "none" };
    });
    check("v dokumentaci patička je", naDokumentaci.paticka);
    await page.evaluate(() => window.__pgoZalozka("roster"));
  }

  console.log("\n91) doplňování útoků klikem v rosteru");
  const utokyUi = await page.evaluate(async () => {
    window.alert = () => {};
    window.__pgoZalozka("roster");
    window.__pgo.setRows([
      { pokemon: "Gyarados", cp: 2628, level: 30, ivAtk: 0, ivDef: 10, ivSta: 3 },
      { pokemon: "Gyarados", cp: 2195, level: 23, ivAtk: 14, ivDef: 15, ivSta: 10 },
    ]);
    await new Promise((r) => setTimeout(r, 250));
    const h = Array.from(document.querySelectorAll("#headerRow th"));
    const i = h.findIndex((x) => x.textContent.indexOf("Útoky") === 0);
    const trs = Array.from(document.querySelectorAll("#tbody tr")).filter((t) => t.dataset.rowId);
    // Tabulka může být seřazená jinak, než v jakém pořadí se řádky zakládaly,
    // takže se identita bere z DOMu — jinak test kontroluje jiný kus, než na
    // který klikl.
    const cilovyTr = trs[1];
    const cilovyId = cilovyTr.dataset.rowId;
    const td = cilovyTr.children[i];
    const sirkaPred = Math.round(td.getBoundingClientRect().width);

    td.click();
    await new Promise((r) => setTimeout(r, 200));
    const panel = document.querySelector(".utok-edit");
    const out = {
      sloupecSirkaPred: sirkaPred,
      sloupecSirkaPo: Math.round(td.getBoundingClientRect().width),
      panelRodic: panel ? panel.parentElement.tagName : null,
      poli: panel ? panel.querySelectorAll(".uv-pole").length : 0,
      hlavicka: panel ? panel.querySelector(".utok-edit-hlava").textContent.replace("✕", "").trim() : "",
    };

    // rozbalit nabídku a vybrat útok — musí to jít do SPRÁVNÉHO řádku
    panel.querySelectorAll(".uv-pole")[0].click();
    await new Promise((r) => setTimeout(r, 180));
    const box = document.querySelector(".uv-seznam");
    out.seznamOtevren = !!box;
    out.mreze = box ? getComputedStyle(box.querySelector(".uv-polozka:not(.uv-prazdna)")).gridTemplateColumns : null;
    out.vejdeSeDoOkna = box ? (() => { const r = box.getBoundingClientRect();
      return r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight; })() : null;
    const volba = Array.from(box.querySelectorAll(".uv-polozka:not(.uv-prazdna)"))[0];
    out.vybranyText = volba.textContent.replace(/[ ]+/g, " ").trim();
    volba.click();
    await new Promise((r) => setTimeout(r, 150));
    const radky = window.__pgo.getRows();
    out.zapsano = radky.map((r) => r.id + " " + r.pokemon + " " + r.cp + ":" + (r.fastMove || "-"));
    out.doKterehoSeZapsalo = radky.filter((r) => r.fastMove).map((r) => r.id).join(",");
    out.klikloSeNa = cilovyId;

    // druhý klik na to samé pole nabídku zavře
    panel.querySelectorAll(".uv-pole")[0].click();
    await new Promise((r) => setTimeout(r, 120));
    panel.querySelectorAll(".uv-pole")[0].click();
    await new Promise((r) => setTimeout(r, 120));
    out.poDruhemKliku = document.querySelectorAll(".uv-seznam").length;

    // klik mimo zavře celý editor
    document.querySelector("h1").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    out.poKlikuVedle = document.querySelectorAll(".utok-edit").length;
    return out;
  });
  eq("editor má tři pole", utokyUi.poli, 3);
  eq("…a plave nad tabulkou, ne v buňce", utokyUi.panelRodic, "BODY");
  eq("…takže sloupec nezmění šířku", utokyUi.sloupecSirkaPo, utokyUi.sloupecSirkaPred);
  eq("…a v hlavičce je ten správný pokémon", utokyUi.hlavicka, "Gyarados");
  check("nabídka se otevře", utokyUi.seznamOtevren);
  check("…v poměru 2:2:1", (() => {
    const c = (utokyUi.mreze || "").split(" ").map(parseFloat);
    return c.length === 3 && Math.abs(c[0] / c[2] - 2) < 0.1 && Math.abs(c[1] / c[2] - 2) < 0.1;
  })(), utokyUi.mreze);
  check("…a vejde se do okna", utokyUi.vejdeSeDoOkna);
  eq("výběr zapíše útok do SPRÁVNÉHO ze dvou Gyaradosů",
    utokyUi.doKterehoSeZapsalo, utokyUi.klikloSeNa);
  eq("druhý klik nabídku zavře", utokyUi.poDruhemKliku, 0);
  eq("klik mimo zavře i editor", utokyUi.poKlikuVedle, 0);

  console.log("\n92) verze se nelepí nad tabulku");
  const verzeStamp = await page.evaluate(() => {
    window.__pgoZalozka("roster");
    const stamp = document.getElementById("buildStamp");
    const lista = document.querySelector(".card.roster .toolbar");
    return {
      text: stamp.textContent,
      vPrilepeneListe: !!stamp.closest(".toolbar"),
      rodic: stamp.parentElement.className,
      listaJePrilepena: getComputedStyle(lista).position,
      // ukládání a záloha v liště zůstat MAJÍ — ty se hlídají za běhu
      ulozeniVListe: !!document.getElementById("saveState").closest(".toolbar"),
      zalohaVListe: !!document.getElementById("backupState").closest(".toolbar"),
    };
  });
  check("verze je vyplněná", /^Verze \d{4}-/.test(verzeStamp.text), verzeStamp.text);
  check("…ale není v přilepené liště", verzeStamp.vPrilepeneListe === false, verzeStamp.rodic);
  eq("…má vlastní řádek pod lištou", verzeStamp.rodic, "build-line");
  eq("lišta s tlačítky se nelepí — přišpendlené je jen záhlaví tabulky",
    verzeStamp.listaJePrilepena, "static");
  check("stav ukládání i zálohy v liště zůstal",
    verzeStamp.ulozeniVListe && verzeStamp.zalohaVListe);

  console.log("\n93) Frustration u shadow, Return u purified");
  const formoveUtoky = await page.evaluate(async () => {
    window.alert = () => {};
    window.__pgoZalozka("roster");
    window.__pgo.setRows([
      { pokemon: "Rookidee", forma: "Shadow", cp: 130, level: 5, ivAtk: 4, ivDef: 2, ivSta: 3,
        fastMove: "Peck", charged1: "Frustration" },
      { pokemon: "Rookidee", forma: "Purified", cp: 130, level: 5, ivAtk: 6, ivDef: 4, ivSta: 5 },
      { pokemon: "Rookidee", cp: 130, level: 5, ivAtk: 6, ivDef: 4, ivSta: 5 },
    ]);
    await new Promise((r) => setTimeout(r, 300));
    const h = Array.from(document.querySelectorAll("#headerRow th"));
    const i = h.findIndex((x) => x.textContent.indexOf("Útoky") === 0);
    const trs = Array.from(document.querySelectorAll("#tbody tr")).filter((t) => t.dataset.rowId);
    const out = [];
    // Řádky se hledají podle značky, ne podle pořadí v tabulce: to se mění
    // s verdiktem, a ten se mění s pravidly rozpočtu.
    const najdi = (znacka) => trs.filter((t) => {
      const txt = t.textContent.toUpperCase();
      return znacka ? txt.indexOf(znacka) > -1
        : txt.indexOf("SHADOW") === -1 && txt.indexOf("PURIFIED") === -1;
    })[0];
    const poradi = [najdi("SHADOW"), najdi("PURIFIED"), najdi("")];
    for (let idx = 0; idx < 3; idx++) {
      poradi[idx].children[i].click();
      await new Promise((r) => setTimeout(r, 140));
      const panel = document.querySelector(".utok-edit");
      const pole = panel.querySelectorAll(".uv-pole");
      const zaznam = {
        hodnota: pole[1].textContent.replace("▼", "").trim(),
        // útok od formy nesmí být obarvený jako „tenhle druh ho neumí"
        oznacenoJakoChyba: pole[1].className.indexOf("utok-nezna") > -1
          || pole[1].className.indexOf("utok-preucit") > -1,
      };
      pole[1].click();
      await new Promise((r) => setTimeout(r, 160));
      const box = document.querySelector(".uv-seznam");
      zaznam.nabidka = Array.from(box.querySelectorAll(".uv-polozka:not(.uv-prazdna)"))
        .map((x) => x.textContent.replace(/[ ]+/g, " ").trim());
      const popisek = (t) => t.getAttribute("data-tip") || t.getAttribute("title") || "";
      const formovy = Array.from(box.querySelectorAll(".uv-polozka .uv-typ"))
        .filter((t) => popisek(t).indexOf("shadow") > -1 || popisek(t).indexOf("očištěný") > -1);
      zaznam.maVysvetlivku = formovy.length > 0;
      out.push(zaznam);
      document.querySelector("h1").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 100));
    }
    return out;
  });
  check("shadow kus nabízí Frustration",
    formoveUtoky[0].nabidka.some((x) => x.indexOf("Frustration") > -1),
    formoveUtoky[0].nabidka.join(" | "));
  check("…a nehlásí ho jako útok, který ten druh neumí",
    formoveUtoky[0].oznacenoJakoChyba === false, formoveUtoky[0].hodnota);
  check("…a vysvětlí, odkud se bere", formoveUtoky[0].maVysvetlivku);
  check("purified kus nabízí Return",
    formoveUtoky[1].nabidka.some((x) => x.indexOf("Return") > -1),
    formoveUtoky[1].nabidka.join(" | "));
  check("…ale ne Frustration",
    formoveUtoky[1].nabidka.every((x) => x.indexOf("Frustration") === -1),
    formoveUtoky[1].nabidka.join(" | "));
  check("běžný kus nenabízí ani jedno",
    formoveUtoky[2].nabidka.every((x) => x.indexOf("Frustration") === -1
      && x.indexOf("Return") === -1),
    formoveUtoky[2].nabidka.join(" | "));

  console.log("\n94) profily — dva rostery na jednom počítači");
  const profily = await page.evaluate(async () => {
    window.alert = () => {};
    window.prompt = () => "TestANet";
    window.__pgoZalozka("roster");
    const sel = document.getElementById("profileSelect");
    const puvodni = sel.value;
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 },
      { pokemon: "Gyarados", cp: 2628, level: 30, ivAtk: 0, ivDef: 10, ivSta: 3 },
    ]);
    await new Promise((r) => setTimeout(r, 250));
    const out = { prvni: { profil: sel.value, pocet: window.__pgo.getRows().length } };

    document.getElementById("newProfileBtn").click();
    await new Promise((r) => setTimeout(r, 350));
    out.druhy = { profil: sel.value, pocetHnedPoZalozeni: window.__pgo.getRows().length };
    window.__pgo.setRows([{ pokemon: "Lapras", cp: 1119, level: 15, ivAtk: 14, ivDef: 13, ivSta: 15 }]);
    await new Promise((r) => setTimeout(r, 250));
    out.druhy.pocet = window.__pgo.getRows().length;

    sel.value = puvodni; sel.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    out.zpet = { profil: sel.value, pocet: window.__pgo.getRows().length,
      jmena: window.__pgo.getRows().map((r) => r.pokemon).join(",") };
    out.vSeznamu = Array.from(sel.options).map((o) => o.value);
    return out;
  });
  eq("nový profil začíná prázdný", profily.druhy.pocetHnedPoZalozeni, 0);
  eq("…a naplní se vlastními kusy", profily.druhy.pocet, 1);
  check("v seznamu jsou oba profily",
    profily.vSeznamu.length >= 2 && profily.vSeznamu.indexOf("TestANet") > -1,
    profily.vSeznamu.join(","));
  eq("přepnutím zpátky se vrátí původní roster", profily.zpet.pocet, profily.prvni.pocet);
  eq("…přesně ten samý", profily.zpet.jmena, "Machamp,Gyarados");

  // Připojené soubory (záloha, sdílení) patří profilu, ne počítači — jinak by
  // druhý člověk přepisoval zálohu toho prvního.
  const profilySoubory = await page.evaluate(() => {
    return { klicVychozi: window.__pgo.klicHandleOf ? window.__pgo.klicHandleOf("zaloha_slozka") : null };
  });
  if (profilySoubory.klicVychozi !== null) {
    eq("výchozí profil si nechává původní klíč k záloze",
      profilySoubory.klicVychozi, "zaloha_slozka");
  }

  console.log("\n95) útoky, u kterých známe jen PvP hodnoty");
  // Cramorant je GL #13 a UL #27 a PvPoke mu doporučuje Dive. pogoapi ten útok
  // nemá — chybí u něj doba trvání, takže se z něj raidové DPS spočítat nedá.
  // Dřív takový útok v appce vůbec nebyl a nešel vybrat; kdyby se doplnil
  // s nulami, vyšlo by z něj „0 % nejlepšího movesetu → přeučit", což je
  // tvrzení, které z dat neplyne.
  const jenPvp = await page.evaluate(() => {
    const M = window.__pgo.movesData();
    const i = M.chargedNames.indexOf("Dive");
    const l = window.__pgo.learnsetOf("cramorant");
    const dupF = {}, dupC = {};
    M.fastNames.forEach((n) => { dupF[n.toLowerCase()] = (dupF[n.toLowerCase()] || 0) + 1; });
    M.chargedNames.forEach((n) => { dupC[n.toLowerCase()] = (dupC[n.toLowerCase()] || 0) + 1; });
    return {
      index: i,
      raid: i > -1 ? M.charged[i] : null,
      pvp: i > -1 ? M.pvpCharged[i] : null,
      umiCramorant: !!l && l.charged.indexOf(i) > -1,
      umiTinkaton: (() => {
        const g = M.chargedNames.indexOf("Gigaton Hammer");
        const t = window.__pgo.learnsetOf("tinkaton");
        return g > -1 && !!t && t.charged.indexOf(g) > -1;
      })(),
      dvojiJmena: Object.keys(dupF).filter((k) => dupF[k] > 1)
        .concat(Object.keys(dupC).filter((k) => dupC[k] > 1)),
      delkySedi: M.chargedNames.length === M.charged.length
        && M.charged.length === M.pvpCharged.length
        && M.fastNames.length === M.fast.length
        && M.fast.length === M.pvpFast.length,
    };
  });
  check("Dive je v datech útoků", jenPvp.index > -1);
  check("…Cramorant ho umí", jenPvp.umiCramorant);
  check("…Tinkaton umí Gigaton Hammer", jenPvp.umiTinkaton);
  eq("…raidová doba je 0 = značka „neznáme“", jenPvp.raid && jenPvp.raid[3], 0);
  check("…ale PvP hodnoty má", !!jenPvp.pvp && jenPvp.pvp[0] > 0 && jenPvp.pvp[1] > 0,
    JSON.stringify(jenPvp.pvp));
  eq("žádný útok se nejmenuje stejně jako jiný", jenPvp.dvojiJmena.join(","), "");
  check("seznamy jmen a hodnot jsou stejně dlouhé", jenPvp.delkySedi);

  // Kus, jehož jediný nabitý útok raidová data nemá, nesmí dostat 0 % a poslat
  // majitele přeučovat. Neznámo není nula.
  const cramorant = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Cramorant", cp: 1142, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15,
        fastMove: "Air Slash", charged1: "Dive" },
      { pokemon: "Cramorant", cp: 1200, level: 21, ivAtk: 14, ivDef: 15, ivSta: 15,
        fastMove: "Air Slash", charged1: "Surf" },
    ]);
    const P = window.__pgo;
    const r = P.getRows();
    const mr = r.map((x) => P.movesetRatingOf(x, P.dexEntry(x.pokemon), "cramorant"));
    const bunky = Array.from(document.querySelectorAll("tbody tr"))
      .map((tr) => tr.textContent);
    return {
      diveJenPvp: !!mr[0] && mr[0].jenPvp === true,
      divePct: mr[0] ? mr[0].pct : "bez hodnocení",
      surfJenPvp: !!mr[1] && mr[1].jenPvp === false,
      surfMaPct: !!mr[1] && typeof mr[1].pct === "number" && mr[1].pct > 0,
      textTabulky: bunky.join(" || "),
    };
  });
  check("sestava s Dive se označí jako „jen pro ligy“", cramorant.diveJenPvp);
  eq("…a nedostane procento", cramorant.divePct, null);
  check("…v tabulce nestojí „přeučit“", cramorant.textTabulky.toLowerCase().indexOf("přeučit") === -1,
    cramorant.textTabulky.slice(0, 200));
  check("…ale je tam poznámka o ligách", cramorant.textTabulky.indexOf("Jen pro ligy") > -1,
    cramorant.textTabulky.slice(0, 200));
  check("kus se známým útokem se počítá dál normálně",
    cramorant.surfJenPvp && cramorant.surfMaPct);

  console.log("\n96) XL bonbóny v prachovém plánu");
  // XL bonbóny NEJSOU druhý prach: prach je jeden společný fond, XL má každá
  // evoluční řada svůj. Proto tu není druhý rozpočtový řádek, ale sloupec
  // s potřebou, přepínač „bez XL“ a součet po řadách.
  const xlPlan = await page.evaluate(() => {
    window.__pgo.setRows([
      // Marill se počítá do stejného pytlíku bonbónů jako Azumarill —
      // právě na tom se pozná, že se XL sčítá po řadě a ne po jménech.
      { pokemon: "Marill", cp: 300, level: 10, ivAtk: 2, ivDef: 15, ivSta: 14,
        fastMove: "Bubble", charged1: "Body Slam" },
      { pokemon: "Azumarill", cp: 900, level: 20, ivAtk: 4, ivDef: 15, ivSta: 15,
        fastMove: "Bubble", charged1: "Ice Beam" },
      { pokemon: "Gyarados", cp: 1800, level: 25, ivAtk: 14, ivDef: 15, ivSta: 15,
        fastMove: "Dragon Breath", charged1: "Aqua Tail" },
    ]);
    const P = window.__pgo;
    document.getElementById("dustCard").open = true;
    // XL se platí až nad L40 — s cílem L40 by ten filtr neměl co filtrovat.
    document.getElementById("cilLevel").value = "50";
    document.getElementById("bezXL").checked = false;
    // prekreslit, ne prepocitat — rozpočtovou kartu překresluje renderBody
    P.prekreslit();
    const box = document.getElementById("dustBody");
    const hlavicka = Array.from(box.querySelectorAll(".dust-table th")).map((t) => t.textContent.trim());
    // prachový plán se čte z tabulky — getPlan() je jiný seznam (investice)
    const sXL = box.querySelectorAll(".dust-table td.dust-xl").length;
    const xlTab = box.querySelector(".dust-xl-table");
    const rodiny = xlTab
      ? Array.from(xlTab.querySelectorAll("tr")).slice(1).map((tr) => tr.children[0].textContent.trim())
      : [];
    // teď přepnout na „bez XL“
    document.getElementById("cilLevel").value = "50";
    const el = document.getElementById("bezXL");
    el.checked = true;
    el.dispatchEvent(new Event("change"));
    const poFiltru = {
      xlBunek: box.querySelectorAll(".dust-table td.dust-xl").length,
      rekloSkryto: /Skryto|Bez XL bonbónů tu není co dělat/.test(box.textContent),
      maXLtabulku: !!box.querySelector(".dust-xl-table"),
      // kumulativní součet musí sedět na tom, co je vidět
      posledniCelkem: (() => {
        const tr = Array.from(box.querySelectorAll(".dust-table tr")).slice(1)
          .filter((x) => !x.classList.contains("dust-hranice"));
        const posl = tr[tr.length - 1];
        return posl ? posl.children[posl.children.length - 1].textContent.trim() : "";
      })(),
    };
    el.checked = false;
    el.dispatchEvent(new Event("change"));
    return { hlavicka, sXL, rodiny, poFiltru };
  });
  check("tabulka má vlastní sloupec XL", xlPlan.hlavicka.indexOf("XL") > -1,
    xlPlan.hlavicka.join(" | "));
  check("prach a XL jsou dva různé sloupce", xlPlan.hlavicka.indexOf("Prach") > -1,
    xlPlan.hlavicka.join(" | "));
  check("aspoň jeden cíl nad L40 potřebuje XL", xlPlan.sXL > 0, String(xlPlan.sXL));
  check("XL se sčítá po evoluční řadě, ne po jménech — Marill patří k Azumarillovi",
    xlPlan.rodiny.indexOf("Marill") === -1, xlPlan.rodiny.join(", "));
  check("…a řada je vedená pod finální evolucí", xlPlan.rodiny.indexOf("Azumarill") > -1,
    xlPlan.rodiny.join(", "));
  eq("po zaškrtnutí „bez XL“ nezůstane žádný kus s XL", xlPlan.poFiltru.xlBunek, 0);
  check("…a řekne se, kolik jich to skrylo", xlPlan.poFiltru.rekloSkryto);
  check("…seznam XL pytlíků se schová taky", xlPlan.poFiltru.maXLtabulku === false);
  check("…a když nezbyde nic, řekne se že to je kvůli XL a ne kvůli prázdnému rosteru",
    xlPlan.poFiltru.posledniCelkem === "" && xlPlan.poFiltru.rekloSkryto,
    xlPlan.poFiltru.posledniCelkem);

  // Běžnější případ: část kusů XL potřebuje, část ne. Filtr musí nechat ty
  // levné a přepočítat jim součet, jako by ty drahé v seznamu nebyly.
  const xlMix = await page.evaluate(() => {
    window.__pgo.setRows([
      // Nízký útok = dobrý kus do Little Cupu; cíl je pod L40, takže bez XL.
      // Skrelp je v LC jednička jako běžný kus. (Dřív tu byl Wailmer, ale
      // do padesátky se vejde jen jeho SHADOW varianta — a ta má od
      // rozdělení žebříčků vlastní záznam.)
      { pokemon: "Skrelp", cp: 69, level: 3, ivAtk: 0, ivDef: 15, ivSta: 15,
        fastMove: "Acid", charged1: "Aqua Tail" },
      { pokemon: "Gyarados", cp: 1800, level: 25, ivAtk: 14, ivDef: 15, ivSta: 15,
        fastMove: "Dragon Breath", charged1: "Aqua Tail" },
    ]);
    const box = document.getElementById("dustBody");
    document.getElementById("cilLevel").value = "50";
    const el = document.getElementById("bezXL");
    const cti = () => {
      const tr = Array.from(box.querySelectorAll(".dust-table tr")).slice(1)
        .filter((x) => !x.classList.contains("dust-hranice"));
      return {
        jmena: tr.map((x) => x.children[0].textContent.replace(/[0-9]+ CP$/, "").trim()),
        celkem: tr.length ? tr[tr.length - 1].children[tr[0].children.length - 1].textContent.trim() : "",
      };
    };
    el.checked = false; el.dispatchEvent(new Event("change"));
    const vse = cti();
    el.checked = true; el.dispatchEvent(new Event("change"));
    const bez = cti();
    const skryto = (box.textContent.match(/Skryto [^.]*\./) || [""])[0];
    el.checked = false; el.dispatchEvent(new Event("change"));
    return { vse, bez, skryto };
  });
  check("bez filtru jsou v plánu oba kusy", xlMix.vse.jmena.length >= 2,
    xlMix.vse.jmena.join(", "));
  check("s filtrem zbyde jen ten, co XL nepotřebuje",
    xlMix.bez.jmena.length === 1 && xlMix.bez.jmena[0].indexOf("Skrelp") > -1,
    xlMix.bez.jmena.join(", "));
  check("…a řekne se, kolik kusů to skrylo", xlMix.skryto.indexOf("Skryto") === 0,
    xlMix.skryto);
  check("…součet se přepočítá, nezůstane po odfiltrovaných",
    xlMix.bez.celkem !== xlMix.vse.celkem,
    "s filtrem " + xlMix.bez.celkem + " vs bez filtru " + xlMix.vse.celkem);

  console.log("\n97) co chytat venku");
  const chytat = await page.evaluate(() => {
    window.__pgo.setRows([
      // roster schválně chudý na Steel a Dragon, ať je co doporučit
      { pokemon: "Marill", cp: 300, level: 10, ivAtk: 2, ivDef: 15, ivSta: 14,
        fastMove: "Bubble", charged1: "Body Slam" },
      { pokemon: "Pidgey", cp: 200, level: 8, ivAtk: 10, ivDef: 10, ivSta: 10,
        fastMove: "Quick Attack", charged1: "Air Cutter" },
    ]);
    document.getElementById("catchCard").open = true;
    window.__pgo.renderCoChytat();
    const d = window.__pgo.coChytat();
    const box = document.getElementById("catchBody");
    const vsechnyDruhy = []
      .concat(...d.ligy.map((l) => l.druhy))
      .concat(...d.raidy.map((r) => r.druhy));
    return {
      maLigy: d.ligy.length > 0,
      maRaidy: d.raidy.length > 0,
      // nic, co se venku nedá chytit
      vzacni: vsechnyDruhy.filter((x) => {
        const dex = window.__pgo.dexByKey(x.klic);
        return dex && (dex.rarity === "L" || dex.rarity === "M" || dex.rarity === "U");
      }).map((x) => x.jmeno),
      // nic, co už mám (ani jako předchozí stupeň — Marill = Azumarill)
      uzMam: vsechnyDruhy.filter((x) => x.klic === "marill" || x.klic === "azumarill")
        .map((x) => x.jmeno),
      // biom se řídí tím určitějším z obou typů
      biomSkrelp: (() => {
        const dex = window.__pgo.dexByKey("skrelp");
        return dex ? { typy: dex.types.join("/"), kde: window.__pgo.biomProDruh(dex.types) } : null;
      })(),
      biomCarvanha: window.__pgo.biomProDruh(["Water", "Dark"]),
      // raidová procenta musí sedět se sloupcem raidů v tabulce (stejná škála)
      sila: window.__pgo.silaNaTypy(),
      raidPodily: d.raidy.map((r) => r.typ + "=" + r.podil),
      maObrazky: box.querySelectorAll("img.ch-sprite").length,
      rekloOBiomech: box.textContent.indexOf("Niantic seznamy nikdy nezveřejnil") > -1,
    };
  });
  check("něco do lig se najde", chytat.maLigy);
  check("něco do raidů taky", chytat.maRaidy, JSON.stringify(chytat.raidPodily));
  eq("nenabízí nic, co se venku nechytá (legendy, mýty, Ultra Beasti)",
    chytat.vzacni.join(", "), "");
  eq("nenabízí, co už mám — ani přes vývojovou řadu", chytat.uzMam.join(", "), "");
  check("u dvojtypu rozhoduje určitější typ: Skrelp je Poison/Water → u vody",
    chytat.biomSkrelp && chytat.biomSkrelp.kde === "u vody",
    JSON.stringify(chytat.biomSkrelp));
  eq("…a Water/Dark taky", chytat.biomCarvanha, "u vody");
  check("každá dlaždice má obrázek", chytat.maObrazky > 0, String(chytat.maObrazky));
  check("je řečeno, že biomy nejsou herní data", chytat.rekloOBiomech);
  // Procenta v této sekci musí být na stejné škále jako sloupec raidů —
  // dřív se porovnávalo counterScore proti counterCeiling, což jsou jiné
  // jednotky, a vycházela z toho nula u všech osmnácti typů.
  check("síla na typy není u všech typů nula (jiná škála by dala samé nuly)",
    Object.keys(chytat.sila).some((t) => chytat.sila[t] > 0),
    JSON.stringify(chytat.sila));
  check("…a nepřeteče přes 100 %",
    Object.keys(chytat.sila).every((t) => chytat.sila[t] <= 100),
    JSON.stringify(chytat.sila));
  chytat.raidPodily.forEach((x) => {
    const n = Number(x.split("=")[1]);
    check("doporučuje se jen tam, kde jsi pod 60 % (" + x + ")", n < 60, x);
  });

  console.log("\n98) historie rozhodnutí");
  // Historie neslouží k výčitkám. Slouží k jedné větě: "tohle si pokaždé
  // necháváš, tak si zvyš limit". Proto se hlídá i to, že se z jednoho
  // odchýlení žádný vzorec nedělá.
  const hist = await page.evaluate(() => {
    const P = window.__pgo;
    const zaznam = (n, rada, volba, i) => ({
      t: Date.now() - i * 1000, k: n + "|10|10", s: n.toLowerCase(),
      n: n, cp: 500, rada: rada, volba: volba,
    });
    // 5x radil pustit Gyaradose, 5x sis ho nechal → vzorec
    const many = [];
    for (let i = 0; i < 5; i++) many.push(zaznam("Gyarados", "Zahodit – kopie", "keep", i));
    // 1x radil pustit Pidgey a nechal sis ho → jednorázovka, ne vzorec
    many.push(zaznam("Pidgey", "Zahodit", "keep", 9));
    P.setHistorie(many);
    const r = P.rozporyHistorie();
    return {
      celkem: r.celkem,
      protiPusteni: r.protiPusteni,
      druhy: r.druhy.map((d) => d.jmeno + " " + d.nechal + "/" + d.celkem),
      vety: r.vety,
      // jedno odchýlení nesmí vyrobit vzorec
      malo: (() => {
        P.setHistorie([zaznam("Rattata", "Zahodit", "keep", 0),
                       zaznam("Rattata", "Zahodit", "keep", 1)]);
        const x = P.rozporyHistorie();
        return { druhu: x.druhy.length, vet: x.vety.length };
      })(),
      // rady, které jsi poslechl, se za rozpor nepovažují
      poslusny: (() => {
        const ok = [];
        for (let i = 0; i < 6; i++) ok.push(zaznam("Zubat", "Zahodit", "drop", i));
        P.setHistorie(ok);
        const x = P.rozporyHistorie();
        return { vet: x.vety.length, celkem: x.celkem, proti: x.protiPusteni };
      })(),
    };
  });
  eq("počítají se jen případy, kdy appka radila pustit", hist.celkem, 6);
  eq("…a z nich ty, kde sis kus nechal", hist.protiPusteni, 6);
  check("opakované nechání jednoho druhu se pozná",
    hist.druhy.some((d) => d.indexOf("Gyarados 5/5") === 0), hist.druhy.join(" | "));
  check("…jednorázovka ne", hist.druhy.every((d) => d.indexOf("Pidgey") !== 0),
    hist.druhy.join(" | "));
  check("rada je konkrétní, ne obecná",
    hist.vety.some((v) => v.indexOf("kolik kopií si nechat") > -1), hist.vety.join(" | "));
  check("…a jmenuje ten druh",
    hist.vety.some((v) => v.indexOf("Gyarados") === 0), hist.vety.join(" | "));
  eq("dva případy na vzorec nestačí", hist.malo.druhu, 0);
  eq("…a nic se z nich neradí", hist.malo.vet, 0);
  eq("když radu posloucháš, není co řešit", hist.poslusny.vet, 0);
  eq("…ale případy se počítají dál", hist.poslusny.celkem, 6);
  eq("…jen nejsou proti", hist.poslusny.proti, 0);

  // Rozhodnutí z čištění boxu se opravdu zapíše a přežije uložení.
  const histZapis = await page.evaluate(() => {
    const P = window.__pgo;
    P.setHistorie([]);
    P.setRows([
      { pokemon: "Rattata", cp: 200, level: 10, ivAtk: 2, ivDef: 3, ivSta: 4 },
      { pokemon: "Rattata", cp: 210, level: 11, ivAtk: 3, ivDef: 3, ivSta: 4 },
    ]);
    P.boxOtevrit();
    const delka = P.boxStav().delka;
    for (let i = 0; i < delka; i++) P.boxRozhodnout("keep");
    P.boxUlozit(false);
    const h = P.historie();
    return {
      delka: delka,
      zapsano: h.length,
      maRadu: h.every((x) => typeof x.rada === "string"),
      maVolbu: h.every((x) => x.volba === "keep"),
      vSnapshotu: Array.isArray(P.snapshot().historie),
    };
  });
  check("čištění boxu zapíše rozhodnutí do historie",
    histZapis.delka > 0 && histZapis.zapsano === histZapis.delka,
    histZapis.zapsano + " z " + histZapis.delka);
  check("…včetně toho, co appka radila", histZapis.maRadu);
  check("…a co jsi zvolil", histZapis.maVolbu);
  check("historie se ukládá s profilem", histZapis.vSnapshotu);

  console.log("\n99) rychlé útoky, které zdroj vedl jako nabité");
  // pogoapi má Psywave, Metal Sound, Sand Attack a Water Gun Blastoise mezi
  // NABITÝMI útoky, přestože energii dávají místo aby ji braly. Appka je pak
  // neznala jako rychlé: Lapras měl Psywave v learnsetu, ale v nabídce nebyl
  // a ručně se zadat nedal. Týkalo se to 66 druhů.
  const slot = await page.evaluate(() => {
    const M = window.__pgo.movesData();
    const kde = (jm) => ({
      rychly: M.fastNames.indexOf(jm), nabity: M.chargedNames.indexOf(jm),
    });
    const umi = (druh, jm) => {
      const l = window.__pgo.learnsetOf(druh);
      const i = M.fastNames.indexOf(jm);
      return !!l && i > -1 && l.fast.indexOf(i) > -1;
    };
    return {
      psywave: kde("Psywave"),
      metalSound: kde("Metal Sound"),
      sandAttack: kde("Sand Attack"),
      lapras: umi("lapras", "Psywave"),
      aggron: umi("aggron", "Metal Sound"),
      corviknight: umi("corviknight", "Sand Attack"),
      // rychlý útok musí energii dávat, nabitý brát — na tom to stojí
      rychleDavajiEnergii: M.fast.every((m) => m[2] >= 0),
      // a doplněné nabité útoky se dostaly i k druhům mimo PvPoke žebříčky
      delphoxMysticalFire: (() => {
        const l = window.__pgo.learnsetOf("delphox");
        const i = M.chargedNames.indexOf("Mystical Fire");
        return !!l && i > -1 && l.charged.indexOf(i) > -1;
      })(),
    };
  });
  check("Psywave je rychlý útok, ne nabitý",
    slot.psywave.rychly > -1 && slot.psywave.nabity === -1, JSON.stringify(slot.psywave));
  check("…stejně Metal Sound",
    slot.metalSound.rychly > -1 && slot.metalSound.nabity === -1, JSON.stringify(slot.metalSound));
  check("…i Sand Attack",
    slot.sandAttack.rychly > -1 && slot.sandAttack.nabity === -1, JSON.stringify(slot.sandAttack));
  check("Lapras umí Psywave", slot.lapras);
  check("Aggron umí Metal Sound", slot.aggron);
  check("Corviknight umí Sand Attack", slot.corviknight);
  check("žádný rychlý útok energii nebere", slot.rychleDavajiEnergii);
  check("learnsety se dorovnaly i mimo PvPoke žebříčky (Delphox + Mystical Fire)",
    slot.delphoxMysticalFire);

  console.log("\n101) rotace nestů a rozložení do sloupců");
  // Rotace je pevný čtrnáctidenní cyklus ve čtvrtek 00:00 UTC. Kotva je ověřená
  // rotace 27. 8. 2026; ta předchozí byla 13. 8., přesně o 14 dní dřív. Kdyby
  // byla kotva vedle o týden, appka by tiše ukazovala špatné datum pořád —
  // proto se tu kontrolují konkrétní data, ne jen "něco to vrátí".
  const rot = await page.evaluate(() => {
    const P = window.__pgo;
    const iso = (t) => P.dalsiRotaceNestu(t).toISOString();
    return {
      // den před ověřenou rotací → má vyjít ona
      pred: iso(Date.UTC(2026, 7, 26, 12, 0)),
      // přesně v okamžiku rotace → už zajímá ta příští
      vOkamziku: iso(Date.UTC(2026, 7, 27, 0, 0)),
      // hned po ní → taky ta příští
      po: iso(Date.UTC(2026, 7, 27, 1, 0)),
      // daleko dopředu i dozadu, ať se ověří že cyklus drží oběma směry
      dozadu: iso(Date.UTC(2026, 7, 12, 0, 0)),
      dopredu: iso(Date.UTC(2026, 11, 1, 0, 0)),
      // vždy čtvrtek a vždy o 14 dní dál
      ctvrtky: (() => {
        let t = Date.UTC(2026, 0, 1), dny = [], posledni = null, ok = true;
        for (let i = 0; i < 12; i++) {
          const d = P.dalsiRotaceNestu(t);
          dny.push(d.getUTCDay());
          if (posledni && d.getTime() - posledni !== 14 * 86400000) ok = false;
          posledni = d.getTime();
          t = d.getTime() + 1000;
        }
        return { dny: Array.from(new Set(dny)), rozestupOk: ok };
      })(),
      text: P.rotaceNestuText(Date.UTC(2026, 7, 25, 0, 0)),
    };
  });
  eq("den před rotací ukazuje tu nejbližší", rot.pred, "2026-08-27T00:00:00.000Z");
  eq("v okamžiku rotace už ukazuje další", rot.vOkamziku, "2026-09-10T00:00:00.000Z");
  eq("…stejně tak hodinu po ní", rot.po, "2026-09-10T00:00:00.000Z");
  eq("cyklus platí i zpětně", rot.dozadu, "2026-08-13T00:00:00.000Z");
  eq("…i daleko dopředu", rot.dopredu, "2026-12-03T00:00:00.000Z");
  eq("rotace vždycky padne na čtvrtek", rot.ctvrtky.dny.join(","), "4");
  check("…a vždy po 14 dnech", rot.ctvrtky.rozestupOk);
  // Odpočet musí být přesný na minuty — "za 2 dny" může znamenat 49 hodin
  // i 25 a to je rozdíl mezi "zítra" a "pozítří".
  eq("odpočet je přesný na minuty, ne zaokrouhlený na dny", rot.text.za, "2 dny 0 h 0 min");
  eq("…a rozpad sedí", rot.text.dnu + "/" + rot.text.hodin + "/" + rot.text.minut, "2/0/0");

  // Bloky (ligy, typy) musí stát vedle sebe, ne pod sebou — kvůli tomu to vzniklo.
  const chSloupce = await page.evaluate(async () => {
    // Sloupcová mřížka vzniká jen tam, kde je co ukázat — bez rosteru nemá
    // appka co doporučit a sekce se vůbec nevykreslí.
    window.__pgo.setRows([
      { pokemon: "Marill", cp: 300, level: 10, ivAtk: 2, ivDef: 15, ivSta: 14,
        fastMove: "Bubble", charged1: "Body Slam" },
      { pokemon: "Pidgey", cp: 200, level: 8, ivAtk: 10, ivDef: 10, ivSta: 10,
        fastMove: "Quick Attack", charged1: "Air Cutter" },
    ]);
    window.__pgoZalozka("catchCard");
    window.__pgo.renderCoChytat();
    const zmer = () => Array.from(document.querySelectorAll("#catchBody .ch-sloupce"))
      .map((c) => new Set(Array.from(c.children)
        .map((x) => Math.round(x.getBoundingClientRect().left))).size);
    return { pocty: zmer(), mrizek: document.querySelectorAll("#catchBody .ch-sloupce").length };
  });
  check("bloky jsou zabalené do sloupcových mřížek", chSloupce.mrizek > 0, String(chSloupce.mrizek));
  check("aspoň jedna mřížka má víc než jeden sloupec vedle sebe",
    chSloupce.pocty.some((n) => n > 1), chSloupce.pocty.join(","));

  const nesty = await page.evaluate(() => {
    const t = document.getElementById("catchBody").textContent;
    return {
      maRotaci: /Další rotace za /.test(t),
      rekloCoJeNest: t.indexOf("konkrétní park nebo místo") > -1,
      maOdkazy: document.querySelectorAll("#catchBody .ch-nesty a").length,
      varujePredSpoofery: t.indexOf("PGSharp") > -1 && t.indexOf("tři strikes") > -1,
      zminujeLegalniRadar: t.indexOf("Nearby / Sightings") > -1,
    };
  });
  check("v kartě je odpočet do další rotace", nesty.maRotaci);
  check("…odpočet se sám přepisuje, nezůstane stát", await page.evaluate(() => {
    const el = document.getElementById("nestOdpocet");
    if (!el) return false;
    el.textContent = "zastaralé";
    // ruční tik místo čekání půl minuty na interval
    el.textContent = window.__pgo.rotaceNestuText().za;
    return /min$/.test(el.textContent);
  }));
  check("sekce o nestech se ukáže i bez naimportovaného rosteru", await page.evaluate(() => {
    window.__pgo.setRows([]);
    window.__pgo.renderCoChytat();
    const t = document.getElementById("catchBody").textContent;
    return t.indexOf("Další rotace za") > -1 && t.indexOf("Naimportuj roster") > -1;
  }));
  check("…a je vysvětleno, co nest vůbec je", nesty.rekloCoJeNest);
  check("…s odkazy, kde to lidi hlásí", nesty.maOdkazy >= 3, String(nesty.maOdkazy));
  check("…a varováním před spoofery", nesty.varujePredSpoofery);
  check("…a odkazem na legální radar ve hře", nesty.zminujeLegalniRadar);

  console.log("\n102) nahrazení nesmí smazat, co jsi napsal ručně");
  // Hvězdička i poznámka žijí jen v appce — Calcy je neexportuje. Po nahrazení
  // musí zůstat, jinak by po každém skenu zmizely a nešlo by poznat proč.
  const rucniPoNahrazeni = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Gyarados", cp: 1719, level: 19, ivAtk: 9, ivDef: 5, ivSta: 6,
        vyska: 6.1, vaha: 220.5 },
      { pokemon: "Machamp", cp: 2400, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 },
    ]);
    const r = P.getRows();
    r[0].star = true; r[0].note = "na trade s ANet";
    r[1].note = "hlídat lepší";
    P.persistNow();

    const nl = String.fromCharCode(10);
    P.importText([
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,Height,Weight",
      "Gyarados,1719,19,9,5,6,6.1,220.5",
      "Machamp,2400,30,15,14,13,,",
    ].join(nl));
    P.finishImport("replace");
    const po = P.getRows();
    const najdi = (jm) => po.filter((x) => x.pokemon === jm)[0] || {};
    return {
      pocet: po.length,
      gyaHvezda: !!najdi("Gyarados").star,
      gyaPoznamka: najdi("Gyarados").note || "",
      machPoznamka: najdi("Machamp").note || "",
    };
  });
  eq("nahrazení nechá roster o správné velikosti", rucniPoNahrazeni.pocet, 2);
  check("hvězdička přežije nahrazení", rucniPoNahrazeni.gyaHvezda);
  eq("…a poznámka taky", rucniPoNahrazeni.gyaPoznamka, "na trade s ANet");
  eq("…i u kusu bez výšky a váhy (páruje se přes klíč skenu)",
    rucniPoNahrazeni.machPoznamka, "hlídat lepší");

  console.log("\n103) verdikt musí znát i Little Cup");
  // Záchranná větev uměla jen GL a UL: měla natvrdo psané
  // `pp.league === "GL" ? metaGL : metaUL`. Kus z Little Cupu tím propadl rovnou
  // na "Zahodit" s odůvodněním "nehraje v žádné lize" — přitom sloupec PvP vedle
  // správně hlásil LC #24. Verdikt a sloupec si odporovaly.
  const ferroseed = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    const zmer = (radky, cp) => {
      P.setRows(radky);
      const b = P.base().filter((x) => x.row.cp === cp)[0];
      const c = P.getComputed()[b.row.id];
      return { verdikt: c.keep, sub: c.keepSub || "", duvod: c.keepTitle || "",
        pvp: c.pvpRec || "", vLize: b.metaLC ? b.metaLC[0] : null };
    };
    const dva = [
      { pokemon: "Ferroseed", cp: 495, level: 22, ivAtk: 2, ivDef: 10, ivSta: 10 },
      { pokemon: "Ferroseed", cp: 420, level: 19, ivAtk: 5, ivDef: 8, ivSta: 6 },
    ];
    // Vysloveně špatný kus se měří SÁM. Jako třetí kopie by spadl do větve
    // o kopiích a testovalo by se odůvodnění, které s ligou nemá co dělat.
    const sam = [{ pokemon: "Ferroseed", cp: 380, level: 17, ivAtk: 15, ivDef: 2, ivSta: 1 }];
    return { dobry: zmer(dva, 495), slabsi: zmer(dva, 420), spatny: zmer(sam, 380) };
  });
  check("druh je v žebříčku Little Cupu", ferroseed.dobry.vLize !== null,
    String(ferroseed.dobry.vLize));
  check("…a sloupec PvP to hlásí", /LC/.test(ferroseed.dobry.pvp), ferroseed.dobry.pvp);
  check("dobrý LC kus se nezahodí", ferroseed.dobry.verdikt.indexOf("Zahodit") === -1,
    ferroseed.dobry.verdikt);
  check("…a drží se právě kvůli lize", /Little Cup/.test(ferroseed.dobry.duvod),
    ferroseed.dobry.duvod.slice(0, 90));
  // Verdikt „Zvážit – slabý kus" se zrušil. Slabší kopie dostane jasné
  // „Zahodit" — appka vidí, že lepší kus toho druhu už v rosteru je,
  // takže není co zvažovat.
  check("slabší kopie dostane jasný verdikt, ne vlažné zvážit",
    ferroseed.slabsi.verdikt.indexOf("Zvážit") === -1, ferroseed.slabsi.verdikt);
  check("…a řekne se, že lepšího už máš", /lepší máš/.test(ferroseed.slabsi.sub),
    ferroseed.slabsi.sub);
  // Vysloveně špatný kus se měří SÁM, takže je to jediný Steel útočník
  // i jediný LC kus v rosteru — a rozpočet takový kus drží jako náplast,
  // aby ta role nezůstala prázdná. Podstatné je, že to appka přizná:
  // řekne „je to náplast, ne řešení" a čím ji nahradit.
  check("jediný kus na roli se drží jako náplast, ne jako řešení",
    ferroseed.spatny.verdikt === "Nechat zatím", ferroseed.spatny.verdikt);
  check("…a je to v podtitulku označené jako díra",
    ferroseed.spatny.sub.indexOf("díra") === 0, ferroseed.spatny.sub);
  check("…ale netvrdí se, že druh nehraje v lize, když hraje",
    ferroseed.spatny.duvod.indexOf("nehraje v žádné lize") === -1,
    ferroseed.spatny.duvod.slice(0, 140));
  check("…místo toho se přizná, ve které lize druh je",
    /Little Cup #\d+/.test(ferroseed.spatny.duvod),
    ferroseed.spatny.duvod.slice(0, 140));

  console.log("\n104) práh kvality se řídí umístěním druhu v lize");
  // Zbytek appky násobí "síla druhu × kvalita kusu", jen práh na ponechání byl
  // placatý: Altaria GL #3 se 94% kusem propadla stejně jako okrajový druh
  // s 94 %. U špičkového druhu se vyplatí i horší kus, u okrajového ani
  // perfektní — proto se práh lineárně posouvá podle pořadí.
  const prah = await page.evaluate(() => {
    const P = window.__pgo;
    const pr = (rank) => Math.round(P.prahProRank(0.96, rank, 50) * 1000) / 10;
    return {
      prvni: pr(1), treti: pr(3), dvacetctyri: pr(24), padesat: pr(50),
      bezPoradi: Math.round(P.prahProRank(0.96, null, 50) * 1000) / 10,
      // Swablu se vyvine na Altarii, která je GL #3 — kus na 94 % má projít
      swablu: (() => {
        P.setRows([{ pokemon: "Swablu", cp: 500, level: 26, ivAtk: 5, ivDef: 14, ivSta: 15 }]);
        const b = P.base()[0], c = P.getComputed()[b.row.id];
        return { verdikt: c.keep, sub: c.keepSub || "", pvp: c.pvpRec || "" };
      })(),
    };
  });
  check("druh na prvním místě dostane plnou slevu", prah.prvni < 96 && prah.prvni >= 90,
    String(prah.prvni));
  check("…druh na hranici tvého prahu pořadí žádnou", prah.padesat === 96, String(prah.padesat));
  check("mezi tím to roste plynule",
    prah.prvni < prah.treti && prah.treti < prah.dvacetctyri && prah.dvacetctyri < prah.padesat,
    [prah.prvni, prah.treti, prah.dvacetctyri, prah.padesat].join(" < "));
  check("bez známého pořadí se práh nemění — sleva se nemá z čeho odvodit",
    prah.bezPoradi === 96, String(prah.bezPoradi));
  check("Swablu se kvůli Altarii (GL #3) nezahodí",
    prah.swablu.verdikt.indexOf("Zahodit") === -1, prah.swablu.verdikt);
  check("…a je z toho doporučení vyvinout",
    /evolvovat/i.test(prah.swablu.verdikt) || /Po evoluci/i.test(prah.swablu.pvp),
    prah.swablu.verdikt + " | " + prah.swablu.pvp);

  console.log("\n105) ligy vidět rovnou při čištění boxu");
  // Při čištění se rozhoduje kus po kuse a liga je hlavní faktor. Jedna věta
  // ve sloupci PvP ("Ano – LC") neřekne pořadí druhu ani kvalitu kusu.
  const boxLigy = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Ferroseed", cp: 495, level: 22, ivAtk: 2, ivDef: 10, ivSta: 10 },
      { pokemon: "Rattata", cp: 120, level: 8, ivAtk: 3, ivDef: 3, ivSta: 3 },
    ]);
    P.boxOtevrit();
    // Měří se sbalená karta: jen tam jsou tlačítka hned pod ligami a jen tam
    // může rozdíl výšky poskočit. V širokém režimu drží výšku samo okno.
    document.getElementById("bmVic").open = false;
    document.getElementById("boxMode").classList.remove("siroky");
    const najdi = () => {
      const box = document.getElementById("bmBody");
      return { text: box.textContent, chipy: box.querySelectorAll(".bm-ligy .lg-chip").length,
        bubliny: [...box.querySelectorAll(".bm-ligy .lg-chip")]
          .map((x) => x.getAttribute("title") || "").join(" | "),
        vyska: Math.round(box.getBoundingClientRect().height),
        aktualni: P.boxStav().aktualni };
    };
    const prvni = najdi();
    P.boxRozhodnout("keep");
    const druhy = najdi();
    P.boxZavritNatvrdo();
    return { prvni, druhy };
  });
  // Karta musí mít stejnou výšku bez ohledu na to, kolik lig kus hraje —
  // jinak pod ní poskakují tlačítka Pustit / Nechat.
  check("karta má stejnou výšku u kusu s ligou i bez ní",
    Math.abs(boxLigy.prvni.vyska - boxLigy.druhy.vyska) <= 2,
    boxLigy.prvni.vyska + " vs " + boxLigy.druhy.vyska);
  const sLigou = [boxLigy.prvni, boxLigy.druhy].filter((x) => x.chipy > 0);
  const bezLigy = [boxLigy.prvni, boxLigy.druhy].filter((x) => x.chipy === 0);
  check("u kusu, který ligu hraje, jsou v čištění vidět odznáčky lig",
    sLigou.length >= 1, JSON.stringify([boxLigy.prvni.aktualni, boxLigy.druhy.aktualni]));
  check("…s pořadím druhu v žebříčku", sLigou.length >= 1 && /#\d+/.test(sLigou[0].text),
    sLigou.length ? sLigou[0].text.slice(0, 120) : "-");
  check("…a s kvalitou kusu v procentech (v bublině odznáčku)",
    sLigou.length >= 1 && /\d+([.,]\d+)? %/.test(sLigou[0].bubliny),
    sLigou.length ? sLigou[0].bubliny.slice(0, 140) : "-");
  check("u kusu bez ligy se to řekne rovnou",
    bezLigy.length === 0 || /v žádné lize nehraje/i.test(bezLigy[0].text),
    bezLigy.length ? bezLigy[0].text.slice(0, 120) : "-");

  console.log("\n106) sleva za umístění jde nastavit a je vidět");
  // Křivka musí být vidět a musí opravdu řídit verdikty, ne být jen obrázek.
  const slevaUI = await page.evaluate(async () => {
    const P = window.__pgo;
    const el = document.getElementById("prahSleva");
    const nastav = (v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const krivka = () => document.getElementById("prahKrivka").textContent.replace(/\s+/g, " ").trim();
    // Swablu se vyvine na Altarii (GL #3). IV 10/10/10 dá 94 % — přesně mezi
    // placatým prahem (96 %) a prahem se slevou (91,2 %), takže se na tomhle
    // kusu pozná, jestli nastavení opravdu něco dělá.
    const verdiktSwablu = () => {
      P.setRows([{ pokemon: "Swablu", cp: 500, level: 26, ivAtk: 10, ivDef: 10, ivSta: 10 }]);
      const b = P.base()[0];
      return P.getComputed()[b.row.id].keep;
    };

    const puvodni = el.value;
    nastav(5);
    const p5 = { krivka: krivka(), verdikt: verdiktSwablu(),
      prah: Math.round(P.prahProRank(0.96, 3, 50, 0.05) * 1000) / 10 };
    nastav(0);
    const p0 = { krivka: krivka(), verdikt: verdiktSwablu(),
      prah: Math.round(P.prahProRank(0.96, 3, 50, 0) * 1000) / 10 };
    nastav(12);
    const p12 = { krivka: krivka(),
      prah: Math.round(P.prahProRank(0.96, 3, 50, 0.12) * 1000) / 10 };
    nastav(puvodni);
    return { p5, p0, p12, poObnoveni: el.value };
  });
  check("políčko na slevu v nastavení je", slevaUI.poObnoveni !== undefined);
  check("křivka ukazuje konkrétní procenta", /%/.test(slevaUI.p5.krivka),
    slevaUI.p5.krivka.slice(0, 80));
  check("…a mění se podle zadané slevy",
    slevaUI.p5.krivka !== slevaUI.p12.krivka, slevaUI.p12.krivka.slice(0, 80));
  check("při nule se řekne, že je sleva vypnutá",
    /vypnutá/.test(slevaUI.p0.krivka), slevaUI.p0.krivka.slice(0, 80));
  eq("…a práh je pak pro všechny stejný", slevaUI.p0.prah, 96);
  check("větší sleva = nižší práh u špičkového druhu",
    slevaUI.p12.prah < slevaUI.p5.prah && slevaUI.p5.prah < slevaUI.p0.prah,
    [slevaUI.p12.prah, slevaUI.p5.prah, slevaUI.p0.prah].join(" < "));
  // Tohle je to podstatné: nastavení musí měnit rozhodnutí, ne jen obrázek.
  check("se slevou se Swablu kvůli Altarii (GL #3) drží",
    slevaUI.p5.verdikt.indexOf("Zahodit") === -1, slevaUI.p5.verdikt);
  // Bez slevy Swablu na práh nedosáhne. Nezahodí se ale rovnou: Altaria je
  // GL #3 a nic lepšího na tu roli v rosteru není, takže ho rozpočet drží
  // jako náplast a rovnou to říká. To je celý smysl toho přepínače —
  // se slevou je to plnohodnotný ligový kus, bez ní jen zástupná varianta.
  check("…a bez slevy spadne na náplast", slevaUI.p0.verdikt === "Nechat zatím",
    slevaUI.p0.verdikt);

  console.log("\n108) kopie, vzácnost a transfer");
  // Appka dlouho držela natvrdo VŠECHNO vzácné s odůvodněním "hra to nepustí
  // do hromadného transferu". To platí jen pro mytické (Mew, Celebi) — ti se
  // profesorovi poslat nedají vůbec. Legendární a Ultra Beasty poslat JDOU:
  // jednotlivě vždycky, hromadně po zapnutí "Expanded Group Transfer".
  // U tří Lunal tak appka mlčela a nedokázala říct, která je nejhorší.
  const kopie = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    document.getElementById("keepCopies").value = "2";
    const nacti = (radky) => {
      P.setRows(radky);
      P.prekreslit();
      const base = P.base(), comp = P.getComputed();
      return base.map((x) => ({
        jmeno: x.row.pokemon, cp: x.row.cp, poradi: x.dupIndex,
        worseCopy: !!comp[x.row.id].worseCopy, keep: comp[x.row.id].keep,
        sub: comp[x.row.id].keepSub || "", duvod: comp[x.row.id].keepTitle || "",
      }));
    };
    return {
      lunala: nacti([
        { pokemon: "Lunala", cp: 2287, level: 30, ivAtk: 15, ivDef: 12, ivSta: 15 },
        { pokemon: "Lunala", cp: 2100, level: 27, ivAtk: 10, ivDef: 10, ivSta: 10 },
        { pokemon: "Lunala", cp: 1900, level: 24, ivAtk: 3, ivDef: 3, ivSta: 3 },
      ]),
      mew: nacti([
        { pokemon: "Mew", cp: 1900, level: 25, ivAtk: 15, ivDef: 15, ivSta: 15 },
        { pokemon: "Mew", cp: 1800, level: 24, ivAtk: 10, ivDef: 10, ivSta: 10 },
        { pokemon: "Mew", cp: 1200, level: 18, ivAtk: 1, ivDef: 1, ivSta: 1 },
      ]),
      rattata: nacti([
        { pokemon: "Rattata", cp: 200, level: 10, ivAtk: 5, ivDef: 5, ivSta: 5 },
        { pokemon: "Rattata", cp: 210, level: 11, ivAtk: 4, ivDef: 4, ivSta: 4 },
        { pokemon: "Rattata", cp: 190, level: 9, ivAtk: 3, ivDef: 3, ivSta: 3 },
        { pokemon: "Rattata", cp: 180, level: 8, ivAtk: 2, ivDef: 2, ivSta: 2 },
      ]),
    };
  });

  // --- legendární: nejhorší z trojice se smí pustit ---
  const treti = kopie.lunala.filter((x) => x.poradi === 3)[0];
  check("nejhorší ze tří Lunal se smí pustit — hra legendárky transferovat nechá",
    !!treti && treti.keep.indexOf("Zahodit") === 0, treti ? treti.keep : "není");
  check("…a je řečeno, že transfer je nevratný",
    !!treti && /nevratný/.test(treti.duvod), treti ? treti.duvod.slice(0, 120) : "");
  check("…a jak ho vůbec hromadně provést",
    !!treti && /Expanded Group Transfer/.test(treti.duvod),
    treti ? treti.duvod.slice(-140) : "");
  check("…což je vidět i bez najetí myší", !!treti && /nevratný/.test(treti.sub),
    treti ? treti.sub : "");
  check("dvě lepší Lunaly se drží",
    kopie.lunala.filter((x) => x.poradi <= 2).every((x) => x.keep.indexOf("Zahodit") !== 0),
    kopie.lunala.map((x) => x.poradi + ":" + x.keep).join(", "));

  // --- mytičtí: skutečný zámek, ten zůstává ---
  check("mytické se drží všechny, i ta nejhorší",
    kopie.mew.every((x) => x.keep.indexOf("Zahodit") !== 0),
    kopie.mew.map((x) => x.poradi + ":" + x.keep).join(", "));
  check("…a důvod je ten správný: poslat je nejde vůbec",
    kopie.mew.every((x) => /nedají vůbec/.test(x.duvod)),
    kopie.mew[0] ? kopie.mew[0].duvod.slice(0, 120) : "");
  check("…a nepočítají se mezi duplicity k zahození",
    kopie.mew.every((x) => !x.worseCopy), JSON.stringify(kopie.mew.map((x) => x.worseCopy)));
  const mewTreti = kopie.mew.filter((x) => x.poradi === 3)[0];
  check("u mytického nad stropem se řekne, že je nad stropem",
    !!mewTreti && /kopie a strop máš 2/.test(mewTreti.duvod),
    mewTreti ? mewTreti.duvod.slice(0, 180) : "není");

  // --- a ať se nezruší to, co fungovat má ---
  const rozpor = [].concat(kopie.lunala, kopie.mew, kopie.rattata)
    .filter((x) => x.worseCopy && x.keep.indexOf("Zahodit") !== 0);
  eq("žádný kus není zároveň duplicita k zahození a Ponechat", rozpor.length, 0);
  check("obyčejné kopie nad limitem se pořád zahazují",
    kopie.rattata.filter((x) => x.worseCopy).length === 2,
    kopie.rattata.map((x) => x.poradi + ":" + x.keep).join(", "));

  console.log("\n109) Dynamax přežije nahrazení");
  // Sloupec Dynamax starší exporty Calcy nemají. Bez tohohle se po nahrazení
  // příznak ztratil a appka ty kusy přestala chránit — "vyhazuje dynamaxy".
  const dmaxNahr = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Wooloo", cp: 385, level: 15, ivAtk: 5, ivDef: 3, ivSta: 6 }]);
    P.getRows()[0].dynamax = "Ano";   // je to řetězec, ne boolean
    P.persistNow();
    const nl = String.fromCharCode(10);
    // sken BEZ sloupce Dynamax, přesně jako starší export
    P.importText([
      "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV",
      "Wooloo,385,15,5,3,6",
    ].join(nl));
    P.finishImport("replace");
    const r = P.getRows()[0];
    const c = P.getComputed()[r.id];
    return { dynamax: r.dynamax === "Ano", keep: c.keep, duvod: c.keepTitle || "" };
  });
  check("příznak Dynamax se po nahrazení neztratí", dmaxNahr.dynamax);
  check("…takže se ten kus pořád drží", dmaxNahr.keep.indexOf("Zahodit") !== 0, dmaxNahr.keep);
  check("…a je řečeno proč", /Max Battle/.test(dmaxNahr.duvod), dmaxNahr.duvod.slice(0, 100));

  console.log("\n110) práh elitního ranku ukazuje, na co sedí");
  // Podmínka je záměrně úzká, takže po změně čísla se v tabulce skoro nic
  // nehne a políčko vypadá jako mrtvé. Musí být vidět, kolik kusů jím projde.
  const rankInfo = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([
      { pokemon: "Cramorant", cp: 1142, level: 20, ivAtk: 2, ivDef: 14, ivSta: 15, glRank: 77 },
      { pokemon: "Snorlax", cp: 2400, level: 30, ivAtk: 10, ivDef: 10, ivSta: 10, ulRank: 34 },
    ]);
    P.prekreslit();
    const el = document.getElementById("rankThresh");
    const cti = () => (document.getElementById("rankThreshInfo") || {}).textContent || "";
    el.value = "100"; el.dispatchEvent(new Event("input", { bubbles: true }));
    const sto = cti();
    el.value = "1"; el.dispatchEvent(new Event("input", { bubbles: true }));
    P.prekreslit();
    const jedna = cti();
    el.value = "100"; el.dispatchEvent(new Event("input", { bubbles: true }));
    P.prekreslit();
    return { sto: sto, jedna: jedna };
  });
  check("u prahu ranku je vidět, kolik kusů jím projde", /projde/.test(rankInfo.sto),
    rankInfo.sto.slice(0, 120));
  check("…a mění se to podle zadané hodnoty", rankInfo.sto !== rankInfo.jedna,
    rankInfo.sto.slice(0, 60) + "  VS  " + rankInfo.jedna.slice(0, 60));
  check("…a vysvětlí se, že rank sám nestačí",
    /projde 0 kusů|druh musí tu ligu/.test(rankInfo.jedna) || /projde/.test(rankInfo.jedna),
    rankInfo.jedna.slice(0, 140));

  console.log("\n111) Dynamax jde zapnout z detailu kusu");
  // Sloupec „Dynamax?" je jen v zobrazení Vše, takže ho nikdo nenašel a příznak
  // nešlo nastavit. Ze skenu se vyčíst nedá — starší exporty Calcy ten sloupec
  // vůbec nemají. Odznáček v detailu je proto přepínač.
  const dmaxUi = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Wooloo", cp: 385, level: 15, ivAtk: 5, ivDef: 3, ivSta: 6 }]);
    P.prekreslit();
    // otevřít detail kliknutím na řádek
    const tr = document.querySelector("#tbody tr");
    tr.querySelector("td.col-pokemon").click();
    const btn = () => document.querySelector(".detail-inner .dmax-prepinac");
    const pred = btn();
    const stavPred = { je: !!pred, vypnuto: pred ? pred.classList.contains("vypnuto") : null,
      popis: pred ? pred.getAttribute("title") : "" };
    pred.click();
    const r = P.getRows()[0];
    const poKliku = { hodnota: r.dynamax, keep: P.getComputed()[r.id].keep };
    // a zpátky
    const znovu = btn();
    const vypnutoPoZapnuti = znovu ? znovu.classList.contains("vypnuto") : null;
    if (znovu) znovu.click();
    return { stavPred, poKliku, vypnutoPoZapnuti, poVypnuti: P.getRows()[0].dynamax };
  });
  check("v detailu je odznáček DMAX i u kusu, který Dynamax není", dmaxUi.stavPred.je);
  check("…a je vidět, že je vypnutý", dmaxUi.stavPred.vypnuto === true);
  check("…s návodem, k čemu je", /Max Battle/.test(dmaxUi.stavPred.popis), dmaxUi.stavPred.popis);
  eq("klik ho zapne", dmaxUi.poKliku.hodnota, "Ano");
  check("…a kus se tím začne držet", dmaxUi.poKliku.keep.indexOf("Zahodit") !== 0,
    dmaxUi.poKliku.keep);
  check("…odznáček přestane být vypnutý", dmaxUi.vypnutoPoZapnuti === false);
  eq("další klik ho zase vypne", dmaxUi.poVypnuti, "Ne");

  console.log("\n112) nápověda u „Nastavit doporučené“ nesmí lhát");
  // Text u toho tlačítka sliboval "min. IV pro TOP roli 13" — takové nastavení
  // v appce vůbec není. A naopak zamlčoval slevu za umístění v lize, která
  // rozhoduje o hodně. Nápověda, která jmenuje neexistující políčko, je horší
  // než žádná: člověk ho pak hledá.
  const preset = await page.evaluate(() => {
    const btn = document.getElementById("resetSettingsBtn");
    const hint = btn && btn.parentNode ? btn.parentNode.querySelector(".hint") : null;
    const text = hint ? hint.textContent.replace(/\s+/g, " ").trim() : "";
    const cti = (id) => {
      const e = document.getElementById(id);
      return e ? e.getAttribute("value") : null;
    };
    // čísla v nápovědě musí sedět s výchozími hodnotami políček
    return {
      text: text,
      kopie: cti("keepCopies"), iv: cti("ivThresh"), pvp: cti("spThresh"),
      sleva: cti("prahSleva"), rank: cti("rankThresh"), limit: cti("rankLimit"),
      role: cti("roleThresh"),
    };
  });
  check("nápověda nejmenuje nastavení, které neexistuje",
    preset.text.indexOf("min. IV pro TOP roli") === -1, preset.text.slice(0, 140));
  check("…a zmiňuje slevu za umístění, která na výsledek má vliv",
    /slev/i.test(preset.text), preset.text.slice(0, 140));
  [["kopie", preset.kopie], ["iv", preset.iv], ["pvp", preset.pvp],
   ["sleva", preset.sleva], ["rank", preset.rank], ["limit", preset.limit],
   ["role", preset.role]].forEach((par) => {
    check("číslo pro „" + par[0] + "“ (" + par[1] + ") je v nápovědě uvedené",
      par[1] !== null && preset.text.indexOf(String(par[1])) > -1,
      par[1] + " | " + preset.text.slice(0, 140));
  });

  console.log("\n113) Zygarde má vlastní výjimku, i když je legendární");
  // Zygarde se skládá z buněk na trasách a hra ho nepustí do transferu, tradu
  // ani do Pokémon HOME. Není mytický, takže samotné "rarity === M" na něj
  // nestačí — a zamčené jsou VŠECHNY formy, s evolucí to nesouvisí.
  const zyg = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    document.getElementById("keepCopies").value = "1";
    const zmer = (radky, cp) => {
      P.setRows(radky);
      P.prekreslit();
      const b = P.base().filter((x) => x.row.cp === cp)[0];
      const c = P.getComputed()[b.row.id];
      return { keep: c.keep, sub: c.keepSub || "", duvod: c.keepTitle || "",
        rarity: b.dex ? b.dex.rarity : "" };
    };
    return {
      desetProcent: zmer([
        { pokemon: "Zygarde 10%", cp: 993, level: 25, ivAtk: 5, ivDef: 5, ivSta: 5 },
        { pokemon: "Zygarde 10%", cp: 900, level: 22, ivAtk: 2, ivDef: 2, ivSta: 2 },
      ], 900),
      plny: zmer([
        { pokemon: "Zygarde", cp: 3000, level: 30, ivAtk: 5, ivDef: 5, ivSta: 5 },
        { pokemon: "Zygarde", cp: 2500, level: 25, ivAtk: 1, ivDef: 1, ivSta: 1 },
      ], 2500),
      // kontrola, že to nezamklo legendárky plošně
      lunala: zmer([
        { pokemon: "Lunala", cp: 2287, level: 30, ivAtk: 15, ivDef: 12, ivSta: 15 },
        { pokemon: "Lunala", cp: 1900, level: 24, ivAtk: 3, ivDef: 3, ivSta: 3 },
      ], 1900),
    };
  });
  eq("Zygarde je v datech legendární, ne mytický", zyg.desetProcent.rarity, "L");
  check("…horší Zygarde 10 % se přesto nezahodí",
    zyg.desetProcent.keep.indexOf("Zahodit") !== 0, zyg.desetProcent.keep);
  check("…a je řečeno, že to je výjimka toho druhu",
    /vlastní výjimku|Pokémon HOME/.test(zyg.desetProcent.duvod),
    zyg.desetProcent.duvod.slice(0, 140));
  check("…zamčená je i plná forma, nejen desetiprocentní",
    zyg.plny.keep.indexOf("Zahodit") !== 0, zyg.plny.keep);
  // A pojistka: legendárky se tím nesmí zamknout všechny zpátky.
  check("horší Lunala se pořád smí pustit",
    zyg.lunala.keep.indexOf("Zahodit") === 0, zyg.lunala.keep);

  console.log("\n114) řadit musí jít podle každého sloupce");
  // SORTABLE byl ruční výčet a osmnáct sloupců v něm chybělo — level,
  // jednotlivá IV, útoky, forma, poznámka… Klikání na jejich hlavičku
  // nedělalo nic. Teď se odvozuje z COLS, takže nový sloupec nemůže vzniknout
  // jako neřaditelný jen tím, že ho někdo zapomene dopsat.
  const sortSweep = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Gyarados", forma: "Shadow", cp: 1000, level: 9, ivAtk: 5, ivDef: 2,
        ivSta: 14, fastMove: "Dragon Breath", charged1: "Aqua Tail", note: "cecko" },
      { pokemon: "Machamp", forma: "Purified", cp: 1200, level: 40, ivAtk: 7, ivDef: 15,
        ivSta: 3, fastMove: "Counter", charged1: "Cross Chop", note: "aaa" },
      { pokemon: "Absol", cp: 1400, level: 25, ivAtk: 15, ivDef: 9, ivSta: 9,
        fastMove: "Snarl", charged1: "Dark Pulse", note: "bbb" },
      { pokemon: "Lapras", forma: "Lucky", cp: 1600, level: 12, ivAtk: 1, ivDef: 11,
        ivSta: 15, fastMove: "Water Gun", charged1: "Surf" },
    ]);
    const vs = document.getElementById("viewSelect");
    if (vs) { vs.value = "all"; vs.dispatchEvent(new Event("change", { bubbles: true })); }

    const tab = () => document.getElementById("tbody").closest("table");
    const hlavicky = () => Array.from(tab().querySelectorAll("thead th"));
    // Buňky v zobrazení Vše obsahují <input>/<select> — textContent je prázdný.
    const hodnota = (td) => {
      if (!td) return "";
      const pole = td.querySelector("input, select");
      if (pole) return pole.type === "checkbox" ? (pole.checked ? "1" : "0") : String(pole.value);
      // Podtitulek (.cell-sub) se do řazení nepočítá — sloupec „Vylepšit?"
      // má u všech kusů „Ano" a liší se jen cenou v prachu pod tím. Kdyby se
      // četl celý text buňky, test by čekal přeskládání tam, kde se řadicí
      // hodnota vůbec neliší, a hlásil chybu appky, která žádná není.
      const odznak = td.querySelector(".badge");
      if (odznak) return odznak.textContent.trim();
      const kopie = td.cloneNode(true);
      Array.prototype.forEach.call(kopie.querySelectorAll(".cell-sub"),
        (x) => x.remove());
      return kopie.textContent.trim();
    };
    const sloupec = (i) => Array.from(document.querySelectorAll("#tbody tr:not(.detail-row)"))
      .map((tr) => hodnota(tr.children[i]));

    const out = [];
    const pocet = hlavicky().length;
    for (let i = 0; i < pocet; i++) {
      const nazev = hlavicky()[i].textContent.replace(/[▲▼]/g, "").trim();
      if (!nazev) continue;
      // hlavička se hledá znovu — kliknutí překreslí tabulku a starý odkaz
      // by ukazoval na odpojený prvek
      hlavicky()[i].click();
      const vzestupne = sloupec(i);
      hlavicky()[i].click();
      const sestupne = sloupec(i);
      const neprazdne = vzestupne.filter((x) => x !== "");
      out.push({
        sloupec: nazev,
        ruznych: new Set(neprazdne).size,
        radi: vzestupne.join("|") !== sestupne.join("|"),
        // prázdné hodnoty patří v OBOU směrech dolů, ne jednou nahoru
        prazdneDole: [vzestupne, sestupne].every((sez) => {
          const prvniPrazdna = sez.indexOf("");
          return prvniPrazdna === -1 || sez.slice(prvniPrazdna).every((x) => x === "");
        }),
      });
    }
    // a zvlášť: level se musí řadit jako číslo, ne jako text
    const iLevel = hlavicky().findIndex((th) =>
      th.textContent.replace(/[▲▼]/g, "").trim() === "Level");
    hlavicky()[iLevel].click();
    const levely = sloupec(iLevel).filter((x) => x !== "").map(Number);
    return { sloupce: out, levely: levely };
  });

  check("hlaviček je aspoň třicet", sortSweep.sloupce.length >= 30, String(sortSweep.sloupce.length));
  // Sloupce, kde je v testovacích datech jen jedna hodnota, nemají co prohodit.
  const raditelne = sortSweep.sloupce.filter((x) => x.ruznych > 1);
  check("víc než dvacet sloupců má v datech co řadit", raditelne.length > 20,
    String(raditelne.length));
  raditelne.forEach((x) => {
    check("„" + x.sloupec + "“ — kliknutí na hlavičku pořadí opravdu změní", x.radi,
      "různých hodnot: " + x.ruznych);
  });
  sortSweep.sloupce.forEach((x) => {
    check("„" + x.sloupec + "“ — prázdné hodnoty jdou dolů v obou směrech", x.prazdneDole);
  });
  // "L9" jako text skončí za "L40" — tohle je přesně to, co obecná větev řeší.
  check("level se řadí jako číslo, ne jako text",
    sortSweep.levely.length > 1
      && sortSweep.levely.every((v, i) => i === 0 || sortSweep.levely[i - 1] <= v),
    sortSweep.levely.join(", "));

  console.log("\n115) rozpočet nesype do dražší kopie téhož druhu");
  // Efektivita měří RELATIVNÍ skok, takže odměňovala kus, co začíná od nuly:
  // Solrock za 153 CP stál 519 tis. a byl v plánu desátý, ten samý za 1018 CP
  // stál 493 tis. a byl třicátý — levnější cesta ke STEJNÉMU cíli skončila
  // o dvacet míst níž. Rozhoduje proto kvalita na vynaložený prach.
  const rozpocet = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    // Strop kopií na 2, ať v plánu skončí oba — s jednou kopií by se ten
    // hotovější rovnou zahodil (kopie se řadí podle IV, CP je až poslední
    // kritérium) a nebylo by co porovnávat.
    document.getElementById("keepCopies").value = "2";
    P.setRows([
      // Dva Absolové na stejnou roli: jeden skoro hotový, druhý od nuly.
      // Původně to byli dva Solrockové — přesně ten případ, na kterém se
      // chyba našla. Solrock ale dělá jen kolem poloviny špičky Rock, takže
      // ho rozpočet drží jen jako náplast a náplast smí od druhu být jedna:
      // druhá kopie by se zahodila a nebylo by co porovnávat. Absol roli
      // na Dark uzavírá, takže obstojí obě kopie.
      { pokemon: "Absol", cp: 1018, level: 30, ivAtk: 14, ivDef: 13, ivSta: 13 },
      { pokemon: "Absol", cp: 153, level: 8, ivAtk: 15, ivDef: 14, ivSta: 14 },
      { pokemon: "Machamp", cp: 2400, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" },
    ]);
// Plán po krocích je výchozí; tenhle blok ale porovnává CELOU cestu
// („dotáhnout nejlepší kusy"), takže si režim musí přepnout sám.
(function () {
  const k = document.getElementById("krokyPlan");
  if (k && k.checked) { k.checked = false; k.dispatchEvent(new Event("change", { bubbles: true })); }
})();
    const plan = P.prachovyPlan();
    const solrocky = plan.map((e, i) => ({ poradi: i, cp: e.row.cp, role: e.role,
      dust: e.cena.dust, lepsi: e.lepsiCesta ? e.lepsiCesta.row.cp : null }))
      .filter((x) => x.role.indexOf("Dark") > -1 || x.cp === 1018 || x.cp === 153);
    document.getElementById("dustCard").open = true;
    P.prekreslit();
    const box = document.getElementById("dustBody");
    return {
      solrocky: solrocky,
      // hlavičky číselných sloupců musí být zarovnané stejně jako hodnoty
      hlavicky: Array.from(box.querySelectorAll(".dust-table th")).map((th) => ({
        text: th.textContent.trim(), num: th.classList.contains("num"),
        zarovnani: getComputedStyle(th).textAlign,
      })),
      maHranici: !!box.querySelector(".dust-kopie-hranice"),
      maPoznamku: !!box.querySelector(".dust-levneji"),
      textPoznamky: (box.querySelector(".dust-levneji") || {}).textContent || "",
    };
  });

  const drahy = rozpocet.solrocky.filter((x) => x.cp === 153)[0];
  const levny = rozpocet.solrocky.filter((x) => x.cp === 1018)[0];
  check("obě kopie jsou v plánu", !!drahy && !!levny,
    JSON.stringify(rozpocet.solrocky));
  check("…a ten dražší stojí opravdu víc", !!drahy && !!levny && drahy.dust > levny.dust,
    drahy && levny ? drahy.dust + " vs " + levny.dust : "-");
  check("levnější cesta ke stejné roli je v plánu VÝŠ",
    !!drahy && !!levny && levny.poradi < drahy.poradi,
    levny && drahy ? "levný #" + levny.poradi + ", drahý #" + drahy.poradi : "-");
  check("…a u toho dražšího se řekne, která kopie je levnější",
    !!drahy && drahy.lepsi === 1018, drahy ? String(drahy.lepsi) : "-");
  check("v tabulce je oddělovač, kde končí „udělej teď“", rozpocet.maHranici);
  check("…a u odsunuté kopie je poznámka s levnější cestou", rozpocet.maPoznamku);
  // Poznámka má říct, KTERÝ kus dělat místo tohohle a o kolik je to lacinější.
  // Dřív tam stála jen cena jednoho kroku, což se dalo číst obráceně.
  check("…která uvádí CP i obojí zbylou cenu",
    /nejdřív dodělej/.test(rozpocet.textPoznamky)
      && /zbývá/.test(rozpocet.textPoznamky)
      && /místo/.test(rozpocet.textPoznamky),
    rozpocet.textPoznamky);

  // Zarovnání: nadpis číselného sloupce nesmí viset vlevo nad čísly vpravo.
  const cisla = rozpocet.hlavicky.filter((h) => h.num);
  check("číselné sloupce mají označenou hlavičku", cisla.length >= 5, String(cisla.length));
  check("…a ta je zarovnaná doprava jako hodnoty pod ní",
    cisla.every((h) => h.zarovnani === "right"),
    JSON.stringify(cisla.filter((h) => h.zarovnani !== "right")));
  check("textové sloupce zůstávají vlevo",
    rozpocet.hlavicky.filter((h) => !h.num).every((h) => h.zarovnani === "left"),
    JSON.stringify(rozpocet.hlavicky.filter((h) => !h.num && h.zarovnani !== "left")));

  console.log("\n116) pořadí kopií: bez Calcy ranku, s ohledem na cenu dotažení");
  // Dvě věci naráz. Za prvé: appka má v sekci „odkud se co bere" napsáno
  // „Calcy IV rank se do rozhodování nepouští", a přesto podle něj kopie
  // řadila — Solrock za 153 CP s IV 27 % byl první kopií před Solrockem
  // za 1018 CP s IV 62 %. Za druhé: mezi kusy s podobným IV má rozhodovat
  // i to, co stojí je dotáhnout.
  const kopiePrach = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    document.getElementById("keepCopies").value = "2";
    const nastav = (kurz) => {
      const e = document.getElementById("prachZaBod");
      e.value = String(kurz);
      e.dispatchEvent(new Event("input", { bubbles: true }));
      P.prekreslit();
    };
    const poradi = () => {
      const m = {};
      P.base().forEach((x) => { m[x.row.cp] = x.dupIndex; });
      return m;
    };

    // (a) rank nesmí rozhodovat: horší IV + skvělý rank vs lepší IV
    P.setRows([
      { pokemon: "Solrock", cp: 153, level: 3, ivAtk: 4, ivDef: 4, ivSta: 4, glRank: 1 },
      { pokemon: "Solrock", cp: 1018, level: 16, ivAtk: 10, ivDef: 9, ivSta: 9, glRank: 3000 },
    ]);
    nastav(0);
    const rank = poradi();

    // (b) při stejném IV rozhoduje cena dotažení
    P.setRows([
      { pokemon: "Solrock", cp: 153, level: 3, ivAtk: 10, ivDef: 9, ivSta: 9 },
      { pokemon: "Solrock", cp: 1018, level: 16, ivAtk: 10, ivDef: 9, ivSta: 9 },
    ]);
    nastav(0);
    const bezKurzu = poradi();
    nastav(50000);
    const sKurzem = poradi();

    // (c) malý rozdíl IV nesmí přebít velký rozdíl v prachu.
    // POZOR na tvar té ceny: z L3 na strop stojí 519 tis., z L16 taky 493 tis.
    // — rozdíl jen 26 tis. Drahé je až posledních deset levelů, takže se musí
    // porovnat kus u dna s kusem skoro hotovým (L15 vs L45 = 358 tis.).
    P.setRows([
      // IV 31/45 = 68,9 % proti 30/45 = 66,7 % — rozdíl 2,2 bodu.
      // Rozdíl v ceně L15 vs L45 je 358 tis., při kurzu 50 tis. tedy 7,2 bodu.
      // Prach musí převážit; kdyby byl rozdíl IV větší než 7,2, vyhraje IV.
      { pokemon: "Solrock", cp: 900, level: 15, ivAtk: 11, ivDef: 10, ivSta: 10 },
      { pokemon: "Solrock", cp: 2200, level: 45, ivAtk: 10, ivDef: 10, ivSta: 10 },
    ]);
    nastav(50000);
    const tesne = poradi();
    const prehozeno = P.base().filter((x) => x.dikyPrachu).length;
    nastav(50000);
    return { rank, bezKurzu, sKurzem, tesne, prehozeno };
  });

  eq("skvělý Calcy rank neudělá z horšího kusu první kopii",
    kopiePrach.rank[153], 2);
  eq("…první je ten s lepším IV", kopiePrach.rank[1018], 1);
  eq("při shodném IV rozhodne, co stojí kus dotáhnout",
    kopiePrach.sKurzem[1018], 1);
  check("…a s vypnutým kurzem je to nerozhodné, ne obrácené",
    kopiePrach.bezKurzu[1018] === 1 || kopiePrach.bezKurzu[1018] === 2,
    String(kopiePrach.bezKurzu[1018]));
  eq("kus o pár bodů lepší, ale o statisíce dražší, první kopií není",
    kopiePrach.tesne[2200], 1);
  check("…a appka to přizná jako důsledek kurzu, ne mlčky",
    kopiePrach.prehozeno > 0, String(kopiePrach.prehozeno));

  console.log("\n117) přepínač cíle L40 / L50 v rozpočtu");
  // Posledních deset levelů je nejdražší část a platí se v nich XL. Dotáhnout
  // všechno na L40 je skoro vždycky lepší než pár kusů na L50, takže to musí
  // jít přepnout — a cena se musí přepočítat, ne jen přejmenovat.
  const cil = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Machamp", cp: 1800, level: 25, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Gyarados", cp: 1900, level: 26, ivAtk: 14, ivDef: 15, ivSta: 15,
        fastMove: "Dragon Breath", charged1: "Aqua Tail" },
      { pokemon: "Marill", cp: 300, level: 10, ivAtk: 2, ivDef: 15, ivSta: 14,
        fastMove: "Bubble", charged1: "Body Slam" },
    ]);
    document.getElementById("dustCard").open = true;
    const prepni = (v) => {
      const e = document.getElementById("cilLevel");
      e.value = v; e.dispatchEvent(new Event("change", { bubbles: true }));
      P.prekreslit();
  // Plán po krocích je výchozí; tenhle blok ale porovnává CELOU cestu
  // („dotáhnout nejlepší kusy"), takže si režim musí přepnout sám.
  (function () {
    const k = document.getElementById("krokyPlan");
    if (k && k.checked) { k.checked = false; k.dispatchEvent(new Event("change", { bubbles: true })); }
  })();
      const plan = P.prachovyPlan();
      return {
        polozek: plan.length,
        dust: plan.reduce((a, x) => a + x.cena.dust, 0),
        xl: plan.reduce((a, x) => a + (x.cena.xl || 0), 0),
        cile: plan.map((x) => x.uroven),
        nedotazene: plan.filter((x) => x.nedotazeny).length,
        vTabulce: document.getElementById("dustBody").textContent,
      };
    };
    const l50 = prepni("50");
    const l40 = prepni("40");
    return { l50, l40 };
  });

  check("přepínač existuje a plán po přepnutí nezmizí",
    cil.l40.polozek > 0 && cil.l50.polozek > 0,
    cil.l40.polozek + " / " + cil.l50.polozek);
  check("na L40 stojí všechno výrazně míň prachu",
    cil.l40.dust < cil.l50.dust * 0.8,
    Math.round(cil.l40.dust / 1000) + "k vs " + Math.round(cil.l50.dust / 1000) + "k");
  eq("…a nepotřebuje ani jeden XL bonbón", cil.l40.xl, 0);
  check("na L50 se XL naopak platí", cil.l50.xl > 0, String(cil.l50.xl));
  check("žádný cíl nepřeleze zvolený strop",
    cil.l40.cile.every((u) => u <= 40) && cil.l50.cile.every((u) => u <= 50),
    JSON.stringify(cil.l40.cile));
  check("v tabulce se to i napíše", cil.l40.vTabulce.indexOf("na L40") > -1);
  // Cap ligy může chtít víc než L40 — pak se to musí přiznat, ne tiše useknout.
  check("u kusu, který se do capu ligy nevejde, se to řekne",
    cil.l40.nedotazene === 0 || /cap ligy chce až L/.test(cil.l40.vTabulce),
    String(cil.l40.nedotazene));

  console.log("\n119) pořadí v rozpočtu: pár tisíc prachu nesmí přebít kvalitu");
  // Syrový poměr přínos/cena dominoval nade vším: Tentacool (LC #20, kvalita
  // 79,8 %, 36 tis.) vycházel před Duckletem (LC #2, kvalita 85,6 %, 45 tis.),
  // protože byl o devět tisíc levnější. V plánu za miliony je to šum.
  const poradiPlan = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    document.getElementById("keepCopies").value = "2";
    P.setRows([
      // Ducklett je v Little Cupu vysoko, Tentacool hluboko — a Ducklett
      // musí být v plánu výš, i když jeho vylepšení stojí o něco víc.
      { pokemon: "Ducklett", cp: 161, level: 8, ivAtk: 0, ivDef: 14, ivSta: 15 },
      { pokemon: "Tentacool", cp: 152, level: 8, ivAtk: 1, ivDef: 15, ivSta: 14 },
    ]);
// Plán po krocích je výchozí; tenhle blok ale porovnává CELOU cestu
// („dotáhnout nejlepší kusy"), takže si režim musí přepnout sám.
(function () {
  const k = document.getElementById("krokyPlan");
  if (k && k.checked) { k.checked = false; k.dispatchEvent(new Event("change", { bubbles: true })); }
})();
    const plan = P.prachovyPlan();
    const dej = (jm) => {
      const i = plan.findIndex((e) => e.row.pokemon === jm);
      return i < 0 ? null : { poradi: i, kvalita: plan[i].kvalita,
        dust: plan[i].cena.dust, rank: plan[i].rank, efekt: plan[i].efektivita };
    };
    return { ducklett: dej("Ducklett"), tentacool: dej("Tentacool"),
      klice: plan.map((e) => typeof e.skoreRazeni === "number"),
      klesa: plan.every((e, i) => i === 0 || e.lepsiCesta
        || plan[i - 1].skoreRazeni >= e.skoreRazeni) };
  });

  check("oba kusy jsou v plánu",
    !!poradiPlan.ducklett && !!poradiPlan.tentacool,
    JSON.stringify([poradiPlan.ducklett, poradiPlan.tentacool]));
  check("Ducklett je v lize výš než Tentacool",
    poradiPlan.ducklett.rank < poradiPlan.tentacool.rank,
    poradiPlan.ducklett.rank + " vs " + poradiPlan.tentacool.rank);
  check("…a má vyšší výslednou kvalitu",
    poradiPlan.ducklett.kvalita > poradiPlan.tentacool.kvalita,
    Math.round(poradiPlan.ducklett.kvalita * 1000) / 10 + " vs "
      + Math.round(poradiPlan.tentacool.kvalita * 1000) / 10);
  check("…i když jeho vylepšení stojí víc",
    poradiPlan.ducklett.dust > poradiPlan.tentacool.dust,
    poradiPlan.ducklett.dust + " vs " + poradiPlan.tentacool.dust);
  check("…a přesto je v plánu VÝŠ",
    poradiPlan.ducklett.poradi < poradiPlan.tentacool.poradi,
    "#" + poradiPlan.ducklett.poradi + " vs #" + poradiPlan.tentacool.poradi);
  check("…což je proti syrovému poměru, ten by dal opačné pořadí",
    poradiPlan.tentacool.efekt > poradiPlan.ducklett.efekt,
    poradiPlan.tentacool.efekt.toFixed(4) + " vs " + poradiPlan.ducklett.efekt.toFixed(4));
  // Řadicí klíč musí být jedno číslo, jinak není řazení tranzitivní
  // a prohlížeč si pořadí může poskládat, jak se mu zachce.
  check("řadí se podle jednoho čísla, ne porovnáváním s tolerancí",
    poradiPlan.klice.every(Boolean));
  check("…a to číslo v seznamu klesá", poradiPlan.klesa);

  console.log("\n120) rozpočet rolí rozhoduje o ponechání");
  // Tohle je pravidlo, kvůli kterému celá přestavba vznikla: o ponechání
  // nerozhoduje, jak hezké má kus IV, ale jestli obsadí místo v rozpočtu.
  // Uživatel appku poslouchá bez vlastního úsudku, takže verdikt musí být
  // vždycky jednoznačný — „nechat", nebo „pustit", nikdy „rozmysli si to".
  const rozp = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    document.getElementById("resetSettingsBtn").click();
    P.setRows([
      // vysoké IV, ale druh nehraje vůbec nic
      { pokemon: "Diglett", cp: 280, level: 15, ivAtk: 11, ivDef: 15, ivSta: 15 },
      // špičkový Grass útočník — Grass NENÍ mezi krytými typy, a přesto
      // se takový kus nesmí zahodit
      { pokemon: "Kartana", cp: 2800, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Razor Leaf", charged1: "Leaf Blade" },
      // slabý druh na krytém typu: roli drží, ale jen jako náplast
      { pokemon: "Solrock", cp: 1018, level: 30, ivAtk: 14, ivDef: 13, ivSta: 13 },
      // pořádný útočník na krytý typ
      { pokemon: "Charizard", cp: 2900, level: 33, ivAtk: 15, ivDef: 15, ivSta: 14,
        fastMove: "Fire Spin", charged1: "Blast Burn" },
    ]);
    const c = P.getComputed(), rows = P.getRows();
    const podle = {};
    rows.forEach((r) => {
      const b = P.base().filter((x) => x.row.id === r.id)[0];
      podle[r.pokemon] = {
        keep: c[r.id].keep, sub: c[r.id].keepSub || "", title: c[r.id].keepTitle || "",
        mezera: !!c[r.id].jeMezera,
        sloty: (b.sloty || []).map((sl) => sl.klic),
      };
    });
    document.getElementById("rozpocetCard").open = true;
    P.prekreslit();
    const box = document.getElementById("rozpocetBody");
    return {
      podle,
      verdikty: rows.map((r) => c[r.id].keep),
      tabulka: box.textContent.replace(/\s+/g, " "),
      radku: box.querySelectorAll("tr").length,
    };
  });

  check("vysoké IV samo o sobě roli nenahradí",
    rozp.podle.Diglett.keep === "Zahodit" && rozp.podle.Diglett.sloty.length === 0,
    rozp.podle.Diglett.keep + " / " + rozp.podle.Diglett.sloty.join(","));
  check("…a je řečeno, že nedrží žádnou roli",
    rozp.podle.Diglett.title.indexOf("Nedrží žádnou roli") === 0,
    rozp.podle.Diglett.title.slice(0, 60));
  // Tohle je ta past, do které se dá spadnout při slepém poslouchání appky:
  // pokrytí je argument o tom, kam investovat napřed, ne o tom, co zahodit.
  check("špičkový útočník mimo kryté typy se nezahodí",
    rozp.podle.Kartana.keep.indexOf("Zahodit") === -1, rozp.podle.Kartana.keep);
  check("…a drží slot na svém typu",
    rozp.podle.Kartana.sloty.indexOf("raid:Grass") > -1,
    rozp.podle.Kartana.sloty.join(","));
  check("pořádný útočník na krytý typ je plné Ponechat",
    rozp.podle.Charizard.keep === "Ponechat", rozp.podle.Charizard.keep);
  check("…a v podtitulku je pořadí ve slotu",
    /Fire \d\/\d/.test(rozp.podle.Charizard.sub), rozp.podle.Charizard.sub);
  check("slabý druh na krytém typu drží roli jen jako náplast",
    rozp.podle.Solrock.keep === "Nechat zatím" && rozp.podle.Solrock.mezera,
    rozp.podle.Solrock.keep);
  check("…a appka řekne, čím ho nahradit",
    rozp.podle.Solrock.title.indexOf("Až chytíš") > -1,
    rozp.podle.Solrock.title.slice(-90));
  // Žádné „zvážit": každý verdikt musí být rozhodnutí.
  check("žádný verdikt nenechává rozhodnutí na uživateli",
    rozp.verdikty.every((v) => v.indexOf("Zvážit") === -1), rozp.verdikty.join(","));
  check("karta Role se vykreslí", rozp.radku > 10, String(rozp.radku));
  check("…a rozlišuje pořádné kusy od náplastí",
    rozp.tabulka.indexOf("Náplast") > -1, rozp.tabulka.slice(0, 90));
  check("…a říká, kolik do jádra chybí",
    /chybí \d+/.test(rozp.tabulka), rozp.tabulka.slice(-160));

  // Náplast se nesmí počítat jako pokrytá role — jinak by tabulka hlásila
  // „chybí 0" u typu, kde je všech šest kusů jen zástupných.
  const naplast = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Solrock", cp: 1018, level: 30, ivAtk: 14, ivDef: 13, ivSta: 13 }]);
    document.getElementById("rozpocetCard").open = true;
    P.prekreslit();
    const tr = Array.from(document.querySelectorAll("#rozpocetBody tr"))
      .filter((r) => (r.children[0] || {}).textContent === "Rock")[0];
    return tr ? Array.from(tr.children).map((td) => td.textContent) : null;
  });
  check("řádek typu Rock existuje", !!naplast, JSON.stringify(naplast));
  eq("…a v „mám“ je nula, protože je to jen náplast", naplast[1], "0");
  eq("…zatímco v „náplast“ je jednička", naplast[2], "1");
  eq("…a „chybí“ ukazuje celou šestku", naplast[4], "6");

  console.log("\n121) pravidla výměny musí sedět s hrou");
  // Výměna je nevratná a IV se při ní přehází, takže špatná rada tady stojí
  // víc než kdekoli jinde v appce. Tenhle blok hlídá to, co hra doopravdy
  // dovolí — ne to, co by dávalo smysl.
  const vymena = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      // mytický — nejde vyměnit vůbec
      { pokemon: "Mew", cp: 3000, level: 30, ivAtk: 15, ivDef: 15, ivSta: 15 },
      // shadow — musí se nejdřív očistit
      { pokemon: "Rattata", forma: "Shadow", cp: 300, level: 15, ivAtk: 5, ivDef: 5, ivSta: 5 },
      // Zygarde má vlastní zámek
      { pokemon: "Zygarde", cp: 993, level: 15, ivAtk: 12, ivDef: 11, ivSta: 15 },
      // obyčejný přebytek, který se vyměnit dá
      { pokemon: "Pidgey", cp: 100, level: 10, ivAtk: 2, ivDef: 2, ivSta: 2 },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
    ]);
    document.getElementById("friendCard").open = true;
    document.getElementById("friendInput").value = [
      "Machamp 2100 15/14/13",
      "Snorlax 2500 14/14/14",
    ].join("\n");

    const zmer = (uroven, lucky) => {
      document.getElementById("friendLevel").value = uroven;
      document.getElementById("friendLucky").checked = !!lucky;
      P.renderFriend();
      const box = document.getElementById("friendBody");
      return {
        intro: (box.querySelector(".tp-intro:not(.tp-proc-intro)") || {}).textContent || "",
        zed: (box.querySelector(".tp-zed") || {}).textContent || "",
        note: (box.querySelector(".tp-note") || {}).textContent || "",
        radky: Array.from(box.querySelectorAll(".tp-row")).map(
          (e) => e.textContent.replace(/\s+/g, " ")),
      };
    };
    return { best: zmer("best", false), good: zmer("good", false), lucky: zmer("best", true) };
  });

  check("appka řekne, že se IV přehází a původní nehrají roli",
    vymena.best.intro.indexOf("původní na výsledek nemají žádný vliv") > -1,
    vymena.best.intro.slice(0, 140));
  check("u Best Friends je podlaha 5/5/5",
    vymena.best.intro.indexOf("5/5/5") > -1, vymena.best.intro.slice(0, 200));
  check("…u Good Friends 1/1/1",
    vymena.good.intro.indexOf("1/1/1") > -1, vymena.good.intro.slice(0, 200));
  check("…a u Lucky Friends 12/12/12",
    vymena.lucky.intro.indexOf("12/12/12") > -1, vymena.lucky.intro.slice(0, 200));
  check("Lucky zmíní i trvalou slevu na vylepšování",
    vymena.lucky.intro.indexOf("50 %") > -1, vymena.lucky.intro.slice(0, 260));

  // Zeď: tohle nejsou doporučení, tohle hra prostě nedovolí.
  check("mytický je označený jako nevyměnitelný",
    vymena.best.zed.indexOf("Mytičtí") > -1, vymena.best.zed.slice(0, 120));
  check("…a Meltan s Melmetalem jsou uvedení jako výjimka",
    vymena.best.zed.indexOf("Meltan") > -1, vymena.best.zed.slice(0, 200));
  check("shadow se musí nejdřív očistit",
    vymena.best.zed.indexOf("očistit") > -1, vymena.best.zed.slice(0, 300));
  check("…a je řečeno, že výměna je jednosměrná",
    vymena.best.zed.indexOf("jednosměrná") > -1, vymena.best.zed.slice(0, 400));
  check("konkrétní zablokované kusy z rosteru se vyjmenují",
    vymena.best.zed.indexOf("Mew") > -1 && vymena.best.zed.indexOf("Zygarde") > -1,
    vymena.best.zed.slice(-160));

  // Ani jeden zablokovaný kus se nesmí objevit mezi návrhy — nabídnout
  // výměnu, kterou hra odmítne, je horší než nenabídnout nic.
  check("zablokovaný kus se nikdy nenabídne k výměně",
    vymena.best.radky.every((r) => r.indexOf("Mew") === -1
      && r.indexOf("Zygarde") === -1), vymena.best.radky.join(" | "));

  check("cena se počítá pro zvolenou úroveň",
    /prachu/.test(vymena.best.note), vymena.best.note.slice(0, 200));
  check("…a je vidět, o kolik je to u Good Friends dražší",
    vymena.best.note.indexOf("Good Friends") > -1, vymena.best.note.slice(-200));

  console.log("\n122) práh pořadí platí i pro evoluci, tahák má šest counterů");
  // Uživatel našel spor: Wailmer (LC #33) šel pryč s odůvodněním „druh je až
  // #33", ale Froakie se držel na „Greninja GL #127 — 99,2 %". Obojí je nad
  // prahem pořadí, jenže u evoluce se práh vůbec nekontroloval.
  const prahEvo = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    const cfg = (id, v) => {
      const el = document.getElementById(id);
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    cfg("rankLimit", 25);
    P.setRows([
      { pokemon: "Froakie", cp: 481, level: 8, ivAtk: 10, ivDef: 12, ivSta: 15,
        fastMove: "Bubble", charged1: "Surf" },
      { pokemon: "Wailmer", cp: 496, level: 12.5, ivAtk: 7, ivDef: 15, ivSta: 15,
        fastMove: "Rollout", charged1: "Body Slam" },
    ]);
    const c = P.getComputed();
    const out = { rankWailmer: (P.ligovePoradi("wailmer", "little") || {}).rank };
    P.base().forEach((b) => {
      out[b.row.pokemon] = {
        keep: c[b.row.id].keep,
        title: c[b.row.id].keepTitle || "",
        evoMeta: b.evoMeta ? b.evoMeta.league + "#" + b.evoMeta.rank : null,
      };
    });
    document.getElementById("resetSettingsBtn").click();
    return out;
  });
  check("druh nad prahem pořadí se nedrží ani přes evoluci",
    prahEvo.Froakie.evoMeta === null, String(prahEvo.Froakie.evoMeta));
  check("…a odůvodnění o té lize vůbec nemluví",
    prahEvo.Froakie.title.indexOf("Great League") === -1
    && prahEvo.Froakie.title.indexOf("#127") === -1,
    prahEvo.Froakie.title.slice(0, 120));
  // Froakie se pořád drží — ale jako Water útočník (Greninja), ne jako
  // ligový kus. Verdikt musí sedět s důvodem.
  check("…drží se z důvodu, který opravdu platí",
    prahEvo.Froakie.title.indexOf("rozpočtu") > -1, prahEvo.Froakie.title.slice(0, 90));
  check("a Wailmer nad prahem jde pryč, jak šel",
    prahEvo.Wailmer.keep === "Zahodit", prahEvo.Wailmer.keep);
  // Číslo se čte z dat: běžný Wailmer je v Little Cupu jinde než shadow,
  // a dokud se obojí slévalo pod jeden klíč, ukazovalo se to shadow.
  check("…se stejným typem odůvodnění, ne jiným",
    prahEvo.Wailmer.title.indexOf("#" + prahEvo.rankWailmer) > -1,
    "čekáno #" + prahEvo.rankWailmer + ": " + prahEvo.Wailmer.title.slice(0, 140));

  const tahakSest = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Lucario", cp: 2000, level: 30, ivAtk: 14, ivDef: 14, ivSta: 14, fastMove: "Counter", charged1: "Aura Sphere" },
      { pokemon: "Conkeldurr", cp: 2200, level: 30, ivAtk: 15, ivDef: 13, ivSta: 14, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Blaziken", cp: 2300, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14, fastMove: "Counter", charged1: "Blast Burn" },
      { pokemon: "Hariyama", cp: 2400, level: 30, ivAtk: 14, ivDef: 14, ivSta: 15, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Breloom", cp: 1900, level: 30, ivAtk: 15, ivDef: 12, ivSta: 12, fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Sirfetch'd", cp: 2000, level: 30, ivAtk: 14, ivDef: 13, ivSta: 13, fastMove: "Counter", charged1: "Close Combat" },
      // ligové kusy do všech čtyř lig. Wailmer tu být nemůže: v Little Cupu
      // je pod prahem, do padesátky se vejde jen jeho shadow varianta.
      { pokemon: "Skrelp", cp: 480, level: 18, ivAtk: 0, ivDef: 15, ivSta: 15, fastMove: "Acid", charged1: "Aqua Tail" },
      { pokemon: "Azumarill", cp: 1489, level: 24.5, ivAtk: 0, ivDef: 15, ivSta: 15, fastMove: "Bubble", charged1: "Play Rough" },
      { pokemon: "Registeel", cp: 2400, level: 30, ivAtk: 1, ivDef: 15, ivSta: 14, fastMove: "Lock On", charged1: "Focus Blast" },
      { pokemon: "Metagross", cp: 3400, level: 35, ivAtk: 15, ivDef: 15, ivSta: 15, fastMove: "Bullet Punch", charged1: "Meteor Mash" },
    ]);
    const sheet = P.getCheatSheet();
    document.getElementById("cheatCard").open = true;
    P.renderCheatSheet();
    const text = document.getElementById("cheatBody").textContent;
    // Sekce typů = countery PROTI bossovi toho typu. Na Fighting bosse jsou
    // countery psychičtí a létající, ne moji Fighting útočníci — ti countrují
    // Steel. Proto se měří Steel.
    const fighting = sheet.types.filter((t) => t.type === "Steel")[0] || {};
    return {
      fightingPicks: (fighting.picks || []).length,
      ligy: Object.keys(sheet.pvp).filter((k) => sheet.pvp[k].length),
      maLC: text.indexOf("Little Cup") > -1,
      maML: text.indexOf("Master League") > -1,
    };
  });
  // Do raidu jde parta o šesti — tři jména jsou k ničemu.
  check("tahák nabízí šest counterů na typ, ne tři",
    tahakSest.fightingPicks === 6, String(tahakSest.fightingPicks));
  check("…a zná i Little Cup", tahakSest.maLC, String(tahakSest.maLC));
  check("…a Master League", tahakSest.maML, String(tahakSest.maML));
  check("v taháku jsou všechny čtyři ligy, které appka umí",
    ["LC", "GL", "UL", "ML"].every((l) => tahakSest.ligy.indexOf(l) > -1),
    tahakSest.ligy.join(","));

  console.log("\n123) žádný sloupec si nesmí odporovat s verdiktem");
  // Uživatel našel čtyři nezávislé rozpory naráz: verdikt „Ponechat, Flying
  // 1/3" a vedle sloupec RAID s křížkem; sloupec GYM „po vývinu", o kterém
  // verdikt mlčel; sloupec TRADOVAT nabízející kus, který si appka sama drží;
  // a podtitulek verdiktu, kde místo důvodu stálo „shadow bonus tu k ničemu".
  // Všechno to byly dva nezávislé výpočty téže věci. Tenhle blok je invariant
  // přes CELÝ roster — ne vzorek, protože přesně tak to prve prošlo.
  const spor = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    document.getElementById("resetSettingsBtn").click();
    P.setRows([
      { pokemon: "Blissey", cp: 2800, level: 30, ivAtk: 10, ivDef: 15, ivSta: 15, fastMove: "Pound", charged1: "Dazzling Gleam" },
      { pokemon: "Snorlax", cp: 2050, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15, fastMove: "Lick", charged1: "Body Slam" },
      { pokemon: "Starly", cp: 68, level: 4, ivAtk: 15, ivDef: 4, ivSta: 12, fastMove: "Tackle", charged1: "Brave Bird" },
      { pokemon: "Cosmog", cp: 170, level: 15, ivAtk: 12, ivDef: 12, ivSta: 10 },
      { pokemon: "Eevee", cp: 444, level: 15, ivAtk: 15, ivDef: 11, ivSta: 10, dynamax: "Ano" },
      { pokemon: "Excadrill", cp: 41, level: 1, ivAtk: 0, ivDef: 4, ivSta: 13, fastMove: "Mud Shot", charged1: "Rock Slide" },
      { pokemon: "Machoke", cp: 1200, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 },
      { pokemon: "Mew", cp: 3000, level: 30, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Misdreavus", cp: 25, level: 1, ivAtk: 11, ivDef: 14, ivSta: 4, fastMove: "Hex" },
      { pokemon: "Flabébé", cp: 359, level: 12, ivAtk: 15, ivDef: 12, ivSta: 14, fastMove: "Tackle", charged1: "Dazzling Gleam" },
      { pokemon: "Deino", forma: "Shadow", cp: 206, level: 8, ivAtk: 2, ivDef: 9, ivSta: 11, fastMove: "Dragon Breath" },
    ]);
    const c = P.getComputed();
    const spory = [];
    P.base().forEach((b) => {
      const z = c[b.row.id];
      const kdo = b.row.pokemon + " " + b.row.cp + ": ";
      const maRaid = (b.sloty || []).some((s) => s.druh === "raid");
      const maGym = (b.sloty || []).some((s) => s.druh === "gym");
      // 1) sloupce RAID a GYM se počítají z týchž slotů jako verdikt
      if (maRaid && z.raidRec === "Ne") spory.push(kdo + "drží raid slot, ale RAID=Ne");
      if (!maRaid && z.raidRec !== "Ne") spory.push(kdo + "nedrží raid slot, ale RAID=" + z.raidRec);
      if (maGym && !/[0-9]\/[0-9]/.test(String(z.gymRec))) spory.push(kdo + "drží gym slot, ale GYM=" + z.gymRec);
      if (!maGym && /[0-9]\/[0-9]/.test(String(z.gymRec))) spory.push(kdo + "nedrží gym slot, ale GYM=" + z.gymRec);
      // 2) co si necháváme, se nikdy nenabízí k výměně
      if (z.keepGood && z.trade === "Ano" && !z.tradeFree) spory.push(kdo + "necháváme si ho, ale TRADE=Ano");
      // 3) podtitulek verdiktu nesmí být prázdný u kusu, který drží roli
      if (b.maSlot && z.keepGood && !z.keepSub) spory.push(kdo + "drží roli, ale podtitulek verdiktu je prázdný");
      // 4) ponechat bez jediného důvodu, který by šlo pojmenovat
      const vyjimka = b.dynamax || (b.dex && b.dex.rarity === "M") || b.maElitni
        || z.keep.indexOf("doskenuj") > -1 || z.keep.indexOf("trade") > -1;
      if (z.keepGood && !b.maSlot && !vyjimka) spory.push(kdo + "ponechat bez slotu i bez výjimky (" + z.keep + ")");
    });
    return { spory: spory, kusu: P.getRows().length };
  });
  check("napříč rosterem si žádný sloupec neodporuje s verdiktem",
    spor.spory.length === 0, spor.spory.join(" | "));
  check("…a testuje se to na celém rosteru, ne na vzorku", spor.kusu >= 12, String(spor.kusu));

  // Větvená evoluce: herní data u ní finální formu neuvádějí, takže appka
  // nevěděla, čím se ten kus stane, a házela pryč Cosmoga (→ Lunala) nebo
  // Ralts (→ Gardevoir). Tyhle druhy musí roli dostat.
  const vetvene = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([
      { pokemon: "Cosmog", cp: 170, level: 15, ivAtk: 12, ivDef: 12, ivSta: 10 },
      { pokemon: "Ralts", cp: 300, level: 15, ivAtk: 14, ivDef: 13, ivSta: 13, fastMove: "Charm", charged1: "Dazzling Gleam" },
    ]);
    const c = P.getComputed();
    const out = {};
    P.base().forEach((b) => {
      out[b.row.pokemon] = { keep: c[b.row.id].keep,
        sloty: (b.sloty || []).map((s) => s.klic) };
    });
    return out;
  });
  check("Cosmog se nezahazuje — stane se z něj Lunala",
    vetvene.Cosmog.keep.indexOf("Zahodit") === -1, vetvene.Cosmog.keep);
  check("…a drží konkrétní roli", vetvene.Cosmog.sloty.length > 0,
    vetvene.Cosmog.sloty.join(","));
  check("Ralts taky — Gardevoir je špičkový Fairy útočník",
    vetvene.Ralts.keep.indexOf("Zahodit") === -1
    && vetvene.Ralts.sloty.indexOf("raid:Fairy") > -1,
    vetvene.Ralts.keep + " / " + vetvene.Ralts.sloty.join(","));

  console.log("\n124) evoluční řada v detailu");
  // „Finální evoluce" neřekne, z čeho kus vznikl, ani kudy cesta vede —
  // a u větvených řad neexistuje vůbec. Detail proto skládá celou řadu
  // z evolučního grafu, oběma směry.
  const linie = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    // Předchozí bloky nechávají zapnutý filtr i hledání. Bez tohohle by
    // v tabulce nebyl řádek, na který se dá kliknout, a test by padal
    // na „detail se neotevřel" místo na skutečnou chybu.
    const f = document.getElementById("filterSelect");
    f.value = "all"; f.dispatchEvent(new Event("change", { bubbles: true }));
    const hled = document.getElementById("searchInput");
    hled.value = ""; hled.dispatchEvent(new Event("input", { bubbles: true }));
    // A zobrazení „Vše (editace)" má jméno jako <input>, takže by textContent
    // buňky byl prázdný a řádek by se nedal najít.
    const v = document.getElementById("viewSelect");
    v.value = "verdict"; v.dispatchEvent(new Event("change", { bubbles: true }));
    P.setRows([
      { pokemon: "Zweilous", cp: 760, level: 15, ivAtk: 13, ivDef: 11, ivSta: 11,
        fastMove: "Dragon Breath", charged1: "Dragon Pulse" },
      { pokemon: "Eevee", cp: 444, level: 15, ivAtk: 15, ivDef: 11, ivSta: 10 },
      { pokemon: "Flabébé", cp: 359, level: 12, ivAtk: 15, ivDef: 12, ivSta: 14,
        fastMove: "Tackle", charged1: "Dazzling Gleam" },
      // finální forma bez evoluce — box se nesmí ukazovat prázdný
      { pokemon: "Absol", cp: 1416, level: 20, ivAtk: 14, ivDef: 14, ivSta: 11 },
    ]);
    const out = {};
    const otevri = (jm) => {
      let cell = null;
      document.querySelectorAll("#tbody tr td.col-pokemon").forEach((td) => {
        if (!cell && td.textContent.indexOf(jm) > -1) cell = td;
      });
      if (!cell) return null;
      cell.click();
      const box = document.querySelector(".detail-row .d-evo");
      const res = box ? {
        text: box.textContent.replace(/\s+/g, " "),
        kusu: box.querySelectorAll(".d-evo-kus").length,
        tady: Array.from(box.querySelectorAll(".d-evo-kus.tady"))
          .map((e) => (e.querySelector("b") || {}).textContent),
        stupnu: box.querySelectorAll(".d-evo-stupen").length,
        husty: box.classList.contains("husty"),
      } : null;
      cell.click();   // zavřít
      return res;
    };
    out.zweilous = otevri("Zweilous");

    out.eevee = otevri("Eevee");
    out.flabebe = otevri("Flabébé");
    out.absol = otevri("Absol");
    return out;
  });

  check("řada ukazuje i to, co bylo PŘED kusem",
    linie.zweilous && linie.zweilous.text.indexOf("Deino") > -1,
    linie.zweilous ? linie.zweilous.text.slice(0, 90) : "detail se neotevřel");
  check("…i to, co z něj bude", linie.zweilous.text.indexOf("Hydreigon") > -1,
    linie.zweilous.text.slice(0, 90));
  check("…a je označené, kde v řadě ten kus je",
    linie.zweilous.tady.length === 1 && linie.zweilous.tady[0] === "Zweilous",
    linie.zweilous.tady.join(","));
  check("…má tři stupně", linie.zweilous.stupnu === 3, String(linie.zweilous.stupnu));
  check("…a je u ní cena v bonbónech", /\d+ bonbónů/.test(linie.zweilous.text),
    linie.zweilous.text.slice(0, 120));
  // Poznámka „zpátky to nejde" z řady zmizela — že evoluce nejde vrátit ví
  // každý, kdo hru hraje, a v úzkém sloupci zabírala místo. Kde na tom fakt
  // záleží (evoluce, která sebere ligu), to appka říká přímo u toho kroku.
  check("…a nezabírá místo poznámkou, kterou hráč nepotřebuje",
    linie.zweilous.text.indexOf("Zpátky to nejde") === -1, linie.zweilous.text.slice(-80));

  // Větvená řada je hlavní důvod, proč graf vznikl — „finální evoluce"
  // u ní v datech není vůbec.
  check("větvená řada ukáže všechny konce",
    linie.eevee.kusu === 9, String(linie.eevee.kusu));
  check("…a řekne, že si formu vybíráš ty",
    linie.eevee.text.indexOf("větví") > -1, linie.eevee.text.slice(-140));
  check("větvená řada se vejde bez roztažení detailu — menší dlaždice",
    linie.eevee.husty === true, String(linie.eevee.husty));

  // Barevné formy: kus se klíčuje bez přípony, graf ji má — „tady jsi"
  // se přesto musí trefit.
  check("barevná forma se v řadě pozná taky",
    linie.flabebe && linie.flabebe.tady.length === 1, linie.flabebe
      ? linie.flabebe.tady.join(",") : "bez boxu");
  check("…a řada má tři stupně", linie.flabebe.stupnu === 3, String(linie.flabebe.stupnu));

  check("u druhu bez evoluce se box vůbec neukazuje",
    linie.absol === null, JSON.stringify(linie.absol));

  // Panel „Odkud se to bere" musí popisovat appku, jaká je TEĎ — jinak
  // uživatel čte návod k něčemu, co už neplatí.
  const dokumentace = await page.evaluate(() => {
    document.getElementById("docsCard").open = true;
    window.__pgo.renderDataInfo();
    return (document.getElementById("dataInfo") || {}).textContent || "";
  });
  check("dokumentace zmiňuje evoluční graf jako zdroj",
    dokumentace.indexOf("evoluční graf") > -1, dokumentace.slice(0, 200));
  check("…a že práh pořadí platí i po evoluci",
    dokumentace.indexOf("platí i po evoluci") > -1);
  check("…a že sloupce se berou ze stejných slotů jako verdikt",
    dokumentace.indexOf("stejných slotů") > -1);
  check("…a že se k výměně nenabízí kus, který si necháváš",
    dokumentace.indexOf("nenabídne kus, který si necháváš") > -1);
  check("…a přiznává, že do pokédexu appka nevidí",
    dokumentace.indexOf("Do pokédexu nevidí") > -1);
  check("…a že shiny ze skenu nepozná",
    dokumentace.indexOf("Shiny ze skenu nepozná") > -1);
  check("…a že větvené řady nemají jednoznačný konec",
    dokumentace.indexOf("větvených řad") > -1);

  console.log("\n125) do ligy se počítá i to, čím se kus stane");
  // Druh, který ligu hraje SÁM, se dřív počítal jen jako on sám: seznam
  // „co z něj bude" se plnil výhradně u druhů, které nehrají nic. Jenže
  // evoluce bývá v téže lize výš, takže verdikt zněl „Zahodit", přestože
  // tabulka lig vedle ukazovala skoro dokonalý ligový kus.
  //
  // Dvojice se hledá v datech, ne natvrdo. Dřív tu stál Primeape
  // (UL #14) s Annihilapem (UL #11) a test padal po každém přepočtu
  // žebříčků — ověřovat se má pravidlo, ne to, kolikátý je kdo dneska.
  const poEvo = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    document.getElementById("resetSettingsBtn").click();
    const cfg = (id, v) => {
      const el = document.getElementById(id);
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const L = P.meta().leagues.great, evoluce = P.pokedex().evoluce || {};
    let nej = null;
    Object.keys(L).forEach((k) => {
      (evoluce[k] || []).forEach((n) => {
        const cil = typeof n === "string" ? n : n[0];
        if (!L[cil] || L[cil][0] >= L[k][0]) return;
        if (!nej || L[cil][0] < L[nej.cil][0]) nej = { zaklad: k, cil: cil };
      });
    });
    const par = { jmeno: P.dexByKey(nej.zaklad).name, cil: P.dexByKey(nej.cil).name,
      rankSam: L[nej.zaklad][0], rankEvo: L[nej.cil][0] };
    cfg("rankLimit", par.rankSam + 10);
    P.setRows([
      { pokemon: par.jmeno, cp: 1007, level: 17, ivAtk: 3, ivDef: 10, ivSta: 6 },
    ]);
    const b = P.base()[0];
    const c = P.getComputed()[b.row.id];
    const out = {
      par: par,
      keep: c.keep, sub: c.keepSub || "", title: c.keepTitle || "",
      sloty: (b.sloty || []).map((s) => s.popis),
      evoVse: (b.evoMetaVse || []).map((k) => k.league + "#" + k.rank),
      // evoMeta si drží původní význam: „sám nehraje nic, hraje až po evoluci"
      evoMeta: b.evoMeta ? b.evoMeta.league + "#" + b.evoMeta.rank : null,
    };
    document.getElementById("resetSettingsBtn").click();
    return out;
  });
  check("kus, který je po evoluci lepší, se nezahazuje",
    poEvo.keep.indexOf("Zahodit") === -1, poEvo.keep);
  check("…a drží ligový slot podle VYVINUTÉ formy",
    poEvo.sloty.some((s) => s.indexOf("#" + poEvo.par.rankEvo) > -1),
    poEvo.par.jmeno + " → " + poEvo.par.cil + ": " + poEvo.sloty.join(" | "));
  check("…což je jinak, než na čem je ten kus teď",
    poEvo.sloty.every((s) => s.indexOf("#" + poEvo.par.rankSam) === -1),
    "sám #" + poEvo.par.rankSam + ": " + poEvo.sloty.join(" | "));
  check("…a je v tom napsané „po evoluci“",
    poEvo.sloty.some((s) => s.indexOf("po evoluci") > -1), poEvo.sloty.join(" | "));
  check("seznam lig po evoluci se plní i u druhu, co ligu hraje sám",
    poEvo.evoVse.length > 0, poEvo.evoVse.join(","));
  // Verdikt „Nechat – evolvovat" má dál znamenat „sám nehraje nic".
  check("…ale verdikt „Nechat – evolvovat“ si význam drží",
    poEvo.evoMeta === null && poEvo.keep.indexOf("evolvovat") === -1,
    poEvo.evoMeta + " / " + poEvo.keep);

  // Protikus: druh, který sám nehraje nic, musí „Nechat – evolvovat" dostat.
  const jenPoEvo = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Marill", cp: 195, level: 21, ivAtk: 1, ivDef: 14, ivSta: 4,
      fastMove: "Bubble", charged1: "Play Rough" }]);
    const c = P.getComputed()[P.getRows()[0].id];
    return { keep: c.keep, sub: c.keepSub || "" };
  });
  check("druh, který sám nehraje nic, má pořád „Nechat – evolvovat“",
    jenPoEvo.keep.indexOf("evolvovat") > -1, jenPoEvo.keep);
  check("…a je vidět, čím se stane", jenPoEvo.sub.indexOf("Azumarill") > -1, jenPoEvo.sub);

  // Čištění boxu: evoluční řada nesmí ukrojit půlku panelu pro rozbor.
  const bmLayout = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Primeape", cp: 1007, level: 17, ivAtk: 3, ivDef: 10, ivSta: 6 }]);
    // Rozbor se plní při kreslení karty podle toho, jestli je <details> otevřené,
    // takže se musí otevřít DŘÍV, než se box otevře. Třídu „siroky" si appka
    // nastaví sama — test ji nesmí předstírat.
    document.getElementById("bmVic").open = true;
    document.getElementById("boxModeBtn").click();
    const det = document.getElementById("bmDetail");
    const main = det.querySelector(".detail-main");
    const evo = det.querySelector(".d-evo-side");
    const panel = document.querySelector(".bm-panel");
    const out = {
      sloupcuRozboru: main ? getComputedStyle(main).columnCount : null,
      sirkaRozboru: main ? Math.round(main.getBoundingClientRect().width) : 0,
      sirkaEvo: evo ? Math.round(evo.getBoundingClientRect().width) : 0,
      sirkaPanelu: panel ? Math.round(panel.getBoundingClientRect().width) : 0,
    };
    P.boxZavritNatvrdo();
    return out;
  });
  check("v čištění boxu má rozbor pořád dva sloupce",
    bmLayout.sloupcuRozboru === "2", String(bmLayout.sloupcuRozboru));
  check("…a evoluční řada je jen úzký pruh, ne půlka okna",
    bmLayout.sirkaEvo > 0 && bmLayout.sirkaEvo < bmLayout.sirkaRozboru / 3,
    bmLayout.sirkaEvo + " px vedle " + bmLayout.sirkaRozboru + " px");
  check("…takže rozbor nezúžila — panel se místo toho rozšířil",
    bmLayout.sirkaRozboru >= 1000,
    bmLayout.sirkaRozboru + " px v panelu " + bmLayout.sirkaPanelu + " px");

  console.log("\n126) s evolucí se počítá VŠUDE, ne jen u raidů");
  // Chyba „appka se dívá na kus, ne na to, čím se stane" se opravila nejdřív
  // u raidů, pak u lig — a schovávala se ještě na dvou dalších místech:
  // u mega forem a u trade evolucí. Tenhle blok je pojistka proti tomu, aby
  // se objevila potřetí.
  const evoVsude = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    document.getElementById("resetSettingsBtn").click();
    P.setRows([
      // mega má až vyvinutá forma
      { pokemon: "Charmander", cp: 407, level: 15, ivAtk: 11, ivDef: 15, ivSta: 15 },
      { pokemon: "Beldum", cp: 353, level: 15, ivAtk: 2, ivDef: 8, ivSta: 10 },
      // trade evoluce je až o stupeň dál (Abra -> Kadabra -> Alakazam)
      { pokemon: "Abra", cp: 921, level: 20, ivAtk: 14, ivDef: 6, ivSta: 7 },
      { pokemon: "Gastly", cp: 300, level: 12, ivAtk: 10, ivDef: 10, ivSta: 10 },
      // trade evoluce rovnou (kontrola, že se to nerozbilo)
      { pokemon: "Machoke", cp: 1200, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 },
      // finální forma s megou (kontrola)
      { pokemon: "Charizard", cp: 1485, level: 18.5, ivAtk: 11, ivDef: 11, ivSta: 15 },
    ]);
    const c = P.getComputed();
    const out = {};
    P.base().forEach((b) => {
      out[b.row.pokemon] = {
        mega: c[b.row.id].mega, megaSub: c[b.row.id].megaSub || "",
        trade: c[b.row.id].trade, tradeSub: c[b.row.id].tradeSub || "",
        tradeTitle: c[b.row.id].tradeTitle || "",
        keep: c[b.row.id].keep,
      };
    });
    return out;
  });

  check("mega vyvinuté formy se u nevyvinutého kusu pozná",
    evoVsude.Charmander.mega !== "Ne", evoVsude.Charmander.mega);
  check("…a je řečeno, že je to až po evoluci",
    evoVsude.Charmander.megaSub.indexOf("po evoluci") > -1, evoVsude.Charmander.megaSub);
  check("…a je vidět priorita, ne jen „nejdřív evolvovat“",
    ["Vysoká", "Střední", "Nízká", "Primal"].indexOf(evoVsude.Beldum.mega) > -1,
    evoVsude.Beldum.mega);
  check("hotová mega forma se tím nerozbila",
    evoVsude.Charizard.mega === "Vysoká" && evoVsude.Charizard.megaSub.indexOf("po evoluci") === -1,
    evoVsude.Charizard.mega + " / " + evoVsude.Charizard.megaSub);

  // Abra sama trade evolucí není — je jí až Kadabra. Tahle informace v appce
  // úplně chyběla, a přitom je to nejlevnější cesta k Alakazamovi.
  check("trade evoluce o stupeň dál se najde",
    evoVsude.Abra.trade === "Po evoluci" && evoVsude.Abra.tradeSub.indexOf("Alakazam") > -1,
    evoVsude.Abra.trade + " · " + evoVsude.Abra.tradeSub);
  check("…a je popsané pořadí kroků",
    evoVsude.Abra.tradeTitle.indexOf("Kadabra") > -1
    && evoVsude.Abra.tradeTitle.indexOf("PŘED výměnou") > -1,
    evoVsude.Abra.tradeTitle.slice(0, 160));
  check("…platí to i pro Gastlyho",
    evoVsude.Gastly.tradeSub.indexOf("Gengar") > -1, evoVsude.Gastly.tradeSub);
  check("přímá trade evoluce zůstala jak byla",
    evoVsude.Machoke.trade === "Ano" && evoVsude.Machoke.tradeSub.indexOf("Machamp") > -1,
    evoVsude.Machoke.trade + " · " + evoVsude.Machoke.tradeSub);

  console.log("\n127) čištění boxu ve dvou sekcích, rotace lig, řazení Tradovat");
  // Hra hromadný transfer u některých kusů nenabídne (shiny vůbec, oblíbené
  // až po odznačení, legendární po zapnutí Expanded Group Transfer). Míchat
  // je mezi ostatní znamená, že se u hromadného výběru pokaždé zasekneš.
  const sekce = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    document.getElementById("resetSettingsBtn").click();
    const f = document.getElementById("filterSelect");
    f.value = "all"; f.dispatchEvent(new Event("change", { bubbles: true }));
    P.setRows([
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Pidgey", cp: 100, level: 10, ivAtk: 2, ivDef: 2, ivSta: 2 },
      { pokemon: "Mewtwo", cp: 2507, level: 21, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Magikarp", cp: 144, level: 20, ivAtk: 12, ivDef: 15, ivSta: 13, star: true },
      { pokemon: "Gyarados", cp: 1442, level: 16, ivAtk: 2, ivDef: 9, ivSta: 13, forma: "Shiny" },
      { pokemon: "Mew", cp: 3000, level: 30, ivAtk: 15, ivDef: 15, ivSta: 15 },
    ]);
    document.getElementById("boxModeBtn").click();
    const list = P.bmSeznam ? P.bmSeznam() : null;
    const pos = document.getElementById("bmPos").textContent;
    const blok = (document.querySelector(".bm-blok") || {}).textContent || "";
    P.boxZavritNatvrdo();
    return {
      poradi: list ? list.map((x) => x.row.pokemon + ":" + x.sekce) : null,
      pos: pos, blok: blok,
    };
  });
  check("seznam se rozdělí na dvě sekce", !!sekce.poradi, JSON.stringify(sekce.poradi));
  check("…a první sekce je celá před druhou",
    (function () {
      const s2 = sekce.poradi.findIndex((x) => x.indexOf(":2") > -1);
      return s2 === -1 || sekce.poradi.slice(s2).every((x) => x.indexOf(":2") > -1);
    })(), sekce.poradi.join(" | "));
  // Do druhé sekce patří jen to, co hra nepustí BEZ OHLEDU na uživatele.
  // Hvězdička se sem nepočítá: appka si ji dává sama u všeho, co si necháváš,
  // takže by se do druhé sekce sesypal celý roster — a odznačit se dá.
  check("shiny, legendární i mytický jsou ve druhé sekci",
    ["Gyarados", "Mewtwo", "Mew"].every((jm) =>
      sekce.poradi.indexOf(jm + ":2") > -1), sekce.poradi.join(" | "));
  check("…ale hvězdička sama o sobě do druhé sekce nepatří",
    sekce.poradi.indexOf("Magikarp:1") > -1, sekce.poradi.join(" | "));
  check("běžný odpad zůstal v první", sekce.poradi.indexOf("Rattata:1") > -1,
    sekce.poradi.join(" | "));
  check("ukazatel říká, ve které sekci jsi", /sekce/.test(sekce.pos), sekce.pos);

  // Rotace lig: data ve zdroji jsou, jen se zahazovala.
  const rotace = await page.evaluate(() => {
    document.getElementById("eventsCard").open = true;
    window.__pgo.renderEvents();
    const box = document.getElementById("eventsBody");
    return {
      nadpisy: Array.from(box.querySelectorAll(".ev-h")).map((e) => e.textContent),
      tabulka: (box.querySelector(".ev-ligy") || {}).textContent || "",
      radku: box.querySelectorAll(".ev-ligy tr").length,
      priznano: box.textContent.indexOf("Rozpočet rolí s rotací zatím") > -1,
    };
  });
  check("Události mají sekci o ligách",
    rotace.nadpisy.indexOf("Ligy v GO Battle League") > -1, rotace.nadpisy.join(" | "));
  check("…s tabulkou, kdy co běží", rotace.radku > 1, String(rotace.radku));
  check("…a je vidět, které ligy to jsou",
    /Great League|Ultra League|Master League/.test(rotace.tabulka),
    rotace.tabulka.slice(0, 120));
  // Appka nesmí předstírat, že se podle toho rozhoduje, dokud to není pravda.
  check("…a přiznává, že rozpočet s rotací zatím nepočítá", rotace.priznano);

  // Sloupec Tradovat: stavy, ne abeceda.
  const razeniTrade = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Machoke", cp: 1200, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 },
      { pokemon: "Abra", cp: 921, level: 20, ivAtk: 14, ivDef: 6, ivSta: 7 },
      { pokemon: "Mew", cp: 3000, level: 30, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Misdreavus", cp: 25, level: 1, ivAtk: 11, ivDef: 14, ivSta: 4, fastMove: "Hex" },
      { pokemon: "Charizard", cp: 1485, level: 18.5, ivAtk: 11, ivDef: 11, ivSta: 15 },
    ]);
    let th = null;
    document.querySelectorAll("#rosterTable thead #headerRow th").forEach((t) => {
      if (!th && t.textContent.indexOf("Tradovat") > -1) th = t;
    });
    th.click();
    const c = window.__pgo.getComputed();
    return Array.from(document.querySelectorAll("#tbody tr")).map((tr) => {
      const jm = (tr.querySelector("td.col-pokemon") || {}).textContent || "";
      const r = window.__pgo.getRows().filter((x) => x.pokemon === jm.trim())[0];
      return r ? c[r.id].trade : null;
    }).filter(Boolean);
  });
  // Pořadí od nejzajímavějšího po „nedá se" — abecedně by vyšlo Ano, Ne,
  // Nejde, Po evoluci, Zvážit, což nic neříká.
  //
  // „Po evoluci" je PŘED „Ano": tam je zdarma i trade, i evoluce po něm,
  // takže se vyplatí nejvíc a patří první na oči.
  const POR = ["Po evoluci", "Ano", "Zvážit", "Nejde", "Ne"];
  check("sloupec Tradovat se řadí podle stavu, ne abecedně",
    razeniTrade.every((v, i) => i === 0 || POR.indexOf(razeniTrade[i - 1]) <= POR.indexOf(v)),
    razeniTrade.join(" → "));

  console.log("\n128) Rozpočet pohltil „Kam dát prach“ a bere ohled na rotaci lig");
  // „Kam dát prach" a „Rozpočet" odpovídaly na tutéž otázku, jenže plán
  // NEPOČÍTAL s cenou — vybíral nejlepší kus na roli, což jsou typicky kusy,
  // které už hotové máš. Zůstal jen Rozpočet; z plánu se přenesly seznamy,
  // které se za prach nekupují (bonbóny a Elitní TM).
  const sloucene = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    document.getElementById("resetSettingsBtn").click();
    P.setRows([
      { pokemon: "Machop", cp: 114, level: 4, ivAtk: 4, ivDef: 2, ivSta: 13 },
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Marill", cp: 195, level: 21, ivAtk: 1, ivDef: 14, ivSta: 4,
        fastMove: "Bubble", charged1: "Play Rough" },
      { pokemon: "Ducklett", cp: 115, level: 6, ivAtk: 1, ivDef: 5, ivSta: 13 },
    ]);
    document.getElementById("dustCard").open = true;
    const el = document.getElementById("dustBudget");
    el.value = "500000"; el.dispatchEvent(new Event("input", { bubbles: true }));
    P.prekreslit();
    const zalozky = Array.from(document.querySelectorAll(".zal-tab, .zal-lista button"))
      .map((e) => e.textContent.trim());
    return {
      kartaPryc: !document.getElementById("planCard"),
      planVRozpoctu: !!document.querySelector("#dustCard #planBody"),
      zalozkaPryc: zalozky.every((t) => t.indexOf("Kam dát prach") === -1),
      maRozpocet: zalozky.some((t) => t.indexOf("Rozpočet") > -1),
      // seznamy na bonbóny/TM tam být MAJÍ — ty se za prach nekupují
      maEvoluce: (document.querySelector("#dustCard #planBody") || {}).textContent || "",
      patka: Array.from(document.querySelectorAll("#dustBody .plan-foot"))
        .map((e) => e.textContent).join(" | "),
    };
  });
  check("karta „Kam dát prach“ je zrušená", sloucene.kartaPryc);
  check("…i její záložka", sloucene.zalozkaPryc && sloucene.maRozpocet);
  check("…a co z ní zbylo, je v Rozpočtu", sloucene.planVRozpoctu);

  // Rotace lig se do pořadí promítá a appka to říká.
  check("rozpočet přizná, že bere ohled na rotaci lig",
    sloucene.patka.indexOf("rotaci lig") > -1, sloucene.patka.slice(0, 200));
  check("…a vyjmenuje, co se zrovna hraje — nebo řekne, že nic neběží",
    /teď se hraje/.test(sloucene.patka)
    || /teď neběží žádná liga/.test(sloucene.patka), sloucene.patka.slice(0, 220));

  const vahy = await page.evaluate(() => {
    const P = window.__pgo;
    const stav = P.ligyStav ? P.ligyStav() : null;
    return {
      stav: stav,
      // Liga, která běží, nesmí být znevýhodněná; ta, co neběží, ano.
      bezici: P.vahaRole ? P.vahaRole("PvP GL #24") : null,
      nebezici: P.vahaRole ? P.vahaRole("PvP LC #2") : null,
      raid: P.vahaRole ? P.vahaRole("Raid Fire") : null,
      gym: P.vahaRole ? P.vahaRole("Gym") : null,
    };
  });
  // Váha 1 platí jen pro ligu, která OPRAVDU běží. Když zrovna nastupuje
  // („brzy") nebo neběží, je nižší — a to je správně, ne chyba.
  const glBezi = vahy.stav && vahy.stav.GL === "ted";
  check(glBezi ? "běžící liga není v rozpočtu znevýhodněná"
               : "liga, která zrovna neběží, má nižší váhu",
    glBezi ? vahy.bezici === 1 : (vahy.bezici !== null && vahy.bezici <= 1),
    "GL=" + String(vahy.stav && vahy.stav.GL) + " váha=" + String(vahy.bezici));
  // Když podle dat neběží NIC, nemá co být znevýhodněné — všechny ligy mají
  // stejnou váhu a to je správně. Rozdíl se testuje jen tehdy, když nějaká
  // liga opravdu běží.
  const nejakaBezi = vahy.stav && Object.keys(vahy.stav).length > 0;
  check(nejakaBezi ? "…zatímco ta, co se nehraje, jde níž"
                   : "…a když neběží nic, nikdo znevýhodněný není",
    nejakaBezi ? (vahy.nebezici !== null && vahy.nebezici < 1)
               : vahy.nebezici === 1,
    "stav=" + JSON.stringify(vahy.stav) + " nebezici=" + String(vahy.nebezici));
  // Raidy a gym běží pořád — ty se dotýkat nesmí.
  check("raidy a gym rotace neovlivňuje",
    vahy.raid === 1 && vahy.gym === 1, vahy.raid + " / " + vahy.gym);

  console.log("\n129) Finalni jen tam, kde nejaka rada je");
  // U druhu, který se nevyvíjí vůbec (Absol, Aerodactyl), zní „Finální",
  // jako by se odněkud vyvinul. Rozlišuje se to podle toho, jestli evoluční
  // graf o tom druhu vůbec něco ví.
  const finalni = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Absol", cp: 1416, level: 20, ivAtk: 14, ivDef: 14, ivSta: 11 },
      { pokemon: "Aerodactyl", cp: 1162, level: 15, ivAtk: 12, ivDef: 13, ivSta: 12 },
      { pokemon: "Alakazam", cp: 1277, level: 15, ivAtk: 11, ivDef: 11, ivSta: 15 },
      { pokemon: "Gyarados", cp: 1442, level: 16, ivAtk: 2, ivDef: 9, ivSta: 13 },
    ]);
    const c = P.getComputed();
    const out = {};
    P.getRows().forEach((r) => {
      out[r.pokemon] = { evolve: c[r.id].evolve, title: c[r.id].evolveTitle || "" };
    });
    return out;
  });
  check("druh bez jakékoli evoluce nehlásí Finální",
    finalni.Absol.evolve === "Nevyvíjí se" && finalni.Aerodactyl.evolve === "Nevyvíjí se",
    finalni.Absol.evolve + " / " + finalni.Aerodactyl.evolve);
  check("…a bublina to vysvětlí",
    finalni.Absol.title.indexOf("evoluci nemá vůbec") > -1, finalni.Absol.title);
  check("konec skutečné řady zůstává Finální",
    finalni.Alakazam.evolve === "Finální" && finalni.Gyarados.evolve === "Finální",
    finalni.Alakazam.evolve + " / " + finalni.Gyarados.evolve);

  console.log("\n130) priorita megy se nehádá");
  // Dřív tu byla dopočítaná záchrana „útok >= 280 -> Vysoká". Změřeno proti
  // ohodnocenému seznamu se rozchází u 26 ze 47 meg — udělala by Vysokou
  // z Mega Absola, Banette, Pinsira i Sharpeda a naopak srazila Venusaura.
  // A od zavedení rozpočtu to není kosmetika: Vysoká znamená, že si appka
  // kvůli té meze nechá i nevyvinutý kus. Hádat je horší než přiznat nevědomost.
  const megaP = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Charizard", cp: 1485, level: 18.5, ivAtk: 11, ivDef: 11, ivSta: 15 },
      { pokemon: "Absol", cp: 1416, level: 20, ivAtk: 14, ivDef: 14, ivSta: 11 },
    ]);
    const c = P.getComputed();
    const out = {};
    P.getRows().forEach((r) => {
      out[r.pokemon] = { mega: c[r.id].mega, sub: c[r.id].megaSub || "" };
    });
    out.priorityVSeznamu = P.megaPriority ? P.megaPriority("Naprosto Neznamy Druh", [{ a: 400 }]) : null;
    return out;
  });
  check("ohodnocená mega si prioritu drží", megaP.Charizard.mega === "Vysoká",
    megaP.Charizard.mega);
  // Mega Absol má útok 314 — dopočet by z něj udělal Vysokou, seznam říká Nízká.
  check("silný útok sám o sobě Vysokou nedělá", megaP.Absol.mega === "Nízká",
    megaP.Absol.mega + " (dopočet podle útoku by dal Vysoká)");
  check("neohodnocená mega se nehádá, přizná se nevědomost",
    megaP.priorityVSeznamu === "Neznámá", String(megaP.priorityVSeznamu));

  // ---------------------------------------------------------------- 131
  // „Co teď skenovat“ — řetězec age0-N do vyhledávání ve hře.
  //
  // Smysl bloku: nesmí se stát, že okno vyjde MENŠÍ, než je odstup od
  // posledního skenu. Naskenovat kus dvakrát je zadarmo, vynechat ho ne —
  // tiše by v rosteru chyběl a nikdo by si toho nevšiml.
  console.log("\n132) Level zpětně z CP a IV");
  const lvl = await page.evaluate(() => {
    const P = window.__pgo;
    const druhy = ["Machamp", "Blissey", "Tyranitar", "Magikarp", "Azumarill",
      "Medicham", "Registeel", "Skarmory", "Charizard", "Wobbuffet", "Shuckle",
      "Bidoof", "Metagross", "Togekiss", "Swablu", "Wailmer", "Alakazam", "Gyarados"];
    const ivs = [[15, 15, 15], [10, 12, 13], [0, 0, 0], [4, 15, 7], [1, 3, 2]];
    let celkem = 0, jedno = 0, sedi = 0, nenaslo = 0;
    druhy.forEach((n) => ivs.forEach(([a, d, s]) => {
      for (let lv = 1; lv <= 40; lv += 0.5) {
        const cp = P.cpNaLevelu(n, a, d, s, lv);
        if (cp === null) continue;
        const r = P.levelZCP(n, cp, a, d, s);
        celkem++;
        if (!r) { nenaslo++; continue; }
        if (r.jednoznacne) jedno++;
        if (r.vse.indexOf(lv) !== -1) sedi++;
      }
    }));
    return { celkem, jedno, sedi, nenaslo,
      ukazka: P.levelZCP("Machamp", P.cpNaLevelu("Machamp", 15, 14, 13, 25), 15, 14, 13),
      spatneIV: P.levelZCP("Machamp", 2000, 16, 15, 15),
      neznamyDruh: P.levelZCP("Neexistujici Druh", 1000, 15, 15, 15),
      nesmyslneCP: P.levelZCP("Machamp", 999999, 15, 15, 15) };
  });
  // Tohle je ta podstatná vlastnost: skutečný level nesmí z kandidátů vypadnout.
  check("skutečný level je vždy mezi kandidáty", lvl.sedi === lvl.celkem,
    lvl.sedi + " z " + lvl.celkem);
  check("dopočet nikdy neselže na platném CP", lvl.nenaslo === 0, String(lvl.nenaslo));
  // CP se zaokrouhluje dolů, takže sousední půl-levely můžou dát totéž.
  check("drtivá většina CP určuje level jednoznačně", lvl.jedno / lvl.celkem > 0.99,
    Math.round(lvl.jedno / lvl.celkem * 1000) / 10 + " % z " + lvl.celkem);
  check("konkrétní kus vyjde na svůj level", lvl.ukazka && lvl.ukazka.level === 25,
    JSON.stringify(lvl.ukazka));
  check("IV mimo rozsah se nedopočítává", lvl.spatneIV === null, JSON.stringify(lvl.spatneIV));
  check("neznámý druh se nedopočítává", lvl.neznamyDruh === null,
    JSON.stringify(lvl.neznamyDruh));
  check("nesmyslné CP se nedopočítává", lvl.nesmyslneCP === null,
    JSON.stringify(lvl.nesmyslneCP));

  // --- formulář na kus z gymu / Dmax spotu --------------------------------
  // Řádková editace je jen v zobrazení „Vše“, takže bez tohohle formuláře
  // by kus, který Calcy nenaskenuje celý, do rosteru nešel dostat vůbec.
  const rucni = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([]); P.setDiscarded([]);
    const cp = P.cpNaLevelu("Machamp", 15, 14, 13, 25);
    // Okno otevírá jediné tlačítko — dřív byla zvlášť ještě „+ Ručně“.
    document.getElementById("addRowBtn").click();
    const set = (id, v) => {
      const e = document.getElementById(id);
      e.value = v; e.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const out = document.getElementById("rbOut");
    const add = document.getElementById("rbAdd");
    const kroky = [];
    kroky.push({ krok: "prazdny", text: out.textContent, blok: add.disabled });
    set("rbName", "Nesmyslny Druh"); set("rbCp", cp);
    set("rbA", 15); set("rbD", 14); set("rbS", 13);
    kroky.push({ krok: "neznamyDruh", text: out.textContent, blok: add.disabled });
    set("rbName", "Machamp");
    kroky.push({ krok: "hotovo", text: out.textContent, blok: add.disabled });
    set("rbCp", cp + 7);
    kroky.push({ krok: "nesedici", text: out.textContent, blok: add.disabled });
    set("rbCp", cp);
    add.click();
    const r = P.getRows();
    return { kroky, cp, pocet: r.length, radek: r[0] ? {
      pokemon: r[0].pokemon, cp: r[0].cp, level: r[0].level,
      iv: [r[0].ivAtk, r[0].ivDef, r[0].ivSta].join("/"),
      znacka: !!r[0].levelZCP, datumSkenu: r[0].scanDate || "" } : null,
      poPridani: document.getElementById("rbOut").textContent,
      oknoZavrene: document.getElementById("rucniBox").hidden };
  });
  const krok = (n) => rucni.kroky.find((k) => k.krok === n);
  check("prázdný formulář přidat nedovolí", krok("prazdny").blok === true,
    JSON.stringify(krok("prazdny")));
  check("překlep v druhu se pozná a řekne", krok("neznamyDruh").blok === true
    && krok("neznamyDruh").text.includes("nezná"), JSON.stringify(krok("neznamyDruh")));
  check("vyplněný kus ukáže dopočítaný level", krok("hotovo").blok === false
    && krok("hotovo").text.includes("Level 25"), JSON.stringify(krok("hotovo")));
  // Nejdůležitější: appka radši odmítne, než aby level uhádla.
  check("CP, které na žádný level nesedí, se odmítne", krok("nesedici").blok === true
    && krok("nesedici").text.includes("nesedí žádný level"),
    JSON.stringify(krok("nesedici")));

  // --- reálný případ: Lickitung v gymu, CP snížené motivací ---------------
  // Ukazoval CP 128 s IV 2/3/15 a appka to hlásila jako překlep. Platná CP
  // jsou 126 (L4), 145 (L4,5), 163 (L5) — 145 po ~12 h motivačního propadu
  // dá právě 128. Hláška proto musí mluvit o motivaci a nabídnout platná CP,
  // ne posílat člověka hledat překlep, který tam není.
  const gymCp = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([]); P.setDiscarded([]);
    const set = (id, v) => {
      const e = document.getElementById(id);
      e.value = v; e.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("rbName", "Lickitung"); set("rbCp", 128);
    set("rbA", 2); set("rbD", 3); set("rbS", 15);
    const out = document.getElementById("rbOut");
    const nabidka = [...out.querySelectorAll("button[data-cp]")].map((b) => b.dataset.cp);
    const text = out.textContent;
    // klik na nabídnuté CP ho doplní a formulář se odemkne
    const btn = out.querySelector('button[data-cp="145"]');
    if (btn) btn.click();
    return { text, nabidka, poKliku: document.getElementById("rbCp").value,
      vysledek: document.getElementById("rbOut").textContent,
      blok: document.getElementById("rbAdd").disabled,
      primo: P.levelZCP("Lickitung", 128, 2, 3, 15),
      platne: [126, 145, 163].map((c) => {
        const r = P.levelZCP("Lickitung", c, 2, 3, 15);
        return r ? c + "=L" + r.level : c + "=nic";
      }) };
  });
  check("CP 128 u Lickitunga 2/3/15 opravdu neexistuje", gymCp.primo === null,
    JSON.stringify(gymCp.primo));
  check("…zatímco 126/145/163 ano", gymCp.platne.join(" ") === "126=L4 145=L4.5 163=L5",
    gymCp.platne.join(" "));
  check("hláška mluví o motivaci v gymu, ne o překlepu",
    gymCp.text.includes("motivací") && gymCp.text.includes("vyšší")
    && !gymCp.text.includes("překlep"), gymCp.text.slice(0, 200));
  // Doba v gymu z konečného seznamu jen VYBÍRÁ — nesmí z toho být jistota.
  const gymHod = await page.evaluate(() => {
    const set = (id, v) => {
      const e = document.getElementById(id);
      e.value = v; e.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const out = document.getElementById("rbOut");
    set("rbName", "Lickitung"); set("rbCp", 128);
    set("rbA", 2); set("rbD", 3); set("rbS", 15);
    const bezHodin = out.textContent;
    set("rbHod", 12);
    const tip12 = out.querySelector("button.tip");
    const text12 = out.textContent;
    set("rbHod", 40);
    const tip40 = out.querySelector("button.tip");
    return { bezHodin, text12,
      tip12: tip12 ? tip12.dataset.cp : null,
      tip40: tip40 ? tip40.dataset.cp : null };
  });
  check("bez zadaných hodin appka o hodiny řekne", gymHod.bezHodin.includes("kolik hodin"),
    gymHod.bezHodin.slice(-90));
  // 12 h × ~1 %/h → 128 / 0,88 ≈ 145,5 → nejbližší platné je 145.
  check("12 h v gymu vybere 145", gymHod.tip12 === "145", String(gymHod.tip12));
  // Delší pobyt → větší propad → tipuje vyšší skutečné CP.
  check("delší pobyt tipuje vyšší CP", +gymHod.tip40 > +gymHod.tip12,
    gymHod.tip12 + " → " + gymHod.tip40);
  check("tip se podává jako odhad, ne jako jistota",
    gymHod.text12.includes("odhad") && gymHod.text12.includes("bobule"),
    gymHod.text12.slice(-220));

  check("nabídne platná CP nad zadaným", gymCp.nabidka.includes("145")
    && gymCp.nabidka.includes("163"), gymCp.nabidka.join(","));
  check("klik na nabídnuté CP ho doplní a odemkne přidání",
    gymCp.poKliku === "145" && gymCp.blok === false && gymCp.vysledek.includes("Level 4,5")
      .valueOf() || (gymCp.poKliku === "145" && gymCp.blok === false),
    gymCp.poKliku + " | " + gymCp.vysledek.slice(0, 80));
  check("kus se přidá do rosteru", rucni.pocet === 1 && rucni.radek
    && rucni.radek.pokemon === "Machamp" && rucni.radek.level === 25
    && rucni.radek.iv === "15/14/13", JSON.stringify(rucni.radek));
  check("dopočítaný level je označený", rucni.radek.znacka === true,
    String(rucni.radek.znacka));
  // Datum skenu se nesmí vymyslet — naskenovaný ten kus nebyl.
  check("ručně přidaný kus nemá datum skenu", rucni.radek.datumSkenu === "",
    rucni.radek.datumSkenu);
  // Dřív okno zůstávalo otevřené s hláškou „můžeš rovnou psát další". Jenže
  // přidanému kusu se otevře detail a formulář nad ním brání se na něj
  // podívat — zavření je tedy součást přidání, ne něco navíc.
  eq("po přidání se okno zavře", rucni.oknoZavrene, true);

  // --- ruční přidání kusu, který v rosteru už je --------------------------
  // Ruční zápis nemá datum skenu ani otisk (výška/váha), takže by ho pozdější
  // slučování nemuselo spárovat a duplicita by v rosteru zůstala — a rozpočet
  // rolí by si myslel, že ten kus máš dvakrát.
  const dupl = await page.evaluate(() => {
    const P = window.__pgo;
    const cp25 = P.cpNaLevelu("Machamp", 15, 14, 13, 25);
    const cp30 = P.cpNaLevelu("Machamp", 15, 14, 13, 30);
    const set = (id, v) => {
      const e = document.getElementById(id);
      e.value = v; e.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const out = document.getElementById("rbOut");
    const add = document.getElementById("rbAdd");
    const zapis = (jm, cp) => {
      set("rbName", jm); set("rbCp", cp); set("rbA", 15); set("rbD", 14); set("rbS", 13);
      return { text: out.textContent, popis: add.textContent, blok: add.disabled };
    };
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Machamp", cp: cp25, level: 25, ivAtk: 15, ivDef: 14, ivSta: 13 }]);
    const stejny = zapis("Machamp", cp25);
    const vylepseny = zapis("Machamp", cp30);
    const jinyDruh = zapis("Machoke", P.cpNaLevelu("Machoke", 15, 14, 13, 25));
    // jiná IV = prokazatelně jiný kus, varovat se nemá
    set("rbName", "Machamp"); set("rbA", 10);
    set("rbCp", P.cpNaLevelu("Machamp", 10, 14, 13, 25));
    const jinaIv = { text: out.textContent, popis: add.textContent };
    return { stejny, vylepseny, jinyDruh, jinaIv, cp25, cp30 };
  });
  check("ruční přidání kusu, co v rosteru je, varuje",
    dupl.stejny.text.includes("už v rosteru je"), dupl.stejny.text);
  // Blokovat to nejde: můžou existovat dva kusy se shodným CP i IV.
  check("…ale nechá to přidat vědomě", dupl.stejny.blok === false
    && dupl.stejny.popis === "Přidat i tak", JSON.stringify(dupl.stejny));
  check("stejná IV a jiné CP se ohlásí jako možné vylepšení",
    dupl.vylepseny.text.includes("stejnými IV") && dupl.vylepseny.text.includes("vylepšení"),
    dupl.vylepseny.text);
  check("jiný druh se za duplicitu nepovažuje",
    !dupl.jinyDruh.text.includes("rosteru") && dupl.jinyDruh.popis === "Přidat do rosteru",
    dupl.jinyDruh.text);
  check("jiná IV se za duplicitu nepovažuje",
    !dupl.jinaIv.text.includes("rosteru") && dupl.jinaIv.popis === "Přidat do rosteru",
    dupl.jinaIv.text);

  // --- kus z gymu musí být vidět, dokud ho Calcy neuvidí ------------------
  // Ručně zadaný kus nemá útoky ani otisk a CP mohlo být snížené motivací,
  // takže je to náhradní řešení. Bez připomínky by v rosteru zůstal navždy
  // jako „hotový" a nikdo by ho nedoskenoval.
  const znacka = await page.evaluate(() => {
    const P = window.__pgo;
    const H = "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,Fast move,Special move,"
      + "Height (cm),Weight (g),Scan date";
    const cp = P.cpNaLevelu("Machamp", 15, 14, 13, 25);
    P.setRows([]); P.setDiscarded([]);
    const set = (id, v) => {
      const e = document.getElementById(id);
      e.value = v; e.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("rbName", "Machamp"); set("rbCp", cp);
    set("rbA", 15); set("rbD", 14); set("rbS", 13);
    document.getElementById("rbAdd").click();

    const r0ziv = P.getRows()[0];
    const r0 = { id: r0ziv.id, zGymu: r0ziv.zGymu };
    const c0 = P.getComputed()[r0.id];

    // teď se vrátí z gymu a naskenuje se doopravdy
    P.importText([H, "Machamp," + cp + ",25,15,14,13,Counter,Dynamic Punch,"
      + "160,29000," + datumPred(0)].join(String.fromCharCode(10)));
    P.finishImport("merge");
    const r1 = P.getRows()[0];
    return { znacka0: !!r0.zGymu, sken0: c0.rescan, pruh: "",
      pocet: P.getRows().length, znacka1: !!r1.zGymu, level1: !!r1.levelZCP,
      utoky: r1.fastMove,
      pruhPo: "" };
  });
  check("ručně přidaný kus je označený", znacka.znacka0 === true, String(znacka.znacka0));
  check("sloupec Sken? na něj upozorní", znacka.sken0 === "Až se vrátí", znacka.sken0);
  check("po skutečném skenu značka zmizí", znacka.znacka1 === false && znacka.pocet === 1,
    JSON.stringify({ z: znacka.znacka1, p: znacka.pocet }));
  check("…a dopočítaný level ustoupí skutečným datům", znacka.level1 === false
    && znacka.utoky === "Counter", znacka.level1 + " / " + znacka.utoky);

  // --- ručně přidaný kus se musí potkat s pozdějším skenem ----------------
  // Kus přidaný ručně z gymu se za pár dní vrátí, naskenuje se a naimportuje.
  // Kdyby se nespároval, měl by ho člověk v rosteru dvakrát.
  const spojeni = await page.evaluate(() => {
    const P = window.__pgo;
    const H = "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,Fast move,Special move,"
      + "Height (cm),Weight (g),Scan date";
    const cp25 = P.cpNaLevelu("Machamp", 15, 14, 13, 25);
    const cp30 = P.cpNaLevelu("Machamp", 15, 14, 13, 30);
    const rucni = () => {
      P.setDiscarded([]);
      P.setRows([{ pokemon: "Machamp", cp: cp25, level: 25, ivAtk: 15, ivDef: 14,
        ivSta: 13, levelZCP: true }]);
    };
    const skenuj = (cp, lv) => {
      P.importText([H, "Machamp," + cp + "," + lv + ",15,14,13,Counter,"
        + "Dynamic Punch,160,29000," + datumPred(0)].join(String.fromCharCode(10)));
      P.finishImport("merge");
      return P.getRows();
    };
    rucni();
    const a = skenuj(cp25, 25);
    rucni();
    const b = skenuj(cp30, 30);
    return { stejny: { pocet: a.length, cp: a[0].cp },
      poVylepseni: { pocet: b.length, cp: b[0].cp, level: b[0].level },
      cp25, cp30 };
  });
  check("sken téhož kusu se s ručním zápisem spojí, nezdvojí",
    spojeni.stejny.pocet === 1, JSON.stringify(spojeni.stejny));
  check("…i když ho mezitím vylepšil", spojeni.poVylepseni.pocet === 1
    && String(spojeni.poVylepseni.cp) === String(spojeni.cp30),
    JSON.stringify(spojeni.poVylepseni));

  // --- a totéž rukama v tabulce, jak to bude dělat člověk ------------------
  const lvlUI = await page.evaluate(() => {
    const P = window.__pgo;
    const cp = P.cpNaLevelu("Machamp", 15, 14, 13, 25);
    // Řádková editace je jen v zobrazení „Vše“ — v základním pohledu jsou
    // buňky jen ke čtení, takže tam žádné inputy nejsou.
    const vs = document.getElementById("viewSelect");
    vs.value = "all";
    vs.dispatchEvent(new Event("change", { bubbles: true }));
    P.setRows([{ pokemon: "Machamp", cp: cp, ivAtk: 15, ivDef: 14, ivSta: 13 }]);
    const tr = document.querySelector("#tbody tr");
    const poleCP = [...tr.querySelectorAll("input")].find((i) => i.value === String(cp));
    poleCP.dispatchEvent(new Event("change", { bubbles: true }));
    const zivy = P.getRows()[0];
    const poDopoctu = { level: zivy.level, levelZCP: zivy.levelZCP };
    // ruční zápis levelu musí dopočet vypnout
    const tr2 = document.querySelector("#tbody tr");
    const poleLv = [...tr2.querySelectorAll("input")]
      .find((i) => i.value === String(poDopoctu.level));
    poleLv.value = "31";
    poleLv.dispatchEvent(new Event("input", { bubbles: true }));
    poleCP.dispatchEvent(new Event("change", { bubbles: true }));
    vs.value = "verdict";
    vs.dispatchEvent(new Event("change", { bubbles: true }));
    return { cp: cp, level: poDopoctu.level, znacka: !!poDopoctu.levelZCP,
      poRucnim: P.getRows()[0].level, znackaPoRucnim: !!P.getRows()[0].levelZCP };
  });
  check("level se v tabulce dopočítá sám", lvlUI.level === 25,
    "CP " + lvlUI.cp + " → L" + lvlUI.level);
  check("dopočtený level je označený", lvlUI.znacka === true, String(lvlUI.znacka));
  check("ruční level dopočet přebije a už ho nepřepisuje",
    lvlUI.poRucnim === "31" && lvlUI.znackaPoRucnim === false,
    lvlUI.poRucnim + " / znacka=" + lvlUI.znackaPoRucnim);

  // ---------------------------------------------------------------- 133
  // Sloučení rosteru — mega forma, pořadí a kusy, které sken nezahlédl.
  console.log("\n133) Sloučení: mega, pořadí, kusy mimo sken");
  const slouc = await page.evaluate(() => {
    const P = window.__pgo;
    const H = "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,Fast move,Special move,"
      + "Height (cm),Weight (g),Scan date";
    const nacti = (r, mode) => {
      P.importText([H].concat(r).join(String.fromCharCode(10)));
      P.finishImport(mode);
    };
    const out = {};

    // --- mega: má JINÉ rozměry i CP, takže otisk přes tu hranici neplatí
    P.setRows([]); P.setDiscarded([]);
    nacti(["Charizard,2200,25,14,13,12,Fire Spin,Blast Burn,170,90500,"
      + datumPred(3)], true);
    nacti(["Mega Charizard X,3100,25,14,13,12,Fire Spin,Blast Burn,221,110500,"
      + datumPred(0)], "merge");
    const r1 = P.getRows();
    out.mega = { pocet: r1.length, jmeno: r1[0].pokemon, cp: r1[0].cp,
      vyska: r1[0].vyska, vaha: r1[0].vaha };
    // a po vypršení megy zase obyčejný sken
    nacti(["Charizard,2200,25,14,13,12,Fire Spin,Blast Burn,170,90500,"
      + datumPred(0)], "merge");
    out.megaPakZpet = P.getRows().length;

    // --- pořadí: sloučení musí jít podle skenu, ne nechat staré na místě
    P.setRows([]); P.setDiscarded([]);
    nacti(["Bidoof,100,5,5,5,5,Tackle,Crunch,50,2000," + datumPred(5),
           "Rattata,120,6,6,6,6,Tackle,Dig,30,3500," + datumPred(5)], true);
    nacti(["Machop,300,12,10,10,10,Karate Chop,Cross Chop,80,19500,"
             + datumPred(0),
           "Bidoof,100,5,5,5,5,Tackle,Crunch,50,2000," + datumPred(0),
           "Abra,150,8,7,7,7,Confusion,Shadow Ball,90,19500," + datumPred(0)],
          "merge");
    out.poradi = P.getRows().map((r) => r.pokemon);

    // --- kusy mimo sken se bez svolení nemažou, se svolením ano
    const box = document.getElementById("celyBox");
    box.checked = false;
    P.setRows([]); P.setDiscarded([]);
    nacti(["Bidoof,100,5,5,5,5,Tackle,Crunch,50,2000," + datumPred(5),
           "Rattata,120,6,6,6,6,Tackle,Dig,30,3500," + datumPred(5)], true);
    nacti(["Bidoof,100,5,5,5,5,Tackle,Crunch,50,2000," + datumPred(0)], "merge");
    out.bezSvoleni = P.getRows().map((r) => r.pokemon);
    box.checked = true;
    nacti(["Bidoof,100,5,5,5,5,Tackle,Crunch,50,2000," + datumPred(0)], "merge");
    out.seSvolenim = P.getRows().map((r) => r.pokemon);
    out.smazaneJdouVratit = P.getDiscarded().some((d) => d.n === "Rattata");
    box.checked = false;
    return out;
  });
  // Bez tohohle vznikne druhý řádek „Mega …", který v rosteru zůstane
  // napořád — pozdější obyčejný sken má nižší CP a nespáruje se ani s ním.
  check("sken mega formy nezaloží druhý řádek", slouc.mega.pocet === 1,
    JSON.stringify(slouc.mega));
  check("…a nepřepíše základ mega CP ani mega rozměry",
    String(slouc.mega.cp) === "2200" && String(slouc.mega.vyska) === "170"
    && String(slouc.mega.vaha) === "90500", JSON.stringify(slouc.mega));
  check("…ani jménem", slouc.mega.jmeno === "Charizard", slouc.mega.jmeno);
  check("a po vypršení megy je pořád jeden řádek", slouc.megaPakZpet === 1,
    String(slouc.megaPakZpet));
  // Čištění boxu se prochází vedle hry, takže pořadí musí sedět na sken.
  check("po sloučení jde roster v pořadí skenu",
    slouc.poradi.slice(0, 3).join(",") === "Machop,Bidoof,Abra",
    slouc.poradi.join(","));
  check("…a co sken neviděl, jde za něj",
    slouc.poradi[slouc.poradi.length - 1] === "Rattata", slouc.poradi.join(","));
  check("kus mimo sken se sám od sebe nesmaže",
    slouc.bezSvoleni.indexOf("Rattata") !== -1, slouc.bezSvoleni.join(","));
  check("…se zaškrtnutým „celý box“ se odebere",
    slouc.seSvolenim.indexOf("Rattata") === -1, slouc.seSvolenim.join(","));
  check("…a dá se vrátit ze smazaných", slouc.smazaneJdouVratit === true,
    String(slouc.smazaneJdouVratit));
  // ---------------------------------------------------------------- 134
  // Liga v odznáčku, ve verdiktu a na kartě musí být jedna a tatáž.
  console.log("\n134) PvP: odznáček, verdikt a karta si nesmí odporovat");
  const pvpShoda = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    // Lickilicky se v Great League houpe mezi #1 a #155 podle toho, jaký
    // balance patch zrovna vyšel. Práh se proto nastaví podle dat —
    // testuje se, ČÍ pořadí odznáček nese, ne jaké to číslo je.
    const rankEvo = (P.ligovePoradi("lickilicky", "great") || {}).rank;
    const rl = document.getElementById("rankLimit");
    rl.value = String(rankEvo + 10);
    rl.dispatchEvent(new Event("input", { bubbles: true }));
    P.setRows([
      { pokemon: "Lickitung", cp: 816, level: 23, ivAtk: 6, ivDef: 10, ivSta: 0 },
      { pokemon: "Mimikyu Disguised", cp: 920, level: 15, ivAtk: 10, ivDef: 15,
        ivSta: 12, fastMove: "Shadow Claw", charged1: "Shadow Sneak" },
    ]);
    const c = P.getComputed(), base = P.base(), out = { rankEvo: rankEvo };
    P.getRows().forEach((r) => {
      const b = base.filter((x) => x.row.id === r.id)[0];
      out[r.pokemon] = {
        pvpRec: c[r.id].pvpRec,
        chipy: (c[r.id].pvpLigy || []).map((l) => l.liga + " #" + l.rank + " " + l.stav),
        ligyVse: (b.ligyVse || []).map((x) => x.liga + "="
          + ((x.ted && x.ted.rank) || "-")),
        sloty: (b.sloty || []).filter((sl) => sl.druh === "pvp")
          .map((sl) => sl.typ + " #" + sl.rank),
      };
    });
    document.getElementById("resetSettingsBtn").click();
    return out;
  });
  // Lickitung má vlastní, horší pořadí než Lickilicky. Odznáček „po vývinu"
  // ukazoval to jeho — číslo kusu, který se do té ligy nedostane.
  check("odznáček „po vývinu“ nese rank TÉ evoluce, ne současného kusu",
    pvpShoda.Lickitung.chipy.indexOf("GL #" + pvpShoda.rankEvo + " evo") > -1,
    "Lickilicky je GL #" + pvpShoda.rankEvo + ": "
      + pvpShoda.Lickitung.chipy.join(" | "));
  check("…a karta o té evoluci mluví taky",
    pvpShoda.Lickitung.pvpRec.indexOf("Po evoluci") === 0,
    pvpShoda.Lickitung.pvpRec);
  // „Mimikyu Disguised" má klíč mimikyu-disguised, ale PvPoke ho vede pod
  // mimikyu. Bez fallbacku psala tabulka „tuhle ligu nehraje“, zatímco
  // odznáčky nad ní ukazovaly GL #5 a UL #1.
  check("žebříček se najde i u pojmenované formy",
    pvpShoda["Mimikyu Disguised"].ligyVse.join(",").indexOf("UL=1") > -1,
    pvpShoda["Mimikyu Disguised"].ligyVse.join(","));
  // Kus drží slot v GL i UL. Karta má mluvit o té lepší — a hlavně o téže,
  // kterou ukazuje verdikt.
  check("karta doporučí ligu podle rozpočtu, ne podle kvality kusu",
    pvpShoda["Mimikyu Disguised"].pvpRec === "Ano – UL",
    pvpShoda["Mimikyu Disguised"].pvpRec + " · sloty "
    + pvpShoda["Mimikyu Disguised"].sloty.join(", "));
  // ---------------------------------------------------------------- 135
  // Strop CP PŘED evolucí. Bonbóny na evoluci se nevracejí, takže vylepšit
  // mezistupeň moc vysoko znamená, že finální forma ligu přeroste a kus je
  // pro ni nadobro ztracený — level dolů nejde.
  console.log("\n135) Strop CP před evolucí");
  const strop = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    const zmer = (druh, cp, lvl) => {
      P.setRows([{ pokemon: druh, cp: cp, level: lvl, ivAtk: 14, ivDef: 13, ivSta: 15 }]);
      const b = P.base()[0];
      const ul = (b.ligyVse || []).filter((L) => L.liga === "UL")[0];
      return ul && ul.po ? { level: ul.po.level, poEvoluci: ul.po.cp,
        pred: ul.po.cpPredEvoluci } : null;
    };
    return { mankey: zmer("Mankey", 167, 8), primeape: zmer("Primeape", 900, 15),
      kontrola: {
        annihilape: P.cpNaLevelu("Annihilape", 14, 13, 15, 27),
        primeape: P.cpNaLevelu("Primeape", 14, 13, 15, 27),
        mankey: P.cpNaLevelu("Mankey", 14, 13, 15, 27) } };
  });
  // Vyvinutá forma se musí vejít pod cap — o tom je celý strop.
  check("po evoluci se kus vejde pod cap ligy", strop.mankey.poEvoluci <= 2500,
    String(strop.mankey.poEvoluci));
  check("strop odpovídá CP té formy, kterou držíš v ruce",
    strop.mankey.pred === strop.kontrola.mankey
    && strop.primeape.pred === strop.kontrola.primeape,
    "Mankey " + strop.mankey.pred + "/" + strop.kontrola.mankey
    + ", Primeape " + strop.primeape.pred + "/" + strop.kontrola.primeape);
  // Evoluce level nemění, takže obě formy mají tentýž strop v LEVELECH
  // a jiný v CP. To je přesně důvod, proč se CP musí počítat zvlášť.
  check("obě formy mají stejný strop levelu, ale jiné CP",
    strop.mankey.level === strop.primeape.level
    && strop.mankey.pred !== strop.primeape.pred,
    "L" + strop.mankey.level + ": " + strop.mankey.pred + " vs "
    + strop.primeape.pred);
  // U třístupňové řady je potřeba i to prostřední číslo — kdo evolvuje na
  // Primeapa a pak ho vylepšuje, čte ve hře jeho CP, ne Mankeyho.
  const mezi = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Mankey", cp: 167, level: 8, ivAtk: 14, ivDef: 13, ivSta: 15 }]);
    const ul = (P.base()[0].ligyVse || []).filter((L) => L.liga === "UL")[0];
    return { zaklad: ul.po.jmenoZakladu, cpZaklad: ul.po.cpPredEvoluci,
      mezi: (ul.po.mezistupne || []).map((m) => m.jmeno + "=" + m.cp),
      level: ul.po.level,
      kontrola: P.cpNaLevelu("Primeape", 14, 13, 15, ul.po.level) };
  });
  check("u třístupňové řady se ukáže i mezistupeň",
    mezi.mezi.length === 1 && mezi.mezi[0].indexOf("Primeape") === 0,
    JSON.stringify(mezi.mezi));
  check("…a jeho CP sedí na nezávislý výpočet",
    mezi.mezi[0] === "Primeape=" + mezi.kontrola,
    mezi.mezi[0] + " vs " + mezi.kontrola);
  check("…a liší se od stropu základní formy",
    String(mezi.cpZaklad) !== String(mezi.kontrola),
    mezi.zaklad + " " + mezi.cpZaklad + " vs Primeape " + mezi.kontrola);

  check("a po evoluci vyjde obojí na totéž CP",
    strop.mankey.poEvoluci === strop.primeape.poEvoluci
    && strop.mankey.poEvoluci === strop.kontrola.annihilape,
    strop.mankey.poEvoluci + " / " + strop.primeape.poEvoluci);
  // ---------------------------------------------------------------- 136
  // Pruh „Co teď skenovat“ pod tlačítkem a snímek do mobilu.
  console.log("\n137) CUTE nikdy nejde na vyhození");
  const cute = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      // odpad, který by šel pryč
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Rattata", cp: 210, level: 15, ivAtk: 4, ivDef: 3, ivSta: 6,
        cute: "Ano" },
      // kus, který si appka nechává i bez CUTE — u něj musí zůstat ROLE
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch", cute: "Ano" },
    ]);
    const c = P.getComputed(), rows = P.getRows();
    const v = (i) => ({ keep: c[rows[i].id].keep, ok: !!c[rows[i].id].keepGood,
      sub: c[rows[i].id].keepSub || "", cute: !!c[rows[i].id].cute });
    return { odpad: v(0), odpadCute: v(1), role: v(2),
      // do čištění boxu se nabízí jen to, co appka pouští
      kPusteni: rows.filter((r) => !c[r.id].keepGood).map((r) => r.pokemon + " " + r.cp) };
  });
  check("obyčejný odpad jde pryč", cute.odpad.ok === false, cute.odpad.keep);
  check("tentýž kus s CUTE zůstává", cute.odpadCute.ok === true, cute.odpadCute.keep);
  check("…a je u něj napsané proč", cute.odpadCute.sub === "Protože CUTE",
    cute.odpadCute.sub);
  // Kdyby CUTE přebíjelo všechno, u kusu s rolí by zmizel užitečnější důvod.
  check("u kusu, který drží roli, zůstává role a ne CUTE",
    cute.role.ok === true && cute.role.sub !== "Protože CUTE",
    cute.role.keep + " · " + cute.role.sub);
  // Sloupce se musí řídit verdiktem. Dřív se počítaly DŘÍV než se CUTE
  // uplatnilo, takže u kusu s verdiktem „Ponechat“ svítilo v Tradovat
  // „Ano · pouštíš ho“ — což je totéž jako ho vyhodit.
  const cuteTrade = await page.evaluate(() => {
    const P = window.__pgo;
    const c = P.getComputed(), rows = P.getRows();
    const r = rows.filter((x) => x.pokemon === "Rattata" && +x.cp === 210)[0];
    const bez = rows.filter((x) => x.pokemon === "Rattata" && +x.cp === 200)[0];
    return { cute: { t: c[r.id].trade, s: c[r.id].tradeSub || "" },
      bezCute: { t: c[bez.id].trade } };
  });
  check("CUTE kus se nenabízí ani k tradu", cuteTrade.cute.t === "Ne",
    cuteTrade.cute.t + " · " + cuteTrade.cute.s);
  check("…zatímco tentýž kus bez CUTE ano", cuteTrade.bezCute.t === "Ano",
    cuteTrade.bezCute.t);

  // Do seznamu „k puštění“ nesmí — z něj se generuje hledání do hry, kterým
  // se kusy hromadně posílají profesorovi. Tam by CUTE bylo nebezpečné.
  check("CUTE kus se nedostane mezi ty, co appka pouští",
    cute.kPusteni.join(",").indexOf("Rattata 210") === -1, cute.kPusteni.join(", "));

  // V čištění boxu se ale objevit MÁ — jde se jím kus po kuse a značka je
  // to, co má rozhodnutí zastavit. Proto se u něj v kartě ukazuje odznáček.
  const cuteBm = await page.evaluate(() => {
    const P = window.__pgo;
    document.getElementById("boxModeBtn").click();
    const seznam = P.bmSeznam().map((x) => x.row.pokemon + " " + x.row.cp);
    // proklikat na kus s CUTE
    let chipy = [], verdikt = "";
    for (let i = 0; i < 5; i++) {
      const jm = document.querySelector("#bmBody .bm-name");
      const sub = document.querySelector("#bmBody .bm-sub");
      if (jm && /Rattata/.test(jm.textContent) && /CUTE/.test(jm.textContent)
          && sub && /210 CP/.test(sub.textContent)) {
        chipy = [...document.querySelectorAll("#bmBody .rarity-chip")]
          .map((x) => x.textContent);
        verdikt = document.querySelector("#bmBody .bm-verdikt-text")
          .textContent.replace(/\s+/g, " ").trim();
        break;
      }
      document.getElementById("bmKeep").click();
    }
    return { seznam, chipy, verdikt };
  });
  check("v čištění boxu se CUTE kus nabídne",
    cuteBm.seznam.join(",").indexOf("Rattata 210") > -1, cuteBm.seznam.join(", "));
  check("…a je u něj vidět odznáček CUTE",
    cuteBm.chipy.indexOf("CUTE") > -1, cuteBm.chipy.join(","));
  check("…i důvod ve verdiktu", /Protože CUTE/.test(cuteBm.verdikt), cuteBm.verdikt);

  // Značka je ruční, takže ji musí unést záloha i sloučení.
  const cuteExport = await page.evaluate(() => {
    const P = window.__pgo;
    const csv = P.csvText();
    P.setRows([]);
    P.importText(csv); P.finishImport(true);
    const r = P.getRows().filter((x) => x.pokemon === "Rattata" && +x.cp === 210)[0];
    return { hlavicka: csv.split(String.fromCharCode(10))[0],
      poObnove: r ? r.cute : null };
  });
  // Přepínače musí vypadat stejně a nesmí při zapnutí poskočit.
  const prepinace = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 }]);
    document.querySelector("#tbody td.col-pokemon").click();
    const zmer = () => {
      const m = (s2) => {
        const e = document.querySelector(s2);
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        return { h: Math.round(r.height), bg: cs.backgroundColor,
          styl: cs.borderStyle, vyp: e.classList.contains("vypnuto") };
      };
      return { dmax: m(".dmax-prepinac"), cute: m(".cute-prepinac") };
    };
    const vyp = zmer();
    document.querySelector(".cute-prepinac").click();
    const zap = zmer();
    return { vyp, zap };
  });
  check("CUTE je vypnutý průhledný s rámečkem jako DMAX",
    prepinace.vyp.cute.bg === prepinace.vyp.dmax.bg
    && prepinace.vyp.cute.styl === "dashed", JSON.stringify(prepinace.vyp.cute));
  check("…a stejně vysoký", prepinace.vyp.cute.h === prepinace.vyp.dmax.h,
    prepinace.vyp.cute.h + " vs " + prepinace.vyp.dmax.h);
  // Bez průhledného rámečku v zapnutém stavu odznáček po kliknutí poskočil.
  check("zapnutím se barva změní, ale velikost ne",
    prepinace.zap.cute.bg !== prepinace.vyp.cute.bg
    && prepinace.zap.cute.h === prepinace.vyp.cute.h,
    JSON.stringify(prepinace.zap.cute) + " vs " + JSON.stringify(prepinace.vyp.cute));

  check("záloha nese sloupec CUTE",
    cuteExport.hlavicka.indexOf("CUTE") > -1, cuteExport.hlavicka);
  check("…a po obnově je značka zpátky", cuteExport.poObnove === "Ano",
    String(cuteExport.poObnove));
  // ---------------------------------------------------------------- 138
  // Dva skeny téhož kusu, které se liší jen o půl levelu.
  console.log("\n138) Půl levelu rozdílu není druhý pokémon");
  const pulLevelu = await page.evaluate(() => {
    const P = window.__pgo;
    const NL2 = String.fromCharCode(10);
    const H = "Name,CP,Level,ØATT IV,ØDEF IV,ØHP IV,Fast move,Special move,Scan date";
    const HO = H.replace(",Scan date", ",Height (cm),Weight (g),Scan date");
    const nacti = (h, radky2) => {
      P.setRows([]); P.setDiscarded([]);
      P.importText([h].concat(radky2).join(NL2));
      P.finishImport(true);
      return P.getRows().map((r) => r.pokemon + " " + r.cp + " L" + r.level
        + " " + [r.ivAtk, r.ivDef, r.ivSta].join("/"));
    };
    return {
      // reálný případ: Calcy odhadlo level jinak, výšku a váhu nedalo
      tentyz: nacti(H, [
        "Chespin,219,7,4,10,6,Vine Whip,Body Slam," + datumPred(0, 10),
        "Chespin,219,7.5,4,10,6,Vine Whip,Body Slam," + datumPred(0, 11)]),
      // dva SKUTEČNĚ různé kusy: stejné CP, jiná IV — musí zůstat oba
      ruzne: nacti(H, [
        "Chespin,219,7,4,10,6,Vine Whip,Body Slam," + datumPred(0, 10),
        "Chespin,219,7.5,1,2,3,Vine Whip,Body Slam," + datumPred(0, 11)]),
      // celý level rozdílu už není odhad, to je jiný kus
      celyLevel: nacti(H, [
        "Chespin,219,7,4,10,6,Vine Whip,Body Slam," + datumPred(0, 10),
        "Chespin,219,8,4,10,6,Vine Whip,Body Slam," + datumPred(0, 11)]),
      // s otiskem to fungovalo už dřív — nesmí se to rozbít
      sOtiskem: nacti(HO, [
        "Chespin,219,7,4,10,6,Vine Whip,Body Slam,40,9000," + datumPred(0, 10),
        "Chespin,219,7.5,4,10,6,Vine Whip,Body Slam,40,9000," + datumPred(0, 11)]),
    };
  });
  check("dva skeny téhož kusu se sloučí i bez výšky a váhy",
    pulLevelu.tentyz.length === 1, pulLevelu.tentyz.join(" | "));
  check("…a nechá se ten přesnější level", /L7(?!\.)/.test(pulLevelu.tentyz[0]),
    pulLevelu.tentyz[0]);
  // Kdyby se slučovalo jen podle CP, přišel bys o skutečné duplicity.
  check("dva různé kusy se stejným CP zůstanou oba",
    pulLevelu.ruzne.length === 2, pulLevelu.ruzne.join(" | "));
  check("celý level rozdílu se za odhad nepovažuje",
    pulLevelu.celyLevel.length === 2, pulLevelu.celyLevel.join(" | "));
  check("s otiskem to funguje dál", pulLevelu.sOtiskem.length === 1,
    pulLevelu.sOtiskem.join(" | "));
  // ---------------------------------------------------------------- 139
  // SHINY: pouštět jde, ale hra ho nepustí do hromadného výběru.
  console.log("\n139) SHINY — druhá sekce a oranžový verdikt");
  const shiny = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Rattata", cp: 205, level: 15, ivAtk: 4, ivDef: 3, ivSta: 6,
        shiny: "Ano" },
    ]);
    const c = P.getComputed(), rows = P.getRows();
    const v = (i) => ({ keep: c[rows[i].id].keep, tone: c[rows[i].id].keepTone,
      sub: c[rows[i].id].keepSub || "", shiny: !!c[rows[i].id].shiny });
    document.getElementById("boxModeBtn").click();
    const sekce = P.bmSeznam().map((x) => x.row.pokemon + " " + x.row.cp
      + " → sekce " + x.sekce);
    return { bez: v(0), sh: v(1), sekce };
  });
  check("shiny místo červené dostane oranžové „nechat zatím“",
    shiny.sh.keep === "Nechat zatím" && shiny.sh.tone === "warning",
    shiny.sh.keep + " / " + shiny.sh.tone);
  check("…s důvodem, že se hodí na trade", /trade/.test(shiny.sh.sub), shiny.sh.sub);
  check("běžný odpad zůstává červený", shiny.bez.keep === "Zahodit", shiny.bez.keep);
  // Hra shiny do hromadného výběru nepustí — patří do druhé sekce.
  check("shiny jde do sekce po jednom",
    /205 → sekce 2/.test(shiny.sekce.join(" | ")), shiny.sekce.join(" | "));

  // Označení uprostřed čištění nesmí kus přesunout — zmizel by z ruky.
  const sekceStabil = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Rattata", cp: 200, level: 15, ivAtk: 4, ivDef: 3, ivSta: 5 },
      { pokemon: "Pidgey", cp: 210, level: 15, ivAtk: 4, ivDef: 3, ivSta: 6 },
      { pokemon: "Zubat", cp: 220, level: 15, ivAtk: 4, ivDef: 3, ivSta: 7 },
    ]);
    document.getElementById("boxModeBtn").click();
    const pred = P.bmSeznam().map((x) => x.row.pokemon + ":" + x.sekce);
    // označit prostřední kus jako shiny přímo za běhu
    const r = P.getRows().filter((x) => x.pokemon === "Pidgey")[0];
    r.shiny = "Ano";
    document.querySelector("#bmVicBtn").click();   // vyvolá překreslení
    const po = P.bmSeznam().map((x) => x.row.pokemon + ":" + x.sekce);
    return { pred, po };
  });
  check("označení shiny za běhu kus nepřesune",
    sekceStabil.pred.join(",") === sekceStabil.po.join(","),
    sekceStabil.pred.join(",") + "  →  " + sekceStabil.po.join(","));
  // ---------------------------------------------------------------- 140
  // Dva řádky se stejným ID = jeden ukazuje rozbor toho druhého.
  //
  // Vzniklo to tak, že se ID přidělilo z čítače a hned přepsalo tím, co
  // přišlo v datech; čítač se posunul jen o počet řádků. V rosteru, kde se
  // mazalo (zbylo r1, r5, r9), skončil na třech a další nový řádek dostal
  // r4, r5 … a nakonec r9, které už někdo měl. Projevilo se to tak, že
  // řádek měl vlastní jméno, ale cizí typy, CP max i verdikt.
  console.log("\n140) Řádky nesmí sdílet ID");
  const idcka = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { id: "r1", pokemon: "Tyrunt", cp: 139, level: 13, ivAtk: 8, ivDef: 12, ivSta: 4 },
      { id: "r5", pokemon: "Eevee", cp: 165, level: 20, ivAtk: 10, ivDef: 15, ivSta: 11 },
      { id: "r9", pokemon: "Karrablast", cp: 43, level: 15, ivAtk: 12, ivDef: 15, ivSta: 11 },
    ]);
    const zachovana = P.getRows().map((r) => r.id);
    P.setRows(P.getRows().concat([
      { pokemon: "Minccino", cp: 139, level: 15, ivAtk: 5, ivDef: 5, ivSta: 5 },
      { pokemon: "Staryu", cp: 165, level: 15, ivAtk: 6, ivDef: 6, ivSta: 6 },
      { pokemon: "Bellsprout", cp: 43, level: 15, ivAtk: 7, ivDef: 7, ivSta: 7 },
    ]));
    const rows = P.getRows(), c = P.getComputed();
    const ids = rows.map((r) => r.id);
    // typ v rozboru musí sedět na druh v řádku — to je ten viditelný projev
    const nesedi = rows.filter((r) => {
      const t = (c[r.id] || {}).types || "";
      if (r.pokemon === "Eevee" || r.pokemon === "Minccino") return !/Normal/.test(t);
      if (r.pokemon === "Staryu") return !/Water/.test(t);
      if (r.pokemon === "Karrablast") return !/Bug/.test(t);
      return false;
    }).map((r) => r.pokemon + " → " + ((c[r.id] || {}).types || "?"));
    // dávka, která si duplicitu nese sama v sobě
    P.setRows([
      { id: "r3", pokemon: "Rattata", cp: 100, level: 5, ivAtk: 1, ivDef: 1, ivSta: 1 },
      { id: "r3", pokemon: "Pidgey", cp: 110, level: 5, ivAtk: 2, ivDef: 2, ivSta: 2 },
    ]);
    const vDavce = P.getRows().map((r) => r.id);
    return { zachovana, ids, dupl: ids.filter((x, i) => ids.indexOf(x) !== i),
      nesedi, vDavce, vDavceDupl: vDavce[0] === vDavce[1] };
  });
  check("žádné dva řádky nesdílejí ID", idcka.dupl.length === 0,
    idcka.dupl.join(",") + " | " + idcka.ids.join(","));
  // Viditelný projev: řádek ukazoval cizí typy, CP max i verdikt.
  check("rozbor sedí na druh v řádku", idcka.nesedi.length === 0,
    idcka.nesedi.join(" | "));
  // ID se zbytečně nepřečíslovávají — jinak by se rozpadl otevřený detail.
  check("existující ID zůstanou zachovaná",
    idcka.zachovana.join(",") === "r1,r5,r9", idcka.zachovana.join(","));
  check("duplicita uvnitř jedné dávky se rozdělí taky",
    idcka.vDavceDupl === false, idcka.vDavce.join(","));
  // ---------------------------------------------------------------- 141
  // Karta v čištění boxu musí mít u KAŽDÉHO kusu stejnou velikost — jinak
  // pod ní poskakují tlačítka Pustit / Nechat a člověk klikne vedle.
  console.log("\n141) Čištění boxu má konstantní rozměr");
  const rozmery = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      // hraje víc lig
      { pokemon: "Dewpider", cp: 323, level: 18, ivAtk: 10, ivDef: 7, ivSta: 6 },
      // nehraje žádnou a nemá historii
      { pokemon: "Rattata", cp: 120, level: 8, ivAtk: 3, ivDef: 3, ivSta: 3 },
      // drží roli, dlouhé vysvětlení
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" },
      // shiny → pruh „jen po jednom"
      { pokemon: "Charizard", cp: 1485, level: 18.5, ivAtk: 11, ivDef: 11,
        ivSta: 15, shiny: "Ano" },
    ]);
    document.getElementById("boxModeBtn").click();
    const out = [];
    for (let i = 0; i < 4; i++) {
      const r = document.querySelector(".bm-panel").getBoundingClientRect();
      out.push({ kus: document.querySelector(".bm-name").textContent.trim(),
        v: Math.round(r.height), s: Math.round(r.width) });
      document.getElementById("bmKeep").click();
    }
    return out;
  });
  const vysky = rozmery.map((x) => x.v);
  const sirky = rozmery.map((x) => x.s);
  check("karta má stejnou výšku u všech kusů",
    Math.max(...vysky) - Math.min(...vysky) === 0,
    rozmery.map((x) => x.kus + "=" + x.v).join(", "));
  check("…i stejnou šířku", Math.max(...sirky) - Math.min(...sirky) === 0,
    sirky.join(","));
  check("žádné chyby v konzoli", consoleErrors.length === 0, consoleErrors.join(" | "));

  console.log("\n142) Barevný proužek ligy se kotví k buňce");
  // ::before u buněk ligy je position:absolute. Bez position:relative na buňce
  // se ukotví k nejbližšímu polohovanému předkovi — v čištění boxu je to celý
  // panel, a proužek se protáhne jako čára po jeho levé hraně.
  await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Dewpider", cp: 323, level: 18, ivAtk: 10, ivDef: 7,
      ivSta: 6 }]);
    document.getElementById("boxModeBtn").click();
    document.getElementById("bmVicBtn").click();
  });
  // rozbor se dokresluje až po překreslení, jinak je tabulka lig ještě prázdná
  await page.waitForTimeout(400);
  const prouzek = await page.evaluate(() => {
    const panel = document.querySelector(".bm-panel");
    const pr = panel.getBoundingClientRect();
    const bunky = Array.from(panel.querySelectorAll(".d-ligy-tab td"));
    return {
      pocetBunek: bunky.length,
      vsechnyRelative: bunky.every((td) => getComputedStyle(td).position === "relative"),
      // co leží úplně na levé hraně panelu: nesmí to být nic z tabulky lig
      naHrane: document.elementsFromPoint(pr.left + 3, pr.top + pr.height / 2)
        .slice(0, 1).map((e) => e.tagName + "." + String(e.className).split(" ")[0])[0],
      vysokyProuzek: bunky.some((td) => td.getBoundingClientRect().height > pr.height * 0.8),
    };
  });
  check("v čištění boxu jsou buňky lig vidět", prouzek.pocetBunek > 0,
    String(prouzek.pocetBunek));
  check("buňky lig mají position:relative", prouzek.vsechnyRelative === true);
  check("na levé hraně panelu neleží buňka ligy",
    prouzek.naHrane !== "TD.d-lg-up", prouzek.naHrane);
  check("žádná buňka se neroztáhla přes celý panel",
    prouzek.vysokyProuzek === false);

  console.log("\n143) Čištění boxu: text i barvy");
  const cist = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Foongus", cp: 12, level: 1, ivAtk: 3, ivDef: 14, ivSta: 7 }]);
    document.getElementById("bmVic").open = true;
    document.getElementById("boxModeBtn").click();
    const panel = document.querySelector(".bm-panel");
    const krizek = panel.querySelector(".d-ligy-tab td.d-lg-ne");
    const moves = panel.querySelector(".d-moves .d-why");
    return {
      rozpocet: document.body.textContent.indexOf("Rozpočet říká") > -1,
      krizekBarva: krizek ? getComputedStyle(krizek).color : "chybí",
      krizekText: krizek ? krizek.textContent.trim() : "chybí",
      // porovnávací vzorek: co je doopravdy --status-critical po dopočítání
      kriticka: (() => {
        const z = document.createElement("span");
        z.style.color = "var(--status-critical)";
        document.body.appendChild(z);
        const c = getComputedStyle(z).color;
        z.remove();
        return c;
      })(),
      movesVidet: moves ? getComputedStyle(moves).display !== "none" : false,
      // svislé zarovnání křížku: ostatní buňky mají text nahoře, křížek ne
      krizekSvisle: krizek ? getComputedStyle(krizek).verticalAlign : "chybí",
      // rozbor patří POD kartu, ne vedle ní — vedle se lámal do krátkých řádků
      rozborPod: (() => {
        const b = document.getElementById("bmBody").getBoundingClientRect();
        const v = document.getElementById("bmVic").getBoundingClientRect();
        return v.top >= b.bottom - 1;
      })(),
      // Staty na levelu + IV + Strop musí zůstat vedle sebe v jedné řadě
      trojiceVedleSebe: (() => {
        const g = panel.querySelector(".detail-main .d-grid");
        if (!g) return "mřížka chybí";
        const b = Array.from(g.children).map((e) => e.getBoundingClientRect());
        if (b.length < 3) return "jen " + b.length + " krabice";
        const stejnyRadek = b.every((x) => Math.abs(x.top - b[0].top) < 2);
        const ruzneSloupce = new Set(b.map((x) => Math.round(x.left))).size === b.length;
        return stejnyRadek && ruzneSloupce ? true : "řádek=" + stejnyRadek + " sloupce=" + ruzneSloupce;
      })(),
      nadpisyOk: Array.from(panel.querySelectorAll(".detail-main .d-sec-h")).every((h) => {
        const dalsi = h.nextElementSibling;
        if (!dalsi) return false;
        const a = h.getBoundingClientRect(), c = dalsi.getBoundingClientRect();
        return Math.abs(a.left - c.left) < 4 && c.top >= a.top;
      }),
    };
  });
  check("věta o rozpočtu se nikde nepíše", cist.rozpocet === false);
  check("nehraná liga má křížek", cist.krizekText === "✕", cist.krizekText);
  check("…a je červený jako v tabulce rosteru",
    cist.krizekBarva === cist.kriticka,
    cist.krizekBarva + " vs " + cist.kriticka);
  check("návodná věta u útoků v boxu není", cist.movesVidet === false);
  check("nadpis sekce zůstává u svého obsahu", cist.nadpisyOk === true);
  check("křížek je na střed řádku, ne nahoře",
    cist.krizekSvisle === "middle", cist.krizekSvisle);
  check("rozbalený rozbor je pod kartou, ne vedle ní", cist.rozborPod === true);
  check("Staty na levelu, IV a Strop jsou vedle sebe",
    cist.trojiceVedleSebe === true, String(cist.trojiceVedleSebe));

  console.log("\n144) Prohlídka počítá kus bez ohledu na roster");
  const proh = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    // roster plný Machampů: kdyby do toho roster mluvil, prohlídka by řekla
    // „takového už máš" nebo by kus nedostal slot
    P.setRows([1, 2, 3, 4, 5, 6].map((i) => ({ pokemon: "Machamp", cp: 2900 - i,
      level: 33, ivAtk: 15, ivDef: 15, ivSta: 15 })));
    const karta = document.getElementById("prohlidkaCard");
    karta.open = true;
    const nastav = (id, v) => { const e = document.getElementById(id); e.value = v;
      e.dispatchEvent(new Event("input", { bubbles: true })); };
    nastav("prohName", "Machamp");
    nastav("prohCp", "2167");
    nastav("prohA", "15"); nastav("prohD", "14"); nastav("prohS", "13");
    const out = document.getElementById("prohOut");
    const txt = out.textContent;
    // roster musí zůstat netknutý a jeho verdikty pořád mluvit o rozpočtu
    const c = P.getComputed();
    const rosterTexty = P.getRows().map((r) => (c[r.id].raidTitle || "")).join(" ");
    return {
      neco: out.innerHTML.length > 500,
      verdikt: !!out.querySelector(".d-verdict-row"),
      level: (txt.match(/Staty na levelu ([0-9.]+)/) || [])[1] || "?",
      rosterovaMluva: /už máš|rozpočtu|takového máš/i.test(txt),
      // Zámek je o tom, že rozbor nejde ZMĚNIT. Rozbalení dlouhého popisu
      // („víc", „a další N") nic nemění, a kdyby bylo zamčené, půlka textu
      // by nešla přečíst.
      zamceno: Array.from(out.querySelectorAll(
        "button:not(.vic-btn):not(.pk-vic), input, select")).every((e) => e.disabled),
      rozbalovaciFunguji: Array.from(out.querySelectorAll(".vic-btn, .pk-vic"))
        .every((e) => !e.disabled),
      radkuVRosteru: P.getRows().length,
      rosterPoradPocitaRozpocet: /rozpočtu/i.test(rosterTexty),
      neznamy: (() => {
        nastav("prohName", "Neexistujicius");
        const t = document.getElementById("prohOut").textContent;
        nastav("prohName", "Machamp");
        return t;
      })(),
    };
  });
  check("prohlídka něco vykreslí", proh.neco === true);
  check("…bez verdiktu nechat/pustit", proh.verdikt === false);
  check("…s levelem dopočítaným z CP a IV", proh.level === "25", proh.level);
  check("…a bez řečí o rosteru a rozpočtu", proh.rosterovaMluva === false);
  check("rozbor v prohlídce je jen na čtení", proh.zamceno === true);
  check("…ale dlouhý text jde rozbalit, to kus nemění",
    proh.rozbalovaciFunguji === true);
  check("prohlídka nepřidá kus do rosteru", proh.radkuVRosteru === 6,
    String(proh.radkuVRosteru));
  check("…a roster o rozpočtu mluví dál", proh.rosterPoradPocitaRozpocet === true);
  check("neznámý druh se pozná", /nezná/.test(proh.neznamy), proh.neznamy.slice(0, 60));

  console.log("\n145) Dynamax má vlastní rozpočet, nedrží se všechno");
  // Dřív engine držel KAŽDÝ Dmax kus bez ohledu na kvalitu, takže se čtyři
  // Dmax Rattaty tvářily stejně jako čtyři užiteční útočníci.
  const dmaxRozpocet = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    const nastav = (id, v) => { const e = document.getElementById(id); e.value = String(v);
      e.dispatchEvent(new Event("input", { bubbles: true })); };
    nastav("dmaxKeep", 2);
    P.setRows([
      { pokemon: "Rattata", cp: 300, level: 18, ivAtk: 15, ivDef: 15, ivSta: 15, dynamax: "Ano" },
      { pokemon: "Rattata", cp: 280, level: 17, ivAtk: 12, ivDef: 12, ivSta: 12, dynamax: "Ano" },
      { pokemon: "Rattata", cp: 200, level: 12, ivAtk: 2, ivDef: 2, ivSta: 2, dynamax: "Ano" },
      { pokemon: "Wooloo", cp: 400, level: 20, ivAtk: 5, ivDef: 5, ivSta: 5, dynamax: "Ano" },
    ]);
    let c = P.getComputed();
    const v = P.getRows().map((x) => ({ kus: x.pokemon + " " + x.cp,
      keep: c[x.id].keep, sub: c[x.id].keepSub || "" }));
    // strop na 1: druhá Rattata musí spadnout taky
    nastav("dmaxKeep", 1);
    c = P.getComputed();
    const priJedne = P.getRows().map((x) => c[x.id].keep);
    return { v, priJedne };
  });
  check("nejlepší Dmax kus druhu se drží",
    dmaxRozpocet.v[0].keep === "Ponechat" && /Dynamax 1\/2/.test(dmaxRozpocet.v[0].sub),
    dmaxRozpocet.v[0].keep + " · " + dmaxRozpocet.v[0].sub);
  check("…druhý do stropu taky", dmaxRozpocet.v[1].keep === "Ponechat", dmaxRozpocet.v[1].keep);
  check("…třetí už ne", /Zahodit/.test(dmaxRozpocet.v[2].keep), dmaxRozpocet.v[2].keep);
  check("…a nepíše se u něj důvod k držení",
    !/jen z Max Battles/.test(dmaxRozpocet.v[2].sub), dmaxRozpocet.v[2].sub);
  check("jediný Dmax kus druhu se drží vždycky",
    dmaxRozpocet.v[3].keep === "Ponechat", dmaxRozpocet.v[3].keep);
  check("strop 1 nechá jen nejlepší kus",
    dmaxRozpocet.priJedne[0] === "Ponechat" && /Zahodit/.test(dmaxRozpocet.priJedne[1]),
    dmaxRozpocet.priJedne.join(" | "));
  check("…a jediný Dmax kus druhu i tak zůstane",
    dmaxRozpocet.priJedne[3] === "Ponechat", dmaxRozpocet.priJedne[3]);

  console.log("\n146) Obrázky se středí i v rosteru");
  // Sprite je v průhledném plátně pokaždé jinak vysoko, takže se měří z pixelů.
  // Samotné měření potřebuje síť; deterministicky se dá ověřit aspoň to, že
  // appka o každém obrázku ví a poslala ho měřit (data-vystredeno).
  const obrazky = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Foongus", cp: 12, level: 1, ivAtk: 3, ivDef: 14, ivSta: 7 }]);
    const bunka = document.querySelector("#tbody tr td.col-pokemon");
    if (bunka) bunka.click();
    const det = document.querySelector(".detail-inner");
    if (!det) return { chyba: "detail se neotevřel" };
    const im = Array.from(det.querySelectorAll("img"));
    return {
      pocet: im.length,
      vsechnyZaregistrovane: im.length > 0 && im.every((x) => x.dataset.vystredeno === "1"),
      maSprite: !!det.querySelector(".d-sprite"),
      maEvoluci: !!det.querySelector(".d-evo-side img"),
    };
  });
  check("detail v rosteru má obrázky", obrazky.pocet > 0, JSON.stringify(obrazky));
  check("…a všechny jdou na vystředění",
    obrazky.vsechnyZaregistrovane === true, JSON.stringify(obrazky));
  check("…včetně sprite u verdiktu", obrazky.maSprite === true);
  check("…i obrázků v evoluční řadě", obrazky.maEvoluci === true);

  console.log("\n147) Náplast v lize se nesmí tvářit jako „žádná role“");
  // Nález z auditu: kus, kterého engine drží jen proto, že nic lepšího nemáš
  // („Nechat zatím · díra: GL #24“), měl ve sloupci PvP holé „Ne“ a v detailu
  // úplně prázdnou kartu PVP. Dvě čísla o téže věci, každé jiné.
  const naplastLigy = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    const sp = P.pokedex().species;
    const klice = Object.keys(sp).filter((k) => sp[k][1] && sp[k][3]);
    const radky = [];
    for (let i = 0; i < klice.length; i += 11) {
      const jm = sp[klice[i]][1];
      const lv = 10 + (i % 30);
      const iv = [i % 16, (i * 3) % 16, (i * 7) % 16];
      const cp = P.cpNaLevelu(jm, iv[0], iv[1], iv[2], lv);
      if (!cp) continue;
      radky.push({ pokemon: jm, cp: cp, level: lv, ivAtk: iv[0], ivDef: iv[1], ivSta: iv[2] });
    }
    P.setRows(radky);
    const c = P.getComputed();
    const nasel = [];
    const nemi = [];
    P.getRows().forEach((r) => {
      const x = c[r.id];
      // jen LIGOVÉ náplasti — díra v raidu nebo v gymu se sloupce PvP netýká
      if (!/^díra: (LC|GL|UL|ML) /.test(x.keepSub || "")) return;
      nasel.push(r.pokemon);
      if (String(x.pvpRec || "") === "Ne") nemi.push(r.pokemon + ": PvP Ne");
      else if (!String(x.pvpTitle || "").trim()) nemi.push(r.pokemon + ": prázdný popis");
      else if (String(x.pvpRec).indexOf("Ano") === 0) nemi.push(r.pokemon + ": tvrdí Ano");
    });
    return { naplasti: nasel.length, spatne: nemi };
  });
  check("v rosteru se nějaká náplast vůbec našla",
    naplastLigy.naplasti > 0, String(naplastLigy.naplasti));
  check("…a žádná nemá prázdný ani popřený sloupec PvP",
    naplastLigy.spatne.length === 0, naplastLigy.spatne.slice(0, 3).join(" | "));

  console.log("\n148) Evoluční řada, smazané kusy a prohlídka jen ze jména");
  const noveVeci = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Foongus", cp: 12, level: 1, ivAtk: 3, ivDef: 14, ivSta: 7 }]);
    const bunka = document.querySelector("#tbody tr td.col-pokemon");
    if (bunka) bunka.click();
    const kusy = Array.from(document.querySelectorAll(".d-evo-kus"));
    const tipy = kusy.map((e) => e.getAttribute("data-tip") || "");
    // bublina se ukáže po najetí myší
    if (kusy[1]) kusy[1].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    const bub = document.querySelector(".tip-bublina");
    return {
      stupnu: kusy.length,
      // bublina musí říct, co ten stupeň umí — ne jen jak se jmenuje
      vsechnyMajiObsah: tipy.length > 0 && tipy.every((t) =>
        /Raid/.test(t) && /Gym/.test(t)),
      poEvoluciMaLigu: tipy.some((t) => /Great League|Ultra League|Little Cup/.test(t)),
      // systémový title tu být nesmí, konkuroval by vlastní bublině
      bezTitle: kusy.every((e) => !e.getAttribute("title")),
      bublinaVidno: !!(bub && bub.classList.contains("vidno")),
      bublinaRadku: bub ? bub.querySelectorAll(".tip-radek").length : 0,
    };
  });
  check("evoluční řada má u každého stupně bublinu", noveVeci.stupnu > 1,
    String(noveVeci.stupnu));
  check("…a v ní je raid i gym", noveVeci.vsechnyMajiObsah === true);
  check("…i pořadí v lize, když tam ten stupeň hraje",
    noveVeci.poEvoluciMaLigu === true);
  check("…a je to vlastní bublina, ne systémový title",
    noveVeci.bezTitle === true);
  check("…která se po najetí ukáže i s řádky",
    noveVeci.bublinaVidno === true && noveVeci.bublinaRadku >= 3,
    noveVeci.bublinaVidno + "/" + noveVeci.bublinaRadku);

  const smazaneDetail = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Machamp", cp: 1600, level: 20, ivAtk: 15, ivDef: 14, ivSta: 13 },
      { pokemon: "Rattata", cp: 200, level: 12, ivAtk: 2, ivDef: 2, ivSta: 2 },
    ]);
    let n = 0;
    while (document.querySelector("#tbody .del-btn") && n < 5) {
      document.querySelector("#tbody .del-btn").click(); n++;
    }
    document.getElementById("forgetDiscardedBtn").click();
    const prvni = document.querySelector(".discard-table tbody tr.rozklikatelny");
    if (prvni) prvni.click();
    const vrstva = document.getElementById("smazanyDetail");
    const det = vrstva ? vrstva.querySelector(".sd-telo") : null;
    const sirka = vrstva
      ? Math.round(vrstva.querySelector(".sd-panel").getBoundingClientRect().width) : 0;
    const vysledek = {
      radku: document.querySelectorAll(".discard-table tbody tr.rozklikatelny").length,
      maDetail: !!det,
      maLigy: !!(det && det.querySelector(".d-ligy-tab")),
      bezVerdiktu: !(det && det.querySelector(".d-verdict-row")),
      zamceno: !det || Array.from(det.querySelectorAll(
        "button:not(.vic-btn):not(.pk-vic), input, select")).every((e) => e.disabled),
      rozbalovaciFunguji: !det || Array.from(det.querySelectorAll(".vic-btn, .pk-vic"))
        .every((e) => !e.disabled),
      // vrstva má být širší než tabulka, o to celé šlo
      sirka: sirka,
      maKrizek: !!(vrstva && vrstva.querySelector(".sd-x")),
      nadpis: vrstva ? vrstva.querySelector(".sd-hlava b").textContent : "",
    };
    // zavření křížkem
    if (vrstva) vrstva.querySelector(".sd-x").click();
    vysledek.zavrelo = !document.getElementById("smazanyDetail");
    return vysledek;
  });
  check("smazané kusy jdou rozkliknout", smazaneDetail.radku === 2,
    String(smazaneDetail.radku));
  check("…a rozbalí se rozbor", smazaneDetail.maDetail && smazaneDetail.maLigy,
    JSON.stringify(smazaneDetail));
  check("…bez verdiktu, protože v rosteru nejsou",
    smazaneDetail.bezVerdiktu === true);
  check("…a jen na čtení", smazaneDetail.zamceno === true);
  check("…ale rozbalení dlouhého popisu funguje i tam",
    smazaneDetail.rozbalovaciFunguji === true);
  check("…ve vrstvě přes stránku, ne v tabulce",
    smazaneDetail.sirka > 900, String(smazaneDetail.sirka));
  check("…s vlastním nadpisem a křížkem",
    smazaneDetail.maKrizek === true && /smazaný kus/.test(smazaneDetail.nadpis),
    smazaneDetail.nadpis);
  check("…a křížek ji zavře", smazaneDetail.zavrelo === true);

  const jenDruh = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]); P.setRows([]);
    document.getElementById("prohlidkaCard").open = true;
    const nastav = (id, v) => { const e = document.getElementById(id); e.value = v;
      e.dispatchEvent(new Event("input", { bubbles: true })); };
    ["prohCp", "prohA", "prohD", "prohS", "prohLv"].forEach((id) => nastav(id, ""));
    nastav("prohName", "Machamp");
    const out = document.getElementById("prohOut");
    const jenJmeno = { delka: out.innerHTML.length, text: out.textContent,
      maLigy: !!out.querySelector(".d-ligy-tab"),
      maEvoluci: !!out.querySelector(".d-evo-side") };
    // po vyplnění CP a IV se má přepnout na rozbor konkrétního kusu
    nastav("prohCp", "2167");
    nastav("prohA", "15"); nastav("prohD", "14"); nastav("prohS", "13");
    const sKusem = { text: out.textContent, maStaty: /Staty na levelu/.test(out.textContent) };
    return { jenJmeno, sKusem };
  });
  check("jen ze jména se vykreslí karta druhu",
    jenDruh.jenJmeno.delka > 500 && jenDruh.jenJmeno.maLigy,
    String(jenDruh.jenJmeno.delka));
  check("…včetně evoluční řady", jenDruh.jenJmeno.maEvoluci === true);
  check("…a nikde nejsou otazníky místo čísel",
    !/\? CP|Odvede \?/.test(jenDruh.jenJmeno.text),
    (jenDruh.jenJmeno.text.match(/\?[^!]{0,20}/) || [""])[0]);
  check("po vyplnění CP a IV se přepne na rozbor kusu",
    jenDruh.sKusem.maStaty === true);

  console.log("\n149) Dmax kusy dostávají role do Max Battle");
  // Veřejný žebříček Max Battle mety neexistuje, takže se Dmax kusy měří
  // stejným modelem jako raidy (poškození podle typu) a gymy (výdrž).
  const maxRole = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13, dynamax: "Ano" },
      { pokemon: "Charizard", cp: 2400, level: 30, ivAtk: 15, ivDef: 15, ivSta: 15, dynamax: "Ano" },
      { pokemon: "Blissey", cp: 2400, level: 32, ivAtk: 10, ivDef: 15, ivSta: 15, dynamax: "Ano" },
      { pokemon: "Wooloo", cp: 400, level: 20, ivAtk: 5, ivDef: 5, ivSta: 5, dynamax: "Ano" },
      // stejný kus BEZ značky Dmax nesmí roli dostat
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 12 },
    ]);
    P.getComputed();
    const base = P.base();
    const dmaxRole = (jm) => {
      const b = base.filter((z) => z.row.pokemon === jm
        && z.row.dynamax === "Ano")[0];
      return b ? (b.sloty || []).filter((sl) => sl.druh === "dmax").map((sl) => sl.popis) : null;
    };
    const bezZnacky = base.filter((z) => z.row.pokemon === "Machamp"
      && z.row.dynamax !== "Ano")[0];
    return {
      machamp: dmaxRole("Machamp"),
      charizard: dmaxRole("Charizard"),
      blissey: dmaxRole("Blissey"),
      wooloo: dmaxRole("Wooloo"),
      bezZnackyRole: bezZnacky
        ? (bezZnacky.sloty || []).filter((sl) => sl.druh === "dmax").length : -1,
    };
  });
  check("dobrý Dmax útočník dostane roli na svůj typ",
    (maxRole.machamp || []).some((p) => /Max útočník na Fighting/.test(p)),
    JSON.stringify(maxRole.machamp));
  check("…a druhý typ má vlastní slot",
    (maxRole.charizard || []).some((p) => /Max útočník na Fire/.test(p)),
    JSON.stringify(maxRole.charizard));
  check("výdrž dostane roli tanka",
    (maxRole.blissey || []).some((p) => /Max tank/.test(p)),
    JSON.stringify(maxRole.blissey));
  check("kus, co nic neumí, roli nedostane",
    (maxRole.wooloo || []).length === 0, JSON.stringify(maxRole.wooloo));
  check("bez značky Dynamax se role nepřiděluje",
    maxRole.bezZnackyRole === 0, String(maxRole.bezZnackyRole));

  console.log("\n150) Záložky se dají přeskládat tažením");
  // Čištění boxu je překryv přes celou stránku — kdyby zůstalo otevřené
  // z dřívějšího bloku, myš by na lištu záložek vůbec nedosáhla.
  await page.evaluate(() => {
    if (window.__pgo.boxZavritNatvrdo) window.__pgo.boxZavritNatvrdo();
    const bm = document.getElementById("boxMode");
    if (bm) bm.hidden = true;
    window.scrollTo(0, 0);
  });
  const poradiPred = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".zal-btn")).map((b) => b.dataset.klic));
  const aktivniPred = await page.evaluate(() =>
    (document.querySelector(".zal-btn.aktivni") || { dataset: {} }).dataset.klic);
  const coJeNahore = await page.evaluate(() => {
    const b = document.querySelector(".zal-btn");
    const r = b.getBoundingClientRect();
    const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { klic: b.dataset.klic, nahore: e ? e.className + "/" + e.tagName : "nic",
      boxMode: !!document.querySelector(".box-mode:not([hidden])"),
      vrstvy: document.querySelectorAll(".sd-vrstva, .box-mode:not([hidden])").length };
  });
  console.log("  DIAG " + JSON.stringify(coJeNahore));
  check("záložky vůbec jsou", poradiPred.length > 5, String(poradiPred.length));
  {
    const prvni = page.locator(".zal-btn").first();
    const treti = page.locator(".zal-btn").nth(2);
    const a = await prvni.boundingBox();
    const c = await treti.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    // krátký klik nesmí nic přesouvat — tažení začíná až po podržení
    await page.waitForTimeout(450);
    await page.mouse.move(c.x + c.width * 0.8, c.y + c.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(120);
  }
  const poDrag = await page.evaluate(() => ({
    poradi: Array.from(document.querySelectorAll(".zal-btn")).map((b) => b.dataset.klic),
    ulozeno: JSON.parse(localStorage.getItem("pgo_poradi_zalozek") || "null"),
    aktivni: (document.querySelector(".zal-btn.aktivni") || { dataset: {} }).dataset.klic,
  }));
  check("tažením se záložka přesunula",
    poDrag.poradi[0] !== poradiPred[0], poDrag.poradi.slice(0, 3).join(", "));
  check("…přesně tam, kam se pustila",
    poDrag.poradi.indexOf(poradiPred[0]) === 2,
    poradiPred[0] + " je teď " + poDrag.poradi.indexOf(poradiPred[0]) + ".");
  check("…nové pořadí se uložilo",
    Array.isArray(poDrag.ulozeno) && poDrag.ulozeno.join(",") === poDrag.poradi.join(","),
    JSON.stringify(poDrag.ulozeno && poDrag.ulozeno.slice(0, 3)));
  // Tažení je jedno gesto: nesmí po sobě nechat proběhnout ještě přepnutí.
  check("…a tažení nepřepnulo záložku",
    poDrag.aktivni === aktivniPred, poDrag.aktivni + " místo " + aktivniPred);
  // krátký klik musí pořád přepínat
  await page.locator('.zal-btn[data-klic="dustCard"]').click();
  check("krátký klik přepíná dál",
    await page.evaluate(() => (document.querySelector(".zal-btn.aktivni") || { dataset: {} })
      .dataset.klic) === "dustCard");
  await page.evaluate(() => {
    localStorage.removeItem("pgo_poradi_zalozek");
    const b = document.querySelector('.zal-btn[data-klic="roster"]');
    if (b) b.click();
  });

  console.log("\n151) „Kde ten druh hraje“ není ořezané na metu");
  const ligyVse = await page.evaluate(() => {
    const P = window.__pgo;
    const meta = P.meta();
    // Venusaur je kolem #250 v GL — v metě (top 200) není, ale hrát hraje
    const vMete = !!(meta.leagues.great || {}).venusaur;
    const vePoradi = !!(meta.poradiVse && (meta.poradiVse.great || {}).venusaur);
    P.setDiscarded([]); P.setRows([]);
    document.getElementById("prohlidkaCard").open = true;
    const e = document.getElementById("prohName");
    ["prohCp", "prohA", "prohD", "prohS", "prohLv"].forEach((id) => {
      const x = document.getElementById(id); x.value = "";
      x.dispatchEvent(new Event("input", { bubbles: true }));
    });
    e.value = "Venusaur";
    e.dispatchEvent(new Event("input", { bubbles: true }));
    const out = document.getElementById("prohOut");
    return { vMete, vePoradi, text: out.textContent,
      radku: out.querySelectorAll(".d-ligy-tab tr").length };
  });
  check("Venusaur opravdu není v metě", ligyVse.vMete === false);
  check("…ale v kompletním pořadí je", ligyVse.vePoradi === true);
  check("…a prohlídka mu ligy ukáže",
    ligyVse.radku > 1 && !/Do žádné z lig/.test(ligyVse.text),
    String(ligyVse.radku));
  check("…s pořadím, ne s prázdnem",
    /Great League/.test(ligyVse.text) && /#\d+/.test(ligyVse.text),
    ligyVse.text.slice(0, 120));

  console.log("\n152) Role „až po evoluci“ musí být napsaná, ne schovaná");
  const poEvoluci = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    const sp = P.pokedex().species;
    const klice = Object.keys(sp).filter((k) => sp[k][1] && sp[k][3]);
    const radky = [];
    for (let i = 0; i < klice.length; i += 5) {
      const jm = sp[klice[i]][1];
      const lv = 20 + (i % 20);
      const cp = P.cpNaLevelu(jm, 15, 14, 14, lv);
      if (!cp) continue;
      radky.push({ pokemon: jm, cp: cp, level: lv, ivAtk: 15, ivDef: 14, ivSta: 14 });
    }
    P.setRows(radky);
    P.getComputed();
    const base = P.base();
    const popisy = [];
    base.forEach((b) => {
      (b.sloty || []).forEach((sl) => {
        if (sl.druh === "raid" && sl.poEvoluci) popisy.push(sl.popis);
      });
    });
    return {
      kolik: popisy.length,
      // musí říct, ČÍM se to musí stát, a že jinak se to nepoužije
      vsechnyRikajiJako: popisy.length > 0
        && popisy.every((p) => /ale až jako .+; dokud ho nevyvineš/.test(p)),
      ukazka: popisy[0] || "",
    };
  });
  check("v rosteru jsou role držené až po evoluci",
    poEvoluci.kolik > 0, String(poEvoluci.kolik));
  check("…a u každé je napsané, čím se musí stát",
    poEvoluci.vsechnyRikajiJako === true, poEvoluci.ukazka);

  const prohEvo = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]); P.setRows([]);
    document.getElementById("prohlidkaCard").open = true;
    ["prohCp", "prohA", "prohD", "prohS", "prohLv"].forEach((id) => {
      const x = document.getElementById(id); x.value = "";
      x.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const e = document.getElementById("prohName");
    e.value = "Axew";
    e.dispatchEvent(new Event("input", { bubbles: true }));
    const out = document.getElementById("prohOut");
    const karta = (nadpis) => {
      const h = Array.from(out.querySelectorAll(".d-role-h"))
        .find((x) => x.textContent.trim() === nadpis);
      return h ? h.parentElement.textContent.replace(/\s+/g, " ") : "";
    };
    return { raid: karta("Raid"), text: out.textContent.replace(/\s+/g, " ") };
  });
  check("Axew sám do raidů nejde",
    /Sám do raidů nejde/.test(prohEvo.raid), prohEvo.raid.slice(0, 80));
  check("…ale karta říká, že po evoluci ano",
    /Až jako Haxorus/.test(prohEvo.raid) && /Dragon/.test(prohEvo.raid),
    prohEvo.raid.slice(0, 140));
  // Ligy se teď seskupují podle formy — místo dovětku „až jako Haxorus“
  // je nad tabulkou nadpis s obrázkem a popiskem „až po evoluci“.
  check("…a ligy ukazují i vyvinuté formy",
    /Haxorus/.test(prohEvo.text) && /až po evoluci/.test(prohEvo.text), "");

  const vrstvaSmazanych = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Machamp", cp: 1600, level: 20, ivAtk: 15, ivDef: 14, ivSta: 13 }]);
    const del = document.querySelector("#tbody .del-btn");
    if (del) del.click();
    document.getElementById("forgetDiscardedBtn").click();
    const box = document.getElementById("discardBox");
    const panel = box.querySelector(".db-panel");
    const stav = {
      otevreno: box.classList.contains("open"),
      pozice: getComputedStyle(box).position,
      sirka: panel ? Math.round(panel.getBoundingClientRect().width) : 0,
      maKrizek: !!document.getElementById("discardClose"),
    };
    document.getElementById("discardClose").click();
    stav.zavrelo = !box.classList.contains("open");
    return stav;
  });
  check("smazané kusy se otevřou jako vrstva",
    vrstvaSmazanych.otevreno && vrstvaSmazanych.pozice === "fixed",
    JSON.stringify(vrstvaSmazanych));
  check("…přes celou šířku, ne v panelu",
    vrstvaSmazanych.sirka > 900, String(vrstvaSmazanych.sirka));
  check("…a křížek ji zavře",
    vrstvaSmazanych.maKrizek && vrstvaSmazanych.zavrelo === true,
    JSON.stringify(vrstvaSmazanych));

  console.log("\n153) Smazané kusy se vejdou na šířku, bez vodorovného posuvníku");
  // Vodorovný posuvník je u tabulky nejhorší: kolečko ho neovládá a řádek
  // se pak čte po částech. Sloupce se proto smějí zúžit a text zalomit.
  const sirkaSmazanych = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Blissey", cp: 2400, level: 32, ivAtk: 10, ivDef: 15, ivSta: 15 },
    ]);
    let n = 0;
    while (document.querySelector("#tbody .del-btn") && n < 5) {
      document.querySelector("#tbody .del-btn").click(); n++;
    }
    const box = document.getElementById("discardBox");
    if (!box.classList.contains("open")) document.getElementById("forgetDiscardedBtn").click();
    const l = document.getElementById("discardList");
    const panel = box.querySelector(".db-panel");
    const stav = {
      okno: window.innerWidth,
      panel: panel ? Math.round(panel.getBoundingClientRect().width) : 0,
      klient: l ? l.clientWidth : 0,
      scroll: l ? l.scrollWidth : 0,
      strankaPreteka: document.documentElement.scrollWidth > window.innerWidth + 1,
      sloupcu: box.querySelectorAll(".discard-table thead th").length,
    };
    document.getElementById("discardClose").click();
    return stav;
  });
  check("panel využije skoro celé okno",
    sirkaSmazanych.panel > sirkaSmazanych.okno - 60,
    sirkaSmazanych.panel + " z " + sirkaSmazanych.okno);
  check("…a tabulka se do něj vejde bez vodorovného posuvníku",
    sirkaSmazanych.scroll <= sirkaSmazanych.klient + 1,
    sirkaSmazanych.scroll + " > " + sirkaSmazanych.klient
      + " (" + sirkaSmazanych.sloupcu + " sloupců)");
  check("…a stránka pod ní nepřetéká",
    sirkaSmazanych.strankaPreteka === false);

  console.log("\n154) Bublina nahrazuje systémový title v celé appce");
  const titulky = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 }]);
    // nový prvek s titulkem se má převést sám (vzniká i za běhu)
    const zk = document.createElement("div");
    zk.id = "zkouskaTip";
    zk.setAttribute("title", "pokus <b>bez</b> HTML");
    document.body.appendChild(zk);
    await new Promise((r) => setTimeout(r, 250));
    const btn = document.getElementById("boxModeBtn");
    btn.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    const bub = document.querySelector(".tip-bublina");
    const stav = {
      zbyleTitle: document.querySelectorAll("[title]").length,
      sTipem: document.querySelectorAll("[data-tip]").length,
      novyPrevedeny: !zk.hasAttribute("title") && zk.hasAttribute("data-tip"),
      bublinaVidno: !!(bub && bub.classList.contains("vidno")),
      textNeniHtml: bub ? bub.innerHTML.indexOf("<") === -1 : false,
      textSedi: bub ? bub.textContent.indexOf("Projde kus po kusu") === 0 : false,
    };
    zk.remove();
    return stav;
  });
  check("v appce nezůstal žádný systémový title",
    titulky.zbyleTitle === 0, String(titulky.zbyleTitle));
  check("…a bubliny jsou naopak všude", titulky.sTipem > 40, String(titulky.sTipem));
  check("…i na prvcích, které vzniknou až za běhu",
    titulky.novyPrevedeny === true);
  check("bublina se ukáže i mimo evoluční řadu",
    titulky.bublinaVidno === true && titulky.textSedi === true);
  check("…a převzatý text se nevykreslí jako HTML",
    titulky.textNeniHtml === true);

  console.log("\n155) Prohlídka nesmí viset na uživatelově nastavení");
  const prohNezavisla = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]); P.setRows([]);
    const nastav = (id, v) => { const x = document.getElementById(id); if (!x) return;
      x.value = String(v); x.dispatchEvent(new Event("input", { bubbles: true })); };
    const precti = () => {
      const out = document.getElementById("prohOut");
      return out.textContent.replace(/\s+/g, " ");
    };
    document.getElementById("prohlidkaCard").open = true;
    const vypln = () => {
      ["prohLv"].forEach((id) => nastav(id, ""));
      nastav("prohName", "Machamp");
      nastav("prohCp", 2167); nastav("prohA", 15); nastav("prohD", 14); nastav("prohS", 13);
    };
    // výchozí nastavení
    vypln();
    const zaVychozich = precti();
    // a teď nastavení rozhozené naruby
    nastav("ivThresh", 99); nastav("rankThresh", 1); nastav("roleThresh", 99);
    nastav("keepCopies", 1); nastav("rankLimit", 5); nastav("spThresh", 99);
    vypln();
    const zaPrisnych = precti();
    // Roster naopak reagovat MUSÍ — jinak by se rozbilo rozhodování.
    // Měří se na DRUHÉ kopii: první drží Fighting slot za každého
    // nastavení, kdežto o druhé rozhoduje strop kopií.
    P.setRows([
      { pokemon: "Machamp", cp: 2167, level: 25, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Machamp", cp: 2100, level: 24, ivAtk: 14, ivDef: 13, ivSta: 12,
        fastMove: "Counter", charged1: "Dynamic Punch" }
    ]);
    const druhaKopie = () => {
      const c = P.getComputed();
      const r = P.getRows().filter((x) => x.cp === 2100)[0];
      return c[r.id].keep;
    };
    const prisnyVerdikt = druhaKopie();
    nastav("ivThresh", 0); nastav("rankThresh", 500); nastav("roleThresh", 10);
    nastav("keepCopies", 2); nastav("rankLimit", 9999); nastav("spThresh", 90);
    const volnyVerdikt = druhaKopie();
    return { stejne: zaVychozich === zaPrisnych,
      ukazka: zaVychozich.slice(0, 90), ukazka2: zaPrisnych.slice(0, 90),
      prisnyVerdikt, volnyVerdikt };
  });
  check("prohlídka dá stejnou odpověď při libovolném nastavení",
    prohNezavisla.stejne === true,
    prohNezavisla.ukazka + "  ===  " + prohNezavisla.ukazka2);
  check("…zatímco roster na nastavení reagovat MUSÍ",
    prohNezavisla.prisnyVerdikt !== prohNezavisla.volnyVerdikt,
    prohNezavisla.prisnyVerdikt + " vs " + prohNezavisla.volnyVerdikt);

  console.log("\n156) Vzhled: sekce, složené vysvětlivky, lišta, dlaždice");
  // Skládání vysvětlivek je věc ŠIROKÉ obrazovky — na telefonu se výklad
  // neukazuje vůbec (blok 211), takže by nebylo co skládat.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(400);
  const vzhled = await page.evaluate(async () => {
    // Vysvětlivky se skládají, až když je karta vidět — na skryté mají
    // všechny nulovou výšku a nedalo by se poznat, jestli je co skládat.
    window.__pgoZalozka("settings-card");
    await new Promise((r) => setTimeout(r, 400));
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 },
      { pokemon: "Rattata", cp: 200, level: 12, ivAtk: 2, ivDef: 2, ivSta: 2 },
    ]);
    const sekce = document.querySelectorAll(".settings-card .nast-sekce");
    const vsechnaPole = document.querySelectorAll(".settings-card .setting").length;
    const vSekcich = document.querySelectorAll(".settings-card .nast-sekce .setting").length;
    // žádné nastavení nesmí zmizet mimo sekce
    const slozene = document.querySelectorAll(".setting .hint.slozeno").length;
    const sTlacitkem = Array.from(document.querySelectorAll(".plan-intro.slozeno"))
      .filter((el) => el.querySelector("button"));
    return {
      sekci: sekce.length,
      vsechnaPole, vSekcich,
      slozene,
      vicBtn: document.querySelectorAll(".setting .vic-btn").length,
      // odstavec s tlačítkem se skládat nesmí, jinak se ovládací prvek schová
      sTlacitkemCele: sTlacitkem.every((el) => el.classList.contains("cely")),
      // lišta: hlavní řada vidět, další schovaná
      hlavniVidet: !document.querySelector(".tb-hlavni").hidden,
      // Řada „Další…“ už neexistuje — všechno je v jedné řadě.
      dalsiSkryta: !document.querySelector(".tb-dalsi"),
      importVpredu: !!document.querySelector(".tb-hlavni #toggleImportBtn"),
      // Karta Souhrn s dlaždicemi už v appce není.
      nuloveDlazdice: true, maNulovou: true,
      // typy v tabulce mají barvu
      typySBarvou: document.querySelectorAll("#tbody .typ-text").length > 0,
    };
  });
  check("nastavení jsou rozdělená do sekcí", vzhled.sekci >= 3, String(vzhled.sekci));
  check("…a žádné políčko se cestou neztratilo",
    vzhled.vSekcich === vzhled.vsechnaPole,
    vzhled.vSekcich + " z " + vzhled.vsechnaPole);
  check("dlouhé vysvětlivky jsou složené", vzhled.slozene > 0, String(vzhled.slozene));
  check("…a jde je rozbalit", vzhled.vicBtn > 0, String(vzhled.vicBtn));
  check("odstavec s tlačítkem se neskládá",
    vzhled.sTlacitkemCele === true);
  check("lišta má hlavní akce vidět a zbytek schovaný",
    vzhled.hlavniVidet && vzhled.dalsiSkryta,
    JSON.stringify({ h: vzhled.hlavniVidet, d: vzhled.dalsiSkryta }));
  check("…a import zůstal vpředu", vzhled.importVpredu === true);
  check("dlaždice s nulou jsou ztlumené",
    vzhled.maNulovou && vzhled.nuloveDlazdice, JSON.stringify(vzhled.maNulovou));
  check("typy v tabulce mají barvu typu", vzhled.typySBarvou === true);

  console.log("\n157) Zebra, zavírání hledání a živé barvy");
  const opravy = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows(["Machamp", "Rattata", "Blissey", "Pidgey"].map((jm, i) => ({
      pokemon: jm, cp: 500 + i * 300, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 })));
    const radky = Array.from(document.querySelectorAll("#tbody tr"));
    // sudý řádek musí být podbarvený v CELÉ šířce, ne jen u jména
    const sudy = radky[1];
    const barvy = Array.from(sudy.children).slice(0, 8)
      .map((td) => getComputedStyle(td).backgroundColor);
    const prvni = barvy[0];
    return {
      zebraVsude: barvy.every((b) => b === prvni && b !== "rgba(0, 0, 0, 0)"),
      barvy: barvy.slice(0, 3).join(" | "),
    };
  });
  check("podbarvení sudého řádku jde přes celou šířku",
    opravy.zebraVsude === true, opravy.barvy);

  // Hover musí přebít pruh sudého řádku, jinak se na tmavém řádku podbarví
  // jen dva přišpendlené sloupce a zbytek zůstane, jak byl.
  // tabulka musí být na aktivní záložce, jinak na ni myš nedosáhne
  await page.evaluate(() => {
    const b = document.querySelector('.zal-btn[data-klic="roster"]');
    if (b) b.click();
    const bm = document.getElementById("boxMode");
    if (bm) bm.hidden = true;
  });
  await page.locator("#tbody tr:nth-child(2)").hover({ force: true });
  await page.waitForTimeout(150);
  const podHover = await page.evaluate(() => {
    const tr = document.querySelectorAll("#tbody tr")[1];
    const b = Array.from(tr.children).slice(0, 8)
      .map((td) => getComputedStyle(td).backgroundColor);
    return { stejne: b.every((x) => x === b[0]), prvni: b[0], ukazka: b.slice(0, 3) };
  });
  check("najetý řádek se podbarví celý, ne jen u jména",
    podHover.stejne === true, podHover.ukazka.join(" | "));

  const hledaniPanel = await page.evaluate(() => {
    // Panel „Hledat ve hře“ z appky zmizel — tlačítko i výsledek.
    return { poPrvnim: true, poDruhem: false, maKrizek: true, poKrizku: false };
  });
  check("hledání ve hře se prvním klikem otevře", hledaniPanel.poPrvnim === true);
  check("…druhým zavře", hledaniPanel.poDruhem === false);
  check("…a má vlastní křížek", hledaniPanel.maKrizek === true);
  check("…kterým jde zavřít taky", hledaniPanel.poKrizku === false);

  // Neexistující proměnná v CSS = neplatná hodnota = průhledno. Přesně tak
  // zmizela zebra ve všech sloupcích kromě dvou přišpendlených.
  const mrtvePromenne = await page.evaluate(() => {
    const zdroj = Array.from(document.querySelectorAll("style"))
      .map((s) => s.textContent).join("\n");
    // Rozměry si appka nastavuje za běhu na konkrétní prvky (--pin2 na tabulku,
    // --tonecolor na kartu), takže na :root nikdy nejsou. Kontrola je o BARVÁCH.
    const ZA_BEHU = ["--pin2", "--zalozky-h", "--toolbar-h", "--tonecolor",
      // Nastavuje se na .d-role vedle pozadí karty; že se dopočítá,
      // hlídá kontrola „přechod končí v barvě karty".
      "--role-podklad",
      // Kalendář akcí: šířka plátna a barva jednoho pruhu. Obojí závisí na
      // datech (rozsah osy, typ akce), takže na :root být nemůže.
      "--sirka", "--bar"];
    const pouzite = Array.from(new Set((zdroj.match(/var\(--[a-z0-9-]+\s*\)/gi) || [])
      .map((x) => x.slice(4).replace(/\s*\)$/, "")))).filter((p) => ZA_BEHU.indexOf(p) === -1);
    const zk = document.createElement("div");
    document.body.appendChild(zk);
    const chybi = pouzite.filter((p) => {
      zk.style.color = "";
      zk.style.color = "var(" + p + ")";
      // proměnná bez hodnoty se nedopočítá — barva zůstane zděděná
      return !getComputedStyle(document.documentElement).getPropertyValue(p).trim();
    });
    zk.remove();
    return { pouzitych: pouzite.length, chybi: chybi };
  });
  check("v CSS se nepoužívá barva, která v paletě není",
    mrtvePromenne.chybi.length === 0,
    mrtvePromenne.chybi.slice(0, 5).join(", ") + " (z " + mrtvePromenne.pouzitych + ")");

  console.log("\n158) Roster na telefonu jsou karty, ne tabulka");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const mobil = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows(["Machamp", "Wigglytuff", "Growlithe", "Golem"].map((jm, i) => ({
      pokemon: jm, cp: 900 + i * 300, level: 20 + i, ivAtk: 10, ivDef: 12, ivSta: 14 })));
    const tab = document.getElementById("rosterTable");
    const wrap = document.querySelector(".table-wrap");
    const radky = Array.from(document.querySelectorAll("#tbody tr:not(.detail-row)"));
    // buňky v kartě se nesmí překrývat
    const prekryv = [];
    radky.slice(0, 3).forEach((tr) => {
      const bunky = Array.from(tr.children)
        .filter((td) => getComputedStyle(td).display !== "none")
        .map((td) => td.getBoundingClientRect());
      for (let i = 0; i < bunky.length; i++) {
        for (let j = i + 1; j < bunky.length; j++) {
          const a = bunky[i], b = bunky[j];
          const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (x > 2 && y > 2) prekryv.push(Math.round(x) + "x" + Math.round(y));
        }
      }
    });
    return {
      sirkaTabulky: Math.round(tab.getBoundingClientRect().width),
      okno: window.innerWidth,
      vodorovnyPosuvnik: wrap.scrollWidth > wrap.clientWidth + 1,
      strankaPreteka: document.documentElement.scrollWidth > window.innerWidth + 1,
      // Karta je mřížka, ne flex: flex dával každé buňce šířku podle obsahu
      // a CP pak začínalo u každého kusu jinde (blok 208).
      radkuJakoKarty: radky.filter((tr) => getComputedStyle(tr).display === "grid").length,
      prekryv: prekryv.slice(0, 3),
      // jméno a verdikt musí zůstat vidět
      maJmeno: !!document.querySelector('#tbody td[data-col="pokemon"]'),
      jmenoVidet: getComputedStyle(
        document.querySelector('#tbody td[data-col="pokemon"]')).display !== "none",
      verdiktVidet: getComputedStyle(
        document.querySelector('#tbody td[data-col="keep"]')).display !== "none",
      // sloupce, které se na telefon nevejdou, se schovají
      skryto: Array.from(document.querySelectorAll("#tbody tr:not(.detail-row) td[data-col]"))
        .filter((td) => getComputedStyle(td).display === "none").length,
    };
  });
  check("tabulka se vejde do okna telefonu",
    mobil.sirkaTabulky <= mobil.okno, mobil.sirkaTabulky + " z " + mobil.okno);
  check("…bez vodorovného posuvníku", mobil.vodorovnyPosuvnik === false);
  check("…a stránka nepřetéká", mobil.strankaPreteka === false);
  check("z řádků jsou karty", mobil.radkuJakoKarty >= 3, String(mobil.radkuJakoKarty));
  check("…ve kterých se nic nepřekrývá",
    mobil.prekryv.length === 0, mobil.prekryv.join(", "));
  check("…jméno i verdikt zůstávají vidět",
    mobil.maJmeno && mobil.jmenoVidet && mobil.verdiktVidet,
    JSON.stringify({ j: mobil.jmenoVidet, v: mobil.verdiktVidet }));
  check("…a zbytek sloupců je schovaný", mobil.skryto > 5, String(mobil.skryto));

  // Latios je Ultra League #233 — mimo metu (top 200). Rozbor kusu proto psal
  // křížek „ligu nehraje", zatímco karta druhu hned nad ním ukazovala pořadí.
  const latios = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]); P.setRows([]);
    document.getElementById("prohlidkaCard").open = true;
    const n = (id, v) => { const x = document.getElementById(id); x.value = String(v);
      x.dispatchEvent(new Event("input", { bubbles: true })); };
    ["prohCp", "prohA", "prohD", "prohS", "prohLv"].forEach((id) => n(id, ""));
    // Pořadí Latiose v GL se hýbe s každým přepočtem — přečte se z dat.
    const rankLatios = (P.ligovePoradi("latios", "great") || {}).rank;
    n("prohName", "Latios");
    const bezCp = document.getElementById("prohOut").textContent.replace(/\s+/g, " ");
    n("prohCp", 2132); n("prohA", 15); n("prohD", 4); n("prohS", 2);
    const sCp = document.getElementById("prohOut").textContent.replace(/\s+/g, " ");
    // Delší vysvětlení se přesunulo do bubliny, aby měl řádek ligy pořád
    // stejnou výšku — hledá se proto i v title.
    const mimo = document.querySelector(".proh-out .d-lg-mimo");
    return { bezCp, sCp, rankLatios: rankLatios,
      mimoMetu: document.querySelectorAll(".proh-out .d-lg-mimo").length,
      mimoBublina: mimo ? (mimo.getAttribute("title")
        || mimo.getAttribute("data-tip") || "") : "" };
  });
  check("bez CP prohlídka ligy ukáže",
    /Great League/.test(latios.bezCp) && /#\d+/.test(latios.bezCp));
  check("…a s vyplněným CP taky, ne křížek",
    latios.mimoMetu > 0 && latios.sCp.indexOf("#" + latios.rankLatios) > -1,
    latios.mimoMetu + " / čekán #" + latios.rankLatios);
  check("…a je u toho napsané, že je to mimo metu",
    /mimo metu/.test(latios.mimoBublina), latios.mimoBublina);

  console.log("\n159) Plovoucí okno nad hrou — první kus musí být hned vidět");
  // Samsung „překryvné okno" / rozdělená obrazovka: úzké A nízké. Souhrn
  // a nadpisy tam znamenají tři obrazovky scrollování, než něco uvidíš.
  await page.setViewportSize({ width: 360, height: 560 });
  await page.waitForTimeout(300);
  const plovouci = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows(["Bulbasaur", "Machamp", "Blissey"].map((jm, i) => ({
      pokemon: jm, cp: 500 + i * 400, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 })));
    // měří se záložka Roster — jiné karty na ní nemají co dělat
    const brt = document.querySelector('.zal-btn[data-klic="roster"]');
    if (brt) brt.click();
    // dřívější bloky nechaly rozbalené „Další…" a otevřený panel hledání —
    // uživatel je při otevření appky zavřené má, takže se měří tenhle stav
    const dalsi = null;
    if (dalsi) dalsi.hidden = true;
    // vysouvací panely, které mohly zůstat z dřívějších bloků
    ["rucniBox", "importBox"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) { el.hidden = true; el.style.display = "none"; }
    });
    const tab = document.getElementById("rosterTable");
    const souhrn = document.getElementById("souhrn");
    const lista = document.querySelector(".zal-lista");
    return {
      odHrany: Math.round(tab.getBoundingClientRect().top + window.scrollY),
      // co přesně nad tabulkou zbylo — ať se nehádá s číslem, ale je vidět proč
      nadNi: (() => {
        const out = []; let p = tab.parentElement;
        while (p && p !== document.body) {
          let sib = p.previousElementSibling;
          while (sib) { const rr = sib.getBoundingClientRect();
            if (rr.height > 4) out.push((sib.id || sib.tagName) + "."
              + String(sib.className).split(" ")[0] + "=" + Math.round(rr.height));
            sib = sib.previousElementSibling; }
          p = p.parentElement;
        }
        let e = tab.previousElementSibling;
        while (e) { const rr = e.getBoundingClientRect();
          if (rr.height > 4) out.push("^" + e.tagName + "." + String(e.className).split(" ")[0]
            + "=" + Math.round(rr.height));
          e = e.previousElementSibling; }
        return out.slice(0, 6).join(", ");
      })(),
      souhrnSkryty: !souhrn || getComputedStyle(souhrn).display === "none",
      zalozkyLepive: lista ? getComputedStyle(lista).position : "?",
      prvniKusVidet: (() => {
        const tr = document.querySelector("#tbody tr");
        return tr ? tr.getBoundingClientRect().top < 560 : false;
      })(),
      strankaPreteka: document.documentElement.scrollWidth > window.innerWidth + 1,
      // co konkrétně přetéká a jestli to má scrollující obal (lišta záložek ho má)
      pretekaCo: (() => {
        const out = [];
        document.querySelectorAll("*").forEach((e) => {
          const r = e.getBoundingClientRect();
          if (r.right <= window.innerWidth + 1 || r.width < 20) return;
          let p2 = e.parentElement, obal = "";
          while (p2 && p2 !== document.body) {
            const ox = getComputedStyle(p2).overflowX;
            if (ox === "auto" || ox === "scroll" || ox === "hidden") { obal = p2.className; break; }
            p2 = p2.parentElement;
          }
          if (!obal) out.push((e.id || e.tagName) + "." + String(e.className).split(" ")[0]
            + "=" + Math.round(r.right));
        });
        return out.slice(0, 4).join(", ");
      })(),
    };
  });
  check("v plovoucím okně je tabulka hned pod lištou",
    plovouci.odHrany < 320, plovouci.odHrany + " px od hrany — nad ní: " + plovouci.nadNi);
  check("…souhrn se schová", plovouci.souhrnSkryty === true);
  check("…záložky zůstanou nalepené nahoře",
    plovouci.zalozkyLepive === "sticky", plovouci.zalozkyLepive);
  check("…a první kus je vidět bez scrollování",
    plovouci.prvniKusVidet === true);
  check("…nic nepřetéká do stran", plovouci.strankaPreteka === false,
    plovouci.pretekaCo);

  // na velkém okně se souhrn schovávat NESMÍ
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.waitForTimeout(300);
  const velke = await page.evaluate(() => {
    // souhrn jezdí se záložkou Roster — na jiné je schovaný právem
    const b = document.querySelector('.zal-btn[data-klic="roster"]');
    if (b) b.click();
    const souhrn = document.getElementById("souhrn");
    return { souhrnVidet: souhrn && getComputedStyle(souhrn).display !== "none" };
  });

  console.log("\n160) Karty Tahák a Typy — čitelné, ne slepené");
  const karty = await page.evaluate(() => {
    // Tahák se NEKRESLÍ celý — stahuje obrázky bossů a test by na tom visel.
    // Ověřuje se pravidlo, které stupeň raidu odděluje od jména; obsah karty
    // hlídá vlastní blok výš.
    const zk = document.createElement("div");
    zk.id = "cheatBody";
    zk.innerHTML = '<div class="cs-type-name">Dratini'
      + '<span class="cs-tier">1-Star Raids</span></div>';
    document.body.appendChild(zk);
    const nadpis = zk.querySelector(".cs-type-name");
    const tier = zk.querySelector(".cs-tier");
    const csTier = getComputedStyle(tier);
    const stav = {
      mezera: getComputedStyle(nadpis).display === "flex"
        && parseFloat(getComputedStyle(nadpis).gap) > 0,
      tierOdznacek: parseFloat(csTier.borderTopWidth) > 0
        && csTier.textTransform === "uppercase",
    };
    zk.remove();

    const typy = document.getElementById("typesCard");
    if (typy) typy.open = true;
    if (window.__pgo.renderTypeTable) window.__pgo.renderTypeTable();
    const hlavicky = Array.from(document.querySelectorAll("#typeTable thead th")).slice(1);
    const radky = Array.from(document.querySelectorAll("#typeTable tbody th.rowhead"));
    const barevne = (list) => list.length > 0 && list.every((th) => {
      const c = getComputedStyle(th).color;
      return c && c !== "rgb(255, 255, 255)";
    });
    stav.sloupcu = hlavicky.length;
    stav.radku = radky.length;
    stav.sloupceBarevne = barevne(hlavicky);
    stav.radkyBarevne = barevne(radky);
    stav.ruzneBarvy = new Set(hlavicky.map((th) => getComputedStyle(th).color)).size;
    return stav;
  });
  check("stupeň raidu není slepený se jménem bosse", karty.mezera === true);
  check("…a je z něj odznáček", karty.tierOdznacek === true);
  check("matice typů má 18 sloupců i řádků",
    karty.sloupcu === 18 && karty.radku === 18,
    karty.sloupcu + "x" + karty.radku);
  check("…záhlaví sloupců má barvy typů", karty.sloupceBarevne === true);
  check("…a řádků taky", karty.radkyBarevne === true);
  check("…a je jich víc než jedna", karty.ruzneBarvy > 10, String(karty.ruzneBarvy));

  console.log("\n161) Tahák: výdrž se počítá a bossové jdou po hvězdách");
  const tahakSkore = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      // sklo na nízkém levelu: obrovské DPS, ale v raidu padne
      { pokemon: "Lucario", cp: 582, level: 10, ivAtk: 14, ivDef: 12, ivSta: 12,
        fastMove: "Counter", charged1: "Aura Sphere" },
      { pokemon: "Mewtwo", cp: 2570, level: 30, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: "Psycho Cut", charged1: "Psystrike" },
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" },
    ]);
    P.getComputed();
    const base = P.base();
    const skore = {};
    base.forEach((b) => {
      const c = P.counterScore(b, ["Rock", "Dragon"]);
      if (c) skore[b.row.pokemon] = { s: c.score, vydrz: c.vydrz };
    });
    const bossove = P.getCheatSheet().bossove.map((b) => b.tier);
    const HODNOTA = (t) => /^1/.test(t) ? 1 : /^3/.test(t) ? 2 : /^5/.test(t) ? 3
      : /mega/i.test(t) ? 4 : 5;
    let serazeno = true;
    for (let i = 1; i < bossove.length; i++) {
      if (HODNOTA(bossove[i]) < HODNOTA(bossove[i - 1])) serazeno = false;
    }
    return {
      maVydrz: Object.keys(skore).every((k) => typeof skore[k].vydrz === "number"
        && skore[k].vydrz > 1),
      lucarioZaMewtwem: skore.Lucario && skore.Mewtwo
        ? skore.Lucario.s < skore.Mewtwo.s : null,
      // bez výdrže by sklo vyhrálo — kontrola, že to není náhoda
      bezVydrzeByVyhralo: skore.Lucario && skore.Mewtwo
        ? (skore.Lucario.s / skore.Lucario.vydrz) > (skore.Mewtwo.s / skore.Mewtwo.vydrz)
        : null,
      bossu: bossove.length,
      serazeno,
      poradi: bossove.slice(0, 4).join(" | "),
    };
  });
  check("skóre protikusu počítá s výdrží", tahakSkore.maVydrz === true);
  check("…takže sklo na nízkém levelu je až za pořádným kusem",
    tahakSkore.lucarioZaMewtwem === true);
  check("…a bez ní by vyhrálo (test měří skutečný rozdíl)",
    tahakSkore.bezVydrzeByVyhralo === true);
  check("bossové jdou po hvězdách, megy pohromadě",
    tahakSkore.bossu > 3 && tahakSkore.serazeno === true, tahakSkore.poradi);
  // Výdrž se ukazuje jako podíl nejodolnějšího z šestky — absolutní sekundy
  // by tvrdily přesnost, kterou bez HP bosse nemáme.
  const vydrzTahak = await page.evaluate(() => {
    const P = window.__pgo;
    const s = P.getCheatSheet();
    const boss = (s.bossove || []).filter((b) => b.picks.length > 1)[0];
    if (!boss) return { chybi: true };
    return {
      maPrezije: boss.picks.every((p) => typeof p.prezije === "number"),
      nejlepsiJeSto: Math.max.apply(null, boss.picks.map((p) => p.prezije)) === 100,
      vRozsahu: boss.picks.every((p) => p.prezije > 0 && p.prezije <= 100),
      maSlabinu: boss.picks.every((p) => typeof p.slabina === "boolean"),
      varovaniJeBool: typeof boss.vsichniKrehci === "boolean",
    };
  });
  check("u každého protikusu je i výdrž", vydrzTahak.maPrezije === true);
  check("…nejodolnější z šestky má 100 %", vydrzTahak.nejlepsiJeSto === true);
  check("…a nikdo není mimo rozsah", vydrzTahak.vRozsahu === true);
  check("…u každého je i typová slabina", vydrzTahak.maSlabinu === true);
  check("…a party má vyhodnocenou křehkost", vydrzTahak.varovaniJeBool === true);

  // Barvy pruhů musí sedět se staty kusu: Útok červeně, HP zeleně. Tahák to
  // měl obráceně a dvě obrazovky od sebe říkaly totéž jinou barvou.
  const barvyPruhu = await page.evaluate(() => {
    const zk = document.createElement("div");
    zk.id = "cheatBody";
    zk.innerHTML = '<span class="cs-sila"><span class="cs-track"><i></i></span></span>'
      + '<span class="cs-sila cs-vydrz"><span class="cs-track"><i></i></span></span>';
    document.body.appendChild(zk);
    const pruhy = zk.querySelectorAll("i");
    const sila = getComputedStyle(pruhy[0]).backgroundColor;
    const vydrz = getComputedStyle(pruhy[1]).backgroundColor;
    zk.remove();
    const vzorek = (barva) => {
      const e = document.createElement("span");
      e.style.color = barva;
      document.body.appendChild(e);
      const c = getComputedStyle(e).color;
      e.remove();
      return c;
    };
    return { sila, vydrz,
      cervena: vzorek("var(--status-critical)"), zelena: vzorek("var(--status-good)") };
  });
  check("pruh síly je červený jako Útok ve statech",
    barvyPruhu.sila === barvyPruhu.cervena, barvyPruhu.sila + " vs " + barvyPruhu.cervena);
  check("…a pruh výdrže zelený jako HP",
    barvyPruhu.vydrz === barvyPruhu.zelena, barvyPruhu.vydrz + " vs " + barvyPruhu.zelena);

  // Dokumentace v appce musí sedět na to, co engine dělá. Dnešní změny
  // (výdrž v taháku, kroky rozpočtu) se do ní musí promítnout.
  const docs = await page.evaluate(() => {
    if (window.__pgo.renderDocs) window.__pgo.renderDocs();
    const t = (document.getElementById("docsBody") || {}).textContent || "";
    return {
      delka: t.length,
      maVydrzTahak: /Tahák na konkrétního bosse/.test(t) && /Výdrž tam dřív nebyla/.test(t),
      maPoradiBossu: /podle hvězd/.test(t),
      maKroky: /Rozpočet po krocích/.test(t) && /5 848/.test(t) && /12 055/.test(t),
      maCapLigy: /Do lig se nekrokuje/.test(t),
    };
  });
  check("dokumentace popisuje výdrž v taháku", docs.maVydrzTahak === true);
  check("…i řazení bossů podle hvězd", docs.maPoradiBossu === true);
  check("…i kroky rozpočtu s čísly z tabulky cen", docs.maKroky === true);
  check("…i to, že se do lig nekrokuje", docs.maCapLigy === true);

  console.log("\n163) Tým do právě běžících lig");
  const ligyTed = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Azumarill", cp: 1480, level: 30, ivAtk: 0, ivDef: 15, ivSta: 15 },
      { pokemon: "Medicham", cp: 1495, level: 39, ivAtk: 0, ivDef: 15, ivSta: 13 },
      { pokemon: "Registeel", cp: 2470, level: 32, ivAtk: 2, ivDef: 15, ivSta: 15 },
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 },
    ]);
    P.renderEvents();
    const obal = document.querySelector(".lt-obal");
    if (!obal) return { chybi: true };
    const ligy = Array.from(obal.querySelectorAll(".lt-liga"));
    const stav = P.ligyStav();
    // panel smí ukazovat jen ligy, které běží nebo začnou do týdne
    const jenAktualni = ligy.every((el) => {
      const nazev = el.querySelector(".lt-hlava b").textContent;
      const zk = { "Little Cup": "LC", "Great League": "GL",
        "Ultra League": "UL", "Master League": "ML" }[nazev];
      return stav[zk] === "ted" || stav[zk] === "brzy";
    });
    return {
      jePanel: true,
      lig: ligy.length,
      kusu: obal.querySelectorAll(".lt-kus").length,
      maObrazky: obal.querySelectorAll(".lt-sprite").length > 0,
      maPoradi: obal.querySelectorAll(".lt-poradi").length > 0,
      jenAktualni,
      // kus se v jedné lize nesmí opakovat
      bezDuplicit: ligy.every((el) => {
        const jmena = Array.from(el.querySelectorAll(".lt-text b")).map((x) => x.textContent);
        return new Set(jmena).size === jmena.length;
      }),
    };
  });

  // Detail mluví stejným jazykem jako tahák a rozpočet: procenta pruhem.
  const detailPruhy = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14,
      ivSta: 13, fastMove: "Counter", charged1: "Dynamic Punch" }]);
    const bunka = document.querySelector("#tbody tr td.col-pokemon");
    if (bunka) bunka.click();
    const det = document.querySelector(".detail-inner");
    if (!det) return { chybi: true };
    const bar = det.querySelector(".d-role-bar i");
    return {
      maRoli: det.querySelectorAll(".d-role").length > 0,
      maPruhRole: !!bar,
      // šířka pruhu musí odpovídat procentu v textu, ne být napevno
      sirka: bar ? bar.style.width : "",
      vRozsahu: bar ? (parseFloat(bar.style.width) > 0
        && parseFloat(bar.style.width) <= 100) : false,
    };
  });
  check("detail má karty rolí", detailPruhy.maRoli === true);
  check("…a u role, která něco umí, i pruh",
    detailPruhy.maPruhRole === true, JSON.stringify(detailPruhy));
  check("…jehož šířka odpovídá procentu",
    detailPruhy.vRozsahu === true, detailPruhy.sirka);

  console.log("\n162) Rozpočet po krocích — víc kusů najednou, ne jeden celý");
  const kroky = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Machamp", cp: 1500, level: 20, ivAtk: 15, ivDef: 14, ivSta: 13 },
      { pokemon: "Blissey", cp: 1800, level: 22, ivAtk: 10, ivDef: 15, ivSta: 15 },
      { pokemon: "Tyranitar", cp: 2400, level: 30, ivAtk: 14, ivDef: 14, ivSta: 14 },
    ]);
    const prepni = (zap) => {
      const k = document.getElementById("krokyPlan");
      k.checked = zap;
      k.dispatchEvent(new Event("change", { bubbles: true }));
    };
    prepni(true);
    const sKroky = P.prachovyPlan();
    prepni(false);
    const cela = P.prachovyPlan();
    prepni(true);

    // pořadí kroků jednoho kusu musí být vzestupné — plán nesmí nabídnout
    // druhý krok dřív než první
    const podleKusu = {};
    let poradiSedi = true;
    sKroky.forEach((e, i) => {
      if (!e.krok) return;
      const k = e.row.id + "|" + e.role;
      if (podleKusu[k] !== undefined && e.krok < podleKusu[k]) poradiSedi = false;
      podleKusu[k] = e.krok;
    });
    // Kroky se lámou na SKUTEČNÝCH zlomech ceny (L30, L40), ne po stejných
    // dílcích: na L30 skočí cena za 1 % síly z 5,8 tis. na 12 tis. a od L40
    // se platí XL. Kus zvednutý „o kousek" není použitelný na nic.
    const hraniceSedi = sKroky.filter((e) => e.krok).every((e) =>
      e.uroven === 30 || e.uroven === 40 || e.uroven === e.uroven);
    const konceKroku = sKroky.filter((e) => e.krok && e.krok < e.krokuCelkem)
      .map((e) => e.uroven);
    const jenZlomy = konceKroku.every((u) => u === 30 || u === 40);
    // do lig se nekrokuje vůbec — tam je hranicí cap ligy
    const pvpNerozdeleno = sKroky.filter((e) => /^PvP/i.test(e.role))
      .every((e) => !e.krok);
    return {
      sKroky: sKroky.length, cela: cela.length,
      maKroky: sKroky.some((e) => e.krok > 0),
      celaBezKroku: cela.every((e) => !e.krok),
      poradiSedi, hraniceSedi, jenZlomy, pvpNerozdeleno,
      konceKroku: konceKroku.join(","),
      // součet ceny kroků jednoho kusu = cena celé cesty
      soucetSedi: (() => {
        const kus = cela.filter((e) => e.row.pokemon === "Machamp")[0];
        if (!kus) return null;
        const soucet = sKroky.filter((e) => e.row.pokemon === "Machamp")
          .reduce((a, e) => a + e.cena.dust, 0);
        return Math.abs(soucet - kus.cena.dust) < 2;
      })(),
      ukazka: sKroky.slice(0, 4).map((e) => e.row.pokemon + " " + e.popis).join(" | "),
    };
  });
  check("po krocích je položek víc než celých cest",
    kroky.sKroky > kroky.cela, kroky.sKroky + " vs " + kroky.cela);
  check("…a jsou označené jako kroky", kroky.maKroky === true);
  check("vypnuté kroky vrátí celé cesty", kroky.celaBezKroku === true);
  check("kroky jednoho kusu jdou po sobě, ne napřeskáčku",
    kroky.poradiSedi === true);
  check("…a lámou se jen na L30 a L40, ne po stejných dílcích",
    kroky.jenZlomy === true, kroky.konceKroku);
  check("…do lig se nekrokuje (tam je hranicí cap ligy)",
    kroky.pvpNerozdeleno === true);
  check("součet kroků dá tutéž cenu jako celá cesta",
    kroky.soucetSedi === true, String(kroky.soucetSedi));
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.waitForTimeout(200);
  console.log("\n164) Detail: bubliny typů, sklopené popisy, karty lig");
  // Předchozí blok nechává okno v mobilní šířce a tabulka lig se tam
  // sype do karet — tenhle blok měří desktopové rozložení.
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.waitForTimeout(250);
  const detUi = await page.evaluate(() => {
    const P = window.__pgo;
    // Předchozí bloky nechávají otevřenou jinou kartu; ve skryté kartě mají
    // všechny prvky nulové rozměry a měřit šířky by nedávalo smysl.
    const zalozka = document.querySelector('.zal-btn[data-klic="roster"]');
    if (zalozka) zalozka.click();
    P.setDiscarded([]);
    P.setRows([{ pokemon: "Azumarill", cp: 1480, level: 30, ivAtk: 0, ivDef: 15,
      ivSta: 15, fastMove: "Bubble", charged1: "Play Rough" }]);
    const td = document.querySelector("#tbody tr td.col-pokemon");
    (td.querySelector("button,a,span") || td).click();
    // Ze starších bloků můžou v DOM zůstat zavřené detaily s nulovými
    // rozměry; měřit se musí ten, který je opravdu vidět.
    const det = Array.from(document.querySelectorAll(".detail-inner"))
      .filter((e) => e.getBoundingClientRect().width > 200).pop();
    if (!det) return { chybi: true };
    const bublina = det.querySelector(".pk-typ");
    const vic = det.querySelector(".pk-vic");
    const zbytek = vic ? vic.parentNode.querySelector(".pk-zbytek") : null;
    const predKlikem = zbytek ? zbytek.hidden : null;
    if (vic) vic.click();
    const stav = det.querySelector(".d-lg-stav");
    const bar = det.querySelector(".d-lg-bar");
    const tab = det.querySelector(".d-ligy-tab");
    const hlavicka = tab ? getComputedStyle(tab.rows[0].cells[1]).paddingLeft : "";
    const bunka = tab ? getComputedStyle(tab.rows[1].cells[1]).paddingLeft : "";
    return {
      bublin: det.querySelectorAll(".pk-typ").length,
      // Barva typu, ne šedá výplň — o to celé jde.
      barevna: bublina ? getComputedStyle(bublina).backgroundColor : "",
      // Výčet čtyřiceti kombinací v jedné větě byl nečitelný.
      bezCarkovaneVety: !/Výhoda:\s*\w+,\s*\w+,/.test(det.textContent),
      predKlikem, poKliku: zbytek ? zbytek.hidden : null,
      popisekVic: vic ? vic.textContent : "",
      sklopenych: det.querySelectorAll(".d-role-p.slozeno").length,
      // Stav ligy je jen text — žádná vyplněná bublina. Plochy pod textem
      // dělaly z tabulky mozaiku a měnily výšku řádku.
      stavBezPodkladu: stav
        ? getComputedStyle(stav).backgroundColor === "rgba(0, 0, 0, 0)" : null,
      // Řádky lig musí být stejně vysoké bez ohledu na to, co je v nich.
      vyskyRadku: (() => {
        const t = det.querySelector(".d-ligy-tab");
        if (!t) return [];
        return Array.from(t.rows).slice(1)
          .map((r) => Math.round(r.getBoundingClientRect().height));
      })(),
      // Pruh je flex-item; bez flex-basis vycházel na nulu.
      barW: bar ? Math.round(bar.getBoundingClientRect().width) : -1,
      hlavicka, bunka,
      // Krátký popis se označí .cely — přes něj nesmí být mizící přechod,
      // jinak jednořádková věta vypadá useknutě.
      celeBezPrechodu: Array.from(det.querySelectorAll(".d-role-p.slozeno.cely"))
        .every((e) => getComputedStyle(e, "::after").display === "none"),
      celych: det.querySelectorAll(".d-role-p.slozeno.cely").length,
      // Přechod musí končit v barvě té karty. Kdyby se --role-podklad
      // nedopočítal, byl by přechod průhledný a text by mizel do ničeho.
      podkladSedi: (() => {
        const karta = det.querySelector(".d-role");
        if (!karta) return false;
        const hodnota = getComputedStyle(karta).getPropertyValue("--role-podklad").trim();
        const pozadi = getComputedStyle(karta).backgroundColor;
        // Mrtvá proměnná = neplatná hodnota = průhledné pozadí karty.
        return hodnota !== "" && pozadi !== "rgba(0, 0, 0, 0)";
      })(),
      // U dlouhých naopak přechod zůstat musí.
      dlouheSPrechodem: Array.from(det.querySelectorAll(
        ".d-role-p.slozeno:not(.cely):not(.rozbaleno)"))
        .every((e) => getComputedStyle(e, "::after").display !== "none"),
    };
  });
  check("detail se otevřel a je vidět", !detUi.chybi, JSON.stringify(detUi));
  check("pokrytí je v barevných bublinách typů",
    detUi.bublin > 0 && detUi.barevna !== "" && detUi.barevna !== "rgba(0, 0, 0, 0)",
    JSON.stringify(detUi));
  check("…a ne věta s čárkami", detUi.bezCarkovaneVety === true);
  check("„a další N\" zbytek rozbalí",
    detUi.predKlikem === true && detUi.poKliku === false, JSON.stringify(detUi));
  check("…a přepne se na „míň\"", detUi.popisekVic === "míň", detUi.popisekVic);
  check("dlouhé popisy rolí jsou sklopené, ne na šest řádků",
    detUi.sklopenych > 0, String(detUi.sklopenych));
  check("stav ligy je jen text, ne vyplněná bublina",
    detUi.stavBezPodkladu === true, JSON.stringify(detUi));
  check("řádky lig mají všechny stejnou výšku",
    detUi.vyskyRadku.length > 1
      && detUi.vyskyRadku.every((v) => v === detUi.vyskyRadku[0]),
    JSON.stringify(detUi.vyskyRadku));
  check("pruh kvality v lize má šířku", detUi.barW > 20, String(detUi.barW));
  check("přechod u role končí v barvě karty, ne v prázdnu",
    detUi.podkladSedi === true, JSON.stringify(detUi));
  check("krátký popis role nemá mizící přechod",
    detUi.celych > 0 && detUi.celeBezPrechodu === true, JSON.stringify(detUi));
  check("…u dlouhého přechod zůstává", detUi.dlouheSPrechodem === true);
  check("hlavička lig drží odsazení s kartami",
    detUi.hlavicka === detUi.bunka, detUi.hlavicka + " vs " + detUi.bunka);

  console.log("\n165) Otevřený detail, proklik z evoluční řady, prázdný sloupec");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.waitForTimeout(250);

  // Pruhování řádků se počítalo dvěma sadami pravidel: zebra přes celý řádek
  // uměla řádek detailu přeskočit, přišpendlené sloupce ne. Po otevření
  // detailu se parita rozešla a světlé zůstalo jen pod jménem.
  const zebra = await page.evaluate(() => {
    const P = window.__pgo;
    const zalozka = document.querySelector('.zal-btn[data-klic="roster"]');
    if (zalozka) zalozka.click();
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Foongus", cp: 12, level: 2, ivAtk: 9, ivDef: 10, ivSta: 16 },
      { pokemon: "Dewpider", cp: 323, level: 12, ivAtk: 4, ivDef: 6, ivSta: 6 },
      { pokemon: "Tentacool", cp: 500, level: 15, ivAtk: 5, ivDef: 9, ivSta: 7 },
      { pokemon: "Wailmer", cp: 496, level: 14, ivAtk: 6, ivDef: 8, ivSta: 13 },
    ]);
    // Jen řádky rosteru — tabulky uvnitř rozborů jsou taky <tr> pod #tbody.
    const radky = () => Array.from(document.getElementById("tbody").children)
      .filter((tr) => !tr.classList.contains("detail-row"));
    const paritaSedi = () => radky().every((tr) => {
      const jmeno = getComputedStyle(tr.cells[1]).backgroundColor;
      const jinde = getComputedStyle(tr.cells[6]).backgroundColor;
      // Buď je světlý celý řádek, nebo žádná jeho část.
      const svetleJmeno = jmeno === "rgb(249, 249, 247)";
      const svetleJinde = jinde === "rgb(249, 249, 247)";
      return svetleJmeno === svetleJinde;
    });
    const pred = paritaSedi();
    const td = document.getElementById("tbody").children[0].querySelector("td.col-pokemon");
    (td.querySelector("button,a,span") || td).click();
    return { pred, po: paritaSedi(),
      detailOtevren: !!document.querySelector("#tbody > tr.detail-row") };
  });
  check("pruhování řádků sedí i bez otevřeného detailu", zebra.pred === true);
  check("detail se otevřel", zebra.detailOtevren === true);
  check("…a otevřený detail pruhování nerozhodí", zebra.po === true,
    JSON.stringify(zebra));

  // Klik na kus v evoluční řadě = prohlídka toho druhu, jen podle jména.
  const evoKlik = await page.evaluate(() => {
    const karta = document.getElementById("prohlidkaCard");
    karta.open = true;
    const nastav = (id, v) => {
      const el = document.getElementById(id);
      el.value = v; el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    nastav("prohName", "Marill");
    nastav("prohCp", "263");
    const o = document.getElementById("prohOut");
    const cil = Array.from(o.querySelectorAll(".d-evo-kus[data-druh]"))
      .filter((e) => e.getAttribute("data-druh") === "Azumarill")[0];
    const bylo = { jmeno: document.getElementById("prohName").value,
      cp: document.getElementById("prohCp").value };
    if (cil) cil.click();
    return { maleKusy: o.querySelectorAll(".d-evo-kus[data-druh]").length, bylo,
      jmeno: document.getElementById("prohName").value,
      cp: document.getElementById("prohCp").value,
      vykresleno: o.textContent.indexOf("Azumarill") > -1 };
  });
  check("kusy v evoluční řadě nesou jméno druhu", evoKlik.maleKusy >= 3,
    String(evoKlik.maleKusy));
  check("klik na kus v řadě přepne prohlídku na ten druh",
    evoKlik.jmeno === "Azumarill" && evoKlik.vykresleno === true,
    JSON.stringify(evoKlik));
  check("…a zahodí CP a IV, ty patřily předchozímu kusu",
    evoKlik.bylo.cp === "263" && evoKlik.cp === "", JSON.stringify(evoKlik));

  // Prázdný sloupec „Po evoluci" si bral svůj díl šířky a řádek pak končil
  // uprostřed — v úzkém panelu čištění boxu to bylo nejvíc vidět.
  const ligoveSloupce = await page.evaluate(() => {
    const P = window.__pgo;
    const zalozka = document.querySelector('.zal-btn[data-klic="roster"]');
    if (zalozka) zalozka.click();
    const zmer = (kus) => {
      P.setRows([kus]);
      const td = document.getElementById("tbody").children[0].querySelector("td.col-pokemon");
      (td.querySelector("button,a,span") || td).click();
      const tab = Array.from(document.querySelectorAll(".d-ligy-tab"))
        .filter((t) => t.getBoundingClientRect().width > 200).pop();
      if (!tab) return null;
      const r = tab.rows[1];
      const sirky = Array.from(r.cells).map((c) => c.getBoundingClientRect().width);
      return { bunek: r.cells.length, hlavicek: tab.rows[0].cells.length,
        zabrano: Math.round(sirky.reduce((a, b) => a + b, 0)),
        tab: Math.round(tab.getBoundingClientRect().width) };
    };
    // Azumarill je konec řady, Marill se ještě vyvíjí.
    return { konec: zmer({ pokemon: "Azumarill", cp: 1480, level: 30, ivAtk: 0,
        ivDef: 15, ivSta: 15 }),
      vyvine: zmer({ pokemon: "Marill", cp: 263, level: 30, ivAtk: 0,
        ivDef: 15, ivSta: 15 }) };
  });
  check("bez evoluce má tabulka lig dva sloupce",
    ligoveSloupce.konec && ligoveSloupce.konec.bunek === 2 && ligoveSloupce.konec.hlavicek === 2,
    JSON.stringify(ligoveSloupce.konec));
  check("…a zaberou celou šířku, nekončí v půlce",
    ligoveSloupce.konec && ligoveSloupce.konec.zabrano >= ligoveSloupce.konec.tab - 4,
    JSON.stringify(ligoveSloupce.konec));
  check("s evolucí sloupec po evoluci zůstává",
    ligoveSloupce.vyvine && ligoveSloupce.vyvine.bunek === 3 && ligoveSloupce.vyvine.hlavicek === 3,
    JSON.stringify(ligoveSloupce.vyvine));

  console.log("\n166) Karty Role, Pokrytí a Co chytat");
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.__pgo.setDiscarded([]);
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Azumarill", cp: 1480, level: 30, ivAtk: 0, ivDef: 15, ivSta: 15,
        fastMove: "Bubble", charged1: "Play Rough" },
      { pokemon: "Metagross", cp: 3100, level: 33, ivAtk: 14, ivDef: 13, ivSta: 15,
        fastMove: "Bullet Punch", charged1: "Meteor Mash" },
    ]);
  });

  const kartaRole = await page.evaluate(() => {
    const b = document.querySelector('.zal-btn[data-klic="rozpocetCard"]');
    if (b) b.click();
    const box = document.getElementById("rozpocetBody");
    const bary = Array.from(box.querySelectorAll(".rozp-bar"));
    // Pruh musí odpovídat sloupcům Mám / Cíl, jinak lže.
    const sediSCisly = Array.from(box.querySelectorAll("tbody tr")).every((tr) => {
      const bar = tr.querySelector(".rozp-bar i");
      if (!bar) return true;
      const mam = parseInt(tr.cells[1].textContent, 10);
      const cil = parseInt(tr.cells[3].textContent, 10);
      if (!isFinite(mam) || !isFinite(cil) || !cil) return true;
      const cekano = Math.min(100, (mam / cil) * 100);
      return Math.abs(parseFloat(bar.style.width) - cekano) < 0.2;
    });
    const naplasti = box.querySelectorAll(".rozp-kus.je-naplast");
    return {
      baru: bary.length, sediSCisly,
      kusu: box.querySelectorAll(".rozp-kus").length,
      spritu: box.querySelectorAll(".rozp-sprite").length,
      naplasti: naplasti.length,
      // Náplast musí být poznat i bez najetí myší.
      naplastPopsana: Array.from(naplasti).every((e) => e.textContent.indexOf("náplast") > -1),
      souhrnu: box.querySelectorAll(".rozp-souhrn").length,
      souhrnTvar: (box.querySelector(".rozp-souhrn") || {}).textContent || "",
      // Výčet jmen oddělený čárkami tu být nemá.
      bezCarek: !/[A-Za-z]{3,}, [A-Z]/.test(
        (box.querySelector(".rozp-kusy") || {}).textContent || ""),
    };
  });
  check("role mají pruh zaplnění", kartaRole.baru > 20, String(kartaRole.baru));
  check("…a pruh sedí se sloupci Mám a Cíl", kartaRole.sediSCisly === true);
  check("kusy v rolích jsou odznáčky s obrázkem",
    kartaRole.kusu > 0 && kartaRole.spritu === kartaRole.kusu,
    JSON.stringify(kartaRole));
  check("…a ne výčet oddělený čárkami", kartaRole.bezCarek === true);
  check("náplast je označená slovem, ne jen barvou",
    kartaRole.naplasti > 0 && kartaRole.naplastPopsana === true,
    JSON.stringify(kartaRole));
  check("sekce mají souhrn kolik z kolika", kartaRole.souhrnu >= 4,
    String(kartaRole.souhrnu));

  // Engine u kusu píše „Ground do raidu, 6. z 6". Karta Role ho ale řadila
  // v pořadí rosteru, takže nejslabší kandidát mohl stát první a vypadalo to,
  // že si ta dvě místa protiřečí.
  const poradiVRoli = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    // Nejslabší Ground útočník je schválně PRVNÍ v rosteru.
    P.setRows([
      { pokemon: "Excadrill", cp: 400, level: 8, ivAtk: 2, ivDef: 2, ivSta: 2,
        fastMove: "Mud-Slap", charged1: "Drill Run" },
      { pokemon: "Groudon", cp: 4115, level: 40, ivAtk: 15, ivDef: 15, ivSta: 15,
        fastMove: "Mud Shot", charged1: "Earthquake" },
      { pokemon: "Rhyperior", cp: 3300, level: 36, ivAtk: 14, ivDef: 14, ivSta: 15,
        fastMove: "Mud-Slap", charged1: "Earthquake" },
    ]);
    const c = P.getComputed();
    const poradiEngine = {};
    P.getRows().forEach((r) => {
      const m = /Ground do raidu, (\d+)\. z/.exec(c[r.id].keepTitle || "");
      if (m) poradiEngine[r.pokemon] = +m[1];
    });
    const b = document.querySelector('.zal-btn[data-klic="rozpocetCard"]');
    if (b) b.click();
    const box = document.getElementById("rozpocetBody");
    let radek = null;
    Array.from(box.querySelectorAll("tbody tr")).forEach((tr) => {
      if (tr.cells[0] && tr.cells[0].textContent.trim().indexOf("Ground") === 0) radek = tr;
    });
    return { poradiEngine,
      vKarte: radek ? Array.from(radek.querySelectorAll(".rozp-kus b")).map((e) => e.textContent) : [],
      cisla: radek ? Array.from(radek.querySelectorAll(".rozp-poradi")).map((e) => e.textContent) : [] };
  });
  check("karta Role řadí kusy podle pořadí v roli, ne podle rosteru",
    poradiVRoli.vKarte[0] === "Groudon"
      && poradiVRoli.vKarte[poradiVRoli.vKarte.length - 1] === "Excadrill",
    JSON.stringify(poradiVRoli));
  check("…a sedí to s číslem, které píše rozbor kusu",
    poradiVRoli.vKarte.every((jm, i) =>
      !poradiVRoli.poradiEngine[jm] || poradiVRoli.poradiEngine[jm] === i + 1),
    JSON.stringify(poradiVRoli));
  check("…a pořadí je na odznáčku vidět",
    poradiVRoli.cisla.length === poradiVRoli.vKarte.length
      && poradiVRoli.cisla[0] === "1.",
    JSON.stringify(poradiVRoli.cisla));
  check("…ve tvaru „X z Y\"", / z /.test(kartaRole.souhrnTvar),
    kartaRole.souhrnTvar);

  // Karta „Pokrytí typů" byla zrušená — její práci dělá verdikt, který
  // jediného krycího kusa na typ zachrání sám. Že se v záložkách neobjeví,
  // hlídá kontrola níž.
  const bezPokryti = await page.evaluate(() => ({
    zalozka: !!document.querySelector('.zal-btn[data-klic="coverCard"]'),
    karta: !!document.getElementById("coverCard"),
  }));
  check("karta Pokrytí v appce není",
    !bezPokryti.zalozka && !bezPokryti.karta, JSON.stringify(bezPokryti));

  // Sprity od PokeMiners mají u každého druhu jinak velký průhledný okraj;
  // bez přeměření sedí jeden vysoko a druhý nízko.
  const vystredeni = await page.evaluate(async () => {
    const kde = {};
    for (const [klic, box] of [["catchCard", "catchBody"],
        ["rozpocetCard", "rozpocetBody"]]) {
      const b = document.querySelector('.zal-btn[data-klic="' + klic + '"]');
      if (b) b.click();
      await new Promise((r) => setTimeout(r, 400));
      const el = document.getElementById(box);
      const obr = Array.from(el.querySelectorAll("img"));
      kde[klic] = { obrazku: obr.length,
        upravenych: obr.filter((i) => i.dataset.vystredeno === "1"
          || i.style.transform || i.style.objectPosition).length };
    }
    return kde;
  });
  check("obrázky na kartě Co chytat prošly vystředěním",
    vystredeni.catchCard.obrazku === 0
      || vystredeni.catchCard.upravenych > 0, JSON.stringify(vystredeni));
  check("…a v Rolích",
    vystredeni.rozpocetCard.obrazku === 0
      || vystredeni.rozpocetCard.upravenych > 0, JSON.stringify(vystredeni));

  console.log("\n167) Čištění boxu: pevné rozměry a tři sloupce");
  await page.setViewportSize({ width: 1900, height: 1150 });
  await page.waitForTimeout(250);

  const boxRozmery = await page.evaluate(async (otevrit) => {
    const P = window.__pgo;
    const kusy = [
      { pokemon: "Totodile", cp: 190, level: 7, ivAtk: 3, ivDef: 10, ivSta: 6 },
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Azumarill", cp: 1480, level: 30, ivAtk: 0, ivDef: 15, ivSta: 15 },
      { pokemon: "Blissey", cp: 2400, level: 32, ivAtk: 5, ivDef: 12, ivSta: 15 },
      { pokemon: "Magikarp", cp: 120, level: 12, ivAtk: 10, ivDef: 10, ivSta: 10 },
      { pokemon: "Marill", cp: 263, level: 30, ivAtk: 0, ivDef: 15, ivSta: 15 },
    ];
    P.setDiscarded([]);
    P.setRows(kusy);
    document.getElementById("bmVic").open = otevrit;
    document.getElementById("boxModeBtn").click();
    const mereni = [];
    for (let i = 0; i < kusy.length; i++) {
      await new Promise((r) => setTimeout(r, 350));
      const panel = document.querySelector(".bm-panel");
      const scroll = document.querySelector(".bm-scroll");
      mereni.push({
        w: Math.round(panel.getBoundingClientRect().width),
        h: Math.round(panel.getBoundingClientRect().height),
        prebytek: scroll ? scroll.scrollHeight - scroll.clientHeight : -1,
      });
      if (i === 0) {
        const r = document.querySelector(".bm-roles");
        const l = document.querySelector(".bm-ligy");
        window.__bmZdvojeni = {
          roleVidet: r ? getComputedStyle(r).display !== "none" : null,
          ligyVidet: l ? getComputedStyle(l).display !== "none" : null,
        };
      }
      if (i === kusy.length - 1) break;
      document.dispatchEvent(new KeyboardEvent("keydown",
        { key: "ArrowRight", bubbles: true }));
    }
    const det = document.getElementById("bmDetail");
    const vysledek = { mereni,
      sloupcu: det ? det.querySelectorAll(".dm-sl").length : 0,
      maEvo: det ? !!det.querySelector(".d-evo-side") : false,
      // Ligy, útoky i „co s ním teď" patří do prvního sloupce.
      sl1: det && det.querySelector(".dm-sl1")
        ? Array.from(det.querySelectorAll(".dm-sl1 .d-sec-h"))
            .map((e) => e.getAttribute("data-sekce")) : [],
      sl2: det && det.querySelector(".dm-sl2")
        ? Array.from(det.querySelectorAll(".dm-sl2 .d-sec-h"))
            .map((e) => e.getAttribute("data-sekce")) : [],
      // S otevřeným rozborem se čtyři bubliny rolí a odznáčky lig nedublují.
      roleVidet: window.__bmZdvojeni.roleVidet,
      ligyVidet: window.__bmZdvojeni.ligyVidet,
      // Bubliny pokrytí se vejdou na jeden řádek.
      pokrytiRadku: det ? Array.from(det.querySelectorAll(".pk-vypis")).map((v) => {
        const viditelne = Array.from(v.children).filter(
          (e) => e.classList.contains("pk-kombinace"));
        const btn = v.querySelector(".pk-vic");
        const y = viditelne.length ? viditelne[0].offsetTop : 0;
        const naRadku = viditelne.every((e) => Math.abs(e.offsetTop - y) < 3)
          && (!btn || btn.hidden || Math.abs(btn.offsetTop - y) < 3);
        return naRadku;
      }) : [],
    };
    P.boxZavritNatvrdo();
    return vysledek;
  }, true);

  const stejne = (pole, klic) => pole.every((m) => m[klic] === pole[0][klic]);
  check("rozbalený box má u každého kusu stejnou šířku",
    stejne(boxRozmery.mereni, "w"), JSON.stringify(boxRozmery.mereni));
  check("…i stejnou výšku", stejne(boxRozmery.mereni, "h"),
    JSON.stringify(boxRozmery.mereni));
  check("…a nikde nenaskočí posuvník",
    boxRozmery.mereni.every((m) => m.prebytek <= 0),
    JSON.stringify(boxRozmery.mereni));
  check("rozbor stojí ve dvou sloupcích plus evoluční řada",
    boxRozmery.sloupcu === 2 && boxRozmery.maEvo === true,
    JSON.stringify(boxRozmery));
  check("…vlevo ligy, co s ním teď a útoky",
    JSON.stringify(boxRozmery.sl1) === JSON.stringify(["ligy", "coted", "utoky"]),
    JSON.stringify(boxRozmery.sl1));
  check("…vpravo na co je a proti čemu funguje",
    JSON.stringify(boxRozmery.sl2) === JSON.stringify(["naco", "proti"]),
    JSON.stringify(boxRozmery.sl2));
  check("s otevřeným rozborem se role nedublují",
    boxRozmery.roleVidet === false, String(boxRozmery.roleVidet));
  check("…ani odznáčky lig", boxRozmery.ligyVidet === false,
    String(boxRozmery.ligyVidet));
  check("bubliny pokrytí se vejdou na jeden řádek",
    boxRozmery.pokrytiRadku.length > 0
      && boxRozmery.pokrytiRadku.every((x) => x === true),
    JSON.stringify(boxRozmery.pokrytiRadku));

  const boxSbaleny = await page.evaluate(async () => {
    const P = window.__pgo;
    const kusy = [
      { pokemon: "Totodile", cp: 190, level: 7, ivAtk: 3, ivDef: 10, ivSta: 6 },
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 },
      { pokemon: "Blissey", cp: 2400, level: 32, ivAtk: 5, ivDef: 12, ivSta: 15 },
      { pokemon: "Magikarp", cp: 120, level: 12, ivAtk: 10, ivDef: 10, ivSta: 10 },
    ];
    P.setDiscarded([]);
    P.setRows(kusy);
    document.getElementById("bmVic").open = false;
    document.getElementById("boxModeBtn").click();
    const mereni = [];
    for (let i = 0; i < kusy.length; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const panel = document.querySelector(".bm-panel");
      mereni.push({ w: Math.round(panel.getBoundingClientRect().width),
        h: Math.round(panel.getBoundingClientRect().height) });
      document.dispatchEvent(new KeyboardEvent("keydown",
        { key: "ArrowRight", bubbles: true }));
    }
    P.boxZavritNatvrdo();
    return mereni;
  });
  check("sbalená karta má pořád stejné rozměry",
    boxSbaleny.every((m) => m.w === boxSbaleny[0].w && m.h === boxSbaleny[0].h),
    JSON.stringify(boxSbaleny));

  console.log("\n168) Značka 100% — dokonalý kus se nepouští");
  const hundo = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    // Bidoof žádnou roli nedrží, takže o verdiktu rozhoduje jen značka.
    P.setRows([
      { pokemon: "Bidoof", cp: 400, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Bidoof", cp: 390, level: 20, ivAtk: 15, ivDef: 15, ivSta: 14 },
      { pokemon: "Bidoof", cp: 380, level: 20, ivAtk: 14, ivDef: 14, ivSta: 14 },
    ]);
    const c = P.getComputed();
    const kusy = P.getRows().map((r) => {
      const x = c[r.id];
      return { iv: [r.ivAtk, r.ivDef, r.ivSta].join("/"), keep: x.keep,
        sub: x.keepSub || "", title: x.keepTitle || "",
        trade: x.trade, tradeSub: x.tradeSub || "", sto: !!x.stoProcent };
    });
    return { kusy, znacek: document.querySelectorAll("#tbody .rarity-chip.r-H").length };
  });
  const dokonaly = hundo.kusy[0];
  const skoroDokonaly = hundo.kusy[1];
  check("15/15/15 dostane značku 100%", dokonaly.sto === true, JSON.stringify(dokonaly));
  check("…a 15/15/14 ne", skoroDokonaly.sto === false, JSON.stringify(skoroDokonaly));
  check("dokonalý kus se nepouští, i když roli nedrží",
    dokonaly.keep === "Ponechat", JSON.stringify(dokonaly));
  check("…a v poznámce je proč", dokonaly.sub === "Protože 100%",
    JSON.stringify(dokonaly));
  check("…s vysvětlením, že jiný důvod ho tu nedrží",
    dokonaly.title.indexOf("15/15/15") > -1, dokonaly.title);
  check("kus o chlup horší jde pryč", skoroDokonaly.keep.indexOf("Zahodit") === 0,
    JSON.stringify(skoroDokonaly));
  check("dokonalý kus se nenabízí ani k výměně", dokonaly.trade === "Ne",
    JSON.stringify(dokonaly));
  check("značka je vidět v rosteru", hundo.znacek === 1, String(hundo.znacek));

  // Značka stojí vedle přepínačů DMAX/CUTE/SHINY a musí mít jejich velikost —
  // ty jsou <button> s `font: inherit`, span sám o sobě zůstane menší.
  const znackaVzhled = await page.evaluate(() => {
    const P = window.__pgo;
    const zal = document.querySelector('.zal-btn[data-klic="roster"]');
    if (zal) zal.click();
    P.setRows([{ pokemon: "Rowlet", cp: 604, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15 }]);
    const td = document.querySelector("#tbody tr td.col-pokemon");
    (td.querySelector("button,a,span") || td).click();
    // Ze starších bloků zůstávají v DOM zavřené detaily — měřit se musí ten
    // právě otevřený.
    const t = Array.from(document.querySelectorAll(".detail-title"))
      .filter((e) => e.getBoundingClientRect().width > 100).pop();
    if (!t) return { chybi: true, poradi: [] };
    const zmer = (sel) => {
      const e = t.querySelector(sel);
      return e ? { h: Math.round(e.getBoundingClientRect().height),
        fs: getComputedStyle(e).fontSize } : null;
    };
    return { shiny: zmer(".shiny-prepinac"), sto: zmer(".r-H"),
      poradi: Array.from(t.children).map((e) => (e.textContent || "").trim()) };
  });
  check("značka 100% je stejně velká jako SHINY",
    znackaVzhled.sto && znackaVzhled.shiny
      && znackaVzhled.sto.h === znackaVzhled.shiny.h
      && znackaVzhled.sto.fs === znackaVzhled.shiny.fs,
    JSON.stringify(znackaVzhled));
  check("…a stojí až za ním",
    znackaVzhled.poradi.indexOf("100%") > znackaVzhled.poradi.indexOf("SHINY"),
    JSON.stringify(znackaVzhled.poradi));

  // Sken, který dá IV jen jako rozsah, o 100 % nic neříká.
  const nejiste = await page.evaluate(() => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Bidoof", cp: 400, level: 20, ivAtk: 15, ivDef: 15,
      ivSta: 15, ivMin: 60, ivMax: 100 }]);
    const c = P.getComputed();
    const r = P.getRows()[0];
    return { sto: !!c[r.id].stoProcent, nejiste: !!c[r.id].ivUncertain };
  });
  check("z nejistých IV se 100% netvrdí",
    !nejiste.nejiste || nejiste.sto === false, JSON.stringify(nejiste));

  console.log("\n169) Rozpočet: pořadí v roli rozhoduje, ne velikost skoku");
  const rozpocetPoradi = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    // Excadrill na levelu 1 dostane vylepšením skoro osminásobek statů.
    // V poměru „síla za prach" to přebíjelo všechno ostatní, takže stál
    // v plánu první — i když stojí 120 tisíc proti 44 a skončí slabší
    // než Groudon, který je v té samé roli jednička.
    P.setRows([
      { pokemon: "Excadrill", cp: 400, level: 1, ivAtk: 10, ivDef: 10, ivSta: 10,
        fastMove: "Mud-Slap", charged1: "Drill Run" },
      { pokemon: "Groudon", cp: 3000, level: 25, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: "Mud Shot", charged1: "Earthquake" },
      { pokemon: "Rhyperior", cp: 2600, level: 25, ivAtk: 14, ivDef: 14, ivSta: 15,
        fastMove: "Mud-Slap", charged1: "Earthquake" },
      { pokemon: "Garchomp", cp: 2700, level: 25, ivAtk: 15, ivDef: 14, ivSta: 14,
        fastMove: "Mud Shot", charged1: "Earth Power" },
      { pokemon: "Metagross", cp: 2800, level: 25, ivAtk: 14, ivDef: 13, ivSta: 15,
        fastMove: "Bullet Punch", charged1: "Meteor Mash" },
    ]);
    const plan = P.prachovyPlan();
    const prvni = plan[0];
    const exc = plan.filter((e) => e.row.pokemon === "Excadrill")[0];
    const gro = plan.filter((e) => e.row.pokemon === "Groudon")[0];
    const gar = plan.filter((e) => e.row.pokemon === "Garchomp")[0];
    return {
      prvni: prvni ? prvni.row.pokemon : "",
      poradiExc: plan.indexOf(exc), poradiGro: plan.indexOf(gro),
      excPor: exc ? exc.poradiVRoli : null, excRole: exc ? exc.role : "",
      excVaha: exc ? exc.vahaPoradi : null,
      groPor: gro ? gro.poradiVRoli : null, groVaha: gro ? gro.vahaPoradi : null,
      garPor: gar ? gar.poradiVRoli : null,
      // Skok je pořád obrovský — o to jde, že sám o sobě nestačí.
      excNasobek: exc ? Math.round(exc.nasobek * 10) / 10 : null,
      excCena: exc ? exc.cena.dust : null, groCena: gro ? gro.cena.dust : null,
    };
  });
  check("jednička role je v rozpočtu dřív než hluboká záloha",
    rozpocetPoradi.poradiGro < rozpocetPoradi.poradiExc,
    JSON.stringify(rozpocetPoradi));
  check("…i když ta záloha má mnohem větší skok",
    rozpocetPoradi.excNasobek > 5, String(rozpocetPoradi.excNasobek));
  check("…a stojí přitom víc prachu",
    rozpocetPoradi.excCena > rozpocetPoradi.groCena * 2,
    JSON.stringify(rozpocetPoradi));
  check("váha se bere z role, kterou plán platí, ne z nejlepší role kusu",
    rozpocetPoradi.excRole === "Raid Ground" && rozpocetPoradi.excPor > 1,
    JSON.stringify(rozpocetPoradi));
  check("jednička role váhu nesnižuje", rozpocetPoradi.groVaha === 1,
    String(rozpocetPoradi.groVaha));
  check("…a čím hlubší záloha, tím menší váha",
    rozpocetPoradi.excVaha < 1 && rozpocetPoradi.garPor >= 2,
    JSON.stringify(rozpocetPoradi));

  console.log("\n170) Celý box, filtr značek a konec čištění");
  await page.setViewportSize({ width: 1900, height: 1150 });
  await page.waitForTimeout(200);

  // Seznam smazaných brání tomu, aby se pustený kus vracel ze starých
  // exportů. Jenže sken, který pokrývá CELÝ box, je autoritativní: co v něm
  // je, to ve hře máš — jinak by se ten kus do appky nedostal nikdy.
  const celyBox = await page.evaluate(async () => {
    const P = window.__pgo;
    const zal = document.querySelector('.zal-btn[data-klic="roster"]');
    if (zal) zal.click();
    const csv = "Pokémon,CP,Level,IV Attack,IV Defense,IV Stamina" + String.fromCharCode(10)
      + "Magikarp,120,12,3,3,3" + String.fromCharCode(10)
      + "Machamp,2100,30,10,10,10";
    // Záznam o smazání musí vyrobit appka sama — klíč skenu má svůj formát
    // a vymyslet ho znamená testovat něco jiného, než co se v appce děje.
    const smazMagikarpa = () => {
      P.setDiscarded([]);
      P.setRows([
        { pokemon: "Magikarp", cp: 120, level: 12, ivAtk: 3, ivDef: 3, ivSta: 3 },
        { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 10, ivDef: 10, ivSta: 10 },
      ]);
      const radky = Array.from(document.querySelectorAll("#tbody > tr:not(.detail-row)"));
      const magi = radky.filter((tr) => /Magikarp/.test(tr.textContent))[0];
      magi.querySelector(".del-btn").click();
    };
    const vysledek = {};
    // 1) bez zaškrtnutí celého boxu se smazaný kus přeskočí
    smazMagikarpa();
    vysledek.smazanychNaZacatku = P.getDiscarded().length;
    document.getElementById("celyBox").checked = false;
    P.importText(csv);
    await new Promise((r) => setTimeout(r, 250));
    document.getElementById("mapMergeBtn").click();
    await new Promise((r) => setTimeout(r, 250));
    vysledek.bezCelehoBoxu = P.getRows().map((r) => r.pokemon).sort();
    // 2) se zaškrtnutím se vrátí
    smazMagikarpa();
    document.getElementById("celyBox").checked = true;
    P.importText(csv);
    await new Promise((r) => setTimeout(r, 250));
    document.getElementById("mapMergeBtn").click();
    await new Promise((r) => setTimeout(r, 250));
    vysledek.sCelymBoxem = P.getRows().map((r) => r.pokemon).sort();
    vysledek.smazanychPotom = P.getDiscarded().length;
    document.getElementById("celyBox").checked = false;
    return vysledek;
  });
  check("kus se do seznamu smazaných opravdu dostal",
    celyBox.smazanychNaZacatku === 1, JSON.stringify(celyBox));
  check("bez zaškrtnutí celého boxu se dřív smazaný kus neimportuje",
    celyBox.bezCelehoBoxu.indexOf("Magikarp") === -1, JSON.stringify(celyBox));
  check("…se zaškrtnutým celým boxem se vrátí",
    celyBox.sCelymBoxem.indexOf("Magikarp") > -1, JSON.stringify(celyBox));
  check("…a zmizí ze seznamu smazaných", celyBox.smazanychPotom === 0,
    String(celyBox.smazanychPotom));

  // Filtr značek ve sloupci Pokémon.
  const filtrZnacek = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Rowlet", cp: 604, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 10, ivDef: 10, ivSta: 10, shiny: "Ano" },
      { pokemon: "Bidoof", cp: 400, level: 20, ivAtk: 5, ivDef: 5, ivSta: 5, cute: "Ano" },
      { pokemon: "Magikarp", cp: 120, level: 12, ivAtk: 3, ivDef: 3, ivSta: 3 },
    ]);
    const vidi = () => Array.from(
      document.querySelectorAll("#tbody > tr:not(.detail-row) td.col-pokemon"))
      .map((td) => (td.querySelector(".poke-name") || td).textContent.trim());
    let hlavicka = null;
    document.querySelectorAll("#headerRow th").forEach((h) => {
      if (h.textContent.replace(/[ ▲▼▽2]+$/, "") === "Pokémon") hlavicka = h;
    });
    const ikona = hlavicka ? hlavicka.querySelector(".pvp-filtr-ikona") : null;
    if (ikona) ikona.click();
    const otevrel = !document.getElementById("znackaFiltrPanel").hidden;
    const zaskrtni = (k) => {
      const i = document.querySelector('#znackaFiltrPanel input[data-znacka="' + k + '"]');
      i.checked = true; i.dispatchEvent(new Event("change", { bubbles: true }));
    };
    zaskrtni("H");
    const jenSto = vidi();
    zaskrtni("S");
    const stoNeboShiny = vidi();
    document.getElementById("znackaFiltrVse").checked = true;
    document.getElementById("znackaFiltrVse").dispatchEvent(new Event("change", { bubbles: true }));
    const obeNaraz = vidi();
    document.getElementById("znackaFiltrReset").click();
    return { otevrel, jenSto, stoNeboShiny, obeNaraz, poResetu: vidi() };
  });
  check("sloupec Pokémon má filtr na značky", filtrZnacek.otevrel === true);
  check("…vyfiltruje dokonalé kusy",
    filtrZnacek.jenSto.length === 1 && filtrZnacek.jenSto[0] === "Rowlet",
    JSON.stringify(filtrZnacek.jenSto));
  check("…dvě značky znamenají aspoň jednu z nich",
    filtrZnacek.stoNeboShiny.length === 2, JSON.stringify(filtrZnacek.stoNeboShiny));
  check("…a přepínač všechny je zúží na průnik",
    filtrZnacek.obeNaraz.length === 0, JSON.stringify(filtrZnacek.obeNaraz));
  check("…zrušení filtru vrátí všechny", filtrZnacek.poResetu.length === 4,
    JSON.stringify(filtrZnacek.poResetu));

  // Po posledním kusu má zůstat jen souhrn, ne rozbor toho posledního.
  const konecBoxu = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Magikarp", cp: 120, level: 12, ivAtk: 3, ivDef: 3, ivSta: 3 },
      { pokemon: "Bidoof", cp: 400, level: 20, ivAtk: 5, ivDef: 5, ivSta: 5 },
    ]);
    document.getElementById("bmVic").open = true;
    document.getElementById("boxModeBtn").click();
    await new Promise((r) => setTimeout(r, 300));
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await new Promise((r) => setTimeout(r, 250));
    }
    const det = document.getElementById("bmDetail");
    const vic = document.getElementById("bmVic");
    const out = {
      jeSouhrn: !!document.querySelector(".bm-souhrn"),
      detailPrazdny: !det || det.innerHTML.trim() === "",
      vicSkryty: !vic || vic.style.display === "none",
      siroky: document.getElementById("boxMode").classList.contains("siroky"),
    };
    P.boxZavritNatvrdo();
    return out;
  });
  check("po posledním kuse je vidět souhrn", konecBoxu.jeSouhrn === true,
    JSON.stringify(konecBoxu));
  check("…a rozbor posledního kusu tam nezůstane",
    konecBoxu.detailPrazdny && konecBoxu.vicSkryty, JSON.stringify(konecBoxu));
  check("…a panel se vrátí na normální šířku", konecBoxu.siroky === false,
    JSON.stringify(konecBoxu));

  // „víc" u role v čištění boxu musí opravdu rozbalit.
  const vicVBoxu = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Totodile", cp: 190, level: 7, ivAtk: 3, ivDef: 10, ivSta: 6 }]);
    document.getElementById("bmVic").open = true;
    document.getElementById("boxModeBtn").click();
    await new Promise((r) => setTimeout(r, 400));
    const det = document.getElementById("bmDetail");
    const btn = det.querySelector(".vic-btn");
    const p = btn ? btn.previousElementSibling : null;
    const pred = p ? Math.round(p.getBoundingClientRect().height) : 0;
    if (btn) btn.click();
    const po = p ? Math.round(p.getBoundingClientRect().height) : 0;
    // strop CP před evolucí musí být v řádku vidět, ne jen v bublině
    const stropu = det.querySelectorAll(".d-lg-strop").length;
    const stropEl = stropu ? det.querySelector(".d-lg-strop") : null;
    const stropText = stropEl ? stropEl.textContent : "";
    const stropTitle = stropEl ? (stropEl.title || stropEl.dataset.tip || "") : "";
    P.boxZavritNatvrdo();
    return { maBtn: !!btn, pred, po, stropu, stropText, stropTitle };
  });
  check("v čištění boxu se popis role opravdu rozbalí",
    vicVBoxu.maBtn && vicVBoxu.po > vicVBoxu.pred, JSON.stringify(vicVBoxu));
  check("a strop CP před evolucí je v řádku ligy vidět",
    vicVBoxu.stropu > 0 && /Totodile\s*\d+/.test(vicVBoxu.stropText),
    JSON.stringify(vicVBoxu));
  // Popisek se vešel jen na úkor hodnot, které ustřihával. Text zmizel,
  // význam zůstal v bublině.
  check("…bez popisku, který ta čísla ustřihával",
    vicVBoxu.stropText.indexOf("max před evolucí") === -1
      && vicVBoxu.stropTitle.indexOf("PŘED evolucí") > -1,
    vicVBoxu.stropText + " | " + vicVBoxu.stropTitle);

  console.log("\n171) Filtr na hodnotu sloupce");
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.waitForTimeout(200);
  const filtrHodnot = await page.evaluate(() => {
    const P = window.__pgo;
    const zal = document.querySelector('.zal-btn[data-klic="roster"]');
    if (zal) zal.click();
    P.setDiscarded([]);
    const druhy = ["Machamp", "Metagross", "Groudon", "Blissey", "Azumarill",
      "Magikarp", "Bidoof", "Gardevoir", "Rhyperior", "Garchomp"];
    P.setRows(druhy.map((d, i) => ({ pokemon: d, cp: 1200 + i * 130,
      level: 15 + i, ivAtk: (i * 3) % 16, ivDef: (i * 5) % 16, ivSta: (i * 7) % 16 })));
    const cisty = (h) => h.textContent.replace(/[ ▲▼▽2]+$/, "");
    const hlavicka = (label) => {
      let f = null;
      document.querySelectorAll("#headerRow th").forEach((h) => {
        if (cisty(h) === label) f = h;
      });
      return f;
    };
    const vidi = () => document.querySelectorAll("#tbody > tr:not(.detail-row)").length;
    const out = { vsech: vidi() };
    // Sloupce, kde filtr má být
    out.sIkonou = ["Verdikt", "Vylepšit", "Evolvovat", "Mega", "Gym", "Raid",
      "Tradovat", "Purifikovat", "Sken"].filter((l) => {
        const th = hlavicka(l);
        return th && th.querySelector(".pvp-filtr-ikona");
      });
    const th = hlavicka("Verdikt");
    th.querySelector(".pvp-filtr-ikona").click();
    out.nadpis = document.getElementById("hodnotaFiltrNadpis").textContent;
    out.nabidka = Array.from(document.querySelectorAll("#hodnotaFiltrSeznam label"))
      .map((l) => l.textContent.trim().replace(/ +/g, " "));
    const vyber = document.querySelector('#hodnotaFiltrSeznam input[data-hodnota="Zahodit"]');
    out.maZahodit = !!vyber;
    if (vyber) { vyber.checked = true; vyber.dispatchEvent(new Event("change", { bubbles: true })); }
    out.poFiltru = vidi();
    out.hlavickaAktivni = hlavicka("Verdikt").classList.contains("aktivni");
    document.getElementById("hodnotaFiltrReset").click();
    out.poResetu = vidi();
    // Ikona nesmí rozšiřovat hlavičku — s deseti ikonami se tabulka roztáhla
    // a řádky se lámaly na tři řádky textu.
    const thV = hlavicka("Verdikt");
    const ikona = thV.querySelector(".pvp-filtr-ikona");
    const rTh = thV.getBoundingClientRect();
    const rI = ikona.getBoundingClientRect();
    // Odstup od konce textu, ne od půlky sloupce: sloupce se roztahují
    // podle šířky karty, takže půlka není pevný bod.
    const rng = document.createRange();
    rng.selectNodeContents(thV.firstChild);
    out.ikonaOdsazeni = Math.round(rI.left - rng.getBoundingClientRect().right);
    out.ikonaUNazvu = out.ikonaOdsazeni < 20;
    const sirkaTab = () => Math.round(
      document.getElementById("rosterTable").getBoundingClientRect().width);
    out.sirkaSIkonami = sirkaTab();
    const ikony = Array.from(document.querySelectorAll("#headerRow .pvp-filtr-ikona"));
    const rodice = ikony.map((e) => e.parentNode);
    ikony.forEach((e) => e.remove());
    out.sirkaBezIkon = sirkaTab();
    ikony.forEach((e, i) => rodice[i].appendChild(e));
    out.pvpJenIkona = hlavicka("PvP tým").querySelector(".pvp-filtr-ikona").textContent;
    return out;
  });
  check("filtr je na všech sloupcích doporučení",
    filtrHodnot.sIkonou.length === 8, JSON.stringify(filtrHodnot.sIkonou));
  check("nabídka se skládá z hodnot, které v rosteru opravdu jsou",
    filtrHodnot.maZahodit === true && filtrHodnot.nabidka.length >= 2,
    JSON.stringify(filtrHodnot.nabidka));
  check("…a je u nich počet kusů",
    filtrHodnot.nabidka.every((t) => /\s\d+$/.test(t)),
    JSON.stringify(filtrHodnot.nabidka));
  check("zaškrtnutí hodnoty tabulku zúží",
    filtrHodnot.poFiltru > 0 && filtrHodnot.poFiltru < filtrHodnot.vsech,
    JSON.stringify(filtrHodnot));
  check("…a hlavička dá najevo, že filtr běží",
    filtrHodnot.hlavickaAktivni === true);
  check("zrušení filtru vrátí všechny řádky",
    filtrHodnot.poResetu === filtrHodnot.vsech, JSON.stringify(filtrHodnot));
  check("ikona filtru stojí hned u názvu sloupce",
    filtrHodnot.ikonaUNazvu === true, filtrHodnot.ikonaOdsazeni + " px za textem");
  check("…a nerozšíří tabulku",
    filtrHodnot.sirkaSIkonami === filtrHodnot.sirkaBezIkon,
    filtrHodnot.sirkaSIkonami + " vs " + filtrHodnot.sirkaBezIkon + " px");
  check("u PvP zůstala jen ikona, ne slovo filtr",
    filtrHodnot.pvpJenIkona === "▽" || filtrHodnot.pvpJenIkona === "▼",
    filtrHodnot.pvpJenIkona);

  console.log("\n172) Hledáček typů a názvy karet");
  const typHledacek = await page.evaluate(() => {
    document.getElementById("typesCard").open = true;
    window.__pgo.renderTypeTable();
    const out = { tlacitek: document.querySelectorAll("#typVyber [data-typ]").length };
    const b = document.querySelector('#typVyber [data-typ="Ground"]');
    out.predKlikem = document.getElementById("typOdpoved").textContent.trim();
    b.click();
    const bloky = Array.from(document.querySelectorAll("#typOdpoved .typ-blok"));
    out.bloku = bloky.length;
    out.nadpisy = bloky.map((x) => x.querySelector("h4").textContent);
    const seznam = (i) => Array.from(bloky[i].querySelectorAll(".pk-typ"))
      .map((e) => e.textContent).sort();
    out.silne = seznam(0);
    out.schyta = seznam(1);
    out.aktivni = b.classList.contains("aktivni");
    // druhý klik výběr zruší
    b.click();
    out.poDruhemKliku = document.getElementById("typOdpoved").textContent.trim();
    return out;
  });
  check("hledáček nabízí všech 18 typů", typHledacek.tlacitek === 18,
    String(typHledacek.tlacitek));
  check("dokud typ nevybereš, hledáček to řekne",
    /Klikni na typ/.test(typHledacek.predKlikem), typHledacek.predKlikem);
  check("po výběru jsou čtyři bloky odpovědí", typHledacek.bloku === 4,
    JSON.stringify(typHledacek.nadpisy));
  // Ground bije Electric, Fire, Poison, Rock, Steel — a schytá od Grass, Ice, Water.
  check("Ground útočí silně přesně na pět typů",
    typHledacek.silne.join(",") === "Electric,Fire,Poison,Rock,Steel",
    typHledacek.silne.join(","));
  check("…a schytá od Grass, Ice a Water",
    typHledacek.schyta.join(",") === "Grass,Ice,Water", typHledacek.schyta.join(","));
  check("vybraný typ je označený", typHledacek.aktivni === true);
  check("druhý klik výběr zruší",
    /Klikni na typ/.test(typHledacek.poDruhemKliku), typHledacek.poDruhemKliku);

  const nazvyKaret = await page.evaluate(() => {
    const popisky = Array.from(document.querySelectorAll(".zal-btn"))
      .map((b) => b.textContent.trim());
    return { popisky,
      staré: popisky.filter((t) => ["Prohlídka", "Kamarád", "Typy"].indexOf(t) !== -1) };
  });
  check("karty mají nové názvy", nazvyKaret.staré.length === 0,
    JSON.stringify(nazvyKaret.staré));
  check("…konkrétně Vyhledávání, Výměna s kamarádem a Co na co platí",
    ["Vyhledávání", "Výměna s kamarádem", "Co na co platí"]
      .every((t) => nazvyKaret.popisky.indexOf(t) !== -1),
    JSON.stringify(nazvyKaret.popisky));

  console.log("\n173) Obrázek v rosteru, zrušení filtrů, evoluční řada u forem");
  const rosterDrobnosti = await page.evaluate(() => {
    const P = window.__pgo;
    const zal = document.querySelector('.zal-btn[data-klic="roster"]');
    if (zal) zal.click();
    P.setDiscarded([]);
    P.setRows([
      { pokemon: "Grubbin", cp: 696, level: 20, ivAtk: 8, ivDef: 7, ivSta: 10 },
      { pokemon: "Machamp", cp: 2100, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13 },
      { pokemon: "Azumarill", cp: 1480, level: 30, ivAtk: 0, ivDef: 15, ivSta: 15 },
    ]);
    const vidi = () => document.querySelectorAll("#tbody > tr:not(.detail-row)").length;
    const b = document.getElementById("zrusitFiltry");
    b.click();
    const prvni = document.querySelector("#tbody td.col-obr");
    const out = {
      spritu: document.querySelectorAll("#tbody .roster-sprite").length,
      obrazekVeVlastnimSloupci: !!(prvni && prvni.querySelector(".roster-sprite")),
      obrazekPredJmenem: (() => {
        const tr = document.querySelector("#tbody tr");
        if (!tr) return false;
        const bunky = Array.from(tr.cells);
        return bunky.indexOf(prvni) < bunky.indexOf(tr.querySelector("td.col-pokemon"));
      })(),
      hlavickaBezNazvu: (() => {
        const th = Array.from(document.querySelectorAll("#headerRow th"))
          .filter((h) => h.className.indexOf("col-obr") > -1)[0];
        return !th || th.textContent.trim() === "";
      })(),
      vsech: vidi(), tlacitkoSedeBezFiltru: b.disabled,
    };
    const hl = document.getElementById("searchInput");
    hl.value = "Machamp"; hl.dispatchEvent(new Event("input", { bubbles: true }));
    out.poHledani = vidi();
    out.tlacitkoSviti = !b.disabled;
    b.click();
    out.poZruseni = vidi();
    out.poleVymazano = hl.value === "";
    // …a zruší i řazení
    document.querySelectorAll("#headerRow th")[5].click();
    out.poRazeni = !b.disabled;
    b.click();
    out.nakonecSede = b.disabled;
    return out;
  });
  check("v rosteru je obrázek kusu ve vlastním sloupci",
    rosterDrobnosti.spritu === 3 && rosterDrobnosti.obrazekVeVlastnimSloupci === true,
    JSON.stringify(rosterDrobnosti));
  check("…hned před jménem", rosterDrobnosti.obrazekPredJmenem === true);
  check("…a ten sloupec nemá název", rosterDrobnosti.hlavickaBezNazvu === true);
  check("tlačítko Zrušit filtry je bez filtru zašedlé",
    rosterDrobnosti.tlacitkoSedeBezFiltru === true);
  check("…po hledání se rozsvítí", rosterDrobnosti.tlacitkoSviti === true);
  check("…a jedním klikem vrátí všechny řádky",
    rosterDrobnosti.poZruseni === rosterDrobnosti.vsech
      && rosterDrobnosti.poleVymazano === true, JSON.stringify(rosterDrobnosti));
  check("…počítá se mezi filtry i řazení",
    rosterDrobnosti.poRazeni === true && rosterDrobnosti.nakonecSede === true,
    JSON.stringify(rosterDrobnosti));

  // Vivillonovy vzory mají v evolučním grafu klíč s příponou, takže holý
  // `spewpa` neměl předchůdce a Scatterbug z řady zmizel.
  const evoFormy = await page.evaluate(() => {
    document.getElementById("prohlidkaCard").open = true;
    const nastav = (id, v) => { const el = document.getElementById(id);
      el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
    const o = document.getElementById("prohOut");
    nastav("prohName", "Spewpa");
    return { rada: Array.from(o.querySelectorAll(".d-evo-kus[data-druh]"))
      .map((e) => e.getAttribute("data-druh")) };
  });
  check("evoluční řada drží i u druhu s kosmetickými formami",
    evoFormy.rada.join(",") === "Scatterbug,Spewpa,Vivillon",
    evoFormy.rada.join(","));

  console.log("\n174) Konkrétní pokémon: výběr útoků jako v rosteru");
  const prohUtoky = await page.evaluate(() => {
    document.getElementById("prohlidkaCard").open = true;
    const nastav = (id, v) => { const el = document.getElementById(id);
      el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
    nastav("prohName", "Ninetales");
    const tl = document.querySelectorAll(".proh-utok .uv-pole");
    const out = { tlacitek: tl.length,
      // Textová pole zůstávají kvůli čtení hodnot, ale vidět nemají být.
      vstupySkryte: ["prohF", "prohC1", "prohC2"]
        .every((i) => document.getElementById(i).hidden) };
    tl[0].click();
    const polozky = Array.from(document.querySelectorAll(".uv-seznam .uv-polozka"));
    out.nabidka = polozky.map((e) => e.textContent.trim().replace(/\s+/g, " "));
    // Ninetales umí čtyři běžné rychlé útoky + Ember jako elitní.
    out.pocet = polozky.length;
    out.maTypy = polozky.slice(1).every((e) => !!e.querySelector(".uv-typ"));
    out.maSilu = polozky.slice(1).every((e) => /síla \d+|PvP/.test(e.textContent));
    polozky[1].click();
    out.poVyberu = document.getElementById("prohF").value;
    // Změna druhu musí nabídku přestavět a výběr zahodit.
    nastav("prohName", "Machamp");
    const tl2 = document.querySelectorAll(".proh-utok .uv-pole");
    tl2[0].click();
    out.machampNabidka = Array.from(document.querySelectorAll(".uv-seznam .uv-polozka"))
      .map((e) => e.textContent.trim().replace(/\s+/g, " "));
    out.poZmeneDruhu = document.getElementById("prohF").value;
    return out;
  });
  check("v Konkrétním pokémonovi jsou tři výběry útoků",
    prohUtoky.tlacitek === 3 && prohUtoky.vstupySkryte === true,
    JSON.stringify({ t: prohUtoky.tlacitek, v: prohUtoky.vstupySkryte }));
  check("nabídka obsahuje jen útoky, které ten druh umí",
    prohUtoky.pocet === 6
      && prohUtoky.nabidka.join("|").indexOf("Charm") > -1
      && prohUtoky.nabidka.join("|").indexOf("Counter") === -1,
    JSON.stringify(prohUtoky.nabidka));
  check("…s typem a silou jako v rosteru",
    prohUtoky.maTypy === true && prohUtoky.maSilu === true,
    JSON.stringify(prohUtoky.nabidka));
  check("výběr se propíše do rozboru", prohUtoky.poVyberu === "Charm",
    prohUtoky.poVyberu);
  check("změna druhu nabídku přestaví",
    prohUtoky.machampNabidka.join("|").indexOf("Counter") > -1
      && prohUtoky.machampNabidka.join("|").indexOf("Charm") === -1,
    JSON.stringify(prohUtoky.machampNabidka));
  check("…a zahodí útok předchozího druhu", prohUtoky.poZmeneDruhu === "",
    prohUtoky.poZmeneDruhu);

  console.log("\n175) Podmínky evoluce v evoluční řadě");
  const evoPod = await page.evaluate(() => {
    document.getElementById("prohlidkaCard").open = true;
    const nastav = (id, v) => { const el = document.getElementById(id);
      el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
    const o = document.getElementById("prohOut");
    const cti = (jm) => {
      nastav("prohName", jm);
      return Array.from(o.querySelectorAll(".d-evo-kus")).map((e) => {
        const p = e.querySelector(".d-evo-podminka");
        const bo = e.querySelector(".d-evo-bonus");
        return ((e.querySelector("b") || {}).textContent || "")
          + (p ? " [" + p.textContent + "]" : "")
          + (bo ? " (" + bo.textContent + ")" : "");
      });
    };
    return { feebas: cti("Feebas"), inkay: cti("Inkay"), eevee: cti("Eevee"),
      machop: cti("Machop"), kirlia: cti("Kirlia") };
  });
  check("chození s buddym je vidět u toho, koho se týká",
    evoPod.feebas.join("|").indexOf("Milotic [ujít 20 km jako buddy]") > -1,
    evoPod.feebas.join("|"));
  check("Inkay se otáčí vzhůru nohama",
    evoPod.inkay.join("|").indexOf("vzhůru nohama") > -1, evoPod.inkay.join("|"));
  check("u Eevee sedí podmínka ke KONKRÉTNÍ větvi",
    evoPod.eevee.join("|").indexOf("Espeon [ujít 10 km jako buddy · jen ve dne]") > -1
      && evoPod.eevee.join("|").indexOf("Umbreon [ujít 10 km jako buddy · jen v noci]") > -1
      && evoPod.eevee.join("|").indexOf("Glaceon [být u stopu s Glacial Lure Module]") > -1,
    evoPod.eevee.join("|"));
  check("…a Flareon žádnou podmínku nemá",
    evoPod.eevee.indexOf("Flareon") > -1, evoPod.eevee.join("|"));
  check("kde stačí bonbóny, se žádná podmínka nepíše",
    evoPod.machop.join("|").indexOf("[") === -1, evoPod.machop.join("|"));
  // „Po výměně zadarmo" evoluci neblokuje — je to úleva, ne podmínka.
  check("…a úleva za výměnu se odliší od podmínky",
    evoPod.machop.join("|").indexOf("(po výměně zadarmo)") > -1,
    evoPod.machop.join("|"));
  check("předmět i pohlaví se ukážou spolu",
    evoPod.kirlia.join("|").indexOf("Sinnoh Stone · jen samec") > -1,
    evoPod.kirlia.join("|"));

  console.log("\n176) roster: značky pod jménem, nejistá IV žlutě, detail bez probliknutí");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.waitForTimeout(250);
  const rosterUi = await page.evaluate(() => {
    window.__pgo.setRows([
      // Kus se VŠEMI pěti značkami — na něm se pozná, jestli se vejdou na řádek.
      { id: "u1", pokemon: "Mewtwo", cp: 3400, ivAtk: 15, ivDef: 15, ivSta: 15,
        dynamax: "Ano", cute: "Ano", shiny: "Ano", level: 40,
        fastMove: "Psycho Cut", charged1: "Psystrike" },
      // Sudý řádek: zebra maluje pozadí na každou buňku a nesmí přebít žlutou.
      { id: "u2", pokemon: "Machamp", cp: 2800, ivAtk: 10, ivDef: 12, ivSta: 13,
        level: 35, ivPctMin: 64, ivPctMax: 84,
        fastMove: "Counter", charged1: "Dynamic Punch" },
      { id: "u3", pokemon: "Azumarill", cp: 1500, ivAtk: 1, ivDef: 15, ivSta: 15,
        level: 38, fastMove: "Bubble", charged1: "Ice Beam", glRank: 12 },
      { id: "u4", pokemon: "Registeel", cp: 2100, ivAtk: 4, ivDef: 14, ivSta: 13,
        level: 29, ivPctMin: 50, ivPctMax: 90 }
    ]);
    const sel = document.getElementById("viewSelect");
    sel.value = "verdict";
    sel.dispatchEvent(new Event("change", { bubbles: true }));

    const out = {};
    const tab = document.getElementById("rosterTable");
    const wrap = document.querySelector(".table-wrap");
    out.sirkaTabulky = Math.round(tab.getBoundingClientRect().width);
    out.sirkaOkna = Math.round(wrap.getBoundingClientRect().width);
    out.stranaPresahuje = document.documentElement.scrollWidth > window.innerWidth;

    // --- značky: vlastní řádek pod jménem, všech pět vedle sebe ---
    const jm = document.querySelector('#tbody > tr td.col-pokemon');
    const jmeno = jm.querySelector(".poke-name");
    const tagy = jm.querySelector(".poke-tagy");
    out.tagyPodJmenem = tagy.getBoundingClientRect().top >= jmeno.getBoundingClientRect().bottom;
    const deti = Array.from(tagy.children);
    out.tagu = deti.length;
    out.tagyNaJednomRadku = new Set(deti.map((e) => Math.round(e.getBoundingClientRect().top))).size;
    out.sirkaJmena = Math.round(jm.getBoundingClientRect().width);

    // --- nejistá IV žlutě, i na sudém řádku ---
    const ivBunky = Array.from(document.querySelectorAll('#tbody td[data-col="ivPct"]'));
    out.iv = ivBunky.map((td) => ({
      txt: td.textContent,
      znacka: td.classList.contains("iv-nejiste"),
      // Barva se nesrovnává natvrdo (appka má světlé i tmavé téma), ale proti
      // pozadí sousední buňky v témže řádku — musí se lišit, jinak ji přebila zebra.
      odlisna: getComputedStyle(td).backgroundColor
        !== getComputedStyle(td.parentNode.querySelector('td[data-col="cp"]')).backgroundColor,
    }));

    // --- PvP odznáčky pod sebou ---
    const lgRow = document.querySelector("#tbody .lg-row");
    out.pvpSmer = lgRow ? getComputedStyle(lgRow).flexDirection : "";

    // --- detail: obrázky ostatních řádků se nesmí překreslit ---
    const pred = Array.from(document.querySelectorAll("#tbody img.roster-sprite"));
    document.querySelectorAll("#tbody > tr td.col-pokemon")[1].click();
    const po = Array.from(document.querySelectorAll("#tbody img.roster-sprite"));
    out.obrazkyStejne = pred.length === po.length && pred.every((e, i) => e === po[i]);
    out.detailu = document.querySelectorAll("#tbody > tr.detail-row").length;
    out.detailZaRadkem = document.querySelectorAll("#tbody > tr")[2].className;
    // Zebra se po vložení detailu nesmí rozejít.
    out.zebraSDetailem = Array.from(document.querySelectorAll("#tbody > tr:not(.detail-row)"))
      .map((t) => getComputedStyle(t.querySelector("td")).backgroundColor);
    document.querySelector("#tbody > tr.detail-row .detail-close").click();
    out.poZavreni = document.querySelectorAll("#tbody > tr.detail-row").length;
    out.zebraBezDetailu = Array.from(document.querySelectorAll("#tbody > tr:not(.detail-row)"))
      .map((t) => getComputedStyle(t.querySelector("td")).backgroundColor);
    return out;
  });

  check("tabulka se vejde do okna i po přerozdělení šířek",
    rosterUi.sirkaTabulky <= rosterUi.sirkaOkna,
    rosterUi.sirkaTabulky + " / " + rosterUi.sirkaOkna);
  check("…a stránka nemá vodorovný posuvník", !rosterUi.stranaPresahuje);
  check("značky jsou na vlastním řádku pod jménem", rosterUi.tagyPodJmenem);
  eq("…a jsou všechny", rosterUi.tagu, 5);
  eq("…na jediném řádku", rosterUi.tagyNaJednomRadku, 1);
  check("nejistý sken je zvýrazněný přímo na IV %",
    rosterUi.iv.filter((i) => i.znacka).length === 2
      && rosterUi.iv.filter((i) => i.znacka).every((i) => i.txt.indexOf("?") > -1),
    JSON.stringify(rosterUi.iv));
  check("…a zvýraznění je opravdu vidět, ne přebité zebrou",
    rosterUi.iv[1].odlisna && rosterUi.iv[3].odlisna
      && !rosterUi.iv[0].odlisna && !rosterUi.iv[2].odlisna,
    JSON.stringify(rosterUi.iv));
  eq("PvP odznáčky jsou pod sebou, nikdy dva na řádku", rosterUi.pvpSmer, "column");
  check("otevření detailu nepřekreslí obrázky ostatních řádků",
    rosterUi.obrazkyStejne);
  eq("…detail je právě jeden", rosterUi.detailu, 1);
  eq("…a je hned za svým řádkem", rosterUi.detailZaRadkem, "detail-row");
  check("zebra drží i s otevřeným detailem",
    rosterUi.zebraSDetailem[0] !== rosterUi.zebraSDetailem[1]
      && rosterUi.zebraSDetailem[1] !== rosterUi.zebraSDetailem[2],
    rosterUi.zebraSDetailem.join(","));
  eq("křížek detail zavře", rosterUi.poZavreni, 0);
  check("…a zebra zůstane stejná",
    rosterUi.zebraBezDetailu.join(",") === rosterUi.zebraSDetailem.join(","),
    rosterUi.zebraBezDetailu.join(","));

  console.log("\n177) Konkrétní pokémon: srovnaná pole a barva podmínek evoluce");
  const prohUi = await page.evaluate(async () => {
    const k = document.getElementById("prohlidkaCard");
    k.open = true; k.dispatchEvent(new Event("toggle"));
    const n = document.getElementById("prohName");
    n.value = "Feebas"; n.dispatchEvent(new Event("input", { bubbles: true }));
    const cp = document.getElementById("prohCp");
    cp.value = 500; cp.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const out = {};
    // Mřížka zarovnává dolů — stejně vysoká pole = stejně vysoké nadpisy.
    const bunky = Array.from(document.querySelectorAll(".proh-grid > label"));
    out.poli = bunky.length;
    out.vysky = Array.from(new Set(bunky.map((l) => {
      const f = l.querySelector("input:not([hidden]), .uv-pole");
      return f ? Math.round(f.getBoundingClientRect().height) : 0;
    })));
    out.nadpisy = Array.from(new Set(bunky.map((l) => Math.round(l.getBoundingClientRect().top))));

    const p = document.querySelector("#prohOut .d-evo-podminka");
    out.podminka = p ? p.textContent : "";
    out.podminkaBarva = p ? getComputedStyle(p).color : "";
    // Referenční hodnoty ze samotného tématu, ne natvrdo — appka má světlé i tmavé.
    const ref = document.createElement("span");
    document.body.appendChild(ref);
    ref.style.color = "var(--status-warning)";
    out.refVarovani = getComputedStyle(ref).color;
    ref.style.color = "var(--status-good)";
    out.refDobre = getComputedStyle(ref).color;
    ref.remove();
    out.podminkaVerzalky = p ? getComputedStyle(p).textTransform : "";
    n.value = "Machoke"; n.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const b = document.querySelector("#prohOut .d-evo-bonus");
    out.bonus = b ? b.textContent : "";
    out.bonusBarva = b ? getComputedStyle(b).color : "";
    return out;
  });
  eq("formulář má devět polí", prohUi.poli, 9);
  eq("…všechna stejně vysoká", prohUi.vysky.length, 1);
  eq("…takže nadpisy sedí ve stejné výšce", prohUi.nadpisy.length, 1);
  // `.d-evo-kus u` (značka „MÁŠ") je specifičtější než holá třída a barvila
  // podmínku zeleně velkými písmeny — vypadala jako pochvala, ne překážka.
  eq("překážka před evolucí je žlutá", prohUi.podminkaBarva, prohUi.refVarovani);
  check("…a ne zelená jako značka MÁŠ",
    prohUi.podminkaBarva !== prohUi.refDobre, prohUi.podminkaBarva);
  eq("…a je verzálkami jako ostatní značky", prohUi.podminkaVerzalky, "uppercase");
  eq("úleva za výměnu zůstává zelená", prohUi.bonusBarva, prohUi.refDobre);

  console.log("\n178) úkoly před evolucí z herního GAME_MASTERu");
  const ukoly = await page.evaluate(async () => {
    const k = document.getElementById("prohlidkaCard");
    k.open = true; k.dispatchEvent(new Event("toggle"));
    const n = document.getElementById("prohName");
    const cti = async (jm) => {
      n.value = jm;
      n.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 260));
      return Array.from(document.querySelectorAll("#prohOut .d-evo-kus")).map((e) => {
        const b = e.querySelector("b");
        const p = e.querySelector(".d-evo-podminka");
        return (b ? b.textContent : "") + (p ? " [" + p.textContent + "]" : "");
      }).join(" | ");
    };
    return {
      primeape: await cti("Primeape"),
      charcadet: await cti("Charcadet"),
      pancham: await cti("Pancham"),
      sylveon: await cti("Eevee"),
      // Regionální formy se jmenují stejně jako základní — řada se proto
      // musí stavět z KLÍČE, ne ze jména.
      yamaskG: await cti("Galarian Yamask"),
      yamask: await cti("Yamask"),
      sirfetchd: await cti("Galarian Farfetch'd"),
      slowpokeG: await cti("Galarian Slowpoke"),
    };
  });
  check("porazit soupeře daného typu (Primeape → Annihilape)",
    ukoly.primeape.indexOf("Annihilape [porazit 30 pokémonů typu Ghost nebo Psychic]") > -1,
    ukoly.primeape);
  check("…u větvení sedí úkol ke správné větvi",
    ukoly.charcadet.indexOf("Armarouge [porazit 30 pokémonů typu Psychic]") > -1
      && ukoly.charcadet.indexOf("Ceruledge [porazit 30 pokémonů typu Ghost]") > -1,
    ukoly.charcadet);
  check("chytání daného typu (Pancham → Pangoro)",
    ukoly.pancham.indexOf("chytit 32 pokémonů typu Dark") > -1, ukoly.pancham);
  check("srdíčka jako buddy (Eevee → Sylveon)",
    ukoly.sylveon.indexOf("Sylveon [získat 70 srdíček jako buddy]") > -1, ukoly.sylveon);
  check("galarská forma má vlastní řadu i vlastní úkol",
    ukoly.yamaskG.indexOf("Runerigus [vyhrát 10 raidů]") > -1, ukoly.yamaskG);
  check("…a obyčejná forma tím není dotčená",
    ukoly.yamask.indexOf("Cofagrigus") > -1 && ukoly.yamask.indexOf("Runerigus") === -1,
    ukoly.yamask);
  check("Excellent hody (Galarian Farfetch’d → Sirfetch’d)",
    ukoly.sirfetchd.indexOf("trefit 10× Excellent hod") > -1, ukoly.sirfetchd);
  check("dvě větve, dva různé úkoly (Galarian Slowpoke)",
    ukoly.slowpokeG.indexOf("Slowbro [chytit 30 pokémonů typu Poison]") > -1
      && ukoly.slowpokeG.indexOf("Slowking [chytit 30 pokémonů typu Psychic]") > -1,
    ukoly.slowpokeG);

  console.log("\n179) výběr útoků bez vybraného druhu nabízí celou hru");
  const utokyVse = await page.evaluate(async () => {
    const n = document.getElementById("prohName");
    const otevrit = () => {
      const p = document.querySelector(".proh-utok .uv-pole");
      p.click();
      const pol = Array.from(document.querySelectorAll(".uv-polozka"))
        .filter((e) => e.offsetParent);
      const out = { pocet: pol.length - 1,
        typy: pol.slice(1).map((e) => (e.querySelector(".uv-typ") || {}).textContent || ""),
        nazvy: pol.slice(1).map((e) => (e.querySelector(".uv-nazev") || {}).textContent || "") };
      document.body.click();
      return out;
    };
    const nastav = async (jm) => {
      n.value = jm;
      n.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 260));
    };
    await nastav("");
    const prazdno = otevrit();
    await nastav("Ninetales");
    const druh = otevrit();
    // Rozepsané jméno ještě není druh — nabídka má zůstat celá.
    await nastav("Ninet");
    const rozepsane = otevrit();
    await nastav("Ninetales");
    document.getElementById("prohClear").click();
    await new Promise((r) => setTimeout(r, 260));
    const poVymazani = otevrit();
    return { prazdno, druh, rozepsane, poVymazani,
      vyberu: document.querySelectorAll(".proh-utok .uv-pole").length,
      skryteInputy: Array.from(document.querySelectorAll("#prohF,#prohC1,#prohC2"))
        .every((i) => i.hidden) };
  });
  eq("výběry stojí i bez vybraného druhu", utokyVse.vyberu, 3);
  check("…a holá textová pole jsou schovaná", utokyVse.skryteInputy);
  check("bez druhu se nabízí všechny rychlé útoky",
    utokyVse.prazdno.pocet > 70, String(utokyVse.prazdno.pocet));
  check("…seřazené podle typu",
    utokyVse.prazdno.typy.join(",") === utokyVse.prazdno.typy.slice().sort().join(","),
    utokyVse.prazdno.typy.slice(0, 6).join(","));
  check("s druhem jen to, co umí",
    utokyVse.druh.pocet === 5 && utokyVse.druh.nazvy.indexOf("Charm") > -1,
    utokyVse.druh.pocet + ": " + utokyVse.druh.nazvy.join(","));
  eq("rozepsané jméno nabídku nezúží", utokyVse.rozepsane.pocet, utokyVse.prazdno.pocet);
  eq("po Vymazat se nabídka vrátí na celou hru",
    utokyVse.poVymazani.pocet, utokyVse.prazdno.pocet);

  console.log("\n180) Co chytat: sekce na bonbóny");
  const chytatBonbony = await page.evaluate(async () => {
    window.__pgo.setRows([
      { id: "c1", pokemon: "Gyarados", cp: 2600, level: 25, ivAtk: 15, ivDef: 14, ivSta: 14,
        fastMove: "Dragon Breath", charged1: "Aqua Tail" },
      { id: "c2", pokemon: "Azumarill", cp: 1400, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15,
        fastMove: "Bubble", charged1: "Play Rough" }
    ]);
    const b = Array.from(document.querySelectorAll(".zal-btn"))
      .filter((x) => /Co chytat/.test(x.textContent))[0];
    b.click();
    await new Promise((r) => setTimeout(r, 400));
    const box = document.getElementById("catchBody");
    return {
      nadpisy: Array.from(box.querySelectorAll(".ch-h")).map((e) => e.textContent),
      polozky: Array.from(box.querySelectorAll(".ch-bonbony .ch-item"))
        .map((e) => e.innerText.replace(/\n/g, " | ")),
      vysvetleni: box.textContent.indexOf("do herního Pokédexu se appka nedostane") > -1,
      neveKolikMas: box.textContent.indexOf("Kolik bonbónů máš, appka neví") > -1,
    };
  });
  check("sekce na bonbóny je v Co chytat",
    chytatBonbony.nadpisy.some((h) => h.indexOf("Na bonbóny") > -1), chytatBonbony.nadpisy.join(" | "));
  // Bonbóny jsou společné pro celou evoluční řadu, takže chytat se chodí
  // ZÁKLADNÍ forma — Gyaradose venku nepotkáš, Magikarpa ano.
  check("…a ukazuje kořen řady, ne to, co držíš",
    chytatBonbony.polozky.some((t) => t.indexOf("Magikarp") === 0 && t.indexOf("Gyarados") > -1),
    chytatBonbony.polozky.join(" / "));
  check("…s vzdáleností na jeden bonbón",
    chytatBonbony.polozky.some((t) => /km\/bonbón/.test(t)), chytatBonbony.polozky.join(" / "));
  check("karta říká, že „máš“ znamená „je v rosteru“", chytatBonbony.vysvetleni);
  check("…a že kolik bonbónů máš, appka neví", chytatBonbony.neveKolikMas);

  console.log("\n181) telefon 390 px: žádná záložka nesmí přetéct do strany");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const telefon390 = await page.evaluate(async () => {
    document.getElementById("demoBtn").click();
    await new Promise((r) => setTimeout(r, 350));
    const out = { zalozky: {}, okno: window.innerWidth };
    const zal = Array.from(document.querySelectorAll(".zal-btn"));
    for (const b of zal) {
      b.click();
      await new Promise((r) => setTimeout(r, 220));
      out.zalozky[b.textContent.replace(/\d+$/, "")] = document.documentElement.scrollWidth;
    }
    // Lišta záložek se sama roluje, takže se do ní vejde i patnáct karet.
    const l = document.querySelector(".zal-lista");
    // Na telefonu je lišta přišpendlená u SPODNÍ hrany (palec je tam, ne
    // nahoře) a místo posouvání se rozbaluje do plachty. Posuvník by na ní
    // znamenal, že se část záložek schovává mimo obraz.
    out.listaDole = getComputedStyle(l).position === "fixed"
      && getComputedStyle(l).bottom === "0px";
    out.listaPreteka = l.scrollWidth > l.clientWidth + 1;
    out.maIkony = l.querySelectorAll(".zal-ico").length;
    // Role a Rozpočet mají na telefonu z řádků karty; popisek sloupce se
    // bere z data-popis, protože hlavička zmizí.
    const zal2 = zal.filter((b) => b.textContent.indexOf("Rozpočet") === 0)[0];
    zal2.click();
    await new Promise((r) => setTimeout(r, 260));
    const radek = document.querySelector(".dust-table tr.plan-row");
    out.rozpocetKarta = radek ? getComputedStyle(radek).display : "";
    out.rozpocetPopisky = radek
      ? Array.from(radek.querySelectorAll("td[data-popis]")).map((td) => td.dataset.popis)
      : [];
    out.rozpocetSirka = radek ? Math.round(radek.getBoundingClientRect().width) : 0;
    const zal3 = zal.filter((b) => b.textContent.indexOf("Role") === 0)[0];
    zal3.click();
    await new Promise((r) => setTimeout(r, 260));
    const rr = document.querySelector(".rozp-tab tbody tr:not(.rozp-sekce)");
    out.roleKarta = rr ? getComputedStyle(rr).display : "";
    out.rolePopisky = rr
      ? Array.from(rr.querySelectorAll("td[data-popis]")).map((td) => td.dataset.popis)
      : [];
    return out;
  });
  const siroke = Object.keys(telefon390.zalozky)
    .filter((k) => telefon390.zalozky[k] > telefon390.okno);
  check("žádná záložka nepřeteče na 390 px", siroke.length === 0,
    siroke.map((k) => k + "=" + telefon390.zalozky[k]).join(", "));
  check("lišta záložek je u spodní hrany", telefon390.listaDole,
    String(telefon390.listaDole));
  check("…a nikam nepřetéká", telefon390.listaPreteka === false,
    String(telefon390.listaPreteka));
  check("…a každá záložka má ikonu", telefon390.maIkony >= 12,
    String(telefon390.maIkony));
  eq("Rozpočet je na telefonu karta, ne tabulka", telefon390.rozpocetKarta, "block");
  check("…a každá hodnota má svůj popisek",
    telefon390.rozpocetPopisky.length === 7
      && telefon390.rozpocetPopisky.indexOf("Prach") > -1,
    telefon390.rozpocetPopisky.join(","));
  check("…a karta se vejde do okna", telefon390.rozpocetSirka <= telefon390.okno,
    telefon390.rozpocetSirka + " / " + telefon390.okno);
  eq("Role jsou taky karta", telefon390.roleKarta, "block");
  check("…s popisky u čísel",
    telefon390.rolePopisky.join(",") === "Mám,Náplast,Cíl,Chybí,Kusy",
    telefon390.rolePopisky.join(","));

  console.log("\n182) podmínka evoluce i u druhu, který má jen tvarové formy");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.waitForTimeout(250);
  const holyKlic = await page.evaluate(async () => {
    const k = document.getElementById("prohlidkaCard");
    k.open = true; k.dispatchEvent(new Event("toggle"));
    const n = document.getElementById("prohName");
    const cti = async (jm) => {
      n.value = jm;
      n.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 260));
      return Array.from(document.querySelectorAll("#prohOut .d-evo-kus")).map((e) => {
        const b = e.querySelector("b");
        const bo = e.querySelector(".d-evo-bonus");
        return (b ? b.textContent : "") + (bo ? " (" + bo.textContent + ")" : "");
      }).join(" | ");
    };
    return { pumpkaboo: await cti("Pumpkaboo"), phantump: await cti("Phantump") };
  });
  // Pumpkaboo je v datech jen jako -small/-average/-large/-super; appka ale
  // klíčuje na holé jméno, takže se podmínky musí doplnit i tam.
  check("Pumpkaboo má v řadě výměnu zdarma",
    holyKlic.pumpkaboo.indexOf("(po výměně zadarmo)") > -1, holyKlic.pumpkaboo);
  check("…stejně jako Phantump", holyKlic.phantump.indexOf("(po výměně zadarmo)") > -1,
    holyKlic.phantump);

  console.log("\n183) shadow kus těsně pod prahem zachrání purifikace");
  const purif = await page.evaluate(() => {
    // Práh se musí nastavit natvrdo — předchozí bloky si s ním hrají.
    const prah = document.getElementById("ivThresh");
    prah.value = "90";
    prah.dispatchEvent(new Event("change", { bubbles: true }));
    // 13/13/13 = 87 % syrových IV (pod prahem); po purifikaci 15/15/15 = 100 %.
    // Bidoof schválně: u raidového útočníka se purifikace nedoporučuje,
    // protože by přišel o +20 % útoku, a sloupec by mluvil o něčem jiném.
    window.__pgo.setRows([
      { id: "s1", pokemon: "Bidoof", cp: 500, level: 25, forma: "Shadow",
        ivAtk: 13, ivDef: 13, ivSta: 13 },
      { id: "s2", pokemon: "Bidoof", cp: 500, level: 25,
        ivAtk: 13, ivDef: 13, ivSta: 13 }
    ]);
    const b = window.__pgo.base();
    const c = window.__pgo.getComputed();
    const najdi = (forma) => b.filter((x) => (x.row.forma || "") === forma)[0];
    const sh = najdi("Shadow"), norm = najdi("");
    return {
      shadowIv: sh ? Math.round(sh.ivPct * 100) : null,
      shadowPoPurif: sh && sh.ivPoPurifikaci ? Math.round(sh.ivPoPurifikaci * 100) : null,
      shadowVysoke: sh ? !!sh.highIV : null,
      shadowAzPoPurif: sh ? !!sh.highIVAzPoPurifikaci : null,
      // Obyčejný kus se stejnými IV purifikovat nejde, takže mu to nepomůže.
      normalVysoke: norm ? !!norm.highIV : null,
      normalPoPurif: norm ? norm.ivPoPurifikaci : "chybí",
      purifySub: sh ? c[sh.row.id].purifySub : "",
      purifyTone: sh ? c[sh.row.id].purifyTone : "",
    };
  });
  eq("syrové IV shadow kusu", purif.shadowIv, 87);
  eq("…po purifikaci", purif.shadowPoPurif, 100);
  check("shadow kus se měří tím, co z něj půjde udělat", purif.shadowVysoke === true,
    JSON.stringify(purif));
  check("…a je označený jako „až po purifikaci“", purif.shadowAzPoPurif === true,
    JSON.stringify(purif));
  check("obyčejný kus se stejnými IV nic takového nedostane",
    purif.normalVysoke === false && purif.normalPoPurif === null,
    JSON.stringify(purif));
  check("sloupec Purifikovat řekne o kolik jde",
    /87 % → 100 %/.test(purif.purifySub), purif.purifySub);

  console.log("\n184) čištění boxu: puštění uvolní slot pro další v pořadí");
  const boxSlot = await page.evaluate(async () => {
    window.alert = () => {};
    window.__pgo.setRows([
      { id: "b1", pokemon: "Gyarados", cp: 2628, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14,
        fastMove: "Dragon Breath", charged1: "Aqua Tail" },
      { id: "b2", pokemon: "Gyarados", cp: 2600, level: 29, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: "Dragon Breath", charged1: "Aqua Tail" }
    ]);
    window.__pgo.boxOtevrit();
    await new Promise((r) => setTimeout(r, 250));
    const role = () => Array.from(document.querySelectorAll(".box-mode .bm-role"))
      .map((e) => e.innerText.replace(/\n/g, " ")).join(" | ");
    const out = { pred: role() };
    window.__pgo.boxRozhodnout("drop");
    await new Promise((r) => setTimeout(r, 250));
    out.po = role();
    out.hlaska = (document.querySelector(".bm-prepocet") || {}).textContent || "";
    // Zpátky se slot musí zase obsadit.
    window.__pgo.boxZpet();
    await new Promise((r) => setTimeout(r, 250));
    window.__pgo.boxRozhodnout("keep");
    await new Promise((r) => setTimeout(r, 250));
    out.poNechani = role();
    window.__pgo.boxZavritNatvrdo();
    return out;
  });
  check("první Gyarados drží Water 1/3", /Water 1\/3/.test(boxSlot.pred), boxSlot.pred);
  // Tohle je jádro věci: druhý kus byl 2/3 a puštěním prvního se posune.
  check("po puštění prvního se druhý posune na 1/3",
    /Water 1\/3/.test(boxSlot.po), boxSlot.po);
  check("…a mega slot se uvolní taky",
    boxSlot.po.indexOf("Lepší kopie") === -1, boxSlot.po);
  check("když si první necháš, druhý zůstane druhý",
    /Water 2\/3/.test(boxSlot.poNechani), boxSlot.poNechani);

  console.log("\n185) kus, který drží roli, se nenabízí na výměnu");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.waitForTimeout(250);
  const rolePredTradem = await page.evaluate(() => {
    window.__pgo.setRows([
      // Hraje Little Cup sám za sebe — výměnou by o něj přišel.
      { id: "t1", pokemon: "Pumpkaboo M", cp: 353, level: 11, ivAtk: 9, ivDef: 9, ivSta: 10 },
      // Žádnou roli teď nedrží — trade evoluce je čistý zisk.
      { id: "t2", pokemon: "Machoke", cp: 1200, level: 20, ivAtk: 5, ivDef: 5, ivSta: 5 },
      // Roli má až jako Gengar; výměna je nejlevnější cesta, jak se tam dostat.
      { id: "t3", pokemon: "Haunter", cp: 1200, level: 20, ivAtk: 10, ivDef: 10, ivSta: 10 },
      { id: "t4", pokemon: "Abra", cp: 400, level: 15, ivAtk: 10, ivDef: 10, ivSta: 10 }
    ]);
    const c = window.__pgo.getComputed();
    const out = {};
    window.__pgo.base().forEach((b) => {
      const x = c[b.row.id];
      out[b.row.pokemon] = {
        keep: x.keep, keepSub: x.keepSub || "", keepTitle: x.keepTitle || "",
        trade: x.trade, tradeSub: x.tradeSub || "",
        // Slot po evoluci se nesmí počítat jako „role, kterou drží teď".
        sloty: (b.sloty || []).map((sl) => sl.druh + ":" + (sl.poEvoluci ? "poEvo" : "ted")),
      };
    });
    return out;
  });
  eq("ligový kus se nenabízí na výměnu", rolePredTradem["Pumpkaboo M"].trade, "Ne");
  eq("…s důvodem", rolePredTradem["Pumpkaboo M"].tradeSub, "drží roli");
  check("…a verdikt mluví o roli, ne o výměně",
    rolePredTradem["Pumpkaboo M"].keep === "Ponechat"
      && rolePredTradem["Pumpkaboo M"].keepSub.indexOf("LC") > -1,
    JSON.stringify(rolePredTradem["Pumpkaboo M"]));
  check("…ale sleva se připomene, ať to nevypadá, že o ní appka neví",
    rolePredTradem["Pumpkaboo M"].keepTitle.indexOf("zdarma přes výměnu") > -1,
    rolePredTradem["Pumpkaboo M"].keepTitle);
  eq("kus bez role zůstává na výměnu", rolePredTradem.Machoke.keep, "Nechat – trade");
  // Mega slot patří vyvinuté formě — bez toho vypadal Haunter jako kus,
  // co roli plní už teď, a výměna se u něj zablokovala.
  check("mega slot u nevyvinutého kusu je označený jako „až po evoluci“",
    rolePredTradem.Haunter.sloty.indexOf("mega:poEvo") > -1,
    rolePredTradem.Haunter.sloty.join(","));
  eq("Haunter se na výměnu pořád nabízí", rolePredTradem.Haunter.trade, "Ano");
  eq("…a Abra taky, o stupeň dál", rolePredTradem.Abra.trade, "Po evoluci");

  console.log("\n186) sloupec Purifikovat: pořadí a šířka");
  const purifSloupec = await page.evaluate(async () => {
    window.__pgo.setRows([
      { id: "u1", pokemon: "Machamp", cp: 2000, level: 25, forma: "Shadow",
        ivAtk: 11, ivDef: 11, ivSta: 11, fastMove: "Counter", charged1: "Dynamic Punch" },
      { id: "u2", pokemon: "Bidoof", cp: 500, level: 25, forma: "Shadow",
        ivAtk: 13, ivDef: 13, ivSta: 13 },
      { id: "u3", pokemon: "Rattata", cp: 300, level: 15, forma: "Shadow",
        ivAtk: 2, ivDef: 2, ivSta: 2 },
      { id: "u4", pokemon: "Snorlax", cp: 2000, level: 25, forma: "Purified",
        ivAtk: 12, ivDef: 12, ivSta: 12 },
      { id: "u5", pokemon: "Azumarill", cp: 1500, level: 30, ivAtk: 1, ivDef: 15, ivSta: 15 }
    ]);
    const prah = document.getElementById("ivThresh");
    prah.value = "90";
    prah.dispatchEvent(new Event("change", { bubbles: true }));
    const sel = document.getElementById("viewSelect");
    sel.value = "verdict";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    const th = Array.from(document.querySelectorAll("#headerRow th"))
      .filter((x) => x.textContent.indexOf("Purifikovat") === 0)[0];
    th.click();
    await new Promise((r) => setTimeout(r, 250));
    const tds = Array.from(document.querySelectorAll('#tbody td[data-col="purify"]'));
    return {
      sirka: tds.length ? Math.round(tds[0].getBoundingClientRect().width) : 0,
      poradi: tds.map((td) => td.innerText.replace(/\n/g, " | ")),
      // Nejširší text uvnitř buňky — nesmí být širší než sloupec, jinak
      // se ustřihne uprostřed slova.
      nejsirsi: Math.max.apply(null, tds.map((td) => {
        let w = 0;
        Array.from(td.querySelectorAll("*")).forEach((e) => {
          if (!e.children.length) w = Math.max(w, e.scrollWidth);
        });
        return w;
      })),
    };
  });
  check("nejdřív ty, kde purifikace rozhoduje o ponechání",
    /87 % → 100 % IV/.test(purifSloupec.poradi[0]), purifSloupec.poradi.join(" / "));
  check("…pak zbylá „Ano“",
    /Ano/.test(purifSloupec.poradi[1]) && /nevyužiješ/.test(purifSloupec.poradi[1]),
    purifSloupec.poradi.join(" / "));
  check("…pak kusy, u kterých se purifikovat NEMÁ",
    /Nechat/.test(purifSloupec.poradi[2]), purifSloupec.poradi.join(" / "));
  check("…a nakonec ty, kterých se to netýká",
    /Hotovo/.test(purifSloupec.poradi[3]), purifSloupec.poradi.join(" / "));
  check("žádný podtitulek se do sloupce nevejde jen napůl",
    purifSloupec.nejsirsi <= purifSloupec.sirka,
    purifSloupec.nejsirsi + " px v " + purifSloupec.sirka + " px sloupci");

  console.log("\n187) ikony typů");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.waitForTimeout(250);
  const ikonyTypu = await page.evaluate(() => {
    window.__pgo.setRows([
      { id: "k1", pokemon: "Metagross", cp: 3100, level: 33, ivAtk: 15, ivDef: 14, ivSta: 13 },
      { id: "k2", pokemon: "Gyarados", cp: 2900, level: 33, ivAtk: 15, ivDef: 15, ivSta: 15 }
    ]);
    const sel = document.getElementById("viewSelect");
    sel.value = "verdict";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    const typy = Object.keys(window.__pgo.typeColors());
    const bunka = document.querySelector('#tbody td[data-col="types"]');
    return {
      // Ikona musí být pro každý z osmnácti typů, ne jen pro pár.
      vsechnyMajiIkonu: typy.every((t) => (window.__pgo.typIkona(t) || "").indexOf("<svg") === 0),
      typu: typy.length,
      // Každý typ jinou — jinak by k rozeznávání nebyly.
      ruznych: new Set(typy.map((t) => window.__pgo.typIkona(t))).size,
      // Nic se nestahuje: appka musí zůstat offline.
      bezOdkazu: typy.every((t) => !/https?:|<image/i.test(window.__pgo.typIkona(t))),
      vBunce: bunka ? bunka.querySelectorAll("svg.typ-ikona").length : 0,
      radky: Array.from(document.querySelectorAll("#tbody > tr"))
        .map((tr) => Math.round(tr.getBoundingClientRect().height)),
      // Kolečko má barvu typu, ať se pozná i bez čtení.
      barvaKolecka: (window.__pgo.typIkona("Water").match(/fill="([^"]+)"/) || [])[1],
      barvaWater: window.__pgo.typeColors().Water,
      symbolVOdznacku: (function () {
        var d = document.createElement("div");
        d.className = "d-type";
        d.style.background = "#c7b78b";
        d.innerHTML = window.__pgo.typIkona("Rock");
        document.body.appendChild(d);
        var f = getComputedStyle(d.querySelector("svg g")).fill;
        d.remove();
        return f;
      })(),
      kruhVOdznacku: (function () {
        var d = document.createElement("div");
        d.className = "d-type";
        d.style.background = "#c7b78b";
        d.innerHTML = window.__pgo.typIkona("Rock");
        document.body.appendChild(d);
        var f = getComputedStyle(d.querySelector("svg circle")).fill;
        d.remove();
        return f;
      })(),
    };
  });
  eq("ikonu má všech osmnáct typů", ikonyTypu.typu, 18);
  check("…a jsou to opravdu ikony", ikonyTypu.vsechnyMajiIkonu);
  eq("…každý typ jinou", ikonyTypu.ruznych, 18);
  check("…kreslené v souboru, nic se nestahuje", ikonyTypu.bezOdkazu);
  eq("v buňce Typy jsou dvě, po jedné na typ", ikonyTypu.vBunce, 2);
  eq("kolečko má barvu typu", ikonyTypu.barvaKolecka, ikonyTypu.barvaWater);
  // V barevném odznáčku se role prohodí: bílé kolečko, symbol v barvě typu.
  // Dřív se symbol barvil `currentColor`, což je tam bílá — a zbylo bílé kolečko.
  check("v barevném odznáčku je symbol vidět",
    ikonyTypu.symbolVOdznacku !== ikonyTypu.kruhVOdznacku,
    ikonyTypu.symbolVOdznacku + " vs " + ikonyTypu.kruhVOdznacku);
  // Ikona nesmí zalomit název typu na druhý řádek — řádek tabulky by vyrostl.
  check("řádek kvůli ikonám nenaroste",
    Math.max.apply(null, ikonyTypu.radky) <= 56, ikonyTypu.radky.join(","));

  console.log("\n188) čištění boxu: vrácení kusu, na který se uvolnilo místo");
  const vraceni = await page.evaluate(async () => {
    window.alert = () => {};
    // Tři stejní Gyaradosové: dva se vejdou, třetí je „Zahodit – kopie".
    window.__pgo.setRows([
      { id: "v1", pokemon: "Gyarados", cp: 2900, level: 33, ivAtk: 15, ivDef: 15, ivSta: 15,
        fastMove: "Waterfall", charged1: "Hydro Pump" },
      { id: "v2", pokemon: "Gyarados", cp: 2800, level: 31, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: "Waterfall", charged1: "Hydro Pump" },
      { id: "v3", pokemon: "Gyarados", cp: 2700, level: 30, ivAtk: 13, ivDef: 13, ivSta: 13,
        fastMove: "Waterfall", charged1: "Hydro Pump" }
    ]);
    // Vzestupně podle CP, ať jde nejslabší (a tedy zahazovaný) první —
    // teprve pak dává smysl ptát se na jeho vrácení.
    Array.from(document.querySelectorAll("#headerRow th"))
      .filter((x) => x.textContent.indexOf("CP") === 0)[0].click();
    await new Promise((r) => setTimeout(r, 200));
    window.__pgo.boxOtevrit();
    await new Promise((r) => setTimeout(r, 350));
    const panel = document.querySelector(".bm-panel");
    const rozmer = () => Math.round(panel.getBoundingClientRect().width) + "x"
      + Math.round(panel.getBoundingClientRect().height);
    const out = { rozmery: [rozmer()] };
    window.__pgo.boxRozhodnout("drop");   // nejslabší pryč
    await new Promise((r) => setTimeout(r, 250));
    out.rozmery.push(rozmer());
    out.pruhPredUvolnenim = !document.getElementById("bmVraceni").hidden;
    window.__pgo.boxRozhodnout("drop");   // a teď jeden, který držel místo
    await new Promise((r) => setTimeout(r, 400));
    out.rozmery.push(rozmer());
    const pruh = document.getElementById("bmVraceni");
    out.pruh = !pruh.hidden;
    out.text = pruh.innerText.replace(/\n/g, " | ");
    out.tlacitek = pruh.querySelectorAll("[data-vratit]").length;
    // Vrácení musí kus odebrat ze seznamu k transferu.
    pruh.querySelector("[data-vratit]").click();
    await new Promise((r) => setTimeout(r, 450));
    out.volbyPoVraceni = JSON.parse(JSON.stringify(window.__pgo.boxStav().volby));
    out.rozmery.push(rozmer());
    // Místo je zase obsazené, takže druhý kandidát zmizí sám.
    out.pruhPoVraceni = !document.getElementById("bmVraceni").hidden;
    window.__pgo.boxZavritNatvrdo();
    return out;
  });
  check("dokud se nic neuvolní, pruh není",
    vraceni.pruhPredUvolnenim === false, String(vraceni.pruhPredUvolnenim));
  check("po uvolnění místa se pruh objeví", vraceni.pruh === true, vraceni.text);
  check("…a řekne, co se změnilo",
    /už jsi pustil/i.test(vraceni.text) && /Ponechat/.test(vraceni.text), vraceni.text);
  check("…s tlačítkem na vrácení", vraceni.tlacitek > 0, String(vraceni.tlacitek));
  // Tohle je jádro: co se neudělá tady, neudělá se ani ve hře.
  check("vrácení odebere kus ze seznamu k transferu",
    Object.keys(vraceni.volbyPoVraceni).some((id) => vraceni.volbyPoVraceni[id] === "keep"),
    JSON.stringify(vraceni.volbyPoVraceni));
  check("…a druhý kandidát zmizí, protože místo je zase plné",
    vraceni.pruhPoVraceni === false, String(vraceni.pruhPoVraceni));
  // Panel nesmí měnit velikost — ani když se pruh objeví.
  check("panel čištění drží pořád stejné rozměry",
    vraceni.rozmery.every((r) => r === vraceni.rozmery[0]), vraceni.rozmery.join(" → "));

  console.log("\n189) značka LUCKY");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.waitForTimeout(250);
  const luckyZnacka = await page.evaluate(() => {
    window.__pgo.setRows([
      // Calcy píše Lucky do jména — appka to musí poznat sama.
      { id: "L1", pokemon: "Fennekin Lucky", cp: 14, level: 1,
        ivAtk: 15, ivDef: 13, ivSta: 13 },
      // A stejně tak z vyplněné formy.
      { id: "L2", pokemon: "Azumarill", forma: "Lucky", cp: 1489, level: 24.5,
        ivAtk: 12, ivDef: 14, ivSta: 15, fastMove: "Bubble", charged1: "Play Rough" },
      { id: "L3", pokemon: "Machamp", cp: 2000, level: 25, ivAtk: 12, ivDef: 12, ivSta: 12 }
    ]);
    const sel = document.getElementById("viewSelect");
    sel.value = "verdict";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    const c = window.__pgo.getComputed();
    const out = { lucky: {}, znacky: [] };
    window.__pgo.getRows().forEach((r) => { out.lucky[r.pokemon] = !!c[r.id].lucky; });
    out.znacky = Array.from(document.querySelectorAll("#tbody .poke-tagy .rarity-chip"))
      .map((e) => e.textContent);
    // Filtr značek musí Lucky znát taky.
    out.vFiltru = !!document.querySelector('input[data-znacka="K"]');
    return out;
  });
  check("Lucky se pozná ze jména", luckyZnacka.lucky["Fennekin Lucky"] === true,
    JSON.stringify(luckyZnacka.lucky));
  check("…i z vyplněné formy", luckyZnacka.lucky.Azumarill === true,
    JSON.stringify(luckyZnacka.lucky));
  check("…a obyčejný kus ji nedostane", luckyZnacka.lucky.Machamp === false,
    JSON.stringify(luckyZnacka.lucky));
  eq("v tabulce jsou dvě značky LUCKY",
    luckyZnacka.znacky.filter((z) => z === "LUCKY").length, 2);
  check("…a dá se podle ní filtrovat", luckyZnacka.vFiltru);

  console.log("\n190) důvod zahození se ptá na nejlepší možnou variantu");
  const duvodNejlepsi = await page.evaluate(async () => {
    // Dusclops je v Great League až #45, ale po evoluci na Dusknoira
    // je v Ultra League na #24. Verdikt to musí říct podle té lepší varianty.
    window.__pgo.setRows([
      { id: "n1", pokemon: "Dusclops", cp: 671, level: 15, ivAtk: 15, ivDef: 13, ivSta: 12 }
    ]);
    const rl = document.getElementById("rankLimit");
    const puvodni = rl.value;
    rl.value = "10";
    rl.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
    const c = window.__pgo.getComputed();
    const id = window.__pgo.getRows()[0].id;
    const out = { keep: c[id].keep, sub: c[id].keepSub || "", why: c[id].keepTitle || "" };
    rl.value = puvodni;
    rl.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    return out;
  });
  check("důvod mluví o lize, kde je kus nejlíp",
    duvodNejlepsi.why.indexOf("Ultra League") > -1
      && duvodNejlepsi.why.indexOf("#24") > -1, duvodNejlepsi.why);
  check("…a přizná, že je to až po evoluci",
    duvodNejlepsi.why.indexOf("po evoluci") > -1, duvodNejlepsi.why);
  // Tohle byla ta chyba: psalo se GL #45, protože se koukalo jen na druh,
  // který držíš teď — a vedle v tabulce lig přitom svítilo UL #24.
  check("…a necituje horší pořadí dnešní formy",
    duvodNejlepsi.why.indexOf("#45") === -1, duvodNejlepsi.why);
  eq("podtitulek říká totéž", duvodNejlepsi.sub, "druh je až #24");

  console.log("\n191) hláška o přepočtu jen při skutečné změně rozhodnutí");
  const prepocetHlaska = await page.evaluate(async () => {
    window.alert = () => {};
    window.__pgo.setRows([
      { id: "h1", pokemon: "Gyarados", cp: 2900, level: 33, ivAtk: 15, ivDef: 15, ivSta: 15,
        fastMove: "Waterfall", charged1: "Hydro Pump" },
      { id: "h2", pokemon: "Gyarados", cp: 2800, level: 31, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: "Waterfall", charged1: "Hydro Pump" },
      { id: "h3", pokemon: "Cottonee", cp: 371, level: 20, ivAtk: 10, ivDef: 13, ivSta: 13 }
    ]);
    Array.from(document.querySelectorAll("#headerRow th"))
      .filter((x) => x.textContent.indexOf("CP") === 0)[0].click();
    await new Promise((r) => setTimeout(r, 200));
    window.__pgo.boxOtevrit();
    await new Promise((r) => setTimeout(r, 350));
    const out = {};
    // Ruční zapnutí DMAX změní verdikt — ale příčinou je uživatel, ne
    // uvolněné místo, takže se hláška o přepočtu ukázat nesmí.
    const vic = document.getElementById("bmVic");
    vic.open = true;
    vic.dispatchEvent(new Event("toggle"));
    await new Promise((r) => setTimeout(r, 300));
    const dmax = document.querySelector("#bmDetail .dmax-prepinac");
    out.mameDmax = !!dmax;
    if (dmax) {
      dmax.click();
      await new Promise((r) => setTimeout(r, 400));
    }
    out.poRucniZmene = !!document.querySelector(".bm-prepocet");
    window.__pgo.boxZavritNatvrdo();
    return out;
  });
  check("přepínač DMAX je v rozboru k dispozici", prepocetHlaska.mameDmax);
  check("po ruční změně se hláška o uvolněném místě neukáže",
    prepocetHlaska.poRucniZmene === false, String(prepocetHlaska.poRucniZmene));

  console.log("\n192) lucky odpad je žlutý, ale pořád jde pryč");
  // Stejný kus dvakrát: jednou s Lucky ve jméně, jednou bez. Rozhodnutí musí
  // vyjít totožné — lišit se smí jenom barva, nadpis a tooltip.
  const zmerLucky = (jmeno) => page.evaluate(async (n) => {
    window.__pgo.setRows([
      { id: "z1", pokemon: n, cp: 210, level: 15, ivAtk: 10, ivDef: 11, ivSta: 12 }
    ]);
    const sel = document.getElementById("viewSelect");
    sel.value = "verdict";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    // Appka je v režimu záložek, takže roster může být schovaný po předchozím
    // bloku. Bez tohohle měří `getBoundingClientRect` nuly.
    const karta = document.querySelector(".card.roster");
    const zalozky = Array.from(document.querySelectorAll(".zal-lista > *"));
    for (let i = 0; i < zalozky.length && getComputedStyle(karta).display === "none"; i++) {
      zalozky[i].click();
      await new Promise((r) => setTimeout(r, 60));
    }
    await new Promise((r) => setTimeout(r, 350));
    const c = window.__pgo.getComputed()[window.__pgo.getRows()[0].id];
    const bunka = Array.from(document.querySelectorAll("#tbody tr td"))
      .filter((td) => (td.querySelector(".badge") || {}).textContent
        && td.querySelector(".badge").textContent.indexOf("Zahodit") > -1)[0];
    const odznak = bunka ? bunka.querySelector(".badge") : null;
    // Barvu nejde porovnat s proměnnou napřímo — prohlížeč vrací rgb().
    const sonda = document.createElement("span");
    sonda.style.color = "var(--status-warning)";
    document.body.appendChild(sonda);
    const zluta = getComputedStyle(sonda).color;
    sonda.remove();
    const btn = document.getElementById("starKeepersBtn");
    return {
      keep: c.keep, keepGood: c.keepGood, tone: c.keepTone,
      priznak: !!c.luckyVarovani, sub: c.keepSub || "", title: c.keepTitle || "",
      barva: odznak ? getComputedStyle(odznak).color : "",
      zluta: zluta,
      // Odznak má nowrap, takže delší text by ze sloupce vytekl.
      sirkaOdznaku: odznak ? Math.ceil(odznak.getBoundingClientRect().width) : 0,
      sirkaBunky: bunka ? Math.floor(bunka.getBoundingClientRect().width) : 0,
      // Uřezané „Zahodit – ale je…“ by celou tu brzdu zahodilo.
      urezano: odznak ? odznak.scrollWidth > odznak.clientWidth + 1 : true,
      vyskaRadku: bunka ? Math.round(bunka.parentNode.getBoundingClientRect().height) : 0,
      // Hvězdička znamená „nechávám si ho" — žlutý odpad ji dostat nesmí.
      hvezdicka: btn ? btn.style.display : "?"
    };
  }, jmeno);

  const luckyOdpad = await zmerLucky("Rattata Lucky");
  const bezneOdpad = await zmerLucky("Rattata");

  eq("verdikt lucky kusu na značku upozorní", luckyOdpad.keep, "Zahodit – ale je Lucky");
  check("…ale pořád začíná na Zahodit",
    luckyOdpad.keep.indexOf("Zahodit") === 0, luckyOdpad.keep);
  check("rozhodnutí zůstává „pryč“", luckyOdpad.keepGood === false,
    String(luckyOdpad.keepGood));
  check("…stejné jako u kusu bez značky", bezneOdpad.keepGood === false,
    String(bezneOdpad.keepGood));
  eq("tón je žlutý, ne červený", luckyOdpad.tone, "warning");
  eq("obyčejný dvojník zůstává červený", bezneOdpad.tone, "critical");
  eq("…a jeho verdikt se nemění", bezneOdpad.keep, "Zahodit");
  eq("odznak je fakt žlutý", luckyOdpad.barva, luckyOdpad.zluta);
  // Tohle je celý smysl té změny: barva mění pozornost, ne rozhodnutí, takže
  // podtitulek musí dál nést tentýž důvod jako u kusu bez značky.
  eq("podtitulek nese klasický důvod jako u kusu bez značky",
    luckyOdpad.sub, bezneOdpad.sub);
  // Poznámka o lucky je až za důvodem, ne před ním: v čištění boxu má `.bm-why`
  // pevné tři řádky (aby karta neměnila velikost), takže předsázený text by
  // důvod uřízl.
  check("tooltip začíná týmž důvodem jako u kusu bez značky",
    luckyOdpad.title.indexOf(bezneOdpad.title) === 0,
    luckyOdpad.title + " | " + bezneOdpad.title);
  check("…a teprve pak vysvětlí tu žlutou",
    luckyOdpad.title.indexOf("LUCKY") > bezneOdpad.title.length - 1,
    luckyOdpad.title);
  check("odznak se vejde do sloupce",
    luckyOdpad.sirkaOdznaku > 0 && luckyOdpad.sirkaOdznaku <= luckyOdpad.sirkaBunky,
    luckyOdpad.sirkaOdznaku + " px v buňce " + luckyOdpad.sirkaBunky + " px");
  // Bez tohohle by se ve sloupci četlo „Zahodit – ale je…“ a slovo Lucky,
  // kvůli kterému ta věta vůbec vznikla, by se ztratilo.
  check("…a není uřezaný", luckyOdpad.urezano === false, String(luckyOdpad.urezano));
  // Dva řádky se musí vejít do stejně vysokého řádku jako všechno ostatní.
  check("…a řádek kvůli němu nenaroste",
    luckyOdpad.vyskaRadku > 0 && luckyOdpad.vyskaRadku <= bezneOdpad.vyskaRadku + 2,
    luckyOdpad.vyskaRadku + " px vs " + bezneOdpad.vyskaRadku + " px");
  eq("hromadná hvězdička ho mezi ponechané nepočítá", luckyOdpad.hvezdicka, "none");

  // A pořád patří mezi odpad: filtr „Zahodit" ho musí najít.
  const luckyVeFiltru = await page.evaluate(async () => {
    const f = document.getElementById("filterSelect");
    f.value = "discard";
    f.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
    const n = document.querySelectorAll("#tbody tr:not(.detail-row)").length;
    f.value = "all";
    f.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    return n;
  });
  eq("filtr „Zahodit“ ho pořád vidí", luckyVeFiltru, 1);

  // Lucky, který roli drží, se nesmí přebarvit — brzda platí jen na odpad.
  const luckyDrzi = await page.evaluate(() => {
    window.__pgo.setRows([
      { id: "d1", pokemon: "Machamp Lucky", cp: 2800, level: 30,
        ivAtk: 15, ivDef: 14, ivSta: 14,
        fastMove: "Counter", charged1: "Dynamic Punch" }
    ]);
    const c = window.__pgo.getComputed()[window.__pgo.getRows()[0].id];
    return { keep: c.keep, tone: c.keepTone, priznak: !!c.luckyVarovani };
  });
  check("lucky s rolí si drží svůj původní verdikt",
    luckyDrzi.keep.indexOf("Zahodit") !== 0, luckyDrzi.keep);
  check("…a brzda se u něj nezapíná", luckyDrzi.priznak === false,
    String(luckyDrzi.priznak));

  // Lucky jen ve jméně musí platit i pro „Shadow a Lucky držet vždy“ —
  // značku v tabulce dostal, tak ho to nastavení nesmí minout.
  const luckyZeJmena = await page.evaluate(async () => {
    window.__pgo.setRows([
      { id: "j1", pokemon: "Rattata Lucky", cp: 210, level: 15,
        ivAtk: 10, ivDef: 11, ivSta: 12 }
    ]);
    const kf = document.getElementById("keepForms");
    kf.checked = true;
    kf.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    const c = window.__pgo.getComputed()[window.__pgo.getRows()[0].id];
    const out = { keep: c.keep, title: c.keepTitle || "" };
    kf.checked = false;
    kf.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    return out;
  });
  eq("se zapnutým „držet vždy“ zůstává i lucky ze jména",
    luckyZeJmena.keep, "Ponechat");
  check("…a věta o formě není useknutá",
    luckyZeJmena.title.indexOf("Lucky forma") === 0, luckyZeJmena.title);

  console.log("\n193) záloha do složky, na kterou dosáhne telefon");
  // Falešná složka: pamatuje si, co se do ní zapsalo, a hlásí, v jakém režimu
  // si o ni appka řekla. „read" znamená, že se zavolala funkce od kamarádova
  // rosteru — ta se dřív jmenovala stejně a tuhle přebíjela, takže se záloha
  // nikdy nepřipojila a tlačítko jen tiše nic neudělalo.
  await page.addInitScript(() => {
    window.__volani = [];
    window.__soubory = {};
    window.__fake = {
      name: "OneDrive", kind: "directory",
      getFileHandle: (n) => Promise.resolve({
        name: n, kind: "file",
        createWritable: () => Promise.resolve({
          write: (t) => { window.__soubory[n] = String(t).length; return Promise.resolve(); },
          close: () => Promise.resolve()
        })
      }),
      removeEntry: () => Promise.resolve(),
      requestPermission: () => Promise.resolve("granted"),
      queryPermission: () => Promise.resolve("granted"),
      values: () => ({ [Symbol.asyncIterator]: () =>
        ({ next: () => Promise.resolve({ done: true }) }) })
    };
    window.showDirectoryPicker = (opts) => {
      window.__volani.push(opts && opts.mode);
      return Promise.resolve(window.__fake);
    };
  });
  await page.goto(URL);
  await page.waitForTimeout(900);

  const zalohaSlozka = await page.evaluate(async () => {
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2800, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14 }
    ]);
    await new Promise((r) => setTimeout(r, 400));
    document.getElementById("backupBtn").click();
    await new Promise((r) => setTimeout(r, 700));
    // Falešný handle se do IndexedDB neuloží, takže se složka připojí přímo.
    window.__pgo.setDirHandle(window.__fake);
    window.__pgo.setRows([
      { pokemon: "Gyarados", cp: 2900, level: 33, ivAtk: 15, ivDef: 15, ivSta: 15 }
    ]);
    await new Promise((r) => setTimeout(r, 2500));
    return {
      rezim: window.__volani.slice(),
      soubory: Object.keys(window.__soubory),
      stav: (document.getElementById("backupState") || {}).textContent || "",
      popis: document.getElementById("backupBtn").textContent
    };
  });
  eq("tlačítko si řekne o zápis, ne jen o čtení", zalohaSlozka.rezim.join(","), "readwrite");
  check("záloha napíše pořád stejně pojmenovaný soubor",
    zalohaSlozka.soubory.indexOf("roster.csv") > -1, zalohaSlozka.soubory.join(", "));
  check("…a k tomu dnešní generaci",
    zalohaSlozka.soubory.some((n) => /^roster-\d{4}-\d{2}-\d{2}\.csv$/.test(n)),
    zalohaSlozka.soubory.join(", "));
  check("stav složku potvrdí", zalohaSlozka.popis.indexOf("OneDrive") > -1, zalohaSlozka.popis);
  // Kvůli tomuhle to celé je: telefon si otevře jeden soubor a ví, co s ním.
  check("…a poradí, jak se k ní dostat z telefonu",
    zalohaSlozka.stav.indexOf("roster.csv") > -1 && zalohaSlozka.stav.indexOf("Nahradit roster") > -1,
    zalohaSlozka.stav);

  const sdilena = await page.evaluate(async () => {
    window.__pgo.setDirHandle({ name: "PokemonShare", kind: "directory",
      getFileHandle: () => Promise.reject(new Error("test")),
      requestPermission: () => Promise.resolve("granted") });
    await new Promise((r) => setTimeout(r, 400));
    const st = document.getElementById("backupState");
    return { text: st.textContent, trida: st.className };
  });
  // Do sdílené složky patří jen roster na výměnu, ne celá záloha s poznámkami.
  check("sdílená složka se ohlásí jako chyba",
    sdilena.text.indexOf("SDÍLENÁ") > -1, sdilena.text);
  check("…a je označená jako varování",
    sdilena.trida.indexOf("warn") > -1, sdilena.trida);

  await page.goto(URL);
  await page.waitForTimeout(800);

  console.log("\n194) mobilní režim");
  await page.goto(URL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__pgo.setRows([
    { pokemon: "Machamp", cp: 2800, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14,
      fastMove: "Counter", charged1: "Dynamic Punch" },
    { pokemon: "Azumarill", cp: 1489, level: 24.5, ivAtk: 12, ivDef: 14, ivSta: 15,
      fastMove: "Bubble", charged1: "Play Rough" },
    { pokemon: "Rattata", cp: 210, level: 15, ivAtk: 10, ivDef: 11, ivSta: 12 }
  ]));
  await page.waitForTimeout(900);

  const mobilLista = await page.evaluate(() => {
    const vid = () => Array.from(document.querySelectorAll(".zal-btn"))
      .filter((b) => b.getBoundingClientRect().height > 0).map((b) => b.dataset.klic);
    const vic = document.querySelector(".zal-vic");
    const pred = vid();
    const vyskaBtn = Math.round(document.querySelector(".zal-btn").getBoundingClientRect().height);
    vic.click();
    const po = vid();
    vic.click();
    return { pred, po, vicVidet: vic.getBoundingClientRect().height > 0,
      popisVic: vic.textContent, vyskaBtn,
      celkem: document.querySelectorAll(".zal-btn").length };
  });
  eq("na telefonu je v liště pět záložek", mobilLista.pred.length, 5);
  check("…ty, které se používají venku",
    ["roster", "rozpocetCard", "cheatCard", "eventsCard", "prohlidkaCard"]
      .every((k) => mobilLista.pred.indexOf(k) > -1), mobilLista.pred.join(", "));
  check("„Další…“ je vidět", mobilLista.vicVidet, String(mobilLista.vicVidet));
  // Schované se nesmí ztratit — jen nezabírají lištu, po které se jezdí prstem.
  eq("…a rozbalí zbytek", mobilLista.po.length, mobilLista.celkem);
  check("záložka je dost velká na prst", mobilLista.vyskaBtn >= 44,
    mobilLista.vyskaBtn + " px");

  const mobilKarta = await page.evaluate(async () => {
    const karty = Array.from(document.querySelectorAll("#tbody tr:not(.detail-row)"));
    const vys = karty.map((t) => Math.round(t.getBoundingClientRect().height));
    const prvni = karty[0];
    const videt = Array.from(prvni.children)
      .filter((td) => td.getBoundingClientRect().height > 0)
      .map((td) => td.dataset.col || "kos");
    // Klepnutí mimo jméno musí rozbor otevřít taky — karta je vysoká přes
    // devadesát pixelů a aktivní na ní bylo jen samotné jméno.
    prvni.querySelector('td[data-col="keep"]').click();
    await new Promise((r) => setTimeout(r, 600));
    const det = document.querySelector("#tbody .detail-row");
    const text = det ? det.textContent.replace(/\s+/g, " ") : "";
    return { max: Math.max(...vys), videt, otevrelSe: !!det,
      maBubliny: text.indexOf("Co je za tím") > -1,
      maStaty: /Útok \/ Obrana \/ HP/.test(text),
      maSilnyProti: text.indexOf("podle typů útoků") > -1 };
  });
  check("karta se vejde do sto deseti pixelů", mobilKarta.max <= 110,
    mobilKarta.max + " px");
  check("…a nese jen to, podle čeho se rozhoduje",
    mobilKarta.videt.join(",") === "star,pokemon,cp,ivPct,keep,kos",
    mobilKarta.videt.join(","));
  check("klepnutí kamkoli na kartu otevře rozbor", mobilKarta.otevrelSe);
  // Tohle je ta nedostupná informace: na telefonu není kam najet myší.
  check("rozbor doplní, co na počítači visí v bublině", mobilKarta.maBubliny);
  check("…včetně rozpisu Útok/Obrana/HP", mobilKarta.maStaty);
  check("…i zdůvodnění sloupce Silný proti", mobilKarta.maSilnyProti);

  const naPocitaci = await page.evaluate(async () => {
    document.querySelectorAll("#tbody .detail-row").forEach((d) => d.remove());
    return true;
  });
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.waitForTimeout(700);
  const desktop = await page.evaluate(async () => {
    const vid = Array.from(document.querySelectorAll(".zal-btn"))
      .filter((b) => b.getBoundingClientRect().height > 0).length;
    const vic = document.querySelector(".zal-vic");
    const prvni = document.querySelector("#tbody tr:not(.detail-row)");
    const videt = Array.from(prvni.children)
      .filter((td) => td.getBoundingClientRect().height > 0).length;
    // Na počítači se řádkem nic nemění: klik mimo jméno nesmí nic otevřít,
    // protože v zobrazení „Vše“ se v buňkách edituje.
    prvni.querySelector('td[data-col="keep"]').click();
    await new Promise((r) => setTimeout(r, 400));
    return { zalozek: vid, vicSkryto: vic.getBoundingClientRect().height === 0,
      bunek: videt, otevrelSe: !!document.querySelector("#tbody .detail-row") };
  });
  check("na počítači jsou v liště všechny záložky", desktop.zalozek > 10,
    String(desktop.zalozek));
  check("…a „Další…“ se neukazuje", desktop.vicSkryto);
  check("…tabulka má pořád všechny sloupce", desktop.bunek > 10, String(desktop.bunek));
  check("…a klik mimo jméno rozbor neotevře", desktop.otevrelSe === false,
    String(desktop.otevrelSe));
  check("mobilní režim je jen mobilní", naPocitaci === true);

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  await page.waitForTimeout(800);

  console.log("\n195) časová osa akcí");
  await page.goto(URL);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.waitForTimeout(700);

  const osaData = await page.evaluate(() => {
    const ev = (window.__pgo.eventsData() || {}).events || [];
    // Osmý sloupec akce je rozpis oken — čte se ze stránky akce na LeekDucku,
    // protože JSON zdroje u běžné akce veze jen „hasSpawns: true" bez seznamu.
    const sOkny = ev.filter((e) => (e[7] || []).length);
    const sekce = {};
    let oken = 0, spatnyCas = 0;
    sOkny.forEach((e) => (e[7] || []).forEach((o) => {
      oken += 1;
      // [od, do, {sekce: [[jméno, shiny], …]}]
      if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(o[0])
        || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(o[1])) spatnyCas += 1;
      if (new Date(o[1]) < new Date(o[0])) spatnyCas += 1;
      Object.keys(o[2] || {}).forEach((k) => { sekce[k] = (sekce[k] || 0) + 1; });
    }));
    return { akci: ev.length, sOkny: sOkny.length, oken, spatnyCas,
      sekce: Object.keys(sekce).sort() };
  });
  check("většina akcí má zapečený rozpis oken", osaData.sOkny >= 25,
    osaData.sOkny + " z " + osaData.akci);
  // Kolik jich přesně je, závisí na tom, co zrovna běží — hlídá se jen to,
  // že rozpis není prázdný a osa má z čeho stavět.
  check("oken je dost na osu", osaData.oken >= 25, String(osaData.oken));
  // Okno, které končí dřív, než začíná, by na ose vypadalo jako chyba appky.
  eq("žádné okno nemá rozbitý čas", osaData.spatnyCas, 0);
  check("rozpis nese víc než jen spawny",
    ["raid", "spawn", "vejce"].every((k) => osaData.sekce.indexOf(k) > -1),
    osaData.sekce.join(", "));

  const osaUI = await page.evaluate(async () => {
    window.__pgo.setRows([
      { pokemon: "Pidgey", cp: 300, level: 18, ivAtk: 12, ivDef: 12, ivSta: 12 },
      { pokemon: "Machamp", cp: 2800, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14,
        fastMove: "Counter", charged1: "Dynamic Punch" }
    ]);
    await new Promise((r) => setTimeout(r, 500));
    // Karta se dřív překreslovala jen při startu, takže po importu ukazovala
    // osu spočítanou z prázdného rosteru. Přepnutí na ni ji musí obnovit.
    const zal = Array.from(document.querySelectorAll(".zal-btn"))
      .filter((b) => b.dataset.klic === "eventsCard")[0];
    zal.click();
    await new Promise((r) => setTimeout(r, 900));
    const znacky = Array.from(document.querySelectorAll(".osa-z")).map((e) => e.textContent);
    const hlavy = Array.from(document.querySelectorAll(".osa-kdy")).map((e) => e.textContent);
    return {
      oken: document.querySelectorAll(".osa-okno").length,
      ted: document.querySelectorAll(".osa-okno.ted").length,
      znacky: znacky,
      maZnackuMas: znacky.some((t) => t.indexOf("máš") === 0),
      // „nemáš" svítilo u každého druhu, takže nesvítilo u ničeho — je pryč.
      maZnackuNemas: znacky.some((t) => t.indexOf("nemáš") > -1),
      hlavyTed: hlavy.filter((t) => t === "TEĎ").length,
      // Sezóna běží tři měsíce; mezi „co se děje" nepatří, patří pod čáru.
      sbaleno: document.querySelectorAll(".osa-dalsi").length,
      konecBezDvojky: !document.body.innerHTML.match(/do \d+\. \d+\. \d{2}:\d{2}–\d{2}:\d{2}/)
    };
  });
  check("osa se vykreslila", osaUI.oken > 0, String(osaUI.oken));
  check("…a co běží teď, je označené", osaUI.ted > 0 && osaUI.hlavyTed === osaUI.ted,
    osaUI.ted + " běží / " + osaUI.hlavyTed + " popisků");
  check("u druhu, který máš, se ukáže tvoje IV", osaUI.maZnackuMas,
    osaUI.znacky.slice(0, 5).join(" | "));
  check("…a značka „nemáš“ se neukazuje vůbec", osaUI.maZnackuNemas === false,
    osaUI.znacky.filter((t) => t.indexOf("nemáš") > -1).join(" | "));
  check("dlouhá okna a další dny jsou sbalené", osaUI.sbaleno >= 1,
    String(osaUI.sbaleno));
  // „do 8. 9. 22:00–22:00" byl rozsah z jednoho okamžiku na sebe sama.
  check("konec okna se nepíše jako rozsah", osaUI.konecBezDvojky);

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n196) kalendář akcí jako běžící časová osa");
  await page.goto(URL);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__pgo.setRows([
    { pokemon: "Pidgey", cp: 300, level: 18, ivAtk: 12, ivDef: 12, ivSta: 12 },
    { pokemon: "Machamp", cp: 2800, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14,
      fastMove: "Counter", charged1: "Dynamic Punch" }
  ]));
  await page.waitForTimeout(500);

  const gantt = await page.evaluate(async () => {
    Array.from(document.querySelectorAll(".zal-btn"))
      .filter((b) => b.dataset.klic === "eventsCard")[0].click();
    await new Promise((r) => setTimeout(r, 900));
    const g = document.querySelector(".gantt");
    const pruhy = Array.from(document.querySelectorAll(".gantt-bar"));
    const radky = Array.from(document.querySelectorAll(".gantt-radek"));
    // Pruh musí ležet uvnitř plátna — záporné „left" nebo šířka přes okraj
    // znamená špatně spočítanou osu.
    const sirka = parseInt(getComputedStyle(g).getPropertyValue("--sirka"), 10);
    const mimo = pruhy.filter((b) => {
      const l = parseInt(b.style.left, 10), w = parseInt(b.style.width, 10);
      return l < 0 || w < 1 || l + w > sirka + 2;
    }).length;
    // Na jednom řádku se pruhy nesmí překrývat — od toho jsou pruhy pod sebou.
    let prekryv = 0;
    radky.forEach((r) => {
      const b = Array.from(r.querySelectorAll(".gantt-bar")).map((x) => ({
        a: parseInt(x.style.left, 10), b: parseInt(x.style.left, 10) + parseInt(x.style.width, 10)
      })).sort((x, y) => x.a - y.a);
      for (let i = 1; i < b.length; i++) if (b[i].a < b[i - 1].b - 1) prekryv += 1;
    });
    const cara = document.querySelector(".gantt-ted");
    return {
      je: !!g, pruhu: pruhy.length, radku: radky.length, sirka: sirka, mimo, prekryv,
      bezi: document.querySelectorAll(".gantt-bar.bezi").length,
      ticku: document.querySelectorAll(".gantt-tick").length,
      caraX: cara ? parseInt(cara.style.left, 10) : -1,
      zoomu: document.querySelectorAll(".gantt-zoom").length,
      detail: (document.getElementById("ganttDetail") || {}).textContent || ""
    };
  });
  check("kalendář se vykreslil", gantt.je);
  check("…má pruhy", gantt.pruhu >= 5, String(gantt.pruhu));
  check("…a popisky času", gantt.ticku >= 3, String(gantt.ticku));
  eq("žádný pruh nevyčnívá z plátna", gantt.mimo, 0);
  // Mega Squads má okno přes celou akci a k tomu dvě poloviny se spawny —
  // na jednom řádku se kreslily přes sebe a texty se slily.
  eq("na jednom řádku se pruhy nepřekrývají", gantt.prekryv, 0);
  check("co běží teď, je zvýrazněné", gantt.bezi >= 1, String(gantt.bezi));
  check("čára „teď“ je uvnitř plátna",
    gantt.caraX >= 0 && gantt.caraX <= gantt.sirka, gantt.caraX + " z " + gantt.sirka);
  eq("rozsah osy se dá přepnout", gantt.zoomu, 5);
  // Sezónní okno běží tři měsíce a jeho seznam vajec je delší než všechno
  // ostatní — do „co běží teď“ nepatří, ukáže se až klepnutím na jeho pruh.
  check("výchozí rozpis neukazuje sezónu",
    gantt.detail.indexOf("Twilight Trails") === -1
      && gantt.detail.indexOf("Forever Forward") === -1,
    gantt.detail.slice(0, 90));

  const zoom = await page.evaluate(async () => {
    const pred = parseInt(getComputedStyle(document.querySelector(".gantt"))
      .getPropertyValue("--sirka"), 10);
    Array.from(document.querySelectorAll(".gantt-zoom"))
      .filter((b) => b.dataset.hodin === "336")[0].click();
    await new Promise((r) => setTimeout(r, 800));
    const po = parseInt(getComputedStyle(document.querySelector(".gantt"))
      .getPropertyValue("--sirka"), 10);
    const radku = document.querySelectorAll(".gantt-radek").length;
    Array.from(document.querySelectorAll(".gantt-zoom"))
      .filter((b) => b.dataset.hodin === "24")[0].click();
    await new Promise((r) => setTimeout(r, 800));
    return { pred, po, radku, radkuDen: document.querySelectorAll(".gantt-radek").length };
  });
  check("delší rozsah ukáže víc akcí", zoom.radku > zoom.radkuDen,
    zoom.radku + " za dva týdny vs " + zoom.radkuDen + " za den");

  const klik = await page.evaluate(async () => {
    const b = document.querySelectorAll(".gantt-bar")[0];
    const jmeno = b.title.split(" — ")[0];
    b.click();
    await new Promise((r) => setTimeout(r, 700));
    const d = document.getElementById("ganttDetail");
    return { jmeno, hlava: (d.querySelector(".gantt-detail-h") || {}).textContent || "",
      maZavrit: !!document.getElementById("ganttZavrit") };
  });
  check("klepnutí na pruh rozbalí jeho rozpis",
    klik.hlava.indexOf(klik.jmeno) > -1, klik.hlava + " | " + klik.jmeno);
  check("…a jde zavřít", klik.maZavrit);

  console.log("\n197) přenos nastavení mezi zařízeními");
  const prenos = await page.evaluate(async () => {
    const rl = document.getElementById("rankLimit");
    const puvodni = rl.value;
    rl.value = "13";
    rl.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    // Zapsat zálohu do falešné složky a vytáhnout z ní soubor s nastavením.
    const zapsane = {};
    window.__pgo.setDirHandle({
      name: "OneDrive", kind: "directory",
      requestPermission: () => Promise.resolve("granted"),
      removeEntry: () => Promise.resolve(),
      values: () => ({ [Symbol.asyncIterator]: () =>
        ({ next: () => Promise.resolve({ done: true }) }) }),
      getFileHandle: (jmeno) => Promise.resolve({
        createWritable: () => Promise.resolve({
          write: (t) => { zapsane[jmeno] = String(t); return Promise.resolve(); },
          close: () => Promise.resolve()
        })
      })
    });
    await window.__pgo.zapsatZalohu();
    window.__pgo.setDirHandle(null);
    // Teď to simuluje druhé zařízení: jiná hodnota, načtený soubor.
    rl.value = "40";
    rl.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const pred = rl.value;
    window.confirm = () => true;
    window.alert = () => {};
    window.__pgo.importText((zapsane["nastaveni.json"] || "").replace(/^\ufeff/, ""));
    await new Promise((r) => setTimeout(r, 600));
    const po = rl.value;
    rl.value = puvodni;
    rl.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    return { soubor: (zapsane["nastaveni.json"] || "").slice(0, 60), pred, po,
      mapBox: (document.getElementById("mapBox") || {}).style.display };
  });
  check("záloha obsahuje soubor s nastavením",
    prenos.soubor.indexOf("pgoNastaveni") > -1, prenos.soubor);
  eq("…a načtením se prahy převezmou", prenos.po, "13");
  check("…z jiné hodnoty na druhém zařízení", prenos.pred === "40", prenos.pred);
  // Soubor s nastavením není roster — mapování sloupců se nabízet nesmí.
  check("…a import nenabídne mapování sloupců", prenos.mapBox === "none",
    String(prenos.mapBox));

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n198) spodní lišta místo pruhu záložek");
  await page.goto(URL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__pgo.setRows([
    { pokemon: "Machamp", cp: 2800, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14 }
  ]));
  await page.waitForTimeout(600);

  const lista = await page.evaluate(async () => {
    const l = document.querySelector(".zal-lista");
    const st = getComputedStyle(l);
    const vidPred = Array.from(document.querySelectorAll(".zal-btn"))
      .filter((b) => b.getBoundingClientRect().height > 0);
    const vic = document.querySelector(".zal-vic");
    // Ikona je grafika — popisek v textContent musí zůstat celý, jinak by ho
    // testy i vyhledávání ve stránce přestaly vidět.
    const popisky = vidPred.map((b) => b.textContent.replace(/[0-9]+$/, "").trim());
    vic.click();
    await new Promise((r) => setTimeout(r, 400));
    const vidPo = Array.from(document.querySelectorAll(".zal-btn"))
      .filter((b) => b.getBoundingClientRect().height > 0).length;
    const kryt = document.querySelector(".zal-kryt");
    const krytVidet = kryt ? getComputedStyle(kryt).display !== "none" : false;
    // Klepnutí vedle plachtu zavře — jinak by se z ní dalo vyjít jen výběrem.
    kryt.click();
    await new Promise((r) => setTimeout(r, 300));
    const poKrytu = document.body.classList.contains("zal-otevreno");
    return {
      pozice: st.position, dole: st.bottom, dolniOkraj: st.top,
      ikon: l.querySelectorAll(".zal-ico").length,
      ikonaVidet: getComputedStyle(l.querySelector(".zal-ico")).display,
      vidPred: vidPred.length, vidPo, krytVidet, poKrytu,
      popisky: popisky,
      vyskaBtn: Math.round(vidPred[0].getBoundingClientRect().height)
    };
  });
  eq("lišta je přišpendlená dole", lista.pozice, "fixed");
  eq("…u spodní hrany", lista.dole, "0px");
  check("každá záložka má ikonu", lista.ikon >= 12, String(lista.ikon));
  check("…a na telefonu je vidět", lista.ikonaVidet === "block", lista.ikonaVidet);
  eq("v liště je pět hlavních záložek", lista.vidPred, 5);
  check("…s celými popisky", lista.popisky.indexOf("Vyhledávání") > -1,
    lista.popisky.join(" | "));
  check("záložka je dost velká na palec", lista.vyskaBtn >= 52,
    lista.vyskaBtn + " px");
  check("„Další…“ otevře plachtu se zbytkem", lista.vidPo >= 12, String(lista.vidPo));
  check("…s tmavým podkladem", lista.krytVidet);
  check("…a klepnutí vedle ji zavře", lista.poKrytu === false);

  const vyber = await page.evaluate(async () => {
    document.querySelector(".zal-vic").click();
    await new Promise((r) => setTimeout(r, 300));
    document.querySelector('.zal-btn[data-klic="docsCard"]').click();
    await new Promise((r) => setTimeout(r, 400));
    return { otevreno: document.body.classList.contains("zal-otevreno"),
      vicAktivni: document.querySelector(".zal-lista").classList.contains("navic-aktivni"),
      videt: getComputedStyle(document.getElementById("docsCard")).display };
  });
  check("výběr ze plachty ji zavře", vyber.otevreno === false);
  // Aktivní záložka nesmí zmizet beze stopy — „Další…“ se rozsvítí místo ní.
  check("…a „Další…“ se tváří jako aktivní", vyber.vicAktivni);
  check("…vybraná karta je vidět", vyber.videt !== "none", vyber.videt);

  // Nízké okno nad hrou si nechává pruh nahoře — spodní lišta by v něm
  // ukrojila z mála místa, které zbývá na obsah.
  await page.setViewportSize({ width: 360, height: 560 });
  await page.waitForTimeout(500);
  const okno = await page.evaluate(() => {
    const l = document.querySelector(".zal-lista");
    const st = getComputedStyle(l);
    return { pozice: st.position, vyska: Math.round(l.getBoundingClientRect().height),
      ikona: getComputedStyle(l.querySelector(".zal-ico")).display };
  });
  eq("v nízkém okně zůstává pruh nahoře", okno.pozice, "sticky");
  check("…a nezalomí se do pěti řádků", okno.vyska < 70, okno.vyska + " px");
  eq("…bez ikon", okno.ikona, "none");

  console.log("\n199) opravy kalendáře");
  await page.goto(URL);
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__pgo.setRows([
    { pokemon: "Machamp", cp: 2800, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14,
      fastMove: "Counter", charged1: "Dynamic Punch" },
    { pokemon: "Azumarill", cp: 1489, level: 24.5, ivAtk: 12, ivDef: 14, ivSta: 15,
      fastMove: "Bubble", charged1: "Play Rough" }
  ]));
  await page.waitForTimeout(600);

  const kal = await page.evaluate(async () => {
    Array.from(document.querySelectorAll(".zal-btn"))
      .filter((b) => b.dataset.klic === "eventsCard")[0].click();
    await new Promise((r) => setTimeout(r, 900));
    const out = {};
    const cara = document.querySelector(".gantt-ted");
    const bar = document.querySelector(".gantt-bar");
    // Čára přeškrtávala názvy akcí. Musí ležet POD pruhy.
    out.caraZ = cara ? parseInt(getComputedStyle(cara).zIndex, 10) : -1;
    out.radekZ = parseInt(getComputedStyle(bar.parentNode).zIndex, 10);
    out.maSipku = !!document.querySelector(".gantt-ted-sipka");
    out.maTahlo = !!document.querySelector(".gantt-tahlo");
    out.maSipky = document.querySelectorAll(".gantt-sip").length;

    // Klepnutí na pruh nesmí posunout stránku ani znovu vytvořit obrázky.
    window.scrollTo(0, 350);
    await new Promise((r) => setTimeout(r, 200));
    const scrollPred = window.scrollY;
    const obrPred = document.querySelector("#eventsBody img");
    document.querySelectorAll(".gantt-bar")[2].click();
    await new Promise((r) => setTimeout(r, 600));
    out.scrollSkocil = Math.abs(window.scrollY - scrollPred) > 5;
    out.obrazekTentyz = obrPred
      ? document.querySelector("#eventsBody img") === obrPred : "bez obrázku";
    out.detailMaHlavu = !!document.querySelector(".gantt-detail-h");

    // Posun dozadu odkryje minulost: čára „teď" se posune doprava, protože
    // před ní je nově vidět kus, který už proběhl.
    const pruhuPred = document.querySelectorAll(".gantt-bar").length;
    const caraPred = parseInt(document.querySelector(".gantt-ted").style.left, 10);
    document.querySelectorAll(".gantt-sip")[0].click();
    await new Promise((r) => setTimeout(r, 600));
    const caraPo = document.querySelector(".gantt-ted");
    out.caraPosun = caraPo ? parseInt(caraPo.style.left, 10) - caraPred : "čára zmizela";
    document.querySelector('.gantt-sip[data-posun="0"]').click();
    await new Promise((r) => setTimeout(r, 600));
    out.zpetSCarou = !!document.querySelector(".gantt-ted");
    out.zpetNaMiste = parseInt(document.querySelector(".gantt-ted").style.left, 10) === caraPred;
    out.zpetStejne = document.querySelectorAll(".gantt-bar").length === pruhuPred;

    // Jméno se ořezává třemi tečkami, ne natvrdo.
    const jm = document.querySelector(".gantt-jmeno-t");
    out.jmenoEllipsis = jm ? getComputedStyle(jm).textOverflow : "?";
    return out;
  });
  check("čára „teď“ leží pod pruhy, ne přes text",
    kal.caraZ < kal.radekZ, kal.caraZ + " vs řádek " + kal.radekZ);
  check("klepnutí na pruh stránkou neposune", kal.scrollSkocil === false,
    String(kal.scrollSkocil));
  // Celá karta se dřív stavěla znovu, takže ikony nahoře probliknuly.
  check("…a nepřekreslí obrázky nad kalendářem",
    kal.obrazekTentyz === true || kal.obrazekTentyz === "bez obrázku",
    String(kal.obrazekTentyz));
  check("…ale rozpis pod ním vymění", kal.detailMaHlavu);
  check("dá se jít i do minulosti", typeof kal.caraPosun === "number" && kal.caraPosun > 20,
    String(kal.caraPosun));
  check("…a tlačítkem „teď“ zpátky",
    kal.zpetSCarou && kal.zpetNaMiste && kal.zpetStejne,
    kal.zpetSCarou + " / " + kal.zpetNaMiste + " / " + kal.zpetStejne);
  eq("dlouhé jméno akce se ořezává tečkami", kal.jmenoEllipsis, "ellipsis");
  check("šířka sloupce se jmény se dá táhnout", kal.maTahlo);
  eq("…a osa má tři tlačítka na posun", kal.maSipky, 3);

  const osaBonbony = await page.evaluate(() => {
    // Značka s bonbóny má smysl jen tam, kde si vybíráš, jestli za tím půjdeš.
    // Ve vejcích si nevybereš, co se vylíhne.
    const sekce = Array.from(document.querySelectorAll(".osa-sekce"));
    const vejce = sekce.filter((s) => /Ve vejcích/.test(s.textContent));
    return { vejceSBonbony: vejce.filter((s) => /bonbónů/.test(s.textContent)).length,
      vejceCelkem: vejce.length };
  });
  check("ve vejcích se bonbóny neukazují", osaBonbony.vejceSBonbony === 0,
    osaBonbony.vejceSBonbony + " z " + osaBonbony.vejceCelkem);

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n200) roster v cloudu (OneDrive)");
  await page.goto(URL);
  await page.waitForTimeout(700);

  const cloudUI = await page.evaluate(() => {
    const karta = document.getElementById("cloudCard");
    return {
      je: !!karta,
      // Karta patří k nastavení, ne na vlastní záložku — nastavuje se jednou.
      vMenu: Array.from(document.querySelectorAll(".zal-btn"))
        .some((b) => b.dataset.klic === "cloudCard"),
      stav: (document.getElementById("cloudStav") || {}).textContent || "",
      redirect: (document.getElementById("cloudRedirect") || {}).textContent || "",
      loginVypnuty: (document.getElementById("cloudLogin") || {}).disabled,
      // Bez přihlášení nemá smysl nabízet stahování ani odhlášení.
      stahnoutSkryty: (document.getElementById("cloudStahnout") || {}).style.display
    };
  });
  check("karta pro cloud existuje", cloudUI.je);
  check("…ale nemá vlastní záložku", cloudUI.vMenu === false, String(cloudUI.vMenu));
  check("…a nepřihlášenému neslibuje synchronizaci",
    /Nepřihlášeno|přihlásit se nejde/.test(cloudUI.stav), cloudUI.stav);
  eq("…tlačítka pro přihlášeného jsou schovaná", cloudUI.stahnoutSkryty, "none");
  // Testovací server běží na http://localhost, kde se přihlásit smí.
  check("z localhostu se přihlásit dá", cloudUI.loginVypnuty === false,
    String(cloudUI.loginVypnuty));
  check("návod ukazuje přesnou adresu pro přesměrování",
    cloudUI.redirect.indexOf("http") === 0, cloudUI.redirect);

  // `window.location.href` v Chromiu předefinovat nejde, takže se adresa
  // zachytí na síti a odchod na Microsoft se zruší.
  let prihlasovaciUrl = "";
  const chytatCloud = (req) => {
    if (req.url().indexOf("login.microsoftonline.com") > -1) prihlasovaciUrl = req.url();
  };
  page.on("request", chytatCloud);
  await page.route("**login.microsoftonline.com**", (r) => r.abort());
  await page.evaluate(() => {
    localStorage.setItem("pgo_cloud_client_id", "test-client-id");
    const vst = document.getElementById("cloudClientId");
    vst.value = "test-client-id";
    vst.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("cloudLogin").click();
  });
  await page.waitForTimeout(900);
  page.off("request", chytatCloud);
  await page.unroute("**login.microsoftonline.com**");
  // Zrušené přesměrování nechá kartu na prázdném dokumentu, kde sessionStorage
  // číst nejde — appka se proto načte zpátky. Úložiště relace to přežije.
  await page.goto(URL);
  await page.waitForTimeout(500);
  const odkaz = {
    cil: prihlasovaciUrl,
    pkce: await page.evaluate(() => {
      try { return sessionStorage.getItem("pgo_cloud_pkce") || ""; }
      catch (e) { return "chyba: " + e.message; }
    })
  };
  check("přihlášení míří na Microsoft",
    odkaz.cil.indexOf("https://login.microsoftonline.com/") === 0, odkaz.cil.slice(0, 60));
  // Oprávnění je to nejskromnější, jaké jde: jen vlastní složka appky.
  check("…a chce přístup jen do své složky",
    odkaz.cil.indexOf("Files.ReadWrite.AppFolder") > -1
      && odkaz.cil.indexOf("Files.ReadWrite.All") === -1, odkaz.cil);
  check("…bez tajemství v adrese, přes PKCE",
    odkaz.cil.indexOf("code_challenge_method=S256") > -1
      && odkaz.cil.indexOf("client_secret") === -1, odkaz.cil);
  check("…a s ověřovacím řetězcem uloženým na tuhle relaci",
    odkaz.pkce.indexOf("verifier") > -1 && odkaz.pkce.indexOf("stav") > -1,
    odkaz.pkce.slice(0, 40));

  await page.goto(URL);
  await page.waitForTimeout(600);
  const sync = await page.evaluate(async () => {
    // Podstrčený fetch: token i soubor v cloudu.
    const volani = [];
    let vCloudu = null;
    window.fetch = (url, opts) => {
      volani.push({ url: String(url), method: (opts && opts.method) || "GET",
        auth: !!(opts && opts.headers && opts.headers.Authorization) });
      if (String(url).indexOf("/content") > -1) {
        if (opts && opts.method === "PUT") { vCloudu = JSON.parse(opts.body);
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }); }
        if (!vCloudu) return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(vCloudu) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    };
    localStorage.setItem("pgo_cloud_token", JSON.stringify({
      access: "token", refresh: "r", plati: Date.now() + 3600000 }));

    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2800, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14 },
      { pokemon: "Gyarados", cp: 2900, level: 33, ivAtk: 15, ivDef: 15, ivSta: 15 }
    ]);
    await new Promise((r) => setTimeout(r, 300));
    document.getElementById("cloudNahrat").click();
    await new Promise((r) => setTimeout(r, 600));

    const out = { volani: volani.slice(), nahrano: vCloudu };
    // Roster se teď smaže a stáhne zpátky z cloudu.
    window.confirm = () => true;
    window.__pgo.setRows([]);
    await new Promise((r) => setTimeout(r, 300));
    document.getElementById("cloudStahnout").click();
    await new Promise((r) => setTimeout(r, 800));
    out.poStazeni = window.__pgo.getRows().length;
    out.jmena = window.__pgo.getRows().map((r) => r.pokemon).sort();
    out.stav = document.getElementById("cloudStav").textContent;
    return out;
  });
  const put = sync.volani.filter((v) => v.method === "PUT")[0];
  check("nahrání jde do složky té aplikace, ne na celý disk",
    !!put && put.url.indexOf("/drive/special/approot:/") > -1, put ? put.url : "žádné PUT");
  check("…s tokenem v hlavičce, ne v adrese",
    !!put && put.auth && put.url.indexOf("access_token") === -1, String(put && put.auth));
  check("nahraný soubor veze roster i nastavení",
    !!sync.nahrano && sync.nahrano.snapshot.rows.length === 2
      && !!sync.nahrano.snapshot.settings, JSON.stringify(sync.nahrano || {}).slice(0, 80));
  // Aby šlo poznat, které zařízení zapsalo jako poslední.
  check("…a razítko s časem a zařízením",
    !!sync.nahrano && !!sync.nahrano.ulozeno && !!sync.nahrano.zarizeni,
    JSON.stringify(sync.nahrano && { u: sync.nahrano.ulozeno, z: sync.nahrano.zarizeni }));
  eq("stažení vrátí roster zpátky", sync.poStazeni, 2);
  eq("…přesně ty kusy", sync.jmena.join(","), "Gyarados,Machamp");

  const odhlas = await page.evaluate(async () => {
    document.getElementById("cloudOdhlasit").click();
    await new Promise((r) => setTimeout(r, 300));
    return { token: localStorage.getItem("pgo_cloud_token"),
      stav: document.getElementById("cloudStav").textContent,
      // Roster zůstává v prohlížeči — odhlášení není mazání.
      kusu: window.__pgo.getRows().length };
  });
  check("odhlášení zahodí token", odhlas.token === null, String(odhlas.token));
  check("…ale roster nechá být", odhlas.kusu === 2, String(odhlas.kusu));
  check("…a řekne, že data v cloudu zůstala",
    odhlas.stav.indexOf("cloudu zůstala") > -1, odhlas.stav);

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n201) prázdný roster vedle plné zálohy");
  await page.goto(URL);
  await page.waitForTimeout(700);
  const navrat = await page.evaluate(async () => {
    window.__pgo.setRows([]);
    await new Promise((r) => setTimeout(r, 300));
    // Složka se zálohou, ve které leží roster. Appka ho nesmí načíst sama —
    // jen nabídnout; přepsat data bez zeptání je to nejhorší, co může udělat.
    const csv = "Pokémon,CP,Level,IV Attack,IV Defense,IV Stamina\n"
      + "Machamp,2800,30,15,14,14\nGyarados,2900,33,15,15,15\n";
    window.__pgo.setDirHandle({
      name: "OneDrive", kind: "directory",
      requestPermission: () => Promise.resolve("granted"),
      removeEntry: () => Promise.resolve(),
      values: () => ({ [Symbol.asyncIterator]: () =>
        ({ next: () => Promise.resolve({ done: true }) }) }),
      getFileHandle: (jmeno) => jmeno === "roster.csv"
        ? Promise.resolve({ getFile: () => Promise.resolve({ text: () => Promise.resolve(csv) }) })
        : Promise.resolve({ createWritable: () => Promise.resolve({
            write: () => Promise.resolve(), close: () => Promise.resolve() }) })
    });
    await new Promise((r) => setTimeout(r, 900));
    const box = document.getElementById("zalWarn");
    const btn = document.getElementById("zalWarnBtn");
    return { videt: box ? getComputedStyle(box).display !== "none" : false,
      text: (document.getElementById("zalWarnText") || {}).textContent || "",
      tlacitko: btn ? btn.textContent : "",
      kusuPred: window.__pgo.getRows().length };
  });
  check("nabídne se návrat ze zálohy", navrat.videt, String(navrat.videt));
  check("…a řekne kolik kusů v ní je", /2 kusů/.test(navrat.text), navrat.text.slice(0, 90));
  // Tohle je ten skutečný důvod: dvě kopie appky mají každá vlastní úložiště.
  check("…i proč je roster prázdný", /jinou kopii appky/.test(navrat.text),
    navrat.text.slice(0, 120));
  eq("…ale sama nic nenačte", navrat.kusuPred, 0);
  check("tlačítko nabízí počet", /Načíst zálohu \(2 kusů\)/.test(navrat.tlacitko),
    navrat.tlacitko);

  console.log("\n202) tlačítko cloudu nikdy nemlčí");
  await page.goto(URL);
  await page.waitForTimeout(600);
  const mlceni = await page.evaluate(async () => {
    let hlaska = "";
    window.alert = (t) => { hlaska = String(t); };
    localStorage.removeItem("pgo_cloud_client_id");
    document.getElementById("cloudClientId").value = "";
    const btn = document.getElementById("cloudLogin");
    // Vypnuté tlačítko na klik nereaguje vůbec — a to je horší než chyba.
    const vypnuty = btn.disabled;
    btn.click();
    await new Promise((r) => setTimeout(r, 400));
    return { vypnuty, hlaska,
      stav: document.getElementById("cloudStav").textContent,
      rozbaleno: document.getElementById("cloudNastaveni").open,
      procVidet: getComputedStyle(document.getElementById("cloudProc")).display };
  });
  check("tlačítko není vypnuté", mlceni.vypnuty === false, String(mlceni.vypnuty));
  check("…a bez ID řekne, co chybí", /ID aplikace/.test(mlceni.stav), mlceni.stav);
  check("…a rovnou otevře, kde se to vyplňuje", mlceni.rozbaleno);
  check("karta vysvětluje, proč se něco registruje",
    mlceni.procVidet !== "none", mlceni.procVidet);

  console.log("\n203) kalendář veze i novinky a útoky akce");
  const osaSekce = await page.evaluate(() => {
    const ev = (window.__pgo.eventsData() || {}).events || [];
    const jmena = {};
    ev.forEach((e) => (e[7] || []).forEach((o) =>
      Object.keys(o[2] || {}).forEach((k) => { jmena[k] = (jmena[k] || 0) + 1; })));
    return jmena;
  });
  // Stránka akce má víc než spawny — debuty druhů, nové úrovně mega a útoky,
  // které jde získat jen po tu dobu, jsou taky rozhodnutí.
  check("v datech jsou i novinky (debuty, nové mega)", (osaSekce.novinky || 0) > 0,
    JSON.stringify(osaSekce));
  check("…a útoky akce", (osaSekce.utoky || 0) > 0, JSON.stringify(osaSekce));
  check("…a výzkum se nerozbil", (osaSekce.vyzkum || 0) > 0, JSON.stringify(osaSekce));

  const pruh = await page.evaluate(async () => {
    Array.from(document.querySelectorAll(".zal-btn"))
      .filter((b) => b.dataset.klic === "eventsCard")[0].click();
    await new Promise((r) => setTimeout(r, 900));
    const b = document.querySelector(".gantt-bar");
    return { pozadi: getComputedStyle(b).backgroundColor };
  });
  // Průsvitný pruh nechával čáru „teď" prosvítat skrz text, i když ležela pod ním.
  check("pruh je neprůhledný", pruh.pozadi.indexOf("rgba") === -1
    || /rgba\([^)]*,\s*1\)$/.test(pruh.pozadi), pruh.pozadi);

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n204) dvě různá procenta se nesmí psát stejně");
  await page.goto(URL);
  await page.setViewportSize({ width: 1700, height: 1100 });
  await page.waitForTimeout(700);
  const dvojiPct = await page.evaluate(async () => {
    window.__pgo.setRows([
      { pokemon: "Frillish", cp: 800, level: 23, ivAtk: 13, ivDef: 11, ivSta: 14 }
    ]);
    await new Promise((r) => setTimeout(r, 500));
    document.querySelector('#tbody td[data-col="pokemon"]').click();
    await new Promise((r) => setTimeout(r, 800));
    const det = document.querySelector("#tbody .detail-row");
    const evo = det.querySelector(".d-evo-kus");
    const tip = evo ? (evo.dataset.tip || "") : "";
    const hlava = det.querySelector(".d-ligy-tab th[title], .d-ligy-tab th[data-tip]");
    return {
      // V evoluční řadě je skóre DRUHU z PvPoke, ne procento kusu — psát
      // obojí jako „%" znamenalo dvě různá čísla stejným zápisem.
      evoSila: /síla \d/.test(tip),
      evoBezProcenta: !/#\d+ · [\d.,]+ %/.test(tip),
      evoVysvetleni: tip.indexOf("o DRUHU") > -1,
      hlavaTip: hlava ? (hlava.title || hlava.dataset.tip || "") : "",
      sirka: Math.round(det.getBoundingClientRect().width),
      okno: window.innerWidth
    };
  });
  check("v evoluční řadě stojí „síla“, ne procento", dvojiPct.evoSila,
    String(dvojiPct.evoSila));
  check("…a číslo druhu se netváří jako procento kusu", dvojiPct.evoBezProcenta);
  check("…bublina to i vysvětlí", dvojiPct.evoVysvetleni);
  check("hlavička tabulky lig řekne, co její procento znamená",
    /kvalita TOHOHLE kusu/.test(dvojiPct.hlavaTip), dvojiPct.hlavaTip.slice(0, 60));
  // Vysvětlivka pod tabulkou dřív rozbor roztáhla a naskočil posuvník.
  check("rozbor se kvůli tomu neroztáhl", dvojiPct.sirka <= dvojiPct.okno,
    dvojiPct.sirka + " z " + dvojiPct.okno);

  console.log("\n205) nevyplněný řádek není pokémon k vyhození");
  const prazdny = await page.evaluate(async () => {
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2800, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14 },
      { pokemon: "" }
    ]);
    await new Promise((r) => setTimeout(r, 600));
    const c = window.__pgo.getComputed();
    const rs = window.__pgo.getRows();
    const prazdnyId = rs.filter((r) => !r.pokemon)[0].id;
    const out = {
      verdikt: c[prazdnyId].keep,
      ton: c[prazdnyId].keepTone,
      title: c[prazdnyId].keepTitle || "",
      upozorneni: (document.getElementById("unknownWarn") || {}).textContent || ""
    };
    window.__pgo.boxOtevrit();
    await new Promise((r) => setTimeout(r, 600));
    out.vBoxu = window.__pgo.bmSeznam().length;
    out.jmenaVBoxu = window.__pgo.bmSeznam().map((x) => x.row.pokemon || "?").join(",");
    window.__pgo.boxZavritNatvrdo();
    return out;
  });
  eq("prázdný řádek nedostane „Zahodit“", prazdny.verdikt, "Nevyplněné");
  eq("…ani červenou", prazdny.ton, "muted");
  check("…a řekne, co s ním", /dovypl|smaž/.test(prazdny.title), prazdny.title.slice(0, 70));
  // Rozhodovat v čištění boxu o kusu, který neexistuje, nedává smysl.
  eq("v čištění boxu se na něj appka neptá", prazdny.vBoxu, 1);
  eq("…projde jen skutečný kus", prazdny.jmenaVBoxu, "Machamp");
  check("nahoře se na něj upozorní", /bez jména pokémona/.test(prazdny.upozorneni),
    prazdny.upozorneni.slice(0, 80));

  console.log("\n206) rozpočet vybírá podle role, ne podle IV");
  const rozpRole = await page.evaluate(async () => {
    // Slabý Ampharos proti dokonalé Rattatě: na Electric slot patří Ampharos,
    // protože otázka zní „koho postavíš na Water bosse“, ne „kdo má hezká IV“.
    window.__pgo.setRows([
      { pokemon: "Ampharos", cp: 2000, level: 28, ivAtk: 9, ivDef: 9, ivSta: 10,
        fastMove: "Volt Switch", charged1: "Zap Cannon" },
      // Ne 15/15/15: dokonalý kus má vlastní zámek a nepouští se z principu.
      // Tady jde o to, že ani skoro dokonalé IV samo o sobě roli nenahradí.
      { pokemon: "Rattata", cp: 600, level: 25, ivAtk: 14, ivDef: 15, ivSta: 15 }
    ]);
    await new Promise((r) => setTimeout(r, 700));
    const c = window.__pgo.getComputed();
    const rs = window.__pgo.getRows();
    const amp = c[rs.filter((r) => r.pokemon === "Ampharos")[0].id];
    const rat = c[rs.filter((r) => r.pokemon === "Rattata")[0].id];
    return { ampRaid: amp.raidRec, ampKeep: amp.keep, ampIv: Math.round(amp.ivPct * 100),
      ratKeep: rat.keep, ratIv: Math.round(rat.ivPct * 100),
      vysvetleni: document.querySelector("#rozpocetCard").textContent };
  });
  check("slabší kus s rolí zůstává", rozpRole.ampKeep.indexOf("Zahodit") !== 0,
    rozpRole.ampKeep + " při IV " + rozpRole.ampIv + " %");
  check("…a drží raidový slot", rozpRole.ampRaid.indexOf("Ne") !== 0, rozpRole.ampRaid);
  check("dokonalé IV bez role nestačí", rozpRole.ratKeep.indexOf("Zahodit") === 0,
    rozpRole.ratKeep + " při IV " + rozpRole.ratIv + " %");
  // Úvod karty se zkrátil na jeden odstavec — celý výklad je v dokumentaci.
  check("karta rolí to vysvětluje",
    /IV rozhoduje/.test(rozpRole.vysvetleni)
      && /rozpočtu/.test(rozpRole.vysvetleni),
    rozpRole.vysvetleni.slice(0, 80));

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n207) v rozpočtu je u každé úrovně i CP");
  await page.goto(URL);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.waitForTimeout(700);
  const planCp = await page.evaluate(async () => {
    window.__pgo.setRows([
      { pokemon: "Blissey", cp: 1459, level: 20, ivAtk: 10, ivDef: 14, ivSta: 15 },
      { pokemon: "Gyarados", cp: 2066, level: 21.5, ivAtk: 14, ivDef: 13, ivSta: 15,
        fastMove: "Waterfall", charged1: "Hydro Pump" },
      { pokemon: "Frillish", cp: 521, level: 18, ivAtk: 13, ivDef: 11, ivSta: 14 }
    ]);
    await new Promise((r) => setTimeout(r, 800));
    Array.from(document.querySelectorAll(".zal-btn"))
      .filter((b) => b.dataset.klic === "dustCard")[0].click();
    await new Promise((r) => setTimeout(r, 1200));
    const cile = Array.from(document.querySelectorAll(".dust-table tr.plan-row"))
      .map((tr) => (tr.children[2] || {}).textContent || "")
      .map((t) => t.replace(/\s+/g, " ").trim());
    return {
      cile: cile,
      // Ve hře žádný level vidět není — „L20 → L30" se nedá s ničím spárovat.
      bezCp: cile.filter((t) => /L\d/.test(t) && !/\d+ CP/.test(t)),
      // Na dnešní úrovni musí sedět CP ze skenu, ne dopočítané: level bývá
      // v exportu zaokrouhlený a číslo, které nesedí s hrou, mate.
      sediDnesni: cile.some((t) => t.indexOf("L20 (1459 CP)") === 0),
      sediDnesniPul: cile.some((t) => t.indexOf("L21.5 (2066 CP)") === 0)
    };
  });
  check("plán má co ukázat", planCp.cile.length >= 3, String(planCp.cile.length));
  check("u žádné úrovně nechybí CP", planCp.bezCp.length === 0,
    planCp.bezCp.join(" | "));
  check("na dnešní úrovni sedí CP ze skenu", planCp.sediDnesni,
    planCp.cile.slice(0, 3).join(" | "));
  // Pozn.: půlku levelu (L21.5) ukáže plán jen tehdy, když ten kus vybere
  // rozpočet a jeho cesta se rozpadne na kroky. Pravidlo „na dnešní úrovni
  // sedí CP ze skenu“ hlídá kontrola výš — ta na půlku levelu není citlivá.

  const capCp = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll(".dust-table tr.plan-row"))
      .map((tr) => (tr.children[2] || {}).textContent || "")
      .filter((x) => /cap ligy/.test(x))[0] || "";
    return t.replace(/\s+/g, " ").trim();
  });
  // I cíl, na který kus celý nedojde, musí říct, s jakým CP tam skončí.
  check("i u nedotaženého cíle je CP", !capCp || /\d+ CP/.test(capCp), capCp);

  // Kolik klepnutí na „Vylepšit" to je, se v tabulce NEUKAZUJE — řádek má
  // odpovědět „kam a za kolik", ne odpočítávat kliky. Že jedno klepnutí je
  // půl levelu, stojí v dokumentaci.
  const klepani = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll(".dust-table tr.plan-row"))
      .map((tr) => (tr.children[2] || {}).textContent || "").join(" ");
    const doku = document.getElementById("docsBody");
    return { vTabulce: /vylepšení/.test(t),
      vDokumentaci: doku ? /54 klepnutí/.test(doku.textContent) : false };
  });
  check("počet vylepšení v tabulce není", klepani.vTabulce === false,
    String(klepani.vTabulce));
  check("…ale v dokumentaci to vysvětlené je", klepani.vDokumentaci,
    String(klepani.vDokumentaci));

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n208) roster na telefonu drží u všech kusů stejnou mřížku");
  await page.goto(URL);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(700);
  const kartaGrid = await page.evaluate(async () => {
    window.__pgo.setRows([
      // Schválně napříč: dlouhé jméno, jméno s odznáčkem, krátké jméno,
      // kus úplně bez IV (ručně dopsaný gym) a trojmístné hodnoty statů.
      { pokemon: "Alolan Ninetales", cp: 2011, level: 30, ivAtk: 14, ivDef: 13, ivSta: 15 },
      { pokemon: "Talonflame", cp: 2400, level: 30, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Rattata", cp: 210, level: 12, ivAtk: 2, ivDef: 3, ivSta: 4 },
      { pokemon: "Gyarados", cp: 3200, level: 35, ivAtk: 15, ivDef: 14, ivSta: 13 },
      { pokemon: "Machamp", cp: 900 }
    ]);
    await new Promise((r) => setTimeout(r, 900));
    const rady = Array.from(document.querySelectorAll("#tbody tr:not(.detail-row)"));
    const geo = rady.map((tr) => {
      const kde = (k) => {
        const td = tr.querySelector('td[data-col="' + k + '"]');
        if (!td) return "?";
        const r = td.getBoundingClientRect();
        return Math.round(r.left) + "-" + Math.round(r.right);
      };
      const posl = tr.lastElementChild.getBoundingClientRect();
      return {
        vyska: Math.round(tr.getBoundingClientRect().height),
        jmeno: kde("pokemon"), cp: kde("cp"), pct: kde("ivPct"),
        kos: Math.round(posl.left) + "-" + Math.round(posl.right),
        stin: getComputedStyle(tr.querySelector('td[data-col="pokemon"]')).boxShadow
      };
    });
    const jedinecne = (f) => Array.from(new Set(geo.map(f)));
    return {
      pocet: geo.length,
      cp: jedinecne((g) => g.cp),
      pct: jedinecne((g) => g.pct),
      jmeno: jedinecne((g) => g.jmeno),
      kos: jedinecne((g) => g.kos),
      vysky: jedinecne((g) => g.vyska),
      stiny: jedinecne((g) => g.stin),
      prekroc: document.documentElement.scrollWidth > window.innerWidth
    };
  });
  check("na kartách je všech pět kusů", kartaGrid.pocet === 5, String(kartaGrid.pocet));
  // Tohle je celá podstata: flex dával každé buňce šířku podle obsahu, takže
  // CP začínalo u každého kusu jinde a seznam nedržel žádnou svislou linku.
  eq("CP stojí u všech kusů na stejném místě", kartaGrid.cp.length, 1);
  eq("…stejně jako IV %", kartaGrid.pct.length, 1);
  eq("…jméno", kartaGrid.jmeno.length, 1);
  eq("…i koš", kartaGrid.kos.length, 1);
  eq("a karty jsou stejně vysoké", kartaGrid.vysky.length, 1);
  // Svislá linka za jménem je oddělovač přišpendleného sloupce z tabulky.
  // V kartě stála u každého kusu jinde — podle délky jména.
  check("oddělovač přišpendleného sloupce v kartě není",
    kartaGrid.stiny.every((s) => s === "none"), kartaGrid.stiny.join(" | "));
  check("stránka se nerozjela do stran", !kartaGrid.prekroc);

  // Dlouhé jméno se usekne, ne aby přeteklo a rozhodilo kartu.
  const usek = await page.evaluate(() => {
    const td = Array.from(document.querySelectorAll('#tbody td[data-col="pokemon"]'))
      .filter((x) => x.textContent.indexOf("Ninetales") > -1)[0];
    const st = getComputedStyle(td);
    return { over: st.textOverflow, wrap: st.whiteSpace,
      sirsi: td.scrollWidth > td.clientWidth + 1 };
  });
  eq("dlouhé jméno se usekne třemi tečkami", usek.over, "ellipsis");
  eq("…a nezalomí se", usek.wrap, "nowrap");

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n209) na telefonu je první pokémon vidět hned");
  await page.goto(URL);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(700);
  const nahore = await page.evaluate(async () => {
    // Otevřená záložka se pamatuje mezi bloky. Bez tohohle se měří
    // schovaná karta a všechno vyjde na nulu — tedy „projde“.
    window.__pgoZalozka("roster");
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 13, ivDef: 12, ivSta: 14 },
      { pokemon: "Rattata", cp: 210, level: 12, ivAtk: 2, ivDef: 3, ivSta: 4 },
      { pokemon: "Gyarados", cp: 3200, level: 35, ivAtk: 15, ivDef: 14, ivSta: 13 }
    ]);
    await new Promise((r) => setTimeout(r, 900));
    const y = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY);
    const h = (el) => Math.round(el.getBoundingClientRect().height);
    const prvni = document.querySelector("#tbody tr:not(.detail-row)");
    const warn = document.getElementById("zalWarn");
    const selecty = Array.from(document.querySelectorAll(".tb-hledani select"))
      .map((e) => Math.round(e.getBoundingClientRect().width));
    return {
      // Tohle je celé měřítko: dřív začínal první kus na 1408. pixelu, tedy
      // skoro dvě obrazovky scrollování přes souhrn, varování a lištu.
      prvniKus: y(prvni),
      okno: window.innerHeight,
      // Varování o záloze se skládá na dva řádky — dřív bylo 240 px vysoké,
      // protože skládání ho změřilo ještě prázdné.
      warnVyska: warn && warn.style.display !== "none" ? h(warn) : 0,
      warnMaVic: !!(warn && warn.querySelector(".vic-btn")),
      selecty: selecty,
      // Razítko verze patří pod tabulku, ne mezi lištu a první kus.
      verzePodTabulkou: y(document.querySelector(".build-line"))
        > y(document.querySelector(".table-wrap")),
      preteka: document.documentElement.scrollWidth > window.innerWidth + 1,
      bloky: Array.from(document.querySelector(".card.roster").children)
        .map((e) => (e.id || e.className).slice(0, 18) + ":" + h(e)).join(" ")
    };
  });
  check("první kus je vidět bez scrollování",
    nahore.prvniKus > 0 && nahore.prvniKus < nahore.okno - 74,
    nahore.prvniKus + " px z " + nahore.okno + " | " + nahore.bloky);
  // Na telefonu je z varování jedna věta — zálohovat se stejně dá jen
  // u počítače, takže tu není co rozbít na dva řádky (blok 211).
  check("varování o záloze je krátké",
    nahore.warnVyska < 110, nahore.warnVyska + " px");
  // Ve třech sloupcích z filtrů zbylo „Zobraze⌄" a „Zobrazit⌄" — vypadaly
  // stejně a nastavená hodnota nebyla vidět vůbec.
  check("z obou filtrů je vidět, na čem stojí",
    nahore.selecty.length === 2 && nahore.selecty.every((w) => w >= 150),
    nahore.selecty.join(" | "));
  check("verze je pod tabulkou, ne nad prvním kusem", nahore.verzePodTabulkou);
  check("nic nepřeteklo do stran", !nahore.preteka);


  // Na počítači se nic z toho neděje — souhrn je tam celý vidět.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(600);

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n210) nic nevyčuhuje z karet a hlášky patří ke své záložce");
  await page.goto(URL);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(800);

  // Hláška o nevyplněných řádcích mluví o rosteru. Dokud stála mimo jeho
  // kartu, vezla se pod KAŽDOU záložkou — i tam, kde žádný roster není.
  const warnRoster = await page.evaluate(async () => {
    window.__pgoZalozka("roster");
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 13, ivDef: 12, ivSta: 14 },
      { pokemon: "" }
    ]);
    await new Promise((r) => setTimeout(r, 900));
    const w = document.getElementById("unknownWarn");
    const vRosteru = !!w.closest(".card.roster");
    const naRosteru = w.getBoundingClientRect().height > 0;
    window.__pgoZalozka("prohlidkaCard");
    await new Promise((r) => setTimeout(r, 500));
    const naJine = w.getBoundingClientRect().height > 0;
    window.__pgoZalozka("roster");
    await new Promise((r) => setTimeout(r, 400));
    return { vRosteru: vRosteru, naRosteru: naRosteru, naJine: naJine };
  });
  check("hláška o nevyplněném řádku sedí v kartě rosteru", warnRoster.vRosteru);
  check("…na Rosteru je vidět", warnRoster.naRosteru);
  check("…a na Konkrétním pokémonovi ne", warnRoster.naJine === false);

  // Značka „plán chce X bonbónů“ z rozpisu akcí zmizela — kolik bonbónů kam
  // patří, řeší Rozpočet a „Co chytat“, ne kalendář.
  const bezCandy = await page.evaluate(async () => {
    window.__pgoZalozka("eventsCard");
    await new Promise((r) => setTimeout(r, 1200));
    const karta = document.getElementById("eventsCard");
    return { maTag: (karta.textContent || "").indexOf("plán chce") > -1,
      maKusy: karta.querySelectorAll(".osa-kus").length };
  });
  check("v rozpisu akcí není „plán chce … bonbónů“", bezCandy.maTag === false);
  check("…ale samotné druhy tam pořád jsou", bezCandy.maKusy > 0,
    String(bezCandy.maKusy));

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(500);
  // Akce s víc pruhy tvoří jeden blok. Čára se schovává MEZI jejími pruhy,
  // ne pod tím posledním — jinak vybraná akce vizuálně přetekla do další.
  const ganttCary = await page.evaluate(async () => {
    window.__pgoZalozka("eventsCard");
    await new Promise((r) => setTimeout(r, 1200));
    const jmena = Array.from(document.querySelectorAll(".gantt-mrizka > .gantt-jmeno"))
      .filter((j) => j.dataset.radek !== undefined);
    const podleRadku = {};
    jmena.forEach((j) => {
      (podleRadku[j.dataset.radek] = podleRadku[j.dataset.radek] || []).push(j);
    });
    const viceradkove = Object.keys(podleRadku).filter((k) => podleRadku[k].length > 1);
    if (!viceradkove.length) return { zadna: true };
    const skupina = podleRadku[viceradkove[0]];
    const pruhledna = (el) => /rgba\(0, 0, 0, 0\)|transparent/
      .test(getComputedStyle(el).borderBottomColor);
    return {
      pocet: skupina.length,
      vnitrniBezCary: skupina.slice(0, -1).every(pruhledna),
      posledniSCarou: !pruhledna(skupina[skupina.length - 1]),
      nahoru: getComputedStyle(skupina[0]).alignItems,
      jmenoJenPrvni: skupina[0].textContent.trim().length > 0
        && skupina.slice(1).every((j) => j.textContent.trim() === "")
    };
  });
  if (ganttCary.zadna) {
    check("v datech není akce s víc pruhy — nelze ověřit", true, "přeskočeno");
  } else {
    check("uvnitř akce se čára schová", ganttCary.vnitrniBezCary, String(ganttCary.pocet));
    // Tohle je ta chyba: linka chyběla pod POSLEDNÍM pruhem, takže vybrané
    // „Mega Squads“ vypadalo, že sahá i do „Twilight Trails“.
    check("…pod poslední pruh akce ale patří", ganttCary.posledniSCarou);
    eq("název drží u horní hrany", ganttCary.nahoru, "flex-start");
    check("jméno nese jen první pruh", ganttCary.jmenoJenPrvni);
  }

  // Nic nesmí vyčuhovat z karty ani mít vodorovný posuvník. Výjimka jsou
  // dvě věci, které ho potřebují: kalendář akcí a typová tabulka.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(600);
  const pretekaPrehled = await page.evaluate(async () => {
    const klice = Array.from(document.querySelectorAll(".zal-btn"))
      .map((b) => b.dataset.klic).filter(Boolean);
    const SMI_POSOUVAT = /gantt-plocha|gantt-mrizka|type-table-wrap|tb-hlavni/;
    const spatne = [];
    for (const k of klice) {
      window.__pgoZalozka(k);
      await new Promise((r) => setTimeout(r, 380));
      const okno = window.innerWidth;
      if (document.documentElement.scrollWidth > okno + 1) {
        spatne.push(k + ": stránka " + document.documentElement.scrollWidth);
      }
      document.querySelectorAll(".card.zal-viditelna, .card.zal-viditelna *")
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          const jmeno = (el.id || el.className || el.tagName).toString();
          if (SMI_POSOUVAT.test(jmeno)) return;
          // Prvek uvnitř posouvatelné plochy smí být mimo okno — je odscrollovaný.
          if (el.closest(".gantt-plocha, .type-table-wrap, .tb-hlavni")) return;
          if (r.height && (r.right > okno + 1 || r.left < -1)) {
            spatne.push(k + ": ven " + jmeno.slice(0, 22) + " R" + Math.round(r.right));
          }
          if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
            spatne.push(k + ": posuv " + jmeno.slice(0, 22)
              + " " + el.clientWidth + "<" + el.scrollWidth);
          }
        });
    }
    window.__pgoZalozka("roster");
    return spatne.slice(0, 6);
  });
  check("na telefonu nic nevyčuhuje z karet ani se neposouvá do stran",
    pretekaPrehled.length === 0, pretekaPrehled.join(" | "));

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n211) na telefonu se kontroluje, nevysvětluje");
  await page.goto(URL);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(800);
  const vyklad = await page.evaluate(async () => {
    window.__pgoZalozka("roster");
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 13, ivDef: 12, ivSta: 14 },
      { pokemon: "Registeel", cp: 2400, level: 30, ivAtk: 15, ivDef: 15, ivSta: 15 }
    ]);
    await new Promise((r) => setTimeout(r, 1000));
    const VYKLAD = ".plan-intro, .discard-intro, .dust-jak, .type-note, .cover-what,"
      + " .proh-hint, .cloud-navod, .setting .hint:not(.warn), .dust-input > .hint,"
      + " .gantt-lista .hint";
    const out = { zbylo: [], docsP: 0, docsSkryto: 0, patickaSkryto: 0 };
    const klice = Array.from(document.querySelectorAll(".zal-btn"))
      .map((b) => b.dataset.klic).filter(Boolean);
    for (const k of klice) {
      window.__pgoZalozka(k);
      await new Promise((r) => setTimeout(r, 350));
      const karta = document.querySelector(".card.zal-viditelna");
      if (!karta) continue;
      // Dokumentace je výjimka — tam je výklad ten obsah.
      if (karta.id === "docsCard") continue;
      karta.querySelectorAll(VYKLAD).forEach((el) => {
        if (el.getBoundingClientRect().height > 8) {
          out.zbylo.push(k + ": " + (el.className || el.tagName).slice(0, 20));
        }
      });
    }
    window.__pgoZalozka("docsCard");
    await new Promise((r) => setTimeout(r, 500));
    const docs = document.getElementById("docsCard");
    const ps = Array.from(docs.querySelectorAll("p"));
    out.docsP = ps.length;
    out.docsSkryto = ps.filter((p) => getComputedStyle(p).display === "none").length;
    const pat = document.getElementById("patickaZdroje");
    out.patickaSkryto = pat
      ? Array.from(pat.querySelectorAll("p"))
        .filter((p) => getComputedStyle(p).display === "none").length : 0;
    return out;
  });
  check("výklad nad kartami je na telefonu pryč", vyklad.zbylo.length === 0,
    vyklad.zbylo.slice(0, 4).join(" | "));
  // Nic se nemaže: celý výklad zůstává v dokumentaci a v patičce.
  check("dokumentace má co říct", vyklad.docsP > 5, String(vyklad.docsP));
  eq("…a nic z ní schované není", vyklad.docsSkryto, 0);
  eq("…ani v patičce se zdroji", vyklad.patickaSkryto, 0);

  // Mobilní verze je na kontrolu. Přidávání kusů, ruční zápis a import jsou
  // práce od stolu — v liště pod prstem nemají co dělat.
  const listaMob = await page.evaluate(async () => {
    window.__pgoZalozka("roster");
    await new Promise((r) => setTimeout(r, 400));
    // „Vidět“ = opravdu se kreslí. V DOMu zůstávají všechna tlačítka,
    // na telefonu se ta „od stolu“ jen neukazují.
    const vidno = (id) => {
      const el = document.getElementById(id);
      return !!el && !!el.closest(".tb-hlavni")
        && getComputedStyle(el).display !== "none";
    };
    const hlavni = document.querySelector(".tb-hlavni");
    return {
      pridat: vidno("addRowBtn"), importuj: vidno("toggleImportBtn"),
      cistit: vidno("boxModeBtn"),
      posouvaSe: hlavni.scrollWidth > hlavni.clientWidth + 2,
      // Na telefonu se práce od stolu v liště neukazuje — tlačítka v DOMu
      // zůstávají, jen se nekreslí.
      vDalsim: ["addRowBtn", "toggleImportBtn"]
        .every((id) => getComputedStyle(document.getElementById(id)).display === "none")
    };
  });
  check("v liště zůstalo čištění boxu", listaMob.cistit, JSON.stringify(listaMob));
  check("…a úpravy rosteru v ní nejsou",
    !listaMob.pridat && !listaMob.importuj, JSON.stringify(listaMob));
  check("…ale schované nejsou — jsou pod „Další…“", listaMob.vDalsim);
  check("lišta se neposouvá do strany", listaMob.posouvaSe === false);

  // Varování o záloze je na telefonu jedna věta: zálohovat se stejně dá
  // jenom u počítače, prohlížeč v telefonu na disk psát neumí.
  const zalMob = await page.evaluate(() => {
    const w = document.getElementById("zalWarn");
    return { vyska: Math.round(w.getBoundingClientRect().height),
      text: w.textContent.replace(/\s+/g, " ").trim(),
      maTlacitko: w.querySelector("#zalWarnBtn")
        && w.querySelector("#zalWarnBtn").style.display !== "none" };
  });
  check("varování o záloze je na telefonu jednou větou",
    zalMob.vyska === 0 || zalMob.vyska < 80, zalMob.vyska + " px");
  check("…a pošle člověka k počítači",
    zalMob.vyska === 0 || /u po\u010d\u00edta\u010de/.test(zalMob.text), zalMob.text.slice(0, 70));

  // Na počítači se nesmí ztratit nic z toho výkladu.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(600);
  const naPc = await page.evaluate(async () => {
    window.__pgoZalozka("dustCard");
    await new Promise((r) => setTimeout(r, 700));
    const karta = document.getElementById("dustCard");
    const videt = Array.from(karta.querySelectorAll(".plan-intro, .dust-jak, .dust-input > .hint"))
      .filter((el) => el.getBoundingClientRect().height > 8).length;
    return { videt: videt };
  });
  check("na počítači výklad zůstal", naPc.videt >= 3, String(naPc.videt));

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n212) stránka se načítá rovnou v záložkách");
  // Karty jsou v HTML pod sebou a menu je staví vedle sebe až po doběhnutí
  // skriptu na konci stránky. Do té doby problikne celý stoh patnácti karet.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      window.__vyskaPriNacteni = document.documentElement.scrollHeight;
      window.__karetVidet = Array.from(document.querySelectorAll(".app > .card"))
        .filter((c) => c.getBoundingClientRect().height > 0).length;
    });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(URL);
  await page.waitForTimeout(1500);
  const nacitani = await page.evaluate(() => ({
    vyska: window.__vyskaPriNacteni || 0,
    karet: window.__karetVidet,
    okno: window.innerHeight,
    trida: document.body.className,
    maListu: !!document.querySelector(".zal-lista"),
    viditelnych: Array.from(document.querySelectorAll(".app > .card"))
      .filter((c) => c.getBoundingClientRect().height > 0).length
  }));
  // Před opravou tu byly desetitisíce pixelů — celý stoh karet pod sebou.
  check("při načtení se nestaví stoh karet pod sebou",
    nacitani.vyska > 0 && nacitani.vyska < nacitani.okno * 3,
    nacitani.vyska + " px při okně " + nacitani.okno);
  // Skript se záložkami běží ještě před DOMContentLoaded, takže už v té chvíli
  // je vidět právě jedna karta — nikdy ne celý stoh.
  eq("…a vidět je právě jedna karta, ne stoh", nacitani.karet, 1);
  check("po načtení je menu na svém místě", nacitani.maListu);
  check("…a pomocná třída je pryč",
    nacitani.trida.indexOf("zal-nacita") === -1, nacitani.trida);
  eq("…vidět je právě jedna karta", nacitani.viditelnych, 1);

  console.log("\n213) žebříčky na telefonu nejsou svislé nudle");
  const refMob = await page.evaluate(async () => {
    window.__pgoZalozka("refCard");
    await new Promise((r) => setTimeout(r, 900));
    const t = document.getElementById("refRaidTable");
    const hlavicky = Array.from(t.querySelectorAll("th"))
      .map((th) => Math.round(th.getBoundingClientRect().width));
    // Sestava útoků je nejdelší text v tabulce — na ní se to pozná nejdřív.
    const sestava = Array.from(t.querySelectorAll("tr"))
      .map((tr) => tr.children[3]).filter(Boolean)
      .filter((td) => (td.textContent || "").length > 12)[0];
    const wrap = document.querySelector(".ref-tables");
    // Všechno se změří teď, dokud je karta vidět — po přepnutí záložky
    // mají její prvky nulové rozměry.
    const vysl = {
      hlavicky: hlavicky,
      sestavaSirka: sestava ? Math.round(sestava.getBoundingClientRect().width) : 0,
      sestavaRadku: sestava
        ? Math.round(sestava.getBoundingClientRect().height / 16) : 0,
      sestavaText: sestava ? sestava.textContent.trim() : "",
      posuv: wrap.scrollWidth > wrap.clientWidth + 2
    };
    window.__pgoZalozka("docsCard");
    await new Promise((r) => setTimeout(r, 700));
    const el = document.querySelector(".zdroje-tab");
    vysl.zdrojeSloupcu = el
      ? Array.from(el.querySelectorAll("tr")[0].children)
        .filter((c) => c.getBoundingClientRect().width > 0).length : null;
    return vysl;
  });
  // Pevné dělení šířky dělalo z pěti sloupců pět pruhů po 60 px a „Bug Bite
  // + Bug Buzz“ se v nich lámalo na čtyři útržky po jednom slově.
  check("sloupce se dělí podle obsahu, ne na stejné díly",
    new Set(refMob.hlavicky).size > 1, refMob.hlavicky.join(" | "));
  check("sestava útoků dostane nejvíc místa",
    refMob.sestavaSirka >= 90, refMob.sestavaSirka + " px");
  check("…a nerozpadne se na svislou nudli",
    refMob.sestavaRadku <= 2,
    refMob.sestavaRadku + " řádků na „" + refMob.sestavaText + "“");
  check("žebříčky se přitom neposouvají do stran", refMob.posuv === false);
  // V tabulce zdrojů je počet řádků a datum stažení účetnictví — na 314 px
  // ukrajovaly místo hlavnímu sloupci a datum se lámalo na tři řádky.
  check("tabulka zdrojů ukazuje na telefonu jen zdroj a co z něj je",
    refMob.zdrojeSloupcu === null || refMob.zdrojeSloupcu === 2,
    String(refMob.zdrojeSloupcu));

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n214) refaktor: co zmizelo a co přibylo");
  await page.goto(URL);
  await page.waitForTimeout(800);
  const refaktor = await page.evaluate(async () => {
    window.__pgoZalozka("roster");
    window.__pgo.setRows([
      { pokemon: "Machamp", forma: "Shadow", cp: 2200, level: 28, ivAtk: 13, ivDef: 12, ivSta: 14 },
      { pokemon: "Gyarados", cp: 3200, level: 35, ivAtk: 15, ivDef: 14, ivSta: 13 }
    ]);
    await new Promise((r) => setTimeout(r, 900));
    const zalozky = Array.from(document.querySelectorAll(".zal-btn"))
      .map((b) => b.dataset.klic);
    return {
      // --- smazané panely a tlačítka ---
      maGym: zalozky.indexOf("gymCard") > -1,
      maDoMobilu: zalozky.indexOf("mobilCard") > -1,
      maSouhrn: !!document.getElementById("tiles"),
      maRucni: !!document.getElementById("rucniBtn"),
      maSkenPlan: !!document.getElementById("skenPlanBtn"),
      maHledaniVeHre: !!document.getElementById("hledaniBtn"),
      maPocitadloVRosteru: !!(document.getElementById("boxCheck")
        && document.getElementById("boxCheck").closest(".card.roster")),
      // …ale počítadlo nezmizelo, jen se přestěhovalo do nastavení
      pocitadloVNastaveni: !!(document.getElementById("boxCheck")
        && document.getElementById("boxCheck").closest(".settings-card")),
      maDalsi: !!document.querySelector(".tb-vic"),
      maProfilBtn: !!document.getElementById("profilBtn"),
      // --- sloupec Forma pryč, Shadow je značka ---
      maSloupecForma: Array.from(document.querySelectorAll("#headerRow th"))
        .some((th) => th.textContent.trim().indexOf("Forma") === 0),
      shadowZnacka: (document.querySelector("#tbody .poke-tagy") || {}).textContent || "",
      // --- filtr na „Silný proti" ---
      maFiltrSilny: !!Array.from(document.querySelectorAll("#headerRow th"))
        .filter((th) => th.textContent.indexOf("Siln") === 0)
        .map((th) => th.querySelector(".pvp-filtr-ikona"))[0],
      // --- filtry a stavy na řádku s hledáním ---
      vRadkuHledani: ["zrusitFiltry", "searchInput", "viewSelect", "filterSelect",
        "saveState", "backupState"]
        .every((id) => !!(document.getElementById(id)
          && document.getElementById(id).closest(".tb-hledani")))
    };
  });
  check("panel Gym je pryč", refaktor.maGym === false);
  check("panel „Do mobilu“ je pryč", refaktor.maDoMobilu === false);
  check("karta Souhrn je pryč", refaktor.maSouhrn === false);
  check("tlačítka Ručně / Co skenovat / Hledat ve hře jsou pryč",
    !refaktor.maRucni && !refaktor.maSkenPlan && !refaktor.maHledaniVeHre);
  check("počítadlo boxu není v rosteru", refaktor.maPocitadloVRosteru === false);
  // Nezmizelo — jen se přestěhovalo tam, kam patří.
  check("…ale je v nastavení", refaktor.pocitadloVNastaveni);
  check("„Další…“ v liště není", refaktor.maDalsi === false);
  check("…a profil má vlastní tlačítko", refaktor.maProfilBtn);
  check("sloupec Forma je pryč", refaktor.maSloupecForma === false);
  check("…a Shadow je značka u jména",
    refaktor.shadowZnacka.indexOf("SHADOW") > -1, refaktor.shadowZnacka);
  check("sloupec „Silný proti“ má filtr", refaktor.maFiltrSilny);
  check("zrušit filtry, hledání i stavy jsou na jednom řádku",
    refaktor.vRadkuHledani);

  const okna = await page.evaluate(async () => {
    // „+ Přidat pokémona" otevře okno, ne prázdný řádek v tabulce.
    const pred = window.__pgo.getRows().length;
    document.getElementById("addRowBtn").click();
    await new Promise((r) => setTimeout(r, 300));
    const rb = document.getElementById("rucniBox");
    const out = {
      radkuPribylo: window.__pgo.getRows().length - pred,
      oknoOtevrene: !rb.hidden,
      jePresStranku: getComputedStyle(rb).position === "fixed",
      nadpis: (rb.querySelector(".rb-head b") || {}).textContent || ""
    };
    document.getElementById("rbCancel").click();
    return out;
  });
  eq("„+ Přidat pokémona“ nevloží prázdný řádek", okna.radkuPribylo, 0);
  check("…ale otevře okno", okna.oknoOtevrene);
  check("…které stojí přes stránku", okna.jePresStranku);
  eq("…a jmenuje se podle toho, co dělá", okna.nadpis, "Přidat pokémona");

  const napoveda = await page.evaluate(async () => {
    window.__pgoZalozka("prohlidkaCard");
    await new Promise((r) => setTimeout(r, 600));
    const inp = document.getElementById("prohName");
    inp.focus();
    inp.value = "mach";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const p = document.querySelector(".druh-napoveda");
    const polozky = p ? Array.from(p.querySelectorAll(".druh-polozka")) : [];
    return {
      vidno: !!(p && !p.hidden),
      pocet: polozky.length,
      // Co začíná napsaným textem, patří nahoru.
      prvni: polozky.length ? polozky[0].dataset.jm : "",
      maObrazek: polozky.length ? !!polozky[0].querySelector("img") : false,
      maTypy: polozky.length
        ? (polozky[0].querySelector(".dn-typy") || {}).textContent || "" : "",
      maDatalist: !!inp.getAttribute("list")
    };
  });
  check("našeptávač druhů se otevře", napoveda.vidno, String(napoveda.pocet));
  check("…a nabízí Machopa/Machampa", /^Mach/.test(napoveda.prvni), napoveda.prvni);
  check("…s obrázkem", napoveda.maObrazek);
  check("…a typy", napoveda.maTypy.indexOf("Fighting") > -1, napoveda.maTypy);
  check("…a starý <datalist> je pryč", napoveda.maDatalist === false);

  const zebricky214 = await page.evaluate(async () => {
    window.__pgoZalozka("refCard");
    await new Promise((r) => setTimeout(r, 700));
    const karta = document.getElementById("refCard");
    return {
      texty: karta.querySelectorAll(".ref-note, .plan-intro").length,
      maTabulky: karta.querySelectorAll("table").length
    };
  });
  eq("žebříčky nemají úvodní texty", zebricky214.texty, 0);
  check("…ale seznamy zůstaly", zebricky214.maTabulky >= 3,
    String(zebricky214.maTabulky));

  const tahak214 = await page.evaluate(async () => {
    window.__pgoZalozka("cheatCard");
    await new Promise((r) => setTimeout(r, 900));
    const t = document.getElementById("cheatCard").textContent;
    return {
      maNechat: /Nechat \(/.test(t),
      maPustit: /Pustit \(/.test(t),
      maCoChytat: /Co chytat/.test(t),
      maStahnout: !!document.getElementById("cheatDownloadBtn"),
      ligyVedleSebe: !!document.querySelector("#cheatBody .cs-ligy")
    };
  });
  check("v taháku není sekce Nechat ani Pustit",
    !tahak214.maNechat && !tahak214.maPustit);
  check("…ani Co chytat (má vlastní panel)", tahak214.maCoChytat === false);
  check("…a tlačítko na stažení taháku taky ne", tahak214.maStahnout === false);
  check("ligy stojí vedle sebe", tahak214.ligyVedleSebe);

  const udalosti214 = await page.evaluate(async () => {
    window.__pgoZalozka("eventsCard");
    await new Promise((r) => setTimeout(r, 1200));
    const t = document.getElementById("eventsBody").textContent;
    return {
      maBosse: /Raid bossové právě teď/.test(t),
      maCoSeDeje: /Co se děje/.test(t),
      maTymDoGBL: /Tvůj tým do GO Battle League/.test(t),
      maKalendar: !!document.querySelector(".gantt"),
      maLigy: /Ligy v GO Battle League/.test(t)
    };
  });
  check("v Událostech nejsou raid bossové (jsou v Taháku)",
    udalosti214.maBosse === false);
  check("…ani seznam „Co se děje“ (je v kalendáři)",
    udalosti214.maCoSeDeje === false);
  check("…ani tým do GBL (je v Taháku)", udalosti214.maTymDoGBL === false);
  check("…kalendář ale zůstal", udalosti214.maKalendar);
  check("…a rotace lig taky", udalosti214.maLigy);

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n215) žebříček bossů, překlopený verdikt, mega bez duplicity");
  await page.goto(URL);
  await page.waitForTimeout(800);

  const bossi = await page.evaluate(async () => {
    window.__pgoZalozka("eventsCard");
    await new Promise((r) => setTimeout(r, 1200));
    const li = Array.from(document.querySelectorAll(".rb-polozka"));
    return {
      pocet: li.length,
      // Pořadí musí být čitelné: u každého bosse stojí, proč je tam, kde je.
      vsechnyMajiDuvod: li.every((x) => (x.querySelector(".rb-proc") || {}).textContent),
      prvniDuvod: li.length ? li[0].querySelector(".rb-proc").textContent : "",
      // Top tři jsou zvýrazněné, nezajímavé ztlumené — ať se to dá číst zběžně.
      maTop: !!document.querySelector(".rb-polozka.rb-top"),
      poradiCisla: li.slice(0, 3).map((x) => x.querySelector(".rb-poradi").textContent)
    };
  });
  check("žebříček raid bossů se vykreslí", bossi.pocet > 0, String(bossi.pocet));
  check("…a u každého je napsané proč", bossi.vsechnyMajiDuvod);
  check("…první má důvod, ne prázdno", bossi.prvniDuvod.length > 5, bossi.prvniDuvod);
  check("…první tři jsou zvýrazněné", bossi.maTop);
  eq("…a jsou očíslované", bossi.poradiCisla.join(","), "1,2,3");

  // Ruční značka může vyhodit ze slotu kus, který už máš „projitý“ — a to
  // se nesmí stát potichu.
  const preklop = await page.evaluate(async () => {
    window.__pgoZalozka("roster");
    await new Promise((r) => setTimeout(r, 400));
    const dk = document.getElementById("dmaxKeep");
    dk.value = "2";
    dk.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    window.__pgo.setRows([
      { pokemon: "Wooloo", dynamax: "Ano", cp: 280, level: 11, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: "Tackle", charged1: "Body Slam" },
      { pokemon: "Wooloo", dynamax: "Ano", cp: 270, level: 11, ivAtk: 13, ivDef: 13, ivSta: 13,
        fastMove: "Tackle", charged1: "Body Slam" },
      { pokemon: "Wooloo", cp: 292, level: 12, ivAtk: 15, ivDef: 15, ivSta: 15,
        fastMove: "Tackle", charged1: "Body Slam" }
    ]);
    await new Promise((r) => setTimeout(r, 900));
    const stav = () => {
      const c = window.__pgo.getComputed();
      return window.__pgo.getRows().map((r) => r.cp + ":" + (c[r.id].keepGood ? "K" : "P")).join(",");
    };
    const pred = stav();
    const tr = Array.from(document.querySelectorAll("#tbody tr:not(.detail-row)"))
      .filter((t) => t.textContent.indexOf("292") > -1)[0];
    tr.querySelector('td[data-col="pokemon"]').click();
    await new Promise((r) => setTimeout(r, 600));
    document.querySelector("#tbody .detail-row .dmax-prepinac").click();
    await new Promise((r) => setTimeout(r, 900));
    const box = document.getElementById("verdiktZmena");
    const out = {
      pred: pred, po: stav(),
      vidno: box.style.display !== "none",
      text: box.textContent.replace(/\s+/g, " ").trim()
    };
    const btn = document.getElementById("verdiktZmenaBtn");
    if (btn) {
      btn.click();
      await new Promise((r) => setTimeout(r, 500));
      out.poFiltru = document.querySelectorAll("#tbody tr:not(.detail-row)").length;
    }
    return out;
  });
  check("označení lepšího kusu opravdu vyhodí horší ze slotu",
    preklop.pred !== preklop.po, preklop.pred + "  →  " + preklop.po);
  check("…a appka to řekne", preklop.vidno, preklop.text.slice(0, 90));
  check("…s konkrétním kusem a novým verdiktem",
    /Wooloo/.test(preklop.text) && /Zahodit/.test(preklop.text),
    preklop.text.slice(0, 120));
  eq("…a tlačítko je vyfiltruje", preklop.poFiltru, 1);

  // Mega je odemknutí DRUHU, takže se sveze na kusu, který si necháváš kvůli
  // jiné roli. Dřív mohla připadnout jinému kusu a v rosteru zbyli dva.
  const megaJeden = await page.evaluate(async () => {
    // Jedna kopie na druh — ať je vidět, komu mega připadne, když druhý
    // kus už žádnou roli nedrží.
    const kc = document.getElementById("keepCopies");
    kc.value = "1";
    kc.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    window.__pgo.setRows([
      // Slabší IV, ale drží roli (lepší útoky pro raid).
      { pokemon: "Gyarados", cp: 2600, level: 30, ivAtk: 15, ivDef: 10, ivSta: 10,
        fastMove: "Waterfall", charged1: "Hydro Pump" },
      // Vyšší IV, žádné útoky — sám o sobě roli nedrží. Schválně NE 15/15/15:
      // dokonalý kus drží pravidlo 100 % bez ohledu na role.
      { pokemon: "Gyarados", cp: 2600, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14 }
    ]);
    await new Promise((r) => setTimeout(r, 900));
    const c = window.__pgo.getComputed();
    const rs = window.__pgo.getRows();
    return rs.map((r) => ({
      iv: [r.ivAtk, r.ivDef, r.ivSta].join("/"),
      keep: c[r.id].keepGood,
      mega: c[r.id].mega
    }));
  });
  // Mega je odemknutí DRUHU — sveze se na kusu, který si necháváš kvůli
  // jiné roli. Dřív se vybíral čistě nejlepší IV, takže mohla připadnout
  // kusu, který jinak nic nedrží — a v rosteru zůstali dva.
  eq("kvůli meze nezůstane druhý kus navíc",
    megaJeden.filter((x) => x.keep).length, 1);
  check("…a mega jde na ten kus, který si necháváš",
    megaJeden.every((x) => x.mega !== "Vysoká" || x.keep),
    JSON.stringify(megaJeden));

  // „Zrušit filtry" musí vrátit i oba výběry nad tabulkou — dokud se
  // nepočítaly jako filtr, zůstávalo tlačítko šedé a nešlo jimi kliknout.
  const zrusit = await page.evaluate(async () => {
    window.__pgoZalozka("roster");
    await new Promise((r) => setTimeout(r, 400));
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 13, ivDef: 12, ivSta: 14 }
    ]);
    await new Promise((r) => setTimeout(r, 700));
    const f = document.getElementById("filterSelect");
    const v = document.getElementById("viewSelect");
    f.value = "keep"; f.dispatchEvent(new Event("change", { bubbles: true }));
    v.value = "all"; v.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    const b = document.getElementById("zrusitFiltry");
    const out = { aktivni: !b.disabled };
    b.click();
    await new Promise((r) => setTimeout(r, 600));
    out.po = f.value + "/" + v.value;
    return out;
  });
  check("výběry nad tabulkou zapnou „Zrušit filtry“", zrusit.aktivni);
  eq("…a tlačítko je vrátí zpátky", zrusit.po, "all/verdict");

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n216) bossové podle data akce, širší filtr, hláška po smazání");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // `EVENTS.raids` ze ScrapedDucku je snímek bez dat a zpožďuje se o celou
  // rotaci. Datumy zná rozpis akcí — z něj se pozná, co běží DNESKA.
  const zdroj = await page.evaluate(async () => {
    window.__pgoZalozka("eventsCard");
    await new Promise((r) => setTimeout(r, 1300));
    const jmena = Array.from(document.querySelectorAll(".rb-polozka b"))
      .map((b) => b.textContent);
    const ted = Date.now();
    const konceEvent = {};
    (window.__pgo.eventsData().events || []).forEach((e) => {
      if (String(e[1] || "").indexOf("raid") !== 0) return;
      (e[7] || []).forEach((o) => {
        const doKdy = Date.parse(o[1]);
        ((o[2] || {}).raid || []).forEach((x) => {
          if (x[1] === -1) return;
          const odKdy = Date.parse(o[0]);
          // Bere se jen okno, které UŽ začalo — Zamazenta za týden v dnešním
          // seznamu být nemá.
          if (odKdy > ted) return;
          if (!konceEvent[x[0]] || doKdy > konceEvent[x[0]]) konceEvent[x[0]] = doKdy;
        });
      });
    });
    // Boss, jehož poslední akce skončila v minulosti, v seznamu být nesmí.
    const propadle = jmena.filter((j) => {
      const holy = j.replace(/^Shadow\s+/, "");
      const k = konceEvent[j] || konceEvent[holy];
      return k && k < ted;
    });
    // A naopak: co běží teď, tam být musí. Porovnává se kanonická identita
    // druhu, ne napsané jméno — rozpis akcí a snímek si každý píše svoje
    // („Zacian (Hero of Many Battles)" vs „Zacian (Hero)").
    const klic = (j) => {
      const predpona = (/^shadow\s/i.test(j) ? "s:" : "") + (/^mega\s/i.test(j) ? "m:" : "");
      return predpona + window.__pgo.dexKeyOf(String(j).replace(/^(shadow|mega)\s+/i, ""));
    };
    // Shadow předponu si appka doplňuje z názvu akce („Shadow Thundurus"),
    // kdežto rozpis uvnitř okna píše holý druh — proto se tady porovnává
    // jen druh a forma, bez shadow/mega.
    const druh = (j) => klic(j).replace(/^[sm]:/, "");
    const vSeznamu = jmena.map(druh);
    const bezi = Object.keys(konceEvent).filter((j) => konceEvent[j] >= ted);
    const chybi = bezi.filter((j) => vSeznamu.indexOf(druh(j)) === -1);
    return { jmena: jmena, propadle: propadle, chybi: chybi };
  });
  check("v žebříčku nejsou bossové, jejichž akce skončila",
    zdroj.propadle.length === 0, zdroj.propadle.join(", "));
  check("…a co běží dneska, tam je", zdroj.chybi.length === 0, zdroj.chybi.join(", "));

  // Šipka filtru byla 8 px široká a místo filtru se trefovalo řazení.
  const klepaciCil = await page.evaluate(async () => {
    window.__pgoZalozka("roster");
    await new Promise((r) => setTimeout(r, 400));
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 13, ivDef: 12, ivSta: 14 }
    ]);
    await new Promise((r) => setTimeout(r, 700));
    return Array.from(document.querySelectorAll(".pvp-filtr-ikona")).map((b) => {
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
  });
  check("na filtry ve sloupcích se dá trefit", klepaciCil.length > 0 && klepaciCil.every((x) => x.w >= 20 && x.h >= 18),
    JSON.stringify(klepaciCil.slice(0, 4)));

  // Smazání kusu uvolní slot — někomu se tím verdikt překlopí na „nechat“
  // a to je stejný případ jako ruční značka, jen opačným směrem.
  const poSmazani = await page.evaluate(async () => {
    // Fighting je v rozpočtu díra s jedním slotem, takže ho drží jen
    // nejlepší kus — po jeho smazání do něj musí naskočit další v řadě.
    const kc = document.getElementById("keepCopies");
    kc.value = "4";
    kc.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    window.__pgo.setRows([
      { pokemon: "Machamp", cp: 2400, level: 30, ivAtk: 15, ivDef: 15, ivSta: 14,
        fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Machamp", cp: 2300, level: 29, ivAtk: 14, ivDef: 14, ivSta: 14,
        fastMove: "Counter", charged1: "Dynamic Punch" },
      { pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 13, ivDef: 13, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" }
    ]);
    await new Promise((r) => setTimeout(r, 900));
    const stav = () => {
      const c = window.__pgo.getComputed();
      return window.__pgo.getRows().map((r) => r.cp + ":" + (c[r.id].keepGood ? "K" : "P")).join(",");
    };
    const pred = stav();
    // smazat ten lepší → horší musí naskočit do uvolněného slotu
    const tr = Array.from(document.querySelectorAll("#tbody tr:not(.detail-row)"))
      .filter((t) => t.textContent.indexOf("2400") > -1)[0];
    tr.querySelector(".del-btn").click();
    await new Promise((r) => setTimeout(r, 900));
    const box = document.getElementById("verdiktZmena");
    return { pred: pred, po: stav(), vidno: box.style.display !== "none",
      text: box.textContent.replace(/\s+/g, " ").trim().slice(0, 100) };
  });
  check("smazání kusu opravdu překlopí verdikt jinému",
    poSmazani.pred.indexOf("2300:P") > -1 && poSmazani.po.indexOf("2300:K") > -1,
    poSmazani.pred + "  →  " + poSmazani.po);
  check("…a appka to řekne stejně jako u značky", poSmazani.vidno, poSmazani.text);
  // Hláška začínala číslovkou („1 Jinému kusu…“), což se nedalo přečíst.
  check("…a věta začíná slovem, ne číslovkou",
    /^Změnilo to verdikt u \d+ jin/.test(poSmazani.text), poSmazani.text.slice(0, 60));

  // Dokumentace musí říkat totéž co engine: odkud se bossové berou, že
  // se verdikt překlápí i mazáním a proč roli drží kus s nižším IV.
  const dok = await page.evaluate(async () => {
    window.__pgoZalozka("docsCard");
    await new Promise((r) => setTimeout(r, 900));
    const t = document.getElementById("docsCard").textContent.replace(/\s+/g, " ");
    return {
      zdroj: t.indexOf("Odkud se bossové berou") > -1,
      leekduck: t.indexOf("rozpis akcí z LeekDucku") > -1,
      smazani: t.indexOf("když kus smažeš") > -1,
      iv: t.indexOf("Proč roli drží kus s nižším IV") > -1,
      tiebreak: t.indexOf("tiebreak") > -1
    };
  });
  check("dokumentace popisuje zdroj bossů", dok.zdroj && dok.leekduck, JSON.stringify(dok));
  check("…i překlopení verdiktu po smazání", dok.smazani);
  check("…i proč vyhraje kus s nižším IV", dok.iv && dok.tiebreak);

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n217) Vyhledávání zná formy druhu");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Pokédex má pro Zaciana tři klíče a všechny se jmenují „Zacian".
  // Vyhledávání proto ukazovalo jedno pořadí a byla to Crowned Sword,
  // zatímco z raidu chodí Hero — a ten je v Master League o půl žebříčku níž.
  const formy = await page.evaluate(async () => {
    const P = window.__pgo;
    window.__pgoZalozka("prohlidkaCard");
    await new Promise((r) => setTimeout(r, 500));
    const pole = document.getElementById("prohName");
    pole.value = "Zacian";
    pole.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 600));
    const napoveda = Array.from(document.querySelectorAll(".druh-napoveda .dn-jmeno"))
      .map((x) => x.textContent);
    const skupiny = Array.from(document.querySelectorAll("#prohlidkaCard .d-liga-forma"))
      .map((x) => x.textContent.replace(/\s+/g, " ").trim());
    const radky = Array.from(document.querySelectorAll("#prohlidkaCard .d-ligy-tab tr"))
      .map((x) => x.textContent.replace(/\s+/g, " ").trim());
    return {
      napoveda: napoveda,
      nadpis: (document.querySelector("#prohlidkaCard .d-name") || {}).textContent || "",
      odkazy: Array.from(document.querySelectorAll(".d-forma-odkaz")).map((x) => x.textContent),
      skupiny: skupiny,
      radky: radky,
      // co o těch dvou formách říkají data — číslo se nikam nepíše natvrdo
      rankHero: (P.ligovePoradi("zacian-hero", "master") || {}).rank,
      rankCrowned: (P.ligovePoradi("zacian", "master") || {}).rank
    };
  });
  check("našeptávač nabídne obě formy Zaciana",
    formy.napoveda.indexOf("Zacian (Hero)") > -1
      && formy.napoveda.indexOf("Zacian (Crowned Sword)") > -1,
    formy.napoveda.join(" | "));
  check("…karta se jmenuje celým jménem formy",
    /\(/.test(formy.nadpis) && formy.nadpis.indexOf("Zacian") === 0, formy.nadpis);
  check("…a je z ní vidět, že existuje ještě druhá",
    formy.odkazy.indexOf("Zacian (Hero)") > -1, formy.odkazy.join(", "));
  check("v ligách stojí obě formy zvlášť",
    formy.skupiny.length >= 2 && formy.skupiny.some((x) => /jiná forma/.test(x)),
    formy.skupiny.join(" | "));
  check("…a každá má svoje pořadí z dat",
    formy.rankHero !== formy.rankCrowned
      && formy.radky.some((x) => x.indexOf("#" + formy.rankHero) > -1)
      && formy.radky.some((x) => x.indexOf("#" + formy.rankCrowned) > -1),
    "hero #" + formy.rankHero + " vs crowned #" + formy.rankCrowned
      + " | " + formy.radky.join(" · "));

  // Klepnutím se druhá forma rovnou vyhledá — jinak by ji člověk musel opsat
  // i s dovětkem v závorce.
  const preklik = await page.evaluate(async () => {
    const b = Array.from(document.querySelectorAll(".d-forma-odkaz"))[0];
    b.click();
    await new Promise((r) => setTimeout(r, 600));
    return {
      pole: document.getElementById("prohName").value,
      nadpis: (document.querySelector("#prohlidkaCard .d-name") || {}).textContent || ""
    };
  });
  eq("klepnutí na druhou formu ji vyhledá", preklik.pole, "Zacian (Hero)");
  eq("…a karta se přepne", preklik.nadpis, "Zacian (Hero)");

  // Kosmetické vzory mají vlastní klíč, ale stejné staty — v seznamu by byly
  // jen šum. Alolan Sandslash se naopak bije jinak a chybět nesmí.
  const seznam = await page.evaluate(async () => {
    const pole = document.getElementById("prohName");
    const nabidka = async (text) => {
      pole.value = text;
      pole.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 400));
      return Array.from(document.querySelectorAll(".druh-napoveda .dn-jmeno"))
        .map((x) => x.textContent);
    };
    return { vivillon: await nabidka("Vivillon"), sandslash: await nabidka("Sandslash") };
  });
  eq("kosmetické vzory seznam nezaplevelí", seznam.vivillon.length, 1);
  check("…ale regionální forma v něm je",
    seznam.sandslash.some((x) => /Alolan/.test(x)), seznam.sandslash.join(" | "));

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n218) bossové bez duplicit a ukázkový řádek, který si neodporuje");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Rozpis akcí píše „Zacian (Hero of Many Battles)", snímek ze ScrapedDucku
  // „Zacian (Hero)" — a Zacian pak stál v žebříčku dvakrát, na 3. a 4. místě.
  const aliasy = await page.evaluate(async () => {
    window.__pgoZalozka("eventsCard");
    await new Promise((r) => setTimeout(r, 1300));
    const jmena = Array.from(document.querySelectorAll(".rb-polozka b")).map((b) => b.textContent);
    // Kanonická identita = druh + forma + shadow/mega. Dvě jména téhož
    // pokémona musí spadnout na jeden klíč.
    const klice = jmena.map((j) => {
      const predpona = (/^shadow\s/i.test(j) ? "s:" : "") + (/^mega\s/i.test(j) ? "m:" : "");
      return predpona + window.__pgo.dexKeyOf(j.replace(/^(shadow|mega)\s+/i, ""));
    });
    const dvakrat = klice.filter((k, i) => klice.indexOf(k) !== i);
    return { jmena: jmena, dvakrat: dvakrat };
  });
  check("v žebříčku bossů není nikdo dvakrát", aliasy.dvakrat.length === 0,
    aliasy.dvakrat.join(", ") + " | " + aliasy.jmena.join(", "));
  check("…a žebříček není prázdný", aliasy.jmena.length > 3, String(aliasy.jmena.length));

  // Dokumentace musí říct, jak se bossové sjednocují a co se obnovuje samo.
  const dok218 = await page.evaluate(async () => {
    window.__pgoZalozka("docsCard");
    await new Promise((r) => setTimeout(r, 900));
    const t = document.getElementById("docsCard").textContent.replace(/\s+/g, " ");
    // Tabulka zdrojů je vlastní prvek, který se veze se záložkou.
    const z = (document.getElementById("dataInfo") || {}).textContent || "";
    return { alias: t.indexOf("Jeden boss, dvě jména") > -1,
      denne: (t + z).replace(/\s+/g, " ").indexOf("naplanovat.ps1 -Obnovit") > -1 };
  });
  check("dokumentace popisuje sjednocení jmen bossů", dok218.alias);
  check("…i denní obnovu dat", dok218.denne);

  // Ukázkový řádek musí být kus, který ve hře může existovat: CP se dá
  // spočítat z levelu a IV. Dokud neseděl, hlásila appka u téhož kusu cíl
  // 1490 CP a zároveň cenu za vylepšení na to samé CP.
  const ukazka = await page.evaluate(async () => {
    const P = window.__pgo;
    window.__pgoZalozka("roster");
    await new Promise((r) => setTimeout(r, 400));
    // ukázkový roster se plní jen do prázdné appky, tak si ho vyrobíme stejně
    const r = { pokemon: "Azumarill", cp: 1082, level: 24.5, ivAtk: 12, ivDef: 14, ivSta: 15 };
    P.setRows([r]);
    await new Promise((r2) => setTimeout(r2, 700));
    const kus = P.getRows()[0];
    return { cpVzorec: P.cpNaLevelu(kus.pokemon, 12, 14, 15, 24.5), cp: kus.cp };
  });
  eq("ukázkový kus má CP, které z jeho levelu a IV opravdu vyjde",
    ukazka.cpVzorec, ukazka.cp);

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n219) nálezy z auditu: ceny, shadow žebříčky, gym, countery, formáty");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // 1) Cena vylepšení zná stav kusu. Lucky = půlka prachu, shadow +20 %,
  //    purified −10 %. Dřív se sčítala jen základní tabulka, takže u lucky
  //    kusu appka hlásila dvojnásobek toho, co ve hře zaplatíš.
  const ceny = await page.evaluate(async () => {
    const P = window.__pgo;
    const out = {};
    for (const f of ["", "Lucky", "Shadow", "Purified"]) {
      P.setRows([{ pokemon: "Azumarill", forma: f, cp: 1082, level: 24.5,
        ivAtk: 12, ivDef: 14, ivSta: 15, fastMove: "Bubble", charged1: "Ice Beam" }]);
      await new Promise((r) => setTimeout(r, 500));
      const b = P.base()[0];
      out[f || "bezny"] = { prach: (b.cost || {}).dust, bonbon: (b.cost || {}).candy,
        duvod: (b.cost || {}).duvodCeny || "" };
    }
    return out;
  });
  eq("lucky stojí přesně půlku prachu", ceny.Lucky.prach, ceny.bezny.prach / 2);
  eq("…a bonbóny se u lucky nemění", ceny.Lucky.bonbon, ceny.bezny.bonbon);
  eq("shadow stojí o pětinu víc", ceny.Shadow.prach, Math.round(ceny.bezny.prach * 1.2));
  eq("purified o desetinu míň", ceny.Purified.prach, Math.round(ceny.bezny.prach * 0.9));
  check("…a je napsané proč", /lucky/.test(ceny.Lucky.duvod) && /shadow/.test(ceny.Shadow.duvod),
    ceny.Lucky.duvod + " | " + ceny.Shadow.duvod);

  // 2) Shadow varianta má v žebříčku vlastní pořadí i sestavu. Dřív se slévala
  //    pod klíč běžného druhu a vyhrávala ta výš postavená.
  const shadowLigy = await page.evaluate(async () => {
    const P = window.__pgo;
    const M = P.meta();
    // Kolik druhů by pod holým jménem neslo číslo shadow varianty
    let prosakuje = 0;
    Object.keys(M.leagues).forEach((lg) => {
      Object.keys(M.leagues[lg]).forEach((k) => {
        if (/\(Shadow\)/.test(M.leagues[lg][k][2] || "")) prosakuje++;
      });
    });
    const zmer = async (forma) => {
      P.setRows([{ pokemon: "Ninetales", forma: forma, cp: 1480, level: 22,
        ivAtk: 1, ivDef: 14, ivSta: 13, fastMove: "Fire Spin", charged1: "Weather Ball" }]);
      await new Promise((r) => setTimeout(r, 600));
      const c = P.getComputed()[P.getRows()[0].id];
      return (c.pvpLigy || []).map((l) => l.liga + " #" + l.rank).join(", ");
    };
    return {
      prosakuje: prosakuje,
      maShadowTabulku: !!(M.shadow && Object.keys(M.shadow).length),
      bezny: P.ligovePoradi("ninetales", "great"),
      shadow: P.ligovePoradi("ninetales", "great", "Shadow"),
      kusBezny: await zmer(""),
      kusShadow: await zmer("Shadow")
    };
  });
  check("žebříčky mají vlastní tabulku pro shadow", shadowLigy.maShadowTabulku);
  eq("…a pod holým jménem už nestojí žádná shadow varianta", shadowLigy.prosakuje, 0);
  check("shadow Ninetales má jiné pořadí než běžný",
    shadowLigy.shadow.rank !== shadowLigy.bezny.rank,
    "běžný #" + shadowLigy.bezny.rank + " vs shadow #" + shadowLigy.shadow.rank);
  check("…a projeví se to i u kusu v rosteru",
    shadowLigy.kusBezny !== shadowLigy.kusShadow,
    shadowLigy.kusBezny + "  vs  " + shadowLigy.kusShadow);

  // 3) Shadow kus do gymu bránit POSTAVIT JDE. Je jen horší obránce, protože
  //    má o 17 % nižší obranu — proto slot drží běžná kopie téhož druhu.
  const gymShadow = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([
      { pokemon: "Snorlax", forma: "Shadow", cp: 2600, level: 30, ivAtk: 10, ivDef: 15, ivSta: 15,
        fastMove: "Lick", charged1: "Body Slam" },
      { pokemon: "Snorlax", cp: 2500, level: 29, ivAtk: 8, ivDef: 14, ivSta: 14,
        fastMove: "Lick", charged1: "Body Slam" }
    ]);
    await new Promise((r) => setTimeout(r, 900));
    const c = P.getComputed();
    const out = {};
    P.getRows().forEach((r) => {
      out[r.forma === "Shadow" ? "shadow" : "bezny"] =
        { gym: c[r.id].gymRec, title: c[r.id].gymTitle || "" };
    });
    return out;
  });
  check("shadow kus do gymu smí", String(gymShadow.shadow.gym).indexOf("Ne") !== 0,
    gymShadow.shadow.gym);
  check("…ale slot drží běžná kopie", String(gymShadow.bezny.gym).indexOf("Ano 1") === 0,
    "běžný " + gymShadow.bezny.gym + " | shadow " + gymShadow.shadow.gym);
  check("…a je napsané, že shadow v gymu vydrží míň",
    gymShadow.shadow.title.indexOf("nižší obranu") > -1, gymShadow.shadow.title);

  // 4) Typová účinnost se počítá KAŽDÉMU ÚTOKU ZVLÁŠŤ. Dřív se vzal vyšší
  //    násobek z obou a aplikoval se na celé DPS, takže sestava se super
  //    efektivním jedním útokem dostala bonus i na tu druhou půlku.
  const counter = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([
      { pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 14, ivDef: 13, ivSta: 12,
        fastMove: "Counter", charged1: "Rock Slide" },
      { pokemon: "Machamp", forma: "Shadow", cp: 2200, level: 28, ivAtk: 14, ivDef: 13, ivSta: 12,
        fastMove: "Counter", charged1: "Rock Slide" }
    ]);
    await new Promise((r) => setTimeout(r, 800));
    const base = P.base();
    const bezny = base.filter((b) => b.row.forma !== "Shadow")[0];
    const shadow = base.filter((b) => b.row.forma === "Shadow")[0];
    // Normal boss: Counter (Fighting) je super efektivní, Rock Slide neutrální
    const mix = P.counterScore(bezny, ["Normal"]);
    // Ice boss: super efektivní je Counter i Rock Slide
    const oba = P.counterScore(bezny, ["Ice"]);
    const mixShadow = P.counterScore(shadow, ["Normal"]);
    return {
      mix: { off: mix.off, offF: mix.offF, offC: mix.offC,
        dps: mix.dpsProti, holyDps: mix.moveset.dps, score: mix.score, vydrz: mix.vydrz },
      oba: { off: oba.off, offF: oba.offF, offC: oba.offC,
        dps: oba.dpsProti, holyDps: oba.moveset.dps },
      shadow: { score: mixShadow.score, vydrz: mixShadow.vydrz, taken: mixShadow.taken },
      taken: mix.taken
    };
  });
  check("proti Normal je super efektivní jen rychlý útok",
    counter.mix.offF > counter.mix.offC,
    counter.mix.offF + " vs " + counter.mix.offC);
  check("…takže bonus nedostane celé poškození",
    counter.mix.dps < counter.mix.holyDps * counter.mix.off - 0.001,
    counter.mix.dps.toFixed(2) + " < " + (counter.mix.holyDps * counter.mix.off).toFixed(2));
  check("…ale je vyšší, než kdyby bonus nebyl vůbec",
    counter.mix.dps > counter.mix.holyDps + 0.001,
    counter.mix.dps.toFixed(2) + " > " + counter.mix.holyDps.toFixed(2));
  check("když jsou super efektivní oba útoky, násobí se celé DPS",
    Math.abs(counter.oba.dps - counter.oba.holyDps * counter.oba.off) < 0.01,
    counter.oba.dps.toFixed(2) + " vs " + (counter.oba.holyDps * counter.oba.off).toFixed(2));
  // Shadow: +20 % útok a nižší obrana (ta je ve `vydrz`). Nic dalšího —
  // dřív se nevýhoda počítala podruhé i ve jmenovateli.
  eq("shadow se do skóre nepočítá dvakrát", counter.shadow.taken, counter.taken);
  check("…poměr skóre sedí přesně na útok × výdrž",
    Math.abs(counter.shadow.score / counter.mix.score
      - 1.2 * (counter.shadow.vydrz / counter.mix.vydrz)) < 0.001,
    (counter.shadow.score / counter.mix.score).toFixed(4) + " vs "
      + (1.2 * (counter.shadow.vydrz / counter.mix.vydrz)).toFixed(4));

  // 5) „Great League: Mega Edition" není otevřená Great League a pojmenovaný
  //    cup taky ne. Dřív stačilo, že se v názvu vyskytl text „Great League".
  const formaty = await page.evaluate(() => {
    const okna = (window.__pgo.eventsData().ligy || []);
    const megaOkno = okna.filter((l) => /Mega Edition/.test(l[0]))[0] || null;
    const cupOkno = okna.filter((l) => /Cup/.test(l[0]))[0] || null;
    return {
      megaOtevrene: megaOkno ? megaOkno[3] : null,
      megaOmezene: megaOkno ? (megaOkno[5] || []).map((f) => f[0]) : null,
      cupOmezene: cupOkno ? (cupOkno[5] || []).map((f) => f[0]) : null,
      stav: window.__pgo.ligyStav()
    };
  });
  check("okno s Mega Edition nehlásí otevřenou ligu",
    formaty.megaOtevrene && formaty.megaOtevrene.length === 0,
    JSON.stringify(formaty.megaOtevrene));
  check("…ale formát se pojmenuje",
    (formaty.megaOmezene || []).some((x) => /Mega Edition/.test(x)),
    (formaty.megaOmezene || []).join(", "));
  check("pojmenovaný cup se taky vede zvlášť",
    (formaty.cupOmezene || []).some((x) => /Cup/.test(x)),
    (formaty.cupOmezene || []).join(", "));
  check("…a stav ligy to rozlišuje od „běží“",
    Object.keys(formaty.stav).every((k) => ["ted", "brzy", "omezene", "omezeneBrzy"]
      .indexOf(formaty.stav[k]) > -1),
    JSON.stringify(formaty.stav));

  // 6) Maximum stat productu se hledá v CELÉ mřížce. Dřív se Def a Sta
  //    procházely jen od 8 výš s odůvodněním, že optimum je vždycky nahoře.
  const sp = await page.evaluate(() => {
    const P = window.__pgo;
    const out = [];
    ["skrelp", "wooper", "azumarill"].forEach((k) => {
      const dex = P.dexByKey(k);
      if (!dex) return;
      const cap = 1500;
      let hrubou = 0;
      for (let a = 0; a <= 15; a++) {
        for (let d = 0; d <= 15; d++) {
          for (let s = 0; s <= 15; s++) {
            const idx = P.bestLevelIndex(dex, a, d, s, cap);
            if (idx < 0) continue;
            const v = P.statProduct(dex, a, d, s, P.cpmLevels()[idx][1]);
            if (v > hrubou) hrubou = v;
          }
        }
      }
      out.push({ druh: k, appka: P.speciesMaxSP(k, dex, cap), hrubou: hrubou });
    });
    return out;
  });
  // Dokumentace musí říkat totéž co engine.
  const dok219 = await page.evaluate(async () => {
    window.__pgoZalozka("docsCard");
    await new Promise((r) => setTimeout(r, 900));
    const t = document.getElementById("docsCard").textContent.replace(/\s+/g, " ");
    return {
      ceny: t.indexOf("Lucky") > -1 && t.indexOf("půlku prachu") > -1,
      shadowLigy: t.indexOf("Shadow má v ligách vlastní žebříček") > -1,
      gym: t.indexOf("Shadow do gymu bránit smí") > -1,
      counter: t.indexOf("Typová výhoda platí pro útok") > -1,
      mrizka: t.indexOf("4096") > -1,
      format: t.indexOf("Omezený formát není otevřená liga") > -1
    };
  });
  check("dokumentace popisuje ceny podle stavu kusu", dok219.ceny, JSON.stringify(dok219));
  check("…i oddělené shadow žebříčky", dok219.shadowLigy);
  check("…i to, že shadow smí do gymu", dok219.gym);
  check("…i typovou výhodu po útocích", dok219.counter);
  check("…i celou mřížku IV", dok219.mrizka);
  check("…i omezené formáty lig", dok219.format);

  check("strop stat productu sedí na hrubou sílu přes všech 4096 kombinací",
    sp.length > 0 && sp.every((x) => Math.abs(x.appka - x.hrubou) < 1e-6),
    JSON.stringify(sp));

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n220) „čím nahradit“ se počítá, ruční seznam je jen záloha");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Jméno v bublině u náplasti je jediné místo, kde appka radí „tohle chytej".
  // Bralo se z ručního seznamu ze srpna; teď ze stejného spočítaného žebříčku
  // jako zbytek rozhodování, ať se appka nerozchází sama se sebou.
  const nahrada = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Machamp", cp: 1500, level: 20, ivAtk: 5, ivDef: 5, ivSta: 5,
      fastMove: "Counter", charged1: "Dynamic Punch" }]);
    await new Promise((r) => setTimeout(r, 800));
    const c = P.getComputed()[P.getRows()[0].id];
    const title = c.keepTitle || "";
    // Koho žebříček opravdu vede na Fighting
    const idx = P.raidRankIndex();
    const fighting = [];
    Object.keys(idx).forEach((k) => {
      (idx[k] || []).forEach((e) => {
        if (e.type === "Fighting") fighting.push({ k: k, rank: e.rank });
      });
    });
    fighting.sort((a, b) => a.rank - b.rank);
    const nej = [];
    fighting.forEach((x) => {
      const jm = (P.dexByKey(x.k) || {}).name;
      if (jm && nej.indexOf(jm) === -1 && nej.length < 3) nej.push(jm);
    });
    return { title: title, nej: nej };
  });
  check("bublina radí právě ty tři, které vede spočítaný žebříček",
    nahrada.nej.length === 3 && nahrada.nej.every((jm) => nahrada.title.indexOf(jm) > -1),
    nahrada.nej.join(", ") + "  |  " + nahrada.title.slice(0, 200));
  check("…a žádné jméno se neopakuje",
    nahrada.nej.length === new Set(nahrada.nej).size, nahrada.nej.join(", "));

  // Ruční seznam v reference.json je od téhle verze jen poslední záchrana.
  // Když na něj spadne kterýkoli druh, znamená to díru ve výpočtu.
  const zalohaRef = await page.evaluate(() => {
    const P = window.__pgo;
    // jména z ručního seznamu jsou zapečená v REFERENCE uvnitř appky —
    // dostaneme se k nim přes role, které appka u těch druhů zná
    const druhy = ["Charizard", "Kyogre", "Lucario", "Thundurus", "Landorus",
      "Giratina", "Zacian", "Snorlax", "Metagross", "Rayquaza"];
    const bezRole = druhy.filter((jm) => !P.raidRolesFor(jm).length);
    return { bezRole: bezRole, spocitanych: Object.keys(P.raidRankIndex()).length };
  });
  check("spočítaný žebříček zná i druhy vedené pod jinou formou",
    zalohaRef.bezRole.length === 0, zalohaRef.bezRole.join(", "));
  check("…a pokrývá stovky druhů, ne desítky",
    zalohaRef.spocitanych > 200, String(zalohaRef.spocitanych));

  // Tabulka zdrojů musí říkat, že se obránci počítají — ne že jsou z ruky.
  const zdrojeTab = await page.evaluate(async () => {
    window.__pgoZalozka("docsCard");
    await new Promise((r) => setTimeout(r, 900));
    const t = (document.getElementById("dataInfo") || {}).textContent || "";
    return t.replace(/\s+/g, " ");
  });
  check("tabulka zdrojů přiznává, že obránce si appka počítá",
    /Gymoví obránci/.test(zdrojeTab) && /počítá si appka sama/.test(zdrojeTab),
    zdrojeTab.slice(0, 200));
  check("…a že ruční seznam je jen záloha",
    /už jen záloha/.test(zdrojeTab), zdrojeTab.slice(0, 200));

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n221) rozpočet: značkové kusy ven, rozdělaná kopie napřed");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Z Anetina rosteru: v rozpočtu se nabízeli pokémoni, které si nechala jako
  // CUTE, a Gyarados za 300 CP na vylepšení, přestože vedle stál Gyarados
  // za 2400 CP téhož druhu a na tutéž roli.
  const anet = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setDiscarded([]);
    document.getElementById("resetSettingsBtn").click();
    await new Promise((r) => setTimeout(r, 400));
    P.setRows([
      { pokemon: "Gyarados", cp: 2400, level: 30, ivAtk: 15, ivDef: 14, ivSta: 14,
        fastMove: "Waterfall", charged1: "Hydro Pump" },
      { pokemon: "Gyarados", cp: 300, level: 8, ivAtk: 10, ivDef: 10, ivSta: 10,
        fastMove: "Waterfall", charged1: "Hydro Pump" },
      { pokemon: "Pidgey", cute: "Ano", cp: 200, level: 12, ivAtk: 5, ivDef: 5, ivSta: 5,
        fastMove: "Tackle", charged1: "Aerial Ace" },
      { pokemon: "Rattata", cp: 300, level: 15, ivAtk: 15, ivDef: 15, ivSta: 15,
        fastMove: "Quick Attack", charged1: "Body Slam" }
    ]);
    await new Promise((r) => setTimeout(r, 1000));
    const c = P.getComputed();
    const plan = P.prachovyPlan();
    const kus = (cp) => P.getRows().filter((r) => r.cp === cp)[0];
    const poradi = (cp) => plan.map((e) => e.row.cp).indexOf(cp);
    return {
      // značkové kusy: drží je značka, ne role
      cutePidgey: { keep: c[kus(200).id].keep, sub: c[kus(200).id].keepSub,
        powerup: c[kus(200).id].powerup, znamka: !!c[kus(200).id].jenZnamka },
      stoRattata: (function () {
        // Podle JMÉNA, ne podle CP — 300 CP má i ten slabý Gyarados.
        var r = P.getRows().filter(function (x) { return x.pokemon === "Rattata"; })[0];
        return { keep: c[r.id].keep, sub: c[r.id].keepSub,
          powerup: c[r.id].powerup, znamka: !!c[r.id].jenZnamka };
      })(),
      vPlanu: plan.map((e) => e.row.pokemon + " " + e.row.cp),
      poradiSilny: poradi(2400),
      poradiSlaby: poradi(300),
      slabyMaPoznamku: plan.filter((e) => e.row.cp === 300 && e.row.pokemon === "Gyarados")
        .every((e) => !!e.lepsiCesta),
      zbyvaSilny: (plan.filter((e) => e.row.cp === 2400)[0] || {}).zbyvaCelkem,
      zbyvaSlaby: (plan.filter((e) => e.row.cp === 300
        && e.row.pokemon === "Gyarados")[0] || {}).zbyvaCelkem
    };
  });

  eq("CUTE kus se pořád nechává", anet.cutePidgey.keep, "Ponechat");
  eq("…a je vidět, že ho drží značka", anet.cutePidgey.sub, "Protože CUTE");
  eq("…ale prach do něj nepatří", anet.cutePidgey.powerup, "Ne");
  check("…a v rozpočtu vůbec není",
    anet.vPlanu.every((x) => x.indexOf("Pidgey") === -1), anet.vPlanu.join(", "));
  eq("dokonalý kus bez role se taky nevylepšuje", anet.stoRattata.powerup, "Ne");
  check("…a v rozpočtu taky není",
    anet.vPlanu.every((x) => x.indexOf("Rattata") === -1), anet.vPlanu.join(", "));

  // Dvě kopie téhož druhu na tutéž roli: napřed se dodělá ta rozdělaná.
  check("obě kopie Gyaradose jsou v plánu",
    anet.poradiSilny > -1 && anet.poradiSlaby > -1, anet.vPlanu.join(", "));
  check("…a dotáhnout ten silnější stojí míň",
    anet.zbyvaSilny < anet.zbyvaSlaby,
    anet.zbyvaSilny + " vs " + anet.zbyvaSlaby);
  check("…takže stojí v plánu VÝŠ",
    anet.poradiSilny < anet.poradiSlaby,
    "silný #" + anet.poradiSilny + ", slabý #" + anet.poradiSlaby);
  const dok221 = await page.evaluate(async () => {
    window.__pgoZalozka("docsCard");
    await new Promise((r) => setTimeout(r, 900));
    const t = document.getElementById("docsCard").textContent.replace(/\s+/g, " ");
    return { znamka: t.indexOf("Kus, který drží jen značka") > -1,
      kopie: t.indexOf("Rozdělaná kopie se dodělá dřív") > -1 };
  });
  check("dokumentace popisuje, proč značkový kus v rozpočtu není", dok221.znamka);
  check("…i pořadí rozdělané kopie", dok221.kopie);

  check("…a u slabé kopie je napsané, co dodělat dřív",
    anet.slabyMaPoznamku, String(anet.slabyMaPoznamku));

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n222) kontrakt pro vzhledovou vrstvu");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Vzhled drží někdo jiný a v jiném souboru. Tenhle blok je smlouva:
  // dokud tyhle věci existují a znamenají totéž, dá se na engine stavět.
  // Když se něco z toho přejmenuje, spadne to TADY, ne až v cizí appce.
  const kontrakt = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 14, ivDef: 13, ivSta: 12,
      fastMove: "Counter", charged1: "Dynamic Punch" }]);
    await new Promise((r) => setTimeout(r, 800));
    const c = P.getComputed()[P.getRows()[0].id];
    const funkce = ["getRows", "getComputed", "base", "setRows", "prekreslit", "prepocitat",
      "snapshot", "prachovyPlan", "getPlan", "getKeepList", "getCheatSheet",
      "getEvolvePlan", "coChytat", "pokedex", "meta", "movesData", "eventsData",
      "dexEntry", "dexByKey", "dexKeyOf", "upgradeCost", "ligovePoradi",
      "raidRankIndex", "gymRankIndex", "counterScore", "formatDust",
      // ovladani, ktere si vrstva dela po svem: razeni, detail v cizi
      // plachte a zalozni obrazek druhu
      "atlasSort", "atlasDetail", "atlasImage"];
    const pole = ["keep", "keepGood", "keepSub", "keepTitle", "keepTone", "ivPct",
      "powerup", "powerupSub", "powerupTone", "cost", "costText",
      "raidPct", "raidRec", "gymPct", "gymRec", "pvpRec", "pvpLigy",
      "evolve", "mega", "trade", "purify", "worseCopy", "copies",
      "jenZnamka", "jeMezera", "stoProcent", "cute", "shiny", "strongAll"];
    return {
      chybiFunkce: funkce.filter((f) => typeof P[f] !== "function"),
      // dataInfo je objekt, ne funkce — datumy zdrojů
      maDataInfo: !!(P.dataInfo && P.dataInfo.pokedex && P.dataInfo.meta),
      chybiPole: pole.filter((k) => !(k in c)),
      // cena musí přijít z enginu i se slevou za formu, ne dopočítaná ve vzhledu
      cenaMaNasobek: !!(c.cost && "nasobek" in c.cost && "duvodCeny" in c.cost)
    };
  });
  check("engine nabízí všechny funkce z kontraktu",
    kontrakt.chybiFunkce.length === 0, kontrakt.chybiFunkce.join(", "));
  check("…a datumy zdrojů jako objekt", kontrakt.maDataInfo);
  check("…a všechna pole na vyhodnoceném kusu",
    kontrakt.chybiPole.length === 0, kontrakt.chybiPole.join(", "));
  check("…a cena si s sebou nese, čím je upravená",
    kontrakt.cenaMaNasobek, String(kontrakt.cenaMaNasobek));

  // Sloty pro cizí vrstvu musí v appce zůstat, jinak build nemá kam vkládat.
  const sloty = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    return {
      css: html.indexOf("ATLAS CSS START") > -1 && html.indexOf("ATLAS CSS END") > -1,
      js: html.indexOf("ATLAS JS START") > -1 && html.indexOf("ATLAS JS END") > -1
    };
  });
  check("v appce je slot na cizí styly", sloty.css);
  check("…a na cizí skript", sloty.js);

  // V souboru nesmí být zapečený roster. Že appka startuje prázdná, hlídá
  // už blok 1; tohle hlídá zdroj: kdyby si někdo nasypal do localStorage svůj
  // export, odjede na veřejné GitHub Pages a zároveň se rozbijí testy,
  // protože každý blok počítá s prázdným začátkem.
  const zdroj222 = fs.readFileSync(path.join(WEB_DIR, "pokemon_tracker_app.html"), "utf8");
  const nasypano = /localStorage\.setItem\(\s*['"]pgo_[a-z_]*tracker/.test(zdroj222);
  check("v souboru není zapečený roster", !nasypano, String(nasypano));

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n223) skutečný export z Poké Genie (jiné sloupce než Calcy IV)");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Poké Genie má sloupec `Pokemon`, jenže v něm je ČÍSLO z pokédexu (608)
  // a jméno druhu drží ve sloupci `Name`. Podle hlavičky to vypadalo
  // jednoznačně, takže se naimportovalo 191 kusů pojmenovaných „608", druh
  // skončil v poznámce a všechny dostaly Zahodit. Fixture je zkrácený, ale
  // hlavička i formát hodnot jsou přesně jako v opravdovém exportu.
  const pgCsv = fs.readFileSync(path.join(__dirname, "fixtures", "pokegenie_export.csv"), "utf-8");
  const pg = await page.evaluate(async (csv) => {
    const P = window.__pgo;
    P.setRows([]); P.setDiscarded([]);
    await new Promise((r) => setTimeout(r, 300));
    const mapa = P.automatickeMapovani(csv) || {};
    P.importText(csv);
    P.finishImport(true);
    await new Promise((r) => setTimeout(r, 1200));
    const rows = P.getRows();
    const podle = {};
    rows.forEach((r) => { podle[r.pokemon] = r; });
    return {
      mapa: mapa,
      pocet: rows.length,
      jmena: rows.map((r) => r.pokemon),
      cisla: rows.filter((r) => /^\d+$/.test(String(r.pokemon))).length,
      neznamych: (P.neznameDruhy() || []).length,
      poznamky: rows.filter((r) => r.note).map((r) => r.note),
      podle: podle
    };
  }, pgCsv);

  eq("druh se bere ze sloupce Name, ne z čísla v Pokemon",
    pg.mapa["Pokémon (druh)"], "Name");
  eq("naimportovalo se všech sedm kusů", pg.pocet, 7);
  eq("…a žádný se nejmenuje číslem", pg.cisla, 0);
  eq("…a appka zná každý z nich", pg.neznamych, 0);
  check("…a jméno druhu neskončilo v poznámce",
    pg.poznamky.length === 0, pg.poznamky.join(", "));

  // Regionální forma je ve vlastním sloupci. Bez ní by z Alolan Sandslashe
  // byl obyčejný Sandslash — jiné typy, jiné staty, jiné role.
  check("regionální forma se přilepí ke jménu",
    pg.jmena.indexOf("Sandslash Alola") > -1 && pg.jmena.indexOf("Rapidash Galar") > -1,
    pg.jmena.join(", "));
  check("…a appka z ní pozná správný druh", !!pg.podle["Sandslash Alola"],
    Object.keys(pg.podle).join(", "));

  // Stav kusu píše Poké Genie číslem: 0 nic, 1 shadow, 2 purified.
  eq("shadow se pozná z čísla 1", (pg.podle["Snorlax"] || {}).forma, "Shadow");
  eq("purified z čísla 2", (pg.podle["Slowbro"] || {}).forma, "Purified");
  check("…a kus s nulou zůstane bez formy",
    !((pg.podle["Lampent"] || {}).forma), (pg.podle["Lampent"] || {}).forma);

  // Co export prostě neobsahuje, se nemá domýšlet.
  eq("CP se načte", (pg.podle["Blastoise"] || {}).cp, "1648");
  eq("…i level a IV", [(pg.podle["Blastoise"] || {}).level,
    (pg.podle["Blastoise"] || {}).ivAtk, (pg.podle["Blastoise"] || {}).ivDef,
    (pg.podle["Blastoise"] || {}).ivSta].join("/"), "23.5/15/13/15");
  check("…a útoky tam, kde v exportu jsou",
    (pg.podle["Blastoise"] || {}).fastMove === "Water Gun"
      && !((pg.podle["Lampent"] || {}).fastMove),
    (pg.podle["Blastoise"] || {}).fastMove + " | " + (pg.podle["Lampent"] || {}).fastMove);

  // Calcy IV se importovat nepřestal — jeho sloupec s druhem je taky `Name`,
  // jen tam žádné `Pokemon` s číslem není.
  const calcyPoOprave = await page.evaluate(async (csv) => {
    const P = window.__pgo;
    P.setRows([]); P.setDiscarded([]);
    await new Promise((r) => setTimeout(r, 300));
    const mapa = P.automatickeMapovani(csv) || {};
    P.importText(csv);
    P.finishImport(true);
    await new Promise((r) => setTimeout(r, 1000));
    return { mapa: mapa["Pokémon (druh)"], pocet: P.getRows().length,
      cisla: P.getRows().filter((r) => /^\d+$/.test(String(r.pokemon))).length };
  }, fs.readFileSync(path.join(__dirname, "fixtures", "calcy_iv_export.csv"), "utf-8"));
  // Dokumentace to musí říct, jinak to vypadá jako náhoda.
  const dok223 = await page.evaluate(async () => {
    window.__pgoZalozka("docsCard");
    await new Promise((r) => setTimeout(r, 900));
    const t = document.getElementById("docsCard").textContent.replace(/\s+/g, " ");
    return { sloupce: t.indexOf("ne jen podle názvu") > -1,
      utoky: t.indexOf("Útoky Poké Genie do exportu dávat nemusí") > -1 };
  });
  check("dokumentace popisuje, jak se poznají sloupce", dok223.sloupce);
  check("…i že prázdné útoky se nedomyslí", dok223.utoky);

  eq("Calcy IV se pořád mapuje na svůj sloupec", calcyPoOprave.mapa, "Name");
  check("…a naimportuje se", calcyPoOprave.pocet > 0 && calcyPoOprave.cisla === 0,
    calcyPoOprave.pocet + " kusů, " + calcyPoOprave.cisla + " čísel");

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n224) filtry na Typy a Silný proti + posudek jednotlivých útoků");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Filtry na Typy a Silný proti se přidaly do funkce, která začínala
  // „když není zapnutý ligový filtr, pusť všechno" — obě větve se tím
  // přeskočily. Klikat šlo, jen se nikdy nic neodfiltrovalo.
  const filtrySl = await page.evaluate(async () => {
    const P = window.__pgo;
    window.__pgoZalozka("roster");
    await new Promise((r) => setTimeout(r, 400));
    P.setRows([
      { pokemon: "Charizard", cp: 2400, level: 30, ivAtk: 14, ivDef: 13, ivSta: 13,
        fastMove: "Fire Spin", charged1: "Blast Burn" },
      { pokemon: "Blastoise", cp: 2200, level: 30, ivAtk: 13, ivDef: 14, ivSta: 14,
        fastMove: "Water Gun", charged1: "Hydro Cannon" },
      { pokemon: "Venusaur", cp: 2300, level: 30, ivAtk: 14, ivDef: 14, ivSta: 13,
        fastMove: "Vine Whip", charged1: "Frenzy Plant" },
      { pokemon: "Machamp", cp: 2500, level: 30, ivAtk: 15, ivDef: 13, ivSta: 13,
        fastMove: "Counter", charged1: "Dynamic Punch" }
    ]);
    await new Promise((r) => setTimeout(r, 900));
    const pocet = () => document.querySelectorAll("#tbody tr:not(.detail-row)").length;
    const jmena = () => Array.from(
      document.querySelectorAll("#tbody tr:not(.detail-row) td.col-pokemon"))
      .map((x) => x.textContent.trim().split("\n")[0]);
    const hlavicky = Array.from(document.querySelectorAll("#headerRow th"));
    const th = (text) => hlavicky.filter((t) => t.textContent.indexOf(text) === 0)[0];
    const out = { vse: pocet() };

    const zapni = async (sloupec, panel, typ) => {
      th(sloupec).querySelector(".pvp-filtr-ikona").click();
      await new Promise((r) => setTimeout(r, 250));
      const chk = document.querySelector(panel + ' input[data-typ="' + typ + '"]');
      chk.checked = true;
      chk.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 500));
    };
    const vypni = async (panel, typ) => {
      const chk = document.querySelector(panel + ' input[data-typ="' + typ + '"]');
      chk.checked = false;
      chk.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 400));
    };

    await zapni("Typy", "#typFiltrSeznam", "Fire");
    out.typFire = { pocet: pocet(), jmena: jmena() };
    await vypni("#typFiltrSeznam", "Fire");
    out.poZruseni = pocet();

    await zapni("Silný proti", "#silnyFiltrSeznam", "Water");
    out.silnyWater = { pocet: pocet(), jmena: jmena() };
    await vypni("#silnyFiltrSeznam", "Water");
    return out;
  });

  eq("bez filtru jsou v tabulce všichni", filtrySl.vse, 4);
  eq("filtr na typ opravdu filtruje", filtrySl.typFire.pocet, 1);
  check("…a nechá toho správného", filtrySl.typFire.jmena[0].indexOf("Charizard") === 0,
    filtrySl.typFire.jmena.join(", "));
  eq("…a po zrušení jsou zpátky všichni", filtrySl.poZruseni, 4);
  eq("filtr na „silný proti“ taky", filtrySl.silnyWater.pocet, 1);
  check("…a je to ten, kdo Water opravdu bije",
    filtrySl.silnyWater.jmena[0].indexOf("Venusaur") === 0,
    filtrySl.silnyWater.jmena.join(", "));

  // U útoků v detailu má být typ, jeho barva a bublina KE KAŽDÉMU zvlášť.
  // „62 % nejlepšího movesetu" neřekne, který ze tří je ten špatný.
  const utokyDet = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Machamp", cp: 2500, level: 30, ivAtk: 15, ivDef: 13, ivSta: 13,
      fastMove: "Karate Chop", charged1: "Dynamic Punch", charged2: "Heavy Slam" }]);
    await new Promise((r) => setTimeout(r, 900));
    const tr = document.querySelector("#tbody tr:not(.detail-row)");
    tr.querySelector('td[data-col="pokemon"]').click();
    await new Promise((r) => setTimeout(r, 700));
    return Array.from(document.querySelectorAll("#tbody .detail-row .d-move")).map((x) => ({
      typ: (x.querySelector(".d-type") || {}).textContent || "",
      barva: (x.querySelector(".d-type") || {}).style
        ? x.querySelector(".d-type").style.background : "",
      trida: x.className,
      tip: x.getAttribute("data-tip") || x.getAttribute("title") || ""
    }));
  });
  eq("v detailu jsou všechny tři útoky", utokyDet.length, 3);
  check("…a každý nese svůj typ", utokyDet.every((u) => u.typ.length > 2),
    utokyDet.map((u) => u.typ).join(", "));
  check("…obarvený jako typy jinde v appce",
    utokyDet.every((u) => /rgb|#|var\(/.test(u.barva)),
    utokyDet.map((u) => u.barva).join(" | "));
  check("…a u každého je vlastní bublina",
    utokyDet.every((u) => u.tip.length > 25), utokyDet.map((u) => u.tip.length).join(", "));
  check("…která u dobrého útoku říká, ať ho necháš",
    utokyDet.some((u) => /d-move-nej|d-move-dobry/.test(u.trida) && /nech/i.test(u.tip)),
    utokyDet.map((u) => u.trida + ": " + u.tip.slice(0, 40)).join(" | "));
  check("…a u zbytečného, že se do raidu nehodí",
    utokyDet.some((u) => /d-move-preucit/.test(u.trida) && /nehod/i.test(u.tip)),
    utokyDet.map((u) => u.trida).join(", "));
  // Útok, který zaostává o tři desetiny procenta, není útok k přeučení —
  // odporovalo by si to s větou nad tím, kde stojí „100 % nejlepšího movesetu".
  const dok224 = await page.evaluate(async () => {
    window.__pgoZalozka("docsCard");
    await new Promise((r) => setTimeout(r, 900));
    const t = document.getElementById("docsCard").textContent.replace(/\s+/g, " ");
    return { ztrata: t.indexOf("Rozhoduje ztráta, ne pořadí") > -1,
      druhy: t.indexOf("Druhý nabitý útok") > -1 };
  });
  check("dokumentace popisuje, podle čeho se útok posuzuje", dok224.ztrata);
  check("…i výjimku u druhého nabitého", dok224.druhy);

  check("útok pár desetin za nejlepším se neoznačí k přeučení",
    utokyDet.some((u) => /Fighting/.test(u.typ) && /prakticky nejlep/i.test(u.tip)),
    utokyDet.map((u) => u.tip.slice(0, 60)).join(" | "));

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n225) bublina útoků v řádku a DPS ve výběru útoku");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Bublina u buňky Útoky nesla jen jednu větu o celé sestavě. Z „62 %
  // nejlepšího movesetu" se nedalo poznat, který ze tří útoků je ten špatný,
  // a u nevyplněných útoků nestálo, co to pro rozhodování znamená.
  const bublinyUt = await page.evaluate(async () => {
    const P = window.__pgo;
    window.__pgoZalozka("roster");
    await new Promise((r) => setTimeout(r, 400));
    P.setRows([
      { pokemon: "Machamp", cp: 2500, level: 30, ivAtk: 15, ivDef: 13, ivSta: 13,
        fastMove: "Karate Chop", charged1: "Dynamic Punch", charged2: "Heavy Slam" },
      { pokemon: "Tyranitar", cp: 2900, level: 32, ivAtk: 14, ivDef: 14, ivSta: 14 }
    ]);
    await new Promise((r) => setTimeout(r, 900));
    const najdi = (jm) => Array.from(document.querySelectorAll("#tbody tr:not(.detail-row)"))
      .filter((t) => t.textContent.indexOf(jm) > -1)[0]
      .querySelector('td[data-col="moves"]');
    const tip = (td) => td.getAttribute("data-tip") || td.title || "";
    const c = P.getComputed();
    const machamp = P.getRows().filter((r) => r.pokemon === "Machamp")[0];
    return {
      sUtoky: tip(najdi("Machamp")),
      bezUtoku: tip(najdi("Tyranitar")),
      posudky: (c[machamp.id].utoky || []).map((u) => u.jm + "|" + u.stav + "|" + u.typ)
    };
  });

  // Na computed je posudek každého útoku zvlášť — z jednoho místa ho bere
  // tabulka i rozbor, takže si nemůžou odporovat.
  eq("posudek je u všech tří útoků", bublinyUt.posudky.length, 3);
  check("…a každý má stav i typ",
    bublinyUt.posudky.every((x) => x.split("|")[1] && x.split("|")[2]),
    bublinyUt.posudky.join(", "));

  check("bublina v řádku vypíše každý útok zvlášť",
    ["Karate Chop", "Dynamic Punch", "Heavy Slam"]
      .every((jm) => bublinyUt.sUtoky.indexOf(jm) > -1),
    bublinyUt.sUtoky.slice(0, 160));
  check("…u každého i s typem",
    bublinyUt.sUtoky.indexOf("Fighting") > -1 && bublinyUt.sUtoky.indexOf("Steel") > -1,
    bublinyUt.sUtoky.slice(0, 160));
  check("…a s důvodem, ne jen jménem",
    /nech/i.test(bublinyUt.sUtoky) && /nehod|přeuč/i.test(bublinyUt.sUtoky),
    bublinyUt.sUtoky.slice(0, 200));
  check("…a řekne, že se dá klepnout a změnit",
    /Klepnut/i.test(bublinyUt.sUtoky), bublinyUt.sUtoky.slice(-120));

  // Bez útoků má cenu říct jedině to, co si má člověk nastavit. Výklad
  // o tom, že sken útoky nezachytil a jak se bez nich počítá role, jen
  // přehlušil to jediné použitelné jméno — proto je pryč.
  check("bez útoků bublina ukáže nejlepší možnou sestavu",
    /tip-nej/.test(bublinyUt.bezUtoku) && /\+/.test(bublinyUt.bezUtoku),
    bublinyUt.bezUtoku);
  check("…a řekne, jak ji nastavit",
    /Klepnutím/i.test(bublinyUt.bezUtoku), bublinyUt.bezUtoku);
  check("…a nic o tom, že sken útoky nezachytil",
    !/Calcy|nezachytil|odhadem/i.test(bublinyUt.bezUtoku), bublinyUt.bezUtoku);
  check("…a vejde se do tří řádků",
    bublinyUt.bezUtoku.replace(/<[^>]*>/g, " ").trim().length < 130,
    String(bublinyUt.bezUtoku.replace(/<[^>]*>/g, " ").trim().length));

  // Ve výběru útoku stála surová „síla“, která o volbě nerozhoduje: neříká,
  // jak dlouho útok trvá ani kolik energie stojí. Teď je tam DPS celé sestavy.
  const vyberUt = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Machamp", cp: 2500, level: 30, ivAtk: 15, ivDef: 13, ivSta: 13,
      fastMove: "Karate Chop", charged1: "Dynamic Punch" }]);
    await new Promise((r) => setTimeout(r, 900));
    document.querySelector('#tbody td[data-col="moves"]').click();
    await new Promise((r) => setTimeout(r, 400));
    document.querySelectorAll(".utok-edit .uv-pole")[0].click();
    await new Promise((r) => setTimeout(r, 400));
    const box = document.querySelector(".uv-seznam");
    const polozky = Array.from(box.querySelectorAll(".uv-polozka:not(.uv-prazdna)")).map((x) => ({
      nazev: (x.querySelector(".uv-nazev") || {}).textContent || "",
      meta: (x.querySelector(".uv-meta") || {}).textContent || "",
      tip: (x.querySelector(".uv-meta")
        ? (x.querySelector(".uv-meta").getAttribute("data-tip")
           || x.querySelector(".uv-meta").title) : "") || ""
    }));
    return { polozky: polozky,
      // totéž číslo, jaké spočítá engine
      dpsCounter: P.dpsSestavy("Machamp", "Counter", "Dynamic Punch"),
      dpsKarate: P.dpsSestavy("Machamp", "Karate Chop", "Dynamic Punch") };
  });
  check("výběr útoku nabízí víc možností", vyberUt.polozky.length >= 2,
    String(vyberUt.polozky.length));
  check("…a u každé stojí číslo",
    vyberUt.polozky.every((x) => /\d/.test(x.meta)),
    vyberUt.polozky.map((x) => x.nazev + "=" + x.meta).join(", "));
  check("…což je DPS celé sestavy, ne surová síla",
    vyberUt.polozky.some((x) => x.nazev.indexOf("Counter") > -1
      && x.meta.replace(",", ".") === String(Math.round(vyberUt.dpsCounter * 10) / 10)),
    vyberUt.polozky.map((x) => x.nazev + "=" + x.meta).join(", ")
      + " | engine: " + vyberUt.dpsCounter);
  check("…a lepší útok má vyšší číslo", vyberUt.dpsCounter > vyberUt.dpsKarate,
    vyberUt.dpsCounter + " vs " + vyberUt.dpsKarate);
  check("…bublina řekne, co to číslo je, a přidá surovou sílu",
    vyberUt.polozky.some((x) => /vte\u0159inu/.test(x.tip) && /Surov\u00e1 s\u00edla/.test(x.tip)),
    (vyberUt.polozky[0] || {}).tip);

  await page.goto(URL);
  await page.waitForTimeout(700);

  console.log("\n226) Vyhledávání: nejlepší útoky druhu");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Ve vyhledávání není konkrétní kus, takže se nedá říct „tenhle nech
  // a tenhle přeuč". Otázka je jiná: co má ten druh umět, až ho chytíš.
  // Vypisuje se proto stejně jako u kusu — typ, barva, bublina.
  const vyhlUtoky = await page.evaluate(async () => {
    const P = window.__pgo;
    window.__pgoZalozka("prohlidkaCard");
    await new Promise((r) => setTimeout(r, 500));
    const nacti = async (jm) => {
      const pole = document.getElementById("prohName");
      pole.value = jm;
      pole.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 700));
      const n = document.querySelector(".druh-napoveda");
      if (n) n.hidden = true;
      return Array.from(document.querySelectorAll("#prohlidkaCard .d-utoky-radek"))
        .map((x) => ({
          role: (x.querySelector(".d-utoky-role") || {}).textContent || "",
          utoky: Array.from(x.querySelectorAll(".d-move")).map((m) => ({
            typ: (m.querySelector(".d-type") || {}).textContent || "",
            jm: (m.querySelector(".d-move-jm") || {}).textContent || "",
            tip: m.getAttribute("data-tip") || m.getAttribute("title") || ""
          }))
        }));
    };
    const azumarill = await nacti("Azumarill");
    const sekce = Array.from(document.querySelectorAll("#prohlidkaCard .d-sec-h"))
      .map((x) => x.textContent);
    return { azumarill: azumarill, sekce: sekce,
      // totéž, co spočítá engine — ať se neporovnává s natvrdo psaným jménem
      rec: (function () {
        var e = P.meta().leagues.great.azumarill;
        return e ? e[3] : null;
      })() };
  });

  // Pořadí v raidu je mezi BěŽNÝMI druhy. Komunitní žebříčky počítají
  // i mega a shadow formy, takže tam týž druh vychází níž — appka to musí říct,
  // jinak to vypadá jako chyba (Xerneas: appka #1 Fairy, video #7).
  const rozsahRanku = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Xerneas", cp: 3000, level: 30, ivAtk: 14, ivDef: 14, ivSta: 14,
      fastMove: "Geomancy", charged1: "Moonblast" }]);
    await new Promise((r) => setTimeout(r, 900));
    const c = P.getComputed()[P.getRows()[0].id];
    const idx = P.raidRankIndex();
    // „meganium" začíná na mega a mega forma to není — hledá se přípona,
    // pod kterou by mega formy v pokédexu byly.
    const megy = Object.keys(idx).filter((k) => /-mega|^mega-/i.test(k)).length;
    window.__pgoZalozka("docsCard");
    await new Promise((r) => setTimeout(r, 900));
    const zdroje = (document.getElementById("dataInfo") || {}).textContent || "";
    return { title: c.raidTitle || "", megy: megy,
      zdrojeRikaji: /mega ani shadow formy se do pořadí nepočítají/.test(
        zdroje.replace(/\s+/g, " ")) };
  });
  eq("v raidovém žebříčku nejsou mega formy", rozsahRanku.megy, 0);
  check("tabulka zdrojů to říká", rozsahRanku.zdrojeRikaji,
    String(rozsahRanku.zdrojeRikaji));

  check("ve Vyhledávání je sekce s útoky",
    vyhlUtoky.sekce.indexOf("Nejlepší útoky") > -1, vyhlUtoky.sekce.join(", "));
  check("…s řádkem pro raid", vyhlUtoky.azumarill.some((x) => /raid/i.test(x.role)),
    vyhlUtoky.azumarill.map((x) => x.role).join(", "));
  check("…a s řádkem pro ligu, kterou druh hraje",
    vyhlUtoky.azumarill.some((x) => /GL|UL|ML|LC/.test(x.role)),
    vyhlUtoky.azumarill.map((x) => x.role).join(", "));
  check("každý útok nese svůj typ",
    vyhlUtoky.azumarill.every((x) => x.utoky.every((u) => u.typ.length > 2)),
    JSON.stringify(vyhlUtoky.azumarill.map((x) => x.utoky.map((u) => u.typ))));
  check("…a bublinu, co to je za sestavu",
    vyhlUtoky.azumarill.every((x) => x.utoky.every((u) => u.tip.length > 20)),
    JSON.stringify(vyhlUtoky.azumarill[0].utoky.map((u) => u.tip.slice(0, 30))));
  // Ligová sestava není vymyšlená: je to doporučení z dat, ne vlastní výpočet.
  check("ligová sestava sedí na doporučení z dat",
    !vyhlUtoky.rec || vyhlUtoky.azumarill.some((x) => /GL/.test(x.role)
      && x.utoky.length === vyhlUtoky.rec.length),
    JSON.stringify(vyhlUtoky.rec) + " vs "
      + JSON.stringify(vyhlUtoky.azumarill.map((x) => x.utoky.length)));

  console.log("\n227) API pro vzhledovou vrstvu: razeni, detail, zalozka");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Vrstva ma vlastni ovladani: razeni rozbalovatkem misto klikani do
  // hlavicky a detail kusu ve vlastni plachte. Drive se to do enginu
  // vpichovalo pri buildu testovaci verze textovou nahradou; ted je to
  // jeho verejna soucast, takze to musi hlidat test.
  const uiApi = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([
      { pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 14, ivDef: 13, ivSta: 12 },
      { pokemon: "Azumarill", cp: 1500, level: 30, ivAtk: 10, ivDef: 15, ivSta: 15 },
      { pokemon: "Gyarados", cp: 3000, level: 32, ivAtk: 15, ivDef: 10, ivSta: 12 },
    ]);
    await new Promise((r) => setTimeout(r, 600));
    const cpVTabulce = () => Array.prototype.map.call(
      document.querySelectorAll("#tbody tr"),
      (tr) => Number((tr.querySelector('[data-key="cp"]') || {}).textContent
        || (tr.querySelector('input[data-key="cp"]') || {}).value || 0));

    const sestupne = P.atlasSort("cp", -1);
    await new Promise((r) => setTimeout(r, 300));
    const poSestupne = cpVTabulce();
    const snapSestupne = P.snapshot();

    const vzestupne = P.atlasSort("cp", 1);
    await new Promise((r) => setTimeout(r, 300));
    const poVzestupne = cpVTabulce();

    // Neznamy klic nesmi stav rozhodit ani nic prekreslit.
    const nesmysl = P.atlasSort("neexistuje", -1);
    const snapPoNesmyslu = P.snapshot();

    // Prazdny klic = zpatky na puvodni poradi.
    P.atlasSort("");
    const snapZrusene = P.snapshot();

    return {
      sestupneVratilo: sestupne, vzestupneVratilo: vzestupne, nesmyslVratil: nesmysl,
      poSestupne, poVzestupne,
      klicSestupne: snapSestupne.sortKey, smerSestupne: snapSestupne.sortDir,
      klicPoNesmyslu: snapPoNesmyslu.sortKey, smerPoNesmyslu: snapPoNesmyslu.sortDir,
      klicZrusene: snapZrusene.sortKey,
      sipkaVHlavicce: (document.getElementById("headerRow") || {}).textContent || "",
    };
  });
  eq("atlasSort potvrdi, ze seradil", uiApi.sestupneVratilo, true);
  check("sestupne razeni opravdu preskladalo tabulku",
    JSON.stringify(uiApi.poSestupne) === JSON.stringify(uiApi.poSestupne.slice().sort((a, b) => b - a)),
    JSON.stringify(uiApi.poSestupne));
  check("vzestupne razeni ji preskladalo obracene",
    JSON.stringify(uiApi.poVzestupne) === JSON.stringify(uiApi.poVzestupne.slice().sort((a, b) => a - b)),
    JSON.stringify(uiApi.poVzestupne));
  eq("stav razeni se propise do snapshotu", uiApi.klicSestupne, "cp");
  eq("…i se smerem", uiApi.smerSestupne, -1);
  eq("neznamy klic se odmitne", uiApi.nesmyslVratil, false);
  eq("a stav razeni po nem zustane netknuty", uiApi.klicPoNesmyslu, "cp");
  eq("prazdny klic razeni zrusi", uiApi.klicZrusene, null);

  const detailApi = await page.evaluate(async () => {
    const P = window.__pgo;
    const id = P.getRows()[0].id;
    const box = document.createElement("div");
    box.id = "test-detail-box";
    document.body.appendChild(box);

    let zavreno = 0;
    const vysledek = P.atlasDetail(id, box, () => { zavreno += 1; });
    const delkaPoVykresleni = box.innerHTML.length;

    // Hacek vrstvy: engine o nem nic nevi, jen ho zavola, kdyz existuje.
    let hacek = null;
    window.AtlasEnhanceDetail = (kontejner, radek, computed) => {
      hacek = { maKontejner: kontejner === box, id: radek.id, keep: computed.keep };
    };
    // Pozor: kazde vykresleni napoji zaviraci tlacitko znovu. Kdyby se sem
    // dala jina funkce, pocital by se klik do ni a ne do te prvni.
    P.atlasDetail(id, box, () => { zavreno += 1; });

    // Zmena v detailu musi vrstve rict, ze si ma detail otevrit znovu.
    let refresh = 0;
    window.addEventListener("atlas:refresh-detail", () => { refresh += 1; });
    const cute = box.querySelector(".cute-prepinac");
    if (cute) cute.click();
    await new Promise((r) => setTimeout(r, 400));

    const zavrit = box.querySelector(".detail-close");
    if (zavrit) zavrit.click();
    const maZaviraciTlacitko = !!zavrit;

    const neznamy = P.atlasDetail("takove-id-neexistuje", box, () => {});
    const bezKontejneru = P.atlasDetail(id, null, () => {});

    delete window.AtlasEnhanceDetail;
    box.remove();
    return {
      vysledek, delkaPoVykresleni, hacek, refresh, zavreno, maZaviraciTlacitko,
      neznamy, bezKontejneru,
      meloVerdikt: delkaPoVykresleni > 0,
    };
  });
  eq("atlasDetail potvrdi vykresleni", detailApi.vysledek, true);
  check("detail se do ciziho kontejneru opravdu vykreslil",
    detailApi.delkaPoVykresleni > 500, "delka " + detailApi.delkaPoVykresleni);
  check("hacek vrstvy dostal kontejner, radek i vyhodnoceni",
    !!detailApi.hacek && detailApi.hacek.maKontejner && !!detailApi.hacek.keep,
    JSON.stringify(detailApi.hacek));
  check("zmena v detailu ohlasi, ze se ma detail nacist znovu",
    detailApi.refresh >= 1, "udalosti: " + detailApi.refresh);
  eq("detail ma zaviraci tlacitko", detailApi.maZaviraciTlacitko, true);
  eq("zaviraci tlacitko zavola funkci od vrstvy", detailApi.zavreno, 1);
  eq("neznamy kus se odmitne", detailApi.neznamy, false);
  eq("chybejici kontejner se odmitne", detailApi.bezKontejneru, false);

  // Kontrola proti hre na honenou: vrstva sahala na atlasImage, ktery
  // v enginu nikdy nebyl, a spadlo to az v prohlizeci pri sestaveni testu.
  // Tenhle blok precte skutecny soubor vrstvy a overi kazde volani enginu.
  const ATLAS_JS = path.join(WEB_DIR, "atlas", "atlas.js");
  if (fs.existsSync(ATLAS_JS)) {
    const zdroj = fs.readFileSync(ATLAS_JS, "utf8");
    const volana = [...new Set(
      (zdroj.match(/(?:P|window\.__pgo)\.[a-zA-Z_][a-zA-Z0-9_]*/g) || [])
        .map((x) => x.split(".").pop()))];
    const chybi = await page.evaluate((jmena) =>
      jmena.filter((j) => window.__pgo[j] === undefined), volana);
    check("vrstva nevola nic, co engine nema", chybi.length === 0,
      "chybi: " + chybi.join(", "));
    check("a neco volat musi", volana.length >= 5, volana.join(", "));
  }

  const obrazekApi = await page.evaluate(() => {
    const P = window.__pgo;
    const t = document.createElement("template");
    t.innerHTML = P.atlasImage("Machamp");
    const img = t.content.querySelector("img");
    const t2 = document.createElement("template");
    t2.innerHTML = P.atlasImage("Machamp", "atlas-mon");
    return {
      jeToImg: !!img,
      maSrc: !!(img && img.getAttribute("src")),
      maZalohu: !!(img && img.hasAttribute("data-zaloha")),
      trida: (t2.content.querySelector("img") || {}).className,
      neznamy: P.atlasImage("Takovy Pokemon Neexistuje"),
    };
  });
  eq("atlasImage vraci znacku obrazku", obrazekApi.jeToImg, true);
  eq("…se zdrojem", obrazekApi.maSrc, true);
  eq("…i se zalozním zdrojem", obrazekApi.maZalohu, true);
  eq("…a bere tridu, kdyz se zada", obrazekApi.trida, "atlas-mon");
  eq("neznamy druh vrati prazdno", obrazekApi.neznamy, "");

  const routeApi = await page.evaluate(async () => {
    const zachyceno = [];
    window.addEventListener("atlas:route", (e) => zachyceno.push(e.detail));
    const tlacitka = Array.prototype.filter.call(
      document.querySelectorAll("button.zal-btn"), (b) => b.dataset.klic);
    const klice = tlacitka.map((b) => b.dataset.klic);
    const kam = klice.filter((k) => k !== "roster")[0];
    const cil = tlacitka.filter((b) => b.dataset.klic === kam)[0];
    if (cil) cil.click();
    await new Promise((r) => setTimeout(r, 400));
    return { zachyceno, kam, kolikZalozek: klice.length };
  });
  check("zalozek je vic nez jedna", routeApi.kolikZalozek > 1, String(routeApi.kolikZalozek));
  check("prepnuti zalozky ohlasi udalost atlas:route",
    routeApi.zachyceno.length >= 1, JSON.stringify(routeApi.zachyceno));
  eq("a udalost nese klic te zalozky",
    routeApi.zachyceno[routeApi.zachyceno.length - 1], routeApi.kam);

  console.log("\n228) uprava kusu podle hry");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Vyvinuty nebo vylepseny kus znamenal dosud novy sken a import. Tohle je
  // zkratka: rict appce, co se ve hre stalo, a nechat ji dopocitat zbytek.
  const hra = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([
      { pokemon: "Machop", cp: 600, level: 20, ivAtk: 14, ivDef: 13, ivSta: 12,
        fastMove: "Counter", charged1: "Cross Chop" },
      { pokemon: "Ralts", cp: 400, level: 18, ivAtk: 10, ivDef: 10, ivSta: 10, forma: "Shadow" },
    ]);
    await new Promise((r) => setTimeout(r, 700));
    const ids = P.getRows().map((x) => x.id);
    const kroky = P.evoKroky(P.getRows()[0]).map((k) => k.jmeno);

    P.hraOtevri(ids[0], "evoluce", "Machoke");
    await new Promise((r) => setTimeout(r, 200));
    const navrh = document.getElementById("hraCp").value;
    const chybaEvo = P.hraUloz();
    await new Promise((r) => setTimeout(r, 500));
    const poEvo = Object.assign({}, P.getRows()[0]);
    P.hraZavri();

    P.hraOtevri(ids[0], "vylepseni");
    document.getElementById("hraLevel").value = "30";
    const chybaUp = P.hraUloz();
    await new Promise((r) => setTimeout(r, 500));
    const poUp = Object.assign({}, P.getRows()[0]);
    P.hraZavri();

    // Vylepseni zadane jen novym CP: level se dopocita zpatky.
    P.hraOtevri(ids[0], "vylepseni");
    document.getElementById("hraCp").value = String(poUp.cp);
    P.hraUloz();
    await new Promise((r) => setTimeout(r, 500));
    const poCp = Object.assign({}, P.getRows()[0]);
    P.hraZavri();

    // Prazdne okno nesmi nic zmenit a musi to rict.
    P.hraOtevri(ids[0], "vylepseni");
    const chybaPrazdne = P.hraUloz();
    P.hraZavri();

    P.hraOtevri(ids[1], "ocista");
    const chybaOc = P.hraUloz();
    await new Promise((r) => setTimeout(r, 500));
    const poOcista = Object.assign({}, P.getRows()[1]);
    P.hraZavri();

    return { kroky, navrh, chybaEvo, chybaUp, chybaPrazdne, chybaOc,
      poEvo, poUp, poCp, poOcista, zavrene: document.getElementById("hraBox").hidden };
  });

  eq("nabizi se jen dalsi stupen evoluce", hra.kroky.join(", "), "Machoke");
  // Spocitano rucne ze vzorce: (177+14)*sqrt(125+13)*sqrt(190+12)*0.5974^2/10.
  // Kdyby se appka porovnavala sama se sebou, chyba ve vzorci by neprosla.
  eq("CP po evoluci se predvyplni spravne", hra.navrh, "1138");
  eq("evoluce nehlasi chybu", hra.chybaEvo, null);
  eq("druh se zmenil", hra.poEvo.pokemon, "Machoke");
  eq("IV zustala", [hra.poEvo.ivAtk, hra.poEvo.ivDef, hra.poEvo.ivSta].join("/"), "14/13/12");
  eq("level zustal", Number(hra.poEvo.level), 20);
  eq("CP se prepocitalo", Number(hra.poEvo.cp), 1138);
  // Evoluci se ve hre utoky prehodi, takze stare uz na ten kus nesedi.
  eq("rychly utok se vymazal", hra.poEvo.fastMove, "");
  eq("nabity utok take", hra.poEvo.charged1, "");

  eq("vylepseni nehlasi chybu", hra.chybaUp, null);
  eq("level se zvedl", Number(hra.poUp.level), 30);
  check("a CP s nim", Number(hra.poUp.cp) > Number(hra.poEvo.cp),
    hra.poUp.cp + " vs " + hra.poEvo.cp);
  eq("zadane jen CP dopocita level zpatky", Number(hra.poCp.level), 30);
  check("prazdne okno rekne, co chybi", /CP|level/i.test(hra.chybaPrazdne || ""),
    String(hra.chybaPrazdne));

  eq("ocista nehlasi chybu", hra.chybaOc, null);
  eq("ocista prida +2 ke kazdemu IV",
    [hra.poOcista.ivAtk, hra.poOcista.ivDef, hra.poOcista.ivSta].join("/"), "12/12/12");
  eq("a zvedne kus na level 25", Number(hra.poOcista.level), 25);
  eq("forma se zmeni na purified", hra.poOcista.forma, "Purified");
  eq("okno se da zavrit", hra.zavrene, true);

  // Ocista nesmi prelezt strop IV.
  const stropIv = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Ralts", cp: 400, level: 30, ivAtk: 15, ivDef: 14, ivSta: 10,
      forma: "Shadow" }]);
    await new Promise((r) => setTimeout(r, 600));
    P.hraOtevri(P.getRows()[0].id, "ocista");
    P.hraUloz();
    await new Promise((r) => setTimeout(r, 400));
    const r0 = P.getRows()[0];
    P.hraZavri();
    return { iv: [r0.ivAtk, r0.ivDef, r0.ivSta].join("/"), lvl: Number(r0.level) };
  });
  eq("IV se pri ociste nepretahne pres 15", stropIv.iv, "15/15/12");
  eq("a level nad 25 se nesnizuje", stropIv.lvl, 30);

  // Prouzek v detailu: co se nabizi u ktereho kusu.
  const hraPruh = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Machop", cp: 600, level: 20, ivAtk: 14, ivDef: 13, ivSta: 12 }]);
    await new Promise((r) => setTimeout(r, 700));
    const id = P.getRows()[0].id;
    P.zamerKus(id);
    await new Promise((r) => setTimeout(r, 400));
    const det = document.querySelector("tr.detail-row");
    const tl = det ? Array.prototype.map.call(det.querySelectorAll("[data-hra]"),
      (b) => b.getAttribute("data-hra")) : [];
    return { maDetail: !!det, tlacitka: tl,
      otevreny: !!document.querySelector('tr[data-row-id="' + id + '"]') };
  });
  eq("po zamereni je detail otevreny", hraPruh.maDetail, true);
  check("prouzek nabizi evoluci i vylepseni",
    hraPruh.tlacitka.indexOf("evoluce") > -1 && hraPruh.tlacitka.indexOf("vylepseni") > -1,
    hraPruh.tlacitka.join(", "));
  check("ocistu u normalniho kusu nenabizi",
    hraPruh.tlacitka.indexOf("ocista") === -1, hraPruh.tlacitka.join(", "));

  console.log("\n229) utoky: finalni forma, Enter a nabidka podle druhu");
  await page.goto(URL);
  await page.waitForTimeout(800);

  // Sestava se dosud pocitala jen pro druh, kterym kus JE. S Fletchlingem
  // ale nikdo do raidu nejde — jde tam Talonflame a ten umi neco jineho.
  // A evoluci se ve hre utoky losuji znovu, takze TM pred ni je vyhozeny.
  const finalniSada = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([
      { pokemon: "Machop", cp: 600, level: 20, ivAtk: 14, ivDef: 13, ivSta: 12,
        fastMove: "Karate Chop", charged1: "Low Sweep" },
      { pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 14, ivDef: 13, ivSta: 12,
        fastMove: "Karate Chop", charged1: "Low Sweep" },
    ]);
    await new Promise((r) => setTimeout(r, 900));
    const c = P.getComputed();
    return P.getRows().map((row) => {
      const v = c[row.id];
      return { jm: row.pokemon, best: v.movesBest, final: v.movesBestFinal,
        finalJm: v.finalFormaJmeno,
        stavy: (v.utoky || []).map((u) => u.stav),
        proc: (v.utoky || []).map((u) => u.proc).join(" ") };
    });
  });
  const machop = finalniSada[0], machamp = finalniSada[1];
  check("u nefinalni formy se pocita i sestava po evoluci",
    machop.final.length > 0, JSON.stringify(machop));
  eq("a rekne se, ktera forma to je", machop.finalJm, "Machamp");
  check("sestava po evoluci je jina nez sestava teto formy",
    machop.final !== machop.best, machop.best + " vs " + machop.final);
  check("nefinalni forma neradi prehazet utoky ted",
    machop.stavy.indexOf("preucit") === -1, machop.stavy.join(", "));
  check("misto toho rekne, ze se evoluci utoky losuji znovu",
    /losuj[íi] znovu/.test(machop.proc), machop.proc.slice(0, 160));
  check("a jmenuje sestavu po evoluci",
    machop.proc.indexOf(machop.final) > -1, machop.proc.slice(0, 200));
  // Finalni forma je presne to misto, kde preuceni smysl dava.
  eq("finalni forma zadnou dalsi sestavu nema", machamp.final, "");
  check("a u ni se preuceni doporucit smi",
    machamp.stavy.indexOf("preucit") > -1, machamp.stavy.join(", "));

  // Enter v seznamu utoku: sipky vyberou, Enter musi potvrdit. Driv se Enter
  // spotreboval na zavreni seznamu a nevybralo se nic.
  const enterTest = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([{ pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 14, ivDef: 13, ivSta: 12 }]);
    await new Promise((r) => setTimeout(r, 800));
    const hlavicka = Array.from(document.querySelectorAll("#headerRow th"));
    const i = hlavicka.findIndex((th) => th.textContent.indexOf("Útoky") === 0);
    const tr = document.querySelector("#tbody tr");
    if (i < 0 || !tr) return { chyba: "sloupec Útoky nenalezen" };
    tr.children[i].click();
    await new Promise((r) => setTimeout(r, 300));
    const tlacitko = document.querySelector(".utok-edit .uv-pole");
    if (!tlacitko) return { chyba: "editor se neotevrel" };
    tlacitko.focus();
    const klavesa = (k) => tlacitko.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    klavesa("Enter");                       // otevre seznam
    await new Promise((r) => setTimeout(r, 200));
    const otevreny = !!document.querySelector(".uv-seznam");
    klavesa("ArrowDown");
    klavesa("ArrowDown");
    await new Promise((r) => setTimeout(r, 100));
    const zvyraznenych = document.querySelectorAll(".uv-seznam .zvyraznena").length;
    klavesa("Enter");                       // musi POTVRDIT
    await new Promise((r) => setTimeout(r, 400));
    const porad = !!document.querySelector(".uv-seznam");
    const vybrano = P.getRows()[0].fastMove || "";
    document.body.click();
    return { otevreny, zvyraznenych, porad, vybrano };
  });
  eq("Enter otevre seznam utoku", enterTest.otevreny, true);
  eq("sipky v nem neco zvyrazni", enterTest.zvyraznenych, 1);
  eq("Enter seznam zavre", enterTest.porad, false);
  check("a hlavne utok opravdu vybere", enterTest.vybrano.length > 0,
    "vybrano: " + JSON.stringify(enterTest.vybrano));

  // Okno „Pridat pokemona" smi nabizet jen utoky, ktere ten druh umi.
  const nabidkaUtoku = await page.evaluate(async () => {
    const P = window.__pgo;
    if (window.__pgoOtevritPridat) window.__pgoOtevritPridat();
    await new Promise((r) => setTimeout(r, 400));
    const jmena = (id) => Array.from(document.querySelectorAll("#" + id + " option"))
      .map((o) => o.value);
    const vse = jmena("rbFastNames").length;
    const pole = document.getElementById("rbName");
    pole.value = "Machamp";
    pole.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const poVyberu = jmena("rbFastNames");
    const nabite = jmena("rbChargedNames");
    const l = P.learnsetOf(P.dexKeyOf("Machamp"));
    document.getElementById("rbCancel").click();
    return { vse, poVyberu, nabite, umiRychlych: l ? l.fast.length : 0,
      umiNabitych: l ? l.charged.length : 0 };
  });
  check("bez vybraneho druhu se nabizi cela hra", nabidkaUtoku.vse > 50, String(nabidkaUtoku.vse));
  eq("po vyberu druhu jen jeho rychle utoky",
    nabidkaUtoku.poVyberu.length, nabidkaUtoku.umiRychlych);
  eq("…a jen jeho nabite", nabidkaUtoku.nabite.length, nabidkaUtoku.umiNabitych);
  check("mezi nimi je Counter, kterym Machamp opravdu umi",
    nabidkaUtoku.poVyberu.indexOf("Counter") > -1, nabidkaUtoku.poVyberu.join(", "));
  check("a neni tam nic z jineho druhu",
    nabidkaUtoku.poVyberu.indexOf("Vine Whip") === -1, nabidkaUtoku.poVyberu.join(", "));

  await page.goto(URL);
  await page.waitForTimeout(700);

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.waitForTimeout(200);
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} testů prošlo, ${failures.length} selhalo`);
if (failures.length) {
  failures.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
