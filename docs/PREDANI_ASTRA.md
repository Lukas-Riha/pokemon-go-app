# Předání: jak přesunout GO Atlas do vlastních souborů

Pro toho, kdo drží vzhledovou vrstvu. Napsáno 9. 9. 2026 po prohlídce
`web-app/pokemon_tracker_TEST.html` (31,75 MB, 22 825 řádků).

Cíl: přestat udržovat vlastní kopii celého HTML a pracovat jen ve dvou
souborech. Engine se tím přestane rozcházet a merge odpadne úplně.

## Co jsem viděl a co na tom stojí za pochvalu

Vrstva staví na enginu správně: čte `getRows`, `getComputed` a `snapshot`,
používá `keepGood`, `ivPct` a `powerup`. Převzalo se i to, že `upgradeCost`
dostává formu kusu, takže sleva za Lucky nezmizela. To je přesně to chování,
na kterém se dá stavět dál.

Dvě věci navíc řeší to, co v enginu chybělo:

- `atlasTarget(b, c, s)` — jeden společný plán kusu (cíl, level, CP, cena).
  To je nález číslo 1 z auditu, který jsem já neudělal.
- `atlasIssues(b)` — kontrola, že CP, IV a level dávají dohromady smysl.
  Nález číslo 7.

**Obojí bych rád převzal do enginu**, protože tam patří: je to rozhodování,
ne vzhled. Pak by `activePlan` a `validationIssues` chodily z `getComputed()`
jako každé jiné pole a byly by pokryté testy.

## Tři věci, které je potřeba změnit

### 1. Nesahat do `computed` po výpočtu

`atlasFinalize` přepisuje `c.cost` a `c.costText` vlastním výpočtem. Dokud to
počítá totéž, nic se nestane. Jenže engine se mění: 9. 9. přibyla cena podle
stavu kusu (Lucky půlka prachu, Shadow ×1,2, Purified ×0,9). Kdyby si vrstva
cenu spočítala po svém, ta oprava zmizí a nikdo si toho nevšimne.

Pravidlo: co chybí, se doplní do enginu jako pojmenované pole i s testem.
Řekni si o pole jménem, doplním ho.

### 2. Obrázky ven ze souboru

`window.ATLAS_ART` je 172 obrázků v base64, tedy 30 z těch 31 MB. Naměřeno:

| | GO Atlas | produkce |
| --- | --- | --- |
| velikost | 31,75 MB | 1,58 MB |
| engine hotový za | 1616 ms | 308 ms |
| paměť | 73 MB | 10 MB |

Offline se obrázky nepotřebují, appka jede z GitHub Pages. Ať tedy `atlas-art.json`
leží vedle appky a stahuje se, až když je potřeba.

### 3. Roster se do souboru nezapéká

Na řádku 2669 je `localStorage.setItem('pgo_test_tracker_v2', …)` s celým
rosterem. Dvě potíže. Odjede na veřejné GitHub Pages, protože se nasazuje
celý soubor. A rozbije to regresní testy: všech 1931 začíná prázdnou appkou,
takže první test spadne hned na „nová appka startuje prázdná".

Testovací data patří za tlačítko nebo za parametr v adrese, ne do načtení stránky.

## Jak přesun udělat

1. Vzít **aktuální** `web-app/pokemon_tracker_app.html`. Ta kopie z rána je
   o dvě dávky pozadu, chybí v ní `jenZnamka`, `zbyvaCelkem` a `nejUtocniciNaTyp`.
2. Všechny styly `atlas-*` přesunout do `web-app/atlas/atlas.css`.
3. Všechny funkce `atlas*` a obsluhu UI přesunout do `web-app/atlas/atlas.js`.
   Soubor už má hlavičku a obal, stačí psát dovnitř.
4. Obrázky do `web-app/atlas/atlas-art.json`, načítat je až na vyžádání.
5. Smazat `web-app/pokemon_tracker_TEST.html` — od té chvíle ho vyrábí build.
6. Sestavit a zkontrolovat:

```
python tools/sync_reference.py --test
node tests/web_app.test.mjs
node tests/audit_app.test.mjs
```

Build vloží styly na konec `<style>` a skript až za engine, takže se na
`window.__pgo` dá spolehnout hned a CSS přebije výchozí vzhled bez `!important`.
Výsledek je `web-app/pokemon_tracker_TEST.html`.

Do produkce se zatím nic nepřeklápí: `tools/deploy.ps1` odmítne běžet, dokud
v kořeni leží `PRODUKCE_ZAMCENA.txt`.

## Kde je zbytek

Seznam funkcí a polí, na které se dá spolehnout, je v `docs/ATLAS_KONTRAKT.md`.
Hlídá ho testovací blok 222 — když něco přejmenuju, spadne to u mě, ne až tady.

## Odpověď na A-003 — API detailu, řazení a route je v kontraktu (11. 9.)

Prosba z A-003 splněna. To, co se do enginu vpichovalo při sestavení testovací
verze, je od teď jeho veřejná součást, takže z `tools/atlas_test_hooks.py`
zmizela celá ta část.

Nové na `window.__pgo`:

| Volání | Co dělá |
| --- | --- |
| `atlasSort(klic, smer)` | seřadí roster, `smer` 1 vzestupně, −1 sestupně |
| `atlasDetail(id, kontejner, zavrit)` | vykreslí detail kusu do cizího prvku a napojí ovládání |
| `atlasImage(jmeno, trida)` | obrázek druhu jako hotová značka `<img>` i se záložním zdrojem |

Událost `atlas:route` posílá engine sám při každé změně záložky, včetně tiché.
`atlas:refresh-detail` chodí dál po každé změně v otevřeném detailu.

Tři věci se oproti háčkům chovají jinak, všechny ve prospěch vrstvy:

1. `atlasSort` bere **všechny** sloupce, které umí řadit hlavička tabulky, ne
   jen čtyři napevno. Neznámý klíč stav nezmění a vrátí `false`, prázdný klíč
   řazení zruší.
2. `atlasDetail` vrací `false` místo tichého konce, když kus neexistuje nebo
   chybí kontejner.
3. `atlasImage` je nový. Vrstva ho volala, ale v enginu nikdy nebyl — bez
   zapečeného artu to padalo na `P.atlasImage is not a function`. Vrací tentýž
   obrázek jako řádek rosteru.

V `atlas_test_hooks.py` zbylo jen oddělení úložiště (`pgo_` → `pgo_test_`) a
pojistka, která build zastaví, kdyby některá z těch funkcí z enginu zmizela.

Hlídá to testovací blok 227 a rozšířený 222. Nově je mezi nimi i kontrola,
která přečte `web-app/atlas/atlas.js` a ověří, že každé volání enginu v něm
opravdu existuje — přesně tenhle typ chyby jsi u `atlasImage` narazila.

Ověřeno: 2012 regresních testů a 68 kontrol auditu prošlo, testovací build
naskočí za 244 ms bez jediné chyby v konzoli, úložiště je oddělené (žádný
produkční klíč). Nic se nenasazovalo, `PRODUKCE_ZAMCENA.txt` leží dál.

## Co přibylo 11. a 12. 9. — a co z toho je na tobě

Všechno níž je v ENGINU, takže se to do testovací verze dostane samo:

```
python tools/sync_reference.py --test
```

Layout ani styly jsem nesahal mimo `web-app/pokemon_tracker_app.html`.

### Nová pole na `getComputed()[id]`

| Pole | Co to je |
| --- | --- |
| `movesBestFinal` | nejlepší sestava formy, kterou se kus teprve stane |
| `finalFormaJmeno` | jméno té formy; obojí prázdné u finální evoluce |

A `utoky[].stav` má novou hodnotu **`poEvoluci`**. Je to `preucit` u kusu, který
se teprve bude vyvíjet: evolucí se ve hře moveset losuje znovu, takže TM
utracený předtím je vyhozený. Kdo si stav mapuje na barvy, musí ji doplnit —
jinak vypadne do výchozí větve.

### Nové API

| Volání | Co dělá |
| --- | --- |
| `hraOtevri(id, akce, cil)` | okno „co se s kusem stalo ve hře"; akce `evoluce`, `vylepseni`, `ocista` |
| `hraUloz()` | zapíše změnu, vrátí text chyby nebo `null` |
| `hraZavri()` | zavře okno |
| `evoKroky(radek)` | na co se kus může vyvinout (jeden krok dopředu) |
| `cpPodleUdaju(radek)` | CP z druhu, levelu a IV |
| `zamerKus(id)` | sjede na kus, otevře mu detail a zvýrazní ho |

### Co se změnilo ve vzhledu rosterového detailu

- V hlavičce detailu je vedle křížku `<span class="hra-pruh">` s tlačítky
  `[data-hra]`. Je to oprava údajů, ne hlavní obsah — proto natěsno u křížku.
- Přibyla sekce `[data-sekce="sestavy"]` a hned za ní `div.d-sestavy`
  se dvěma sloupci: sestava teď a sestava po evoluci.
- Prvky `.d-move-poEvoluci` potřebují vlastní barvu.
- `bezVerdiktu()` obojí odstraňuje, takže v čištění boxu a v prohlídce to
  nevidíš. Kdybys detail skládala jinak, počítej s tím.

### Co je opravené a nemá se vracet

- Systémový `title` na `.d-evo-kus` se nastavit NESMÍ: appka si ho přepisuje
  do vlastní bubliny a přepsal by její obsah.
- Kartička „Doskenovat" bere hodnotu a důvod z `c.rescan` / `c.rescanTitle`,
  ne natvrdo „Ano".
- Enter v seznamu útoků potvrzuje vybranou položku; dřív ho spotřebovala
  první podmínka na zavření seznamu.

Nic z toho není nasazené a `PRODUKCE_ZAMCENA.txt` leží dál.
