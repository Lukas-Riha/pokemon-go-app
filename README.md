# Pokémon GO — Guide, Tracker & Web App

Cíl projektu: **appka, která si přečte tvoje pokémony a sama u každého řekne, co s ním** —
nechat / zahodit / vylepšit / evolvovat / mega-evolvovat / do gymu / do raidu / do PvP týmu.

## Kontext (proč tohle existuje)

Konverzace začala požadavkem na "100% kompletní guide na Pokémon GO včetně všech
pokémonů". Protože doslovná databáze 1000+ pokémonů by byla k ničemu, dohodli
jsme se na strategickém guide s kompletními mechanikami + TOP pokémoni podle
role, ve Wordu a Excelu.

Dál padl dotaz, jestli lze appku napojit přímo na hráčův Pokémon GO účet přes
API a denně automaticky vyhodnocovat roster. Odpověď: **Niantic nemá veřejné API.**
Jediná cesta k datům je buď neoficiální reverse-engineered API (porušuje ToS,
riziko banu — proto to neděláme), nebo appky jako **Poké Genie** / **Calcy IV**,
které čtou obrazovku hry (screen-reading), nikoli síťové API — to je bezpečné a
běžně používané.

Reálný pracovní postup je tedy:

```
Poké Genie (hromadný sken celého boxu)  →  export CSV
        →  přetáhnout soubor do webové appky
        →  appka vyhodnotí celý roster naráz
```

## Struktura

```
data/reference.json   kurátorovaná data (TOP raidy, gymy) — ruční zdroj pravdy
data/pokedex.json     herní data (typy, base staty, evoluce, mega, CPM) — generovaná
data/meta.json        PvP žebříčky z PvPoke — generovaná, obnovitelná jedním příkazem
docs/                 návody pro uživatele
tools/                skripty pro údržbu dat a kontrolu výstupů
docx-guide/           zdroj + hotový .docx (kompletní strategický guide)
xlsx-reference/       zdroj + hotový .xlsx (statická tabulka TOP pokémonů)
xlsx-tracker/         zdroj + hotový .xlsx (doporučovací engine ve vzorcích)
web-app/              samostatná HTML/JS appka se stejnou logikou (hlavní nástroj)
tests/                regresní test webové appky (Playwright)
```

### `data/reference.json` — zdroj pravdy

Dřív byla referenční data (TOP raidoví útočníci, gymoví obránci, PvP ligy)
napsaná **třikrát** ručně — v `build_xlsx.py`, v `build_tracker.py` a v HTML
appce. Teď jsou jednou tady a všechno ostatní z nich čerpá:

| konzument | jak čte data |
|---|---|
| `xlsx-reference/build_xlsx.py` | `json.load` při buildu |
| `xlsx-tracker/build_tracker.py` | `json.load` při buildu |
| `web-app/pokemon_tracker_app.html` | zapečeno skriptem `tools/sync_reference.py` |

### Obnovení dat po nové generaci pokémonů

```
python tools/refresh_all.py
```

Jeden příkaz: stáhne pokédex → útoky → ligy → eventy, pustí **audit integrity dat**,
zapeče vše do appky a nakonec spustí obě testovací sady. Když cokoli neprojde,
skončí a řekne u kterého kroku — do appky se nezapeče nic rozbitého.
Pořadí není libovolné: klíče druhů z PvPoke se párují proti pokédexu, takže
pokédex musí být čerstvý první. `--offline` jen přepočítá z `data/raw/`.

### Denní záloha + kontrola (dá se naplánovat)

```
python tools/audit_zaloha.py
```

Zazálohuje `data/*.json` a hotovou appku do `zalohy/RRRR-MM-DD_HHMM/` —
**zálohuje se dřív, než se cokoli kontroluje**, aby poslední funkční stav byl
stranou i kdyby audit spadl uprostřed. Pak pustí audit dat a obě testovací sady
a napíše `report.txt` do složky se zálohou. Souhrn všech běhů je
v `zalohy/posledni.txt`. Drží posledních 20 generací, starší maže sám.

Naplánovat na každý den ve 20:00:

```
powershell -ExecutionPolicy Bypass -File tools
aplanovat.ps1
```

`-Cas "21:30"` jiný čas, `-Ted` zkusit hned bez registrace, `-Odebrat` zrušit.

### Pískoviště — zkoušení změn mimo ostrou appku

```
python tools/pisek.py
```

Vygeneruje `web-app/pokemon_tracker_TEST.html` z **aktuální ostré appky** a
nalepí na ni pokusy ze složky `web-app/pokusy/*.py`. Nedrží se druhá kopie,
která by se rozešla — pokus je vždycky nad tím, co je v ostré verzi teď.
Testovací soubor je označený oranžovým pruhem a `[TEST]` v titulku,
je v `.gitignore` a `deploy.ps1` ho do sdílené složky nepustí (a kdyby ho tam
někdo přetáhl, smaže ho).

Každý pokus je jeden soubor:

```python
NAZEV = "krátký popis"
def uprav(html: str) -> str:
    return html.replace("kotva", "kotva" + MOJE_ZMENA)
```

Když pokus spadne nebo nenajde, co hledá, skript to řekne a pokračuje
s ostatními. Vygenerovaný JavaScript se navíc zkontroluje přes `node --check`,
takže se rozbitý pokus pozná hned, ne až podle prázdné stránky v prohlížeči.
Když se pokus osvědčí, přesune se do normálního patch skriptu a ze složky
`pokusy` zmizí.

| přepínač | co dělá |
|---|---|
| `--seznam` | vypíše dostupné pokusy |
| `--jen menu` | vygeneruje jen s tímhle pokusem |
| `--bez menu` | vygeneruje bez něj |

Když se pokus osvědčí, propíše se do ostré appky:

```
python tools/propsat.py menu utoky
```

Aplikuje ho na `pokemon_tracker_app.html` **úplně stejně**, jako ho aplikoval do
pískoviště — takže co jsi odsouhlasil v testu, je přesně to, co skončí
v produkci. Soubor pokusu se přesune do `web-app/pokusy/hotovo/`, ať se
nenalepí podruhé. Skript sám nic nenasazuje: pusť pak testy a `deploy.ps1`.

Kontrolní skripty:

| skript | co hlídá |
|---|---|
| `tools/audit_data.py` | integrita JSON dat: typy, evoluční řetězce, CPM bez děr, indexy útoků, klíče lig |
| `tests/audit_app.test.mjs` | výpočty přes **celý pokédex**: CP roste, cíle lig nepřetečou cap, žádné NaN, žebříčky v rozsahu |
| `tests/web_app.test.mjs` | chování appky (978 testů) |

Appka navíc sama vypíše varování, když v rosteru najde druh, který herní data
neznají — tak se nová generace nikdy neprojeví tiše.

Webová appka musí zůstat jeden samostatný soubor otevíratelný přes `file://`,
proto se data nenačítají fetchem, ale vkládají se do označeného bloku
`// === REFERENCE DATA START/END ===`. **Po každé změně `reference.json` spusť
`python tools/sync_reference.py`**, jinak web zůstane na starých datech.

Obsah: 70 raidových útočníků (podle typu — appka je dnes používá **jen jako
záložku pro mega formy**, jinak si žebříček počítá sama), 8 gymových obránců
(appka je nepoužívá vůbec, obránce si počítá z Def × HP, typování a síly útoků), 47 mega/primal
evolucí, 10 druhů s evolucí zdarma po tradu, 15 + 12 + 12 PvP picků (GL/UL/ML). Každý záznam má navíc `matchNames`
(pro matchování jmen v JS) a `matchName` (pro `COUNTIF`/`MATCH` v Excelu).

### `data/pokedex.json` — herní data

Upečená veřejná herní data z [pogoapi.net](https://pogoapi.net) (mirror herního
game masteru): **1051 druhů a forem**, base staty, typy, evoluční řetězce,
**47 mega/primal forem** včetně jejich statů, a tabulka CP multiplierů (level 1–45).

Díky tomu appka **neptá uživatele na to, co si může zjistit sama**:

| dřív ruční vstup | teď |
|---|---|
| „Finální evoluce? Ano/Ne" | z evolučních řetězců (588 druhů je finálních) |
| ručně psaný seznam mega evolucí | z herních dat, včetně Mega Charizard X vs Y |
| typy pokémona | z herních dat |
| PvP kvalita = rank z Poké Genie | **stat product spočítaný z IV** (viz níže) |

Regionální a bojové formy se rozlišují (`stunfisk` vs `stunfisk-galar`,
`landorus-therian`), protože mají jiné staty i typy — a hlavně: galarský
Farfetch'd se umí vyvinout, běžný ne.

Regenerace: `python tools/build_pokedex.py --refresh` (surová data se cachují
v `data/raw/`).

#### PvP potenciál z IV

Appka pro Great a Ultra ligu spočítá, na jaký nejvyšší level se kus vejde pod
CP limit, z toho jeho **stat product**, a porovná ho s teoretickým maximem
jeho vlastního druhu. Výsledek je „GL 96 % (L14.5, 1481 CP)". Nepotřebuje na to
ranky z Poké Genie — stačí IV.

Práh, od kterého to engine bere jako PvP pick, je nastavitelný a **výchozí je
98 %**. Není to kosmetika: stat product se mezi kombinacemi IV liší málo, takže
95 % projde 36 % všech kusů (medián je 94 %), zatímco 98 % projde 3,6 % —
zhruba obdoba ranku 150 z Poké Genie.

Důležité omezení, na které narazil test: **vysoký stat product má i druh, který
do ligy vůbec nepatří** — Metagross v Great League vyjde na 96 %, a přesto je to
nesmysl. Jako signál pro doporučení se proto bere jen u druhů, které v té lize
podle `reference.json` opravdu hrají. U ostatních se % ukazuje jen informativně
s poznámkou „druh není meta pro GL/UL". Master League se takhle hodnotit nedá
(nemá CP limit), tam rozhodují ranky z Poké Genie.

### `data/meta.json` — kdo je v které lize meta

Top 200 picků na ligu z [PvPoke](https://github.com/pvpoke/pvpoke) (GL / UL / ML),
po sloučení variant 144 / 143 / 136 druhů. Nahrazuje otázku „hraje tenhle druh
vůbec v téhle lize?", kterou dřív odpovídal ručně psaný seznam 39 picků.

Proč to není kosmetika: **stat product sám o sobě nic neříká** — Metagross vyjde
v Great League na 96 % a přesto tam nemá co dělat. Teprve kombinace „je v PvPoke
top 200 pro tuhle ligu" + „má vysoký stat product" dává použitelné doporučení.
V appce se pořadí ukazuje jako „PvPoke #21“.

Obnova po balance patchi: `python tools/build_meta.py --refresh` a pak
`python tools/sync_reference.py`.

### Stáří dat a poctivost doporučení

Appka v patičce ukazuje **tabulku zdrojů** — co je tvrdé herní datum, co je
názor komunity (PvPoke) a co ručně udržovaný seznam, u každého datum stažení
a stáří ve dnech. Když je cokoliv starší než 90 dní, objeví se varování
s příkazy na obnovu. Je tam i konkrétní návod, kdy a co ověřit na PvPoke —
včetně upozornění, že **útoky (movesety) appka vůbec neřeší**, což je největší
díra v jejích doporučeních.

### `data/moves.json` — útoky

77 rychlých a 235 nabitých útoků (typ, síla, energie, doba) + learnsety pro
1051 druhů včetně **elitních útoků** (ty jdou naučit jen přes Elite TM).

Engine z toho počítá DPS movesetu a porovnává ho s nejlepším, který se ten druh
může naučit. Tři věci, které stojí za zapamatování, protože bez nich model lhal:

- **DPS se počítá váženým vzorcem** (ne naivním „n rychlých + nabitý") — ten
  naivní přeceňoval útoky s vysokou energií.
- **Přednost mají dvojice se stejným typem.** Metagrossovi vycházel Fury Cutter
  (Bug) líp než Bullet Punch (Steel), což je proti Fairy bossovi nesmysl.
- **Elitní útok musí být aspoň o 2 % lepší**, jinak vyhraje běžný — nemá cenu
  posílat uživatele pálit Elite TM kvůli půl procentu.

Moveset se hodnotí **v rámci role**: Tyranitar s Rock movesetem je „Top Rock",
ne „špatný", a zvlášť se řekne, že jako Dark by byl silnější.

Obnova: `python tools/build_moves.py --refresh`.

### `tools/`

| skript | co dělá |
|---|---|
| `extract_reference.py` | jednorázová extrakce dat z původního `build_xlsx.py` do JSONu (v repu kvůli reprodukovatelnosti) |
| `build_pokedex.py` | stáhne veřejná herní data a upeče `data/pokedex.json` |
| `build_meta.py` | stáhne PvP žebříčky z PvPoke a upeče `data/meta.json` |
| `build_moves.py` | stáhne data o útocích a upeče `data/moves.json` |
| `augment_reference.py` | doplní mega/primal seznam a normalizovaná jména; pouštět po ruční editaci JSONu |
| `sync_reference.py` | zapeče oba JSONy (reference + pokédex) do webové appky |
| `check_tracker.py` | kontrola vzorců v hotovém trackeru bez Excelu (viz „Ověřování“) |
| `deploy.ps1` | zkopíruje appku + návod do sdílené OneDrive složky pro kolegyni |

### `docx-guide/`

- `build.js` — sdílené helpery pro `docx` (npm): nadpisy, tabulky, odrážky.
- `main.js`, `main2.js`, `main3.js` — obsah guide rozdělený do 3 částí.
- `assemble.js` — spojí části, nastaví page size/margins/header/footer, vyrenderuje `.docx`.
- 22 kapitol: mechaniky (XP, stardust, candy, XL candy, IV, evoluce, Shadow/
  Purified/Lucky, počasí, buddy), typová tabulka, strategie vylepšování, raidy +
  Mega Evoluce, obrana gymů, PvP, itemy, vejce, přátelství, eventy, tipy.
- Guide obsahuje meta-disclaimer: PvP/raidové žebříčky se mění s balance patchi.

### `xlsx-reference/`

`build_xlsx.py` (openpyxl) → `Pokemon_GO_TOP_Pokemoni.xlsx`, 7 listů:
Info, Raid Attackers, Gym Defenders, **Mega Evoluce**, Great/Ultra/Master League.
Statická referenční tabulka, žádné vzorce.

### `xlsx-tracker/`

`build_tracker.py` (openpyxl) → `Pokemon_GO_Tracker.xlsx` — doporučovací engine
ve vzorcích (12 500 vzorců), pro lidi, co chtějí zůstat v Excelu / Google Sheets.

Listy: `Návod`, `Nastavení`, `Import`, `Ref_Raid`, `Ref_Gym`, **`Ref_Mega`**, `Doporučení`.

- `Nastavení` — 4 prahy: IV % pro „vysoké IV“, PvP rank pro „elitní“ pick,
  min. jednotlivé IV pro TOP roli a **kolik kopií druhu si nechat**. Vzorce na
  ně odkazují přes buňky, žádná magická čísla přímo ve formulích.
- `Import` — ruční vstup (kapacita 500 řádků), žluté buňky, IV % dopočítané
  vzorcem, dropdowny pro Forma / Finální evoluce / Buddy.
- `Doporučení` — 24 sloupců: pomocné příznaky (A–P) + finální doporučení
  (Q–X): PONECHAT/ZAHODIT, VYLEPŠIT, EVOLVOVAT, **MEGA EVOLUCE**, DO GYMU,
  DO RAIDU, PVP TÝM, Shrnutí. Nově počítá i **počet kopií** (`COUNTIF`) a
  **pořadí kopie** (`COUNTIFS` podle IV %).
- **Formulová kompatibilita**: záměrně jen `IF/AND/OR/NOT/COUNTIF/COUNTIFS/
  INDEX/MATCH` — žádné `XLOOKUP/IFS/SORT/FILTER/UNIQUE`, aby to jelo i v Google
  Sheets a starším Excelu/LibreOffice bez `_xlfn` problémů.

### `web-app/pokemon_tracker_app.html` (hlavní nástroj)

Samostatný self-contained HTML/JS soubor — žádné závislosti, žádný build krok,
stačí otevřít v prohlížeči. `analyze()` uvnitř souboru je ekvivalent vzorců
z trackeru, jen chytřejší (viz rozdíly níže).

Co umí:

- **Import souborem** — přetáhni CSV/TSV export z Poké Genie / Calcy IV na drop
  zónu, nebo vlož text přes Ctrl+V. Oddělovač (tab/`,`/`;`) se detekuje sám.
- **IV z přejmenování** — Poké Genie i Calcy IV umí zdarma přepsat přezdívku
  pokémona na jeho IV (`Metagross 15/14/13 93%`). Import z takového textu vytáhne
  druh, IV i procenta a původní přezdívku uloží do poznámky — takže **placený CSV
  export není podmínka**. Funguje i na holém seznamu jmen bez hlavičky.
- **Automatické mapování sloupců** — hlavička se rozpozná podle aliasů (české
  i anglické názvy), co se nepovede, doladíš v mapovacím UI s náhledem prvních
  řádků. Zvládne i IV zapsané jako `13/15/14` v jednom sloupci a formu
  v samostatných sloupcích (`Shadow/Purified`, `Lucky`) — Poké Genie totiž mívá
  `Form = Normal` i u shadow kusu.
- **Tři režimy importu** — *Sloučit s rosterem* (výchozí; aktualizuje, co sedí,
  přidá, co je nové, a **nechá ruční úpravy** jako Forma/poznámka), *Nahradit*
  (s potvrzením, protože ruční úpravy zahodí) a *Přidat vše*. Export z Calcy IV
  je vždy celá historie, takže „přidat“ by roster zdvojilo.
- **Slučování opakovaných skenů** — kdo si kus doskenuje podruhé s otevřeným
  Appraisal (kvůli přesným IV), má ho v exportu dvakrát. Import to pozná podle
  shody druh + CP + level + útoky, **a navíc ověří, že si oba skeny o IV
  neodporují** — dva různé kusy se shodným CP tak zůstanou oba. Nechá přesnější
  sken a napíše, kolik jich sloučil; dá se vypnout zaškrtávátkem.
  Zvlášť se řeší **tentýž kus po vylepšení**: IV se nemění, CP ano, takže shodná
  přesná IV při jiném CP nedostanou verdikt zahodit, ale varování
  „Zkontroluj — možná ten samý kus".
- **Útoky a movesety** — sloupec „Útoky" řekne, jestli má kus top moveset ve své
  roli, nebo ho pošle přeučit (a na co). Filtr i dlaždice „Přeučit útoky".
  Typy útoků zároveň zpřesňují sloupec „Silný proti typům".
- **Cena vylepšení** — u kusů, do kterých se má investovat, je rovnou „225 tis.
  prachu do L40"; v tooltipu i bonbóny. Tabulka cen je v `pokedex.json`.
- **Tradování** — sloupec „Tradovat?": druhy s evolucí zdarma po tradu
  (10 druhů v `reference.json`), slabé kusy meta druhů jako kandidáti na
  přehození IV, a shadow kusy označené jako netradovatelné.
- **Předvýběr na doskenování** — sloupec „Doskenovat s Appraisal?" řekne, u kterých
  nejistých skenů se vyplatí otevřít ve hře Appraisal a naskenovat znovu (meta
  druh, raid/gym pick, mega kandidát, nebo dost vysoký strop IV) — a u kterých
  je to ztráta času. Uzavírá to smyčku: hrubý sken → předvýběr → doskenovat →
  znovu import.
- **Shadow vs. purify** — vlastní sloupec „Purifikovat?" a filtr: *Nechat*
  (raidový druh — +20 % útoku je víc než +2 IV), *Ano* (PvP kus, kde −20 %
  obrany bolí, nebo druh, kterého do raidu stejně nedáš), ✕ (není shadow).
  Hranice je 60 % špičky svého typu.
- **Legendární / mytičtí / Ultra Beasti** — hra je nepustí do hromadného
  transferu (mytické nejde transferovat vůbec), takže je engine nikdy nepošle
  do koše. Dostanou „Ponechat" s vysvětlením a v tabulce **barevný štítek u jména**
  (LEG / MYT / UB) plus vlastní filtr. Vzácnost je v `pokedex.json`
  (`pokemon_rarity` z pogoapi, 124 druhů z 1051).
- **Seznam nechat / pustit** — každý kus dostane právě jeden důvod, proč si ho
  nechat (raid / PvP / gym / trade / speciální forma / mega / vysoké IV /
  dovyvinout), zbytek je v seznamu k transferu. Raidový útočník se nechává jen
  když je aspoň na 50 % špičky svého typu — jinak si musí najít jiný důvod,
  nebo jde pryč. Je součástí taháku, takže to jde odklikat u boxu.
- **Prázdný start** — appka se nikdy neplní ukázkovými daty sama. Nový uživatel
  vidí prázdný stav s pokynem, co udělat, a ukázka se načte až tlačítkem.
  (Dřív se seedovali tři pokémoni, což u nového uživatele vypadalo jako
  cizí roster.)
- **Tahák na ven** — vygeneruje samostatnou HTML stránku (stáhne se souborem)
  s tím, koho nasadit na bosse každého z 18 typů, koho nechat v gymu a jaké má
  hráč PvP týmy. Vše inline, funguje offline v mobilu, dá se vytisknout.
  Typy bez counteru jsou označené jako díry v pokrytí.
- **Měřítko proti špičce** — u každého návrhu je „kolik % špičky" tzn. poměr
  k nejlepšímu možnému útočníkovi toho typu ve hře (spočítá se ze všech 1051
  druhů a jejich learnsetů, cachuje se). Bez toho appka radila investovat i do
  slabých kusů jen proto, že nic lepšího v rosteru není. Pod 55 % poradí počkat.
- **Power up list** — karta „Power up list — kam dát prach jako první" vybere
  jeden nejlepší kus na roli (jeden raidový útočník na každý útočný typ, 3+3 PvP
  picky, 2 obránci) a spočítá, kolik prachu to dohromady stojí. Filtr se 70 kusy
  k rozhodnutí nepomůže; tohle ano. U každého řádku je **CP, IV % a level toho
  konkrétního kusu** — se třemi Machampy nestačí druh. Přezdívka se do popisku
  nebere: Calcy si pokémony sám přejmenovává (`Gya♂84-87`) a byl by to šum.
  Jeden kus se v seznamu neopakuje — Gyarados dobrý do GL i UL obsadí jeden
  slot a druhá liga si vezme dalšího v pořadí.
- **Hledání a řazení** — vyhledávací pole, klik na jméno v tabulce filtruje ten
  druh, řazení funguje i na sloupcích s verdikty a **Shift+klik** přidá druhotné
  řazení.
- **Counter mód** — přepínač nad tabulkou. Vybereš jeden nebo dva typy raid
  bosse a tabulka se seřadí podle toho, kdo se na něj hodí: DPS reálného
  movesetu × typová výhoda útoku ÷ odmocnina z toho, kolik sám schytá.
  Sloupec se přejmenuje na „Proti Fire" a v tooltipu jsou přesné násobky.
  Používá **plnou typovou tabulku** (`type_effectiveness` z pogoapi) včetně
  odolností 0,625 a dvojitých odolností 0,39 — ne jen super efektivitu.
- **Typová efektivita** — sloupec „Silný proti typům" počítá z typů útoků, které
  kus reálně má (bez vyplněných útoků z typů druhu). Druhý řádek filtrů umí
  vybrat typ a nechat jen kusy silné proti němu.
- **Souhrn jsou filtry** — každá dlaždice se dá kliknout a vyfiltruje tabulku;
  aktivní je zvýrazněná.
- **Filtr „jen přesné IV"** — import umí přeskočit nejisté skeny a vzít jen
  doskenované kusy. Sedí to na nastavení Calcy IV „nechat appraised natrvalo":
  ta množina se v historii drží napořád, zbytek se odmazává sám.
- **Varování u celé historie** — když importovaný soubor pokrývá víc dní a není
  vybrané okno skenů, appka upozorní, že transferované kusy jsou v historii pořád
  a roster by nafoukly. (Reálně se to stalo: 30denní export + „Sloučit" udělal
  roster o 413 kusech, i když jich hráč měl 325.)
- **Výběr podle času skenu** — import umí vzít jen skeny z poslední hodiny,
  3 hodin, dne, 7 nebo 30 dní. Krátká okna řeší situaci „chodil jsem dvě hodiny
  a část úlovků cestou transferoval": projdeš box a vezmeš poslední hodinu. Po úklidu boxu tedy stačí jeden průchod boxem, zvolit „poslední
  den" a *Nahradit roster* — roster se rovná realitě a **nic se nemaže ručně**.
  Řeší to, že transfer ve hře se do historie Calcy IV nijak nepromítne.
- **Paměť na smazané kusy** — kdo přesto maže ručně, tomu si appka pamatuje klíč
  skenu **i jeho datum**. Starý sken vyhozeného kusu se nevrátí, ale později
  chycený identický pokémon (stejný druh, CP, level i útoky) se pozná jako nový
  a projde. „Zapomenout smazané (N)" i *Nahradit roster* paměť vymažou.
- **Rozhodné verdikty** — místo vlažného „Zvážit zahození" padne „Zahodit".
  „Zvážit" zůstane jen tam, kde to má důvod: nejistý sken, který se vyplatí
  doskenovat, nebo meta druh se slabým kusem.
- **Dvě zobrazení tabulky** — *Rozhodnutí* (16 sloupců, vejde se na 1920 px bez
  scrollování) a *Vše* (33 sloupců, na editaci vstupů). Hvězdička a sloupec se
  jménem jsou přišpendlené, takže při scrollování doprava víš, čí řádek čteš.
  Nastavení prahů je sbalené, aby byl roster hned pod souhrnem.
- **Hvězdička (první sloupec)** — ruční značka „tenhle si nechávám", protipól
  oblíbeného pokémona ve hře. Klik rozsvítí, druhý klik zhasne; řádek přitom
  neodskočí (kliknutí nepřekresluje tabulku, jen dlaždici s počtem). Drží se
  v rosteru, takže přežije zavření stránky, sloučení nového skenu i režim
  *Nahradit roster*, a jde podle ní řadit i filtrovat (*jen označené* /
  *jen neoznačené*). V exportu CSV je jako poslední sloupec `Označeno`
  — začátek hlavičky zůstal stejný kvůli listu `Import` v Excelu.
- **Strop CP** — sloupec „CP na L40" spočítá, kolik z kusu bude po vylepšení,
  a u nevyvinutých i po evoluci (`pokedex.json` drží jednoznačný konec
  evolučního řetězce). Odpovídá na „má cenu se zabývat CP 120 Magikarpem?" —
  má, je z něj Gyarados s 3378 CP.
- **Počet kopií** — engine ví, že máš pět Pidgey, seřadí je podle kvality a
  přebytečné horší kopie označí k zahození. Kolik kopií si nechat, je
  nastavitelné. Strop kopií smí obejít jen **speciální forma** (Shadow / Lucky /
  Purified) a **nejlepší kus druhu pro konkrétní roli** — raid, gym, Great liga,
  Ultra liga. Samotné „vysoké IV" ani PvP rank nestačí; viz další bod.
- **Rank z Calcy je pořadí v rámci druhu** — `GL Rank #20` znamená „20. nejlepší
  možný Elgyem", ne „20. nejlepší kus ve hře". Bez kontroly, že ten druh v lize
  vůbec hraje, se z toho stane past: u 24 Elgyemů má deset z nich rank pod 100 a
  appka je všechny držela jako „elitní PvP". Proto `elitePvp` vyžaduje i to, že
  je druh v PvPoke žebříčku — stejnou pojistku už měl stat product.
- **Nechat na vyvinutí** — Spoink sám nehraje nikde, ale Grumpig je v Great
  League #44. Engine proto u nevyvinutých kusů spočítá stat product **pro cílovou
  evoluci** (IV se evolucí nemění) a nechá jeden nejlepší kus s verdiktem
  „Nechat – vyvinout" a důvodem („Grumpig GL #44 · 99,7 %"). Slabý kus takového
  druhu ochranu nedostane — z 22% Pidgeyho ligový Pidgeot nebude.
- **Hromadné smazání** — tlačítko „Smazat neoznačené (N)" nechá v rosteru jen
  kusy s hvězdičkou a zbytek si zapamatuje jako smazaný, takže se při dalším
  importu nevrátí. Objeví se, až něco označíš.
- **Dynamax** — Calcy IV má v exportu sloupec `Dynamax` (`D` = Dynamax,
  `G` = Gigantamax, ` - ` = není, `?` = nepoznal; otazník bereme jako „není").
  Takový kus se dá získat jen z Max Battle a hra nepustí do transferu poslední
  z nich, takže ho engine **nikdy neposílá do koše** — dostane „Ponechat", růžový
  štítek **DMAX** u jména, vlastní filtr i kategorii v seznamu „nechat".
  Doplnit se dá i ručně (sloupec *Dynamax?* v zobrazení *Vše*).
- **Kamarádův roster — porovnání a trade.** Vlastní karta. Vezme buď **celý CSV
  export** druhého hráče, nebo prosté řádky `Machamp 2100 15/14/13` — detekuje se
  to samo (`parseRowsQuiet` obchází mapovací UI: `parseText` + `autoMap` +
  `buildRowsFromPending` s dočasně podstrčeným `pending`). Jeho kusy dostanou
  **stejnou tabulku a stejné verdikty jako roster** (`analyze(list)`), a pod ní
  jsou tři návrhy: **Nabídni mu** (tvoje přebytky, jejichž druh nemá — ty
  dostaneš bonbóny, on nový dex), **Chtěj od něj** (druhy, co ty nemáš) a
  **Na Lucky se vyplatí** (druhy s rolí, kde se hodí minimum 12/12/12 IV
  a poloviční prach). Jeho data se **nikam neukládají** — analyzují se stranou
  a po zavření stránky jsou pryč.
- **Popisy eventů.** Feed nese jen název, typ a termín. Co ten typ znamená, je
  ale konstantní, tak je vysvětlení napsané v appce (`EV_POPIS`) a ukazuje se
  pod každým eventem i v bublině; k tomu odkaz na podrobnosti.
- **Kusy od kamaráda.** V panelu *Gym a raid* je rozbalovací pole, kam se napíše,
  co má po ruce druhý hráč (`Machamp 2100 15/14/13`, CP i IV nepovinné — bez IV
  se počítá s patnáctkami, jinak by cizí kus vyšel uměle slabý). Zahrnou se do
  výběru party a u každého je štítek **kamarád**, takže je hned vidět, kdo koho
  posílá. Počítají se stranou (`analyze(list)` → `pomocnyBase`), aby nepřepsaly
  roster; dostávají stabilní `id`, aby fungovalo i vyřazení křížkem.
- **Eventy a bossové ve dvou sloupcích** — vlevo bossové s countery, vpravo
  kalendář. Seznam bossů je dlouhý a eventy se hledaly až úplně dole.
- **Eventy a raid bossové.** Oficiální `pokemongo.com/events` použít nejde:
  ověřeno, že je to **prázdná JS schránka a obsah dá až po přihlášení k účtu
  Pokémon GO** — strojově z ní nejde vytáhnout nic. Data se proto berou ze
  **ScrapedDuck** (komunitní scraper LeekDuck, publikuje JSON přímo v repu):
  29 eventů a 17 raid bossů, 6 kB. `tools/build_events.py` je upeče do
  `data/events.json`, `sync_reference.py` do appky.
  Karta ukazuje **u každého bosse jeho typy, CP při chycení, shiny a rovnou
  trojku counterů z rosteru** (přes `counterScore`, stejně jako panel na gymy),
  pod tím kalendář s tím, co zrovna běží.
  Data se **zapékají**, protože appka běží offline z disku a `file://` stránka
  by kvůli CORS stejně nic nestáhla — proto se ukazuje stáří a po týdnu se
  objeví upozornění. `deploy.ps1` je před nasazením obnovuje sám; když není síť,
  použije cache a nespadne. Zdroj je v patičce přiznaný jako neoficiální.
- **Roster v cloudu (OneDrive).** Záloha do složky řeší vymazaný prohlížeč
  na počítači, ale ne v telefonu — Android složku připojit neumí. Druhá
  polovina je proto přihlášení k vlastnímu OneDrivu: `OAuth 2.0 + PKCE`
  (postup pro stránky bez serveru, žádný secret v souboru), oprávnění
  **`Files.ReadWrite.AppFolder`** — appka se dostane výhradně do složky
  `Aplikace/Pokémon GO tracker` a ke zbytku disku ne. Ukládá se celý snímek
  profilu (roster, nastavení, smazaní, historie) jako `roster.json` s razítkem
  času a zařízení. **Appka nikdy nepřepíše roster sama**: když najde v cloudu
  novější, zeptá se a řekne kolik kusů, kdy a odkud. `client_id` si uživatel
  zaregistruje sám (Entra → Registrace aplikací, typ SPA) a vloží do appky —
  je to veřejný údaj. Service worker přitom **nekešuje cizí původ**, jinak by
  odpovědi z Microsoft Graphu (tedy roster) skončily v cache prohlížeče navíc.
- **Časová osa akcí.** JSON ScrapedDucku u běžné akce veze jen
  `"hasSpawns": true` — příznak, že se něco spawnuje, **bez seznamu**;
  konkrétní jména dává jenom u Spotlight Hour a Community Day. Rozpis „co se
  v kterém úseku spawnuje, co je ve vejcích, kdo je v raidech a co dává
  výzkum" proto čte `tools/leekduck_okna.py` **přímo ze stránky akce**, kde
  je poskládaný strojově čitelně (sekce `event-section-header`, okna jako
  nadpisy, seznamy `pkmn-list-flex`). Z 44 akcí má rozpis **30**; zbylých 14
  jsou raid hodiny bez sekcí a budoucí akce, u kterých na stránce stojí „Stay
  tuned for more details" — tam se nic nedomýšlí a na ose prostě nejsou.
  Nadpis bez hodiny („September 11–15") zůstane **dnem**, ne půlnocí.
  Je to scraping cizí šablony, takže je křehký: když se změní, parser vrátí
  prázdno a karta vypadá jako dřív. U každého druhu na ose se ukáže značka,
  jen když něco znamená — kolik bonbónů do té rodiny sype plán, nebo jak dobrý
  kus už máš. „Nemáš" se neukazuje: svítilo by u každého druhu a appka navíc
  nevidí do pokédexu, jen do rosteru.
- **Upozornění „raid ≠ liga".** Vylezlo z reálného zmatku: kolegovi jiný asistent
  poradil u Gyaradose přeučit Dragon Breath na Waterfall kvůli STAB — správně
  **pro raidy**, jenže PvPoke pro Ultra League doporučuje právě Dragon Breath
  (víc energie a pokrytí Dragonů). Obojí je pravda, jen pro jinou roli, a appka
  to dřív rozhazovala do dvou sloupců. Když je kus **zároveň raidový útočník
  i ligový pick** a rychlý útok se u obou liší, sloupec *Útoky* dostane žluté
  „raid ≠ liga", v bublině obě sestavy a v rozboru vlastní blok s vysvětlením.
  Rada „přeučit" se v tom případě mění na **„do ligy přeučit — na raid nech"**,
  aby nevypadala jako oprava chyby. Nový filtr *Jen konflikt útoků*.
- **Záloha do souboru na disku.** `localStorage` smaže „Cookies and other site
  data" v prohlížeči a roster je pryč. Ověřeno, že **File System Access API je
  na `file://` k dispozici** (`isSecureContext: true`, `showSaveFilePicker`
  existuje), takže uživatel jednou vybere záložní soubor a od té chvíle se do něj
  roster ukládá sám při každé změně (zápis se sdružuje 1,5 s, aby se při psaní do
  buňky nepsalo na disk po každém znaku). Odkaz na soubor (handle) leží
  v IndexedDB — ten se smaže spolu s daty webu, ale **samotný soubor zůstane**
  a naimportuje se zpátky. Po znovuotevření stránky chce prohlížeč přístup
  potvrdit kliknutím, na což tlačítko upozorní („Obnovit zálohu do…").
  Volá se i `navigator.storage.persist()`, aby prohlížeč data nevyhazoval sám.
  Když API chybí, tlačítko se schová a zůstane ruční *Exportovat CSV*.
- **Klik na jméno rozbalí podrobný rozbor.** Dřív jméno filtrovalo roster na
  ten druh (což umí i hledací pole). Teď se pod řádkem rozbalí **vizuální
  rozbor**, ne odstavce textu: barevné štítky typů (barvy jako ve hře),
  verdikt jako barevný pruh s odůvodněním, **pruhy statů** (útok/obrana/HP na
  jeho levelu) vedle **pruhů IV** ve stejné podobě, jakou ukazuje Appraisal ve
  hře, strop CP velkým písmem, a role (Raid / Gym / PvP / Mega) i akce
  (vylepšit / evolvovat / purifikovat / tradovat / doskenovat) v kartách.
  Útoky jsou štítky. Dlouhé věty zůstaly jen jako odůvodnění pod nadpisy.
  **Obrázky pokémonů appka nemá** — musela by je stahovat, a to je proti tomu,
  že běží offline z disku a nikam nechodí.
- **Skupinová hlavička („Ruční vstup / Automaticky dopočítané doporučení")
  zrušena.** Nic neříkala a jako `position: static` navíc dělala mezeru mezi
  přišpendlenou lištou a hlavičkou, kterou prosvítal scrollovaný text. Hlavička
  se teď lepí přímo pod lištu, jejíž výška se měří (`--toolbar-h`) a zaokrouhluje
  **nahoru**. Pozor při testování: `position: sticky` je na `<th>`, ne na
  `<tr>` — řádek hlásí nezalepenou pozici.
- **Obyčejný klik na hlavičku ruší druhotné řazení.** Dřív ho zrušila jen změna
  sloupce; opakovaný klik na stejný sloupec ho nechal viset a pořadí pak
  neodpovídalo tomu, co uživatel čekal. Shift+klik ho pořád přidá.
- **Lišta s tlačítky se drží nahoře** spolu s hlavičkou tabulky — uprostřed
  dlouhého rosteru jsou tak *Smazané*, filtry i *Označit ponechané* pořád po
  ruce. Hlavička se lepí pod ni; její výšku měří `syncToolbarHeight()`, protože
  se mění podle toho, kolik tlačítek je vidět a jestli se zalomí.
- **Basculin se počítal dvakrát.** Má jen pruhované formy (`Blue_striped`,
  `Red_striped`, `White_striped`), takže „Basculin White Striped" se v `dexKey`
  rozložilo na formu **White** (jako u Kyurema) — druh se nenašel a dva zápisy
  téhož kusu se nikdy nespojily. `cleanName()` teď kosmetické pruhy zahodí dřív,
  než se hledá skutečná forma.
- **Poradce na Elitní TM.** Nová sekce v Power up listu: u kusů, které umí
  legacy útok, se porovná nejlepší sestava **včetně** elitních útoků s tou
  nejlepší dosažitelnou běžným TM. Ukáže se přírůstek DPS a na co přeučit.
  Filtruje tvrdě: kus, který legacy útok už má, a kus **bez role** (raid / PvP /
  gym / Master League / legendární) se nedoporučí vůbec — elitní TM je vzácný
  a 360 CP Eevee s Last Resort pořád nikomu neublíží. Na reálném rosteru vyjde
  Mewtwo → Psystrike, Charizard → Blast Burn, Jolteon → Zap Cannon.
- **Hromadné označení.** Tlačítko „Označit ponechané (N)" dá hvězdičku všem
  kusům s kladným verdiktem najednou. Hvězdičky jen přidává, nikdy neodebírá.
- **Seznam smazaných je doslova stejná tabulka jako roster.** Předchozí verze
  ukazovala jen zhuštěný řádek, což nestačilo. `analyze()` teď umí spočítat
  libovolný seznam řádků (`analyze(list)`), ne jen roster — smazaní se vykreslí
  stejnými sloupci a se stejnými verdikty, přes `fillComputedCell` a
  `visibleCols()`. `lastBase` se u pomocných výpočtů nepřepisuje.
- **Přišpendlená hlavička rosteru.** `thead th` mělo `position: sticky` už dřív,
  ale nefungovalo: `.table-wrap` mělo `overflow-x: auto`, což prohlížeč dopočítá
  i na `overflow-y: auto` — hlavička se tím lepila k wrapu, který svisle
  nescrolloval. První pokus (vlastní posuvník rosteru) uživatel odmítl, protože
  chtěl **jeden posuvník na celou stránku**. Řešení: vodorovný posuvník se
  zapíná jen když se tabulka nevejde. `syncWrapOverflow()` změří šířku a přidá
  třídu `fits` (`overflow: visible`), při které hlavička drží na úrovni stránky;
  jinak zůstane `overflow: auto`. Výchozí stav je ten bezpečný, aby neposunutý
  layout nepustil tabulku přes okraj. Hlídá to `ResizeObserver` nad kartou —
  `window.resize` se ozve dřív, než se přepočítá layout.
- **„Koukni, jestli nemáš lepšího" appka udělá sama.** U verdiktu
  *Zvážit – slabý kus* je v podřádku buď „lepší máš: 1500 CP", nebo
  „lepšího nemáš", a v bublině konkrétně který kus to je a s jakým IV.
- **Seznam smazaných ukazuje to samé co roster** — forma, CP, level, IV %
  (s přesnými hodnotami, když jsou), typy, útoky a datum smazání. Mezi stovkami
  Magikarpů se jinak nedalo poznat, který to je.
- **„% špičky" v taháku lezlo nad 100.** `shareOfCeiling` dostávalo skóre kusu
  počítané z **jeho vlastní** sestavy, ale porovnávalo ho se stropem **bossova**
  typu — Mewtwo s Psychic útoky na Fighting bosse tak vyšlo na 102 % „Fighting
  špičky". Přibyl `counterCeiling(bossType)`: nejlepší counter na ten typ napříč
  **všemi** útočnými typy, s započítanou typovou výhodou. Srovnává se stejná
  veličina (`DPS × útok × výhoda`) a výsledek je navíc oříznutý na 100 %.
- **Vylepšený kus s nejistým skenem a vyvinutý kus se při importu slučují.**
  Předchozí oprava párovala jen podle **přesných** IV, takže kus naskenovaný
  z chytání (rozsah IV) se po vylepšení přidal podruhé — a evoluce se nespárovala
  vůbec, protože se mění jméno druhu. Merge má teď tři kola: klíč skenu →
  stejný druh s neodporujícími IV → **stejná evoluční rodina** (přes `finalKey`).
  U evoluce se přepíše i jméno; hvězdička a ruční forma zůstanou. CP nesmí
  klesnout — vylepšuje i evolvuje se jen nahoru.
- **Raidové žebříčky se počítají z dat.** Poslední ručně udržovaný seznam
  (70 útočníků v `reference.json`) nahradil `typeRanking(type)`: projde všech
  1110 druhů, u každého najde nejlepší **stejnotypou** sestavu a seřadí podle
  `DPS × (base útok + 15)`. Za raidového útočníka se bere kdo je v **top 30**
  svého typu a dělá aspoň **50 %** toho, co špička; priorita podle podílu
  (≥85 % vysoká, ≥70 % střední). Ruční seznam zůstal jen jako záloha pro druhy,
  kde výpočet nic nenajde. Referenční tabulka v appce se generuje ze stejného
  žebříčku (5 nejlepších na typ, formy se stejným jménem sloučené).
  Ověřeno proti realitě: Kyogre #1 Water, Lucario #1 Fighting, Metagross #1
  Steel, Rampardos #1 Rock, Kyurem #1 Ice.
- **Typová tabulka v appce — a v GO číslech.** Běžné tabulky na internetu jsou
  z klasických her (×2 / ×0,5 / **×0**) a v Pokémon GO neplatí: super efektivní
  je **×1,6**, neefektivní **×0,625**, dvojitě **×0,390625** a **imunity nejsou
  vůbec** — Normal útok Ghosta zasáhne za 39 %. Karta *Typová tabulka a dnešní
  počasí* ji ukazuje správně, celých 18×18.
- **Počasí.** `weather_boosts` z pogoapi do `reference.json`. Vybereš dnešní
  počasí a boostnuté typy se zvýrazní v tabulce i v typových chipech nad
  rosterem. Volba se ukládá do profilu.
- **Tahák se přepočítá i po ruční úpravě buňky** — dřív se obnovoval jen při
  překreslení celé tabulky, ne při `refreshComputed`.
- **Skutečné staty pod CP.** Calcy exportuje jen HP, ale Útok/Obrana/HP se dají
  dopočítat: `(base + IV) × CPM levelu`, u shadow ×1,2 útok a ×0,833 obrana.
  Zkoušel jsem to jako samostatný sloupec, ale do šířky se nevešel — leží proto
  jako podřádek přímo v buňce s CP, což je i logičtější (CP je jen jejich
  slepenec).
- **Šířku tabulky netlačila data, ale nadpisy.** „Doskenovat s Appraisal?" si
  s `nowrap` bral 172 px místo deklarovaných 62 a přetahoval tabulku přes okraj.
  Sloupce mají nově volitelný `lv` = zkrácený nadpis pro režim *Rozhodnutí*
  (`Sken?`, `Verdikt`, `Silný proti`, `Mega?`, `CP L40`, `Gym?`, `Raid?`); plný
  název zůstal v bublině a v režimu *Vše*. Dvojtyp se píše `Water / Fairy`
  s mezerami, aby se měl kde zalomit.
- **Cena evoluce v bonbónech** (`pokemon_candy_to_evolve`, nově v `pokedex.json`).
  Je v podřádku sloupce *Evolvovat?*, v bublině a v seznamu „Koho evolvovat".
  Kolik bonbónů uživatel má, appka nezjistí — Calcy to neexportuje.
- **Kus, který bez evoluce nemá smysl, to má napsané.** Sloupec *Evolvovat?*
  u něj ukazuje `Ano` **žlutě** s podřádkem „jinak k ničemu", místo aby vypadal
  stejně jako u kusu, co roli drží už teď.
- **Vylepšený kus se při importu nepřidá podruhé.** Klíč skenu je
  `druh|CP|level|útoky`, takže po vylepšení nesedí a merge ho bral jako nový kus.
  `mergeIntoRoster` má teď druhý index podle **druhu a přesných IV** (ty se
  vylepšováním nemění) a spáruje ho s existujícím řádkem — jen když nové CP není
  nižší, protože vylepšuje se nahoru. U nejistého skenu (rozsah IV) se to
  nepoužije. Report po importu píše, kolik kusů se takhle poznalo.
- **`Nechat – vyvinout` přejmenováno na `Nechat – evolvovat`.** Uživatel to četl
  jako dvě různé akce („evolvovat = boost statů, vyvinout = boost + liga"), což
  není pravda — je to stejná akce, liší se jen důvod, proč ten kus v boxu držet.
  Sloupec i verdikt teď mluví stejným slovem a vysvětlivka to říká rovnou.
- **Vysvětlivka u „Nechat – evolvovat" umí vysvětlit nízké IV.** Rookidee s IV
  60 % dělá 97% Corviknighta pro Great League a z původního textu nešlo poznat
  proč. Když je IV pod 80 %, bublina dopíše, že **v lize s CP limitem se na IV %
  nehraje** — nízký útok je tam výhoda, protože se do limitu vejde víc obrany
  a HP.
- **Seznam „Koho evolvovat" v Power up listu.** Karta je nově dvousloupcová:
  vlevo kam dát prach, vpravo pořadí evolucí. Nahoře kusy, které bez evoluce
  nemají smysl (verdikt `Nechat – evolvovat`), pod nimi ty, co roli drží už teď
  a evoluce je bonus.
- **Normal mezi typovými chipy.** Schovával se, protože Normal útoky nikoho
  nebijí — jenže chip znamená „mám kusy silné **proti** tomuhle typu", a proti
  Normal obráncům (Blissey, Snorlax — dva nejběžnější v gymech) se hodí Fighting.
- **Filtry `Jen shadow` a `Jen purified`.**
- **Vysvětlivky u verdiktů.** Buňky `Ponechat/Zahodit`, `Vylepšit`, `Evolvovat`,
  `Do gymu`, `Do raidu`, `Kopie` a `Mega` mají `title` s důvodem, ne jen verdikt.
  U „Nechat – vyvinout" je v bublině **na co se to vyvine, v jaké lize to hraje
  a na kolikátém místě** („Grumpig je v Great League na místě #44; tenhle kus by
  z něj udělal 99,7 % nejlepšího možného").
- **`Evolvovat = Ano` ≠ `Nechat – vyvinout`.** Sloupec *Evolvovat* říká „tenhle
  kus se vyplatí vyvinout", verdikt *Nechat – vyvinout* říká „drží místo **právě
  proto**, že jeho evoluce hraje". Na reálném rosteru má `Ano` 43 řádků, ale
  „Nechat – vyvinout" jen část — zbytek drží místo z jiného důvodu (shadow forma,
  vlastní ligová relevance, vysoké IV) a evoluce je až bonus. Vysvětlivky teď
  obojí rozliší.
- **Režimy v panelu Gym a raid** (výběr místo dřívějšího zaškrtávátka):
  *Gym / raid* (parta 6), *Team GO Rocket* (parta 3) a *Max Battle* (parta 3,
  jen Dynamax kusy). U Rocketu se navíc vysvětlí, jak souboj funguje (štíty
  u vůdců, výhoda rychlého dokončení) a obránci gymu se logicky neradí.
- **Do panelu jde napsat i holý typ** — `Water` místo jmen. Rocket grunt svůj typ
  vyhlásí ještě před soubojem, ale jména neuvidíš, takže tohle je jediné, co
  o něm víš. Typ se vezme jako pseudo-soupeř a counter se počítá stejně.
- **Nebo rovnou celá hláška raketáka** — `These waters are treacherous!`
  `typZHlasky()` z ní typ vyloupne (nejdřív podle tabulky známých hlášek, jinak
  podle typu, který ve větě zazní) a nad výsledkem napíše, co si přečetla, aby šlo
  poznat špatný odhad. Na jméno druhu se to schválně nespouští, jinak by ze
  `Steelix` udělalo Steel. Neznámá hláška se přizná místo tichého nesmyslu —
  dřív ji fuzzy hledání jmen umlelo na náhodný druh.
- **Hlídač pokrytí typů** (`pokrytiTypu()`, karta *Pokrytí typů*). Po tvrdém
  úklidu zbyde 19 skvělých kusů a žádný Electric — a na vodního raketáka pak
  nemáš nic. Prochází všech 18 typů a rozlišuje tři stavy: **díra** (mezi
  přeživšími nikdo s `off > 1`, ale v odpadu ano), **oslabení** (přeživší někdo
  je, ale zahazovaný je aspoň `COVER_LEPSI` = 1,5× silnější) a **nemáš vůbec**.
  „Co přežije" jsou hvězdičky, dokud žádná není, tak `usableForPlan()`. Každý
  řádek má tlačítko na hvězdičku, dole je hromadné. Samotné „mám / nemám" bylo
  na reálném rosteru bezzubé (18/18 pokrytých) — teprve druhá úroveň chytá to,
  co se doopravdy děje.
- **Tahák začíná aktuálními raid bossy** — jméno, tier, typy, CP a tři kusy na
  něj, pod tím teprve sekce po typech (pro bosse, který v datech není).
- **Sken jen části boxu se hlásil jako chyba.** Kdo si maže historii v Calcy,
  skenuje pak často jen dnešní úlovky — a kontrola proti počtu z boxu na to
  křičela „chybí 780 z 800". Pod 60 % pokrytí to teď appka pojmenuje jako sken
  části boxu, doporučí *Sloučit s rosterem* a **nebarví to jako chybu**. Bez
  toho by ta kontrola byla u běžného denního skenování jen šum.

- **Kusy v gymech kontrolu rozbíjely.** Do počtu v boxu se počítají, ale Calcy je
  při průchodu nenaskenuje, takže roster vyšel menší a appka hlásila neexistující
  díru. Vedle *Ve hře mám* je proto **z toho v gymech** — odečte se a zpráva
  ukáže výpočet (`94 ve hře minus 5 v gymech`). Když manko gymy nevysvětlí, hlásí
  se dál.
- **Ze starého jednosouborového režimu zálohy nešlo přepnout na složku.** Tlačítko
  nabízelo výběr složky jen tomu, kdo neměl nastavené nic — kdo měl soubor, uvízl
  v něm a *Zálohovat teď* mu snímek jen stáhlo přes prohlížeč místo uložení vedle
  ostatních záloh. Teď přepnutí nabídne vždycky a stavový řádek to říká.
- **Pojistky proti ztrátě dat při aktualizaci.** `beforeunload` zapisoval stav
  vždycky — takže když se appka z jakéhokoli důvodu načetla prázdná, zavření
  záložky ta data teprve doopravdy zabilo. Teď se prázdný roster přes uložený
  neprázdný nezapíše. K tomu `snimekPred()` ukládá do zálohovací složky stav
  před *Nahradit roster*, *Smazat neoznačené* a *Vymazat vše*.
- **Test „aktualizace nesmí sáhnout na data"**: přes `addInitScript()` se
  podstrčí storage uložený starší verzí, appka nastartuje a musí sedět roster,
  hvězdičky, poznámky, forma, prahy i paměť smazaných — a `localStorage` musí
  být po startu **bajt po bajtu stejný**. To je ta záruka, kterou uživatel chtěl
  před tím, než bude ANet dělat F5 na nové verzi.
- **Záloha byla zrcadlo, ne záloha.** Jeden soubor přepisovaný při každé změně
  uloží i rozbitý stav a předchozí je pryč — přesně to uživatel pojmenoval
  („pokud se přepisuje, tak je to k ničemu záloha"). Teď se zálohuje do složky
  přes `showDirectoryPicker()`: `roster.csv` (aktuální) + `roster-RRRR-MM-DD.csv`
  (jedna generace na den, drží se 30, starší `uklidGenerace()` maže). Včerejší
  soubor se už nikdy nezmění.
- **Tlačítko „Zálohovat teď"** (`zalohovatTed()`) uloží snímek s časem v názvu,
  který nic nepřepíše — pro okamžik „hotovo s úklidem". Bez připojené složky se
  snímek stáhne přes prohlížeč, takže funguje i tam, kde `showDirectoryPicker`
  není.

- **Appraise zdvojoval řádky.** `dedupeScans()` slučovalo skeny přes
  `sameMonPossible()` (překryv rozsahů IV). Appraisnutý sken téhož kusu ale nese
  přesnou IV, která se do dřívějšího odhadu Calcy nemusí vejít — a pak z jednoho
  pokémona vznikly dva řádky. Teď platí i tady otisk: stejný `scanKey` + stejná
  výška/váha = tentýž kus, ať IV říkají cokoli.
- **Slepá ulička, ať se neopakuje:** `parseScanDate()` schválně vrací jen den.
  Čas přidává `parseScanTime()`, které se používá na okno skenů — přidat čas do
  obou znamená sečíst ho dvakrát a posunout skeny o den dopředu.

- **Trvalá kontrola „ve hře mám N"** (`renderBoxCheck()`, nad rosterem). ANet
  měla po obnově 141 řádků a ve hře 49 kusů a nešlo to poznat — roster prostě
  vypadal plný. Číslo z boxu se ukládá mezi nastavení a appka průběžně hlásí
  rozdíl: přebytek pojmenuje jako „naimportovaná celá historie skenů" i s návodem
  (poslední hodiny + Nahradit roster), manko jako neúplný sken.
- **Viditelná verze appky** (`BUILD`, razítko z `sync_reference.py`, vpravo
  v panelu nad rosterem). U souboru sdíleného přes OneDrive se jinak nedá poznat,
  jestli druhý člověk otevírá poslední verzi, nebo starou kopii — a bez toho se
  „u mě to nefunguje" nedá vůbec rozseknout. `PrectiMe.txt` ve sdílené složce
  k tomu má postup (zavřít záložku, zkontrolovat, že soubor není jen v cloudu,
  otevřít znovu).
- **Paměť smazaných blokovala nově chycené kusy.** `isDiscarded()` porovnávalo
  jen `scanKey` (druh + CP + level + útoky), což u nízkých CP kolidovalo: na
  reálném souboru 1 řádek z 225, a byla to falešná blokace. Otisk to rozsoudí —
  stejný = ten smazaný kus, jiný = pustit. Otisk má přednost před datem, protože
  je to silnější důkaz. Kde chybí, platí datová logika jako dřív.
- **Kratší retence paměti smazaných** (7 / 14 dní) a výchozí 60 → **30 dní**.
  Plus varování v panelu, když je smazaných víc než kusů v rosteru — s návodem,
  že *Nahradit roster* paměť maže sám.
- **Výška a váha jako otisk jednotlivce** (`kusKey()`). Uživatel odmítl řešení
  „proklikej 300 kusů Appraisal" — správně, to není řešení. V exportu jsou ale
  `Height (cm)` a `Weight (g)`: losují se při chycení a **power-upem se nemění**.
  Měření na reálném exportu: uvnitř druhu **nekolidují ani jednou** a napříč
  skeny našly přesně jeden vylepšený kus (Gyarados 652 → 1479 → 2195 CP,
  stejné IV, stejný otisk) — což sedí s tím, že uživatel vylepšil jednoho.
  Klíč platí **obousměrně**: shodný otisk = tentýž kus, různý otisk = různé kusy
  (veto, které přebije i shodu podle IV). Falešná sloučení na jeho datech:
  54 → 20, a těch 20 jsou řádky, kde Calcy otisk nepřečetl (181 z 225 ho má).
  Evoluce výšku i váhu mění, takže na evoluční kolo se klíč nepoužívá.
- **Sloučení mazalo pokémony.** `stejnyKusPoUprave()` bez přesných IV spadlo na
  `sameMonPossible()`, tedy „stejný druh a rozsahy IV se nevylučují", a
  `mergeIntoRoster()` vzalo **první** takový řádek. V reálném exportu má nepřesná
  IV 211 z 225 řádků, takže se u dvanácti Mareanie potkal každý s každým: import
  ohlásil **54 vylepšených u člověka, který vylepšil jednoho**, a tolik kusů se
  tím přepsalo a zmizelo z rosteru. Uživatel to odhalil tím, že to číslo nesedělo
  s realitou — samotný počet řádků na to nestačil.

  Oprava: slučuje se jen při **jednoznačném** kandidátovi (`jedinyKandidat()`).
  Víc možností = kus se přidá jako nový a hlášení to přizná. Duplicitní řádek se
  dá smazat, ztracený pokémon ne. Test hlídá i idempotenci — třetí import téhož
  souboru nesmí nic přidat ani ubrat.
- **Kontrola úplnosti skenu** (`scanMissInfo()`). Uživatel hlásil, že po importu
  „mega moc pokémonů chybí". Měření na jeho souboru: export měl 728 řádků, ale
  poslední průchod boxem zachytil **225** a ve hře jich měl **276** — Calcy jich
  51 přeskočil, appka neztratila ani jeden. To se ale nedalo poznat, protože
  appka nevěděla, kolik jich má být. Teď se dá do importu zadat číslo z boxu
  a rozdíl se pojmenuje. Bez toho se ta chyba hledá v nesprávné vrstvě.
- **`isDiscarded()` blokoval navždy záznamy bez data skenu.** Když měl smazaný
  záznam `at === null`, nepustil ten klíč nikdy — ani kus chycený až po smazání.
  Teď v takovém případě rozhoduje čas smazání (`del`).
- **Trade sekce přepsaná na konkrétní páry** (`tradePairs()`): tvůj přebytek,
  který on nemá, spárovaný s jeho druhem, který nemáš ty — očíslovaný seznam
  `dáš ⇄ dostaneš`, ne dva nesouvisející výpisy. `specialTrade()` označí, co je
  speciální výměna (legendární / nový do pokédexu příjemce); protože je jedna
  denně, appka spočítá, **kolik dní** seznam zabere. Na reálných datech vyšlo
  5 z 5 speciálních, což je přesně ta informace, která chyběla.
- **Explicitní varování, že se IV při výměně přehází.** Bez toho celá karta svádí
  k „on má lepší Machampa, vyměň se" — a to je špatná rada, protože příjemci se
  IV přegenerují. Trade dává smysl kvůli druhu, bonbónům a Lucky, což je teď
  napsané nad seznamem.
- **„Co spolu zvládnete líp"** (`spolecnaSila()`): typy, kde jeden druhého přebíjí
  o 30 % a víc. Odpověď na „co jiného spolu můžeme dělat než trade" — jít spolu
  do raidu a nechat útok vést toho, kdo na daný typ má.
- **Karta kamaráda se přesunula nad vlastní roster** a vypadá jako on: stejné
  sloupce z `visibleCols()`, stejný rozbor, plus první sloupec **Proti tobě**
  z `porovnat()` — druh nemáš / máš jiný stupeň řady / má lepšího / máš lepšího
  (práh 2 % IV). Nad tabulkou pás čísel. Načtení celého souboru je přes
  `<input type="file">` a drop na textarea, ne přes File System Access API —
  tohle funguje všude a nic si nepamatuje, což je u cizích dat správně.
- **Výměna rosterů přes sdílenou složku** místo posílání CSV. Dva handly navíc
  v IndexedDB (`sdileny_muj` zapisovaný při každé změně, `sdileny_kamarad`
  čtený); `idbHandle()` proto bere klíč. `renderFriend()` dá přednost ručnímu
  vstupu a jinak vezme text ze sdíleného souboru. Synchronizaci řeší OneDrive,
  appka jen čte a píše.
- **Cliff / Arlo / Sierra / Giovanni se poznají jménem.** Vůdci typ nevyhlašují,
  takže appka místo „Nepoznal jsem: cliff" vysvětlí, že u nich je potřeba napsat
  jména pokémonů, a že jejich sestava je v rámci rotace pevná.
- **Max Battle režim v panelu Gym a raid** přepne party na **tři** a do výběru
  pustí jen Dynamax kusy. Bosse samotného od
  běžného poznat nejde — je to normální druh, mění se jen to, koho na něj smíš
  vzít, takže stačí přepínač. Kus s nulovým skóre (Magikarp se Splashem) se do
  trojky dostane taky: v Max Battle se stejně bere tolik, kolik jich máš.
- **Little Cup (500 CP).** PvPoke ho publikuje jako `rankings-500.json`
  a Calcy IV má rank v exportu jako `LL Rank (min)` — obojí appka ignorovala.
  Přibyl sloupec **LC Rank**, liga se počítá i do stat productu (`LEAGUES`) a do
  ochrany kopií. Pro Lukášův roster to není okrajovka: **136 z 389 řádků má LC
  rank**, protože většina jeho kusů je pod 500 CP.
- **Práh na skóre v `build_meta.py` (`MIN_SCORE = 70`).** Samotné „top 200"
  u Little Cupu neořezalo nic — ta liga má jen 168 záznamů, takže procházel
  i Magikarp na #167 a appka radila „přeučit na Splash + Return". Great a Ultra
  mají přes tisíc záznamů, takže jim ořez top-200 nechá skutečnou metu (nejhorší
  má skóre 83); Little Cup a Master mají tail slabých. Skóre je u PvPoke
  porovnatelné napříč ligami, tak se přidal práh na něj: little 117 → 59,
  master 136 → 100, great a ultra beze změny.
- **U verdiktu je vidět liga.** „Ano – hlavní" nešlo přečíst — z čeho ten rank
  je? `bestRankOf` teď vrací i ligu, takže verdikt je `Ano – LC` a v podřádku
  `hlavní · rank #37`.
- **Dvě chyby v `counterScore`**, obojí našel uživatel na tom, že pořadí
  neodpovídalo intuici:
  1. **Útok se počítal ze základních statů, bez levelu.** 234 CP Cacnea tak
     vycházela stejně jako vylevelovaná a typová výhoda ×1,6 přebila i
     čtyřnásobně silnějšího pokémona. Teď se násobí CPM aktuálního levelu.
  2. **U odhadované sestavy se typová výhoda brala z typů druhu, ne z útoků,
     které se u kusu ukazují.** Cacnea (Grass/Dark) se sestavou Sucker Punch +
     Payback — obojí Dark — dostávala proti Water bonus ×1,6 za Grass, který
     v těch útocích vůbec není. Teď se typy berou vždy z té sestavy, která je
     na řádku vidět.
  Přibyl i **shadow bonus** (+20 % útok, −20 % obrana) a u každého kusu
  **relativní síla v procentech**, aby pořadí šlo přečíst bez hádání.
  Vzorec: `útok na levelu × DPS sestavy × typová výhoda ÷ √(přijaté poškození)`.
- **Padlý kus a náhrada za něj.** Křížek u kterékoli položky party ji vyřadí
  („padl / nemám ho") a panel se přepočítá — přijde náhrada a vyřazený zmizí
  i z rozpisu po obráncích. Nahoře je vidět, kdo je mimo hru, a tlačítko
  *Vrátit všechny*. Drží se to **jen v paměti**: je to stav jednoho útoku na gym,
  ne něco, co patří do rosteru nebo do uloženého profilu.
- **Party do souboje (6).** Do gymu i do raidu se bere šestice, takže rozpis
  „tři nejlepší na každého obránce" sám o sobě nestačil. Panel teď nahoře
  navrhne konkrétní **šestku**: nejdřív po jednom counteru na každého obránce,
  zbytek se doplní podle součtu skóre přes celou sestavu. U každého je napsané,
  na koho je nejlepší (v boji se přepíná ručně). U jednoho raid bosse to je
  prostě šest nejlepších proti němu.
- **59 druhů v pokédexu vůbec nebylo.** Vylezlo to při hledání obránců gymu.
  Dvě příčiny, obě v `build_pokedex.py`: (1) Scatterbug / Spewpa / Vivillon
  nemají formu `Normal`, jen dvacet vzorových (`Archipelago`, `Meadow`…), takže
  je `wanted()` zahodil všechny a druh zmizel; (2) druhy, které existují jen jako
  regionální forma (Perrserker, Sirfetch'd, Obstagoon, Cursola…), seděly pod
  klíčem `perrserker-galar` a pod holým jménem se nenašly. Build teď každý druh
  doplní i pod holé jméno. Stejná oprava je v `build_moves.py` u learnsetů.
  Pokédex: 1051 → **1110 druhů**.
- **Překlepy ve jménech obránců se opravují.** Jména se opisují z malé obrazovky,
  takže `Bubasaur` a `Magnazone` jsou realita. Hledá se nejbližší známý druh
  (editační vzdálenost 1 pro krátká jména, 2 pro delší) a dosadí se **jen když
  je jednoznačný** — vždy s viditelnou poznámkou „Bubasaur → Bulbasaur".
  Úplný nesmysl a řetězce kratší než 4 znaky zůstanou nerozpoznané.
- **Gym a raid — koho na ně poslat.** Vlastní karta: napíšeš jména obránců
  (`Blissey 3200, Snorlax, Steelix`), appka dohledá typy a pro **každého obránce
  zvlášť** vybere tři nejlepší kusy z rosteru. Po jednom schválně — v gymu se
  bojuje jeden na jednoho, průměr přes celou sestavu by zakryl to podstatné.
  U obránce je vidět jeho **slabina**, a když na ni v rosteru nikdo není, řekne
  se to rovnou (jinak by tam svítilo jen „útok ×1" a nebylo by jasné proč).
  Nakonec souhrn „celou sestavu pokryješ N pokémony" a **koho tam po dobytí
  nechat bránit**. CP obránce se dá zadat, ale na výběr counteru nemá vliv —
  je jen pro přehled.
  **Proč se jména píšou ručně:** obrazovku gymu legálně nečte žádná appka.
  Calcy IV i Poké Genie čtou snímek obrazovky s detailem *tvého* pokémona;
  cizí sestavu v gymu nikoli. Vlastní skener by znamenal totéž co u nich —
  číst obraz — a šest jmen se napíše rychleji, než by se to vyladilo.
- **PvP verdikt počítá s útoky** (dřív jako jediná role nepočítal — kus
  s parádními IV a nepoužitelnými útoky prošel jako dobrý pick). Zdrojem je
  **PvPoke**: `build_meta.py` z jeho žebříčků bere i doporučenou sestavu
  (`moveset`) a seznam útoků, které simulace reálně používá (útok projde, když
  ho sim nasadil aspoň ve 40 % užití toho nejpoužívanějšího). Kus s útoky mimo
  ten seznam dostane „přeučit na X + Y / Z", tón varovný, a spadne do dlaždice
  *Přeučit útoky*.
  **Proč ne vlastní výpočet:** poškození za tah neumí ocenit štíty (nabitý útok
  se dá zablokovat) ani buffy — Power Up Punch má poškození na energii 0,57
  a vyšel by jako odpad, přestože je to Medichamova podpisová schopnost.
  Vlastní model (`pvpCycleDpt`, data `pvpFast`/`pvpCharged` z pogoapi) zůstal
  jako **odhad pro druhy mimo PvPoke žebříček** — do verdiktu se nepromítá
  a v tooltipu je označený jako odhad.
- **Prahy jde nastavit tak, že nic neprojde** — a stalo se to: dvě PvP pole
  („elitní rank" = pořadí 1…N, „PvP potenciál" = procenta) nebyla vedle sebe
  a obě berou čísla kolem stovky, takže si je uživatel prohodil. `spThresh` na
  100 % pak propustí jen dokonalý kus a doporučení zmizí. Obě pole jsou teď
  vedle sebe, popsaná jako **procenta** / **pořadí, ne %**, a u nesmyslné hodnoty
  (`spThresh` ≥ 99, `ivThresh` ≥ 99, rank < 20 nebo > 1000) se pod polem objeví
  vysvětlení, co to udělá a co je doporučené.
- **Dlaždice „Ponechat"** — počet kusů s kladným verdiktem, aby při ladění prahů
  bylo vidět, co ta změna udělala. Klik na ni tabulku vyfiltruje (i v nabídce
  *Zobrazit* jako „Jen ponechat"). Změna prahu překresluje **celou tabulku**, ne
  jen dopočítané buňky — jinak by pod aktivním filtrem seděly staré řádky.
- **Výchozí kalibrace prahů** — 2 kopie druhu, IV 90 %, PvP potenciál 96 %,
  elitní rank 100, min. IV pro TOP roli 13. Změřeno na reálném rosteru
  (389 řádků): 1 kopie / IV 90 / PvP 98 nechá 41 kusů, 2 / 90 / 96 jich nechá 57,
  3 / 90 / 96 už jen 60 — třetí kopie druhu nepřidá skoro nic, proto dvojka.
  Prahy se ukládají do profilu, takže **starší profil si drží své staré hodnoty**;
  tlačítko **„Nastavit doporučené"** v nastavení je vrátí na tuhle kalibraci.
  (Testy, které chování prahů ověřují, si je nastavují natvrdo — nesmí viset na
  výchozích hodnotách appky.)
- **Správce smazaných** — tlačítko „Smazané (N)" otevře panel se seznamem toho,
  co import přeskakuje: jméno, CP, level a datum smazání. Dá se v něm **hledat**
  a **vrátit jednotlivý kus** — s každým zápisem se odkládá i kopie řádku, takže
  se vrátí rovnou do rosteru včetně IV, bez importu. Zápisy z dřívějška kopii
  nemají a nabízejí jen *Odblokovat* (vrátí se s dalším importem CSV); dřív šlo
  jen „zapomenout všechno". 345 odložených řádků zabere v localStorage ~146 kB.
  Volba
  **Paměť držet** (30 / 60 / 90 dní / navždy, výchozí 60) zápisy nechá vypršet,
  aby paměť po roce hraní nerostla do tisíců. Prořezává se při načtení appky
  i při změně volby. Záznamy ze starších profilů nemají datum smazání, takže
  jim ho appka dorazí na „teď" — expirace jim začne běžet od upgradu, ale
  nezůstanou v paměti navždy.
- **Prázdný filtr řekne proč** — dřív po filtru bez shody zbyla holá tabulka a
  vypadalo to jako rozbitá appka. Teď je v ní věta s názvem filtru, počtem kusů
  v rosteru a tlačítkem „Zrušit filtry"; u Dynamaxu navíc poradí naimportovat
  roster znovu (starší import ten sloupec nemá). Hláška je přišpendlená k levému
  okraji, aby při 1800 px široké tabulce zůstala vidět.
- **Oblíbení ze hry = hvězdička** — Calcy exportuje i sloupec `Favorite`
  (srdíčko v Pokémon GO) a import ho automaticky napojí na hvězdičku. Značka
  tedy funguje oběma směry: co si označíš ve hře, dorazí i do trackeru.
  Ruční hvězdička se přepsat nedá, import jen doplňuje prázdné.
- **Mega evoluce** — sloupec navíc s prioritou pro raidy (mega boost pomáhá celé
  skupině), s ohledem na to, že mega dává smysl jen u nejlepší kopie.
- **Profily** — víc rosterů vedle sebe, každý s vlastními prahy (víc lidí na
  jednom počítači, cizí export k posouzení, druhý účet). Data se drží pod klíčem
  `pgo_tracker_v2` jako `{ active, profiles }`, starý jednorosterový formát se
  při prvním spuštění zmigruje.
  **Hotové a otestované, ale schované** — `PROFILES_ENABLED = false` v appce
  skryje přepínač, protože zatím každý jede na svém počítači. Zapnout, až budou
  rostery víc lidí vedle sebe k něčemu (návrhy na tradování mezi hráči).
- **Perzistence v prohlížeči** — roster se ukládá do `localStorage` (klíč
  `pgo_tracker_v2`), takže po zavření stránky o data nepřijdeš. Zápis je
  odložený při psaní, ale okamžitý při importu/přidání/smazání, plus pojistka
  na `beforeunload`. Když prohlížeč ukládání nepovolí, appka to **řekne** místo
  aby tvářila, že uložila.
- Filtry (včetně „jen duplicity“ a „jen mega“), řazení, souhrnné dlaždice,
  export CSV (stejné pořadí sloupců jako list `Import` v Excelu).

**Rozdíl proti Excelu:** web řadí kopie stejného druhu podle *PvP ranku a pak
IV %* a chrání nejlepší kus pro každou roli zvlášť; Excel řadí jen podle IV %
a roli řešit neumí (nešlo by to bez pomocných sloupců navíc). Web je proto
přesnější — Excel je záložní varianta pro toho, kdo chce zůstat v tabulce.

## Důležitá omezení a otevřené otázky

1. **Export z Calcy IV je odladěný na reálném souboru** (`tests/fixtures/calcy_iv_export.csv`,
   51 sloupců) a mapuje se sám. **Poké Genie ověřené není** — na to chybí vzorek;
   mapovací UI a čtení IV z přezdívek to ale pokryjí i tak.
   **Shadow i Purified se načtou** — Calcy IV je píše do jména (`Girafarig Shadow`),
   tracker to přesune do sloupce Forma a jméno nechá čisté. Sloupce `Form`
   a `ShadowForm` se ignorují (vnitřní číselná ID; `ShadowForm = 7` je zjevně
   „druh má mega evoluci", ne shadow). Fixture: `tests/fixtures/calcy_shadow_export.csv`.
2. **Žádné API napojení na Pokémon GO účet** a nemá být implementováno přes
   neoficiální/reverse-engineered cesty (ToS, riziko banu).
3. **Excel a web se rozcházejí ve schopnostech.** Web má herní data
   (finální evoluce, typy, PvP stat product, role-aware ochranu kopií), Excel
   ne — ten pořád spoléhá na ručně vyplněný sloupec „Finální evoluce" a řadí
   kopie jen podle IV %. Dostat 1051 druhů do sešitu by šlo, ale zatím to
   nemá cenu — web je hlavní nástroj.
4. **PvP/raidové žebříčky nejsou „zamražená pravda"** — meta se mění s balance
   patchi. Data v `reference.json` jsou vědomě „dlouhodobě stabilní jádro“, ne
   aktuální tier list s % výher.
5. **Mega seznam se rozrůstá.** Niantic přidává nové mega formy průběžně;
   `tools/augment_reference.py` obsahuje ručně udržovaný seznam k ověření.

## Nápady na pokračování

- Doladit aliasy sloupců podle reálného exportu z Poké Genie.
- Doplnit útoky (move data) → skutečné DPS/TDO pro raidy místo matchování jmen.
Kompletní rozbor stavu, limitů a priorit je v [docs/analyza.md](docs/analyza.md).
Ve zkratce: P1 = PvP útoky (jediné místo, kde engine ignoruje movesety),
plná typová tabulka s counter módem, a raidové žebříčky počítat z dat místo
ručního seznamu.
- Zvážit Google Drive konektor, pokud Poké Genie umí zálohovat export na Drive.
- Doplnit do Excelu roli-aware ochranu kopií (teď ji má jen web).
- Čtvrtletně ověřit meta proti PvPoke.com / Pokémon GO Hub.

## Jak spustit / re-generovat

### web app (hlavní nástroj)
```
web-app/pokemon_tracker_app.html
```
Stačí otevřít v prohlížeči. Žádný build, žádné závislosti.

### PvP meta (po balance patchi)
```bash
python tools/build_meta.py --refresh
```

### herní data (pokédex)
```bash
python tools/build_pokedex.py            # z cache v data/raw/
python tools/build_pokedex.py --refresh  # stáhne znovu z pogoapi.net
```

### data → web (nutné po každé změně JSONů)
```bash
python tools/sync_reference.py
```

### xlsx reference tabulka
```bash
cd xlsx-reference && python build_xlsx.py
```

### xlsx tracker
```bash
cd xlsx-tracker && python build_tracker.py
```

### docx guide
```bash
cd docx-guide && npm install && node assemble.js
```

Python potřebuje `openpyxl` (`python -m pip install openpyxl`).
Všechny buildy ukládají výstup vedle svého skriptu.

## Ověřování

### regresní test webové appky
```bash
node tests/web_app.test.mjs
```
187 kontrol v headless Chromiu: načtení bez chyb v konzoli, automatické mapování
sloupců na exportu ve stylu Poké Genie, rozpoznání Shadow/Lucky, logika
duplicit, mega/gym/raid/PvP verdikty, perzistence po reloadu, zachování focusu
při psaní, filtry, export CSV a round-trip import zpět. Devátá sekce ověřuje
herní data: automatické rozpoznání finální evoluce (včetně rozdílu běžný vs
galarský Farfetch'd), typy regionálních forem, mega formy a PvP stat product.
Desátá sekce ověřuje čtení IV z přejmenovaných přezdívek, jedenáctá jede proti
skutečnému exportu z Calcy IV (mapování 51 sloupců, nejednoznačné skeny,
pohlavím omezené evoluce), dvanáctá a třináctá slučování opakovaných skenů (včetně případu tentýž kus naskenovaný před vylepšením i po něm), čtrnáctá a patnáctá profily, šestnáctá tradování a předvýběr na doskenování, sedmnáctá přehled zdrojů a hlídání stáří dat, osmnáctá režimy opakovaného importu, devatenáctá strop CP a to, že CP není měřítko kvality, dvacátá rozvržení stránky, jednadvacátá rozhodné verdikty, dlaždice jako filtry, typová efektivita a paměť na smazané kusy, dvaadvacátá výběr podle data skenu a odlišení znovu chyceného kusu, třiadvacátá import jen doskenovaných kusů, čtyřiadvacátá útoky a movesety, pětadvacátá cena vylepšení, šestadvacátá čitelnost tabulky, sedmadvacátá counter mód, osmadvacátá hledání, řazení a plán investic, devětadvacátá tahák na ven, třicátá krátká okna skenů a seznam k transferu, jedenatřicátá měření proti špičce, dvaatřicátá seznam nechat/pustit, třiatřicátá Shadow/Purified z reálného exportu, čtyřiatřicátá rada k purifikaci.
Playwright se bere z `../playwright-day2/node_modules` (nestahuje se znovu).

### kontrola vzorců v trackeru
```bash
python tools/check_tracker.py
```
Projde všech 12 500 vzorců: vyvážené závorky a uvozovky, jen funkce
kompatibilní s Google Sheets, žádné `_xlfn`, existující odkazované listy,
párování řádků `Import` ↔ `Doporučení`.

**Pozor:** tohle je strukturální kontrola, ne přepočet. Na téhle mašině není
LibreOffice ani Excel, takže hodnoty vzorců (dřív se ověřovaly přes
`soffice --headless` recalc) po posledních změnách **spočítané nebyly**. Až
tracker poprvé otevřeš, projeď očima list `Doporučení`.

### docx
Renderoval se přes LibreOffice headless → `pdftoppm` → vizuální kontrola.
Guide se od té doby needitoval.

## Sdílení appky někomu dalšímu

Stačí poslat **jeden soubor**: `web-app/pokemon_tracker_app.html`. Žádná
instalace, žádné závislosti — dvojklik a běží.

**Roster v tom souboru není.** Data žijí v `localStorage` prohlížeče na tom
počítači, kde se appka otevře; ověřeno, že to funguje i při otevření přes
`file://` a přežije to zavření. Dva lidé na dvou počítačích proto vidí každý
jen svoje, i když otevírají tentýž soubor ze sdílené složky.

`tools/deploy.ps1` to zkopíruje do OneDrive složky (kolegyně je na svém PC
přihlášená stejným OneDrivem, takže se jí soubor sám aktualizuje — jen ho znovu
otevře). Skript před kopírováním zapeče čerstvá data a **odmítne poslat appku,
ve které by byly stopy CSV exportu**.

Do sdílené složky nikdy nepatří vlastní `history_*.csv` — ten roster obsahuje.

## Návody pro uživatele

- [docs/analyza.md](docs/analyza.md) — rozbor stavu: co appka počítá a odkud,
  kde se může mýlit, nevyužitá data a priority dalšího vývoje.

- [docs/navod-import-dat.md](docs/navod-import-dat.md) — jak dostat pokémony
  z telefonu do appky krok po kroku, včetně vysvětlení, proč se k účtu nedá
  připojit napřímo. Doporučená cesta: **Calcy IV na Androidu, zdarma i s CSV
  exportem**; pro iPhone a pro případ bez exportu jsou tam bezplatné náhrady
  (rename trick, jen jména druhů).

## Uživatel

Komunikuje česky, preferuje přímé jednání a věcné vysvětlení omezení.
Časová zóna Europe/Prague.
