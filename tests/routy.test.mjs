/**
 * Regresní test plánovače rout (Playwright, headless Chromium).
 *
 * Spuštění:  node tests/routy.test.mjs
 *
 * Plánovač je jediný soubor v sadě, který sahá na internet (mapový podklad
 * z CDN). Testy proto běží dvakrát:
 *   - s ZABLOKOVANOU sítí, kde se místo mapy kreslí schéma. Tahle část musí
 *     projít vždycky, i na počítači bez připojení;
 *   - s Leafletem, když se ho podaří stáhnout. Když ne, blok se přeskočí —
 *     jinak by celá sada padala na tom, že je zrovna vlak v tunelu.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "web-app");
const PORT = 8779;

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

let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; console.log("  ok   " + name); }
  else {
    failures.push(name + (detail ? " → " + detail : ""));
    console.log("  FAIL " + name + (detail ? " → " + detail : ""));
  }
}
function eq(name, actual, expected) {
  check(name, actual === expected, `čekáno "${expected}", dostal "${actual}"`);
}
/** Zabali souradnice jako polyline s presnosti na sest mist — tedy to, co
 *  posila smerovac. Je to tu schvalne napsane znovu a nezavisle na appce:
 *  test ma overit prevod, ne porovnat appku samu se sebou. */
function zakodujPolyline6(body) {
  let lat = 0, lon = 0, out = "";
  const kus = (n) => {
    let v = n < 0 ? ~(n << 1) : (n << 1);
    let s = "";
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63);
  };
  for (const [la, lo] of body) {
    const nl = Math.round(la * 1e6), nn = Math.round(lo * 1e6);
    out += kus(nl - lat) + kus(nn - lon);
    lat = nl; lon = nn;
  }
  return out;
}

function blizko(name, actual, expected, tolerance) {
  check(name, Math.abs(actual - expected) <= tolerance,
    `čekáno ${expected} ± ${tolerance}, dostal ${actual}`);
}

/* Tři stopy na jedné poledníkové přímce a jedna routa mezi krajními. Rovná
   čára je schválně: každý bod, který se do trasy vloží, ji prokazatelně
   prodlouží, takže se pozná, že se počítá s nakresleným tvarem. */
const VZOREK = {
  stopy: [
    { id: "sA", nazev: "Alfa", lat: 49.2, lon: 16.6, gym: false },
    { id: "sB", nazev: "Beta", lat: 49.21, lon: 16.6, gym: false },
    { id: "sC", nazev: "Cesta", lat: 49.22, lon: 16.6, gym: true },
  ],
  routy: [
    { id: "rAB", nazev: "Kolem rybníka", od: "sA", do: "sB",
      km: null, min: null, hotovo: false },
  ],
};

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(WEB_DIR, rel === "/" ? "routy.html" : rel);
  if (!file.startsWith(WEB_DIR) || !fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});

const chromium = loadChromium();
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();
const URL = `http://localhost:${PORT}/routy.html`;

// Nenačtený podklad NENÍ chyba plánovače: soubor s tím počítá a kreslí
// schéma. Bez tohohle filtru by testy padaly na odpojené síti.
const SIT_JE_JEDNO = /cdnjs|openstreetmap|opentopomap|arcgisonline|ERR_|Failed to load resource/i;
function hlidejChyby(page, kam) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (SIT_JE_JEDNO.test(m.text())) return;
    kam.push(m.text());
  });
  page.on("pageerror", (e) => kam.push(String(e)));
}

try {
  /* ==================================================================
     1) BEZ SÍTĚ — schéma místo mapy
     ================================================================== */
  console.log("\n1) plánovač bez internetu");
  const offline = await browser.newContext();
  // Glob s hvezdickou pred domenou by cdnjs.cloudflare.com netrefil (chybi
  // subdomena), takze radeji vzor: nic z internetu se do teto zalozky
  // nedostane a Leaflet se nenacte.
  await offline.route(/cdnjs|openstreetmap|opentopomap|arcgisonline/, (r) => r.abort());
  const chybyOffline = [];
  const p1 = await offline.newPage();
  hlidejChyby(p1, chybyOffline);
  await p1.goto(URL);
  await p1.waitForFunction(() => !!window.__routy);
  await p1.evaluate((d) => window.__routy.setData(JSON.parse(JSON.stringify(d))), VZOREK);

  eq("bez Leafletu se kreslí schéma", await p1.evaluate(() => !!document.getElementById("schema")), true);
  eq("mapa se nepodařila a to je v pořádku", await p1.evaluate(() => window.__routy.mapa() === null), true);
  eq("body ve schématu odpovídají stopám",
    await p1.evaluate(() => document.querySelectorAll("[data-stopa]").length), 3);

  /* ---------------------------------------------------------- délka */
  console.log("\n2) délka routy");
  const vzdusnaAB = await p1.evaluate(() =>
    window.__routy.vzdusne({ lat: 49.2, lon: 16.6 }, { lat: 49.21, lon: 16.6 }));
  const bezTvaru = await p1.evaluate(() => window.__routy.delkaRouty(window.__routy.data().routy[0]));
  blizko("bez tvaru se počítá vzdušná čára s přirážkou", bezTvaru, vzdusnaAB * 1.35, 0.001);

  await p1.evaluate(() => {
    const r = window.__routy.data().routy[0];
    window.__routy.vlozBod(r, 49.205, 16.61);
  });
  const sTvarem = await p1.evaluate(() => window.__routy.delkaRouty(window.__routy.data().routy[0]));
  check("nakreslený tvar routu prodlouží", sTvarem > bezTvaru, `${sTvarem} vs ${bezTvaru}`);
  const soucet = await p1.evaluate(() => {
    const P = window.__routy;
    const b = P.bodyRouty(P.data().routy[0]);
    let s = 0;
    for (let i = 1; i < b.length; i++) s += P.vzdusne(b[i - 1], b[i]);
    return s;
  });
  blizko("nakreslený tvar se přirážkou už nenásobí", sTvarem, soucet, 0.0001);

  await p1.evaluate(() => {
    const r = window.__routy.data().routy[0];
    r.km = 3.3;
  });
  eq("ručně zadaná délka přebíjí všechno",
    await p1.evaluate(() => window.__routy.delkaRouty(window.__routy.data().routy[0])), 3.3);
  await p1.evaluate(() => { window.__routy.data().routy[0].km = null; });

  /* ------------------------------------------------- vkládání do úseku */
  console.log("\n3) bod se vkládá do nejbližšího úseku");
  const poradi = await p1.evaluate(() => {
    const P = window.__routy;
    const r = P.data().routy[0];
    r.body = [{ lat: 49.208, lon: 16.61 }];
    // Tenhle bod je blízko PRVNÍHO úseku (Alfa → stávající bod), takže musí
    // skončit před ním, ne na konci pole.
    P.vlozBod(r, 49.2015, 16.603);
    return r.body.map((b) => b.lat);
  });
  eq("bod se zařadil doprostřed, ne na konec", poradi[0], 49.2015);
  eq("původní bod zůstal za ním", poradi[1], 49.208);

  const naKonec = await p1.evaluate(() => {
    const P = window.__routy;
    const r = P.data().routy[0];
    P.vlozBod(r, 49.2098, 16.603);
    return r.body.map((b) => b.lat);
  });
  eq("bod u konce se zařadil na konec", naKonec[naKonec.length - 1], 49.2098);
  eq("v trase jsou tři body", naKonec.length, 3);

  /* ------------------------------------------------------- editor stopy */
  console.log("\n4) editace stopy pravým tlačítkem");
  await p1.evaluate((d) => window.__routy.setData(JSON.parse(JSON.stringify(d))), VZOREK);
  eq("editor je zavřený", await p1.evaluate(() => document.getElementById("editor").hidden), true);
  await p1.click('[data-stopa="sB"]', { button: "right" });
  eq("pravé tlačítko otevřelo editor",
    await p1.evaluate(() => document.getElementById("editor").hidden), false);
  eq("editor drží tu stopu, na kterou se kliklo",
    await p1.evaluate(() => window.__routy.editovana()), "sB");
  eq("editor nabízí jméno k přepsání",
    await p1.evaluate(() => document.getElementById("edNazev").value), "Beta");

  await p1.fill("#edNazev", "U kostela");
  eq("přejmenování se propsalo do dat",
    await p1.evaluate(() => window.__routy.data().stopy[1].nazev), "U kostela");
  eq("přejmenování se propsalo i do tabulky stop",
    await p1.evaluate(() => document.querySelectorAll("#tabStopy input[data-pole=nazev]")[1].value),
    "U kostela");
  eq("přejmenování se propsalo do nabídky začátku",
    await p1.evaluate(() => Array.from(document.getElementById("plOd").options)
      .some((o) => o.textContent === "U kostela")), true);
  eq("mapa se kvůli editoru nepřepnula jinam",
    await p1.evaluate(() => document.getElementById("pMapa").classList.contains("aktivni")), true);

  await p1.check("#edGym");
  eq("gym se dá zaškrtnout rovnou v mapě",
    await p1.evaluate(() => window.__routy.data().stopy[1].gym), true);
  await p1.click("#edOd");
  eq("tlačítko Začátek nastaví začátek plánu",
    await p1.evaluate(() => document.getElementById("plOd").value), "sB");

  await p1.keyboard.press("Escape");
  eq("Escape editor zavře", await p1.evaluate(() => document.getElementById("editor").hidden), true);

  await p1.click('[data-stopa="sC"]', { button: "right" });
  await p1.click("#edSmazat");
  eq("smazání z editoru ubere stopu",
    await p1.evaluate(() => window.__routy.data().stopy.length), 2);
  eq("po smazání je editor zavřený",
    await p1.evaluate(() => document.getElementById("editor").hidden), true);

  /* -------------------------------------------------- kreslení trasy v UI */
  console.log("\n5) kreslení trasy");
  await p1.evaluate((d) => window.__routy.setData(JSON.parse(JSON.stringify(d))), VZOREK);
  eq("lišta kreslení je schovaná",
    await p1.evaluate(() => document.getElementById("upravaLista").hidden), true);
  // Vlastnost hidden je true i tehdy, když ji CSS přebije display:flex —
  // musí se koukat na to, co se opravdu vykreslí.
  eq("a není ji vidět",
    await p1.evaluate(() => getComputedStyle(document.getElementById("upravaLista")).display),
    "none");
  await p1.click('.zal[data-panel="pRouty"]');
  await p1.click("#tabRouty [data-tvar]");
  eq("tlačítko Trasa zapne kreslení",
    await p1.evaluate(() => window.__routy.upravovana()), "rAB");
  eq("kreslení přepne zpátky na mapu",
    await p1.evaluate(() => document.getElementById("pMapa").classList.contains("aktivni")), true);
  eq("lišta kreslení svítí",
    await p1.evaluate(() => document.getElementById("upravaLista").hidden), false);
  check("a je opravdu vidět",
    await p1.evaluate(() => getComputedStyle(document.getElementById("upravaLista")).display !== "none"));

  // Klik do schématu přidá bod trasy, ne novou stopu.
  const predKlikem = await p1.evaluate(() => window.__routy.data().stopy.length);
  await p1.click("#schema", { position: { x: 300, y: 300 } });
  eq("klik při kreslení přidal bod trasy",
    await p1.evaluate(() => (window.__routy.data().routy[0].body || []).length), 1);
  eq("klik při kreslení nezaložil stopu",
    await p1.evaluate(() => window.__routy.data().stopy.length), predKlikem);
  check("lišta hlásí počet bodů",
    (await p1.textContent("#upravaLista")).includes("1 bod"),
    await p1.textContent("#upravaLista"));

  await p1.click("[data-bod]", { button: "right" });
  eq("pravé tlačítko bod trasy smaže",
    await p1.evaluate(() => (window.__routy.data().routy[0].body || []).length), 0);

  await p1.click("#schema", { position: { x: 300, y: 300 } });
  await p1.click("#upravaVymazat");
  eq("Vymazat tvar smaže celou trasu",
    await p1.evaluate(() => window.__routy.data().routy[0].body.length), 0);
  await p1.click("#upravaHotovo");
  eq("Hotovo kreslení ukončí", await p1.evaluate(() => window.__routy.upravovana()), null);
  eq("po ukončení klik do schématu zase nic nepřidává",
    await p1.evaluate(() => (window.__routy.data().routy[0].body || []).length), 0);

  /* ------------------------------------------------------ cesta po silnici */
  console.log("\n5b) cesta po silnici");
  await p1.evaluate((d) => window.__routy.setData(JSON.parse(JSON.stringify(d))), VZOREK);

  // Nova routa nesmi mit stejny zacatek i konec: kreslila by se jako smycka
  // a spojnice od posledniho bodu zpatky na prvni vypada jako chyba.
  await p1.click('.zal[data-panel="pRouty"]');
  await p1.click("#pridatRoutu");
  const novaRouta = await p1.evaluate(() => {
    const r = window.__routy.data().routy.slice(-1)[0];
    return { od: r.od, doo: r.do, stejne: r.od === r.do };
  });
  eq("nova routa nema stejny zacatek i konec", novaRouta.stejne, false);

  // Ulozena cesta po silnici patri k urcitym bodum. Kdyz se body zmeni,
  // nesmi se stara cesta kreslit dal.
  const podpisy = await p1.evaluate(() => {
    const P = window.__routy;
    const r = P.data().routy[0];
    r.body = [{ lat: 49.205, lon: 16.61 }];
    r.tvar = [{ lat: 49.2, lon: 16.6 }, { lat: 49.205, lon: 16.605 }, { lat: 49.21, lon: 16.6 }];
    r.tvarZ = P.podpisTrasy(r);
    const cerstva = P.maCestuPoSilnici(r);
    const delkaSCestou = P.delkaRouty(r);
    const kresliSe = P.tvarRouty(r).length;
    // posunuti bodu = jine zadani, ulozena cesta uz k nemu nepatri
    r.body[0].lat = 49.206;
    return {
      cerstva, delkaSCestou, kresliSe,
      poZmene: P.maCestuPoSilnici(r),
      kresliSePoZmene: P.tvarRouty(r).length,
    };
  });
  eq("cesta po silnici plati, dokud sedi otisk zadani", podpisy.cerstva, true);
  eq("…a kresli se prave ona", podpisy.kresliSe, 3);
  eq("po posunu bodu uz neplati", podpisy.poZmene, false);
  eq("…a kresli se zase naklikane body", podpisy.kresliSePoZmene, 3);

  // Delka po silnici se necha tak, jak je: neni to vzdusna cara, takze se
  // uz nenasobi klikatosti.
  const delkaPoSilnici = await p1.evaluate(() => {
    const P = window.__routy;
    const r = P.data().routy[0];
    r.body = [];
    r.tvar = [{ lat: 49.2, lon: 16.6 }, { lat: 49.2, lon: 16.61 }, { lat: 49.21, lon: 16.61 }];
    r.tvarZ = P.podpisTrasy(r);
    let soucet = 0;
    for (let i = 1; i < r.tvar.length; i++) soucet += P.vzdusne(r.tvar[i - 1], r.tvar[i]);
    return { delka: P.delkaRouty(r), soucet };
  });
  blizko("delka se bere po silnici, bez prirazky", delkaPoSilnici.delka,
    delkaPoSilnici.soucet, 0.0001);

  // Rozbaleni tvaru od smerovace. Zakodovano nezavisle primo v testu, aby
  // se overil prevod, ne jen to, ze neco vrati.
  const polylineTest = await p1.evaluate((zakodovano) =>
    window.__routy.rozbalPolyline(zakodovano).map((b) => [+b.lat.toFixed(6), +b.lon.toFixed(6)]),
  zakodujPolyline6([[49.2, 16.6], [49.205, 16.61], [49.21, 16.6]]));
  check("tvar od smerovace se rozbali zpatky na tytez souradnice",
    JSON.stringify(polylineTest) === JSON.stringify([[49.2, 16.6], [49.205, 16.61], [49.21, 16.6]]),
    JSON.stringify(polylineTest));

  // Lista kresleni musi umet vybrat konec. Bez toho se konec dal nastavit
  // jen v tabulce, kam ten, kdo kresli na mape, nechodi.
  await p1.evaluate((d) => window.__routy.setData(JSON.parse(JSON.stringify(d))), VZOREK);
  await p1.evaluate(() => window.__routy.zacniUpravu("rAB"));
  await p1.waitForTimeout(200);
  eq("lista kresleni nabizi zacatek", await p1.evaluate(() => !!document.getElementById("upravaOd")), true);
  eq("…i konec", await p1.evaluate(() => !!document.getElementById("upravaDo")), true);
  await p1.selectOption("#upravaDo", "sC");
  await p1.waitForTimeout(200);
  eq("zmena konce v liste se propise do routy",
    await p1.evaluate(() => window.__routy.data().routy[0].do), "sC");

  const smycka = await p1.evaluate(async () => {
    const P = window.__routy;
    const r = P.data().routy[0];
    r.do = r.od;
    P.zacniUpravu("rAB");
    await new Promise((x) => setTimeout(x, 200));
    return (document.getElementById("upravaStav") || {}).textContent || "";
  });
  check("na routu se stejnym zacatkem i koncem lista upozorni",
    /smy[čc]ku|tat[áa][žz] stopa/i.test(smycka), smycka);
  await p1.evaluate(() => window.__routy.konecUpravy());

  /* --------------------------------------------------------------- metry */
  console.log("\n5c) delky v metrech");
  await p1.evaluate((d) => window.__routy.setData(JSON.parse(JSON.stringify(d))), VZOREK);
  await p1.click('.zal[data-panel="pRouty"]');
  const jednotky = await p1.evaluate(() => {
    const P = window.__routy;
    const hlavicka = document.querySelector("#tabRouty th:nth-child(4)").textContent;
    const pole = document.querySelector('#tabRouty input[data-pole="metry"]');
    return { hlavicka, maPole: !!pole, zastupny: pole ? pole.placeholder : null,
      delkaKm: P.delkaRouty(P.data().routy[0]) };
  });
  check("sloupec delky je v metrech", /metr/i.test(jednotky.hlavicka), jednotky.hlavicka);
  eq("a policko take", jednotky.maPole, true);
  eq("zastupna hodnota je cele metry, ne kilometry",
    jednotky.zastupny, String(Math.round(jednotky.delkaKm * 1000)));

  // Zadava se v metrech, uklada v kilometrech: starsi zalohy maji km a nemaji
  // se proc prepocitavat.
  await p1.fill('#tabRouty input[data-pole="metry"]', "1500");
  await p1.waitForTimeout(200);
  eq("zadane metry se ulozi jako kilometry",
    await p1.evaluate(() => window.__routy.data().routy[0].km), 1.5);
  eq("a delka routy s tim pocita",
    await p1.evaluate(() => window.__routy.delkaRouty(window.__routy.data().routy[0])), 1.5);

  const planMetry = await p1.evaluate(async () => {
    document.getElementById("plOd").value = "sA";
    document.getElementById("plDo").value = "sB";
    document.getElementById("plSpocitat").click();
    await new Promise((r) => setTimeout(r, 400));
    return document.getElementById("plVysledek").textContent;
  });
  check("plan ukazuje metry, ne kilometry",
    / m /.test(planMetry) && !/\d km/.test(planMetry), planMetry.slice(0, 200));

  /* ------------------------------------------------- ktere routy se kresli */
  console.log("\n5d) viditelnost rout");
  await p1.evaluate((d) => window.__routy.setData(JSON.parse(JSON.stringify(d))), VZOREK);
  await p1.click('.zal[data-panel="pMapa"]');
  const viditelnost = await p1.evaluate(async () => {
    const P = window.__routy;
    const r = P.data().routy[0];
    const sel = document.getElementById("zobrazRouty");
    const kolik = () => document.querySelectorAll("[data-routa]").length;
    sel.value = "vse"; sel.dispatchEvent(new Event("change"));
    await new Promise((x) => setTimeout(x, 150));
    const vse = kolik();
    sel.value = "nic"; sel.dispatchEvent(new Event("change"));
    await new Promise((x) => setTimeout(x, 150));
    const nic = kolik();
    sel.value = "vybranou"; sel.dispatchEvent(new Event("change"));
    await new Promise((x) => setTimeout(x, 150));
    const bezVyberu = kolik();
    const pamet = localStorage.getItem("pgo_routy_zobraz");
    // pri kresleni musi byt videt i pri „bez rout" — jinak by se kreslilo naslepo
    sel.value = "nic"; sel.dispatchEvent(new Event("change"));
    P.zacniUpravu(r.id);
    await new Promise((x) => setTimeout(x, 200));
    const priKresleni = kolik();
    P.konecUpravy();
    sel.value = "vse"; sel.dispatchEvent(new Event("change"));
    return { vse, nic, bezVyberu, priKresleni, pamet };
  });
  eq("vsechny routy se kresli", viditelnost.vse, 1);
  eq("bez rout se nekresli zadna", viditelnost.nic, 0);
  eq("jen vybranou bez vyberu take nekresli nic", viditelnost.bezVyberu, 0);
  eq("kreslena routa je videt i pri vypnutych routach", viditelnost.priKresleni, 1);
  eq("volba se pamatuje", viditelnost.pamet, "vybranou");

  /* ------------------------------------------------------- okno nove routy */
  console.log("\n5e) okno na zalozeni routy");
  await p1.evaluate((d) => window.__routy.setData(JSON.parse(JSON.stringify(d))), VZOREK);
  eq("okno je zavrene",
    await p1.evaluate(() => document.getElementById("oknoRouty").hidden), true);

  // Vyber zacatku a cile na mape musi nabidnout zalozeni routy.
  await p1.click('[data-stopa="sA"]');
  await p1.click('[data-stopa="sB"]');
  eq("po vyberu obou koncu se nabidne zalozeni routy",
    await p1.evaluate(() => !!document.getElementById("zalozitRoutu")), true);
  await p1.click("#zalozitRoutu");
  await p1.waitForTimeout(1200);
  const okno = await p1.evaluate(() => ({
    otevrene: !document.getElementById("oknoRouty").hidden,
    od: document.getElementById("orOd").value,
    doo: document.getElementById("orDo").value,
    metry: document.getElementById("orMetry").value,
    stav: document.getElementById("orStav").textContent,
  }));
  eq("okno se otevrelo", okno.otevrene, true);
  eq("zacatek je predvyplneny z mapy", okno.od, "sA");
  eq("cil taky", okno.doo, "sB");
  check("metry jsou predvyplnene", okno.metry !== "" && +okno.metry > 0, okno.metry);
  check("a rekne se, odkud to cislo je", okno.stav.length > 10, okno.stav);

  const poZruseni = await p1.evaluate(async () => {
    const pred = window.__routy.data().routy.length;
    document.getElementById("orZrusit").click();
    await new Promise((r) => setTimeout(r, 150));
    return { pred, po: window.__routy.data().routy.length,
      zavrene: document.getElementById("oknoRouty").hidden };
  });
  eq("zruseni zadnou routu nezalozi", poZruseni.po, poZruseni.pred);
  eq("a okno zavre", poZruseni.zavrene, true);

  await p1.click('[data-stopa="sA"]');
  await p1.click('[data-stopa="sC"]');
  await p1.click("#zalozitRoutu");
  await p1.waitForTimeout(1200);
  await p1.fill("#orNazev", "Testovaci okruh");
  await p1.fill("#orMetry", "860");
  await p1.fill("#orMinut", "12");
  await p1.click("#orUlozit");
  await p1.waitForTimeout(300);
  const ulozena = await p1.evaluate(() => {
    const P = window.__routy;
    const r = P.data().routy.slice(-1)[0];
    return { nazev: r.nazev, od: r.od, doo: r.do, km: r.km, min: r.min,
      pocet: P.data().routy.length,
      zavrene: document.getElementById("oknoRouty").hidden };
  });
  eq("ulozeni zalozi routu", ulozena.pocet, 2);
  eq("s nazvem z okna", ulozena.nazev, "Testovaci okruh");
  eq("se spravnym zacatkem", ulozena.od, "sA");
  eq("a cilem", ulozena.doo, "sC");
  eq("metry z okna se ulozi jako kilometry", ulozena.km, 0.86);
  eq("minuty se ulozi tak, jak jsou", ulozena.min, 12);
  eq("a okno se zavre", ulozena.zavrene, true);

  /* ------------------------------------------------------- podklady mapy */
  console.log("\n6) přepínač podkladu");
  const podklady = await p1.evaluate(() => Object.keys(window.__routy.podklady));
  check("na výběr je víc podkladů", podklady.length >= 4, podklady.join(", "));
  eq("nabídka v liště je vyplněná",
    await p1.evaluate(() => document.getElementById("podklad").options.length), podklady.length);
  check("mezi podklady je satelit", podklady.indexOf("satelit") !== -1, podklady.join(", "));
  await p1.selectOption("#podklad", "satelit");
  eq("volba podkladu se pamatuje",
    await p1.evaluate(() => localStorage.getItem("pgo_routy_podklad")), "satelit");
  await p1.reload();
  await p1.waitForFunction(() => !!window.__routy);
  eq("po načtení je vybraný ten podklad, co si člověk zvolil",
    await p1.evaluate(() => document.getElementById("podklad").value), "satelit");
  await p1.evaluate(() => window.__routy.nastavPodklad("prehledna"));

  /* ------------------------------------------------- plán a záloha s tvarem */
  console.log("\n7) plán a záloha počítají s tvarem");
  await p1.evaluate((d) => {
    const kopie = JSON.parse(JSON.stringify(d));
    kopie.routy[0].body = [{ lat: 49.205, lon: 16.62 }];
    window.__routy.setData(kopie);
  }, VZOREK);
  const plan = await p1.evaluate(() =>
    window.__routy.najdiTrasu("sA", "sB", 240, 4.5, false));
  eq("plán našel jednu routu", plan.pocet, 1);
  const delkaVPlanu = plan.kroky.reduce((s, k) => s + (k.km || 0), 0);
  const delkaRouty = await p1.evaluate(() =>
    window.__routy.delkaRouty(window.__routy.data().routy[0]));
  blizko("plán počítá s nakreslenou délkou, ne se vzdušnou", delkaVPlanu, delkaRouty, 0.01);

  const zaloha = await p1.evaluate(() => JSON.stringify(window.__routy.data()));
  check("tvar trasy je v záloze", JSON.parse(zaloha).routy[0].body.length === 1, zaloha.slice(0, 200));

  /* --------------------------------------------- stará záloha bez tvaru */
  console.log("\n8) starší záloha se načte beze změny");
  await p1.evaluate(() => {
    window.__routy.setData({
      stopy: [{ id: "x1", nazev: "Stará", lat: 49.2, lon: 16.6, gym: false },
        { id: "x2", nazev: "Druhá", lat: 49.21, lon: 16.6, gym: false }],
      routy: [{ id: "xr", nazev: "Bez tvaru", od: "x1", do: "x2",
        km: null, min: null, hotovo: false }],
    });
  });
  eq("routa bez pole body nespadne",
    await p1.evaluate(() => (window.__routy.bodyRouty(window.__routy.data().routy[0]) || []).length), 2);
  blizko("a počítá se jí pořád vzdušná čára s přirážkou",
    await p1.evaluate(() => window.__routy.delkaRouty(window.__routy.data().routy[0])),
    vzdusnaAB * 1.35, 0.001);

  /* ------------------------------------------------------------ 500 px */
  console.log("\n9) úzké okno");
  await p1.setViewportSize({ width: 500, height: 900 });
  await p1.evaluate((d) => window.__routy.setData(JSON.parse(JSON.stringify(d))), VZOREK);
  const preteka = await p1.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("v 500 px nic nepřetéká do stran", preteka <= 1, "přetok " + preteka + " px");
  await p1.click('[data-stopa="sB"]', { button: "right" });
  const vejde = await p1.evaluate(() => {
    const e = document.getElementById("editor").getBoundingClientRect();
    const m = document.querySelector(".mapa-plocha").getBoundingClientRect();
    return e.left >= m.left - 1 && e.right <= m.right + 1;
  });
  check("editor se vejde do plochy mapy i v 500 px", vejde);
  // Lista kresleni je siroka: dve rozbalovatka a tri tlacitka. Musi se zalomit,
  // ne roztahnout stranku.
  await p1.keyboard.press("Escape");
  await p1.evaluate(() => window.__routy.zacniUpravu("rAB"));
  await p1.waitForTimeout(300);
  const pretekaLista = await p1.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("ani lista kresleni v 500 px nepreteka", pretekaLista <= 1, "pretok " + pretekaLista + " px");
  await p1.evaluate(() => window.__routy.konecUpravy());
  await p1.evaluate(() => window.__routy.otevriOknoRouty("sA", "sB"));
  await p1.waitForTimeout(300);
  const oknoVUzkem = await p1.evaluate(() => {
    const o = document.querySelector(".okno").getBoundingClientRect();
    return { pretok: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sirka: Math.round(o.width), vejdeSe: o.left >= -1 && o.right <= innerWidth + 1 };
  });
  check("okno nove routy se v 500 px vejde", oknoVUzkem.vejdeSe, "sirka " + oknoVUzkem.sirka);
  check("a nepreteka stranku", oknoVUzkem.pretok <= 1, "pretok " + oknoVUzkem.pretok + " px");
  await p1.evaluate(() => window.__routy.zavriOknoRouty());
  await p1.setViewportSize({ width: 1280, height: 900 });

  eq("bez sítě nespadla žádná chyba", chybyOffline.join(" | "), "");
  await offline.close();

  /* ==================================================================
     10) S LEAFLETEM — jen když se ho podaří stáhnout
     ================================================================== */
  console.log("\n10) skutečná mapa (vyžaduje síť)");
  const online = await browser.newContext();
  const chybyOnline = [];
  const p2 = await online.newPage();
  hlidejChyby(p2, chybyOnline);
  let mapaJede = false;
  try {
    await p2.goto(URL, { timeout: 15000 });
    await p2.waitForFunction(() => !!window.__routy, { timeout: 15000 });
    await p2.waitForFunction(() => window.__routy.mapa() !== null, { timeout: 8000 });
    mapaJede = true;
  } catch (e) { mapaJede = false; }

  if (!mapaJede) {
    console.log("  -- přeskočeno: Leaflet se nestáhl (bez sítě je to v pořádku)");
  } else {
    await p2.evaluate((d) => window.__routy.setData(JSON.parse(JSON.stringify(d))), VZOREK);
    eq("mapa naskočila", await p2.evaluate(() => window.__routy.mapa() !== null), true);
    eq("routa se kreslí jako lomená čára",
      await p2.evaluate(() => document.querySelectorAll("#mapa path").length > 0), true);

    // Pravé tlačítko na bod v mapě otevře stejný editor jako ve schématu.
    // Bez animace a s chvilkou na dokresleni: dokud Leaflet posouva mapu,
    // hlasi latLngToContainerPoint pixely rozjeteho stavu a klik mine.
    await p2.evaluate(() => window.__routy.mapa().setView([49.21, 16.6], 15, { animate: false }));
    await p2.waitForTimeout(300);
    const bod = await p2.evaluate(() => {
      const m = window.__routy.mapa();
      const p = m.latLngToContainerPoint([49.21, 16.6]);
      const r = document.getElementById("mapa").getBoundingClientRect();
      return { x: r.left + p.x, y: r.top + p.y };
    });
    await p2.mouse.click(bod.x, bod.y, { button: "right" });
    eq("pravé tlačítko na značku otevře editor",
      await p2.evaluate(() => window.__routy.editovana()), "sB");
    await p2.keyboard.press("Escape");

    // Klik do prázdna při kreslení přidá bod trasy.
    await p2.evaluate(() => window.__routy.zacniUpravu("rAB"));
    await p2.mouse.click(bod.x + 60, bod.y + 40);
    eq("klik do mapy při kreslení přidal bod",
      await p2.evaluate(() => (window.__routy.data().routy[0].body || []).length), 1);
    eq("body trasy mají vlastní značky",
      await p2.evaluate(() => document.querySelectorAll(".bod-trasy").length), 1);
    await p2.evaluate(() => window.__routy.konecUpravy());

    // Pravé tlačítko do prázdna založí stopu i s otevřeným editorem.
    const stopPred = await p2.evaluate(() => window.__routy.data().stopy.length);
    await p2.mouse.click(bod.x - 80, bod.y - 60, { button: "right" });
    eq("pravé tlačítko do prázdna založí stopu",
      await p2.evaluate(() => window.__routy.data().stopy.length), stopPred + 1);
    eq("a rovnou ji otevře k pojmenování",
      await p2.evaluate(() => document.getElementById("editor").hidden), false);
    await p2.fill("#edNazev", "Nová u lavičky");
    eq("jméno se uloží bez odchodu z mapy",
      await p2.evaluate(() => window.__routy.data().stopy.slice(-1)[0].nazev), "Nová u lavičky");
    await p2.keyboard.press("Escape");

    // Skutecny smerovac. Bezi jen online a dve stopy jsou schvalne ctyri sta
    // metru od sebe pres zastavenou ulici — kdyby se vratila primka, poznalo
    // by se to podle poctu bodu.
    const cesta = await p2.evaluate(async () => {
      const P = window.__routy;
      P.setData({
        stopy: [
          { id: "bA", nazev: "Zilkova", lat: 49.2374, lon: 16.5285, gym: false },
          { id: "bB", nazev: "Kubova", lat: 49.2412, lon: 16.5361, gym: false },
        ],
        routy: [{ id: "bR", nazev: "Po silnici", od: "bA", do: "bB",
          km: null, min: null, hotovo: false, body: [] }],
      });
      const r = P.data().routy[0];
      const vzdusna = P.vzdusne({ lat: 49.2374, lon: 16.5285 }, { lat: 49.2412, lon: 16.5361 });
      return await new Promise((hotovo) => {
        const dost = setTimeout(() => hotovo({ chyba: "timeout" }), 20000);
        P.najdiCestu(r, (chyba, km) => {
          clearTimeout(dost);
          hotovo({
            chyba, km, vzdusna,
            bodu: (r.tvar || []).length,
            cerstva: P.maCestuPoSilnici(r),
            delka: P.delkaRouty(r),
          });
        });
      });
    });
    if (cesta.chyba) {
      console.log("  -- smerovac neodpovedel (" + cesta.chyba + "), blok preskocen");
    } else {
      eq("smerovac vratil cestu", cesta.chyba, null);
      check("cesta vede po ulicich, ne primo", cesta.bodu > 10, "bodu: " + cesta.bodu);
      eq("a plati pro zadane body", cesta.cerstva, true);
      check("delka je delsi nez vzdusna cara",
        cesta.delka > cesta.vzdusna, cesta.delka + " vs " + cesta.vzdusna);
      check("a zaroven ne nesmyslne dlouha",
        cesta.delka < cesta.vzdusna * 3, cesta.delka + " vs " + cesta.vzdusna);
      check("delka z appky sedi s tim, co hlasi smerovac",
        Math.abs(cesta.delka - cesta.km) < 0.05, cesta.delka + " vs " + cesta.km);
    }

    const vrstvaUrl = () => p2.evaluate(() => {
      let u = null;
      window.__routy.mapa().eachLayer((l) => { if (l._url) u = l._url; });
      return u;
    });
    const pred = await vrstvaUrl();
    await p2.selectOption("#podklad", "satelit");
    const po = await vrstvaUrl();
    check("přepnutí podkladu vymění dlaždice", pred !== po && /arcgis/i.test(po || ""),
      pred + " -> " + po);
    eq("v mapě zůstala jen jedna vrstva podkladu",
      await p2.evaluate(() => {
        let n = 0;
        window.__routy.mapa().eachLayer((l) => { if (l._url) n++; });
        return n;
      }), 1);

    /* Každý podklad musí jet bez registrace. CARTO se sem hodilo nejvíc,
       jenže začalo přes dlaždice malovat „API KEY REQUIRED" — a to je
       obrázek jako každý jiný, takže se to nepozná jinak než okem. Seznam
       hostitelů, kteří klíč chtějí, je proto natvrdo. */
    const NUTNY_KLIC = /cartocdn|mapbox|thunderforest|stadiamaps|maptiler|tomtom|here\.com|google/i;
    const sKlicem = await p2.evaluate((vzor) => Object.keys(window.__routy.podklady)
      .filter((k) => new RegExp(vzor, "i").test(window.__routy.podklady[k].url)),
    NUTNY_KLIC.source);
    eq("žádný podklad nepotřebuje registraci", sKlicem.join(", "), "");

    const mrtve = await p2.evaluate(() => {
      const P = window.__routy.podklady;
      // Jedna dlaždice Brna v přiblížení 16. Načte-li se, hostitel žije.
      return Promise.all(Object.keys(P).map((k) => new Promise((res) => {
        const u = P[k].url
          .replace("{s}", (P[k].subdomains || "abc")[0])
          .replace("{z}", 16).replace("{x}", 35777).replace("{y}", 22447)
          .replace("{r}", "");
        const img = new Image();
        const t = setTimeout(() => res(k + ": timeout"), 12000);
        img.onload = () => { clearTimeout(t); res(null); };
        img.onerror = () => { clearTimeout(t); res(k + ": nenacetlo se"); };
        img.src = u;
      }))).then((v) => v.filter(Boolean));
    });
    eq("všechny podklady odpovídají", mrtve.join(", "), "");

    eq("s mapou nespadla žádná chyba", chybyOnline.join(" | "), "");
  }
  await online.close();
} finally {
  await browser.close();
  server.close();
}

console.log("\n=====================================");
console.log("prošlo: " + passed + ", spadlo: " + failures.length);
if (failures.length) {
  failures.forEach((f) => console.log("  - " + f));
  process.exitCode = 1;
}
