/**
 * Snímky do okna „Co je nového".
 *
 * Věta o změně je jedna věc, ukázat ji je druhá — u řazení nebo importu
 * je obrázek srozumitelnější než dva řádky textu. Snímky se pořizují
 * z TESTOVACÍ sestavy na ukázkovém rosteru (nikdy ne z opravdového:
 * novinky jdou do produkce všem) a ukládají se do `data/novinky_obrazky/`.
 * Odtud je `tools/novinky_obrazky.py` převede na WebP a `sync_reference.py`
 * vloží do appky jako data: URI, aby zůstala jedním souborem.
 *
 * Snímá se ve dvojnásobném rozlišení a v okně se ukazuje na poloviční
 * šířku, aby text na obrázku nebyl rozmazaný.
 *
 * Spouští se ručně, když se přidá nová verze novinek:
 *   node tools/novinky_snimky.mjs
 */
import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve('../playwright-day2/node_modules/playwright'));

const KOREN = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const CIL = path.join(KOREN, 'data', 'novinky_obrazky');
fs.mkdirSync(CIL, { recursive: true });

/* Ukázkový roster: druhy, na kterých je vidět to, o čem novinka mluví.
   Schválně malý — na snímku má být jedna věc, ne třicet dlaždic. */
const ROSTER = [
  { pokemon: 'Tinkatink', cp: 187, level: 14, ivAtk: 15, ivDef: 15, ivSta: 15 },
  { pokemon: 'Rookidee', cp: 59, level: 8, ivAtk: 14, ivDef: 15, ivSta: 15 },
  { pokemon: 'Azumarill', cp: 1400, level: 24, ivAtk: 0, ivDef: 15, ivSta: 15,
    fastMove: 'Bubble', charged1: 'Ice Beam' },
  { pokemon: 'Machamp', cp: 2600, level: 30, ivAtk: 15, ivDef: 14, ivSta: 13,
    fastMove: 'Counter', charged1: 'Dynamic Punch' },
  { pokemon: 'Charizard', cp: 2813, level: 40, ivAtk: 14, ivDef: 14, ivSta: 13,
    fastMove: 'Fire Spin', charged1: 'Overheat' },
  { pokemon: 'Gyarados', cp: 2628, level: 30, ivAtk: 12, ivDef: 12, ivSta: 12,
    fastMove: 'Waterfall', charged1: 'Aqua Tail' }
];

const prohlizec = await chromium.launch();
const stranka = await prohlizec.newPage({
  viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2
});
stranka.on('pageerror', (e) => console.log('CHYBA STRÁNKY:', e.message));
await stranka.goto(url.pathToFileURL(path.join(KOREN, 'web-app', 'pokemon_tracker_TEST.html')).href);
await stranka.waitForFunction(() => window.__pgo && window.__atlasTest, null, { timeout: 60000 });
await stranka.evaluate(async (rows) => {
  window.__pgo.setRows(rows);
  await new Promise((r) => setTimeout(r, 3000));
  window.__atlasTest.go('roster');
  await new Promise((r) => setTimeout(r, 1200));
}, ROSTER);

/**
 * Výřez kolem prvků — ne podle pevných souřadnic: ty se s každou úpravou
 * rozvržení rozejdou a snímek pak ukazuje prázdno.
 */
async function snimek(jmeno, selektory, okraj = 10, sirkaPodle = null) {
  const vyrez = await stranka.evaluate(([sel, o, cap]) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of sel) for (const el of document.querySelectorAll(s)) {
      if (el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    }
    if (!isFinite(x0)) return null;
    // Pole hledani je pres celou listu; snimek by pak ukazal i tlacitka,
    // se kterymi novinka nema nic spolecneho. `cap` orizne sirku podle
    // toho, o co ve snimku jde.
    if (cap) {
      const el = document.querySelector(cap);
      if (el) x1 = Math.min(x1, el.getBoundingClientRect().right);
    }
    return { x: Math.round(x0 - o), y: Math.round(y0 - o),
      width: Math.round(x1 - x0 + 2 * o), height: Math.round(y1 - y0 + 2 * o) };
  }, [selektory, okraj, sirkaPodle]);
  if (!vyrez) { console.log(jmeno, 'PŘESKOČENO — prvek nenalezen'); return; }
  const cesta = path.join(CIL, jmeno + '.png');
  await stranka.screenshot({ path: cesta, clip: vyrez });
  const kb = Math.round(fs.statSync(cesta).size / 1024);
  console.log(jmeno, vyrez.width + '×' + vyrez.height, kb + ' kB');
}

// 1) Štítky v hledání — kostička v poli a nabídka pod ním.
await stranka.evaluate(async () => {
  const pole = document.getElementById('searchInput');
  window.AtlasHledaniPridej && window.AtlasHledaniPridej('Water');
  await new Promise((r) => setTimeout(r, 600));
  pole.focus(); pole.value = 'Fig';
  pole.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 500));
});
await snimek('hledani-stitky', ['.atlas-hledani-roster', '.atlas-navrhy'], 4, '.atlas-navrhy');

// 2) Kostičky řazení a role.
await stranka.evaluate(async () => {
  document.querySelectorAll('.atlas-hledani-kostky .atlas-kostka button').forEach((b) => b.click());
  const pole = document.getElementById('searchInput');
  pole.value = ''; pole.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
});
await snimek('razeni-kosticky', ['.atlas-mode-controls label[for="atlasSort"]', '.atlas-razeni'], 4);

// 3) Import — plán „co se stane".
await stranka.evaluate(async () => {
  document.getElementById('toggleImportBtn').click();
  await new Promise((r) => setTimeout(r, 500));
  window.__pgo.importText([
    'Name,CP,Level,ATT IV,DEF IV,HP IV,Scan Date',
    'Machamp,2600,30,15,14,13,9/29/26 08:00:00',
    'Gyarados,2900,32,14,14,14,9/29/26 08:01:00',
    'Metagross,3050,32,15,15,14,9/29/26 08:02:00',
    'Snorlax,2477,30,12,14,15,9/29/26 08:03:00'
  ].join('\n'));
  await new Promise((r) => setTimeout(r, 900));
});
await snimek('import-plan', ['#atlasImportDialog'], 0);

// 4) Druhý nabitý útok pod „+".
await stranka.evaluate(async () => {
  document.querySelector('#atlasImportDialog header button').click();
  await new Promise((r) => setTimeout(r, 500));
  const kus = window.__pgo.getRows().find((r) => r.pokemon === 'Azumarill');
  window.__atlasTest.openDetail(kus.id);
  await new Promise((r) => setTimeout(r, 1500));
});
await snimek('druhy-nabity', ['.atlas-drawer .atlas-ident-utoky > *'], 14);

// 5) Vyhledávání: jedna výsledková tabulka místo seznamu lig.
await stranka.evaluate(async () => {
  window.__atlasTest.closeDetail();
  await new Promise((r) => setTimeout(r, 400));
  window.__pgoZalozka('prohlidkaCard');
  await new Promise((r) => setTimeout(r, 1200));
  const pole = document.getElementById('prohName');
  pole.value = 'Eevee';
  pole.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1300));
  pole.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  pole.blur();
  await new Promise((r) => setTimeout(r, 500));
});
{
  const blok = await stranka.$('.atlas-vysledek');
  const cesta = path.join(CIL, 'hledani-vysledky.png');
  if (blok) {
    await blok.screenshot({ path: cesta });
    console.log('hledani-vysledky', Math.round(fs.statSync(cesta).size / 1024) + ' kB');
  } else console.log('hledani-vysledky PŘESKOČENO — blok nenalezen');
}

// 5b) Záložky stránky druhu a sloučená raidová tabulka. Beedrill schválně:
//     má megu i shadow, takže je na jednom snímku vidět štítek formy, známka
//     i cena megy. Eevee měl třicet ligových řádků a snímek byl dva tisíce
//     pixelů vysoký — do okna novinek se takový obrázek nehodí.
await stranka.evaluate(async () => {
  const pole = document.getElementById('prohName');
  pole.value = 'Beedrill';
  pole.dataset.tiseVybrano = '1';
  pole.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1300));
  const raid = document.querySelector('.atlas-vysledek-ovladani [data-role=raid]');
  if (raid) raid.click();
  await new Promise((r) => setTimeout(r, 900));
});
await snimek('hledani-zalozky', ['.atlas-sekce-zalozky', '.atlas-vysledek-tab'], 12);

// 5c) Záložka Typy. Charizard je Fire/Flying — na dvojtypu je vidět,
//     proč se násobky počítají z kombinace (Rock 2,56×, Fighting 0,625×).
await stranka.evaluate(async () => {
  const pole = document.getElementById('prohName');
  pole.value = 'Charizard';
  pole.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1600));
  pole.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  pole.blur();
  const zalozka = [...document.querySelectorAll('.atlas-sekce-zalozky button')]
    .find((b) => /Typy/.test(b.textContent));
  if (zalozka) zalozka.click();
  await new Promise((r) => setTimeout(r, 900));
  // Vyrez se bere z okna, ne z cele stranky: co je pod hranou, by se uselo.
  document.querySelector('.atlas-typy').scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 400));
});
await snimek('hledani-typy', ['.atlas-typy'], 12);

// 5d) Evoluce a náklady. Charmander má obě mega formy, takže je na něm
//     vidět i čárkovaná větev „dočasná mega forma".
await stranka.evaluate(async () => {
  const pole = document.getElementById('prohName');
  pole.value = 'Charmander';
  pole.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1600));
  pole.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  pole.blur();
  const zalozka = [...document.querySelectorAll('.atlas-sekce-zalozky button')]
    .find((b) => /Evoluce/.test(b.textContent));
  if (zalozka) zalozka.click();
  await new Promise((r) => setTimeout(r, 900));
  const cil = document.querySelector('[data-evo-cil="charizard"]');
  if (cil) cil.click();
  await new Promise((r) => setTimeout(r, 700));
  document.querySelector('.atlas-evo').scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 400));
});
await snimek('hledani-evoluce', ['.atlas-evo'], 12);

// 6) Pruh „je nová verze". Číslo je ilustrativní — ukazuje se verze,
//    která zrovna vyšla; tady se nastaví ručně, aby bylo co nasnímat.
// 6) Verze 2.12 — ligy v jedné tabulce i s nejlepším možným IV.
await stranka.evaluate(async () => {
  const pole = document.getElementById('prohName');
  pole.value = 'Azumarill';
  pole.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1600));
  pole.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  pole.blur();
  const zalozka = [...document.querySelectorAll('.atlas-sekce-zalozky button')]
    .find((b) => /Přehled/.test(b.textContent));
  if (zalozka) zalozka.click();
  await new Promise((r) => setTimeout(r, 900));
});
await snimek('ligy-tabulka', ['.atlas-vysledek-nadpis', '.atlas-vysledek-tab'], 12);

// 7) Ligová tabulka v detailu kusu: sestava útoků i pořadí kombinace IV.
await stranka.evaluate(async () => {
  window.__atlasTest.go('roster');
  await new Promise((r) => setTimeout(r, 900));
  const kus = window.__pgo.getRows().find((r) => r.pokemon === 'Azumarill');
  window.__atlasTest.openDetail(kus.id);
  await new Promise((r) => setTimeout(r, 1600));
  document.querySelector('.atlas-drawer [data-detail-section="ligy"]')
    ?.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 400));
});
await snimek('ligy-detail', ['.atlas-drawer [data-detail-section="ligy"]'], 10);

// 8) Transfer: filtry, vlastní předfiltry a dávka na dnešek.
await stranka.evaluate(async () => {
  window.__atlasTest.closeDetail();
  await new Promise((r) => setTimeout(r, 500));
  document.getElementById('hledaniBtn').click();
  await new Promise((r) => setTimeout(r, 1200));
});
{
  /* Okno Transferu je delsi nez obrazovka. Do novinky patri jeho horni
     cast — filtry a davka na dnesek; cely vypis prikazu by byl jen zed
     textu a snimek by vazil pul megabajtu. */
  const vyrez = await stranka.evaluate(() => {
    const e = document.getElementById('hledaniOkno');
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(Math.max(0, r.left)), y: Math.round(Math.max(0, r.top)),
      width: Math.round(Math.min(r.width, window.innerWidth)),
      height: Math.min(430, Math.round(r.height)) };
  });
  if (vyrez) {
    const cesta = path.join(CIL, 'transfer-okno.png');
    await stranka.screenshot({ path: cesta, clip: vyrez });
    console.log('transfer-okno', vyrez.width + '×' + vyrez.height,
      Math.round(fs.statSync(cesta).size / 1024) + ' kB');
  } else console.log('transfer-okno PŘESKOČENO — okno nenalezeno');
}

// 9) Přehled: co se hraje v GO Battle League teď a co přijde.
await stranka.evaluate(async () => {
  document.getElementById('hledaniBtn').click();
  await new Promise((r) => setTimeout(r, 400));
  window.__atlasTest.go('home');
  await new Promise((r) => setTimeout(r, 1600));
  document.querySelector('.ac-ligy')?.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 400));
});
await snimek('kalendar-ligy', ['.ac-ligy'], 10);

await stranka.evaluate(async () => {
  window.__atlasTest.closeDetail();
  await new Promise((r) => setTimeout(r, 500));
  window.__pgo.verzeZkontroluj({ verze: '3.0', sestaveno: '2026-10-01 09:00' });
  await new Promise((r) => setTimeout(r, 500));
});
await snimek('nova-verze', ['#verzePruh'], 0);
// Ať se stránka pod skriptem neobnoví.
await stranka.evaluate(() => document.querySelector('[data-verze-pozdeji]')?.click());

// 11) Verze 2.13 — okno, kterým se appka ptá na roster z cloudu. Data jsou
//     vymyšlená: přihlášení z kopie na disku nejde a do novinek nepatří
//     cizí roster.
await stranka.evaluate(async () => {
  window.__atlasTest.closeDetail();
  window.__atlasTest.go('roster');
  await new Promise((r) => setTimeout(r, 700));
  const kusy = window.__pgo.getRows();
  const kus = (jmeno) => kusy.find((r) => r.pokemon === jmeno) || kusy[0];
  window.AtlasCloudOtazka({
    ulozeno: new Date('2026-11-03T11:46:00').toISOString(),
    zarizeni: 'Telefon', kusuVCloudu: 408,
    pridane: [kus('Tinkatink'), kus('Rookidee')],
    zmenene: [{ moje: Object.assign({}, kus('Machamp'), { cp: 2600 }),
      jejich: Object.assign({}, kus('Machamp'), { cp: 2812 }) }],
    smazane: [kus('Gyarados')],
    konflikty: [{ sid: 'x', jmeno: 'Charizard',
      moje: kus('Charizard'), jejich: kus('Charizard') }],
  }, () => {});
  await new Promise((r) => setTimeout(r, 900));
  document.querySelectorAll('.atlas-import-group')[0]?.setAttribute('open', '');
  await new Promise((r) => setTimeout(r, 500));
});
await snimek('cloud-okno', ['.atlas-import-result'], 10);

// 12) Verze 2.13 — Nastavení po přeskládání: cloud nahoře, sekce místo
//     jednoho sloupce.
await stranka.evaluate(async () => {
  document.getElementById('atlasImportDialog')?.close();
  window.__atlasTest.go('settings', 'settings-card');
  await new Promise((r) => setTimeout(r, 900));
});
await snimek('nastaveni-sekce', ['.settings-card .nast-sekce'], 12);

// 13) Verze 2.13 — výklad pod otazníkem stojí nad appkou, ne pod řádkem.
//     Ztmavená karta pod ním je na snímku to podstatné: stránka se nehnula.
await stranka.evaluate(async () => {
  const radek = [...document.querySelectorAll('.atlas-setting-row')]
    .find((r) => r.querySelector('input,select').id === 'keepCopies');
  if (radek) radek.dataset.snimek = '1';
  radek?.querySelector('.atlas-help-button')?.click();
  await new Promise((r) => setTimeout(r, 600));
});
await snimek('nastaveni-vyklad', ['.atlas-help-pop-box', '[data-snimek]'], 14);

await prohlizec.close();
console.log('hotovo →', CIL);
