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
