# Kontrakt mezi enginem a vzhledovou vrstvou

Appka je jeden HTML soubor, ale píšou do ní dva lidi. Aby se nepřepisovali,
je rozdělená na **engine** (rozhodování a data) a **vzhledovou vrstvu**
(jak to vypadá a jak se to ovládá). Tenhle soubor říká, kde je hranice.

Poslední aktualizace: 12. 9. 2026.

## Kdo drží co

| | Soubor | Kdo |
| --- | --- | --- |
| engine, data, rozhodování | `web-app/pokemon_tracker_app.html` | Claude |
| vzhled, styly | `web-app/atlas/atlas.css` | vzhledová vrstva |
| vzhled, chování UI | `web-app/atlas/atlas.js` | vzhledová vrstva |
| obrázky | `web-app/atlas/atlas-art.json` | vzhledová vrstva |

`tools/sync_reference.py` při buildu vezme obsah `atlas.css` a `atlas.js`
a vloží ho do hlavního souboru mezi značky `ATLAS CSS` a `ATLAS JS`.
Do hlavního HTML se proto **ručně nesahá** — při dalším buildu to zmizí.

Kam se to vkládá a proč:

- **CSS** úplně nakonec `<style>`. Přebije tím výchozí vzhled jen tím, že
  stojí níž, takže není potřeba `!important`.
- **JS** až za celý engine. Když kód doběhne, `window.__pgo` už existuje
  a první vykreslení je hotové.

Ověření, že se to zapeklo, vypíše `sync_reference.py` řádkem `vzhled:`.

## Obrázky se do HTML nezapékají

`atlas-art.json` se kopíruje vedle appky a stahuje se **až když je potřeba**.
Zapečený do HTML dělal ze souboru 31 MB místo 1,6 MB, engine se rozjížděl
1616 ms místo 308 ms a paměť vyskočila z 10 MB na 73 MB. Offline se obrázky
nepotřebují — appka jede z GitHub Pages.

## Co engine nabízí

Všechno visí na `window.__pgo`. Celkem 152 funkcí, tady je to, o co se
vzhledová vrstva opravdu opírá:

### Roster a přepočet

| Volání | Co vrátí |
| --- | --- |
| `getRows()` | pole kusů tak, jak je zadal uživatel |
| `getComputed()` | mapa `id kusu → vyhodnocení` |
| `base()` | mezivýpočet pro každý kus (staty, role, sloty, cesty do lig) |
| `setRows(pole)` | nahradí roster a přepočítá |
| `prekreslit()` | překreslí tabulku |
| `prepocitat()` | jen přepočítá |
| `snapshot()` | stav řazení a filtrů |

### Plány a seznamy

`prachovyPlan()`, `getPlan()`, `getKeepList()`, `getCheatSheet()`,
`getEvolvePlan()`, `getEliteTmPlan()`, `coChytat()`, `gymPlan()`,
`tradePairs()`.

### Ovládání, které si vrstva dělá po svém

Vrstva neřadí klikáním do hlavičky tabulky a detail kusu neotvírá pod řádkem,
ale ve vlastní plachtě. Aby se kvůli tomu nemusel upravovat engine zvenčí,
je obojí jeho veřejnou součástí.

| Volání | Co dělá |
| --- | --- |
| `atlasSort(klic, smer)` | seřadí roster; `smer` 1 vzestupně, −1 sestupně |
| `atlasDetail(id, kontejner, zavrit)` | vykreslí detail kusu do cizího prvku a napojí jeho ovládání |
| `atlasImage(jmeno, trida)` | obrázek druhu jako hotová značka `<img>` i se záložním zdrojem |

`atlasSort` bere jen ty klíče, které umí řadit i hlavička tabulky. Kdyby si
vrstva držela vlastní seznam, rozešel by se s enginem při prvním novém
sloupci. Na neznámý klíč se stav nezmění vůbec a vrátí se `false`. Prázdný
klíč řazení zruší. Druhotné řazení (Shift+klik v hlavičce) se ruší vždycky,
protože rozbalovátko umí zvolit jen jedno kritérium. Zvolené řazení si
přečteš ze `snapshot()` jako `sortKey` a `sortDir`.

`atlasImage` je to, na co vrstva spadne zpátky, když pro druh nemá vlastní
art. Je to tentýž obrázek, jaký ukazuje řádek rosteru, takže se obojí
nerozejde. Neznámý druh vrátí prázdný řetězec.

`atlasDetail` vrátí `false`, když kus neexistuje nebo kontejner chybí. Obsah
i chování jsou tytéž jako v detailu pod řádkem, včetně přepínačů Lucky,
Dynamax, CUTE a skládání dlouhých textů. Vrstva dodá jen místo a funkci,
kterou se detail zavírá.

### Události

| Událost na `window` | Kdy přijde | `detail` |
| --- | --- | --- |
| `atlas:route` | uživatel přepnul záložku | klíč záložky |
| `atlas:refresh-detail` | v otevřeném detailu se něco změnilo | — |

`atlas:route` chodí i při tichém přepnutí. Tiché znamená neposkakovat
stránkou, ne zamlčet, že se záložka změnila.

`atlas:refresh-detail` je signál, že se přepočítal verdikt kusu, který má
vrstva otevřený. Sama to nepozná, takže na tuhle událost detail otevře znovu.
Posílá ji engine; vrstva ji smí poslat i sama, když si kus upraví.

### Data a výpočty

`pokedex()`, `meta()`, `movesData()`, `eventsData()`, `dataInfo` (objekt,
ne funkce — datumy zdrojů),
`dexEntry(jmeno)`, `dexByKey(klic)`, `dexKeyOf(jmeno)`, `cpAt(...)`,
`cpNaLevelu(...)`, `levelZCP(...)`, `upgradeCost(od, do, forma, jmeno)`,
`ligovePoradi(klic, liga, forma)`, `raidRankIndex()`, `gymRankIndex()`,
`counterScore(b, typyBosse)`, `speciesMaxSP(...)`, `formatDust(n)`.

## Pole na vyhodnoceném kusu

`getComputed()[id]` má 84 polí. Stabilní jádro, na které se dá spolehnout:

| Pole | Význam |
| --- | --- |
| `keep`, `keepGood` | verdikt a jestli je to „nechat" |
| `keepSub`, `keepTitle`, `keepTone` | důvod krátce, celé a barva |
| `ivPct` | IV jako podíl 0–1 (`1` = 15/15/15) |
| `powerup`, `powerupSub`, `powerupTone` | má se do kusu sypat prach |
| `cost`, `costText` | cena dotažení; **už zná Lucky, Shadow i Purified** |
| `raid`, `raidPct`, `raidRec`, `raidTitle` | raidová role |
| `gym`, `gymPct`, `gymRec`, `gymTitle` | gymová role |
| `pvpRec`, `pvpLigy`, `pvpPot`, `pvpSub` | ligy |
| `evolve`, `evolveSub`, `evolveTone` | evoluce |
| `mega`, `megaKandidat`, `megaSub` | mega |
| `trade`, `tradeFree`, `tradeSub` | výměna |
| `purify`, `purifySub` | očista |
| `worseCopy`, `copies`, `procKopie` | kopie téhož druhu |
| `jenZnamka` | drží ho jen CUTE nebo 100 %, žádnou roli nezastává |
| `jeMezera` | drží roli jen jako náplast |
| `stoProcent`, `cute`, `shiny`, `lucky`, `dynamax` | značky |
| `strong`, `strongAll`, `strongTypes` | proti čemu je silný |
| `utoky` | posudek KAŽDÉHO útoku zvlášť (viz níž) |
| `movesBest` | nejlepší možná sestava druhu jako text |
| `movesBestFinal` | nejlepší sestava formy, kterou se kus teprve stane |
| `finalFormaJmeno` | jméno té formy; obojí prázdné u finální evoluce |
| `moves`, `movesSub`, `movesTitle`, `movesTone` | shrnutí sestavy |

### `utoky` — posudek jednotlivého útoku

Pole `getComputed()[id].utoky` je pole záznamů, jeden na každý vyplněný útok
v pořadí rychlý, nabitý, druhý nabitý:

| Klíč | Význam |
| --- | --- |
| `jm` | jméno útoku |
| `typ` | typ útoku (`Fighting`, `Steel`, …) — barvu vezmi z `typeColors()` |
| `rychly` | `true` u rychlého útoku |
| `druhy` | `true` u druhého nabitého |
| `stav` | `nej`, `dobry`, `preucit`, `poEvoluci` nebo `nezna` |
| `znacka` | `★` u elitního útoku, jinak prázdné |
| `proc` | celá věta proč — do bubliny |

Prázdné pole znamená, že útoky vyplněné nejsou. Pak má cenu ukázat jedině
`movesBest`, tedy nejlepší možnou sestavu toho druhu.

Jak se `stav` určuje: spočítá se cyklus s tím útokem a cyklus s nejlepší
náhradou. Do 5 % ztráty je to `dobry` (přeučovat se nevyplatí), nad tím
`preucit`. Útok v doporučené sestavě od PvPoke je `nej` i tehdy, když do raidu
nevede. Frustration a Return se neposuzují jako volba — ty dává stav kusu.

`poEvoluci` je `preucit` u kusu, který se teprve bude vyvíjet. **Evolucí se ve
hře celý moveset losuje znovu**, takže TM utracený předtím je vyhozený —
rada proto nezní „přeuč", ale „počkej". Sestavu, která bude platit potom,
nese `movesBestFinal`.

Poznámka k `movesBest`: je to sestava druhu, kterým kus je **teď**. U
Fletchlinga vyjde „Peck + Fly", jenže s Fletchlingem do raidu nikdo nejde.
Co bude umět Talonflame, říká `movesBestFinal`.

### `dpsSestavy(druh, rychlyUtok, nabityUtok)`

Poškození za vteřinu celého cyklu. Je to číslo, podle kterého se pak počítá
raidová role — ne surová síla útoku. Surová síla neříká, jak dlouho útok trvá
ani kolik energie stojí: Karate Chop má vyšší sílu než Counter a přesto je
u Machampa horší.

## Pravidla

**Engine se z vzhledové vrstvy neupravuje.** Když něco chybí, řekne se o pole
jménem a doplní se do enginu i s testem. Přepsat `computed` po `analyze()`
znamená, že se oprava ve výpočtu tiše ztratí — přesně tak by zmizela sleva
za Lucky, kdyby si vrstva počítala cenu sama.

**Vlastní třídy prefixovat `atlas-`**, ať je poznat, co je čí.

**Barvy z proměnných** (`--surface-1`, `--text-primary`, `--series-1` a další),
jinak se rozbije tmavý režim.

**Appka drží do 500 px šířky.** Pod tím se nepodporuje.

**Roster se do souboru nezapéká.** Testovací data patří do zvláštního profilu,
který se zapíná ručně, ne při načtení stránky. Jinak proti buildu nejdou pustit
regresní testy — ty začínají prázdnou appkou. A skutečný roster nemá co dělat
v souboru, který se nasazuje na veřejné GitHub Pages.

## Než se něco spojí dohromady

1. Vzít **aktuální** `pokemon_tracker_app.html`, ne starší kopii.
2. Vlastní změny mít jen v `web-app/atlas/`.
3. `python tools/sync_reference.py` zapeče vzhled do appky.
4. `node tests/web_app.test.mjs` a `node tests/audit_app.test.mjs` musí projít.
5. Teprve pak `tools/deploy.ps1`.
