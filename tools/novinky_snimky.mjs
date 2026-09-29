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

// 5) Pruh „je nová verze". Číslo je ilustrativní — ukazuje se verze,
//    která zrovna vyšla; tady se nastaví ručně, aby bylo co nasnímat.
await stranka.evaluate(async () => {
  window.__atlasTest.closeDetail();
  await new Promise((r) => setTimeout(r, 500));
  window.__pgo.verzeZkontroluj({ verze: '3.0', sestaveno: '2026-10-01 09:00' });
  await new Promise((r) => setTimeout(r, 500));
});
await snimek('nova-verze', ['#verzePruh'], 0);
// Ať se stránka pod skriptem neobnoví.
await stranka.evaluate(() => document.querySelector('[data-verze-pozdeji]')?.click());

await prohlizec.close();
console.log('hotovo →', CIL);
