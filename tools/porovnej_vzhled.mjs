/**
 * Porovná VYKRESLENÍ testu a produkce — prvek po prvku, obrázek po obrázku.
 *
 * `porovnej_test_a_produkci.py` porovná soubory. Jenže appka si část vzhledu
 * dopočítá až za běhu (vystřeďování spritů dopisuje `transform` přímo do
 * značky), a to se stane jen tehdy, když má co měřit — tedy na profilu
 * s rosterem. Proto tenhle skript do obou sestavení nasype TENTÝŽ roster,
 * počká, až se appka usadí, a teprve pak měří.
 *
 * Měří se to, co člověk doopravdy vidí: `getBoundingClientRect`, tedy
 * rozměr VČETNĚ transformace. Projde se každý viditelný prvek na každé
 * stránce, obě sestavení ve stejném pořadí, a porovná se položka po položce.
 *
 * Spuštění:
 *   node tools/porovnej_vzhled.mjs
 *   node tools/porovnej_vzhled.mjs --sirka 2210
 *   node tools/porovnej_vzhled.mjs --adresa https://…/
 *
 * Skončí nulou, když se vykreslení shoduje.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TEST = path.join(ROOT, "web-app", "pokemon_tracker_TEST.html");
const ADRESA = "https://lukas-riha.github.io/pokemon-go-app/";
const POHLEDY = ["home", "roster", "teams", "invest", "events", "settings"];

const arg = (jmeno, vychozi) => {
  const i = process.argv.indexOf("--" + jmeno);
  return i > -1 ? process.argv[i + 1] : vychozi;
};
const SIRKA = Number(arg("sirka", 2210));
const adresa = arg("adresa", ADRESA);

function loadChromium() {
  const require = createRequire(import.meta.url);
  for (const p of [
    path.resolve(ROOT, "node_modules/playwright"),
    path.resolve(ROOT, "../playwright-day2/node_modules/playwright"),
    path.resolve(ROOT, "../playwright-day2/node_modules/playwright-core"),
  ]) if (fs.existsSync(p)) return require(p).chromium;
  throw new Error("Playwright nenalezen.");
}

/** Roster, který se nasype do obou. Musí být stejný, jinak se porovnává
 *  jablko s hruškou — a dost velký, aby appka měla co měřit. */
function rosterSkript() {
  return `(() => {
    const P = window.__pgo;
    const klice = Object.keys(P.pokedex().species).sort().slice(0, 220);
    const jmena = klice.map(k => P.dexEntry(k) && P.dexEntry(k).name).filter(Boolean);
    // Útoky se doplňují schválně: bez nich engine nenabídne žádný
    // investiční krok, dlaždice „Co připravit jako první“ zůstanou prázdné
    // a nikdy se neporovnají. (Přesně tam se pak našel rozdíl, který tohle
    // porovnání mělo najít.)
    P.setRows(jmena.map((n, i) => {
      const u = P.utokyDruhu ? P.utokyDruhu(n) : null;
      return {
        // CP se schvalne nevyplnuje: nesedici CP je "chyba v datech"
        // a engine takovy kus z planu vyradi, takze by dlazdice opet
        // zustaly prazdne.
        pokemon: n, level: 10 + (i % 30),
        ivAtk: 15, ivDef: 15, ivSta: 15,
        fastMove: (u && u.fast && u.fast[0]) || "",
        charged1: (u && u.charged && u.charged[0]) || ""
      };
    }));
    return P.getRows().length;
  })()`;
}

/** Otisk vykreslení: každý viditelný prvek jako jeden řádek. */
function otiskSkript() {
  return `(() => {
    const ven = [];
    const vse = document.querySelectorAll("#atlasShell *, .app *");
    for (const el of vse) {
      // Testovací odznaky do produkce nepatří a je to v pořádku — spolu
      // s nimi se vynechávají i rámečky, které je obsahují (jinak by se
      // lišily o jejich výšku) a číslo verze, které se liší záměrně.
      if (el.closest("[data-atlas-test-badge]")) continue;
      if (el.querySelector("[data-atlas-test-badge]")) continue;
      if (el.id === "atlasCrumbVerze" || el.id === "atlasVerze") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const c = getComputedStyle(el);
      const obr = el.tagName === "IMG";
      ven.push([
        el.tagName.toLowerCase(),
        (el.id || ""),
        String(el.className || "").slice(0, 40),
        obr ? (el.getAttribute("alt") || "") : "",
        Math.round(r.width) + "x" + Math.round(r.height),
        c.transform === "none" ? "-" : c.transform,
        obr ? String(el.currentSrc || el.src).split("/").pop().slice(0, 30) : "",
      ].join(" | "));
    }
    return ven;
  })()`;
}

const chromium = loadChromium();
const browser = await chromium.launch();
const chyby = [];

async function posbirej(kde, zivy) {
  const page = await browser.newPage({ viewport: { width: SIRKA, height: 1200 } });
  page.on("pageerror", (e) => chyby.push(kde + ": " + String(e).slice(0, 120)));
  await page.goto(zivy ? kde : pathToFileURL(kde).href);
  await page.waitForFunction(() => window.__pgo && window.__atlasTest, null, { timeout: 60000 });
  const kusu = await page.evaluate(rosterSkript());
  // Vystřeďování spritů měří obrázky na pozadí; bez čekání by se otisk
  // pořídil dřív, než appka svoje `transform` vůbec dopíše.
  await page.waitForTimeout(6000);
  const otisky = {};
  for (const pohled of POHLEDY) {
    await page.evaluate((v) => window.__atlasTest.go(v), pohled);
    await page.waitForTimeout(2500);
    // Obrázky se načítají líně (`loading=lazy`), takže dokud se na ně
    // nesroluje, nejsou stažené. Bez tohohle by se místo vzhledu porovnával
    // závod v načítání.
    await page.evaluate(async () => {
      const krok = Math.round(window.innerHeight * 0.8);
      for (let y = 0; y < document.body.scrollHeight; y += krok) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    // Vystredovani spritu se spusti az tehdy, kdyz ma appka co merit —
    // tedy na skutecne pouzivanem profilu. Cerstvy profil ho nikdy
    // nevyvola, takze by se porovnaval stav, ktery clovek nikdy nevidi.
    // Proto se vynuti natvrdo, v obou sestavenich stejne.
    await page.evaluate(() => {
      if (window.__pgo && window.__pgo.vystreditSprity) {
        window.__pgo.vystreditSprity(document.body);
      }
    });
    await page.waitForTimeout(3500);
    otisky[pohled] = await page.evaluate(otiskSkript());
  }
  // A ještě detail kusu — tam vystřeďování opravdu běží.
  await page.evaluate(() => {
    window.__atlasTest.go("roster");
    window.__atlasTest.openDetail(window.__pgo.getRows()[0].id);
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    if (window.__pgo && window.__pgo.vystreditSprity) {
      window.__pgo.vystreditSprity(document.body);
    }
  });
  await page.waitForTimeout(3500);
  otisky.detail = await page.evaluate(otiskSkript());
  const verze = await page.evaluate(() => window.__pgo.verze && window.__pgo.verze());
  await page.close();
  return { otisky, kusu, verze };
}

console.log("sirka okna: " + SIRKA + " px");
console.log("test:     " + TEST);
console.log("produkce: " + adresa);
console.log("");

const t = await posbirej(TEST, false);
const p = await posbirej(adresa, true);
await browser.close();

console.log("roster: test %d kusu (verze %s), produkce %d kusu (verze %s)\n",
  t.kusu, t.verze, p.kusu, p.verze);

let rozdilu = 0, porovnano = 0;
for (const pohled of [...POHLEDY, "detail"]) {
  const a = t.otisky[pohled] || [], b = p.otisky[pohled] || [];
  porovnano += Math.max(a.length, b.length);
  const nalez = [];
  if (a.length !== b.length) {
    nalez.push("  ruzny pocet prvku: test " + a.length + ", produkce " + b.length);
  }
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    if (nalez.length < 12) {
      nalez.push("  test:     " + a[i]);
      nalez.push("  produkce: " + b[i]);
    }
  }
  if (nalez.length) {
    rozdilu++;
    console.log("ROZDIL — " + pohled + " (" + a.length + " prvku):");
    nalez.forEach((x) => console.log(x));
    console.log("");
  } else {
    console.log("OK     — " + pohled + " (" + a.length + " prvku sedi)");
  }
}

if (chyby.length) console.log("\nCHYBY V KONZOLI:\n  " + chyby.join("\n  "));
console.log("");
if (rozdilu) {
  console.log("VYKRESLENI SE LISI v " + rozdilu + " pohledech.");
  process.exit(1);
}
console.log("Vykresleni je shodne (" + porovnano + " prvku pres " + (POHLEDY.length + 1) + " stranek).");
process.exit(chyby.length ? 1 : 0);
