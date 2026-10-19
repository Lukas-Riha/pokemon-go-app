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
| `atlasPoradi()` | pořadí kusů (pole `id`) tak, jak zrovna prochází hledáním, filtrem a řazením |
| `atlasImage(jmeno, trida)` | obrázek druhu jako hotová značka `<img>` i se záložním zdrojem |
| `atlasDuvody(id nebo computed)` | štítky k verdiktu jako hotové HTML (`.dv-radek` se štítky a bublinami `data-tip`). Ponechaný kus: důvody. Pouštěný kus: štítky „pod čarou" (`.dv-radek-pod`, `.dv-chip.dv-pod`, kvalita `.dv-kvalita`) — kde se nevešel; `""`, když nemá kde |
| `atlasRozlozFormu(text)` | „Shadow Snorlax" → `{jmeno:"Snorlax", forma:"Shadow"}`; jedno místo pro motor i vrstvu |
| `atlasMaShadow(jmeno)` | vede PvPoke pro ten druh shadow žebříček? jen tehdy má smysl nabízet přepnutí |
| `prohlidkaModel(jmeno, forma?)` | model druhu pro vyhledávání; nese `forma`, `maShadow` a CELOU evoluční řadu |
| `atlasDmax(jmeno)` | pořadí druhu mezi Dynamax útočníky po typech, nebo `null`. Čísla jsou model Pokémon GO Hubu, ne appky |
| `atlasDmaxZdroj()` | odkud a k jakému dni Dmax čísla jsou — musí stát u každého místa, kde se ukazují |
| `atlasStropLigy(jmeno, limit, iva, ivd, ivs)` | nejvyšší půllevel, kde se kus ještě vejde pod limit ligy |
| `atlasRankLimit()` | do kolikátého místa v lize bere člověk druh vážně (z nastavení) |
| `atlasCounterStav()` / `atlasCounterZrus()` | proti kterému druhu se roster zrovna poměřuje; druhé to vypne |
| `atlasDuplikatPrepni(id, hodnota?)` | přepne odbavení podezření na duplikát (štítek u kusu zůstává) |
| `srovnejDuvody(kontejner)` | po vložení štítků schová, co se do šířky nevejde, do „+N" s bublinou |
| `utokyDruhu(jmeno)` | útoky, které se druh může naučit: `{fast: [jména], charged: [jména], znamy}`; neznámý druh vrátí všechny |
| `atlasSort("liga:LC"/"liga:GL"/"liga:UL"/"liga:ML", 1/-1)` | řazení podle pořadí druhu v jedné lize; kdo ji nehraje, je na konci v obou směrech |
| `atlasSort("scanDate"/"catchDate", 1/-1)` | řazení podle data skenu a data chycení (`row.catchDate`: „2022-05-09", jen rok „2026-?-?", prázdné = nevíme); neznámé na konci |

| `atlasStitky()` | co jde v rosteru hledat: `znacky` (Shiny, 100 %, verdikt…) a `duvody` (ligy, typy, Gym, Mega). Každý nese `klic`, `stitek`, `pocet`, `trida`, `barva` a `kat` (`liga` / `raid` / `role`) |
| `atlasStitkyFiltr(znacky, duvody, vse)` | zapne filtr podle nich; `vse` znamená průnik („Fire A ZÁROVEŇ GL") |
| `atlasRole("pvp"/"raid"/"gym")` | celá skupina najednou i s vlastním pořadím; prázdná hodnota filtr zruší. Vrací `{role, kusu}` |
`atlasSort` bere jen ty klíče, které umí řadit i hlavička tabulky. Kdyby si
vrstva držela vlastní seznam, rozešel by se s enginem při prvním novém
sloupci. Na neznámý klíč se stav nezmění vůbec a vrátí se `false`. Prázdný
klíč řazení zruší. Druhotné řazení (Shift+klik v hlavičce) se ruší vždycky,
protože rozbalovátko umí zvolit jen jedno kritérium. Zvolené řazení si
přečteš ze `snapshot()` jako `sortKey` a `sortDir`.

### Import se počítá nanečisto

`finishImport(mode, zkouska)` je jedna funkce ve dvou režimech. S `zkouska`
běží celý import na **kopii** rosteru, nic nezapíše a místo hlášky vrátí
plán: `{pridano, aktualizovano, pusteno, vylepseno, vyvinuto, nejasnych,
sloucenoSkenu, preskoceno, vraceno, mimoSken, rucnich}`. Z toho se kreslí
řádek „co to udělá" v importním dialogu.

Musí to být tatáž funkce, ne druhý výpočet vedle ní — náhled, který se
s importem rozejde, je horší než žádný. Na 600 kusech v rosteru a 588
řádcích ve skenu trvá 17 ms, takže se překresluje při každé změně volby.

Vedlejší účinky jsou uvnitř hlídané příznakem: snímek před nahrazením,
`povolPrazdnyZapis`, zápis, překreslení a hláška se v režimu zkoušky
přeskočí a `rows`/`discarded` se na konci vrátí zpátky.

### Hledání podle štítku najde i to, co je pod čarou

Štítek na kartě znamená dvě různé věci: buď kus roli **drží** („UL #1",
„Fire 2/6"), nebo se do ní **nevešel** a stojí pod čarou („UL #45",
„Fire 9/6"). Hledání bere obojí — kdo štítek na kartě vidí, čeká, že mu ho
vyhledávání vrátí. Držitelé slotů stojí nahoře, pod čarou až za nimi
(v pořadí odpovídá `duvodPoradi` číslo pod čarou o tisíc vyšší).

`atlasRole` je proti tomu jen o držených slotech: role odpovídá na otázku
„koho na tohle mám", ne „kdo se o to ucházel". V roli stojí kus, který
pokrývá víc typů, **jednou** — u toho typu, kde je nejdál vpředu (Moltres
s `Flying 1/3` a `Fire 5/6` patří k Flying). Seznam kusů týž kus dvakrát
obsahovat nemůže; kompletní seznam jednoho typu je štítek toho typu.

### Klasická tabulka se ve vrstvě nestaví

Vrstva má svůj vlastní seznam kusů a původní tabulku schovává stylem
(třída `atlas-compact` na `body`). Engine to pozná a řádky tabulky vůbec
nestaví — u čtyř set kusů to bylo půl vteřiny při každé změně a nejdražší
věc v celé appce. Výpočet běží dál, mění se jen to, že řádky nevzniknou.

Plyne z toho dvojí:

* **Pořadí se čte z `atlasPoradi()`, ne z řádků.** Dřív si vrstva brala
  `id` z `#tbody tr[data-row-id]`; to už ve svém zobrazení nenajde.
* **Změna dat se pozná dál podle těla tabulky.** I když se řádky
  nestaví, engine do `#tbody` vždycky vloží značku (HTML komentář), takže
  `MutationObserver` na `childList` funguje přesně jako předtím.

Když se třída `atlas-compact` sundá (klasická tabulka), engine řádky
dostaví sám. Lišta záložek na úzkém okně se tohohle netýká — tam se
řádky staví pořád, aby přepnutí záložky ukázalo tabulku hned.

`atlasImage` je to, na co vrstva spadne zpátky, když pro druh nemá vlastní
art. Je to tentýž obrázek, jaký ukazuje řádek rosteru, takže se obojí
nerozejde. Neznámý druh vrátí prázdný řetězec.

`atlasDetail` vrátí `false`, když kus neexistuje nebo kontejner chybí. Obsah
i chování jsou tytéž jako v detailu pod řádkem, včetně přepínačů Lucky,
Dynamax, CUTE a skládání dlouhých textů. Vrstva dodá jen místo a funkci,
kterou se detail zavírá.

### Sprity si engine měří — vrstva mu musí říct kde

Obrázky ze hry mají každý jinak velkou kresbu v jinak posazeném průhledném
čtverci. Engine si u každé adresy jednou změří, kde kresba leží, a posune
ji na střed rámečku; naměřené si pamatuje mezi spuštěními.

**Kdekoli vrstva vykreslí sprite sama, musí po sobě zavolat
`vystreditSprity(kontejner)`.** Bez toho se ukáže jen to, co engine
náhodou změřil jinde: v rosteru tak byly shiny obrázky (vlastní adresa,
kterou člověk v detailu obvykle neotevře) o třetinu menší a nakřivo
vedle stejného druhu bez shiny. Měří se líně, až když se obrázek dostane
do zorného pole, takže zavolat to nad seznamem o čtyřech stech dlaždicích
nic nestojí.

### Předání kusu do seznamu vrstvy

`zamerKus(id)` v enginu znamená „ukaž ten kus a označ ho". V tabulce
doroluje na řádek, ve vrstvě tabulka není — proto si ho vrstva přebírá
funkcí `window.AtlasFocusRow(id)`, kterou do enginu doplňuje
`tools/atlas_ui_hooks.py` a jen do TEST sestavení.

Předání sedí **až za** přepočtem pořadí a zrušením filtrů (značka
`ATLAS-ZAMER` ve zdroji). Když se předávalo hned na začátku funkce,
`renderBody()` vůbec neproběhl, `lastVisibleIds` zůstaly staré — a ručně
přidaný kus se v seznamu vrstvy neobjevil, dokud se stránka neobnovila.

Vrstva si uvnitř drží `window.AtlasZamerKus(id)`: po nejbližším překreslení
roster doroluje k tomu kusu a na chvíli ho obtáhne. Jinak si seznam pozici
drží a nahoru jde jen při změně pohledu (hledání, filtr, řazení, stránka).

### Co engine volá ve vrstvě

Engine si vrstvu nikdy nevynucuje — každý z těchhle háčků se použije jen
tehdy, když existuje. Bez vrstvy appka funguje dál tak, jak fungovala.

| Háček | Kdy ho engine volá | Co má vrstva udělat |
| --- | --- | --- |
| `window.AtlasFocusRow(id)` | `zamerKus(id)` v TEST sestavení | ukázat ten kus v seznamu a označit ho |
| `window.AtlasEnhanceDetail(box, radek, rozbor)` | po vykreslení detailu kusu | přeskládat detail do podoby vrstvy |
| `window.AtlasDoplnitRoster()` | po přidání kusu do rosteru | překreslit seznam |
| `window.AtlasSmazane(box, položky, info)` | místo tabulky smazaných kusů | nakreslit je jako dlaždice; `false` = nech tabulku |

Model smazaných kusů staví engine: ke každé položce patří kopie řádku,
hotový rozbor, datum smazání a dvě funkce (`vratit`, `rozbor`). Vrstva
nepočítá nic, jen kreslí — a když kreslení odmítne, engine nakreslí
původní tabulku.

Opačným směrem vede `window.AtlasUpravitUtoky(id)`: otevře úpravu útoků
toho kusu. Drží ji vrstva, protože tam ta úprava bydlí; engine ji volá
tlačítkem u nadpisu „Útoky".

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

### Druh ve Vyhledávání

`atlasShiny(jmeno)` → `{ stav, je, zdroje }`, nebo `null` u neznámého druhu.
`stav` je `"ano"`, `"ne"`, nebo `"neověřeno"` — a ten rozdíl je podstatný:
„ve hře zatím není“ tvrdí něco o hře, „nevíme“ o datech. Zdroj je seznam
vydaných shiny, takže druh mimo něj shiny nemá; druh, na který zdroj ještě
nedosáhl, je `"neověřeno"`. `zdroje` jsou česky: `raid`, `volná příroda`,
`vajíčko`, `výzkum`, `evoluce`, `fotka`. Prázdné `zdroje` při `stav:"ano"`
znamenají „vydané, zdroj neuveden“. **Obecné ANO neříká nic o raidu** — na
shiny z raidu se ptej přes `zdroje`.

`atlasCP(jmeno, level, ivA, ivD, ivS)` → CP druhu při daném levelu (výchozí
IV 15/15/15), nebo `null`, když druh nebo level neznáme. L20 je běžný raid,
L25 raid v boostujícím počasí. **Není to údaj o aktuální dostupnosti**;
jestli je druh právě teď boss, plyne z `eventsData()`, ne odsud. U neznámé
formy vrací `null` — základní formou se to nenahrazuje.

`atlasPocasi(typ)` → počasí, které ten typ boostuje (anglicky, klíč do
`POCASI`), nebo `""`, když se na typ žádné neváže.

`prohlidkaModel(jmeno)` → podklad pro výsledkovou tabulku ve Vyhledávání,
nebo `null` u neznámého druhu. Nic se v něm nepočítá znovu: skládá ho týž
výpočet jako rozbor druhu, jen vrací data místo HTML. **UI z něj jen kreslí**
— rank ani cenu si nedopočítává a text hotových tabulek neparsuje.

```
{
  klic, jmeno, typy: [...],
  druhy: [ { klic, jmeno, vztah: "vstup" | "evoluce" | "forma" } ],
  poradiLig: ["little", "great", "ultra", "master"],
  role: {
    pvp:  { little: {klic, nazev, radky}, great: {...}, ultra: {...}, master: {...} },
    raid: { klic, nazev, radky },
    gym:  { klic, nazev, radky },
    mega: { klic, nazev, radky }
  }
}
```

Řádek: `{ klic, jmeno, vztah, rank, pct, utoky, jeMeta?, posun?, typ?, priorita? }`

- `rank` je **pořadí druhu** v té roli. Není to pořadí konkrétního kusu
  (IV rank) ani jeho připravenost (level a útoky) — tři různé údaje.
  `null` znamená, že pořadí pro tu roli v datech není; takové řádky stojí
  na konci, protože nezměřené není totéž co nejlepší.
- `pct` je procento nejlepšího v té roli; `null`, když se neměří.
- `utoky` je doporučená sestava pro tu roli, nebo `""`. Prázdné s
  `jeMeta:false` znamená „mimo metu, sestavu appka nemá" — ne „bez útoků".
- `posun` je změna pořadí od poslední obnovy dat (`{drive, ted, rozdil, odKdy}`),
  nebo `null`.
- `typ` má jen raid (typ útočníka), `priorita` jen mega (v datech k ní
  žádné pořadí není, takže se žádné nevymýšlí).

`window.__pgoProhlidkaKus()` → co appka spočítala o zadaném kusu ve
Vyhledávání: `{ivPct, cp, level, iv:{a,d,s}, jmeno, klic}`, nebo `null`,
když se kus nezadal nebo spočítat nedá. Bez CP a IV vrstva o kusu netvrdí
nic a nic nedopočítává. **IV rank tu schválně není**: je vždycky o jedné
konkrétní lize, a bez jejího jména by to bylo číslo, které tvrdí něco
jiného, než se zdá.

`atlasIvRank(jmeno, ivA, ivD, ivS, liga)` → `{rank, z, pct, liga}` —
pořadí téhle kombinace IV mezi 4096 možnými **v té jedné lize**, počítané
ze stat productu na nejvyšším levelu, který se do limitu vejde. `null`
dostaneš, když liga limit nemá (Master), když se kus do limitu nevejde,
u neznámého druhu nebo u IV mimo 0–15. Není to pořadí druhu v lize a není
to připravenost kusu.

`evoPodminky(odKlic, naKlic)` → co hra vyžaduje, aby se z prvního stal
druhý, česky a jako věty (`["ujít 10 km jako buddy", "jen v noci"]`).
**Prázdné pole samo o sobě nic neznamená** — vrátí ho i přechod, o kterém
data nemáme. Kdo to potřebuje rozlišit, ptá se `evoPodminkyStav`.

`evoPodminkyStav(odKlic, naKlic)` → `"jsou"`, `"zadne"` nebo `"nevime"`.
`zadne` je ověřený údaj: zdroj ten přechod zná a žádnou další podmínku
u něj neuvádí. `nevime` znamená, že o tom přechodu data nejsou — appka
pak nesmí tvrdit „stačí bonbóny". (V datech to drží `evoPozadavky`:
prázdný objekt = ověřeně nic navíc, chybějící cíl = nevíme.)

`atlasImage(jmeno, trida, vzhled)` → `<img>` druhu. `vzhled.shiny` přepne
na shiny podobu; adresa se liší jen příponou a když ji mirror nemá, spadne
zpátky na běžnou ikonu. Shiny je **jiná barva, ne jiný druh** — žádné číslo,
pořadí ani sestava se tím nemění.

`atlasVylepseni(jmeno, forma, odLevel, naLevel, ivA, ivD, ivS)` → co stojí
vylepšení **po půl levelech** a jaké je po každém kroku CP; `null`, když druh
nebo levely nedávají smysl.

```
{
  odLevel, naLevel,
  kroky: [ { z, na, prach, bonbony, xl, celkemPrach, celkemBonbony, celkemXl, cp } ],
  prach, bonbony, xl, cpOd, cpNa, nasobekPrachu, duvodCeny
}
```

`forma` (Shadow, Purified, Lucky) mění cenu a je započítaná; `duvodCeny`
říká proč. Slouží simulaci na detailu kusu — **nic nemění**, jen počítá.

`atlasElitniUtok(jmenoDruhu, jmenoUtoku)` → `true`, když ten útok u toho druhu
dává jen **elitní** TM, `false` u běžně dostupného a `null`, když appka ten druh
nebo útok nezná. Bez toho by rada „přeuč na X" byla u elitního útoku nesplnitelná.

`atlasStaty(jmeno)` → `{utok, obrana, hp, max:{utok, obrana, hp}}` — základní
staty DRUHU (ne kusu) a nejvyšší hodnoty, jaké se v pokédexu vyskytují, aby
šel nakreslit poměr. `null` u neznámého druhu.

`atlasEvoStrom(jmeno)` → celá evoluční řada pro stránku druhu, nebo
`null` u neznámého druhu.

```
{
  klic,
  stupne: [ [ { klic, jmeno, popis, typy, vstup, bonbonuNaEvoluci } ] ],
  hrany:  [ { od, na, stav, podminky: [...], bonusy: [...], bonbony } ],
  mega:   [ { od, jmeno, druh: "Mega"|"Primal", typy, energie,
              energiePoprve, obrazek } ]
}
```

- `stupne` jsou patra řady (Eevee má osm větví v jednom patře), `popis`
  nese formu (`Slowpoke (Galarian)`).
- `hrany` popisují **každý přechod zvlášť** — podmínka patří konkrétní
  cestě, ne druhu (Espeon ve dne, Umbreon v noci). `stav` je totéž co
  `evoPodminkyStav`.
- `mega` stojí bokem: **není to evoluce**, ale dočasná forma, a platí se
  energií, ne bonbóny. `energiePoprve` je `null`, když ho data nemají.
  `obrazek` je hotové `<img>` mega formy (vrstva si adresu nestaví).

`atlasEvoCena(odKlic, naKlic, odLevel, naLevel, forma)` → cena **jedné**
vybrané cesty, nebo `null`, když cesta nevede. Součet přes všechny větve
(osm evolucí Eevee) se nikdy nedělá.

```
{
  cesta: [klice…], kroky: [ { od, na, jmeno, bonbony, stav, podminky, bonusy } ],
  odLevel, naLevel,
  polozky: {
    prach:   { hodnota, znamo },
    bonbony: { hodnota, znamo },   // evoluce i vylepšení dohromady
    xl:      { hodnota, znamo },   // nikdy se nesčítá s běžnými
    predmety: ["King's Rock", …]
  },
  uplne: true|false, chybi: ["bonbóny za evoluci …"]
}
```

- Neznámý člen zůstane neznámý (`znamo:false`) a `uplne` je pak `false`:
  takový součet se nesmí vydávat za úplný.
- `forma` je stav kusu (`Shadow`, `Purified`, …) — hra u něj počítá
  vylepšení dráž a engine to zohlední.
- Bez levelů (`null`) se počítají jen bonbóny za evoluci; nic se za
  uživatele nedosazuje a žádný stav inventáře se nepředpokládá.
- **Mega energie tu schválně není** — viz `atlasEvoStrom().mega`.

`atlasTypovka(jmeno)` → typová stránka druhu obojím směrem, nebo `null`
u neznámého druhu.

```
{
  typy: ["Fire", "Flying"],
  obrana: [ { typ, nasobek } ],            // 18 záznamů, od nejhoršího
  utok: { typy, sestava, dvojity, vyhoda, vyrusene } | null
}
```

- `obrana` je, co ten druh schytá: násobek každého útočného typu proti
  jeho **kombinaci** typů, ne proti jednotlivým. U dvojtypů se to jinak
  plete — Fighting je proti Fire normální, ale Flying ho srazí na 0,625.
- `utok` je, kam se hodí **jeho útoky** — bere se doporučená sestava
  druhu, ne jeho typ. Druh typu Normal může mít nabitý útok jiného typu;
  vydávat typ Pokémona za všechno, co umí, by lhalo. Když appka sestavu
  nemá, je `utok` `null` a **nic se neodhaduje**.
- `dvojity` / `vyhoda` / `vyrusene` jsou kombinace typů z pokrytí, tedy
  proti čemu ta sestava opravdu funguje, počítané stejným výpočtem jako
  v rozboru kusu.

`window.__pgoProhlidkaRezim(rezim?)` → přepne Vyhledávání mezi `"druh"`
a `"kus"` a vrátí, jak to teď stojí. V režimu `"druh"` se CP, level, IV ani
útoky do výpočtu neberou, ale v polích zůstanou pro návrat. Režim patří
společnému výpočtu; vrstva si druhý algoritmus nestaví.

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
| `mega`, `megaKandidat`, `megaSub`, `megaDrzi` | mega (priorita je spočítaná z `megaRanking()`, ne z ručního seznamu); `megaDrzi` je jediný kus druhu, kterému rozpočet mega slot dal — ostatní mají `mega: "Lepší kopie"` |
| `trade`, `tradeFree`, `tradeSub` | výměna |
| `purify`, `purifySub` | očista |
| `worseCopy`, `copies`, `procKopie` | kopie téhož druhu |
| `jenZnamka` | drží ho jen CUTE nebo 100 %, žádnou roli nezastává |
| `jeMezera` | drží roli jen jako náplast |
| `jeRezerva` | drží jen rezervu ligy nebo ho drží jen paměť pořadí: `keep` je „Nechat – rezerva" (`keepTone: warning`), `powerup` je „Ne", do plánu prachu nejde; vyvinout smí |
| `duvody` | důvody verdiktu jako seznam: `[{kat: "liga"/"raid"/"role"/"znacka", druh, klic, filtr, stitek, proc, mezera, rezerva, poEvoluci, kusId}]`. `filtr` je klíč pro filtr („GL", „Fire", „Gym", „Max", „Mega", „CUTE", „Lucky", „100 %"…), `stitek` text štítku („GL #7", „Fire 2/6"), `proc` krátká věta, proč zrovna tenhle kus. U pouštěného kusu jen značky. |
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
