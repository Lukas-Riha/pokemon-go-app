// Audit výpočtů přes CELÝ pokédex, ne jen přes pár ukázkových kusů.
//
// Smysl je jediný: až přibude nová generace, musí být hned vidět, jestli se
// něco rozbilo. Fixtury tohle nechytí — ty testují, co jsem si vymyslel já.
// Tenhle soubor kontroluje invarianty, které musí platit pro každý druh,
// každou úroveň a každou kombinaci typů, co ve hře existuje.
//
// Spuštění:  node tests/audit_app.test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"), "..");
const require = createRequire(import.meta.url);
const chromium = require(path.resolve(ROOT, "../playwright-day2/node_modules/playwright")).chromium;

let passed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { passed++; console.log("  ok   " + name); }
  else { failures.push(name + (detail ? " → " + detail : "")); console.log("  FAIL " + name + (detail ? " → " + detail : "")); }
}
function eq(name, actual, expected) {
  check(name, actual === expected, "čekáno " + JSON.stringify(expected) + ", dostal " + JSON.stringify(actual));
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  // Stejnou sadou se dá projet i build se vzhledovou vrstvou:
  //   PGO_APP=web-app/pokemon_tracker_TEST.html node tests/...
  res.end(fs.readFileSync(process.env.PGO_APP
    ? path.resolve(ROOT, process.env.PGO_APP)
    : path.join(ROOT, "web-app/pokemon_tracker_app.html")));
});
await new Promise((r) => server.listen(9099, r));

const browser = await chromium.launch();
const consoleErrors = [];
const page = await (await browser.newContext()).newPage();
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));
await page.goto("http://localhost:9099/");

try {
  console.log("\n1) CP a CPM — herní vzorec musí platit pro každý druh");
  const cp = await page.evaluate(() => {
    const P = window.__pgo;
    const dex = P.pokedex().species;
    const klice = Object.keys(dex);
    const spatne = { neroste: [], nula: [], nan: [] };
    klice.forEach((k) => {
      const d = P.dexByKey(k);
      if (!d) { spatne.nan.push(k); return; }
      let predchozi = 0;
      [1, 10, 20, 30, 40, 50].forEach((lvl) => {
        const c = P.cpAt(d, 15, 15, 15, P.cpmAtLevel(lvl));
        if (!isFinite(c)) spatne.nan.push(k + "@L" + lvl);
        else if (c <= 0) spatne.nula.push(k + "@L" + lvl);
        else if (c < predchozi) spatne.neroste.push(k + "@L" + lvl);
        predchozi = c;
      });
    });
    return { pocet: klice.length, spatne };
  });
  check("pokédex není prázdný", cp.pocet > 1000, String(cp.pocet));
  eq("CP nikde nevyjde NaN", cp.spatne.nan.length, 0);
  eq("CP nikde nevyjde nula nebo míň", cp.spatne.nula.length, 0);
  eq("CP s levelem vždycky roste", cp.spatne.neroste.length, 0);

  console.log("\n2) Cíl pro ligu — nesmí přetéct cap, ani zůstat zbytečně nízko");
  const cap = await page.evaluate(() => {
    const P = window.__pgo;
    const dex = P.pokedex().species;
    const ligy = [{ label: "LC", cap: 500 }, { label: "GL", cap: 1500 }, { label: "UL", cap: 2500 }];
    const prelil = [], nizko = [];
    Object.keys(dex).forEach((k) => {
      const d = P.dexByKey(k);
      if (!d) return;
      ligy.forEach((lg) => {
        const idx = P.bestLevelIndex(d, 15, 15, 15, lg.cap);
        if (idx < 0) return;                       // ani na L1 se nevejde
        const lvls = P.cpmLevels();
        const cpTady = P.cpAt(d, 15, 15, 15, lvls[idx][1]);
        if (cpTady > lg.cap) prelil.push(k + " " + lg.label + " " + cpTady);
        // o půl levelu výš už se vejít nesmí (jinak to necílí na strop)
        if (idx + 1 < lvls.length) {
          const cpVys = P.cpAt(d, 15, 15, 15, lvls[idx + 1][1]);
          if (cpVys <= lg.cap) nizko.push(k + " " + lg.label + " " + cpTady + "->" + cpVys);
        }
      });
    });
    return { prelil: prelil.slice(0, 8), prelilN: prelil.length,
      nizko: nizko.slice(0, 8), nizkoN: nizko.length };
  });
  eq("žádný cíl nepřeteče CP limit ligy", cap.prelilN, 0);
  check("…a ani jeden necílí zbytečně nízko", cap.nizkoN === 0, cap.nizko.join(" | "));

  console.log("\n3) Maximum stat productu je opravdu maximum");
  const sp = await page.evaluate(() => {
    const P = window.__pgo;
    const dex = P.pokedex().species;
    const klice = Object.keys(dex);
    // vzorek napříč celým pokédexem (každý dvacátý), jinak by to trvalo minuty
    const vzorek = klice.filter((_, i) => i % 20 === 0);
    const prekroceno = [];
    vzorek.forEach((k) => {
      const d = P.dexByKey(k);
      if (!d) return;
      const max = P.speciesMaxSP(k, d, 1500);
      if (!max) return;
      for (let a = 0; a <= 15; a += 5) {
        for (let df = 0; df <= 15; df += 5) {
          for (let s = 0; s <= 15; s += 5) {
            const idx = P.bestLevelIndex(d, a, df, s, 1500);
            if (idx < 0) continue;
            const v = P.statProduct(d, a, df, s, P.cpmLevels()[idx][1]);
            if (v > max * 1.0001) prekroceno.push(k + " " + a + "/" + df + "/" + s);
          }
        }
      }
    });
    return { vzorek: vzorek.length, prekroceno: prekroceno.slice(0, 6), n: prekroceno.length };
  });
  check("vzorek pokrývá celý pokédex", sp.vzorek > 40, String(sp.vzorek));
  eq("žádná IV kombinace nepřekročí spočítané maximum druhu", sp.n, 0);

  console.log("\n4) Žebříčky rolí — procenta musí být v rozsahu a pořadí konzistentní");
  const zebr = await page.evaluate(() => {
    const P = window.__pgo;
    const raid = P.raidRankIndex(), gym = P.gymRankIndex();
    const spatnePct = [];
    Object.keys(raid).forEach((k) => raid[k].forEach((e) => {
      if (!(e.pct > 0 && e.pct <= 1)) spatnePct.push("raid " + k + " " + e.pct);
      if (!(e.rank >= 1)) spatnePct.push("raid rank " + k + " " + e.rank);
    }));
    Object.keys(gym).forEach((k) => {
      const e = gym[k];
      if (!(e.pct > 0 && e.pct <= 1)) spatnePct.push("gym " + k + " " + e.pct);
      if (!(e.poradi >= 1)) spatnePct.push("gym poradi " + k + " " + e.poradi);
    });
    const gz = P.gymRanking();
    const neklesa = gz.some((e, i) => i > 0 && e.score > gz[i - 1].score + 1e-9);
    // legendární a mytičtí v gymu být nesmí
    const legendy = Object.keys(gym).filter((k) => {
      const d = P.dexByKey(k);
      return d && (d.rarity === "L" || d.rarity === "M");
    });
    return { spatnePct: spatnePct.slice(0, 6), n: spatnePct.length, neklesa: neklesa,
      raidDruhu: Object.keys(raid).length, gymDruhu: Object.keys(gym).length, legendy: legendy };
  });
  eq("všechna procenta rolí jsou v rozsahu 0–1", zebr.n, 0);
  check("gymový žebříček je seřazený sestupně", zebr.neklesa === false);
  check("raidových útočníků je rozumný počet", zebr.raidDruhu > 100 && zebr.raidDruhu < 800,
    String(zebr.raidDruhu));
  check("gymových obránců taky", zebr.gymDruhu > 20 && zebr.gymDruhu < 200, String(zebr.gymDruhu));
  eq("legendární a mytičtí mezi obránci nejsou", zebr.legendy.length, 0);

  console.log("\n5) Typová účinnost — jen povolené násobky, žádná díra");
  const typy = await page.evaluate(() => {
    const P = window.__pgo;
    const povolene = [0.390625, 0.3906, 0.625, 1, 1.6];
    const blizko = (v) => povolene.some((x) => Math.abs(x - v) < 0.001);
    const spatne = [];
    const T = P.allTypes();
    T.forEach((a) => T.forEach((d) => {
      const m = P.typeMult(a, d);
      if (!blizko(m)) spatne.push(a + "->" + d + " " + m);
    }));
    // proti každé reálné kombinaci musí existovat aspoň jeden typ, který na ni platí
    const bezCounteru = [];
    P.realneKombinace().forEach((k) => {
      const nej = Math.max.apply(null, T.map((a) => P.pokrytiKombinaci([a]) && 1));
      let best = 0;
      T.forEach((a) => {
        let m = 1;
        k.typy.forEach((t) => { m *= P.typeMult(a, t); });
        if (m > best) best = m;
      });
      if (best <= 1) bezCounteru.push(k.klic);
    });
    return { spatne: spatne.slice(0, 6), n: spatne.length,
      kombinaci: P.realneKombinace().length, bezCounteru: bezCounteru };
  });
  eq("typová tabulka má jen herní násobky", typy.n, 0);
  check("kombinací typů je přes sto", typy.kombinaci > 100, String(typy.kombinaci));
  eq("na každou kombinaci existuje counter", typy.bezCounteru.length, 0);

  console.log("\n6) Jména z pokédexu se musí najít zpátky");
  const jmena = await page.evaluate(() => {
    const P = window.__pgo;
    const dex = P.pokedex().species;
    const nenajde = [], jinyDruh = [];
    Object.keys(dex).forEach((k) => {
      const jmeno = dex[k][1];
      const zpet = P.dexEntry(jmeno);
      if (!zpet) { nenajde.push(jmeno); return; }
      // stejné jméno může mít víc forem (Deoxys, Palafin) — kontroluje se jméno
      if (zpet.name !== jmeno) jinyDruh.push(jmeno + " -> " + zpet.name);
    });
    return { nenajde: nenajde.slice(0, 10), nenajdeN: nenajde.length,
      jinyDruh: jinyDruh.slice(0, 10), jinyDruhN: jinyDruh.length };
  });
  eq("každé jméno z pokédexu se najde zpátky", jmena.nenajdeN, 0);
  check("…a vrátí ten samý druh", jmena.jinyDruhN === 0, jmena.jinyDruh.join(" | "));

  console.log("\n7) Ligové žebříčky ukazují na druhy, které existují");
  const ligy = await page.evaluate(() => {
    const P = window.__pgo;
    const meta = P.meta().leagues;
    const nezname = [], spatnyRank = [];
    Object.keys(meta).forEach((lg) => {
      Object.keys(meta[lg]).forEach((k) => {
        if (!P.dexByKey(k)) nezname.push(lg + ":" + k);
        const v = meta[lg][k];
        if (!(v[0] >= 1)) spatnyRank.push(lg + ":" + k + " #" + v[0]);
      });
    });
    return { nezname: nezname.slice(0, 10), n: nezname.length, spatnyRank: spatnyRank.length,
      pocty: Object.keys(meta).map((k) => k + " " + Object.keys(meta[k]).length).join(", ") };
  });
  check("žebříčky nejsou prázdné", ligy.pocty.length > 0, ligy.pocty);
  check("každý druh v žebříčku existuje i v pokédexu", ligy.n === 0, ligy.nezname.join(", "));
  eq("žádné nesmyslné pořadí", ligy.spatnyRank, 0);

  console.log("\n8) Větvené evoluce (Eevee, Ralts, Tyrogue) nesmí nic položit");
  const vetve = await page.evaluate(() => {
    const P = window.__pgo;
    const dex = P.pokedex().species;
    const vetvene = Object.keys(dex).filter((k) => dex[k][6] === 1 && !dex[k][7]);
    const spadlo = [];
    vetvene.forEach((k) => {
      const jmeno = dex[k][1];
      try {
        const gl = { label: "GL", cap: 1500, meta: "great" };
        P.ligovaCesta(jmeno, 15, 15, 15, 20, gl);
        P.raidRolesFor(jmeno);
        P.gymRoleFor(jmeno);
        P.cpAtL40(jmeno, 15, 15, 15);
      } catch (e) {
        spadlo.push(jmeno + ": " + e.message);
      }
    });
    return { pocet: vetvene.length, spadlo: spadlo.slice(0, 6), n: spadlo.length,
      priklad: vetvene.slice(0, 6).map((k) => dex[k][1]) };
  });
  check("větvené evoluce v datech jsou", vetve.pocet > 5, vetve.priklad.join(", "));
  eq("…a žádná z nich nic nepoloží", vetve.n, 0);

  console.log("\n9) Neznámý druh v rosteru — appka to musí říct, ne tiše počítat");
  const neznamy = await page.evaluate(() => {
    window.__pgo.setRows([
      { pokemon: "Nechytrapokemon", cp: 500, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Pikachu", cp: 500, level: 20, ivAtk: 15, ivDef: 15, ivSta: 15 },
    ]);
    const c = window.__pgo.getComputed(), r = window.__pgo.getRows();
    return {
      neznamyDex: c[r[0].id].types,
      znamyDex: c[r[1].id].types,
      neznamyKeep: c[r[0].id].keep,
      zadneNaN: JSON.stringify(c[r[0].id]).indexOf("NaN") === -1,
    };
  });
  check("neznámý druh se pozná (nemá typy)", neznamy.neznamyDex === "–" || !neznamy.neznamyDex,
    String(neznamy.neznamyDex));
  eq("známý druh typy má", neznamy.znamyDex, "Electric");
  check("u neznámého druhu nevznikne NaN", neznamy.zadneNaN);

  console.log("\n10) Celý roster přes všechny druhy — nic nesmí spadnout ani vydat NaN");
  const vsichni = await page.evaluate(() => {
    const P = window.__pgo;
    const dex = P.pokedex().species;
    // každý patnáctý druh, tři různé IV sady a tři levely
    const vzorek = Object.keys(dex).filter((_, i) => i % 15 === 0);
    const rows = [];
    vzorek.forEach((k, i) => {
      const iv = [[15, 15, 15], [0, 15, 15], [7, 3, 11]][i % 3];
      const lvl = [1, 20, 40][i % 3];
      rows.push({ pokemon: dex[k][1], cp: 500, level: lvl,
        ivAtk: iv[0], ivDef: iv[1], ivSta: iv[2] });
    });
    P.setRows(rows);
    const c = P.getComputed(), r = P.getRows();
    const nan = [], prazdne = [];
    r.forEach((row) => {
      const x = c[row.id];
      if (!x) { prazdne.push(row.pokemon); return; }
      const txt = JSON.stringify(x);
      if (txt.indexOf("NaN") > -1) nan.push(row.pokemon);
      if (!x.keep) prazdne.push(row.pokemon);
      ["raidPct", "gymPct"].forEach((p) => {
        const v = x[p];
        if (v !== null && v !== undefined && !(v >= 0 && v <= 1.0001)) nan.push(row.pokemon + "." + p + "=" + v);
      });
    });
    return { pocet: rows.length, nan: nan.slice(0, 8), nanN: nan.length,
      prazdne: prazdne.slice(0, 8), prazdneN: prazdne.length };
  });
  check("prošel se vzorek napříč celým pokédexem", vsichni.pocet > 60, String(vsichni.pocet));
  check("nikde nevzniklo NaN", vsichni.nanN === 0, vsichni.nan.join(", "));
  check("každý řádek dostal verdikt", vsichni.prazdneN === 0, vsichni.prazdne.join(", "));

  console.log("\n11) Ceny vylepšení — souvislé a rostoucí");
  const ceny = await page.evaluate(() => {
    const P = window.__pgo;
    const strop = P.cpmStrop();
    const chyby = [];
    let predchozi = null;
    for (let l = 1; l < strop; l += 0.5) {
      const c = P.upgradeCost(l, strop);
      if (!c) { chyby.push("L" + l + ": cena chybí"); continue; }
      if (c.dust <= 0) chyby.push("L" + l + ": prach " + c.dust);
      // čím níž začínáš, tím dráž tě to celkem vyjde
      if (predchozi !== null && c.dust > predchozi) chyby.push("L" + l + ": cena roste směrem nahoru");
      predchozi = c.dust;
    }
    return { strop: strop, chyby: chyby.slice(0, 6), n: chyby.length,
      zL1: P.upgradeCost(1, strop), zL40: P.upgradeCost(40, strop) };
  });
  eq("strop levelů je 50", ceny.strop, 50);
  check("ceny jsou souvislé a klesají směrem k cíli", ceny.n === 0, ceny.chyby.join(" | "));
  check("z L1 na strop to stojí víc než z L40", ceny.zL1.dust > ceny.zL40.dust,
    ceny.zL1.dust + " vs " + ceny.zL40.dust);
  check("nad L40 se platí XL bonbóny", ceny.zL40.xl > 0, JSON.stringify(ceny.zL40));

  check("žádné chyby v konzoli", consoleErrors.length === 0, consoleErrors.join(" | "));
  // ================= SLUČOVÁNÍ S ROSTEREM =================
  //
  // Tady se dají data ztratit tiše: špatně spárovaný kus se PŘEPÍŠE a původní
  // pokémon z rosteru zmizí. Duplicitní řádek se dá smazat, ztracený kus ne —
  // proto se kontroluje obojí: co se sloučit MÁ, i co se sloučit NESMÍ.

  const csvHlava = "Scan date,Name,Level,CP,HP,ØATT IV,ØDEF IV,ØHP IV,min IV%,ØIV%,max IV%,"
    + "Fast move,Special move,Height (cm),Weight (g),Form,Dynamax";
  const csvRadek = (o) => [o.datum || "8/20/26 7:28:29", o.jmeno, o.level, o.cp, o.hp || 100,
    o.a, o.d, o.st, o.iv || 100, o.iv || 100, o.iv || 100, o.rychly || "Tackle",
    o.nabity || "Body Slam", o.vyska, o.vaha, o.forma || "", o.dmax || 0].join(",");
  const csv = (radky) => csvHlava + "\n" + radky.map(csvRadek).join("\n");

  const naimportuj = async (radky, mode) => await page.evaluate(([text, m]) => {
    window.__pgo.importText(text);
    window.__pgo.finishImport(m);
    const rows = window.__pgo.getRows();
    return { pocet: rows.length,
      kusy: rows.map((r) => r.pokemon + " " + r.cp + " L" + r.level
        + " " + r.ivAtk + "/" + r.ivDef + "/" + r.ivSta
        + (r.cute ? " CUTE" : "") + (r.dynamax === "Ano" ? " DMAX" : "")
        + (r.star ? " HVEZDA" : "")),
      idUnikatni: new Set(rows.map((r) => r.id)).size === rows.length };
  }, [csv(radky), mode]);

  const A = { jmeno: "Machamp", level: 20, cp: 1600, a: 15, d: 14, st: 13, vyska: 160, vaha: 130000 };
  const B = { jmeno: "Machamp", level: 22, cp: 1750, a: 15, d: 14, st: 13, vyska: 155, vaha: 128000 };
  const C = { jmeno: "Gyarados", level: 19, cp: 1719, a: 9, d: 5, st: 6, vyska: 505, vaha: 154730 };

  console.log("\n12) Slučování — tentýž sken podruhé nesmí nic zdvojit");
  await page.evaluate(() => { window.__pgo.setRows([]); window.__pgo.setDiscarded([]); });
  const prvni = await naimportuj([A, B, C], "merge");
  eq("první import načte všechny kusy", prvni.pocet, 3);
  const druhy = await naimportuj([A, B, C], "merge");
  eq("…a tentýž soubor podruhé nepřidá nic", druhy.pocet, 3);
  check("…kusy zůstaly beze změny", druhy.kusy.join(" | ") === prvni.kusy.join(" | "),
    druhy.kusy.join(" | "));
  check("…a řádky nesdílejí ID", druhy.idUnikatni === true);

  console.log("\n13) Slučování — vylepšený kus se pozná podle otisku");
  await page.evaluate(() => { window.__pgo.setRows([]); window.__pgo.setDiscarded([]); });
  await naimportuj([A, B], "merge");
  const povysen = await naimportuj([Object.assign({}, A, { level: 30, cp: 2100 }), B], "merge");
  eq("vylepšený kus se sloučí, nepřidá", povysen.pocet, 2);
  check("…a řádek má nové CP i level",
    povysen.kusy.some((k) => k.indexOf("Machamp 2100 L30") === 0), povysen.kusy.join(" | "));
  check("…druhý kus téhož druhu zůstal netknutý",
    povysen.kusy.some((k) => k.indexOf("Machamp 1750 L22") === 0), povysen.kusy.join(" | "));

  console.log("\n14) Slučování — dva různé kusy téhož druhu se nesmí slít");
  await page.evaluate(() => { window.__pgo.setRows([]); window.__pgo.setDiscarded([]); });
  const dvojice = await naimportuj([A, B], "merge");
  eq("dva kusy se stejnými IV a jiným otiskem zůstanou dva", dvojice.pocet, 2);

  console.log("\n15) Slučování — ruční značky přežijí další sken");
  await page.evaluate(() => { window.__pgo.setRows([]); window.__pgo.setDiscarded([]); });
  await naimportuj([A], "merge");
  await page.evaluate(() => {
    const r = window.__pgo.getRows()[0];
    r.cute = "Ano"; r.dynamax = "Ano"; r.star = true; r.note = "moje poznámka";
    window.__pgo.prekreslit();
  });
  const poZnackach = await naimportuj([Object.assign({}, A, { level: 30, cp: 2100 })], "merge");
  eq("po dalším skenu je pořád jeden kus", poZnackach.pocet, 1);
  check("…a značky CUTE, DMAX i hvězdička zůstaly",
    /CUTE/.test(poZnackach.kusy[0]) && /DMAX/.test(poZnackach.kusy[0])
      && /HVEZDA/.test(poZnackach.kusy[0]), poZnackach.kusy[0]);
  check("…i ruční poznámka",
    (await page.evaluate(() => window.__pgo.getRows()[0].note)) === "moje poznámka");

  console.log("\n16) Slučování — smazané kusy se nevrací");
  await page.evaluate(() => { window.__pgo.setRows([]); window.__pgo.setDiscarded([]); });
  await naimportuj([A, C], "merge");
  // maže se tlačítkem z tabulky, ať test projde stejnou cestou jako uživatel —
  // zápis do paměti smazaných si appka postaví sama (klíč skenu, otisk, kopie)
  const smazano = await page.evaluate(() => {
    const rows = window.__pgo.getRows();
    let kliknuto = false;
    document.querySelectorAll("#tbody tr").forEach((tr) => {
      if (kliknuto) return;
      if (tr.textContent.indexOf("Gyarados") === -1) return;
      const btn = tr.querySelector(".del-btn");
      if (btn) { btn.click(); kliknuto = true; }
    });
    return { kliknuto, zbylo: window.__pgo.getRows().length,
      vPameti: window.__pgo.getDiscarded().length };
  });
  check("Gyarados se smazal tlačítkem", smazano.kliknuto === true && smazano.zbylo === 1,
    JSON.stringify(smazano));
  check("…a je zapsaný v paměti smazaných", smazano.vPameti === 1, JSON.stringify(smazano));
  const poSmazani = await naimportuj([A, C], "merge");
  check("smazaný kus se dalším importem nevrátí",
    !poSmazani.kusy.some((k) => k.indexOf("Gyarados") === 0), poSmazani.kusy.join(" | "));

  console.log("\n17) Slučování — kusy mimo sken zůstávají");
  await page.evaluate(() => {
    window.__pgo.setDiscarded([]);
    window.__pgo.setRows([{ pokemon: "Blissey", cp: 2400, level: 32, ivAtk: 10,
      ivDef: 15, ivSta: 15 }]);
  });
  const mimoSken = await naimportuj([A], "merge");
  eq("kus, který sken nezahlédl, v rosteru zůstane", mimoSken.pocet, 2);
  check("…a je to pořád ten původní",
    mimoSken.kusy.some((k) => k.indexOf("Blissey") === 0), mimoSken.kusy.join(" | "));

  console.log("\n18) Data na sebe navazují — žádný odkaz do prázdna");
  const vazby = await page.evaluate(() => {
    const P = window.__pgo;
    const dex = P.pokedex();
    const sp = dex.species;
    const meta = P.meta().leagues || {};
    const chybiVLize = [];
    Object.keys(meta).forEach((liga) => {
      Object.keys(meta[liga]).forEach((k) => { if (!sp[k]) chybiVLize.push(liga + ":" + k); });
    });
    const evo = dex.evoluce || {};
    const chybiEvo = [];
    Object.keys(evo).forEach((k) => {
      if (!sp[k]) chybiEvo.push("zdroj " + k);
      (evo[k] || []).forEach((c) => { if (!sp[c]) chybiEvo.push(k + "->" + c); });
    });
    const cykly = [];
    Object.keys(evo).forEach((start) => {
      const videl = {};
      let fronta = [start];
      while (fronta.length) {
        const k = fronta.shift();
        if (videl[k]) { cykly.push(start); return; }
        videl[k] = 1;
        fronta = fronta.concat(evo[k] || []);
      }
    });
    const raid = P.raidRankIndex(), gym = P.gymRankIndex();
    const chybiRole = [];
    Object.keys(raid).forEach((k) => { if (!sp[k] && !P.dexByKey(k)) chybiRole.push("raid:" + k); });
    Object.keys(gym).forEach((k) => { if (!sp[k] && !P.dexByKey(k)) chybiRole.push("gym:" + k); });
    return { chybiVLize, chybiEvo, cykly, chybiRole };
  });
  check("každý druh v ligových žebříčcích existuje v pokédexu",
    vazby.chybiVLize.length === 0, vazby.chybiVLize.slice(0, 5).join(", "));
  check("každá evoluce míří na existující druh",
    vazby.chybiEvo.length === 0, vazby.chybiEvo.slice(0, 5).join(", "));
  check("v evolucích není cyklus", vazby.cykly.length === 0, vazby.cykly.slice(0, 5).join(", "));
  check("role odkazují na existující druhy",
    vazby.chybiRole.length === 0, vazby.chybiRole.slice(0, 5).join(", "));

  console.log("\n19) Dopočet levelu z CP je vratný");
  const vratnost = await page.evaluate(() => {
    const P = window.__pgo;
    const sp = P.pokedex().species;
    const klice = Object.keys(sp).filter((k) => sp[k][1] && sp[k][3]);
    const spatne = [];
    let zkusenych = 0;
    for (let i = 0; i < klice.length; i += 37) {
      const jm = sp[klice[i]][1];
      [10, 20, 25.5, 33, 40].forEach((lv) => {
        const cp = P.cpNaLevelu(jm, 15, 14, 13, lv);
        if (!cp) return;
        zkusenych++;
        const zpet = P.levelZCP(jm, cp, 15, 14, 13);
        if (!zpet || !zpet.vse || zpet.vse.indexOf(lv) === -1) {
          spatne.push(jm + " L" + lv + " CP" + cp + " -> " + JSON.stringify(zpet && zpet.vse));
        }
      });
    }
    return { zkusenych, spatne };
  });
  check("zkusil se pořádný vzorek", vratnost.zkusenych > 100, String(vratnost.zkusenych));
  check("z CP a IV vyjde zpátky týž level",
    vratnost.spatne.length === 0, vratnost.spatne.slice(0, 3).join(" | "));

  console.log("\n20) Verdikt nesmí odporovat sloupcům rolí");
  // Vzorek musí být z MOŽNÝCH kusů: CP se dopočítá z druhu, levelu a IV.
  // S vymyšleným CP (Marill 720 na L20, když jeho strop je 263) hlásí engine
  // rozpory, které nejsou jeho chyba — počítá nad kusem, co nemůže existovat.
  const spor = await page.evaluate(() => {
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
      radky.push({ pokemon: jm, cp: cp, level: lv,
        ivAtk: iv[0], ivDef: iv[1], ivSta: iv[2] });
    }
    P.setRows(radky);
    const c = P.getComputed();
    const spory = [];
    P.getRows().forEach((r) => {
      const x = c[r.id];
      if (!x) { spory.push(r.pokemon + ": bez rozboru"); return; }
      if (!x.keep) spory.push(r.pokemon + ": bez verdiktu");
      const drziRoli = /LC |GL |UL |ML |Raid|Gym|Mega/i.test(x.keepSub || "");
      // „Po evoluci" a „Po vývinu" jsou plnohodnotné role — kus se drží kvůli
      // tomu, čím se stane. Za „žádnou roli" se smí považovat jen tvrdé Ne.
      const role = [x.raidRec, x.gymRec, x.pvpRec, x.mega].map((v) => String(v || ""));
      const vsechnyNe = role.every((v) => v === "Ne" || v.indexOf("Ne ") === 0);
      if (drziRoli && vsechnyNe) spory.push(r.pokemon + ": " + x.keepSub + " ale role vsechny Ne");
    });
    return { kusu: radky.length, spory };
  });
  check("prošel se vzorek napříč pokédexem", spor.kusu > 100, String(spor.kusu));
  check("verdikt nikde neodporuje sloupcům rolí",
    spor.spory.length === 0, spor.spory.slice(0, 3).join(" | "));

  console.log("\n21) Nad možnými kusy musí sedět i čísla, ne jen verdikt");
  const cisla = await page.evaluate(() => {
    const P = window.__pgo;
    P.setDiscarded([]);
    const sp = P.pokedex().species;
    const klice = Object.keys(sp).filter((k) => sp[k][1] && sp[k][3]);
    const radky = [];
    for (let i = 0; i < klice.length; i += 7) {
      const jm = sp[klice[i]][1];
      const lv = 5 + (i % 40) * 0.5 + 5;
      const iv = [i % 16, (i * 5) % 16, (i * 11) % 16];
      const cp = P.cpNaLevelu(jm, iv[0], iv[1], iv[2], Math.round(lv * 2) / 2);
      if (!cp) continue;
      radky.push({ pokemon: jm, cp: cp, level: Math.round(lv * 2) / 2,
        ivAtk: iv[0], ivDef: iv[1], ivSta: iv[2] });
    }
    P.setRows(radky);
    const c = P.getComputed();
    const base = P.base();
    const chyby = { ivMimo: [], stropPodCp: [], nanu: [], bezVerdiktu: [], pctMimo: [] };
    P.getRows().forEach((r) => {
      const x = c[r.id];
      const b = base.filter((z) => z.row.id === r.id)[0];
      if (!x) { chyby.bezVerdiktu.push(r.pokemon); return; }
      if (!x.keep) chyby.bezVerdiktu.push(r.pokemon);
      if (JSON.stringify(x).indexOf("NaN") > -1) chyby.nanu.push(r.pokemon);
      // IV % musí přesně odpovídat součtu tří IV
      const cekane = Math.round(((+r.ivAtk + +r.ivDef + +r.ivSta) / 45) * 1000) / 10;
      const mame = b && b.ivPct !== null && b.ivPct !== undefined
        ? Math.round(b.ivPct * 1000) / 10 : null;
      if (mame === null || Math.abs(mame - cekane) > 0.11) {
        chyby.ivMimo.push(r.pokemon + " " + mame + " vs " + cekane);
      }
      // strop CP nesmí být nižší než aktuální CP téhož kusu
      if (b && b.cpMax && +r.cp && b.cpMax + 1 < +r.cp) {
        chyby.stropPodCp.push(r.pokemon + " strop " + b.cpMax + " < CP " + r.cp);
      }
      // Shadow kus smí u raidu přerůst 100 %: měřítkem je nejlepší BĚŽNÝ
      // kus druhu a shadow má o 20 % vyšší útok. Strop je tam proto, aby
      // se chytila nesmyslná čísla, ne aby ten bonus schoval.
      const shadow = /shadow/i.test(String(r.forma || ""));
      ["raidPct", "gymPct"].forEach((k) => {
        const v = x[k];
        const strop = (k === "raidPct" && shadow) ? 1.25 : 1.0001;
        if (v !== null && v !== undefined && !(v >= 0 && v <= strop)) {
          chyby.pctMimo.push(r.pokemon + "." + k + "=" + v);
        }
      });
    });
    return { kusu: radky.length, chyby };
  });
  check("vzorek možných kusů je dost velký", cisla.kusu > 150, String(cisla.kusu));
  check("každý kus dostal verdikt",
    cisla.chyby.bezVerdiktu.length === 0, cisla.chyby.bezVerdiktu.slice(0, 3).join(", "));
  check("nikde nevzniklo NaN", cisla.chyby.nanu.length === 0, cisla.chyby.nanu.slice(0, 3).join(", "));
  check("IV % sedí na součet tří IV",
    cisla.chyby.ivMimo.length === 0, cisla.chyby.ivMimo.slice(0, 3).join(" | "));
  check("strop CP není nižší než současné CP",
    cisla.chyby.stropPodCp.length === 0, cisla.chyby.stropPodCp.slice(0, 3).join(" | "));
  check("procenta rolí zůstávají v rozsahu (shadow smí do 125 % u raidu)",
    cisla.chyby.pctMimo.length === 0, cisla.chyby.pctMimo.slice(0, 3).join(" | "));

  console.log("\n22) Rozdělení žebříčků na metu a zbytek nikoho neztratilo");
  // Kompletní tabulka pořadí ZÁMĚRNĚ neopakuje to, co je v metě — appka se
  // dívá nejdřív tam. Kdyby se ta přednost někdy obrátila nebo rozbila,
  // přišly by o pořadí právě ty nejlepší druhy, a to je nejhorší možná ztráta.
  const zebricky = await page.evaluate(() => {
    const P = window.__pgo;
    const m = P.meta();
    const ligy = ["little", "great", "ultra", "master"];
    const chybi = [], jinePoradi = [], vObou = [];
    let metaCelkem = 0, vseCelkem = 0;
    ligy.forEach((liga) => {
      const meta = m.leagues[liga] || {};
      const vse = (m.poradiVse || {})[liga] || {};
      metaCelkem += Object.keys(meta).length;
      vseCelkem += Object.keys(vse).length;
      Object.keys(meta).forEach((k) => {
        if (vse[k]) vObou.push(liga + ":" + k);
        const p = P.ligovePoradi(k, liga);
        if (!p) { chybi.push(liga + ":" + k); return; }
        if (p.rank !== meta[k][0]) jinePoradi.push(liga + ":" + k + " " + p.rank + " vs " + meta[k][0]);
        if (!p.jeMeta) jinePoradi.push(liga + ":" + k + " se netváří jako meta");
      });
      // a druh mimo metu musí jít dohledat taky
      Object.keys(vse).slice(0, 50).forEach((k) => {
        const p = P.ligovePoradi(k, liga);
        if (!p) chybi.push(liga + ":" + k + " (mimo metu)");
        else if (p.rank !== vse[k][0]) jinePoradi.push(liga + ":" + k + " mimo metu " + p.rank);
      });
    });
    return { chybi, jinePoradi, vObou, metaCelkem, vseCelkem };
  });
  check("v obou tabulkách zároveň není nikdo",
    zebricky.vObou.length === 0, zebricky.vObou.slice(0, 3).join(", "));
  check("každý druh z mety si drží své pořadí",
    zebricky.chybi.length === 0 && zebricky.jinePoradi.length === 0,
    zebricky.chybi.slice(0, 3).concat(zebricky.jinePoradi.slice(0, 3)).join(" | "));
  check("mimo metu se dohledá taky",
    zebricky.vseCelkem > 1000, String(zebricky.vseCelkem));
  check("dohromady je to víc než samotná meta",
    zebricky.metaCelkem + zebricky.vseCelkem > zebricky.metaCelkem * 2,
    zebricky.metaCelkem + " meta + " + zebricky.vseCelkem + " zbytek");

  /* ====================================================================
     ROZPORY MEZI ÚDAJI U TÉHOŽ KUSU

     „Ponechat po purifikaci 96 %" vedle „Purifikace: Nechat". Každá věta
     zvlášť platí, dohromady si odporují — a čte se to jako chyba rozhodnutí.
     Tenhle blok projde roster poskládaný tak, aby se do něj vešly shadow,
     purified, lucky, dynamax, duplicity i dokonalé kusy, a hlídá dvojice
     údajů, které si odporovat nesmí.
     ==================================================================== */
  console.log("\nrozpory mezi údaji");
  const rozpory = await page.evaluate(async () => {
    const P = window.__pgo;
    const DRUHY = ["Machamp", "Machop", "Tyranitar", "Larvitar", "Metagross", "Beldum",
      "Garchomp", "Gible", "Mewtwo", "Rayquaza", "Magikarp", "Gyarados", "Blissey",
      "Ralts", "Gardevoir", "Eevee", "Vaporeon", "Shellos East Sea", "Thundurus",
      "Zapdos", "Magnezone", "Lucario", "Riolu", "Togetic", "Togekiss", "Swablu",
      "Altaria", "Medicham", "Meditite", "Bastiodon", "Registeel", "Melmetal",
      "Pidgey", "Rattata", "Weedle", "Caterpie", "Sableye", "Azumarill", "Marill",
      "Dragonite", "Dratini", "Snorlax", "Lapras", "Scizor", "Scyther", "Charizard"];
    const FORMY = ["", "Shadow", "Purified", "Lucky"];
    const rows = [];
    DRUHY.forEach((d, i) => {
      FORMY.forEach((f, j) => {
        [[3, 4, 5], [13, 13, 13], [14, 15, 14], [15, 15, 15]].forEach((iv, k) => {
          if ((i + j + k) % 3 !== 0) return;
          rows.push({ pokemon: d, cp: 500 + i * 40 + k * 300, level: 15 + k * 5,
            ivAtk: iv[0], ivDef: iv[1], ivSta: iv[2], forma: f,
            dynamax: (i % 7 === 0) ? "Ano" : "", cute: (i % 11 === 0) ? "Ano" : "" });
        });
      });
    });
    P.setRows(rows);
    await new Promise((x) => setTimeout(x, 4000));
    const base = P.base();
    const c = P.getComputed();
    const pustis = (v) => String(v.keep || "").indexOf("Zahodit") === 0;
    const PRAVIDLA = [
      ["pouštíš ho, a přesto evolvovat", (v) => pustis(v) && v.evolve === "Ano"],
      ["pouštíš ho, a přesto vylepšit", (v) => pustis(v) && v.powerup === "Ano"],
      ["necháváš si ho, ale trade říká pouštíš ho",
        (v) => !pustis(v) && /pouštíš ho/.test(v.tradeSub || "")],
      ["důvod mluví o purifikaci, ale purifikace se nedoporučuje",
        (v) => /po purifikaci/.test(v.keepSub || "") && v.purify === "Nechat"],
      ["doskenovat, i když jsou IV přesné",
        (v, x) => v.rescan !== "Ne" && !v.ivUncertain && !x.row.zGymu],
      ["purifikace u kusu, který není shadow",
        (v, x) => (v.purify === "Ano" || v.purify === "Nechat") && x.row.forma !== "Shadow"],
      ["hlásí lepší kopii, ale je jediný kus",
        (v) => /kopie/i.test(v.mega || "") && /jediný/.test(v.copies || "")],
      ["finální evoluce, a přesto se nabízí vývin",
        (v, x) => v.evolve === "Finální" && P.evoKroky(x.row).length > 0],
      ["podtitulek mluví o Dynamaxu, ale kus pouštíš",
        (v) => pustis(v) && /Dynamax/.test(v.keepSub || "")],
      ["sestava po evoluci u finální formy",
        (v) => v.evolve === "Finální" && !!v.movesBestFinal],
      ["pouštíš ho, ale podtitulek zní jako důvod k ponechání",
        (v) => pustis(v) && /vysoké IV|po purifikaci|drží ho/.test(v.keepSub || "")],
      ["necháváš si ho, ale podtitulek zní jako důvod k puštění",
        (v) => !pustis(v) && /pouštíš ho|lepší máš|horší kopie/.test(v.keepSub || "")],
      ["vylepšit a zároveň lepší kopie", (v) => v.powerup === "Ano" && !!v.worseCopy],
      // Držitel mega slotu měl ve sloupci Mega napsáno "Lepší kopie", protože
      // sloupec si "nejlepší kopii" počítal sám, nezávisle na rozpočtu.
      ["drží mega slot, a přesto Lepší kopie",
        (v) => v.megaDrzi && /kopie/i.test(v.mega || "")],
      ["verdikt ho drží kvůli meze, ale mega slot má někdo jiný",
        (v) => /^mega/.test(v.keepSub || "") && !v.megaDrzi],
      // Kus, který drží slot AŽ PO EVOLUCI, měl ve sloupci Evolvovat "Ne"
      // s odůvodněním "ani vyvinutý by tenhle kus žádnou roli nedržel" —
      // a o dvě buňky vedle "drží místo v rozpočtu, ale až jako Blaziken".
      ["drží slot až po evoluci, a přesto evolvovat Ne",
        (v, x) => (x.sloty || []).some((sl) => sl.poEvoluci)
          && String(v.evolve || "").indexOf("Ne") === 0],
    ];
    const nalezy = [];
    base.forEach((x) => {
      const v = c[x.row.id];
      if (!v) return;
      PRAVIDLA.forEach((pr) => {
        let ano = false;
        try { ano = pr[1](v, x); } catch (e) { ano = false; }
        if (!ano) return;
        if (nalezy.length < 6) {
          nalezy.push(pr[0] + ": " + x.row.pokemon + " " + (x.row.forma || "-")
            + " [" + v.keep + " / " + (v.keepSub || "") + "]");
        }
      });
    });
    return { kusu: base.length, pravidel: PRAVIDLA.length, nalezy };
  });
  check("roster na rozpory se opravdu poskládal", rozpory.kusu > 150, String(rozpory.kusu));
  check("hlídá se víc než deset druhů rozporu", rozpory.pravidel >= 13,
    String(rozpory.pravidel));
  check("žádné dva údaje u téhož kusu si neodporují",
    rozpory.nalezy.length === 0, rozpory.nalezy.join(" | "));

  /* ====================================================================
     ŘAZENÍ SLOUPCŮ: OBRÁCENÝ SEMAFOR
     První kliknutí na hlavičku musí dát nahoru to nejlepší. U stavů zelená,
     oranžová, červená; u čísel od nejvyššího. Dřív se stavy řadily abecedně
     a u Megy tím pádem vyskočilo nahoru "Lepší kopie" a "Vysoká" spadla dolů.
     ==================================================================== */
  console.log("\nřazení sloupců");
  const razeni = await page.evaluate(async () => {
    const P = window.__pgo;
    P.setRows([
      { pokemon: "Garchomp", cp: 3000, level: 30, ivAtk: 15, ivDef: 15, ivSta: 15 },
      { pokemon: "Gible", cp: 300, level: 10, ivAtk: 2, ivDef: 3, ivSta: 4 },
      { pokemon: "Machamp", cp: 2200, level: 28, ivAtk: 14, ivDef: 13, ivSta: 12 },
      { pokemon: "Pidgey", cp: 100, level: 5, ivAtk: 1, ivDef: 1, ivSta: 1 },
      { pokemon: "Blissey", cp: 2500, level: 30, ivAtk: 10, ivDef: 14, ivSta: 15 },
      { pokemon: "Magikarp", cp: 200, level: 12, ivAtk: 5, ivDef: 5, ivSta: 5 },
      { pokemon: "Charizard", cp: 2600, level: 30, ivAtk: 13, ivDef: 13, ivSta: 13 },
      { pokemon: "Rattata", cp: 150, level: 8, ivAtk: 3, ivDef: 3, ivSta: 3 },
    ]);
    await new Promise((r) => setTimeout(r, 1500));
    const TONY = { good: 0, evo: 1, warning: 2, muted: 3, critical: 4 };
    const TON_POLE = { keep: "keepTone", powerup: "powerupTone",
      evolve: "evolveTone", mega: "megaTone", moves: "movesTone" };
    const out = { stavy: {}, cisla: {} };
    // stavové sloupce: tóny musí jít vzestupně (zelená nahoře)
    for (const klic of Object.keys(TON_POLE)) {
      P.atlasSort("");
      await new Promise((r) => setTimeout(r, 60));
      P.atlasSort(klic, 1);
      await new Promise((r) => setTimeout(r, 250));
      const c = P.getComputed();
      const rady = Array.from(document.querySelectorAll("#tbody tr[data-row-id]"));
      const tony = rady.map((tr) => {
        const v = c[tr.dataset.rowId];
        const t = v ? v[TON_POLE[klic]] : null;
        return TONY[t] === undefined ? 3 : TONY[t];
      });
      out.stavy[klic] = { tony: tony,
        vzestupne: tony.every((x, i) => i === 0 || tony[i - 1] <= x) };
    }
    // číselné sloupce: první kliknutí = od nejvyššího
    for (const [klic, th] of [["cp", "CP"], ["ivPct", "IV %"]]) {
      P.atlasSort("");
      await new Promise((r) => setTimeout(r, 60));
      const hl = Array.from(document.querySelectorAll("#headerRow th"))
        .filter((x) => x.textContent.replace(/[▲▼]\d?/g, "").trim() === th)[0];
      if (!hl) { out.cisla[klic] = { chybi: true }; continue; }
      hl.click();
      await new Promise((r) => setTimeout(r, 250));
      const c = P.getComputed();
      const hodnoty = Array.from(document.querySelectorAll("#tbody tr[data-row-id]"))
        .map((tr) => {
          const v = c[tr.dataset.rowId];
          return klic === "cp" ? Number(P.getRows().filter((r) => r.id === tr.dataset.rowId)[0].cp)
            : (v ? v.ivPct : null);
        }).filter((x) => x !== null && !isNaN(x));
      out.cisla[klic] = { hodnoty,
        sestupne: hodnoty.every((x, i) => i === 0 || hodnoty[i - 1] >= x),
        smer: P.snapshot().sortDir };
    }
    P.atlasSort("");
    return out;
  });
  Object.keys(razeni.stavy).forEach((klic) => {
    check("sloupec „" + klic + "“ řadí od zelené k červené",
      razeni.stavy[klic].vzestupne, razeni.stavy[klic].tony.join(","));
  });
  Object.keys(razeni.cisla).forEach((klic) => {
    check("číselný sloupec „" + klic + "“ začíná od nejvyššího",
      razeni.cisla[klic].sestupne === true && razeni.cisla[klic].smer === -1,
      JSON.stringify(razeni.cisla[klic]));
  });

  /* ====================================================================
     HODNOTA VÝVINU U NIŽŠÍ EVOLUCE
     Nižší forma musí nést, co z ní bude: raid, gym, ligu i megu. Bez toho
     by šel pryč Gible, protože sám neumí nic, a Garchomp by se nikdy nechytil.
     ==================================================================== */
  console.log("\nhodnota vývinu u nižší evoluce");
  const vyvin = await page.evaluate(async () => {
    const P = window.__pgo;
    // nižší formy, jejichž vývin je špička v dané roli
    const VZORKY = [
      { niz: "Gible", role: "raidRec" },
      { niz: "Chansey", role: "gymRec" },
      { niz: "Machoke", role: "raidRec" },
      // Dratini tu schválně NENÍ: Dragonite appka mezi raidové útočníky
      // nepočítá (jsou před ním Rayquaza, Salamence a spol.), takže mlčení
      // je u něj správná odpověď, ne chyba.
      { niz: "Deino", role: "raidRec" },
      { niz: "Beldum", role: "raidRec" },
      { niz: "Larvitar", role: "raidRec" },
      { niz: "Magikarp", role: "mega" },
      { niz: "Ralts", role: "raidRec" },
    ];
    P.setRows(VZORKY.map((x) => ({ pokemon: x.niz, cp: 400, level: 15,
      ivAtk: 14, ivDef: 14, ivSta: 14 })));
    await new Promise((r) => setTimeout(r, 2000));
    const c = P.getComputed();
    const rows = P.getRows();
    return VZORKY.map((x) => {
      const row = rows.filter((r) => r.pokemon === x.niz)[0];
      const v = row ? c[row.id] : null;
      if (!v) return { niz: x.niz, chybi: true };
      const vse = [v.raidRec, v.gymRec, v.pvpRec, v.mega, v.megaSub, v.keepSub,
        v.raidTitle, v.gymTitle, v.pvpTitle, v.megaTitle].join(" ");
      // Buď o vývinu mluví, nebo tu roli zastane sám — Chansey je gymový
      // obránce už teď, takže odkazovat na Blissey nemá proč.
      const maRoliSam = String(v[x.role] || "").indexOf("Ne") !== 0
        && String(v[x.role] || "") !== "";
      return { niz: x.niz, role: x.role, hodnota: v[x.role], maRoliSam,
        mluviOVyvinu: /po evo|Po evoluci|po evoluci|Po vývinu|evolvovat/i.test(vse) };
    });
  });
  vyvin.forEach((x) => {
    check("„" + x.niz + "“ nese hodnotu svého vývinu, nebo roli zastane sám",
      !x.chybi && (x.mluviOVyvinu || x.maRoliSam), JSON.stringify(x));
  });

  /* ====================================================================
     KDO Z DRUHU DOSTANE MEGA SLOT
     Tři pravidla, a musí platit všechna tři najednou:
       1. přednost má kus, který si necháváš kvůli JINÉ roli (mega se sveze),
       2. mezi kusy bez role vyhraje lepší kopie — a při shodném IV je to
          ten VÝŠ LEVELEM, protože toho druhého bys musel dotáhnout prachem,
       3. kdo slot nedrží, má ve sloupci „Lepší kopie" — a kdo ho drží, nikdy.
     Bod 2 je přesně případ dvou Houndoomů po 82 %: megu dostal kus za
     1026 CP jen proto, že byl dřív v poli, a ten za 1249 CP se pouštěl.
     ==================================================================== */
  console.log("\nkomu z druhu patří mega");
  const megaVyber = await page.evaluate(async () => {
    const P = window.__pgo;
    const sber = (rows) => {
      P.setRows(rows);
      const c = P.getComputed();
      return P.getRows().map((r) => ({
        cp: r.cp, drzi: !!c[r.id].megaDrzi, mega: c[r.id].mega,
        keepSub: c[r.id].keepSub || "", megaSub: c[r.id].megaSub || ""
      }));
    };
    // a) shodné IV (15/10/12 i 13/12/12 = 37/45 = 82,2 %), různý level.
    //    Původně to byli dva Houndoomi; ten má ale od přepočtu priority
    //    Dark až třetí, takže mega slot nedostává vůbec. Pravidlo se proto
    //    zkouší na Tyranitarovi — nejlepší Dark mega, slot dostane.
    const shoda = sber([
      { pokemon: "Tyranitar", cp: 1026, level: 20, ivAtk: 15, ivDef: 10, ivSta: 12,
        fastMove: "Bite", charged1: "Crunch" },
      { pokemon: "Tyranitar", cp: 1249, level: 25, ivAtk: 13, ivDef: 12, ivSta: 12,
        fastMove: "Bite", charged1: "Crunch" }
    ]);
    // b) plný roster: mega nikdy nekotví na kusu, který si nenecháváš, a
    //    drží ji vždycky nejvýš postavená kopie druhu, co slot má
    const rows = [];
    ["Gyarados", "Charizard", "Houndoom", "Venusaur", "Alakazam", "Gengar",
     "Manectric", "Steelix", "Ampharos", "Beedrill", "Tyranitar", "Gardevoir",
     "Lucario", "Heracross"].forEach((d, i) => {
      [[15, 15, 15], [13, 12, 12], [15, 10, 12], [6, 7, 8]].forEach((iv, k) => {
        rows.push({ pokemon: d, cp: 900 + i * 30 + k * 250, level: 15 + k * 6,
          ivAtk: iv[0], ivDef: iv[1], ivSta: iv[2] });
      });
    });
    P.setRows(rows);
    const c = P.getComputed();
    const podleDruhu = {};
    P.getRows().forEach((r) => {
      (podleDruhu[r.pokemon] = podleDruhu[r.pokemon] || []).push(c[r.id]);
    });
    const plny = Object.keys(podleDruhu).map((d) => {
      const g = podleDruhu[d];
      const drzitel = g.filter((v) => v.megaDrzi);
      return {
        druh: d, drzitelu: drzitel.length,
        pustis: drzitel.some((v) => String(v.keep || "").indexOf("Zahodit") === 0),
        kopieUDrzitele: drzitel.map((v) => v.mega),
        // Druh, kterému rozpočet mega slot nedává (nízká priorita), držitele
        // nemá — tam se nemá co porovnávat.
        jinyMaLepsiKopii: !drzitel.length || g.filter((v) => !v.megaDrzi)
          .every((v) => v.mega === "Lepší kopie" || v.mega === "Ne")
      };
    });
    return { shoda, plny };
  });
  const megaDrzitel = (pole) => pole.filter((x) => x.drzi);
  check("při shodném IV drží megu jen jeden kus",
    megaDrzitel(megaVyber.shoda).length === 1, JSON.stringify(megaVyber.shoda));
  check("při shodném IV dostane megu ten výš levelem (1249 CP, ne 1026 CP)",
    (megaDrzitel(megaVyber.shoda)[0] || {}).cp === 1249, JSON.stringify(megaVyber.shoda));
  check("horší kopie má ve sloupci Lepší kopie",
    megaVyber.shoda.filter((x) => !x.drzi).every((x) => x.mega === "Lepší kopie"),
    JSON.stringify(megaVyber.shoda));
  check("držitel megy nikdy nehlásí Lepší kopie",
    megaVyber.shoda.filter((x) => x.drzi).every((x) => !/kopie/i.test(x.mega)),
    JSON.stringify(megaVyber.shoda));
  check("každý mega druh má nejvýš jednoho držitele",
    megaVyber.plny.every((x) => x.drzitelu <= 1),
    JSON.stringify(megaVyber.plny.filter((x) => x.drzitelu > 1)));
  check("mega nikdy nekotví na kusu, který podle verdiktu pouštíš",
    megaVyber.plny.every((x) => !x.pustis),
    JSON.stringify(megaVyber.plny.filter((x) => x.pustis)));
  check("aspoň některé druhy mega slot opravdu dostanou",
    megaVyber.plny.filter((x) => x.drzitelu === 1).length >= 4,
    JSON.stringify(megaVyber.plny.map((x) => x.druh + ":" + x.drzitelu)));
  check("u druhu s mega slotem hlásí Lepší kopie jen ti ostatní",
    megaVyber.plny.every((x) => x.jinyMaLepsiKopii && !x.kopieUDrzitele.some((m) => /kopie/i.test(m))),
    JSON.stringify(megaVyber.plny.filter((x) => !x.jinyMaLepsiKopii)));

  /* ====================================================================
     NA POŘADÍ V ROSTERU NESMÍ ZÁLEŽET
     Kdekoli se kusy řadí podle síly, může vyjít remíza — dva Snorlaxi
     15/15/15 mají stejnou výdrž, dva Garchompi stejný ligový rank. Když se
     remíza nerozsoudí, rozhodne pořadí v poli, tedy to, co se naskenovalo
     dřív. Takhle si dva Snorlaxi prohazovali gymový slot 5. a 6. a u Garchompa
     jeden ligový slot dostal a druhý ne. Test spočítá roster, pak ho
     pozpátku a třikrát zamíchaný, a všechna pole musí vyjít stejně.
     ==================================================================== */
  console.log("\nvýsledek nezávisí na pořadí v rosteru");
  const poradi = await page.evaluate(async () => {
    const P = window.__pgo;
    const DRUHY = ["Houndoom", "Gyarados", "Machamp", "Tyranitar", "Metagross",
      "Garchomp", "Venusaur", "Charizard", "Alakazam", "Gengar", "Manectric",
      "Steelix", "Ampharos", "Beedrill", "Blissey", "Azumarill", "Altaria",
      "Medicham", "Scizor", "Lucario", "Dragonite", "Snorlax", "Registeel",
      "Bastiodon", "Swampert", "Sceptile", "Blaziken"];
    // Stejné součty IV s různým rozložením: shodné IV %, jiný level a CP.
    const SADY = [
      [[15, 10, 12], [13, 12, 12], [12, 13, 12], [10, 15, 12]],
      [[15, 15, 15], [15, 15, 15]],
      [[14, 14, 14], [15, 13, 14], [13, 15, 14], [14, 15, 13]],
      [[10, 10, 10], [12, 9, 9], [9, 12, 9], [9, 9, 12]]
    ];
    const rows = [];
    DRUHY.forEach((d, i) => {
      SADY[i % SADY.length].forEach((iv, k) => {
        rows.push({ pokemon: d, cp: 900 + k * 120, level: 16 + k * 5,
          ivAtk: iv[0], ivDef: iv[1], ivSta: iv[2],
          forma: (i % 5 === 0 && k % 2 === 1) ? "Shadow" : "",
          dynamax: (i % 4 === 0) ? "Ano" : "" });
      });
    });
    const klic = (r) => [r.pokemon, r.cp, r.level, r.ivAtk, r.ivDef, r.ivSta, r.forma].join("/");
    const snap = () => {
      const c = P.getComputed();
      const m = {};
      P.getRows().forEach((r) => { m[klic(r)] = c[r.id]; });
      return m;
    };
    let seed = 20260914;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const zamichej = (pole) => {
      const x = pole.slice();
      for (let i = x.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const t = x[i]; x[i] = x[j]; x[j] = t;
      }
      return x;
    };
    P.setRows(rows.slice());
    await new Promise((r) => setTimeout(r, 1500));
    const zaklad = snap();
    const prvni = zaklad[Object.keys(zaklad)[0]];
    const POLE = Object.keys(prvni).filter((k) => {
      const v = prvni[k];
      return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    });
    const nalezy = [];
    const varianty = [rows.slice().reverse(), zamichej(rows), zamichej(rows), zamichej(rows)];
    for (const v of varianty) {
      P.setRows(v);
      await new Promise((r) => setTimeout(r, 600));
      const m = snap();
      Object.keys(zaklad).forEach((k) => {
        if (!m[k]) { nalezy.push("chybí kus " + k); return; }
        POLE.forEach((f) => {
          if (JSON.stringify(zaklad[k][f]) === JSON.stringify(m[k][f])) return;
          if (nalezy.length < 6) {
            nalezy.push(f + " u " + k + ": " + JSON.stringify(zaklad[k][f])
              + " vs " + JSON.stringify(m[k][f]));
          }
        });
      });
    }
    return { kusu: Object.keys(zaklad).length, poli: POLE.length,
      variant: varianty.length, nalezy };
  });
  check("roster na pořadí se poskládal", poradi.kusu > 80, String(poradi.kusu));
  check("porovnává se celý výpočet, ne jen verdikt", poradi.poli > 60, String(poradi.poli));
  check("zkouší se víc různých pořadí", poradi.variant >= 4, String(poradi.variant));
  check("žádné pole se nezmění, když se roster přeskládá",
    poradi.nalezy.length === 0, poradi.nalezy.join(" | "));

} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} kontrol prošlo, ${failures.length} selhalo`);
if (failures.length) {
  failures.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
