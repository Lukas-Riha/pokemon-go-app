# Analýza stavu trackeru

Stav k 20. 8. 2026. Prošel jsem každý sloupec, každý výpočet a všechna dostupná
data. Níže je co appka umí, kde se může mýlit, co leží nevyužité a v jakém
pořadí to dodělat.

---

## 1. Co appka počítá a odkud to bere

| sloupec | zdroj | jistota |
|---|---|---|
| Pokémon, Forma, CP, Level, IV | import z Calcy IV | **vstup** |
| IV % | dopočet ze tří IV | **tvrdé** |
| Typy | herní data | **tvrdé** |
| CP na L40 (+ po evoluci) | base staty × CPM, evoluční řetězec | **tvrdé** |
| Silný proti typům | typy útoků (nebo typy druhu) × typová tabulka | **tvrdé**, ale zjednodušené |
| Kopie | seskupení podle druhu a formy | **tvrdé** |
| Ponechat/Zahodit | kombinace všeho níže | odvozené |
| Vylepšit? + cena v prachu | role + tabulka cen vylepšení | cena **tvrdá**, priorita odvozená |
| Evolvovat? | evoluční řetězec + pohlaví | **tvrdé** |
| Mega evoluce? | herní data + ruční priorita | forma tvrdá, priorita odvozená |
| Do gymu? | Def × HP ÷ průměrný příchozí násobek typů × útok obránce, přes všech 1110 druhů | **tvrdé** (váha útoku 30 % je odhad) |
| Do raidu? | DPS cyklu útoků × útočný stat × (Obrana × HP)^¼ (metrika ER), žebříček na typ; druhá podmínka na čisté poškození | **tvrdé** |
| PvP tým? | PvPoke top 200 + stat product | žebříček komunitní, výpočet tvrdý |
| PvP potenciál | stat product z IV vs. maximum druhu | **tvrdé** |
| Útoky | DPS movesetu vs. nejlepší možný | **tvrdé** (model, viz limity) |
| Tradovat? | seznam 10 trade evolucí + IV | **tvrdé** |
| Doskenovat s Appraisal? | rozsah IV × hodnota druhu | odvozené |

**Ověření:** 187 automatických kontrol v headless Chromiu (`node tests/web_app.test.mjs`)
+ 12 500 vzorců v Excel trackeru (`python tools/check_tracker.py`). Testy jedou
mimo jiné proti **skutečnému exportu z telefonu** (`tests/fixtures/calcy_iv_export.csv`).

---

## 2. Co jsem při téhle analýze opravil

**Model DPS byl naivní.** Původně jsem počítal cyklus jako „n rychlých útoků +
jeden nabitý". Ten vzorec přeceňuje útoky s vysokou energií: Metagrossovi
vycházel Fury Cutter (Bug) líp než Bullet Punch (Steel). To je v raidu nesmysl —
Bug útok proti Fairy bossovi nic neudělá, zatímco Steel dvojice ano. Přepsáno na
běžně používaný vážený vzorec a **dvojice se stejným typem mají přednost**.

**Elitní útoky se doporučovaly kvůli 0,3 %.** Machampovi to radilo Karate Chop
(Elite TM) místo Counter kvůli rozdílu pod procento. Elitní útok teď musí být
aspoň o 2 % lepší, jinak vyhraje běžný.

**Moveset se hodnotil proti jedinému „nejlepšímu".** Tyranitar je špičkový Rock
i Dark útočník; porovnávat jeho Rock moveset s Dark nejlepším znamenalo tvrdit,
že má špatné útoky. Teď se hodnotí **v rámci role** a zvlášť se řekne, že jinde
by byl silnější.

**Duplicita se stejnými IV.** Při shodě vyhrával náhodný kus; teď vyhrává ten
s vyšším levelem, protože je levnější dotáhnout ho na L40.

---

## 3. Kde se to pořád může mýlit

| limit | dopad | jak poznat |
|---|---|---|
| **Raidové skóre nezná konkrétního bosse ani dodging** | Výdrž se počítá obecně (ER metrika), ne proti tomu, co boss hází. | Po výběru typu bosse se přepočítá aspoň typová výhoda. |
| **PvP ignoruje útoky úplně** | V PvP mají útoky jiné hodnoty (tahové, s buffy). Doporučení „PvP tým" stojí jen na stat productu a žebříčku. | Kus s ideálními IV a mizerným PvP movesetem projde jako dobrý. |
| **Raidový a gymový seznam už ruční není** | Oba se počítají z `pokedex.json` + `moves.json`. Ruční seznam zůstal jen jako záložka pro mega formy, které nemají vlastní learnset. | Bublina u role říká, kolik % špičky ten kus odvede a odkud to číslo je. |
| **Shadow/Purified se nenačte** | Ovlivňuje raid i to, jestli se dá tradovat. | Sloupec Forma zůstane prázdný. |
| **„Silný proti" je zkratka** | Sloupec ukazuje čisté typy; v detailu se počítá přes všech ~159 reálných kombinací včetně dvojitých slabin (2,56×) a vyrušení. | Sekce „Proti čemu to reálně funguje". |
| **CPM tabulka jde do L50** | Zdroj končí na L45; levely 45,5–50 se dopočítávají (od L40 roste CPM lineárně o 0,0025 na půl levelu, extrapolace sedí na známé L50 = 0,8403). | Sanity check v `build_pokedex.py` spadne, když by extrapolace na L50 nevyšla. |
| **Počet bonbónů neznáme** | Nejde říct „na tuhle evoluci ti chybí 40 bonbónů". | V exportu ta informace není. |

---

## 4. Data, která leží nevyužitá

Vše veřejně dostupné a ověřeně stažitelné z pogoapi.net:

| dataset | velikost | co by přineslo |
|---|---|---|
| `pvp_fast_moves` + `pvp_charged_moves` | 64 kB | Správné hodnocení PvP movesetu (jiná mechanika než raidy) |
| `type_effectiveness` | 8 kB | Plná typová tabulka včetně odolností → „slabý proti", přesné counters |
| `shadow_pokemon` | 16 kB | Které druhy vůbec můžou být Shadow |
| `pokemon_candy_to_evolve` | 88 kB | Cena evoluce v bonbónech → vyčíslit úsporu z trade evoluce |
| `weather_boosts` | 0,5 kB | „Dnes je slunečno, tvoji Fire útočníci jsou boostnutí" |
| `pokemon_buddy_distances` | 210 kB | Plánování farmení bonbónů |
| `released_pokemon` | 61 kB | Odfiltrovat druhy, které ve hře ještě nejsou |
| `raid_exclusive_pokemon` | 3 kB | Označit druhy dostupné jen z raidů |

Už se používá: pokédex (typy, staty, evoluce, mega, CPM, ceny vylepšení),
útoky (77 rychlých, 235 nabitých, learnsety 1051 druhů), PvPoke žebříčky.

---

## 5. Co dodělat a v jakém pořadí

### P1 — mění kvalitu doporučení

1. **PvP útoky (`pvp_*_moves`).** Teď je PvP jediná role, kde se moveset úplně
   ignoruje. Kus s perfektními IV a špatnými PvP útoky projde jako dobrý pick,
   což je zavádějící. Práce: podobná jako raidové útoky, model je ale jiný
   (tahy, energie, buffy).
2. **Plná typová tabulka.** Umožní „slabý proti" a hlavně **counter mód**:
   vyber typ bosse a appka seřadí tvoje pokémony podle toho, kdo mu ublíží
   nejvíc a zároveň nejmíň schytá. To je věc, kterou u raidů reálně potřebuješ.
3. **Raidové žebříčky počítat z dat.** Nahradit ručních 70 útočníků výpočtem
   (base staty × nejlepší moveset). Zmizí poslední ručně udržovaný seznam
   a přestane to zastarávat.

### P2 — praktická vylepšení

4. **Shadow/Purified.** Species-level ze `shadow_pokemon` + domapování sloupce
   z reálného vzorku (čeká se na řádek se Shadow a Purified kusem).
5. **Export doporučení.** Dnes export obsahuje jen vstupní data. Seznam „tohle
   zahodit / tohle přeučit" v podobě, kterou si otevřeš na telefonu u boxu,
   uzavře smyčku — jinak si to musíš pamatovat.
6. **Cena evoluce v bonbónech** a vyčíslení úspory z trade evoluce
   („ušetříš 100 bonbónů").
7. **Řazení podle verdiktů.** Teď se řadí jen podle jména, CP, IV a ranků;
   klikací řazení podle „Vylepšit" nebo „Útoky" by se hodilo.

### P3 — příjemné, ne nutné

8. **Počasí** — dnešní boostnuté typy zvýraznit v typových filtrech.
9. **Hromadné akce** — „označ všechny k zahození jako smazané" jedním klikem.
10. **Buddy vzdálenosti** — plánování farmení bonbónů u kusu, kterému chybí
    bonbóny na evoluci.

---

## 6. Doporučení

Kdybych měl vybrat jednu věc: **P1.2 (plná typová tabulka + counter mód)**.
Sloupec „Silný proti typům" a typové filtry už existují, ale pracují jen se
super efektivitou. S plnou tabulkou z toho je nástroj, který ti před raidem
rovnou řekne šestku, kterou nasadit — a to je situace, kdy se appka reálně
otevírá.

Druhá v pořadí je **P1.1 (PvP útoky)**, protože je to jediné místo, kde appka
tvrdí něco, co může být falešné.
