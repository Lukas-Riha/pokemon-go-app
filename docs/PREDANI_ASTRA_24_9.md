# Co appka doopravdy umí — podklad pro nové návrhy (24. 9. 2026)

Od Clauda pro Astru. Tvoje návrhy Přehledu, Kalendáře a Vyhledávání jsou
hotové a rozvržení z nich beru jako předlohu. Tenhle soubor říká, **čím se
dají naplnit skutečnými daty** a kde předloha slibuje něco, co appka neví —
ať se to dá v další verzi návrhů rovnou zohlednit.

Kontrakt enginu je v `ATLAS_KONTRAKT.md`, tohle ho nenahrazuje. Je to
odpověď na jedinou otázku: **co tam může být napsané, aby to byla pravda.**

---

## Pravidlo číslo jedna: data se mění každý den

Rozpis akcí se stahuje z LeekDucku při každé stavbě. Z toho plyne pár věcí,
které v návrzích zatím nejsou:

- **Počty nejsou pevné.** Tři karty na Přehledu jsou dnes tři, zítra může
  být jedna nebo osm. Dva obrázky u akce můžou být příště tři nebo žádný.
  Rozvržení musí obojí unést.
- **Názvy jsou dlouhé a ošklivé.** Skutečné akce se jmenují
  „Choose Your Path: Twilight Trails", „adidas × Pokémon Timed Research"
  nebo „Shadow Thundurus (Incarnate)". V návrhu jsou „Raidová hodina"
  a „Bonus k chytání". **Karta musí počítat se dvěma řádky názvu** a nesmí
  se jí přitom posunout štítek ani termín proti sousední kartě.
- **Leccos chybí.** Akce často nemá potvrzený čas, druh ani bonus. Pro
  každý údaj potřebuju vědět, co se má stát, když není — a „nechat prázdno"
  není odpověď.

---

## Přehled

### Co je v datech u každé akce

Jedna akce nese: název, typ, začátek, konec, odkaz na zdroj a k tomu
**okna** — časové úseky, a v nich bloky:

| blok | co v něm je | použitelné na |
| --- | --- | --- |
| `bonus` | věty typu „2× XP za chycení Nice Throwem" | **konkrétní věta pod název karty** |
| `novinky` | co je nové; pod nadpisem „Featured Pokémon" je hlavní druh | **hlavní ilustrace** |
| `spawn` | co se objevuje ve volné přírodě | doplňkové ikony, „Co teď potkáš" |
| `raid` | raidoví bossové | panel Raidy / Max |
| `vyzkum` | úkoly a odměny | detail akce |

Každá položka je dvojice `[text, příznak]`: `-1` je nadpis, `1` je pokémon,
`0` je obyčejný text. **Druh se tedy nepozná z názvu akce, ale z dat** —
tohle jsme minulý týden opravovali, protože „Phantump Catch Mastery"
ukazoval Cherubi a Drifloona.

### Obrázky: scéna + druh

Máme **dvě malované scény** (`atlas/assets`) a k nim oficiální artwork
druhu. Vlastní ilustrace pro každou akci, jak je v návrhu, nejde — musela
by se vyrábět ručně ke každé nové akci a v buildu na to není zdroj.
Uživatel to potvrdil jako v pořádku: **kompozice scéna + druh**, lepší časem.

Prakticky to znamená: navrhuj kartu tak, aby fungovala s **jednou scénou
a jedním až třemi druhy přes ni**. A počítej s tím, že druh může chybět
úplně — pak zůstane samotná scéna.

Velikosti obrázků na Přehledu jsou teď pevné a **nezvětšují se s oknem**
(dřív rostly z 248 na 298 px a pokémon kartu vyplnil). Když budeš chtít
jinou velikost, řekni číslo — je to jedna hodnota.

### Co pod názvem může stát jako konkrétní věta

V tomhle pořadí, první co existuje:

1. **hlavní bonus** z bloku `bonus` (skutečná věta z dat),
2. **hlavní druh** („Phantump ve volné přírodě"),
3. **časové okno**, když je kratší než celá akce („jen 18:00–19:00"),
4. když nic z toho, pak **„Podrobnosti ve zdroji"** a odkaz — ne vymyšlený
   bonus.

### Panely Raidy a Max

Raidy ukazují, co běží teď. Max panel se jmenuje **„Nejbližší Max akce"**,
když dnešní okno potvrzené není, aby se budoucí Sobble nečetl jako boss
dostupný právě teď. Ikony bossů mají pevných 100 px.

„Připravit tým" u raidové akce **přenese bosse do rosteru** a seřadí ho
podle toho, kdo se na jeho typy hodí nejlíp — funguje i u akce, která
zrovna neběží. Když appka druh nezná, otevře Tahák.

### Týdenní pruh

Každý den nese tečku „má akce". **Dnešek je označený slovem „dnes"**
místo zkratky dne, protože tečka už je obsazená a dva modré rámečky vedle
sebe se bez legendy nedaly rozlišit. Vybraný den má modrou plochu.

---

## Kalendář

Data jsou tatáž jako na Přehledu. Co stojí za pozornost v návrhu:

- **Pořadí vícedenních pruhů.** Dnes se berou první tři podle data, takže
  nahoře skončí sezóna a LEGO — tedy to nejméně akční. Patří tam krátké
  akce a ty, co brzy končí; dlouhé pod ně.
- **Jedno tlačítko na jednu akci.** U běžné události dělala obě totéž;
  teď je jedno „Detail události". Druhý odkaz dává smysl jen jako
  „Oficiální zdroj", a to jen když zdroj opravdu známe.
- **Detail akce** má nést dva až tři konkrétní body z dat (druhy / bonus /
  omezení), ne obecnou větu. Data na to jsou, viz tabulka bloků výš.
- **Prázdné dny.** Výška sloupce má vycházet z obsahu; prázdný stav po
  zavření detailu má být klidný, ne druhý seznam týchž karet.

---

## Vyhledávání

Tvůj návrh A-013 sedí na to, co engine umí. Tři věci navíc, které si přál
uživatel a **data na ně existují**:

| údaj | odkud | poznámka |
| --- | --- | --- |
| **Má druh shiny verzi?** | pogoapi `shiny_pokemon.json` | Ví i **odkud** shiny padá: raid / volná příroda / vajíčko / výzkum / evoluce. U raidového bosse tedy umíme říct „shiny z raidu ano/ne". |
| **CP hunda (15/15/15)** | základní staty + CPM | Dvě čísla: **L20** (běžný raid) a **L25** (boostnuté počasím). Přesně ta dvojice z herních infografik. Engine k tomu dostane malou funkci navíc. |
| **Jaké počasí ho boostuje** | `data/raw/weather_boosts.json` | `Clear: Grass/Ground/Fire`, `Rainy: Water/Electric/Bug`, … Data jsou stažená, ale zatím se do appky nezapékají. |

Kam bych je dal: **do hlavičky druhu, vedle typů.** Je to trojice údajů,
kterou člověk chce vidět dřív, než se rozhodne jít na raid — stejně jako
je má herní infografika hned nahoře. Shiny jako malá ikona u jména, CP
hunda jako dvojice čísel s popiskem „L20 / L25 v boostu", počasí jako
ikona počasí u druhé hodnoty.

Platí to jen pro **raidové bosse**; u divokých spawnů to smysl nedává
a uživatel to sám vyloučil.

---

## Co appka neumí a v návrzích to je

Ne jako výtka — jen ať se s tím počítá:

- **„Zkontroluj předměty", „Slaď se s týmem", „Otevři mapu"** v patě
  Přehledu. Appka nezná inventář, přátele ani polohu. Buď to zmizí, nebo
  se z toho stane odkaz na něco skutečného (např. „Doplnit útoky · 12 kusů",
  což appka spočítat umí).
- **Notifikační zvoneček** na mobilu. Upozornění zatím nejsou.
- **„Více Legendary raidů s Lugiou"** a podobné věty — to jsou vymyšlené
  texty. Skutečné bonusy jsou v datech a znějí jinak, viz výš.
- **Percentily a „šance na výhru"** ve Vyhledávání. Engine dává pořadí
  druhu a kvalitu kusu; pravděpodobnost výhry nepočítá a neměla by se
  dopočítávat ve vzhledu.

---

## Technické mantinely

- **Nesahej do enginu** (`web-app/pokemon_tracker_app.html`). Při každém
  nasazení ho přepisuje build, takže by ses o změny připravila. Všechno
  patří do `atlas.css`, `atlas.js` a `calendar.js`. Když budeš potřebovat
  data, která engine nenabízí, napiš to do předání — doplním do něj funkci
  a přidám ji do kontraktu.
- **Rozvržení musí držet do 500 px** šířky. Pod tím se appka nepodporuje.
- **Roster má i přes čtyři sta kusů.** Cokoli, co se kreslí pro každý kus,
  se násobí čtyřmi sty.
- **Neměř sprity za běhu.** Vystřeďování spritů je na Přehledu a v kalendáři
  vypnuté schválně: výsledek závisel na tom, co už prohlížeč stihl změřit,
  takže tatáž appka vypadala pokaždé jinak.
- **Testuj na profilu s daty, ne na prázdném.** Prázdný profil schová
  celou třídu chyb — stálo nás to jeden celý den.

## Než pošleš nové návrhy

Pomůže mi, když u každého nového prvku bude jasné:

1. **odkud se bere text** (které pole dat), a
2. **jak vypadá, když chybí.**

Tohle jsou jediné dvě věci, kvůli kterým se návrh obvykle nedá postavit
jedna ku jedné. Všechno ostatní — mřížka, rozestupy, typografie, barvy,
tvary, mobilní rozvržení — beru jako závazné a dotáhnu do detailu.
