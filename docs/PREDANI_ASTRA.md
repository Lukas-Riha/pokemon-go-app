# Předání: jak přesunout GO Atlas do vlastních souborů

> **Nové rozdělení práce (17. 9., Lukáš):** ty děláš **grafiku** (hlavně
> `atlas.css`, rozvržení, návrhy obrazovek), Claude dělá **funkční věci
> v `atlas.js`** (napojení na engine, chyby, testy). Nikdy nepracujete
> současně. Podmínka: **vždycky začni z aktuálního gitu a hotovou práci hned
> commitni** — jinak si změny v `atlas.js` přepíšete. `atlas.js` se
> nepřeformátovává.
>
> **Otevřené na tvé straně (stav 17. 9.):**
>
> 1. Do produkce brání `atlas.js`: klíče `pgo_test_atlas_*` (6×), text
>    „LOKÁLNÍ TEST" a „TESTOVACÍ VERZE" (2×). Řeší se, až Lukáš řekne
>    „do produkce" — do té doby nesahat.
>
> **Hotovo Claudem v tvých souborech (17. 9.)** — viz sekce „Co Claude
> změnil ve vrstvě (17. 9.)": štítky důvodů v kartách rosteru, zdvojený
> text verdiktu v detailu pryč, „Vylepšil jsem ho" vedle „Upravit", bublina
> evoluční řady mimo posuvník, jeden nadpis evoluční řady. Klik na evoluční
> řadu (dřívější bod 6) jsi opravila sama.
>
> **Druhé kolo 17. 9. (Claude, na Lukášovo přání)** — v `atlas.js`:
> tmavý režim je výchozí (světlý jen po přepnutí, pamatuje se), popisek
> „Zobrazení rosteru" nad řazením je pryč, značky u jména jdou v pořadí
> SHADOW, PURIFIED, DMAX, 100%, CUTE, SHINY, LUCKY. V detailu zmizel
> souhrnný box Využití / Potřebný krok / Cena / Chybějící údaje
> (`.atlas-journey` se v detailu už nevkládá, v kartách rosteru zůstal);
> verdikt stojí v `.atlas-verdict-radek` vedle `.atlas-krok`, kam se
> přesunul obsah sekce „Doporučené kroky" (sekce `coted` se ruší).
> V `atlas.css` je na konci blok „Claude 17. 9. (2)": mřížka verdikt/krok
> 1fr 1fr (pod 650 px pod sebou), staty/IV/strop vedle sebe, Mega karta
> `.d-role-radek` na jeden řádek. Klidně to přestyluj — testy hlídají jen
> rozložení (krok vedle verdiktu, verdikt < 60 % sloupce, staty v jednom
> řádku, Mega do 60 px, na telefonu krok pod verdiktem).
> V enginu: štítky důvodů mají všude jedno pořadí (ligy LC→ML, raid,
> gym, Max, mega, elitní útok, 100 %, CUTE, ostatní), karty „Herní
> využití" jdou PvP, Raid, Gym, Mega; typové pokrytí vypisuje výhodu jen
> proti samotným typům po útočném typu + „Výhoda se vyruší".
>
> **Třetí kolo 17. 9. (Claude)** — značky SHADOW/DMAX/100%/CUTE/SHINY/LUCKY
> mají tvar i velikost typových štítků (engine `.rarity-chip`, v `atlas.css`
> blok „Claude 17. 9. (3)"): v kartě 18 px / 10 px, v detailu 24 px / 12 px,
> zaoblení 11 px, vypnutý přepínač čárkovaně. Test porovnává výšku, písmo
> a zaoblení s `.d-type` — barvy jsou tvoje. Štítky „pod čarou" u pouštěného
> kusu (`.dv-pod`, čárkované) a jeden štítek Dynamax místo Max Dragon/Ground/
> tank. Herní využití: všechny karty `.d-role-radek` (bez textu a pruhu).
> V `atlas.js`: IV procento v identitě („IV 14 / 15 / 15 · 98 %", čísla bez
> „.0"), pod pruhy IV a ve stropu bez textu, šipky ←/→ a A/D listují detailem.
> Evoluční řada je i u druhu bez evoluce (jeden stupeň + „Tenhle druh se
> nevyvíjí.") — engine ji kreslí vždy.
>
> **Čtvrté kolo 17. 9. (Claude)** — `atlas.js` přesouvá mřížku Staty / IV /
> Strop (`.d-grid` → `.atlas-ident-stats`) do hlavičky `.atlas-detail-identity`
> vedle jména a obrázku, sekce `stats` dole zmizí; nadpis IV zkrácen na „IV".
> Karty doporučeného kroku (`.atlas-krok .d-roles-akce`) stojí vedle sebe ve
> sloupcích stejné výšky, „Herní využití" jsou čtyři stejně široké karty
> v řádku (nadpis nad hodnotou). CSS v bloku „Claude 17. 9. (4)" — pod
> 1100 px jdou staty pod jméno, pod 650 px pod sebe.
>
> **Páté kolo 17. 9. (Claude)** — `.atlas-drawer` a `#atlasDetailContent` mají
> `scrollbar-gutter:stable`, aby detail neskákal o šířku posuvníku. Z typového
> pokrytí se „Výhoda" přesouvá na řádek značek vpravo jako `.atlas-vyhoda`
> (`<small>silný proti</small>` + barevné `.pk-typ`); v sekci „Typové pokrytí"
> zůstává jen „Výhoda se vyruší" (a když ani ta není, sekce se odstraní).
> Vypnutý `.atlas-lucky-tag` je průhledný jako ostatní vypnuté značky (dřív
> měl tmavou výplň). CSS v bloku „Claude 17. 9. (5)".
>
> **Šesté kolo 17. 9. (Claude)** — detail nesmí při listování skákat, proto
> mají bloky pevné rozměry (blok „Claude 17. 9. (6)"): `.atlas-verdict-radek`
> min-height 104 px, karty „Herní využití" 90 px, `.detail-title` 52 px,
> evoluční sloupec 520 px nad 900 px šířky. Test (sekce 9 v atlas_vrstva)
> projde šest různých kusů a porovná pozici i rozměry hlavičky, statů,
> verdiktu, značek, evoluce a sekcí — když něco změní výšku, spadne.
> Sekce „Typové pokrytí" se v detailu už nekreslí vůbec (zůstal jen štítek
> „silný proti"), cena vylepšení je krátká na jeden řádek („L40 · 475 tis.
> + 248 candy + 296 XL", celá věta je v bublině) a „silný proti" má menší
> bubliny s menšími mezerami.
>
> **Sedmé kolo 17. 9. (Claude)** — do hlavičky přibyl blok `.atlas-ident-utoky`
> (útoky pod sebou + „Teď" / „Po evo" nejlepší sestava, věty v bublinách);
> sekce „Útoky a připravenost" i „Nejlepší sestava" dole zmizely. „Herní
> využití" je bez rámečku sekce — jen `.d-roles.atlas-vyuziti` se čtyřmi
> kartami, text zarovnaný nahoru. Evoluční sloupec se roztáhne do výšky
> (žádný prázdný rám pod řadou). Hlavička má pevnou geometrii: výška 200 px,
> jméno `.atlas-ident-text` 300 px, útoky 260 px, staty 150 px — dlouhé jméno
> ani poznámka u shadow statů s ní nehnou. Pod 1100 px se to rozpadá do řádků.
>
> **Osmé kolo 17. 9. (Claude)** — pořadí v hlavičce je Staty / IV / Strop
> a až za nimi Útoky (vpravo). Obrázek kusu je v okénku `.atlas-ident-obr`
> (150×150, `overflow:hidden`): engine sprity po změření zvětšuje až 1,55×
> a posouvá, takže bez ořezu vyskakovaly z hlavičky ven — to bylo to
> „poskakování mimo rámečky". Kdyby se okénko stylovalo jinak, ořez musí
> zůstat. Test to hlídá (zvětší sprite a měří výšku hlavičky).
>
> **Deváté kolo 17. 9. (Claude)** — sekce lig se v `atlas.js` mění z `details`
> na `section` s nadpisem `.atlas-sekce-nadpis` („Ligy"): je napevno
> rozbalená a nejde sbalit. Nadpis má styl summary bez šipky (blok „Claude
> 17. 9. (9)").
>
> **Desáté kolo 17. 9. (Claude)** — čištění boxu kreslí ten samý rozbor jako
> detail kusu. Hlavička je společná funkce `window.AtlasIdentitaHTML(row)`,
> rozbor vkládá `boxRozbor()` do `#bmBody` jako `.atlas-box-rozbor`
> (MutationObserver hlídá překreslení enginem, vlastní vložení ignoruje).
> `AtlasEnhanceDetail` teď hledá hlavičku v `container.closest('#atlasModal,
> .atlas-box-rozbor')` — kdyby se přidal další hostitel, musí se doplnit sem.
> Zjednodušené bloky enginu (`.bm-head`, `.bm-verdikt`, `.bm-why`, `.bm-roles`,
> `.bm-ligy`, `#bmVic`, `#bmVicBtn`) jsou schované a panel je široký jako
> „Celý rozbor". Lišta „ve hře jsem s ním něco udělal" jde nad 650 px nahoru
> k postupu, na telefonu zůstává v rozboru. CSS blok „Claude 17. 9. (10)".
>
> **Jedenácté kolo 17. 9. (Claude)** — v čištění boxu nesmí být posuvník.
> Panel má `height:auto;max-height:100%`, `.bm-scroll` schovaný scrollbar
> a obsah je rozdělený na dvě stránky (třída `siroky` na `#boxMode`, přepíná
> ji `#bmVicBtn`): sbalené = hlavička se staty a útoky, verdikt s krokem,
> značky, Herní využití; rozbalené = malá hlavička + Ligy a evoluční řada.
> Všechno v boxu je kompaktnější (menší hlavička, řádky tabulky, dlaždice
> evoluce) — CSS blok „Claude 17. 9. (11)". Kdyby se do boxu něco přidávalo,
> test v sekci 10 měří přetečení `.bm-scroll` na 1500×1000 i 1400×900
> u tří kusů včetně Eevee (větvená řada je nejvyšší).
>
> **Dvanácté kolo 17. 9. (Claude)** — rozbalený stav boxu ukazuje VŠECHNO
> (hlavička se staty a útoky, verdikt, značky, Ligy, Herní využití, evoluce),
> jen menší: v `siroky` se zmenšují dlaždice evoluce (u větvené řady jen
> obrázky, jména a podmínky jsou v bublině), řádky tabulky lig a odsazení.
> Pod otevřeným boxem se zamyká rolování stránky (`body.atlas-box-otevreno`),
> takže vpravo nesvítí posuvník celé stránky. Test měří přetečení na
> 1500×1000 (obě stránky) a 1400×900 (sbalený stav).
>
> **Třinácté kolo 17. 9. (Claude)** — proporce rozbaleného boxu: obrázek
> 120 px, jméno 26 px, staty/IV/strop a útoky hned vedle jména (menší
> odsazení), evoluční řada výrazně větší (dlaždice 60 px, u větvené 34 px)
> a širší sloupec (`minmax(300px,0.62fr)`). Sbalení/rozbalení je plynulé:
> Ligy a evoluce se skrývají přes `max-height`+`opacity` s přechodem, ne
> `display:none` — pozor v testech, „vidět" se musí měřit výškou a průhledností.
> Velikosti hlavičky (obrázek 120, jméno 26 px, staty a útoky hned vedle jména)
> platí v obou stavech, ať při rozbalení nic neposkočí.
>
> **Čtrnácté kolo 18. 9. (Claude)** — box má napevno dva sloupce: vlevo
> hlavička + rozbor, vpravo evoluční řada (`grid-template-areas`
> „hlavicka evoluce" / „obsah evoluce", `.atlas-box-rozbor`). Evoluce je
> vidět v obou stavech, je velká (dlaždice 76 px) a táhne se od hlavičky až
> dolů (`display:grid;grid-template-rows:auto 1fr` na sloupci — u `<details>`
> je grid spolehlivější než flex). Rozbaluje se jen tabulka Lig, takže se
> hlavička ani karty nikam nehnou; test to hlídá porovnáním pozic a šířek
> hlavičky v obou stavech (tolerance 4 px). Staty/IV/strop jsou užší
> (`minmax(150px,190px)`) a pruhy mají `min-width`, ať nezmizí.
>
> **19. 9. (Claude) — k tvému A-007:** tvoje dlaždice rosteru jsem našel
> necommitnuté a commitnul je beze změny samostatně (`a9c364b`), obnovu dat
> taky zvlášť (`2941c02`). Připomínka podmínky nahoře: hotovou práci prosím
> commitni hned, ať se naše změny nepletou v jednom souboru.
> Dvě věci po A-007 jsem opravil v bloku „Claude 19. 9.": (1) skrytí prázdné
> lišty pod rosterem mělo selektor `.card.roster>.toolbar`, který po přesunu
> do `.atlas-roster-fixed-controls` přestal platit — je teď potomkový;
> (2) typy a značky v dlaždici měly různou výšku (22 vs 18 px) — Lukášovo
> pravidlo je, že vlastní značky vypadají přesně jako typy, jen jinou barvou,
> takže mají v dlaždici obě 20 px. Tvoje rozložení dlaždic zůstalo.
> V čištění boxu obsah (verdikt, značky, karty, Ligy) teď sahá až k evoluční
> řadě a jméno v hlavičce se smí zúžit, ať se útoky vejdou celé.
>
> **Patnácté kolo 19. 9. (Claude)** — box má pevnou velikost: panel 780 px
> sbalený a 980 px rozbalený (`min(…,100%)`), hlavička 190 px, řádek značek
> 40 px, verdikt 104 px, karty využití 58 px; evoluce se dotahuje do zbytku.
> Štítky verdiktu se v boxu neskládají do víc řádků — `srovnejDuvody` je
> schová do „+N". Engine měl na rozboru `max-width:1180px`, proto obsah
> nesahal k evoluční řadě (v boxu je přebitý). Značky mají pevné místo:
> chybějící typ doplní `.atlas-typ-mezera`. Sestavy útoků jsou barevné chipy
> (bez předpony „Teď/Po evo", duplicity se nevypisují). V hlavičce je jeden
> výrazný řádek `CP · L · IV %` (hodnoty IV zůstaly v pruzích).
> V enginu: „Vyvinul jsem ho" je jedno tlačítko a cíl se vybírá v okně
> (dlaždice z evoluční řady), u procent platných až po evoluci stojí
> „po evoluci na X", a přibylo API `fastByNameOf`.

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

## Co zkontrolovat po backendových změnách (13. 9.)

Testovací verze byla dva dny pozadu — postavená 11. 9., zatímco engine se
měnil ještě 12. a 13. Teď je přestavěná z aktuálního enginu a ověřená:
naskočí za 390 ms, žádná chyba v konzoli, oddělené úložiště drží.
Od teď ji stavím po každé změně enginu, ne až na vyžádání.

**Projdi prosím u sebe tohle:**

1. **`utoky[].stav` má hodnotu `poEvoluci`.** Když si stav mapuješ na barvu
   nebo ikonu, dopadne jinak do výchozí větve. Znamená to „nepřeučuj teď,
   evolucí se moveset losuje znovu".
2. **Nová pole `movesBestFinal` a `finalFormaJmeno`.** Sestava formy, kterou
   se kus teprve stane. U finální evoluce jsou prázdná.
3. **`keepSub` teď u kusu s víc rolemi končí na `+N`** (třeba `Ground 1/6 +3`).
   Když ho někde ořezáváš na pevnou délku, ten přípis zmizí jako první.
4. **Obrázky Shellose a Gastrodona** mají nově v adrese příponu moře. Pokud
   máš vlastní mapování v `ATLAS_ART`, zkontroluj, že se nepere s tím z enginu.
5. **Detail má dva nové kusy obsahu:** `<span class="hra-pruh">` v hlavičce
   vedle křížku a sekci `[data-sekce="sestavy"]` s `div.d-sestavy`.
   `bezVerdiktu()` obojí odstraňuje, takže v prohlídce a v čištění boxu to
   není. Když detail skládáš jinak, počítej s tím.
6. **Nové okno `#doplnitBox`** (hromadné doplnění útoků) používá třídu
   `rucni-box`, takže dědí tvůj vzhled oken. Otevírá se tlačítkem
   `#doplnitBtn` v liště rosteru.
7. **`#rucniBox` se po přidání kusu sám zavírá** a nově přidanému kusu se
   otevře detail. Kdybys na to navazovala, tohle je změna chování.

**Co se nesmí vracet zpátky:** systémový `title` na `.d-evo-kus` (appka si
ho přepisuje do vlastní bubliny a přepsal by její obsah) a natvrdo psané
„Ano" v kartičce Doskenovat.

---

# Co se změnilo 14. 9. — tohle je celý dnešek

Všechno starší už jsi četla, tak jen nové věci. Je jich hodně o megách,
protože se ukázalo, že si o nich appka na třech místech počítala tři různé
odpovědi. **Od dneška je to i v produkci** (Pages i sdílená složka), takže
to nekoukáš jen do testovací verze.

## 1. Mega slot má jednoho vlastníka

Sloupec **Mega** si „lepší kopii" počítal sám — z pořadí kopií a z toho, kdo
je nejlepší raidový kus druhu. Rozpočet si přitom držitele megy vybíral
jinak (podle IV %). Ty dva výpočty se rozcházely, takže u kusu, který megu
podle verdiktu drží (`keepSub: "mega"`), mohlo ve sloupci stát **Lepší
kopie**. Teď je zdroj jeden: kdo dostal mega slot z rozpočtu.

**Projdi prosím u sebe tohle:**

1. **Nové pole `megaDrzi`** v `getComputed()`. `true` má nejvýš jeden kus
   druhu — ten, kterému rozpočet mega slot dal. Všechny ostatní kusy toho
   druhu mají `mega: "Lepší kopie"`. Pokud si někde držitele megy dopočítáváš
   z `dupIndex` nebo z `megaKandidat`, přepni na `megaDrzi`.
2. **`megaSub` má novou hodnotu `"veze se na roli"`.** Je u držitele, který
   není první kopií — mega se veze na kusu, co si necháváš kvůli jiné roli
   (typicky Dmax kus). Když `megaSub` mapuješ na výčet hodnot, tahle tam
   dosud nebyla.
3. **Pořadí kopií rozhoduje i o meze.** Při shodném IV % vyhraje kus **výš
   levelem** (dřív o tom rozhodovalo pořadí v poli, tedy náhoda).
4. **Dokumentace má dva nové řádky** — „Mega — k čemu vlastně je" a
   „Mega — kdy ji použít". Jsou v `renderDocs()`, ne v `renderDataInfo()`.

**Co appka pořád nesleduje:** mega energii ani úroveň megy. V žádném poli to
není, takže to neukazuj — doporučení „kdy megovat" je v dokumentaci jako
pravidlo, ne jako spočítaný údaj.

---

## 2. Priorita megy se počítá a pořadí v rosteru nic neurčuje

**1. Nová funkce `window.__pgo.megaRanking()`.** Vrací objekt `typ -> pole`
mega forem seřazené od nejlepší. Každá položka má `jmeno`, `druh`, `key`,
`typy`, `kind`, `set` (sestava útoků), `atk` / `atkZaklad`, `def` / `defZaklad`,
`energie`, `skore`, `podil` (1 = špička běžných druhů toho typu) a `aura`
(mega ten typ sama má, takže na něj dává boost). Referenční tabulka
`#refMegaTable` je z toho postavená — má teď sloupce Typ / # / Mega / Sestava
/ % špičky a používá stejný gridový layout jako `#refRaidTable`. Kdybys ji
stylovala, počítej s pěti sloupci místo tří.

**2. `megaPriority()` už neopisuje ručně psaný seznam**, počítá se z toho
žebříčku. Prakticky to znamená, že se u části druhů změnila hodnota ve
sloupci **Mega**: nahoru šlo 7 druhů (Heracross, Tyranitar, Absol, Pinsir,
Gallade, Lopunny, Abomasnow), dolů 11 (Salamence, Gyarados, Metagross,
Garchomp, Venusaur, Gengar, Blaziken, Houndoom, Scizor, Aerodactyl, Steelix). Nic v rozhraní se nemění, ale když máš
někde ukázkové screenshoty nebo fixtury s konkrétními hodnotami, přepočítej je.

**3. Nová funkce `priShode(x, y)` v enginu** (interní, nevystavená): poslední
slovo při remíze v každém žebříčku rozpočtu — vyšší level, pak IV, pak CP.
Dřív při shodě rozhodovalo pořadí kusů v rosteru, takže dva stejní Snorlaxi
si prohazovali gymový slot 5. a 6. podle toho, který se naskenoval dřív.
**Když si někde děláš vlastní řazení kusů, musí mít taky deterministický
tiebreak** — jinak se rozhraní a engine rozejdou.

**4. Dokumentace opravena u lig:** megy v běžné lize nejsou, ale existují
omezené formáty **Great / Ultra / Master League: Mega Edition**. Ligové
žebříčky appky s nimi nepočítají a je to tam napsané.

**5. Seznam mega druhů se generuje z herních dat.** `reference.json` →
`megaEvolutions` byl ručně psaný a měl `raidPriority` natvrdo; teď ho
`tools/augment_reference.py` skládá z pokédexu (sekce `mega`, 47 druhů) a
prioritu nechává na `Neznámá`, protože si ji appka počítá. Zároveň se z
`raidAttackers[].form` odstraní nárok na mega formu, kterou hra nemá —
stálo tam „Mewtwo (Mega Y)" a „Machamp (Mega/Shadow)", ačkoli Mega Mewtwo
ani Mega Machamp v Pokémon GO nejsou. Audit dat to nově hlídá.

## 3. Nastavení: reset nevracel zaškrtávátka

`resetSettings()` dělal `el.value = výchozí` pro každou volbu — u checkboxu
to nedělá nic. „Nastavit doporučené" proto nechávalo `keepForms`,
`krokyPlan`, `keepRare` a `bezXL` tak, jak byly, a `applySnapshot()` měl
stejnou díru, takže si je profily přetahovaly mezi sebou.

**Co z toho plyne pro tebe:** obojí teď volá nové `nastavVychozi(el)`.
Když si někde stavíš vlastní panel nastavení nebo vlastní přepínání
profilů, **zaškrtávátko se musí nastavovat přes `.checked`, ne `.value`** —
jinak si tu chybu přineseš zpátky. Sada voleb je `SETTING_IDS` (19 prvků
s elementem v DOM, rozeseté po kartách Nastavení, Import, Smazané a Prach).

Texty u tří voleb jsem přepsal, protože slibovaly něco jiného, než engine
dělá — kurz prachu za bod IV, váha nehrající ligy a výčet u tlačítka
„Nastavit doporučené". Když je máš někde okopírované, vezmi si nové znění.

## 4. Shadow v raidové roli a Darmanitan (14. 9. večer)

Našlo se porovnáním s cizím žebříčkem (pokemongohub).

1. **`raidPct` může nově přerůst 1.0.** Shadow má ve hře útok +20 % a obranu
   −17 %; gymový rozpočet tu srážku počítal odjakživa, raidový bonus k útoku
   ne. Shadow Tyranitar a běžný Tyranitar vycházeli oba na 100 %. Teď vychází
   shadow na 114 %. **Když někde procento formátuješ nebo kreslíš pruh, počítej
   s hodnotou nad 100 %** — pruh se nesmí přetéct ani zaseknout na stropu.
2. **Pod holým klíčem `darmanitan` byla galarská (ledová) forma.** Herní data
   u něj nemají formu „Normal", ale „Standard", takže klíč dostala ta, co byla
   v datech první. Chycený unovský Darmanitan měl typ Ice, raid „Ne" a sestavu
   Ice Fang + Avalanche. Opraveno v `tools/build_pokedex.py` (Standard se bere
   jako základní forma) a hlídá to audit dat.
3. **Dokumentace má nový bod v „Co appka NEVÍ":** patnáct nabitých útoků nemá
   v herních datech raidová čísla (Mind Blown, Pyro Ball, Glaive Rush,
   Gigaton Hammer, Wildbolt Storm a další), takže druh, jehož nejlepší sestava
   na nich stojí, vychází hůř, než ve hře je. Kdybys někde psala, že žebříček
   je úplný, tohle je výjimka.

## 5. Sloupec Evolvovat u kusu, který drží slot až po evoluci

`evolve` koukal jen na to, co kus umí **teď**. Kus, který drží raidový nebo
mega slot až jako vyvinutá forma, tak měl „Ne" s odůvodněním „ani vyvinutý by
tenhle kus žádnou roli nedržel" — a o dvě buňky vedle ve verdiktu „Drží místo
v rozpočtu: Fighting 5. z 6 — ale až jako Blaziken".

Nově u nich `evolve: "Ano"`, **tón `warning` místo `good`** (zatím to nehraje,
tak to nemá být zelené), podřádek zůstává cena v bonbónech a bublina jmenuje
rozpočet. Když si tón mapuješ na barvu, tohle je nová kombinace: `Ano` +
`warning`. Hlídá to nové pravidlo v auditu rozporů.

## 6. Shadow se počítá z obou stran a jedním číslem

Shadow má útok ×1,2, ale zároveň **schytá o pětinu víc** (obrana ×1/1,2).
Appka to počítala na třech místech třemi způsoby:

| kde | dřív | teď |
| --- | --- | --- |
| rozdávání raidových slotů | ×1,2 (jen útok) | ×1,2^0,75 ≈ **1,1465** |
| `raidPct` (sloupec RAID) | ×1,2 a ×1/1,2 | totéž, ale ze sdílené konstanty |
| `gymPct` (sloupec GYM) | **bez srážky** | ×1/1,2 |
| řazení gymových slotů | ×1/1,2 | čte přímo `gymPct` |

Prakticky: u shadow kusu svítilo ve slotu „83 % špičky" a ve sloupci 80 %,
a v gymu ukazoval sloupec procento, jako by srážku obrany neměl. Teď jsou to
dvě konstanty (`SHADOW_RAID`, `SHADOW_GYM`) a obě strany appky čtou totéž.

**`gymPct` u shadow kusu tedy nově klesne o 17 %** — když máš někde uložené
ukázkové hodnoty, přepočítej je.

## 7. Čištění boxu: druhý pruh — kdo ze slotu vypadl

Panel čištění měl jen jeden pruh: **kusy, které jsi pustil a teď by se zase
vešly** (`#bmVraceni`, oranžový). Chyběl opačný směr — kus, kterého sis
nechal, ale pak jsi něco změnil a on o slot přišel. Reálný případ: třináct
Rhyhornů bez značky DMAX, uživatel ji přidával v čištění jednomu po druhém
od nejslabšího, u každého viděl „Ponechat" a nikdo mu neřekl, že tím
z Max rozpočtu vypadl některý dřívější. Nechal si všech třináct.

**Nový prvek `#bmVypadli`** (a `#bmVypadliSouhrn` na konci), třída
`bm-vraceni bm-vypadli` — **stejný tvar a stejné třídy jako pruh s vracením,
jen červený**. Tlačítka `[data-pustit]` a `[data-nechat]`. Když si pruhy
stylizuješ, tenhle je potřeba odlišit barvou, ne rozložením.

Nové testovací háky v `window.__pgo`: `boxPrepocitat()`, `boxVraceni()`,
`boxVypadli()`, `boxPuvodni()`.

**Mimochodem:** záložka *Co chytat* padala na akci bez termínu
(`evRozsah(null, null)` → `null.toDateString()`). Dnes takovou akci LeekDuck
poslal („Houndour and Houndoom Spotlight Hour" se spawny, ale bez data).
Opraveno a akce bez termínu se do sekce „co zrovna pouštějí" nedostane.

---

# Co zbývá do produkce (15. 9.) — jedna věc, ale podstatná

Projel jsem testovací build proti enginu na šestikusovém rosteru. **Vzhled
i chování jsou hotové, rozvaha „Přehled" ale ukazuje jiná čísla než engine.**
Ostatní části sedí, takže tohle je poslední věc mezi testem a produkcí.

**Roster (`Moji Pokémoni`)** ✓ ukáže všech šest kusů.
**Čištění boxu (`Projít box`)** ✓ jede z enginu, včetně obou nových pruhů
(`#bmVypadli`, `#bmVraceni`) a nových čísel („Dark 1/6, 114 % špičky").
**Konzole** ✓ bez jediné chyby.

### Co nesedí

Testovací roster (6 kusů) a co k nim říká engine:

| kus | IV | verdikt | raid |
| --- | --- | --- | --- |
| Tyranitar Shadow | 96 % | Ponechat | Dark 1/6 +1 |
| Machamp | 93 % | Nechat zatím | Fighting 2/6 |
| Azumarill Lucky | 69 % | Ponechat | Ne |
| Blissey | 89 % | Ponechat | Ne |
| Rhyhorn | 80 % | Ponechat | Ground 1/6 +1 |
| Combusken | 53 % | Ponechat | Fighting 1/6 +1 |

**1. Karta „Na co se zaměřit"** má podtitulek *„Ponechané kusy s vysokými
IV"*, ale vypíše **jediný kus — Combuskena s 53 % IV**, tedy ten úplně
nejhorší. Má tam být pět ponechaných seřazených podle IV, v čele Tyranitar.

```js
const c = window.__pgo.getComputed();
window.__pgo.getRows()
  .filter((r) => c[r.id] && c[r.id].keepGood)      // co si engine nechává
  .sort((a, b) => c[b.id].ivPct - c[a.id].ivPct);  // od nejvyššího IV
```

**2. Karta „Raidové pokrytí"** ukazuje pevnou pětici Psychic / Ghost /
Fighting / Steel / Water a u všeho `0 kandidátů` kromě Fightingu. V rosteru
jsou přitom Dark, Ground i Rock — a ty v seznamu nejsou vůbec. Typy i počty
musí vyjít z rozpočtu, ne z pevného seznamu:

```js
const pokryti = {};
window.__pgo.base().forEach((b) => {
  (b.sloty || []).forEach((sl) => {
    if (sl.druh !== "raid") return;
    pokryti[sl.typ] = (pokryti[sl.typ] || 0) + 1;
  });
});
```

Pořadí typů, kolik jich rozpočet pokrývá přednostně a kolik slotů má který,
drží engine — nekopíruj si vlastní seznam, zestárne stejně jako ten ručně
psaný seznam mega evolucí, který jsme kvůli tomu tenhle týden zahodili.

### Až tohle sedne

Pak už je to jen na rozhodnutí, kdy přepnout. Nic jiného jsem rozbitého
nenašel.

---

# Odpověď na A-005 — ověřeno, obě karty sedí (15. 9.)

Přeměřil jsem obě karty na svém šestikusovém rosteru, na desktopu (1400 px)
i na mobilu (390 px), proti aktuálnímu TEST buildu. **Sedí obojí.**

**Raidové pokrytí** — engine spočítal obsazené raidové sloty
`{Dark: 1, Rock: 2, Fighting: 2, Ground: 1, Fire: 1}` a karta ukazuje přesně
tohle, ve stejném pořadí a se stejnými počty. Dark, Ground i Rock, které
dřív v seznamu chyběly úplně, tam jsou. Formulace „obsazený slot" je
přesnější než původní „kandidát" — slot a kandidát opravdu nejsou totéž.

**Na co se zaměřit** — engine si nechává všech šest a podle IV je řadí
Tyranitar 96 % → Machamp 93 % → Blissey 89 % → Rhyhorn 80 % →
Azumarill 69 % → Combusken 53 %. Karta začíná Tyranitarem a pokračuje
Machampem a Blissey. Combusken, který tam dřív stál sám a první, je zpátky
na konci, kam patří.

Bez jediné chyby v konzoli na obou šířkách. Produkční soubor se nezměnil
(datum souboru je pořád 14. 9.), zámek leží na místě.

**Jedna poznámka k mému rosteru, ne k tvé opravě:** u pěti z šesti kusů
svítí „Ověřit data". Ověřil jsem si proč — moje CP byla vymyšlená a k levelu
a IV neseděla (Tyranitar L33 s 15/14/14 má mít 3436, ne 3100). Tedy
`validationIssues` pracuje správně a označení zůstalo viditelné přesně tak,
jak píšeš. Chyba je v mém testovacím rosteru.

**Co jsem nekontroloval:** Rozpočet, Týmy, Investice a Události. Když na ně
budeš sahat, řeknu si o stejné přeměření.

`web-app/atlas/atlas.js` máš rozpracovaný a **necommitnutý** — nechávám to
na tobě, do tvých souborů nesahám.

---

# Prověření před přepnutím produkce (15. 9.)

Postavil jsem **produkčního kandidáta** — engine + `atlas.css` + `atlas.js`,
bez testovacího úložiště a bez zapečených obrázků — a prohnal ho vším, co mám.

## Co sedí

| kontrola | výsledek |
| --- | --- |
| audit výpočtů (98 kontrol) | prošlo |
| regresní sada (2137 testů) | prošlo, **stejně jako produkce** |
| JS chyby, 14 položek navigace × 3 šířky (1400 / 500 / 390 px) | **žádná** |
| obrázky bez 30MB balíku | 233 obrázků, 1 se nenačetl (jedna forma z PokeMiners) |
| velikost | **1,71 MB** místo 31,9 MB |
| osobní data v buildu | žádná; seed rosteru tam není |
| plánovač rout, audit dat | prošlo |

Že projde celá regresní sada, je hlavní zpráva: vzhledová vrstva **nic
z enginu nezakrývá ani nerozbíjí** — čištění boxu, oba nové pruhy, nastavení,
detail i dokumentace fungují pod Atlasem stejně jako pod starou tabulkou.
Obrázky navíc jedou z herních URL enginu, takže se 30MB balík do produkce
vůbec nemusí.

## Co jsem připravil na své straně

`tools/sync_reference.py --vzhled` = **produkce i se vzhledem**. Proti
`--test` dělá tři věci jinak: nepřejmenovává úložiště na `pgo_test_`,
nezapéká obrázky a přilepí jen funkční můstky (report importu, zaměření
kusu). Součástí je **pojistka**: když by do produkce šel `pgo_test_`,
`LOKÁLNÍ TEST` nebo `TESTOVACÍ VERZE`, build se zastaví a nic nepřepíše.
Zkusil jsem to — zastaví se.

## Co zbývá na tobě (a je to všechno v atlas.js)

Tahle tři místa teď tu pojistku spouštějí:

1. **`pgo_test_atlas_theme`** — 6× natvrdo. V produkci by si vzhled ukládal
   motiv do testovacího klíče. Má to být `pgo_atlas_theme`, nebo ještě líp
   předponu brát z jednoho místa, ať ji build umí přepnout.
2. **Odznak „LOKÁLNÍ TEST"** v hlavičce.
3. **„TESTOVACÍ VERZE"** 2× (nadpis stránky a patička postranního panelu,
   včetně věty „Oddělené profily a zálohy").

Nejsou to bugy, jsou to správné popisky testovací verze — jen musí zmizet
(nebo se zapínat podle příznaku), než se přepne produkce.

## Co jsem NEkontroloval

Obsah karet Rozpočet, Týmy, Investice a Události proti enginu. Prošel jsem
je jen na JS chyby. Po A-005 jsem ověřoval dvě karty rozvahy — na zbytek si
řekni, až na ně sáhneš.

## Jak to pak přepnout

Jedním příkazem: `python tools/sync_reference.py --vzhled`, pak deploy.
Zpátky stejně tak bez `--vzhled`. Engine je jeden, takže se tím nic nerozdvojí.

---

# Než se to propíše do devu — zkontroloval jsem zbytek (15. 9.)

Doplnil jsem to, co jsem minule vynechal: prošel jsem **všech deset zbylých
sekcí** a porovnal je s enginem. **Nic rozbitého, nula JS chyb.** Navíc:
celá regresní sada **2142 testů projde i proti tvému TEST buildu**, ne jen
proti produkčnímu souboru.

| sekce | výsledek |
| --- | --- |
| Rozpočet | „4 cílů" = 4 položky z `prachovyPlan()` ✓ |
| Pokrytí rolí | Ground 1, Dark 1, Rock 2, Fighting 0+1 náplast — sedí na `base()[].sloty` ✓ |
| Žebříčky | Bug: Volcarona 100 %, Pheromosa 96 %, Heracross 92 %, Genesect 91 %, Kartana 89 % — přesně `typeRanking("Bug")` ✓ |
| Typy a počasí, Výměna, Tahák, Nastavení, Metodika | vykreslí se, obsah z enginu ✓ |
| Kalendář | raidy i osa z enginu ✓ |
| Co chytat | **našla se chyba, viz níž** |

## 1. Opravil jsem v enginu „Co chytat" — mění to DOM

Sekce měla jediný nadpis **„Akce, které je zrovna pouštějí"** a pod ním
vypisovala i akce, které teprve začnou. Dnes pod ním stály Spotlight Hour
na 17. 9. a na 24. 9., přestože je 15. 9. a neběží ani jedna. Filtr totiž
vyhazoval jen akce, které už **skončily**; na začátek se nekoukal.

Nově jsou to **dvě skupiny se dvěma nadpisy**:

- `Akce, které je zrovna pouštějí`
- `Akce, které teprve začnou`

Každá položka `coChytat().akce[]` má nové pole **`bezi` (boolean)**. Když si
tu sekci kreslíš sama, tohle je ta změna: jeden `<h3 class="ch-h">` se může
rozdělit na dva a mezi nimi je druhý `<div class="ch-sloupce">`. Když
nic neběží, první nadpis se nevykreslí vůbec.

## 2. Pozor na testy, které mají napevno pořadí z PvPoke

`data/meta.json` se dnes obnovila (staženo 12. 9. → 15. 9.) a pořadí se
pohnulo dost na to, aby mi spadly dva vlastní testy:

- **Azumarill Great League #24 → #32.** Sleva z prahu se tím zmenšila
  a týž 94% kus je nově **pod prahem**. Test čekal „Ano – GL", dostal
  „GL 94 % · pod prahem".
- **Mimikyu Great League #18 → #6** (Ultra zůstalo #10). Karta teď
  doporučuje GL místo UL — správně, protože se řídí rozpočtem.

Ani jedno není chyba. Oba testy jsem přepsal tak, aby ověřovaly **pravidlo**,
ne jeho dnešní výsledek (práh musí být nižší pro výš postavený druh; karta
musí mluvit o téže lize, jakou má kus ve slotu). **Jestli máš někde v UI
testech napsané konkrétní pořadí nebo konkrétní ligu, projde ti to dnes
a spadne za týden** — stejná past.

## 3. Do produkce pořád zbývají ty tři věci z minule

`pgo_test_atlas_theme` (6×), odznak „LOKÁLNÍ TEST", „TESTOVACÍ VERZE" (2×
včetně věty o oddělených profilech). Build `--vzhled` se o ně zastaví.

Nic jiného už mezi testem a produkcí nestojí.

## Dodatek: „Zahodit – kopie / Empoleon UL #8 · 97,5 %"

Ještě jeden rozpor v enginu, ať o něm víš, než to propíšeš. U Piplupa stálo
ve verdiktu **Zahodit – kopie** a hned pod tím **Empoleon UL #8 · 97,5 %** —
četlo se to jako „vyhazuju osmý nejlepší kus Ultra ligy".

Ten podtitulek se zapisuje u kusu, kterého engine označí za nejlepšího
budoucího ligovníka svého druhu (`pvpKeeper`). Jenže **chránit ho to
nezačne**: o ponechání rozhoduje slot v rozpočtu. Když ligový slot dostanou
jiné druhy, kus spadne pod strop kopií — a podtitulek mu zůstal.

Čistící pravidlo, které u puštěného kusu už dřív mazalo „po purifikaci",
„vysoké IV" a „Dynamax", teď maže i tenhle. Zůstane „horší kopie" a **důvod
je v bublině** („lepších kusů toho druhu si necháváš 2" nebo „slot po
evoluci drží lepší kusy").

Hlídá to nové pravidlo v auditu rozporů. **Pro tebe:** `keepSub` u puštěného
kusu nikdy nenese důvod k ponechání — když si ho někde zobrazuješ vedle
verdiktu, tohle je ta záruka.

## Posun v PvPoke a kdo drží ligu (16. 9.)

Dvě nová pole, obě odpovídají na otázku „proč se to změnilo / proč se tam
nevejdu".

**`window.__pgo.posunVLize(klicDruhu, ligaKlic)`** → `{drive, ted, rozdil,
odKdy}` nebo `null`. Kladný `rozdil` je posun **nahoru** (menší číslo pořadí
je lepší). `null` znamená „nehnulo se to" nebo „srovnávací základ ještě
není". Základ je pořadí z **minulého stažení** dat, ne pevné okno dní —
`data/meta.json` má nově `poradiDrive: {datum, ligy}` a `build_meta.py` ho
přepisuje jen tehdy, když se pořadí opravdu změnilo. Hlídá se jen **meta**
ligy (~144 druhů), ne celý žebříček.

**`window.__pgo.drziteleLigy(ligaKlic)`** → pole `{jmeno, cp, poradi, celkem,
rank, mezera, poEvoluci}` seřazené podle slotu. To je odpověď na „proč se mi
#8 Ultra ligy nevejde": sloty drží tyhle konkrétní kusy.

V rozboru kusu je u pořadí v lize nově `<span class="d-lg-posun nahoru|dolu">`
s `▲N` / `▼N` a do bubliny se přidalo obojí — posun i seznam držitelů.
Ověřeno na 1500, 500 i 390 px. **Když si rozbor kreslíš sama, tohle jsou dvě
volání, která to dají bez dalšího výpočtu.**

## Bublina u ligy je HTML seznam + dvojtypová kalkulačka (16. 9.)

**1. `bublinaLigy(zkratka, klicDruhu, uvod)`** vrací **HTML** — nadpis,
řádek s posunem v PvPoke a číslovaný `<ol class="tip-seznam">` s držiteli
slotů. Bublina appky HTML vykreslí, protože obsah začíná značkou.

Visí to teď na **odznáčcích lig** (`ligoveChipy`, tedy tabulka **i čištění
boxu**) a u **pořadí v rozboru**. Odznáček nově nemá `title`, ale `data-tip`.
**Pokud si odznáčky kreslíš sama, tohle je jedno volání a máš totéž.**
Nové třídy: `tip-podnadpis`, `tip-radek`, `tip-posun` (`nahoru`/`dolu`),
`tip-seznam`, `tip-znak`.

`ligoveStavy()` má u každého odznáčku nové pole **`klic`** — klíč druhu,
o kterém ten odznáček mluví (u stavu `evo` je to vyvinutá forma). Z něj se
dohledá posun.

**2. „Co na co platí" umí dvojtyp.** Druhé klepnutí na jiný typ přidá
kombinaci, klepnutí na vybraný ho odebere. Obrana se nově dělí podle
**přesného násobku** (×2,56, ×1,6, ×0,625, ×0,391, ×0,244), ne na dvě
hromádky — mezi ×1,6 a ×2,56 je v raidu rozdíl, který rozhoduje.
**Bloků odpovědi je proto proměnný počet**; když je někde počítáš nebo
bereš podle pořadí, ber je podle nadpisu. Druhý vybraný typ má na tlačítku
třídu `druhy`.

Ověřeno proti pokemondb.net/type/dual: Normal/Fighting dá +60 % Fairy,
Fighting, Flying, Psychic; −37,5 % Bug, Dark, Rock; −60,9 % Ghost.

## Co je na vzhledové vrstvě (16. 9., ze screenshotů TEST verze)

Čtyři věci z dnešního kola jsou ve tvé části, nesahal jsem na ně:

1. **„Vylepšil jsem ho" visí pod tlačítkem „Upravit tohoto Pokémona"**, ne
   vedle něj. Patří do jedné řady.
2. **Bublina evoluční řady zasahuje do posuvníku stránky** — musí se posunout
   dovnitř, ať nepřekrývá scrollbar.
3. **V detailu se dubluje informace**: „Ponechat · Max Electric 1/3" je
   v zeleném boxu a hned vpravo od něj ještě jednou samostatně. Totéž
   u „Dynamax 1/2".
4. **Panel evoluční řady se stickuje i s nadpisem**, takže při scrollování
   je „EVOLUČNÍ ŘADA" dvakrát pod sebou.

Z mé strany k tomu: **„už přerostl" v tabulce lig je nově na střed** (bylo
vlevo, zatímco zbytek sloupce na střed) — kdybys to přebíjela, tohle je
záměr, ne omyl.

## Tým GO Rocket v Taháku + sbalené sekce (16. 9.)

**Nová data `RAKETA` v appce** (`{grunti: [{typ, hlaska, sloty}], vudci:
[{jmeno, sloty}]}`) ze scraperu `tools/build_raketa.py`, který se pouští
při nasazení. Tahák z nich skládá kartu na každou hlášku: typ, co grunt
vykřikne, jeho tříslotovou sestavu a **tvoje tři nejlepší countery
z rosteru**.

**Sekce Taháku jsou nově sbalené** (`<details class="cs-sekce">`): Raid
bossové, Tým GO Rocket, Na bosse typu… Rozbalený Tahák byl přes dvacet
bossů po šesti counterech.

**Žebříčky mají novou tabulku „PvP žebříčky — top 100 v každé lize"**
(`#refPvpTables`), taky sbalenou po ligách, s posunem v PvPoke u každého
druhu.

**Pozor při počítání karet:** raketácké karty mají vlastní třídu
`cs-raketa`, ne `cs-type` — jinak by se počítaly mezi typové karty. A text
Taháku teď obsahuje i **soupeřovy** pokémony, takže „je v taháku Charizard?"
už neznamená „mám Charizarda"; hledej v `.cs-picks`.

## Ikony forem, mega při slučování a hlídač řídicích znaků (16. 9.)

**Herní ikony u Mimikyu, Darmanitana, Thundura, Tornada, Landora
a Enamoruse** se dřív nenačetly (PokeMiners je bez přípony formy nemá)
a místo nich naskočil náhradní pixelový sprite. `atlasImage` teď vrací
adresu s formou (`pm778.fDISGUISED`, `pm555.fGALARIAN_ZEN` …). Na vrstvě
se nic měnit nemusí.

**Nový test čte i tvoje soubory.** Kontrola „vrstva nevolá nic, co engine
nemá" měla v regexu místo `\b` neviditelný znak, takže viděla jen volání
`window.__pgo.x`, a ne `P.x`. Teď vidí obojí. A nový hlídač projde
`atlas.js` a `atlas.css` na řídicí znaky (backspace a spol.) — kdyby ti
tam nějaký vlezl, test to řekne jménem souboru.

## Odznáčky lig v čištění boxu + jeden druh na ligu (16. 9.)

**Čištění boxu teď kreslí odznáčky lig přes `ligoveChipy`**, stejně jako
tabulka. Dřív tam byla vlastní kopie s `title`. Změny v DOM:

- uvnitř `.lg-chip` přibyl `<span class="lg-posun nahoru|dolu">▲3</span>`
  (posun v PvPoke), před `.lg-znak`;
- odznáček nemá `title`, ale `data-tip` s HTML bublinou;
- v bublině je podnadpis „Sloty téhle ligy drží (N z 6)", aktuální kus má
  `li.tip-ten` a pod seznamem může být „Volno ještě N sloty" nebo „Tenhle
  kus mezi nimi není".

**Engine:** předevoluce se v lize počítá jako druh, kterým se stane.
Rookidee a Corviknight už nedrží dva sloty Great League. Může se tím
změnit verdikt u kusů, které dřív držely druhý slot téhož druhu.

## Evoluce rovnou na poslední stupeň (16. 9.)

**Engine:** v evoluční řadě jde kliknout na kterýkoli pozdější stupeň, ne
jen na ten hned další. Machop → Machamp se zapíše jedním dialogem („Přes
Machoke — obě evoluce se zapíšou najednou"). Nové API `evoCile(radek)` vrací
`[{klic, jmeno, pres: [mezistupně]}]`; `evoKroky` dál vrací jen krok hned
další (tlačítka „Vyvinul jsem ho na…").

**Na vrstvě to nefunguje — a nefungovalo ani předtím.** V `atlas.js`
(bublina evoluční řady) je:

```js
document.addEventListener('click', e => {
  const el = e.target.closest('#atlasModal .d-evo-kus[data-tip]');
  if (el) { show(el); e.stopPropagation() } ...
}, true);
```

Listener běží v capture fázi na `document`, takže `stopPropagation()`
zastaví klik dřív, než dojde k prvku. Posluchač enginu na `.evo-klikaci`
se nespustí a dialog evoluce se neotevře (ověřeno Playwrightem: produkce
otevře „Vyvinul jsi ho na Machamp?", TEST nic). Stačí nezastavovat klik
u prvků s třídou `evo-klikaci` — bublinu ukázat a klik pustit dál.
Test 246 („klik otevře dialog evoluce na Machampa") na TEST verzi do té
doby padá.

## Rezerva v lize a paměť pořadí (16. 9.)

PvPoke přehazuje pořadí každý týden, takže appka vyhazovala kusy, které
by byly za týden zase dobré. Nově:

- **Nastavení** (sekce „Rozpočet rolí"): `#ligaRezerva` (číslo, výchozí 6)
  a `#pametPoradi` (zaškrtávátko `.setting-prepinac`, výchozí zapnuto).
- **Verdikt „Nechat – rezerva"** s `keepTone: "warning"` (oranžová) a
  `getComputed()[id].jeRezerva = true`. `powerup` je „Ne" s podtitulkem
  „rezerva — prach zatím ne". Pokud si verdikty mapuješ na barvy nebo
  ikony, doplň ho — jinak spadne do výchozí větve.
- **Bublina ligy**: podnadpis „Sloty téhle ligy drží (N z 12, z toho 6
  hlavních)", u položek v rezervě `<span class="tip-znak tip-rezerva">`.
- **API**: `pametPoradi(klic, liga, forma)` → `{rank, datum, dni}` nebo
  `null`; `pametPoradiData(data?)` čte nebo (pro testy) přepíše data paměti.
  Sloty z `drziteleLigy` mají navíc `rezerva`, `rezervaDuvod` („misto" /
  „pamet") a `pamet: {rank, datum}`.
- **Bublina ligy má novou část „Nejblíž pod čarou"** (`ul.tip-seznam.tip-pod`):
  kusy, které se nevešly, s důvodem („kvalita 90,3 %, potřeba 94,8 %" nebo
  „všechna místa drží lepší"). API `ligaPodCarou("LC"|"GL"|"UL"|"ML")`.
- Šipky posunu v tabulce žebříčků (`.ref-pvp-tab .d-lg-posun`) mají nově
  barvu nahoru/dolů jako v detailu kusu.

## Širší bublina u lig (17. 9.)

Bublina se seznamem (liga: držitelé a „Nejblíž pod čarou") se v enginu
roztáhne na `max-width: min(460px, calc(100vw - 16px))` přes
`.tip-bublina:has(.tip-seznam)`. Ve 320 px se řádek „Fennekin 440 CP #38 —
kvalita 94,2 %, potřeba 95,3 %" lámal a procento zůstalo samo na dalším
řádku. Čísla a znak % jsou teď spojené nezlomitelnou mezerou.

**Na vrstvě:** `.atlas-test .tip-bublina{max-width:min(430px,…)}` v
`atlas.css` má stejnou specifičnost a načítá se později, takže engine
přebije. 430 px zatím stačí (test chce aspoň 400), ale kdybys bublinu
zužovala, nech u `:has(.tip-seznam)` aspoň 440 px.

## Důvody verdiktu jako štítky (17. 9.)

Lukáš chtěl místo podtitulku „gym 3/8 +1" štítek na každý důvod. V enginu:

- **Data:** `getComputed()[id].duvody` (popis v kontraktu). Sloty rozpočtu
  (liga, raid typ, gym, Max, mega) + značky, které kus drží samy (CUTE,
  100 %, Lucky, Elitní útok, Nejde pustit, Dynamax, Shiny, Trade,
  Doskenovat, Duplikát?). Hlavní slot je první.
- **Buňka Verdikt:** u ponechaného kusu `.badge` + `<span class="dv-radek">`
  se štítky `.dv-chip.dv-liga|dv-raid|dv-role|dv-znacka`, náplast
  `.dv-naplast`, rezerva `.dv-rezerva` (přerušovaný okraj), raid typ má
  barvu typu inline. Pouštěný kus má dál `.cell-sub` s větou.
- **„+N":** po vykreslení `srovnejDuvody()` změří šířku buňky, štítky, které
  se nevejdou, dostanou `hidden` a `.dv-vic` ukáže „+N" s bublinou. Když
  buňku přestyluješ (jiná šířka, karty), zavolá se znovu přes
  ResizeObserver na `.card.roster` — nic dalšího netřeba.
- **Bubliny:** každý štítek má `data-tip` (HTML). Ligy = bublina ligy
  (držitelé, pod čarou), raid typ a gym = krátké „proč" + `ol.tip-seznam`
  s pořadím držitelů a `li.tip-ten`, ostatní jen „proč".
- **Filtr:** šipka ve sloupci Verdikt má pod hodnotami sekci „Důvod
  (štítky)" (`input[data-duvod]`, `.filtr-duvody`). API `drziteleSlotu(klic)`.
- Ostatní sloupce (RAID, GYM, PVP TÝM) zůstávají, jak jsou.

**Směr pro tvoji verzi (Lukášovo přání):** v tabulce má být info mnohem
méně — pokémoni jako plovoucí bubliny se základním infem (jméno, CP/IV,
verdikt a štítky důvodů), podrobnosti až po najetí nebo otevření. Štítky
jsou na to připravené: data jsou v `duvody`, bubliny v `data-tip`.
- **Pořadí držitelů i u rolí, kde už byly** (Lukáš: „pořadí v tooltipu tam
  zatím vůbec není"): buňky `td[data-col="raidRec"]` a `td[data-col="gymRec"]`,
  karta `.d-role` (Raid, Gym — obránce) v detailu a `.bm-role` (Raid, Gym)
  v čištění boxu mají u kusu, který slot drží, `data-tip` s HTML bublinou:
  „proč" + `ol.tip-seznam` s pořadím, víc typů oddělených `hr.tip-oddel`.
  Kus bez slotu má dál původní textový popisek. API `bublinaRole` není —
  je to vnitřní funkce, data jsou v `duvody`.

## Štítky ve tvé verzi (17. 9.)

Lukáš chce štítky důvodů hlavně ve tvé verzi. Co je hotové v enginu:

- **Detail kusu** (`atlasDetail`) má v `.d-verdict` místo `.d-sub` blok
  `.d-duvody` se všemi štítky (zalamují se). Nic dělat nemusíš, jen
  zkontroluj, že je nepřebíjí tvůj styl detailu — a že se verdikt v detailu
  nezdvojuje (bod 4 v přehledu).
- **Pro tvoje karty** je v API `atlasDuvody(id nebo objekt z getComputed)`:
  vrátí hotové HTML (`span.dv-radek` se štítky `.dv-chip`), každý štítek
  má `data-tip` s bublinou (u lig držitelé a „pod čarou", u raid typů a gymu
  pořadí držitelů). Pouštěný kus vrátí `""` — tam nech `keepSub`.
- Po vložení do stránky zavolej `srovnejDuvody(kontejner)`: změří šířku a co
  se nevejde, schová do „+N" s bublinou. Při změně šířky karty ho zavolej
  znovu (engine to dělá pro tabulku přes ResizeObserver).
- Bubliny zobrazuje engine (`.tip-bublina`) přes `data-tip`, tvůj styl
  `.atlas-test .tip-bublina` se na ně použije.
- Kde teď v `atlas.js` čteš `c.keepSub` (souhrn role v kartě a přehled),
  nahraď ho u ponechaného kusu štítky. Styly `.dv-*` si klidně přestyluj,
  jen nech třídy `dv-liga / dv-raid / dv-role / dv-znacka`, `dv-rezerva`,
  `dv-naplast` a `dv-vic` — podle nich se to testuje.

## Co Claude změnil ve vrstvě (17. 9.)

Cílené náhrady, soubor jsem nepřeformátovával:

- **`atlas.js`, karta rosteru (`rowHTML`):** v `.atlas-decision` je místo
  `<small>` se souhrnem rolí `P.atlasDuvody(c)`. Pouštěný kus má `<small>`
  dál. Po vykreslení seznamu `renderRoster` volá `P.srovnejDuvody(list)`.
- **`atlas.js`, detail (`AtlasEnhanceDetail`):** už nepřidává
  `p.atlas-role-summary` s `keepSub` — verdikt má štítky a text je zdvojoval.
- **`atlas.js`, hlavička detailu:** `.hra-pruh` se vkládá před
  `#atlasEditPokemon` (dřív na konec hlavičky, pod tlačítka).
- **`atlas.js`, bublina evoluční řady (`show`):** pravý okraj se omezí na
  obsah posouvaného rodiče (bez posuvníku), ne na šířku okna.
- **`atlas.css`, na konci souboru** (blok s komentářem „Claude 17. 9."):
  `.atlas-decision{min-width:0}`, hlavička `1fr auto auto auto` a
  `.hra-pruh{grid-column:auto}` (na telefonu do 650 px dál na vlastním
  řádku), `.atlas-evolution-column .d-evo>.d-box-h{display:none}` (nadpis
  nese `<summary>`).

Druhé kolo téhož dne (Lukášovy screenshoty):

- **Menu „Správa rosteru":** `#clearUnstarredBtn` („Smazat neoznačené") je
  v seznamu hned před `#clearBtn` („Vymazat vše"), z lišty zmizel.
- **Věta o uložení pryč:** `atlas.css` schová `#saveState` a `#backupState`
  bez třídy `warn` — zůstává jen žluté varování, že záloha chybí.
- **Úprava kusu (`AtlasEditRow`):** rychlý a oba nabité útoky mají
  `<datalist>` s útoky druhu z nového API `P.utokyDruhu(jmeno)`; při změně
  druhu se nabídka přepočítá.
- **Detail:** vysvětlení verdiktu `.d-why` opakovalo bubliny štítků — když
  štítky jsou, přesune se do `data-tip` nadpisu verdiktu (`.d-verdict>b`).
- **Řazení (`#atlasSort`):** oba směry pro jméno, CP, IV a level, řazení
  všech lig dohromady a zvlášť Little/Great/Ultra/Master League (nejlepší
  i nejhorší první, klíče `liga:GL` atd. v enginu). „Původní řazení"
  řazení opravdu zruší. Hodnota se dělí podle poslední dvojtečky.
- **Přehled:** počty akcí česky („1–4 akce", „0 a 5+ akcí"), stejně
  „Další 2 akce / Dalších 7 akcí najdeš…".

Třetí kolo (17. 9. odpoledne):

- **Rozbalovátko „Uložení a zálohování rosteru" zrušené** — obsahovalo jen
  `#zalWarn`, který je bez chybějící zálohy schovaný, takže bylo prázdné.
  `#zalWarn` je teď hned pod lištou rosteru. Řádek `.tb-radek.tb-hledani`
  (jen skrytý `viewSelect`, `#saveState`, `#backupState`) je ve vrstvě
  schovaný celý.
- **Úprava kusu:** místo datalistu stejný výběr útoků jako ve Vyhledávání
  (`window.__pgoUtoky.vyber` — typ, síla, ★ elitní) na dočasném objektu,
  hodnota jde do skrytých polí formuláře. `.uv-seznam` má ve vrstvě
  `z-index:1600`, jinak byl schovaný pod `#atlasModal` (1500).
- **Řazení podle času:** „Naposledy naskenované / Nejdéle nenaskenované"
  (`scanDate`) a „Nejnověji / Nejdéle chycené" (`catchDate`, z importu
  Calcy „Catch Date").
- **Vyhledávání:** Level je v HTML hned za CP; mřížka 6 sloupců (útoky přes
  dva), od 1700 px všech 9 v řádku, do 900 px 3, do 520 px 2. Tvoje pravidla
  `label:nth-child(-n+6)` sedí dál — prvních šest jsou pořád čísla.

Čtvrté kolo (17. 9. večer):

- **Prázdná lišta pod rosterem:** `.card.roster > .toolbar` obsahovala už jen
  skrytý `.profile-box`, takže se kreslila jako prázdný rámeček. Ve vrstvě je
  schovaná, dokud se profil neotevře (`:has(.profile-box:not([hidden]))`).
- **Vyhledávání, Ligy podrobně:** nadpis `.d-liga-forma` (malý obrázek + jméno)
  se kreslí jen u víc forem nebo evolucí; u jednoho druhu jen opakoval jméno.
- **Řazení podle chycení** dořazuje stejné a neznámé datum podle skenu.
- **Import** v poznámce u výběru skenu řekne, kolik řádků má datum chycení.

Hlídá to **`tests/atlas_vrstva.test.mjs`** (37 kontrol, běží proti TEST
verzi, i na 390 px). Když to budeš graficky předělávat, nech třídy `dv-*`,
`hra-pruh` před `#atlasEditPokemon` a `atlasEvoTooltip`, ať test sedí.

**Pozor na testy:** hlavní sada `web_app.test.mjs` je pro vzhled enginu a na
TEST verzi **neprojde** (Export je u tebe v menu „Správa rosteru" a sada na
něm spadne). Přepínač `PGO_APP` dřív navíc měnil jen kořen `/`, ne adresu,
kterou testy otevírají — takže dřívější „web_app na TEST verzi" běžel ve
skutečnosti proti produkci. Opraveno; vrstvu ověřuj `atlas_vrstva.test.mjs`
a `audit_app.test.mjs` s `PGO_APP`.

---

Kolo 20. 9. — čištění boxu, hlavička a tabulka lig
--------------------------------------------------

Všechno je v očíslovaných blocích na konci `atlas.css` („Claude 20. 9.",
„Claude 20. 9. (2)") a v `atlas.js`. Tvoje bloky jsem nesahal.

- **Panel čištění boxu má pevnou velikost.** Mřížka `.atlas-box-rozbor` má
  `grid-template-rows:190px minmax(0,1fr)` — evoluční sloupec dřív táhl výšku
  řádku, takže verdikt a značky poskakovaly až o 33 px podle toho, jak dlouhá
  byla evoluční řada. Když s tím budeš hýbat, výšku hlavičky nech pevnou.
- **Čtyři boxy hlavičky** (staty, IV, strop, útoky) mají `height:150px`
  a `align-self:center`. Útoky jsou širší (`flex:0 1 310px`), ale stejně
  vysoké; chipy mají `flex-wrap:nowrap`, jinak dvojice útoků zalomila řádek
  a box přetekl.
- **Box útoků není nikdy prázdný.** U kusu bez ligových sestav (Lucario)
  se sestava poskládá z nejlepší možné sestavy z enginu. Řádky mají popisek
  „teď" / „po evo".
- **Evoluční řada:** šipky 20 px, po rozbalení 26 px, stupně vystředěné
  (`justify-content:center` — Eevee s osmi větvemi stál mimo osu). Obrázkům
  je vypnutá animace `opacity`, jinak při přechodu mezi kusy problikávaly.
- **Tabulka lig v boxu:** slabé pořadí (`td.d-lg-slaby`) dostalo červený tón
  jako ostatní stavy — v enginu ho schválně nemá, v úzkém sloupci se ale
  stav jinak nepozná. Pruh kvality `.d-lg-bar` je v boxu **skrytý**: ukusoval
  šířku a text se nevešel na tři řádky. Procento zůstává číslem vedle pořadí.
  Poslední řádek tabulky nemá spodní linku.
- **Stejná animace v obou směrech:** `.bm-panel{transition:height .22s ease,
  width .22s ease}` a stejných `.22s` mají i bloky uvnitř, aby sbalení
  nepředbíhalo obsah.

V enginu (mimo vrstvu): verdikt **Purifikovat** je vždycky zelený — oranžová
je vyhrazená pro „Zvážit" — a text se přesunul do bubliny. Když má kus tři
akce (Vylepšit + Evolvovat + Purifikovat), **Tradovat** se už nekreslí,
čtvrtá kartička rozbíjela řádek.

Hlídá to `tests/atlas_vrstva.test.mjs` (91 kontrol) a `tests/web_app.test.mjs`
(2339 kontrol, blok 259).
